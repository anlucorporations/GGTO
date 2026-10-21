"""D-144 · La búsqueda libre cubre todo el universo y se puede filtrar CERRADOS.

Petición del usuario: «que la búsqueda por texto libre se aplique a todo el
universo de casos (abiertos, cerrados, etc.)» y «en la selección de estados poder
filtrar por casos CERRADOS».

Web: el listado de CASOS forzaba `solo_abiertos=true` **siempre**, así que un caso
cerrado no aparecía ni buscándolo, y el selector de estado no ofrecía CERRADO ni
CANCELADO. Ahora la búsqueda mira todo el universo, elegir estado manda sobre
«solo abiertos» y el selector incluye los estados resueltos.
"""

from __future__ import annotations

import pytest

CASOS = "/api/v1/casos"


def _caso(client, headers, id_averia: str, pago: str, contacto: str = "04147778899") -> int:
    r = client.post(
        CASOS,
        json={
            "id_averia": id_averia,
            "direccion": "SECTOR D144 CASA 1",
            "nombre_cliente": f"CLIENTE {id_averia}",
            "contacto_cliente": contacto,
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
    abierto = _caso(client, admin_token["admin"], "TSTD144-1", "7014003701", "04147770001")
    cerrado = _caso(client, admin_token["admin"], "TSTD144-2", "7014003702", "04147770002")
    r = client.patch(
        f"{CASOS}/{cerrado}",
        json={"estado_actual": "CERRADO", "motivo_estado": "prueba D-144"},
        headers=admin_token["admin"],
    )
    assert r.status_code == 200, r.text
    return {"headers": admin_token["admin"], "abierto": abierto, "cerrado": cerrado}


def test_la_busqueda_libre_encuentra_un_caso_cerrado(client, entorno):
    """Sin `solo_abiertos`, el texto encuentra el caso cerrado (lo que hace la web)."""
    r = client.get(
        CASOS,
        params={"q": "TSTD144-2", "solo_abiertos": "false"},
        headers=entorno["headers"],
    )
    assert r.status_code == 200, r.text
    ids = {c["id_caso"] for c in r.json()["items"]}
    assert entorno["cerrado"] in ids
    assert entorno["abierto"] not in ids


def test_el_filtro_por_estado_cerrado_devuelve_los_resueltos(client, entorno):
    r = client.get(
        CASOS,
        params={"estado_actual": "CERRADO", "solo_abiertos": "false"},
        headers=entorno["headers"],
    )
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    assert items, "no devolvió ningún caso cerrado"
    assert all(c["estado_actual"] == "CERRADO" for c in items)
    assert entorno["cerrado"] in {c["id_caso"] for c in items}


def test_el_texto_libre_tambien_busca_el_contacto(client, entorno):
    """D-144: el listado busca el número de contacto, no solo el pago."""
    r = client.get(
        CASOS,
        params={"q": "04147770002", "solo_abiertos": "false"},
        headers=entorno["headers"],
    )
    assert r.status_code == 200, r.text
    assert entorno["cerrado"] in {c["id_caso"] for c in r.json()["items"]}


def test_el_listado_por_defecto_sigue_siendo_solo_abierto(client, entorno):
    """RN-AL-02 se conserva: sin búsqueda ni estado, la sección lista lo abierto."""
    r = client.get(CASOS, params={"solo_abiertos": "true"}, headers=entorno["headers"])
    assert r.status_code == 200, r.text
    ids = {c["id_caso"] for c in r.json()["items"]}
    assert entorno["abierto"] in ids
    assert entorno["cerrado"] not in ids
