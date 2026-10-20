"""D-121 · Idempotencia de la carga de la APK (`POST /sync/carga`).

El defecto (H-01 de la auditoría V3): la carga no tenía clave de idempotencia, de
modo que un reenvío del mismo lote —timeout, reintento o los dos emisores de la
cola— volvía a insertar la actividad CIERRE/ENRUTE y a mover el caso, duplicando
la bitácora, la productividad y el conteo del monitoreo.

La corrección: cada acción de la cola viaja con `id_actividad_local` y el
`dispositivo_id` del lote; la pareja es única en `actividad` y el servidor
responde **por acción** (`items`) para que la APK marque cada una.
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from sqlalchemy import func, select

from app.models import Actividad, Caso, Cuadrilla, CuadrillaTecnico, Despacho, DespachoCasos, Tecnico
from app.services.tiempo import hoy_operativo

SYNC = "/api/v1/sync/carga"
DISPOSITIVO = "DEV-D121-TEST"


def _actividad(id_caso: int, local: int | None, tipo: str = "CONTACTO", **extra) -> dict:
    cuerpo = {
        "id_caso": id_caso,
        "tipo": tipo,
        "resultado": "EXITOSO",
        "reporte_corto": f"Acción {local}",
        "fecha_hora": datetime.now(UTC).isoformat(),
        "evidencias": [],
    }
    if local is not None:
        cuerpo["id_actividad_local"] = local
    cuerpo.update(extra)
    return cuerpo


@pytest.fixture()
def entorno_carga(client, admin_token, db_session):
    """Técnico con cuadrilla vigente y un caso despachado en ella."""
    headers = admin_token["admin"]
    id_central = admin_token["id_central"]

    creado = client.post(
        "/api/v1/casos",
        json={
            "id_averia": "TSTD121-1",
            "direccion": "SECTOR D121 CASA 1",
            "nombre_cliente": "CLIENTE D121",
            "contacto_cliente": "04141112233",
            "id_pago": "7014002021",
            "tipo_reporte": "REPARACION",
            "tipo_problema": "SIN_SERVICIO",
        },
        headers=headers,
    )
    assert creado.status_code == 201, creado.text
    id_caso = creado.json()["id_caso"]

    id_tecnico = db_session.scalar(
        select(Tecnico.id_tecnico).where(Tecnico.p00 == "TESTTEC")
    )
    assert id_tecnico is not None
    cuadrilla = Cuadrilla(id_central=id_central, codigo="TCD121", nombre="Cuadrilla D-121")
    db_session.add(cuadrilla)
    db_session.flush()
    db_session.add(
        CuadrillaTecnico(
            id_cuadrilla=cuadrilla.id_cuadrilla, id_tecnico=id_tecnico, desde=hoy_operativo()
        )
    )
    despacho = Despacho(
        id_central=id_central,
        fecha=hoy_operativo(),
        id_cuadrilla=cuadrilla.id_cuadrilla,
        estado="BORRADOR",
    )
    db_session.add(despacho)
    db_session.flush()
    db_session.add(
        DespachoCasos(
            id_despacho=despacho.id_despacho,
            id_caso=id_caso,
            estado="ASIGNADO",
            orden_visita=1,
            tipo_asignacion="REPARACION",
        )
    )
    db_session.commit()
    return {
        "headers": admin_token["tecnico"],
        "id_caso": id_caso,
        "id_cuadrilla": cuadrilla.id_cuadrilla,
    }


def _post(client, entorno, actividades, dispositivo=DISPOSITIVO):
    return client.post(
        SYNC,
        json={
            "dispositivo_id": dispositivo,
            "actividades": actividades,
            "estados": [],
        },
        headers=entorno["headers"],
    )


def test_el_mismo_lote_dos_veces_registra_una_sola_actividad(client, entorno_carga,
                                                             db_session):
    """D-121 · H-01: reenviar el lote no duplica la actividad ni la bitácora."""
    actividad = _actividad(entorno_carga["id_caso"], 7)

    primera = _post(client, entorno_carga, [actividad])
    assert primera.status_code == 200, primera.text
    assert primera.json()["items"][0]["aceptada"] is True
    id_servidor = primera.json()["items"][0]["id_actividad"]
    assert id_servidor is not None

    segunda = _post(client, entorno_carga, [actividad])
    assert segunda.status_code == 200, segunda.text
    cuerpo = segunda.json()
    assert cuerpo["items"][0]["aceptada"] is True, "el reenvío se confirma, no se rechaza"
    assert cuerpo["items"][0]["id_actividad"] == id_servidor
    assert "anterior" in (cuerpo["items"][0]["mensaje"] or "")

    db_session.expire_all()
    total = db_session.scalar(
        select(func.count()).select_from(Actividad).where(
            Actividad.id_caso == entorno_carga["id_caso"],
            Actividad.dispositivo_id == DISPOSITIVO,
            Actividad.id_actividad_local == 7,
        )
    )
    assert total == 1, "la actividad se registró dos veces"


def test_el_cierre_reenviado_no_duplica_la_actividad(client, entorno_carga, db_session):
    """El cierre es el caso crítico: dos envíos → un cierre y un histórico."""
    cierre = _actividad(
        entorno_carga["id_caso"], 11, tipo="CIERRE", modo="IVR",
        reporte_corto="Cierre en campo (D-121)",
    )
    primera = _post(client, entorno_carga, [cierre])
    assert primera.status_code == 200, primera.text
    assert primera.json()["items"][0]["aceptada"] is True

    segunda = _post(client, entorno_carga, [cierre])
    assert segunda.status_code == 200, segunda.text
    assert segunda.json()["items"][0]["aceptada"] is True

    db_session.expire_all()
    cierres = db_session.scalar(
        select(func.count()).select_from(Actividad).where(
            Actividad.id_caso == entorno_carga["id_caso"],
            Actividad.tipo == "CIERRE",
        )
    )
    assert cierres == 1
    caso = db_session.get(Caso, entorno_carga["id_caso"])
    assert caso is not None and caso.estado_actual == "CERRADO"


def test_un_item_rechazado_no_arrastra_al_resto(client, entorno_carga, db_session):
    """D-121: la respuesta es por acción; el bueno se confirma y el malo se informa."""
    bueno = _actividad(entorno_carga["id_caso"], 21)
    malo = _actividad(entorno_carga["id_caso"], 22, tipo="CIERRE", modo="NO_EXISTE",
                      reporte_corto="Cierre con modo inválido")

    r = _post(client, entorno_carga, [bueno, malo])
    assert r.status_code == 200, r.text
    items = {i["id_actividad_local"]: i for i in r.json()["items"]}
    assert items[21]["aceptada"] is True
    assert items[22]["aceptada"] is False
    assert items[22]["mensaje"], "el motivo del rechazo debe llegar a la APK"
    assert r.json()["aceptadas"] == 1 and r.json()["rechazadas"] == 1

    db_session.expire_all()
    assert db_session.scalar(
        select(func.count()).select_from(Actividad).where(
            Actividad.id_caso == entorno_carga["id_caso"],
            Actividad.id_actividad_local == 22,
        )
    ) == 0, "el ítem rechazado no puede dejar actividad"


def test_sin_id_local_el_contrato_antiguo_sigue_funcionando(client, entorno_carga,
                                                            db_session):
    """Compatibilidad: una acción antigua (sin id local) se registra como siempre.

    El desglose la informa con `id_actividad_local = null`; la APK ignora esas
    filas y sigue con el contador del lote.
    """
    r = _post(client, entorno_carga, [_actividad(entorno_carga["id_caso"], None)])
    assert r.status_code == 200, r.text
    assert r.json()["aceptadas"] == 1
    items = r.json()["items"]
    assert len(items) == 1 and items[0]["id_actividad_local"] is None
    assert items[0]["aceptada"] is True
