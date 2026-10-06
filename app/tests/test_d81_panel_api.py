"""Pruebas de integración del incremento D-81 — panel de gestión diaria (RF-43)."""

from __future__ import annotations

from datetime import date

from app.models import Cuadrilla, Despacho, DespachoCasos

BASE = "/api/v1"
CASOS = f"{BASE}/casos"
PANEL = f"{BASE}/panel/gestion-diaria"


def _entorno(client, admin_token, db_session) -> dict:
    id_central = admin_token["id_central"]
    headers = admin_token["admin"]
    cua = Cuadrilla(id_central=id_central, codigo="TCD84", nombre="Cuadrilla D84")
    db_session.add(cua)
    db_session.flush()

    def caso(id_averia: str) -> int:
        r = client.post(CASOS, json={"id_averia": id_averia, "direccion": "X"}, headers=headers)
        assert r.status_code == 201, r.text
        return r.json()["id_caso"]

    c1 = caso("TSTPAN-1")
    c2 = caso("TSTPAN-2")
    d = Despacho(
        id_central=id_central, fecha=date.today(), id_cuadrilla=cua.id_cuadrilla, estado="PUBLICADO"
    )
    db_session.add(d)
    db_session.flush()
    db_session.add(DespachoCasos(id_despacho=d.id_despacho, id_caso=c1))
    db_session.add(DespachoCasos(id_despacho=d.id_despacho, id_caso=c2))
    db_session.commit()

    # c1 cerrado (los casos nacen RESIDENCIAL → cuentan en el modo Común).
    client.patch(f"{CASOS}/{c1}", json={"estado_actual": "CERRADO"}, headers=headers)
    return {"id_cuadrilla": cua.id_cuadrilla, "id_despacho": d.id_despacho, "c1": c1, "c2": c2}


def _fila(resp, id_cuadrilla):
    return next(c for c in resp["cuadrillas"] if c["id_cuadrilla"] == id_cuadrilla)


def test_panel_comun_asignadas_vs_cerradas(client, admin_token, db_session):
    e = _entorno(client, admin_token, db_session)
    r = client.get(f"{PANEL}?modo=COMUN", headers=admin_token["admin"])
    assert r.status_code == 200, r.text
    fila = _fila(r.json(), e["id_cuadrilla"])
    assert fila["asignadas"] == 2 and fila["cerradas"] == 1 and fila["porcentaje"] == 50.0


def test_panel_referidos(client, admin_token, db_session):
    e = _entorno(client, admin_token, db_session)
    # Caso especial REFERIDO añadido al despacho del día.
    esp = client.post(
        f"{BASE}/casos-especiales",
        json={"clasificacion": "REFERIDO", "tipo_actividad": "REPARACION", "prioridad": "ALTA"},
        headers=admin_token["admin"],
    )
    assert esp.status_code == 201, esp.text
    id_caso = esp.json()["id_caso"]
    db_session.add(DespachoCasos(id_despacho=e["id_despacho"], id_caso=id_caso))
    db_session.commit()

    r = client.get(f"{PANEL}?modo=REFERIDOS", headers=admin_token["admin"])
    assert r.status_code == 200
    fila = _fila(r.json(), e["id_cuadrilla"])
    assert fila["asignadas"] == 1


def test_panel_rbac_y_modo_invalido(client, admin_token, db_session):
    _entorno(client, admin_token, db_session)
    assert client.get(PANEL, headers=admin_token["tecnico"]).status_code == 403
    assert client.get(f"{PANEL}?modo=OTRO", headers=admin_token["admin"]).status_code == 422


def test_panel_sin_despacho(client, admin_token):
    r = client.get(f"{PANEL}?fecha=2000-01-01&modo=COMUN", headers=admin_token["supervisor"])
    assert r.status_code == 200
    assert r.json()["totales"]["asignadas"] == 0
