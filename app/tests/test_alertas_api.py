"""Pruebas de integración del Ciclo 9: alertas, outbox, Telegram y MCP."""

from __future__ import annotations

import pytest
from sqlalchemy import select

from app.models import Caso, FallaMasiva, Notificacion

FALLAS = "/api/v1/fallas-masivas"
NOTIF = "/api/v1/notificaciones"


@pytest.fixture()
def entorno(client, admin_token, db_session):
    """Seis casos pendientes en el mismo OLT (supera el umbral de 5)."""
    headers = admin_token["admin"]
    casos = []
    for i in range(6):
        r = client.post("/api/v1/casos",
                        json={"id_averia": f"TSTA-{i}", "direccion": "SECTOR ALFA CASA 1",
                              "nombre_cliente": "CLIENTE A"}, headers=headers)
        assert r.status_code == 201, r.text
        casos.append(r.json()["id_caso"])
    # El OLT no se carga por la vía manual: se fija directamente para simular la ingesta
    for id_caso in casos:
        caso = db_session.get(Caso, id_caso)
        caso.olt = "pde-olt-99"
    db_session.commit()
    yield {"headers": headers, "casos": casos}


# --------------------------------------------------------------------------- #
# Detección automática (RF-09)
# --------------------------------------------------------------------------- #
def test_deteccion_por_concentracion(client, entorno, db_session):
    r = client.post(f"{FALLAS}/detectar", headers=entorno["headers"])
    assert r.status_code == 200, r.text
    creadas = r.json()
    assert len(creadas) == 1
    falla = creadas[0]
    assert falla["origen"] == "AUTOMATICA"
    assert falla["clave_concentracion"] == "olt:pde-olt-99"
    assert falla["estado"] == "DETECTADA"

    # Idempotente: una segunda detección no duplica
    otra = client.post(f"{FALLAS}/detectar", headers=entorno["headers"])
    assert otra.status_code == 200
    assert otra.json() == []
    assert db_session.scalar(select(FallaMasiva).where(
        FallaMasiva.clave_concentracion == "olt:pde-olt-99")) is not None


def test_deteccion_encola_alerta(client, entorno, db_session):
    client.post(f"{FALLAS}/detectar", headers=entorno["headers"])
    notificaciones = client.get(NOTIF, headers=entorno["headers"]).json()
    assert len(notificaciones) >= 1
    alerta = notificaciones[0]
    assert alerta["canal"] == "TELEGRAM"
    assert "Falla masiva" in alerta["asunto"]
    # Sin credenciales del bot queda PENDIENTE, no se pierde
    assert alerta["estado"] == "PENDIENTE"


def test_deteccion_desactivada(client, entorno, db_session):
    from app.models import Configuracion

    config = db_session.get(Configuracion, "fallas.activo")
    config.valor = False
    db_session.commit()
    try:
        r = client.post(f"{FALLAS}/detectar", headers=entorno["headers"])
        assert r.status_code == 200
        assert r.json() == []
    finally:
        config.valor = True
        db_session.commit()


# --------------------------------------------------------------------------- #
# Reporte manual, planificación y material (RF-16, RF-17, RF-18)
# --------------------------------------------------------------------------- #
def test_reporte_manual_y_planificacion(client, entorno):
    r = client.post(FALLAS, json={"descripcion": "Corte de fibra sector Alfa"},
                    headers=entorno["headers"])
    assert r.status_code == 201, r.text
    id_falla = r.json()["id_falla"]
    assert r.json()["origen"] == "REPORTE_TECNICO"

    plan = client.post(f"{FALLAS}/{id_falla}/planificacion", json={
        "planificacion": "Cuadrilla 1 a las 8am con fusionadora",
        "reporte_simple": "Afectados 20 servicios",
        "evidencias": ["IMG-001", "IMG-002"],
    }, headers=entorno["headers"])
    assert plan.status_code == 200, plan.text
    cuerpo = plan.json()
    assert cuerpo["estado"] == "PLANIFICADA"
    assert cuerpo["planificada_en"] is not None
    assert "IMG-001" in (cuerpo["reporte_simple"] or "")


