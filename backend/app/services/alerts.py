from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.alert import Alert, AlertAttachment, AlertRevision, AlertStatusHistory, EstablishmentConfirmation, Notification, PermanentDecision
from app.models.establishment import Establishment
from app.models.enums import AgentDecision, AlertStatus
from app.models.station import Station
from app.models.user import User


def compute_delay_minutes(
    confirmation: Optional[EstablishmentConfirmation],
    decision: Optional[PermanentDecision],
) -> Optional[int]:
    if not confirmation or not decision:
        return None
    if confirmation.delay_minutes is not None:
        return confirmation.delay_minutes

    eta_date = decision.eta_date
    reception_date = confirmation.reception_date
    if eta_date.tzinfo is None:
        eta_date = eta_date.replace(tzinfo=timezone.utc)
    if reception_date.tzinfo is None:
        reception_date = reception_date.replace(tzinfo=timezone.utc)
    return int((reception_date - eta_date).total_seconds() // 60)


def apply_alert_derived_fields(alert: Alert) -> Alert:
    if alert.establishment_confirmation and alert.permanent_decision:
        alert.establishment_confirmation.delay_minutes = compute_delay_minutes(
            alert.establishment_confirmation,
            alert.permanent_decision,
        )
    alert.history.sort(key=lambda item: item.changed_at)
    alert.revisions.sort(key=lambda item: item.revision_number, reverse=True)
    return alert


def apply_alert_collection_derived_fields(alerts: list[Alert]) -> list[Alert]:
    for alert in alerts:
        apply_alert_derived_fields(alert)
    return alerts


def add_history(
    db: Session,
    alert: Alert,
    status_value: AlertStatus,
    user_id: Optional[int],
    note: Optional[str] = None,
) -> None:
    alert.status = status_value
    db.add(
        AlertStatusHistory(
            alert=alert,
            status=status_value,
            changed_by_user_id=user_id,
            note=note,
        )
    )


def ensure_station_exists(db: Session, station_id: int) -> Station:
    station = db.get(Station, station_id)
    if not station:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gare introuvable")
    return station


def ensure_establishment_exists(db: Session, establishment_id: int) -> Establishment:
    establishment = db.get(Establishment, establishment_id)
    if not establishment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Etablissement introuvable")
    return establishment


def get_alert_or_404(db: Session, alert_id: int) -> Alert:
    stmt = (
        select(Alert)
        .where(Alert.id == alert_id)
        .options(
            joinedload(Alert.created_by),
            joinedload(Alert.station),
            joinedload(Alert.requested_destination_establishment),
            joinedload(Alert.history).joinedload(AlertStatusHistory.changed_by),
            joinedload(Alert.revisions).joinedload(AlertRevision.archived_by),
            joinedload(Alert.revisions).joinedload(AlertRevision.station),
            joinedload(Alert.revisions).joinedload(AlertRevision.requested_destination_establishment),
            joinedload(Alert.permanent_decision).joinedload(PermanentDecision.destination_establishment),
            joinedload(Alert.permanent_decision).joinedload(PermanentDecision.permanent_user),
            joinedload(Alert.establishment_confirmation).joinedload(EstablishmentConfirmation.establishment_user),
            joinedload(Alert.attachments),
        )
    )
    alert = db.execute(stmt).unique().scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alerte introuvable")
    return apply_alert_derived_fields(alert)


def authorize_alert_access(alert: Alert, user: User) -> None:
    if user.role.value in {"PERMANENT", "ADMIN", "SUIVI"}:
        return
    if user.role.value == "AGENT" and alert.created_by_user_id == user.id:
        return
    if user.role.value == "ETABLISSEMENT" and alert.created_by_user_id == user.id:
        return
    if (
        user.role.value == "ETABLISSEMENT"
        and user.establishment_id
        and alert.permanent_decision
        and alert.permanent_decision.destination_establishment_id == user.establishment_id
    ):
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces refuse")


def map_decision_to_status(decision: str) -> AlertStatus:
    if decision == "CONFIRMER":
        return AlertStatus.TRAITEE_PAR_PM
    if decision == "ANNULER":
        return AlertStatus.ANNULEE
    return AlertStatus.A_MODIFIER


def mark_notification_as_read(db: Session, alert_id: int, establishment_id: int) -> None:
    stmt = (
        select(Notification)
        .where(Notification.alert_id == alert_id, Notification.to_establishment_id == establishment_id)
        .order_by(Notification.sent_at.desc())
    )
    notification = db.execute(stmt).scalars().first()
    if notification and notification.read_at is None:
        notification.read_at = datetime.now(timezone.utc)


