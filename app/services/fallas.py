"""Fallas masivas: detección automática por concentración (RF-09 / D-31)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import Caso, Cuadrilla, FallaMasiva
from . import outbox

CAMPOS_VALIDOS = ("olt", "fat", "id_sector")
UMBRAL_POR_DEFECTO = 5
VENTANA_POR_DEFECTO = 24


def _config(db: Session, clave: str, defecto: Any) -> Any:
    from ..models import Configuracion

    valor = db.scalar(select(Configuracion.valor).where(Configuracion.clave == clave))
    return defecto if valor in (None, "") else valor


def cuadrilla_cercana(db: Session, id_central: int, id_sector: int | None) -> int | None:
    """Cuadrilla de calle con más casos en ese sector; si no, la de menos carga."""
    de_calle = db.scalars(
        select(Cuadrilla).where(
            Cuadrilla.id_central == id_central,
            Cuadrilla.activa.is_(True),
            Cuadrilla.es_supervisor.is_(False),
        )
    ).all()
    if not de_calle:
        return None
    if id_sector is not None:
        from ..models import Despacho, DespachoCasos

        conteo = dict(
            db.execute(
                select(Despacho.id_cuadrilla, func.count())
                .join(DespachoCasos, DespachoCasos.id_despacho == Despacho.id_despacho)
                .where(Despacho.id_central == id_central, DespachoCasos.id_sector == id_sector)
                .group_by(Despacho.id_cuadrilla)
            ).all()
        )
        if conteo:
            return max(conteo, key=lambda k: conteo[k])
    return min(de_calle, key=lambda c: c.codigo).id_cuadrilla


def detectar(db: Session, id_central: int) -> list[FallaMasiva]:
    """Crea fallas masivas para los grupos que superan el umbral (idempotente)."""
    activo = str(_config(db, "fallas.activo", True)).strip('"').lower()
    if activo in ("false", "0", "no"):
        return []

    umbral = int(_config(db, "fallas.umbral_casos", UMBRAL_POR_DEFECTO))
    horas = int(_config(db, "fallas.ventana_horas", VENTANA_POR_DEFECTO))
    campo = str(_config(db, "fallas.campo_concentracion", "olt")).strip('"')
    if campo not in CAMPOS_VALIDOS:
        campo = "olt"

    columna = getattr(Caso, campo)
    desde = datetime.now(UTC) - timedelta(hours=horas)
    grupos = db.execute(
        select(columna, func.count())
        .where(
            Caso.id_central == id_central,
            Caso.estado_actual.notin_(("CERRADO", "CANCELADO")),
            Caso.creado_en >= desde,
            columna.is_not(None),
        )
        .group_by(columna)
        .having(func.count() >= umbral)
    ).all()

    creadas: list[FallaMasiva] = []
    for valor, total in grupos:
        clave = f"{campo}:{valor}"[:120]
        existente = db.scalar(
            select(FallaMasiva).where(
                FallaMasiva.id_central == id_central,
                FallaMasiva.clave_concentracion == clave,
                FallaMasiva.estado.in_(("DETECTADA", "PLANIFICADA")),
            )
        )
        if existente:
            continue

        if campo == "id_sector":
            id_sector = int(valor)
        else:
            id_sector = db.scalar(
                select(Caso.id_sector)
                .where(Caso.id_central == id_central, columna == valor, Caso.id_sector.is_not(None))
                .limit(1)
            )
        falla = FallaMasiva(
            id_central=id_central,
            clave_concentracion=clave,
            descripcion=f"Concentración de {total} casos en {campo} {valor} (últimas {horas} h)",
            origen="AUTOMATICA",
            id_sector=id_sector,
            id_cuadrilla=cuadrilla_cercana(db, id_central, id_sector),
            estado="DETECTADA",
        )
        db.add(falla)
        creadas.append(falla)

    if creadas:
        db.flush()
        for falla in creadas:
            alertar(db, falla)
    return creadas


def alertar(db: Session, falla: FallaMasiva) -> None:
    """Encola la alerta de la falla masiva (Telegram; el envío lo hace el outbox)."""
    destino = _config(db, "despacho.destino_telegram", "")
    destinatario = str(destino).strip('"') or None
    outbox.encolar(
        db,
        canal="TELEGRAM",
        destinatario=destinatario,
        asunto=f"⚠️ Falla masiva detectada ({falla.clave_concentracion})",
        cuerpo=(
            f"{falla.descripcion}\n"
            f"Cuadrilla asignada: {falla.id_cuadrilla or 'sin asignar'}\n"
            f"Estado: {falla.estado}"
        ),
    )
