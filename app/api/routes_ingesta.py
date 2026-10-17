"""Ingesta del archivo diario de averías — RF-01, RF-21, RF-22, RF-23, RF-25, RF-29."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..models import Central, IngestaLote, Usuario
from ..models.caso_entities import Caso
from ..schemas.ingesta import (
    DireccionesSinSectorOut,
    DireccionSinSector,
    IngestaLoteOut,
    ResumenIngesta,
    SectorizacionPendientesOut,
)
from ..services import cuadrilla0, fallas, pagos
from ..services.consultas import cargar_config, cargar_patrones, resolver_central
from ..services.ingesta import (
    COLUMNAS_ESPERADAS,
    ESPECIFICACION,
    columnas_encabezado,
    encabezado_valido,
    filtrar_por_central,
    normalizar,
    parsear,
)
from ..services.sectorizacion import Patron, asignar_sector
from .deps import get_current_user, require_roles

router = APIRouter(prefix="/api/v1/ingesta", tags=["ingesta"])

_escritura = require_roles("ADMIN", "SUPERVISOR")
CAMPOS_ESPECIFICACION = tuple(c for c, _, _ in ESPECIFICACION)
TAMANO_LOTE_CONSULTA = 1000
MAX_AVISOS_DETALLE = 500


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
        "filas_sin_identificador_pago": 0,
        "filas_con_contacto": 0,
        "avisos": avisos,
        "ejemplos": [],
    }

    # D-89 (RF-45/RF-46/RF-56): clasificación de los números de cada fila.
    patron = pagos.compilar_patron(config)
    avisos_detalle: list[dict[str, Any]] = []
    for fila in candidatas:
        clasificacion = pagos.clasificar_numeros(fila, patron)
        fila["_clasificacion"] = clasificacion
        if clasificacion.sin_identificador:
            resumen["filas_sin_identificador_pago"] += 1
            if len(avisos_detalle) < MAX_AVISOS_DETALLE:
                avisos_detalle.append({
                    "fila": fila.get("_linea"),
                    "id_averia": fila.get("id_averia"),
                    "numero": pagos.normalizar_numero(fila.get("telefono")) or None,
                    "motivo": clasificacion.motivo,
                })
        if clasificacion.contactos:
            resumen["filas_con_contacto"] += 1
    resumen["avisos_detalle"] = avisos_detalle
    if resumen["filas_sin_identificador_pago"]:
        resumen["avisos"].append(
            f"{resumen['filas_sin_identificador_pago']} filas sin identificador de pago (70*)"
        )
    if resumen["filas_con_contacto"]:
        resumen["avisos"].append(
            f"{resumen['filas_con_contacto']} filas con número de contacto sumado a informacion"
        )

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

    # Direcciones que no pertenecen a ningún sector: se agrupan para que el
    # usuario las gestione en SECTOR (requisito 2 del ciclo D-66).
    pendientes: dict[str, dict[str, Any]] = {}
    for fila in candidatas:
        if fila.get("_id_sector"):
            continue
        direccion = (fila.get("direccion") or "").strip()
        if not direccion:
            continue
        clave = normalizar(direccion)
        registro = pendientes.setdefault(
            clave, {"direccion": direccion, "total": 0, "ejemplo_id_averia": fila.get("id_averia")}
        )
        registro["total"] += 1

    resumen["direcciones_sin_sector"] = sorted(
        pendientes.values(), key=lambda d: (-d["total"], d["direccion"])
    )[:50]

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
    if not encabezado_valido(contenido):
        raise HTTPException(status_code=422, detail=_detalle_encabezado(contenido))
    resumen, _cand, _central, _patrones, _config = _analizar(db, contenido, id_central)
    resumen["archivo"] = archivo.filename or "sin-nombre"
    return ResumenIngesta(
        **{k: v for k, v in resumen.items() if k not in ("ejemplos", "avisos_detalle")},
        ejemplos=resumen["ejemplos"],
        avisos_detalle=resumen["avisos_detalle"],
    )


def _detalle_encabezado(contenido: bytes | str) -> str:
    """Mensaje único de la validación de encabezado (RT-20)."""
    return (
        f"El encabezado tiene {columnas_encabezado(contenido)} columnas; "
        f"se esperaban {COLUMNAS_ESPERADAS} (RT-05 / RT-20)"
    )


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

    # RT-20: encabezado inválido → lote en ERROR, 0 casos y 422 al cliente.
    if not encabezado_valido(contenido):
        detalle = _detalle_encabezado(contenido)
        config = cargar_config(db)
        central = resolver_central(db, id_central, config)
        db.add(
            IngestaLote(
                archivo=nombre[:255],
                id_central=central.id_central,
                filas_leidas=0,
                estado="ERROR",
                detalle_error=detalle,
                usuario=usuario.p00,
            )
        )
        db.commit()
        raise HTTPException(status_code=422, detail=detalle)

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
        filas_sin_identificador_pago=resumen["filas_sin_identificador_pago"],
        filas_con_contacto=resumen["filas_con_contacto"],
        estado="PROCESANDO",
        usuario=usuario.p00,
    )
    db.add(lote)
    db.flush()

    cache_pagos: dict[str, int] = {}
    for fila in candidatas:
        datos = {campo: fila.get(campo) for campo in CAMPOS_ESPECIFICACION}
        clasificacion = fila.get("_clasificacion")
        if clasificacion is not None:
            datos["telefono"] = clasificacion.identificador
            datos["contacto_cliente"] = (
                clasificacion.contacto_principal or datos.get("contacto_cliente")
            )
            datos["informacion"] = pagos.componer_informacion(
                datos.get("informacion"), clasificacion.contactos
            )
        datos["id_central"] = central.id_central
        datos["id_lote_ingesta"] = lote.id_lote
        datos["id_sector"] = fila.get("_id_sector")
        datos["en_gestion_supervisor"] = bool(fila.get("_cuadrilla0"))
        datos["origen"] = "INGESTA_CSV"
        datos["creado_por"] = usuario.p00
        datos["ayudantes"] = datos.get("ayudantes") or []
        datos["id_pago"] = (
            pagos.resolver_identificador(
                db,
                clasificacion.identificador,
                central.id_central,
                datos.get("nombre_cliente"),
                datos.get("direccion"),
                cache_pagos,
            )
            if clasificacion is not None and clasificacion.identificador
            else None
        )
        db.add(Caso(**datos))

    lote.estado = "OK"
    lote.detalle_error = "; ".join(resumen["avisos"]) or None
    lote.avisos = resumen["avisos_detalle"]
    db.commit()

    # RF-09: detección automática de fallas masivas por concentración
    creadas = fallas.detectar(db, central.id_central)
    if creadas:
        db.commit()
        resumen["fallas_masivas"] = len(creadas)

    return ResumenIngesta(
        **{
            k: v
            for k, v in resumen.items()
            if k not in ("ejemplos", "fallas_masivas", "avisos_detalle")
        },
        id_lote=lote.id_lote,
        ejemplos=resumen["ejemplos"],
        avisos_detalle=resumen["avisos_detalle"],
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


@router.get("/direcciones-sin-sector", response_model=DireccionesSinSectorOut,
            summary="Direcciones del sistema que no pertenecen a ningún sector (D-106)")
def direcciones_sin_sector(
    id_central: int | None = Query(default=None),
    db: Session = Depends(get_db),
    _: Usuario = Depends(_escritura),
) -> DireccionesSinSectorOut:
    """Agrupa por dirección los casos vigentes que se quedaron sin sector.

    Es la vista **permanente** de la gestión que antes solo aparecía al terminar
    una ingesta: si el usuario cierra el cuadro, o si los casos sin sector vienen
    de cargas anteriores, aquí los recupera para asignarles un sector.
    """
    config = cargar_config(db)
    central = resolver_central(db, id_central, config)
    casos = db.scalars(
        select(Caso).where(
            Caso.id_central == central.id_central,
            Caso.id_sector.is_(None),
            Caso.direccion.isnot(None),
        )
    ).all()

    pendientes: dict[str, dict[str, Any]] = {}
    total_casos = 0
    for caso in casos:
        direccion = (caso.direccion or "").strip()
        if not direccion:
            continue
        total_casos += 1
        clave = normalizar(direccion)
        registro = pendientes.setdefault(
            clave, {"direccion": direccion, "total": 0, "ejemplo_id_averia": caso.id_averia}
        )
        registro["total"] += 1

    ordenadas = sorted(pendientes.values(), key=lambda d: (-d["total"], d["direccion"]))[:200]
    return DireccionesSinSectorOut(
        total_direcciones=len(pendientes),
        total_casos=total_casos,
        direcciones=[DireccionSinSector(**d) for d in ordenadas],
    )


@router.post("/sectorizar-pendientes", response_model=SectorizacionPendientesOut,
             summary="Re-sectorizar los casos sin sector de la central (D-66)")
def sectorizar_pendientes(
    id_central: int | None = Query(default=None),
    db: Session = Depends(get_db),
    _: Usuario = Depends(_escritura),
) -> SectorizacionPendientesOut:
    """Aplica los patrones vigentes a los casos que quedaron sin sector.

    Se usa después de agregar direcciones nuevas a un sector desde la ingesta.
    """
    config = cargar_config(db)
    central = resolver_central(db, id_central, config)
    patrones = cargar_patrones(db, central.id_central)

    pendientes = list(
        db.scalars(
            select(Caso).where(
                Caso.id_central == central.id_central,
                Caso.id_sector.is_(None),
                Caso.direccion.isnot(None),
            )
        ).all()
    )
    asignados = 0
    for caso in pendientes:
        id_sector = asignar_sector(caso.direccion, patrones)
        if id_sector:
            caso.id_sector = id_sector
            asignados += 1
    if asignados:
        db.commit()
    return SectorizacionPendientesOut(
        revisados=len(pendientes), asignados=asignados, sin_sector=len(pendientes) - asignados
    )
