"""Pruebas de contrato de la API (Fase 4).

Verifican que el contrato OpenAPI publicado es coherente y estable: rutas
versionadas, documentación, modelos de respuesta, esquema de seguridad y el
contrato de errores (401/403/404/422) sobre la matriz de roles.
"""

from __future__ import annotations

from app.main import app

ESQUEMA = app.openapi()
RUTAS = ESQUEMA["paths"]
METODOS = ("get", "post", "put", "patch", "delete")


def _operaciones():
    for ruta, item in RUTAS.items():
        for metodo, operacion in item.items():
            if metodo in METODOS:
                yield ruta, metodo, operacion


# --------------------------------------------------------------------------- #
# Contrato OpenAPI
# --------------------------------------------------------------------------- #
def test_todas_las_rutas_estan_versionadas():
    sin_version = [r for r in RUTAS if r.startswith("/api/") and not r.startswith("/api/v1/")]
    assert sin_version == []


def test_cobertura_del_contrato():
    total = sum(1 for _ in _operaciones())
    assert total >= 70, f"el contrato solo declara {total} operaciones"
    assert "/api/v1/fallas-masivas" in RUTAS
    assert "/api/v1/mcp" in RUTAS
    assert "/api/v1/telegram/webhook" in RUTAS
    assert "/api/v1/metricas" in RUTAS


def test_cada_operacion_esta_documentada():
    sin_resumen = [
        f"{metodo.upper()} {ruta}"
        for ruta, metodo, operacion in _operaciones()
        if not operacion.get("summary")
    ]
    assert sin_resumen == []


def test_las_respuestas_declaradas_tienen_descripcion():
    sin_descripcion = [
        f"{metodo.upper()} {ruta}"
        for ruta, metodo, operacion in _operaciones()
        for codigo, respuesta in operacion.get("responses", {}).items()
        if not respuesta.get("description")
    ]
    assert sin_descripcion == []


def test_los_endpoints_de_listado_declaran_su_modelo():
    """Un 200 sin `content` suele indicar que se olvidó el `response_model`."""
    sin_modelo = [
        f"{metodo.upper()} {ruta}"
        for ruta, metodo, operacion in _operaciones()
        if "200" in operacion.get("responses", {})
        and "content" not in operacion["responses"]["200"]
        and not ruta.startswith(("/health", "/ready"))
    ]
    assert sin_modelo == []


def test_esquema_de_seguridad_bearer():
    esquemas = ESQUEMA.get("components", {}).get("securitySchemes", {})
    assert any(v.get("scheme", "").lower() == "bearer" for v in esquemas.values())


def test_las_rutas_privadas_exigen_seguridad():
    """Toda ruta de negocio declara `HTTPBearer` (salvo salud, login y webhooks)."""
    publicas = (
        "/health",
        "/ready",
        "/api/v1/info",
        "/api/v1/auth/login",
        "/api/v1/auth/setup",
        "/api/v1/auth/unlock",
        "/api/v1/auth/reset-password",
        "/api/v1/auth/primer-acceso",
        "/api/v1/telegram/webhook",
        "/api/v1/mcp",
    )
    sin_seguridad = [
        f"{metodo.upper()} {ruta}"
        for ruta, metodo, operacion in _operaciones()
        if ruta not in publicas and not operacion.get("security")
    ]
    assert sin_seguridad == []


# --------------------------------------------------------------------------- #
# Contrato de errores y RBAC
# --------------------------------------------------------------------------- #
def test_error_de_autenticacion_en_formato_detail(client):
    respuesta = client.get("/api/v1/casos")
    assert respuesta.status_code == 401
    assert "detail" in respuesta.json()


def test_error_de_autorizacion_en_formato_detail(client, admin_token):
    respuesta = client.post("/api/v1/fallas-masivas", json={"descripcion": "x" * 10},
                            headers=admin_token["tecnico"])
    assert respuesta.status_code == 403
    assert "detail" in respuesta.json()


def test_error_de_recurso_inexistente(client, admin_token):
    respuesta = client.get("/api/v1/casos/99999999", headers=admin_token["admin"])
    assert respuesta.status_code == 404
    assert "detail" in respuesta.json()


def test_error_de_validacion_422(client, admin_token):
    respuesta = client.post("/api/v1/casos", json={"categoria": "INEXISTENTE"},
                            headers=admin_token["admin"])
    assert respuesta.status_code == 422
    assert isinstance(respuesta.json()["detail"], list)


def test_rbac_matriz_de_escritura(client, admin_token):
    """TECNICO no escribe; ADMIN y SUPERVISOR sí (por el rol, no por la ruta)."""
    cuerpo = {"descripcion": "Falla de contrato para RBAC"}
    for rol in ("admin", "super"):
        respuesta = client.post("/api/v1/fallas-masivas", json=cuerpo,
                                headers=admin_token[rol])
        assert respuesta.status_code == 201, f"{rol} debería poder crear fallas"
    respuesta = client.post("/api/v1/fallas-masivas", json=cuerpo,
                            headers=admin_token["tecnico"])
    assert respuesta.status_code == 403


def test_los_webhooks_no_exigen_token(client):
    """Telegram y MCP son públicos (se protegen por secreto propio, no por JWT)."""
    assert client.post("/api/v1/telegram/webhook", json={"message": {}}).status_code == 200
    assert client.post("/api/v1/mcp", json={"jsonrpc": "2.0", "id": 1,
                                            "method": "initialize"}).status_code == 200


def test_paginacion_declarada_en_casos(client, admin_token):
    respuesta = client.get("/api/v1/casos", headers=admin_token["admin"])
    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert set(cuerpo) >= {"items", "total", "page", "page_size", "pages"}
