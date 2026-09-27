"""Cálculo de las métricas de MONITOREO y REPORTES (ver `RepoTecnico/metricas.md`)."""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import (
    Caso,
    CasoEstadoHist,
    Cita,
    Cuadrilla,
    CuadrillaTecnico,
    Despacho,
    DespachoCasos,
    Flota,
    Herramienta,
    Sector,
    Tecnico,
)

PENDIENTE_EXCLUIR = ("CERRADO", "CANCELADO")
EMPRESARIAL = ("EMPRESA", "GOBIERNO")
DIAS_SEMANA = 6  # lunes a sábado


def rango_semana(fecha: date) -> tuple[date, date]:
    """Lunes a sábado de la semana de `fecha`."""
    lunes = fecha - timedelta(days=fecha.weekday())
    return lunes, lunes + timedelta(days=DIAS_SEMANA - 1)


def rango_periodo(periodo: str, fecha: date) -> tuple[date, date]:
    if periodo == "semanal":
        return rango_semana(fecha)
    if periodo == "mensual":
        primero = fecha.replace(day=1)
        siguiente = (primero + timedelta(days=32)).replace(day=1)
        return primero, siguiente - timedelta(days=1)
    return fecha, fecha


def _dias(desde: date, dias: int = DIAS_SEMANA) -> list[date]:
    return [desde + timedelta(days=i) for i in range(dias)]


def _conteo(db: Session, *condiciones) -> int:
    return db.scalar(select(func.count()).select_from(Caso).where(*condiciones)) or 0


def _resueltos(db: Session, id_central: int, desde: date, hasta: date, categoria: str | None) -> int:
    condiciones = [
        Caso.id_central == id_central,
        CasoEstadoHist.estado_nuevo == "CERRADO",
        func.date(CasoEstadoHist.fecha_hora).between(desde, hasta),
    ]
    if categoria:
        condiciones.append(Caso.categoria == categoria)
    return db.scalar(
        select(func.count()).select_from(CasoEstadoHist).join(Caso, Caso.id_caso == CasoEstadoHist.id_caso)
        .where(*condiciones)
    ) or 0


def _cambiaron_a(db: Session, id_central: int, estado: str, desde: date, hasta: date) -> int:
    return db.scalar(
        select(func.count()).select_from(CasoEstadoHist).join(Caso, Caso.id_caso == CasoEstadoHist.id_caso)
        .where(Caso.id_central == id_central, CasoEstadoHist.estado_nuevo == estado,
               func.date(CasoEstadoHist.fecha_hora).between(desde, hasta))
    ) or 0


def _pendientes(db: Session, id_central: int, *extra):
    return _conteo(db, Caso.id_central == id_central, Caso.estado_actual.notin_(PENDIENTE_EXCLUIR), *extra)


# --------------------------------------------------------------------------- #
# Gestión diaria / semanal
# --------------------------------------------------------------------------- #
def gestion_diaria(db: Session, id_central: int, fecha: date) -> dict:
    return {
        "fecha": fecha.isoformat(),
        "ingresos_nuevos": _conteo(db, Caso.id_central == id_central, func.date(Caso.creado_en) == fecha),
        "resueltos_residencial": _resueltos(db, id_central, fecha, fecha, "RESIDENCIAL"),
        "resueltos_empresarial": db.scalar(
            select(func.count()).select_from(CasoEstadoHist)
            .join(Caso, Caso.id_caso == CasoEstadoHist.id_caso)
            .where(Caso.id_central == id_central, CasoEstadoHist.estado_nuevo == "CERRADO",
                   func.date(CasoEstadoHist.fecha_hora) == fecha, Caso.categoria.in_(EMPRESARIAL))
        ) or 0,
        "resueltos_referidos": _resueltos(db, id_central, fecha, fecha, "REFERIDO"),
        "citados": db.scalar(
            select(func.count(func.distinct(Cita.id_caso))).where(func.date(Cita.fecha_hora) == fecha,
                                                                  Cita.id_caso.is_not(None))
        ) or 0,
        "diferidos": _cambiaron_a(db, id_central, "DIFERIDO", fecha, fecha),
        "gestionados": db.scalar(
            select(func.count(func.distinct(DespachoCasos.id_caso)))
            .join(Despacho, Despacho.id_despacho == DespachoCasos.id_despacho)
            .where(Despacho.id_central == id_central, Despacho.fecha == fecha,
                   DespachoCasos.estado == "GESTIONADO")
        ) or 0,
        "pendientes_total": _pendientes(db, id_central),
    }


