"""D-155 - Observabilidad: logs JSON, contexto y redacción (H-15).

Fija el contrato de los logs de operación:

- cada registro es una línea JSON con `request_id`, `usuario` y `rol`;
- el middleware emite `http_request` con método, ruta, estado y latencia;
- el usuario y el rol se vinculan tras autenticar y viajan a los servicios;
- los secretos, correos y teléfonos se redactan antes de escribir;
- `/ready` y el outbox dejan eventos que las alertas pueden contar.
"""

from __future__ import annotations

import json
import logging
import pathlib
import re
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.observabilidad import (
    FiltroContexto,
    FormatoJSON,
    iniciar_request,
    limpiar_contexto,
    redactar,
    vincular_usuario,
)
from app.main import app
from app.tests.conftest import P00_ADMIN

EVENTO = "http_request"
RUTA_MUESTRA = (
    pathlib.Path(__file__).resolve().parents[2]
    / "RepoTecnico"
    / "muestras"
    / "detalle_averias_gpon_EJEMPLO.csv"
)


class _Captura(logging.Handler):
    """Guarda los registros para inspeccionarlos sin tocar la salida real."""

    def __init__(self) -> None:
        super().__init__()
        self.registros: list[logging.LogRecord] = []
        self.addFilter(FiltroContexto())

    def emit(self, record: logging.LogRecord) -> None:
        self.registros.append(record)


def _capturar() -> _Captura:
    handler = _Captura()
    logging.getLogger().addHandler(handler)
    return handler


def _soltar(handler: _Captura) -> None:
    logging.getLogger().removeHandler(handler)


def _datos(record: logging.LogRecord) -> dict:
    return json.loads(FormatoJSON().format(record))


def _eventos(handler: _Captura, nombre: str) -> list[logging.LogRecord]:
    return [r for r in handler.registros if getattr(r, "evento", "") == nombre]


def test_redacta_secretos_correos_telefonos_y_p00() -> None:
    texto = (
        "Authorization: Bearer abc.def.ghi usuario=TESTTEC p00=TESTADM "
        "clave=secreta correo.uno@cantv.com.ve telefono 04141234567 "
        "cedula 12345678"
    )
    limpio = redactar(texto)
    assert "abc.def.ghi" not in limpio
    assert "TESTADM" not in limpio
    assert "secreta" not in limpio
    assert "correo.uno@cantv.com.ve" not in limpio
    assert "04141234567" not in limpio
    assert "***" in limpio


def test_formato_json_incluye_contexto_y_redacta_el_mensaje() -> None:
    iniciar_request("req-123")
    vincular_usuario("TESTTEC", "TECNICO")
    try:
        record = logging.LogRecord(
            "ggto.prueba",
            logging.INFO,
            __file__,
            1,
            "contacto 04141234567 token=abc",
            (),
            None,
        )
        record.evento = "prueba"
        record.metodo = "GET"
        record.ruta = "/api/v1/prueba"
        record.status = 200
        record.ms = 12.5
        datos = _datos(record)
    finally:
        limpiar_contexto()

    assert datos["severity"] == "INFO"
    assert datos["request_id"] == "req-123"
    assert datos["usuario"] == "TESTTEC"
    assert datos["rol"] == "TECNICO"
    assert datos["evento"] == "prueba"
    assert datos["metodo"] == "GET"
    assert datos["ruta"] == "/api/v1/prueba"
    assert datos["status"] == 200
    assert datos["ms"] == 12.5
    assert "04141234567" not in datos["message"]
    assert "abc" not in datos["message"]


