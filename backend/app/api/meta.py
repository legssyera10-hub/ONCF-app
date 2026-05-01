from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.technicentres import TECHNICENTRE_CODES
from app.db.session import get_db
from app.models.establishment import Establishment
from app.models.station import Station
from app.models.user import User
from app.services.alert_form_config import get_alert_form_config
from app.schemas.common import EstablishmentRead, StationRead

router = APIRouter(tags=["meta"])


class AlertFormFieldConfigRead(BaseModel):
    required: bool
    options: list[str]


class AlertFormConfigRead(BaseModel):
    fields: dict[str, AlertFormFieldConfigRead]


@router.get("/stations", response_model=list[StationRead])
def list_stations(_: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[Station]:
    return list(db.execute(select(Station).order_by(Station.name)).scalars())


@router.get("/establishments", response_model=list[EstablishmentRead])
def list_establishments(_: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[Establishment]:
    stmt = select(Establishment).where(Establishment.code.in_(TECHNICENTRE_CODES)).order_by(Establishment.name)
    return list(db.execute(stmt).scalars())


@router.get("/alert-form-config", response_model=AlertFormConfigRead)
def read_alert_form_config(_: User = Depends(get_current_user), db: Session = Depends(get_db)) -> AlertFormConfigRead:
    config = get_alert_form_config(db)
    return AlertFormConfigRead(
        fields={name: AlertFormFieldConfigRead(**value) for name, value in config.items()}
    )
