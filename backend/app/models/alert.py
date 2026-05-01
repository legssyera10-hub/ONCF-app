from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import AgentDecision, AlertStatus, DecisionKind, MaintenanceState, Severity


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    dossier_number: Mapped[int] = mapped_column(Integer, index=True)
    dossier_parent_id: Mapped[Optional[int]] = mapped_column(ForeignKey("alerts.id"), nullable=True, index=True)
    dossier_iteration: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    station_id: Mapped[int] = mapped_column(ForeignKey("stations.id"))
    requested_destination_establishment_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("establishments.id"),
        nullable=True,
    )
    material_type: Mapped[str] = mapped_column(String(120))
    material_ref: Mapped[str] = mapped_column(String(120))
    material_concerned: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    request_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    speed_kmh: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    transport_mode: Mapped[str] = mapped_column(String(80), default="FRET")
    transport_type: Mapped[str] = mapped_column(String(80), default="HLP")
    problem_description: Mapped[str] = mapped_column(Text)
    maintenance_state: Mapped[MaintenanceState] = mapped_column(Enum(MaintenanceState))
    severity: Mapped[Severity] = mapped_column(Enum(Severity), index=True)
    transport_conditions_initial: Mapped[str] = mapped_column(Text)
    agent_decision: Mapped[AgentDecision] = mapped_column(Enum(AgentDecision))
    status: Mapped[AlertStatus] = mapped_column(Enum(AlertStatus), index=True)

    created_by = relationship("User")
    station = relationship("Station")
    requested_destination_establishment = relationship("Establishment")
    history = relationship("AlertStatusHistory", back_populates="alert", cascade="all, delete-orphan")
    permanent_decision = relationship("PermanentDecision", back_populates="alert", uselist=False)
    establishment_confirmation = relationship("EstablishmentConfirmation", back_populates="alert", uselist=False)
    notifications = relationship("Notification", back_populates="alert", cascade="all, delete-orphan")
    attachments = relationship("AlertAttachment", back_populates="alert", cascade="all, delete-orphan")
    revisions = relationship("AlertRevision", back_populates="alert", cascade="all, delete-orphan")
    mail_events = relationship("MailEvent", back_populates="alert", cascade="all, delete-orphan")

    @property
    def dossier_root_id(self) -> int:
        return self.dossier_parent_id or self.id

    @property
    def dossier_label(self) -> str:
        base_number = self.dossier_number or self.dossier_root_id
        if self.dossier_iteration > 0:
            return f"{base_number} ({self.dossier_iteration})"
        return str(base_number)


class AlertStatusHistory(Base):
    __tablename__ = "alert_status_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    alert_id: Mapped[int] = mapped_column(ForeignKey("alerts.id", ondelete="CASCADE"), index=True)
    status: Mapped[AlertStatus] = mapped_column(Enum(AlertStatus))
    changed_by_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    alert = relationship("Alert", back_populates="history")
    changed_by = relationship("User")


class PermanentDecision(Base):
    __tablename__ = "permanent_decisions"

    id: Mapped[int] = mapped_column(primary_key=True)
    alert_id: Mapped[int] = mapped_column(ForeignKey("alerts.id", ondelete="CASCADE"), unique=True)
    permanent_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    destination_establishment_id: Mapped[int] = mapped_column(ForeignKey("establishments.id"))
    transport_conditions_final: Mapped[str] = mapped_column(Text)
    eta_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    decision: Mapped[DecisionKind] = mapped_column(Enum(DecisionKind))
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    material_decisions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    alert = relationship("Alert", back_populates="permanent_decision")
    permanent_user = relationship("User")
    destination_establishment = relationship("Establishment")


class EstablishmentConfirmation(Base):
    __tablename__ = "establishment_confirmations"

    id: Mapped[int] = mapped_column(primary_key=True)
    alert_id: Mapped[int] = mapped_column(ForeignKey("alerts.id", ondelete="CASCADE"), unique=True)
    establishment_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    confirmed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    reception_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    confirmed_material_indexes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    material_confirmations: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    delay_minutes: Mapped[Optional[int]] = mapped_column(nullable=True)
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    alert = relationship("Alert", back_populates="establishment_confirmation")
    establishment_user = relationship("User")


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    alert_id: Mapped[int] = mapped_column(ForeignKey("alerts.id", ondelete="CASCADE"))
    to_establishment_id: Mapped[int] = mapped_column(ForeignKey("establishments.id"), index=True)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    alert = relationship("Alert", back_populates="notifications")
    establishment = relationship("Establishment")


class AlertAttachment(Base):
    __tablename__ = "alert_attachments"

    id: Mapped[int] = mapped_column(primary_key=True)
    alert_id: Mapped[int] = mapped_column(ForeignKey("alerts.id", ondelete="CASCADE"), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    stored_path: Mapped[str] = mapped_column(String(500))
    content_type: Mapped[str] = mapped_column(String(120))
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    alert = relationship("Alert", back_populates="attachments")


class AlertRevision(Base):
    __tablename__ = "alert_revisions"

    id: Mapped[int] = mapped_column(primary_key=True)
    alert_id: Mapped[int] = mapped_column(ForeignKey("alerts.id", ondelete="CASCADE"), index=True)
    revision_number: Mapped[int] = mapped_column(nullable=False)
    archived_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    archived_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    station_id: Mapped[int] = mapped_column(ForeignKey("stations.id"))
    requested_destination_establishment_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("establishments.id"),
        nullable=True,
    )
    material_type: Mapped[str] = mapped_column(String(120))
    material_ref: Mapped[str] = mapped_column(String(120))
    material_concerned: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    request_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    speed_kmh: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    transport_mode: Mapped[str] = mapped_column(String(80))
    transport_type: Mapped[str] = mapped_column(String(80))
    problem_description: Mapped[str] = mapped_column(Text)
    maintenance_state: Mapped[MaintenanceState] = mapped_column(Enum(MaintenanceState))
    severity: Mapped[Severity] = mapped_column(Enum(Severity))
    transport_conditions_initial: Mapped[str] = mapped_column(Text)
    agent_decision: Mapped[AgentDecision] = mapped_column(Enum(AgentDecision))

    alert = relationship("Alert", back_populates="revisions")
    archived_by = relationship("User")
    station = relationship("Station")
    requested_destination_establishment = relationship("Establishment")


class MailEvent(Base):
    __tablename__ = "mail_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    alert_id: Mapped[int] = mapped_column(ForeignKey("alerts.id", ondelete="CASCADE"), index=True)
    triggered_by_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    event_type: Mapped[str] = mapped_column(String(80))
    subject: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text)
    sender_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    recipient_emails: Mapped[str] = mapped_column(Text)
    delivery_status: Mapped[str] = mapped_column(String(40), default="PENDING")
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    alert = relationship("Alert", back_populates="mail_events")
    triggered_by = relationship("User")
