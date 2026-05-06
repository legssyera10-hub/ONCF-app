from __future__ import annotations

from datetime import datetime, timezone
import json
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.online_trial import (
    OnlineTrialAttachment,
    OnlineTrialDecision,
    OnlineTrialRequest,
    OnlineTrialStatusHistory,
)
from app.models.enums import AlertStatus, DecisionKind, MaintenanceState, Severity, UserRole
from app.models.user import User
from app.schemas.online_trial import (
    OnlineTrialDecisionCreate,
    OnlineTrialProgressUpdate,
    OnlineTrialRead,
    OnlineTrialUpdate,
)
from app.services.alert_form_config import get_alert_form_config
from app.services.alerts import ensure_station_exists
from app.services.realtime import manager
from app.services.storage import save_upload

router = APIRouter(prefix="/online-trials", tags=["online_trials"])

ONLINE_TRIAL_ALLOWED_SPEEDS = {
    160,
    150,
    140,
    130,
    120,
    110,
    100,
    90,
    80,
    70,
    60,
    50,
    40,
    30,
    20,
    10,
    5,
}


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
    if value is None or not str(value).strip():
        return
    allowed = _field_allowed_options(config, field_name)
    if allowed and value not in allowed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Valeur non autorisee pour {label}")


def _normalize_online_trial_mode(value: Optional[str]) -> str:
    return (value or "").strip().upper()


def _validate_online_trial_mode(value: Optional[str]) -> None:
    normalized = _normalize_online_trial_mode(value)
    if normalized and normalized not in {"US", "UM", "-"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mode d'essai invalide (valeurs autorisees: US, UM, -)",
        )


def _validate_online_trial_directions(parcours_aller: bool, parcours_retour: bool) -> None:
    if not parcours_aller and not parcours_retour:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selectionnez au moins un sens de parcours: aller ou retour",
        )


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


def _validate_online_trial_form_rules(
    db: Session,
    *,
    parcours_aller: bool,
    parcours_retour: bool,
    type_materiel: str,
    identifiant_materiel: str,
    materiel_concerne: Optional[str],
    date_depart: Optional[datetime],
    vitesse: Optional[int],
    mode_acheminement: str,
    probleme: str,
    etat_maintenance: str,
    gravite: str,
    conditions_acheminement: str,
) -> None:
    config = get_alert_form_config(db)

    _validate_required_value(config, "date_demande", date_depart, "Date de depart")
    _validate_required_text(config, "materiel_concerne", materiel_concerne, "Materiel concerne")
    _validate_required_text(config, "probleme", probleme, "Motif")
    _validate_required_text(config, "conditions_acheminement", conditions_acheminement, "Autres conditions")
    _validate_online_trial_directions(parcours_aller, parcours_retour)
    _validate_online_trial_mode(mode_acheminement)
    has_mr = _contains_mr_material(type_materiel)
    normalized_mode = _normalize_online_trial_mode(mode_acheminement)
    if has_mr:
        if normalized_mode != "-":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Le mode d'essai doit etre '-' si un materiel MR est present",
            )
    else:
        if normalized_mode not in {"US", "UM"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Le mode d'essai est obligatoire et doit etre US ou UM",
            )

    _validate_option(config, "etat_maintenance", etat_maintenance, "Exploitant")
    _validate_option(config, "gravite", gravite, "Accompagnement")
    _validate_joined_options(config, "type_materiel", type_materiel, "Type de materiel")
    _validate_joined_options(config, "serie", identifiant_materiel, "Serie")
    _validate_joined_options(config, "materiel_concerne", materiel_concerne, "Materiel concerne")

    if vitesse is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Le champ Vitesse est obligatoire")
    if vitesse not in ONLINE_TRIAL_ALLOWED_SPEEDS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Valeur non autorisee pour Vitesse")


def _split_joined_values(value: Optional[str]) -> list[str]:
    return [item.strip() for item in (value or "").split(" + ") if item.strip()]


def _contains_mr_material(type_materiel: str) -> bool:
    return any(item.upper() == "MR" for item in _split_joined_values(type_materiel))


def _online_trial_material_count(trial: OnlineTrialRequest) -> int:
    return max(
        len(_split_joined_values(trial.material_type)),
        len(_split_joined_values(trial.material_ref)),
        len(_split_joined_values(trial.material_concerned)),
        1,
    )


