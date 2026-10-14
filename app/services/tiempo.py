"""Zona y **día operativo** de la central (RNF-13).

La central opera en Venezuela: el «día» de las métricas, de los informes y de las
alarmas de despacho es el de `America/Caracas`, no el del servidor. Nació en D-94
porque las consultas comparaban `date(timestamptz)` —que PostgreSQL evalúa en la
zona de la **sesión** (UTC en Cloud SQL)— y a partir de las 20:00 de Caracas todo
caía en el día siguiente.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta, timezone, tzinfo
from zoneinfo import ZoneInfo

#: Zona horaria del **día operativo** (parametrizable aquí y solo aquí).
ZONA_OPERATIVA = "America/Caracas"

try:  # la base de zonas horarias puede faltar en Windows sin el paquete `tzdata`.
    _ZONA: tzinfo = ZoneInfo(ZONA_OPERATIVA)
except Exception:  # pragma: no cover - solo entornos sin tzdata
    # Caracas no aplica horario de verano desde 2016 (UTC-04:00 fijo).
    _ZONA = timezone(timedelta(hours=-4), ZONA_OPERATIVA)


def ahora_operativo() -> datetime:
    """Momento actual en la zona operativa."""
    return datetime.now(UTC).astimezone(_ZONA)


def hoy_operativo() -> date:
    """Fecha de hoy en el **día operativo**.

    Es el valor por defecto de `fecha` en MONITOREO y REPORTES: con el día del
    servidor (UTC), la consulta sin fecha mostraba el día siguiente a partir de las
    20:00 de Caracas.
    """
    return ahora_operativo().date()


def dia_operativo(momento: datetime) -> date:
    """Día operativo de un `datetime` (si viene sin zona, se asume UTC)."""
    if momento.tzinfo is None:
        momento = momento.replace(tzinfo=UTC)
    return momento.astimezone(_ZONA).date()
