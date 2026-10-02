"""Servicio de sincronización móvil (D-73).

Resuelve la cuadrilla activa del técnico, arma la carga diferencial de DESCARGA
y aplica el batch de actividades/estados de CARGA. Reutiliza helpers existentes
de `routes_casos` para no duplicar reglas de estado ni bitácora.
"""

from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import (
    Actividad,
    Caso,
    CasoEstadoHist,
    CatalogoMetodo,
    Causa,
    Cuadrilla,
    CuadrillaTecnico,
    Despacho,
    DespachoCasos,
    Evidencia,
    Sector,
    Usuario,
)

ESTADOS_OPERABLES = ("ASIGNADO", "CONTACTADO", "CITADO", "DIFERIDO", "EN_GESTION")


def _cuadrilla_activa(db: Session, usuario: Usuario) -> Cuadrilla | None:
    """Cuadrilla vigente del técnico vinculado a la cuenta (si existe)."""
    if usuario.id_tecnico is None:
        return None
    hoy = date.today()
    id_cuadrilla = db.scalar(
        select(CuadrillaTecnico.id_cuadrilla)
        .where(
            CuadrillaTecnico.id_tecnico == usuario.id_tecnico,
            CuadrillaTecnico.desde <= hoy,
            (CuadrillaTecnico.hasta.is_(None)) | (CuadrillaTecnico.hasta >= hoy),
        )
        .order_by(CuadrillaTecnico.desde.desc())
        .limit(1)
    )
    if id_cuadrilla is None:
        return None
    return db.get(Cuadrilla, id_cuadrilla)


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


def _casos_ids_de_cuadrilla(db: Session, id_cuadrilla: int) -> list[int]:
    """IDs de casos cuyo último despacho pertenece a la cuadrilla dada."""
    filas = db.execute(
        select(DespachoCasos.id_caso)
        .join(Despacho, Despacho.id_despacho == DespachoCasos.id_despacho)
        .where(Despacho.id_cuadrilla == id_cuadrilla)
        .distinct()
    ).scalars().all()
    return list(filas)


def _caso_sync(caso: Caso, sector_nombre: str | None, dc: DespachoCasos | None) -> dict[str, Any]:
    return {
        "id_caso": caso.id_caso,
        "id_averia": caso.id_averia,
        "estado_actual": caso.estado_actual,
        "tipo_caso": caso.tipo_caso,
        "categoria": caso.categoria,
        "sector_nombre": sector_nombre,
        "direccion": caso.direccion,
        "telefono": caso.telefono,
        "nombre_cliente": caso.nombre_cliente,
        "problema_reporte": caso.problema_reporte,
        "informacion": caso.informacion,
        "fecha_cita": caso.fecha_cita,
        "actualizado_en": caso.actualizado_en,
        "orden_visita": dc.orden_visita if dc else None,
        "tipo_asignacion": dc.tipo_asignacion if dc else None,
        "observacion_despacho": dc.observacion if dc else None,
    }


