"""Patrón *outbox* para notificaciones con reintentos (RNF-20).

Toda notificación se persiste primero en `notificacion` (PENDIENTE) y un proceso
la intenta enviar. Si falla, se reprograma con **backoff exponencial** hasta
`outbox.max_intentos`; entonces queda FALLIDA. Si el canal no tiene credenciales,
permanece PENDIENTE con el motivo (no se pierde).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Configuracion, Notificacion
from .notificaciones import enviar

MAX_INTENTOS_POR_DEFECTO = 5
BACKOFF_TOPE_MINUTOS = 60


def _config(db: Session, clave: str, defecto: Any) -> Any:
    valor = db.scalar(select(Configuracion.valor).where(Configuracion.clave == clave))
    return defecto if valor in (None, "") else valor


def backoff_minutos(intentos: int) -> int:
    """1, 2, 4, 8… minutos, con tope."""
    return min(2 ** max(intentos - 1, 0), BACKOFF_TOPE_MINUTOS)


def encolar(db: Session, canal: str, asunto: str, cuerpo: str,
            destinatario: str | None = None, id_caso: int | None = None) -> Notificacion:
    """Registra la notificación en el outbox (no la envía)."""
    notificacion = Notificacion(
        canal=canal,
        destinatario=destinatario,
        asunto=asunto[:200],
        cuerpo=cuerpo,
        id_caso=id_caso,
        estado="PENDIENTE",
        intentos=0,
        proximo_intento=datetime.now(UTC),
    )
    db.add(notificacion)
    return notificacion


def procesar(db: Session, limite: int = 50) -> dict:
    """Intenta enviar las notificaciones PENDIENTES cuyo momento ya llegó."""
    max_intentos = int(_config(db, "outbox.max_intentos", MAX_INTENTOS_POR_DEFECTO))
    ahora = datetime.now(UTC)
    pendientes = db.scalars(
        select(Notificacion)
        .where(
            Notificacion.estado == "PENDIENTE",
            Notificacion.proximo_intento.is_not(None),
            Notificacion.proximo_intento <= ahora,
        )
        .order_by(Notificacion.id_notificacion)
        .limit(limite)
    ).all()

    resumen: dict[str, Any] = {"intentadas": 0, "enviadas": 0, "diferidas": 0, "fallidas": 0, "detalle": []}
    for notificacion in pendientes:
        resumen["intentadas"] += 1
        estado, error = enviar(notificacion.canal, notificacion.destinatario,
                               notificacion.asunto or "", notificacion.cuerpo or "")
        notificacion.intentos = (notificacion.intentos or 0) + 1
        notificacion.error = error
        if estado == "ENVIADO":
            notificacion.estado = "ENVIADO"
            notificacion.enviado_en = ahora
            notificacion.proximo_intento = None
            resumen["enviadas"] += 1
        elif estado == "PENDIENTE":
            # Falta configuración del canal: se reintenta más tarde sin gastar intentos
            notificacion.estado = "PENDIENTE"
            notificacion.intentos = (notificacion.intentos or 0) - 1
            notificacion.proximo_intento = ahora + timedelta(
                minutes=backoff_minutos((notificacion.intentos or 0) + 1)
            )
            resumen["diferidas"] += 1
        else:
            if notificacion.intentos >= max_intentos:
                notificacion.estado = "FALLIDO"
                notificacion.proximo_intento = None
                resumen["fallidas"] += 1
            else:
                notificacion.estado = "PENDIENTE"
                notificacion.proximo_intento = ahora + timedelta(
                    minutes=backoff_minutos(notificacion.intentos)
                )
                resumen["diferidas"] += 1
        resumen["detalle"].append({
            "id_notificacion": notificacion.id_notificacion,
            "canal": notificacion.canal,
            "estado": notificacion.estado,
            "intentos": notificacion.intentos,
            "error": notificacion.error,
        })
    return resumen


def metricas(db: Session) -> dict:
    """Métricas de negocio del outbox (RNF-19)."""
    from sqlalchemy import func

    filas = db.execute(
        select(Notificacion.estado, func.count()).group_by(Notificacion.estado)
    ).all()
    por_estado = {estado: total for estado, total in filas}
    return {
        "notificaciones_pendientes": por_estado.get("PENDIENTE", 0),
        "notificaciones_enviadas": por_estado.get("ENVIADO", 0),
        "notificaciones_fallidas": por_estado.get("FALLIDO", 0),
        "por_estado": por_estado,
    }
