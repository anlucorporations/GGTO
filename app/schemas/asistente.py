"""Esquemas Pydantic del asistente virtual (ciclo C4)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TurnoEntrada(BaseModel):
    """Registro de un turno del asistente (PANEL, TELEGRAM o TELEGRAM_GRUPO)."""

    sesion_id: str = Field(min_length=1, max_length=64)
    canal: str = Field(default="PANEL", pattern="^(PANEL|TELEGRAM|TELEGRAM_GRUPO)$")
    p00: str | None = Field(default=None, max_length=20)
    texto_entrada: str = Field(min_length=1, max_length=4000)
    intencion: str | None = Field(default=None, max_length=30)
    detalle: str | None = Field(default=None, max_length=60)
    ficha_json: str | None = Field(default=None, max_length=20000)
    respuesta: str | None = Field(default=None, max_length=20000)
    # v2 (F3-TG-1): trazabilidad del turno en grupo (identidad por from.id)
    id_grupo: int | None = None
    mensaje_id: int | None = None
    telegram_user_id: int | None = None


class TurnoOut(BaseModel):
    """Turno del historial del asistente."""

    model_config = ConfigDict(from_attributes=True)

    id_turno: int
    sesion_id: str
    canal: str
    id_central: int | None = None
    p00: str | None = None
    texto_entrada: str
    intencion: str | None = None
    detalle: str | None = None
    respuesta: str | None = None
    creado_en: datetime
    id_grupo: int | None = None
    mensaje_id: int | None = None
    telegram_user_id: int | None = None


class GrupoOut(BaseModel):
    """Grupo de Telegram autorizado (F3-TG-1)."""

    model_config = ConfigDict(from_attributes=True)

    id_grupo: int
    chat_id: int
    titulo: str
    id_central: int | None = None
    politica_pii: str
    eventos_config: dict = Field(default_factory=dict)
    activo: bool


class MiembroOut(BaseModel):
    """Miembro autorizado del grupo: identidad por telegram_user_id (from.id)."""

    model_config = ConfigDict(from_attributes=True)

    id_miembro: int
    id_grupo: int
    telegram_user_id: int
    p00: str
    rol: str
    puede_actualizar: bool
    activo: bool


class RemitenteAlta(BaseModel):
    """Alta de un remitente de chat autorizado (solo SUPER, ciclo C5)."""

    id_central: int = Field(description="Central del operador (recinto de su historial)")
    canal: str = Field(default="TELEGRAM", pattern="^(TELEGRAM)$")
    chat_id: str = Field(min_length=1, max_length=64)
    p00: str = Field(min_length=3, max_length=20)
    nombre: str | None = Field(default=None, max_length=120)
    activo: bool = True


class RemitenteUpdate(BaseModel):
    """Activar/desactivar o reasignar un remitente (solo SUPER)."""

    p00: str | None = Field(default=None, min_length=3, max_length=20)
    nombre: str | None = Field(default=None, max_length=120)
    activo: bool | None = None


class RemitenteOut(BaseModel):
    """Remitente autorizado del asistente."""

    model_config = ConfigDict(from_attributes=True)

    id_remitente: int
    id_central: int
    canal: str
    chat_id: str
    p00: str
    nombre: str | None = None
    activo: bool
    creado_en: datetime
