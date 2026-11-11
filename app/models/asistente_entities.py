"""Modelos del asistente virtual (propuesta v2.1, ciclo C4).

Historial de sesiones del asistente de gestión por texto libre
(`asistente-ggto`): cada turno se registra vía `POST /api/v1/asistente/sesiones`
con el usuario de servicio. Es un **registro de auditoría/segumiento**, no
interviene en la operación de casos; la lectura se acota por central.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from ..core.db import Base


class AsistenteSesion(Base):
    """Un turno del asistente: texto de entrada + intención + respuesta."""

    __tablename__ = "asistente_sesion"

    id_turno: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    sesion_id: Mapped[str] = mapped_column(String(64), nullable=False)
    #: PANEL | TELEGRAM (canales de la propuesta v2.1)
    canal: Mapped[str] = mapped_column(String(20), nullable=False, default="PANEL")
    #: Central del usuario de servicio (recinto de lectura del historial).
    id_central: Mapped[int | None] = mapped_column(ForeignKey("central.id_central"))
    #: Operador humano del panel, si hay (Telegram: el p00 autorizado).
    p00: Mapped[str | None] = mapped_column(String(20))
    texto_entrada: Mapped[str] = mapped_column(Text, nullable=False)
    #: ALTA_CASO | EVENTO | CONSULTA | DESCONOCIDO
    intencion: Mapped[str | None] = mapped_column(String(30))
    #: tipo_evento (C3) o tipo de consulta (C4): CASO | FAT | RESUMEN_DIA
    detalle: Mapped[str | None] = mapped_column(String(60))
    #: Vista previa mostrada al operador (JSON en texto).
    ficha_json: Mapped[str | None] = mapped_column(Text)
    respuesta: Mapped[str | None] = mapped_column(Text)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AsistenteRemitente(Base):
    """Remitente autorizado del asistente por canal de chat (C5: Telegram).

    El alta la hace el **SUPER** (`POST /api/v1/asistente/remitentes`): liga un
    `chat_id` de Telegram a un operador (`p00`) de una central. Solo los
    remitentes activos de la tabla reciben respuesta del asistente.
    """

    __tablename__ = "asistente_remitente"

    id_remitente: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    id_central: Mapped[int] = mapped_column(ForeignKey("central.id_central"), nullable=False)
    #: PANEL no se usa (el panel se autentica aparte); queda abierto a otros canales.
    canal: Mapped[str] = mapped_column(String(20), nullable=False, default="TELEGRAM")
    chat_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    #: Operador bajo el que se registran sus turnos (auditoría e historial).
    p00: Mapped[str] = mapped_column(String(20), nullable=False)
    nombre: Mapped[str | None] = mapped_column(String(120))
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
