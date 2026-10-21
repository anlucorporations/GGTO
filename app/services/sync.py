"""Servicio de sincronización móvil (D-73).

Resuelve la cuadrilla activa del técnico, arma la carga diferencial de DESCARGA
y aplica el batch de actividades/estados de CARGA. Reutiliza helpers existentes
de `routes_casos` para no duplicar reglas de estado ni bitácora.
"""

from __future__ import annotations

import logging
from datetime import UTC, date, datetime, timedelta
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import (
    Actividad,
    Caso,
    CatalogoMetodo,
    Causa,
    Cuadrilla,
    CuadrillaSectorDia,
    CuadrillaTecnico,
    Despacho,
    DespachoCasos,
    Evidencia,
    FallaMasiva,
    OrdenMaterial,
    Sector,
    SyncCheck,
    SyncLog,
    Usuario,
)
from . import masivas as svc_masivas
from . import resolucion as svc_resolucion
from .tiempo import hoy_operativo

logger = logging.getLogger(__name__)

#: Estados que ya **no** son trabajo de la cuadrilla: cerrado, cancelado o
#: enrutado a otra instancia. Un caso recién despachado nace `NUEVO` (el despacho
#: marca `despacho_caso.estado = ASIGNADO`, no el caso), así que excluir `NUEVO`
#: dejaría al técnico sin nada que descargar.
ESTADOS_TERMINALES = ("CERRADO", "CANCELADO", "ENRUTADO")

#: Estados de un despacho que **son la jornada** de la cuadrilla para su APK.
#:
#: D-119: `BORRADOR` **sí** cuenta. El supervisor ya procesó el despacho y esos
#: casos son el trabajo real del técnico; excluirlo hacía que `ids_del_dia`
#: viajara vacío y que la purga del dispositivo borrara en la misma descarga los
#: casos que acababa de recibir (el técnico sincronizaba y no veía nada).
#: La decisión de D-104/DEC-104-3 («un borrador no dispara la purga») queda
#: cubierta de otra forma: la APK conserva lo vigente y lo descargado
#: (`ids_vigentes` + `ids_del_dia`) y solo descarta lo que ya no es suyo.
ESTADOS_JORNADA_DIA = ("BORRADOR", "PUBLICADO", "CERRADO")

#: Motivos de una DESCARGA vacía (D-83). Antes, los cuatro casos devolvían
#: `casos: []` y la APK los anunciaba igual («No hay casos nuevos ni cambios»),
#: de modo que un técnico sin cuadrilla, uno en la cuadrilla de gestión
#: (C-00) o una cuadrilla sin despacho parecían «todo sincronizado».
MOTIVO_OK = "OK"
MOTIVO_SIN_TECNICO = "SIN_TECNICO"
MOTIVO_SIN_CUADRILLA = "SIN_CUADRILLA"
MOTIVO_CUADRILLA_GESTION = "CUADRILLA_GESTION"
MOTIVO_SIN_DESPACHO = "SIN_DESPACHO"
MOTIVO_SIN_PENDIENTES = "SIN_PENDIENTES"
MOTIVO_SIN_CAMBIOS = "SIN_CAMBIOS"

#: Tipos admitidos por el CHECK de `actividad.tipo` (ver `db/schema.sql`).
#: La APK envía «ENRUTADO»; en la tabla se guarda «ENRUTE».
TIPOS_DB = {
    "CONTACTO": "CONTACTO",
    "CIERRE": "CIERRE",
    "ENRUTE": "ENRUTE",
    "ENRUTADO": "ENRUTE",
    "DIFERIDO": "DIFERIDO",
    "INCIDENTE": "INCIDENTE",
    "FALLA_MASIVA": "FALLA_MASIVA",
}

#: `actividad.resultado` solo admite nombres de estado. El resultado se deriva del
#: tipo cuando el cliente envía valores de campo («EXITOSO», «NO_ATIENDE»…).
RESULTADO_POR_TIPO = {
    "CONTACTO": "CONTACTADO",
    "CIERRE": "CERRADO",
    "ENRUTE": "ENRUTADO",
    "DIFERIDO": "DIFERIDO",
}
RESULTADOS_VALIDOS = frozenset(RESULTADO_POR_TIPO.values())


def _cuadrilla_activa(db: Session, usuario: Usuario) -> Cuadrilla | None:
    """Cuadrilla vigente del técnico vinculado a la cuenta (si existe).

    D-83: si el técnico tiene **varias** cuadrillas vigentes se prefiere, en este
    orden: la pertenencia **abierta** (`hasta` nula, que es la que la web muestra
    como activa) sobre la que termina hoy, una cuadrilla de **campo** sobre la de
    gestión (`es_supervisor`), y la asignación más reciente. Así, mover a un
    técnico de C-00 a una cuadrilla de campo surte efecto el mismo día.
    """
    if usuario.id_tecnico is None:
        return None
    hoy = hoy_operativo()
    return db.scalars(
        select(Cuadrilla)
        .join(CuadrillaTecnico, CuadrillaTecnico.id_cuadrilla == Cuadrilla.id_cuadrilla)
        .where(
            CuadrillaTecnico.id_tecnico == usuario.id_tecnico,
            CuadrillaTecnico.desde <= hoy,
            (CuadrillaTecnico.hasta.is_(None)) | (CuadrillaTecnico.hasta >= hoy),
        )
        .order_by(
            CuadrillaTecnico.hasta.is_(None).desc(),
            Cuadrilla.es_supervisor.asc(),
            CuadrillaTecnico.desde.desc(),
            Cuadrilla.id_cuadrilla.desc(),
        )
        .limit(1)
    ).first()


