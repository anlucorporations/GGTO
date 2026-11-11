"""Asistente virtual — endpoints de sesiones (ciclo C4).

Prueba permisos (RNF-AV: ADMIN/SUPERVISOR; TÉCNICO fuera) y recinto (la
escritura/lectura se acota por la central del usuario autenticado; solo el
SUPER puede cruzar centrales).
"""

from __future__ import annotations

import pytest

from app.models import Central

RUTA = "/api/v1/asistente/sesiones"
CLAVE_TEST = "config12345"     # conftest.py
P00_SUPER = "TESTSUP"          # conftest.py
P00_SPV = "TESTSPV"            # conftest.py
TURNO = {
    "sesion_id": "TST-SESION-1",
    "canal": "PANEL",
    "p00": P00_SPV,
    "texto_entrada": "cambiar caso 7012345678 a CONTACTADO",
    "intencion": "EVENTO",
    "detalle": "CAMBIO_ESTADO",
    "respuesta": "Estado actualizado por el camino canónico",
}


def _login(client, p00):
    r = client.post("/api/v1/auth/login", json={"p00": p00, "clave": CLAVE_TEST})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture()
def _segunda_central(db_session):
    """Central de prueba distinta (para verificar el recinto entre centrales)."""
    db_session.add(Central(
        codigo_central="TST9X", nombre_central="Central 9 de prueba", area="ARA",
        region="CENTRO", estado_geografico="LAGO", municipio="MARACAIBO",
        parroquia="COORDINACION",
    ))
    db_session.commit()
    return db_session.query(Central).filter(Central.codigo_central == "TST9X").one().id_central


def test_requiere_autenticacion(client):
    assert client.post(RUTA, json=TURNO).status_code in (401, 403)
    assert client.get(RUTA).status_code in (401, 403)


def test_tecnico_sin_acceso(client, admin_token):
    r = client.post(RUTA, json=TURNO, headers=admin_token["tecnico"])
    assert r.status_code == 403
    r = client.get(RUTA, headers=admin_token["tecnico"])
    assert r.status_code == 403


def test_supervisor_registra_turno_con_recinto_forzado(client, admin_token):
    h = admin_token["supervisor"]
    # id_central ajena en la query no se acepta ni se usa (se fuerza su central)
    r = client.post(f"{RUTA}?id_central=999999", json=TURNO, headers=h)
    assert r.status_code == 201, r.text
    cuerpo = r.json()
    assert cuerpo["canal"] == "PANEL"
    assert cuerpo["intencion"] == "EVENTO"
    assert cuerpo["id_central"] != 999999 or cuerpo["id_central"] is None
    # el historial del supervisor no devuelve turnos de otra central
    r2 = client.get(RUTA, headers=h)
    assert r2.status_code == 200
    assert all(t["sesion_id"] == "TST-SESION-1" for t in r2.json())


def test_supervisor_no_ve_central_ajena(client, admin_token, _segunda_central):
    h_sup = admin_token["supervisor"]
    h_super = admin_token["super"]
    # turno del SUPER en la central de prueba 9 (recinto cruzado permitido)
    r = client.post(f"{RUTA}?id_central={_segunda_central}",
                    json={**TURNO, "sesion_id": "TST-SESION-2"}, headers=h_super)
    assert r.status_code == 201, r.text
    assert r.json()["id_central"] == _segunda_central
    # el SUPERVISOR (central 2324X) no ve el turno de la central 9
    r2 = client.get(RUTA, headers=h_sup)
    assert all(t["sesion_id"] != "TST-SESION-2" for t in r2.json())
    # el SUPER sí lo ve
    r3 = client.get(RUTA, headers=h_super)
    assert any(t["sesion_id"] == "TST-SESION-2" for t in r3.json())


def test_filtros_sesion_y_canal(client, admin_token):
    h = admin_token["supervisor"]
    for sid, canal in (("TST-SESION-A", "PANEL"), ("TST-SESION-B", "TELEGRAM")):
        r = client.post(RUTA, json={**TURNO, "sesion_id": sid, "canal": canal}, headers=h)
        assert r.status_code == 201, r.text
    r = client.get(RUTA, params={"sesion_id": "TST-SESION-B"}, headers=h)
    assert r.status_code == 200
    filas = r.json()
    assert filas and all(t["sesion_id"] == "TST-SESION-B" for t in filas)
    r = client.get(RUTA, params={"canal": "TELEGRAM", "sesion_id": "TST-SESION-B"}, headers=h)
    assert all(t["canal"] == "TELEGRAM" for t in r.json())
    r = client.get(RUTA, params={"sesion_id": "TST-SESION-INEXISTENTE"}, headers=h)
    assert r.json() == []


