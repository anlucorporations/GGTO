"""Pruebas de integración del Ciclo 2: configuración y RBAC."""

from __future__ import annotations

import pytest
from sqlalchemy import select, text

from app.core.security import hash_password
from app.models import Central, Rol, Tecnico, Usuario

P00_ADMIN = "TESTADM"
P00_TEC = "TESTTEC"
CLAVE = "config12345"

SQL_LIMPIEZA = """
DELETE FROM cuadrilla_herramienta WHERE id_cuadrilla IN (SELECT id_cuadrilla FROM cuadrilla WHERE codigo LIKE 'TC%');
DELETE FROM cuadrilla_tecnico   WHERE id_cuadrilla IN (SELECT id_cuadrilla FROM cuadrilla WHERE codigo LIKE 'TC%');
DELETE FROM cuadrilla          WHERE codigo LIKE 'TC%';
DELETE FROM sector_direccion    WHERE id_sector IN (SELECT id_sector FROM sector WHERE codigo LIKE 'TS%');
DELETE FROM sector              WHERE codigo LIKE 'TS%';
DELETE FROM flota               WHERE can LIKE 'TCAN%';
DELETE FROM causa               WHERE codigo_causa LIKE 'T9%';
DELETE FROM usuario             WHERE p00 IN ('TESTADM','TESTTEC');
DELETE FROM tecnico             WHERE p00 IN ('TESTADM','TESTTEC');
DELETE FROM central             WHERE codigo_central LIKE 'TST%';
"""


@pytest.fixture()
def admin_token(client, db_session):
    """Crea un ADMIN y devuelve su token; limpia los datos de prueba al final."""
    db_session.execute(text(SQL_LIMPIEZA))
    db_session.commit()

    id_central = db_session.scalar(
        select(Central.id_central).where(Central.codigo_central == "2324X")
    )
    rol_admin = db_session.scalar(select(Rol).where(Rol.codigo == "ADMIN"))
    rol_tec = db_session.scalar(select(Rol).where(Rol.codigo == "TECNICO"))

    admin_tec = Tecnico(id_central=id_central, nombre="ADMIN", apellido="TEST", p00=P00_ADMIN)
    tec_tec = Tecnico(id_central=id_central, nombre="TECNICO", apellido="TEST", p00=P00_TEC)
    db_session.add_all([admin_tec, tec_tec])
    db_session.flush()

    db_session.add_all([
        Usuario(p00=P00_ADMIN, clave_hash=hash_password(CLAVE), id_rol=rol_admin.id_rol,
                id_tecnico=admin_tec.id_tecnico, id_central=id_central),
        Usuario(p00=P00_TEC, clave_hash=hash_password(CLAVE), id_rol=rol_tec.id_rol,
                id_tecnico=tec_tec.id_tecnico, id_central=id_central),
    ])
    db_session.commit()

    admin = client.post("/api/v1/auth/login", json={"p00": P00_ADMIN, "clave": CLAVE})
    assert admin.status_code == 200, admin.text
    tecnico = client.post("/api/v1/auth/login", json={"p00": P00_TEC, "clave": CLAVE})
    assert tecnico.status_code == 200, tecnico.text

    yield {
        "admin": {"Authorization": f"Bearer {admin.json()['access_token']}"},
        "tecnico": {"Authorization": f"Bearer {tecnico.json()['access_token']}"},
        "id_central": id_central,
    }

    db_session.execute(text(SQL_LIMPIEZA))
    db_session.commit()


def test_sin_token_devuelve_401(client):
    assert client.get("/api/v1/central").status_code == 401


def test_listar_central_incluye_la_sembrada(client, admin_token):
    r = client.get("/api/v1/central", headers=admin_token["admin"])
    assert r.status_code == 200
    codigos = {c["codigo_central"] for c in r.json()}
    assert "2324X" in codigos


def test_crear_y_actualizar_central(client, admin_token):
    payload = {
        "region": "CAPITAL", "estado_geografico": "MIRANDA", "municipio": "CARACAS",
        "parroquia": "PETARE", "area": "AREA 9", "codigo_central": "TST9",
        "nombre_central": "CENTRAL DE PRUEBA",
    }
    r = client.post("/api/v1/central", json=payload, headers=admin_token["admin"])
    assert r.status_code == 201, r.text
    idc = r.json()["id_central"]

    duplicado = client.post("/api/v1/central", json=payload, headers=admin_token["admin"])
    assert duplicado.status_code == 409

    r2 = client.patch(f"/api/v1/central/{idc}", json={"nombre_central": "RENOMBRADA"},
                      headers=admin_token["admin"])
    assert r2.status_code == 200
    assert r2.json()["nombre_central"] == "RENOMBRADA"


