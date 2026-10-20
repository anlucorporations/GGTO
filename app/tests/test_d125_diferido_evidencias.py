"""D-125 · La evidencia del diferido queda vinculada al llegar por la CARGA (H-08).

Cierre del hallazgo H-08 de la auditoría V3: la APK encolaba `DIFERIDO_EVIDENCIAS`
contra `/casos/{id}/estado` sin `estado_actual` (422 y ERROR permanente, con la
foto sin vínculo). Desde D-124 ese tipo solo lo envía la CARGA, y la CARGA lo
traduce a una actividad `CONTACTO` con los seriales (D-125). Aquí se fija que el
servidor **vincula** la evidencia ya subida a esa actividad.
"""

from __future__ import annotations

from datetime import UTC, date, datetime

import pytest
from sqlalchemy import select

from app.models import (
    Cuadrilla,
    CuadrillaTecnico,
    Despacho,
    DespachoCasos,
    Evidencia,
    Tecnico,
)
from app.tests.conftest import asignar_caso_al_tecnico

CASOS = "/api/v1/casos"
SYNC = "/api/v1/sync/carga"


@pytest.fixture()
def entorno(client, admin_token, db_session):
    creado = client.post(
        CASOS,
        json={
            "id_averia": "TSTD125-1",
            "direccion": "SECTOR D125 CASA 1",
            "nombre_cliente": "CLIENTE D125",
            "contacto_cliente": "04145556677",
            "id_pago": "7014002521",
            "tipo_reporte": "REPARACION",
            "tipo_problema": "SIN_SERVICIO",
        },
        headers=admin_token["admin"],
    )
    assert creado.status_code == 201, creado.text
    id_caso = creado.json()["id_caso"]
    asignar_caso_al_tecnico(db_session, admin_token, id_caso)
    return {"headers": admin_token["tecnico"], "id_caso": id_caso}


def test_la_evidencia_del_diferido_se_vincula_en_la_carga(client, entorno, db_session):
    """La acción `DIFERIDO_EVIDENCIAS` llega como CONTACTO y la foto queda vinculada."""
    # Lo que deja `/evidencias/upload`: la evidencia subida aún sin actividad.
    db_session.add(
        Evidencia(
            id_actividad=None,
            tipo="DEMO",
            serial_imagen="TSTD125-1-20261020-100000.jpg",
            ruta_remota="https://storage/TSTD125-1-20261020-100000.jpg",
            fecha_hora=datetime.now(UTC),
            origen_camara=True,
        )
    )
    db_session.commit()

    carga = client.post(
        SYNC,
        json={
            "dispositivo_id": "DEV-D125",
            "actividades": [
                {
                    "id_actividad_local": 51,
                    "id_caso": entorno["id_caso"],
                    "tipo": "CONTACTO",
                    "reporte_corto": "Evidencias del diferido",
                    "fecha_hora": datetime.now(UTC).isoformat(),
                    "evidencias": ["TSTD125-1-20261020-100000.jpg"],
                }
            ],
            "estados": [],
        },
        headers=entorno["headers"],
    )
    assert carga.status_code == 200, carga.text
    assert carga.json()["items"][0]["aceptada"] is True, carga.text

    db_session.expire_all()
    evidencia = db_session.scalar(
        select(Evidencia).where(
            Evidencia.serial_imagen == "TSTD125-1-20261020-100000.jpg"
        )
    )
    assert evidencia is not None
    assert evidencia.id_actividad is not None, "la evidencia quedó sin vínculo"

    # La acción es idempotente: reenviar el lote no duplica la actividad ni la foto.
    otra = client.post(
        SYNC,
        json={
            "dispositivo_id": "DEV-D125",
            "actividades": [
                {
                    "id_actividad_local": 51,
                    "id_caso": entorno["id_caso"],
                    "tipo": "CONTACTO",
                    "reporte_corto": "Evidencias del diferido",
                    "fecha_hora": datetime.now(UTC).isoformat(),
                    "evidencias": ["TSTD125-1-20261020-100000.jpg"],
                }
            ],
            "estados": [],
        },
        headers=entorno["headers"],
    )
    assert otra.status_code == 200, otra.text
    assert otra.json()["items"][0]["id_actividad"] == carga.json()["items"][0]["id_actividad"]
