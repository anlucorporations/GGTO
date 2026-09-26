"""CRUD de CONFIGURACIÓN — RF-02, RF-03, RF-04, RF-07, RF-38 / RNF-21."""

from __future__ import annotations

from datetime import UTC, date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..models import (
    CatalogoMetodo,
    Causa,
    Central,
    Configuracion,
    Cuadrilla,
    CuadrillaHerramienta,
    CuadrillaTecnico,
    Flota,
    Sector,
    SectorDireccion,
    Tecnico,
    Usuario,
)
from ..schemas.config import (
    CausaCreate,
    CausaOut,
    CentralCreate,
    CentralOut,
    CentralUpdate,
    ConfiguracionOut,
    ConfiguracionUpdate,
    CuadrillaCreate,
    CuadrillaIntegranteCreate,
    CuadrillaIntegranteOut,
    CuadrillaOut,
    CuadrillaUpdate,
    FlotaCreate,
    FlotaOut,
    FlotaUpdate,
    MetodoCreate,
    MetodoOut,
    SectorCreate,
    SectorDireccionCreate,
    SectorDireccionOut,
    SectorOut,
    SectorUpdate,
    TecnicoCreate,
    TecnicoOut,
    TecnicoUpdate,
)
from .deps import get_current_user, require_roles

router = APIRouter(prefix="/api/v1", tags=["configuración"])

# Escritura solo para ADMIN y SUPERVISOR (RNF-21); lectura para cualquier usuario autenticado.
_escritura = require_roles("ADMIN", "SUPERVISOR")


def _o_404(db: Session, modelo, pk, nombre: str):
    obj = db.get(modelo, pk)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{nombre} no encontrado")
    return obj


def _commit(db: Session, mensaje: str):
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Conflicto: {mensaje}") from exc


# --------------------------------------------------------------------------- #
# CENTRAL
# --------------------------------------------------------------------------- #
@router.get("/central", response_model=list[CentralOut])
def listar_central(
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
    solo_activas: bool = Query(default=False),
):
    stmt = select(Central).order_by(Central.id_central)
    if solo_activas:
        stmt = stmt.where(Central.activa.is_(True))
    return db.scalars(stmt).all()


@router.post("/central", response_model=CentralOut, status_code=status.HTTP_201_CREATED)
def crear_central(
    datos: CentralCreate,
    db: Session = Depends(get_db),
    _: Usuario = Depends(_escritura),
):
    obj = Central(**datos.model_dump())
    db.add(obj)
    _commit(db, "el código de central ya existe")
    db.refresh(obj)
    return obj


@router.get("/central/{id_central}", response_model=CentralOut)
def obtener_central(
    id_central: int, db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)
):
    return _o_404(db, Central, id_central, "Central")


@router.patch("/central/{id_central}", response_model=CentralOut)
def actualizar_central(
    id_central: int,
    datos: CentralUpdate,
    db: Session = Depends(get_db),
    _: Usuario = Depends(_escritura),
):
    obj = _o_404(db, Central, id_central, "Central")
    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(obj, campo, valor)
    _commit(db, "datos inválidos")
    db.refresh(obj)
    return obj


@router.delete("/central/{id_central}", status_code=status.HTTP_204_NO_CONTENT)
def desactivar_central(
    id_central: int, db: Session = Depends(get_db), _: Usuario = Depends(_escritura)
):
    obj = _o_404(db, Central, id_central, "Central")
    obj.activa = False
    _commit(db, "no se pudo desactivar")


# --------------------------------------------------------------------------- #
# SECTORES
# --------------------------------------------------------------------------- #
@router.get("/sectores", response_model=list[SectorOut])
def listar_sectores(
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
    id_central: int | None = None,
    solo_activos: bool = Query(default=False),
):
    stmt = select(Sector).order_by(Sector.prioridad, Sector.nombre)
    if id_central is not None:
        stmt = stmt.where(Sector.id_central == id_central)
    if solo_activos:
        stmt = stmt.where(Sector.activo.is_(True))
    return db.scalars(stmt).all()


@router.post("/sectores", response_model=SectorOut, status_code=status.HTTP_201_CREATED)
def crear_sector(
    datos: SectorCreate, db: Session = Depends(get_db), _: Usuario = Depends(_escritura)
):
    _o_404(db, Central, datos.id_central, "Central")
    direcciones = datos.direcciones
    valores = datos.model_dump(exclude={"direcciones"})
    sector = Sector(**valores)
    sector.direcciones = [SectorDireccion(**d.model_dump()) for d in direcciones]
    db.add(sector)
    _commit(db, "el código de sector ya existe en la central")
    db.refresh(sector)
    return sector


