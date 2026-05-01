from __future__ import annotations

from datetime import datetime
from email.message import EmailMessage
from html import escape
import json
from smtplib import SMTP, SMTPException
from typing import Callable, Iterable, Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.alert import Alert, MailEvent
from app.models.user import User


def _normalize_recipients(recipients: Iterable[Optional[str]]) -> list[str]:
    seen: set[str] = set()
    normalized: list[str] = []
    for value in recipients:
        email = (value or "").strip()
        if not email:
            continue
        key = email.lower()
        if key in seen:
            continue
        seen.add(key)
        normalized.append(email)
    return normalized


def _display_text(value: Optional[object], fallback: str = "") -> str:
    if hasattr(value, "value"):
        value = value.value
    text = str(value).strip() if value is not None else ""
    return text or fallback


def _split_joined_values(value: Optional[str]) -> list[str]:
    return [item.strip() for item in (value or "").split(" + ") if item.strip()]


def _parse_json_object(value: Optional[str]) -> dict[str, dict]:
    if not value:
        return {}
    try:
        parsed = json.loads(value)
    except (TypeError, ValueError):
        return {}
    if not isinstance(parsed, dict):
        return {}
    return {str(key): item for key, item in parsed.items() if isinstance(item, dict)}


def _parse_confirmed_indexes(value: Optional[str]) -> set[int]:
    indexes: set[int] = set()
    for item in (value or "").split(","):
        token = item.strip()
        if not token:
            continue
        try:
            parsed = int(token)
        except ValueError:
            continue
        if parsed >= 0:
            indexes.add(parsed)
    return indexes


def _format_date(value: Optional[datetime]) -> str:
    if not value:
        return ""
    return value.astimezone().strftime("%d/%m/%Y") if getattr(value, "tzinfo", None) else value.strftime("%d/%m/%Y")


def _format_time(value: Optional[datetime]) -> str:
    if not value:
        return ""
    return value.astimezone().strftime("%H:%M") if getattr(value, "tzinfo", None) else value.strftime("%H:%M")


def _format_datetime_from_iso(value: Optional[object]) -> str:
    if not isinstance(value, str) or not value.strip():
        return ""
    normalized = value.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return ""
    return _format_date(parsed) + " " + _format_time(parsed)


def _demandeur_code(alert: Alert) -> str:
    return _display_text(alert.created_by.establishment.code if alert.created_by and alert.created_by.establishment else None)


def _destinataire_code(alert: Alert) -> str:
    if alert.permanent_decision and alert.permanent_decision.destination_establishment:
        return _display_text(alert.permanent_decision.destination_establishment.code)
    if alert.requested_destination_establishment:
        return _display_text(alert.requested_destination_establishment.code)
    return ""


def _dossier_label(alert: Alert) -> str:
    return f"Dossier #{alert.dossier_label}"


def _accompagnement_label(alert: Alert) -> str:
    mapping = {
        "NIVEAU_1": "Sans",
        "NIVEAU_2": "Avec",
    }
    return mapping.get(_display_text(alert.severity), "")


def _exploitant_label(alert: Alert) -> str:
    value = _display_text(alert.maintenance_state)
    return value if value in {"PFL", "PV"} else value


def _autres_label(alert: Alert) -> str:
    return _display_text(alert.transport_conditions_initial)


def _state_label(value: str) -> str:
    mapping = {
        "CONFIRMER": "Traitée par PPM",
        "ANNULER": "Annulée",
        "MODIFIER": "À modifier",
    }
    return mapping.get(value, value)


def _status_state_label(status: Optional[object]) -> str:
    value = _display_text(status)
    mapping = {
        "EN_COURS_DE_TRAITEMENT": "En cours de traitement",
        "A_MODIFIER": "À modifier",
        "MODIFIEE": "Modifiée",
        "TRAITEE_PAR_PM": "Traitée par PPM",
        "ANNULEE": "Annulée",
        "RECEPTION_PARTIELLE": "Réception partielle",
        "RECEPTION_COMPLETE": "Réception complète",
    }
    return mapping.get(value, value)


def _global_ppm_reason(alert: Alert) -> str:
    if not alert.history:
        return ""
    for item in sorted(alert.history, key=lambda row: row.changed_at, reverse=True):
        status_value = _display_text(item.status)
        if status_value in {"A_MODIFIER", "ANNULEE"} and item.note:
            return item.note.strip()
    return ""


