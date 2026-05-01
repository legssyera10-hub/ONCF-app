from __future__ import annotations

from datetime import datetime, timezone
import json
import math
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.alert import (
    Alert,
    AlertAttachment,
    AlertRevision,
    AlertStatusHistory,
    EstablishmentConfirmation,
    MailEvent,
    Notification,
    PermanentDecision,
)
from app.models.app_setting import AppSetting
from app.models.establishment import Establishment
from app.models.enums import AgentDecision, AlertStatus, DecisionKind, MaintenanceState, Severity, UserRole
from app.models.user import User
from app.schemas.alert import (
    AlertRead,
    AlertUpdate,
    AlertStatusUpdate,
    EstablishmentConfirmationCreate,
    PermanentDecisionCreate,
)
from app.schemas.notification import NotificationRead
from app.services.alerts import (
    add_history,
    apply_alert_collection_derived_fields,
    apply_alert_derived_fields,
    authorize_alert_access,
    ensure_establishment_exists,
    ensure_station_exists,
    get_alert_or_404,
    map_decision_to_status,
    mark_notification_as_read,
)
from app.services.alert_form_config import get_alert_form_config
from app.services.mailing import (
    compose_decision_mail,
    compose_exploitant_decision_mail,
    compose_modification_requested_mail,
    compose_reception_confirmation_mail,
    compose_request_created_mail,
    compose_request_updated_mail,
    send_alert_mail,
)
from app.services.realtime import manager
from app.services.storage import save_upload

router = APIRouter(tags=["alerts"])


def _field_is_required(config: dict[str, dict], field_name: str) -> bool:
    field = config.get(field_name, {})
    return bool(field.get("required"))


def _field_allowed_options(config: dict[str, dict], field_name: str) -> list[str]:
    field = config.get(field_name, {})
    options = field.get("options")
    if isinstance(options, list):
        return [str(item).strip() for item in options if str(item).strip()]
    return []


def _validate_required_text(config: dict[str, dict], field_name: str, value: Optional[str], label: str) -> None:
    if _field_is_required(config, field_name) and not (value or "").strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Le champ {label} est obligatoire")


def _validate_required_value(config: dict[str, dict], field_name: str, value: object, label: str) -> None:
    if _field_is_required(config, field_name) and value is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Le champ {label} est obligatoire")


def _validate_option(config: dict[str, dict], field_name: str, value: Optional[str], label: str) -> None:
    if value is None:
        return
    allowed = _field_allowed_options(config, field_name)
    if allowed and value not in allowed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Valeur non autorisee pour {label}")


def _validate_joined_options(config: dict[str, dict], field_name: str, value: Optional[str], label: str) -> None:
    if not value:
        return
    allowed = _field_allowed_options(config, field_name)
    if not allowed:
        return

    values = [item.strip() for item in value.split(" + ") if item.strip()]
    allow_other = "AUTRE" in allowed
    for item in values:
        if item not in allowed and not allow_other:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Valeur non autorisee pour {label}")


def _validate_alert_form_rules(
    db: Session,
    *,
    etablissement_dest_id: Optional[int],
    type_materiel: str,
    identifiant_materiel: str,
    materiel_concerne: Optional[str],
    date_demande: Optional[datetime],
    vitesse: Optional[int],
    mode_acheminement: str,
    type_acheminement: str,
    probleme: str,
    etat_maintenance: str,
    gravite: str,
    conditions_acheminement: str,
    decision_agent: str,
) -> None:
    config = get_alert_form_config(db)

    _validate_required_value(config, "etablissement_dest_id", etablissement_dest_id, "Destinataire")
    _validate_required_value(config, "date_demande", date_demande, "Date de la demande")
    _validate_required_text(config, "materiel_concerne", materiel_concerne, "Materiel concerne")
    _validate_required_text(config, "probleme", probleme, "Motif")
    _validate_required_text(config, "conditions_acheminement", conditions_acheminement, "Autres conditions")
    if mode_acheminement == "FRET":
        _validate_required_value(config, "vitesse", vitesse, "Vitesse")

    _validate_option(config, "mode_acheminement", mode_acheminement, "Mode d'acheminement")
    _validate_option(config, "type_acheminement", type_acheminement, "Type d'acheminement")
    _validate_option(config, "etat_maintenance", etat_maintenance, "Exploitant")
    _validate_option(config, "gravite", gravite, "Accompagnement")
    _validate_option(config, "decision_agent", decision_agent, "Decision")
    _validate_joined_options(config, "type_materiel", type_materiel, "Type de materiel")
    _validate_joined_options(config, "serie", identifiant_materiel, "Serie")
    _validate_joined_options(config, "materiel_concerne", materiel_concerne, "Materiel concerne")

    allowed_speeds = _field_allowed_options(config, "vitesse")
    if vitesse is not None and allowed_speeds and str(vitesse) not in allowed_speeds:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Valeur non autorisee pour Vitesse")


def _split_joined_values(value: Optional[str]) -> list[str]:
    return [item.strip() for item in (value or "").split(" + ") if item.strip()]


def _alert_material_count(alert: Alert) -> int:
    return max(
        len(_split_joined_values(alert.material_type)),
        len(_split_joined_values(alert.material_ref)),
        len(_split_joined_values(alert.material_concerned)),
        1,
    )


def _parse_confirmed_material_indexes(value: Optional[str]) -> list[int]:
    indexes: list[int] = []
    for item in (value or "").split(","):
        item = item.strip()
        if not item:
            continue
        try:
            index = int(item)
        except ValueError:
            continue
        if index >= 0:
            indexes.append(index)
    return sorted(set(indexes))


