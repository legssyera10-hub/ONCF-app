"""add missing tables and fields

Revision ID: 20260428_0009
Revises: 20260420_0008
Create Date: 2026-04-28
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260428_0009"
down_revision = "20260420_0008"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        "app_settings",
        sa.Column("key", sa.String(length=120), primary_key=True),
        sa.Column("value", sa.Text(), nullable=False, server_default=""),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    with op.batch_alter_table("alerts") as batch_op:
        batch_op.add_column(sa.Column("material_concerned", sa.Text(), nullable=True))

    with op.batch_alter_table("establishment_confirmations") as batch_op:
        batch_op.add_column(sa.Column("confirmed_material_indexes", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("material_confirmations", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("delay_minutes", sa.Integer(), nullable=True))

    op.create_table(
        "alert_attachments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("alert_id", sa.Integer(), sa.ForeignKey("alerts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("stored_path", sa.String(length=500), nullable=False),
        sa.Column("content_type", sa.String(length=120), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_alert_attachments_alert_id", "alert_attachments", ["alert_id"], unique=False)

def downgrade() -> None:
    op.drop_index("ix_alert_attachments_alert_id", table_name="alert_attachments")
    op.drop_table("alert_attachments")

    with op.batch_alter_table("establishment_confirmations") as batch_op:
        batch_op.drop_column("delay_minutes")
        batch_op.drop_column("material_confirmations")
        batch_op.drop_column("confirmed_material_indexes")

    with op.batch_alter_table("alerts") as batch_op:
        batch_op.drop_column("material_concerned")

    op.drop_table("app_settings")
