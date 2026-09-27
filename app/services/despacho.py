"""Construcción de la propuesta de despacho diario (RF-08, RF-24, RF-25 / brief PROCEDIMIENTO 2).

Reglas aplicadas:
1. Universo: casos de la central, no cerrados/cancelados/enrutados, **excluyendo la cuadrilla 0**
   (RF-25) salvo que tengan **cita del día** (un compromiso explícito prima).
2. Se excluyen los casos ya asignados a un despacho no cerrado.
3. Agrupación por **sector** y reparto *greedy*: cada sector se asigna a la cuadrilla con menor carga.
4. La **construcción** va completa a **una sola cuadrilla**, preferentemente la que ya trabaja en su sector.
5. Se verifica que el despacho incluya **≥2 referidos** y **≥1 empresa** (si existen en el universo).
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..models import Caso, Cuadrilla, Despacho, DespachoCasos, Sector

ESTADOS_FUERA = ("CERRADO", "CANCELADO", "ENRUTADO")
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

    def como_dict(self) -> dict:
        return self.__dict__.copy()


@dataclass
class GrupoCuadrilla:
    id_cuadrilla: int
    codigo: str
    nombre: str
    casos: list[CasoAsignado] = field(default_factory=list)

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


def seleccionar_casos(db: Session, id_central: int, fecha: date) -> list[Caso]:
    """Universo de casos despachables para la fecha (excluye cuadrilla 0 y ya despachados)."""
    ocupados = (
        select(DespachoCasos.id_caso)
        .join(Despacho, Despacho.id_despacho == DespachoCasos.id_despacho)
        .where(Despacho.estado != "CERRADO")
        .scalar_subquery()
    )
    citados_hoy = func.date(Caso.fecha_cita) == fecha
    return list(
        db.scalars(
            select(Caso)
            .where(
                Caso.id_central == id_central,
                Caso.estado_actual.notin_(ESTADOS_FUERA),
                or_(Caso.en_gestion_supervisor.is_(False), citados_hoy),
                Caso.id_caso.notin_(ocupados),
            )
            .order_by(Caso.id_sector.nullslast(), Caso.fecha_reporte.nullslast(), Caso.id_caso)
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


def construir_propuesta(db: Session, id_central: int, fecha: date) -> Propuesta:
    cuadrillas = cuadrillas_activas(db, id_central)
    casos = seleccionar_casos(db, id_central, fecha)
    nombres_sector = {
        s.id_sector: s.nombre for s in db.scalars(select(Sector).where(Sector.id_central == id_central))
    }

    def envolver(caso: Caso, tipo: str, orden: int) -> CasoAsignado:
        return CasoAsignado(
            id_caso=caso.id_caso,
            id_averia=caso.id_averia,
            id_sector=caso.id_sector,
            sector_nombre=(nombres_sector.get(caso.id_sector) if caso.id_sector else None),
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
        )

    if not cuadrillas:
        return Propuesta(
            fecha=fecha, id_central=id_central, grupos=[],
            sin_asignar=[envolver(c, _tipo_asignacion(c), i) for i, c in enumerate(casos, 1)],
            reglas={"cuadrillas_activas": 0, "motivo": "No hay cuadrillas activas de calle"},
            resumen={"total_casos": len(casos), "asignados": 0, "sin_asignar": len(casos)},
        )

    # --- Reparto por sector con balanceo greedy ---
    por_sector: dict[int | None, list[Caso]] = defaultdict(list)
    for caso in casos:
        por_sector[caso.id_sector].append(caso)

    grupos: dict[int, list[CasoAsignado]] = {c.id_cuadrilla: [] for c in cuadrillas}
    carga: dict[int, int] = {c.id_cuadrilla: 0 for c in cuadrillas}
    orden = 0
    for _id_sector, lista in sorted(
        por_sector.items(), key=lambda kv: (-len(kv[1]), kv[0] is None, kv[0] or 0)
    ):
        destino = min(cuadrillas, key=lambda c: (carga[c.id_cuadrilla], c.codigo))
        for caso in lista:
            orden += 1
            grupos[destino.id_cuadrilla].append(envolver(caso, _tipo_asignacion(caso), orden))
        carga[destino.id_cuadrilla] += len(lista)

    # --- Regla: toda la CONSTRUCCIÓN a una sola cuadrilla ---
    construcciones = [
        c for lista in grupos.values() for c in lista if c.tipo_asignacion == "CONSTRUCCION"
    ]
    cuadrilla_construccion = None
    if construcciones:
        sectores_construccion = {c.id_sector for c in construcciones if c.id_sector is not None}
        candidatas = []
        for cu in cuadrillas:
            en_sector = sum(
                1 for c in grupos[cu.id_cuadrilla]
                if c.id_sector in sectores_construccion and c.tipo_asignacion != "CONSTRUCCION"
            )
            candidatas.append((en_sector, -carga[cu.id_cuadrilla], cu))
        cuadrilla_construccion = max(candidatas, key=lambda t: (t[0], t[1]))[2]
        destino_id = cuadrilla_construccion.id_cuadrilla
        for cu in cuadrillas:
            if cu.id_cuadrilla == destino_id:
                continue
            mover = [c for c in grupos[cu.id_cuadrilla] if c.tipo_asignacion == "CONSTRUCCION"]
            for c in mover:
                grupos[cu.id_cuadrilla].remove(c)
                grupos[destino_id].append(c)
            carga[cu.id_cuadrilla] -= len(mover)
            carga[destino_id] += len(mover)

    # --- Renumerar orden de visita por cuadrilla (sector y luego id) ---
    for cu in cuadrillas:
        grupos[cu.id_cuadrilla].sort(
            key=lambda c: (c.id_sector is None, c.id_sector or 0, c.id_caso)
        )
        for i, c in enumerate(grupos[cu.id_cuadrilla], start=1):
            c.orden_visita = i

    resultado = [
        GrupoCuadrilla(id_cuadrilla=cu.id_cuadrilla, codigo=cu.codigo, nombre=cu.nombre,
                       casos=grupos[cu.id_cuadrilla])
        for cu in cuadrillas
    ]
    total_asignados = sum(g.total for g in resultado)
    referidos = sum(1 for g in resultado for c in g.casos if c.tipo_asignacion == "REFERIDO")
    empresas = sum(1 for g in resultado for c in g.casos if c.tipo_asignacion == "EMPRESA")
    citados = sum(1 for g in resultado for c in g.casos if c.es_cita)
    referidos_disponibles = sum(1 for c in casos if c.categoria == "REFERIDO")
    empresas_disponibles = sum(1 for c in casos if c.categoria in ("EMPRESA", "GOBIERNO"))
    construccion_en = [g.codigo for g in resultado if any(
        c.tipo_asignacion == "CONSTRUCCION" for c in g.casos)]

    return Propuesta(
        fecha=fecha,
        id_central=id_central,
        grupos=resultado,
        sin_asignar=[],
        reglas={
            "citados_incluidos": citados,
            "referidos_asignados": referidos,
            "referidos_disponibles": referidos_disponibles,
            "min_referidos": MIN_REFERIDOS,
            "cumple_min_referidos": referidos >= min(MIN_REFERIDOS, referidos_disponibles),
            "empresas_asignadas": empresas,
            "empresas_disponibles": empresas_disponibles,
            "min_empresas": MIN_EMPRESAS,
            "cumple_min_empresas": empresas >= min(MIN_EMPRESAS, empresas_disponibles),
            "construccion_cuadrilla": construccion_en[0] if len(construccion_en) == 1 else None,
            "construccion_en_una_sola": len(construccion_en) <= 1,
            "cuadrillas_activas": len(cuadrillas),
        },
        resumen={
            "total_casos": len(casos),
            "asignados": total_asignados,
            "sin_asignar": len(casos) - total_asignados,
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
