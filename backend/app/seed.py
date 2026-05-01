from __future__ import annotations

from datetime import datetime, timedelta, timezone
import unicodedata
from typing import Optional

from sqlalchemy import select

from app.core.technicentres import TECHNICENTRE_DEFINITIONS
from app.core.security import get_password_hash
from app.db.session import SessionLocal
from app.models.alert import Alert, EstablishmentConfirmation, Notification, PermanentDecision
from app.models.establishment import Establishment
from app.models.enums import (
    AgentDecision,
    AlertStatus,
    DecisionKind,
    MaintenanceState,
    MaterialType,
    Severity,
    UserRole,
)
from app.models.station import Station
from app.models.user import User
from app.services.alerts import add_history

ESTABLISHMENT_DEFINITIONS = TECHNICENTRE_DEFINITIONS

STATION_DEFINITIONS = [
    ("TNGV", "Tanger Ville", "Tanger-Tetouan-Al Hoceima", 35.7803, -5.8137),
    ("TNGM", "Tanger Med", "Tanger-Tetouan-Al Hoceima", 35.8864, -5.5032),
    ("ASIL", "Asilah", "Tanger-Tetouan-Al Hoceima", 35.4687, -6.0348),
    ("KSGR", "Ksar Sghir", "Tanger-Tetouan-Al Hoceima", 35.8416, -5.5376),
    ("KENI", "Kenitra", "Rabat-Sale-Kenitra", 34.261, -6.5802),
    ("SDTB", "Sidi Taibi", "Rabat-Sale-Kenitra", 34.1878, -6.6862),
    ("SYEG", "Sidi Yahya El Gharb", "Rabat-Sale-Kenitra", 34.3046, -6.3069),
    ("SSLM", "Sidi Slimane", "Rabat-Sale-Kenitra", 34.2648, -5.9256),
    ("RABA", "Rabat Agdal", "Rabat-Sale-Kenitra", 33.9962, -6.8528),
    ("RABV", "Rabat Ville", "Rabat-Sale-Kenitra", 34.0204, -6.8326),
    ("CASP", "Casa Port", "Casablanca-Settat", 33.5992, -7.6192),
    ("CASV", "Casa Voyageurs", "Casablanca-Settat", 33.5892, -7.6039),
    ("AINS", "Ain Sebaa", "Casablanca-Settat", 33.6137, -7.5369),
    ("LOAS", "L'Oasis", "Casablanca-Settat", 33.5658, -7.6405),
    ("MERS", "Mers Sultan", "Casablanca-Settat", 33.5782, -7.6258),
    ("FACL", "Facultes", "Casablanca-Settat", 33.5423, -7.6482),
    ("ENNA", "Ennassim", "Casablanca-Settat", 33.5346, -7.6391),
    ("BOUS", "Bouskoura", "Casablanca-Settat", 33.4516, -7.6542),
    ("AMV", "Aeroport Mohammed V", "Casablanca-Settat", 33.3675, -7.5899),
    ("MOHA", "Mohammedia", "Casablanca-Settat", 33.6861, -7.3830),
    ("ZENA", "Zenata", "Casablanca-Settat", 33.6339, -7.4832),
    ("SKHI", "Skhirat", "Rabat-Sale-Kenitra", 33.8493, -7.0317),
    ("TEMA", "Temara", "Rabat-Sale-Kenitra", 33.9253, -6.9118),
    ("BOUZ", "Bouznika", "Casablanca-Settat", 33.7876, -7.1590),
    ("SETT", "Settat", "Casablanca-Settat", 33.001, -7.6164),
    ("BERR", "Berrechid", "Casablanca-Settat", 33.2657, -7.5878),
    ("BENG", "Benguerir", "Marrakech-Safi", 32.2359, -7.9538),
    ("MAR", "Marrakech", "Marrakech-Safi", 31.6295, -8.0083),
    ("KHOU", "Khouribga", "Beni Mellal-Khenifra", 32.8811, -6.9063),
    ("OUZD", "Oued Zem", "Beni Mellal-Khenifra", 32.8627, -6.5736),
    ("BMEL", "Beni Mellal", "Beni Mellal-Khenifra", 32.3373, -6.3498),
    ("SDKA", "Sidi Kacem", "Rabat-Sale-Kenitra", 34.2215, -5.7078),
    ("MEKA", "Meknes Amir Abdelkader", "Fes-Meknes", 33.9142, -5.5208),
    ("FES", "Fes", "Fes-Meknes", 34.0433, -5.0033),
    ("TAZA", "Taza", "Fes-Meknes", 34.2138, -4.0090),
    ("TAOU", "Taourirt", "Oriental", 34.4073, -2.8968),
    ("OUJ", "Oujda", "Oriental", 34.6867, -1.9114),
    ("SELO", "Selouane", "Oriental", 35.0736, -2.9425),
    ("NADV", "Nador Ville", "Oriental", 35.1681, -2.9287),
    ("BNAR", "Beni Nsar", "Oriental", 35.2717, -2.9416),
]


