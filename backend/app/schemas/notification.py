from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.schemas.alert import AlertRead
from app.schemas.common import EstablishmentRead


class NotificationRead(BaseModel):
    id: int
    sent_at: datetime
    read_at: Optional[datetime]
    establishment: EstablishmentRead
    alert: AlertRead

    model_config = {"from_attributes": True}