def _parse_material_confirmations(value: Optional[str]) -> dict[str, dict]:
    if not value:
        return {}

    try:
        raw = json.loads(value)
    except (TypeError, ValueError):
        return {}

    if not isinstance(raw, dict):
        return {}

    parsed: dict[str, dict] = {}
    for key, item in raw.items():
        if not isinstance(item, dict):
            continue
        parsed[str(key)] = item
    return parsed


def _parse_iso_datetime(value: object) -> Optional[datetime]:
    if not isinstance(value, str) or not value.strip():
        return None

    normalized = value.strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


def _parse_pm_material_decisions(value: Optional[str]) -> dict[str, dict]:
    if not value:
        return {}

    try:
        raw = json.loads(value)
    except (TypeError, ValueError):
        return {}

    if not isinstance(raw, dict):
        return {}

    parsed: dict[str, dict] = {}
    for key, item in raw.items():
        if not isinstance(item, dict):
            continue
        parsed[str(key)] = item
    return parsed


def _default_pm_material_decisions(material_count: int) -> dict[str, dict]:
    now = datetime.now(timezone.utc).isoformat()
    return {
        str(index): {
            "ppm_status": None,
            "ppm_reason": None,
            "updated_at": now,
        }
        for index in range(material_count)
    }


def _accepted_material_indexes_from_pm(alert: Alert) -> list[int]:
    material_count = _alert_material_count(alert)
    if not alert.permanent_decision or not alert.permanent_decision.material_decisions:
        return []

    decisions = _parse_pm_material_decisions(alert.permanent_decision.material_decisions)
    accepted: list[int] = []
    for index in range(material_count):
        entry = decisions.get(str(index), {})
        if entry.get("ppm_status") == "ACCEPTEE":
            accepted.append(index)
    return accepted


def _establishment_contact_email(db: Session, establishment_id: Optional[int]) -> Optional[str]:
    if establishment_id is None:
        return None

    establishment = db.get(Establishment, establishment_id)
    if establishment and establishment.outlook_email:
        return establishment.outlook_email

    technicentre_user = (
        db.execute(
            select(User)
            .where(User.role == UserRole.ETABLISSEMENT, User.establishment_id == establishment_id)
            .order_by(User.id)
        )
        .scalars()
        .first()
    )
    return technicentre_user.outlook_email if technicentre_user and technicentre_user.outlook_email else None


def _creator_contact_email(db: Session, alert: Alert) -> Optional[str]:
    if alert.created_by and alert.created_by.outlook_email:
        return alert.created_by.outlook_email
    creator_establishment_id = alert.created_by.establishment_id if alert.created_by else None
    return _establishment_contact_email(db, creator_establishment_id)


def _app_setting_email(db: Session, key: str) -> Optional[str]:
    setting = db.get(AppSetting, key)
    if not setting:
        return None
    value = (setting.value or "").strip()
    return value or None


def _selected_exploitant_email(db: Session, alert: Alert) -> Optional[str]:
    maintenance_value = (alert.maintenance_state.value if hasattr(alert.maintenance_state, "value") else str(alert.maintenance_state or "")).upper()
    transport_mode = (alert.transport_mode.value if hasattr(alert.transport_mode, "value") else str(alert.transport_mode or "")).upper()

    if maintenance_value == "PV":
        return _app_setting_email(db, "permanent_pv_email")
    if maintenance_value == "PFL":
        return _app_setting_email(db, "permanent_pfl_email")
    if transport_mode == "VOYAGEUR":
        return _app_setting_email(db, "permanent_pv_email")
    if transport_mode == "FRET":
        return _app_setting_email(db, "permanent_pfl_email")
    return None


def _alert_query():
    return select(Alert).options(
        joinedload(Alert.created_by),
        joinedload(Alert.station),
        joinedload(Alert.requested_destination_establishment),
        joinedload(Alert.history).joinedload(AlertStatusHistory.changed_by),
        joinedload(Alert.revisions).joinedload(AlertRevision.archived_by),
        joinedload(Alert.revisions).joinedload(AlertRevision.station),
        joinedload(Alert.revisions).joinedload(AlertRevision.requested_destination_establishment),
        joinedload(Alert.mail_events).joinedload(MailEvent.triggered_by),
        joinedload(Alert.permanent_decision).joinedload(PermanentDecision.destination_establishment),
        joinedload(Alert.permanent_decision).joinedload(PermanentDecision.permanent_user),
        joinedload(Alert.establishment_confirmation).joinedload(EstablishmentConfirmation.establishment_user),
        joinedload(Alert.attachments),
    )


