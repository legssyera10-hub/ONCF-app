"""add dossier versioning fields to online trial requests

Revision ID: 20260505_0013
Revises: 20260504_0012
Create Date: 2026-05-05
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260505_0013"
down_revision = "20260504_0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("online_trial_requests", sa.Column("dossier_number", sa.Integer(), nullable=True))
    op.add_column("online_trial_requests", sa.Column("dossier_parent_id", sa.Integer(), nullable=True))
    op.add_column("online_trial_requests", sa.Column("dossier_iteration", sa.Integer(), nullable=True))

    with op.batch_alter_table("online_trial_requests") as batch_op:
        batch_op.create_foreign_key(
            "fk_online_trial_requests_dossier_parent_id",
            "online_trial_requests",
            ["dossier_parent_id"],
            ["id"],
        )

    op.execute("UPDATE online_trial_requests SET dossier_number = id WHERE dossier_number IS NULL")
    op.execute("UPDATE online_trial_requests SET dossier_iteration = 0 WHERE dossier_iteration IS NULL")

    with op.batch_alter_table("online_trial_requests") as batch_op:
        batch_op.alter_column("dossier_number", existing_type=sa.Integer(), nullable=False)
        batch_op.alter_column("dossier_iteration", existing_type=sa.Integer(), nullable=False)

    op.create_index(
        "ix_online_trial_requests_dossier_number",
        "online_trial_requests",
        ["dossier_number"],
        unique=False,
    )
    op.create_index(
        "ix_online_trial_requests_dossier_parent_id",
        "online_trial_requests",
        ["dossier_parent_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_online_trial_requests_dossier_parent_id", table_name="online_trial_requests")
    op.drop_index("ix_online_trial_requests_dossier_number", table_name="online_trial_requests")

    with op.batch_alter_table("online_trial_requests") as batch_op:
        batch_op.drop_constraint("fk_online_trial_requests_dossier_parent_id", type_="foreignkey")

    op.drop_column("online_trial_requests", "dossier_iteration")
    op.drop_column("online_trial_requests", "dossier_parent_id")
    op.drop_column("online_trial_requests", "dossier_number")
