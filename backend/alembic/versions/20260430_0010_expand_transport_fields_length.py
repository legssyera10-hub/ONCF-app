"""expand transport fields length

Revision ID: 20260430_0010
Revises: 20260428_0009
Create Date: 2026-04-30
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260430_0010"
down_revision = "20260428_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("alerts") as batch_op:
        batch_op.alter_column(
            "transport_mode",
            existing_type=sa.String(length=20),
            type_=sa.String(length=80),
            existing_nullable=False,
        )
        batch_op.alter_column(
            "transport_type",
            existing_type=sa.String(length=20),
            type_=sa.String(length=80),
            existing_nullable=False,
        )

    with op.batch_alter_table("alert_revisions") as batch_op:
        batch_op.alter_column(
            "transport_mode",
            existing_type=sa.String(length=20),
            type_=sa.String(length=80),
            existing_nullable=False,
        )
        batch_op.alter_column(
            "transport_type",
            existing_type=sa.String(length=20),
            type_=sa.String(length=80),
            existing_nullable=False,
        )


def downgrade() -> None:
    with op.batch_alter_table("alert_revisions") as batch_op:
        batch_op.alter_column(
            "transport_type",
            existing_type=sa.String(length=80),
            type_=sa.String(length=20),
            existing_nullable=False,
        )
        batch_op.alter_column(
            "transport_mode",
            existing_type=sa.String(length=80),
            type_=sa.String(length=20),
            existing_nullable=False,
        )

    with op.batch_alter_table("alerts") as batch_op:
        batch_op.alter_column(
            "transport_type",
            existing_type=sa.String(length=80),
            type_=sa.String(length=20),
            existing_nullable=False,
        )
        batch_op.alter_column(
            "transport_mode",
            existing_type=sa.String(length=80),
            type_=sa.String(length=20),
            existing_nullable=False,
        )
