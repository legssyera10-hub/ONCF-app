"""add alert metadata and outlook mailing

Revision ID: 20260412_0002
Revises: 20260310_0001
Create Date: 2026-04-12
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260412_0002"
down_revision = "20260310_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("alerts") as batch_op:
        batch_op.add_column(sa.Column("request_date", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("speed_kmh", sa.Integer(), nullable=True))

    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("outlook_email", sa.String(length=255), nullable=True))

    with op.batch_alter_table("establishments") as batch_op:
        batch_op.add_column(sa.Column("outlook_email", sa.String(length=255), nullable=True))

    op.create_table(
        "mail_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("alert_id", sa.Integer(), sa.ForeignKey("alerts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("triggered_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("event_type", sa.String(length=80), nullable=False),
        sa.Column("subject", sa.String(length=255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("sender_email", sa.String(length=255), nullable=True),
        sa.Column("recipient_emails", sa.Text(), nullable=False),
        sa.Column("delivery_status", sa.String(length=40), nullable=False, server_default="PENDING"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_mail_events_alert_id", "mail_events", ["alert_id"])


def downgrade() -> None:
    op.drop_index("ix_mail_events_alert_id", table_name="mail_events")
    op.drop_table("mail_events")

    with op.batch_alter_table("establishments") as batch_op:
        batch_op.drop_column("outlook_email")

    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("outlook_email")

    with op.batch_alter_table("alert_revisions") as batch_op:
        batch_op.drop_column("speed_kmh")
        batch_op.drop_column("request_date")

    with op.batch_alter_table("alerts") as batch_op:
        batch_op.drop_column("speed_kmh")
        batch_op.drop_column("request_date")