def test_solicitud_de_material(client, entorno):
    falla = client.post(FALLAS, json={"descripcion": "Falla con material"},
                        headers=entorno["headers"]).json()
    r = client.post(f"{FALLAS}/{falla['id_falla']}/material",
                    json={"descripcion": "50 m de fibra y 4 conectores"},
                    headers=entorno["headers"])
    assert r.status_code == 201, r.text
    assert r.json()["estado"] == "SOLICITADA"
    assert f"[Falla {falla['id_falla']}]" in r.json()["observacion"]


def test_actualizar_estado_de_falla(client, entorno):
    falla = client.post(FALLAS, json={"descripcion": "Falla para cerrar"},
                        headers=entorno["headers"]).json()
    r = client.patch(f"{FALLAS}/{falla['id_falla']}", json={"estado": "CERRADA"},
                     headers=entorno["headers"])
    assert r.status_code == 200
    assert r.json()["estado"] == "CERRADA"


def test_filtros_de_fallas(client, entorno):
    client.post(FALLAS, json={"descripcion": "Falla filtro"}, headers=entorno["headers"])
    todas = client.get(FALLAS, headers=entorno["headers"]).json()
    assert len(todas) >= 1
    activas = client.get(FALLAS, params={"solo_activas": True}, headers=entorno["headers"]).json()
    assert all(f["estado"] in ("DETECTADA", "PLANIFICADA") for f in activas)


# --------------------------------------------------------------------------- #
# Outbox (RNF-20)
# --------------------------------------------------------------------------- #
def test_procesar_outbox_sin_credenciales(client, entorno, db_session):
    client.post(FALLAS, json={"descripcion": "Falla para outbox"}, headers=entorno["headers"])
    r = client.post(f"{NOTIF}/procesar", headers=entorno["headers"])
    assert r.status_code == 200, r.text
    resumen = r.json()
    assert resumen["intentadas"] >= 1
    assert resumen["diferidas"] >= 1        # sin TELEGRAM_BOT_TOKEN
    assert resumen["enviadas"] == 0

    # Las diferidas se reprograman y no se pierden
    pendientes = client.get(NOTIF, params={"estado": "PENDIENTE"},
                            headers=entorno["headers"]).json()
    assert pendientes and pendientes[0]["proximo_intento"] is not None
    assert db_session.scalar(select(Notificacion)) is not None


# --------------------------------------------------------------------------- #
# Telegram (RF-06, RF-16)
# --------------------------------------------------------------------------- #
def _update(texto: str, chat_id: int = 12345):
    return {"message": {"chat": {"id": chat_id}, "text": texto}}


def test_telegram_ayuda(client, entorno):
    r = client.post("/api/v1/telegram/webhook", json=_update("/ayuda"))
    assert r.status_code == 200, r.text
    assert "Comandos" in r.json()["respuesta"]


def test_telegram_estado(client, entorno):
    r = client.post("/api/v1/telegram/webhook", json=_update("/estado"))
    assert r.status_code == 200
    assert "Casos pendientes" in r.json()["respuesta"]


def test_telegram_consulta_caso(client, entorno):
    r = client.post("/api/v1/telegram/webhook", json=_update("/caso TSTA-0"))
    assert r.status_code == 200
    assert "TSTA-0" in r.json()["respuesta"]

    faltante = client.post("/api/v1/telegram/webhook", json=_update("/caso NOEXISTE"))
    assert "No encontré" in faltante.json()["respuesta"]


def test_telegram_reporta_falla(client, entorno, db_session):
    r = client.post("/api/v1/telegram/webhook",
                    json=_update("/falla Corte total en el sector"))
    assert r.status_code == 200
    assert "registrada" in r.json()["respuesta"]
    falla = db_session.scalar(select(FallaMasiva).where(FallaMasiva.origen == "REPORTE_TECNICO"))
    assert falla is not None and "Telegram" in falla.descripcion


def test_telegram_sin_texto(client):
    r = client.post("/api/v1/telegram/webhook", json={"message": {"chat": {"id": 1}}})
    assert r.status_code == 200
    assert r.json().get("ignorado") is True


