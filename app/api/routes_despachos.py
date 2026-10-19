"""DESPACHO diario — RF-08, RF-09, RF-10, RF-24, RF-25, RF-27, RT-08."""

from __future__ import annotations

from datetime import UTC, date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import HTMLResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..models import (
    Caso,
    Cuadrilla,
    Despacho,
    DespachoCasos,
    FallaMasiva,
    Notificacion,
    Sector,
    Usuario,
)
from ..schemas.despacho import (
    AsignacionCasosOut,
    AsignacionCasosRequest,
    AsignacionUpdate,
    CasoAgregar,
    CasoEstadoUpdate,
    CierreJornadaOut,
    DespachoDetalleOut,
    DespachoOut,
    DespachoUpdate,
    EnvioOut,
    FallaMasivaCreate,
    FallaMasivaOut,
    NotificacionOut,
    ProcesarDespacho,
    ProcesoDespachoOut,
    PropuestaOut,
    ReporteProduccionOut,
)
from ..services import despacho as svc
from ..services import jornada as svc_jornada
from ..services import mensajes as svc_mensajes
from ..services.consultas import cargar_config, resolver_central
from ..services.notificaciones import enviar
from .deps import get_current_user, require_roles

router = APIRouter(prefix="/api/v1/despachos", tags=["despacho"])
_escritura = require_roles("ADMIN", "SUPERVISOR")


def _o_404(db: Session, id_despacho: int) -> Despacho:
    obj = db.get(Despacho, id_despacho)
    if obj is None:
        raise HTTPException(status_code=404, detail="Despacho no encontrado")
    return obj


def _de_usuario(db: Session, obj: Despacho, usuario: Usuario) -> Despacho:
    resolver_central(db, obj.id_central, cargar_config(db), usuario)
    return obj


def _detalle(db: Session, despacho: Despacho) -> DespachoDetalleOut:
    cuadrilla = db.get(Cuadrilla, despacho.id_cuadrilla)
    detalle = DespachoDetalleOut.model_validate(despacho)
    detalle.cuadrilla_codigo = cuadrilla.codigo if cuadrilla else None
    detalle.cuadrilla_nombre = cuadrilla.nombre if cuadrilla else None
    return detalle


# --------------------------------------------------------------------------- #
# Propuesta y generación (RF-24)
# --------------------------------------------------------------------------- #
@router.post("/propuesta", response_model=PropuestaOut, summary="Simular el despacho del día")
def propuesta(
    fecha: date | None = Query(default=None),
    id_central: int | None = Query(default=None),
    tipos: str | None = Query(
        default=None,
        description="Tipos a distribuir separados por coma (D-113); vacío = todos",
    ),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_escritura),
) -> PropuestaOut:
    config = cargar_config(db)
    central = resolver_central(db, id_central, config, usuario)
    resultado = svc.construir_propuesta(
        db, central.id_central, fecha or date.today(), tipos=tipos
    )
    return PropuestaOut(**resultado.como_dict())


@router.post("", response_model=list[DespachoOut], status_code=status.HTTP_201_CREATED,
             summary="Generar y guardar el despacho del día")
def generar(
    fecha: date | None = Query(default=None),
    id_central: int | None = Query(default=None),
    reemplazar: bool = Query(default=False, description="Elimina los borradores del día antes de crear"),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_escritura),
) -> list[Despacho]:
    config = cargar_config(db)
    central = resolver_central(db, id_central, config, usuario)
    dia = fecha or date.today()

    if reemplazar:
        for previo in db.scalars(
            select(Despacho).where(
                Despacho.id_central == central.id_central,
                Despacho.fecha == dia,
                Despacho.estado == "BORRADOR",
            )
        ).all():
            db.delete(previo)
        db.flush()

    ya_existe = db.scalar(
        select(func.count()).select_from(Despacho).where(
            Despacho.id_central == central.id_central, Despacho.fecha == dia
        )
    )
    if ya_existe:
        raise HTTPException(
            status_code=409,
            detail="Ya existe un despacho para esa fecha (use reemplazar=true o edite el existente)",
        )

    resultado = svc.construir_propuesta(db, central.id_central, dia)
    creados = svc.guardar_propuesta(db, resultado, usuario.p00)
    db.commit()
    return creados