def _parse_json_object(value: Optional[str]) -> dict[str, dict]:
    if not value:
        return {}
    try:
        raw = json.loads(value)
    except (TypeError, ValueError):
        return {}
    if not isinstance(raw, dict):
        return {}
    return {str(key): item for key, item in raw.items() if isinstance(item, dict)}


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


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _is_online_trial_closed(trial: OnlineTrialRequest) -> bool:
    return trial.status in {
        AlertStatus.RECEPTION_COMPLETE,
        AlertStatus.ANNULEE,
        AlertStatus.MODIFIEE,
    }


def _add_trial_history(
    db: Session,
    trial: OnlineTrialRequest,
    status_value: AlertStatus,
    user_id: Optional[int],
    note: Optional[str] = None,
) -> None:
    trial.status = status_value
    db.add(
        OnlineTrialStatusHistory(
            trial=trial,
            status=status_value,
            changed_by_user_id=user_id,
            note=note,
        )
    )


def _online_trial_query():
    return select(OnlineTrialRequest).options(
        joinedload(OnlineTrialRequest.created_by),
        joinedload(OnlineTrialRequest.station),
        joinedload(OnlineTrialRequest.departure_station),
        joinedload(OnlineTrialRequest.arrival_station),
        joinedload(OnlineTrialRequest.history).joinedload(OnlineTrialStatusHistory.changed_by),
        joinedload(OnlineTrialRequest.permanent_decision).joinedload(OnlineTrialDecision.permanent_user),
        joinedload(OnlineTrialRequest.attachments),
    )


def _apply_online_trial_derived_fields(trial: OnlineTrialRequest) -> OnlineTrialRequest:
    trial.history.sort(key=lambda item: item.changed_at)
    return trial


def _apply_online_trial_collection_derived_fields(trials: list[OnlineTrialRequest]) -> list[OnlineTrialRequest]:
    for trial in trials:
        _apply_online_trial_derived_fields(trial)
    return trials


def _get_online_trial_or_404(db: Session, trial_id: int) -> OnlineTrialRequest:
    trial = db.execute(_online_trial_query().where(OnlineTrialRequest.id == trial_id)).unique().scalar_one_or_none()
    if not trial:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Demande d'essai introuvable")
    return _apply_online_trial_derived_fields(trial)


def _authorize_online_trial_access(trial: OnlineTrialRequest, user: User) -> None:
    if user.role in {UserRole.PERMANENT, UserRole.ADMIN, UserRole.SUIVI}:
        return
    if user.role in {UserRole.ETABLISSEMENT, UserRole.PROJET} and trial.created_by_user_id == user.id:
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces refuse")


def _accepted_trial_material_indexes(trial: OnlineTrialRequest) -> list[int]:
    decisions = _parse_json_object(trial.permanent_decision.material_decisions if trial.permanent_decision else None)
    material_count = _online_trial_material_count(trial)
    accepted: list[int] = []
    for index in range(material_count):
        if decisions.get(str(index), {}).get("ppm_status") == "ACCEPTEE":
            accepted.append(index)
    return accepted


def _compute_trial_status_from_progress(
    trial: OnlineTrialRequest,
    material_decisions: dict[str, dict],
) -> AlertStatus:
    accepted_indexes = [
        int(key)
        for key, value in material_decisions.items()
        if isinstance(value, dict) and value.get("ppm_status") == "ACCEPTEE" and str(key).isdigit()
    ]
    if not accepted_indexes:
        return AlertStatus.ANNULEE

    progress = _parse_json_object(trial.trial_material_progress)
    performed_count = 0
    for index in accepted_indexes:
        entry = progress.get(str(index), {})
        if bool(entry.get("performed")):
            performed_count += 1

    if performed_count == len(accepted_indexes):
        return AlertStatus.RECEPTION_COMPLETE
    return AlertStatus.TRAITEE_PAR_PM


