"""initial schema

Revision ID: 20260310_0001
Revises:
Create Date: 2026-03-10
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260310_0001"
down_revision = None
branch_labels = None
depends_on = None


user_role = postgresql.ENUM(
    "AGENT",
    "PERMANENT",
    "ETABLISSEMENT",
    "ADMIN",
    "SUIVI",
    name="userrole",
    create_type=False,
)
maintenance_state = postgresql.ENUM(
    "OK",
    "A_SURVEILLER",
    "PFL",
    "PV",
    "A_REPARER",
    "CRITIQUE",
    name="maintenancestate",
    create_type=False,
)
severity = postgresql.ENUM(
    "NIVEAU_1",
    "NIVEAU_2",
    "NIVEAU_3",
    "NIVEAU_4",
    "NIVEAU_5",
    name="severity",
    create_type=False,
)
agent_decision = postgresql.ENUM("CONFIRMER", "ANNULER", name="agentdecision", create_type=False)
alert_status = postgresql.ENUM(
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
decision_kind = postgresql.ENUM("CONFIRMER", "ANNULER", name="decisionkind", create_type=False)


def upgrade() -> None:
    bind = op.get_bind()
    for enum_type in [
        user_role,
        maintenance_state,
        severity,
        agent_decision,
        alert_status,
        decision_kind,
    ]:
        enum_type.create(bind, checkfirst=True)

    op.create_table(
        "establishments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(length=50), nullable=False, unique=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("city", sa.String(length=120), nullable=False),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lon", sa.Float(), nullable=True),
    )
    op.create_table(
        "stations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(length=50), nullable=False, unique=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("region", sa.String(length=120), nullable=False),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lon", sa.Float(), nullable=True),
    )
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(length=80), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", user_role, nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("establishment_id", sa.Integer(), sa.ForeignKey("establishments.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_users_role", "users", ["role"])
    op.create_table(
        "alerts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("station_id", sa.Integer(), sa.ForeignKey("stations.id"), nullable=False),
        sa.Column("material_type", sa.String(length=120), nullable=False),
        sa.Column("material_ref", sa.String(length=120), nullable=False),
        sa.Column("problem_description", sa.Text(), nullable=False),
        sa.Column("maintenance_state", maintenance_state, nullable=False),
        sa.Column("severity", severity, nullable=False),
        sa.Column("transport_conditions_initial", sa.Text(), nullable=False),
        sa.Column("agent_decision", agent_decision, nullable=False),
        sa.Column("status", alert_status, nullable=False),
    )
    op.create_index("ix_alerts_created_at", "alerts", ["created_at"])
    op.create_index("ix_alerts_severity", "alerts", ["severity"])
    op.create_index("ix_alerts_status", "alerts", ["status"])
    op.create_table(
        "alert_status_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("alert_id", sa.Integer(), sa.ForeignKey("alerts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", alert_status, nullable=False),
        sa.Column("changed_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("changed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
    )
    op.create_index("ix_alert_history_alert_id", "alert_status_history", ["alert_id"])
    op.create_table(
        "alert_revisions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("alert_id", sa.Integer(), sa.ForeignKey("alerts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("revision_number", sa.Integer(), nullable=False),
        sa.Column("archived_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("archived_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("station_id", sa.Integer(), sa.ForeignKey("stations.id"), nullable=False),
        sa.Column(
            "requested_destination_establishment_id",
            sa.Integer(),
            sa.ForeignKey("establishments.id"),
            nullable=True,
        ),
        sa.Column("material_type", sa.String(length=120), nullable=False),
        sa.Column("material_ref", sa.String(length=120), nullable=False),
        sa.Column("material_concerned", sa.Text(), nullable=True),
        sa.Column("request_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("speed_kmh", sa.Integer(), nullable=True),
        sa.Column("transport_mode", sa.String(length=20), nullable=False),
        sa.Column("transport_type", sa.String(length=20), nullable=False),
        sa.Column("problem_description", sa.Text(), nullable=False),
        sa.Column("maintenance_state", maintenance_state, nullable=False),
        sa.Column("severity", severity, nullable=False),
        sa.Column("transport_conditions_initial", sa.Text(), nullable=False),
        sa.Column("agent_decision", agent_decision, nullable=False),
    )
    op.create_index("ix_alert_revisions_alert_id", "alert_revisions", ["alert_id"])
    op.create_table(
        "permanent_decisions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("alert_id", sa.Integer(), sa.ForeignKey("alerts.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("permanent_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("destination_establishment_id", sa.Integer(), sa.ForeignKey("establishments.id"), nullable=False),
        sa.Column("transport_conditions_final", sa.Text(), nullable=False),
        sa.Column("eta_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("decision", decision_kind, nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("alert_id", sa.Integer(), sa.ForeignKey("alerts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("to_establishment_id", sa.Integer(), sa.ForeignKey("establishments.id"), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_notifications_establishment", "notifications", ["to_establishment_id"])
    op.create_table(
        "establishment_confirmations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("alert_id", sa.Integer(), sa.ForeignKey("alerts.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("establishment_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("reception_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("remarks", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("establishment_confirmations")
    op.drop_index("ix_notifications_establishment", table_name="notifications")
    op.drop_table("notifications")
    op.drop_table("permanent_decisions")
    op.drop_index("ix_alert_history_alert_id", table_name="alert_status_history")
    op.drop_table("alert_status_history")
    op.drop_index("ix_alerts_status", table_name="alerts")
    op.drop_index("ix_alerts_severity", table_name="alerts")
    op.drop_index("ix_alerts_created_at", table_name="alerts")
    op.drop_table("alerts")
    op.drop_index("ix_users_role", table_name="users")
    op.drop_table("users")
    op.drop_table("stations")
    op.drop_table("establishments")
