"""Modelos SQLAlchemy del Ciclo 5 (DESPACHO) y notificaciones."""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
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
    # D-99: corte de jornada (RF-65). `cierre_auto` distingue el cierre de las
    # 23:50 del cierre manual, que ya no se ofrece en la interfaz.
    cerrado_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cierre_auto: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    reprocesado_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
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


class CuadrillaSectorDia(Base):
    """Asignación dinámica de sectores a cuadrillas para un día (D-66).

    El supervisor decide, para cada jornada, qué sectores atiende cada
    cuadrilla; el despacho reparte los casos según esa asignación. Un sector
    pertenece como máximo a una cuadrilla por día.
    """

    __tablename__ = "cuadrilla_sector_dia"

    id_asignacion: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    id_central: Mapped[int] = mapped_column(ForeignKey("central.id_central"), nullable=False)
    fecha: Mapped[date] = mapped_column(Date, nullable=False)
    id_cuadrilla: Mapped[int] = mapped_column(
        ForeignKey("cuadrilla.id_cuadrilla", ondelete="CASCADE"), nullable=False
    )
    id_sector: Mapped[int] = mapped_column(
        ForeignKey("sector.id_sector", ondelete="CASCADE"), nullable=False
    )
    usuario: Mapped[str | None] = mapped_column(String(20))
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("fecha", "id_sector", name="cuadrilla_sector_dia_fecha_id_sector_key"),
    )


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
    intentos: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    proximo_intento: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FallaMasiva(Base):
    __tablename__ = "falla_masiva"

    id_falla: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    id_central: Mapped[int] = mapped_column(ForeignKey("central.id_central"), nullable=False)
    clave_concentracion: Mapped[str | None] = mapped_column(String(120))
    descripcion: Mapped[str] = mapped_column(Text, nullable=False)
    fecha_deteccion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    origen: Mapped[str] = mapped_column(String(20), nullable=False, default="AUTOMATICA")
    id_sector: Mapped[int | None] = mapped_column(ForeignKey("sector.id_sector"))
    id_cuadrilla: Mapped[int | None] = mapped_column(ForeignKey("cuadrilla.id_cuadrilla"))
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default="DETECTADA")
    # D-82: datos del reporte de campo (APK) — ODN, dirección, FAT y las
    # evidencias fotográficas (seriales separados por coma, máximo 2).
    odn: Mapped[str | None] = mapped_column(String(60))
    direccion: Mapped[str | None] = mapped_column(String(200))
    fat: Mapped[str | None] = mapped_column(String(60))
    # D-118: identidad técnica del FAT (OLT + slot + puerto + FAT). La detección,
    # la asociación manual y el cierre comparan esta tupla completa.
    olt: Mapped[str | None] = mapped_column(String(60))
    slot: Mapped[str | None] = mapped_column(String(20))
    puerto: Mapped[str | None] = mapped_column(String(20))
    evidencias: Mapped[str | None] = mapped_column(Text)
    planificacion: Mapped[str | None] = mapped_column(Text)
    reporte_simple: Mapped[str | None] = mapped_column(Text)
    planificada_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # D-99 (RF-61): cierre de la masiva. Exige descripción del trabajo, el
    # personal del CRASS que valida la reparación y las evidencias.
    descripcion_cierre: Mapped[str | None] = mapped_column(Text)
    id_validador_crass: Mapped[int | None] = mapped_column(
        ForeignKey("solicitante.id_solicitante", ondelete="SET NULL")
    )
    evidencias_cierre: Mapped[str | None] = mapped_column(Text)
    cerrada_por: Mapped[str | None] = mapped_column(String(20))
    cerrada_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    casos_cerrados: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # D-99 (RF-60): ubicación del FAT afectado para el mapa de la sección MASIVAS.
    latitud: Mapped[float | None] = mapped_column(Numeric(10, 7))
    longitud: Mapped[float | None] = mapped_column(Numeric(10, 7))
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    actualizado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FallaMasivaCaso(Base):
    """Asociación explícita entre una falla masiva y un caso (D-99 · DEC-MA-1).

    Sustituye la deducción implícita por `clave_concentracion`: permite listar
    los CASOS ASOCIADOS, agregar o quitar casos a mano y cerrar la masiva en
    cascada sin ambigüedad.
    """

    __tablename__ = "falla_masiva_caso"

    id_asociacion: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    id_falla: Mapped[int] = mapped_column(
        ForeignKey("falla_masiva.id_falla", ondelete="CASCADE"), nullable=False
    )
    id_caso: Mapped[int] = mapped_column(
        ForeignKey("caso.id_caso", ondelete="CASCADE"), nullable=False
    )
    origen: Mapped[str] = mapped_column(String(12), nullable=False, default="AUTO")
    agregado_por: Mapped[str | None] = mapped_column(String(20))
    agregado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("id_falla", "id_caso", name="falla_masiva_caso_id_falla_id_caso_key"),
    )
