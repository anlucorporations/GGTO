"""Modelo mínimo de órdenes de material (RF-18); el módulo de insumos es v2 (Ciclo 10)."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from ..core.db import Base


class OrdenMaterial(Base):
    __tablename__ = "orden_material"

    id_orden: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    id_caso: Mapped[int | None] = mapped_column(ForeignKey("caso.id_caso"))
    id_cuadrilla: Mapped[int | None] = mapped_column(ForeignKey("cuadrilla.id_cuadrilla"))
    solicitante_usuario: Mapped[str | None] = mapped_column(String(20))
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default="SOLICITADA")
    fecha: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    observacion: Mapped[str | None] = mapped_column(Text)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    actualizado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
