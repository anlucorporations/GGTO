"""Configuración de pruebas.

Las pruebas unitarias no necesitan base de datos.
Las de integración se ejecutan si está definida `GGTO_TEST_DB_URL`; en ese caso se
crea el esquema completo a partir de `RepoTecnico/db/schema.sql` en el esquema
indicado por `GGTO_TEST_SCHEMA` (por defecto `public`).
"""

from __future__ import annotations

import os
import pathlib

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

RAIZ = pathlib.Path(__file__).resolve().parents[2]
SCHEMA_SQL = RAIZ / "RepoTecnico" / "db" / "schema.sql"
TEST_URL = os.environ.get("GGTO_TEST_DB_URL")
TEST_SCHEMA = os.environ.get("GGTO_TEST_SCHEMA", "public")


@pytest.fixture(autouse=True)
def _limpiar_rate_limit():
    """Aísla el limitador de intentos entre pruebas (RNF-22)."""
    from app.api import routes_auth

    routes_auth._intentos.clear()
    yield
    routes_auth._intentos.clear()


@pytest.fixture(scope="session")
def engine():
    if not TEST_URL:
        pytest.skip("GGTO_TEST_DB_URL no configurada: se omiten las pruebas de integración")
    connect_args = {}
    if TEST_SCHEMA != "public":
        # `public` se mantiene en el search_path para resolver las extensiones
        # (pgcrypto, pg_trgm) ya instaladas a nivel de base de datos.
        connect_args["options"] = f"-csearch_path={TEST_SCHEMA},public"
    eng = create_engine(TEST_URL, connect_args=connect_args, pool_pre_ping=True, future=True)
    raw = eng.raw_connection()
    try:
        cur = raw.cursor()
        if TEST_SCHEMA != "public":
            cur.execute(f'CREATE SCHEMA IF NOT EXISTS "{TEST_SCHEMA}"')
        cur.execute(SCHEMA_SQL.read_text(encoding="utf-8"))
        raw.commit()
    finally:
        raw.close()
    yield eng
    eng.dispose()


@pytest.fixture()
def db_session(engine):
    sesion = sessionmaker(bind=engine, expire_on_commit=False)()
    try:
        yield sesion
    finally:
        sesion.rollback()
        sesion.close()


@pytest.fixture()
def client(engine):
    from fastapi.testclient import TestClient

    from app.core.db import get_db
    from app.main import app

    fabrica = sessionmaker(bind=engine, expire_on_commit=False)

    def _override():
        sesion = fabrica()
        try:
            yield sesion
        finally:
            sesion.close()

    app.dependency_overrides[get_db] = _override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
