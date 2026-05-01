from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models.enums import AgentDecision, AlertStatus, MaintenanceState, Severity
from app.schemas.auth import UserSummary
from app.schemas.common import EstablishmentRead, StationRead


class AlertCreate(BaseModel):
    station_id: int
    etablissement_dest_id: Optional[int] = None
    type_materiel: str = Field(min_length=1, max_length=120)
    identifiant_materiel: str = Field(min_length=1, max_length=120)
    materiel_concerne: Optional[str] = None
    date_demande: Optional[datetime] = None
    vitesse: Optional[int] = Field(default=None, ge=0, le=500)
    mode_acheminement: str = Field(min_length=1, max_length=80)
    type_acheminement: str = Field(min_length=1, max_length=80)
    probleme: str = ""
    etat_maintenance: MaintenanceState
    gravite: Severity
    conditions_acheminement: str = ""
    decision_agent: AgentDecision


class AlertUpdate(BaseModel):
    station_id: int
    etablissement_dest_id: Optional[int] = None
    type_materiel: str = Field(min_length=1, max_length=120)
    identifiant_materiel: str = Field(min_length=1, max_length=120)
    materiel_concerne: Optional[str] = None
    date_demande: Optional[datetime] = None
    vitesse: Optional[int] = Field(default=None, ge=0, le=500)
    mode_acheminement: str = Field(min_length=1, max_length=80)
    type_acheminement: str = Field(min_length=1, max_length=80)
    probleme: str = ""
    etat_maintenance: MaintenanceState
    gravite: Severity
    conditions_acheminement: str = ""
    decision_agent: AgentDecision


class AlertStatusUpdate(BaseModel):
    status: AlertStatus
    note: Optional[str] = None


class MaterialPmReasonUpdate(BaseModel):
    index: int = Field(ge=0)
    motif_pm: Optional[str] = None


class PermanentDecisionCreate(BaseModel):
    etablissement_dest_id: Optional[int] = None
    commentaire: Optional[str] = None
    accepted_material_indexes: list[int] = Field(default_factory=list)
    canceled_material_indexes: list[int] = Field(default_factory=list)
    motif_pm: Optional[str] = None
    material_reason_updates: list[MaterialPmReasonUpdate] = Field(default_factory=list)
    decision: str = Field(pattern="^(CONFIRMER|ANNULER|MODIFIER)$")


class MaterialReceptionUpdate(BaseModel):
    index: int = Field(ge=0)
    date_reception: datetime
    outcome: str = Field(pattern="^(VALIDEE|EN_INSTANCE|EN_ATTENTE)$")
    reason: Optional[str] = None


class EstablishmentConfirmationCreate(BaseModel):
    confirmed_material_indexes: list[int] = Field(default_factory=list)
    material_updates: list[MaterialReceptionUpdate] = Field(default_factory=list)
    remarques: Optional[str] = None
    reception_outcome: Optional[str] = Field(
        default=None,
        pattern="^(RECEPTION_COMPLETE|RECEPTION_PARTIELLE)$",
    )


class AlertStatusHistoryRead(BaseModel):
    id: int
    status: AlertStatus
    changed_at: datetime
    note: Optional[str] = None
    changed_by: Optional[UserSummary] = None

    model_config = {"from_attributes": True}


class PermanentDecisionRead(BaseModel):
    id: int
    decision: AgentDecision
    comment: Optional[str] = None
    material_decisions: Optional[str] = None
    destination_establishment: EstablishmentRead
    permanent_user: UserSummary
    created_at: datetime

    model_config = {"from_attributes": True}


class EstablishmentConfirmationRead(BaseModel):
    id: int
    confirmed_at: datetime
    reception_date: datetime
    confirmed_material_indexes: Optional[str] = None
    material_confirmations: Optional[str] = None
    delay_minutes: Optional[int] = None
    remarks: Optional[str] = None
    establishment_user: UserSummary

    model_config = {"from_attributes": True}


class AlertAttachmentRead(BaseModel):
    id: int
    filename: str
    stored_path: str
    content_type: str
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class MailEventRead(BaseModel):
    id: int
    event_type: str
    subject: str
    body: str
    sender_email: Optional[str] = None
    recipient_emails: str
    delivery_status: str
    error_message: Optional[str] = None
    created_at: datetime
    triggered_by: Optional[UserSummary] = None

    model_config = {"from_attributes": True}


class AlertRevisionRead(BaseModel):
    id: int
    revision_number: int
    archived_at: datetime
    station: StationRead
    requested_destination_establishment: Optional[EstablishmentRead] = None
    material_type: str
    material_ref: str
    material_concerned: Optional[str] = None
    request_date: Optional[datetime] = None
    speed_kmh: Optional[int] = None
    transport_mode: str
    transport_type: str
    problem_description: str
    maintenance_state: MaintenanceState
    severity: Severity
    transport_conditions_initial: str
    agent_decision: AgentDecision
    archived_by: Optional[UserSummary] = None

    model_config = {"from_attributes": True}


class AlertRead(BaseModel):
    id: int
    dossier_number: int
    dossier_parent_id: Optional[int] = None
    dossier_iteration: int = 0
    dossier_label: str
    created_at: datetime
    updated_at: Optional[datetime]
    material_type: str
    material_ref: str
    material_concerned: Optional[str] = None
    request_date: Optional[datetime] = None
    speed_kmh: Optional[int] = None
    transport_mode: str
    transport_type: str
    problem_description: str
    maintenance_state: MaintenanceState
    severity: Severity
    transport_conditions_initial: str
    agent_decision: AgentDecision
    status: AlertStatus
    created_by: UserSummary
    station: StationRead
    requested_destination_establishment: Optional[EstablishmentRead] = None
    history: list[AlertStatusHistoryRead]
    attachments: list[AlertAttachmentRead] = []
    mail_events: list[MailEventRead] = []
    revisions: list[AlertRevisionRead] = []
    permanent_decision: Optional[PermanentDecisionRead] = None
    establishment_confirmation: Optional[EstablishmentConfirmationRead] = None

    model_config = {"from_attributes": True}
