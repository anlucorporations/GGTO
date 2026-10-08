"""Pruebas de integración del incremento D-81 — mensajería interna (RF-41).

Requieren `GGTO_TEST_DB_URL`. Cubren CU-D81-04…07 y CU-D81-11.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select

from app.models import (
    Cuadrilla,
    CuadrillaSectorDia,
    CuadrillaTecnico,
    FallaMasiva,
    Sector,
    Tecnico,
)

BASE = "/api/v1"
CASOS = f"{BASE}/casos"
P00_TEC = "TESTTEC"


def _cuadrilla_con_tecnico(db_session, admin_token, codigo="TCD83") -> tuple[int, int]:
    c = Cuadrilla(id_central=admin_token["id_central"], codigo=codigo, nombre=codigo)
    db_session.add(c)
    db_session.flush()
    tec = db_session.scalar(select(Tecnico).where(Tecnico.p00 == P00_TEC))
    db_session.add(
        CuadrillaTecnico(
            id_cuadrilla=c.id_cuadrilla, id_tecnico=tec.id_tecnico, desde=date(2020, 1, 1)
        )
    )
    db_session.commit()
    return c.id_cuadrilla, tec.id_tecnico


def _token_mantenimiento(monkeypatch):
    from app.core.config import get_settings

    monkeypatch.setenv("MANTENIMIENTO_TOKEN", "tok-d81")
    get_settings.cache_clear()
    return {"X-Mantenimiento-Token": "tok-d81"}


# --------------------------------------------------------------------------- #
# CU-D81-04 — Enviar
# --------------------------------------------------------------------------- #
def test_enviar_todos_y_recibir(client, admin_token):
    r = client.post(
        f"{BASE}/mensajes",
        json={"destino_tipo": "TODOS", "cuerpo": "Hola equipo, revisar despacho."},
        headers=admin_token["admin"],
    )
    assert r.status_code == 201, r.text
    assert r.json()["tipo"] == "TEXTO" and r.json()["origen_p00"] == "TESTADM"

    recibidos = client.get(f"{BASE}/mensajes?desde=0", headers=admin_token["tecnico"])
    assert recibidos.status_code == 200
    assert len(recibidos.json()) == 1 and recibidos.json()[0]["leido"] is False


def test_ultimos_trae_los_mas_recientes_y_en_orden(client, admin_token):
    """D-86: la primera carga de la APK pide los N **más recientes**.

    Antes pedía `desde=0` y recibía los N más antiguos, así que con más de N
    mensajes los recién llegados tardaban varios ciclos de sondeo en aparecer.
    """
    for i in range(5):
        r = client.post(
            f"{BASE}/mensajes",
            json={"destino_tipo": "TODOS", "cuerpo": f"Mensaje {i}"},
            headers=admin_token["admin"],
        )
        assert r.status_code == 201, r.text

    recientes = client.get(f"{BASE}/mensajes?ultimos=3", headers=admin_token["tecnico"])
    assert recientes.status_code == 200, recientes.text
    cuerpos = [m["cuerpo"] for m in recientes.json()]
    assert cuerpos == ["Mensaje 2", "Mensaje 3", "Mensaje 4"], (
        "deben ser los 3 más recientes y venir en orden cronológico"
    )

    # El sondeo incremental (`desde`) no cambia: devuelve todo lo posterior.
    todos = client.get(f"{BASE}/mensajes?desde=0", headers=admin_token["tecnico"])
    assert todos.status_code == 200
    assert len(todos.json()) == 5
    despues = client.get(
        f"{BASE}/mensajes?desde={recientes.json()[-1]['id_mensaje']}",
        headers=admin_token["tecnico"],
    )
    assert despues.json() == []


def test_rbac_y_validaciones(client, admin_token):
    # El técnico no puede enviar.
    assert client.post(
        f"{BASE}/mensajes", json={"destino_tipo": "TODOS", "cuerpo": "x"},
        headers=admin_token["tecnico"],
    ).status_code == 403
    # Cuerpo vacío.
    assert client.post(
        f"{BASE}/mensajes", json={"destino_tipo": "TODOS", "cuerpo": ""},
        headers=admin_token["admin"],
    ).status_code == 422
    # Destino TECNICO inexistente.
    assert client.post(
        f"{BASE}/mensajes",
        json={"destino_tipo": "TECNICO", "id_tecnico": 999999, "cuerpo": "x"},
        headers=admin_token["admin"],
    ).status_code == 404


def test_destino_cuadrilla_solo_miembros(client, admin_token, db_session):
    id_cuadrilla, _ = _cuadrilla_con_tecnico(db_session, admin_token)
    r = client.post(
        f"{BASE}/mensajes",
        json={"destino_tipo": "CUADRILLA", "id_cuadrilla": id_cuadrilla, "cuerpo": "Para la cuadrilla"},
        headers=admin_token["admin"],
    )
    assert r.status_code == 201, r.text

    recibidos = client.get(f"{BASE}/mensajes?desde=0", headers=admin_token["tecnico"]).json()
    assert len(recibidos) == 1 and recibidos[0]["destino_tipo"] == "CUADRILLA"


# --------------------------------------------------------------------------- #
# CU-D81-05 — Recibir, leer y contar
# --------------------------------------------------------------------------- #
def test_no_leidos_marcar_idempotente(client, admin_token):
    idm = client.post(
        f"{BASE}/mensajes", json={"destino_tipo": "TODOS", "cuerpo": "A"},
        headers=admin_token["admin"],
    ).json()["id_mensaje"]
    assert client.get(f"{BASE}/mensajes/no-leidos", headers=admin_token["tecnico"]).json()["total"] == 1

    assert client.post(f"{BASE}/mensajes/{idm}/leido", headers=admin_token["tecnico"]).status_code == 204
    assert client.post(f"{BASE}/mensajes/{idm}/leido", headers=admin_token["tecnico"]).status_code == 204
    assert client.get(f"{BASE}/mensajes/no-leidos", headers=admin_token["tecnico"]).json()["total"] == 0


def test_leidos_masivo(client, admin_token):
    ids = [
        client.post(
            f"{BASE}/mensajes", json={"destino_tipo": "TODOS", "cuerpo": f"M{i}"},
            headers=admin_token["admin"],
        ).json()["id_mensaje"]
        for i in range(3)
    ]
    r = client.post(f"{BASE}/mensajes/leidos", json={"ids": ids}, headers=admin_token["tecnico"])
    assert r.status_code == 200 and r.json()["actualizados"] == 3
    assert client.get(f"{BASE}/mensajes/no-leidos", headers=admin_token["tecnico"]).json()["total"] == 0


# --------------------------------------------------------------------------- #
# CU-D81-11 — Bandeja del autor
# --------------------------------------------------------------------------- #
def test_bandeja(client, admin_token):
    client.post(
        f"{BASE}/mensajes", json={"destino_tipo": "TODOS", "cuerpo": "B"}, headers=admin_token["admin"]
    )
    r = client.get(f"{BASE}/mensajes/bandeja", headers=admin_token["admin"])
    assert r.status_code == 200 and r.json()["total"] >= 1
    assert client.get(f"{BASE}/mensajes/bandeja", headers=admin_token["tecnico"]).status_code == 403


# --------------------------------------------------------------------------- #
# CU-D81-06 — Automáticos
# --------------------------------------------------------------------------- #
def test_cierre_de_sync_emite_estado_sync(client, admin_token, db_session):
    _cuadrilla_con_tecnico(db_session, admin_token)
    id_log = client.post(
        f"{BASE}/sync/sesion", json={"tipo": "CARGA"}, headers=admin_token["tecnico"]
    ).json()["id_sync_log"]
    client.patch(
        f"{BASE}/sync/sesion/{id_log}",
        json={"recibidos": 3, "procesados": 3, "errores": 0},
        headers=admin_token["tecnico"],
    )
    recibidos = client.get(f"{BASE}/mensajes?desde=0", headers=admin_token["tecnico"]).json()
    assert any(m["tipo"] == "ESTADO_SYNC" for m in recibidos)


def test_recordatorios_citas_idempotente(client, admin_token, db_session, monkeypatch):
    id_cuadrilla, _ = _cuadrilla_con_tecnico(db_session, admin_token)
    caso = client.post(
        CASOS, json={"id_averia": "TSTCITA-1", "direccion": "X"}, headers=admin_token["admin"]
    ).json()
    from app.models import Cita

    db_session.add(
        Cita(
            id_caso=caso["id_caso"],
            id_cuadrilla=id_cuadrilla,
            fecha_hora=datetime.now(UTC) + timedelta(minutes=30),
            estado="CONFIRMADA",
            tipo="ATENCION",
        )
    )
    db_session.commit()

    h = _token_mantenimiento(monkeypatch)
    try:
        r1 = client.post(f"{BASE}/mantenimiento/recordatorios-citas", headers=h)
        assert r1.status_code == 200 and r1.json()["recordatorios"] == 1
        r2 = client.post(f"{BASE}/mantenimiento/recordatorios-citas", headers=h)
        assert r2.json()["recordatorios"] == 0  # idempotente
    finally:
        from app.core.config import get_settings

        get_settings.cache_clear()


def test_alarmas_despacho(client, admin_token, db_session, monkeypatch):
    id_cuadrilla, _ = _cuadrilla_con_tecnico(db_session, admin_token)
    sector = Sector(id_central=admin_token["id_central"], nombre="Norte D81", codigo="TSD83")
    db_session.add(sector)
    db_session.flush()
    db_session.add(
        CuadrillaSectorDia(
            id_central=admin_token["id_central"],
            fecha=date.today(),
            id_cuadrilla=id_cuadrilla,
            id_sector=sector.id_sector,
        )
    )
    db_session.add(
        FallaMasiva(
            id_central=admin_token["id_central"],
            descripcion="Concentración de averías",
            id_sector=sector.id_sector,
            estado="DETECTADA",
        )
    )
    db_session.commit()

    h = _token_mantenimiento(monkeypatch)
    try:
        r1 = client.post(f"{BASE}/mantenimiento/alarmas-despacho", headers=h)
        assert r1.status_code == 200 and r1.json()["alarmas"] >= 1
        r2 = client.post(f"{BASE}/mantenimiento/alarmas-despacho", headers=h)
        assert r2.json()["alarmas"] == 0  # idempotente
    finally:
        from app.core.config import get_settings

        get_settings.cache_clear()
