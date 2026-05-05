"""add online trials module and projet role

Revision ID: 20260503_0011
Revises: 20260430_0010
Create Date: 2026-05-03
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260503_0011"
down_revision = "20260430_0010"
branch_labels = None
depends_on = None


maintenance_state_enum = postgresql.ENUM(
    "OK",
    "A_SURVEILLER",
    "PFL",
    "PV",
    "A_REPARER",
    "CRITIQUE",
    name="maintenancestate",
    create_type=False,
)
severity_enum = postgresql.ENUM(
    "NIVEAU_1",
    "NIVEAU_2",
    "NIVEAU_3",
    "NIVEAU_4",
    "NIVEAU_5",
    name="severity",
    create_type=False,
)
alert_status_enum = postgresql.ENUM(
    "EN_COURS_DE_TRAITEMENT",
    "A_MODIFIER",
    "MODIFIEE",
    "TRAITEE_PAR_PM",
    "ANNULEE",
    "RECEPTION_PARTIELLE",
    "RECEPTION_COMPLETE",
    name="alertstatus",
    create_type=False,
)
decision_kind_enum = postgresql.ENUM(
    "CONFIRMER",
    "ANNULER",
    name="decisionkind",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_enum e
                    JOIN pg_type t ON e.enumtypid = t.oid
                    WHERE t.typname = 'userrole'
                      AND e.enumlabel = 'PROJET'
                ) THEN
                    ALTER TYPE userrole ADD VALUE 'PROJET';
                END IF;
            END
            $$;
            """
        )

    op.create_table(
        "online_trial_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("station_id", sa.Integer(), sa.ForeignKey("stations.id"), nullable=False),
        sa.Column("material_type", sa.String(length=120), nullable=False),
        sa.Column("material_ref", sa.String(length=120), nullable=False),
        sa.Column("material_concerned", sa.Text(), nullable=True),
        sa.Column("request_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("speed_kmh", sa.Integer(), nullable=True),
        sa.Column("transport_mode", sa.String(length=80), nullable=False, server_default="FRET"),
        sa.Column("transport_type", sa.String(length=80), nullable=False, server_default="HLP"),
        sa.Column("problem_description", sa.Text(), nullable=False),
        sa.Column("maintenance_state", maintenance_state_enum, nullable=False),
        sa.Column("severity", severity_enum, nullable=False),
        sa.Column("transport_conditions_initial", sa.Text(), nullable=False),
        sa.Column("status", alert_status_enum, nullable=False),
        sa.Column("pm_reference_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("trial_material_progress", sa.Text(), nullable=True),
    )
    op.create_index("ix_online_trial_requests_created_at", "online_trial_requests", ["created_at"], unique=False)
    op.create_index("ix_online_trial_requests_status", "online_trial_requests", ["status"], unique=False)
    op.create_index("ix_online_trial_requests_severity", "online_trial_requests", ["severity"], unique=False)

    op.create_table(
        "online_trial_status_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "trial_id",
            sa.Integer(),
            sa.ForeignKey("online_trial_requests.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", alert_status_enum, nullable=False),
        sa.Column("changed_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("changed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
    )
    op.create_index(
        "ix_online_trial_status_history_trial_id",
        "online_trial_status_history",
        ["trial_id"],
        unique=False,
    )

    op.create_table(
        "online_trial_decisions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "trial_id",
            sa.Integer(),
            sa.ForeignKey("online_trial_requests.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("permanent_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("decision", decision_kind_enum, nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("material_decisions", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "online_trial_attachments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "trial_id",
            sa.Integer(),
            sa.ForeignKey("online_trial_requests.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("stored_path", sa.String(length=500), nullable=False),
        sa.Column("content_type", sa.String(length=120), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        "ix_online_trial_attachments_trial_id",
        "online_trial_attachments",
        ["trial_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_online_trial_attachments_trial_id", table_name="online_trial_attachments")
    op.drop_table("online_trial_attachments")
    op.drop_table("online_trial_decisions")
    op.drop_index("ix_online_trial_status_history_trial_id", table_name="online_trial_status_history")
    op.drop_table("online_trial_status_history")
    op.drop_index("ix_online_trial_requests_severity", table_name="online_trial_requests")
    op.drop_index("ix_online_trial_requests_status", table_name="online_trial_requests")
    op.drop_index("ix_online_trial_requests_created_at", table_name="online_trial_requests")
    op.drop_table("online_trial_requests")