def resolver_cuadrilla(db: Session, usuario: Usuario) -> dict[str, Any]:
    """Payload para `GET /sync/cuadrilla`."""
    rol = usuario.rol.codigo if usuario.rol else ""
    if rol in {"ADMIN", "SUPERVISOR", "SUPER"}:
        # Pueden ver cualquier cuadrilla; por defecto devolvemos la propia si la tienen.
        c = _cuadrilla_activa(db, usuario)
        if c is None:
            return {"id_cuadrilla": None}
        return {
            "id_cuadrilla": c.id_cuadrilla,
            "codigo": c.codigo,
            "nombre": c.nombre,
            "desde": None,
            "es_supervisor": c.es_supervisor,
        }
    c = _cuadrilla_activa(db, usuario)
    if c is None:
        return {"id_cuadrilla": None}
    ct = db.scalar(
        select(CuadrillaTecnico)
        .where(
            CuadrillaTecnico.id_cuadrilla == c.id_cuadrilla,
            CuadrillaTecnico.id_tecnico == usuario.id_tecnico,
            CuadrillaTecnico.hasta.is_(None),
        )
        .limit(1)
    )
    return {
        "id_cuadrilla": c.id_cuadrilla,
        "codigo": c.codigo,
        "nombre": c.nombre,
        "desde": ct.desde if ct else None,
        "es_supervisor": c.es_supervisor,
    }


#: Días hacia atrás que se acepta el trabajo de un caso que **estuvo** en la
#: cuadrilla, aunque el supervisor lo haya reasignado a mitad de jornada (D-123).
#: `despacho.fecha` es una fecha (no tiene hora), así que 1 día cubre «hoy y ayer».
DIAS_TRABAJO_RECIENTE = 1


def _casos_recientes_de_cuadrilla(db: Session, id_cuadrilla: int, desde: date) -> list[int]:
    """Casos que **estuvieron** en la cuadrilla desde `desde` (D-123 · H-06).

    Es el histórico de `despacho_caso` en los despachos de esa cuadrilla, sin
    mirar si el último despacho es suyo: el trabajo que el técnico ya había
    recibido no se le rechaza porque el caso cambie de manos.
    """
    return list(
        db.scalars(
            select(DespachoCasos.id_caso)
            .join(Despacho, Despacho.id_despacho == DespachoCasos.id_despacho)
            .where(
                Despacho.id_cuadrilla == id_cuadrilla,
                Despacho.fecha >= desde,
            )
            .distinct()
        ).all()
    )


def casos_permitidos(db: Session, usuario: Usuario) -> set[int] | None:
    """Casos que el usuario puede **gestionar por la vía de campo** (D-123).

    - `None` para los roles de gestión (ADMIN, SUPERVISOR, SUPER): sin restricción.
    - Para un TÉCNICO: los de su cuadrilla vigente **más** los que estuvieron en
      ella en `DIAS_TRABAJO_RECIENTE` (si el caso se reasignó a mitad de jornada,
      el trabajo ya hecho se sigue pudiendo subir).
    - Sin cuadrilla vigente: conjunto **vacío** (fail-closed, H-02).

    Lo usan la carga de la APK (`aplicar_carga`) y los endpoints de resolución de
    campo, para que **un solo criterio** gobierne las dos vías.
    """
    rol = usuario.rol.codigo if usuario.rol else ""
    if rol in {"ADMIN", "SUPERVISOR", "SUPER"}:
        return None
    c = _cuadrilla_activa(db, usuario)
    if c is None:
        return set()
    ids = set(_casos_ids_de_cuadrilla(db, c.id_cuadrilla))
    ids |= set(
        _casos_recientes_de_cuadrilla(
            db, c.id_cuadrilla, hoy_operativo() - timedelta(days=DIAS_TRABAJO_RECIENTE)
        )
    )
    return ids


def _casos_ids_de_cuadrilla(db: Session, id_cuadrilla: int) -> list[int]:
    """IDs de casos cuyo **último despacho** pertenece a la cuadrilla dada.

    Se toma el despacho más reciente (`fecha` y `id_despacho` descendentes): un
    caso reasignado a otra cuadrilla deja de pertenecer a la anterior, con el
    mismo criterio que el filtro «Cuadrilla» de CASOS (D-72). Así el técnico no
    descarga trabajo que ya pasó a manos de otra cuadrilla.
    """
    rn = (
        func.row_number()
        .over(
            partition_by=DespachoCasos.id_caso,
            order_by=(Despacho.fecha.desc(), Despacho.id_despacho.desc()),
        )
        .label("rn")
    )
    por_caso = (
        select(
            DespachoCasos.id_caso.label("id_caso"),
            Despacho.id_cuadrilla.label("id_cuadrilla"),
            rn,
        )
        .join(Despacho, Despacho.id_despacho == DespachoCasos.id_despacho)
        .subquery()
    )
    filas: list[int] = list(
        db.scalars(
            select(por_caso.c.id_caso).where(
                por_caso.c.id_cuadrilla == id_cuadrilla, por_caso.c.rn == 1
            )
        ).all()
    )
    return filas


def _despacho_del_dia(db: Session, id_cuadrilla: int, dia: date) -> Despacho | None:
    """Despacho **de hoy** de la cuadrilla, si existe (D-104/D-105/D-119).

    Identifica la jornada cuyos casos la APK conserva siempre (`ids_del_dia`).

    D-119: cuentan los despachos en estado **BORRADOR**, **PUBLICADO** o
    **CERRADO**. Mientras solo contaban los publicados, un despacho recién
    procesado por el supervisor (BORRADOR, el estado normal antes de publicar)
    hacía que `ids_del_dia` viajara vacío: la APK descargaba los casos y la purga
    los borraba en la misma sincronización, así que el técnico no veía nada.
    """
    return db.scalars(
        select(Despacho)
        .where(
            Despacho.id_cuadrilla == id_cuadrilla,
            Despacho.fecha == dia,
            Despacho.estado.in_(ESTADOS_JORNADA_DIA),
        )
        .order_by(Despacho.id_despacho.desc())
        .limit(1)
    ).first()


