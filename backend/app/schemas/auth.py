from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.enums import UserRole


class LoginRequest(BaseModel):
    username: str
    password: str


class UserSummary(BaseModel):
    id: int
    username: str
    role: UserRole
    full_name: str
    outlook_email: Optional[str] = None
    establishment_id: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserSummary
