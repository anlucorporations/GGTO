"""Esquemas Pydantic de la mensajería interna (RF-41 / D-81)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

DestinoTipo = Literal["TODOS", "CUADRILLA", "TECNICO", "SUPERVISOR"]
TipoMensaje = Literal["RECORDATORIO_CITA", "ESTADO_SYNC", "ALARMA_DESPACHO", "TEXTO"]


class MensajeIn(BaseModel):
    """Envío manual de un mensaje (solo SUPER/ADMIN/SUPERVISOR a técnicos)."""

    destino_tipo: DestinoTipo
    id_cuadrilla: int | None = None
    id_tecnico: int | None = None
    id_usuario_destino: str | None = None
    cuerpo: str = Field(min_length=1, max_length=500)
    id_caso: int | None = None


class MensajeSupervisorIn(BaseModel):
    """Envío de mensaje del Coordinador al Supervisor (DEC-G9 / DEC-G15)."""

    p00_supervisor: str = Field(min_length=1, max_length=20)
    cuerpo: str = Field(min_length=1, max_length=500)
    id_caso: int | None = None
    escalar_al_admin: bool = False


class MensajeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_mensaje: int
    id_central: int
    origen_p00: str | None = None
    destino_tipo: str
    id_cuadrilla: int | None = None
    id_tecnico: int | None = None
    id_usuario_destino: str | None = None
    tipo: str
    cuerpo: str
    id_caso: int | None = None
    creado_en: datetime
    expira_en: datetime


class MensajeRecibidoOut(MensajeOut):
    """Mensaje tal como lo ve un técnico (con su marca de lectura)."""

    leido: bool = False


class BandejaOut(BaseModel):
    total: int
    items: list[MensajeOut] = Field(default_factory=list)


class NoLeidosOut(BaseModel):
    total: int


class LeidosIn(BaseModel):
    ids: list[int] = Field(min_length=1, max_length=200)


class LeidosOut(BaseModel):
    actualizados: int