def _build_instance_observation(confirmation: dict) -> str:
    reception_status = confirmation.get("reception_status")
    instance_used_once = bool(confirmation.get("instance_used_once"))
    if reception_status == "EN_INSTANCE" and instance_used_once:
        started_at = (
            confirmation.get("last_instance_started_at")
            or confirmation.get("en_instance_started_at")
            or confirmation.get("confirmed_at")
        )
        label = _format_datetime_from_iso(started_at)
        return f"Mis en instance le {label}" if label else "Mis en instance"
    return ""


def _build_material_rows(alert: Alert, fallback_ppm_reason: Optional[str] = None) -> list[dict[str, str]]:
    types = _split_joined_values(alert.material_type)
    series = _split_joined_values(alert.material_ref)
    concerned = _split_joined_values(alert.material_concerned)
    material_count = max(len(types), len(series), len(concerned), 1)

    ppm_decisions = _parse_json_object(alert.permanent_decision.material_decisions if alert.permanent_decision else None)
    confirmations = _parse_json_object(
        alert.establishment_confirmation.material_confirmations if alert.establishment_confirmation else None
    )
    confirmed_indexes = _parse_confirmed_indexes(
        alert.establishment_confirmation.confirmed_material_indexes if alert.establishment_confirmation else None
    )

    status_value = _display_text(alert.status)
    if status_value == "A_MODIFIER":
        global_ppm_status = "A_MODIFIER"
    elif status_value == "MODIFIEE":
        global_ppm_status = "MODIFIEE"
    elif status_value == "ANNULEE":
        global_ppm_status = "ANNULEE"
    else:
        global_ppm_status = None
    global_reason = (fallback_ppm_reason or "").strip() or _global_ppm_reason(alert)

    rows: list[dict[str, str]] = []
    for index in range(material_count):
        key = str(index)
        decision = ppm_decisions.get(key, {})
        confirmation = confirmations.get(key, {})

        raw_ppm_status = decision.get("ppm_status") or global_ppm_status or "PENDING"
        ppm_state = (
            "Acceptée"
            if raw_ppm_status == "ACCEPTEE"
            else ("À modifier" if raw_ppm_status == "A_MODIFIER" else ("Annulée" if raw_ppm_status == "ANNULEE" else ("Modifiée" if raw_ppm_status == "MODIFIEE" else "En attente")))
        )
        ppm_reason = _display_text(decision.get("ppm_reason")) or (
            global_reason if raw_ppm_status in {"A_MODIFIER", "ANNULEE", "MODIFIEE"} else ""
        )

        is_confirmed = bool(confirmation.get("confirmed")) or index in confirmed_indexes
        reception_status = _display_text(confirmation.get("reception_status"))
        if reception_status == "VALIDEE" or (not reception_status and is_confirmed):
            reception_label = "Validée"
        elif reception_status == "EN_INSTANCE":
            reception_label = "En instance"
        else:
            reception_label = "Non confirmée"

        observation_parts = [_display_text(confirmation.get("remarks")), _build_instance_observation(confirmation)]
        observation = " ".join(part for part in observation_parts if part).strip()

        rows.append(
            {
                "index": str(index + 1),
                "type": types[index] if index < len(types) else (types[0] if types else ""),
                "serie": series[index] if index < len(series) else (series[0] if series else ""),
                "materiel": concerned[index] if index < len(concerned) else (concerned[0] if concerned else ""),
                "ppm_state": ppm_state,
                "ppm_status": _display_text(raw_ppm_status),
                "ppm_reason": ppm_reason,
                "reception": reception_label,
                "reception_date": _format_datetime_from_iso(confirmation.get("reception_date")),
                "observation": observation,
            }
        )

    return rows


def _render_text_mail(
    title: str,
    intro_lines: list[str],
    summary_lines: list[str],
    material_headers: list[str],
    material_rows: list[list[str]],
) -> str:
    lines = [title, "", "Bonjour,", ""]
    lines.extend(intro_lines)
    lines.extend(["", "Informations generales:"])
    lines.extend(summary_lines)
    lines.extend(["", "Detail materiels:"])
    lines.append(" | ".join(material_headers))
    for row in material_rows:
        lines.append(" | ".join(row))
    return "\n".join(lines)