@router.get("", response_model=list[DespachoDetalleOut], summary="Despachos por fecha")
def listar(
    fecha: date | None = Query(default=None),
    id_central: int | None = Query(default=None),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
) -> list[DespachoDetalleOut]:
    # D-99 (RF-65, DEC-MA-5): cierre perezoso de la jornada vencida. Solo lo
    # dispara la entrada de un SUPER/ADMIN/SUPERVISOR; para el resto de roles (y
    # para el técnico de la APK) no tiene ningún efecto.
    svc_jornada.quizas_cerrar(db, usuario)
    stmt = select(Despacho).order_by(Despacho.fecha.desc(), Despacho.id_cuadrilla)
    if usuario.rol.codigo != "SUPER" or id_central is not None:
        central = resolver_central(db, id_central, cargar_config(db), usuario)
        stmt = stmt.where(Despacho.id_central == central.id_central)
    if fecha:
        stmt = stmt.where(Despacho.fecha == fecha)
    return [_detalle(db, d) for d in db.scalars(stmt).all()]


# --------------------------------------------------------------------------- #
# Fallas masivas (RF-09)
# --------------------------------------------------------------------------- #
@router.post("/fallas-masivas", response_model=FallaMasivaOut,
             status_code=status.HTTP_201_CREATED, summary="Reportar una falla masiva")
def reportar_falla(
    datos: FallaMasivaCreate,
    id_central: int | None = Query(default=None),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_escritura),
) -> FallaMasiva:
    config = cargar_config(db)
    central = resolver_central(db, id_central, config)
    id_cuadrilla = None
    if datos.id_sector:
        candidata = db.scalar(
            select(Despacho.id_cuadrilla)
            .join(DespachoCasos, DespachoCasos.id_despacho == Despacho.id_despacho)
            .where(Despacho.id_central == central.id_central,
                   DespachoCasos.id_sector == datos.id_sector)
            .order_by(Despacho.fecha.desc())
            .limit(1)
        )
        id_cuadrilla = candidata
    falla = FallaMasiva(
        id_central=central.id_central, descripcion=datos.descripcion, origen=datos.origen,
        id_sector=datos.id_sector, id_cuadrilla=id_cuadrilla, estado="DETECTADA",
    )
    db.add(falla)
    db.commit()
    db.refresh(falla)
    return falla


@router.get("/fallas-masivas", response_model=list[FallaMasivaOut],
            summary="Fallas masivas registradas")
def listar_fallas(
    db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)
) -> list[FallaMasiva]:
    return list(db.scalars(select(FallaMasiva).order_by(FallaMasiva.id_falla.desc())).all())


@router.get("/proceso", response_model=ProcesoDespachoOut,
            summary="Sectores, cuadrillas, especiales separados y masivas del proceso (D-66/D-114)")
def proceso_despacho(
    fecha: date | None = Query(default=None),
    id_central: int | None = Query(default=None),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
) -> ProcesoDespachoOut:
    config = cargar_config(db)
    central = resolver_central(db, id_central, config, usuario)
    return ProcesoDespachoOut(**svc.proceso(db, central.id_central, fecha or date.today()))


@router.put("/asignacion", response_model=ProcesoDespachoOut,
            summary="Guardar la asignación de sectores por cuadrilla del día")
def guardar_asignacion_dia(
    datos: AsignacionUpdate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_escritura),
) -> ProcesoDespachoOut:
    config = cargar_config(db)
    central = resolver_central(db, datos.id_central, config, usuario)
    svc.guardar_asignacion(
        db, central.id_central, datos.fecha,
        [bloque.model_dump() for bloque in datos.asignaciones], usuario.p00,
    )
    db.commit()
    return ProcesoDespachoOut(**svc.proceso(db, central.id_central, datos.fecha))


