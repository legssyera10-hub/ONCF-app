from __future__ import annotations

from enum import Enum


class UserRole(str, Enum):
    AGENT = "AGENT"
    PERMANENT = "PERMANENT"
    ETABLISSEMENT = "ETABLISSEMENT"
    ADMIN = "ADMIN"
    SUIVI = "SUIVI"


class MaterialType(str, Enum):
    MM = "MM"
    MR = "MR"


class MaintenanceState(str, Enum):
    OK = "OK"
    A_SURVEILLER = "A_SURVEILLER"
    PFL = "PFL"
    PV = "PV"
    A_REPARER = "A_REPARER"
    CRITIQUE = "CRITIQUE"


class Severity(str, Enum):
    NIVEAU_1 = "NIVEAU_1"
    NIVEAU_2 = "NIVEAU_2"
    NIVEAU_3 = "NIVEAU_3"
    NIVEAU_4 = "NIVEAU_4"
    NIVEAU_5 = "NIVEAU_5"


class AgentDecision(str, Enum):
    CONFIRMER = "CONFIRMER"
    ANNULER = "ANNULER"


class AlertStatus(str, Enum):
    EN_COURS_DE_TRAITEMENT = "EN_COURS_DE_TRAITEMENT"
    A_MODIFIER = "A_MODIFIER"
    MODIFIEE = "MODIFIEE"
    TRAITEE_PAR_PM = "TRAITEE_PAR_PM"
    ANNULEE = "ANNULEE"
    RECEPTION_PARTIELLE = "RECEPTION_PARTIELLE"
    RECEPTION_COMPLETE = "RECEPTION_COMPLETE"


class DecisionKind(str, Enum):
    CONFIRMER = "CONFIRMER"
    ANNULER = "ANNULER"
