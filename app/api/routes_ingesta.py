"""Ingesta del archivo diario de averías — RF-01, RF-21, RF-22, RF-23, RF-25, RF-29."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..models import Central, IngestaLote, Usuario
from ..models.caso_entities import Caso
from ..schemas.ingesta import IngestaLoteOut, ResumenIngesta
from ..services import cuadrilla0, fallas
from ..services.consultas import cargar_config, cargar_patrones, resolver_central
from ..services.ingesta import ESPECIFICACION, filtrar_por_central, parsear
from ..services.sectorizacion import Patron, asignar_sector
from .deps import get_current_user, require_roles

router = APIRouter(prefix="/api/v1/ingesta", tags=["ingesta"])

_escritura = require_roles("ADMIN", "SUPERVISOR")
CAMPOS_ESPECIFICACION = tuple(c for c, _, _ in ESPECIFICACION)
TAMANO_LOTE_CONSULTA = 1000


# --------------------------------------------------------------------------- #
# Apoyo
# --------------------------------------------------------------------------- #
def _existentes(db: Session, ids: list[str]) -> set[str]:
    encontrados: set[str] = set()
    for i in range(0, len(ids), TAMANO_LOTE_CONSULTA):
        trozo = ids[i : i + TAMANO_LOTE_CONSULTA]
        filas = db.execute(select(Caso.id_averia).where(Caso.id_averia.in_(trozo))).scalars().all()
        encontrados.update(filas)
    return encontrados


def _analizar(
    db: Session, contenido: bytes, id_central: int | None
) -> tuple[dict[str, Any], list[dict[str, Any]], Central, list[Patron], dict[str, Any]]:
    config = cargar_config(db)
    central = resolver_central(db, id_central, config)
    patrones = cargar_patrones(db, central.id_central)

    filas, avisos = parsear(contenido)
    del_central = filtrar_por_central(filas, central.codigo_central)

    vistos: set[str] = set()
    repetidos_archivo = 0
    nuevas: list[dict[str, Any]] = []
    for fila in del_central:
        id_averia = fila["id_averia"]
        if id_averia in vistos:
            repetidos_archivo += 1
            continue
        vistos.add(id_averia)
        nuevas.append(fila)

    existentes = _existentes(db, [f["id_averia"] for f in nuevas])
    candidatas = [f for f in nuevas if f["id_averia"] not in existentes]
    duplicadas = len(nuevas) - len(candidatas) + repetidos_archivo

    resumen: dict[str, Any] = {
        "archivo": "",
        "filas_leidas": len(filas),
        "filas_central": len(del_central),
        "casos_nuevos": len(candidatas),
        "casos_duplicados": duplicadas,
        "casos_descartados": len(filas) - len(del_central),
        "sectorizados": 0,
        "sin_sector": 0,
        "cuadrilla0": 0,
        "avisos": avisos,
        "ejemplos": [],
    }

    for fila in candidatas:
        id_sector = asignar_sector(fila.get("direccion"), patrones)
        fila["_id_sector"] = id_sector
        fila["_cuadrilla0"] = cuadrilla0.evaluar(fila, config)
        if id_sector:
            resumen["sectorizados"] += 1
        else:
            resumen["sin_sector"] += 1
        if fila["_cuadrilla0"]:
            resumen["cuadrilla0"] += 1

    resumen["ejemplos"] = [
        {
            "id_averia": f["id_averia"],
            "direccion": f.get("direccion"),
            "sector": f.get("_id_sector"),
            "cuadrilla0": f.get("_cuadrilla0"),
        }
        for f in candidatas[:10]
    ]
    return resumen, candidatas, central, patrones, config


# --------------------------------------------------------------------------- #
# Endpoints
# --------------------------------------------------------------------------- #
@router.post("/preview", response_model=ResumenIngesta, summary="Simular la ingesta sin guardar")
async def preview(
    archivo: UploadFile = File(...),
    id_central: int | None = Form(default=None),
    db: Session = Depends(get_db),
    _: Usuario = Depends(_escritura),
) -> ResumenIngesta:
    contenido = await archivo.read()
    resumen, _cand, _central, _patrones, _config = _analizar(db, contenido, id_central)
    resumen["archivo"] = archivo.filename or "sin-nombre"
    return ResumenIngesta(**{k: v for k, v in resumen.items() if k != "ejemplos"},
                          ejemplos=resumen["ejemplos"])


@router.post("", response_model=ResumenIngesta, status_code=status.HTTP_201_CREATED,
             summary="Cargar el archivo diario e insertar los casos nuevos")
async def cargar(
    archivo: UploadFile = File(...),
    id_central: int | None = Form(default=None),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_escritura),
) -> ResumenIngesta:
    contenido = await archivo.read()
    nombre = archivo.filename or "sin-nombre"

    resumen, candidatas, central, _patrones, _config = _analizar(db, contenido, id_central)
    resumen["archivo"] = nombre

    lote = IngestaLote(
        archivo=nombre[:255],
        id_central=central.id_central,
        filas_leidas=resumen["filas_leidas"],
        filas_central=resumen["filas_central"],
        casos_nuevos=resumen["casos_nuevos"],
        casos_duplicados=resumen["casos_duplicados"],
        casos_descartados=resumen["casos_descartados"],
        estado="PROCESANDO",
        usuario=usuario.p00,
    )
    db.add(lote)
    db.flush()

    for fila in candidatas:
        datos = {campo: fila.get(campo) for campo in CAMPOS_ESPECIFICACION}
        datos["id_central"] = central.id_central
        datos["id_lote_ingesta"] = lote.id_lote
        datos["id_sector"] = fila.get("_id_sector")
        datos["en_gestion_supervisor"] = bool(fila.get("_cuadrilla0"))
        datos["origen"] = "INGESTA_CSV"
        datos["creado_por"] = usuario.p00
        datos["ayudantes"] = datos.get("ayudantes") or []
        db.add(Caso(**datos))

    lote.estado = "OK"
    lote.detalle_error = "; ".join(resumen["avisos"]) or None
    db.commit()

    # RF-09: detección automática de fallas masivas por concentración
    creadas = fallas.detectar(db, central.id_central)
    if creadas:
        db.commit()
        resumen["fallas_masivas"] = len(creadas)

    return ResumenIngesta(
        **{k: v for k, v in resumen.items() if k not in ("ejemplos", "fallas_masivas")},
        id_lote=lote.id_lote, ejemplos=resumen["ejemplos"],
        fallas_masivas=resumen.get("fallas_masivas", 0),
    )


@router.get("/lotes", response_model=list[IngestaLoteOut], summary="Historial de cargas")
def listar_lotes(
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
    limite: int = Query(default=50, ge=1, le=200),
) -> list[IngestaLote]:
    return list(
        db.scalars(
            select(IngestaLote).order_by(IngestaLote.id_lote.desc()).limit(limite)
        ).all()
    )


@router.get("/lotes/{id_lote}", response_model=IngestaLoteOut, summary="Detalle de una carga")
def obtener_lote(
    id_lote: int, db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)
) -> IngestaLote:
    lote = db.get(IngestaLote, id_lote)
    if lote is None:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    return lote
