"""add transport mode to alerts

Revision ID: 20260410_0003
Revises: 20260410_0002
Create Date: 2026-04-10
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260410_0003"
down_revision = "20260410_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("alerts") as batch_op:
        batch_op.add_column(sa.Column("transport_mode", sa.String(length=20), nullable=True))

    op.execute("UPDATE alerts SET transport_mode = 'FRET' WHERE transport_mode IS NULL")

    with op.batch_alter_table("alerts") as batch_op:
        batch_op.alter_column("transport_mode", existing_type=sa.String(length=20), nullable=False)


def downgrade() -> None:
    with op.batch_alter_table("alerts") as batch_op:
        batch_op.drop_column("transport_mode")
