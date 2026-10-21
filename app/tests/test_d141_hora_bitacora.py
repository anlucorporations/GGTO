"""D-141 · La bitácora guarda la hora real de la acción (H-24).

Defecto (auditoría V3): las actividades viajaban con la hora **local sin offset** y
los estados **no llevaban hora**. Resultado: la bitácora quedaba desplazada 4 h
(hora de Venezuela tratada como UTC) y los estados se fechaban al **sincronizar**,
no cuando el técnico los hizo.

Corrección: la APK manda `fecha_hora` en UTC con offset en actividades y estados, y
el servidor usa ese instante al registrar la bitácora (si falta, el de llegada).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.models import CasoEstadoHist
from app.tests.conftest import asignar_caso_al_tecnico

CASOS = "/api/v1/casos"
SYNC = "/api/v1/sync/carga"


@pytest.fixture()
def entorno(client, admin_token, db_session):
    r = client.post(
        CASOS,
        json={
            "id_averia": "TSTD141-1",
            "direccion": "SECTOR D141 CASA 1",
            "nombre_cliente": "CLIENTE D141",
            "contacto_cliente": "04145556677",
            "id_pago": "7014003541",
            "tipo_reporte": "REPARACION",
            "tipo_problema": "SIN_SERVICIO",
        },
        headers=admin_token["admin"],
    )
    assert r.status_code == 201, r.text
    id_caso = r.json()["id_caso"]
    asignar_caso_al_tecnico(db_session, admin_token, id_caso)
    return {"headers": admin_token["tecnico"], "id_caso": id_caso}


def _carga(client, entorno, actividades=(), estados=()):
    return client.post(
        SYNC,
        json={
            "dispositivo_id": "DEV-D141",
            "actividades": list(actividades),
            "estados": list(estados),
        },
        headers=entorno["headers"],
    )


def test_el_estado_se_fecha_con_la_hora_del_tecnico(client, entorno, db_session):
    """El CONTACTADO de las 10:00 (UTC) no se fecha a la hora de sincronizar."""
    momento = datetime(2026, 10, 20, 10, 0, tzinfo=UTC)
    r = _carga(
        client,
        entorno,
        estados=[
            {
                "id_actividad_local": 1,
                "id_caso": entorno["id_caso"],
                "estado_nuevo": "CONTACTADO",
                "fecha_hora": momento.isoformat(),
            }
        ],
    )
    assert r.status_code == 200, r.text
    assert r.json()["aceptadas"] == 1

    db_session.expire_all()
    fila = db_session.scalar(
        select(CasoEstadoHist)
        .where(CasoEstadoHist.id_caso == entorno["id_caso"])
        .order_by(CasoEstadoHist.id_hist.desc())
    )
    assert fila is not None
    assert fila.fecha_hora is not None
    assert fila.fecha_hora.astimezone(UTC) == momento


def test_sin_hora_se_usa_el_instante_de_llegada(client, entorno, db_session):
    antes = datetime.now(UTC) - timedelta(minutes=1)
    r = _carga(
        client,
        entorno,
        estados=[
            {
                "id_actividad_local": 2,
                "id_caso": entorno["id_caso"],
                "estado_nuevo": "CONTACTADO",
            }
        ],
    )
    assert r.status_code == 200, r.text
    db_session.expire_all()
    fila = db_session.scalar(
        select(CasoEstadoHist)
        .where(CasoEstadoHist.id_caso == entorno["id_caso"])
        .order_by(CasoEstadoHist.id_hist.desc())
    )
    assert fila is not None
    assert fila.fecha_hora.astimezone(UTC) >= antes


def test_una_hora_ilegible_la_rechaza_el_esquema(client, entorno):
    """El campo es `datetime`: una hora ilegible se corta con 422 (nunca un 500)."""
    r = _carga(
        client,
        entorno,
        estados=[
            {
                "id_actividad_local": 3,
                "id_caso": entorno["id_caso"],
                "estado_nuevo": "CONTACTADO",
                "fecha_hora": "no-es-una-fecha",
            }
        ],
    )
    assert r.status_code == 422, r.text


def test_la_actividad_conserva_su_hora(client, entorno, db_session):
    from app.models import Actividad

    momento = datetime(2026, 10, 20, 9, 30, tzinfo=UTC)
    r = _carga(
        client,
        entorno,
        actividades=[
            {
                "id_actividad_local": 4,
                "id_caso": entorno["id_caso"],
                "tipo": "CONTACTO",
                "resultado": "EXITOSO",
                "reporte_corto": "Contacto realizado a las 9:30",
                "fecha_hora": momento.isoformat(),
                "evidencias": [],
            }
        ],
    )
    assert r.status_code == 200, r.text
    db_session.expire_all()
    actividad = db_session.scalar(
        select(Actividad).where(Actividad.id_actividad_local == 4)
    )
    assert actividad is not None
    assert actividad.fecha_hora.astimezone(UTC) == momento
