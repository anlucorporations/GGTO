"""Observabilidad: request-id, usuario/rol y logs JSON (D-155 - H-15).

Un unico filtro inyecta el contexto de la peticion en **todos** los registros,
incluidos los que emiten los servicios. El formateador escribe una linea JSON
por registro (Cloud Logging la indexa como `jsonPayload`) y redacta secretos y
datos personales conocidos antes de escribir.
"""

from __future__ import annotations

import contextvars
import json
import logging
import re
from datetime import UTC, datetime

#: Identificador de la peticion en curso. Se propaga a los servicios.
_request_id: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="")
#: P00 del usuario autenticado (vacio en peticiones anonimas o antes del login).
_usuario: contextvars.ContextVar[str] = contextvars.ContextVar("usuario", default="")
#: Codigo del rol del usuario autenticado.
_rol: contextvars.ContextVar[str] = contextvars.ContextVar("rol", default="")

#: Campos estructurados que se copian del registro al JSON si estan presentes.
_CAMPOS = (
    "evento",
    "metodo",
    "ruta",
    "status",
    "ms",
    "id_lote",
    "filas",
    "nuevos",
    "duplicados",
    "canal",
    "id_notificacion",
    "intentos",
    "motivo",
    "archivo",
)

_REDACCIONES: tuple[tuple[re.Pattern[str], str], ...] = (
    # Cabecera Authorization / tokens Bearer.
    (re.compile(r"(?i)\b(bearer)\s+[A-Za-z0-9._~+/=-]+"), r"\1 ***"),
    # JWT suelto (sin la palabra Bearer).
    (re.compile(r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b"), "***"),
    # secretos en formato clave=valor o clave: valor.
    (
        re.compile(
            r"(?i)\b(token|clave|password|contrasena|contraseña|secret|authorization)"
            r"(\s*[=:]\s*)[^\s,;]+"
        ),
        r"\1\2***",
    ),
    # P00 en texto libre; el campo estructurado `usuario` se conserva.
    (re.compile(r"(?i)\b(p00)(\s*[=:]\s*)[A-Za-z0-9_-]+"), r"\1\2***"),
    # Correos electronicos.
    (re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b"), "***@***"),
    # Telefonos venezolanos (0412/0414/0416/0424/0426 y +58...).
    (re.compile(r"\b(?:\+?58)?0?4(?:12|14|16|24|26)\d{7}\b"), "***"),
    # Cedulas y numeros de 10-11 digitos (no fechas ni identificadores hex).
    (re.compile(r"\b\d{10,11}\b"), "***"),
)


def redactar(texto: str) -> str:
    """Redacta secretos y datos personales reconocibles en un texto."""
    for patron, reemplazo in _REDACCIONES:
        texto = patron.sub(reemplazo, texto)
    return texto


def iniciar_request(request_id: str) -> None:
    """Asocia el request-id a la peticion en curso y limpia usuario/rol."""
    _request_id.set(request_id)
    _usuario.set("")
    _rol.set("")


def vincular_usuario(p00: str, rol: str) -> None:
    """Vincula el usuario autenticado a la peticion en curso."""
    _usuario.set(p00 or "")
    _rol.set(rol or "")


def limpiar_contexto() -> None:
    """Descarta el contexto al terminar la peticion (evita fugas entre tareas)."""
    _request_id.set("")
    _usuario.set("")
    _rol.set("")


def request_id_actual() -> str:
    return _request_id.get()


class FiltroContexto(logging.Filter):
    """Copia el contexto de la peticion en cada registro de log."""

    def filter(self, record: logging.LogRecord) -> bool:
        if not getattr(record, "request_id", ""):
            record.request_id = _request_id.get()
        if not getattr(record, "usuario", ""):
            record.usuario = _usuario.get()
        if not getattr(record, "rol", ""):
            record.rol = _rol.get()
        return True


class FormatoJSON(logging.Formatter):
    """Formatea cada registro como una linea JSON apta para Cloud Logging."""

    def format(self, record: logging.LogRecord) -> str:
        datos: dict[str, object] = {
            "timestamp": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            "severity": record.levelname,
            "logger": record.name,
            "message": redactar(record.getMessage()),
            "request_id": getattr(record, "request_id", "") or _request_id.get(),
            "usuario": getattr(record, "usuario", "") or _usuario.get(),
            "rol": getattr(record, "rol", "") or _rol.get(),
        }
        for campo in _CAMPOS:
            valor = getattr(record, campo, None)
            if valor is not None:
                datos[campo] = valor
        if record.exc_info:
            datos["exception"] = redactar(self.formatException(record.exc_info))
        return json.dumps(datos, ensure_ascii=False, default=str)


def configurar_logging(nivel: int = logging.INFO) -> None:
    """Instala el formateador JSON en la raiz y en los loggers de Uvicorn.

    Se ejecuta al importar `app.main`. El log de acceso de Uvicorn se desactiva
    porque el middleware ya emite un unico evento `http_request` estructurado
    (evita duplicados y mantiene el mismo request-id).
    """
    handler = logging.StreamHandler()
    handler.setFormatter(FormatoJSON())
    handler.addFilter(FiltroContexto())

    root = logging.getLogger()
    for existente in list(root.handlers):
        root.removeHandler(existente)
    root.addHandler(handler)
    root.setLevel(nivel)

    for nombre in ("uvicorn", "uvicorn.error"):
        logger = logging.getLogger(nombre)
        logger.handlers = [handler]
        logger.propagate = False
        logger.setLevel(nivel)

    acceso = logging.getLogger("uvicorn.access")
    acceso.handlers = []
    acceso.propagate = False
    acceso.disabled = True
