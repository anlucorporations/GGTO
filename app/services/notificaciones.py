"""Envío de notificaciones (RF-10, RF-27) con patrón *outbox* (RNF-20).

Si el canal no tiene credenciales configuradas, la notificación queda **PENDIENTE** con el
motivo, en lugar de perderse. Las credenciales se configuran en el Ciclo 9 (Telegram/correo).
"""

from __future__ import annotations

import json
import os
import smtplib
import urllib.error
import urllib.request
from email.message import EmailMessage

LIMITE_TELEGRAM = 4000


def _telegram(destinatario: str, asunto: str, cuerpo: str) -> tuple[str, str | None]:
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not token:
        return "PENDIENTE", "Sin TELEGRAM_BOT_TOKEN configurado (se habilita en el Ciclo 9)"
    texto = f"*{asunto}*\n\n{cuerpo}"[:LIMITE_TELEGRAM]
    datos = json.dumps({"chat_id": destinatario, "text": texto, "parse_mode": "Markdown"}).encode()
    peticion = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/sendMessage",
        data=datos,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(peticion, timeout=20) as respuesta:
            if respuesta.status == 200:
                return "ENVIADO", None
            return "FALLIDO", f"Telegram respondió {respuesta.status}"
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        return "FALLIDO", f"Telegram: {type(exc).__name__}"


def _correo(destinatario: str, asunto: str, cuerpo: str) -> tuple[str, str | None]:
    host = os.environ.get("SMTP_HOST")
    if not host:
        return "PENDIENTE", "Sin SMTP_HOST configurado (se habilita en el Ciclo 9)"
    puerto = int(os.environ.get("SMTP_PORT", "587"))
    usuario = os.environ.get("SMTP_USER", "")
    clave = os.environ.get("SMTP_PASSWORD", "")
    remitente = os.environ.get("MAIL_FROM", usuario or "ggto@localhost")

    mensaje = EmailMessage()
    mensaje["Subject"] = asunto
    mensaje["From"] = remitente
    mensaje["To"] = destinatario
    mensaje.set_content(cuerpo)
    try:
        with smtplib.SMTP(host, puerto, timeout=20) as smtp:
            smtp.starttls()
            if usuario:
                smtp.login(usuario, clave)
            smtp.send_message(mensaje)
        return "ENVIADO", None
    except Exception as exc:
        return "FALLIDO", f"SMTP: {type(exc).__name__}"


def enviar(canal: str, destinatario: str | None, asunto: str, cuerpo: str) -> tuple[str, str | None]:
    """Devuelve (estado, error). Estados: ENVIADO | PENDIENTE | FALLIDO."""
    if not destinatario:
        return "PENDIENTE", "Sin destinatario configurado"
    if canal == "TELEGRAM":
        return _telegram(destinatario, asunto, cuerpo)
    if canal == "CORREO":
        return _correo(destinatario, asunto, cuerpo)
    return "FALLIDO", f"Canal no soportado: {canal}"
