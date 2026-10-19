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
    """Crea fallas masivas para los grupos que superan el umbral (idempotente).

    D-118: la concentración se agrupa por la **tupla completa del FAT**
    (OLT + slot + puerto + FAT). Un grupo con el mismo OLT pero otro slot,
    puerto o FAT **no** es la misma masiva, y sus casos no se mezclan.
    """
    activo = str(_config(db, "fallas.activo", True)).strip('"').lower()
    if activo in ("false", "0", "no"):
        return []

    umbral = int(_config(db, "fallas.umbral_casos", UMBRAL_POR_DEFECTO))
    horas = int(_config(db, "fallas.ventana_horas", VENTANA_POR_DEFECTO))
    desde = datetime.now(UTC) - timedelta(hours=horas)
    grupos = db.execute(
        select(Caso.olt, Caso.slot, Caso.puerto, Caso.fat, func.count())
        .where(
            Caso.id_central == id_central,
            Caso.estado_actual.notin_(("CERRADO", "CANCELADO")),
            Caso.creado_en >= desde,
            Caso.olt.is_not(None),
            Caso.slot.is_not(None),
            Caso.puerto.is_not(None),
            Caso.fat.is_not(None),
        )
        .group_by(Caso.olt, Caso.slot, Caso.puerto, Caso.fat)
        .having(func.count() >= umbral)
    ).all()

    creadas: list[FallaMasiva] = []
    for olt, slot, puerto, fat, total in grupos:
        olt, slot, puerto, fat = (
            "" if valor is None else str(valor).strip()
            for valor in (olt, slot, puerto, fat)
        )
        if not (olt and slot and puerto and fat):
            continue
        existente = db.scalar(
            select(FallaMasiva).where(
                FallaMasiva.id_central == id_central,
                func.lower(func.trim(FallaMasiva.olt)) == olt.casefold(),
                func.lower(func.trim(FallaMasiva.slot)) == slot.casefold(),
                func.lower(func.trim(FallaMasiva.puerto)) == puerto.casefold(),
                func.lower(func.trim(FallaMasiva.fat)) == fat.casefold(),
                FallaMasiva.estado.in_(("DETECTADA", "PLANIFICADA")),
            )
        )
        if existente:
            continue

        representativo = db.scalar(
            select(Caso)
            .where(
                Caso.id_central == id_central,
                func.lower(func.trim(Caso.olt)) == olt.casefold(),
                func.lower(func.trim(Caso.slot)) == slot.casefold(),
                func.lower(func.trim(Caso.puerto)) == puerto.casefold(),
                func.lower(func.trim(Caso.fat)) == fat.casefold(),
            )
            .order_by(Caso.id_caso.desc())
            .limit(1)
        )
        id_sector = representativo.id_sector if representativo else None
        falla = FallaMasiva(
            id_central=id_central,
            clave_concentracion=f"fat:{fat}"[:120],
            descripcion=(
                f"Concentración de {total} casos en OLT {olt} · slot {slot} · "
                f"puerto {puerto} · FAT {fat} (últimas {horas} h)"
            ),
            origen="AUTOMATICA",
            id_sector=id_sector,
            id_cuadrilla=cuadrilla_cercana(db, id_central, id_sector),
            estado="DETECTADA",
            olt=olt,
            slot=slot,
            puerto=puerto,
            fat=fat,
            direccion=(representativo.direccion if representativo else None),
        )
        db.add(falla)
        creadas.append(falla)

    if creadas:
        db.flush()
        # D-99 (RF-58): la detección deja la **asociación explícita** de los casos
        # de la concentración, para que la ficha tenga CASOS ASOCIADOS y el cierre
        # en cascada no dependa de volver a deducirlos.
        from . import masivas as svc_masivas

        asociar = str(_config(db, "fallas.asociar_automatico", True)).strip('"').lower()
        if asociar not in ("false", "0", "no"):
            for falla in creadas:
                svc_masivas.sincronizar_asociacion(db, falla)
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
