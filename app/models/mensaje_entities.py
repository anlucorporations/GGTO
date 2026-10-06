"""Modelos SQLAlchemy de la mensajería interna (RF-41 / D-81).

Mensajería **unidireccional** supervisor → técnicos. `mensaje` es la cabecera;
`mensaje_destino` materializa el **fan-out** de destinatarios y la marca
leído/no leído por técnico (permite un sondeo 20 s incremental y el conteo de no
leídos sin recorrer todos los mensajes).
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from ..core.db import Base

#: Tipos de mensaje automático o manual.
TIPOS_MENSAJE = ("RECORDATORIO_CITA", "ESTADO_SYNC", "ALARMA_DESPACHO", "TEXTO")
#: Tipos de destinatario.
TIPOS_DESTINO = ("TODOS", "CUADRILLA", "TECNICO")


class Mensaje(Base):
    """Mensaje interno (cabecera)."""

    __tablename__ = "mensaje"

    id_mensaje: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    id_central: Mapped[int] = mapped_column(ForeignKey("central.id_central"), nullable=False)
    #: Autor del mensaje; `NULL` en los automáticos del sistema (D-81).
    origen_p00: Mapped[str | None] = mapped_column(ForeignKey("usuario.p00"))
    destino_tipo: Mapped[str] = mapped_column(String(12), nullable=False)
    id_cuadrilla: Mapped[int | None] = mapped_column(
        ForeignKey("cuadrilla.id_cuadrilla", ondelete="SET NULL")
    )
    id_tecnico: Mapped[int | None] = mapped_column(
        ForeignKey("tecnico.id_tecnico", ondelete="SET NULL")
    )
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)
    cuerpo: Mapped[str] = mapped_column(String(500), nullable=False)
    id_caso: Mapped[int | None] = mapped_column(ForeignKey("caso.id_caso", ondelete="SET NULL"))
    #: Clave de idempotencia de los mensajes automáticos (recordatorios, estado
    #: de sync, alarmas). `NULL` para los mensajes manuales. (D-81)
    dedupe_key: Mapped[str | None] = mapped_column(String(80), unique=True)
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    expira_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        CheckConstraint(
            "destino_tipo IN ('TODOS','CUADRILLA','TECNICO')", name="ck_mensaje_destino_tipo"
        ),
        CheckConstraint(
            "tipo IN ('RECORDATORIO_CITA','ESTADO_SYNC','ALARMA_DESPACHO','TEXTO')",
            name="ck_mensaje_tipo",
        ),
        CheckConstraint("expira_en > creado_en", name="ck_mensaje_expira"),
        CheckConstraint(
            "(destino_tipo = 'TODOS'     AND id_cuadrilla IS NULL     AND id_tecnico IS NULL) OR "
            "(destino_tipo = 'CUADRILLA' AND id_cuadrilla IS NOT NULL AND id_tecnico IS NULL) OR "
            "(destino_tipo = 'TECNICO'   AND id_tecnico IS NOT NULL   AND id_cuadrilla IS NULL)",
            name="ck_mensaje_destino_xor",
        ),
    )


class MensajeDestino(Base):
    """Fan-out de destinatarios y lectura por técnico (A-03/A-06)."""

    __tablename__ = "mensaje_destino"

    id_mensaje: Mapped[int] = mapped_column(
        ForeignKey("mensaje.id_mensaje", ondelete="CASCADE"), primary_key=True
    )
    id_tecnico: Mapped[int] = mapped_column(
        ForeignKey("tecnico.id_tecnico", ondelete="CASCADE"), primary_key=True
    )
    leido_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
