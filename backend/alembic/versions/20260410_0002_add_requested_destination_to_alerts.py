"""add requested destination establishment to alerts

Revision ID: 20260410_0002
Revises: 20260310_0001
Create Date: 2026-04-10
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260410_0002"
down_revision = "20260310_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("alerts") as batch_op:
        batch_op.add_column(sa.Column("requested_destination_establishment_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_alerts_requested_destination_establishment_id_establishments",
            "establishments",
            ["requested_destination_establishment_id"],
            ["id"],
        )


def downgrade() -> None:
    with op.batch_alter_table("alerts") as batch_op:
        batch_op.drop_constraint("fk_alerts_requested_destination_establishment_id_establishments", type_="foreignkey")
        batch_op.drop_column("requested_destination_establishment_id")
