"""Almacenamiento de evidencias en Cloud Storage (D-73).

Se implementa con la API JSON de GCS usando `httpx` para evitar añadir el SDK
pesado de `google-cloud-storage`. Si no se configura un bucket, las fotos se
guardan localmente bajo `EVIDENCIAS_LOCAL_DIR` y `ruta_remota` devuelve una URL
relativa servida por FastAPI. Esto permite desarrollo offline y pruebas sin
credenciales.
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from pathlib import Path

import httpx

logger = logging.getLogger("ggto.storage")

GCS_BUCKET = os.getenv("GGTO_GCS_BUCKET", "").strip()
GOOGLE_APPLICATION_CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
TOKEN_URL = "https://oauth2.googleapis.com/token"
UPLOAD_URL = f"https://storage.googleapis.com/upload/storage/v1/b/{GCS_BUCKET}/o" if GCS_BUCKET else ""


def _token_gcs() -> str | None:
    """Obtiene un access token OAuth2 desde ADC si existen credenciales."""
    if not GOOGLE_APPLICATION_CREDENTIALS or not Path(GOOGLE_APPLICATION_CREDENTIALS).is_file():
        return None
    try:
        with open(GOOGLE_APPLICATION_CREDENTIALS) as f:
            info = json.load(f)
        grant_type = "urn:ietf:params:oauth:grant-type:jwt-bearer"
        payload = {
            "iss": info["client_email"],
            "scope": "https://www.googleapis.com/auth/devstorage.read_write",
            "aud": TOKEN_URL,
            "exp": int(__import__("time").time()) + 3600,
        }
        # JWT RS256 firmado con private_key; requiere PyJWT[crypto] o cryptography.
        import jwt

        assertion = jwt.encode(payload, info["private_key"], algorithm="RS256")
        resp = httpx.post(
            TOKEN_URL,
            data={"grant_type": grant_type, "assertion": assertion},
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json().get("access_token")
    except Exception:
        logger.exception("No se pudo obtener token de GCS; se usará almacenamiento local")
        return None


def subir_evidencia(nombre: str, contenido: bytes, content_type: str = "image/jpeg") -> str:
    """Sube la evidencia y devuelve su ruta remota (URL relativa o gcs://)."""
    safe_name = nombre.replace("/", "_").replace("\\", "_")[:180]
    object_name = f"evidencias/{uuid.uuid4().hex}/{safe_name}"

    if GCS_BUCKET:
        token = _token_gcs()
        if token:
            url = UPLOAD_URL
            params = {"uploadType": "media", "name": object_name}
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": content_type,
            }
            try:
                r = httpx.post(url, params=params, headers=headers, content=contenido, timeout=90)
                r.raise_for_status()
                return f"gcs://{GCS_BUCKET}/{object_name}"
            except Exception:
                logger.exception("Fallo al subir a GCS; se guardará localmente")

    # Fallback local: útil para desarrollo y pruebas unitarias.
    base_dir = Path(os.getenv("GGTO_EVIDENCIAS_DIR", ".evidencias"))
    destino = base_dir / object_name
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_bytes(contenido)
    return f"/evidencias-locales/{object_name}"


def serial_desde_nombre(nombre_original: str) -> str:
    """Genera un serial único estable para la fila `evidencia.serial_imagen`."""
    return f"{uuid.uuid4().hex}-{nombre_original}"[:160]