@router.post("/procesar", response_model=list[DespachoOut], status_code=status.HTTP_201_CREATED,
             summary="Procesar el despacho del día con la asignación de sectores")
def procesar(
    datos: ProcesarDespacho,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_escritura),
) -> list[Despacho]:
    config = cargar_config(db)
    central = resolver_central(db, datos.id_central, config, usuario)
    dia = datos.fecha
    # D-113: valida el checklist antes de tocar la jornada (400 si viene vacío o
    # con un tipo desconocido).
    tipos = svc.normalizar_tipos(datos.tipos)

    publicados = db.scalar(
        select(func.count()).select_from(Despacho).where(
            Despacho.id_central == central.id_central,
            Despacho.fecha == dia,
            Despacho.estado.in_(("PUBLICADO", "CERRADO")),
        )
    )
    if publicados:
        raise HTTPException(
            status_code=409,
            detail="Ya hay despachos publicados o cerrados para esa fecha",
        )

    # D-99 (RF-68): si la jornada ya tenía despachos, este procesamiento es un
    # reproceso y el aviso a los técnicos es «DESPACHO ACTUALIZADO».
    reproceso = bool(db.scalar(
        select(func.count()).select_from(Despacho).where(
            Despacho.id_central == central.id_central, Despacho.fecha == dia
        )
    ))

    if datos.reemplazar:
        for previo in db.scalars(
            select(Despacho).where(
                Despacho.id_central == central.id_central,
                Despacho.fecha == dia,
                Despacho.estado == "BORRADOR",
            )
        ).all():
            db.delete(previo)
        db.flush()
    elif db.scalar(
        select(func.count()).select_from(Despacho).where(
            Despacho.id_central == central.id_central, Despacho.fecha == dia
        )
    ):
        raise HTTPException(
            status_code=409,
            detail="Ya existe un despacho para esa fecha (use reemplazar=true)",
        )

    if datos.asignaciones:
        svc.guardar_asignacion(
            db, central.id_central, dia,
            [bloque.model_dump() for bloque in datos.asignaciones], usuario.p00,
        )

    # D-113: la cuadrilla elegida para cada masiva se guarda y manda sobre el
    # sector al repartir sus casos.
    masivas_incluidas: set[int] | None = None
    if datos.masivas:
        svc.asignar_masivas(
            db, central.id_central, [bloque.model_dump() for bloque in datos.masivas]
        )
        # D-114: si el formulario desmarcó alguna masiva en la lista desplegable
        # de su sector, sus casos quedan fuera del proceso; si vienen todas
        # marcadas, se mantiene el comportamiento anterior (todas incluidas).
        if not all(bloque.incluida for bloque in datos.masivas):
            masivas_incluidas = {
                bloque.id_falla for bloque in datos.masivas if bloque.incluida
            }

    # El universo es el mismo del formulario de proceso: incluye los borradores
    # del día y los casos PENDIENTES que devolvió el cierre de jornada (D-113).
    casos = svc.universo_casos(db, central.id_central, dia)
    resultado = svc.construir_propuesta(
        db, central.id_central, dia, casos=casos, tipos=tipos,
        masivas_incluidas=masivas_incluidas,
    )
    creados = svc.guardar_propuesta(db, resultado, usuario.p00)
    if reproceso:
        for despacho in creados:
            despacho.reprocesado_en = datetime.now(UTC)
    codigos = {c.id_cuadrilla: c.codigo for c in db.scalars(select(Cuadrilla)).all()}
    avisos = [
        (d.id_cuadrilla, codigos.get(d.id_cuadrilla, str(d.id_cuadrilla)), len(d.casos))
        for d in creados
    ]
    db.commit()
    # RF-69: el aviso a los técnicos va en su propia transacción para que un fallo
    # de mensajería no deshaga el despacho recién procesado.
    svc_mensajes.emitir_despacho_actualizado(
        db, id_central=central.id_central, fecha=dia, cuadrillas=avisos,
        origen_p00=usuario.p00, reproceso=reproceso,
    )
    return creados