def _render_html_mail(
    title: str,
    intro_lines: list[str],
    summary_pairs: list[tuple[str, str]],
    material_headers: list[str],
    material_rows: list[list[str]],
) -> str:
    summary_html = "".join(
        "<tr>"
        f"<td style=\"width:32%;padding:10px;border-bottom:1px solid #e2e8f0;background:#f8fafc;color:#475569;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;\">{escape(label)}</td>"
        f"<td style=\"padding:10px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px;\">{escape(value or '')}</td>"
        "</tr>"
        for label, value in summary_pairs
    )

    headers_html = "".join(
        f"<th style=\"padding:10px;border-bottom:1px solid #cbd5e1;background:#eef2ff;color:#1e293b;font-size:12px;text-align:left;\">{escape(col)}</th>"
        for col in material_headers
    )
    rows_html = "".join(
        "<tr>"
        + "".join(
            f"<td style=\"padding:10px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#334155;vertical-align:top;\">{escape(cell)}</td>"
            for cell in row
        )
        + "</tr>"
        for row in material_rows
    )
    intro_html = "".join(
        f"<p style=\"margin:0 0 8px 0;font-size:14px;color:#334155;line-height:1.55;\">{escape(line)}</p>"
        for line in intro_lines
    )

    return (
        "<html><body style=\"margin:0;padding:24px;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;\">"
        "<div style=\"max-width:1200px;margin:0 auto;background:#ffffff;border:1px solid #dbeafe;border-radius:20px;overflow:hidden;box-shadow:0 20px 40px -30px rgba(15,23,42,0.45);\">"
        "<div style=\"padding:20px 24px;background:#e2e8f0;border-bottom:1px solid #cbd5e1;\">"
        f"<p style=\"margin:0;font-size:22px;font-weight:700;color:#0f172a;\">{escape(title)}</p>"
        "</div>"
        "<div style=\"padding:22px 24px;\">"
        "<p style=\"margin:0 0 12px 0;font-size:15px;color:#0f172a;\">Bonjour,</p>"
        f"{intro_html}"
        "<div style=\"border:1px solid #cbd5e1;border-radius:14px;overflow:hidden;margin:14px 0 18px 0;\">"
        "<table style=\"width:100%;border-collapse:collapse;\">"
        f"<tbody>{summary_html}</tbody>"
        "</table>"
        "</div>"
        "<div style=\"border:1px solid #cbd5e1;border-radius:14px;overflow:auto;\">"
        "<table style=\"width:100%;border-collapse:collapse;min-width:980px;\">"
        f"<thead><tr>{headers_html}</tr></thead>"
        f"<tbody>{rows_html}</tbody>"
        "</table>"
        "</div>"
        "<p style=\"margin:14px 0 0 0;font-size:12px;color:#64748b;\">Message automatique ONCF - Acheminement materiel roulant.</p>"
        "</div></div></body></html>"
    )


def _build_summary_pairs(alert: Alert, state_label: str) -> list[tuple[str, str]]:
    request_date = alert.request_date or alert.created_at
    if _display_text(alert.transport_mode) == "VOYAGEUR":
        speed_label = "Normal voyageur"
    elif alert.speed_kmh is not None:
        speed_label = f"{alert.speed_kmh} km/h"
    else:
        speed_label = "Normal fret"
    return [
        ("Dossier", _dossier_label(alert)),
        ("Demandeur", _demandeur_code(alert)),
        ("Destinataire", _destinataire_code(alert)),
        ("Date demande", _format_date(request_date)),
        ("Horaire demande", _format_time(request_date)),
        ("Mode", _display_text(alert.transport_mode)),
        ("Type acheminement", _display_text(alert.transport_type)),
        ("Exploitant", _exploitant_label(alert)),
        ("Motif", _display_text(alert.problem_description)),
        ("Accompagnement", _accompagnement_label(alert)),
        ("Vitesse", speed_label),
        ("Autres conditions", _autres_label(alert)),
        ("Etat dossier", state_label),
    ]


