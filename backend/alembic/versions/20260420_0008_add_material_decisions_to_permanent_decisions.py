"""add material decisions to permanent decisions

Revision ID: 20260420_0008
Revises: 20260417_0007
Create Date: 2026-04-20
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260420_0008"
down_revision = "20260417_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("permanent_decisions", sa.Column("material_decisions", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("permanent_decisions", "material_decisions")
