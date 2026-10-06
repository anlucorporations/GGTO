"""Panel de gestión diaria (RF-43 / D-81).

Muestra, por cuadrilla, **Asignadas vs. Cerradas** del despacho de una fecha, en dos
modos: **Común** (`caso.categoria = 'RESIDENCIAL'`) y **Referidos**
(`caso_especial.clasificacion = 'REFERIDO'`). Acotado a la central (RNF-21).
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..models import Caso, CasoEspecial, Cuadrilla, Despacho, DespachoCasos

MODOS = ("COMUN", "REFERIDOS")


def _tz() -> ZoneInfo:
    try:
        return ZoneInfo(get_settings().app_timezone)
    except Exception:  # ZoneInfoNotFoundError, p. ej. sin tzdata
        return ZoneInfo("UTC")


def _porcentaje(cerradas: int, asignadas: int) -> float:
    return round(cerradas / asignadas * 100, 1) if asignadas else 0.0


def gestion_diaria(
    db: Session,
    *,
    id_central: int,
    fecha: date | None = None,
    modo: str = "COMUN",
) -> dict[str, Any]:
    fecha = fecha or datetime.now(_tz()).date()
    cuadrillas = list(
        db.scalars(
            select(Cuadrilla)
            .where(Cuadrilla.id_central == id_central)
            .order_by(Cuadrilla.codigo)
        ).all()
    )

    filas = db.execute(
        select(
            Despacho.id_cuadrilla,
            Caso.id_caso,
            Caso.estado_actual,
            Caso.categoria,
            CasoEspecial.clasificacion,
        )
        .join(DespachoCasos, DespachoCasos.id_despacho == Despacho.id_despacho)
        .join(Caso, Caso.id_caso == DespachoCasos.id_caso)
        .outerjoin(CasoEspecial, CasoEspecial.id_caso == Caso.id_caso)
        .where(Despacho.id_central == id_central, Despacho.fecha == fecha)
    ).all()

    conteo: dict[int, dict[str, int]] = {
        c.id_cuadrilla: {"asignadas": 0, "cerradas": 0} for c in cuadrillas
    }
    for id_cuadrilla, _id_caso, estado, categoria, clasificacion in filas:
        if modo == "COMUN":
            incluir = (categoria or "") == "RESIDENCIAL"
        else:  # REFERIDOS
            incluir = (clasificacion or "") == "REFERIDO"
        if not incluir:
            continue
        grupo = conteo.setdefault(id_cuadrilla, {"asignadas": 0, "cerradas": 0})
        grupo["asignadas"] += 1
        if estado == "CERRADO":
            grupo["cerradas"] += 1

    salida = []
    total_asig = 0
    total_cerr = 0
    for c in cuadrillas:
        g = conteo.get(c.id_cuadrilla, {"asignadas": 0, "cerradas": 0})
        total_asig += g["asignadas"]
        total_cerr += g["cerradas"]
        salida.append(
            {
                "id_cuadrilla": c.id_cuadrilla,
                "codigo": c.codigo,
                "nombre": c.nombre,
                "es_supervisor": c.es_supervisor,
                "asignadas": g["asignadas"],
                "cerradas": g["cerradas"],
                "porcentaje": _porcentaje(g["cerradas"], g["asignadas"]),
            }
        )

    return {
        "fecha": fecha,
        "modo": modo,
        "cuadrillas": salida,
        "totales": {
            "asignadas": total_asig,
            "cerradas": total_cerr,
            "porcentaje": _porcentaje(total_cerr, total_asig),
        },
    }