@router.post("", response_model=OnlineTrialRead, status_code=status.HTTP_201_CREATED)
async def create_online_trial(
    departure_station_id: int = Form(...),
    arrival_station_id: int = Form(...),
    parcours_aller: bool = Form(default=True),
    parcours_retour: bool = Form(default=True),
    type_materiel: str = Form(..., min_length=1, max_length=120),
    identifiant_materiel: str = Form(..., min_length=1, max_length=120),
    materiel_concerne: Optional[str] = Form(default=None),
    date_depart: Optional[datetime] = Form(default=None),
    vitesse: Optional[int] = Form(default=None),
    mode_acheminement: str = Form(default="", max_length=80),
    probleme: str = Form(default=""),
    etat_maintenance: MaintenanceState = Form(...),
    gravite: Severity = Form(...),
    conditions_acheminement: str = Form(default=""),
    files: list[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.ETABLISSEMENT, UserRole.PROJET, UserRole.ADMIN)
    ),
) -> OnlineTrialRequest:
    mode_essai = _normalize_online_trial_mode(mode_acheminement)
    if _contains_mr_material(type_materiel):
        mode_essai = "-"
    ensure_station_exists(db, departure_station_id)
    ensure_station_exists(db, arrival_station_id)
    _validate_online_trial_form_rules(
        db,
        parcours_aller=parcours_aller,
        parcours_retour=parcours_retour,
        type_materiel=type_materiel,
        identifiant_materiel=identifiant_materiel,
        materiel_concerne=materiel_concerne,
        date_depart=date_depart,
        vitesse=vitesse,
        mode_acheminement=mode_essai,
        probleme=probleme,
        etat_maintenance=etat_maintenance.value,
        gravite=gravite.value,
        conditions_acheminement=conditions_acheminement,
    )

    next_dossier_number = (
        db.execute(
            select(func.max(func.coalesce(OnlineTrialRequest.dossier_number, OnlineTrialRequest.id)))
        ).scalar_one_or_none()
        or 0
    ) + 1

    trial = OnlineTrialRequest(
        created_by_user_id=current_user.id,
        dossier_number=next_dossier_number,
        dossier_parent_id=None,
        dossier_iteration=0,
        departure_station_id=departure_station_id,
        arrival_station_id=arrival_station_id,
        station_id=departure_station_id,
        material_type=type_materiel,
        material_ref=identifiant_materiel,
        material_concerned=(materiel_concerne or "").strip() or None,
        departure_date=date_depart,
        arrival_date=None,
        request_date=date_depart,
        speed_kmh=vitesse,
        parcours_aller=parcours_aller,
        parcours_retour=parcours_retour,
        transport_mode=mode_essai,
        transport_type="",
        problem_description=probleme.strip(),
        maintenance_state=etat_maintenance,
        severity=gravite,
        transport_conditions_initial=conditions_acheminement.strip(),
        status=AlertStatus.EN_COURS_DE_TRAITEMENT,
    )
    db.add(trial)
    db.flush()

    _add_trial_history(
        db,
        trial,
        AlertStatus.EN_COURS_DE_TRAITEMENT,
        current_user.id,
        "Demande d'essai en ligne creee et transmise au permanent.",
    )

    for file in files:
        if not file.filename:
            continue
        saved_name, public_path = save_upload(file)
        db.add(
            OnlineTrialAttachment(
                trial_id=trial.id,
                filename=file.filename,
                stored_path=public_path,
                content_type=file.content_type or "application/octet-stream",
            )
        )

    db.commit()
    trial = _get_online_trial_or_404(db, trial.id)
    await manager.broadcast(
        "alerts",
        {"type": "online_trial_created", "trial_id": trial.id, "status": trial.status.value},
    )
    return trial


