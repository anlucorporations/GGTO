"""D-130 · El listado y la búsqueda de casos respetan la cuadrilla (H-13).

Defecto (auditoría V3): ningún endpoint de `/casos` aplicaba el filtro de cuadrilla
que sí aplica `/sync`. Un TÉCNICO podía **listar y ver** los casos de otras
cuadrillas de su central, y `GET /casos/buscar` no acotaba ni siquiera por central
(con un teléfono se podía llegar a casos de cualquier central).

Regla: el TÉCNICO ve solo los casos que puede gestionar (`casos_permitidos`, el
mismo criterio de D-123); ADMIN/SUPERVISOR/SUPER siguen viendo todo su alcance.
"""

from __future__ import annotations

import pytest

from app.tests.conftest import asignar_caso_al_tecnico

CASOS = "/api/v1/casos"
BUSCAR = "/api/v1/casos/buscar"


def _caso(client, headers, id_averia: str, pago: str, telefono: str = "04149990011") -> int:
    r = client.post(
        CASOS,
        json={
            "id_averia": id_averia,
            "direccion": "SECTOR D130 CASA 1",
            "nombre_cliente": f"CLIENTE {id_averia}",
            "contacto_cliente": telefono,
            "id_pago": pago,
            "tipo_reporte": "REPARACION",
            "tipo_problema": "SIN_SERVICIO",
        },
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()["id_caso"]


@pytest.fixture()
def entorno(client, admin_token, db_session):
    propio = _caso(client, admin_token["admin"], "TSTD130-1", "7014003021", "04149990021")
    ajeno = _caso(client, admin_token["admin"], "TSTD130-2", "7014003022", "04149990022")
    asignar_caso_al_tecnico(db_session, admin_token, propio)
    return {
        "tecnico": admin_token["tecnico"],
        "admin": admin_token["admin"],
        "propio": propio,
        "ajeno": ajeno,
    }


def test_el_tecnico_solo_lista_los_casos_de_su_cuadrilla(client, entorno):
    r = client.get(CASOS, params={"page_size": 200}, headers=entorno["tecnico"])
    assert r.status_code == 200, r.text
    ids = {c["id_caso"] for c in r.json()["items"]}
    assert entorno["propio"] in ids
    assert entorno["ajeno"] not in ids, "el técnico vio un caso de otra cuadrilla"
    assert r.json()["total"] == len(ids)


def test_el_admin_sigue_viendo_todo(client, entorno):
    r = client.get(CASOS, params={"page_size": 200}, headers=entorno["admin"])
    assert r.status_code == 200, r.text
    ids = {c["id_caso"] for c in r.json()["items"]}
    assert {entorno["propio"], entorno["ajeno"]} <= ids


def test_la_busqueda_del_tecnico_no_cruza_cuadrillas(client, entorno):
    r = client.get(BUSCAR, params={"q": "TSTD130-2"}, headers=entorno["tecnico"])
    assert r.status_code == 200, r.text
    assert r.json() == [], "la búsqueda devolvió un caso ajeno"

    propio = client.get(BUSCAR, params={"q": "TSTD130-1"}, headers=entorno["tecnico"])
    assert [c["id_caso"] for c in propio.json()] == [entorno["propio"]]


def test_la_busqueda_por_telefono_ajeno_no_devuelve_nada(client, entorno):
    # El alta normaliza el contacto (+58…): se busca con el valor ya guardado.
    propio = client.get(f"{CASOS}/{entorno['propio']}", headers=entorno["admin"]).json()
    ajeno = client.get(f"{CASOS}/{entorno['ajeno']}", headers=entorno["admin"]).json()

    r = client.get(BUSCAR, params={"telefono": ajeno["contacto_cliente"]},
                   headers=entorno["tecnico"])
    assert r.status_code == 200 and r.json() == [], "la búsqueda cruzó de cuadrilla"

    r = client.get(BUSCAR, params={"telefono": propio["contacto_cliente"]},
                   headers=entorno["tecnico"])
    assert r.status_code == 200 and [c["id_caso"] for c in r.json()] == [entorno["propio"]]


def test_un_tecnico_sin_cuadrilla_no_ve_nada(client, admin_token):
    """Sin cuadrilla vigente el alcance es vacío (fail-closed, D-123)."""
    r = client.get(CASOS, params={"page_size": 200}, headers=admin_token["tecnico"])
    assert r.status_code == 200, r.text
    assert r.json()["items"] == []