def test_middleware_emite_http_request_y_conserva_el_request_id() -> None:
    handler = _capturar()
    try:
        with TestClient(app) as cliente:
            valido = cliente.get("/health", headers={"X-Request-ID": "soporte-123"})
            invalido = cliente.get("/health", headers={"X-Request-ID": "no valido!"})
    finally:
        _soltar(handler)

    assert valido.status_code == 200
    assert valido.headers["X-Request-ID"] == "soporte-123"
    assert invalido.status_code == 200
    assert re.fullmatch(r"[0-9a-f]{12}", invalido.headers["X-Request-ID"])

    eventos = _eventos(handler, EVENTO)
    assert len(eventos) == 2
    primero = _datos(eventos[0])
    assert primero["request_id"] == "soporte-123"
    assert primero["metodo"] == "GET"
    assert primero["ruta"] == "/health"
    assert primero["status"] == 200
    assert isinstance(primero["ms"], (int, float))
    assert primero["usuario"] == ""
    assert primero["rol"] == ""


def test_el_usuario_y_el_rol_llegan_al_log_de_acceso(client, admin_token) -> None:
    handler = _capturar()
    try:
        respuesta = client.get(
            "/api/v1/resumen",
            headers={**admin_token["admin"], "X-Request-ID": "con-usuario"},
        )
    finally:
        _soltar(handler)

    assert respuesta.status_code == 200
    eventos = _eventos(handler, EVENTO)
    assert eventos, "no se emitió el evento http_request"
    datos = _datos(eventos[-1])
    assert datos["request_id"] == "con-usuario"
    assert datos["usuario"] == P00_ADMIN
    assert datos["rol"] == "ADMIN"


def test_ready_fallido_emite_un_evento_observable() -> None:
    from app.core.db import get_db

    class SesionRota:
        def execute(self, *_args, **_kwargs):
            raise RuntimeError("sin base")

    def _rota():
        yield SesionRota()

    app.dependency_overrides[get_db] = _rota
    handler = _capturar()
    try:
        with TestClient(app, raise_server_exceptions=False) as cliente:
            respuesta = cliente.get("/ready")
    finally:
        app.dependency_overrides.clear()
        _soltar(handler)

    assert respuesta.status_code == 503
    eventos = _eventos(handler, "ready_fallido")
    assert eventos, "no se emitió el evento ready_fallido"
    datos = _datos(eventos[-1])
    assert datos["motivo"] == "RuntimeError"
    assert datos["severity"] == "ERROR"


def test_ingesta_emite_evento_completada(client, admin_token) -> None:
    handler = _capturar()
    try:
        with RUTA_MUESTRA.open("rb") as fh:
            respuesta = client.post(
                "/api/v1/ingesta",
                files={"archivo": ("detalle_averias_gpon.csv", fh, "text/csv")},
                headers=admin_token["admin"],
            )
    finally:
        _soltar(handler)

    assert respuesta.status_code == 201, respuesta.text
    eventos = _eventos(handler, "ingesta_completada")
    assert eventos, "no se emitió el evento ingesta_completada"
    datos = _datos(eventos[-1])
    assert datos["usuario"] == P00_ADMIN
    assert datos["filas"] > 0
    assert datos["id_lote"] > 0


def test_outbox_fallido_emite_evento(db_session, monkeypatch) -> None:
    from app.models import Configuracion, Notificacion
    from app.services import outbox

    fila = db_session.scalar(
        select(Configuracion).where(Configuracion.clave == "outbox.max_intentos")
    )
    assert fila is not None
    fila.valor = 1
    notificacion = Notificacion(
        canal="TELEGRAM",
        destinatario="123",
        asunto="prueba",
        cuerpo="cuerpo",
        estado="PENDIENTE",
        intentos=0,
        proximo_intento=datetime.now(UTC) - timedelta(minutes=1),
    )
    db_session.add(notificacion)
    db_session.commit()
    monkeypatch.setattr(outbox, "enviar", lambda *_: ("FALLIDO", "fallo de prueba"))

    handler = _capturar()
    try:
        resultado = outbox.procesar(db_session)
    finally:
        _soltar(handler)

    assert resultado["fallidas"] == 1
    eventos = _eventos(handler, "notificacion_fallida")
    assert eventos, "no se emitió el evento notificacion_fallida"
    datos = _datos(eventos[-1])
    assert datos["canal"] == "TELEGRAM"
    assert datos["id_notificacion"] == notificacion.id_notificacion
    assert datos["intentos"] == 1
    assert datos["severity"] == "ERROR"