@router.put("/{trial_id}", response_model=OnlineTrialRead)
async def update_online_trial(
    trial_id: int,
    payload: OnlineTrialUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.ETABLISSEMENT, UserRole.PROJET, UserRole.ADMIN)
    ),
) -> OnlineTrialRequest:
    trial = _get_online_trial_or_404(db, trial_id)
    if current_user.role != UserRole.ADMIN and trial.created_by_user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Modification non autorisee")
    if trial.status != AlertStatus.A_MODIFIER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cette demande d'essai ne peut pas etre modifiee",
        )

    dossier_root_id = trial.dossier_parent_id or trial.id
    has_newer_version = db.execute(
        select(OnlineTrialRequest.id)
        .where(
            or_(
                OnlineTrialRequest.id == dossier_root_id,
                OnlineTrialRequest.dossier_parent_id == dossier_root_id,
            ),
            OnlineTrialRequest.dossier_iteration > trial.dossier_iteration,
        )
        .limit(1)
    ).scalar_one_or_none()
    if has_newer_version:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cette demande est deja cloturee. Modifiez la version la plus recente du dossier.",
        )

    ensure_station_exists(db, payload.departure_station_id)
    ensure_station_exists(db, payload.arrival_station_id)
    mode_for_validation = _normalize_online_trial_mode(payload.mode_acheminement)
    if _contains_mr_material(payload.type_materiel):
        mode_for_validation = "-"
    _validate_online_trial_form_rules(
        db,
        parcours_aller=payload.parcours_aller,
        parcours_retour=payload.parcours_retour,
        type_materiel=payload.type_materiel,
        identifiant_materiel=payload.identifiant_materiel,
        materiel_concerne=payload.materiel_concerne,
        date_depart=payload.date_depart,
        vitesse=payload.vitesse,
        mode_acheminement=mode_for_validation,
        probleme=payload.probleme,
        etat_maintenance=payload.etat_maintenance.value,
        gravite=payload.gravite.value,
        conditions_acheminement=payload.conditions_acheminement,
    )

    next_iteration = (
        db.execute(
            select(func.max(OnlineTrialRequest.dossier_iteration)).where(
                or_(
                    OnlineTrialRequest.id == dossier_root_id,
                    OnlineTrialRequest.dossier_parent_id == dossier_root_id,
                )
            )
        ).scalar_one_or_none()
        or 0
    ) + 1

    normalized_mode = mode_for_validation

    new_trial = OnlineTrialRequest(
        created_by_user_id=trial.created_by_user_id,
        dossier_number=trial.dossier_number,
        dossier_parent_id=dossier_root_id,
        dossier_iteration=next_iteration,
        departure_station_id=payload.departure_station_id,
        arrival_station_id=payload.arrival_station_id,
        station_id=payload.departure_station_id,
        material_type=payload.type_materiel,
        material_ref=payload.identifiant_materiel,
        material_concerned=(payload.materiel_concerne or "").strip() or None,
        departure_date=payload.date_depart,
        arrival_date=None,
        request_date=payload.date_depart,
        speed_kmh=payload.vitesse,
        parcours_aller=payload.parcours_aller,
        parcours_retour=payload.parcours_retour,
        transport_mode=normalized_mode,
        transport_type="",
        problem_description=payload.probleme.strip(),
        maintenance_state=payload.etat_maintenance,
        severity=payload.gravite,
        transport_conditions_initial=payload.conditions_acheminement.strip(),
        status=AlertStatus.EN_COURS_DE_TRAITEMENT,
        pm_reference_at=None,
        trial_material_progress=None,
    )
    db.add(new_trial)
    db.flush()

    for attachment in trial.attachments:
        db.add(
            OnlineTrialAttachment(
                trial_id=new_trial.id,
                filename=attachment.filename,
                stored_path=attachment.stored_path,
                content_type=attachment.content_type,
            )
        )

    _add_trial_history(
        db,
        trial,
        AlertStatus.MODIFIEE,
        current_user.id,
        f"Demande d'essai modifiee et cloturee. Nouvelle version creee: dossier {new_trial.dossier_label}",
    )
    _add_trial_history(
        db,
        new_trial,
        AlertStatus.EN_COURS_DE_TRAITEMENT,
        current_user.id,
        f"Demande regeneree depuis dossier {trial.dossier_label}",
    )

    db.commit()
    trial = _get_online_trial_or_404(db, new_trial.id)
    await manager.broadcast(
        "alerts",
        {"type": "online_trial_created", "trial_id": trial.id, "status": trial.status.value},
    )
    return trial


