"""Pruebas de integración del Ciclo 9: alertas, outbox, Telegram y MCP."""

from __future__ import annotations

import pytest
from sqlalchemy import select

from app.models import Caso, FallaMasiva, Notificacion

FALLAS = "/api/v1/fallas-masivas"
NOTIF = "/api/v1/notificaciones"


@pytest.fixture()
def entorno(client, admin_token, db_session):
    """Seis casos del mismo FAT (OLT + slot + puerto + FAT), sobre el umbral."""
    headers = admin_token["admin"]
    casos = []
    for i in range(6):
        r = client.post("/api/v1/casos",
                        json={"id_averia": f"TSTA-{i}", "direccion": "SECTOR ALFA CASA 1",
                              "nombre_cliente": "CLIENTE A",
                              "contacto_cliente": "04140000000",
                              "id_pago": "7000000000",
                              "tipo_reporte": "REPARACION",
                              "tipo_problema": "SIN_SERVICIO"}, headers=headers)
        assert r.status_code == 201, r.text
        casos.append(r.json()["id_caso"])
    # La tupla técnica no se carga por la vía manual: se fija para simular la ingesta.
    for id_caso in casos:
        caso = db_session.get(Caso, id_caso)
        caso.olt = "pde-olt-99"
        caso.slot = "3"
        caso.puerto = "7"
        caso.fat = "pde-fat-99"
    db_session.commit()
    yield {"headers": headers, "casos": casos}


def _masiva(client, entorno, descripcion: str, ids_caso: list[int] | None = None):
    """Alta manual D-118 con la tupla del entorno y al menos un caso."""
    r = client.post(
        FALLAS,
        json={
            "descripcion": descripcion,
            "olt": "pde-olt-99",
            "slot": "3",
            "puerto": "7",
            "fat": "pde-fat-99",
            "direccion": "SECTOR ALFA CASA 1",
            "ids_caso": ids_caso or [entorno["casos"][0]],
        },
        headers=entorno["headers"],
    )
    assert r.status_code == 201, r.text
    return r


def test_reporte_imprimible_de_la_masiva_escapa_html(client, entorno):
    """H-06: la descripción de la falla se imprime como texto, no se ejecuta."""
    falla = _masiva(client, entorno, '<script>alert("x")</script>').json()
    r = client.get(f"{FALLAS}/{falla['id_falla']}/reporte", headers=entorno["headers"])
    assert r.status_code == 200
    assert "<script>alert" not in r.text
    assert "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;" in r.text
    assert "default-src 'none'" in r.headers["content-security-policy"]


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
    assert falla["clave_concentracion"] == "fat:pde-fat-99"
    assert falla["olt"] == "pde-olt-99" and falla["slot"] == "3"
    assert falla["puerto"] == "7" and falla["fat"] == "pde-fat-99"
    assert falla["estado"] == "DETECTADA"

    # Idempotente: una segunda detección no duplica
    otra = client.post(f"{FALLAS}/detectar", headers=entorno["headers"])
    assert otra.status_code == 200
    assert otra.json() == []
    assert db_session.scalar(select(FallaMasiva).where(
        FallaMasiva.clave_concentracion == "fat:pde-fat-99")) is not None


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
    r = _masiva(client, entorno, "Corte de fibra sector Alfa")
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
    falla = _masiva(client, entorno, "Falla con material").json()
    r = client.post(f"{FALLAS}/{falla['id_falla']}/material",
                    json={"descripcion": "50 m de fibra y 4 conectores"},
                    headers=entorno["headers"])
    assert r.status_code == 201, r.text
    assert r.json()["estado"] == "SOLICITADA"
    assert f"[Falla {falla['id_falla']}]" in r.json()["observacion"]


def test_actualizar_estado_de_falla(client, entorno):
    falla = _masiva(client, entorno, "Falla para cerrar").json()
    r = client.patch(f"{FALLAS}/{falla['id_falla']}", json={"estado": "CERRADA"},
                     headers=entorno["headers"])
    assert r.status_code == 200
    assert r.json()["estado"] == "CERRADA"