@router.post("/cierre-jornada", response_model=CierreJornadaOut,
             summary="Cerrar la jornada de despacho y devolver los casos a PENDIENTE (D-99)")
def cierre_jornada(
    id_central: int | None = Query(default=None),
    solo_vencidos: bool = Query(
        default=True, description="Solo los despachos que ya pasaron su hora de corte"
    ),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_escritura),
) -> CierreJornadaOut:
    """Corte de jornada del despacho (RF-65 · RF-66).

    Declarado **antes** de `/{id_despacho}` para que `cierre-jornada` no se
    interprete como un identificador. Normalmente no hay que llamarlo: el cierre
    se dispara solo al entrar un SUPER/ADMIN/SUPERVISOR (DEC-MA-5).
    """
    config = cargar_config(db)
    central = resolver_central(db, id_central, config, usuario)
    resultado = svc_jornada.cerrar_jornada(
        db, id_central=central.id_central, usuario_p00=usuario.p00,
        solo_vencidos=solo_vencidos,
    )
    db.commit()
    return CierreJornadaOut(**resultado)


@router.get("/{id_despacho}", response_model=DespachoDetalleOut, summary="Detalle del despacho")
def obtener(
    id_despacho: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
) -> DespachoDetalleOut:
    return _detalle(db, _de_usuario(db, _o_404(db, id_despacho), usuario))


@router.patch("/{id_despacho}", response_model=DespachoDetalleOut, summary="Publicar / cerrar el despacho")
def actualizar(
    id_despacho: int,
    datos: DespachoUpdate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_escritura),
) -> DespachoDetalleOut:
    despacho = _de_usuario(db, _o_404(db, id_despacho), usuario)
    cambios = datos.model_dump(exclude_unset=True)
    if "observacion" in cambios:
        cambios.pop("observacion")  # la observación es por caso, no del despacho
    for campo, valor in cambios.items():
        setattr(despacho, campo, valor)
    if datos.estado == "PUBLICADO" and despacho.enviado_en is None:
        despacho.enviado_en = datetime.now(UTC)
    db.commit()
    db.refresh(despacho)
    return _detalle(db, despacho)


# --------------------------------------------------------------------------- #
# Casos del despacho
# --------------------------------------------------------------------------- #
@router.post("/{id_despacho}/casos", response_model=DespachoDetalleOut,
             summary="Agregar un caso al despacho")
def agregar_caso(
    id_despacho: int,
    datos: CasoAgregar,
    db: Session = Depends(get_db),
    _: Usuario = Depends(_escritura),
) -> DespachoDetalleOut:
    despacho = _o_404(db, id_despacho)
    caso = db.get(Caso, datos.id_caso)
    if caso is None:
        raise HTTPException(status_code=404, detail="Caso no encontrado")
    repetido = db.scalar(
        select(DespachoCasos).where(
            DespachoCasos.id_despacho == id_despacho, DespachoCasos.id_caso == datos.id_caso
        )
    )
    if repetido:
        raise HTTPException(status_code=409, detail="El caso ya está en el despacho")
    orden = datos.orden_visita or (
        db.scalar(
            select(func.coalesce(func.max(DespachoCasos.orden_visita), 0)).where(
                DespachoCasos.id_despacho == id_despacho
            )
        )
        or 0
    ) + 1
    db.add(
        DespachoCasos(
            id_despacho=id_despacho,
            id_caso=caso.id_caso,
            id_sector=caso.id_sector,
            orden_visita=orden,
            tipo_asignacion=datos.tipo_asignacion,
            estado="ASIGNADO",
            observacion=datos.observacion,
        )
    )
    db.commit()
    db.refresh(despacho)
    return _detalle(db, despacho)


@router.delete("/{id_despacho}/casos/{id_caso}", response_model=DespachoDetalleOut,
               summary="Quitar un caso del despacho")
