from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from app.models.app_setting import AppSetting

ALERT_FORM_CONFIG_KEY = "alert_form_config_v1"

DEFAULT_SPEED_OPTIONS = [
    "140",
    "130",
    "120",
    "110",
    "100",
    "90",
    "80",
    "70",
    "60",
    "50",
    "40",
    "30",
    "20",
    "10",
    "5",
]
LEGACY_SPEED_OPTIONS = ["70", "60", "50", "40", "30", "20", "10", "5"]
SEVERITY_OPTIONS = ["NIVEAU_1", "NIVEAU_2", "NIVEAU_3", "NIVEAU_4", "NIVEAU_5"]
MAINTENANCE_OPTIONS = ["OK", "A_SURVEILLER", "PFL", "PV", "A_REPARER", "CRITIQUE"]
AGENT_DECISION_OPTIONS = ["CONFIRMER", "ANNULER"]

DEFAULT_ALERT_FORM_CONFIG: dict[str, dict[str, Any]] = {
    "station_id": {"required": True, "options": []},
    "etablissement_dest_id": {"required": True, "options": []},
    "date_demande": {"required": False, "options": []},
    "type_materiel": {"required": True, "options": ["MM", "MR"]},
    "serie": {
        "required": True,
        "options": [
            "E1100",
            "E1250",
            "E1300",
            "E1350",
            "E1400",
            "E1450",
            "Z2M",
            "ZM",
            "DH350",
            "DH400",
            "WAGON",
            "VOITURE",
            "VOITURE+FG",
            "FG",
            "DI500",
            "DK550",
            "DM600",
            "DF100",
            "AUTRE",
        ],
    },
    "materiel_concerne": {"required": False, "options": []},
    "mode_acheminement": {"required": True, "options": ["FRET", "VOYAGEUR"]},
    "type_acheminement": {"required": True, "options": ["HLP", "VHL"]},
    "etat_maintenance": {"required": True, "options": ["PFL", "PV"]},
    "gravite": {"required": True, "options": ["NIVEAU_1", "NIVEAU_2"]},
    "vitesse": {"required": False, "options": DEFAULT_SPEED_OPTIONS},
    "probleme": {"required": True, "options": []},
    "conditions_acheminement": {"required": True, "options": []},
    "decision_agent": {"required": True, "options": AGENT_DECISION_OPTIONS},
}


def _normalize_speed_options(options: list[str]) -> list[str]:
    parsed: list[str] = []
    for item in options:
        token = item.strip()
        if not token or not token.isdigit():
            continue
        value = int(token)
        if 0 <= value <= 500:
            parsed.append(str(value))

    unique = list(dict.fromkeys(parsed))
    if unique == LEGACY_SPEED_OPTIONS:
        return list(DEFAULT_SPEED_OPTIONS)
    return unique if unique else list(DEFAULT_SPEED_OPTIONS)


def _normalize_enum_options(options: list[str], allowed: list[str], fallback: list[str]) -> list[str]:
    allowed_set = set(allowed)
    unique = list(dict.fromkeys([item for item in options if item in allowed_set]))
    return unique if unique else list(fallback)


def normalize_alert_form_config(raw: Any) -> dict[str, dict[str, Any]]:
    normalized: dict[str, dict[str, Any]] = {}
    source = raw if isinstance(raw, dict) else {}
    fields = source.get("fields") if isinstance(source.get("fields"), dict) else source
    for field_name, defaults in DEFAULT_ALERT_FORM_CONFIG.items():
        raw_field = fields.get(field_name) if isinstance(fields, dict) else None
        required = defaults["required"]
        options = list(defaults["options"])

        if isinstance(raw_field, dict):
            if "required" in raw_field:
                required = bool(raw_field.get("required"))
            raw_options = raw_field.get("options")
            if isinstance(raw_options, list):
                cleaned = [str(item).strip() for item in raw_options if str(item).strip()]
                unique = list(dict.fromkeys(cleaned))
                options = unique if unique else options

        if field_name == "vitesse":
            options = _normalize_speed_options(options)
        elif field_name == "gravite":
            options = _normalize_enum_options(options, SEVERITY_OPTIONS, defaults["options"])
        elif field_name == "etat_maintenance":
            options = _normalize_enum_options(options, MAINTENANCE_OPTIONS, defaults["options"])
        elif field_name == "decision_agent":
            options = _normalize_enum_options(options, AGENT_DECISION_OPTIONS, defaults["options"])

        normalized[field_name] = {
            "required": required,
            "options": options,
        }
    return normalized


def get_alert_form_config(db: Session) -> dict[str, dict[str, Any]]:
    setting = db.get(AppSetting, ALERT_FORM_CONFIG_KEY)
    if not setting or not setting.value:
        return normalize_alert_form_config({})

    try:
        raw = json.loads(setting.value)
    except (TypeError, ValueError):
        return normalize_alert_form_config({})
    return normalize_alert_form_config(raw)


def save_alert_form_config(db: Session, payload: dict[str, Any]) -> dict[str, dict[str, Any]]:
    normalized = normalize_alert_form_config(payload)
    setting = db.get(AppSetting, ALERT_FORM_CONFIG_KEY)
    serialized = json.dumps({"fields": normalized}, ensure_ascii=True)
    if setting:
        setting.value = serialized
    else:
        db.add(AppSetting(key=ALERT_FORM_CONFIG_KEY, value=serialized))
    return normalized
