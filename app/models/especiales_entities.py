"""Modelos SQLAlchemy del Ciclo 6 (SEGUIMIENTO, EMPRESAS, REFERIDOS y AGENDA)."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from ..core.db import Base


class Solicitante(Base):
    """Personal externo que reporta casos especiales (unidad + nombre + contacto)."""

    __tablename__ = "solicitante"

    id_solicitante: Mapped[int] = mapped_column(Integer, primary_key=True)
    unidad: Mapped[str] = mapped_column(String(120), nullable=False)
    nombre: Mapped[str] = mapped_column(String(120), nullable=False)
    contacto: Mapped[str] = mapped_column(String(60), nullable=False)
    canal: Mapped[str | None] = mapped_column(String(20))
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CasoEspecial(Base):
    """Caso REFERIDO / EMPRESA / GOBIERNO (RF-35, RF-36)."""

    __tablename__ = "caso_especial"

    id_caso_especial: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_caso: Mapped[int | None] = mapped_column(ForeignKey("caso.id_caso", ondelete="CASCADE"))
    id_solicitante: Mapped[int | None] = mapped_column(ForeignKey("solicitante.id_solicitante"))
    clasificacion: Mapped[str] = mapped_column(String(20), nullable=False)
    tipo_actividad: Mapped[str] = mapped_column(String(20), nullable=False)
    prioridad: Mapped[str] = mapped_column(String(20), nullable=False, default="MEDIA")
    tiene_id_averia: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    descripcion: Mapped[str | None] = mapped_column(Text)
    requiere_informe: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default="ABIERTO")
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    actualizado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Cita(Base):
    """Agenda de contacto/atención; no admite solapamientos por cuadrilla (RF-12 / RNF-04)."""

    __tablename__ = "cita"

    id_cita: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    id_caso: Mapped[int | None] = mapped_column(ForeignKey("caso.id_caso", ondelete="CASCADE"))
    id_caso_especial: Mapped[int | None] = mapped_column(
        ForeignKey("caso_especial.id_caso_especial", ondelete="CASCADE")
    )
    id_cuadrilla: Mapped[int | None] = mapped_column(ForeignKey("cuadrilla.id_cuadrilla"))
    fecha_hora: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    tipo: Mapped[str] = mapped_column(String(20), nullable=False, default="CONTACTO")
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default="PROPUESTA")
    observacion: Mapped[str | None] = mapped_column(Text)
    creado_por: Mapped[str | None] = mapped_column(String(20))
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    #: D-81: `fecha_hora` para la que ya se emitió el recordatorio (idempotencia
    #: y reenvío si la cita se reprograma).
    recordatorio_para: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Seguimiento(Base):
    """Caso derivado a otra instancia/cola (RF-34)."""

    __tablename__ = "seguimiento"

    id_seguimiento: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    id_caso: Mapped[int] = mapped_column(
        ForeignKey("caso.id_caso", ondelete="CASCADE"), nullable=False
    )
    instancia_destino: Mapped[str] = mapped_column(String(120), nullable=False)
    motivo: Mapped[str | None] = mapped_column(Text)
    fecha_envio: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    fecha_retorno: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default="EN_COLA")
    observacion: Mapped[str | None] = mapped_column(Text)
    usuario: Mapped[str | None] = mapped_column(String(20))
