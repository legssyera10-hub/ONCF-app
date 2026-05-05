from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models.enums import AlertStatus, MaintenanceState, Severity
from app.schemas.auth import UserSummary
from app.schemas.common import StationRead


class OnlineTrialMaterialReasonUpdate(BaseModel):
    index: int = Field(ge=0)
    motif_pm: Optional[str] = None


class OnlineTrialCreate(BaseModel):
    departure_station_id: int
    arrival_station_id: int
    parcours_aller: bool = True
    parcours_retour: bool = True
    type_materiel: str = Field(min_length=1, max_length=120)
    identifiant_materiel: str = Field(min_length=1, max_length=120)
    materiel_concerne: Optional[str] = None
    date_depart: Optional[datetime] = None
    vitesse: Optional[int] = Field(default=None, ge=0, le=500)
    mode_acheminement: str = Field(default="", max_length=80)
    probleme: str = ""
    etat_maintenance: MaintenanceState
    gravite: Severity
    conditions_acheminement: str = ""


class OnlineTrialUpdate(BaseModel):
    departure_station_id: int
    arrival_station_id: int
    parcours_aller: bool = True
    parcours_retour: bool = True
    type_materiel: str = Field(min_length=1, max_length=120)
    identifiant_materiel: str = Field(min_length=1, max_length=120)
    materiel_concerne: Optional[str] = None
    date_depart: Optional[datetime] = None
    vitesse: Optional[int] = Field(default=None, ge=0, le=500)
    mode_acheminement: str = Field(default="", max_length=80)
    probleme: str = ""
    etat_maintenance: MaintenanceState
    gravite: Severity
    conditions_acheminement: str = ""


class OnlineTrialDecisionCreate(BaseModel):
    commentaire: Optional[str] = None
    accepted_material_indexes: list[int] = Field(default_factory=list)
    canceled_material_indexes: list[int] = Field(default_factory=list)
    material_reason_updates: list[OnlineTrialMaterialReasonUpdate] = Field(default_factory=list)
    decision: str = Field(pattern="^(CONFIRMER|ANNULER|MODIFIER)$")


class OnlineTrialProgressMaterialUpdate(BaseModel):
    index: int = Field(ge=0)
    performed: bool = False
    realization_date: Optional[datetime] = None
    departure_date: Optional[datetime] = None
    return_date: Optional[datetime] = None
    remarks: Optional[str] = None


class OnlineTrialProgressUpdate(BaseModel):
    material_updates: list[OnlineTrialProgressMaterialUpdate] = Field(default_factory=list)
    global_remarks: Optional[str] = None


class OnlineTrialStatusHistoryRead(BaseModel):
    id: int
    status: AlertStatus
    changed_at: datetime
    note: Optional[str] = None
    changed_by: Optional[UserSummary] = None

    model_config = {"from_attributes": True}


class OnlineTrialDecisionRead(BaseModel):
    id: int
    decision: str
    comment: Optional[str] = None
    material_decisions: Optional[str] = None
    permanent_user: UserSummary
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class OnlineTrialAttachmentRead(BaseModel):
    id: int
    filename: str
    stored_path: str
    content_type: str
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class OnlineTrialRead(BaseModel):
    id: int
    dossier_number: int
    dossier_parent_id: Optional[int] = None
    dossier_iteration: int
    dossier_label: str
    created_at: datetime
    updated_at: Optional[datetime]
    material_type: str
    material_ref: str
    material_concerned: Optional[str] = None
    departure_date: Optional[datetime] = None
    arrival_date: Optional[datetime] = None
    request_date: Optional[datetime] = None
    speed_kmh: Optional[int] = None
    parcours_aller: bool = True
    parcours_retour: bool = True
    transport_mode: str
    transport_type: str
    problem_description: str
    maintenance_state: MaintenanceState
    severity: Severity
    transport_conditions_initial: str
    status: AlertStatus
    pm_reference_at: Optional[datetime] = None
    trial_material_progress: Optional[str] = None
    created_by: UserSummary
    station: StationRead
    departure_station: Optional[StationRead] = None
    arrival_station: Optional[StationRead] = None
    history: list[OnlineTrialStatusHistoryRead]
    attachments: list[OnlineTrialAttachmentRead] = []
    permanent_decision: Optional[OnlineTrialDecisionRead] = None

    model_config = {"from_attributes": True}