def _casos_del_dia(db: Session, id_cuadrilla: int, dia: date) -> list[int]:
    """IDs de los casos cuyo **último despacho es el de hoy** de esta cuadrilla.

    Se aplica el mismo criterio que `_casos_ids_de_cuadrilla` (último despacho por
    caso, `fecha` e `id_despacho` descendentes): un caso reasignado hoy a otra
    cuadrilla no cuenta como del día para la anterior.
    """
    rn = (
        func.row_number()
        .over(
            partition_by=DespachoCasos.id_caso,
            order_by=(Despacho.fecha.desc(), Despacho.id_despacho.desc()),
        )
        .label("rn")
    )
    por_caso = (
        select(
            DespachoCasos.id_caso.label("id_caso"),
            Despacho.id_cuadrilla.label("id_cuadrilla"),
            Despacho.fecha.label("fecha"),
            rn,
        )
        .join(Despacho, Despacho.id_despacho == DespachoCasos.id_despacho)
        .subquery()
    )
    return list(
        db.scalars(
            select(por_caso.c.id_caso).where(
                por_caso.c.id_cuadrilla == id_cuadrilla,
                por_caso.c.fecha == dia,
                por_caso.c.rn == 1,
            )
        ).all()
    )


def _caso_sync(caso: Caso, sector_nombre: str | None, dc: DespachoCasos | None) -> dict[str, Any]:    return {
        "id_caso": caso.id_caso,
        "id_averia": caso.id_averia,
        "estado_actual": caso.estado_actual,
        "tipo_caso": caso.tipo_caso,
        "categoria": caso.categoria,
        "sector_nombre": sector_nombre,
        "direccion": caso.direccion,
        "telefono": caso.telefono,
        # D-96: el teléfono para **contactar** al cliente es `contacto_cliente`;
        # `telefono` es el identificador de pago (70*) y no sirve para llamar.
        "contacto_cliente": caso.contacto_cliente,
        "persona_reporta": caso.persona_reporta,
        "nombre_cliente": caso.nombre_cliente,
        "problema_reporte": caso.problema_reporte,
        "informacion": caso.informacion,
        "fecha_cita": caso.fecha_cita,
        "actualizado_en": caso.actualizado_en,
        "orden_visita": dc.orden_visita if dc else None,
        "tipo_asignacion": dc.tipo_asignacion if dc else None,
        "observacion_despacho": dc.observacion if dc else None,
        # D-99: datos técnicos y RUTA. Sin ellos el bloque «Técnica» de la ficha de
        # la APK nunca se pintaba tras una descarga diferencial (los campos estaban
        # vacíos y la ficha oculta las filas vacías). `extra` es la columna del
        # archivo de ingesta donde viaja la RUTA.
        "olt": caso.olt,
        "plan": caso.plan,
        "slot": caso.slot,
        "puerto": caso.puerto,
        "fat": caso.fat,
        "extra": caso.extra,
        "serial": caso.serial,
        "tipo_servicio": caso.tipo_servicio,
        "area_trabajo": caso.area_trabajo,
        "nombre_central": caso.nombre_central,
        "ultimo_comentario": caso.ultimo_comentario,
        "fecha_reporte": caso.fecha_reporte,
        "es_falla_masiva": caso.es_falla_masiva,
    }


def _info_cuadrilla(c: Cuadrilla | None) -> dict[str, Any] | None:
    """Cuadrilla que el servidor resolvió para la sesión (D-83)."""
    if c is None:
        return None
    return {
        "id_cuadrilla": c.id_cuadrilla,
        "codigo": c.codigo,
        "nombre": c.nombre,
        "es_supervisor": c.es_supervisor,
    }


def _masivas_de_cuadrilla(db: Session, c: Cuadrilla) -> list[dict[str, Any]]:
    """Masivas activas que atañen a la cuadrilla (D-99 · RF-72).

    Son las asignadas a la cuadrilla y las de los sectores que cubre. Cada una
    viaja con sus **CASOS ASOCIADOS**, los datos técnicos y la **RUTA**, para que
    la ficha MASIVA de la APK funcione sin conexión.
    """
    sectores = set(db.scalars(
        select(CuadrillaSectorDia.id_sector).where(
            CuadrillaSectorDia.id_cuadrilla == c.id_cuadrilla
        )
    ).all())
    fallas = db.scalars(
        select(FallaMasiva)
        .where(
            FallaMasiva.id_central == c.id_central,
            FallaMasiva.estado.in_(("DETECTADA", "PLANIFICADA")),
        )
        .order_by(FallaMasiva.id_falla.desc())
    ).all()
    nombres_sector = {s.id_sector: s.nombre for s in db.scalars(select(Sector)).all()}
    salida: list[dict[str, Any]] = []
    for falla in fallas:
        if falla.id_cuadrilla != c.id_cuadrilla and falla.id_sector not in sectores:
            continue
        casos = svc_masivas.casos_asociados(db, falla)
        ordenes = [
            {"id_orden": o.id_orden, "estado": o.estado, "observacion": o.observacion,
             "fecha": o.fecha}
            for o in db.scalars(
                select(OrdenMaterial)
                .where(OrdenMaterial.id_falla == falla.id_falla)
                .order_by(OrdenMaterial.id_orden.desc())
            ).all()
        ]
        salida.append({
            "id_falla": falla.id_falla,
            "descripcion": falla.descripcion,
            "estado": falla.estado,
            "origen": falla.origen,
            "clave_concentracion": falla.clave_concentracion,
            "id_sector": falla.id_sector,
            "sector_nombre": nombres_sector.get(falla.id_sector) if falla.id_sector else None,
            "id_cuadrilla": falla.id_cuadrilla,
            "odn": falla.odn,
            "olt": falla.olt,
            "slot": falla.slot,
            "puerto": falla.puerto,
            "fat": falla.fat,
            "direccion": falla.direccion,
            "latitud": float(falla.latitud) if falla.latitud is not None else None,
            "longitud": float(falla.longitud) if falla.longitud is not None else None,
            "planificacion": falla.planificacion,
            "reporte_simple": falla.reporte_simple,
            "planificada_en": falla.planificada_en,
            "fecha_deteccion": falla.fecha_deteccion,
            "evidencias": [s.strip() for s in (falla.evidencias or "").split(",") if s.strip()],
            "actualizado_en": falla.actualizado_en,
            "casos_asociados": len(casos),
            "ordenes": ordenes,
            "casos": [caso.model_dump() for caso in casos],
        })
    return salida