def test_filtros_de_fallas(client, entorno):
    _masiva(client, entorno, "Falla filtro")
    todas = client.get(FALLAS, headers=entorno["headers"]).json()
    assert len(todas) >= 1
    activas = client.get(FALLAS, params={"solo_activas": True}, headers=entorno["headers"]).json()
    assert all(f["estado"] in ("DETECTADA", "PLANIFICADA") for f in activas)


# --------------------------------------------------------------------------- #
# Outbox (RNF-20)
# --------------------------------------------------------------------------- #
def test_procesar_outbox_sin_credenciales(client, entorno, db_session):
    _masiva(client, entorno, "Falla para outbox")
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


# H-02: los canales externos exigen credencial. Estas pruebas los configuran.
SECRETO_TELEGRAM = "s3creto"
CLAVE_MCP = "clave-mcp"
CABECERAS_TELEGRAM = {"X-Telegram-Bot-Api-Secret-Token": SECRETO_TELEGRAM}
CABECERAS_MCP = {"X-MCP-Key": CLAVE_MCP}


def _configurar(db_session, clave: str, valor: str) -> None:
    from app.models import Configuracion

    fila = db_session.get(Configuracion, clave)
    fila.valor = valor
    db_session.commit()


@pytest.fixture()
def canales_con_credencial(db_session):
    """Configura el secreto de Telegram y la clave de MCP, y los restaura."""
    _configurar(db_session, "telegram.webhook_secret", SECRETO_TELEGRAM)
    _configurar(db_session, "mcp.api_key", CLAVE_MCP)
    yield
    _configurar(db_session, "telegram.webhook_secret", "")
    _configurar(db_session, "mcp.api_key", "")


def test_telegram_ayuda(client, entorno, canales_con_credencial):
    r = client.post("/api/v1/telegram/webhook", json=_update("/ayuda"),
                    headers=CABECERAS_TELEGRAM)
    assert r.status_code == 200, r.text
    assert "Comandos" in r.json()["respuesta"]


def test_telegram_estado(client, entorno, canales_con_credencial):
    r = client.post("/api/v1/telegram/webhook", json=_update("/estado"),
                    headers=CABECERAS_TELEGRAM)
    assert r.status_code == 200
    assert "Casos pendientes" in r.json()["respuesta"]


def test_telegram_consulta_caso(client, entorno, canales_con_credencial):
    r = client.post("/api/v1/telegram/webhook", json=_update("/caso TSTA-0"),
                    headers=CABECERAS_TELEGRAM)
    assert r.status_code == 200
    assert "TSTA-0" in r.json()["respuesta"]

    faltante = client.post("/api/v1/telegram/webhook", json=_update("/caso NOEXISTE"),
                           headers=CABECERAS_TELEGRAM)
    assert "No encontré" in faltante.json()["respuesta"]


def test_telegram_reporta_falla(client, entorno, db_session, canales_con_credencial):
    r = client.post("/api/v1/telegram/webhook",
                    json=_update("/falla Corte total en el sector"),
                    headers=CABECERAS_TELEGRAM)
    assert r.status_code == 200
    assert "registrada" in r.json()["respuesta"]
    falla = db_session.scalar(select(FallaMasiva).where(FallaMasiva.origen == "REPORTE_TECNICO"))
    assert falla is not None and "Telegram" in falla.descripcion


def test_telegram_sin_texto(client, canales_con_credencial):
    r = client.post("/api/v1/telegram/webhook", json={"message": {"chat": {"id": 1}}},
                    headers=CABECERAS_TELEGRAM)
    assert r.status_code == 200
    assert r.json().get("ignorado") is True


def test_telegram_sin_secreto_configurado_no_atiende(client, db_session):
    """H-02: sin secreto, el webhook responde 503 y no ejecuta ningún comando."""
    _configurar(db_session, "telegram.webhook_secret", "")
    r = client.post("/api/v1/telegram/webhook", json=_update("/estado"))
    assert r.status_code == 503, r.text


