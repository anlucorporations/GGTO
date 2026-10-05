"""Construcción de la propuesta de despacho diario (RF-08, RF-24, RF-25 / D-66).

Reglas aplicadas (ciclo D-66):

1. **Universo**: casos de la central, no cerrados/cancelados/enrutados, sin
   excluir la cuadrilla 0 salvo que no tengan **cita del día** (un compromiso
   explícito prima). Incluye **casos comunes y especiales** (categorías
   REFERIDO, EMPRESA y GOBIERNO).
2. **Asignación de sectores a cuadrillas por día** (`cuadrilla_sector_dia`): el
   supervisor decide qué sectores atiende cada cuadrilla. Si no hay asignación
   guardada se **propone** una equilibrada por carga de casos.
3. Los casos se reparten **según el sector de cada cuadrilla** (un sector va
   completo a su cuadrilla). Los casos **citados** tienen prioridad: se ordenan
   primero y, si su sector no tiene cuadrilla, se asignan a la menos cargada.
4. Los casos sin sector asignado quedan en `sin_asignar`.
5. La **construcción** va completa a **una sola cuadrilla**.
6. Se verifica que el despacho incluya **≥2 referidos** y **≥1 empresa** (si
   existen en el universo).
7. **Cuadrilla 0 (D-77)**: los casos en GESTIÓN (`en_gestion_supervisor` o
   estado `EN_GESTION`) ya no se descartan: se agrupan aparte y se despachan a
   la cuadrilla del supervisor, que puede publicarlos y enviarlos como
   cualquier otra. El supervisor también puede **asignar y quitar** casos
   (comunes y especiales) a una cuadrilla a mano.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from ..models import (
    Caso,
    CasoEspecial,
    Cuadrilla,
    CuadrillaSectorDia,
    Despacho,
    DespachoCasos,
    Sector,
)

ESTADOS_FUERA = ("CERRADO", "CANCELADO", "ENRUTADO")
CATEGORIAS_ESPECIALES = ("REFERIDO", "EMPRESA", "GOBIERNO")
MIN_REFERIDOS = 2
MIN_EMPRESAS = 1


@dataclass
class CasoAsignado:
    id_caso: int
    id_averia: str
    id_sector: int | None
    sector_nombre: str | None
    tipo_asignacion: str
    orden_visita: int
    direccion: str | None
    telefono: str | None
    nombre_cliente: str | None
    problema_reporte: str | None
    estado_actual: str
    categoria: str
    tipo_caso: str
    es_cita: bool
    especial: bool = False

    def como_dict(self) -> dict:
        return self.__dict__.copy()


@dataclass
class GrupoCuadrilla:
    id_cuadrilla: int
    codigo: str
    nombre: str
    casos: list[CasoAsignado] = field(default_factory=list)
    # D-77: la cuadrilla 0 (supervisor) recibe los casos en GESTIÓN
    es_supervisor: bool = False

    @property
    def total(self) -> int:
        return len(self.casos)


@dataclass
class Propuesta:
    fecha: date
    id_central: int
    grupos: list[GrupoCuadrilla]
    sin_asignar: list[CasoAsignado]
    reglas: dict
    resumen: dict

    def como_dict(self) -> dict:
        return {
            "fecha": self.fecha.isoformat(),
            "id_central": self.id_central,
            "grupos": [
                {
                    "id_cuadrilla": g.id_cuadrilla,
                    "codigo": g.codigo,
                    "nombre": g.nombre,
                    "total": g.total,
                    "es_supervisor": g.es_supervisor,
                    "casos": [c.como_dict() for c in g.casos],
                }
                for g in self.grupos
            ],
            "sin_asignar": [c.como_dict() for c in self.sin_asignar],
            "reglas": self.reglas,
            "resumen": self.resumen,
        }


def _tipo_asignacion(caso: Caso) -> str:
    if caso.tipo_caso == "CONSTRUCCION":
        return "CONSTRUCCION"
    if caso.categoria == "REFERIDO":
        return "REFERIDO"
    if caso.categoria in ("EMPRESA", "GOBIERNO"):
        return "EMPRESA"
    return "REPARACION"


def es_especial(caso: Caso) -> bool:
    return caso.categoria in CATEGORIAS_ESPECIALES


def en_gestion(caso: Caso) -> bool:
    """D-77: el caso pertenece a la gestión del supervisor (cuadrilla 0)."""
    return bool(caso.en_gestion_supervisor) or caso.estado_actual == "EN_GESTION"


def cuadrilla_supervisor(db: Session, id_central: int) -> Cuadrilla | None:
    """Cuadrilla 0: la del supervisor (D-77)."""
    return db.scalar(
        select(Cuadrilla).where(
            Cuadrilla.id_central == id_central,
            Cuadrilla.activa.is_(True),
            Cuadrilla.es_supervisor.is_(True),
        ).order_by(Cuadrilla.codigo).limit(1)
    )


# --------------------------------------------------------------------------- #
# Universo
# --------------------------------------------------------------------------- #
def _filtro_universo(id_central: int, fecha: date, solo_libres: bool):
    """Condiciones del universo de casos despachables.

    `solo_libres` excluye los casos que ya están en cualquier despacho no
    cerrado (comportamiento de la simulación). En modo proceso se incluyen los
    borradores del día, porque se van a reemplazar.
    """
    if solo_libres:
        ocupados = (
            select(DespachoCasos.id_caso)
            .join(Despacho, Despacho.id_despacho == DespachoCasos.id_despacho)
            .where(Despacho.estado != "CERRADO")
            .scalar_subquery()
        )
    else:
        ocupados = (
            select(DespachoCasos.id_caso)
            .join(Despacho, Despacho.id_despacho == DespachoCasos.id_despacho)
            .where(Despacho.estado.in_(("PUBLICADO", "CERRADO")))
            .scalar_subquery()
        )
    return (
        Caso.id_central == id_central,
        Caso.estado_actual.notin_(ESTADOS_FUERA),
        Caso.id_caso.notin_(ocupados),
    )


def seleccionar_casos(db: Session, id_central: int, fecha: date) -> list[Caso]:
    """Universo de casos despachables (sin los ya despachados)."""
    return list(
        db.scalars(
            select(Caso)
            .where(*_filtro_universo(id_central, fecha, solo_libres=True))
            .order_by(Caso.id_sector.nullslast(), Caso.fecha_reporte.nullslast(), Caso.id_caso)
        ).all()
    )


def universo_casos(db: Session, id_central: int, fecha: date) -> list[Caso]:
    """Universo para el formulario de proceso (incluye los borradores del día)."""
    return list(
        db.scalars(
            select(Caso)
            .where(*_filtro_universo(id_central, fecha, solo_libres=False))
            .order_by(Caso.id_sector.nullslast(), Caso.fecha_cita.nullslast(), Caso.id_caso)
        ).all()
    )


def cuadrillas_activas(db: Session, id_central: int) -> list[Cuadrilla]:
    return list(
        db.scalars(
            select(Cuadrilla)
            .where(
                Cuadrilla.id_central == id_central,
                Cuadrilla.activa.is_(True),
                Cuadrilla.es_supervisor.is_(False),
            )
            .order_by(Cuadrilla.codigo)
        ).all()
    )


def nombres_de_sector(db: Session, id_central: int) -> dict[int, str]:
    return {
        s.id_sector: s.nombre
        for s in db.scalars(select(Sector).where(Sector.id_central == id_central)).all()
    }


# --------------------------------------------------------------------------- #
# Asignación diaria de sectores a cuadrillas
# --------------------------------------------------------------------------- #
def asignacion_guardada(db: Session, fecha: date) -> dict[int, int]:
    """`id_sector -> id_cuadrilla` guardado para la fecha (puede estar vacío)."""
    filas = db.scalars(
        select(CuadrillaSectorDia).where(CuadrillaSectorDia.fecha == fecha)
    ).all()
    return {f.id_sector: f.id_cuadrilla for f in filas}


def propuesta_asignacion(
    cuadrillas: list[Cuadrilla], casos: list[Caso]
) -> dict[int, int]:
    """Reparto inicial equilibrado: cada sector se asigna a la cuadrilla menos cargada."""
    por_sector: dict[int, int] = defaultdict(int)
    for caso in casos:
        if caso.id_sector is not None:
            por_sector[caso.id_sector] += 1
    if not cuadrillas:
        return {}
    carga = {c.id_cuadrilla: 0 for c in cuadrillas}
    asignacion: dict[int, int] = {}
    for id_sector, total in sorted(por_sector.items(), key=lambda kv: (-kv[1], kv[0])):
        destino = min(cuadrillas, key=lambda c: (carga[c.id_cuadrilla], c.codigo))
        asignacion[id_sector] = destino.id_cuadrilla
        carga[destino.id_cuadrilla] += total
    return asignacion


def asignacion_efectiva(
    db: Session, id_central: int, fecha: date
) -> tuple[dict[int, int], str]:
    """Asignación del día: la guardada o, si no existe, una propuesta equilibrada."""
    guardada = asignacion_guardada(db, fecha)
    if guardada:
        return guardada, "GUARDADA"
    cuadrillas = cuadrillas_activas(db, id_central)
    casos = universo_casos(db, id_central, fecha)
    return propuesta_asignacion(cuadrillas, casos), "PROPUESTA"


def guardar_asignacion(
    db: Session,
    id_central: int,
    fecha: date,
    asignaciones: list[dict],
    usuario: str | None,
) -> dict[int, int]:
    """Reemplaza la asignación del día. `asignaciones`: [{id_cuadrilla, ids_sector}]."""
    db.execute(delete(CuadrillaSectorDia).where(CuadrillaSectorDia.fecha == fecha))
    vistos: set[int] = set()
    for bloque in asignaciones or []:
        crudo_cuadrilla = bloque.get("id_cuadrilla")
        if crudo_cuadrilla is None:
            continue
        id_cuadrilla = int(crudo_cuadrilla)
        for id_sector in bloque.get("ids_sector") or []:
            id_sector = int(id_sector)
            if id_sector in vistos:
                continue  # un sector solo puede estar en una cuadrilla por día
            vistos.add(id_sector)
            db.add(
                CuadrillaSectorDia(
                    id_central=id_central,
                    fecha=fecha,
                    id_cuadrilla=id_cuadrilla,
                    id_sector=id_sector,
                    usuario=usuario,
                )
            )
    db.flush()
    return asignacion_guardada(db, fecha)


# --------------------------------------------------------------------------- #
# Propuesta de despacho
# --------------------------------------------------------------------------- #
def _envolver(caso: Caso, tipo: str, orden: int, nombres: dict[int, str], fecha: date) -> CasoAsignado:
    return CasoAsignado(
        id_caso=caso.id_caso,
        id_averia=caso.id_averia,
        id_sector=caso.id_sector,
        sector_nombre=(nombres.get(caso.id_sector) if caso.id_sector else None),
        tipo_asignacion=tipo,
        orden_visita=orden,
        direccion=caso.direccion,
        telefono=caso.telefono,
        nombre_cliente=caso.nombre_cliente,
        problema_reporte=caso.problema_reporte,
        estado_actual=caso.estado_actual,
        categoria=caso.categoria,
        tipo_caso=caso.tipo_caso,
        es_cita=bool(caso.fecha_cita and caso.fecha_cita.date() == fecha),
        especial=es_especial(caso),
    )


def construir_propuesta(
    db: Session,
    id_central: int,
    fecha: date,
    asignacion: dict[int, int] | None = None,
    casos: list[Caso] | None = None,
) -> Propuesta:
    """Reparte el universo según la asignación de sectores del día.

    `casos` permite pasar un universo ya calculado (p. ej. el del formulario de
    proceso, que incluye los borradores del día).
    """
    cuadrillas = cuadrillas_activas(db, id_central)
    supervisor = cuadrilla_supervisor(db, id_central)
    if casos is None:
        casos = seleccionar_casos(db, id_central, fecha)
    nombres = nombres_de_sector(db, id_central)
    if asignacion is None:
        asignacion = asignacion_guardada(db, fecha)
        if not asignacion and cuadrillas:
            asignacion = propuesta_asignacion(cuadrillas, casos)

    # D-77: los casos en GESTIÓN no se reparten por sector — se agrupan en la
    # cuadrilla 0 (la del supervisor). Si no hay cuadrilla 0 vuelven al reparto.
    en_gestion_total = [c for c in casos if en_gestion(c)]
    casos = [c for c in casos if not en_gestion(c)]
    supervisor_grupo: GrupoCuadrilla | None = None
    if supervisor is not None and en_gestion_total:
        ordenados = sorted(en_gestion_total, key=lambda c: (c.id_sector or 0, c.id_caso))
        supervisor_grupo = GrupoCuadrilla(
            id_cuadrilla=supervisor.id_cuadrilla,
            codigo=supervisor.codigo,
            nombre=supervisor.nombre,
            es_supervisor=True,
            casos=[_envolver(c, _tipo_asignacion(c), i, nombres, fecha)
                   for i, c in enumerate(ordenados, 1)],
        )
    else:
        casos = casos + en_gestion_total

    comunes = sum(1 for c in casos if not es_especial(c))
    especiales = len(casos) - comunes
    asignados_gestion = supervisor_grupo.total if supervisor_grupo else 0

    if not cuadrillas:
        pendientes = [_envolver(c, _tipo_asignacion(c), i, nombres, fecha)
                      for i, c in enumerate(casos, 1)]
        return Propuesta(
            fecha=fecha, id_central=id_central,
            grupos=[supervisor_grupo] if supervisor_grupo else [],
            sin_asignar=pendientes,
            reglas={"cuadrillas_activas": 0, "motivo": "No hay cuadrillas activas de calle",
                    "gestion_cuadrilla0": asignados_gestion},
            resumen={"total_casos": len(casos) + asignados_gestion, "comunes": comunes,
                     "especiales": especiales, "asignados": asignados_gestion,
                     "sin_asignar": len(pendientes)},
        )

    # --- Reparto por sector según la asignación del día ---
    por_sector: dict[int | None, list[Caso]] = defaultdict(list)
    for caso in casos:
        por_sector[caso.id_sector].append(caso)

    grupos: dict[int, list[CasoAsignado]] = {c.id_cuadrilla: [] for c in cuadrillas}
    por_id = {c.id_cuadrilla: c for c in cuadrillas}
    sin_asignar: list[CasoAsignado] = []
    citados_reasignados = 0

    for id_sector, lista in sorted(
        por_sector.items(), key=lambda kv: (-len(kv[1]), kv[0] is None, kv[0] or 0)
    ):
        id_destino = asignacion.get(id_sector) if id_sector is not None else None
        destino = por_id.get(id_destino) if id_destino is not None else None
        for caso in lista:
            envuelto = _envolver(caso, _tipo_asignacion(caso), 0, nombres, fecha)
            if destino is not None:
                grupos[destino.id_cuadrilla].append(envuelto)
            elif envuelto.es_cita:
                # Prioridad: un citado nunca se queda fuera si hay cuadrillas.
                elegida = min(cuadrillas, key=lambda c: (len(grupos[c.id_cuadrilla]), c.codigo))
                grupos[elegida.id_cuadrilla].append(envuelto)
                citados_reasignados += 1
            else:
                sin_asignar.append(envuelto)

    # --- Regla: toda la CONSTRUCCIÓN a una sola cuadrilla ---
    construcciones = [
        c for lista in grupos.values() for c in lista if c.tipo_asignacion == "CONSTRUCCION"
    ]
    construccion_cuadrilla = None
    if construcciones:
        sectores_construccion = {c.id_sector for c in construcciones if c.id_sector is not None}
        candidatas = []
        for cu in cuadrillas:
            en_sector = sum(
                1 for c in grupos[cu.id_cuadrilla]
                if c.id_sector in sectores_construccion and c.tipo_asignacion != "CONSTRUCCION"
            )
            candidatas.append((en_sector, -len(grupos[cu.id_cuadrilla]), cu))
        destino_cu = max(candidatas, key=lambda t: (t[0], t[1]))[2]
        for cu in cuadrillas:
            if cu.id_cuadrilla == destino_cu.id_cuadrilla:
                continue
            mover = [c for c in grupos[cu.id_cuadrilla] if c.tipo_asignacion == "CONSTRUCCION"]
            for c in mover:
                grupos[cu.id_cuadrilla].remove(c)
                grupos[destino_cu.id_cuadrilla].append(c)
        construccion_cuadrilla = destino_cu.codigo

    # --- Orden de visita: citados primero, luego sector y caso ---
    for cu in cuadrillas:
        grupos[cu.id_cuadrilla].sort(
            key=lambda c: (not c.es_cita, c.id_sector is None, c.id_sector or 0, c.id_caso)
        )
        for i, c in enumerate(grupos[cu.id_cuadrilla], start=1):
            c.orden_visita = i
    sin_asignar.sort(key=lambda c: (not c.es_cita, c.id_caso))
    for i, c in enumerate(sin_asignar, start=1):
        c.orden_visita = i

    resultado = ([supervisor_grupo] if supervisor_grupo else []) + [
        GrupoCuadrilla(id_cuadrilla=cu.id_cuadrilla, codigo=cu.codigo, nombre=cu.nombre,
                       casos=grupos[cu.id_cuadrilla])
        for cu in cuadrillas
    ]
    total_asignados = sum(g.total for g in resultado)
    referidos = sum(1 for g in resultado for c in g.casos if c.tipo_asignacion == "REFERIDO")
    empresas = sum(1 for g in resultado for c in g.casos if c.tipo_asignacion == "EMPRESA")
    citados = sum(1 for g in resultado for c in g.casos if c.es_cita)
    especiales_asignados = sum(1 for g in resultado for c in g.casos if c.especial)
    referidos_disponibles = sum(1 for c in casos if c.categoria == "REFERIDO")
    empresas_disponibles = sum(1 for c in casos if c.categoria in ("EMPRESA", "GOBIERNO"))
    sectores_sin_cuadrilla = sorted({
        c.id_sector for c in sin_asignar if c.id_sector is not None
    })

    return Propuesta(
        fecha=fecha,
        id_central=id_central,
        grupos=resultado,
        sin_asignar=sin_asignar,
        reglas={
            "citados_incluidos": citados,
            "citados_reasignados": citados_reasignados,
            "referidos_asignados": referidos,
            "referidos_disponibles": referidos_disponibles,
            "min_referidos": MIN_REFERIDOS,
            "cumple_min_referidos": referidos >= min(MIN_REFERIDOS, referidos_disponibles),
            "empresas_asignadas": empresas,
            "empresas_disponibles": empresas_disponibles,
            "min_empresas": MIN_EMPRESAS,
            "cumple_min_empresas": empresas >= min(MIN_EMPRESAS, empresas_disponibles),
            "especiales_asignados": especiales_asignados,
            "construccion_cuadrilla": construccion_cuadrilla,
            "construccion_en_una_sola": len({
                g.codigo for g in resultado
                if any(c.tipo_asignacion == "CONSTRUCCION" for c in g.casos)
            }) <= 1,
            "sectores_sin_cuadrilla": sectores_sin_cuadrilla,
            "cuadrillas_activas": len(cuadrillas),
            "gestion_cuadrilla0": asignados_gestion,
        },
        resumen={
            "total_casos": len(casos) + asignados_gestion,
            "comunes": comunes,
            "especiales": especiales,
            "asignados": total_asignados,
            "sin_asignar": len(sin_asignar),
            "por_cuadrilla": {g.codigo: g.total for g in resultado},
        },
    )


def guardar_propuesta(db: Session, propuesta: Propuesta, usuario: str | None) -> list[Despacho]:
    """Persiste la propuesta como despachos en BORRADOR (uno por cuadrilla con casos)."""
    creados: list[Despacho] = []
    for grupo in propuesta.grupos:
        if not grupo.casos:
            continue
        despacho = Despacho(
            id_central=propuesta.id_central,
            fecha=propuesta.fecha,
            id_cuadrilla=grupo.id_cuadrilla,
            estado="BORRADOR",
            generado_auto=True,
            usuario_crea=usuario,
        )
        despacho.casos = [
            DespachoCasos(
                id_caso=c.id_caso,
                id_sector=c.id_sector,
                orden_visita=c.orden_visita,
                tipo_asignacion=c.tipo_asignacion,
                estado="ASIGNADO",
            )
            for c in grupo.casos
        ]
        db.add(despacho)
        creados.append(despacho)
    return creados


# --------------------------------------------------------------------------- #
# Formulario de proceso (UI 6)
# --------------------------------------------------------------------------- #
def proceso(db: Session, id_central: int, fecha: date) -> dict:
    """Universo + sectores + cuadrillas + asignación, para el formulario flotante."""
    cuadrillas = cuadrillas_activas(db, id_central)
    supervisor = cuadrilla_supervisor(db, id_central)
    casos = universo_casos(db, id_central, fecha)
    nombres = nombres_de_sector(db, id_central)
    asignacion, origen = asignacion_efectiva(db, id_central, fecha)
    propuesta = construir_propuesta(db, id_central, fecha, asignacion=asignacion, casos=casos)

    # Sectores con su total de casos (comunes y especiales).
    sectores: dict[int, dict] = {}
    sin_sector = 0
    for caso in casos:
        if caso.id_sector is None:
            sin_sector += 1
            continue
        fila = sectores.setdefault(
            caso.id_sector,
            {"id_sector": caso.id_sector, "nombre": nombres.get(caso.id_sector),
             "total": 0, "especiales": 0, "citados": 0, "id_cuadrilla": asignacion.get(caso.id_sector)},
        )
        fila["total"] += 1
        if es_especial(caso):
            fila["especiales"] += 1
        if caso.fecha_cita and caso.fecha_cita.date() == fecha:
            fila["citados"] += 1

    por_cuadrilla = {g.id_cuadrilla: g.total for g in propuesta.grupos}
    ids_por_cuadrilla: dict[int, list[int]] = {c.id_cuadrilla: [] for c in cuadrillas}
    for id_sector, id_cuadrilla in asignacion.items():
        if id_cuadrilla in ids_por_cuadrilla and id_sector in sectores:
            ids_por_cuadrilla[id_cuadrilla].append(id_sector)

    retorno = {
        "fecha": fecha.isoformat(),
        "id_central": id_central,
        "asignacion_origen": origen,
        "universo": {
            "total": len(casos),
            "comunes": sum(1 for c in casos if not es_especial(c)),
            "especiales": sum(1 for c in casos if es_especial(c)),
            "sin_sector": sin_sector,
            "casos": [
                _envolver(c, _tipo_asignacion(c), i, nombres, fecha).como_dict()
                for i, c in enumerate(casos, start=1)
            ],
        },
        "sectores": sorted(sectores.values(), key=lambda s: (s["nombre"] or "", s["id_sector"])),
        "cuadrillas": (
            ([{
                "id_cuadrilla": supervisor.id_cuadrilla,
                "codigo": supervisor.codigo,
                "nombre": supervisor.nombre,
                "es_supervisor": True,
                "ids_sector": [],
                "total": por_cuadrilla.get(supervisor.id_cuadrilla, 0),
            }] if supervisor else [])
            + [
                {
                    "id_cuadrilla": c.id_cuadrilla,
                    "codigo": c.codigo,
                    "nombre": c.nombre,
                    "es_supervisor": False,
                    "ids_sector": sorted(ids_por_cuadrilla[c.id_cuadrilla]),
                    "total": por_cuadrilla.get(c.id_cuadrilla, 0),
                }
                for c in cuadrillas
            ]
        ),
        "asignacion": [
            {"id_cuadrilla": c.id_cuadrilla, "ids_sector": sorted(ids_por_cuadrilla[c.id_cuadrilla])}
            for c in cuadrillas
        ],
        "grupos": propuesta.como_dict()["grupos"],
        "sin_asignar": propuesta.como_dict()["sin_asignar"],
        "reglas": propuesta.reglas,
        "resumen": propuesta.resumen,
    }
    return retorno


# --------------------------------------------------------------------------- #
# Asignación manual de casos a una cuadrilla (D-77)
# --------------------------------------------------------------------------- #
def _casos_de_especiales(db: Session, ids_caso_especial: list[int]) -> tuple[list[int], list[int]]:
    """Resuelve los casos especiales a su `id_caso` asociado."""
    if not ids_caso_especial:
        return [], []
    filas = db.scalars(
        select(CasoEspecial).where(CasoEspecial.id_caso_especial.in_(ids_caso_especial))
    ).all()
    encontrados = {f.id_caso_especial: f.id_caso for f in filas}
    ids: list[int] = []
    omitidos: list[int] = []
    for id_especial in ids_caso_especial:
        id_caso = encontrados.get(id_especial)
        if id_caso is None:
            omitidos.append(id_especial)
        else:
            ids.append(id_caso)
    return ids, omitidos


def _borrador_de_cuadrilla(
    db: Session, id_central: int, fecha: date, id_cuadrilla: int, usuario: str | None
) -> Despacho:
    """Despacho BORRADOR de esa cuadrilla y fecha (lo crea si no existe)."""
    despacho = db.scalar(
        select(Despacho).where(
            Despacho.id_central == id_central,
            Despacho.fecha == fecha,
            Despacho.id_cuadrilla == id_cuadrilla,
        ).order_by(Despacho.id_despacho.desc())
    )
    if despacho is None:
        despacho = Despacho(
            id_central=id_central, fecha=fecha, id_cuadrilla=id_cuadrilla,
            estado="BORRADOR", generado_auto=False, usuario_crea=usuario,
        )
        db.add(despacho)
        db.flush()
    elif despacho.estado in ("PUBLICADO", "CERRADO"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El despacho de esa cuadrilla ya está publicado o cerrado para esa fecha",
        )
    return despacho


def asignar_casos(
    db: Session,
    id_central: int,
    fecha: date,
    id_cuadrilla: int,
    ids_caso: list[int],
    ids_caso_especial: list[int] | None = None,
    usuario: str | None = None,
) -> dict:
    """D-77: agrega casos (comunes y especiales) al despacho del día de la cuadrilla.

    Si el caso estaba en el borrador de otra cuadrilla del mismo día, se **mueve**.
    Un caso en un despacho ya publicado o cerrado no se toca (se informa en
    `omitidos`). Al asignar a la cuadrilla 0 se marca `en_gestion_supervisor`;
    al asignarlo a una cuadrilla de calle se desmarca.
    """
    cuadrilla = db.get(Cuadrilla, id_cuadrilla)
    if cuadrilla is None or cuadrilla.id_central != id_central:
        raise HTTPException(status_code=404, detail="Cuadrilla no encontrada")

    de_especiales, omitidos_esp = _casos_de_especiales(db, list(ids_caso_especial or []))
    solicitados = list(dict.fromkeys(list(ids_caso) + de_especiales))
    if not solicitados:
        raise HTTPException(status_code=400, detail="No se indicaron casos para asignar")

    destino = _borrador_de_cuadrilla(db, id_central, fecha, id_cuadrilla, usuario)
    en_destino = {
        f.id_caso for f in db.scalars(
            select(DespachoCasos).where(DespachoCasos.id_despacho == destino.id_despacho)
        ).all()
    }
    orden = db.scalar(
        select(func.coalesce(func.max(DespachoCasos.orden_visita), 0)).where(
            DespachoCasos.id_despacho == destino.id_despacho
        )
    ) or 0

    agregados = movidos = 0
    omitidos = list(omitidos_esp)
    for id_caso in solicitados:
        caso = db.get(Caso, id_caso)
        if caso is None or caso.id_central != id_central:
            omitidos.append(id_caso)
            continue
        if id_caso in en_destino:
            omitidos.append(id_caso)
            continue
        # ¿Está en el despacho de otra cuadrilla del mismo día?
        fila_previa = db.scalar(
            select(DespachoCasos)
            .join(Despacho, Despacho.id_despacho == DespachoCasos.id_despacho)
            .where(
                Despacho.id_central == id_central,
                Despacho.fecha == fecha,
                Despacho.id_cuadrilla != id_cuadrilla,
                DespachoCasos.id_caso == id_caso,
            )
        )
        if fila_previa is not None:
            previo = db.get(Despacho, fila_previa.id_despacho)
            if previo is not None and previo.estado in ("PUBLICADO", "CERRADO"):
                omitidos.append(id_caso)
                continue
            db.delete(fila_previa)
            movidos += 1
        else:
            agregados += 1
        orden += 1
        db.add(
            DespachoCasos(
                id_despacho=destino.id_despacho,
                id_caso=caso.id_caso,
                id_sector=caso.id_sector,
                orden_visita=orden,
                tipo_asignacion=_tipo_asignacion(caso),
                estado="ASIGNADO",
            )
        )
        # La cuadrilla 0 marca el caso como gestión del supervisor (y lo desmarca
        # si va a una cuadrilla de calle).
        caso.en_gestion_supervisor = bool(cuadrilla.es_supervisor)
        en_destino.add(id_caso)

    db.commit()
    return {
        "fecha": fecha,
        "id_cuadrilla": cuadrilla.id_cuadrilla,
        "cuadrilla_codigo": cuadrilla.codigo,
        "id_despacho": destino.id_despacho,
        "agregados": agregados,
        "movidos": movidos,
        "omitidos": omitidos,
    }


def quitar_casos(
    db: Session,
    id_central: int,
    fecha: date,
    ids_caso: list[int],
    ids_caso_especial: list[int] | None = None,
) -> dict:
    """D-77: saca los casos de los despachos BORRADOR del día (cualquier cuadrilla).

    Los despachos publicados o cerrados se respetan y los borradores que quedan
    vacíos se eliminan.
    """
    de_especiales, omitidos_esp = _casos_de_especiales(db, list(ids_caso_especial or []))
    solicitados = list(dict.fromkeys(list(ids_caso) + de_especiales))
    if not solicitados:
        raise HTTPException(status_code=400, detail="No se indicaron casos para quitar")

    filas = db.scalars(
        select(DespachoCasos)
        .join(Despacho, Despacho.id_despacho == DespachoCasos.id_despacho)
        .where(
            Despacho.id_central == id_central,
            Despacho.fecha == fecha,
            DespachoCasos.id_caso.in_(solicitados),
        )
    ).all()
    quitados = 0
    omitidos = list(omitidos_esp)
    afectados: set[int] = set()
    for fila in filas:
        despacho = db.get(Despacho, fila.id_despacho)
        if despacho is None or despacho.estado in ("PUBLICADO", "CERRADO"):
            omitidos.append(fila.id_caso)
            continue
        db.delete(fila)
        afectados.add(fila.id_despacho)
        quitados += 1
    presentes = {f.id_caso for f in filas}
    omitidos += [c for c in solicitados if c not in presentes]

    db.flush()
    for id_despacho in afectados:
        quedan = db.scalar(
            select(func.count()).select_from(DespachoCasos).where(
                DespachoCasos.id_despacho == id_despacho
            )
        )
        if not quedan:
            vacio = db.get(Despacho, id_despacho)
            if vacio is not None and vacio.estado == "BORRADOR":
                # En bloque: las filas hijas ya se borraron y el cascade del ORM
                # intentaría eliminarlas otra vez (SAWarning).
                db.execute(delete(Despacho).where(Despacho.id_despacho == id_despacho))
    db.commit()
    return {"fecha": fecha, "quitados": quitados, "omitidos": omitidos}
