"""PANEL y CASOS — RF-30, RF-31, RF-32, RF-33 y bitácora RNF-12."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select, text
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..models import (
    Actividad,
    Auditoria,
    Caso,
    CasoEstadoHist,
    CatalogoMetodo,
    Cita,
    Cuadrilla,
    Despacho,
    DespachoCasos,
    Evidencia,
    Sector,
    Seguimiento,
    Usuario,
)
from ..schemas.casos import (
    CasoEstadoHistOut,
    CasoGestionEstado,
    CasoManualCreate,
    CasoOut,
    CasoRelacionado,
    CasoUpdate,
    CierreCaso,
    CitaRapida,
    ContactoUpdate,
    EnrutadoCaso,
    NoContestaIn,
    PaginaCasos,
    ResolucionOut,
)
from ..services.consultas import cargar_config, cargar_patrones, resolver_central
from ..services.sectorizacion import asignar_sector
from .deps import get_current_user, require_roles

router = APIRouter(prefix="/api/v1/casos", tags=["casos"])

# Edición completa de casos: ADMIN y SUPERVISOR (SUPER tiene acceso total).
_escritura = require_roles("ADMIN", "SUPERVISOR")
# Gestión del estado del caso: se suma el rol TECNICO (D-68).
_gestion = require_roles("ADMIN", "SUPERVISOR", "TECNICO")


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

    # D-78: cuadrilla del último despacho que incluyó el caso (misma regla que el
    # filtro «Cuadrilla» de D-72: `fecha` e `id_despacho` descendentes).
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
        .where(DespachoCasos.id_caso.in_(ids))
        .subquery()
    )
    ultima = {
        fila.id_caso: fila.id_cuadrilla
        for fila in db.execute(
            select(por_caso.c.id_caso, por_caso.c.id_cuadrilla).where(por_caso.c.rn == 1)
        ).all()
    }
    cuadrillas = {c.id_cuadrilla: c for c in db.scalars(select(Cuadrilla)).all()}

    salida: list[CasoOut] = []
    for caso in casos:
        id_cuadrilla = ultima.get(caso.id_caso)
        cuadrilla = cuadrillas.get(id_cuadrilla) if id_cuadrilla else None
        datos = CasoOut.model_validate(caso).model_dump()
        datos.update(
            sector_nombre=(sectores.get(caso.id_sector) if caso.id_sector else None),
            pendiente=caso.id_caso in pendientes,
            asignado=caso.id_caso in asignados,
            citado=caso.id_caso in citados,
            gestion=caso.id_caso in gestion,
            id_cuadrilla=id_cuadrilla,
            cuadrilla_codigo=(cuadrilla.codigo if cuadrilla else None),
            cuadrilla_nombre=(cuadrilla.nombre if cuadrilla else None),
        )
        salida.append(CasoOut(**datos))
    return salida


# --------------------------------------------------------------------------- #
# Listado con filtros (RF-33)
# --------------------------------------------------------------------------- #
def _casos_de_cuadrilla(id_cuadrilla: int):
    """Subconsulta: id de los casos cuyo **último despacho** es de la cuadrilla.

    Ciclo D-72: el filtro «Cuadrilla» de CASOS toma la cuadrilla de origen del
    despacho más reciente (`fecha` y `id_despacho` descendentes) que incluyó el
    caso. Si el caso no ha sido despachado nunca, no pertenece a ninguna.
    """
    rn = (
        func.row_number()
        .over(
            partition_by=DespachoCasos.id_caso,
            order_by=(Despacho.fecha.desc(), Despacho.id_despacho.desc()),
        )
        .label("rn")
    )
    por_caso = (
        select(DespachoCasos.id_caso.label("id_caso"), Despacho.id_cuadrilla.label("id_cuadrilla"), rn)
        .join(Despacho, Despacho.id_despacho == DespachoCasos.id_despacho)
        .subquery()
    )
    return select(por_caso.c.id_caso).where(
        por_caso.c.id_cuadrilla == id_cuadrilla, por_caso.c.rn == 1
    )


@router.get("", response_model=PaginaCasos, summary="Listado de casos con filtros")
def listar(
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
    q: str | None = Query(
        default=None,
        description="Texto libre: busca en todos los renglones de la tabla "
        "(avería, tipo, clase, sector, dirección, nombre y estado)",
    ),
    id_averia: str | None = None,
    telefono: str | None = None,
    id_central: int | None = None,
    id_sector: int | None = None,
    id_cuadrilla: int | None = Query(
        default=None,
        description="Cuadrilla del último despacho que incluyó el caso (D-72)",
    ),
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
        sectores_q = select(Sector.id_sector).where(Sector.nombre.ilike(patron))
        condiciones.append(
            or_(
                Caso.id_averia.ilike(patron),
                Caso.telefono.ilike(patron),
                Caso.nombre_cliente.ilike(patron),
                Caso.direccion.ilike(patron),
                Caso.tipo_caso.ilike(patron),
                Caso.categoria.ilike(patron),
                Caso.estado_actual.ilike(patron),
                Caso.id_sector.in_(sectores_q),
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
    if id_cuadrilla is not None:
        condiciones.append(Caso.id_caso.in_(_casos_de_cuadrilla(id_cuadrilla)))
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


@router.post("/{id_caso}/estado", response_model=CasoOut,
             summary="Cambiar el estado del caso desde su gestión")
def cambiar_estado(
    id_caso: int,
    datos: CasoGestionEstado,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_gestion),
) -> CasoOut:
    """Movimiento de estado con bitácora (RF-31 / RNF-12).

    A diferencia del `PATCH /casos/{id}` (edición completa), este endpoint lo
    puede usar también el **rol TECNICO**: es la gestión del caso que atiende
    (D-68). No permite modificar ningún otro campo.
    """
    caso = _o_404(db, id_caso)
    if datos.estado_actual == caso.estado_actual:
        raise HTTPException(status_code=409, detail="El caso ya está en ese estado")
    _registrar_estado(db, caso, datos.estado_actual, datos.motivo_estado, usuario.p00)
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


# --------------------------------------------------------------------------- #
# Resolución del caso: cierre, cita y enrutado (D-70)
# Se apoya en las tablas ya existentes `actividad` / `evidencia` / `cita` /
# `seguimiento`, y en el catálogo `catalogo_metodo` (dominio CIERRE: IVR/COS/SACAS).
# --------------------------------------------------------------------------- #
def _metodo_cierre(db: Session, codigo: str) -> CatalogoMetodo:
    metodo = db.scalar(
        select(CatalogoMetodo).where(
            CatalogoMetodo.dominio == "CIERRE", CatalogoMetodo.codigo == codigo
        )
    )
    if metodo is None:
        raise HTTPException(status_code=404, detail=f"El modo de cierre {codigo} no está en el catálogo")
    return metodo


@router.post("/{id_caso}/cierre", response_model=ResolucionOut,
             summary="Cerrar el caso con modo, descripción y evidencias")
def cerrar_caso(
    id_caso: int,
    datos: CierreCaso,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_escritura),
) -> ResolucionOut:
    """Registra la actividad de cierre (tipo CIERRE) y pasa el caso a CERRADO."""
    caso = _o_404(db, id_caso)
    if caso.estado_actual == "CERRADO":
        raise HTTPException(
            status_code=409,
            detail="El caso ya está cerrado; reabra el estado antes de registrar otro cierre",
        )
    metodo = _metodo_cierre(db, datos.modo)

    actividad = Actividad(
        id_caso=caso.id_caso,
        id_usuario=usuario.id_usuario,
        tipo="CIERRE",
        resultado="CERRADO",
        reporte_corto=datos.descripcion,
        id_metodo=metodo.id_metodo,
        id_causa=datos.id_causa,
        fecha_hora=datetime.now(UTC),
        sincronizado=True,
    )
    db.add(actividad)
    db.flush()

    ahora = datetime.now(UTC)
    for indice, serial in enumerate(datos.evidencias, start=1):
        limpio = serial.strip()
        if not limpio:
            continue
        db.add(
            Evidencia(
                id_actividad=actividad.id_actividad,
                tipo="DEMO",
                # El serial debe ser único en toda la tabla: se incluye el id de la
                # actividad para poder cerrar/reabrir el mismo caso varias veces.
                serial_imagen=(
                    f"{caso.id_averia}-A{actividad.id_actividad}-CIERRE-{indice:02d}"[:160]
                ),
                ruta_remota=limpio[:255],
                fecha_hora=ahora,
                origen_camara=False,
            )
        )

    if caso.estado_actual != "CERRADO":
        _registrar_estado(db, caso, "CERRADO", f"Cierre con {datos.modo}", usuario.p00)
    db.commit()
    db.refresh(caso)
    return ResolucionOut(
        accion="CIERRE",
        id_actividad=actividad.id_actividad,
        estado_actual=caso.estado_actual,
        mensaje=f"Caso cerrado con {datos.modo}.",
    )


@router.post("/{id_caso}/cita", response_model=ResolucionOut,
             summary="Agendar una cita desde la ficha del caso")
def agendar_cita(
    id_caso: int,
    datos: CitaRapida,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_escritura),
) -> ResolucionOut:
    """Crea la cita vinculada al caso y deja constancia de la fecha comprometida."""
    caso = _o_404(db, id_caso)
    cita = Cita(
        id_caso=caso.id_caso,
        fecha_hora=datos.fecha_hora,
        tipo=datos.tipo,
        estado="PROPUESTA",
        observacion=datos.observacion,
        creado_por=usuario.p00,
    )
    db.add(cita)
    caso.fecha_cita = datos.fecha_hora
    db.commit()
    db.refresh(caso)
    db.refresh(cita)
    return ResolucionOut(
        accion="CITA",
        id_cita=cita.id_cita,
        estado_actual=caso.estado_actual,
        mensaje=f"Cita agendada para {datos.fecha_hora:%d/%m/%Y %H:%M}.",
    )


@router.post("/{id_caso}/no-contesta", response_model=ResolucionOut,
             summary="«No Contesta»: cita de 1ra visita, CITADO e informado al COS (D-88)")
def no_contesta(
    id_caso: int,
    datos: NoContestaIn | None = None,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_gestion),
) -> ResolucionOut:
    """Compone el «No Contesta» del técnico en **una sola transacción** (RF-APK-12).

    1. El caso pasa a `CITADO` con su bitácora de estado.
    2. Se agenda la cita de **1ra visita** para el día siguiente a las 08:00 (la
       hora la envía la APK, que conoce la zona del dispositivo).
    3. Se registra la actividad de `CONTACTO` con el método `COS` («informado al
       COS», D-88).

    Lo puede ejecutar el **TECNICO** (es gestión del caso que atiende), a
    diferencia del cierre o el enrutado, que exigen ADMIN/SUPERVISOR. La APK lo
    encola si no hay red, de modo que llega íntegro en la CARGA.
    """
    caso = _o_404(db, id_caso)
    if caso.estado_actual in {"CERRADO", "CANCELADO", "ENRUTADO"}:
        raise HTTPException(
            status_code=409,
            detail=f"El caso está {caso.estado_actual}: no admite «No Contesta»",
        )

    metodo = db.scalar(
        select(CatalogoMetodo).where(
            CatalogoMetodo.dominio == "CONTACTO", CatalogoMetodo.codigo == "COS"
        )
    )
    if metodo is None:
        # El catálogo se siembra en `schema.sql`; en producción lo añade la
        # migración D-88. Sin él no se puede dejar constancia del aviso al COS.
        raise HTTPException(
            status_code=409,
            detail="Falta el método CONTACTO/COS en el catálogo (migración D-88 pendiente)",
        )

    ahora = datetime.now(UTC)
    fecha_cita = (datos.fecha_hora if datos else None) or (
        (ahora + timedelta(days=1)).replace(hour=8, minute=0, second=0, microsecond=0)
    )
    observacion = ((datos.observacion if datos else None) or "").strip() or (
        "1ra visita: el cliente no contestó; se informó al COS"
    )

    _registrar_estado(db, caso, "CITADO", "No contesta: 1ra visita", usuario.p00)
    cita = Cita(
        id_caso=caso.id_caso,
        fecha_hora=fecha_cita,
        tipo="ATENCION",
        estado="PROPUESTA",
        observacion=observacion[:500],
        creado_por=usuario.p00,
    )
    db.add(cita)
    caso.fecha_cita = fecha_cita
    db.flush()
    actividad = Actividad(
        id_caso=caso.id_caso,
        id_usuario=usuario.id_usuario,
        tipo="CONTACTO",
        resultado="CONTACTADO",
        reporte_corto=observacion[:200],
        id_metodo=metodo.id_metodo,
        fecha_hora=ahora,
        sincronizado=True,
    )
    db.add(actividad)
    db.commit()
    db.refresh(caso)
    db.refresh(cita)
    db.refresh(actividad)
    return ResolucionOut(
        accion="NO_CONTESTA",
        id_actividad=actividad.id_actividad,
        id_cita=cita.id_cita,
        estado_actual=caso.estado_actual,
        mensaje=(
            f"Caso en CITADO con cita el {fecha_cita:%d/%m/%Y %H:%M} "
            "(1ra visita, informado al COS)."
        ),
    )


@router.patch("/{id_caso}/contacto", response_model=CasoOut,
              summary="Corregir dirección y número de contacto desde el campo (D-88)")
def actualizar_contacto(
    id_caso: int,
    datos: ContactoUpdate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_gestion),
) -> CasoOut:
    """El técnico corrige **solo** la dirección y el teléfono del contacto.

    Queda la traza en `auditoria` (`datos_antes` / `datos_despues`) y, si cambia
    la dirección, se recalcula el sector como en la edición de gestión (RF-23).
    Cualquier otro campo sigue reservado al PATCH de ADMIN/SUPERVISOR.
    """
    caso = _o_404(db, id_caso)
    cambios = datos.model_dump(exclude_unset=True, exclude_none=True)
    if not cambios:
        raise HTTPException(
            status_code=422, detail="Indique la dirección o el número de contacto"
        )
    if caso.estado_actual in {"CERRADO", "CANCELADO", "ENRUTADO"}:
        raise HTTPException(
            status_code=409,
            detail=f"El caso está {caso.estado_actual}: no admite cambios de contacto",
        )

    antes = {campo: getattr(caso, campo) for campo in cambios}
    for campo, valor in cambios.items():
        setattr(caso, campo, valor)
    if "direccion" in cambios:
        caso.id_sector = _sectorizar(db, caso.id_central, caso.direccion)
    db.add(
        Auditoria(
            usuario=usuario.p00,
            accion="CONTACTO_CAMPO",
            entidad="caso",
            id_entidad=str(caso.id_caso),
            datos_antes=antes,
            datos_despues={campo: getattr(caso, campo) for campo in cambios},
        )
    )
    db.commit()
    db.refresh(caso)
    return _resumen(db, [caso])[0]


@router.post("/{id_caso}/enrutado", response_model=ResolucionOut,
             summary="Enrutar el caso a otra instancia")
def enrutar_caso(
    id_caso: int,
    datos: EnrutadoCaso,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_escritura),
) -> ResolucionOut:
    """Registra la actividad de enrutado, el seguimiento y pasa el caso a ENRUTADO."""
    caso = _o_404(db, id_caso)
    actividad = Actividad(
        id_caso=caso.id_caso,
        id_usuario=usuario.id_usuario,
        tipo="ENRUTE",
        resultado="ENRUTADO",
        reporte_corto=datos.motivo,
        id_metodo=datos.id_metodo,
        fecha_hora=datetime.now(UTC),
        sincronizado=True,
    )
    db.add(actividad)
    db.flush()

    seguimiento = Seguimiento(
        id_caso=caso.id_caso,
        instancia_destino=datos.destino,
        motivo=datos.motivo,
        estado="EN_COLA",
    )
    db.add(seguimiento)

    if caso.estado_actual != "ENRUTADO":
        _registrar_estado(db, caso, "ENRUTADO", f"Enrutado a {datos.destino}", usuario.p00)
    db.commit()
    db.refresh(caso)
    return ResolucionOut(
        accion="ENRUTE",
        id_actividad=actividad.id_actividad,
        id_seguimiento=seguimiento.id_seguimiento,
        estado_actual=caso.estado_actual,
        mensaje=f"Caso enrutado a {datos.destino}.",
    )


@router.get("/{id_caso}/relacionados", response_model=list[CasoRelacionado],
            summary="Antecedentes del mismo teléfono o dirección")
def relacionados(
    id_caso: int,
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
    limite: int = Query(default=20, ge=1, le=100),
) -> list[CasoRelacionado]:
    """Casos previos asociados al teléfono del caso (pestaña Histórico, D-70).

    Toma el `telefono` del caso y, si viene vacío, el `contacto_cliente`. Cada
    antecedente incluye el id de avería anterior, la fecha de cierre, el problema
    reportado y la justificación del cierre (última actividad de CIERRE).
    """
    caso = _o_404(db, id_caso)
    telefono = (caso.telefono or caso.contacto_cliente or "").strip()
    if not telefono:
        return []

    anteriores = list(
        db.scalars(
            select(Caso)
            .where(Caso.telefono == telefono, Caso.id_caso != caso.id_caso)
            .order_by(Caso.fecha_reporte.desc().nulls_last(), Caso.id_caso.desc())
            .limit(limite)
        ).all()
    )
    if not anteriores:
        return []

    ids = [c.id_caso for c in anteriores]
    cierres = db.execute(
        text(
            """
            SELECT DISTINCT ON (a.id_caso)
                   a.id_caso, a.reporte_corto, a.fecha_hora, m.codigo
              FROM actividad a
              LEFT JOIN catalogo_metodo m ON m.id_metodo = a.id_metodo
             WHERE a.id_caso = ANY(:ids) AND a.tipo = 'CIERRE'
             ORDER BY a.id_caso, a.fecha_hora DESC
            """
        ),
        {"ids": ids},
    ).mappings().all()
    por_caso = {f["id_caso"]: f for f in cierres}

    salida: list[CasoRelacionado] = []
    for c in anteriores:
        cierre = por_caso.get(c.id_caso)
        justificacion = None
        if cierre is not None:
            modo = cierre["codigo"] or ""
            detalle = cierre["reporte_corto"] or ""
            justificacion = f"{('Cierre con ' + modo + ': ') if modo else ''}{detalle}".strip()
        salida.append(
            CasoRelacionado(
                id_caso=c.id_caso,
                id_averia=c.id_averia,
                fecha_reporte=c.fecha_reporte,
                fecha_cierre=(cierre["fecha_hora"] if cierre is not None else None),
                estado_actual=c.estado_actual,
                categoria=c.categoria,
                problema_reporte=c.problema_reporte,
                justificacion_cierre=justificacion or None,
                direccion=c.direccion,
                nombre_cliente=c.nombre_cliente,
            )
        )
    return salida
