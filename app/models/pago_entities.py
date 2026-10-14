"""Modelos SQLAlchemy del ciclo D-89 — identificador de pago (70\\*).

El **identificador de pago** es el número telefónico 70\\* que enlaza al usuario con
la institución (CANTV). Es la clave de negocio del incremento D-89…D-94:

- **único global** (DEC-IP-6): una sola ficha por número;
- `id_central` registra la **central de origen** (la primera que lo vio); la RLS
  permite leer la ficha a esa central o a cualquier otra que tenga casos enlazados;
- puede acumular **N reportes** (casos con su propio `id_averia`), por lo que los
  históricos se construyen a su alrededor y no alrededor del caso.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from ..core.db import Base

ESTADOS_IDENTIFICADOR = ("ACTIVO", "SUSPENDIDO", "BAJA")


class IdentificadorPago(Base):
    """Identificador de pago (70\\*) — eje del histórico de casos (RF-45…RF-48)."""

    __tablename__ = "identificador_pago"

    id_pago: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    numero: Mapped[str] = mapped_column(String(15), unique=True, nullable=False)
    id_central: Mapped[int] = mapped_column(
        ForeignKey("central.id_central"), nullable=False
    )
    nombre_titular: Mapped[str | None] = mapped_column(String(160))
    direccion_principal: Mapped[str | None] = mapped_column(Text)
    estado: Mapped[str] = mapped_column(String(12), nullable=False, default="ACTIVO")
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
