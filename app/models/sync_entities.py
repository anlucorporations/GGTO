"""Modelos SQLAlchemy del módulo de sincronización (D-73 / D-81).

`sync_log` registra cada sesión DESCARGA / CARGA de la APK para trazabilidad,
detección de sincronizaciones incompletas y resolución de conflictos.
`sync_check` (D-81) guarda el checklist **por paso** de cada sesión (RF-40).
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from ..core.db import Base


class SyncLog(Base):
    """Bitácora de sesiones de sincronización móvil."""

    __tablename__ = "sync_log"

    id_sync_log: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    p00: Mapped[str] = mapped_column(String(20), nullable=False)
    id_cuadrilla: Mapped[int | None] = mapped_column(ForeignKey("cuadrilla.id_cuadrilla"))
    id_central: Mapped[int | None] = mapped_column(ForeignKey("central.id_central"))  # D-81 / RNF-21
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)
    dispositivo_id: Mapped[str | None] = mapped_column(String(80))
    version_app: Mapped[str | None] = mapped_column(String(20))
    plataforma: Mapped[str] = mapped_column(
        String(20), nullable=False, default="APK", server_default="APK"
    )  # D-81
    duracion_ms: Mapped[int | None] = mapped_column(Integer)  # D-81
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


class SyncCheck(Base):
    """Checklist por paso de una sesión de sincronización (RF-40 / C-02).

    Una fila por `(id_sync_log, paso)`. `estado` admite `OMITIDO` para los pasos
    que no se ejecutan cuando falla la conexión.
    """

    __tablename__ = "sync_check"

    id_sync_check: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    id_sync_log: Mapped[int] = mapped_column(
        ForeignKey("sync_log.id_sync_log", ondelete="CASCADE"), nullable=False
    )
    paso: Mapped[str] = mapped_column(String(12), nullable=False)
    estado: Mapped[str] = mapped_column(String(12), nullable=False, default="PENDIENTE")
    fecha_hora: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    detalle: Mapped[dict | None] = mapped_column(JSONB)

    __table_args__ = (
        CheckConstraint("paso IN ('CONEXION','LOGIN','DESCARGA','CARGA')", name="ck_sync_check_paso"),
        CheckConstraint(
            "estado IN ('PENDIENTE','EN_CURSO','OK','ERROR','OMITIDO')",
            name="ck_sync_check_estado",
        ),
        UniqueConstraint("id_sync_log", "paso", name="uq_sync_check_log_paso"),
    )