def _por_dia_cuadrilla(db: Session, id_central: int, id_cuadrilla: int, dia: date) -> dict:
    asignados = db.scalar(
        select(func.count()).select_from(DespachoCasos)
        .join(Despacho, Despacho.id_despacho == DespachoCasos.id_despacho)
        .where(Despacho.id_central == id_central, Despacho.id_cuadrilla == id_cuadrilla,
               Despacho.fecha == dia)
    ) or 0
    gestionados = db.scalar(
        select(func.count()).select_from(DespachoCasos)
        .join(Despacho, Despacho.id_despacho == DespachoCasos.id_despacho)
        .where(Despacho.id_central == id_central, Despacho.id_cuadrilla == id_cuadrilla,
               Despacho.fecha == dia, DespachoCasos.estado == "GESTIONADO")
    ) or 0
    cerrados = db.scalar(
        select(func.count()).select_from(CasoEstadoHist)
        .join(Caso, Caso.id_caso == CasoEstadoHist.id_caso)
        .join(DespachoCasos, DespachoCasos.id_caso == Caso.id_caso)
        .join(Despacho, Despacho.id_despacho == DespachoCasos.id_despacho)
        .where(Despacho.id_central == id_central, Despacho.id_cuadrilla == id_cuadrilla,
               Despacho.fecha == dia, CasoEstadoHist.estado_nuevo == "CERRADO",
               func.date(CasoEstadoHist.fecha_hora) == dia)
    ) or 0
    return {"fecha": dia.isoformat(), "asignados": asignados, "cerrados": cerrados,
            "gestionados": gestionados}


def gestion_semanal(db: Session, id_central: int, desde: date) -> dict:
    lunes, sabado = rango_semana(desde)
    dias = []
    for dia in _dias(lunes):
        asignados = db.scalar(
            select(func.count()).select_from(DespachoCasos)
            .join(Despacho, Despacho.id_despacho == DespachoCasos.id_despacho)
            .where(Despacho.id_central == id_central, Despacho.fecha == dia)
        ) or 0
        gestionados = db.scalar(
            select(func.count()).select_from(DespachoCasos)
            .join(Despacho, Despacho.id_despacho == DespachoCasos.id_despacho)
            .where(Despacho.id_central == id_central, Despacho.fecha == dia,
                   DespachoCasos.estado == "GESTIONADO")
        ) or 0
        dias.append({
            "fecha": dia.isoformat(),
            "asignados": asignados,
            "cerrados": _resueltos(db, id_central, dia, dia, None),
            "gestionados": gestionados,
        })
    return {"desde": lunes.isoformat(), "hasta": sabado.isoformat(), "dias": dias}


def casos_globales(db: Session, id_central: int, desde: date, hasta: date) -> dict:
    pendientes = _pendientes(db, id_central)
    resueltos = _resueltos(db, id_central, desde, hasta, None)
    por_estado = dict(
        db.execute(
            select(Caso.estado_actual, func.count()).where(Caso.id_central == id_central)
            .group_by(Caso.estado_actual)
        ).all()
    )
    por_categoria = dict(
        db.execute(
            select(Caso.categoria, func.count()).where(Caso.id_central == id_central)
            .group_by(Caso.categoria)
        ).all()
    )
    return {"desde": desde.isoformat(), "hasta": hasta.isoformat(), "pendientes": pendientes,
            "resueltos": resueltos, "total": pendientes + resueltos,
            "por_estado": por_estado, "por_categoria": por_categoria}


def reparacion(db: Session, id_central: int) -> dict:
    residenciales = _pendientes(db, id_central, Caso.categoria == "RESIDENCIAL",
                                Caso.tipo_caso != "CONSTRUCCION")
    referidos = _pendientes(db, id_central, Caso.categoria == "REFERIDO",
                            Caso.tipo_caso != "CONSTRUCCION")
    empresariales = _pendientes(db, id_central, Caso.categoria.in_(EMPRESARIAL),
                                Caso.tipo_caso != "CONSTRUCCION")
    return {"residenciales_comunes": residenciales, "residenciales_referidos": referidos,
            "empresariales": empresariales, "total": residenciales + referidos + empresariales}