def _respuesta(
    catalogos: dict[str, Any],
    casos: list[dict[str, Any]],
    motivo: str,
    mensaje: str,
    cuadrilla: Cuadrilla | None = None,
    casos_cuadrilla: int = 0,
    masivas: list[dict[str, Any]] | None = None,
    despacho_del_dia: Despacho | None = None,
    ids_del_dia: list[int] | None = None,
    ids_vigentes: list[int] | None = None,
) -> dict[str, Any]:
    """Payload de DESCARGA con el motivo explícito (D-83).

    `motivo` es estable para la máquina y `mensaje` va listo para mostrar: así la
    APK explica por qué no hay casos en vez de decir siempre «no hay casos
    nuevos» (que era falso cuando el técnico no tenía cuadrilla, estaba en la de
    gestión o su cuadrilla no tenía despacho).

    D-99: `masivas` viaja **siempre**, aunque no haya casos nuevos, porque el
    bloque MASIVA de la APK es fijo y debe reflejar el estado vigente.

    D-104: `despacho_del_dia` (**null** si la cuadrilla no tiene despacho hoy) e
    `ids_del_dia` (los casos del despacho de hoy) permiten a la APK verificar que
    hay jornada del día y, solo entonces, borrar los casos no atendidos que
    arrastra de despachos anteriores.

    D-119: `ids_vigentes` es **todo** el trabajo vigente de la cuadrilla (los
    casos que el servidor le reconoce ahora, estén o no en el despacho de hoy).
    La purga del dispositivo conserva esos ids además de `ids_del_dia`, de modo
    que una descarga nunca puede borrar lo que el servidor acaba de enviar.
    """
    return {
        "server_ts": datetime.now(UTC),
        "casos": casos,
        "catalogos": catalogos,
        "motivo": motivo,
        "mensaje": mensaje,
        "cuadrilla": _info_cuadrilla(cuadrilla),
        "casos_cuadrilla": casos_cuadrilla,
        "masivas": masivas or [],
        "despacho_del_dia": (
            {"id_despacho": despacho_del_dia.id_despacho, "fecha": despacho_del_dia.fecha}
            if despacho_del_dia is not None
            else None
        ),
        "ids_del_dia": ids_del_dia or [],
        "ids_vigentes": ids_vigentes or [],
        # D-140 · H-23: una cuadrilla de gestión no purga en el dispositivo,
        # tenga o no casos (antes la salvaguarda solo actuaba si estaba vacía).
        "purga_permitida": True if cuadrilla is None else not cuadrilla.es_supervisor,
    }


def construir_descarga(
    db: Session,
    usuario: Usuario,
    desde: datetime | None = None,
    ids_conocidos: set[int] | None = None,
) -> dict[str, Any]:
    """Arma el payload de DESCARGA diferencial.

    - Con `ids_conocidos` (lo que el dispositivo declara tener) se envía **lo que
      falta en local** y lo que cambió desde `desde`. Un caso desconocido viaja
      siempre (D-105): el diferencial no puede dejar trabajo inaccesible.
    - Sin `ids_conocidos` (modo «solo `desde`») se envía lo modificado después de
      la marca, o todo si no hay marca.
    - D-83: siempre acompaña `motivo`/`mensaje`/`cuadrilla` para que la APK
      distinga «no hay nada despachado» de «ya tiene todo».
    """
    rol = usuario.rol.codigo if usuario.rol else ""
    if rol not in {"ADMIN", "SUPERVISOR", "SUPER"} and rol != "TECNICO":
        raise HTTPException(status_code=403, detail="Rol sin acceso a sincronización")

    # Los catálogos se devuelven SIEMPRE (son independientes de la cuadrilla):
    # la APK los necesita para operar offline aunque hoy no tenga casos asignados.
    catalogos = _catalogos(db)

    c = _cuadrilla_activa(db, usuario)
    if c is None:
        if usuario.id_tecnico is None:
            return _respuesta(
                catalogos, [], MOTIVO_SIN_TECNICO,
                "Su cuenta no está vinculada a un técnico: pida a su supervisor "
                "que la registre en el sistema.",
            )
        return _respuesta(
            catalogos, [], MOTIVO_SIN_CUADRILLA,
            "No tiene una cuadrilla vigente: pida a su supervisor que lo asigne "
            "a una cuadrilla.",
        )

    ids_cuadrilla = _casos_ids_de_cuadrilla(db, c.id_cuadrilla)
    # D-104: jornada del día de la cuadrilla. Si no la hay, la APK no borra nada.
    dia = hoy_operativo()
    despacho_hoy = _despacho_del_dia(db, c.id_cuadrilla, dia)
    ids_dia = _casos_del_dia(db, c.id_cuadrilla, dia) if despacho_hoy else []
    # D-99: las masivas se calculan una vez y acompañan a todas las respuestas.
    masivas = _masivas_de_cuadrilla(db, c)
    if not ids_cuadrilla:
        if c.es_supervisor:
            return _respuesta(
                catalogos, [], MOTIVO_CUADRILLA_GESTION,
                f"Su cuadrilla {c.codigo} es de gestión (supervisor) y no recibe "
                "trabajo de campo: pida a su supervisor una cuadrilla de campo.",
                c, masivas=masivas,
            )
        return _respuesta(
            catalogos, [], MOTIVO_SIN_DESPACHO,
            f"Su cuadrilla {c.codigo} no tiene casos despachados todavía.", c,
            masivas=masivas, despacho_del_dia=despacho_hoy, ids_del_dia=ids_dia,
        )

    stmt = (
        select(Caso)
        .where(
            Caso.id_caso.in_(ids_cuadrilla),
            Caso.estado_actual.notin_(ESTADOS_TERMINALES),
        )
        .order_by(Caso.id_caso)
    )
    casos = list(db.scalars(stmt).all())

    sectores = {s.id_sector: s.nombre for s in db.scalars(select(Sector)).all()}

    # Última línea de despacho por caso y cuadrilla (para orden/tipo/observación).
    dc_map: dict[int, DespachoCasos] = {}
    if casos:
        ids = [cc.id_caso for cc in casos]
        dcs = db.scalars(
            select(DespachoCasos)
            .join(Despacho, Despacho.id_despacho == DespachoCasos.id_despacho)
            .where(Despacho.id_cuadrilla == c.id_cuadrilla, DespachoCasos.id_caso.in_(ids))
            .order_by(Despacho.fecha.desc(), Despacho.id_despacho.desc())
        ).all()
        for dc in dcs:
            if dc.id_caso not in dc_map:
                dc_map[dc.id_caso] = dc

    if not casos:
        return _respuesta(
            catalogos, [], MOTIVO_SIN_PENDIENTES,
            f"Su cuadrilla {c.codigo} no tiene casos pendientes: todos están cerrados.", c,
            masivas=masivas, despacho_del_dia=despacho_hoy, ids_del_dia=ids_dia,
        )

    # D-119: todo el trabajo vigente de la cuadrilla (no terminal). La APK lo
    # conserva en la purga junto con `ids_del_dia`: si solo conservara el despacho
    # del día, los casos de una jornada anterior —que el servidor sigue
    # enviando— se borrarían en cada sincronización y volverían a bajar.
    ids_vigentes = [caso.id_caso for caso in casos]

    salida: list[dict[str, Any]] = []
    for caso in casos:
        # DESCARGA diferencial (D-73/D-105):
        #   `desde`         → solo lo modificado después de esa marca.
        #   `ids_conocidos` → lo que la APK ya tiene no se reenvía, salvo que
        #                     haya cambiado después de `desde`.
        # D-105: un caso que el dispositivo **no tiene** se envía siempre, aunque
        # no haya cambiado desde la marca. Antes se descartaba por «no modificado»
        # y el técnico no recibía nunca un caso despachado con posterioridad a su
        # última actualización (el despacho no toca `caso.actualizado_en`), que es
        # el caso normal de un caso viejo recién asignado; y tras una purga del
        # dispositivo el caso quedaba perdido para siempre.
        modificado = (
            desde is None
            or caso.actualizado_en is None
            or caso.actualizado_en > desde
        )
        conocido = ids_conocidos is not None and caso.id_caso in ids_conocidos
        if conocido:
            if desde is None or not modificado:
                continue
        elif ids_conocidos is None:
            # Modo diferencial puro (sin `ids_conocidos`): lo que no cambió no viaja.
            if not modificado:
                continue
        sector_nombre = sectores.get(caso.id_sector) if caso.id_sector else None
        salida.append(_caso_sync(caso, sector_nombre, dc_map.get(caso.id_caso)))

    if salida:
        motivo = MOTIVO_OK
        mensaje = f"{len(salida)} caso(s) de su cuadrilla {c.codigo}."
    else:
        motivo = MOTIVO_SIN_CAMBIOS
        mensaje = (
            f"Su cuadrilla {c.codigo} tiene {len(casos)} caso(s) y el dispositivo "
            "ya los tiene todos: no hay cambios."
        )
    return _respuesta(
        catalogos, salida, motivo, mensaje, c, len(casos), masivas=masivas,
        despacho_del_dia=despacho_hoy, ids_del_dia=ids_dia, ids_vigentes=ids_vigentes,
    )


