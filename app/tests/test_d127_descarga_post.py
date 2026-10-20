"""D-127 · La descarga diferencial viaja en el cuerpo (H-10).

`GET /sync/descarga` llevaba **todos** los ids conocidos en la query string: con
~380 casos la URL rondaba 8 KB y crecía sin límite, de modo que el proxy o el
servidor podían rechazarla (414/431) y el técnico se quedaba sin despacho.

La corrección añade `POST /sync/descarga` con el mismo contrato en JSON y mantiene
el GET por compatibilidad. Estas pruebas fijan que **las dos vías responden lo
mismo** y que el cuerpo admite listas grandes sin URL.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.tests.conftest import asignar_caso_al_tecnico

CASOS = "/api/v1/casos"
SYNC = "/api/v1/sync/descarga"


def _caso(client, headers, id_averia: str, pago: str) -> int:
    r = client.post(
        CASOS,
        json={
            "id_averia": id_averia,
            "direccion": "SECTOR D127 CASA 1",
            "nombre_cliente": f"CLIENTE {id_averia}",
            "contacto_cliente": "04146667788",
            "id_pago": pago,
            "tipo_reporte": "REPARACION",
            "tipo_problema": "SIN_SERVICIO",
        },
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()["id_caso"]


def _entorno(client, admin_token, db_session):
    primero = _caso(client, admin_token["admin"], "TSTD127-1", "7014002721")
    segundo = _caso(client, admin_token["admin"], "TSTD127-2", "7014002722")
    asignar_caso_al_tecnico(db_session, admin_token, primero)
    asignar_caso_al_tecnico(db_session, admin_token, segundo)
    return {"headers": admin_token["tecnico"], "ids": [primero, segundo]}


def _normalizar(cuerpo: dict) -> tuple:
    """Lo que debe coincidir entre las dos vías (sin el `server_ts`)."""
    return (
        cuerpo["motivo"],
        sorted(c["id_caso"] for c in cuerpo["casos"]),
        sorted(cuerpo["ids_del_dia"]),
        sorted(cuerpo["ids_vigentes"]),
        cuerpo["casos_cuadrilla"],
        (cuerpo["despacho_del_dia"] or {}).get("id_despacho"),
    )


def test_el_post_responde_lo_mismo_que_el_get(client, admin_token, db_session):
    entorno = _entorno(client, admin_token, db_session)

    get = client.get(SYNC, headers=entorno["headers"])
    post = client.post(SYNC, json={}, headers=entorno["headers"])
    assert get.status_code == 200, get.text
    assert post.status_code == 200, post.text
    assert _normalizar(post.json()) == _normalizar(get.json())
    assert entorno["ids"][0] in [c["id_caso"] for c in post.json()["casos"]]


def test_el_cuerpo_acepta_una_lista_grande_de_ids_conocidos(client, admin_token,
                                                            db_session):
    """Lo que en la URL no cabía (8 KB) cabe en el cuerpo sin límite práctico."""
    entorno = _entorno(client, admin_token, db_session)
    # 500 ids «conocidos» que no existen: el servidor no debe romperse y los dos
    # casos reales tienen que llegar igualmente (son desconocidos).
    conocidos = list(range(900000, 900500))

    r = client.post(
        SYNC,
        json={"ids_conocidos": conocidos},
        headers=entorno["headers"],
    )
    assert r.status_code == 200, r.text
    ids = {c["id_caso"] for c in r.json()["casos"]}
    assert set(entorno["ids"]) <= ids, "los casos desconocidos se envían siempre (D-105)"


def test_el_post_respeta_el_diferencial_por_marca(client, admin_token, db_session):
    """Con `desde` en el futuro no hay cambios, igual que por GET."""
    entorno = _entorno(client, admin_token, db_session)
    futuro = (datetime.now(UTC) + timedelta(days=1)).isoformat()

    post = client.post(
        SYNC,
        json={"desde": futuro, "ids_conocidos": entorno["ids"]},
        headers=entorno["headers"],
    )
    assert post.status_code == 200, post.text
    assert post.json()["casos"] == [], post.text
    assert post.json()["motivo"] == "SIN_CAMBIOS"

    get = client.get(
        SYNC, params={"desde": futuro, "ids_conocidos": entorno["ids"]},
        headers=entorno["headers"],
    )
    assert _normalizar(post.json()) == _normalizar(get.json())


def test_el_post_valida_la_fecha(client, admin_token):
    r = client.post(SYNC, json={"desde": "no-es-una-fecha"},
                    headers=admin_token["tecnico"])
    assert r.status_code == 422, r.text