@router.post("/alerts", response_model=AlertRead, status_code=status.HTTP_201_CREATED)
async def create_alert(
    station_id: int = Form(...),
    etablissement_dest_id: Optional[int] = Form(default=None),
    type_materiel: str = Form(..., min_length=1, max_length=120),
    identifiant_materiel: str = Form(..., min_length=1, max_length=120),
    materiel_concerne: Optional[str] = Form(default=None),
    date_demande: Optional[datetime] = Form(default=None),
    vitesse: Optional[int] = Form(default=None),
    mode_acheminement: str = Form(..., min_length=1, max_length=80),
    type_acheminement: str = Form(..., min_length=1, max_length=80),
    probleme: str = Form(default=""),
    etat_maintenance: MaintenanceState = Form(...),
    gravite: Severity = Form(...),
    conditions_acheminement: str = Form(default=""),
    decision_agent: AgentDecision = Form(...),
    files: list[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.AGENT, UserRole.ETABLISSEMENT, UserRole.ADMIN)),
) -> Alert:
    ensure_station_exists(db, station_id)
    if etablissement_dest_id is not None:
        ensure_establishment_exists(db, etablissement_dest_id)
    _validate_alert_form_rules(
        db,
        etablissement_dest_id=etablissement_dest_id,
        type_materiel=type_materiel,
        identifiant_materiel=identifiant_materiel,
        materiel_concerne=materiel_concerne,
        date_demande=date_demande,
        vitesse=vitesse,
        mode_acheminement=mode_acheminement,
        type_acheminement=type_acheminement,
        probleme=probleme,
        etat_maintenance=etat_maintenance.value,
        gravite=gravite.value,
        conditions_acheminement=conditions_acheminement,
        decision_agent=decision_agent.value,
    )

    next_dossier_number = (
        db.execute(select(func.max(func.coalesce(Alert.dossier_number, Alert.id)))).scalar_one_or_none() or 0
    ) + 1

    alert = Alert(
        created_by_user_id=current_user.id,
        dossier_number=next_dossier_number,
        station_id=station_id,
        requested_destination_establishment_id=etablissement_dest_id,
        material_type=type_materiel,
        material_ref=identifiant_materiel,
        material_concerned=(materiel_concerne or "").strip() or None,
        request_date=date_demande,
        speed_kmh=vitesse,
        transport_mode=mode_acheminement,
        transport_type=type_acheminement,
        problem_description=probleme.strip(),
        maintenance_state=etat_maintenance,
        severity=gravite,
        transport_conditions_initial=conditions_acheminement.strip(),
        agent_decision=decision_agent,
        status=AlertStatus.EN_COURS_DE_TRAITEMENT,
    )
    db.add(alert)
    db.flush()

    add_history(
        db,
        alert,
        AlertStatus.EN_COURS_DE_TRAITEMENT,
        current_user.id,
        f"Demande creee et transmise au permanent - EXP {etat_maintenance.value}",
    )

    for file in files:
        if not file.filename:
            continue
        saved_name, public_path = save_upload(file)
        db.add(
            AlertAttachment(
                alert_id=alert.id,
                filename=file.filename,
                stored_path=public_path,
                content_type=file.content_type or "application/octet-stream",
            )
        )
    permanent_user = db.execute(select(User).where(User.role == UserRole.PERMANENT).order_by(User.id)).scalars().first()
    subject, body, html_body = compose_request_created_mail(alert, current_user, permanent_user)
    send_alert_mail(
        db,
        alert=alert,
        event_type="REQUEST_CREATED",
        subject=subject,
        body=body,
        html_body=html_body,
        sender_email=current_user.outlook_email,
        recipients=[permanent_user.outlook_email if permanent_user else None],
        triggered_by_user_id=current_user.id,
    )
    db.commit()

    alert = get_alert_or_404(db, alert.id)
    await manager.broadcast("alerts", {"type": "alert_created", "alert_id": alert.id, "status": alert.status.value})
    return alert