def _catalogos(db: Session) -> dict[str, Any]:
    """Catálogos de apoyo para operar offline (independientes de la cuadrilla)."""
    modelos = [
        {"id_metodo": m.id_metodo, "dominio": m.dominio, "codigo": m.codigo, "nombre": m.nombre}
        for m in db.scalars(select(CatalogoMetodo).where(CatalogoMetodo.activo.is_(True))).all()
    ]
    causas = [
        {
            "id_causa": ca.id_causa,
            "codigo": f"{ca.codigo_causa}-{ca.subcodigo_causa}",
            "descripcion": ca.descripcion,
        }
        for ca in db.scalars(select(Causa).where(Causa.activo.is_(True))).all()
    ]
    return {"modelos": modelos, "causas": causas}


def _registrar_estado(
    db: Session,
    caso: Caso,
    nuevo: str,
    motivo: str | None,
    usuario_p00: str,
    momento: datetime | None = None,
) -> None:
    """Bitácora + estado del caso para la CARGA de la APK.

    D-120: delega en `resolucion.registrar_estado` para que un caso cerrado **en
    la cola offline** también cierre su ficha de caso especial. Antes esta copia
    no tocaba `caso_especial` y el referido seguía «pendiente» en la web y en la
    APK aunque el trabajo de campo estuviera terminado.
    """
    svc_resolucion.registrar_estado(
        db, caso, nuevo, motivo, usuario_p00, momento=momento
    )


def _instante_del_item(item: dict[str, Any]) -> datetime | None:
    """Instante real de una acción del lote (D-141 · H-24).

    La APK manda `fecha_hora` en UTC con offset; si viene sin zona se asume UTC
    (nunca la hora local del servidor). Un valor ilegible se ignora.
    """
    crudo = item.get("fecha_hora")
    if not crudo:
        return None
    try:
        momento = datetime.fromisoformat(str(crudo).replace("Z", "+00:00"))
    except ValueError:
        return None
    return momento if momento.tzinfo is not None else momento.replace(tzinfo=UTC)


def _fk_invalida(db: Session, act: dict[str, Any]) -> str | None:
    """Mensaje si `id_metodo`/`id_causa` del ítem no existen (D-139 · H-22).

    Antes, una FK rota lanzaba un 500 al insertar la actividad y **se perdía el
    lote entero**. Ahora el ítem se rechaza con su motivo y el resto se aplica.
    """
    for campo, modelo, etiqueta in (
        ("id_metodo", CatalogoMetodo, "método"),
        ("id_causa", Causa, "causa"),
    ):
        crudo = act.get(campo)
        if crudo is None or crudo == "":
            continue
        try:
            valor = int(crudo)
        except (TypeError, ValueError):
            return f"El {etiqueta} '{crudo}' no es un identificador válido"
        if db.get(modelo, valor) is None:
            return f"El {etiqueta} {valor} no existe en el catálogo"
    return None


