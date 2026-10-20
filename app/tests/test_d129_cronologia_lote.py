"""D-129 · El lote de la CARGA se aplica en orden cronológico (H-12).

Defecto (auditoría V3): `aplicar_carga` aplicaba **primero** todas las
`actividades` y **después** los `estados`. Un CONTACTADO encolado antes de un
CIERRE llegaba al final y **revertía** el cierre: el caso quedaba contactado
aunque el técnico lo había cerrado.

La corrección: una sola secuencia ordenada por el **id local** de la acción en la
cola (su orden real en el dispositivo) y, si falta, por el orden de llegada.
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from sqlalchemy import select

from app.models import Actividad, Caso, CasoEstadoHist
from app.tests.conftest import asignar_caso_al_tecnico

CASOS = "/api/v1/casos"
SYNC = "/api/v1/sync/carga"
DISPOSITIVO = "DEV-D129"


@pytest.fixture()
def entorno(client, admin_token, db_session):
    r = client.post(
        CASOS,
        json={
            "id_averia": "TSTD129-1",
            "direccion": "SECTOR D129 CASA 1",
            "nombre_cliente": "CLIENTE D129",
            "contacto_cliente": "04148889900",
            "id_pago": "7014002921",
            "tipo_reporte": "REPARACION",
            "tipo_problema": "SIN_SERVICIO",
        },
        headers=admin_token["admin"],
    )
    assert r.status_code == 201, r.text
    id_caso = r.json()["id_caso"]
    asignar_caso_al_tecnico(db_session, admin_token, id_caso)
    return {"headers": admin_token["tecnico"], "id_caso": id_caso}


def _carga(client, entorno, actividades, estados):
    return client.post(
        SYNC,
        json={
            "dispositivo_id": DISPOSITIVO,
            "actividades": actividades,
            "estados": estados,
        },
        headers=entorno["headers"],
    )


def _actividad(id_caso: int, local: int, tipo: str = "CIERRE", **extra) -> dict:
    cuerpo = {
        "id_actividad_local": local,
        "id_caso": id_caso,
        "tipo": tipo,
        "resultado": "EXITOSO",
        "reporte_corto": f"Acción {local}",
        "fecha_hora": datetime.now(UTC).isoformat(),
        "evidencias": [],
    }
    cuerpo.update(extra)
    return cuerpo


def test_el_cierre_posterior_gana_al_contacto_anterior(client, entorno, db_session):
    """El orden real del técnico es CONTACTADO (1) y después CIERRE (2)."""
    id_caso = entorno["id_caso"]
    r = _carga(
        client,
        entorno,
        actividades=[_actividad(id_caso, 2, modo="IVR", reporte_corto="Cierre del caso")],
        estados=[{"id_actividad_local": 1, "id_caso": id_caso, "estado_nuevo": "CONTACTADO"}],
    )
    assert r.status_code == 200, r.text
    assert r.json()["aceptadas"] == 2, r.text

    db_session.expire_all()
    caso = db_session.get(Caso, id_caso)
    assert caso is not None
    assert caso.estado_actual == "CERRADO", "el contacto anterior revirtió el cierre"

    # La bitácora refleja el orden: CONTACTADO y luego CERRADO.
    historial = [
        h.estado_nuevo
        for h in db_session.scalars(
            select(CasoEstadoHist)
            .where(CasoEstadoHist.id_caso == id_caso)
            .order_by(CasoEstadoHist.id_hist)
        ).all()
    ]
    assert historial[-1] == "CERRADO"


def test_un_contacto_posterior_es_el_que_manda(client, entorno, db_session):
    """Si el técnico contactó **después** del cierre, el último estado es el suyo."""
    id_caso = entorno["id_caso"]
    r = _carga(
        client,
        entorno,
        actividades=[_actividad(id_caso, 1, modo="IVR", reporte_corto="Cierre del caso")],
        estados=[{"id_actividad_local": 2, "id_caso": id_caso, "estado_nuevo": "CONTACTADO"}],
    )
    assert r.status_code == 200, r.text

    db_session.expire_all()
    caso = db_session.get(Caso, id_caso)
    assert caso is not None
    assert caso.estado_actual == "CONTACTADO"


def test_sin_id_local_se_respeta_el_orden_de_llegada(client, entorno, db_session):
    """Compatibilidad: actividades primero, estados después (como antes)."""
    id_caso = entorno["id_caso"]
    r = _carga(
        client,
        entorno,
        actividades=[_actividad(id_caso, 0, modo="IVR", reporte_corto="Cierre sin id local")],
        estados=[{"id_caso": id_caso, "estado_nuevo": "CONTACTADO"}],
    )
    assert r.status_code == 200, r.text
    db_session.expire_all()
    caso = db_session.get(Caso, id_caso)
    assert caso is not None and caso.estado_actual == "CONTACTADO"


def test_la_actividad_del_cierre_sigue_registrandose(client, entorno, db_session):
    id_caso = entorno["id_caso"]
    r = _carga(
        client,
        entorno,
        actividades=[_actividad(id_caso, 5, modo="COS", reporte_corto="Cierre D-129")],
        estados=[],
    )
    assert r.status_code == 200, r.text
    db_session.expire_all()
    actividad = db_session.scalar(
        select(Actividad).where(
            Actividad.id_caso == id_caso, Actividad.tipo == "CIERRE"
        )
    )
    assert actividad is not None and actividad.id_actividad_local == 5
