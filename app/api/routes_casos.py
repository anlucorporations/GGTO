"""PANEL y CASOS — RF-30, RF-31, RF-32, RF-33 y bitácora RNF-12."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select, text
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..models import Caso, CasoEstadoHist, Cita, DespachoCasos, Sector, Usuario
from ..schemas.casos import (
    CasoEstadoHistOut,
    CasoManualCreate,
    CasoOut,
    CasoUpdate,
    PaginaCasos,
)
from ..services.consultas import cargar_config, cargar_patrones, resolver_central
from ..services.sectorizacion import asignar_sector
from .deps import get_current_user, require_roles

router = APIRouter(prefix="/api/v1/casos", tags=["casos"])

_escritura = require_roles("ADMIN", "SUPERVISOR")


def _o_404(db: Session, id_caso: int) -> Caso:
    caso = db.get(Caso, id_caso)
    if caso is None:
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    return caso


def _registrar_estado(db: Session, caso: Caso, nuevo: str, motivo: str | None,
                      usuario: str | None) -> None:
    if nuevo == caso.estado_actual:
        return
    db.add(
        CasoEstadoHist(
            id_caso=caso.id_caso,
            estado_anterior=caso.estado_actual,
            estado_nuevo=nuevo,
            motivo=motivo,
            usuario=usuario,
        )
    )
    caso.estado_actual = nuevo


def _sectorizar(db: Session, id_central: int, direccion: str | None) -> int | None:
    return asignar_sector(direccion, cargar_patrones(db, id_central))


def _resumen(db: Session, casos: list[Caso]) -> list[CasoOut]:
    """Añade el nombre del sector y los iconos de estado del listado."""
    if not casos:
        return []
    ids = [c.id_caso for c in casos]
    sectores = {s.id_sector: s.nombre for s in db.scalars(select(Sector)).all()}
    pendientes = set(db.scalars(select(Caso.id_caso).where(
        Caso.id_caso.in_(ids), Caso.estado_actual.notin_(('CERRADO', 'CANCELADO')))))
    asignados = set(db.scalars(select(DespachoCasos.id_caso).where(
        DespachoCasos.id_caso.in_(ids))))
    asignados |= {c.id_caso for c in casos if c.estado_actual == 'ASIGNADO'}
    citados = set(db.scalars(select(Cita.id_caso).where(
        Cita.id_caso.in_(ids), Cita.estado.in_(('PROPUESTA', 'CONFIRMADA')))))
    gestion = {c.id_caso for c in casos if c.en_gestion_supervisor or c.estado_actual == 'EN_GESTION'}
    gestion |= set(db.scalars(select(DespachoCasos.id_caso).where(
        DespachoCasos.id_caso.in_(ids), DespachoCasos.estado == 'GESTIONADO')))
    salida: list[CasoOut] = []
    for caso in casos:
        datos = CasoOut.model_validate(caso).model_dump()
        datos.update(
            sector_nombre=(sectores.get(caso.id_sector) if caso.id_sector else None),
            pendiente=caso.id_caso in pendientes,
            asignado=caso.id_caso in asignados,
            citado=caso.id_caso in citados,
            gestion=caso.id_caso in gestion,
        )
        salida.append(CasoOut(**datos))
    return salida


# --------------------------------------------------------------------------- #
# Listado con filtros (RF-33)
# --------------------------------------------------------------------------- #
@router.get("", response_model=PaginaCasos, summary="Listado de casos con filtros")
def listar(
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
    q: str | None = Query(default=None, description="Texto libre: avería, teléfono, cliente o dirección"),
    id_averia: str | None = None,
    telefono: str | None = None,
    id_central: int | None = None,
    id_sector: int | None = None,
    id_causa: int | None = None,
    id_lote_ingesta: int | None = None,
    estado_actual: str | None = None,
    tipo_caso: str | None = None,
    categoria: str | None = None,
    origen: str | None = None,
    en_gestion_supervisor: bool | None = None,
    es_falla_masiva: bool | None = None,
    desde: datetime | None = Query(default=None, description="fecha_reporte desde"),
    hasta: datetime | None = Query(default=None, description="fecha_reporte hasta"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
) -> PaginaCasos:
    condiciones = []
    if q:
        patron = f"%{q.strip()}%"
        condiciones.append(
            or_(
                Caso.id_averia.ilike(patron),
                Caso.telefono.ilike(patron),
                Caso.nombre_cliente.ilike(patron),
                Caso.direccion.ilike(patron),
            )
        )
    if id_averia:
        condiciones.append(Caso.id_averia.ilike(f"%{id_averia.strip()}%"))
    if telefono:
        condiciones.append(Caso.telefono.ilike(f"%{telefono.strip()}%"))
    if id_central is not None:
        condiciones.append(Caso.id_central == id_central)
    if id_sector is not None:
        condiciones.append(Caso.id_sector == id_sector)
    if id_causa is not None:
        condiciones.append(Caso.id_causa == id_causa)
    if id_lote_ingesta is not None:
        condiciones.append(Caso.id_lote_ingesta == id_lote_ingesta)
    if estado_actual:
        condiciones.append(Caso.estado_actual == estado_actual)
    if tipo_caso:
        condiciones.append(Caso.tipo_caso == tipo_caso)
    if categoria:
        condiciones.append(Caso.categoria == categoria)
    if origen:
        condiciones.append(Caso.origen == origen)
    if en_gestion_supervisor is not None:
        condiciones.append(Caso.en_gestion_supervisor.is_(en_gestion_supervisor))
    if es_falla_masiva is not None:
        condiciones.append(Caso.es_falla_masiva.is_(es_falla_masiva))
    if desde is not None:
        condiciones.append(Caso.fecha_reporte >= desde)
    if hasta is not None:
        condiciones.append(Caso.fecha_reporte <= hasta)

    total = db.scalar(select(func.count()).select_from(Caso).where(*condiciones)) or 0
    items = db.scalars(
        select(Caso)
        .where(*condiciones)
        .order_by(Caso.fecha_reporte.desc().nullslast(), Caso.id_caso.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    paginas = (total + page_size - 1) // page_size if page_size else 0
    return PaginaCasos(
        items=_resumen(db, list(items)),
        total=total,
        page=page,
        page_size=page_size,
        pages=paginas,
    )


# --------------------------------------------------------------------------- #
# Búsqueda en PANEL (RF-30)
# --------------------------------------------------------------------------- #
@router.get("/buscar", response_model=list[CasoOut], summary="Buscar por id_averia o teléfono")
def buscar(
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
    q: str | None = Query(default=None, description="Incidente o número de teléfono"),
    id_averia: str | None = Query(default=None),
    telefono: str | None = Query(default=None),
    limite: int = Query(default=20, ge=1, le=100),
) -> list[CasoOut]:
    if not any((q, id_averia, telefono)):
        raise HTTPException(
            status_code=422,
            detail="Indique `q`, `id_averia` o `telefono` para buscar",
        )
    condiciones = []
    if q:
        termino = q.strip()
        condiciones.append(
            or_(
                Caso.id_averia.ilike(f"%{termino}%"),
                Caso.telefono.ilike(f"%{termino}%"),
                Caso.nombre_cliente.ilike(f"%{termino}%"),
                Caso.direccion.ilike(f"%{termino}%"),
            )
        )
    if id_averia:
        condiciones.append(Caso.id_averia == id_averia.strip())
    if telefono:
        limpio = telefono.strip()
        condiciones.append(
            or_(Caso.telefono == limpio, Caso.telefono.ilike(f"%{limpio}%"))
        )
    encontrados = list(
        db.scalars(
            select(Caso)
            .where(or_(*condiciones) if len(condiciones) > 1 else condiciones[0])
            .order_by(Caso.fecha_reporte.desc().nullslast())
            .limit(limite)
        ).all()
    )
    return _resumen(db, list(encontrados))


# --------------------------------------------------------------------------- #
# Alta manual (RF-32)
# --------------------------------------------------------------------------- #
@router.post("", response_model=CasoOut, status_code=status.HTTP_201_CREATED,
             summary="Alta manual de un caso (genera REF-… si no hay id_averia)")
def crear_manual(
    datos: CasoManualCreate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_escritura),
) -> CasoOut:
    config = cargar_config(db)
    central = resolver_central(db, datos.id_central, config)

    valores = datos.model_dump(exclude={"id_sector", "id_averia", "id_central"})
    id_averia = (datos.id_averia or "").strip()
    if not id_averia:
        id_averia = db.execute(
            text("SELECT generar_id_averia_ref(:c)"), {"c": central.id_central}
        ).scalar_one()

    if db.scalar(select(Caso.id_caso).where(Caso.id_averia == id_averia)) is not None:
        raise HTTPException(status_code=409, detail=f"Ya existe un caso con id_averia {id_averia}")

    id_sector = datos.id_sector
    if id_sector is None:
        id_sector = _sectorizar(db, central.id_central, datos.direccion)
    elif db.get(Sector, id_sector) is None:
        raise HTTPException(status_code=404, detail="Sector no encontrado")

    if valores.get("fecha_reporte") is None:
        valores["fecha_reporte"] = datetime.now().astimezone()
    valores["ayudantes"] = []

    caso = Caso(
        **valores,
        id_central=central.id_central,
        id_averia=id_averia,
        id_sector=id_sector,
        origen="MANUAL",
        estado_actual="NUEVO",
        codigo_central=central.codigo_central,
        nombre_central=central.nombre_central,
        creado_por=usuario.p00,
    )
    db.add(caso)
    db.flush()
    db.add(
        CasoEstadoHist(
            id_caso=caso.id_caso,
            estado_anterior=None,
            estado_nuevo="NUEVO",
            motivo="Alta manual desde PANEL",
            usuario=usuario.p00,
        )
    )
    db.commit()
    db.refresh(caso)
    return _resumen(db, [caso])[0]


# --------------------------------------------------------------------------- #
# Ficha y edición (RF-31)
# --------------------------------------------------------------------------- #
@router.get("/{id_caso}", response_model=CasoOut, summary="Ficha completa del caso")
def obtener(id_caso: int, db: Session = Depends(get_db),
            _: Usuario = Depends(get_current_user)) -> CasoOut:
    return _resumen(db, [_o_404(db, id_caso)])[0]


@router.patch("/{id_caso}", response_model=CasoOut, summary="Actualizar un caso")
def actualizar(
    id_caso: int,
    datos: CasoUpdate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_escritura),
) -> CasoOut:
    caso = _o_404(db, id_caso)
    cambios = datos.model_dump(exclude_unset=True)

    motivo = cambios.pop("motivo_estado", None)
    nuevo_estado = cambios.pop("estado_actual", None)
    id_sector = cambios.pop("id_sector", None)

    for campo, valor in cambios.items():
        setattr(caso, campo, valor)

    if id_sector is not None:
        if db.get(Sector, id_sector) is None:
            raise HTTPException(status_code=404, detail="Sector no encontrado")
        caso.id_sector = id_sector
    elif "direccion" in cambios:
        # Al corregir la dirección se recalcula el sector (RF-23)
        caso.id_sector = _sectorizar(db, caso.id_central, caso.direccion)

    if nuevo_estado is not None:
        _registrar_estado(db, caso, nuevo_estado, motivo, usuario.p00)

    db.commit()
    db.refresh(caso)
    return _resumen(db, [caso])[0]


@router.get("/{id_caso}/historial", response_model=list[CasoEstadoHistOut],
            summary="Bitácora de estados del caso")
def historial(
    id_caso: int, db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)
) -> list[CasoEstadoHist]:
    _o_404(db, id_caso)
    return list(
        db.scalars(
            select(CasoEstadoHist)
            .where(CasoEstadoHist.id_caso == id_caso)
            .order_by(CasoEstadoHist.id_hist.desc())
        ).all()
    )
