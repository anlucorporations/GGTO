"""Primitivas de seguridad: hashing Argon2id, JWT y normalización de palabras."""

from __future__ import annotations

import secrets
import unicodedata
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from .config import get_settings

# Argon2id con parámetros por defecto de argon2-cffi (RNF-22).
_hasher = PasswordHasher()


# --------------------------------------------------------------------------- #
# Contraseñas
# --------------------------------------------------------------------------- #
def hash_password(password: str) -> str:
    """Devuelve el hash Argon2id de la contraseña."""
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    """Verifica una contraseña contra su hash sin lanzar excepciones."""
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def needs_rehash(password_hash: str) -> bool:
    """True si el hash debe regenerarse (parámetros desactualizados)."""
    try:
        return _hasher.check_needs_rehash(password_hash)
    except InvalidHashError:
        return True


# --------------------------------------------------------------------------- #
# Normalización de palabras de seguridad
# --------------------------------------------------------------------------- #
def normalizar_palabra(valor: str) -> str:
    """Minúsculas, sin acentos y sin espacios extremos (comparación estable)."""
    base = unicodedata.normalize("NFKD", (valor or "").strip().lower())
    return "".join(c for c in base if not unicodedata.combining(c))


# --------------------------------------------------------------------------- #
# Tokens JWT
# --------------------------------------------------------------------------- #
def create_access_token(subject: str, rol: str, minutos: int | None = None,
                        extra: dict[str, Any] | None = None) -> tuple[str, int]:
    """Crea un token de acceso. Devuelve (token, segundos de vigencia)."""
    s = get_settings()
    minutos = minutos or s.access_token_minutes
    expira = datetime.now(UTC) + timedelta(minutes=minutos)
    payload: dict[str, Any] = {
        "sub": subject,
        "rol": rol,
        "exp": expira,
        "iat": datetime.now(UTC),
        "jti": secrets.token_hex(8),
    }
    if extra:
        payload.update(extra)
    token = jwt.encode(payload, s.secret_key, algorithm=s.jwt_algorithm)
    return token, minutos * 60


def decode_token(token: str) -> dict[str, Any]:
    """Decodifica y valida un token. Lanza jwt.PyJWTError si es inválido."""
    s = get_settings()
    return jwt.decode(token, s.secret_key, algorithms=[s.jwt_algorithm])
