"""Construcción de la propuesta de despacho diario (RF-08, RF-24, RF-25 / D-66).

Reglas aplicadas (ciclo D-66, ampliadas en D-113):

1. **Universo**: casos de la central, no cerrados/cancelados/enrutados, sin
   excluir la cuadrilla 0 salvo que no tengan **cita del día** (un compromiso
   explícito prima). Incluye **casos comunes y especiales** (categorías
   REFERIDO, EMPRESA y GOBIERNO). En el **formulario de proceso** también
   entran los **casos PENDIENTES** que devolvió el cierre de jornada, aunque
   sigan vinculados al despacho ya CERRADO (D-113).
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
8. **Tipos a distribuir (D-113 · D-114)**: el checklist del formulario elige
   qué tipos de caso se reparten —COMUNES, ESPECIALES_REPARACION,
   ESPECIALES_CONSTRUCCION, ESPECIALES_GOBIERNO y MASIVAS—. Por defecto solo
   **Comunes y Especiales Reparación**. Los tipos no marcados quedan fuera de
   la propuesta (y por tanto del despacho).
9. **Especiales separados (D-114)**: el antiguo concepto único «Especiales» se
   separa en **Especiales Reparación**, **Especiales Construcción** y
   **Especiales Gobierno**. Reparación/Construcción se deciden por la
   actividad del caso y Gobierno por su clasificación, así que un especial de
   gobierno pertenece a su actividad **y** a Gobierno (las tres categorías no
   son una partición).
10. **Fallas masivas (D-113 · D-114)**: la cuadrilla de la masiva se puede
    **cambiar** desde el formulario de proceso y, además, cada sector elige con
    una lista desplegable **qué masivas suyas entran** en el despacho. Sus
    casos asociados se despachan a la cuadrilla de la masiva aunque su sector
    esté asignado a otra; las masivas no incluidas quedan fuera del proceso.
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import and_, delete, func, or_, select
from sqlalchemy.orm import Session

from ..models import (
    Caso,
    CasoEspecial,
    Cuadrilla,
    CuadrillaSectorDia,
    Despacho,
    DespachoCasos,
    FallaMasiva,
    FallaMasivaCaso,
    Sector,
)

ESTADOS_FUERA = ("CERRADO", "CANCELADO", "ENRUTADO")
CATEGORIAS_ESPECIALES = ("REFERIDO", "EMPRESA", "GOBIERNO")
MIN_REFERIDOS = 2
MIN_EMPRESAS = 1

#: D-113 · D-114: tipos del checklist «Casos a distribuir».
TIPOS_DISTRIBUCION = (
    "COMUNES",
    "ESPECIALES_REPARACION",
    "ESPECIALES_CONSTRUCCION",
    "MANTENIMIENTO",
    "ESPECIALES_GOBIERNO",
    "MASIVAS",
)
ETIQUETAS_DISTRIBUCION = {
    "COMUNES": "Comunes",
    "ESPECIALES_REPARACION": "Especiales Reparación",
    "ESPECIALES_CONSTRUCCION": "Especiales Construcción",
    "MANTENIMIENTO": "Mantenimiento",
    "ESPECIALES_GOBIERNO": "Especiales Gobierno",
    "MASIVAS": "Masivas",
}
#: D-113 · D-114: selección predeterminada (Comunes, Especiales Reparación y el
#: Mantenimiento de D-161: los casos «JUSTIFICATIVO» reclasificados entran por
#: defecto al despacho, agrupados por sector).
TIPOS_DISTRIBUCION_POR_DEFECTO = ("COMUNES", "ESPECIALES_REPARACION", "MANTENIMIENTO")


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
    #: D-113 · D-114: tipo **principal** del checklist de distribución.
    tipo_distribucion: str = "COMUNES"
    #: D-114: todos los tipos del checklist a los que pertenece (Gobierno suma
    #: a su actividad; el resto tiene uno solo).
    tipos_distribucion: list[str] = field(default_factory=list)
    #: D-77/D-113: el caso va a la cuadrilla 0 (gestión), no a la de su sector.
    en_gestion: bool = False

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
    # D-161: el mantenimiento (casos «JUSTIFICATIVO» de las masivas) es un
    # bloque propio; debe resolverse antes que la categoría REFERIDO, que es la
    # categoría nativa de esos casos.
    if caso.tipo_caso == "MANTENIMIENTO":
        return "MANTENIMIENTO"
    if caso.tipo_caso == "CONSTRUCCION":
        return "CONSTRUCCION"
    if caso.categoria == "REFERIDO":
        return "REFERIDO"
    if caso.categoria in ("EMPRESA", "GOBIERNO"):
        return "EMPRESA"
    # D-113: un caso asociado a una falla masiva se marca como tal para que el
    # despacho lo informe aparte (D-110) y el checklist pueda distribuirlo.
    if caso.es_falla_masiva:
        return "FALLA_MASIVA"
    return "REPARACION"


def tipos_distribucion(caso: Caso) -> tuple[str, ...]:
    """Tipos del checklist a los que pertenece el caso (D-113 · D-114).

    **Especiales Reparación/Construcción** se deciden por la actividad del caso
    (`tipo_caso`) y **Especiales Gobierno** por su clasificación (`categoria`),
    como pidió el usuario: un especial de gobierno pertenece a su actividad
    **y** a Gobierno, de modo que las tres categorías pueden solaparse.
    """
    if caso.categoria == "GOBIERNO":
        actividad = (
            "ESPECIALES_CONSTRUCCION"
            if caso.tipo_caso == "CONSTRUCCION"
            else "ESPECIALES_REPARACION"
        )
        return (actividad, "ESPECIALES_GOBIERNO")
    # D-161: el mantenimiento se reparte por sí mismo (agrupado por sector).
    if caso.tipo_caso == "MANTENIMIENTO":
        return ("MANTENIMIENTO",)
    if caso.tipo_caso == "CONSTRUCCION":
        return ("ESPECIALES_CONSTRUCCION",) if es_especial(caso) else ("COMUNES",)
    if caso.categoria in ("REFERIDO", "EMPRESA"):
        return ("ESPECIALES_REPARACION",)
    if caso.es_falla_masiva:
        return ("MASIVAS",)
    return ("COMUNES",)


def tipo_distribucion(caso: Caso) -> str:
    """Tipo **principal** del checklist (el primero de `tipos_distribucion`)."""
    return tipos_distribucion(caso)[0]


def normalizar_tipos(tipos: Iterable[object] | str | None) -> tuple[str, ...] | None:
    """Valida la selección del checklist (`None` = todos los tipos).

    Acepta la lista del cuerpo JSON o el texto separado por comas de la
    simulación. Un valor desconocido o una selección vacía es un 400: el
    procesamiento nunca deja la jornada sin casos por un error de tecleo.
    """
    if tipos is None:
        return None
    if isinstance(tipos, str):
        valores: list[object] = [t for t in tipos.split(",")]
    else:
        valores = list(tipos)
    limpios: list[str] = []
    for valor in valores:
        clave = str(valor).strip().upper()
        if not clave:
            continue
        if clave not in TIPOS_DISTRIBUCION:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Tipo de caso desconocido: {valor}. "
                    f"Válidos: {', '.join(TIPOS_DISTRIBUCION)}"
                ),
            )
        if clave not in limpios:
            limpios.append(clave)
    if not limpios:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Seleccione al menos un tipo de caso a distribuir",
        )
    return tuple(limpios)


def tipos_disponibles(casos: list[Caso]) -> list[dict]:
    """Checklist de tipos con su total en el universo (D-113 · D-114)."""
    conteo = dict.fromkeys(TIPOS_DISTRIBUCION, 0)
    for caso in casos:
        for clave in tipos_distribucion(caso):
            conteo[clave] += 1
    return [
        {
            "clave": clave,
            "etiqueta": ETIQUETAS_DISTRIBUCION[clave],
            "total": conteo[clave],
            "por_defecto": clave in TIPOS_DISTRIBUCION_POR_DEFECTO,
        }
        for clave in TIPOS_DISTRIBUCION
    ]


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
    cerrado (comportamiento de la simulación).

    En modo proceso (D-113) se incluyen los borradores del día —porque se van a
    reemplazar— y los **casos PENDIENTES que devolvió el cierre de jornada**:
    siguen vinculados al despacho ya CERRADO, pero vuelven a ser despachables.
    Quedan fuera los casos de un despacho **PUBLICADO** (la jornada ya se envió y
    no se reprocesa) y los borradores de **otra** fecha, para no asignarlos dos
    veces.
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
            .where(
                or_(
                    Despacho.estado == "PUBLICADO",
                    and_(Despacho.estado == "BORRADOR", Despacho.fecha != fecha),
                )
            )
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
# Fallas masivas: cuadrilla asignada y casos que arrastra (D-113)
# --------------------------------------------------------------------------- #
def masivas_asignables(db: Session, id_central: int) -> list[FallaMasiva]:
    """Masivas que el formulario de proceso puede reasignar."""
    return list(
        db.scalars(
            select(FallaMasiva)
            .where(
                FallaMasiva.id_central == id_central,
                FallaMasiva.estado.in_(("DETECTADA", "PLANIFICADA")),
            )
            .order_by(FallaMasiva.id_falla.desc())
        ).all()
    )


def casos_por_masiva(db: Session, ids_falla: list[int]) -> dict[int, list[int]]:
    """`id_falla -> [id_caso]` de la asociación explícita (DEC-MA-1)."""
    if not ids_falla:
        return {}
    filas = db.scalars(
        select(FallaMasivaCaso)
        .where(FallaMasivaCaso.id_falla.in_(ids_falla))
        .order_by(FallaMasivaCaso.id_asociacion)
    ).all()
    salida: dict[int, list[int]] = {}
    for fila in filas:
        salida.setdefault(fila.id_falla, []).append(fila.id_caso)
    return salida


def overrides_de_masivas(
    db: Session, id_central: int, incluidas: set[int] | None = None
) -> dict[int, int]:
    """`id_caso -> id_cuadrilla` de la masiva que lo atiende (D-113).

    Un caso asociado a una falla masiva con cuadrilla asignada se despacha a
    esa cuadrilla, **aunque su sector** esté asignado a otra: es la forma de
    «cambiar la asignación de la masiva» desde el formulario de proceso.

    D-114: `incluidas` limita las masivas que el sector marcó en su lista
    desplegable; las no incluidas no fuerzan la cuadrilla (sus casos quedan
    fuera del proceso, ver `excluir_casos_de_masivas`).
    """
    stmt = select(FallaMasiva).where(
        FallaMasiva.id_central == id_central,
        FallaMasiva.estado != "CERRADA",
        FallaMasiva.id_cuadrilla.is_not(None),
    )
    if incluidas is not None:
        if not incluidas:
            return {}
        stmt = stmt.where(FallaMasiva.id_falla.in_(incluidas))
    fallas = db.scalars(stmt).all()
    destinos = {f.id_falla: f.id_cuadrilla for f in fallas if f.id_cuadrilla is not None}
    if not destinos:
        return {}
    vinculos = db.scalars(
        select(FallaMasivaCaso).where(FallaMasivaCaso.id_falla.in_(destinos))
    ).all()
    return {v.id_caso: int(destinos[v.id_falla]) for v in vinculos}


def excluir_casos_de_masivas(
    db: Session, id_central: int, casos: list[Caso], incluidas: set[int]
) -> tuple[list[Caso], list[Caso]]:
    """D-114: separa los casos de las masivas que el sector no incluyó.

    Un caso que pertenece a varias masivas se conserva si **alguna** de ellas
    está incluida; solo se excluye cuando todas sus masivas quedaron fuera.
    Devuelve `(casos_que_quedan, casos_excluidos)`.
    """
    ids_falla = [f.id_falla for f in masivas_asignables(db, id_central)]
    if not ids_falla:
        return casos, []
    fallas_por_caso: dict[int, set[int]] = {}
    for id_falla, ids_caso in casos_por_masiva(db, ids_falla).items():
        for id_caso in ids_caso:
            fallas_por_caso.setdefault(id_caso, set()).add(id_falla)
    quedan: list[Caso] = []
    excluidos: list[Caso] = []
    for caso in casos:
        fallas = fallas_por_caso.get(caso.id_caso)
        if fallas and fallas.isdisjoint(incluidas):
            excluidos.append(caso)
        else:
            quedan.append(caso)
    return quedan, excluidos


def asignar_masivas(
    db: Session, id_central: int, asignaciones: list[dict]
) -> list[dict]:
    """D-113: cambia la cuadrilla que atiende cada falla masiva.

    `asignaciones`: `[{id_falla, id_cuadrilla}]`; `id_cuadrilla` nulo deja la
    masiva «sin cuadrilla». **No hace `commit`**: acompaña al procesamiento.
    """
    cambios: list[dict] = []
    for bloque in asignaciones or []:
        crudo_falla = bloque.get("id_falla")
        if crudo_falla is None:
            continue
        falla = db.get(FallaMasiva, int(crudo_falla))
        if falla is None or falla.id_central != id_central:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Falla masiva {crudo_falla} no encontrada",
            )
        if falla.estado == "CERRADA":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"La falla masiva {falla.id_falla} está cerrada",
            )
        crudo_cuadrilla = bloque.get("id_cuadrilla")
        if crudo_cuadrilla is None:
            falla.id_cuadrilla = None
            cambios.append({
                "id_falla": falla.id_falla,
                "id_cuadrilla": None,
                "cuadrilla_codigo": None,
            })
            continue
        cuadrilla = db.get(Cuadrilla, int(crudo_cuadrilla))
        if cuadrilla is None or cuadrilla.id_central != id_central:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Cuadrilla {crudo_cuadrilla} no encontrada",
            )
        if cuadrilla.es_supervisor:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La cuadrilla 0 (supervisor) no atiende fallas masivas",
            )
        falla.id_cuadrilla = cuadrilla.id_cuadrilla
        cambios.append({
            "id_falla": falla.id_falla,
            "id_cuadrilla": cuadrilla.id_cuadrilla,
            "cuadrilla_codigo": cuadrilla.codigo,
        })
    if cambios:
        db.flush()
    return cambios


# --------------------------------------------------------------------------- #
# Asignación diaria de sectores a cuadrillas
# --------------------------------------------------------------------------- #
def asignacion_guardada(db: Session, fecha: date, id_central: int | None = None) -> dict[int, int]:
    """`id_sector -> id_cuadrilla` guardado para la fecha y central (H-13)."""
    stmt = select(CuadrillaSectorDia).where(CuadrillaSectorDia.fecha == fecha)
    if id_central is not None:
        stmt = stmt.where(CuadrillaSectorDia.id_central == id_central)
    filas = db.scalars(stmt).all()
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
    guardada = asignacion_guardada(db, fecha, id_central=id_central)
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
    db.execute(
        delete(CuadrillaSectorDia).where(
            CuadrillaSectorDia.fecha == fecha,
            CuadrillaSectorDia.id_central == id_central,
        )
    )
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
    return asignacion_guardada(db, fecha, id_central=id_central)


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
        tipo_distribucion=tipo_distribucion(caso),
        tipos_distribucion=list(tipos_distribucion(caso)),
        en_gestion=en_gestion(caso),
    )


def construir_propuesta(
    db: Session,
    id_central: int,
    fecha: date,
    asignacion: dict[int, int] | None = None,
    casos: list[Caso] | None = None,
    tipos: Iterable[object] | str | None = None,
    masivas_incluidas: set[int] | None = None,
    construccion_cuadrilla_id: int | None = None,
) -> Propuesta:
    """Reparte el universo según la asignación de sectores del día.

    D-143: la **construcción** se procesa aparte. Si `construccion_cuadrilla_id`
    llega, **toda** la construcción se asigna a esa cuadrilla (la elige el
    formulario con la tabla de sectores y sus cantidades); si no, se mantiene la
    heurística de D-113 (la cuadrilla con más sectores de construcción).

    `casos` permite pasar un universo ya calculado (p. ej. el del formulario de
    proceso, que incluye los borradores del día). `tipos` es la selección del
    checklist de D-113/D-114; `None` distribuye todos los tipos (compatibilidad).

    `masivas_incluidas` son las fallas masivas que el sector dejó marcadas en su
    lista desplegable (D-114); `None` = todas incluidas (compatibilidad) y un
    conjunto vacío = ninguna masiva entra al despacho.
    """
    cuadrillas = cuadrillas_activas(db, id_central)
    supervisor = cuadrilla_supervisor(db, id_central)
    if casos is None:
        casos = seleccionar_casos(db, id_central, fecha)
    nombres = nombres_de_sector(db, id_central)

    tipos_sel = normalizar_tipos(tipos)
    # D-114: totales del universo completo (Gobierno suma a su actividad).
    por_tipo_universo = dict.fromkeys(TIPOS_DISTRIBUCION, 0)
    for caso in casos:
        for clave in tipos_distribucion(caso):
            por_tipo_universo[clave] += 1

    # D-114: primero se quitan los casos de las masivas no incluidas; después se
    # aplica el checklist de tipos sobre lo que queda.
    excluidos_masiva: list[Caso] = []
    if masivas_incluidas is not None:
        casos, excluidos_masiva = excluir_casos_de_masivas(
            db, id_central, casos, masivas_incluidas
        )

    if tipos_sel is not None:
        seleccion = set(tipos_sel)
        casos_tipados = [
            c for c in casos if set(tipos_distribucion(c)) & seleccion
        ]
        excluidos_por_tipo = {
            clave: sum(
                1
                for c in casos
                if clave in tipos_distribucion(c)
                and not (set(tipos_distribucion(c)) & seleccion)
            )
            for clave in TIPOS_DISTRIBUCION
            if clave not in seleccion
        }
        excluidos = len(casos) - len(casos_tipados)
        casos = casos_tipados
    else:
        excluidos_por_tipo = {}
        excluidos = 0
    distribuibles = len(casos)

    if asignacion is None:
        asignacion = asignacion_guardada(db, fecha, id_central=id_central)
        if not asignacion and cuadrillas:
            asignacion = propuesta_asignacion(cuadrillas, casos)
    # D-113 · D-114: la cuadrilla de la masiva incluida manda sobre el sector.
    overrides = overrides_de_masivas(db, id_central, incluidas=masivas_incluidas)

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
    # D-114: especiales separados por concepto. Gobierno suma a su actividad
    # (reparación o construcción), por eso las tres cifras pueden solaparse.
    especiales_reparacion = sum(
        1 for c in casos if "ESPECIALES_REPARACION" in tipos_distribucion(c)
    )
    especiales_construccion = sum(
        1 for c in casos if "ESPECIALES_CONSTRUCCION" in tipos_distribucion(c)
    )
    especiales_gobierno = sum(
        1 for c in casos if "ESPECIALES_GOBIERNO" in tipos_distribucion(c)
    )
    asignados_gestion = supervisor_grupo.total if supervisor_grupo else 0

    if not cuadrillas:
        pendientes = [_envolver(c, _tipo_asignacion(c), i, nombres, fecha)
                      for i, c in enumerate(casos, 1)]
        return Propuesta(
            fecha=fecha, id_central=id_central,
            grupos=[supervisor_grupo] if supervisor_grupo else [],
            sin_asignar=pendientes,
            reglas={"cuadrillas_activas": 0, "motivo": "No hay cuadrillas activas de calle",
                    "gestion_cuadrilla0": asignados_gestion,
                    "tipos": list(tipos_sel) if tipos_sel else list(TIPOS_DISTRIBUCION),
                    "casos_excluidos_por_tipo": excluidos,
                    "masivas_incluidas": (
                        sorted(masivas_incluidas) if masivas_incluidas is not None else None
                    ),
                    "casos_excluidos_por_masiva": len(excluidos_masiva)},
            resumen={"total_casos": len(casos) + asignados_gestion, "comunes": comunes,
                     "especiales": especiales,
                     "especiales_reparacion": especiales_reparacion,
                     "especiales_construccion": especiales_construccion,
                     "especiales_gobierno": especiales_gobierno,
                     "asignados": asignados_gestion,
                     "sin_asignar": len(pendientes),
                     "por_tipo": por_tipo_universo, "excluidos": excluidos,
                     "excluidos_por_masiva": len(excluidos_masiva)},
        )

    # --- Reparto por sector según la asignación del día ---
    por_sector: dict[int | None, list[Caso]] = defaultdict(list)
    for caso in casos:
        por_sector[caso.id_sector].append(caso)

    grupos: dict[int, list[CasoAsignado]] = {c.id_cuadrilla: [] for c in cuadrillas}
    por_id = {c.id_cuadrilla: c for c in cuadrillas}
    sin_asignar: list[CasoAsignado] = []
    citados_reasignados = 0
    masiva_reasignados = 0

    for id_sector, lista in sorted(
        por_sector.items(), key=lambda kv: (-len(kv[1]), kv[0] is None, kv[0] or 0)
    ):
        id_destino = asignacion.get(id_sector) if id_sector is not None else None
        for caso in lista:
            envuelto = _envolver(caso, _tipo_asignacion(caso), 0, nombres, fecha)
            # D-113: la cuadrilla asignada a la masiva tiene prioridad.
            id_masiva = overrides.get(caso.id_caso)
            destino = por_id.get(id_masiva) if id_masiva is not None else None
            if destino is not None:
                if id_destino != destino.id_cuadrilla:
                    masiva_reasignados += 1
            elif id_destino is not None:
                destino = por_id.get(id_destino)
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
    construccion_id = None
    if construcciones:
        sectores_construccion = {c.id_sector for c in construcciones if c.id_sector is not None}
        # D-143: la cuadrilla elegida en el formulario manda; si no hay (o no es de
        # calle), se usa la heurística de D-113.
        destino_cu = por_id.get(construccion_cuadrilla_id) if construccion_cuadrilla_id else None
        if destino_cu is None:
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
        construccion_id = destino_cu.id_cuadrilla

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
    # D-161: mantenimientos repartidos (agrupados por sector).
    mantenimientos = sum(
        1 for g in resultado for c in g.casos if c.tipo_asignacion == "MANTENIMIENTO"
    )
    citados = sum(1 for g in resultado for c in g.casos if c.es_cita)
    especiales_asignados = sum(1 for g in resultado for c in g.casos if c.especial)
    # D-161: los mantenimientos no son referidos aunque su categoría sea la
    # misma (la categoría es herencia del caso «JUSTIFICATIVO» original).
    referidos_disponibles = sum(
        1 for c in casos
        if c.categoria == "REFERIDO" and c.tipo_caso != "MANTENIMIENTO"
    )
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
            # D-161: el mantenimiento va a la cuadrilla de su sector (agrupado
            # por sector); no hay bloque único como la construcción.
            "mantenimientos_asignados": mantenimientos,
            "construccion_cuadrilla": construccion_cuadrilla,
            "construccion_id_cuadrilla": construccion_id,
            "construccion_total": len(construcciones),
            "construccion_en_una_sola": len({
                g.codigo for g in resultado
                if any(c.tipo_asignacion == "CONSTRUCCION" for c in g.casos)
            }) <= 1,
            "sectores_sin_cuadrilla": sectores_sin_cuadrilla,
            "cuadrillas_activas": len(cuadrillas),
            "gestion_cuadrilla0": asignados_gestion,
            # D-113: checklist aplicado y casos que quedan fuera por su tipo.
            "tipos": list(tipos_sel) if tipos_sel else list(TIPOS_DISTRIBUCION),
            "casos_excluidos_por_tipo": excluidos,
            "excluidos_por_tipo": excluidos_por_tipo,
            "masiva_reasignados": masiva_reasignados,
            # D-114: masivas que cada sector dejó marcadas y casos que quedan
            # fuera del proceso por no estar incluidas.
            "masivas_incluidas": (
                sorted(masivas_incluidas) if masivas_incluidas is not None else None
            ),
            "casos_excluidos_por_masiva": len(excluidos_masiva),
        },
        resumen={
            "total_casos": len(casos) + asignados_gestion,
            "comunes": comunes,
            "especiales": especiales,
            "especiales_reparacion": especiales_reparacion,
            "especiales_construccion": especiales_construccion,
            "especiales_gobierno": especiales_gobierno,
            "asignados": total_asignados,
            "sin_asignar": len(sin_asignar),
            "por_cuadrilla": {g.codigo: g.total for g in resultado},
            "distribuibles": distribuibles,
            "por_tipo": por_tipo_universo,
            "excluidos": excluidos,
            "excluidos_por_masiva": len(excluidos_masiva),
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
    # La propuesta del formulario se calcula con **todos** los tipos (es el
    # universo completo); el checklist de D-113 decide después qué se distribuye.
    propuesta = construir_propuesta(db, id_central, fecha, asignacion=asignacion, casos=casos)

    # Sectores con su total de casos (especiales separados, D-114).
    sectores: dict[int, dict] = {}
    sin_sector = 0
    for caso in casos:
        if caso.id_sector is None:
            sin_sector += 1
            continue
        fila = sectores.setdefault(
            caso.id_sector,
            {
                "id_sector": caso.id_sector,
                "nombre": nombres.get(caso.id_sector),
                "total": 0,
                "especiales": 0,
                "especiales_reparacion": 0,
                "especiales_construccion": 0,
                "especiales_gobierno": 0,
                "citados": 0,
                "id_cuadrilla": asignacion.get(caso.id_sector),
            },
        )
        fila["total"] += 1
        claves = tipos_distribucion(caso)
        if es_especial(caso):
            fila["especiales"] += 1
        if "ESPECIALES_REPARACION" in claves:
            fila["especiales_reparacion"] += 1
        if "ESPECIALES_CONSTRUCCION" in claves:
            fila["especiales_construccion"] += 1
        if "ESPECIALES_GOBIERNO" in claves:
            fila["especiales_gobierno"] += 1
        if caso.fecha_cita and caso.fecha_cita.date() == fecha:
            fila["citados"] += 1

    por_cuadrilla = {g.id_cuadrilla: g.total for g in propuesta.grupos}
    ids_por_cuadrilla: dict[int, list[int]] = {c.id_cuadrilla: [] for c in cuadrillas}
    for id_sector, id_cuadrilla in asignacion.items():
        if id_cuadrilla in ids_por_cuadrilla and id_sector in sectores:
            ids_por_cuadrilla[id_cuadrilla].append(id_sector)

    # D-99 (RF-67/RF-68): el primer procesamiento de la jornada no tiene sectores
    # guardados y el formulario debe pedirlos; si ya hay despachos del día, es un
    # reproceso y la asignación se rehace por sector.
    guardada = asignacion_guardada(db, fecha, id_central)
    despachos_del_dia = db.scalar(
        select(func.count()).select_from(Despacho).where(
            Despacho.id_central == id_central, Despacho.fecha == fecha
        )
    ) or 0
    # D-113 · D-114: masivas activas con su cuadrilla, su sector y sus casos,
    # para poder reasignarlas y para que el sector elija cuáles entran.
    fallas = masivas_asignables(db, id_central)
    vinculadas = casos_por_masiva(db, [f.id_falla for f in fallas])
    ids_asociados = [id_caso for ids in vinculadas.values() for id_caso in ids]
    casos_asociados = (
        {
            c.id_caso: c
            for c in db.scalars(
                select(Caso).where(Caso.id_caso.in_(ids_asociados))
            ).all()
        }
        if ids_asociados
        else {}
    )
    ids_cuadrilla = {c.id_cuadrilla: c for c in cuadrillas}
    if supervisor is not None:
        ids_cuadrilla.setdefault(supervisor.id_cuadrilla, supervisor)
    masivas = []
    for falla in fallas:
        cuadrilla = ids_cuadrilla.get(falla.id_cuadrilla) if falla.id_cuadrilla else None
        ids_caso = vinculadas.get(falla.id_falla, [])
        # D-114: si la masiva no declara sector, se usa el de sus casos para que
        # aparezca en la lista desplegable del sector correcto.
        sector_falla = falla.id_sector
        if sector_falla is None:
            for id_caso in ids_caso:
                caso_asociado = casos_asociados.get(id_caso)
                if caso_asociado is not None and caso_asociado.id_sector is not None:
                    sector_falla = caso_asociado.id_sector
                    break
        masivas.append({
            "id_falla": falla.id_falla,
            "id_cuadrilla": falla.id_cuadrilla,
            "cuadrilla_codigo": cuadrilla.codigo if cuadrilla else None,
            "cuadrilla_nombre": cuadrilla.nombre if cuadrilla else None,
            "estado": falla.estado,
            "descripcion": falla.descripcion,
            "es_activa": falla.estado in ("DETECTADA", "PLANIFICADA"),
            "casos": len(ids_caso),
            "ids_caso": ids_caso,
            "id_sector": sector_falla,
            "sector_nombre": nombres.get(sector_falla) if sector_falla else None,
            # D-114: el formulario arranca con todas las masivas incluidas.
            "incluida": True,
        })

    por_tipo = dict.fromkeys(TIPOS_DISTRIBUCION, 0)
    for caso in casos:
        for clave in tipos_distribucion(caso):
            por_tipo[clave] += 1

    especiales_reparacion = sum(
        1 for c in casos if "ESPECIALES_REPARACION" in tipos_distribucion(c)
    )
    especiales_construccion = sum(
        1 for c in casos if "ESPECIALES_CONSTRUCCION" in tipos_distribucion(c)
    )
    especiales_gobierno = sum(
        1 for c in casos if "ESPECIALES_GOBIERNO" in tipos_distribucion(c)
    )

    # D-143: la construcción se presenta aparte, con sus sectores y cantidades,
    # para asignarla a una sola cuadrilla desde el formulario.
    sectores_construccion: dict[int, dict] = {}
    # El formulario se calcula con **todos** los tipos (el checklist decide después),
    # así que la tabla muestra el universo de construcción completo.
    candidatos_construccion = [
        c for c in casos if _tipo_asignacion(c) == "CONSTRUCCION"
    ]
    for caso in candidatos_construccion:
        if caso.id_sector is None:
            continue
        fila = sectores_construccion.setdefault(
            caso.id_sector,
            {
                "id_sector": caso.id_sector,
                "nombre": nombres.get(caso.id_sector),
                "cantidad": 0,
            },
        )
        fila["cantidad"] += 1
    id_construccion = propuesta.reglas.get("construccion_id_cuadrilla")
    cuadrilla_construccion = ids_cuadrilla.get(id_construccion) if id_construccion else None
    bloque_construccion = {
        "total": propuesta.reglas.get("construccion_total", 0),
        "por_sector": sorted(
            sectores_construccion.values(), key=lambda s: (s["nombre"] or "", s["id_sector"])
        ),
        "id_cuadrilla": id_construccion,
        "cuadrilla_codigo": cuadrilla_construccion.codigo if cuadrilla_construccion else None,
        "cuadrilla_nombre": cuadrilla_construccion.nombre if cuadrilla_construccion else None,
        "automatica": True,
    }

    retorno = {
        "fecha": fecha.isoformat(),
        "id_central": id_central,
        "asignacion_origen": origen,
        #: True = primer procesamiento de la jornada (hay que asignar los sectores).
        "primera_vez": not guardada,
        #: True = la jornada ya tiene despachos (el procesamiento es un reproceso).
        "reproceso": bool(despachos_del_dia),
        #: D-113: checklist de tipos a distribuir, con su total en el universo.
        "tipos": tipos_disponibles(casos),
        "masivas": masivas,
        "universo": {
            "total": len(casos),
            "comunes": sum(1 for c in casos if not es_especial(c)),
            "especiales": sum(1 for c in casos if es_especial(c)),
            # D-114: los especiales separados en sus tres conceptos.
            "especiales_reparacion": especiales_reparacion,
            "especiales_construccion": especiales_construccion,
            "especiales_gobierno": especiales_gobierno,
            "sin_sector": sin_sector,
            "por_tipo": por_tipo,
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
        "construccion": bloque_construccion,
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