def quitar_caso(
    id_despacho: int,
    id_caso: int,
    db: Session = Depends(get_db),
    _: Usuario = Depends(_escritura),
) -> DespachoDetalleOut:
    despacho = _o_404(db, id_despacho)
    fila = db.scalar(
        select(DespachoCasos).where(
            DespachoCasos.id_despacho == id_despacho, DespachoCasos.id_caso == id_caso
        )
    )
    if fila is None:
        raise HTTPException(status_code=404, detail="El caso no está en el despacho")
    db.delete(fila)
    db.commit()
    db.refresh(despacho)
    return _detalle(db, despacho)


@router.patch("/{id_despacho}/casos/{id_caso}", response_model=DespachoDetalleOut,
              summary="Actualizar el estado de un caso del despacho")
def estado_caso(
    id_despacho: int,
    id_caso: int,
    datos: CasoEstadoUpdate,
    db: Session = Depends(get_db),
    _: Usuario = Depends(_escritura),
) -> DespachoDetalleOut:
    despacho = _o_404(db, id_despacho)
    fila = db.scalar(
        select(DespachoCasos).where(
            DespachoCasos.id_despacho == id_despacho, DespachoCasos.id_caso == id_caso
        )
    )
    if fila is None:
        raise HTTPException(status_code=404, detail="El caso no está en el despacho")
    fila.estado = datos.estado
    if datos.observacion is not None:
        fila.observacion = datos.observacion
    db.commit()
    db.refresh(despacho)
    return _detalle(db, despacho)


# --------------------------------------------------------------------------- #
# Asignación manual de casos a una cuadrilla (D-77)
# --------------------------------------------------------------------------- #
@router.post("/asignar-casos", response_model=AsignacionCasosOut,
             summary="Asignar casos (comunes y especiales) a una cuadrilla")
def asignar_casos(
    datos: AsignacionCasosRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_escritura),
) -> AsignacionCasosOut:
    """Crea o reutiliza el BORRADOR del día de esa cuadrilla y agrega los casos.

    Los casos que estaban en el borrador de otra cuadrilla se mueven; un caso en
    un despacho publicado o cerrado se omite.
    """
    if datos.id_cuadrilla is None:
        raise HTTPException(status_code=400, detail="Indique la cuadrilla destino")
    config = cargar_config(db)
    central = resolver_central(db, datos.id_central, config, usuario)
    resultado = svc.asignar_casos(
        db, central.id_central, datos.fecha or date.today(), datos.id_cuadrilla,
        datos.ids_caso, datos.ids_caso_especial, usuario.p00,
    )
    partes = [f"{resultado['agregados']} agregado(s)"]
    if resultado["movidos"]:
        partes.append(f"{resultado['movidos']} movido(s) de otra cuadrilla")
    if resultado["omitidos"]:
        partes.append(f"{len(resultado['omitidos'])} omitido(s)")
    return AsignacionCasosOut(
        **resultado,
        mensaje=(f"Cuadrilla {resultado['cuadrilla_codigo']}: " + ", ".join(partes) + "."),
    )


@router.post("/quitar-casos", response_model=AsignacionCasosOut,
             summary="Quitar casos del despacho del día (desasignar)")
def quitar_casos(
    datos: AsignacionCasosRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_escritura),
) -> AsignacionCasosOut:
    config = cargar_config(db)
    central = resolver_central(db, datos.id_central, config, usuario)
    resultado = svc.quitar_casos(
        db, central.id_central, datos.fecha or date.today(),
        datos.ids_caso, datos.ids_caso_especial,
    )
    detalle = f"{resultado['quitados']} caso(s) fuera del despacho del día"
    if resultado["omitidos"]:
        detalle += f" · {len(resultado['omitidos'])} sin cambios (publicados o no asignados)"
    return AsignacionCasosOut(**resultado, mensaje=detalle + ".")


# --------------------------------------------------------------------------- #
# Impresión tamaño carta (RT-08)
# --------------------------------------------------------------------------- #
@router.get("/{id_despacho}/imprimible", response_class=HTMLResponse,
            summary="Ficha de la cuadrilla lista para imprimir (carta)")
