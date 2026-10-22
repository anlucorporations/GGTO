"""Sincronización de la APK móvil — D-73 (Ciclo 8).

Endpoints:
  - `GET /api/v1/sync/cuadrilla`     → cuadrilla activa del usuario.
  - `GET /api/v1/sync/descarga`      → casos asignados a la cuadrilla, diferenciales.
  - `POST /api/v1/evidencias/upload` → subida multipart de una foto.
  - `POST /api/v1/sync/carga`        → batch de actividades y estados del día.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Response,
    UploadFile,
    status,
)
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..core.security import create_access_token, decode_token
from ..models import Caso, Configuracion, Evidencia, SyncLog, Usuario
from ..schemas.sync import (
    ChecklistIn,
    EvidenciaUploadOut,
    SyncCargaIn,
    SyncCargaOut,
    SyncCuadrillaOut,
    SyncDescargaIn,
    SyncDescargaOut,
    SyncSesionCierreIn,
    SyncSesionCierreOut,
    SyncSesionIn,
    SyncSesionOut,
)
from ..services import sync as svc
from ..services.consultas import cargar_config, resolver_central
from ..services.storage import (
    StorageError,
    detectar_tipo_imagen,
    leer_evidencia,
    serial_desde_nombre,
    subir_evidencia,
)
from .deps import bearer, get_current_user

router = APIRouter(prefix="/api/v1", tags=["sincronización móvil"])

MAX_FOTO_BYTES = 3 * 1024 * 1024  # 3 MB por evidencia (decisión del usuario)

#: Tipos admitidos por el CHECK `evidencia_tipo_check` (ver `db/schema.sql`).
#: `FALLA_MASIVA` es la evidencia del reporte de campo de la APK (D-82).
TIPOS_EVIDENCIA = ("POTENCIA", "NAVEGACION", "DEMO", "FALLA_MASIVA")

#: Roles que pueden abrir una evidencia sin caso (reporte de falla masiva).
ROLES_EVIDENCIA_SIN_CASO = frozenset({"ADMIN", "SUPERVISOR", "COORDINADOR", "SUPER"})


def _config_int(db: Session, clave: str, defecto: int) -> int:
    valor = db.scalar(select(Configuracion.valor).where(Configuracion.clave == clave))
    try:
        return int(valor) if valor is not None else defecto
    except (TypeError, ValueError):
        return defecto


def _configurar_sesion(db: Session, usuario: Usuario) -> None:
    """Aplica el acotado RLS de la sesión (mismo criterio que `get_current_user`)."""
    if db.bind and db.bind.dialect.name == "postgresql":
        if usuario.rol and usuario.rol.codigo == "SUPER":
            db.execute(text("SELECT set_config('app.sin_acotar', 'on', true)"))
        if usuario.id_central is not None:
            db.execute(
                text("SELECT set_config('app.id_central', :c, true)"),
                {"c": str(usuario.id_central)},
            )


def _url_firmada(usuario: Usuario, id_evidencia: int) -> str:
    """URL de corta vida para abrir la evidencia sin volver a autenticarse."""
    token, _ = create_access_token(
        subject=usuario.p00,
        rol=usuario.rol.codigo if usuario.rol else "",
        minutos=15,
        extra={"ev": id_evidencia},
    )
    return f"/api/v1/evidencias/{id_evidencia}?token={token}"


def _evidencia_visible(db: Session, usuario: Usuario, evidencia: Evidencia) -> bool:
    """Alcance de lectura de una evidencia (D-152/D-154)."""
    rol = usuario.rol.codigo if usuario.rol else ""
    if evidencia.id_caso is None:
        return rol in ROLES_EVIDENCIA_SIN_CASO
    caso = db.get(Caso, evidencia.id_caso)
    if caso is None:
        return False
    if rol != "SUPER":
        central = resolver_central(db, None, cargar_config(db), usuario)
        if caso.id_central != central.id_central:
            return False
    permitidos = svc.casos_permitidos(db, usuario)
    return permitidos is None or caso.id_caso in permitidos


def _parsear_datetime(valor: str | None) -> datetime | None:
    if not valor:
        return None
    try:
        return datetime.fromisoformat(valor.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Fecha inválida en 'desde'") from exc


@router.get("/sync/cuadrilla", response_model=SyncCuadrillaOut, summary="Cuadrilla activa del usuario")
def sync_cuadrilla(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
) -> SyncCuadrillaOut:
    return SyncCuadrillaOut(**svc.resolver_cuadrilla(db, usuario))


@router.get("/sync/descarga", response_model=SyncDescargaOut, summary="Descarga diferencial por cuadrilla")
def sync_descarga(
    desde: Annotated[str | None, Query(description="ISO8601; devuelve solo cambios posteriores")] = None,
    ids_conocidos: Annotated[list[int] | None, Query(description="IDs locales ya conocidos")] = None,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
) -> SyncDescargaOut:
    dt = _parsear_datetime(desde)
    # D-105: `None` (parámetro ausente) significa «el dispositivo no declara lo que
    # tiene» y se aplica el diferencial puro por fecha; una lista —aunque venga
    # vacía— significa «esto es lo que tengo y lo que falte, mándalo».
    conocidos = None if ids_conocidos is None else set(ids_conocidos)
    payload = svc.construir_descarga(db, usuario, desde=dt, ids_conocidos=conocidos)
    return SyncDescargaOut(**payload)


@router.post(
    "/sync/descarga",
    response_model=SyncDescargaOut,
    summary="Descarga diferencial por cuadrilla (cuerpo JSON)",
)
def sync_descarga_post(
    datos: SyncDescargaIn,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
) -> SyncDescargaOut:
    """Mismo contrato que el GET, con `desde` e `ids_conocidos` en el cuerpo (D-127).

    H-10 de la auditoría: la query string crecía con toda la caché del dispositivo
    (~8 KB con 380 casos) y podía superar el límite de URL del proxy. La APK usa
    esta vía; el GET se mantiene por compatibilidad con versiones anteriores.
    """
    conocidos = None if datos.ids_conocidos is None else set(datos.ids_conocidos)
    payload = svc.construir_descarga(
        db, usuario, desde=datos.desde, ids_conocidos=conocidos
    )
    return SyncDescargaOut(**payload)


@router.post("/evidencias/upload", response_model=EvidenciaUploadOut, summary="Subir una foto de evidencia")
async def upload_evidencia(
    file: Annotated[UploadFile, File()],
    id_caso: Annotated[int, Form()],
    tipo: Annotated[str, Form()] = "DEMO",
    serial_local: Annotated[str | None, Form()] = None,
    latitud: Annotated[float | None, Form()] = None,
    longitud: Annotated[float | None, Form()] = None,
    fecha_hora: Annotated[str | None, Form()] = None,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
) -> EvidenciaUploadOut:
    contenido = await file.read()
    if len(contenido) > MAX_FOTO_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"La foto supera el máximo de {MAX_FOTO_BYTES // (1024 * 1024)} MB",
        )
    if not contenido:
        raise HTTPException(status_code=422, detail="Archivo vacío")

    # Validar el contenido real (bytes mágicos), no solo la cabecera declarada.
    tipo_imagen = detectar_tipo_imagen(contenido)
    if tipo_imagen is None:
        raise HTTPException(
            status_code=422,
            detail="El archivo no es una imagen JPEG, PNG o WebP válida",
        )
    if (file.content_type or "") not in {
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
    }:
        raise HTTPException(status_code=422, detail="Formato no permitido: use JPEG/PNG/WebP")

    # Validar el tipo de evidencia ANTES de tocar la base: un valor fuera del
    # CHECK devolvería un 500 en lugar de un 422 (D-82).
    if tipo not in TIPOS_EVIDENCIA:
        raise HTTPException(
            status_code=422,
            detail=f"Tipo de evidencia no válido: use uno de {', '.join(TIPOS_EVIDENCIA)}",
        )

    nombre = file.filename or "foto.jpg"
    serial = serial_local or serial_desde_nombre(nombre)

    # D-128 · H-11: la foto se guarda **ligada a su caso** y solo si el usuario
    # puede gestionarlo (mismo criterio que D-123). `id_caso <= 0` es la firma de
    # las evidencias de un reporte de falla masiva (`FM-…`), que aún no tienen
    # caso: se aceptan sin vínculo, como antes. Un id positivo inexistente ya no
    # deja una evidencia huérfana (H-05).
    caso = None
    if id_caso > 0:
        caso = db.get(Caso, id_caso)
        if caso is None:
            raise HTTPException(status_code=404, detail="Caso no encontrado")
        permitidos = svc.casos_permitidos(db, usuario)
        if permitidos is not None and caso.id_caso not in permitidos:
            raise HTTPException(
                status_code=403,
                detail="El caso no está asignado a su cuadrilla: no puede subir evidencias.",
            )
        if usuario.id_central is not None and caso.id_central != usuario.id_central:
            raise HTTPException(status_code=403, detail="El caso es de otra central")
    id_caso_vinculo = caso.id_caso if caso is not None else None

    # Idempotencia: si el serial ya fue subido, se devuelve la fila existente.
    existente = db.query(Evidencia).filter(Evidencia.serial_imagen == serial).first()
    # El serial lo elige el cliente: no puede servir para leer la evidencia de
    # otro caso. Sin caso (falla masiva) se mantiene la idempotencia porque la
    # descarga de esas filas ya está restringida a jefaturas.
    if existente is not None and existente.id_caso is not None:
        if not _evidencia_visible(db, usuario, existente):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="El serial ya está registrado en otra evidencia",
            )
    if existente is not None and existente.ruta_remota:
        return EvidenciaUploadOut(
            id_evidencia=existente.id_evidencia,
            serial_imagen=existente.serial_imagen,
            ruta_remota=existente.ruta_remota or "",
            url_firmada=_url_firmada(usuario, existente.id_evidencia),
        )

    # Cuota por caso y día (H-05): evita que un cliente en bucle llene el bucket.
    # Un reintento del mismo serial no consume cuota.
    if id_caso_vinculo is not None and existente is None:
        limite = _config_int(db, "evidencia.max_por_caso_dia", 10)
        desde = datetime.now(UTC) - timedelta(days=1)
        usadas = db.scalar(
            select(func.count(Evidencia.id_evidencia)).where(
                Evidencia.id_caso == id_caso_vinculo,
                Evidencia.fecha_hora >= desde,
            )
        )
        if (usadas or 0) >= limite:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Límite diario de {limite} evidencias para este caso alcanzado",
            )

    try:
        ruta_remota = subir_evidencia(nombre, contenido, content_type=tipo_imagen)
    except StorageError as exc:
        # Fail-closed (H-05): la APK conserva la foto y reintenta; nunca se
        # devuelve una ruta que no existe.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No se pudo guardar la evidencia; la APK la reintentará",
        ) from exc

    if existente is not None:
        # Fila huérfana previa (sin archivo): se completa con la ruta remota.
        existente.ruta_remota = ruta_remota[:255]
        if existente.id_caso is None:
            existente.id_caso = id_caso_vinculo
        db.commit()
        db.refresh(existente)
        return EvidenciaUploadOut(
            id_evidencia=existente.id_evidencia,
            serial_imagen=existente.serial_imagen,
            ruta_remota=existente.ruta_remota or "",
            url_firmada=_url_firmada(usuario, existente.id_evidencia),
        )

    ev = Evidencia(
        id_actividad=None,  # se vincula al crear la actividad en /sync/carga
        id_caso=id_caso_vinculo,
        tipo=tipo[:20],
        serial_imagen=serial,
        ruta_remota=ruta_remota[:255],
        latitud=latitud,
        longitud=longitud,
        fecha_hora=_parsear_datetime(fecha_hora) or datetime.now(UTC),
        origen_camara=True,
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return EvidenciaUploadOut(
        id_evidencia=ev.id_evidencia,
        serial_imagen=ev.serial_imagen,
        ruta_remota=ev.ruta_remota or "",
        url_firmada=_url_firmada(usuario, ev.id_evidencia),
    )


@router.get("/evidencias/{id_evidencia}", summary="Descargar una evidencia")
def descargar_evidencia(
    id_evidencia: int,
    token: Annotated[str | None, Query(include_in_schema=False)] = None,
    cred: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)] = None,
    db: Session = Depends(get_db),
) -> Response:
    """Sirve la imagen con el alcance de su caso.

    Acepta el Bearer habitual o el token de corta vida de `url_firmada` (emitido
    al subir la foto). Responde 404 si la evidencia no existe o el usuario no
    puede verla, para no confirmar su existencia.
    """
    if token:
        try:
            payload = decode_token(token)
        except jwt.PyJWTError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token de evidencia inválido o expirado",
            ) from exc
        if payload.get("ev") != id_evidencia:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Token de evidencia inválido"
            )
        usuario = db.scalar(select(Usuario).where(Usuario.p00 == payload.get("sub")))
        if usuario is None or not usuario.activo:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Token de evidencia inválido"
            )
        _configurar_sesion(db, usuario)
    else:
        usuario = get_current_user(cred, db)

    evidencia = db.get(Evidencia, id_evidencia)
    if evidencia is None or not _evidencia_visible(db, usuario, evidencia):
        raise HTTPException(status_code=404, detail="Evidencia no encontrada")
    try:
        contenido, mime = leer_evidencia(evidencia.ruta_remota or evidencia.ruta_local or "")
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="La evidencia no está disponible") from exc
    except StorageError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Almacenamiento de evidencias no disponible",
        ) from exc
    return Response(
        content=contenido,
        media_type=mime,
        headers={"Cache-Control": "private, max-age=300"},
    )


@router.post("/sync/carga", response_model=SyncCargaOut, summary="Cargar actividades y estados del día")
def sync_carga(
    datos: SyncCargaIn,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
) -> SyncCargaOut:
    payload = datos.model_dump(mode="python")
    resultado = svc.aplicar_carga(db, usuario, payload)
    return SyncCargaOut(**resultado)


# --------------------------------------------------------------------------- #
# Sesión de sincronización y checklist (D-81 · RF-39 / RF-40)
# --------------------------------------------------------------------------- #
@router.post(
    "/sync/sesion",
    response_model=SyncSesionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Abrir una sesión de sincronización",
)
def sync_abrir_sesion(
    datos: SyncSesionIn,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
) -> SyncSesionOut:
    sesion = svc.abrir_sesion(
        db,
        usuario,
        tipo=datos.tipo,
        dispositivo_id=datos.dispositivo_id,
        version_app=datos.version_app,
    )
    return SyncSesionOut(id_sync_log=sesion.id_sync_log)


@router.patch(
    "/sync/sesion/{id_sync_log}",
    response_model=SyncSesionCierreOut,
    summary="Cerrar una sesión de sincronización",
)
def sync_cerrar_sesion(
    id_sync_log: int,
    datos: SyncSesionCierreIn,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
) -> SyncSesionCierreOut:
    resultado = svc.cerrar_sesion(db, usuario, id_sync_log, datos.model_dump(mode="python"))
    return SyncSesionCierreOut(**resultado)


@router.patch(
    "/sync/checklist",
    response_model=SyncSesionOut,
    summary="Subir el checklist por paso (idempotente)",
)
def sync_checklist(
    id_sync_log: Annotated[int, Query(description="Sesión a la que pertenece el checklist")],
    datos: ChecklistIn,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
) -> SyncSesionOut:
    sesion = db.get(SyncLog, id_sync_log)
    if sesion is None or sesion.p00 != usuario.p00:
        raise HTTPException(status_code=404, detail="Sesión de sincronización no encontrada")
    svc.guardar_checklist(db, id_sync_log, [p.model_dump(mode="python") for p in datos.pasos])
    db.commit()
    return SyncSesionOut(id_sync_log=id_sync_log)