@router.put("/alerts/{alert_id}", response_model=AlertRead)
async def update_alert(
    alert_id: int,
    payload: AlertUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.AGENT, UserRole.ETABLISSEMENT, UserRole.ADMIN)),
) -> Alert:
    alert = get_alert_or_404(db, alert_id)
    if current_user.role != UserRole.ADMIN and alert.created_by_user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Modification non autorisee")
    if alert.status != AlertStatus.A_MODIFIER:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cette demande ne peut pas etre modifiee")
    if alert.permanent_decision or alert.establishment_confirmation:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cette demande ne peut plus etre modifiee")

    dossier_root_id = alert.dossier_parent_id or alert.id
    has_newer_version = db.execute(
        select(Alert.id)
        .where(
            or_(Alert.id == dossier_root_id, Alert.dossier_parent_id == dossier_root_id),
            Alert.dossier_iteration > alert.dossier_iteration,
        )
        .limit(1)
    ).scalar_one_or_none()
    if has_newer_version:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cette demande est deja cloturee. Modifiez la version la plus recente du dossier.",
        )

    ensure_station_exists(db, payload.station_id)
    if payload.etablissement_dest_id is not None:
        ensure_establishment_exists(db, payload.etablissement_dest_id)
    _validate_alert_form_rules(
        db,
        etablissement_dest_id=payload.etablissement_dest_id,
        type_materiel=payload.type_materiel,
        identifiant_materiel=payload.identifiant_materiel,
        materiel_concerne=payload.materiel_concerne,
        date_demande=payload.date_demande,
        vitesse=payload.vitesse,
        mode_acheminement=payload.mode_acheminement,
        type_acheminement=payload.type_acheminement,
        probleme=payload.probleme,
        etat_maintenance=payload.etat_maintenance.value,
        gravite=payload.gravite.value,
        conditions_acheminement=payload.conditions_acheminement,
        decision_agent=payload.decision_agent.value,
    )

    next_iteration = (
        db.execute(
            select(func.max(Alert.dossier_iteration)).where(
                or_(Alert.id == dossier_root_id, Alert.dossier_parent_id == dossier_root_id)
            )
        ).scalar_one_or_none()
        or 0
    ) + 1

    next_revision_number = (max((item.revision_number for item in alert.revisions), default=0) + 1)
    db.add(
        AlertRevision(
            alert_id=alert.id,
            revision_number=next_revision_number,
            archived_by_user_id=current_user.id,
            station_id=alert.station_id,
            requested_destination_establishment_id=alert.requested_destination_establishment_id,
            material_type=alert.material_type,
            material_ref=alert.material_ref,
            material_concerned=alert.material_concerned,
            request_date=alert.request_date,
            speed_kmh=alert.speed_kmh,
            transport_mode=alert.transport_mode,
            transport_type=alert.transport_type,
            problem_description=alert.problem_description,
            maintenance_state=alert.maintenance_state,
            severity=alert.severity,
            transport_conditions_initial=alert.transport_conditions_initial,
            agent_decision=alert.agent_decision,
        )
    )

    new_alert = Alert(
        created_by_user_id=alert.created_by_user_id,
        dossier_number=alert.dossier_number,
        dossier_parent_id=dossier_root_id,
        dossier_iteration=next_iteration,
        station_id=payload.station_id,
        requested_destination_establishment_id=payload.etablissement_dest_id,
        material_type=payload.type_materiel,
        material_ref=payload.identifiant_materiel,
        material_concerned=(payload.materiel_concerne or "").strip() or None,
        request_date=payload.date_demande,
        speed_kmh=payload.vitesse,
        transport_mode=payload.mode_acheminement,
        transport_type=payload.type_acheminement,
        problem_description=payload.probleme.strip(),
        maintenance_state=payload.etat_maintenance,
        severity=payload.gravite,
        transport_conditions_initial=payload.conditions_acheminement.strip(),
        agent_decision=payload.decision_agent,
        status=AlertStatus.EN_COURS_DE_TRAITEMENT,
    )
    db.add(new_alert)
    db.flush()

    for attachment in alert.attachments:
        db.add(
            AlertAttachment(
                alert_id=new_alert.id,
                filename=attachment.filename,
                stored_path=attachment.stored_path,
                content_type=attachment.content_type,
            )
        )

    add_history(
        db,
        alert,
        AlertStatus.MODIFIEE,
        current_user.id,
        f"Demande modifiee et cloturee. Nouvelle version creee: dossier {new_alert.dossier_label}",
    )

    add_history(
        db,
        new_alert,
        AlertStatus.EN_COURS_DE_TRAITEMENT,
        current_user.id,
        f"Demande regeneree depuis dossier {alert.dossier_label}",
    )
    permanent_user = db.execute(select(User).where(User.role == UserRole.PERMANENT).order_by(User.id)).scalars().first()
    subject, body, html_body = compose_request_updated_mail(new_alert)
    send_alert_mail(
        db,
        alert=new_alert,
        event_type="REQUEST_UPDATED",
        subject=subject,
        body=body,
        html_body=html_body,
        sender_email=current_user.outlook_email,
        recipients=[permanent_user.outlook_email if permanent_user else None],
        triggered_by_user_id=current_user.id,
    )
    db.commit()

    alert = get_alert_or_404(db, new_alert.id)
    await manager.broadcast(
        "alerts",
        {"type": "alert_created", "alert_id": alert.id, "status": alert.status.value},
    )
    return alert


@router.get("/alerts", response_model=list[AlertRead])
def list_alerts(
    mine: bool = Query(default=False),
    status_filter: Optional[AlertStatus] = Query(default=None, alias="status"),
    severity: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Alert]:
    stmt = _alert_query().order_by(Alert.created_at.desc())

    if current_user.role in {UserRole.AGENT, UserRole.ETABLISSEMENT} and mine:
        stmt = stmt.where(Alert.created_by_user_id == current_user.id)
    elif current_user.role == UserRole.AGENT:
        stmt = stmt.where(Alert.created_by_user_id == current_user.id)
    elif current_user.role == UserRole.ETABLISSEMENT:
        stmt = stmt.join(PermanentDecision, PermanentDecision.alert_id == Alert.id).where(
            PermanentDecision.destination_establishment_id == current_user.establishment_id
        )
    elif mine:
        stmt = stmt.where(Alert.created_by_user_id == current_user.id)

    if status_filter:
        stmt = stmt.where(Alert.status == status_filter)
    if severity:
        stmt = stmt.where(Alert.severity == severity)

    alerts = list(db.execute(stmt).unique().scalars())
    return apply_alert_collection_derived_fields(alerts)


@router.get("/alerts/{alert_id}", response_model=AlertRead)
def get_alert(alert_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Alert:
    alert = get_alert_or_404(db, alert_id)
    authorize_alert_access(alert, current_user)
    if (
        current_user.role == UserRole.ETABLISSEMENT
        and current_user.establishment_id
        and alert.permanent_decision
        and alert.permanent_decision.destination_establishment_id == current_user.establishment_id
    ):
        mark_notification_as_read(db, alert.id, current_user.establishment_id)
        db.commit()
    return apply_alert_derived_fields(alert)


@router.post("/alerts/{alert_id}/status", response_model=AlertRead)
async def update_alert_status(
    alert_id: int,
    payload: AlertStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.PERMANENT, UserRole.ADMIN)),
) -> Alert:
    if payload.status != AlertStatus.EN_COURS_DE_TRAITEMENT:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Statut non autorise via cette route")

    alert = get_alert_or_404(db, alert_id)
    add_history(db, alert, payload.status, current_user.id, payload.note)
    db.commit()
    alert = get_alert_or_404(db, alert.id)
    await manager.broadcast(
        "alerts",
        {"type": "status_updated", "alert_id": alert.id, "status": alert.status.value, "note": payload.note},
    )
    return alert


