"""GGTO API — esqueleto desplegable (Fase 1 / smoke test en GCP).

Servicio mínimo para validar el extremo a extremo:
Cloud Run -> Cloud SQL (base `ggtov2`) vía socket del conector.
El desarrollo funcional completo corresponde a la Fase 3.
"""

import os

import psycopg2
from fastapi import FastAPI, HTTPException

APP_VERSION = "0.1.0"

app = FastAPI(
    title="GGTO API",
    version=APP_VERSION,
    description="Sistema de administración de reportes de avería y puntos ópticos — CANTV Central Francisco Salias (Área 4)",
)


def db_config() -> dict:
    """Configuración de conexión tomada de variables de entorno."""
    return {
        "host": os.environ.get("DB_HOST", "localhost"),
        "port": int(os.environ.get("DB_PORT", "5432")),
        "dbname": os.environ.get("DB_NAME", "ggtov2"),
        "user": os.environ.get("DB_USER", "ggtov2_app"),
        "password": os.environ.get("DB_PASSWORD", ""),
        "connect_timeout": 15,
        "application_name": "ggto-web",
    }


def query(sql: str, params: tuple | None = None):
    """Ejecuta una consulta y devuelve (columnas, filas)."""
    conn = psycopg2.connect(**db_config())
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            cols = [d[0] for d in cur.description] if cur.description else []
            rows = cur.fetchall()
        return cols, rows
    finally:
        conn.close()


@app.get("/")
def root():
    return {
        "servicio": "GGTO API",
        "version": APP_VERSION,
        "estado": "desplegado (esqueleto)",
        "fase": "Fase 1 — Concepto completada; Fase 3 pendiente",
        "documentacion": "/docs",
    }


@app.get("/health")
def health():
    """Liveness: no toca la base de datos."""
    return {"status": "ok"}


@app.get("/ready")
def ready():
    """Readiness: verifica la conexión con PostgreSQL y el esquema desplegado."""
    try:
        cols, rows = query(
            """
            SELECT version() AS version,
                   current_database() AS base,
                   current_user AS usuario,
                   (SELECT count(*) FROM information_schema.tables
                     WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS tablas
            """
        )
        datos = dict(zip(cols, rows[0]))
        return {
            "status": "ready",
            "base": datos["base"],
            "usuario": datos["usuario"],
            "postgres": str(datos["version"]).split(" on ")[0],
            "tablas": datos["tablas"],
        }
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"BD no disponible: {type(exc).__name__}") from exc


@app.get("/api/v1/central")
def central():
    """Central configurada (base del filtro de ingesta)."""
    try:
        cols, rows = query(
            "SELECT id_central, codigo_central, nombre_central, municipio, parroquia "
            "FROM central ORDER BY id_central"
        )
        return {"items": [dict(zip(cols, r)) for r in rows]}
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"BD no disponible: {type(exc).__name__}") from exc


@app.get("/api/v1/resumen")
def resumen():
    """Conteo de entidades principales: evidencia de que el esquema quedó desplegado."""
    try:
        cols, rows = query(
            """
            SELECT
              (SELECT count(*) FROM information_schema.tables
                WHERE table_schema='public' AND table_type='BASE TABLE') AS tablas,
              (SELECT count(*) FROM central)     AS centrales,
              (SELECT count(*) FROM rol)         AS roles,
              (SELECT count(*) FROM cuadrilla)   AS cuadrillas,
              (SELECT count(*) FROM causa)       AS causas,
              (SELECT count(*) FROM configuracion) AS parametros
            """
        )
        return dict(zip(cols, rows[0]))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"BD no disponible: {type(exc).__name__}") from exc
