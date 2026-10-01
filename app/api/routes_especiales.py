"""SEGUIMIENTO, EMPRESAS, REFERIDOS y AGENDA — RF-06, RF-12, RF-34, RF-35, RF-36 / RNF-04."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select, text
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..models import (
    Caso,
    Cita,
    Cuadrilla,
    DespachoCasos,
    Sector,
    Seguimiento,
    Solicitante,
    Usuario,
)
from ..models.especiales_entities import CasoEspecial
from ..schemas.especiales import (
    CasoEspecialCreate,
    CasoEspecialOut,
    CasoEspecialUpdate,
    CitaCreate,
    CitaOut,
    CitaUpdate,
    SeguimientoCreate,
    SeguimientoOut,
    SeguimientoUpdate,
    SolicitanteCreate,
    SolicitanteOut,
)
from ..services.consultas import cargar_config, cargar_patrones, resolver_central
from ..services.sectorizacion import asignar_sector
from .deps import ROL_SUPER, get_current_user, require_roles

router = APIRouter(prefix="/api/v1", tags=["seguimiento y especiales"])
_escritura = require_roles("ADMIN", "SUPERVISOR")

DURACION_POR_DEFECTO = 60
ESTADOS_BLOQUEANTES_POR_DEFECTO = ("PROPUESTA", "CONFIRMADA")


# --------------------------------------------------------------------------- #
# Solicitantes (personal externo)
# --------------------------------------------------------------------------- #
@router.get("/solicitantes", response_model=list[SolicitanteOut])
def listar_solicitantes(
    db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)
) -> list[Solicitante]:
    return list(db.scalars(select(Solicitante).order_by(Solicitante.unidad, Solicitante.nombre)).all())


@router.post("/solicitantes", response_model=SolicitanteOut, status_code=status.HTTP_201_CREATED)
def crear_solicitante(
    datos: SolicitanteCreate, db: Session = Depends(get_db), _: Usuario = Depends(_escritura)
) -> Solicitante:
    obj = Solicitante(**datos.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


# --------------------------------------------------------------------------- #
# Casos especiales (EMPRESAS / REFERIDOS / GOBIERNOS)
# --------------------------------------------------------------------------- #
def _crear_caso_asociado(db: Session, datos: CasoEspecialCreate, usuario: Usuario) -> Caso:
    config = cargar_config(db)
    central = resolver_central(db, None, config)
    id_averia = (datos.id_averia or "").strip() or db.execute(
        text("SELECT generar_id_averia_ref(:c)"), {"c": central.id_central}
    ).scalar_one()
    if db.scalar(select(Caso.id_caso).where(Caso.id_averia == id_averia)):
        raise HTTPException(status_code=409, detail=f"Ya existe un caso con id_averia {id_averia}")

    id_sector = asignar_sector(datos.direccion, cargar_patrones(db, central.id_central))
    caso = Caso(
        id_central=central.id_central,
        id_averia=id_averia,
        origen="MANUAL",
        tipo_caso="CONSTRUCCION" if datos.tipo_actividad == "CONSTRUCCION" else "REPARACION",
        categoria=datos.clasificacion,
        estado_actual="NUEVO",
        id_sector=id_sector,
        nombre_cliente=datos.nombre_cliente,
        telefono=datos.telefono,
        direccion=datos.direccion,
        informacion=datos.descripcion,
        codigo_central=central.codigo_central,
        nombre_central=central.nombre_central,
        creado_por=usuario.p00,
        ayudantes=[],
    )
    db.add(caso)
    db.flush()
    return caso


@router.get("/casos-especiales", response_model=list[CasoEspecialOut])
def listar_especiales(
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
    clasificacion: str | None = None,
    estado: str | None = None,
    prioridad: str | None = None,
    tipo_actividad: str | None = None,
    id_solicitante: int | None = None,
    q: str | None = Query(
        default=None,
        description="Texto libre: busca en todos los renglones de la tabla "
        "(tipo, sector, prioridad, solicitante, dirección, nombre y estado)",
    ),
    solo_pendientes: bool = Query(default=False),
) -> list[CasoEspecialOut]:
    stmt = select(CasoEspecial).order_by(CasoEspecial.id_caso_especial.desc())
    if clasificacion:
        stmt = stmt.where(CasoEspecial.clasificacion == clasificacion)
    if estado:
        stmt = stmt.where(CasoEspecial.estado == estado)
    if prioridad:
        stmt = stmt.where(CasoEspecial.prioridad == prioridad)
    if tipo_actividad:
        stmt = stmt.where(CasoEspecial.tipo_actividad == tipo_actividad)
    if id_solicitante is not None:
        stmt = stmt.where(CasoEspecial.id_solicitante == id_solicitante)
    if solo_pendientes:
        stmt = stmt.where(CasoEspecial.estado.in_(("ABIERTO", "EN_PROCESO")))
    if q:
        patron = f"%{q.strip()}%"
        # subconsultas sobre el caso asociado (dirección, nombre, sector y avería)
        casos_q = select(Caso.id_caso).where(
            or_(
                Caso.id_averia.ilike(patron),
                Caso.direccion.ilike(patron),
                Caso.nombre_cliente.ilike(patron),
                Caso.telefono.ilike(patron),
            )
        )
        sectores_q = select(Caso.id_caso).join(Sector, Sector.id_sector == Caso.id_sector).where(
            Sector.nombre.ilike(patron)
        )
        solicitantes_q = select(Solicitante.id_solicitante).where(
            or_(Solicitante.nombre.ilike(patron), Solicitante.unidad.ilike(patron))
        )
        stmt = stmt.where(
            or_(
                CasoEspecial.id_caso.in_(casos_q),
                CasoEspecial.id_caso.in_(sectores_q),
                CasoEspecial.id_solicitante.in_(solicitantes_q),
                CasoEspecial.clasificacion.ilike(patron),
                CasoEspecial.tipo_actividad.ilike(patron),
                CasoEspecial.prioridad.ilike(patron),
                CasoEspecial.estado.ilike(patron),
                CasoEspecial.descripcion.ilike(patron),
            )
        )
    return _resumen_especiales(db, list(db.scalars(stmt).all()))


@router.post("/casos-especiales", response_model=CasoEspecialOut,
             status_code=status.HTTP_201_CREATED, summary="Ingresar un caso especial")
def crear_especial(
    datos: CasoEspecialCreate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_escritura),
) -> CasoEspecialOut:
    if datos.id_caso and datos.id_solicitante and datos.crear_solicitante:
        raise HTTPException(
            status_code=422,
            detail="Indique `id_solicitante` o `crear_solicitante`, no ambos",
        )

    id_solicitante = datos.id_solicitante
    if datos.crear_solicitante:
        solicitante = Solicitante(**datos.crear_solicitante.model_dump())
        db.add(solicitante)
        db.flush()
        id_solicitante = solicitante.id_solicitante
    elif id_solicitante and db.get(Solicitante, id_solicitante) is None:
        raise HTTPException(status_code=404, detail="Solicitante no encontrado")

    id_caso = datos.id_caso
    if id_caso:
        if db.get(Caso, id_caso) is None:
            raise HTTPException(status_code=404, detail="Caso no encontrado")
        tiene_id = bool(db.scalar(select(Caso.id_averia).where(Caso.id_caso == id_caso)))
    else:
        caso = _crear_caso_asociado(db, datos, usuario)
        id_caso = caso.id_caso
        tiene_id = True

    especial = CasoEspecial(
        id_caso=id_caso,
        id_solicitante=id_solicitante,
        clasificacion=datos.clasificacion,
        tipo_actividad=datos.tipo_actividad,
        prioridad=datos.prioridad,
        tiene_id_averia=tiene_id,
        descripcion=datos.descripcion,
        requiere_informe=datos.requiere_informe,
        estado="ABIERTO",
    )
    db.add(especial)
    db.commit()
    db.refresh(especial)
    # D-72: se responde con el resumen enriquecido (sector, solicitante,
    # dirección y nombre del caso asociado), igual que el listado.
    return _resumen_especiales(db, [especial])[0]


@router.get("/casos-especiales/{id_caso_especial}", response_model=CasoEspecialOut)
def obtener_especial(
    id_caso_especial: int, db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)
) -> CasoEspecial:
    obj = db.get(CasoEspecial, id_caso_especial)
    if obj is None:
        raise HTTPException(status_code=404, detail="Caso especial no encontrado")
    return obj


@router.patch("/casos-especiales/{id_caso_especial}", response_model=CasoEspecialOut)
def actualizar_especial(
    id_caso_especial: int,
    datos: CasoEspecialUpdate,
    db: Session = Depends(get_db),
    _: Usuario = Depends(_escritura),
) -> CasoEspecial:
    obj = db.get(CasoEspecial, id_caso_especial)
    if obj is None:
        raise HTTPException(status_code=404, detail="Caso especial no encontrado")
    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(obj, campo, valor)
    db.commit()
    db.refresh(obj)
    return obj


def _resumen_especiales(db: Session, lista: list[CasoEspecial]) -> list[CasoEspecialOut]:
    """Añade sector, solicitante y los iconos de estado al listado de especiales."""
    if not lista:
        return []
    ids_caso = [e.id_caso for e in lista if e.id_caso]
    ids_esp = [e.id_caso_especial for e in lista]
    sectores = {s.id_sector: s.nombre for s in db.scalars(select(Sector)).all()}
    casos = {
        c.id_caso: c
        for c in db.scalars(select(Caso).where(Caso.id_caso.in_(ids_caso))).all()
    } if ids_caso else {}
    solicitantes = {
        s.id_solicitante: s for s in db.scalars(select(Solicitante)).all()
    }
    asignados = set(db.scalars(select(DespachoCasos.id_caso).where(
        DespachoCasos.id_caso.in_(ids_caso)))) if ids_caso else set()
    gestion = {
        cid for cid, caso in casos.items()
        if caso.en_gestion_supervisor or caso.estado_actual == "EN_GESTION"
    }
    if ids_caso:
        gestion |= set(db.scalars(select(DespachoCasos.id_caso).where(
            DespachoCasos.id_caso.in_(ids_caso), DespachoCasos.estado == "GESTIONADO")))
    citados = set(db.scalars(select(Cita.id_caso_especial).where(
        Cita.id_caso_especial.in_(ids_esp), Cita.estado.in_(("PROPUESTA", "CONFIRMADA")))))
    if ids_caso:
        citados |= set(db.scalars(select(Cita.id_caso).where(
            Cita.id_caso.in_(ids_caso), Cita.estado.in_(("PROPUESTA", "CONFIRMADA")))))

    salida: list[CasoEspecialOut] = []
    for esp in lista:
        caso = casos.get(esp.id_caso) if esp.id_caso else None
        sol = solicitantes.get(esp.id_solicitante) if esp.id_solicitante else None
        datos = CasoEspecialOut.model_validate(esp).model_dump()
        datos.update(
            sector_nombre=(sectores.get(caso.id_sector) if caso and caso.id_sector else None),
            solicitante_nombre=(sol.nombre if sol else None),
            solicitante_unidad=(sol.unidad if sol else None),
            # D-72: columnas Dirección y Nombre del listado de ESPECIALES.
            direccion=(caso.direccion if caso else None),
            nombre_cliente=(caso.nombre_cliente if caso else None),
            pendiente=esp.estado in ("ABIERTO", "EN_PROCESO"),
            asignado=(esp.id_caso in asignados) if esp.id_caso else False,
            citado=esp.id_caso_especial in citados
            or (esp.id_caso is not None and esp.id_caso in citados),
            gestion=(esp.id_caso in gestion) if esp.id_caso else False,
        )
        salida.append(CasoEspecialOut(**datos))
    return salida

# --------------------------------------------------------------------------- #
# Agenda de citas (RF-12 / RNF-04)
# --------------------------------------------------------------------------- #
def _duracion(db: Session) -> tuple[int, tuple[str, ...]]:
    config = cargar_config(db)
    duracion = int(config.get("agenda.duracion_minutos") or DURACION_POR_DEFECTO)
    estados = config.get("agenda.estados_bloqueantes") or list(ESTADOS_BLOQUEANTES_POR_DEFECTO)
    return duracion, tuple(estados)


def _validar_solape(db: Session, id_cuadrilla: int | None, fecha_hora: datetime,
                    id_excluir: int | None = None) -> None:
    if id_cuadrilla is None:
        return
    duracion, bloqueantes = _duracion(db)
    fin = fecha_hora + timedelta(minutes=duracion)
    condicion = [
        Cita.id_cuadrilla == id_cuadrilla,
        Cita.estado.in_(bloqueantes),
        Cita.fecha_hora < fin,
        Cita.fecha_hora + func.make_interval(0, 0, 0, 0, 0, duracion) > fecha_hora,
    ]
    if id_excluir is not None:
        condicion.append(Cita.id_cita != id_excluir)
    choque = db.scalar(select(Cita).where(*condicion).limit(1))
    if choque:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(f"La cuadrilla ya tiene una cita a las "
                    f"{choque.fecha_hora.isoformat()} (duración {duracion} min)"),
        )


@router.get("/citas", response_model=list[CitaOut], summary="Agenda de citas")
def listar_citas(
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
    desde: datetime | None = None,
    hasta: datetime | None = None,
    id_cuadrilla: int | None = None,
    estado: str | None = None,
    tipo_caso: str | None = Query(default=None, description="Tipo del caso asociado (D-72)"),
    categoria: str | None = Query(default=None, description="Clase del caso asociado (D-72)"),
) -> list[Cita]:
    stmt = select(Cita).order_by(Cita.fecha_hora)
    if desde:
        stmt = stmt.where(Cita.fecha_hora >= desde)
    if hasta:
        stmt = stmt.where(Cita.fecha_hora <= hasta)
    if id_cuadrilla:
        stmt = stmt.where(Cita.id_cuadrilla == id_cuadrilla)
    if estado:
        stmt = stmt.where(Cita.estado == estado)
    # D-72: el calendario puede filtrarse por Tipo y Clase del caso asociado.
    if tipo_caso or categoria:
        stmt = stmt.outerjoin(Caso, Caso.id_caso == Cita.id_caso)
        if tipo_caso:
            stmt = stmt.where(Caso.tipo_caso == tipo_caso)
        if categoria:
            stmt = stmt.where(Caso.categoria == categoria)
    return list(db.scalars(stmt).unique().all())


@router.post("/citas", response_model=CitaOut, status_code=status.HTTP_201_CREATED,
             summary="Agendar una cita (sin solapamiento)")
def crear_cita(
    datos: CitaCreate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_escritura),
) -> Cita:
    if datos.id_caso is None and datos.id_caso_especial is None:
        raise HTTPException(status_code=422, detail="La cita requiere `id_caso` o `id_caso_especial`")
    if datos.id_caso and db.get(Caso, datos.id_caso) is None:
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    if datos.id_caso_especial and db.get(CasoEspecial, datos.id_caso_especial) is None:
        raise HTTPException(status_code=404, detail="Caso especial no encontrado")
    if datos.id_cuadrilla and db.get(Cuadrilla, datos.id_cuadrilla) is None:
        raise HTTPException(status_code=404, detail="Cuadrilla no encontrada")

    if not datos.permitir_solape:
        _validar_solape(db, datos.id_cuadrilla, datos.fecha_hora)
    elif usuario.rol is None or usuario.rol.codigo != ROL_SUPER:
        raise HTTPException(status_code=403, detail="Solo el Super Usuario puede forzar solapamientos")

    cita = Cita(**datos.model_dump(exclude={"permitir_solape"}), creado_por=usuario.p00)
    db.add(cita)
    db.commit()
    db.refresh(cita)
    return cita


@router.patch("/citas/{id_cita}", response_model=CitaOut)
def actualizar_cita(
    id_cita: int,
    datos: CitaUpdate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_escritura),
) -> Cita:
    cita = db.get(Cita, id_cita)
    if cita is None:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    cambios = datos.model_dump(exclude_unset=True)
    permitir = cambios.pop("permitir_solape", False)
    if "fecha_hora" in cambios or "id_cuadrilla" in cambios:
        nueva_fecha = cambios.get("fecha_hora", cita.fecha_hora)
        nueva_cuadrilla = cambios.get("id_cuadrilla", cita.id_cuadrilla)
        if not permitir:
            _validar_solape(db, nueva_cuadrilla, nueva_fecha, id_excluir=id_cita)
        elif usuario.rol is None or usuario.rol.codigo != ROL_SUPER:
            raise HTTPException(status_code=403, detail="Solo el Super Usuario puede forzar solapamientos")
    for campo, valor in cambios.items():
        setattr(cita, campo, valor)
    db.commit()
    db.refresh(cita)
    return cita


@router.delete("/citas/{id_cita}", status_code=status.HTTP_204_NO_CONTENT)
def cancelar_cita(
    id_cita: int, db: Session = Depends(get_db), _: Usuario = Depends(_escritura)
) -> None:
    cita = db.get(Cita, id_cita)
    if cita is None:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    cita.estado = "CANCELADA"
    db.commit()


# --------------------------------------------------------------------------- #
# Seguimiento (RF-34)
# --------------------------------------------------------------------------- #
@router.get("/seguimiento", response_model=list[SeguimientoOut], summary="Casos derivados a otras colas")
def listar_seguimiento(
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
    id_caso: int | None = None,
    estado: str | None = None,
    instancia_destino: str | None = None,
) -> list[Seguimiento]:
    stmt = select(Seguimiento).order_by(Seguimiento.id_seguimiento.desc())
    if id_caso:
        stmt = stmt.where(Seguimiento.id_caso == id_caso)
    if estado:
        stmt = stmt.where(Seguimiento.estado == estado)
    if instancia_destino:
        stmt = stmt.where(Seguimiento.instancia_destino.ilike(f"%{instancia_destino}%"))
    return list(db.scalars(stmt).all())


@router.post("/seguimiento", response_model=SeguimientoOut, status_code=status.HTTP_201_CREATED,
             summary="Derivar un caso a otra instancia")
def crear_seguimiento(
    datos: SeguimientoCreate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_escritura),
) -> Seguimiento:
    caso = db.get(Caso, datos.id_caso)
    if caso is None:
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    obj = Seguimiento(**datos.model_dump(), usuario=usuario.p00)
    db.add(obj)
    # El caso queda enrutado a otra instancia: no vuelve al despacho de calle (RF-34/RF-25)
    if datos.estado == "EN_COLA":
        caso.estado_actual = "ENRUTADO"
        if caso.id_sector is None:
            caso.en_gestion_supervisor = False
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/seguimiento/{id_seguimiento}", response_model=SeguimientoOut)
def actualizar_seguimiento(
    id_seguimiento: int,
    datos: SeguimientoUpdate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_escritura),
) -> Seguimiento:
    obj = db.get(Seguimiento, id_seguimiento)
    if obj is None:
        raise HTTPException(status_code=404, detail="Seguimiento no encontrado")
    cambios = datos.model_dump(exclude_unset=True)
    for campo, valor in cambios.items():
        setattr(obj, campo, valor)
    if datos.estado == "DEVUELTO":
        caso = db.get(Caso, obj.id_caso)
        if caso and caso.estado_actual == "ENRUTADO":
            caso.estado_actual = "NUEVO"
            caso.en_gestion_supervisor = False
        obj.fecha_retorno = obj.fecha_retorno or datetime.now(UTC)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/seguimiento/{id_seguimiento}", response_model=SeguimientoOut)
def obtener_seguimiento(
    id_seguimiento: int, db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)
) -> Seguimiento:
    obj = db.get(Seguimiento, id_seguimiento)
    if obj is None:
        raise HTTPException(status_code=404, detail="Seguimiento no encontrado")
    return obj