def test_telegram_secreto(client, entorno, db_session):
    from app.models import Configuracion

    config = db_session.get(Configuracion, "telegram.webhook_secret")
    config.valor = "s3creto"
    db_session.commit()
    try:
        rechazado = client.post("/api/v1/telegram/webhook", json=_update("/estado"))
        assert rechazado.status_code == 403
        ok = client.post("/api/v1/telegram/webhook", json=_update("/estado"),
                         headers={"X-Telegram-Bot-Api-Secret-Token": "s3creto"})
        assert ok.status_code == 200
    finally:
        config.valor = ""
        db_session.commit()


# --------------------------------------------------------------------------- #
# MCP (RF-06)
# --------------------------------------------------------------------------- #
def _rpc(metodo: str, params: dict | None = None, ident: int = 1, token: str | None = None):
    return {"jsonrpc": "2.0", "id": ident, "method": metodo, "params": params or {}}


def test_mcp_initialize(client):
    r = client.post("/api/v1/mcp", json=_rpc("initialize"))
    assert r.status_code == 200
    assert r.json()["result"]["serverInfo"]["name"] == "ggto-mcp"


def test_mcp_tools_list(client):
    r = client.post("/api/v1/mcp", json=_rpc("tools/list"))
    nombres = {t["name"] for t in r.json()["result"]["tools"]}
    assert {"estado_central", "consultar_caso", "reportar_falla",
            "procesar_notificaciones"} <= nombres


def test_mcp_tool_estado_y_caso(client, entorno):
    r = client.post("/api/v1/mcp", json=_rpc("tools/call", {
        "name": "estado_central", "arguments": {}}))
    datos = r.json()["result"]["datos"]
    assert datos["casos_pendientes"] == 6

    caso = client.post("/api/v1/mcp", json=_rpc("tools/call", {
        "name": "consultar_caso", "arguments": {"id_averia": "TSTA-1"}}))
    assert caso.json()["result"]["datos"]["encontrado"] is True

    sin_argumentos = client.post("/api/v1/mcp", json=_rpc("tools/call", {
        "name": "consultar_caso", "arguments": {}}))
    assert sin_argumentos.json()["error"]["code"] == -32602


def test_mcp_reportar_falla(client, entorno, db_session):
    r = client.post("/api/v1/mcp", json=_rpc("tools/call", {
        "name": "reportar_falla", "arguments": {"descripcion": "Falla reportada por IA"}}))
    assert r.status_code == 200
    assert r.json()["result"]["datos"]["estado"] == "DETECTADA"
    assert db_session.scalar(select(FallaMasiva).where(FallaMasiva.origen == "MCP")) is not None


def test_mcp_metodo_no_soportado(client):
    r = client.post("/api/v1/mcp", json=_rpc("resources/list"))
    assert r.json()["error"]["code"] == -32601


def test_mcp_clave(client, entorno, db_session):
    from app.models import Configuracion

    config = db_session.get(Configuracion, "mcp.api_key")
    config.valor = "clave-mcp"
    db_session.commit()
    try:
        rechazado = client.post("/api/v1/mcp", json=_rpc("initialize"))
        assert rechazado.json()["error"]["code"] == -32001
        ok = client.post("/api/v1/mcp", json=_rpc("initialize"), headers={"X-MCP-Key": "clave-mcp"})
        assert ok.json()["result"]["serverInfo"]["name"] == "ggto-mcp"
    finally:
        config.valor = ""
        db_session.commit()


# --------------------------------------------------------------------------- #
# Métricas y RBAC
# --------------------------------------------------------------------------- #
def test_metricas(client, entorno):
    r = client.get("/api/v1/metricas", headers=entorno["headers"])
    assert r.status_code == 200, r.text
    datos = r.json()
    assert datos["casos_total"] == 6
    assert datos["casos_ingeridos"] == 0
    assert datos["canales_configurados"]["telegram"] is False
    assert set(datos["canales_configurados"]) == {"telegram", "correo"}


def test_rbac_tecnico(client, entorno, admin_token):
    tecnico = admin_token["tecnico"]
    assert client.get(FALLAS, headers=tecnico).status_code == 200
    assert client.get("/api/v1/metricas", headers=tecnico).status_code == 200
    assert client.post(FALLAS, json={"descripcion": "x" * 10},
                       headers=tecnico).status_code == 403
    assert client.post(f"{NOTIF}/procesar", headers=tecnico).status_code == 403


def test_sin_token(client):
    assert client.get(FALLAS).status_code == 401
