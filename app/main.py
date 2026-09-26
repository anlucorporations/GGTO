"""GGTO API — Sistema de administración de reportes de avería y puntos ópticos.

CANTV C.A. — Central Francisco Salias (Área 4).
Fase 3 · Ciclo 1: núcleo + autenticación.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import routes_auth, routes_health
from .core.config import get_settings

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "Plataforma de gestión de averías GPON y construcción de puntos ópticos. "
        "Ciclo 1: autenticación con P00 + clave, bloqueo a los 3 intentos y "
        "recuperación con 3 de las 12 palabras de seguridad."
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
