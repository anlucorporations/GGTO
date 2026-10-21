"""Efectividad y **ranking de cuadrillas** (D-146 · RF-27).

El objetivo es comparar cuadrillas con un número estable, explicable y auditable.
El puntaje es una media ponderada de cuatro criterios, todos medidos sobre el
**trabajo despachado** a la cuadrilla en un periodo:

| Criterio | Peso | Qué mide |
|---|---|---|
| **Cierre** | 45 % | casos cerrados sobre los asignados (el trabajo se termina) |
| **Oportunidad** | 25 % | de los cerrados, cuántos se cerraron dentro de `DIAS_OPORTUNIDAD` día(s) |
| **Calidad** | 20 % | de los cerrados, cuántos tienen al menos una **evidencia** fotográfica |
| **Sin reapertura** | 10 % | 1 - (casos reabiertos / casos cerrados) |

`puntaje = 100 * suma(peso * criterio)`, entre 0 y 100. Los conteos viajan en
la respuesta para que el ranking sea reproducible a mano.

Reglas:
- Un caso **reasignado** cuenta en las dos cuadrillas (una fila de `despacho_caso`
  por despacho): el trabajo devuelto penaliza a la que no lo terminó.
- Los despachos en `BORRADOR` no cuentan (no llegaron a los técnicos).
- Con menos de `MIN_MUESTRAS` casos asignados el puntaje se informa igual, pero
  marcado como `muestra_suficiente=false` y **fuera** del ranking de posiciones.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import (
    Actividad,
    Caso,
    CasoEstadoHist,
    Cuadrilla,
    Despacho,
    DespachoCasos,
    Evidencia,
)
from .tiempo import dia_operativo

#: Pesos de los criterios (suman 1). Cambiarlos aquí cambia el ranking.
PESOS: dict[str, float] = {
    "cierre": 0.45,
    "oportunidad": 0.25,
    "calidad": 0.20,
    "reapertura": 0.10,
}

#: Días que se consideran «a tiempo» desde el despacho hasta el cierre.
DIAS_OPORTUNIDAD = 1

#: Asignaciones mínimas para entrar al ranking de posiciones.
MIN_MUESTRAS = 5

#: Umbrales de la etiqueta cualitativa.
ETIQUETAS = ((85.0, "EXCELENTE"), (70.0, "BUENO"), (50.0, "REGULAR"))

ESTADOS_REAPERTURA_DESTINO = ("CERRADO",)


@dataclass
class Conteos:
    """Conteos crudos de una cuadrilla en el periodo."""

    asignados: int = 0
    cerrados: int = 0
    devueltos: int = 0
    en_plazo: int = 0
    con_evidencia: int = 0
    reaperturas: int = 0
    casos_unicos: int = 0
    dias_trabajados: int = 0
    #: Casos por estado actual (para el detalle del panel).
    por_estado: dict[str, int] = field(default_factory=dict)


def _cociente(numerador: int, denominador: int) -> float:
    if denominador <= 0:
        return 0.0
    return numerador / denominador


def puntaje(conteos: Conteos, *, minimo_muestras: int = MIN_MUESTRAS) -> dict:
    """Calcula el puntaje (0-100) y sus componentes a partir de los conteos.

    Es una función **pura**: la usan el endpoint, las pruebas y cualquier informe
    sin tocar la base.
    """
    cierre = _cociente(conteos.cerrados, conteos.asignados)
    oportunidad = _cociente(conteos.en_plazo, conteos.cerrados)
    calidad = _cociente(conteos.con_evidencia, conteos.cerrados)
    # Un caso reabierto puede **no** estar cerrado hoy (es justo lo que produce la
    # reapertura), así que el denominador no puede ser solo `cerrados`: se toma el
    # mayor entre cerrados y reabiertos para que la ratio quede en 0..1.
    denominador_reapertura = max(conteos.cerrados, conteos.reaperturas)
    reapertura = 1.0 - min(1.0, _cociente(conteos.reaperturas, denominador_reapertura))
    componentes = {
        "cierre": round(cierre, 4),
        "oportunidad": round(oportunidad, 4),
        "calidad": round(calidad, 4),
        "reapertura": round(reapertura, 4),
    }
    total = sum(PESOS[clave] * valor for clave, valor in componentes.items())
    valor = round(100.0 * total, 1)
    return {
        "puntaje": valor,
        "componentes": componentes,
        "etiqueta": _etiqueta(valor),
        "muestra_suficiente": conteos.asignados >= minimo_muestras,
    }


def _etiqueta(valor: float) -> str:
    for umbral, etiqueta in ETIQUETAS:
        if valor >= umbral:
            return etiqueta
    return "BAJO"


def _cierres_por_caso(db: Session, ids_caso: list[int]) -> dict[int, datetime]:
    """Primera fecha de cierre de cada caso."""
    if not ids_caso:
        return {}
    filas = db.execute(
        select(CasoEstadoHist.id_caso, func.min(CasoEstadoHist.fecha_hora))
        .where(
            CasoEstadoHist.id_caso.in_(ids_caso),
            CasoEstadoHist.estado_nuevo.in_(ESTADOS_REAPERTURA_DESTINO),
        )
        .group_by(CasoEstadoHist.id_caso)
    ).all()
    return {id_caso: momento for id_caso, momento in filas if momento is not None}


def _casos_con_evidencia(db: Session, ids_caso: list[int]) -> set[int]:
    """Casos con al menos una evidencia fotográfica.

    Desde D-128 la evidencia guarda su `id_caso`; las filas antiguas solo tienen
    la actividad, así que se resuelven también por ahí.
    """
    if not ids_caso:
        return set()
    ids = set(ids_caso)
    directos = set(
        db.scalars(select(Evidencia.id_caso).where(Evidencia.id_caso.in_(ids_caso))).all()
    )
    por_actividad = set(
        db.scalars(
            select(Actividad.id_caso)
            .join(Evidencia, Evidencia.id_actividad == Actividad.id_actividad)
            .where(Actividad.id_caso.in_(ids_caso))
        ).all()
    )
    return {c for c in (directos | por_actividad) if c is not None and c in ids}


def _casos_reabiertos(db: Session, ids_caso: list[int]) -> set[int]:
    """Casos que volvieron a abrirse después de estar cerrados."""
    if not ids_caso:
        return set()
    return set(
        db.scalars(
            select(CasoEstadoHist.id_caso)
            .where(
                CasoEstadoHist.id_caso.in_(ids_caso),
                CasoEstadoHist.estado_anterior.in_(ESTADOS_REAPERTURA_DESTINO),
                CasoEstadoHist.estado_nuevo.notin_(ESTADOS_REAPERTURA_DESTINO),
            )
            .distinct()
        ).all()
    )


def ranking(
    db: Session,
    id_central: int,
    desde: date,
    hasta: date,
    *,
    minimo_muestras: int = MIN_MUESTRAS,
) -> dict:
    """Ranking de efectividad de las cuadrillas de la central en el periodo."""
    filas = db.execute(
        select(
            Despacho.id_cuadrilla,
            Despacho.fecha,
            DespachoCasos.id_caso,
            DespachoCasos.estado.label("estado_despacho"),
            Caso.estado_actual,
        )
        .join(DespachoCasos, DespachoCasos.id_despacho == Despacho.id_despacho)
        .join(Caso, Caso.id_caso == DespachoCasos.id_caso)
        .where(
            Despacho.id_central == id_central,
            Despacho.fecha >= desde,
            Despacho.fecha <= hasta,
            Despacho.estado != "BORRADOR",
        )
    ).all()

    cuadrillas = list(
        db.scalars(
            select(Cuadrilla)
            .where(Cuadrilla.id_central == id_central, Cuadrilla.es_supervisor.is_(False))
            .order_by(Cuadrilla.codigo)
        ).all()
    )
    conteos: dict[int, Conteos] = {c.id_cuadrilla: Conteos() for c in cuadrillas}
    por_cuadrilla: dict[int, list] = {}
    for fila in filas:
        por_cuadrilla.setdefault(fila.id_cuadrilla, []).append(fila)

    ids_todos = sorted({f.id_caso for f in filas})
    cierres = _cierres_por_caso(db, ids_todos)
    con_evidencia = _casos_con_evidencia(db, ids_todos)
    reabiertos = _casos_reabiertos(db, ids_todos)

    for id_cuadrilla, propias in por_cuadrilla.items():
        datos = conteos.setdefault(id_cuadrilla, Conteos())
        datos.asignados = len(propias)
        datos.casos_unicos = len({f.id_caso for f in propias})
        datos.dias_trabajados = len({f.fecha for f in propias})
        estados: dict[str, int] = {}
        for fila in propias:
            estado = (fila.estado_actual or "").upper()
            cerrado = estado == "CERRADO" or (fila.estado_despacho or "").upper() == "CERRADO"
            if cerrado:
                datos.cerrados += 1
                momento = cierres.get(fila.id_caso)
                if momento is not None:
                    # D-131: el plazo se mide en **día operativo** (America/Caracas),
                    # no en la fecha UTC que devuelve la base.
                    limite = fila.fecha.toordinal() + DIAS_OPORTUNIDAD
                    if dia_operativo(momento).toordinal() <= limite:
                        datos.en_plazo += 1
                if fila.id_caso in con_evidencia:
                    datos.con_evidencia += 1
            # D-99: el cierre de jornada devuelve el **caso** a PENDIENTE; ese es
            # el «no atendido» que se mide como trabajo devuelto.
            if estado == "PENDIENTE":
                datos.devueltos += 1
            estados[estado or "SIN_ESTADO"] = estados.get(estado or "SIN_ESTADO", 0) + 1
        # Las reaperturas se cuentan por **caso**, no por fila, y también cuando el
        # caso ya no está cerrado (el estado típico de un caso reabierto).
        datos.reaperturas = len({f.id_caso for f in propias} & reabiertos)
        datos.por_estado = estados

    resultado = []
    for cuadrilla in cuadrillas:
        datos = conteos[cuadrilla.id_cuadrilla]
        calculo = puntaje(datos, minimo_muestras=minimo_muestras)
        resultado.append(
            {
                "id_cuadrilla": cuadrilla.id_cuadrilla,
                "codigo": cuadrilla.codigo,
                "nombre": cuadrilla.nombre,
                "activa": cuadrilla.activa,
                "asignados": datos.asignados,
                "cerrados": datos.cerrados,
                "devueltos": datos.devueltos,
                "en_plazo": datos.en_plazo,
                "con_evidencia": datos.con_evidencia,
                "reaperturas": datos.reaperturas,
                "casos_unicos": datos.casos_unicos,
                "dias_trabajados": datos.dias_trabajados,
                "por_estado": datos.por_estado,
                **calculo,
                "posicion": None,
            }
        )

    # Posiciones solo entre las que tienen muestra suficiente; el resto va después.
    con_muestra = [f for f in resultado if f["muestra_suficiente"]]
    sin_muestra = [f for f in resultado if not f["muestra_suficiente"]]
    orden = sorted(
        con_muestra,
        key=lambda f: (-f["puntaje"], -f["cerrados"], -f["asignados"], f["codigo"]),
    )
    for indice, fila in enumerate(orden, start=1):
        fila["posicion"] = indice
    orden.extend(
        sorted(sin_muestra, key=lambda f: (-f["puntaje"], f["codigo"]))
    )

    return {
        "desde": desde,
        "hasta": hasta,
        "id_central": id_central,
        "pesos": dict(PESOS),
        "criterios": {
            "cierre": "casos cerrados / asignados",
            "oportunidad": f"cerrados en {DIAS_OPORTUNIDAD} día(s) o menos / cerrados",
            "calidad": "cerrados con evidencia / cerrados",
            "reapertura": "1 - (casos reabiertos / casos cerrados)",
        },
        "minimo_muestras": minimo_muestras,
        "dias_oportunidad": DIAS_OPORTUNIDAD,
        "ranking": orden,
    }