def _slug(value: str) -> str:
    return value.lower().replace(" ", "_")


def _normalize_station_name(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value)
    ascii_only = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
    return ascii_only.lower().replace("'", "").replace("’", "").strip()


def _ensure_establishments(db) -> dict[str, Establishment]:
    establishments_by_code = {
        item.code: item for item in db.execute(select(Establishment)).scalars()
    }

    for code, name, city in ESTABLISHMENT_DEFINITIONS:
        if code not in establishments_by_code:
            establishment = Establishment(code=code, name=name, city=city, lat=None, lon=None)
            db.add(establishment)
            db.flush()
            establishments_by_code[code] = establishment

    # preserve legacy demo establishments if they already exist
    for code in ["ETB-CAS", "ETB-RAB"]:
        existing = db.execute(select(Establishment).where(Establishment.code == code)).scalar_one_or_none()
        if existing:
            establishments_by_code[code] = existing

    return establishments_by_code


def _ensure_stations(db) -> dict[str, Station]:
    stations_by_code = {item.code: item for item in db.execute(select(Station)).scalars()}
    stations_by_name = {_normalize_station_name(item.name): item for item in stations_by_code.values()}
    for code, name, region, lat, lon in STATION_DEFINITIONS:
        existing = stations_by_code.get(code) or stations_by_name.get(_normalize_station_name(name))
        if existing:
            existing.name = name
            existing.region = region
            existing.lat = lat
            existing.lon = lon
            stations_by_code[existing.code] = existing
            stations_by_name[_normalize_station_name(name)] = existing
            continue

        station = Station(code=code, name=name, region=region, lat=lat, lon=lon)
        db.add(station)
        db.flush()
        stations_by_code[code] = station
        stations_by_name[_normalize_station_name(name)] = station
    return stations_by_code


def _ensure_user(db, username: str, password: str, role: UserRole, full_name: str, establishment_id: Optional[int] = None) -> User:
    user = db.execute(select(User).where(User.username == username)).scalar_one_or_none()
    if user:
        changed = False
        if user.role != role:
            user.role = role
            changed = True
        if user.full_name != full_name:
            user.full_name = full_name
            changed = True
        if user.establishment_id != establishment_id:
            user.establishment_id = establishment_id
            changed = True
        if changed:
            db.flush()
        return user

    user = User(
        username=username,
        password_hash=get_password_hash(password),
        role=role,
        full_name=full_name,
        establishment_id=establishment_id,
    )
    db.add(user)
    db.flush()
    return user


def _ensure_core_users(db, establishments_by_code: dict[str, Establishment]) -> dict[str, User]:
    users: dict[str, User] = {}
    users["admin"] = _ensure_user(db, "admin", "pass123", UserRole.ADMIN, "Administrateur ONCF")
    users["permanent"] = _ensure_user(db, "permanent", "pass123", UserRole.PERMANENT, "Permanent PM")
    users["suivi"] = _ensure_user(db, "suivi", "pass123", UserRole.SUIVI, "Vision Suivi Acheminement")

    for code, name, _city in ESTABLISHMENT_DEFINITIONS:
        username = _slug(code)
        full_name = f"Technicentre {name}"
        users[username] = _ensure_user(
            db,
            username,
            "pass123",
            UserRole.ETABLISSEMENT,
            full_name,
            establishments_by_code[code].id,
        )

    return users