@router.get("/sectores/{id_sector}", response_model=SectorOut)
def obtener_sector(
    id_sector: int, db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)
):
    return _o_404(db, Sector, id_sector, "Sector")


@router.patch("/sectores/{id_sector}", response_model=SectorOut)
def actualizar_sector(
    id_sector: int,
    datos: SectorUpdate,
    db: Session = Depends(get_db),
    _: Usuario = Depends(_escritura),
):
    obj = _o_404(db, Sector, id_sector, "Sector")
    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(obj, campo, valor)
    _commit(db, "datos inválidos")
    db.refresh(obj)
    return obj


@router.delete("/sectores/{id_sector}", status_code=status.HTTP_204_NO_CONTENT)
def desactivar_sector(
    id_sector: int, db: Session = Depends(get_db), _: Usuario = Depends(_escritura)
):
    obj = _o_404(db, Sector, id_sector, "Sector")
    obj.activo = False
    _commit(db, "no se pudo desactivar")


@router.post(
    "/sectores/{id_sector}/direcciones",
    response_model=SectorDireccionOut,
    status_code=status.HTTP_201_CREATED,
)
def agregar_direccion(
    id_sector: int,
    datos: SectorDireccionCreate,
    db: Session = Depends(get_db),
    _: Usuario = Depends(_escritura),
):
    _o_404(db, Sector, id_sector, "Sector")
    obj = SectorDireccion(id_sector=id_sector, **datos.model_dump())
    db.add(obj)
    _commit(db, "el patrón ya existe en el sector")
    db.refresh(obj)
    return obj


@router.delete(
    "/sectores/{id_sector}/direcciones/{id_direccion}", status_code=status.HTTP_204_NO_CONTENT
)
def eliminar_direccion(
    id_sector: int,
    id_direccion: int,
    db: Session = Depends(get_db),
    _: Usuario = Depends(_escritura),
):
    obj = _o_404(db, SectorDireccion, id_direccion, "Dirección")
    if obj.id_sector != id_sector:
        raise HTTPException(status_code=404, detail="La dirección no pertenece al sector")
    db.delete(obj)
    _commit(db, "no se pudo eliminar")


# --------------------------------------------------------------------------- #
# TÉCNICOS
# --------------------------------------------------------------------------- #
@router.get("/tecnicos", response_model=list[TecnicoOut])
def listar_tecnicos(
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
    id_central: int | None = None,
    status_: str | None = Query(default=None, alias="status"),
):
    stmt = select(Tecnico).order_by(Tecnico.nombre, Tecnico.apellido)
    if id_central is not None:
        stmt = stmt.where(Tecnico.id_central == id_central)
    if status_:
        stmt = stmt.where(Tecnico.status == status_)
    return db.scalars(stmt).all()


@router.post("/tecnicos", response_model=TecnicoOut, status_code=status.HTTP_201_CREATED)
def crear_tecnico(
    datos: TecnicoCreate, db: Session = Depends(get_db), _: Usuario = Depends(_escritura)
):
    _o_404(db, Central, datos.id_central, "Central")
    obj = Tecnico(**datos.model_dump())
    db.add(obj)
    _commit(db, "el P00 o la cédula ya existen")
    db.refresh(obj)
    return obj


@router.get("/tecnicos/{id_tecnico}", response_model=TecnicoOut)
def obtener_tecnico(
    id_tecnico: int, db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)
):
    return _o_404(db, Tecnico, id_tecnico, "Técnico")


@router.patch("/tecnicos/{id_tecnico}", response_model=TecnicoOut)
def actualizar_tecnico(
    id_tecnico: int,
    datos: TecnicoUpdate,
    db: Session = Depends(get_db),
    _: Usuario = Depends(_escritura),
):
    obj = _o_404(db, Tecnico, id_tecnico, "Técnico")
    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(obj, campo, valor)
    _commit(db, "datos inválidos")
    db.refresh(obj)
    return obj


@router.delete("/tecnicos/{id_tecnico}", status_code=status.HTTP_204_NO_CONTENT)
def desactivar_tecnico(
    id_tecnico: int, db: Session = Depends(get_db), _: Usuario = Depends(_escritura)
):
    obj = _o_404(db, Tecnico, id_tecnico, "Técnico")
    obj.status = "INACTIVO"
    _commit(db, "no se pudo desactivar")


