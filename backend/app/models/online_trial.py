from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import AlertStatus, DecisionKind, MaintenanceState, Severity


class OnlineTrialRequest(Base):
    __tablename__ = "online_trial_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    dossier_number: Mapped[int] = mapped_column(Integer, index=True)
    dossier_parent_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("online_trial_requests.id"),
        nullable=True,
        index=True,
    )
    dossier_iteration: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    departure_station_id: Mapped[int] = mapped_column(ForeignKey("stations.id"))
    arrival_station_id: Mapped[Optional[int]] = mapped_column(ForeignKey("stations.id"), nullable=True)
    station_id: Mapped[int] = mapped_column(ForeignKey("stations.id"))
    material_type: Mapped[str] = mapped_column(String(120))
    material_ref: Mapped[str] = mapped_column(String(120))
    material_concerned: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    departure_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    arrival_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    request_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    speed_kmh: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    parcours_aller: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    parcours_retour: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    transport_mode: Mapped[str] = mapped_column(String(80), default="FRET")
    transport_type: Mapped[str] = mapped_column(String(80), default="HLP")
    problem_description: Mapped[str] = mapped_column(Text)
    maintenance_state: Mapped[MaintenanceState] = mapped_column(Enum(MaintenanceState))
    severity: Mapped[Severity] = mapped_column(Enum(Severity), index=True)
    transport_conditions_initial: Mapped[str] = mapped_column(Text)
    status: Mapped[AlertStatus] = mapped_column(Enum(AlertStatus), index=True)
    pm_reference_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    trial_material_progress: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_by = relationship("User")
    station = relationship("Station", foreign_keys=[station_id])
    departure_station = relationship("Station", foreign_keys=[departure_station_id])
    arrival_station = relationship("Station", foreign_keys=[arrival_station_id])
    history = relationship("OnlineTrialStatusHistory", back_populates="trial", cascade="all, delete-orphan")
    permanent_decision = relationship("OnlineTrialDecision", back_populates="trial", uselist=False)
    attachments = relationship("OnlineTrialAttachment", back_populates="trial", cascade="all, delete-orphan")

    @property
    def dossier_root_id(self) -> int:
        return self.dossier_parent_id or self.id

    @property
    def dossier_label(self) -> str:
        base_number = self.dossier_number or self.dossier_root_id
        if self.dossier_iteration > 0:
            return f"{base_number} ({self.dossier_iteration})"
        return str(base_number)


class OnlineTrialStatusHistory(Base):
    __tablename__ = "online_trial_status_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    trial_id: Mapped[int] = mapped_column(ForeignKey("online_trial_requests.id", ondelete="CASCADE"), index=True)
    status: Mapped[AlertStatus] = mapped_column(Enum(AlertStatus))
    changed_by_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    trial = relationship("OnlineTrialRequest", back_populates="history")
    changed_by = relationship("User")


class OnlineTrialDecision(Base):
    __tablename__ = "online_trial_decisions"

    id: Mapped[int] = mapped_column(primary_key=True)
    trial_id: Mapped[int] = mapped_column(ForeignKey("online_trial_requests.id", ondelete="CASCADE"), unique=True)
    permanent_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    decision: Mapped[DecisionKind] = mapped_column(Enum(DecisionKind))
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    material_decisions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    trial = relationship("OnlineTrialRequest", back_populates="permanent_decision")
    permanent_user = relationship("User")


class OnlineTrialAttachment(Base):
    __tablename__ = "online_trial_attachments"

    id: Mapped[int] = mapped_column(primary_key=True)
    trial_id: Mapped[int] = mapped_column(ForeignKey("online_trial_requests.id", ondelete="CASCADE"), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    stored_path: Mapped[str] = mapped_column(String(500))
    content_type: Mapped[str] = mapped_column(String(120))
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    trial = relationship("OnlineTrialRequest", back_populates="attachments")