@router.post("/alerts/{alert_id}/decision", response_model=AlertRead)
async def create_decision(
    alert_id: int,
    payload: PermanentDecisionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.PERMANENT, UserRole.ADMIN)),
) -> Alert:
    alert = get_alert_or_404(db, alert_id)

    decision_kind = payload.decision
    commentaire = (payload.commentaire or "").strip() or None
    motif_pm = (payload.motif_pm or "").strip() or None
    existing_decision = alert.permanent_decision

    if decision_kind == "MODIFIER":
        if existing_decision:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La demande a deja ete traitee par le permanent")
        if not commentaire:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Le message de modification est obligatoire")
        add_history(db, alert, AlertStatus.A_MODIFIER, current_user.id, commentaire)
        subject, body, html_body = compose_modification_requested_mail(alert, commentaire)
        send_alert_mail(
            db,
            alert=alert,
            event_type="DECISION_MODIFIER",
            subject=subject,
            body=body,
            html_body=html_body,
            sender_email=current_user.outlook_email,
            recipients=[_creator_contact_email(db, alert)],
            triggered_by_user_id=current_user.id,
        )
    elif decision_kind == "ANNULER":
        if existing_decision and alert.status in {
            AlertStatus.RECEPTION_COMPLETE,
            AlertStatus.ANNULEE,
            AlertStatus.MODIFIEE,
        }:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ce dossier est deja cloture")
        if not commentaire:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Le motif d'annulation est obligatoire")
        add_history(db, alert, AlertStatus.ANNULEE, current_user.id, commentaire)
        subject, body, html_body = compose_decision_mail(alert, "ANNULER", commentaire)
        send_alert_mail(
            db,
            alert=alert,
            event_type="DECISION_ANNULER",
            subject=subject,
            body=body,
            html_body=html_body,
            sender_email=current_user.outlook_email,
            recipients=[_creator_contact_email(db, alert)],
            triggered_by_user_id=current_user.id,
        )
    else:
        if alert.status in {AlertStatus.RECEPTION_COMPLETE, AlertStatus.ANNULEE, AlertStatus.MODIFIEE}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ce dossier est deja cloture")

        destination_id = payload.etablissement_dest_id or alert.requested_destination_establishment_id
        if destination_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Aucun destinataire n'est renseigne sur la demande")

        material_count = _alert_material_count(alert)
        requested_accepted = sorted(set(payload.accepted_material_indexes))
        requested_canceled = sorted(set(payload.canceled_material_indexes))

        if any(index < 0 or index >= material_count for index in requested_accepted + requested_canceled):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selection de materiels invalide")
        if set(requested_accepted) & set(requested_canceled):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Un materiel ne peut pas etre accepte et annule en meme temps")

        reason_updates_by_index: dict[int, Optional[str]] = {}
        for item in payload.material_reason_updates:
            if item.index in reason_updates_by_index:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Chaque materiel ne peut avoir qu'un seul motif PM",
                )
            if item.index < 0 or item.index >= material_count:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selection de materiels invalide")
            reason_updates_by_index[item.index] = (item.motif_pm or "").strip() or None

        existing_material_decisions = _parse_pm_material_decisions(
            existing_decision.material_decisions if existing_decision else None
        )
        if not existing_material_decisions:
            existing_material_decisions = _default_pm_material_decisions(material_count)

        existing_material_confirmations = _parse_material_confirmations(
            alert.establishment_confirmation.material_confirmations
            if alert.establishment_confirmation
            else None
        )

        now_iso = datetime.now(timezone.utc).isoformat()
        next_material_decisions = {str(index): dict(existing_material_decisions.get(str(index), {})) for index in range(material_count)}

        if requested_accepted or requested_canceled:
            accepted_set = set(requested_accepted)
            canceled_set = set(requested_canceled)
            for index in range(material_count):
                key = str(index)
                previous_status = next_material_decisions.get(key, {}).get("ppm_status")
                desired_status = "ANNULEE" if index in canceled_set else ("ACCEPTEE" if index in accepted_set else None)
                existing_reason = next_material_decisions.get(key, {}).get("ppm_reason")
                row_reason = reason_updates_by_index.get(index, motif_pm if motif_pm is not None else existing_reason)

                if previous_status == "ANNULEE" and desired_status != "ANNULEE":
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Le materiel #{index + 1} deja annule est definitivement cloture et ne peut plus etre modifie",
                    )

                reception_entry = existing_material_confirmations.get(key, {})
                is_reception_validated = reception_entry.get("reception_status") == "VALIDEE"
                if previous_status == "ACCEPTEE" and is_reception_validated and desired_status != "ACCEPTEE":
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Le materiel #{index + 1} est deja valide en reception et est cloture",
                    )

                next_material_decisions[key] = {
                    "ppm_status": desired_status,
                    "ppm_reason": row_reason,
                    "updated_at": now_iso,
                }
        elif reason_updates_by_index or motif_pm:
            for index in range(material_count):
                key = str(index)
                current_status = next_material_decisions.get(key, {}).get("ppm_status")
                existing_reason = next_material_decisions.get(key, {}).get("ppm_reason")
                row_reason = reason_updates_by_index.get(index, motif_pm if motif_pm is not None else existing_reason)
                next_material_decisions[key] = {
                    "ppm_status": current_status,
                    "ppm_reason": row_reason,
                    "updated_at": now_iso,
                }

        ensure_establishment_exists(db, destination_id)
        previous_destination_id = existing_decision.destination_establishment_id if existing_decision else None
        if existing_decision:
            existing_decision.permanent_user_id = current_user.id
            existing_decision.destination_establishment_id = destination_id
            existing_decision.comment = commentaire
            existing_decision.material_decisions = json.dumps(next_material_decisions)
        else:
            decision = PermanentDecision(
                alert=alert,
                permanent_user_id=current_user.id,
                destination_establishment_id=destination_id,
                transport_conditions_final="",
                eta_date=datetime.now(timezone.utc),
                decision=DecisionKind(decision_kind),
                comment=commentaire,
                material_decisions=json.dumps(next_material_decisions),
            )
            db.add(decision)

        is_dossier_fully_closed = True
        all_materials_canceled_by_ppm = True
        for index in range(material_count):
            key = str(index)
            ppm_status = next_material_decisions.get(key, {}).get("ppm_status")
            if ppm_status != "ANNULEE":
                all_materials_canceled_by_ppm = False
            reception_entry = existing_material_confirmations.get(key, {})
            is_reception_validated = reception_entry.get("reception_status") == "VALIDEE"
            if ppm_status == "ANNULEE" or is_reception_validated:
                continue
            is_dossier_fully_closed = False
            break

        if all_materials_canceled_by_ppm:
            next_status = AlertStatus.ANNULEE
        elif is_dossier_fully_closed:
            next_status = AlertStatus.RECEPTION_COMPLETE
        else:
            next_status = (
                AlertStatus.RECEPTION_PARTIELLE
                if alert.establishment_confirmation and alert.status == AlertStatus.RECEPTION_PARTIELLE
                else AlertStatus.TRAITEE_PAR_PM
            )
        add_history(db, alert, next_status, current_user.id, commentaire)
        if previous_destination_id != destination_id:
            db.add(Notification(alert_id=alert.id, to_establishment_id=destination_id))
        db.flush()
        subject, body, html_body = compose_decision_mail(alert, "CONFIRMER", commentaire)
        send_alert_mail(
            db,
            alert=alert,
            event_type="DECISION_CONFIRMER",
            subject=subject,
            body=body,
            html_body=html_body,
            sender_email=current_user.outlook_email,
            recipients=[
                _creator_contact_email(db, alert),
                _establishment_contact_email(db, destination_id),
            ],
            triggered_by_user_id=current_user.id,
        )

        exploitant_email = _selected_exploitant_email(db, alert)
        has_accepted_material = any(
            decision.get("ppm_status") == "ACCEPTEE" for decision in next_material_decisions.values()
        )
        if exploitant_email and has_accepted_material:
            subject, body, html_body = compose_exploitant_decision_mail(alert, "CONFIRMER", commentaire)
            send_alert_mail(
                db,
                alert=alert,
                event_type="DECISION_CONFIRMER_EXPLOITANT",
                subject=subject,
                body=body,
                html_body=html_body,
                sender_email=current_user.outlook_email,
                recipients=[exploitant_email],
                triggered_by_user_id=current_user.id,
            )

    db.commit()

    alert = get_alert_or_404(db, alert.id)
    await manager.broadcast(
        "alerts",
        {"type": "decision_created", "alert_id": alert.id, "status": alert.status.value},
    )
    return alert


