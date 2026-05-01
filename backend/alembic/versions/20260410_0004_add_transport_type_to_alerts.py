"""add transport type to alerts

Revision ID: 20260410_0004
Revises: 20260410_0003
Create Date: 2026-04-10
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260410_0004"
down_revision = "20260410_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("alerts") as batch_op:
      batch_op.add_column(sa.Column("transport_type", sa.String(length=20), nullable=True))

    op.execute("UPDATE alerts SET transport_type = 'HLP' WHERE transport_type IS NULL")

    with op.batch_alter_table("alerts") as batch_op:
      batch_op.alter_column("transport_type", existing_type=sa.String(length=20), nullable=False)


def downgrade() -> None:
    with op.batch_alter_table("alerts") as batch_op:
      batch_op.drop_column("transport_type")