def test_telegram_con_secreto_incorrecto_no_atiende(client, entorno, db_session,
                                                    canales_con_credencial):
    r = client.post("/api/v1/telegram/webhook", json=_update("/estado"),
                    headers={"X-Telegram-Bot-Api-Secret-Token": "otro"})
    assert r.status_code == 403, r.text
    # El comando no se ejecuta: nada se registra como falla.
    assert db_session.scalar(select(FallaMasiva).where(
        FallaMasiva.origen == "REPORTE_TECNICO")) is None


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


def test_mcp_initialize(client, canales_con_credencial):
    r = client.post("/api/v1/mcp", json=_rpc("initialize"), headers=CABECERAS_MCP)
    assert r.status_code == 200
    assert r.json()["result"]["serverInfo"]["name"] == "ggto-mcp"


def test_mcp_tools_list(client, canales_con_credencial):
    r = client.post("/api/v1/mcp", json=_rpc("tools/list"), headers=CABECERAS_MCP)
    nombres = {t["name"] for t in r.json()["result"]["tools"]}
    assert {"estado_central", "consultar_caso", "reportar_falla",
            "procesar_notificaciones"} <= nombres


def test_mcp_tool_estado_y_caso(client, entorno, canales_con_credencial):
    r = client.post("/api/v1/mcp", json=_rpc("tools/call", {
        "name": "estado_central", "arguments": {}}), headers=CABECERAS_MCP)
    datos = r.json()["result"]["datos"]
    assert datos["casos_pendientes"] == 6

    caso = client.post("/api/v1/mcp", json=_rpc("tools/call", {
        "name": "consultar_caso", "arguments": {"id_averia": "TSTA-1"}}),
        headers=CABECERAS_MCP)
    assert caso.json()["result"]["datos"]["encontrado"] is True

    sin_argumentos = client.post("/api/v1/mcp", json=_rpc("tools/call", {
        "name": "consultar_caso", "arguments": {}}), headers=CABECERAS_MCP)
    assert sin_argumentos.json()["error"]["code"] == -32602


def test_mcp_reportar_falla(client, entorno, db_session, canales_con_credencial):
    r = client.post("/api/v1/mcp", json=_rpc("tools/call", {
        "name": "reportar_falla", "arguments": {"descripcion": "Falla reportada por IA"}}),
        headers=CABECERAS_MCP)
    assert r.status_code == 200
    assert r.json()["result"]["datos"]["estado"] == "DETECTADA"
    assert db_session.scalar(select(FallaMasiva).where(FallaMasiva.origen == "MCP")) is not None


def test_mcp_metodo_no_soportado(client, canales_con_credencial):
    r = client.post("/api/v1/mcp", json=_rpc("resources/list"), headers=CABECERAS_MCP)
    assert r.json()["error"]["code"] == -32601


def test_mcp_sin_clave_configurada_no_atiende(client, db_session):
    """H-02: sin clave, el servidor MCP responde 503 y no expone herramienta alguna."""
    _configurar(db_session, "mcp.api_key", "")
    r = client.post("/api/v1/mcp", json=_rpc("tools/list"))
    assert r.status_code == 503, r.text


def test_mcp_clave(client, entorno, db_session, canales_con_credencial):
    rechazado = client.post("/api/v1/mcp", json=_rpc("initialize"))
    assert rechazado.status_code == 401
    equivocada = client.post("/api/v1/mcp", json=_rpc("initialize"),
                             headers={"X-MCP-Key": "otra"})
    assert equivocada.status_code == 401
    ok = client.post("/api/v1/mcp", json=_rpc("initialize"), headers=CABECERAS_MCP)
    assert ok.json()["result"]["serverInfo"]["name"] == "ggto-mcp"


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