def imprimible(
    id_despacho: int, db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)
) -> HTMLResponse:
    despacho = _o_404(db, id_despacho)
    cuadrilla = db.get(Cuadrilla, despacho.id_cuadrilla)
    filas = db.execute(
        select(DespachoCasos, Caso)
        .join(Caso, Caso.id_caso == DespachoCasos.id_caso)
        .where(DespachoCasos.id_despacho == id_despacho)
        .order_by(DespachoCasos.orden_visita)
    ).all()
    sectores = {s.id_sector: s.nombre for s in db.scalars(select(Sector)).all()}

    filas_html = "".join(
        f"<tr><td>{dc.orden_visita or ''}</td><td>{c.id_averia}</td>"
        f"<td>{(sectores.get(dc.id_sector) if dc.id_sector else None) or '—'}</td>"
        f"<td>{c.direccion or ''}</td>"
        f"<td>{c.nombre_cliente or ''}</td><td>{c.telefono or ''}</td>"
        f"<td>{c.contacto_cliente or ''}</td>"
        f"<td>{dc.tipo_asignacion or ''}</td><td>{c.problema_reporte or ''}</td>"
        f"<td></td></tr>"
        for dc, c in filas
    )
    html = f"""<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Despacho {despacho.fecha} · {cuadrilla.codigo if cuadrilla else ''}</title>
<style>
  @page {{ size: letter; margin: 1cm; }}
  body {{ font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #111; }}
  h1 {{ font-size: 14px; margin: 0 0 2px; }}
  .sub {{ font-size: 10px; color: #444; margin-bottom: 8px; }}
  table {{ width: 100%; border-collapse: collapse; }}
  th, td {{ border: 1px solid #999; padding: 2px 3px; vertical-align: top; }}
  th {{ background: #eee; font-size: 9px; text-transform: uppercase; }}
  td:nth-child(1) {{ width: 4%; text-align: center; }}
  td:nth-child(2) {{ width: 10%; }}
  td:nth-child(3) {{ width: 12%; }}
  td:nth-child(4) {{ width: 26%; }}
  @media print {{ .no-print {{ display: none; }} }}
</style></head>
<body>
  <h1>GGTO — Despacho de cuadrilla</h1>
  <div class="sub">
    <strong>Central:</strong> FRANCISCO SALIAS · <strong>Fecha:</strong> {despacho.fecha} ·
    <strong>Cuadrilla:</strong> {cuadrilla.codigo if cuadrilla else '—'}
    — {cuadrilla.nombre if cuadrilla else ''} ·
    <strong>Estado:</strong> {despacho.estado} · <strong>Casos:</strong> {len(filas)}
  </div>
  <table>
    <thead><tr><th>#</th><th>ID avería</th><th>Sector</th><th>Dirección</th><th>Cliente</th>
    <th>Identificador de pago (70*)</th><th>Contacto</th><th>Tipo</th><th>Problema</th>
    <th>Firma / resultado</th></tr></thead>
    <tbody>{filas_html}</tbody>
  </table>
  <p class="no-print"><button onclick="window.print()">Imprimir</button></p>
</body></html>"""
    return HTMLResponse(content=html)