# --------------------------------------------------------------------------- #
# FLOTA
# --------------------------------------------------------------------------- #
@router.get("/flota", response_model=list[FlotaOut])
def listar_flota(
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
    id_central: int | None = None,
):
    stmt = select(Flota).order_by(Flota.can)
    if id_central is not None:
        stmt = stmt.where(Flota.id_central == id_central)
    return db.scalars(stmt).all()


@router.post("/flota", response_model=FlotaOut, status_code=status.HTTP_201_CREATED)
def crear_flota(
    datos: FlotaCreate, db: Session = Depends(get_db), _: Usuario = Depends(_escritura)
):
    _o_404(db, Central, datos.id_central, "Central")
    obj = Flota(**datos.model_dump())
    db.add(obj)
    _commit(db, "el CAN o la placa ya existen")
    db.refresh(obj)
    return obj


@router.get("/flota/{id_flota}", response_model=FlotaOut)
def obtener_flota(
    id_flota: int, db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)
):
    return _o_404(db, Flota, id_flota, "Flota")


@router.patch("/flota/{id_flota}", response_model=FlotaOut)
def actualizar_flota(
    id_flota: int,
    datos: FlotaUpdate,
    db: Session = Depends(get_db),
    _: Usuario = Depends(_escritura),
):
    obj = _o_404(db, Flota, id_flota, "Flota")
    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(obj, campo, valor)
    _commit(db, "datos inválidos")
    db.refresh(obj)
    return obj


@router.delete("/flota/{id_flota}", status_code=status.HTTP_204_NO_CONTENT)
def retirar_flota(
    id_flota: int, db: Session = Depends(get_db), _: Usuario = Depends(_escritura)
):
    obj = _o_404(db, Flota, id_flota, "Flota")
    obj.status = "FUERA_SERVICIO"
    _commit(db, "no se pudo retirar")


# --------------------------------------------------------------------------- #
# CUADRILLAS
# --------------------------------------------------------------------------- #
@router.get("/cuadrillas", response_model=list[CuadrillaOut])
def listar_cuadrillas(
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
    id_central: int | None = None,
    solo_activas: bool = Query(default=False),
):
    stmt = select(Cuadrilla).order_by(Cuadrilla.codigo)
    if id_central is not None:
        stmt = stmt.where(Cuadrilla.id_central == id_central)
    if solo_activas:
        stmt = stmt.where(Cuadrilla.activa.is_(True))
    return db.scalars(stmt).all()


@router.post("/cuadrillas", response_model=CuadrillaOut, status_code=status.HTTP_201_CREATED)
def crear_cuadrilla(
    datos: CuadrillaCreate, db: Session = Depends(get_db), _: Usuario = Depends(_escritura)
):
    _o_404(db, Central, datos.id_central, "Central")
    valores = datos.model_dump(exclude={"integrantes", "herramientas"})
    cuadrilla = Cuadrilla(**valores)
    hoy = date.today()
    cuadrilla.integrantes = [
        CuadrillaTecnico(
            id_tecnico=i.id_tecnico,
            rol_cuadrilla=i.rol_cuadrilla,
            desde=i.desde or hoy,
        )
        for i in datos.integrantes
    ]
    cuadrilla.herramientas = [
        CuadrillaHerramienta(id_herramienta=h, asignada_en=datetime.now(UTC))
        for h in datos.herramientas
    ]
    db.add(cuadrilla)
    _commit(db, "el código de cuadrilla ya existe en la central")
    db.refresh(cuadrilla)
    return cuadrilla


@router.get("/cuadrillas/{id_cuadrilla}", response_model=CuadrillaOut)
def obtener_cuadrilla(
    id_cuadrilla: int, db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)
):
    return _o_404(db, Cuadrilla, id_cuadrilla, "Cuadrilla")


@router.patch("/cuadrillas/{id_cuadrilla}", response_model=CuadrillaOut)
def actualizar_cuadrilla(
    id_cuadrilla: int,
    datos: CuadrillaUpdate,
    db: Session = Depends(get_db),
    _: Usuario = Depends(_escritura),
):
    obj = _o_404(db, Cuadrilla, id_cuadrilla, "Cuadrilla")
    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(obj, campo, valor)
    _commit(db, "datos inválidos")
    db.refresh(obj)
    return obj