# --------------------------------------------------------------------------- #
# Ficha flotante y enriquecimiento de la tabla (ciclo D-75)
# --------------------------------------------------------------------------- #
def test_ficha_y_ordenes_por_falla(client, entorno):
    """La ficha GET devuelve la falla; sus órdenes se listan por `id_falla`."""
    headers = entorno["headers"]
    falla = _masiva(client, entorno, "Falla para la ficha").json()
    id_falla = falla["id_falla"]

    ficha = client.get(f"{FALLAS}/{id_falla}", headers=headers)
    assert ficha.status_code == 200, ficha.text
    cuerpo = ficha.json()
    assert cuerpo["id_falla"] == id_falla
    assert "ordenes_count" in cuerpo and "ruta" in cuerpo  # campos D-75

    # Dos solicitudes de material quedan ligadas a la falla (D-75: id_falla real)
    for n in ("100 m de fibra", "6 conectores SC/APC"):
        assert client.post(f"{FALLAS}/{id_falla}/material",
                           json={"descripcion": n}, headers=headers).status_code == 201
    ordenes = client.get(f"{FALLAS}/{id_falla}/ordenes", headers=headers)
    assert ordenes.status_code == 200, ordenes.text
    lista = ordenes.json()
    assert len(lista) == 2
    assert {o["id_falla"] for o in lista} == {id_falla}
    assert all(o["solicitante_usuario"] for o in lista)

    # El contador de la tabla refleja las órdenes
    assert client.get(f"{FALLAS}/{id_falla}", headers=headers).json()["ordenes_count"] == 2


def test_404_en_ficha_y_ordenes(client, entorno):
    assert client.get(f"{FALLAS}/999999", headers=entorno["headers"]).status_code == 404
    assert client.get(f"{FALLAS}/999999/ordenes",
                      headers=entorno["headers"]).status_code == 404


def test_editar_descripcion_sector_y_cuadrilla(client, entorno, admin_token):
    """La pestaña MASIVA de la ficha edita descripción/sector/cuadrilla (D-75)."""
    headers = entorno["headers"]
    falla = _masiva(client, entorno, "Descripción original larga").json()
    cuad = client.post("/api/v1/cuadrillas",
                       json={"id_central": admin_token["id_central"], "codigo": "TCF7",
                             "nombre": "Cuadrilla ficha"}, headers=headers)
    assert cuad.status_code == 201, cuad.text
    id_cuadrilla = cuad.json()["id_cuadrilla"]

    r = client.patch(f"{FALLAS}/{falla['id_falla']}",
                     json={"descripcion": "Descripción corregida por la ficha",
                           "id_cuadrilla": id_cuadrilla},
                     headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["descripcion"] == "Descripción corregida por la ficha"
    assert r.json()["cuadrilla_codigo"] == "TCF7"


def test_enriquecimiento_ruta_sector_direccion(client, entorno, db_session):
    """Sector+Dirección corta y RUTA (slot·puerto·fat) del caso representativo."""
    headers = entorno["headers"]
    id_central = db_session.scalar(
        select(Caso.id_central).where(Caso.id_averia == "TSTA-0"))

    sector = client.post("/api/v1/sectores",
                         json={"id_central": id_central, "nombre": "Delta", "codigo": "TSD7",
                               "direcciones": [{"patron": "AV LARGUISIMA DE DEL"}]},
                         headers=headers)
    assert sector.status_code == 201, sector.text
    id_sector = sector.json()["id_sector"]

    # Reasigna los 6 casos del entorno al sector y fija la ruta GPON (slot/puerto/fat)
    for i, id_caso in enumerate(entorno["casos"]):
        caso = db_session.get(Caso, id_caso)
        caso.id_sector = id_sector
        caso.direccion = "AV LARGUISIMA DE DEL 1234, SECTOR DELTA, CARACAS DISTRITO CAPITAL"
        caso.slot, caso.puerto, caso.fat = "1", "7", "FAT-99"
        if i == 0:
            caso.olt = "pde-olt-99"
    db_session.commit()

    # Detecta: agrupa por olt → la falla hereda sector y ruta del caso más reciente
    creadas = client.post(f"{FALLAS}/detectar", headers=headers).json()
    assert len(creadas) == 1
    falla = creadas[0]
    assert falla["sector_nombre"] == "Delta"
    assert falla["ruta"] == "1 · 7 · FAT-99"
    assert falla["direccion_corta"] and falla["direccion_corta"].startswith("AV LARGUISIMA")
    assert len(falla["direccion_corta"]) <= 41  # truncada a 40 + elipsis
    assert falla["casos_afectos"] == 6
