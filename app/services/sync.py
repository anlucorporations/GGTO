"""Servicio de sincronización móvil (D-73).

Resuelve la cuadrilla activa del técnico, arma la carga diferencial de DESCARGA
y aplica el batch de actividades/estados de CARGA. Reutiliza helpers existentes
de `routes_casos` para no duplicar reglas de estado ni bitácora.
"""

from __future__ import annotations

import logging
from datetime import UTC, date, datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func, select
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
    SyncCheck,
    SyncLog,
    Usuario,
)

logger = logging.getLogger(__name__)

#: Estados que ya **no** son trabajo de la cuadrilla: cerrado, cancelado o
#: enrutado a otra instancia. Un caso recién despachado nace `NUEVO` (el despacho
#: marca `despacho_caso.estado = ASIGNADO`, no el caso), así que excluir `NUEVO`
#: dejaría al técnico sin nada que descargar.
ESTADOS_TERMINALES = ("CERRADO", "CANCELADO", "ENRUTADO")

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

    salida: list[dict[str, Any]] = []
    for caso in casos:
        # DESCARGA diferencial (D-73):
        #   `desde`         → solo lo modificado después de esa marca.
        #   `ids_conocidos` → lo que la APK ya tiene no se reenvía, salvo que
        #                     haya cambiado después de `desde`.
        modificado = (
            desde is None
            or caso.actualizado_en is None
            or caso.actualizado_en > desde
        )
        conocido = ids_conocidos is not None and caso.id_caso in ids_conocidos
        if conocido and (desde is None or not modificado):
            continue
        if not modificado:
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
        tipo_db = _tipo_db(tipo)
        if tipo_db is None:
            # Tipos sin fila en `actividad` (p. ej. CITA, que se registra como
            # estado): se aplica el cambio de estado y no se escribe actividad.
            estado_sin_fila = _estado_por_tipo(tipo)
            if estado_sin_fila:
                _registrar_estado(db, caso, estado_sin_fila, act.get("reporte_corto"),
                                  usuario.p00)
            aceptadas += 1
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