# --------------------------------------------------------------------------- #
# Reporte de producción (RF-27)
# --------------------------------------------------------------------------- #
def _reporte(db: Session, id_central: int, fecha: date) -> ReporteProduccionOut:
    """Reporte de producción del día (RF-27 · RF-70).

    D-99 añade a cada cuadrilla el desglose que consume el **gráfico de aro** del
    cumplimiento —ABIERTOS, CERRADOS, ENRUTADO, DIFERIDO y CITADOS— y la marca
    `es_masiva`, que pinta el icono MASIVA en la cuadrilla a la que se le asignó
    una falla masiva.
    """
    filas = db.execute(
        select(Despacho, Cuadrilla, DespachoCasos, Caso)
        .join(Cuadrilla, Cuadrilla.id_cuadrilla == Despacho.id_cuadrilla)
        .join(DespachoCasos, DespachoCasos.id_despacho == Despacho.id_despacho)
        .join(Caso, Caso.id_caso == DespachoCasos.id_caso)
        .where(Despacho.id_central == id_central, Despacho.fecha == fecha)
    ).all()

    # Cuadrillas con una masiva activa asignada (RF-71): alimentan el icono.
    masivas_por_cuadrilla: dict[int, list[int]] = {}
    for falla in db.scalars(
        select(FallaMasiva).where(
            FallaMasiva.id_central == id_central,
            FallaMasiva.estado.in_(("DETECTADA", "PLANIFICADA")),
        )
    ).all():
        if falla.id_cuadrilla:
            masivas_por_cuadrilla.setdefault(falla.id_cuadrilla, []).append(falla.id_falla)

    por_cuadrilla: dict[str, dict] = {}
    totales = {"asignados": 0, "abiertos": 0, "cerrados": 0, "enrutado": 0, "citados": 0,
               "diferidos": 0, "gestionados": 0, "referidos": 0, "empresas": 0,
               "masivas": 0}
    for _despacho, cuadrilla, dc, caso in filas:
        fila = por_cuadrilla.setdefault(
            cuadrilla.codigo,
            {"cuadrilla": cuadrilla.codigo, "nombre": cuadrilla.nombre, "id_cuadrilla":
             cuadrilla.id_cuadrilla, "asignados": 0, "abiertos": 0,
             "cerrados": 0, "enrutado": 0, "citados": 0, "diferidos": 0, "gestionados": 0,
             "referidos": 0, "empresas": 0, "es_masiva": False, "masivas": []},
        )
        fila["asignados"] += 1
        totales["asignados"] += 1
        cerrado = caso.estado_actual == "CERRADO" or dc.estado == "CERRADO"
        enrutado = caso.estado_actual == "ENRUTADO"
        citado = caso.estado_actual == "CITADO" or dc.estado == "CITADO"
        diferido = caso.estado_actual == "DIFERIDO" or dc.estado == "DIFERIDO"
        if cerrado:
            fila["cerrados"] += 1
            totales["cerrados"] += 1
        if enrutado:
            fila["enrutado"] += 1
            totales["enrutado"] += 1
        if citado:
            fila["citados"] += 1
            totales["citados"] += 1
        if diferido:
            fila["diferidos"] += 1
            totales["diferidos"] += 1
        # ABIERTOS = asignados sin desenlace de la jornada. Se cuenta por caso en
        # lugar de restar, para que un caso con dos marcas no descuadre el aro.
        if not (cerrado or enrutado or citado or diferido):
            fila["abiertos"] += 1
            totales["abiertos"] += 1
        if dc.estado == "GESTIONADO":
            fila["gestionados"] += 1
            totales["gestionados"] += 1
        if dc.tipo_asignacion == "REFERIDO":
            fila["referidos"] += 1
            totales["referidos"] += 1
        if dc.tipo_asignacion == "EMPRESA":
            fila["empresas"] += 1
            totales["empresas"] += 1
        # Icono MASIVA: por asignación explícita del caso o por la masiva activa
        # de la cuadrilla.
        if dc.tipo_asignacion == "FALLA_MASIVA":
            fila["es_masiva"] = True

    for fila in por_cuadrilla.values():
        ids = masivas_por_cuadrilla.get(fila["id_cuadrilla"] or 0)
        if ids:
            fila["es_masiva"] = True
            fila["masivas"] = sorted(ids)
        totales["masivas"] += len(fila["masivas"])

    return ReporteProduccionOut(
        fecha=fecha, id_central=id_central,
        por_cuadrilla=list(por_cuadrilla.values()), totales=totales,
    )


@router.get("/reporte/produccion", response_model=ReporteProduccionOut,
            summary="Reporte de producción del día")
def reporte(
    fecha: date | None = Query(default=None),
    id_central: int | None = Query(default=None),
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
) -> ReporteProduccionOut:
    config = cargar_config(db)
    central = resolver_central(db, id_central, config)
    return _reporte(db, central.id_central, fecha or date.today())


