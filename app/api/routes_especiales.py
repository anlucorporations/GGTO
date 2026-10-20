"""SEGUIMIENTO, EMPRESAS, REFERIDOS y AGENDA — RF-06, RF-12, RF-34, RF-35, RF-36 / RNF-04."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, func, or_, select, text
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..models import (
    Caso,
    Cita,
    Cuadrilla,
    CuadrillaSectorDia,
    Despacho,
    DespachoCasos,
    FallaMasiva,
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
    SolicitanteUpdate,
)
from ..services import clasificacion, pagos
from ..services.consultas import cargar_config, cargar_patrones, resolver_central
from ..services.sectorizacion import asignar_sector
from ..services.tiempo import hoy_operativo
from .deps import ROL_SUPER, _especial_alta, get_current_user, require_roles

router = APIRouter(prefix="/api/v1", tags=["seguimiento y especiales"])
_escritura = require_roles("ADMIN", "SUPERVISOR")
# D-112: el TÉCNICO agenda desde la APK (RF-APK-06/RF-12); sin esto, «Agendar»
# recibía un 403 y la cita se quedaba en la cola del dispositivo sin aplicarse.
_campo = require_roles("ADMIN", "SUPERVISOR", "TECNICO")

DURACION_POR_DEFECTO = 60
ESTADOS_BLOQUEANTES_POR_DEFECTO = ("PROPUESTA", "CONFIRMADA")


# --------------------------------------------------------------------------- #
# Personal externo: solicitantes de casos referidos y personal del CRASS (D-99)
# --------------------------------------------------------------------------- #
@router.get("/solicitantes", response_model=list[SolicitanteOut])
def listar_solicitantes(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
    tipo: str | None = Query(default=None, pattern="^(SOLICITANTE|CRASS|OTRO)$"),
    q: str | None = Query(default=None, description="Busca en nombre, unidad y documento"),
    solo_activos: bool = Query(default=True),
) -> list[Solicitante]:
    """Catálogo de personal externo (D-99 · RF-63).

    Es el desplegable del **validador del CRASS** al cerrar una masiva y el del
    **solicitante** al dar de alta un caso referido.
    """
    stmt = select(Solicitante).order_by(Solicitante.unidad, Solicitante.nombre)
    if usuario.rol.codigo != "SUPER":
        central = resolver_central(db, None, cargar_config(db), usuario)
        stmt = stmt.where(or_(Solicitante.id_central.is_(None),
                              Solicitante.id_central == central.id_central))
    if tipo:
        stmt = stmt.where(Solicitante.tipo == tipo)
    if solo_activos:
        stmt = stmt.where(Solicitante.activo.is_(True))
    if q:
        patron = f"%{q.strip()}%"
        stmt = stmt.where(or_(
            Solicitante.nombre.ilike(patron),
            Solicitante.unidad.ilike(patron),
            Solicitante.documento.ilike(patron),
            Solicitante.contacto.ilike(patron),
        ))
    return list(db.scalars(stmt).all())


@router.post("/solicitantes", response_model=SolicitanteOut, status_code=status.HTTP_201_CREATED)
def crear_solicitante(
    datos: SolicitanteCreate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_escritura),
) -> Solicitante:
    valores = datos.model_dump()
    if valores.get("id_central") is None:
        valores["id_central"] = resolver_central(
            db, None, cargar_config(db), usuario
        ).id_central
    obj = Solicitante(**valores)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/solicitantes/{id_solicitante}", response_model=SolicitanteOut)
def actualizar_solicitante(
    id_solicitante: int,
    datos: SolicitanteUpdate,
    db: Session = Depends(get_db),
    _: Usuario = Depends(_escritura),
) -> Solicitante:
    """Edita una ficha del catálogo de personal externo (D-99)."""
    obj = db.get(Solicitante, id_solicitante)
    if obj is None:
        raise HTTPException(status_code=404, detail="Registro de personal externo no encontrado")
    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(obj, campo, valor)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/solicitantes/{id_solicitante}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_solicitante(
    id_solicitante: int,
    db: Session = Depends(get_db),
    _: Usuario = Depends(_escritura),
) -> None:
    """Da de baja una ficha del catálogo.

    Si ya está referenciada por un caso especial o por una masiva cerrada se
    **desactiva** en lugar de borrarse, para no romper la trazabilidad (D-99).
    """
    obj = db.get(Solicitante, id_solicitante)
    if obj is None:
        raise HTTPException(status_code=404, detail="Registro de personal externo no encontrado")
    en_uso = bool(db.scalar(
        select(func.count()).select_from(CasoEspecial).where(
            CasoEspecial.id_solicitante == id_solicitante
        )
    )) or bool(db.scalar(
        select(func.count()).select_from(FallaMasiva).where(
            FallaMasiva.id_validador_crass == id_solicitante
        )
    ))
    if en_uso:
        obj.activo = False
    else:
        db.delete(obj)
    db.commit()


# --------------------------------------------------------------------------- #
# Casos especiales (EMPRESAS / REFERIDOS / GOBIERNOS)
# --------------------------------------------------------------------------- #
def _crear_caso_asociado(db: Session, datos: CasoEspecialCreate, usuario: Usuario) -> Caso:
    config = cargar_config(db)
    central = resolver_central(db, None, config, usuario)
    id_averia = (datos.id_averia or "").strip() or db.execute(
        text("SELECT generar_id_averia_ref(:c)"), {"c": central.id_central}
    ).scalar_one()
    if db.scalar(select(Caso.id_caso).where(Caso.id_averia == id_averia)):
        raise HTTPException(status_code=409, detail=f"Ya existe un caso con id_averia {id_averia}")

    # D-89/D-90 + RN-AL-01: el teléfono del alta **es** el identificador de pago
    # (70*) del caso; el **teléfono de contacto** va aparte y se registra como
    # `contacto_cliente` (y en `informacion`, como en el resto del sistema).
    patron = pagos.compilar_patron(config)
    numero = pagos.normalizar_numero(datos.telefono)
    if not pagos.es_identificador_pago(numero, patron):
        raise HTTPException(
            status_code=422,
            detail="El teléfono debe ser el identificador de pago (70*) del caso",
        )
    telefono = numero
    id_pago = pagos.resolver_identificador(
        db, numero, central.id_central, datos.nombre_cliente, datos.direccion
    )
    contacto = pagos.normalizar_numero(datos.contacto_cliente) or None
    informacion = pagos.componer_informacion(
        datos.descripcion, [contacto] if contacto else []
    )

    id_sector = asignar_sector(datos.direccion, cargar_patrones(db, central.id_central))
    # D-122 · H-04: sin sector el caso no entra en ningún despacho por sector y la
    # APK nunca lo recibe. Se exige (o se indica explícitamente).
    if datos.id_sector is not None:
        sector = db.get(Sector, datos.id_sector)
        if sector is None or sector.id_central != central.id_central:
            raise HTTPException(
                status_code=422,
                detail="El sector indicado no existe en esta central",
            )
        id_sector = sector.id_sector
    if id_sector is None:
        raise HTTPException(
            status_code=422,
            detail=(
                "La dirección no coincide con ningún sector de la central: corrija "
                "la dirección o indique `id_sector`. Sin sector, el caso especial no "
                "se puede despachar a ninguna cuadrilla y no llega a la APK."
            ),
        )
    caso = Caso(
        id_central=central.id_central,
        id_averia=id_averia,
        origen="MANUAL",
        tipo_caso="CONSTRUCCION" if datos.tipo_actividad == "CONSTRUCCION" else "REPARACION",
        categoria=datos.clasificacion,
        estado_actual="NUEVO",
        id_sector=id_sector,
        id_pago=id_pago,
        nombre_cliente=datos.nombre_cliente,
        telefono=telefono,
        contacto_cliente=contacto,
        direccion=datos.direccion,
        tipo_problema=datos.tipo_problema,
        informacion=informacion,
        codigo_central=central.codigo_central,
        nombre_central=central.nombre_central,
        creado_por=usuario.p00,
        ayudantes=[],
    )
    db.add(caso)
    db.flush()
    # D-90: si el especial es una REPARACIÓN sin 70* o sin avería real, la regla la
    # convierte en REFERIDO (el trigger de la base ya ajusta el `tipo_caso`).
    clasificacion.aplicar_regla_reparacion(db, caso, "ALTA_ESPECIAL", usuario.p00)
    return caso


def estado_efectivo_sql():
    """Expresión SQL del estado **visible** del especial (D-120).

    Reproduce en SQL `clasificacion.estado_especial_visible`: el estado del caso
    manda —caso cerrado → `CERRADO`; caso con gestión → `EN_PROCESO`— salvo que la
    ficha ya esté `ATENDIDO`/`CERRADO`, que no se reabre sola.
    """
    return case(
        (Caso.estado_actual.in_(("CERRADO", "CANCELADO", "ENRUTADO")), "CERRADO"),
        (CasoEspecial.estado.in_(("ATENDIDO", "CERRADO")), CasoEspecial.estado),
        (
            Caso.estado_actual.in_(("CONTACTADO", "CITADO", "EN_GESTION", "DIFERIDO")),
            "EN_PROCESO",
        ),
        else_=CasoEspecial.estado,
    )


@router.get("/casos-especiales", response_model=list[CasoEspecialOut])
def listar_especiales(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
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
    stmt = (
        select(CasoEspecial)
        .outerjoin(Caso, Caso.id_caso == CasoEspecial.id_caso)
        .order_by(CasoEspecial.id_caso_especial.desc())
    )
    if usuario.rol.codigo != "SUPER":
        central = resolver_central(db, None, cargar_config(db), usuario)
        stmt = stmt.where(
            CasoEspecial.id_caso.in_(
                select(Caso.id_caso).where(Caso.id_central == central.id_central)
            )
        )
    if clasificacion:
        stmt = stmt.where(CasoEspecial.clasificacion == clasificacion)
    # D-120: los filtros de estado se aplican sobre el estado **efectivo** (el
    # caso manda). Antes leían la columna cruda y un referido con el caso cerrado
    # seguía apareciendo en «Solo pendientes».
    if estado:
        stmt = stmt.where(estado_efectivo_sql() == estado)
    if prioridad:
        stmt = stmt.where(CasoEspecial.prioridad == prioridad)
    if tipo_actividad:
        stmt = stmt.where(CasoEspecial.tipo_actividad == tipo_actividad)
    if id_solicitante is not None:
        stmt = stmt.where(CasoEspecial.id_solicitante == id_solicitante)
    if solo_pendientes:
        stmt = stmt.where(estado_efectivo_sql().in_(("ABIERTO", "EN_PROCESO")))
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


def _aviso_de_despacho(db: Session, caso: Caso) -> str | None:
    """Aviso del alta: ¿el especial podrá llegar hoy a una cuadrilla? (D-122).

    - Si la jornada de hoy ya está **publicada** (o cerrada), el caso no entra en
      el reparto de hoy: se incluirá en la próxima jornada o habrá que asignarlo a
      mano desde DESPACHO.
    - Si su sector no tiene cuadrilla asignada hoy, tampoco.
    """
    if caso.id_sector is None:
        return None
    hoy = hoy_operativo()
    publicados = db.scalar(
        select(func.count())
        .select_from(Despacho)
        .where(
            Despacho.id_central == caso.id_central,
            Despacho.fecha == hoy,
            Despacho.estado.in_(("PUBLICADO", "CERRADO")),
        )
    )
    if publicados:
        return (
            "La jornada de hoy ya está publicada: el caso especial se incluirá en el "
            "despacho de la próxima jornada. Si debe atenderse hoy, asígnelo a una "
            "cuadrilla desde DESPACHO."
        )
    cubierto = db.scalar(
        select(CuadrillaSectorDia.id_cuadrilla)
        .where(
            CuadrillaSectorDia.id_sector == caso.id_sector,
            CuadrillaSectorDia.fecha == hoy,
        )
        .limit(1)
    )
    if cubierto is None:
        return (
            "Su sector no tiene cuadrilla asignada en la jornada de hoy: el caso se "
            "despachará cuando el supervisor asigne el sector a una cuadrilla."
        )
    return None


@router.post("/casos-especiales", response_model=CasoEspecialOut,
             status_code=status.HTTP_201_CREATED, summary="Ingresar un caso especial")
def crear_especial(
    datos: CasoEspecialCreate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_especial_alta),
) -> CasoEspecialOut:
    # RN-AL-01: los datos del solicitante son obligatorios y son **uno solo**
    # (el esquema ya exige `crear_solicitante` o `id_solicitante`).
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
        caso = db.get(Caso, id_caso)
        if caso is None:
            raise HTTPException(status_code=404, detail="Caso no encontrado")
        resolver_central(db, caso.id_central, cargar_config(db), usuario)
    else:
        caso = _crear_caso_asociado(db, datos, usuario)
        id_caso = caso.id_caso
    # D-90: `tiene_id_averia` refleja la realidad (el id sintético `REF-…` no cuenta).
    tiene_id = clasificacion.tiene_id_averia_real(caso)

    # D-90: la ficha del especial es **idempotente** (una sola por caso): si ya
    # existe —p. ej. la creó la regla de reclasificación— se actualiza.
    especial = db.scalar(select(CasoEspecial).where(CasoEspecial.id_caso == id_caso))
    if especial is None:
        especial = CasoEspecial(id_caso=id_caso, estado="ABIERTO")
        db.add(especial)
    especial.id_solicitante = id_solicitante
    especial.clasificacion = datos.clasificacion
    especial.tipo_actividad = datos.tipo_actividad
    especial.prioridad = datos.prioridad
    especial.tiene_id_averia = tiene_id
    especial.descripcion = datos.descripcion
    especial.requiere_informe = datos.requiere_informe
    db.commit()
    db.refresh(especial)
    # D-72: se responde con el resumen enriquecido (sector, solicitante,
    # dirección y nombre del caso asociado), igual que el listado.
    resumen = _resumen_especiales(db, [especial])[0]
    # D-122 · H-04: se dice si el especial podrá despacharse hoy.
    aviso = _aviso_de_despacho(db, caso)
    if aviso:
        resumen.aviso = aviso
    return resumen


@router.get("/casos-especiales/{id_caso_especial}", response_model=CasoEspecialOut)
def obtener_especial(
    id_caso_especial: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
) -> CasoEspecial:
    obj = db.get(CasoEspecial, id_caso_especial)
    if obj is None:
        raise HTTPException(status_code=404, detail="Caso especial no encontrado")
    if obj.id_caso is not None:
        caso = db.get(Caso, obj.id_caso)
        if caso is None:
            raise HTTPException(status_code=404, detail="Caso asociado no encontrado")
        resolver_central(db, caso.id_central, cargar_config(db), usuario)
    return obj


@router.patch("/casos-especiales/{id_caso_especial}", response_model=CasoEspecialOut)
def actualizar_especial(
    id_caso_especial: int,
    datos: CasoEspecialUpdate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_escritura),
) -> CasoEspecial:
    obj = db.get(CasoEspecial, id_caso_especial)
    if obj is None:
        raise HTTPException(status_code=404, detail="Caso especial no encontrado")
    if obj.id_caso is not None:
        caso = db.get(Caso, obj.id_caso)
        if caso is None:
            raise HTTPException(status_code=404, detail="Caso asociado no encontrado")
        resolver_central(db, caso.id_central, cargar_config(db), usuario)

    cambios = datos.model_dump(exclude_unset=True)
    # D-133 · H-16: `requiere_informe` deja de ser decorativo. Un especial que lo
    # requiere no pasa a ATENDIDO/CERRADO sin un informe de atención.
    estado_destino = str(cambios.get("estado") or obj.estado or "").upper()
    requiere = bool(cambios.get("requiere_informe", obj.requiere_informe))
    informe = str(cambios.get("informe", obj.informe) or "").strip()
    if requiere and estado_destino in clasificacion.ESTADOS_ESPECIAL_FINALES and len(informe) < 20:
        raise HTTPException(
            status_code=422,
            detail=(
                "Este caso especial requiere un informe de atención de al menos "
                "20 caracteres para pasar a "
                f"{estado_destino}: complete el campo `informe`."
            ),
        )
    for campo, valor in cambios.items():
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

    # D-80: cuadrilla del último despacho del caso asociado, con la misma regla
    # que el listado de CASOS (D-78): `fecha` e `id_despacho` descendentes.
    ultima_cuadrilla: dict[int, int] = {}
    if ids_caso:
        rn = (
            func.row_number()
            .over(
                partition_by=DespachoCasos.id_caso,
                order_by=(Despacho.fecha.desc(), Despacho.id_despacho.desc()),
            )
            .label("rn")
        )
        por_caso = (
            select(
                DespachoCasos.id_caso.label("id_caso"),
                Despacho.id_cuadrilla.label("id_cuadrilla"),
                rn,
            )
            .join(Despacho, Despacho.id_despacho == DespachoCasos.id_despacho)
            .where(DespachoCasos.id_caso.in_(ids_caso))
            .subquery()
        )
        ultima_cuadrilla = {
            fila.id_caso: fila.id_cuadrilla
            for fila in db.execute(
                select(por_caso.c.id_caso, por_caso.c.id_cuadrilla).where(por_caso.c.rn == 1)
            ).all()
        }
    cuadrillas = {c.id_cuadrilla: c for c in db.scalars(select(Cuadrilla)).all()}

    salida: list[CasoEspecialOut] = []
    for esp in lista:
        caso = casos.get(esp.id_caso) if esp.id_caso else None
        sol = solicitantes.get(esp.id_solicitante) if esp.id_solicitante else None
        id_cuadrilla = ultima_cuadrilla.get(esp.id_caso) if esp.id_caso else None
        cuadrilla = cuadrillas.get(id_cuadrilla) if id_cuadrilla else None
        datos = CasoEspecialOut.model_validate(esp).model_dump()
        # D-120: el caso manda. Si el técnico lo cerró (o lo enrutó/canceló), el
        # especial se muestra CERRADO aunque su fila siga en ABIERTO; si ya hubo
        # gestión, EN_PROCESO. Así la lista de ESPECIALES de la web y de la APK
        # coincide con la realidad del trabajo de campo.
        estado_visible = clasificacion.estado_especial_visible(
            esp.estado, caso.estado_actual if caso else None
        )
        datos.update(
            estado=estado_visible,
            sector_nombre=(sectores.get(caso.id_sector) if caso and caso.id_sector else None),
            solicitante_nombre=(sol.nombre if sol else None),
            solicitante_unidad=(sol.unidad if sol else None),
            # D-72: columnas Dirección y Nombre del listado de ESPECIALES.
            direccion=(caso.direccion if caso else None),
            nombre_cliente=(caso.nombre_cliente if caso else None),
            # D-103: el FAT del caso asociado acompaña al sector en el listado.
            fat=(caso.fat if caso else None),
            # D-120: el caso asociado, para abrirlo o cerrarlo desde el especial.
            id_averia=(caso.id_averia if caso else None),
            estado_caso=(caso.estado_actual if caso else None),
            # RN-AL-01: contacto, identificador de pago y tipo de problema del caso.
            contacto_cliente=(caso.contacto_cliente if caso else None),
            telefono=(caso.telefono if caso else None),
            tipo_problema=(caso.tipo_problema if caso else None),
            pendiente=estado_visible in ("ABIERTO", "EN_PROCESO"),
            asignado=(esp.id_caso in asignados) if esp.id_caso else False,
            citado=esp.id_caso_especial in citados
            or (esp.id_caso is not None and esp.id_caso in citados),
            gestion=(esp.id_caso in gestion) if esp.id_caso else False,
            # D-80: cuadrilla del último despacho (icono con color en el listado).
            id_cuadrilla=id_cuadrilla,
            cuadrilla_codigo=(cuadrilla.codigo if cuadrilla else None),
            cuadrilla_nombre=(cuadrilla.nombre if cuadrilla else None),
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
    usuario: Usuario = Depends(_campo),
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

