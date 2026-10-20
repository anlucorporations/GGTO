"""Pruebas de integración del incremento D-112 — el TÉCNICO resuelve en campo.

La prueba de campo sobre la APK (emulador + `/sync/carga`) destapó que el
TÉCNICO no podía cerrar, enrutar ni agendar: `POST /casos/{id}/cierre`,
`/enrutado`, `/cita` y `POST /citas` exigían ADMIN/SUPERVISOR, así que la API
respondía **403**, la acción quedaba en la cola del dispositivo y el caso nunca
se actualizaba.

Estas pruebas fijan el contrato corregido: el TÉCNICO (rol de campo) puede
resolver el caso que atiende, y el ADMIN sigue pudiendo hacerlo.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.models import Caso

BASE = "/api/v1"
CASOS = f"{BASE}/casos"


def _caso(client, admin_token, db_session, id_averia: str) -> dict:
    """Caso abierto con los datos obligatorios (RN-AL-01)."""
    r = client.post(
        CASOS,
        json={
            "id_averia": id_averia,
            "direccion": "TEST GGTO NORTE, CALLE 1, CASA 1",
            "nombre_cliente": "CLIENTE D112",
            "contacto_cliente": "04243109000",
            "id_pago": "7001234567",
            "tipo_reporte": "REPARACION",
            "tipo_problema": "SIN_SERVICIO",
        },
        headers=admin_token["admin"],
    )
    assert r.status_code == 201, r.text
    # D-123: el caso debe estar en la cuadrilla del TÉCNICO.
    from app.tests.conftest import asignar_caso_al_tecnico

    asignar_caso_al_tecnico(db_session, admin_token, r.json()["id_caso"])
    return r.json()


def _manana() -> datetime:
    return (datetime.now(UTC) + timedelta(days=1)).replace(
        hour=12, minute=0, second=0, microsecond=0
    )


# --------------------------------------------------------------------------- #
# Cierre en campo (RF-APK-06 · RF-15)
# --------------------------------------------------------------------------- #
def test_tecnico_cierra_el_caso(client, admin_token, db_session):
    caso = _caso(client, admin_token, db_session, "TSTD112-C")

    r = client.post(
        f"{CASOS}/{caso['id_caso']}/cierre",
        json={
            "modo": "COS",
            "descripcion": "TEST se reemplazo el conector y se verifico la potencia",
            "evidencias": ["EVD-D112-1", "EVD-D112-2"],
        },
        headers=admin_token["tecnico"],
    )
    assert r.status_code == 200, r.text
    assert r.json()["accion"] == "CIERRE"
    assert r.json()["estado_actual"] == "CERRADO"

    db_session.expire_all()
    assert db_session.get(Caso, caso["id_caso"]).estado_actual == "CERRADO"


def test_admin_sigue_pudiendo_cerrar(client, admin_token, db_session):
    caso = _caso(client, admin_token, db_session, "TSTD112-A")
    r = client.post(
        f"{CASOS}/{caso['id_caso']}/cierre",
        json={"modo": "IVR", "descripcion": "TEST cierre administrativo con IVR"},
        headers=admin_token["admin"],
    )
    assert r.status_code == 200, r.text
    assert r.json()["estado_actual"] == "CERRADO"


# --------------------------------------------------------------------------- #
# Enrutado en campo (RF-APK-06 · RF-13)
# --------------------------------------------------------------------------- #
def test_tecnico_enruta_el_caso(client, admin_token, db_session):
    caso = _caso(client, admin_token, db_session, "TSTD112-E")

    r = client.post(
        f"{CASOS}/{caso['id_caso']}/enrutado",
        json={"destino": "COS", "motivo": "TEST requiere soporte del COS"},
        headers=admin_token["tecnico"],
    )
    assert r.status_code == 200, r.text
    # La API nombra la acción «ENRUTE».
    assert r.json()["accion"] in {"ENRUTADO", "ENRUTE"}

    db_session.expire_all()
    assert db_session.get(Caso, caso["id_caso"]).estado_actual == "ENRUTADO"


# --------------------------------------------------------------------------- #
# Citas en campo (RF-APK-06 · RF-12)
# --------------------------------------------------------------------------- #
def test_tecnico_agenda_cita_desde_la_apk(client, admin_token, db_session):
    caso = _caso(client, admin_token, db_session, "TSTD112-T")
    manana = _manana()

    r = client.post(
        f"{BASE}/citas",
        json={
            "id_caso": caso["id_caso"],
            "fecha_hora": manana.isoformat(),
            "tipo": "ATENCION",
            "observacion": "TEST cita agendada desde la APK",
        },
        headers=admin_token["tecnico"],
    )
    assert r.status_code == 201, r.text
    assert r.json()["id_caso"] == caso["id_caso"]


def test_tecnico_usa_la_cita_rapida_de_la_ficha(client, admin_token, db_session):
    caso = _caso(client, admin_token, db_session, "TSTD112-R")
    manana = _manana()

    r = client.post(
        f"{CASOS}/{caso['id_caso']}/cita",
        json={"fecha_hora": manana.isoformat(), "tipo": "ATENCION"},
        headers=admin_token["tecnico"],
    )
    assert r.status_code == 200, r.text
    assert r.json()["accion"] == "CITA"

    db_session.expire_all()
    assert db_session.get(Caso, caso["id_caso"]).fecha_cita is not None
