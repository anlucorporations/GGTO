"""Pruebas unitarias de las primitivas de seguridad (no requieren base de datos)."""

from __future__ import annotations

import jwt
import pytest

from app.core.security import (
    create_access_token,
    decode_token,
    hash_password,
    normalizar_palabra,
    verify_password,
)
from app.core.words import generar_palabras


def test_hash_y_verificacion():
    h = hash_password("clave-segura-123")
    assert h.startswith("$argon2id$")
    assert verify_password(h, "clave-segura-123")
    assert not verify_password(h, "otra-clave")


def test_hash_es_salado():
    assert hash_password("igual") != hash_password("igual")


def test_normalizar_palabra():
    assert normalizar_palabra("  Árbol ") == "arbol"
    assert normalizar_palabra("CAMION") == "camion"
    assert normalizar_palabra("ñandú") == "nandu"


def test_token_ida_y_vuelta():
    token, expira = create_access_token("2324X001", "TECNICO", minutos=5)
    assert expira == 300
    payload = decode_token(token)
    assert payload["sub"] == "2324X001"
    assert payload["rol"] == "TECNICO"


def test_token_invalido():
    with pytest.raises(jwt.PyJWTError):
        decode_token("token.falso.invalido")


def test_generar_palabras():
    palabras = generar_palabras(12)
    assert len(palabras) == 12
    assert len(set(palabras)) == 12
    assert all(p.islower() for p in palabras)
