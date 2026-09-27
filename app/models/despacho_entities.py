"""Modelos SQLAlchemy del Ciclo 5 (DESPACHO) y notificaciones."""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.db import Base


class Despacho(Base):
    __tablename__ = "despacho"

    id_despacho: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    id_central: Mapped[int] = mapped_column(ForeignKey("central.id_central"), nullable=False)
    fecha: Mapped[date] = mapped_column(Date, nullable=False)
    id_cuadrilla: Mapped[int] = mapped_column(ForeignKey("cuadrilla.id_cuadrilla"), nullable=False)
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default="BORRADOR")
    generado_auto: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    enviado_canal: Mapped[str | None] = mapped_column(String(20))
    enviado_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reporte_produccion_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    usuario_crea: Mapped[str | None] = mapped_column(String(20))
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    actualizado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (UniqueConstraint("fecha", "id_cuadrilla", name="despacho_fecha_id_cuadrilla_key"),)

    casos: Mapped[list[DespachoCasos]] = relationship(
        back_populates="despacho", cascade="all, delete-orphan", lazy="selectin"
    )


class DespachoCasos(Base):
    __tablename__ = "despacho_caso"

    id_despacho_caso: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    id_despacho: Mapped[int] = mapped_column(
        ForeignKey("despacho.id_despacho", ondelete="CASCADE"), nullable=False
    )
    id_caso: Mapped[int] = mapped_column(ForeignKey("caso.id_caso", ondelete="CASCADE"), nullable=False)
    id_sector: Mapped[int | None] = mapped_column(ForeignKey("sector.id_sector"))
    orden_visita: Mapped[int | None] = mapped_column(SmallInteger)
    tipo_asignacion: Mapped[str | None] = mapped_column(String(20))
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default="ASIGNADO")
    observacion: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        UniqueConstraint("id_despacho", "id_caso", name="despacho_caso_id_despacho_id_caso_key"),
    )

    despacho: Mapped[Despacho] = relationship(back_populates="casos")


class Notificacion(Base):
    __tablename__ = "notificacion"

    id_notificacion: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    canal: Mapped[str] = mapped_column(String(20), nullable=False)
    destinatario: Mapped[str | None] = mapped_column(String(160))
    asunto: Mapped[str | None] = mapped_column(String(200))
    cuerpo: Mapped[str | None] = mapped_column(Text)
    id_caso: Mapped[int | None] = mapped_column(ForeignKey("caso.id_caso", ondelete="SET NULL"))
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default="PENDIENTE")
    error: Mapped[str | None] = mapped_column(Text)
    enviado_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FallaMasiva(Base):
    __tablename__ = "falla_masiva"

    id_falla: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    id_central: Mapped[int] = mapped_column(ForeignKey("central.id_central"), nullable=False)
    descripcion: Mapped[str] = mapped_column(Text, nullable=False)
    fecha_deteccion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    origen: Mapped[str] = mapped_column(String(20), nullable=False, default="AUTOMATICA")
    id_sector: Mapped[int | None] = mapped_column(ForeignKey("sector.id_sector"))
    id_cuadrilla: Mapped[int | None] = mapped_column(ForeignKey("cuadrilla.id_cuadrilla"))
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default="DETECTADA")
    planificacion: Mapped[str | None] = mapped_column(Text)
    reporte_simple: Mapped[str | None] = mapped_column(Text)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    actualizado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
