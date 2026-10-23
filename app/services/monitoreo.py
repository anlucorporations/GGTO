"""Cálculo de las métricas de MONITOREO y REPORTES (ver `RepoTecnico/metricas.md`)."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from ..models import (
    Caso,
    CasoEspecial,
    CasoEstadoHist,
    Cita,
    Cuadrilla,
    CuadrillaTecnico,
    Despacho,
    DespachoCasos,
    Flota,
    Herramienta,
    IdentificadorPago,
    Sector,
    Tecnico,
)
from .tiempo import ZONA_OPERATIVA, hoy_operativo  # noqa: F401 - reexportado a las rutas

PENDIENTE_EXCLUIR = ("CERRADO", "CANCELADO")
EMPRESARIAL = ("EMPRESA", "GOBIERNO")
DIAS_SEMANA = 6  # lunes a sábado
TERMINALES = ("CERRADO", "CANCELADO", "ENRUTADO")


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


def _dia(columna):
    """Día operativo de una columna `timestamptz` (America/Caracas · RNF-13).

    Antes eran `func.date(columna)`, que PostgreSQL evalúa en la zona de la
    **sesión** (UTC en Cloud SQL): un caso creado a las 22:00 de Caracas caía en el
    día siguiente y las métricas del día no cuadraban. La conversión se hace en la
    base —que ya trae la base de zonas horarias— y no en Python.
    """
    return func.date(func.timezone(ZONA_OPERATIVA, columna))


def _casos_de_cuadrilla(id_cuadrilla: int):
    """D-72: subconsulta con los ids de los casos despachados a la cuadrilla.

    Se usa para limitar los indicadores de MONITOREO a los datos de la cuadrilla
    del técnico (el rol TECNICO solo ve su cuadrilla; el SUPERVISOR ve lo global).
    """
    return (
        select(DespachoCasos.id_caso)
        .join(Despacho, Despacho.id_despacho == DespachoCasos.id_despacho)
        .where(Despacho.id_cuadrilla == id_cuadrilla)
    )


def _scope_cuadrilla(id_cuadrilla: int | None):
    """Condición (o vacío) para restringir consultas a una cuadrilla (D-72)."""
    return [Caso.id_caso.in_(_casos_de_cuadrilla(id_cuadrilla))] if id_cuadrilla is not None else []


def _resueltos(
    db: Session,
    id_central: int,
    desde: date,
    hasta: date,
    categoria: str | tuple[str, ...] | None,
    id_cuadrilla: int | None = None,
    *,
    tipo_caso: str | None = None,
    excluir_tipos: tuple[str, ...] = (),
) -> int:
    """Casos **distintos** cerrados en el rango, con filtros de categoría/tipo.

    Se cuenta `distinct(Caso.id_caso)` y no las filas del historial: un caso que
    se cerró, reabrió y volvió a cerrar el mismo día sigue siendo **un** caso
    resuelto. Los filtros de tipo permiten separar comunes, referidos y
    construcciones sin dobles conteos.
    """
    condiciones = [
        Caso.id_central == id_central,
        CasoEstadoHist.estado_nuevo == "CERRADO",
        _dia(CasoEstadoHist.fecha_hora).between(desde, hasta),
        *_scope_cuadrilla(id_cuadrilla),
    ]
    if categoria:
        if isinstance(categoria, tuple):
            condiciones.append(Caso.categoria.in_(categoria))
        else:
            condiciones.append(Caso.categoria == categoria)
    if tipo_caso:
        condiciones.append(Caso.tipo_caso == tipo_caso)
    if excluir_tipos:
        condiciones.append(Caso.tipo_caso.notin_(excluir_tipos))
    return db.scalar(
        select(func.count(func.distinct(Caso.id_caso)))
        .select_from(CasoEstadoHist)
        .join(Caso, Caso.id_caso == CasoEstadoHist.id_caso)
        .where(*condiciones)
    ) or 0


def _cambiaron_a(
    db: Session,
    id_central: int,
    estado: str,
    desde: date,
    hasta: date,
    id_cuadrilla: int | None = None,
) -> int:
    return db.scalar(
        select(func.count()).select_from(CasoEstadoHist).join(Caso, Caso.id_caso == CasoEstadoHist.id_caso)
        .where(Caso.id_central == id_central, CasoEstadoHist.estado_nuevo == estado,
               _dia(CasoEstadoHist.fecha_hora).between(desde, hasta),
               *_scope_cuadrilla(id_cuadrilla))
    ) or 0


def _pendientes(db: Session, id_central: int, *extra):
    return _conteo(db, Caso.id_central == id_central, Caso.estado_actual.notin_(PENDIENTE_EXCLUIR), *extra)


# --------------------------------------------------------------------------- #
# Gestión diaria / semanal
# --------------------------------------------------------------------------- #
def gestion_diaria(db: Session, id_central: int, fecha: date,
                   id_cuadrilla: int | None = None) -> dict:
    extra = _scope_cuadrilla(id_cuadrilla)
    citados_cond = [_dia(Cita.fecha_hora) == fecha, Cita.id_caso.is_not(None)]
    if id_cuadrilla is not None:
        citados_cond.append(Cita.id_cuadrilla == id_cuadrilla)
    # Los bloques «comunes» excluyen referidos y construcciones para que las
    # tarjetas no cuenten el mismo caso dos veces. Los referidos son el resultado
    # de la regla REPARACIÓN/REFERIDO y las construcciones se identifican por
    # `tipo_caso`.
    comunes = ("CONSTRUCCION", "REFERIDO")
    return {
        "fecha": fecha.isoformat(),
        "ingresos_nuevos": _conteo(db, Caso.id_central == id_central,
                                   _dia(Caso.creado_en) == fecha, *extra),
        "resueltos_residencial": _resueltos(
            db, id_central, fecha, fecha, "RESIDENCIAL", id_cuadrilla,
            excluir_tipos=comunes,
        ),
        "resueltos_empresarial": _resueltos(
            db, id_central, fecha, fecha, EMPRESARIAL, id_cuadrilla,
            excluir_tipos=comunes,
        ),
        "resueltos_reparaciones_referidas": _resueltos(
            db, id_central, fecha, fecha, None, id_cuadrilla, tipo_caso="REFERIDO"
        ),
        "resueltos_construccion": _resueltos(
            db, id_central, fecha, fecha, None, id_cuadrilla, tipo_caso="CONSTRUCCION"
        ),
        "citados": db.scalar(
            select(func.count(func.distinct(Cita.id_caso))).where(*citados_cond)
        ) or 0,
        "diferidos": _cambiaron_a(db, id_central, "DIFERIDO", fecha, fecha, id_cuadrilla),
        "gestionados": db.scalar(
            select(func.count(func.distinct(DespachoCasos.id_caso)))
            .join(Despacho, Despacho.id_despacho == DespachoCasos.id_despacho)
            .where(Despacho.id_central == id_central, Despacho.fecha == fecha,
                   DespachoCasos.estado == "GESTIONADO",
                   *([Despacho.id_cuadrilla == id_cuadrilla] if id_cuadrilla is not None else []))
        ) or 0,
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
               _dia(CasoEstadoHist.fecha_hora) == dia)
    ) or 0
    return {"fecha": dia.isoformat(), "asignados": asignados, "cerrados": cerrados,
            "gestionados": gestionados}


def gestion_semanal(db: Session, id_central: int, desde: date,
                    id_cuadrilla: int | None = None) -> dict:
    lunes, sabado = rango_semana(desde)
    desp_cond = [Despacho.id_central == id_central]
    if id_cuadrilla is not None:
        desp_cond.append(Despacho.id_cuadrilla == id_cuadrilla)
    dias = []
    for dia in _dias(lunes):
        asignados = db.scalar(
            select(func.count()).select_from(DespachoCasos)
            .join(Despacho, Despacho.id_despacho == DespachoCasos.id_despacho)
            .where(*desp_cond, Despacho.fecha == dia)
        ) or 0
        gestionados = db.scalar(
            select(func.count()).select_from(DespachoCasos)
            .join(Despacho, Despacho.id_despacho == DespachoCasos.id_despacho)
            .where(*desp_cond, Despacho.fecha == dia,
                   DespachoCasos.estado == "GESTIONADO")
        ) or 0
        dias.append({
            "fecha": dia.isoformat(),
            "asignados": asignados,
            "cerrados": _resueltos(db, id_central, dia, dia, None, id_cuadrilla),
            "gestionados": gestionados,
        })
    return {"desde": lunes.isoformat(), "hasta": sabado.isoformat(), "dias": dias}


def gestion_mensual(db: Session, id_central: int, fecha: date,
                    id_cuadrilla: int | None = None) -> dict:
    """Resumen agregado del mes operativo de `fecha` (D-96 / RF-APK-13)."""
    desde, hasta = rango_periodo("mensual", fecha)
    extra = _scope_cuadrilla(id_cuadrilla)
    citados = db.scalar(
        select(func.count(func.distinct(Cita.id_caso)))
        .join(Caso, Caso.id_caso == Cita.id_caso)
        .where(Caso.id_central == id_central, _dia(Cita.fecha_hora).between(desde, hasta),
               *_scope_cuadrilla(id_cuadrilla),
               *([Cita.id_cuadrilla == id_cuadrilla] if id_cuadrilla is not None else []))
    ) or 0
    diferidos = _cambiaron_a(db, id_central, "DIFERIDO", desde, hasta, id_cuadrilla)
    resueltos_empresarial = db.scalar(
        select(func.count()).select_from(CasoEstadoHist)
        .join(Caso, Caso.id_caso == CasoEstadoHist.id_caso)
        .where(
            Caso.id_central == id_central,
            CasoEstadoHist.estado_nuevo == "CERRADO",
            _dia(CasoEstadoHist.fecha_hora).between(desde, hasta),
            Caso.categoria.in_(EMPRESARIAL),
            *_scope_cuadrilla(id_cuadrilla),
        )
    ) or 0
    return {
        "desde": desde.isoformat(),
        "hasta": hasta.isoformat(),
        "ingresos_nuevos": _conteo(
            db, Caso.id_central == id_central, _dia(Caso.creado_en).between(desde, hasta), *extra
        ),
        "resueltos_residencial": _resueltos(
            db, id_central, desde, hasta, "RESIDENCIAL", id_cuadrilla
        ),
        "resueltos_empresarial": resueltos_empresarial,
        "resueltos_referidos": _resueltos(
            db, id_central, desde, hasta, "REFERIDO", id_cuadrilla
        ),
        "citados": citados,
        "diferidos": diferidos,
        "pendientes_total": _pendientes(db, id_central, *extra),
    }


def casos_especiales_monitor(db: Session, id_central: int) -> dict:
    """Conteo de casos especiales por clasificación y estado, sin exponer PII."""
    filas = db.execute(
        select(CasoEspecial.clasificacion, CasoEspecial.estado, func.count())
        .join(Caso, Caso.id_caso == CasoEspecial.id_caso)
        .where(Caso.id_central == id_central)
        .group_by(CasoEspecial.clasificacion, CasoEspecial.estado)
        .order_by(CasoEspecial.clasificacion, CasoEspecial.estado)
    ).all()
    por_clasificacion: dict[str, int] = {}
    por_estado: dict[str, int] = {}
    for clasificacion, estado, cantidad in filas:
        por_clasificacion[clasificacion] = por_clasificacion.get(clasificacion, 0) + cantidad
        por_estado[estado] = por_estado.get(estado, 0) + cantidad
    return {
        "total": sum(por_clasificacion.values()),
        "por_clasificacion": por_clasificacion,
        "por_estado": por_estado,
    }


def casos_globales(db: Session, id_central: int, desde: date, hasta: date,
                   id_cuadrilla: int | None = None) -> dict:
    extra = _scope_cuadrilla(id_cuadrilla)
    pendientes = _pendientes(db, id_central, *extra)
    resueltos = _resueltos(db, id_central, desde, hasta, None, id_cuadrilla)
    # Totales de cartera por tipo (estado actual). El rango solo acota los
    # cerrados, igual que `resueltos`; así «Referidos» y «Construcción» no
    # cambian de significado al mover el filtro de fechas.
    referidos = _conteo(
        db, Caso.id_central == id_central, Caso.tipo_caso == "REFERIDO", *extra
    )
    total_construccion = _conteo(
        db, Caso.id_central == id_central, Caso.tipo_caso == "CONSTRUCCION", *extra
    )
    cerrados_comunes = _resueltos(
        db, id_central, desde, hasta, "RESIDENCIAL", id_cuadrilla,
        excluir_tipos=("CONSTRUCCION", "REFERIDO"),
    )
    por_estado = dict(
        db.execute(
            select(Caso.estado_actual, func.count()).where(Caso.id_central == id_central, *extra)
            .group_by(Caso.estado_actual)
        ).all()
    )
    por_categoria = dict(
        db.execute(
            select(Caso.categoria, func.count()).where(Caso.id_central == id_central, *extra)
            .group_by(Caso.categoria)
        ).all()
    )
    return {"desde": desde.isoformat(), "hasta": hasta.isoformat(), "pendientes": pendientes,
            "resueltos": resueltos, "total": pendientes + resueltos,
            "referidos": referidos, "construccion": total_construccion,
            "cerrados_comunes": cerrados_comunes,
            "por_estado": por_estado, "por_categoria": por_categoria}


def reparacion(db: Session, id_central: int, id_cuadrilla: int | None = None) -> dict:
    extra = _scope_cuadrilla(id_cuadrilla)
    residenciales = _pendientes(db, id_central, Caso.categoria == "RESIDENCIAL",
                                Caso.tipo_caso != "CONSTRUCCION", *extra)
    referidos = _pendientes(db, id_central, Caso.categoria == "REFERIDO",
                            Caso.tipo_caso != "CONSTRUCCION", *extra)
    empresariales = _pendientes(db, id_central, Caso.categoria.in_(EMPRESARIAL),
                                Caso.tipo_caso != "CONSTRUCCION", *extra)
    return {"residenciales_comunes": residenciales, "residenciales_referidos": referidos,
            "empresariales": empresariales, "total": residenciales + referidos + empresariales}


def construccion(db: Session, id_central: int, id_cuadrilla: int | None = None) -> dict:
    extra = _scope_cuadrilla(id_cuadrilla)
    residenciales = _pendientes(db, id_central, Caso.tipo_caso == "CONSTRUCCION",
                                Caso.categoria == "RESIDENCIAL", *extra)
    empresariales = _pendientes(db, id_central, Caso.tipo_caso == "CONSTRUCCION",
                                Caso.categoria.in_(EMPRESARIAL), *extra)
    return {"residenciales": residenciales, "empresariales": empresariales,
            "total": residenciales + empresariales}


def reclasificaciones(db: Session, id_central: int) -> dict:
    """Métricas de la regla REPARACIÓN ⇐ 70* + avería real (RF-49/RF-50/RF-55).

    - `reparaciones_validas`: REPARACIÓN con identificador de pago y avería real.
    - `referidos`: casos `tipo_caso='REFERIDO'` (el destino del incumplimiento).
    - `reclasificadas`: referidos con ficha de especial de actividad REPARACIÓN
      (nacieron como reparación y no acreditaron sus claves).
    - `pendientes_historicos`: REPARACIONES **marcadas** (sin 70* o sin avería real)
      que aún no han tenido su próximo cambio (DEC-IP-3).
    - `referidos_sin_ficha`: referidos sin fila en `caso_especial` (estado
      transitorio entre D-89 y D-90, o escrituras que no pasan por el servicio).
    """
    base = (Caso.id_central == id_central,)
    validas = _conteo(
        db, *base,
        Caso.tipo_caso == "REPARACION",
        Caso.id_pago.isnot(None),
        Caso.id_averia.notlike("REF-%"),
    )
    referidos = _conteo(db, *base, Caso.tipo_caso == "REFERIDO")
    marcadas = db.scalar(
        select(func.count()).select_from(Caso).where(
            *base,
            Caso.tipo_caso == "REPARACION",
            (Caso.id_pago.is_(None)) | (Caso.id_averia.like("REF-%")),
        )
    ) or 0
    en_terminal = db.scalar(
        select(func.count()).select_from(Caso).where(
            *base,
            Caso.tipo_caso == "REPARACION",
            (Caso.id_pago.is_(None)) | (Caso.id_averia.like("REF-%")),
            Caso.estado_actual.in_(TERMINALES),
        )
    ) or 0
    con_ficha = db.scalar(
        select(func.count())
        .select_from(CasoEspecial)
        .where(
            CasoEspecial.tipo_actividad == "REPARACION",
            CasoEspecial.id_caso.in_(
                select(Caso.id_caso).where(*base, Caso.tipo_caso == "REFERIDO")
            ),
        )
    ) or 0
    sin_ficha = db.scalar(
        select(func.count()).select_from(Caso).where(
            *base,
            Caso.tipo_caso == "REFERIDO",
            ~Caso.id_caso.in_(select(CasoEspecial.id_caso).where(
                CasoEspecial.id_caso.isnot(None))),
        )
    ) or 0
    por_clasificacion = {
        fila[0]: fila[1]
        for fila in db.execute(
            select(Caso.categoria, func.count())
            .where(*base, Caso.tipo_caso == "REFERIDO")
            .group_by(Caso.categoria)
        ).all()
    }
    return {
        "reparaciones_validas": validas,
        "referidos": referidos,
        "reclasificadas": con_ficha,
        "pendientes_historicos": int(marcadas),
        "pendientes_historicos_en_terminal": int(en_terminal),
        "referidos_sin_ficha": int(sin_ficha),
        "referidos_por_clasificacion": por_clasificacion,
    }


def identificadores(db: Session, id_central: int, dias: int = 90, limite: int = 10) -> dict:
    """Métricas por **identificador de pago (70\\*)** (RF-54/RF-55).

    El identificador es la clave que enlaza al usuario con la institución y puede
    tener **varios reportes**: estas métricas miran el caso desde ese lado.

    - `con_casos`: identificadores distintos con al menos un caso de la central.
    - `casos_con_identificador` / `casos_sin_identificador`: reparto de los casos.
    - `media_casos` y `max_casos`: reportes por identificador.
    - `reincidentes`: identificadores con **2 o más reportes** dentro de la ventana
      (`pago.reincidencia_dias`, por defecto 90 días · RF-54).
    - `top`: los identificadores con más reportes en la ventana (número, total de
      casos y si es reincidente).
    """
    base = (Caso.id_central == id_central,)
    desde = datetime.now(UTC) - timedelta(days=dias)
    agrupado = (
        select(
            Caso.id_pago.label("id_pago"),
            func.count().label("casos"),
            func.sum(case((Caso.creado_en >= desde, 1), else_=0)).label("en_ventana"),
        )
        .where(*base, Caso.id_pago.isnot(None))
        .group_by(Caso.id_pago)
        .subquery()
    )
    filas = db.execute(
        select(IdentificadorPago.numero, agrupado.c.casos, agrupado.c.en_ventana)
        .join(IdentificadorPago, IdentificadorPago.id_pago == agrupado.c.id_pago)
        .order_by(agrupado.c.en_ventana.desc(), agrupado.c.casos.desc(), IdentificadorPago.numero)
        .limit(limite)
    ).all()
    totales = db.execute(
        select(
            func.count(agrupado.c.id_pago),
            func.coalesce(func.sum(agrupado.c.casos), 0),
            func.coalesce(func.max(agrupado.c.casos), 0),
            func.coalesce(func.sum(case((agrupado.c.en_ventana >= 2, 1), else_=0)), 0),
        )
    ).one()
    con_casos, total_casos, max_casos, reincidentes = (int(valor or 0) for valor in totales)
    return {
        "ventana_dias": dias,
        "con_casos": con_casos,
        "casos_con_identificador": total_casos,
        "casos_sin_identificador": _conteo(db, *base, Caso.id_pago.is_(None)),
        "media_casos": round(total_casos / con_casos, 1) if con_casos else 0.0,
        "max_casos": max_casos,
        "reincidentes": reincidentes,
        "top": [
            {
                "numero": fila[0],
                "casos": int(fila[1]),
                "reportes_ventana": int(fila[2] or 0),
                "reincidente": int(fila[2] or 0) >= 2,
            }
            for fila in filas
        ],
    }


def por_cuadrilla(db: Session, id_central: int, desde: date, dias: int = DIAS_SEMANA,
                  id_cuadrilla: int | None = None) -> dict:
    cond = [Cuadrilla.id_central == id_central, Cuadrilla.es_supervisor.is_(False)]
    if id_cuadrilla is not None:
        cond.append(Cuadrilla.id_cuadrilla == id_cuadrilla)
    cuadrillas = db.scalars(
        select(Cuadrilla).where(*cond).order_by(Cuadrilla.codigo)
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


def capacidad(db: Session, id_central: int, id_cuadrilla: int | None = None) -> dict:
    cond = [Cuadrilla.id_central == id_central, Cuadrilla.activa.is_(True)]
    if id_cuadrilla is not None:
        cond.append(Cuadrilla.id_cuadrilla == id_cuadrilla)
    cuadrillas = db.scalars(
        select(Cuadrilla).where(*cond).order_by(Cuadrilla.codigo)
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
def reporte_trabajo(db: Session, id_central: int, periodo: str, fecha: date,
                    id_cuadrilla: int | None = None) -> dict:
    desde, hasta = rango_periodo(periodo, fecha)
    lunes, _sabado = rango_semana(fecha)
    return {
        "periodo": periodo,
        "desde": desde.isoformat(),
        "hasta": hasta.isoformat(),
        "diario": gestion_diaria(db, id_central, fecha, id_cuadrilla),
        "semanal": gestion_semanal(db, id_central, lunes, id_cuadrilla),
        "globales": casos_globales(db, id_central, desde, hasta, id_cuadrilla),
        "reparacion": reparacion(db, id_central, id_cuadrilla),
        "construccion": construccion(db, id_central, id_cuadrilla),
        "cuadrilla": por_cuadrilla(db, id_central, lunes, DIAS_SEMANA, id_cuadrilla),
        "capacidad": capacidad(db, id_central, id_cuadrilla),
        # D-94: RF-55 pide que el informe también muestre el lado del identificador.
        "reclasificaciones": reclasificaciones(db, id_central),
        "identificadores": identificadores(db, id_central),
    }