def _mail_payload(
    *,
    alert: Alert,
    subject: str,
    intro_lines: list[str],
    state_label: str,
    fallback_ppm_reason: Optional[str] = None,
    material_filter: Optional[Callable[[dict[str, str]], bool]] = None,
) -> tuple[str, str, str]:
    summary_pairs = _build_summary_pairs(alert, state_label)
    summary_lines = [f"- {label}: {value or ''}" for label, value in summary_pairs]

    material_headers = [
        "#",
        "Type materiel",
        "Serie",
        "Materiel concerne",
        "Etat demande (PPM)",
        "Motif PPM",
        "Confirmation reception",
        "Date reception",
        "Observation",
    ]

    material_data = _build_material_rows(alert, fallback_ppm_reason=fallback_ppm_reason)
    if material_filter:
        material_data = [row for row in material_data if material_filter(row)]
    material_rows = [
        [
            row["index"],
            row["type"],
            row["serie"],
            row["materiel"],
            row["ppm_state"],
            row["ppm_reason"],
            row["reception"],
            row["reception_date"],
            row["observation"],
        ]
        for row in material_data
    ]

    text_body = _render_text_mail(
        title=subject,
        intro_lines=intro_lines,
        summary_lines=summary_lines,
        material_headers=material_headers,
        material_rows=material_rows,
    )
    html_body = _render_html_mail(
        title=subject,
        intro_lines=intro_lines,
        summary_pairs=summary_pairs,
        material_headers=material_headers,
        material_rows=material_rows,
    )
    return subject, text_body, html_body


def send_alert_mail(
    db: Session,
    *,
    alert: Alert,
    event_type: str,
    subject: str,
    body: str,
    sender_email: Optional[str],
    recipients: Iterable[Optional[str]],
    triggered_by_user_id: Optional[int],
    html_body: Optional[str] = None,
) -> MailEvent:
    normalized_recipients = _normalize_recipients(recipients)
    requested_sender = (sender_email or "").strip() or None
    smtp_sender = settings.smtp_username.strip() or None

    mail_event = MailEvent(
        alert_id=alert.id,
        triggered_by_user_id=triggered_by_user_id,
        event_type=event_type,
        subject=subject,
        body=html_body or body,
        sender_email=requested_sender or smtp_sender,
        recipient_emails="; ".join(normalized_recipients),
        delivery_status="SKIPPED",
    )
    db.add(mail_event)

    if not normalized_recipients:
        mail_event.delivery_status = "NO_RECIPIENT"
        mail_event.error_message = "Aucune adresse destinataire n'est configuree."
        return mail_event

    if not settings.smtp_host or not settings.smtp_username or not settings.smtp_password:
        mail_event.delivery_status = "CONFIGURATION_MANQUANTE"
        mail_event.error_message = (
            "Configuration SMTP absente. Renseignez SMTP_HOST, SMTP_USERNAME et SMTP_PASSWORD."
        )
        return mail_event

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = f"{settings.smtp_sender_name} <{smtp_sender}>"
    message["To"] = ", ".join(normalized_recipients)
    if requested_sender and smtp_sender and requested_sender.lower() != smtp_sender.lower():
        message["Reply-To"] = requested_sender
    message.set_content(body, charset="utf-8")
    if html_body:
        message.add_alternative(html_body, subtype="html", charset="utf-8")

    try:
        with SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls()
            smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(message)
        mail_event.delivery_status = "SENT"
    except (SMTPException, OSError) as exc:
        mail_event.delivery_status = "FAILED"
        mail_event.error_message = str(exc)

    return mail_event


def send_system_mail(
    *,
    subject: str,
    body: str,
    recipients: Iterable[Optional[str]],
    sender_email: Optional[str] = None,
    html_body: Optional[str] = None,
) -> tuple[str, Optional[str], list[str]]:
    normalized_recipients = _normalize_recipients(recipients)
    requested_sender = (sender_email or "").strip() or None
    smtp_sender = settings.smtp_username.strip() or None

    if not normalized_recipients:
        return ("NO_RECIPIENT", "Aucune adresse destinataire n'est configuree.", [])

    if not settings.smtp_host or not settings.smtp_username or not settings.smtp_password:
        return (
            "CONFIGURATION_MANQUANTE",
            "Configuration SMTP absente. Renseignez SMTP_HOST, SMTP_USERNAME et SMTP_PASSWORD.",
            normalized_recipients,
        )

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = f"{settings.smtp_sender_name} <{smtp_sender}>"
    message["To"] = ", ".join(normalized_recipients)
    if requested_sender and smtp_sender and requested_sender.lower() != smtp_sender.lower():
        message["Reply-To"] = requested_sender
    message.set_content(body, charset="utf-8")
    if html_body:
        message.add_alternative(html_body, subtype="html", charset="utf-8")

    try:
        with SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls()
            smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(message)
        return ("SENT", None, normalized_recipients)
    except (SMTPException, OSError) as exc:
        return ("FAILED", str(exc), normalized_recipients)