def aplicar_carga(
    db: Session,
    usuario: Usuario,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """Aplica actividades y estados enviados por la APK.

    Regla (D-121 · H-02 de la auditoría V3): un TECNICO solo puede tocar casos
    asignados a su cuadrilla y, si **no tiene cuadrilla vigente**, la carga se
    rechaza con 403 en lugar de aceptar cualquier caso. Antes el filtro quedaba en
    `None` (fail-open) y un técnico retirado de su cuadrilla podía mover estados
    de cualquier caso de la central.
    D-123 · H-06: se acepta además el trabajo de los casos que **estuvieron** en su
    cuadrilla en los últimos días (`DIAS_TRABAJO_RECIENTE`), de modo que una
    reasignación a mitad de jornada no deja el trabajo del técnico rechazado para
    siempre. El mismo criterio (`casos_permitidos`) aplica a los endpoints de
    resolución de campo.
    SUPERVISOR/ADMIN/SUPER pueden tocar cualquier caso de su central.
    """
    rol = usuario.rol.codigo if usuario.rol else ""
    es_gestor = rol in {"ADMIN", "SUPERVISOR", "SUPER"}
    c = _cuadrilla_activa(db, usuario) if not es_gestor else None
    # D-123 · H-06: se acepta también el trabajo de los casos que estuvieron en la
    # cuadrilla en los últimos días (un caso reasignado no deja huérfano lo ya hecho).
    ids_permitidos: set[int] | None = casos_permitidos(db, usuario)
    if not es_gestor and c is None:
        raise HTTPException(
            status_code=403,
            detail=(
                "Su cuenta no tiene una cuadrilla vigente: no puede cargar trabajo "
                "de campo. Pida a su supervisor que lo asigne a una cuadrilla."
            ),
        )

    errores: list[dict[str, Any]] = []
    items: list[dict[str, Any]] = []
    aceptadas = 0
    rechazadas = 0
    # D-121: clave de idempotencia por acción de la cola del dispositivo.
    dispositivo = str(payload.get("dispositivo_id") or "").strip()[:80] or None

    def _rechazar(id_caso: int, mensaje: str, local: int | None = None) -> None:
        errores.append({"id_caso": id_caso, "mensaje": mensaje,
                        "id_actividad_local": local})
        items.append({"id_actividad_local": local, "id_caso": id_caso,
                      "aceptada": False, "mensaje": mensaje, "id_actividad": None})

    def _aceptar(id_caso: int, local: int | None, id_actividad: int | None = None,
                 duplicada: bool = False) -> None:
        items.append({
            "id_actividad_local": local,
            "id_caso": id_caso,
            "aceptada": True,
            "mensaje": "Ya registrada en una carga anterior" if duplicada else None,
            "id_actividad": id_actividad,
        })

    def _ya_aplicada(local: int | None) -> Actividad | None:
        """¿Esa acción de la cola ya se registró en este dispositivo? (D-121)."""
        if local is None or dispositivo is None:
            return None
        return db.scalar(
            select(Actividad).where(
                Actividad.dispositivo_id == dispositivo,
                Actividad.id_actividad_local == local,
            )
        )

    def _validar_acceso(id_caso: int) -> Caso | None:
        caso = db.get(Caso, id_caso)
        if caso is None:
            errores.append({"id_caso": id_caso, "mensaje": "Caso no encontrado"})
            return None
        if usuario.id_central is not None and caso.id_central != usuario.id_central:
            errores.append({"id_caso": id_caso, "mensaje": "El caso es de otra central"})
            return None
        if ids_permitidos is not None and id_caso not in ids_permitidos:
            errores.append({"id_caso": id_caso, "mensaje": "El caso no está asignado a tu cuadrilla"})
            return None
        return caso

    # D-129 · H-12: el lote se aplica en **orden cronológico**. Antes se hacían
    # primero todas las actividades y después los estados, así que un CONTACTADO
    # encolado antes de un CIERRE se aplicaba al final y revertía el cierre.
    # La clave es el id local de la acción en la cola (su orden real en el
    # dispositivo); si falta (cliente antiguo), se conserva el orden de llegada.
    lote: list[tuple[int, int, str, dict[str, Any]]] = []
    for indice, act in enumerate(payload.get("actividades", [])):
        local = act.get("id_actividad_local")
        clave = int(local) if isinstance(local, int) else 1_000_000 + indice
        lote.append((clave, indice, "actividad", act))
    for indice, est in enumerate(payload.get("estados", [])):
        local = est.get("id_actividad_local")
        clave = int(local) if isinstance(local, int) else 1_100_000 + indice
        lote.append((clave, indice, "estado", est))
    lote.sort(key=lambda elemento: (elemento[0], elemento[1]))

    for _clave, _indice, clase, datos in lote:
        if clase == "actividad":
            act = datos
            local = act.get("id_actividad_local")
            local = int(local) if isinstance(local, int) else None
            caso = _validar_acceso(int(act["id_caso"]))
            if caso is None:
                rechazadas += 1
                _rechazar(int(act["id_caso"]), "El caso no se puede gestionar desde su cuadrilla", local)
                continue

            # D-121 · H-01: idempotencia. Si la acción ya se aplicó (reenvío del mismo
            # lote tras un timeout, reintento o doble emisor), se confirma sin volver
            # a escribir la actividad ni a mover el caso.
            problema_fk = _fk_invalida(db, act)
            if problema_fk is not None:
                rechazadas += 1
                _rechazar(caso.id_caso, problema_fk, local)
                continue

            previa = _ya_aplicada(local)
            if previa is not None:
                aceptadas += 1
                _aceptar(caso.id_caso, local, previa.id_actividad, duplicada=True)
                continue

            tipo = str(act.get("tipo", "")).upper()
            tipo_db = _tipo_db(tipo)
            if tipo_db is None:
                # Tipos sin fila en `actividad` (p. ej. CITA, que se registra como
                # estado): se aplica el cambio de estado y no se escribe actividad.
                estado_sin_fila = _estado_por_tipo(tipo)
                if estado_sin_fila:
                    _registrar_estado(db, caso, estado_sin_fila, act.get("reporte_corto"),
                                      usuario.p00)
                aceptadas += 1
                _aceptar(caso.id_caso, local)
                continue

            if tipo_db == "CIERRE":
                # D-121 · H-03: el cierre que llega de la cola offline pasa por las
                # **mismas reglas** que el cierre de la ficha (método del catálogo,
                # caso no cerrado, clasificación REPARACIÓN↔REFERIDO y auditoría),
                # en vez de escribir la actividad a mano y dejar `id_metodo` en NULL.
                try:
                    cierre = svc_resolucion.cerrar_caso(
                        db,
                        caso,
                        modo=str(act.get("modo") or ""),
                        descripcion=str(act.get("reporte_corto") or ""),
                        evidencias=[
                            str(s).strip()
                            for s in (act.get("evidencias") or [])
                            if str(s).strip()
                        ],
                        id_causa=act.get("id_causa"),
                        usuario=usuario,
                        sincronizado=True,
                        id_actividad_local=local,
                        dispositivo_id=dispositivo,
                    )
                except svc_resolucion.CierreInvalido as exc:
                    errores.append({"id_caso": caso.id_caso, "mensaje": exc.mensaje,
                                    "id_actividad_local": local})
                    rechazadas += 1
                    _rechazar(caso.id_caso, exc.mensaje, local)
                    continue
                aceptadas += 1
                _aceptar(caso.id_caso, local, cierre.id_actividad)
                continue

            actividad = Actividad(
                id_caso=caso.id_caso,
                id_usuario=usuario.id_usuario,
                id_cuadrilla=c.id_cuadrilla if c else None,
                tipo=tipo_db,
                resultado=_resultado_db(tipo_db, act.get("resultado")),
                reporte_corto=act.get("reporte_corto"),
                id_metodo=_resolver_metodo(db, tipo_db, act),
                id_causa=act.get("id_causa"),
                fecha_hora=act.get("fecha_hora") or datetime.now(UTC),
                latitud=act.get("latitud"),
                longitud=act.get("longitud"),
                sincronizado=True,
                id_actividad_local=local,
                dispositivo_id=dispositivo,
            )
            db.add(actividad)
            db.flush()

            seriales = act.get("evidencias", [])
            for idx, serial in enumerate(seriales, start=1):
                limpio = str(serial).strip()
                if not limpio:
                    continue
                existente = db.scalar(select(Evidencia).where(Evidencia.serial_imagen == limpio))
                if existente is not None:
                    # Vincular la evidencia ya subida con esta actividad.
                    if existente.id_actividad is None:
                        existente.id_actividad = actividad.id_actividad
                    continue
                db.add(
                    Evidencia(
                        id_actividad=actividad.id_actividad,
                        tipo="DEMO",
                        serial_imagen=f"{caso.id_averia}-A{actividad.id_actividad}-{tipo_db}-{idx:02d}"[:160],
                        ruta_remota=limpio[:255],
                        latitud=act.get("latitud"),
                        longitud=act.get("longitud"),
                        fecha_hora=actividad.fecha_hora,
                        origen_camara=True,
                    )
                )

            estado_objetivo = _estado_por_tipo(tipo)
            if estado_objetivo:
                _registrar_estado(db, caso, estado_objetivo, act.get("reporte_corto"), usuario.p00)
            aceptadas += 1
            _aceptar(caso.id_caso, local, actividad.id_actividad)

        else:
            est = datos
            caso = _validar_acceso(int(est["id_caso"]))
            if caso is None:
                rechazadas += 1
                continue
            nuevo = str(est.get("estado_nuevo", "")).upper()
            estados_validos = {
                "NUEVO", "ASIGNADO", "CONTACTADO", "CITADO", "DIFERIDO",
                "EN_GESTION", "ENRUTADO", "CERRADO", "CANCELADO",
            }
            if nuevo not in estados_validos:
                errores.append({"id_caso": caso.id_caso, "mensaje": f"Estado inválido: {nuevo}"})
                rechazadas += 1
                continue
            if nuevo == caso.estado_actual:
                continue
            _registrar_estado(
                db, caso, nuevo, est.get("motivo"), usuario.p00,
                momento=_instante_del_item(est),
            )
            aceptadas += 1

    db.commit()
    return {
        "aceptadas": aceptadas,
        "rechazadas": rechazadas,
        "errores": errores,
        # D-121: resultado **por acción** de la cola, para que la APK marque cada
        # una (enviada / con error) en vez del lote completo.
        "items": items,
        "server_ts": datetime.now(UTC),
    }


def _estado_por_tipo(tipo: str) -> str | None:
    """Estado del caso que produce una actividad del técnico."""
    mapping = {
        "CONTACTO": "CONTACTADO",
        "CIERRE": "CERRADO",
        "CITA": "CITADO",
        "ENRUTE": "ENRUTADO",
        "ENRUTADO": "ENRUTADO",
        "DIFERIDO": "DIFERIDO",
    }
    return mapping.get(tipo.upper())


def _tipo_db(tipo: str) -> str | None:
    """Tipo normalizado para `actividad.tipo`; `None` si no genera fila."""
    return TIPOS_DB.get(tipo.upper())


def _resultado_db(tipo_db: str, enviado: Any) -> str | None:
    """Resultado admitido por el CHECK de `actividad.resultado`.

    Se respeta el valor del cliente si ya es uno de los estados válidos; para los
    valores de campo («EXITOSO», «NO_ATIENDE»…) se deriva del tipo, que es la
    convención que ya usan los cierres y enrutados de la web.
    """
    if isinstance(enviado, str) and enviado.upper() in RESULTADOS_VALIDOS:
        return enviado.upper()
    return RESULTADO_POR_TIPO.get(tipo_db)


def _resolver_metodo(db: Session, tipo_db: str, act: dict[str, Any]) -> int | None:
    """`id_metodo` explícito o resuelto desde el `modo` de cierre de la APK.

    El cierre de campo viaja con `modo` (IVR/COS/SACAS) porque la APK lo captura
    sin conexión; aquí se traduce al catálogo `CIERRE` para no perder el dato.
    """
    directo = act.get("id_metodo")
    if isinstance(directo, int):
        return directo
    if tipo_db != "CIERRE":
        return None
    modo = str(act.get("modo") or "").strip().upper()
    if not modo:
        return None
    return db.scalar(
        select(CatalogoMetodo.id_metodo).where(
            CatalogoMetodo.dominio == "CIERRE", CatalogoMetodo.codigo == modo
        )
    )


# --------------------------------------------------------------------------- #
# Sesiones de sincronización y checklist (D-81 · RF-39 / RF-40)
# --------------------------------------------------------------------------- #
PASOS_CHECKLIST = ("CONEXION", "LOGIN", "DESCARGA", "CARGA")


def _derivar_estado(recibidos: int, procesados: int, errores: int) -> str:
    """Estado de la sesión a partir de sus contadores."""
    if errores == 0:
        return "OK"
    if procesados > 0:
        return "PARCIAL"
    return "ERROR"


def abrir_sesion(
    db: Session,
    usuario: Usuario,
    *,
    tipo: str,
    dispositivo_id: str | None = None,
    version_app: str | None = None,
) -> SyncLog:
    """Crea una sesión de sincronización `EN_PROCESO` (CU-D81-01)."""
    if tipo not in ("DESCARGA", "CARGA"):
        raise HTTPException(status_code=422, detail="Tipo de sesión inválido: use DESCARGA o CARGA")
    c = _cuadrilla_activa(db, usuario)
    sesion = SyncLog(
        p00=usuario.p00,
        id_cuadrilla=c.id_cuadrilla if c else None,
        id_central=usuario.id_central,
        tipo=tipo,
        dispositivo_id=dispositivo_id,
        version_app=version_app,
        plataforma="APK",
        estado="EN_PROCESO",
        recibidos=0,
        procesados=0,
        errores=0,
    )
    db.add(sesion)
    db.commit()
    db.refresh(sesion)
    return sesion


def guardar_checklist(db: Session, id_sync_log: int, pasos: list[Any]) -> None:
    """Inserta/actualiza el checklist por paso (idempotente por `(log, paso)`)."""
    for p in pasos:
        if isinstance(p, dict):
            paso, estado = p.get("paso"), p.get("estado")
            fh, det = p.get("fecha_hora"), p.get("detalle")
        else:
            paso, estado, fh, det = p.paso, p.estado, p.fecha_hora, p.detalle
        if paso not in PASOS_CHECKLIST or estado is None:
            continue
        fila = db.scalar(
            select(SyncCheck).where(
                SyncCheck.id_sync_log == id_sync_log, SyncCheck.paso == paso
            )
        )
        if fila is None:
            db.add(
                SyncCheck(
                    id_sync_log=id_sync_log, paso=paso, estado=estado,
                    fecha_hora=fh, detalle=det,
                )
            )
        else:
            fila.estado = estado
            if fh is not None:
                fila.fecha_hora = fh
            if det is not None:
                fila.detalle = det


def cerrar_sesion(db: Session, usuario: Usuario, id_sync_log: int, datos: dict[str, Any]) -> dict[str, Any]:
    """Cierra la sesión con contadores, estado y checklist (CU-D81-01)."""
    sesion = db.get(SyncLog, id_sync_log)
    if sesion is None:
        raise HTTPException(status_code=404, detail="Sesión de sincronización no encontrada")
    # D-137 · H-20: solo el **dueño** de la sesión (o un rol de gestión) puede
    # cerrarla. Antes cualquier autenticado podía cerrar y falsear los contadores
    # de la sesión de otro técnico (IDOR).
    rol = usuario.rol.codigo if usuario.rol else ""
    if sesion.p00 != usuario.p00 and rol not in {"ADMIN", "SUPERVISOR", "SUPER"}:
        raise HTTPException(
            status_code=403,
            detail="La sesión de sincronización no le pertenece: no puede cerrarla.",
        )
    if sesion.estado != "EN_PROCESO" or sesion.finalizado_en is not None:
        raise HTTPException(status_code=409, detail="La sesión ya está cerrada")

    ahora = datetime.now(UTC)
    recibidos = int(datos.get("recibidos") or 0)
    procesados = int(datos.get("procesados") or 0)
    errores = int(datos.get("errores") or 0)
    estado = datos.get("estado") or _derivar_estado(recibidos, procesados, errores)

    detalle = dict(sesion.detalle or {})
    if datos.get("detalle"):
        detalle.update(datos["detalle"])
    if sesion.id_cuadrilla is None:
        estado = "ERROR"
        detalle["motivo"] = "sin_cuadrilla"

    sesion.recibidos, sesion.procesados, sesion.errores = recibidos, procesados, errores
    sesion.estado = estado
    sesion.finalizado_en = ahora
    if sesion.iniciado_en is not None:
        sesion.duracion_ms = int((ahora - sesion.iniciado_en).total_seconds() * 1000)
    sesion.detalle = detalle or None

    guardar_checklist(db, id_sync_log, datos.get("checklist") or [])
    db.commit()
    db.refresh(sesion)

    # Mensaje automático de estado al técnico (CU-D81-06). Best-effort:
    # no debe impedir el cierre de la sesión si falla.
    try:
        from .mensajes import emitir_estado_sync

        emitir_estado_sync(db, sesion)
    except Exception:
        db.rollback()
        logger.exception("No se pudo emitir ESTADO_SYNC de la sesión %s", id_sync_log)

    return {
        "id_sync_log": sesion.id_sync_log,
        "estado": sesion.estado,
        "recibidos": sesion.recibidos,
        "procesados": sesion.procesados,
        "errores": sesion.errores,
        "duracion_ms": sesion.duracion_ms,
    }
