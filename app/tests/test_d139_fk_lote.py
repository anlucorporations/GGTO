"""D-139 · Una FK inválida rechaza su ítem, no el lote entero (H-22).

Defecto (auditoría V3): `id_metodo`/`id_causa` que manda la APK no se validaban. Si
llegaba un id que no existía, la FK reventaba al insertar la actividad con **500** y
se perdía **todo el lote** (todas las acciones del técnico).

Regla: el ítem con la FK rota se rechaza con su motivo y el resto del lote se
aplica con normalidad.
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from sqlalchemy import select

from app.models import Actividad
from app.tests.conftest import asignar_caso_al_tecnico

CASOS = "/api/v1/casos"
SYNC = "/api/v1/sync/carga"


@pytest.fixture()
def entorno(client, admin_token, db_session):
    r = client.post(
        CASOS,
        json={
            "id_averia": "TSTD139-1",
            "direccion": "SECTOR D139 CASA 1",
            "nombre_cliente": "CLIENTE D139",
            "contacto_cliente": "04142223344",
            "id_pago": "7014003141",
            "tipo_reporte": "REPARACION",
            "tipo_problema": "SIN_SERVICIO",
        },
        headers=admin_token["admin"],
    )
    assert r.status_code == 201, r.text
    id_caso = r.json()["id_caso"]
    asignar_caso_al_tecnico(db_session, admin_token, id_caso)
    return {"headers": admin_token["tecnico"], "id_caso": id_caso}


def _actividad(id_caso: int, local: int, **extra) -> dict:
    cuerpo = {
        "id_actividad_local": local,
        "id_caso": id_caso,
        "tipo": "CONTACTO",
        "resultado": "EXITOSO",
        "reporte_corto": f"Acción {local}",
        "fecha_hora": datetime.now(UTC).isoformat(),
        "evidencias": [],
    }
    cuerpo.update(extra)
    return cuerpo


def _carga(client, entorno, actividades):
    return client.post(
        SYNC,
        json={"dispositivo_id": "DEV-D139", "actividades": actividades, "estados": []},
        headers=entorno["headers"],
    )


def test_un_metodo_inexistente_no_tumba_el_lote(client, entorno, db_session):
    r = _carga(
        client,
        entorno,
        [
            _actividad(entorno["id_caso"], 1, id_metodo=999999),
            _actividad(entorno["id_caso"], 2, reporte_corto="Acción válida del lote"),
        ],
    )
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    assert items[0]["aceptada"] is False
    assert "método" in (items[0]["mensaje"] or "").lower()
    assert items[1]["aceptada"] is True

    db_session.expire_all()
    actividades = list(
        db_session.scalars(select(Actividad).where(Actividad.id_caso == entorno["id_caso"])).all()
    )
    assert len(actividades) == 1, "solo se registró la acción válida"


def test_una_causa_inexistente_se_rechaza_por_item(client, entorno):
    r = _carga(
        client,
        entorno,
        [_actividad(entorno["id_caso"], 5, id_causa=888888)],
    )
    assert r.status_code == 200, r.text
    assert r.json()["items"][0]["aceptada"] is False
    assert "causa" in (r.json()["items"][0]["mensaje"] or "").lower()


def test_un_id_de_metodo_no_numerico_lo_corta_el_esquema(client, entorno):
    """El esquema exige enteros: un texto nunca llega a la base (422, no 500)."""
    r = _carga(client, entorno, [_actividad(entorno["id_caso"], 6, id_metodo="IVR")])
    assert r.status_code == 422, r.text


def test_sin_metodo_ni_causa_la_accion_se_acepta(client, entorno):
    r = _carga(client, entorno, [_actividad(entorno["id_caso"], 7)])
    assert r.status_code == 200, r.text
    assert r.json()["items"][0]["aceptada"] is True
