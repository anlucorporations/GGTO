"""Esquemas Pydantic para auditoría (D-95 / RT-APK-06 / DEC-G17)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class AuditoriaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_auditoria: int
    id_central: int | None = None
    usuario: str | None = None
    accion: str
    entidad: str | None = None
    id_entidad: str | None = None
    datos_antes: dict[str, Any] | None = None
    datos_despues: dict[str, Any] | None = None
    resultado: str | None = None
    request_id: str | None = None
    fecha_hora: datetime


class AuditoriaListOut(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[AuditoriaOut] = Field(default_factory=list)