def test_crear_sector_con_direcciones(client, admin_token):
    payload = {
        "id_central": admin_token["id_central"], "nombre": "Norte 1", "codigo": "TS1",
        "prioridad": 10,
        "direcciones": [
            {"patron": "VALLE ARRIBA"},
            {"patron": "CONCRESA"},
            {"patron": "PARQUE HUMBOLDT", "tipo_coincidencia": "CONTIENE"},
        ],
    }
    r = client.post("/api/v1/sectores", json=payload, headers=admin_token["admin"])
    assert r.status_code == 201, r.text
    cuerpo = r.json()
    assert len(cuerpo["direcciones"]) == 3

    # Dirección duplicada en el mismo sector → 409
    dup = client.post(
        f"/api/v1/sectores/{cuerpo['id_sector']}/direcciones",
        json={"patron": "VALLE ARRIBA"},
        headers=admin_token["admin"],
    )
    assert dup.status_code == 409

    listado = client.get("/api/v1/sectores", headers=admin_token["admin"])
    assert any(s["codigo"] == "TS1" for s in listado.json())


def test_crear_tecnico_y_duplicado(client, admin_token):
    payload = {
        "id_central": admin_token["id_central"], "nombre": "JUAN", "apellido": "PEREZ",
        "cedula": "V-12345678", "p00": "TESTADM",
    }
    r = client.post("/api/v1/tecnicos", json=payload, headers=admin_token["admin"])
    assert r.status_code == 409  # el p00 ya existe (fixture)


def test_crear_flota(client, admin_token):
    r = client.post(
        "/api/v1/flota",
        json={"id_central": admin_token["id_central"], "can": "TCAN01", "tipo": "CAMIONETA",
              "marca": "TOYOTA", "status": "DISPONIBLE"},
        headers=admin_token["admin"],
    )
    assert r.status_code == 201, r.text
    id_flota = r.json()["id_flota"]

    r2 = client.patch(f"/api/v1/flota/{id_flota}", json={"status": "MANTENIMIENTO"},
                      headers=admin_token["admin"])
    assert r2.status_code == 200
    assert r2.json()["status"] == "MANTENIMIENTO"


def test_crear_cuadrilla_con_integrantes(client, admin_token):
    flota = client.post(
        "/api/v1/flota",
        json={"id_central": admin_token["id_central"], "can": "TCAN02"},
        headers=admin_token["admin"],
    ).json()
    id_tecnico = client.get(
        "/api/v1/tecnicos?status=ACTIVO", headers=admin_token["admin"]
    ).json()[0]["id_tecnico"]

    r = client.post(
        "/api/v1/cuadrillas",
        json={
            "id_central": admin_token["id_central"], "codigo": "TC01", "nombre": "Cuadrilla Prueba",
            "id_flota": flota["id_flota"],
            "integrantes": [{"id_tecnico": id_tecnico, "rol_cuadrilla": "REPARADOR_PRINCIPAL"}],
        },
        headers=admin_token["admin"],
    )
    assert r.status_code == 201, r.text
    cuerpo = r.json()
    assert cuerpo["codigo"] == "TC01"
    assert len(cuerpo["integrantes"]) == 1

    retirar = client.delete(
        f"/api/v1/cuadrillas/{cuerpo['id_cuadrilla']}/integrantes/{id_tecnico}",
        headers=admin_token["admin"],
    )
    assert retirar.status_code == 204


def test_catalogos_causas(client, admin_token):
    r = client.post(
        "/api/v1/catalogos/causas",
        json={"codigo_causa": "T901", "descripcion": "Causa de prueba"},
        headers=admin_token["admin"],
    )
    assert r.status_code == 201, r.text
    listado = client.get("/api/v1/catalogos/causas", headers=admin_token["admin"])
    assert any(c["codigo_causa"] == "T901" for c in listado.json())


def test_configuracion_listar_y_actualizar(client, admin_token):
    listado = client.get("/api/v1/configuracion", headers=admin_token["admin"])
    assert listado.status_code == 200
    claves = {c["clave"] for c in listado.json()}
    assert "despacho.min_referidos" in claves

    r = client.put("/api/v1/configuracion/despacho.min_referidos",
                   json={"valor": 3}, headers=admin_token["admin"])
    assert r.status_code == 200
    assert r.json()["valor"] == 3

    # Restaura el valor original para no dejar la base modificada.
    client.put("/api/v1/configuracion/despacho.min_referidos",
               json={"valor": 2}, headers=admin_token["admin"])


def test_rbac_tecnico_no_puede_crear(client, admin_token):
    r = client.post(
        "/api/v1/flota",
        json={"id_central": admin_token["id_central"], "can": "TCAN99"},
        headers=admin_token["tecnico"],
    )
    assert r.status_code == 403


def test_rbac_tecnico_puede_leer(client, admin_token):
    r = client.get("/api/v1/central", headers=admin_token["tecnico"])
    assert r.status_code == 200
