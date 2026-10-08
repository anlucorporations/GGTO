"""Pruebas de integración del incremento D-88 — flujo de campo (RF-APK-11/12).

Requieren `GGTO_TEST_DB_URL`. Cubren:

- `POST /casos/{id}/no-contesta`: compone **una sola transacción** con el estado
  `CITADO`, la cita de 1ra visita y la actividad de `CONTACTO` con método `COS`
  («informado al COS»).
- `PATCH /casos/{id}/contacto`: el **técnico** corrige solo dirección y teléfono,
  con validación de la serie 700/701/702 y traza en `auditoria`.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.models import Actividad, Auditoria, Caso, CatalogoMetodo, Cita

BASE = "/api/v1"
CASOS = f"{BASE}/casos"


def _crear_caso(client, admin_token, id_averia: str = "TSTD88-1") -> dict:
    r = client.post(
        CASOS,
        json={
            "id_averia": id_averia,
            "direccion": "CALLE 4 CON AVENIDA 5",
            "nombre_cliente": "CLIENTE D88",
            "telefono": "7001234567",
        },
        headers=admin_token["admin"],
    )
    assert r.status_code == 201, r.text
    return r.json()


# --------------------------------------------------------------------------- #
# No Contesta (RF-APK-12)
# --------------------------------------------------------------------------- #
def test_no_contesta_compone_estado_cita_y_cos(client, admin_token, db_session):
    caso = _crear_caso(client, admin_token)
    manana = (datetime.now(UTC) + timedelta(days=1)).replace(
        hour=12, minute=0, second=0, microsecond=0
    )

    r = client.post(
        f"{CASOS}/{caso['id_caso']}/no-contesta",
        json={"fecha_hora": manana.isoformat()},
        headers=admin_token["tecnico"],
    )
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert cuerpo["accion"] == "NO_CONTESTA"
    assert cuerpo["estado_actual"] == "CITADO"
    assert cuerpo["id_cita"] and cuerpo["id_actividad"]

    db_session.expire_all()
    actualizado = db_session.get(Caso, caso["id_caso"])
    assert actualizado.estado_actual == "CITADO"
    assert actualizado.fecha_cita is not None

    # 1) La cita de 1ra visita quedó agendada con la hora enviada.
    cita = db_session.scalar(select(Cita).where(Cita.id_caso == caso["id_caso"]))
    assert cita is not None
    assert cita.fecha_hora.astimezone(UTC) == manana
    assert "1ra visita" in (cita.observacion or "")

    # 2) La actividad de contacto lleva el método CONTACTO/COS del catálogo.
    actividad = db_session.scalar(
        select(Actividad).where(Actividad.id_caso == caso["id_caso"])
    )
    assert actividad is not None and actividad.tipo == "CONTACTO"
    metodo = db_session.scalar(
        select(CatalogoMetodo).where(
            CatalogoMetodo.dominio == "CONTACTO", CatalogoMetodo.codigo == "COS"
        )
    )
    assert metodo is not None, "falta el método CONTACTO/COS sembrado por schema.sql"
    assert actividad.id_metodo == metodo.id_metodo


def test_no_contesta_sin_hora_propone_manana_a_las_ocho(client, admin_token, db_session):
    caso = _crear_caso(client, admin_token, "TSTD88-2")
    r = client.post(
        f"{CASOS}/{caso['id_caso']}/no-contesta",
        json={},
        headers=admin_token["tecnico"],
    )
    assert r.status_code == 200, r.text
    cita = db_session.scalar(select(Cita).where(Cita.id_caso == caso["id_caso"]))
    assert cita is not None
    assert (cita.fecha_hora.hour, cita.fecha_hora.minute) == (8, 0)


def test_no_contesta_rechaza_un_caso_cerrado(client, admin_token):
    caso = _crear_caso(client, admin_token, "TSTD88-3")
    cierre = client.patch(
        f"{CASOS}/{caso['id_caso']}",
        json={"estado_actual": "CERRADO"},
        headers=admin_token["admin"],
    )
    assert cierre.status_code == 200, cierre.text

    r = client.post(
        f"{CASOS}/{caso['id_caso']}/no-contesta",
        json={},
        headers=admin_token["tecnico"],
    )
    assert r.status_code == 409, r.text
    assert "no admite" in r.json()["detail"]


# --------------------------------------------------------------------------- #
# Edición del contacto desde el campo (RF-APK-11)
# --------------------------------------------------------------------------- #
def test_el_tecnico_corrige_contacto_y_queda_auditado(client, admin_token, db_session):
    caso = _crear_caso(client, admin_token, "TSTD88-4")

    r = client.patch(
        f"{CASOS}/{caso['id_caso']}/contacto",
        json={"direccion": "AVENIDA 7 CON CALLE 8", "telefono": "701-555-6677"},
        headers=admin_token["tecnico"],
    )
    assert r.status_code == 200, r.text
    assert r.json()["direccion"] == "AVENIDA 7 CON CALLE 8"
    # El teléfono se normaliza (se quitan guiones) antes de guardarlo.
    assert r.json()["telefono"] == "7015556677"

    db_session.expire_all()
    traza = db_session.scalar(
        select(Auditoria).where(
            Auditoria.accion == "CONTACTO_CAMPO",
            Auditoria.id_entidad == str(caso["id_caso"]),
        )
    )
    assert traza is not None, "la edición del técnico debe quedar auditada"
    assert traza.datos_antes["direccion"] == "CALLE 4 CON AVENIDA 5"
    assert traza.datos_despues["telefono"] == "7015556677"


def test_contacto_valida_la_serie_del_telefono(client, admin_token):
    caso = _crear_caso(client, admin_token, "TSTD88-5")
    r = client.patch(
        f"{CASOS}/{caso['id_caso']}/contacto",
        json={"telefono": "04121234567"},
        headers=admin_token["tecnico"],
    )
    assert r.status_code == 422, r.text
    assert "700" in r.text


def test_contacto_ignora_campos_ajenos(client, admin_token, db_session):
    """El técnico no puede cambiar el estado (ni nada que no sea dirección/teléfono)."""
    caso = _crear_caso(client, admin_token, "TSTD88-6")
    r = client.patch(
        f"{CASOS}/{caso['id_caso']}/contacto",
        json={"direccion": "CALLE 9 CON AVENIDA 10", "estado_actual": "CERRADO"},
        headers=admin_token["tecnico"],
    )
    assert r.status_code == 200, r.text
    assert r.json()["estado_actual"] != "CERRADO"

    db_session.expire_all()
    assert db_session.get(Caso, caso["id_caso"]).estado_actual != "CERRADO"


def test_contacto_en_caso_cerrado_se_rechaza(client, admin_token):
    caso = _crear_caso(client, admin_token, "TSTD88-7")
    client.patch(
        f"{CASOS}/{caso['id_caso']}",
        json={"estado_actual": "CERRADO"},
        headers=admin_token["admin"],
    )
    r = client.patch(
        f"{CASOS}/{caso['id_caso']}/contacto",
        json={"direccion": "CALLE 11 CON AVENIDA 12"},
        headers=admin_token["tecnico"],
    )
    assert r.status_code == 409, r.text


def test_contacto_sin_cambios_es_422(client, admin_token):
    caso = _crear_caso(client, admin_token, "TSTD88-8")
    r = client.patch(
        f"{CASOS}/{caso['id_caso']}/contacto",
        json={},
        headers=admin_token["tecnico"],
    )
    assert r.status_code == 422, r.text
    assert "dirección" in r.json()["detail"]
