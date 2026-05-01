from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from app.core.config import settings


def ensure_upload_dir() -> Path:
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    return upload_dir


def save_upload(file: UploadFile) -> tuple[str, str]:
    upload_dir = ensure_upload_dir()
    suffix = Path(file.filename or "").suffix
    safe_name = f"{uuid4().hex}{suffix}"
    destination = upload_dir / safe_name
    content = file.file.read()
    destination.write_bytes(content)
    return safe_name, f"/uploads/{safe_name}"
