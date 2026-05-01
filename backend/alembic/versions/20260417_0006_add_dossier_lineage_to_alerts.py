"""add dossier lineage to alerts

Revision ID: 20260417_0006
Revises: 20260416_0005
Create Date: 2026-04-17
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260417_0006"
down_revision = "20260416_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("alerts") as batch_op:
        batch_op.add_column(sa.Column("dossier_parent_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("dossier_iteration", sa.Integer(), nullable=False, server_default="0"))
        batch_op.create_index("ix_alerts_dossier_parent_id", ["dossier_parent_id"], unique=False)
        batch_op.create_foreign_key(
            "fk_alerts_dossier_parent_id_alerts",
            "alerts",
            ["dossier_parent_id"],
            ["id"],
        )


def downgrade() -> None:
    with op.batch_alter_table("alerts") as batch_op:
        batch_op.drop_constraint("fk_alerts_dossier_parent_id_alerts", type_="foreignkey")
        batch_op.drop_index("ix_alerts_dossier_parent_id")
        batch_op.drop_column("dossier_iteration")
        batch_op.drop_column("dossier_parent_id")
