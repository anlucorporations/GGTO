"""GGTO API — Sistema de administración de reportes de avería y puntos ópticos.

CANTV C.A. — Central Francisco Salias (Área 4).
Fase 3 · Ciclos 1-7 y 9 completados (autenticación, configuración, ingesta, PANEL/CASOS,
DESPACHO, casos especiales/agenda, MONITOREO/REPORTES y ALERTAS/Telegram/MCP).
"""

import logging
import time
import uuid
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware

from .api import (
    routes_alertas,
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

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s %(levelname)s %(name)s %(message)s')
logger = logging.getLogger('ggto')

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

class ObservabilidadMiddleware(BaseHTTPMiddleware):
    """Añade un `request-id` y registra cada petición (RNF-19)."""

    async def dispatch(self, request, call_next):
        request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex[:12]
        inicio = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            logger.exception("request_id=%s %s %s fallo", request_id,
                             request.method, request.url.path)
            raise
        duracion = (time.perf_counter() - inicio) * 1000
        response.headers["X-Request-ID"] = request_id
        logger.info("request_id=%s %s %s -> %s %.1fms", request_id, request.method,
                    request.url.path, response.status_code, duracion)
        return response


app.add_middleware(ObservabilidadMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes_health.router)
app.include_router(routes_auth.router)
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


WEB_DIST = Path(__file__).resolve().parent / "web" / "dist"
if WEB_DIST.is_dir():
    app.mount("/", SPAStaticFiles(directory=str(WEB_DIST), html=True), name="web")
