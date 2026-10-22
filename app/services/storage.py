"""Almacenamiento de evidencias en Cloud Storage (D-73 · D-154).

Se implementa con la API JSON de GCS usando `httpx` para evitar añadir el SDK
pesado de `google-cloud-storage`. En producción el bucket es obligatorio: si no
está configurado o falla la subida, se lanza `StorageError` para que la APK
conserve la foto en su cola local (fail-closed, H-05). En desarrollo se permite
el fallback a `GGTO_EVIDENCIAS_DIR` para trabajar sin credenciales.
"""

from __future__ import annotations

import json
import logging
import os
import time
import uuid
from pathlib import Path
from urllib.parse import quote

import httpx

logger = logging.getLogger("ggto.storage")

TOKEN_URL = "https://oauth2.googleapis.com/token"
METADATA_TOKEN_URL = (
    "http://metadata.google.internal/computeMetadata/v1/"
    "instance/service-accounts/default/token"
)
#: Cache del token de GCS: (token, instante de expiración en epoch).
_TOKEN_CACHE: tuple[str, float] | None = None


class StorageError(RuntimeError):
    """Fallo al subir o leer una evidencia (se traduce a 503 en la API)."""


class StorageNoConfigurado(StorageError):
    """Producción sin bucket: la subida no puede aceptarse."""


def en_produccion() -> bool:
    """True si el despliegue se declara productivo (`APP_ENV=production`)."""
    return os.getenv("APP_ENV", "development").strip().lower() in {
        "production",
        "produccion",
        "producción",
        "prod",
    }


def _bucket() -> str:
    return os.getenv("GGTO_GCS_BUCKET", "").strip()


def modo_almacenamiento() -> str:
    """`gcs`, `local` (solo desarrollo) o `no_configurado` (producción sin bucket)."""
    if _bucket():
        return "gcs"
    return "no_configurado" if en_produccion() else "local"


def _token_gcs() -> str | None:
    """Obtiene un access token OAuth2 por cuenta de servicio o metadatos (ADC)."""
    global _TOKEN_CACHE
    if _TOKEN_CACHE and _TOKEN_CACHE[1] > time.time() + 30:
        return _TOKEN_CACHE[0]

    ruta = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
    if ruta and Path(ruta).is_file():
        try:
            with open(ruta) as f:
                info = json.load(f)
            grant_type = "urn:ietf:params:oauth:grant-type:jwt-bearer"
            payload = {
                "iss": info["client_email"],
                "scope": "https://www.googleapis.com/auth/devstorage.read_write",
                "aud": TOKEN_URL,
                "exp": int(time.time()) + 3600,
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
            token = resp.json().get("access_token")
            if token:
                _TOKEN_CACHE = (token, time.time() + 3500)
                return token
        except Exception:
            logger.exception("No se pudo obtener token de GCS desde el archivo de credenciales")
            return None

    # Cloud Run: cuenta de servicio a través del servidor de metadatos.
    try:
        resp = httpx.get(METADATA_TOKEN_URL, headers={"Metadata-Flavor": "Google"}, timeout=2)
        if resp.status_code == 200:
            datos = resp.json()
            token = datos.get("access_token")
            if token:
                vigencia = max(60, int(datos.get("expires_in", 3600)) - 60)
                _TOKEN_CACHE = (token, time.time() + vigencia)
                return token
    except Exception:
        logger.debug("Sin metadatos de GCE para obtener token de GCS", exc_info=True)
    return None


def detectar_tipo_imagen(contenido: bytes) -> str | None:
    """Devuelve el MIME real por bytes mágicos, o `None` si no es una foto admitida."""
    if contenido.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if contenido.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if len(contenido) >= 12 and contenido[:4] == b"RIFF" and contenido[8:12] == b"WEBP":
        return "image/webp"
    return None


def subir_evidencia(nombre: str, contenido: bytes, content_type: str = "image/jpeg") -> str:
    """Sube la evidencia y devuelve su ruta remota.

    Con bucket configurado **nunca** cae al disco local: un fallo lanza
    `StorageError` para que el cliente reintente. Sin bucket, en producción lanza
    `StorageNoConfigurado`; en desarrollo escribe en `GGTO_EVIDENCIAS_DIR`.
    """
    safe_name = nombre.replace("/", "_").replace("\\", "_")[:180]
    object_name = f"evidencias/{uuid.uuid4().hex}/{safe_name}"
    bucket = _bucket()

    if bucket:
        token = _token_gcs()
        if not token:
            raise StorageError("No se pudo obtener credenciales para Cloud Storage")
        try:
            r = httpx.post(
                f"https://storage.googleapis.com/upload/storage/v1/b/{bucket}/o",
                params={"uploadType": "media", "name": object_name},
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": content_type,
                },
                content=contenido,
                timeout=90,
            )
        except httpx.HTTPError as exc:
            raise StorageError("No se pudo contactar con Cloud Storage") from exc
        if r.status_code not in (200, 201):
            raise StorageError(f"Cloud Storage respondió {r.status_code}")
        return f"gcs://{bucket}/{object_name}"

    if en_produccion():
        raise StorageNoConfigurado(
            "El almacenamiento de evidencias no está configurado (GGTO_GCS_BUCKET)"
        )

    # Fallback local: útil para desarrollo y pruebas unitarias.
    base_dir = Path(os.getenv("GGTO_EVIDENCIAS_DIR", ".evidencias"))
    destino = base_dir / object_name
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_bytes(contenido)
    return f"/evidencias-locales/{object_name}"


