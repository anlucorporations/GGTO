"""Pruebas unitarias del incremento D-81 (sin base de datos).

Cubren los modelos nuevos, sus restricciones y el guardián de token de
mantenimiento (fail-closed). Las pruebas de integración del incremento viven en
`test_d81_api.py` (requieren `GGTO_TEST_DB_URL`).
"""

from __future__ import annotations

import pytest
from fastapi import HTTPException
from sqlalchemy import CheckConstraint, UniqueConstraint

from app.core.config import get_settings
from app.core.db import Base
from app.models import Mensaje, MensajeDestino, SyncCheck, SyncLog


# --------------------------------------------------------------------------- #
# Modelos
# --------------------------------------------------------------------------- #
def test_tablas_d81_registradas():
    nombres = set(Base.metadata.tables)
    assert {"sync_log", "sync_check", "mensaje", "mensaje_destino"} <= nombres


def test_sync_log_columnas_nuevas():
    cols = {c.name for c in SyncLog.__table__.columns}
    assert {"plataforma", "duracion_ms", "id_central"} <= cols


def test_sync_check_estructura():
    cols = {c.name for c in SyncCheck.__table__.columns}
    assert {"id_sync_check", "id_sync_log", "paso", "estado", "fecha_hora", "detalle"} <= cols
    checks = " ".join(
        str(c.sqltext) for c in SyncCheck.__table__.constraints if isinstance(c, CheckConstraint)
    )
    assert "CONEXION" in checks and "OMITIDO" in checks
    uniques = [
        c for c in SyncCheck.__table__.constraints if isinstance(c, UniqueConstraint)
    ]
    assert any({col.name for col in u.columns} == {"id_sync_log", "paso"} for u in uniques)


def test_mensaje_estructura_y_xor():
    cols = {c.name for c in Mensaje.__table__.columns}
    assert {
        "id_mensaje",
        "id_central",
        "origen_p00",
        "destino_tipo",
        "id_cuadrilla",
        "id_tecnico",
        "tipo",
        "cuerpo",
        "id_caso",
        "creado_en",
        "expira_en",
    } <= cols
    checks = " ".join(
        str(c.sqltext) for c in Mensaje.__table__.constraints if isinstance(c, CheckConstraint)
    )
    assert "destino_tipo = 'TODOS'" in checks  # XOR de destinatarios (M-04)
    assert "expira_en > creado_en" in checks


def test_mensaje_destino_pk_compuesta():
    pk = [c.name for c in MensajeDestino.__table__.primary_key.columns]
    assert pk == ["id_mensaje", "id_tecnico"]


# --------------------------------------------------------------------------- #
# Token de mantenimiento (fail-closed)
# --------------------------------------------------------------------------- #
def test_mantenimiento_token_fail_closed(monkeypatch):
    from app.api.routes_mantenimiento import verificar_token

    monkeypatch.setenv("MANTENIMIENTO_TOKEN", "")
    get_settings.cache_clear()
    try:
        with pytest.raises(HTTPException) as exc:
            verificar_token(None)
        assert exc.value.status_code == 503
    finally:
        get_settings.cache_clear()


def test_mantenimiento_token_valida(monkeypatch):
    from app.api.routes_mantenimiento import verificar_token

    monkeypatch.setenv("MANTENIMIENTO_TOKEN", "secreto-123")
    get_settings.cache_clear()
    try:
        assert verificar_token("secreto-123") is None
        with pytest.raises(HTTPException) as exc:
            verificar_token("otro")
        assert exc.value.status_code == 401
        with pytest.raises(HTTPException) as exc2:
            verificar_token(None)
        assert exc2.value.status_code == 401
    finally:
        get_settings.cache_clear()