# --------------------------------------------------------------------------- #
# C5: remitentes de Telegram
# --------------------------------------------------------------------------- #
RUTA_REM = "/api/v1/asistente/remitentes"


def _id_central_admin(db_session):
    from sqlalchemy import select

    from app.models import Central

    return db_session.scalar(select(Central.id_central).where(Central.codigo_central == "2324X"))


def test_remitente_alta_solo_super(client, admin_token, db_session):
    idc = _id_central_admin(db_session)
    alta = {"id_central": idc, "canal": "TELEGRAM", "chat_id": "TSTCHAT1", "p00": P00_SPV, "nombre": "SPV Test"}
    # el SUPERVISOR no puede dar de alta remitentes (decisión: alta por SUPER)
    r = client.post(RUTA_REM, json=alta, headers=admin_token["supervisor"])
    assert r.status_code == 403
    r = client.post(RUTA_REM, json=alta, headers=admin_token["super"])
    assert r.status_code == 201, r.text
    assert r.json()["chat_id"] == "TSTCHAT1"
    assert r.json()["activo"] is True


def test_remitente_chat_duplicado_409(client, admin_token, db_session):
    idc = _id_central_admin(db_session)
    alta = {"id_central": idc, "chat_id": "TSTCHAT2", "p00": P00_SPV}
    assert client.post(RUTA_REM, json=alta, headers=admin_token["super"]).status_code == 201
    r = client.post(RUTA_REM, json=alta, headers=admin_token["super"])
    assert r.status_code == 409


def test_remitente_recinto_y_consulta_por_chat(client, admin_token, db_session, _segunda_central):
    h_sup = admin_token["supervisor"]
    h_super = admin_token["super"]
    # remitente en la central 9 (el SUPER puede cruzar); chat_id consultable por el asistente
    r = client.post(RUTA_REM, json={"id_central": _segunda_central, "chat_id": "TSTCHAT3",
                                    "p00": P00_SPV, "canal": "TELEGRAM"}, headers=h_super)
    assert r.status_code == 201, r.text
    # el asistente (usuario de servicio SUPERVISOR de 2324X) NO ve remitentes de otra central
    r = client.get(RUTA_REM, params={"canal": "TELEGRAM", "chat_id": "TSTCHAT3"}, headers=h_sup)
    assert r.json() == []
    # remitente en su propia central sí se ve por chat_id
    idc = _id_central_admin(db_session)
    client.post(RUTA_REM, json={"id_central": idc, "chat_id": "TSTCHAT4", "p00": P00_SPV,
                                "canal": "TELEGRAM"}, headers=h_super)
    r = client.get(RUTA_REM, params={"canal": "TELEGRAM", "chat_id": "TSTCHAT4"}, headers=h_sup)
    assert r.status_code == 200
    fila = r.json()
    assert fila and fila[0]["chat_id"] == "TSTCHAT4" and fila[0]["activo"] is True


def test_remitente_desactivar_solo_super(client, admin_token, db_session):
    idc = _id_central_admin(db_session)
    client.post(RUTA_REM, json={"id_central": idc, "chat_id": "TSTCHAT5", "p00": P00_SPV,
                                "canal": "TELEGRAM"}, headers=admin_token["super"])
    fila = client.get(RUTA_REM, params={"chat_id": "TSTCHAT5"}, headers=admin_token["supervisor"]).json()[0]
    # el SUPERVISOR no puede desactivar
    r = client.patch(f"{RUTA_REM}/{fila['id_remitente']}", json={"activo": False},
                     headers=admin_token["supervisor"])
    assert r.status_code == 403
    r = client.patch(f"{RUTA_REM}/{fila['id_remitente']}", json={"activo": False},
                     headers=admin_token["super"])
    assert r.status_code == 200 and r.json()["activo"] is False
    # desactivado no aparece en la consulta del asistente (activo=true)
    r = client.get(RUTA_REM, params={"chat_id": "TSTCHAT5", "activo": True},
                   headers=admin_token["supervisor"])
    assert r.json() == []