@router.post(
    "/cuadrillas/{id_cuadrilla}/integrantes",
    response_model=CuadrillaIntegranteOut,
    status_code=status.HTTP_201_CREATED,
)
def agregar_integrante(
    id_cuadrilla: int,
    datos: CuadrillaIntegranteCreate,
    db: Session = Depends(get_db),
    _: Usuario = Depends(_escritura),
):
    _o_404(db, Cuadrilla, id_cuadrilla, "Cuadrilla")
    _o_404(db, Tecnico, datos.id_tecnico, "Técnico")
    integrante = CuadrillaTecnico(
        id_cuadrilla=id_cuadrilla,
        id_tecnico=datos.id_tecnico,
        rol_cuadrilla=datos.rol_cuadrilla,
        desde=datos.desde or date.today(),
    )
    db.add(integrante)
    _commit(db, "el técnico ya está en la cuadrilla desde esa fecha")
    return integrante


@router.delete(
    "/cuadrillas/{id_cuadrilla}/integrantes/{id_tecnico}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def retirar_integrante(
    id_cuadrilla: int,
    id_tecnico: int,
    db: Session = Depends(get_db),
    _: Usuario = Depends(_escritura),
):
    hoy = date.today()
    integrante = db.scalar(
        select(CuadrillaTecnico).where(
            CuadrillaTecnico.id_cuadrilla == id_cuadrilla,
            CuadrillaTecnico.id_tecnico == id_tecnico,
            CuadrillaTecnico.hasta.is_(None),
        )
    )
    if integrante is None:
        raise HTTPException(status_code=404, detail="El técnico no está activo en la cuadrilla")
    integrante.hasta = hoy
    _commit(db, "no se pudo retirar")


# --------------------------------------------------------------------------- #
# CATÁLOGOS
# --------------------------------------------------------------------------- #
@router.get("/catalogos/causas", response_model=list[CausaOut])
def listar_causas(
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
    solo_activos: bool = Query(default=True),
):
    stmt = select(Causa).order_by(Causa.codigo_causa, Causa.subcodigo_causa)
    if solo_activos:
        stmt = stmt.where(Causa.activo.is_(True))
    return db.scalars(stmt).all()


@router.post("/catalogos/causas", response_model=CausaOut, status_code=status.HTTP_201_CREATED)
def crear_causa(
    datos: CausaCreate, db: Session = Depends(get_db), _: Usuario = Depends(_escritura)
):
    obj = Causa(**datos.model_dump())
    db.add(obj)
    _commit(db, "la causa ya existe")
    db.refresh(obj)
    return obj


@router.delete("/catalogos/causas/{id_causa}", status_code=status.HTTP_204_NO_CONTENT)
def desactivar_causa(
    id_causa: int, db: Session = Depends(get_db), _: Usuario = Depends(_escritura)
):
    obj = _o_404(db, Causa, id_causa, "Causa")
    obj.activo = False
    _commit(db, "no se pudo desactivar")


@router.get("/catalogos/metodos", response_model=list[MetodoOut])
def listar_metodos(
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
    dominio: str | None = None,
):
    stmt = select(CatalogoMetodo).order_by(CatalogoMetodo.dominio, CatalogoMetodo.codigo)
    if dominio:
        stmt = stmt.where(CatalogoMetodo.dominio == dominio)
    return db.scalars(stmt).all()


@router.post("/catalogos/metodos", response_model=MetodoOut, status_code=status.HTTP_201_CREATED)
def crear_metodo(
    datos: MetodoCreate, db: Session = Depends(get_db), _: Usuario = Depends(_escritura)
):
    obj = CatalogoMetodo(**datos.model_dump())
    db.add(obj)
    _commit(db, "el método ya existe para ese dominio")
    db.refresh(obj)
    return obj


# --------------------------------------------------------------------------- #
# PARÁMETROS
# --------------------------------------------------------------------------- #
@router.get("/configuracion", response_model=list[ConfiguracionOut])
def listar_configuracion(db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)):
    return db.scalars(select(Configuracion).order_by(Configuracion.clave)).all()


@router.put("/configuracion/{clave}", response_model=ConfiguracionOut)
def actualizar_configuracion(
    clave: str,
    datos: ConfiguracionUpdate,
    db: Session = Depends(get_db),
    _: Usuario = Depends(_escritura),
):
    obj = db.get(Configuracion, clave)
    if obj is None:
        raise HTTPException(status_code=404, detail="Parámetro no encontrado")
    obj.valor = datos.valor
    if datos.descripcion is not None:
        obj.descripcion = datos.descripcion
    _commit(db, "valor inválido")
    db.refresh(obj)
    return obj
