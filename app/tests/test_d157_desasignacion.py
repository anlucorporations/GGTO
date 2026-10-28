"""Pruebas del incremento D-157 — el cierre de jornada anula las asignaciones.

El corte (D-99) devolvía el caso a `PENDIENTE` pero su renglón de
`despacho_caso` seguía contando como asignación: la cuadrilla seguía
descargándolo, CASOS lo mostraba como suyo y podía quedar eternamente «de» la
cuadrilla de una jornada vencida. Con D-157 la fila queda `DEVUELTO` y:

* `_casos_ids_de_cuadrilla` deja de considerarla (la APK no la descarga);
* el filtro `id_cuadrilla` y el icono `asignado` de CASOS también la ignoran;
* el histórico del despacho conserva la fila y su estado (`DEVUELTO`);
* el caso vuelve a poder asignarse en la jornada siguiente;
* el técnico conserva la protección D-123 para subir trabajo reciente.
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from sqlalchemy import delete, select

from app.models import (
    Caso,
    CuadrillaTecnico,
    DespachoCasos,
    Tecnico,
    Usuario,
)
from app.services import sync as svc_sync
from app.services.tiempo import hoy_operativo

CASOS = "/api/v1/casos"
DESPACHOS = "/api/v1/despachos"
AYER = (hoy_operativo() - timedelta(days=1)).isoformat()
HOY = hoy_operativo().isoformat()


@pytest.fixture()
def jornada(client, admin_token, db_session):
    """Un sector, una cuadrilla y dos casos despachados de AYER."""
    headers = admin_token["admin"]
    id_central = admin_token["id_central"]

    r = client.post(
        "/api/v1/sectores",
        json={"id_central": id_central, "nombre": "Devuelta", "codigo": "TS15A",
              "direcciones": [{"patron": "SECTOR D157"}]},
        headers=headers,
    )
    assert r.status_code == 201, r.text

    r = client.post(
        "/api/v1/cuadrillas",
        json={"id_central": id_central, "codigo": "TC15A", "nombre": "Cuadrilla D157"},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    id_cuadrilla = r.json()["id_cuadrilla"]

    # El técnico de pruebas (TESTTEC) queda inscrito en la cuadrilla: así la
    # prueba de protección D-123 usa un técnico real (no el conjunto vacío).
    id_tecnico = db_session.scalar(
        select(Tecnico.id_tecnico).where(Tecnico.p00 == "TESTTEC")
    )
    if id_tecnico is not None:
        inc = client.post(
            f"/api/v1/cuadrillas/{id_cuadrilla}/integrantes",
            json={"id_tecnico": id_tecnico},
            headers=headers,
        )
        assert inc.status_code == 201, inc.text

    def crear(id_averia: str, **extra):
        cuerpo = {"id_averia": id_averia, "direccion": "SECTOR D157 CASA 1",
                  "nombre_cliente": f"CLIENTE {id_averia}",
                  "contacto_cliente": "04141515151", "id_pago": "7015151515",
                  "tipo_reporte": "REPARACION", "tipo_problema": "SIN_SERVICIO"}
        cuerpo.update(extra)
        r = client.post(CASOS, json=cuerpo, headers=headers)
        assert r.status_code == 201, r.text
        return r.json()

    casos = [crear(f"TST15-DEV{i}") for i in range(2)]

    r = client.post(f"{DESPACHOS}/procesar",
                    json={"fecha": AYER, "reemplazar": True, "asignaciones": []},
                    headers=headers)
    assert r.status_code == 201, r.text
    propios = [d for d in r.json() if d["id_cuadrilla"] == id_cuadrilla]
    assert propios, "la jornada de AYER no incluyó la cuadrilla de la prueba"
    id_despacho = propios[0]["id_despacho"]

    yield {"headers": headers, "id_central": id_central, "id_cuadrilla": id_cuadrilla,
           "id_despacho": id_despacho, "casos": casos,
           # D-160: el corte manual lo ejecuta el Super Usuario (el ADMIN ya no).
           "super": admin_token["super"]}
    db_session.expire_all()
    cliente_tecnico = db_session.scalar(select(Usuario).where(Usuario.p00 == "TESTTEC"))
    if cliente_tecnico is not None and cliente_tecnico.id_tecnico is not None:
        db_session.execute(
            delete(CuadrillaTecnico).where(
                CuadrillaTecnico.id_tecnico == cliente_tecnico.id_tecnico,
                CuadrillaTecnico.id_cuadrilla == id_cuadrilla,
            )
        )
        db_session.commit()


def _cerrar(client, headers):
    """D-160: el corte manual lo ejecuta el SUPER de la prueba (el ADMIN ya no)."""
    r = client.post(f"{DESPACHOS}/cierre-jornada?solo_vencidos=true", headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def test_el_corte_marca_las_asignaciones_devueltas(client, jornada, db_session):
    """RF-65/D-157: las filas liberadas quedan `DEVUELTO` y el total se informa."""
    resultado = _cerrar(client, jornada["super"])
    assert resultado["asignaciones_devueltas"] >= len(jornada["casos"])
    assert resultado["casos_pendientes"] >= len(jornada["casos"])

    db_session.expire_all()
    filas = db_session.scalars(
        select(DespachoCasos).where(DespachoCasos.id_despacho == jornada["id_despacho"])
    ).all()
    estados = {f.id_caso: f.estado for f in filas}
    for caso in jornada["casos"]:
        assert estados[caso["id_caso"]] == "DEVUELTO"


def test_el_caso_devuelto_deja_de_ser_de_la_cuadrilla(client, jornada, db_session):
    """D-157: la cuadrilla deja de recibir un caso liberado por el corte."""
    ids = [c["id_caso"] for c in jornada["casos"]]
    _cerrar(client, jornada["super"])
    db_session.expire_all()

    # El helper de vigencia ya no la cuenta como asignación.
    ids_cuadrilla = svc_sync._casos_ids_de_cuadrilla(db_session, jornada["id_cuadrilla"])
    assert not (set(ids) & set(ids_cuadrilla)), "el caso devuelto sigue siendo de la cuadrilla"

    # El listado de CASOS tampoco lo atribuye a la cuadrilla.
    lista = client.get(CASOS, params={"id_cuadrilla": jornada["id_cuadrilla"]},
                       headers=jornada["headers"]).json()
    assert not ({x["id_caso"] for x in lista["items"]} & set(ids)), (
        "el caso devuelto aparece en la cuadrilla de la jornada vencida"
    )

    # El despacho conserva la fila devuelta (historial, no asignación).
    ficha = client.get(f"{DESPACHOS}/{jornada['id_despacho']}",
                       headers=jornada["headers"]).json()
    estados = {c["id_caso"]: c["estado"] for c in ficha["casos"]}
    for caso in jornada["casos"]:
        assert estados[caso["id_caso"]] == "DEVUELTO"


def test_un_caso_devuelto_puede_reasignarse_despues(client, jornada, db_session):
    """D-157: la devolución no bloquea la nueva asignación del caso."""
    caso = jornada["casos"][0]
    _cerrar(client, jornada["super"])
    r = client.post(f"{DESPACHOS}/asignar-casos",
                    json={"id_central": jornada["id_central"], "fecha": HOY,
                          "id_cuadrilla": jornada["id_cuadrilla"],
                          "ids_caso": [caso["id_caso"]]},
                    headers=jornada["headers"])
    assert r.status_code == 200, r.text

    ids_cuadrilla = svc_sync._casos_ids_de_cuadrilla(db_session, jornada["id_cuadrilla"])
    assert caso["id_caso"] in ids_cuadrilla, (
        "el caso reasignado hoy debe volver a la cuadrilla"
    )
    db_session.expire_all()
    assert db_session.get(Caso, caso["id_caso"]).estado_actual == "PENDIENTE"


def test_la_proteccion_d123_sobrevive_a_la_devolucion(client, jornada, db_session,
                                                     admin_token):
    """D-157: el técnico sigue pudiendo subir el trabajo reciente del caso.

    La devolución anula la *asignación futura*, no el trabajo ya hecho: el caso
    sigue dentro de la ventana D-123 de su cuadrilla para la carga offline.
    """
    caso = jornada["casos"][0]
    _cerrar(client, jornada["super"])
    db_session.expire_all()
    usuario = db_session.scalar(select(Usuario).where(Usuario.p00 == "TESTTEC"))
    if usuario is None:
        pytest.skip("la matriz de tokens no incluye técnico TESTTEC")
    permitidos = svc_sync.casos_permitidos(db_session, usuario)
    assert permitidos is not None and caso["id_caso"] in permitidos