def compose_request_created_mail(alert: Alert, sender_user: User, permanent_user: Optional[User]) -> tuple[str, str, str]:
    demandeur = _demandeur_code(alert)
    destinataire = _destinataire_code(alert)
    subject = f"Demande d'acheminement a traiter, {_dossier_label(alert)} - {demandeur} / {destinataire}"
    intro_lines = [
        "Merci de bien traiter la demande d'acheminement suivante.",
        "Vous trouverez ci-dessous le detail complet du dossier et des materiels.",
    ]
    return _mail_payload(
        alert=alert,
        subject=subject,
        intro_lines=intro_lines,
        state_label="En cours de traitement",
    )


def compose_decision_mail(alert: Alert, decision_label: str, commentaire: Optional[str]) -> tuple[str, str, str]:
    demandeur = _demandeur_code(alert)
    destinataire = _destinataire_code(alert)
    subject = f"Demande d'acheminement traitée, {_dossier_label(alert)} - {demandeur} / {destinataire}"
    state = _status_state_label(alert.status)

    if decision_label == "MODIFIER":
        intro = "Le permanent PM demande une modification de ce dossier."
    elif decision_label == "ANNULER":
        intro = "Le permanent PM a annule ce dossier."
    else:
        intro = "Le permanent PM a traite la demande (acceptation et/ou annulation de materiels)."

    intro_lines = [intro]
    if commentaire and commentaire.strip():
        intro_lines.append(f"Commentaire PM: {commentaire.strip()}")
    intro_lines.append("Le tableau ci-dessous reprend le detail complet du dossier.")

    return _mail_payload(
        alert=alert,
        subject=subject,
        intro_lines=intro_lines,
        state_label=state,
        fallback_ppm_reason=commentaire,
    )


def compose_exploitant_decision_mail(
    alert: Alert, decision_label: str, commentaire: Optional[str]
) -> tuple[str, str, str]:
    demandeur = _demandeur_code(alert)
    destinataire = _destinataire_code(alert)
    subject = f"Demande d'acheminement traitee (exploitant), {_dossier_label(alert)} - {demandeur} / {destinataire}"
    state = _status_state_label(alert.status)

    if decision_label == "MODIFIER":
        intro = "Le permanent PM demande une modification de ce dossier."
    elif decision_label == "ANNULER":
        intro = "Le permanent PM a annule ce dossier."
    else:
        intro = "Le permanent PM a traite la demande (acceptation et/ou annulation de materiels)."

    intro_lines = [intro]
    if commentaire and commentaire.strip():
        intro_lines.append(f"Commentaire PM: {commentaire.strip()}")
    intro_lines.append("Le tableau ci-dessous reprend uniquement les materiels acceptes par le permanent PM.")

    return _mail_payload(
        alert=alert,
        subject=subject,
        intro_lines=intro_lines,
        state_label=state,
        fallback_ppm_reason=commentaire,
        material_filter=lambda row: row.get("ppm_status") == "ACCEPTEE",
    )


def compose_modification_requested_mail(alert: Alert, commentaire: Optional[str]) -> tuple[str, str, str]:
    return compose_decision_mail(alert, "MODIFIER", commentaire)


def compose_request_updated_mail(alert: Alert) -> tuple[str, str, str]:
    demandeur = _demandeur_code(alert)
    destinataire = _destinataire_code(alert)
    subject = f"Demande d'acheminement modifiee, {_dossier_label(alert)} - {demandeur} / {destinataire}"
    intro_lines = [
        "Le demandeur a modifie la demande et l'a renvoyee pour traitement.",
        "Merci de consulter les informations detaillees ci-dessous.",
    ]
    return _mail_payload(
        alert=alert,
        subject=subject,
        intro_lines=intro_lines,
        state_label="En cours de traitement",
    )


def compose_reception_confirmation_mail(alert: Alert, commentaire: Optional[str], reception_date=None) -> tuple[str, str, str]:
    demandeur = _demandeur_code(alert)
    destinataire = _destinataire_code(alert)
    subject = f"Demande d'acheminement (etat des receptions), {_dossier_label(alert)} - {demandeur} / {destinataire}"
    intro_lines = [
        "Le technicentre destinataire a mis a jour l'etat de reception (validation et/ou en instance).",
        "Le tableau suivant detaille l'etat de chaque materiel.",
    ]
    if commentaire and commentaire.strip():
        intro_lines.append(f"Observation du destinataire: {commentaire.strip()}")
    return _mail_payload(
        alert=alert,
        subject=subject,
        intro_lines=intro_lines,
        state_label="Etat receptions mis a jour",
    )




