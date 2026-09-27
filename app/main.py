"""GGTO API — Sistema de administración de reportes de avería y puntos ópticos.

CANTV C.A. — Central Francisco Salias (Área 4).
Fase 3 · Ciclos 1-7 completados (autenticación, configuración, ingesta, PANEL/CASOS,
DESPACHO, casos especiales/agenda y MONITOREO/REPORTES).
"""

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from .api import (
    routes_auth,
    routes_casos,
    routes_config,
    routes_despachos,
    routes_especiales,
    routes_health,
    routes_ingesta,
    routes_monitoreo,
)
from .core.config import get_settings

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