def _seed_demo_alerts(db, users: dict[str, User], stations_by_code: dict[str, Station], establishments_by_code: dict[str, Establishment]) -> None:
    if db.execute(select(Alert).limit(1)).scalar_one_or_none():
        return

    now = datetime.now(timezone.utc)
    tmic_user = users["tmic"]
    tmrc_user = users["tmrc"]
    tmlc_user = users["tmlc"]
    tmlc_establishment = establishments_by_code["TMLC"]
    tmf_establishment = establishments_by_code["TMF"]

    alert1 = Alert(
        created_by_user_id=tmic_user.id,
        dossier_number=1,
        station_id=stations_by_code["CASP"].id,
        requested_destination_establishment_id=tmlc_establishment.id,
        material_type=MaterialType.MM,
        material_ref="WG-9021",
        problem_description="Porte laterale deformee, fermeture difficile.",
        maintenance_state=MaintenanceState.A_REPARER,
        severity=Severity.NIVEAU_2,
        transport_conditions_initial="Acheminement lent, pas de chargement supplementaire.",
        agent_decision=AgentDecision.CONFIRMER,
        status=AlertStatus.EN_COURS_DE_TRAITEMENT,
    )
    db.add(alert1)
    db.flush()
    add_history(db, alert1, AlertStatus.EN_COURS_DE_TRAITEMENT, tmic_user.id, "Demande transmise au permanent")

    alert2 = Alert(
        created_by_user_id=tmrc_user.id,
        dossier_number=2,
        station_id=stations_by_code["RABV"].id,
        requested_destination_establishment_id=tmf_establishment.id,
        material_type=MaterialType.MR,
        material_ref="VC-118",
        problem_description="Suspicion d'echauffement bogie cote B.",
        maintenance_state=MaintenanceState.CRITIQUE,
        severity=Severity.NIVEAU_5,
        transport_conditions_initial="Immobilisation recommandee.",
        agent_decision=AgentDecision.ANNULER,
        status=AlertStatus.EN_COURS_DE_TRAITEMENT,
    )
    db.add(alert2)
    db.flush()
    add_history(db, alert2, AlertStatus.EN_COURS_DE_TRAITEMENT, tmrc_user.id, "Demande envoyee")

    destination = tmlc_establishment
    receiver = tmlc_user
    alert3 = Alert(
        created_by_user_id=tmic_user.id,
        dossier_number=3,
        station_id=stations_by_code["CASV"].id,
        requested_destination_establishment_id=destination.id,
        material_type=MaterialType.MR,
        material_ref="VC-772",
        problem_description="Vitre fissuree et porte intercirculation a surveiller.",
        maintenance_state=MaintenanceState.PV,
        severity=Severity.NIVEAU_1,
        transport_conditions_initial="Acheminement autorise avec inspection a l'arrivee.",
        agent_decision=AgentDecision.CONFIRMER,
        status=AlertStatus.RECEPTION_COMPLETE,
    )
    db.add(alert3)
    db.flush()
    add_history(db, alert3, AlertStatus.EN_COURS_DE_TRAITEMENT, tmic_user.id, "Demande envoyee")
    add_history(db, alert3, AlertStatus.TRAITEE_PAR_PM, users["permanent"].id, "Orientation Casablanca")
    add_history(db, alert3, AlertStatus.RECEPTION_COMPLETE, receiver.id, "Reception confirmee")
    db.add(
        PermanentDecision(
            alert_id=alert3.id,
            permanent_user_id=users["permanent"].id,
            destination_establishment_id=destination.id,
            transport_conditions_final="",
            eta_date=now + timedelta(days=1),
            decision=DecisionKind.CONFIRMER,
            comment="Maintenance legere planifiee",
        )
    )
    db.add(Notification(alert_id=alert3.id, to_establishment_id=destination.id))
    db.add(
        EstablishmentConfirmation(
            alert_id=alert3.id,
            establishment_user_id=receiver.id,
            reception_date=now + timedelta(days=1, hours=3),
            remarks="Vehicule bien recu a l'atelier.",
        )
    )


def seed_demo_data() -> None:
    db = SessionLocal()
    try:
        establishments_by_code = _ensure_establishments(db)
        stations_by_code = _ensure_stations(db)
        users = _ensure_core_users(db, establishments_by_code)
        _seed_demo_alerts(db, users, stations_by_code, establishments_by_code)
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_data()
