"""add reception outcome statuses

Revision ID: 20260416_0005
Revises: 20260410_0004, 20260412_0002
Create Date: 2026-04-16
"""

from __future__ import annotations

from alembic import op


revision = "20260416_0005"
down_revision = ("20260410_0004", "20260412_0002")
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE alertstatus ADD VALUE IF NOT EXISTS 'RECEPTION_PARTIELLE'")
    op.execute("ALTER TYPE alertstatus ADD VALUE IF NOT EXISTS 'RECEPTION_COMPLETE'")


def downgrade() -> None:
    # PostgreSQL enum values cannot be dropped safely without recreating the type.
    pass
