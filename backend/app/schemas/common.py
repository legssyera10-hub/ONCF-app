from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class StationRead(BaseModel):
    id: int
    code: str
    name: str
    region: str
    lat: Optional[float]
    lon: Optional[float]

    model_config = {"from_attributes": True}


class EstablishmentRead(BaseModel):
    id: int
    code: str
    name: str
    city: str
    outlook_email: Optional[str]
    lat: Optional[float]
    lon: Optional[float]

    model_config = {"from_attributes": True}