def construccion(db: Session, id_central: int) -> dict:
    residenciales = _pendientes(db, id_central, Caso.tipo_caso == "CONSTRUCCION",
                                Caso.categoria == "RESIDENCIAL")
    empresariales = _pendientes(db, id_central, Caso.tipo_caso == "CONSTRUCCION",
                                Caso.categoria.in_(EMPRESARIAL))
    return {"residenciales": residenciales, "empresariales": empresariales,
            "total": residenciales + empresariales}


def por_cuadrilla(db: Session, id_central: int, desde: date, dias: int = DIAS_SEMANA) -> dict:
    cuadrillas = db.scalars(
        select(Cuadrilla).where(Cuadrilla.id_central == id_central, Cuadrilla.es_supervisor.is_(False))
        .order_by(Cuadrilla.codigo)
    ).all()
    resultado = []
    for cu in cuadrillas:
        detalle = [_por_dia_cuadrilla(db, id_central, cu.id_cuadrilla, d) for d in _dias(desde, dias)]
        resultado.append({
            "id_cuadrilla": cu.id_cuadrilla, "codigo": cu.codigo, "nombre": cu.nombre,
            "dias": detalle,
            "totales": {
                "asignados": sum(d["asignados"] for d in detalle),
                "cerrados": sum(d["cerrados"] for d in detalle),
                "gestionados": sum(d["gestionados"] for d in detalle),
            },
        })
    return {"desde": desde.isoformat(), "dias": dias, "cuadrillas": resultado}


def capacidad(db: Session, id_central: int) -> dict:
    cuadrillas = db.scalars(
        select(Cuadrilla).where(Cuadrilla.id_central == id_central, Cuadrilla.activa.is_(True))
        .order_by(Cuadrilla.codigo)
    ).all()
    detalle = []
    for cu in cuadrillas:
        integrantes = db.scalar(
            select(func.count()).select_from(CuadrillaTecnico)
            .where(CuadrillaTecnico.id_cuadrilla == cu.id_cuadrilla, CuadrillaTecnico.hasta.is_(None))
        ) or 0
        flota = db.get(Flota, cu.id_flota) if cu.id_flota else None
        detalle.append({
            "id_cuadrilla": cu.id_cuadrilla, "codigo": cu.codigo, "nombre": cu.nombre,
            "es_supervisor": cu.es_supervisor, "integrantes": integrantes,
            "flota": f"{flota.can} ({flota.status})" if flota else None,
            "completa": bool(integrantes) and (flota is not None or cu.es_supervisor),
        })
    return {
        "cuadrillas_activas": len([c for c in detalle if not c["es_supervisor"]]),
        "cuadrillas": detalle,
        "tecnicos_activos": db.scalar(
            select(func.count()).select_from(Tecnico)
            .where(Tecnico.id_central == id_central, Tecnico.status == "ACTIVO")
        ) or 0,
        "flota_disponible": db.scalar(
            select(func.count()).select_from(Flota)
            .where(Flota.id_central == id_central, Flota.status == "DISPONIBLE")
        ) or 0,
        "herramientas_disponibles": db.scalar(
            select(func.count()).select_from(Herramienta)
            .where(Herramienta.id_central == id_central, Herramienta.estado == "DISPONIBLE")
        ) or 0,
        "sectores_activos": db.scalar(
            select(func.count()).select_from(Sector)
            .where(Sector.id_central == id_central, Sector.activo.is_(True))
        ) or 0,
    }


# --------------------------------------------------------------------------- #
# Reporte de trabajo consolidado
# --------------------------------------------------------------------------- #
def reporte_trabajo(db: Session, id_central: int, periodo: str, fecha: date) -> dict:
    desde, hasta = rango_periodo(periodo, fecha)
    lunes, _sabado = rango_semana(fecha)
    return {
        "periodo": periodo,
        "desde": desde.isoformat(),
        "hasta": hasta.isoformat(),
        "diario": gestion_diaria(db, id_central, fecha),
        "semanal": gestion_semanal(db, id_central, lunes),
        "globales": casos_globales(db, id_central, desde, hasta),
        "reparacion": reparacion(db, id_central),
        "construccion": construccion(db, id_central),
        "cuadrilla": por_cuadrilla(db, id_central, lunes),
        "capacidad": capacidad(db, id_central),
    }

