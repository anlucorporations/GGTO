"""Pruebas de integración del incremento D-81 — sincronización y mantenimiento.

Requieren `GGTO_TEST_DB_URL` (se omiten si no está configurada). Cubren CU-D81-01,
CU-D81-02, CU-D81-03 y los jobs de mantenimiento (C-01, M-09).
"""

from __future__ import annotations

from datetime import date

from sqlalchemy import select

from app.models import Cuadrilla, CuadrillaTecnico, Tecnico

P00_TEC = "TESTTEC"


def _asignar_cuadrilla(db_session, admin_token) -> Cuadrilla:
    c = Cuadrilla(
        id_central=admin_token["id_central"],
        codigo="TCD81",
        nombre="Cuadrilla D81",
        es_supervisor=False,
    )
    db_session.add(c)
    db_session.flush()
    tec = db_session.scalar(select(Tecnico).where(Tecnico.p00 == P00_TEC))
    db_session.add(
        CuadrillaTecnico(
            id_cuadrilla=c.id_cuadrilla, id_tecnico=tec.id_tecnico, desde=date(2020, 1, 1)
        )
    )
    db_session.commit()
    return c


# --------------------------------------------------------------------------- #
# CU-D81-01 — Registrar (loguear) una sesión
# --------------------------------------------------------------------------- #
def test_abrir_y_cerrar_sesion_ok(client, admin_token, db_session):
    _asignar_cuadrilla(db_session, admin_token)
    r = client.post(
        "/api/v1/sync/sesion",
        json={"tipo": "DESCARGA", "dispositivo_id": "DEV-1", "version_app": "1.0"},
        headers=admin_token["tecnico"],
    )
    assert r.status_code == 201, r.text
    id_log = r.json()["id_sync_log"]
    assert id_log > 0

    r2 = client.patch(
        f"/api/v1/sync/sesion/{id_log}",
        json={"recibidos": 12, "procesados": 12, "errores": 0},
        headers=admin_token["tecnico"],
    )
    assert r2.status_code == 200, r2.text
    cuerpo = r2.json()
    assert cuerpo["estado"] == "OK" and cuerpo["duracion_ms"] >= 0


def test_cerrar_sesion_parcial_y_doble_cierre(client, admin_token, db_session):
    _asignar_cuadrilla(db_session, admin_token)
    id_log = client.post(
        "/api/v1/sync/sesion", json={"tipo": "CARGA"}, headers=admin_token["tecnico"]
    ).json()["id_sync_log"]

    r = client.patch(
        f"/api/v1/sync/sesion/{id_log}",
        json={"recibidos": 10, "procesados": 8, "errores": 2},
        headers=admin_token["tecnico"],
    )
    assert r.status_code == 200 and r.json()["estado"] == "PARCIAL"

    r2 = client.patch(
        f"/api/v1/sync/sesion/{id_log}",
        json={"recibidos": 1, "procesados": 1, "errores": 0},
        headers=admin_token["tecnico"],
    )
    assert r2.status_code == 409


def test_sesion_sin_cuadrilla_queda_error(client, admin_token):
    # El técnico de prueba no tiene cuadrilla asignada.
    id_log = client.post(
        "/api/v1/sync/sesion", json={"tipo": "CARGA"}, headers=admin_token["tecnico"]
    ).json()["id_sync_log"]
    r = client.patch(
        f"/api/v1/sync/sesion/{id_log}",
        json={"recibidos": 0, "procesados": 0, "errores": 0},
        headers=admin_token["tecnico"],
    )
    assert r.status_code == 200 and r.json()["estado"] == "ERROR"


def test_tipo_de_sesion_invalido(client, admin_token):
    r = client.post(
        "/api/v1/sync/sesion", json={"tipo": "SYNC_WEB"}, headers=admin_token["tecnico"]
    )
    assert r.status_code == 422  # solo DESCARGA/CARGA (H-04/A-02)


