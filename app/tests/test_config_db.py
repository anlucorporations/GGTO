"""Pruebas unitarias de la configuración y la URL de conexión (sin base de datos)."""

from __future__ import annotations

from app.core import db
from app.core.config import get_settings


def _preparar(monkeypatch, **valores: str) -> None:
    for clave in ("DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD",
                  "DB_SSLMODE", "DB_SCHEMA"):
        monkeypatch.delenv(clave, raising=False)
    for clave, valor in valores.items():
        monkeypatch.setenv(clave, valor)
    get_settings.cache_clear()


def test_url_tcp_sin_esquema(monkeypatch):
    _preparar(monkeypatch, DB_HOST="127.0.0.1", DB_PORT="5432", DB_NAME="ggtov2",
              DB_USER="u", DB_PASSWORD="p", DB_SSLMODE="require")
    try:
        assert db.build_url() == (
            "postgresql+psycopg2://u:p@127.0.0.1:5432/ggtov2?sslmode=require"
        )
    finally:
        get_settings.cache_clear()


def test_url_con_esquema_alternativo(monkeypatch):
    _preparar(monkeypatch, DB_HOST="127.0.0.1", DB_NAME="ggtov2", DB_USER="u",
              DB_PASSWORD="p", DB_SCHEMA="ggto_test")
    try:
        url = db.build_url()
        assert "options=-csearch_path%3Dggto_test%2Cpublic" in url
        assert "sslmode=prefer" in url
    finally:
        get_settings.cache_clear()


def test_url_socket_cloud_sql(monkeypatch):
    _preparar(monkeypatch, DB_HOST="/cloudsql/proj:reg:inst", DB_NAME="ggtov2",
              DB_USER="u", DB_PASSWORD="p", DB_SCHEMA="ggto_test")
    try:
        url = db.build_url()
        assert url.startswith("postgresql+psycopg2://u:p@/ggtov2?")
        assert "host=%2Fcloudsql%2Fproj%3Areg%3Ainst" in url
        assert "options=-csearch_path%3Dggto_test%2Cpublic" in url
        assert "sslmode" not in url
    finally:
        get_settings.cache_clear()