@router.get("", response_model=list[OnlineTrialRead])
def list_online_trials(
    mine: bool = Query(default=False),
    status_filter: Optional[AlertStatus] = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[OnlineTrialRequest]:
    stmt = _online_trial_query().order_by(OnlineTrialRequest.created_at.desc())
    if current_user.role in {UserRole.ETABLISSEMENT, UserRole.PROJET}:
        stmt = stmt.where(OnlineTrialRequest.created_by_user_id == current_user.id)
    elif mine:
        stmt = stmt.where(OnlineTrialRequest.created_by_user_id == current_user.id)

    if status_filter:
        stmt = stmt.where(OnlineTrialRequest.status == status_filter)

    trials = list(db.execute(stmt).unique().scalars())
    return _apply_online_trial_collection_derived_fields(trials)


@router.get("/{trial_id}", response_model=OnlineTrialRead)
def get_online_trial(
    trial_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OnlineTrialRequest:
    trial = _get_online_trial_or_404(db, trial_id)
    _authorize_online_trial_access(trial, current_user)
    return trial


@router.post("/{trial_id}/decision", response_model=OnlineTrialRead)
async def create_online_trial_decision(
    trial_id: int,
    payload: OnlineTrialDecisionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.PERMANENT, UserRole.ADMIN)),
) -> OnlineTrialRequest:
    trial = _get_online_trial_or_404(db, trial_id)
    if _is_online_trial_closed(trial):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ce dossier d'essai est cloture et ne peut plus etre modifie",
        )
    decision_kind = payload.decision
    commentaire = (payload.commentaire or "").strip() or None
    existing_decision = trial.permanent_decision
    material_count = _online_trial_material_count(trial)
    now = _now_utc()
    now_iso = now.isoformat()

    if decision_kind == "MODIFIER":
        if not commentaire:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Le motif de modification est obligatoire",
            )
        if existing_decision:
            previous_material_decisions = _parse_json_object(existing_decision.material_decisions)
            updated_material_decisions: dict[str, dict] = {}
            for index in range(material_count):
                key = str(index)
                current = dict(previous_material_decisions.get(key, {}))
                updated_material_decisions[key] = {
                    "ppm_status": "MODIFIEE",
                    "ppm_reason": commentaire,
                    "updated_at": now_iso,
                    **{
                        k: v
                        for k, v in current.items()
                        if k not in {"ppm_status", "ppm_reason", "updated_at"}
                    },
                }
            existing_decision.permanent_user_id = current_user.id
            existing_decision.comment = commentaire
            existing_decision.material_decisions = json.dumps(updated_material_decisions)
        _add_trial_history(
            db,
            trial,
            AlertStatus.A_MODIFIER,
            current_user.id,
            commentaire,
        )
        db.commit()
        trial = _get_online_trial_or_404(db, trial.id)
        await manager.broadcast(
            "alerts",
            {"type": "online_trial_decision", "trial_id": trial.id, "status": trial.status.value},
        )
        return trial

    if decision_kind == "ANNULER":
        if not commentaire:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Le motif d'annulation est obligatoire",
            )
        canceled_material_decisions = {
            str(index): {
                "ppm_status": "ANNULEE",
                "ppm_reason": commentaire,
                "updated_at": now_iso,
            }
            for index in range(material_count)
        }
        if existing_decision:
            existing_decision.permanent_user_id = current_user.id
            existing_decision.decision = DecisionKind.ANNULER
            existing_decision.comment = commentaire
            existing_decision.material_decisions = json.dumps(canceled_material_decisions)
        else:
            db.add(
                OnlineTrialDecision(
                    trial_id=trial.id,
                    permanent_user_id=current_user.id,
                    decision=DecisionKind.ANNULER,
                    comment=commentaire,
                    material_decisions=json.dumps(canceled_material_decisions),
                )
            )
        _add_trial_history(
            db,
            trial,
            AlertStatus.ANNULEE,
            current_user.id,
            commentaire,
        )
        db.commit()
        trial = _get_online_trial_or_404(db, trial.id)
        await manager.broadcast(
            "alerts",
            {"type": "online_trial_decision", "trial_id": trial.id, "status": trial.status.value},
        )
        return trial

    next_material_decisions = {
        str(index): {
            "ppm_status": "ACCEPTEE",
            "ppm_reason": None,
            "updated_at": now_iso,
        }
        for index in range(material_count)
    }

    if existing_decision:
        existing_decision.permanent_user_id = current_user.id
        existing_decision.decision = DecisionKind.CONFIRMER
        existing_decision.comment = commentaire
        existing_decision.material_decisions = json.dumps(next_material_decisions)
    else:
        db.add(
            OnlineTrialDecision(
                trial_id=trial.id,
                permanent_user_id=current_user.id,
                decision=DecisionKind.CONFIRMER,
                comment=commentaire,
                material_decisions=json.dumps(next_material_decisions),
            )
        )

    trial.pm_reference_at = now
    next_status = _compute_trial_status_from_progress(trial, next_material_decisions)
    status_note = commentaire or "Demande d'essai analysee par le permanent."

    _add_trial_history(db, trial, next_status, current_user.id, status_note)
    db.commit()

    trial = _get_online_trial_or_404(db, trial.id)
    await manager.broadcast(
        "alerts",
        {"type": "online_trial_decision", "trial_id": trial.id, "status": trial.status.value},
    )
    return trial


