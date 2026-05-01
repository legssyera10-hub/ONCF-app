"""add dossier number to alerts

Revision ID: 20260417_0007
Revises: 20260417_0006
Create Date: 2026-04-17
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260417_0007"
down_revision = "20260417_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("alerts", sa.Column("dossier_number", sa.Integer(), nullable=True))
    op.execute("UPDATE alerts SET dossier_number = id WHERE dossier_number IS NULL")
    op.execute(
        """
        UPDATE alerts
        SET dossier_number = (
            SELECT parent.dossier_number
            FROM alerts AS parent
            WHERE parent.id = alerts.dossier_parent_id
        )
        WHERE dossier_parent_id IS NOT NULL
        """
    )
    op.execute("UPDATE alerts SET dossier_number = id WHERE dossier_number IS NULL")

    op.alter_column("alerts", "dossier_number", existing_type=sa.Integer(), nullable=False)
    op.create_index("ix_alerts_dossier_number", "alerts", ["dossier_number"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_alerts_dossier_number", table_name="alerts")
    op.drop_column("alerts", "dossier_number")