@router.get("/{id_despacho}/reporte", response_model=ReporteProduccionOut,
            summary="Reporte de producción del despacho")
def reporte_despacho(
    id_despacho: int, db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)
) -> ReporteProduccionOut:
    despacho = _o_404(db, id_despacho)
    return _reporte(db, despacho.id_central, despacho.fecha)


# --------------------------------------------------------------------------- #
# Envío por Telegram/correo (RF-10, RF-27)
# --------------------------------------------------------------------------- #
@router.post("/{id_despacho}/enviar", response_model=EnvioOut, summary="Enviar la ficha por mensajería")
def enviar_despacho(
    id_despacho: int,
    canal: str = Query(default="TELEGRAM", pattern="^(TELEGRAM|CORREO)$"),
    destinatario: str | None = Query(default=None),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_escritura),
) -> EnvioOut:
    from ..services.despacho import MIN_EMPRESAS, MIN_REFERIDOS

    despacho = _o_404(db, id_despacho)
    cuadrilla = db.get(Cuadrilla, despacho.id_cuadrilla)
    reporte = _reporte(db, despacho.id_central, despacho.fecha)
    filas = db.execute(
        select(DespachoCasos, Caso)
        .join(Caso, Caso.id_caso == DespachoCasos.id_caso)
        .where(DespachoCasos.id_despacho == id_despacho)
        .order_by(DespachoCasos.orden_visita)
    ).all()

    lineas = [
        f"Despacho {despacho.fecha} · Cuadrilla {cuadrilla.codigo if cuadrilla else '—'}",
        f"Casos: {len(filas)} · Referidos: {reporte.totales['referidos']} (mín. {MIN_REFERIDOS})",
        f"Empresas: {reporte.totales['empresas']} (mín. {MIN_EMPRESAS})",
        "",
    ]
    for dc, caso in filas:
        lineas.append(
            f"{dc.orden_visita}. [{dc.tipo_asignacion}] {caso.id_averia} · "
            f"{caso.direccion or ''} · 70*: {caso.telefono or '—'}"
            f"{f' · Contacto: {caso.contacto_cliente}' if caso.contacto_cliente else ''}"
        )
    cuerpo = "\n".join(lineas)
    asunto = f"Despacho {despacho.fecha} — Cuadrilla {cuadrilla.codigo if cuadrilla else ''}"

    config = cargar_config(db)
    configurado = str(config.get(f"despacho.destino_{canal.lower()}") or "").strip('"')
    destino = destinatario or configurado or None
    estado_envio, error = enviar(canal, destino, asunto, cuerpo)

    notificacion = Notificacion(
        canal=canal, destinatario=destino, asunto=asunto, cuerpo=cuerpo,
        estado=estado_envio, error=error,
        enviado_en=datetime.now(UTC) if estado_envio == "ENVIADO" else None,
    )
    db.add(notificacion)
    if estado_envio == "ENVIADO":
        despacho.enviado_canal = canal
        despacho.enviado_en = datetime.now(UTC)
    db.commit()
    db.refresh(notificacion)
    return EnvioOut(id_despacho=despacho.id_despacho, canal=canal, estado=estado_envio,
                    error=error, notificacion=NotificacionOut.model_validate(notificacion))


@router.get("/{id_despacho}/notificaciones", response_model=list[NotificacionOut],
            summary="Notificaciones asociadas al despacho")
def notificaciones(
    id_despacho: int, db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)
) -> list[Notificacion]:
    despacho = _o_404(db, id_despacho)
    cuadrilla = db.get(Cuadrilla, despacho.id_cuadrilla)
    asunto = f"Despacho {despacho.fecha} — Cuadrilla {cuadrilla.codigo if cuadrilla else ''}"
    return list(
        db.scalars(
            select(Notificacion).where(Notificacion.asunto == asunto)
            .order_by(Notificacion.id_notificacion.desc())
        ).all()
    )