@router.get("/notifications", response_model=list[NotificationRead])
def list_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ETABLISSEMENT, UserRole.ADMIN)),
) -> list[Notification]:
    if current_user.role == UserRole.ETABLISSEMENT and not current_user.establishment_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Utilisateur sans etablissement associe")

    stmt = (
        select(Notification)
        .options(
            joinedload(Notification.establishment),
            joinedload(Notification.alert).joinedload(Alert.created_by),
            joinedload(Notification.alert).joinedload(Alert.station),
            joinedload(Notification.alert).joinedload(Alert.history).joinedload(AlertStatusHistory.changed_by),
            joinedload(Notification.alert).joinedload(Alert.permanent_decision).joinedload(PermanentDecision.destination_establishment),
            joinedload(Notification.alert).joinedload(Alert.permanent_decision).joinedload(PermanentDecision.permanent_user),
            joinedload(Notification.alert).joinedload(Alert.establishment_confirmation).joinedload(EstablishmentConfirmation.establishment_user),
        )
        .order_by(Notification.sent_at.desc())
    )
    if current_user.role == UserRole.ETABLISSEMENT:
        stmt = stmt.where(Notification.to_establishment_id == current_user.establishment_id)

    notifications = list(db.execute(stmt).unique().scalars())
    for notification in notifications:
        apply_alert_derived_fields(notification.alert)
    return notifications