# --------------------------------------------------------------------------- #
# CU-D81-03 — Checklist por paso
# --------------------------------------------------------------------------- #
def test_checklist_por_paso_y_omitido(client, admin_token, db_session):
    _asignar_cuadrilla(db_session, admin_token)
    id_log = client.post(
        "/api/v1/sync/sesion", json={"tipo": "DESCARGA"}, headers=admin_token["tecnico"]
    ).json()["id_sync_log"]

    # Fallo de conexión: CONEXION=ERROR, el resto OMITIDO (subida posterior, C-03).
    r = client.patch(
        f"/api/v1/sync/sesion/{id_log}",
        json={
            "recibidos": 0,
            "procesados": 0,
            "errores": 1,
            "checklist": [
                {"paso": "CONEXION", "estado": "ERROR", "detalle": {"conexion": "timeout"}},
                {"paso": "LOGIN", "estado": "OMITIDO"},
                {"paso": "DESCARGA", "estado": "OMITIDO"},
                {"paso": "CARGA", "estado": "OMITIDO"},
            ],
        },
        headers=admin_token["tecnico"],
    )
    assert r.status_code == 200

    det = client.get(f"/api/v1/sincronizaciones/{id_log}", headers=admin_token["admin"]).json()
    pasos = {p["paso"]: p["estado"] for p in det["checklist"]}
    assert pasos == {"CONEXION": "ERROR", "LOGIN": "OMITIDO", "DESCARGA": "OMITIDO", "CARGA": "OMITIDO"}


# --------------------------------------------------------------------------- #
# CU-D81-02 — Consultar el log (RBAC y detalle)
# --------------------------------------------------------------------------- #
def test_log_rbac_y_listado(client, admin_token, db_session):
    _asignar_cuadrilla(db_session, admin_token)
    id_log = client.post(
        "/api/v1/sync/sesion", json={"tipo": "DESCARGA"}, headers=admin_token["tecnico"]
    ).json()["id_sync_log"]
    client.patch(
        f"/api/v1/sync/sesion/{id_log}",
        json={"recibidos": 5, "procesados": 5, "errores": 0},
        headers=admin_token["tecnico"],
    )

    assert client.get("/api/v1/sincronizaciones", headers=admin_token["tecnico"]).status_code == 403
    r = client.get("/api/v1/sincronizaciones", headers=admin_token["admin"])
    assert r.status_code == 200 and r.json()["total"] >= 1

    res = client.get("/api/v1/sincronizaciones/resumen", headers=admin_token["supervisor"])
    assert res.status_code == 200 and "total" in res.json()


# --------------------------------------------------------------------------- #
# Mantenimiento (C-01 / M-09)
# --------------------------------------------------------------------------- #
def test_mantenimiento_token_fail_closed(client, admin_token, monkeypatch):
    from app.core.config import get_settings

    monkeypatch.setenv("MANTENIMIENTO_TOKEN", "")
    get_settings.cache_clear()
    try:
        r = client.post("/api/v1/mantenimiento/purgar")
        assert r.status_code == 503
    finally:
        get_settings.cache_clear()


def test_mantenimiento_purgar_con_token(client, admin_token, monkeypatch):
    from app.core.config import get_settings

    monkeypatch.setenv("MANTENIMIENTO_TOKEN", "tok-123")
    get_settings.cache_clear()
    try:
        assert client.post("/api/v1/mantenimiento/purgar").status_code == 401
        r = client.post(
            "/api/v1/mantenimiento/purgar", headers={"X-Mantenimiento-Token": "tok-123"}
        )
        assert r.status_code == 200 and "mensajes_eliminados" in r.json()
        r2 = client.post(
            "/api/v1/mantenimiento/cerrar-sesiones",
            headers={"X-Mantenimiento-Token": "tok-123"},
        )
        assert r2.status_code == 200 and "cerradas" in r2.json()
    finally:
        get_settings.cache_clear()
