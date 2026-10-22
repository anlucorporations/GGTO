"""GGTO API — Sistema de administración de reportes de avería y puntos ópticos.

CANTV C.A. — Central Francisco Salias (Área 4).
Fase 3 · Ciclos 1-7 y 9 completados (autenticación, configuración, ingesta, PANEL/CASOS,
DESPACHO, casos especiales/agenda, MONITOREO/REPORTES y ALERTAS/Telegram/MCP).
"""

import logging
import os
import re
import time
import uuid
from pathlib import Path

import jwt
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.datastructures import Headers, MutableHeaders
from starlette.exceptions import HTTPException as StarletteHTTPException

from .api import (
    routes_alertas,
    routes_auditoria,
    routes_auth,
    routes_casos,
    routes_config,
    routes_despachos,
    routes_especiales,
    routes_health,
    routes_ingesta,
    routes_mantenimiento,
    routes_mensajes,
    routes_monitoreo,
    routes_panel,
    routes_sincronizacion,
    routes_sistemas,
    routes_sync,
)
from .core.config import get_settings
from .core.observabilidad import (
    configurar_logging,
    iniciar_request,
    limpiar_contexto,
    vincular_usuario,
)
from .core.security import decode_token

configurar_logging()
logger = logging.getLogger("ggto")

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "Plataforma de gestión de averías GPON y construcción de puntos ópticos. "
        "Ciclos 1-7: autenticación (P00 + clave, bloqueo y 12 palabras), configuración, "
        "ingesta del CSV diario, PANEL/CASOS, DESPACHO, casos especiales y agenda, "
        "y MONITOREO/REPORTES."
    ),
)

class ObservabilidadMiddleware:
    """Añade un `request-id` y registra cada petición como JSON (RNF-19).

    Es un middleware ASGI puro (no `BaseHTTPMiddleware`) para conservar el
    contexto en la misma tarea. El P00 y el rol se toman del JWT **firmado**
    solo como datos de trazabilidad; la autorización real sigue en
    `get_current_user`. Así los logs de los servicios, incluso en el hilo de
    las dependencias síncronas, comparten request-id, usuario y rol.
    """

    _ID_VALIDO = re.compile(r"^[A-Za-z0-9._-]{1,64}$")

    def __init__(self, app) -> None:
        self.app = app

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = Headers(scope=scope)
        solicitado = headers.get("X-Request-ID", "")
        request_id = (
            solicitado
            if self._ID_VALIDO.fullmatch(solicitado)
            else uuid.uuid4().hex[:12]
        )
        iniciar_request(request_id)

        autorizacion = headers.get("Authorization", "")
        if autorizacion.lower().startswith("bearer "):
            try:
                payload = decode_token(autorizacion[7:].strip())
            except jwt.PyJWTError:
                payload = {}
            if payload.get("sub"):
                vincular_usuario(
                    str(payload["sub"]), str(payload.get("rol") or "")
                )

        metodo = scope.get("method", "")
        ruta = scope.get("path", "")
        inicio = time.perf_counter()
        estado = 500

        async def enviar(message) -> None:
            nonlocal estado
            if message["type"] == "http.response.start":
                estado = message["status"]
                respuesta = MutableHeaders(scope=message)
                respuesta["X-Request-ID"] = request_id
            await send(message)

        try:
            await self.app(scope, receive, enviar)
        except Exception:
            duracion = (time.perf_counter() - inicio) * 1000
            logger.exception(
                "http_request",
                extra={
                    "evento": "http_request",
                    "metodo": metodo,
                    "ruta": ruta,
                    "status": 500,
                    "ms": round(duracion, 1),
                },
            )
            raise
        else:
            duracion = (time.perf_counter() - inicio) * 1000
            nivel = (
                logging.ERROR
                if estado >= 500
                else logging.WARNING
                if duracion >= 2000
                else logging.INFO
            )
            logger.log(
                nivel,
                "http_request",
                extra={
                    "evento": "http_request",
                    "metodo": metodo,
                    "ruta": ruta,
                    "status": estado,
                    "ms": round(duracion, 1),
                },
            )
        finally:
            limpiar_contexto()


app.add_middleware(ObservabilidadMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)

app.include_router(routes_health.router)
app.include_router(routes_auth.router)
app.include_router(routes_auditoria.router)
app.include_router(routes_config.router)
app.include_router(routes_ingesta.router)
app.include_router(routes_casos.router)
app.include_router(routes_despachos.router)
app.include_router(routes_especiales.router)
app.include_router(routes_monitoreo.router)
app.include_router(routes_alertas.router)
app.include_router(routes_sistemas.router)
app.include_router(routes_sync.router)
app.include_router(routes_sincronizacion.router)
app.include_router(routes_mensajes.router)
app.include_router(routes_panel.router)
app.include_router(routes_mantenimiento.router)


# --------------------------------------------------------------------------- #
# Web de administración (SPA React). Se monta al final para no tapar la API.
# --------------------------------------------------------------------------- #
class SPAStaticFiles(StaticFiles):
    """Sirve `index.html` ante rutas del cliente (deep links de React Router)."""

    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code == 404:
                return await super().get_response("index.html", scope)
            raise


# --------------------------------------------------------------------------- #
# Evidencias locales (H-05): en producción se sirven por la ruta autenticada
# `/api/v1/evidencias/{id}` desde Cloud Storage. El montaje directo queda solo
# para desarrollo; en producción la ruta responde 404 (nunca el HTML de la SPA).
# --------------------------------------------------------------------------- #
_APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
if _APP_ENV in {"production", "produccion", "producción", "prod"}:

    @app.get("/evidencias-locales/{ruta:path}", include_in_schema=False)
    def evidencias_locales_no_disponibles(ruta: str) -> None:
        raise HTTPException(status_code=404, detail="No encontrada")

else:
    EVIDENCIAS_DIR = Path(os.getenv("GGTO_EVIDENCIAS_DIR", ".evidencias"))
    app.mount(
        "/evidencias-locales",
        StaticFiles(directory=str(EVIDENCIAS_DIR), check_dir=False),
        name="evidencias-locales",
    )


WEB_DIST = Path(__file__).resolve().parent / "web" / "dist"
if WEB_DIST.is_dir():
    app.mount("/", SPAStaticFiles(directory=str(WEB_DIST), html=True), name="web")
