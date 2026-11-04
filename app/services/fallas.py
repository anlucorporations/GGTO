"""Fallas masivas: detección automática por concentración (RF-09 / D-31)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import Caso, Cuadrilla, FallaMasiva
from . import outbox

UMBRAL_POR_DEFECTO = 3  # D-168: 3 o más casos con la misma tupla → masiva
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

    D-118: la concentración se agrupa por la **tupla técnica del FAT**
    (OLT + slot + puerto + FAT). D-168: la tupla pasa a **5 campos**
    (OLT + slot + puerto + FAT + EXTRA, la ruta del archivo de ingesta) y el
    umbral baja de 5 a **3** casos: los casos de una masiva deben tener los
    datos técnicos **idénticos** para corroborar que pertenecen al mismo FAT.
    Un grupo con el mismo OLT pero otro slot, puerto, FAT o EXTRA **no** es la
    misma masiva, y sus casos no se mezclan.
    """
    activo = str(_config(db, "fallas.activo", True)).strip('"').lower()
    if activo in ("false", "0", "no"):
        return []

    umbral = int(_config(db, "fallas.umbral_casos", UMBRAL_POR_DEFECTO))
    horas = int(_config(db, "fallas.ventana_horas", VENTANA_POR_DEFECTO))
    desde = datetime.now(UTC) - timedelta(hours=horas)
    # D-168: los 5 campos se **exigen** (no vacíos) y se agrupan normalizados
    # (sin espacios ni mayúsculas) para que `FAT 777` y `fat  777` agrupen igual.
    campos = (Caso.olt, Caso.slot, Caso.puerto, Caso.fat, Caso.extra)
    grupos = db.execute(
        select(*campos, func.count())
        .where(
            Caso.id_central == id_central,
            Caso.estado_actual.notin_(("CERRADO", "CANCELADO")),
            Caso.creado_en >= desde,
            *(c.is_not(None) for c in campos),
            *(func.trim(c) != "" for c in campos),
        )
        .group_by(*campos)
        .having(func.count() >= umbral)
    ).all()

    creadas: list[FallaMasiva] = []
    for olt, slot, puerto, fat, extra, total in grupos:
        olt, slot, puerto, fat, extra = (
            "" if valor is None else str(valor).strip()
            for valor in (olt, slot, puerto, fat, extra)
        )
        if not all((olt, slot, puerto, fat, extra)):
            continue
        existente = db.scalar(
            select(FallaMasiva).where(
                FallaMasiva.id_central == id_central,
                func.lower(func.trim(FallaMasiva.olt)) == olt.casefold(),
                func.lower(func.trim(FallaMasiva.slot)) == slot.casefold(),
                func.lower(func.trim(FallaMasiva.puerto)) == puerto.casefold(),
                func.lower(func.trim(FallaMasiva.fat)) == fat.casefold(),
                func.lower(func.trim(FallaMasiva.extra)) == extra.casefold(),
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
                func.lower(func.trim(Caso.extra)) == extra.casefold(),
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
                f"puerto {puerto} · FAT {fat} · EXTRA {extra} (últimas {horas} h)"
            ),
            origen="AUTOMATICA",
            id_sector=id_sector,
            id_cuadrilla=cuadrilla_cercana(db, id_central, id_sector),
            estado="DETECTADA",
            olt=olt,
            slot=slot,
            puerto=puerto,
            fat=fat,
            extra=extra,
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