@router.post("/alerts/{alert_id}/confirm", response_model=AlertRead)
async def confirm_reception(
    alert_id: int,
    payload: EstablishmentConfirmationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ETABLISSEMENT, UserRole.ADMIN)),
) -> Alert:
    alert = get_alert_or_404(db, alert_id)
    authorize_alert_access(alert, current_user)
    if alert.establishment_confirmation and alert.status not in {
        AlertStatus.TRAITEE_PAR_PM,
        AlertStatus.RECEPTION_PARTIELLE,
    }:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reception deja confirmee")
    if not current_user.establishment_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Utilisateur sans etablissement")
    if not alert.permanent_decision:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Aucune decision permanent enregistree")

    material_count = _alert_material_count(alert)
    accepted_indexes = sorted(_accepted_material_indexes_from_pm(alert))
    accepted_index_set = set(accepted_indexes)
    if not accepted_indexes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Aucun materiel accepte par le permanent. Impossible de confirmer la reception.",
        )

    if not payload.material_updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Renseignez au moins un materiel a traiter")

    updates_by_index = {item.index: item for item in payload.material_updates}
    if len(updates_by_index) != len(payload.material_updates):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Chaque materiel ne peut etre renseigne qu'une seule fois")
    if any(index < 0 or index >= material_count for index in updates_by_index):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selection de materiels invalide pour le suivi reception")
    if any(index not in accepted_index_set for index in updates_by_index):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Seuls les materiels acceptes par le permanent peuvent etre confirmes")

    selected_from_updates = sorted(index for index, item in updates_by_index.items() if item.outcome == "VALIDEE")
    selected_indexes = sorted(set(selected_from_updates) | set(payload.confirmed_material_indexes))
    if any(index < 0 or index >= material_count for index in selected_indexes):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selection de materiels invalide")
    if any(index not in accepted_index_set for index in selected_indexes):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Seuls les materiels acceptes par le permanent peuvent etre confirmes")

    fallback_reference_date = alert.permanent_decision.created_at
    if fallback_reference_date.tzinfo is None:
        fallback_reference_date = fallback_reference_date.replace(tzinfo=timezone.utc)
    pm_material_decisions = _parse_pm_material_decisions(alert.permanent_decision.material_decisions)
    accepted_reference_dates: dict[int, datetime] = {}
    for index in accepted_indexes:
        entry = pm_material_decisions.get(str(index), {})
        accepted_at = _parse_iso_datetime(entry.get("updated_at"))
        accepted_reference_dates[index] = accepted_at or fallback_reference_date

    existing_confirmation = alert.establishment_confirmation
    confirmed_at_timestamp = datetime.now(timezone.utc)
    remarks = (payload.remarques or "").strip() or None
    existing_indexes = _parse_confirmed_material_indexes(
        existing_confirmation.confirmed_material_indexes if existing_confirmation else None
    )
    material_confirmations = _parse_material_confirmations(
        existing_confirmation.material_confirmations if existing_confirmation else None
    )

    latest_reception_date = fallback_reference_date
    latest_delay_minutes: Optional[int] = None
    for update in payload.material_updates:
        key = str(update.index)
        current = dict(material_confirmations.get(key, {}))
        previous_status = str(current.get("reception_status") or "")
        instance_used_once = bool(current.get("instance_used_once"))
        previous_instance_started_at = _parse_iso_datetime(current.get("en_instance_started_at"))
        previous_last_instance_started_at = _parse_iso_datetime(current.get("last_instance_started_at"))
        previous_instance_ended_at = _parse_iso_datetime(current.get("instance_ended_at"))
        previous_reception_date = _parse_iso_datetime(current.get("reception_date"))
        previous_instance_total_minutes = current.get("en_instance_total_minutes")
        instance_total_minutes = (
            int(previous_instance_total_minutes) if isinstance(previous_instance_total_minutes, int) else 0
        )
        is_validated = update.outcome == "VALIDEE"

        if previous_status == "VALIDEE" and update.outcome != "VALIDEE":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Le materiel #{update.index + 1} est deja valide et cloture",
            )

        if update.outcome == "EN_INSTANCE" and previous_status != "EN_INSTANCE" and instance_used_once:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Le materiel #{update.index + 1} a deja ete mis en instance une fois et ne peut plus etre remis en instance",
            )

        if update.outcome == "EN_ATTENTE" and previous_status != "EN_INSTANCE":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Le materiel #{update.index + 1} ne peut etre retire d'en instance que s'il est actuellement en instance",
            )

        reception_date = update.date_reception
        if reception_date.tzinfo is None:
            reception_date = reception_date.replace(tzinfo=timezone.utc)
        row_reference_date = accepted_reference_dates.get(update.index, fallback_reference_date)
        row_delay_minutes = int((reception_date - row_reference_date).total_seconds() // 60)
        if reception_date >= latest_reception_date:
            latest_reception_date = reception_date
            latest_delay_minutes = row_delay_minutes

        if update.outcome == "EN_INSTANCE":
            if previous_status != "EN_INSTANCE" or previous_instance_started_at is None:
                instance_started_at = confirmed_at_timestamp
            else:
                instance_started_at = previous_instance_started_at
            instance_used_once = True
            last_instance_started_at = instance_started_at
            instance_ended_at = None
        else:
            instance_started_at = None
            last_instance_started_at = previous_last_instance_started_at
            instance_ended_at = previous_instance_ended_at
            if previous_status == "EN_INSTANCE":
                start_reference = previous_instance_started_at or previous_last_instance_started_at or previous_reception_date
                if start_reference is not None:
                    duration_seconds = (confirmed_at_timestamp - start_reference).total_seconds()
                    additional_minutes = (
                        max(1, int(math.ceil(duration_seconds / 60))) if duration_seconds > 0 else 0
                    )
                    instance_total_minutes += additional_minutes
                    last_instance_started_at = start_reference
                    instance_ended_at = confirmed_at_timestamp

        reception_status_value: Optional[str]
        if update.outcome == "EN_ATTENTE":
            reception_status_value = None
            is_validated = False
        else:
            reception_status_value = update.outcome

        should_show_instance_duration = instance_used_once and reception_status_value != "EN_INSTANCE"
        if should_show_instance_duration:
            en_instance_total_minutes_value: Optional[int] = max(instance_total_minutes, 0)
        else:
            en_instance_total_minutes_value = instance_total_minutes if instance_total_minutes > 0 else None

        current.update(
            {
                "confirmed": is_validated,
                "reception_status": reception_status_value,
                "confirmed_at": confirmed_at_timestamp.isoformat(),
                "reception_date": reception_date.isoformat(),
                "delay_minutes": row_delay_minutes,
                "remarks": (update.reason or "").strip() or remarks,
                "en_instance_started_at": instance_started_at.isoformat() if instance_started_at else None,
                "en_instance_total_minutes": en_instance_total_minutes_value,
                "last_instance_started_at": (
                    last_instance_started_at.isoformat() if last_instance_started_at else None
                ),
                "instance_ended_at": instance_ended_at.isoformat() if instance_ended_at else None,
                "instance_used_once": instance_used_once,
            }
        )
        material_confirmations[key] = current

    delay_minutes = latest_delay_minutes if latest_delay_minutes is not None else 0
    if delay_minutes == 0:
        delay_label = "a l'heure"
    elif delay_minutes > 0:
        delay_label = f"{delay_minutes} minute(s) de retard"
    else:
        delay_label = f"{abs(delay_minutes)} minute(s) d'avance"

    for index in selected_indexes:
        key = str(index)
        current = dict(material_confirmations.get(key, {}))
        row_reception_date = current.get("reception_date") or latest_reception_date.isoformat()
        row_delay_minutes = current.get("delay_minutes")
        row_reception_status = str(current.get("reception_status") or "")
        if not isinstance(row_delay_minutes, int):
            parsed_row_reception_date = _parse_iso_datetime(row_reception_date)
            row_reference_date = accepted_reference_dates.get(index, fallback_reference_date)
            if parsed_row_reception_date is not None:
                row_delay_minutes = int((parsed_row_reception_date - row_reference_date).total_seconds() // 60)
            else:
                row_delay_minutes = delay_minutes
        if row_reception_status != "VALIDEE":
            row_reception_status = "VALIDEE"
        current.update(
            {
                "confirmed": True,
                "reception_status": row_reception_status,
                "confirmed_at": confirmed_at_timestamp.isoformat(),
                "reception_date": row_reception_date,
                "delay_minutes": row_delay_minutes,
                "remarks": current.get("remarks") or remarks,
            }
        )
        material_confirmations[key] = current

    merged_indexes = sorted(set(existing_indexes) | set(selected_indexes))
    merged_indexes_value = ",".join(str(index) for index in merged_indexes)
    material_confirmations_value = json.dumps(material_confirmations)

    validated_accepted_count = 0
    for index in accepted_indexes:
        entry = material_confirmations.get(str(index), {})
        if entry.get("reception_status") == "VALIDEE":
            validated_accepted_count += 1

    accepted_count = len(accepted_indexes)
    if accepted_count > 0 and validated_accepted_count == accepted_count:
        next_status = AlertStatus.RECEPTION_COMPLETE
    elif accepted_count > 1 and 0 < validated_accepted_count < accepted_count:
        next_status = AlertStatus.RECEPTION_PARTIELLE
    else:
        next_status = AlertStatus.TRAITEE_PAR_PM

    if existing_confirmation:
        existing_confirmation.establishment_user_id = current_user.id
        existing_confirmation.reception_date = latest_reception_date
        existing_confirmation.confirmed_at = confirmed_at_timestamp
        existing_confirmation.confirmed_material_indexes = merged_indexes_value
        existing_confirmation.material_confirmations = material_confirmations_value
        existing_confirmation.delay_minutes = delay_minutes
        existing_confirmation.remarks = remarks or existing_confirmation.remarks
    else:
        db.add(
            EstablishmentConfirmation(
                alert=alert,
                establishment_user_id=current_user.id,
                confirmed_at=confirmed_at_timestamp,
                reception_date=latest_reception_date,
                confirmed_material_indexes=merged_indexes_value,
                material_confirmations=material_confirmations_value,
                delay_minutes=delay_minutes,
                remarks=remarks,
            )
        )

    reception_scope = f"{len(merged_indexes)}/{len(accepted_indexes)} materiel(s) confirme(s)"
    if next_status == AlertStatus.RECEPTION_COMPLETE:
        base_note = f"Réception complète ({reception_scope})"
    elif next_status == AlertStatus.TRAITEE_PAR_PM:
        base_note = f"Reception en cours ({reception_scope})"
    else:
        has_instance_material = any(
            material_confirmations.get(str(index), {}).get("reception_status") == "EN_INSTANCE"
            for index in accepted_indexes
        )
        base_note = (
            f"Réception partielle (en instance) ({reception_scope})"
            if has_instance_material
            else f"Réception partielle ({reception_scope})"
        )

    if remarks:
        history_note = f"{base_note} : {remarks} avec {delay_label}"
    else:
        history_note = f"{base_note} avec {delay_label}"

    add_history(db, alert, next_status, current_user.id, history_note)
    db.flush()
    subject, body, html_body = compose_reception_confirmation_mail(alert, remarks, latest_reception_date)
    permanent_user = alert.permanent_decision.permanent_user if alert.permanent_decision else None
    event_type = {
        AlertStatus.TRAITEE_PAR_PM: "RECEPTION_EN_COURS",
        AlertStatus.RECEPTION_PARTIELLE: "RECEPTION_PARTIELLE",
        AlertStatus.RECEPTION_COMPLETE: "RECEPTION_COMPLETE",
    }.get(next_status, "RECEPTION_EN_COURS")
    send_alert_mail(
        db,
        alert=alert,
        event_type=event_type,
        subject=subject,
        body=body,
        html_body=html_body,
        sender_email=current_user.outlook_email or (current_user.establishment.outlook_email if current_user.establishment else None),
        recipients=[_creator_contact_email(db, alert), permanent_user.outlook_email if permanent_user else None],
        triggered_by_user_id=current_user.id,
    )
    db.commit()

    alert = get_alert_or_404(db, alert.id)
    await manager.broadcast(
        "alerts",
        {"type": "reception_confirmed", "alert_id": alert.id, "status": alert.status.value},
    )
    return alert