@router.post("/{trial_id}/progress", response_model=OnlineTrialRead)
async def update_online_trial_progress(
    trial_id: int,
    payload: OnlineTrialProgressUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.ETABLISSEMENT, UserRole.PROJET, UserRole.ADMIN)
    ),
) -> OnlineTrialRequest:
    trial = _get_online_trial_or_404(db, trial_id)
    if current_user.role != UserRole.ADMIN and trial.created_by_user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Mise a jour non autorisee")
    if _is_online_trial_closed(trial):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ce dossier d'essai est cloture et ne peut plus etre modifie",
        )

    if not trial.permanent_decision or trial.permanent_decision.decision != DecisionKind.CONFIRMER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le suivi d'essai est disponible apres validation du permanent",
        )

    accepted_indexes = _accepted_trial_material_indexes(trial)
    accepted_set = set(accepted_indexes)
    if not accepted_indexes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Aucun materiel accepte pour cette demande d'essai",
        )
    if not payload.material_updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Renseignez au moins un materiel a mettre a jour",
        )

    material_decisions = _parse_json_object(trial.permanent_decision.material_decisions)
    progress = _parse_json_object(trial.trial_material_progress)
    planned_departure = trial.departure_date
    if planned_departure and planned_departure.tzinfo is None:
        planned_departure = planned_departure.replace(tzinfo=timezone.utc)
    for update in payload.material_updates:
        if update.index not in accepted_set:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Seuls les materiels acceptes peuvent etre suivis",
            )

        key = str(update.index)
        current = dict(progress.get(key, {}))
        realization = update.realization_date or update.return_date or update.departure_date
        result_value = update.result
        remarks_value = (update.remarks or "").strip() or None
        if realization and realization.tzinfo is None:
            realization = realization.replace(tzinfo=timezone.utc)
        if not update.performed:
            if result_value is not None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Le resultat ne peut etre renseigne que pour un essai realise",
                )
            realization = None
            result_value = None
            remarks_value = None
        else:
            if not realization:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="La date de realisation est obligatoire quand l'essai est marque comme realise",
                )
            if result_value not in {"CONCLUANT", "NON_CONCLUANT"}:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Le champ Resultat est obligatoire (Concluant ou Non concluant)",
                )
            if result_value == "NON_CONCLUANT" and not remarks_value:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Le champ Observation est obligatoire pour un resultat Non concluant",
                )
            if result_value == "CONCLUANT":
                remarks_value = None

        delay_minutes: Optional[int] = None
        if update.performed and realization and planned_departure:
            delay_minutes = int((realization - planned_departure).total_seconds() // 60)

        current.update(
            {
                "performed": bool(update.performed),
                "result": result_value,
                "realization_date": realization.isoformat() if realization else None,
                "departure_date": None,
                "return_date": None,
                "delay_minutes": delay_minutes,
                "remarks": remarks_value,
                "updated_at": _now_utc().isoformat(),
            }
        )
        progress[key] = current

    trial.trial_material_progress = json.dumps(progress)
    next_status = _compute_trial_status_from_progress(trial, material_decisions)
    history_note = (payload.global_remarks or "").strip() or "Suivi d'essai mis a jour."
    _add_trial_history(db, trial, next_status, current_user.id, history_note)
    db.commit()

    trial = _get_online_trial_or_404(db, trial.id)
    await manager.broadcast(
        "alerts",
        {"type": "online_trial_progress", "trial_id": trial.id, "status": trial.status.value},
    )
    return trial
