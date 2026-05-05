"""add parcours directions to online trial requests

Revision ID: 20260505_0014
Revises: 20260505_0013
Create Date: 2026-05-05
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260505_0014"
down_revision = "20260505_0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "online_trial_requests",
        sa.Column("parcours_aller", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.add_column(
        "online_trial_requests",
        sa.Column("parcours_retour", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )


def downgrade() -> None:
    op.drop_column("online_trial_requests", "parcours_retour")
    op.drop_column("online_trial_requests", "parcours_aller")