def construir_descarga(
    db: Session,
    usuario: Usuario,
    desde: datetime | None = None,
    ids_conocidos: set[int] | None = None,
) -> dict[str, Any]:
    """Arma el payload de DESCARGA diferencial.

    - Si `ids_conocidos` se envía, solo retorna los casos que faltan en local o
      que cambiaron desde `desde`.
    - Si no se envía, retorna todos los operables de la cuadrilla.
    """
    rol = usuario.rol.codigo if usuario.rol else ""
    if rol not in {"ADMIN", "SUPERVISOR", "SUPER"} and rol != "TECNICO":
        raise HTTPException(status_code=403, detail="Rol sin acceso a sincronización")

    # Los catálogos se devuelven SIEMPRE (son independientes de la cuadrilla):
    # la APK los necesita para operar offline aunque hoy no tenga casos asignados.
    catalogos = _catalogos(db)

    c = _cuadrilla_activa(db, usuario)
    if c is None:
        return {"server_ts": datetime.now(UTC), "casos": [], "catalogos": catalogos}

    ids_cuadrilla = _casos_ids_de_cuadrilla(db, c.id_cuadrilla)
    if not ids_cuadrilla:
        return {"server_ts": datetime.now(UTC), "casos": [], "catalogos": catalogos}

    stmt = (
        select(Caso)
        .where(Caso.id_caso.in_(ids_cuadrilla), Caso.estado_actual.in_(ESTADOS_OPERABLES))
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

    salida: list[dict[str, Any]] = []
    for caso in casos:
        if ids_conocidos is not None and caso.id_caso in ids_conocidos:
            if desde is not None and caso.actualizado_en and caso.actualizado_en <= desde:
                continue
        sector_nombre = sectores.get(caso.id_sector) if caso.id_sector else None
        salida.append(_caso_sync(caso, sector_nombre, dc_map.get(caso.id_caso)))

    return {
        "server_ts": datetime.now(UTC),
        "casos": salida,
        "catalogos": catalogos,
    }


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


def _registrar_estado(db: Session, caso: Caso, nuevo: str, motivo: str | None, usuario_p00: str) -> None:
    if nuevo == caso.estado_actual:
        return
    db.add(
        CasoEstadoHist(
            id_caso=caso.id_caso,
            estado_anterior=caso.estado_actual,
            estado_nuevo=nuevo,
            motivo=motivo,
            usuario=usuario_p00,
        )
    )
    caso.estado_actual = nuevo


def aplicar_carga(
    db: Session,
    usuario: Usuario,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """Aplica actividades y estados enviados por la APK.

    Regla: un TECNICO solo puede tocar casos asignados actualmente a su cuadrilla.
    SUPERVISOR/ADMIN/SUPER pueden tocar cualquier caso.
    """
    rol = usuario.rol.codigo if usuario.rol else ""
    es_gestor = rol in {"ADMIN", "SUPERVISOR", "SUPER"}
    c = _cuadrilla_activa(db, usuario) if not es_gestor else None
    ids_permitidos: set[int] | None = None
    if c is not None:
        ids_permitidos = set(_casos_ids_de_cuadrilla(db, c.id_cuadrilla))

    errores: list[dict[str, Any]] = []
    aceptadas = 0
    rechazadas = 0

    def _validar_acceso(id_caso: int) -> Caso | None:
        caso = db.get(Caso, id_caso)
        if caso is None:
            errores.append({"id_caso": id_caso, "mensaje": "Caso no encontrado"})
            return None
        if ids_permitidos is not None and id_caso not in ids_permitidos:
            errores.append({"id_caso": id_caso, "mensaje": "El caso no está asignado a tu cuadrilla"})
            return None
        return caso

    for act in payload.get("actividades", []):
        caso = _validar_acceso(int(act["id_caso"]))
        if caso is None:
            rechazadas += 1
            continue
        tipo = str(act.get("tipo", "")).upper()
        actividad = Actividad(
            id_caso=caso.id_caso,
            id_usuario=usuario.id_usuario,
            id_cuadrilla=c.id_cuadrilla if c else None,
            tipo=tipo,
            resultado=act.get("resultado"),
            reporte_corto=act.get("reporte_corto"),
            id_metodo=act.get("id_metodo"),
            id_causa=act.get("id_causa"),
            fecha_hora=act.get("fecha_hora") or datetime.now(UTC),
            latitud=act.get("latitud"),
            longitud=act.get("longitud"),
            sincronizado=True,
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
                    serial_imagen=f"{caso.id_averia}-A{actividad.id_actividad}-{tipo}-{idx:02d}"[:160],
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

    for est in payload.get("estados", []):
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
        _registrar_estado(db, caso, nuevo, est.get("motivo"), usuario.p00)
        aceptadas += 1

    db.commit()
    return {
        "aceptadas": aceptadas,
        "rechazadas": rechazadas,
        "errores": errores,
        "server_ts": datetime.now(UTC),
    }


def _estado_por_tipo(tipo: str) -> str | None:
    mapping = {
        "CONTACTO": "CONTACTADO",
        "CIERRE": "CERRADO",
        "CITA": "CITADO",
        "ENRUTADO": "ENRUTADO",
        "DIFERIDO": "DIFERIDO",
    }
    return mapping.get(tipo)
