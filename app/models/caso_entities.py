"""Modelos SQLAlchemy del Ciclo 3 (INGESTA) — caso, lote y seguimiento."""

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
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from ..core.db import Base


class IngestaLote(Base):
    __tablename__ = "ingesta_lote"

    id_lote: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    archivo: Mapped[str] = mapped_column(String(255), nullable=False)
    fecha_archivo: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    id_central: Mapped[int | None] = mapped_column(ForeignKey("central.id_central"))
    filas_leidas: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    filas_central: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    casos_nuevos: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    casos_duplicados: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    casos_descartados: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default="PROCESANDO")
    detalle_error: Mapped[str | None] = mapped_column(Text)
    usuario: Mapped[str | None] = mapped_column(String(20))
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Caso(Base):
    """Tabla central de casos (63 columnas; mapeo depurado del CSV — D-27)."""

    __tablename__ = "caso"

    id_caso: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    id_central: Mapped[int] = mapped_column(ForeignKey("central.id_central"), nullable=False)

    # Clasificación del sistema
    id_averia: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    origen: Mapped[str] = mapped_column(String(20), nullable=False, default="INGESTA_CSV")
    tipo_caso: Mapped[str] = mapped_column(String(20), nullable=False, default="AVERIA")
    categoria: Mapped[str] = mapped_column(String(20), nullable=False, default="RESIDENCIAL")
    estado_actual: Mapped[str] = mapped_column(String(20), nullable=False, default="NUEVO")
    id_sector: Mapped[int | None] = mapped_column(ForeignKey("sector.id_sector"))
    id_causa: Mapped[int | None] = mapped_column(ForeignKey("causa.id_causa"))
    id_lote_ingesta: Mapped[int | None] = mapped_column(ForeignKey("ingesta_lote.id_lote"))
    en_gestion_supervisor: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    es_falla_masiva: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    creado_por: Mapped[str | None] = mapped_column(String(20))

    # Geografía (filtro de la central)
    region: Mapped[str | None] = mapped_column(String(80))
    estado_geografico: Mapped[str | None] = mapped_column(String(80))
    capital_estado: Mapped[str | None] = mapped_column(String(80))
    municipio: Mapped[str | None] = mapped_column(String(80))
    parroquia: Mapped[str | None] = mapped_column(String(80))
    estado_operativo: Mapped[str | None] = mapped_column(String(80))
    distrito: Mapped[str | None] = mapped_column(String(40))
    area: Mapped[str | None] = mapped_column(String(20))
    codigo_central: Mapped[str | None] = mapped_column(String(20))
    nombre_central: Mapped[str | None] = mapped_column(String(120))

    # Datos administrativos y de contacto
    telefono: Mapped[str | None] = mapped_column(String(30))
    fecha_reporte: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    persona_reporta: Mapped[str | None] = mapped_column(String(120))
    contacto_cliente: Mapped[str | None] = mapped_column(String(60))
    fecha_compromiso: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    fecha_cita: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ultimo_comentario: Mapped[str | None] = mapped_column(Text)
    results: Mapped[str | None] = mapped_column(Text)
    asignado_a: Mapped[str | None] = mapped_column(String(60))
    cuadrilla_externa: Mapped[str | None] = mapped_column(String(40))
    estatus_origen: Mapped[str | None] = mapped_column(String(20))
    problema_reporte: Mapped[str | None] = mapped_column(Text)
    informacion: Mapped[str | None] = mapped_column(Text)
    nombre_cliente: Mapped[str | None] = mapped_column(String(160))
    direccion: Mapped[str | None] = mapped_column(Text)

    # Datos técnicos / lógicos
    olt: Mapped[str | None] = mapped_column(String(40))
    plan: Mapped[str | None] = mapped_column(String(60))
    slot: Mapped[str | None] = mapped_column(String(10))
    puerto: Mapped[str | None] = mapped_column(String(10))
    fat: Mapped[str | None] = mapped_column(String(80))
    serial: Mapped[str | None] = mapped_column(String(60))
    extra: Mapped[str | None] = mapped_column(String(40))
    area_trabajo: Mapped[str | None] = mapped_column(String(40))
    tipo_servicio: Mapped[str | None] = mapped_column(String(40))
    tipo_problema: Mapped[str | None] = mapped_column(String(20))
    dias_area_resolutoria: Mapped[int | None] = mapped_column(Integer)
    unidad_negocio: Mapped[str | None] = mapped_column(String(40))
    ups: Mapped[str | None] = mapped_column(String(10))
    codigos_gestionados_venapp: Mapped[str | None] = mapped_column(String(60))
    codigos_sin_gestion_venapp: Mapped[str | None] = mapped_column(String(60))

    # Asignación de origen
    reparador_principal: Mapped[str | None] = mapped_column(String(20))
    ayudantes: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    flota_can: Mapped[str | None] = mapped_column(String(20))
    despacho_nombre: Mapped[str | None] = mapped_column(String(80))
    despacho_apellido: Mapped[str | None] = mapped_column(String(80))
    telefono_oficina: Mapped[str | None] = mapped_column(String(30))
    telefono_movil: Mapped[str | None] = mapped_column(String(30))
    fecha_hora_asignacion: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    actualizado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
