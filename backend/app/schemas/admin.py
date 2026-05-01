from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models.enums import UserRole
from app.schemas.common import EstablishmentRead
from app.schemas.auth import UserSummary
from app.schemas.common import StationRead


class AdminUserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=80)
    password: str = Field(min_length=6, max_length=128)
    role: UserRole
    full_name: str = Field(min_length=3, max_length=255)
    outlook_email: Optional[str] = Field(default=None, max_length=255)
    establishment_id: Optional[int] = None


class AdminUserUpdate(BaseModel):
    full_name: str = Field(min_length=3, max_length=255)
    role: UserRole
    outlook_email: Optional[str] = Field(default=None, max_length=255)
    establishment_id: Optional[int] = None


class AdminPasswordUpdate(BaseModel):
    password: str = Field(min_length=6, max_length=128)


class AdminUserRead(UserSummary):
    pass


class AdminUserActivity(BaseModel):
    timestamp: datetime
    action: str
    details: str
    alert_id: Optional[int] = None


class AdminUserDetail(BaseModel):
    user: AdminUserRead
    history: list[AdminUserActivity]


class AdminEstablishmentCreate(BaseModel):
    name: str = Field(min_length=3, max_length=255)
    city: str = Field(min_length=2, max_length=120)
    code: Optional[str] = Field(default=None, min_length=2, max_length=50)
    outlook_email: Optional[str] = Field(default=None, max_length=255)
    lat: float
    lon: float


class AdminEstablishmentCreateResponse(BaseModel):
    establishment: EstablishmentRead


class AdminEstablishmentUpdate(BaseModel):
    name: str = Field(min_length=3, max_length=255)
    city: str = Field(min_length=2, max_length=120)
    code: Optional[str] = Field(default=None, min_length=2, max_length=50)
    outlook_email: Optional[str] = Field(default=None, max_length=255)
    lat: float
    lon: float


class AdminMailRoutingSettingsRead(BaseModel):
    permanent_pv_email: Optional[str] = None
    permanent_pfl_email: Optional[str] = None


class AdminMailRoutingSettingsUpdate(BaseModel):
    permanent_pv_email: Optional[str] = Field(default=None, max_length=255)
    permanent_pfl_email: Optional[str] = Field(default=None, max_length=255)


class AdminMailRoutingTestPayload(BaseModel):
    permanent_pv_email: Optional[str] = Field(default=None, max_length=255)
    permanent_pfl_email: Optional[str] = Field(default=None, max_length=255)


class AdminStationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    code: Optional[str] = Field(default=None, min_length=2, max_length=50)
    region: str = Field(min_length=2, max_length=120)
    lat: float
    lon: float


class AdminStationUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    code: Optional[str] = Field(default=None, min_length=2, max_length=50)
    region: str = Field(min_length=2, max_length=120)
    lat: float
    lon: float


class AdminStationResponse(BaseModel):
    station: StationRead


class AdminAlertFormFieldConfig(BaseModel):
    required: bool
    options: list[str] = Field(default_factory=list)


class AdminAlertFormConfigRead(BaseModel):
    fields: dict[str, AdminAlertFormFieldConfig]


class AdminAlertFormConfigUpdate(BaseModel):
    fields: dict[str, AdminAlertFormFieldConfig]
