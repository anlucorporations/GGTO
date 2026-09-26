"""Modelos SQLAlchemy del Ciclo 2 (CONFIGURACIÓN) y catálogos de apoyo."""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    PrimaryKeyConstraint,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.db import Base


class Sector(Base):
    __tablename__ = "sector"

    id_sector: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_central: Mapped[int] = mapped_column(ForeignKey("central.id_central"), nullable=False)
    nombre: Mapped[str] = mapped_column(String(120), nullable=False)
    codigo: Mapped[str] = mapped_column(String(20), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text)
    prioridad: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=100)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    actualizado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (UniqueConstraint("id_central", "codigo", name="sector_id_central_codigo_key"),)

    direcciones: Mapped[list[SectorDireccion]] = relationship(
        back_populates="sector", cascade="all, delete-orphan", lazy="selectin"
    )


class SectorDireccion(Base):
    __tablename__ = "sector_direccion"

    id_sector_direccion: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_sector: Mapped[int] = mapped_column(
        ForeignKey("sector.id_sector", ondelete="CASCADE"), nullable=False
    )
    patron: Mapped[str] = mapped_column(String(160), nullable=False)
    tipo_coincidencia: Mapped[str] = mapped_column(String(20), nullable=False, default="CONTIENE")
    normalizar: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("id_sector", "patron", name="sector_direccion_id_sector_patron_key"),
    )

    sector: Mapped[Sector] = relationship(back_populates="direcciones")


class Flota(Base):
    __tablename__ = "flota"

    id_flota: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_central: Mapped[int] = mapped_column(ForeignKey("central.id_central"), nullable=False)
    can: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    tipo: Mapped[str | None] = mapped_column(String(40))
    marca: Mapped[str | None] = mapped_column(String(40))
    modelo: Mapped[str | None] = mapped_column(String(40))
    placa: Mapped[str | None] = mapped_column(String(20), unique=True)
    combustible: Mapped[str | None] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="DISPONIBLE")
    estado_cauchos: Mapped[str | None] = mapped_column(String(30))
    estado_fluidos: Mapped[str | None] = mapped_column(String(30))
    estado_general: Mapped[str | None] = mapped_column(String(30))
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    actualizado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Herramienta(Base):
    __tablename__ = "herramienta"

    id_herramienta: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_central: Mapped[int] = mapped_column(ForeignKey("central.id_central"), nullable=False)
    nombre: Mapped[str] = mapped_column(String(120), nullable=False)
    codigo: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default="DISPONIBLE")
    observacion: Mapped[str | None] = mapped_column(Text)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    actualizado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Cuadrilla(Base):
    __tablename__ = "cuadrilla"

    id_cuadrilla: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_central: Mapped[int] = mapped_column(ForeignKey("central.id_central"), nullable=False)
    codigo: Mapped[str] = mapped_column(String(20), nullable=False)
    nombre: Mapped[str] = mapped_column(String(80), nullable=False)
    id_flota: Mapped[int | None] = mapped_column(ForeignKey("flota.id_flota"))
    es_supervisor: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    activa: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    actualizado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("id_central", "codigo", name="cuadrilla_id_central_codigo_key"),
    )

    integrantes: Mapped[list[CuadrillaTecnico]] = relationship(
        back_populates="cuadrilla", cascade="all, delete-orphan", lazy="selectin"
    )
    herramientas: Mapped[list[CuadrillaHerramienta]] = relationship(
        back_populates="cuadrilla", cascade="all, delete-orphan", lazy="selectin"
    )


class CuadrillaTecnico(Base):
    __tablename__ = "cuadrilla_tecnico"

    id_cuadrilla: Mapped[int] = mapped_column(
        ForeignKey("cuadrilla.id_cuadrilla", ondelete="CASCADE"), nullable=False
    )
    id_tecnico: Mapped[int] = mapped_column(
        ForeignKey("tecnico.id_tecnico", ondelete="CASCADE"), nullable=False
    )
    desde: Mapped[date] = mapped_column(Date, nullable=False, server_default=func.current_date())
    rol_cuadrilla: Mapped[str] = mapped_column(
        String(30), nullable=False, default="REPARADOR_PRINCIPAL"
    )
    hasta: Mapped[date | None] = mapped_column(Date)

    __table_args__ = (PrimaryKeyConstraint("id_cuadrilla", "id_tecnico", "desde"),)

    cuadrilla: Mapped[Cuadrilla] = relationship(back_populates="integrantes")


class CuadrillaHerramienta(Base):
    __tablename__ = "cuadrilla_herramienta"

    id_cuadrilla: Mapped[int] = mapped_column(
        ForeignKey("cuadrilla.id_cuadrilla", ondelete="CASCADE"), nullable=False
    )
    id_herramienta: Mapped[int] = mapped_column(
        ForeignKey("herramienta.id_herramienta", ondelete="CASCADE"), nullable=False
    )
    asignada_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    devuelta_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        PrimaryKeyConstraint("id_cuadrilla", "id_herramienta", "asignada_en"),
    )

    cuadrilla: Mapped[Cuadrilla] = relationship(back_populates="herramientas")


class Causa(Base):
    __tablename__ = "causa"

    id_causa: Mapped[int] = mapped_column(Integer, primary_key=True)
    codigo_causa: Mapped[str] = mapped_column(String(20), nullable=False)
    subcodigo_causa: Mapped[str] = mapped_column(String(20), nullable=False, default="")
    descripcion: Mapped[str | None] = mapped_column(String(255))
    descripcion_subcodigo: Mapped[str | None] = mapped_column(String(255))
    tipo: Mapped[str | None] = mapped_column(String(20))
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("codigo_causa", "subcodigo_causa", name="causa_codigo_causa_subcodigo_causa_key"),
    )


class CatalogoMetodo(Base):
    __tablename__ = "catalogo_metodo"

    id_metodo: Mapped[int] = mapped_column(Integer, primary_key=True)
    dominio: Mapped[str] = mapped_column(String(20), nullable=False)
    codigo: Mapped[str] = mapped_column(String(30), nullable=False)
    nombre: Mapped[str] = mapped_column(String(120), nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    __table_args__ = (
        UniqueConstraint("dominio", "codigo", name="catalogo_metodo_dominio_codigo_key"),
    )


class Configuracion(Base):
    __tablename__ = "configuracion"

    clave: Mapped[str] = mapped_column(String(80), primary_key=True)
    valor: Mapped[dict] = mapped_column(JSONB, nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text)
    actualizado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