def _ruta_local(ruta: str) -> Path:
    base = Path(os.getenv("GGTO_EVIDENCIAS_DIR", ".evidencias")).resolve()
    relativa = ruta[len("/evidencias-locales/") :]
    destino = (base / relativa).resolve()
    if destino != base and base not in destino.parents:
        raise FileNotFoundError(ruta)
    return destino


def leer_evidencia(ruta: str) -> tuple[bytes, str]:
    """Devuelve `(bytes, mime)` de una evidencia remota o local."""
    if not ruta:
        raise FileNotFoundError(ruta)

    if ruta.startswith("gcs://"):
        bucket, _, objeto = ruta[len("gcs://") :].partition("/")
        if not bucket or not objeto:
            raise FileNotFoundError(ruta)
        token = _token_gcs()
        if not token:
            raise StorageError("No se pudo obtener credenciales para Cloud Storage")
        try:
            r = httpx.get(
                f"https://storage.googleapis.com/storage/v1/b/{bucket}/o/{quote(objeto, safe='')}",
                params={"alt": "media"},
                headers={"Authorization": f"Bearer {token}"},
                timeout=60,
            )
        except httpx.HTTPError as exc:
            raise StorageError("No se pudo contactar con Cloud Storage") from exc
        if r.status_code == 404:
            raise FileNotFoundError(ruta)
        if r.status_code != 200:
            raise StorageError(f"Cloud Storage respondió {r.status_code}")
        return r.content, detectar_tipo_imagen(r.content) or "application/octet-stream"

    if ruta.startswith("/evidencias-locales/"):
        destino = _ruta_local(ruta)
        if not destino.is_file():
            raise FileNotFoundError(ruta)
        contenido = destino.read_bytes()
        return contenido, detectar_tipo_imagen(contenido) or "application/octet-stream"

    raise FileNotFoundError(ruta)


def serial_desde_nombre(nombre_original: str) -> str:
    """Genera un serial único estable para la fila `evidencia.serial_imagen`."""
    return f"{uuid.uuid4().hex}-{nombre_original}"[:160]


def borrar_evidencia(ruta: str) -> bool:
    """Borra el objeto de una evidencia y devuelve si ya no existe (D-153).

    Acepta las dos formas que produce `subir_evidencia`: `gcs://bucket/objeto` y
    `/evidencias-locales/objeto`. Un objeto ausente cuenta como borrado; un fallo
    de credenciales o de red devuelve `False` para que la purga reintente y no
    pierda la referencia.
    """
    if not ruta:
        return True

    if ruta.startswith("/evidencias-locales/"):
        try:
            destino = _ruta_local(ruta)
        except FileNotFoundError:
            return True
        try:
            destino.unlink()
        except FileNotFoundError:
            return True
        except OSError:
            logger.exception("No se pudo borrar la evidencia local %s", destino)
            return False
        return True

    if ruta.startswith("gcs://"):
        bucket, _, objeto = ruta[len("gcs://") :].partition("/")
        if not bucket or not objeto:
            return True
        token = _token_gcs()
        if not token:
            return False
        url = (
            "https://storage.googleapis.com/storage/v1/b/"
            f"{bucket}/o/{quote(objeto, safe='')}"
        )
        try:
            r = httpx.delete(url, headers={"Authorization": f"Bearer {token}"}, timeout=30)
        except httpx.HTTPError:
            logger.exception("No se pudo borrar la evidencia remota %s", ruta)
            return False
        return r.status_code in (200, 204, 404)

    return True
