from __future__ import annotations

from pathlib import Path

from sqlalchemy import text

from app.core.config import settings
from app.db.session import engine


def run_startup_migrations() -> None:
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)

    if engine.dialect.name != "sqlite":
        # Alembic owns schema changes in Postgres; avoid SQLite-specific SQL.
        return

    with engine.begin() as connection:
        connection.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS alert_attachments (
                    id INTEGER PRIMARY KEY,
                    alert_id INTEGER NOT NULL,
                    filename VARCHAR(255) NOT NULL,
                    stored_path VARCHAR(500) NOT NULL,
                    content_type VARCHAR(120) NOT NULL,
                    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(alert_id) REFERENCES alerts (id) ON DELETE CASCADE
                )
                """
            )
        )
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_alert_attachments_alert_id ON alert_attachments (alert_id)"))
        connection.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS alert_revisions (
                    id INTEGER PRIMARY KEY,
                    alert_id INTEGER NOT NULL,
                    revision_number INTEGER NOT NULL,
                    archived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    archived_by_user_id INTEGER NOT NULL,
                    station_id INTEGER NOT NULL,
                    requested_destination_establishment_id INTEGER,
                    material_type VARCHAR(20) NOT NULL,
                    material_ref VARCHAR(120) NOT NULL,
                    material_concerned TEXT,
                    transport_mode VARCHAR(20) NOT NULL,
                    transport_type VARCHAR(20) NOT NULL,
                    problem_description TEXT NOT NULL,
                    maintenance_state VARCHAR(20) NOT NULL,
                    severity VARCHAR(20) NOT NULL,
                    transport_conditions_initial TEXT NOT NULL,
                    agent_decision VARCHAR(20) NOT NULL,
                    FOREIGN KEY(alert_id) REFERENCES alerts (id) ON DELETE CASCADE,
                    FOREIGN KEY(archived_by_user_id) REFERENCES users (id),
                    FOREIGN KEY(station_id) REFERENCES stations (id),
                    FOREIGN KEY(requested_destination_establishment_id) REFERENCES establishments (id)
                )
                """
            )
        )
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_alert_revisions_alert_id ON alert_revisions (alert_id)"))
        confirmation_columns = {
            row[1]
            for row in connection.execute(text("PRAGMA table_info(establishment_confirmations)")).fetchall()
        }
        if "confirmed_material_indexes" not in confirmation_columns:
            connection.execute(text("ALTER TABLE establishment_confirmations ADD COLUMN confirmed_material_indexes TEXT"))
        if "material_confirmations" not in confirmation_columns:
            connection.execute(text("ALTER TABLE establishment_confirmations ADD COLUMN material_confirmations TEXT"))
        if "delay_minutes" not in confirmation_columns:
            connection.execute(text("ALTER TABLE establishment_confirmations ADD COLUMN delay_minutes INTEGER"))

        alert_columns = {
            row[1]
            for row in connection.execute(text("PRAGMA table_info(alerts)")).fetchall()
        }
        if "requested_destination_establishment_id" not in alert_columns:
            connection.execute(text("ALTER TABLE alerts ADD COLUMN requested_destination_establishment_id INTEGER"))
        if "dossier_number" not in alert_columns:
            connection.execute(text("ALTER TABLE alerts ADD COLUMN dossier_number INTEGER"))
            connection.execute(text("UPDATE alerts SET dossier_number = id WHERE dossier_number IS NULL"))
        if "dossier_parent_id" not in alert_columns:
            connection.execute(text("ALTER TABLE alerts ADD COLUMN dossier_parent_id INTEGER"))
        if "dossier_iteration" not in alert_columns:
            connection.execute(text("ALTER TABLE alerts ADD COLUMN dossier_iteration INTEGER"))
            connection.execute(text("UPDATE alerts SET dossier_iteration = 0 WHERE dossier_iteration IS NULL"))
        if "request_date" not in alert_columns:
            connection.execute(text("ALTER TABLE alerts ADD COLUMN request_date DATETIME"))
        if "material_concerned" not in alert_columns:
            connection.execute(text("ALTER TABLE alerts ADD COLUMN material_concerned TEXT"))
        if "speed_kmh" not in alert_columns:
            connection.execute(text("ALTER TABLE alerts ADD COLUMN speed_kmh INTEGER"))
        if "transport_mode" not in alert_columns:
            connection.execute(text("ALTER TABLE alerts ADD COLUMN transport_mode VARCHAR(20)"))
            connection.execute(text("UPDATE alerts SET transport_mode = 'FRET' WHERE transport_mode IS NULL"))
        if "transport_type" not in alert_columns:
            connection.execute(text("ALTER TABLE alerts ADD COLUMN transport_type VARCHAR(20)"))
            connection.execute(text("UPDATE alerts SET transport_type = 'HLP' WHERE transport_type IS NULL"))
        connection.execute(
            text(
                """
                UPDATE alerts
                SET dossier_number = (
                    SELECT parent.dossier_number
                    FROM alerts AS parent
                    WHERE parent.id = alerts.dossier_parent_id
                )
                WHERE dossier_parent_id IS NOT NULL
                  AND (dossier_number IS NULL OR dossier_number = id)
                """
            )
        )
        connection.execute(text("UPDATE alerts SET dossier_number = id WHERE dossier_number IS NULL"))

        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_alerts_dossier_number ON alerts (dossier_number)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_alerts_dossier_parent_id ON alerts (dossier_parent_id)"))

        establishment_columns = {
            row[1]
            for row in connection.execute(text("PRAGMA table_info(establishments)")).fetchall()
        }
        if "outlook_email" not in establishment_columns:
            connection.execute(text("ALTER TABLE establishments ADD COLUMN outlook_email VARCHAR(255)"))

        user_columns = {
            row[1]
            for row in connection.execute(text("PRAGMA table_info(users)")).fetchall()
        }
        if "outlook_email" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN outlook_email VARCHAR(255)"))

        revision_columns = {
            row[1]
            for row in connection.execute(text("PRAGMA table_info(alert_revisions)")).fetchall()
        }
        if "request_date" not in revision_columns:
            connection.execute(text("ALTER TABLE alert_revisions ADD COLUMN request_date DATETIME"))
        if "material_concerned" not in revision_columns:
            connection.execute(text("ALTER TABLE alert_revisions ADD COLUMN material_concerned TEXT"))
        if "speed_kmh" not in revision_columns:
            connection.execute(text("ALTER TABLE alert_revisions ADD COLUMN speed_kmh INTEGER"))

        permanent_decision_columns = {
            row[1]
            for row in connection.execute(text("PRAGMA table_info(permanent_decisions)")).fetchall()
        }
        if "material_decisions" not in permanent_decision_columns:
            connection.execute(text("ALTER TABLE permanent_decisions ADD COLUMN material_decisions TEXT"))

        connection.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS mail_events (
                    id INTEGER PRIMARY KEY,
                    alert_id INTEGER NOT NULL,
                    triggered_by_user_id INTEGER,
                    event_type VARCHAR(80) NOT NULL,
                    subject VARCHAR(255) NOT NULL,
                    body TEXT NOT NULL,
                    sender_email VARCHAR(255),
                    recipient_emails TEXT NOT NULL,
                    delivery_status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
                    error_message TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(alert_id) REFERENCES alerts (id) ON DELETE CASCADE,
                    FOREIGN KEY(triggered_by_user_id) REFERENCES users (id)
                )
                """
            )
        )
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_mail_events_alert_id ON mail_events (alert_id)"))
        connection.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS app_settings (
                    key VARCHAR(120) PRIMARY KEY,
                    value TEXT NOT NULL DEFAULT '',
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )

        material_updates = {
            "wagon": "MM",
            "car": "MR",
            "WAGON": "MM",
            "CAR": "MR",
            "engin": "MM",
            "vehicule": "MR",
            "ENGIN": "MM",
            "VEHICULE": "MR",
        }
        for old_value, new_value in material_updates.items():
            connection.execute(
                text("UPDATE alerts SET material_type = :new_value WHERE material_type = :old_value"),
                {"new_value": new_value, "old_value": old_value},
            )
            connection.execute(
                text("UPDATE alert_revisions SET material_type = :new_value WHERE material_type = :old_value"),
                {"new_value": new_value, "old_value": old_value},
            )

        severity_updates = {
            "LOW": "NIVEAU_1",
            "MEDIUM": "NIVEAU_2",
            "HIGH": "NIVEAU_4",
            "CRITICAL": "NIVEAU_5",
        }
        for old_value, new_value in severity_updates.items():
            connection.execute(
                text("UPDATE alerts SET severity = :new_value WHERE severity = :old_value"),
                {"new_value": new_value, "old_value": old_value},
            )

        status_updates = {
            "INSPECTION": "EN_COURS_DE_TRAITEMENT",
            "ETIQUETTE_POSEE": "EN_COURS_DE_TRAITEMENT",
            "ACHEMINEMENT_CONFIRME_PAR_AGENT": "EN_COURS_DE_TRAITEMENT",
            "ACHEMINEMENT_ANNULE_PAR_AGENT": "EN_COURS_DE_TRAITEMENT",
            "ALERTE_ENVOYEE": "EN_COURS_DE_TRAITEMENT",
            "RECU_PAR_PERMANENT": "EN_COURS_DE_TRAITEMENT",
            "EN_ANALYSE": "EN_COURS_DE_TRAITEMENT",
            "DEMANDE_A_MODIFIER": "A_MODIFIER",
            "VALIDEE_PAR_LE_PERMANENT": "TRAITEE_PAR_PM",
            "VALIDE_PAR_LE_PERMANENT": "TRAITEE_PAR_PM",
            "DECISION_PERMANENT_CONFIRME": "TRAITEE_PAR_PM",
            "ETABLISSEMENT_NOTIFIE": "TRAITEE_PAR_PM",
            "DECISION_PERMANENT_ANNULEE": "ANNULEE",
            "RECEPTION_PARTIELLE_EN_INSTANCE": "RECEPTION_PARTIELLE",
            "RECEPTION_PARTIELLE": "RECEPTION_PARTIELLE",
            "RECEPTION_LIMITEE": "RECEPTION_PARTIELLE",
            "RECEPTION_EN_INSTANCE": "RECEPTION_PARTIELLE",
            "RECEPTION_PROBLEME_SIGNALE": "RECEPTION_PARTIELLE",
            "RECEPTION_REJETEE": "ANNULEE",
            "RECEPTION_CONFIRMEE": "RECEPTION_COMPLETE",
            "RECEPTION_CONFIRMMEE": "RECEPTION_COMPLETE",
            "CLOTURE": "RECEPTION_COMPLETE",
        }
        for old_value, new_value in status_updates.items():
            connection.execute(
                text("UPDATE alerts SET status = :new_value WHERE status = :old_value"),
                {"new_value": new_value, "old_value": old_value},
            )
            connection.execute(
                text("UPDATE alert_status_history SET status = :new_value WHERE status = :old_value"),
                {"new_value": new_value, "old_value": old_value},
            )

        connection.execute(
            text(
                """
                DELETE FROM stations
                WHERE name = 'Meknes Ville'
                  AND id NOT IN (SELECT DISTINCT station_id FROM alerts)
                """
            )
        )
