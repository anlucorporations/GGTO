"""Modelos SQLAlchemy del módulo de sincronización (D-73).

`sync_log` registra cada sesión DESCARGA / CARGA de la APK para trazabilidad,
detección de sincronizaciones incompletas y resolución de conflictos.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from ..core.db import Base


class SyncLog(Base):
    """Bitácora de sesiones de sincronización móvil."""

    __tablename__ = "sync_log"

    id_sync_log: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    p00: Mapped[str] = mapped_column(String(20), nullable=False)
    id_cuadrilla: Mapped[int | None] = mapped_column(ForeignKey("cuadrilla.id_cuadrilla"))
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)
    dispositivo_id: Mapped[str | None] = mapped_column(String(80))
    version_app: Mapped[str | None] = mapped_column(String(20))
    iniciado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    finalizado_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    recibidos: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    procesados: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    errores: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default="EN_PROCESO")
    detalle: Mapped[dict | None] = mapped_column(JSONB)

    __table_args__ = (
        CheckConstraint("tipo IN ('DESCARGA','CARGA')", name="ck_sync_log_tipo"),
        CheckConstraint(
            "estado IN ('EN_PROCESO','OK','PARCIAL','ERROR')",
            name="ck_sync_log_estado",
        ),
    )
