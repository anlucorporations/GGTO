"""Configuración de pruebas.

- Las pruebas unitarias no necesitan base de datos.
- Las de integración se ejecutan si está definida `GGTO_TEST_DB_URL`; el esquema
  completo se crea a partir de `RepoTecnico/db/schema.sql` en el esquema indicado
  por `GGTO_TEST_SCHEMA` (por defecto `public`).
"""

from __future__ import annotations

import os
import pathlib

import pytest
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import sessionmaker

from app.core.security import hash_password
from app.models import Central, Rol, Tecnico, Usuario

RAIZ = pathlib.Path(__file__).resolve().parents[2]
SCHEMA_SQL = RAIZ / "RepoTecnico" / "db" / "schema.sql"
MUESTRA_CSV = RAIZ / "RepoTecnico" / "muestras" / "detalle_averias_gpon_EJEMPLO.csv"
TEST_URL = os.environ.get("GGTO_TEST_DB_URL")
TEST_SCHEMA = os.environ.get("GGTO_TEST_SCHEMA", "public")

P00_ADMIN = "TESTADM"
P00_TEC = "TESTTEC"
P00_SUPER = "TESTSUP"
CLAVE_TEST = "config12345"

# Orden respetando las claves foráneas.
SQL_LIMPIEZA = """
DELETE FROM cita;
DELETE FROM seguimiento;
DELETE FROM caso_especial;
DELETE FROM solicitante;
DELETE FROM despacho;
DELETE FROM notificacion;
DELETE FROM falla_masiva;
DELETE FROM caso              WHERE id_averia LIKE 'DEMO-%' OR id_averia LIKE 'REF-%'
                                 OR id_averia LIKE 'MAN-%' OR id_averia LIKE 'TST%';
DELETE FROM ingesta_lote;
DELETE FROM cuadrilla_herramienta WHERE id_cuadrilla IN (SELECT id_cuadrilla FROM cuadrilla WHERE codigo LIKE 'TC%');
DELETE FROM cuadrilla_tecnico   WHERE id_cuadrilla IN (SELECT id_cuadrilla FROM cuadrilla WHERE codigo LIKE 'TC%');
DELETE FROM cuadrilla          WHERE codigo LIKE 'TC%';
DELETE FROM sector_direccion    WHERE id_sector IN (SELECT id_sector FROM sector WHERE codigo LIKE 'TS%');
DELETE FROM sector              WHERE codigo LIKE 'TS%';
DELETE FROM flota               WHERE can LIKE 'TCAN%';
DELETE FROM causa               WHERE codigo_causa LIKE 'T9%';
DELETE FROM dispositivo_seguridad WHERE p00 IN ('TESTADM','TESTTEC');
DELETE FROM usuario             WHERE p00 IN ('TESTADM','TESTTEC','TESTSUP');
DELETE FROM tecnico             WHERE p00 IN ('TESTADM','TESTTEC','TESTSUP');
DELETE FROM central             WHERE codigo_central LIKE 'TST%';
"""


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


def _limpiar(db) -> None:
    db.execute(text(SQL_LIMPIEZA))
    db.commit()


@pytest.fixture()
def admin_token(client, db_session):
    """Crea un ADMIN y un TECNICO y devuelve sus cabeceras de autenticación."""
    _limpiar(db_session)

    id_central = db_session.scalar(
        select(Central.id_central).where(Central.codigo_central == "2324X")
    )
    rol_admin = db_session.scalar(select(Rol).where(Rol.codigo == "ADMIN"))
    rol_tec = db_session.scalar(select(Rol).where(Rol.codigo == "TECNICO"))
    rol_super = db_session.scalar(select(Rol).where(Rol.codigo == "SUPER"))

    admin_tec = Tecnico(id_central=id_central, nombre="ADMIN", apellido="TEST", p00=P00_ADMIN)
    tec_tec = Tecnico(id_central=id_central, nombre="TECNICO", apellido="TEST", p00=P00_TEC)
    sup_tec = Tecnico(id_central=id_central, nombre="SUPER", apellido="TEST", p00=P00_SUPER)
    db_session.add_all([admin_tec, tec_tec, sup_tec])
    db_session.flush()

    db_session.add_all([
        Usuario(p00=P00_ADMIN, clave_hash=hash_password(CLAVE_TEST), id_rol=rol_admin.id_rol,
                id_tecnico=admin_tec.id_tecnico, id_central=id_central),
        Usuario(p00=P00_TEC, clave_hash=hash_password(CLAVE_TEST), id_rol=rol_tec.id_rol,
                id_tecnico=tec_tec.id_tecnico, id_central=id_central),
        Usuario(p00=P00_SUPER, clave_hash=hash_password(CLAVE_TEST), id_rol=rol_super.id_rol,
                id_tecnico=sup_tec.id_tecnico, id_central=id_central),
    ])
    db_session.commit()

    admin = client.post("/api/v1/auth/login", json={"p00": P00_ADMIN, "clave": CLAVE_TEST})
    assert admin.status_code == 200, admin.text
    tecnico = client.post("/api/v1/auth/login", json={"p00": P00_TEC, "clave": CLAVE_TEST})
    assert tecnico.status_code == 200, tecnico.text
    superu = client.post("/api/v1/auth/login", json={"p00": P00_SUPER, "clave": CLAVE_TEST})
    assert superu.status_code == 200, superu.text

    yield {
        "admin": {"Authorization": f"Bearer {admin.json()['access_token']}"},
        "tecnico": {"Authorization": f"Bearer {tecnico.json()['access_token']}"},
        "super": {"Authorization": f"Bearer {superu.json()['access_token']}"},
        "id_central": id_central,
    }

    _limpiar(db_session)
