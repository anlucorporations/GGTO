"""ALERTAS, Telegram y MCP — RF-06, RF-09, RF-16, RF-17, RF-18 / RNF-19, RNF-20."""

from __future__ import annotations

import os
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from fastapi.responses import HTMLResponse
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..models import (
    Caso,
    Cuadrilla,
    Evidencia,
    FallaMasiva,
    IngestaLote,
    Notificacion,
    OrdenMaterial,
    Sector,
    Solicitante,
    Usuario,
)
from ..schemas.alertas import (
    AsociarCasosRequest,
    CasoAsociadoOut,
    CierreMasivaOut,
    CierreMasivaRequest,
    FallaMasivaCampo,
    FallaMasivaManual,
    FallaMasivaOut,
    FallaMasivaUpdate,
    MaterialRequest,
    MetricasOut,
    NotificacionOut,
    OrdenMaterialOut,
    PlanificacionRequest,
    ProcesarOutboxOut,
    UbicacionOut,
    ValidadorCrassOut,
)
from ..services import fallas as svc_fallas
from ..services import masivas as svc_masivas
from ..services import outbox
from ..services import sync as svc_sync
from ..services.consultas import cargar_config, resolver_central
from .deps import _material, get_current_user, require_roles

router = APIRouter(prefix="/api/v1", tags=["alertas, telegram y mcp"])
_escritura = require_roles("ADMIN", "SUPERVISOR")
MCP_VERSION = "0.1.0"


def _o_404(db: Session, id_falla: int) -> FallaMasiva:
    falla = db.get(FallaMasiva, id_falla)
    if falla is None:
        raise HTTPException(status_code=404, detail="Falla masiva no encontrada")
    return falla


def _falla_de_usuario(db: Session, id_falla: int, usuario: Usuario) -> FallaMasiva:
    falla = _o_404(db, id_falla)
    central = resolver_central(db, falla.id_central, cargar_config(db), usuario)
    if central.id_central != falla.id_central:
        raise HTTPException(status_code=403, detail="No tiene acceso a esta falla masiva")
    return falla


MAX_EVIDENCIAS_CAMPO = 2


def _evidencias_de(texto: str | None) -> list[str]:
    """Seriales de evidencia guardados en la columna (separados por coma)."""
    if not texto:
        return []
    return [parte.strip() for parte in texto.split(",") if parte.strip()]


def _texto_evidencias(seriales: list[str]) -> str | None:
    limpios = [s.strip()[:120] for s in seriales if s and s.strip()]
    return ", ".join(limpios[:MAX_EVIDENCIAS_CAMPO]) or None


def _ruta_desde_caso(caso: Caso | None) -> tuple[str | None, str | None]:
    """RUTA unificada y dirección corta del caso representativo de la concentración.

    D-99: la RUTA la resuelve `services.masivas.ruta_de_caso`, que da prioridad a
    la columna **EXTRA** del archivo de ingesta —donde viaja la ruta— y, si viene
    vacía, compone Tarjeta (slot) · Puerto · FAT (criterio D-75).
    """
    if caso is None:
        return None, None
    ruta = svc_masivas.ruta_de_caso(caso)
    direccion = (caso.direccion or "").strip()
    if not direccion:
        return ruta, None
    return ruta, (direccion[:40] + "…") if len(direccion) > 40 else direccion


def _caso_representativo(db: Session, falla: FallaMasiva) -> tuple[Caso | None, int | None]:
    """Caso más reciente de la concentración + nº de casos afectados (D-75).

    Con `clave_concentracion` «campo:valor» se filtra por ese campo; si la falla
    es manual (sin clave) se usa el sector. Devuelve también el conteo.
    """
    campo = valor = None
    if falla.clave_concentracion and ":" in falla.clave_concentracion:
        campo, valor = falla.clave_concentracion.split(":", 1)
    columna = {"olt": Caso.olt, "fat": Caso.fat, "id_sector": Caso.id_sector}.get(campo or "")
    if columna is None:
        if falla.id_sector is None:
            return None, None
        columna, valor = Caso.id_sector, str(falla.id_sector)
    condiciones = [Caso.id_central == falla.id_central]
    if columna is Caso.id_sector:
        try:
            valor_num = int(str(valor))
        except ValueError:
            return None, None
        condiciones.append(columna == valor_num)
    else:
        condiciones.append(columna == valor)
    total = db.scalar(select(func.count()).select_from(Caso).where(*condiciones)) or 0
    caso = db.scalar(
        select(Caso).where(*condiciones).order_by(Caso.id_caso.desc()).limit(1)
    )
    return caso, total


def _salida(db: Session, fallas: list[FallaMasiva]) -> list[FallaMasivaOut]:
    """Enriquece las fallas para la tabla y la ficha (D-75)."""
    if not fallas:
        return []
    sectores = {s.id_sector: s.nombre for s in db.scalars(select(Sector)).all()}
    cuadrillas = {c.id_cuadrilla: c for c in db.scalars(select(Cuadrilla)).all()}
    ids = [f.id_falla for f in fallas]
    ordenes = dict(
        db.execute(
            select(OrdenMaterial.id_falla, func.count())
            .where(OrdenMaterial.id_falla.in_(ids))
            .group_by(OrdenMaterial.id_falla)
        ).all()
    )
    # D-99: nº real de casos asociados y validador del CRASS de las cerradas.
    asociados = svc_masivas.contar_asociados(db, ids)
    ids_validador = [f.id_validador_crass for f in fallas if f.id_validador_crass]
    validadores = {
        s.id_solicitante: s
        for s in db.scalars(
            select(Solicitante).where(Solicitante.id_solicitante.in_(ids_validador))
        ).all()
    } if ids_validador else {}
    salida: list[FallaMasivaOut] = []
    for f in fallas:
        caso, casos_afectos = _caso_representativo(db, f)
        ruta, dir_corta = _ruta_desde_caso(caso)
        cu = cuadrillas.get(f.id_cuadrilla) if f.id_cuadrilla else None
        validador = validadores.get(f.id_validador_crass) if f.id_validador_crass else None
        datos = FallaMasivaOut.model_validate(f).model_dump()
        datos.update(
            sector_nombre=(sectores.get(f.id_sector) if f.id_sector is not None else None),
            cuadrilla_codigo=(cu.codigo if cu else None),
            cuadrilla_nombre=(cu.nombre if cu else None),
            ruta=ruta,
            direccion_corta=dir_corta,
            ordenes_count=ordenes.get(f.id_falla, 0),
            casos_afectos=casos_afectos,
            evidencias=_evidencias_de(f.evidencias),
            evidencias_cierre=_evidencias_de(f.evidencias_cierre),
            casos_asociados=asociados.get(f.id_falla, 0),
            validador_crass=(
                ValidadorCrassOut.model_validate(validador) if validador else None
            ),
        )
        salida.append(FallaMasivaOut(**datos))
    return salida


def _salida1(db: Session, falla: FallaMasiva) -> FallaMasivaOut:
    return _salida(db, [falla])[0]


# --------------------------------------------------------------------------- #
# Fallas masivas (RF-09, RF-16, RF-17)
# --------------------------------------------------------------------------- #
@router.get("/fallas-masivas", response_model=list[FallaMasivaOut],
            summary="Fallas masivas registradas (histórico de la sección MASIVAS)")
def listar_fallas(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
    estado: str | None = None,
    id_central: int | None = None,
    solo_activas: bool = Query(default=False),
    q: str | None = Query(default=None, description="Busca en descripción, ODN, FAT y dirección"),
    desde: datetime | None = Query(default=None, description="Desde fecha_deteccion"),
    hasta: datetime | None = Query(default=None, description="Hasta fecha_deteccion"),
    origen: str | None = None,
    limite: int = Query(default=200, ge=1, le=1000),
) -> list[FallaMasivaOut]:
    """Histórico de masivas (RF-60).

    Además del filtro por estado y central admite búsqueda textual (`q`), rango de
    detección (`desde`/`hasta`) y origen, que es lo que consume la sección MASIVAS.
    """
    stmt = select(FallaMasiva).order_by(FallaMasiva.id_falla.desc()).limit(limite)
    if usuario.rol.codigo != "SUPER" or id_central is not None:
        central = resolver_central(db, id_central, cargar_config(db), usuario)
        stmt = stmt.where(FallaMasiva.id_central == central.id_central)
    if estado:
        stmt = stmt.where(FallaMasiva.estado == estado)
    if origen:
        stmt = stmt.where(FallaMasiva.origen == origen)
    if solo_activas:
        stmt = stmt.where(FallaMasiva.estado.in_(("DETECTADA", "PLANIFICADA")))
    if desde:
        stmt = stmt.where(FallaMasiva.fecha_deteccion >= desde)
    if hasta:
        stmt = stmt.where(FallaMasiva.fecha_deteccion <= hasta)
    if q:
        patron = f"%{q.strip()}%"
        stmt = stmt.where(or_(
            FallaMasiva.descripcion.ilike(patron),
            FallaMasiva.odn.ilike(patron),
            FallaMasiva.fat.ilike(patron),
            FallaMasiva.direccion.ilike(patron),
            FallaMasiva.clave_concentracion.ilike(patron),
        ))
    return _salida(db, list(db.scalars(stmt).all()))


@router.post("/fallas-masivas", response_model=FallaMasivaOut,
             status_code=status.HTTP_201_CREATED, summary="Reportar una falla masiva")
def reportar_falla(
    datos: FallaMasivaManual,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_escritura),
) -> FallaMasivaOut:
    central = resolver_central(db, None, cargar_config(db))
    id_cuadrilla = datos.id_cuadrilla or svc_fallas.cuadrilla_cercana(
        db, central.id_central, datos.id_sector)
    falla = FallaMasiva(
        id_central=central.id_central,
        descripcion=datos.descripcion,
        origen=datos.origen,
        id_sector=datos.id_sector,
        id_cuadrilla=id_cuadrilla,
        # D-82: ODN/dirección/FAT/evidencias (opcionales en el alta administrativa).
        odn=(datos.odn or None),
        direccion=(datos.direccion or None),
        fat=(datos.fat or None),
        evidencias=_texto_evidencias(datos.evidencias),
        estado="DETECTADA",
    )
    db.add(falla)
    db.flush()
    # D-99: materializa la asociación de la concentración (o del sector, si el
    # alta es manual) para que la ficha tenga CASOS ASOCIADOS desde el minuto cero.
    svc_masivas.sincronizar_asociacion(db, falla, usuario.p00)
    svc_fallas.alertar(db, falla)
    db.commit()
    db.refresh(falla)
    return _salida1(db, falla)


@router.post("/fallas-masivas/reporte-campo", response_model=FallaMasivaOut,
             status_code=status.HTTP_201_CREATED,
             summary="Reporte de falla masiva desde la APK (RF-16 · D-82)")
def reportar_falla_campo(
    datos: FallaMasivaCampo,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_roles("TECNICO", "ADMIN", "SUPERVISOR")),
) -> FallaMasivaOut:
    """Reporte del **técnico en campo**: ODN, dirección, FAT, descripción y
    hasta 2 fotos.

    A diferencia de `POST /fallas-masivas` (reservado a ADMIN/SUPERVISOR), este
    endpoint lo pueden usar TECNICO, ADMIN y SUPERVISOR. COORDINADOR no puede
    reportar desde campo (DEC-G11). Siempre registra el origen `REPORTE_TECNICO`.
    La cuadrilla se toma de la del propio reportante (la activa del día) y, si
    no tiene, la más cercana al sector indicado.
    """
    central = resolver_central(db, None, cargar_config(db))
    propia = svc_sync.resolver_cuadrilla(db, usuario).get("id_cuadrilla")
    id_cuadrilla = (
        datos.id_cuadrilla
        or (int(propia) if propia is not None else None)
        or svc_fallas.cuadrilla_cercana(db, central.id_central, datos.id_sector)
    )
    falla = FallaMasiva(
        id_central=central.id_central,
        descripcion=datos.descripcion.strip(),
        origen="REPORTE_TECNICO",
        id_sector=datos.id_sector,
        id_cuadrilla=id_cuadrilla,
        odn=datos.odn.strip(),
        direccion=datos.direccion.strip(),
        fat=datos.fat.strip(),
        evidencias=_texto_evidencias(datos.evidencias),
        estado="DETECTADA",
    )
    db.add(falla)
    db.flush()
    # D-99 (RF-60): si las evidencias del reporte traen GPS, se guarda la posición
    # del FAT afectado para el mapa de la sección MASIVAS.
    seriales = [s.strip() for s in (falla.evidencias or "").split(",") if s.strip()]
    if seriales:
        punto = db.scalar(
            select(Evidencia)
            .where(Evidencia.serial_imagen.in_(seriales),
                   Evidencia.latitud.is_not(None), Evidencia.longitud.is_not(None))
            .order_by(Evidencia.fecha_hora.desc())
            .limit(1)
        )
        if punto is not None:
            falla.latitud = punto.latitud
            falla.longitud = punto.longitud
    svc_masivas.sincronizar_asociacion(db, falla, usuario.p00)
    svc_fallas.alertar(db, falla)
    db.commit()
    db.refresh(falla)
    return _salida1(db, falla)


@router.post("/fallas-masivas/detectar", response_model=list[FallaMasivaOut],
             summary="Detectar fallas masivas por concentración")
def detectar_fallas(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_escritura),
) -> list[FallaMasivaOut]:
    central = resolver_central(db, None, cargar_config(db))
    creadas = svc_fallas.detectar(db, central.id_central)
    db.commit()
    for falla in creadas:
        db.refresh(falla)
    return _salida(db, creadas)


@router.patch("/fallas-masivas/{id_falla}", response_model=FallaMasivaOut,
              summary="Actualizar estado, sector, cuadrilla o descripción de la falla (D-75)")
def actualizar_falla(
    id_falla: int,
    datos: FallaMasivaUpdate,
    db: Session = Depends(get_db),
    _: Usuario = Depends(_escritura),
) -> FallaMasivaOut:
    falla = _o_404(db, id_falla)
    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(falla, campo, valor)
    db.commit()
    db.refresh(falla)
    return _salida1(db, falla)


@router.post("/fallas-masivas/{id_falla}/planificacion", response_model=FallaMasivaOut,
             summary="Documentar la planificación de atención (RF-17)")
def planificar_falla(
    id_falla: int,
    datos: PlanificacionRequest,
    db: Session = Depends(get_db),
    _: Usuario = Depends(_escritura),
) -> FallaMasivaOut:
    falla = _o_404(db, id_falla)
    falla.planificacion = datos.planificacion
    if datos.reporte_simple:
        falla.reporte_simple = datos.reporte_simple
    if datos.evidencias:
        seriales = ", ".join(datos.evidencias)
        falla.reporte_simple = f"{falla.reporte_simple or ''}\nEvidencias: {seriales}".strip()
    if datos.id_cuadrilla:
        falla.id_cuadrilla = datos.id_cuadrilla
    falla.estado = "PLANIFICADA"
    falla.planificada_en = datetime.now(UTC)
    db.commit()
    db.refresh(falla)
    return _salida1(db, falla)


@router.get("/fallas-masivas/{id_falla}", response_model=FallaMasivaOut,
            summary="Ficha completa de una falla masiva (D-75)")
def obtener_falla(
    id_falla: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
) -> FallaMasivaOut:
    return _salida1(db, _falla_de_usuario(db, id_falla, usuario))


@router.get("/fallas-masivas/{id_falla}/ordenes", response_model=list[OrdenMaterialOut],
            summary="Órdenes de material de una falla (D-75)")
def listar_ordenes(
    id_falla: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
) -> list[OrdenMaterial]:
    _falla_de_usuario(db, id_falla, usuario)
    # `id_falla` real (D-75) + compatibilidad con las solicitudes históricas
    # que solo guardaban el marcador «[Falla N]» en la observación.
    stmt = (
        select(OrdenMaterial)
        .where(or_(OrdenMaterial.id_falla == id_falla,
                  OrdenMaterial.observacion.ilike(f"[Falla {id_falla}]%")))
        .order_by(OrdenMaterial.id_orden.desc())
    )
    return list(db.scalars(stmt).unique().all())


@router.post("/fallas-masivas/{id_falla}/material", response_model=OrdenMaterialOut,
             status_code=status.HTTP_201_CREATED, summary="Solicitar material para la falla (RF-18)")
def solicitar_material(
    id_falla: int,
    datos: MaterialRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_material),
) -> OrdenMaterial:
    falla = _falla_de_usuario(db, id_falla, usuario)
    orden = OrdenMaterial(
        id_falla=falla.id_falla,  # D-75: vínculo real, ya no solo el texto
        id_cuadrilla=datos.id_cuadrilla or falla.id_cuadrilla,
        solicitante_usuario=usuario.p00,
        estado="SOLICITADA",
        observacion=f"[Falla {falla.id_falla}] {datos.descripcion}",
    )
    db.add(orden)
    db.commit()
    db.refresh(orden)
    return orden


# --------------------------------------------------------------------------- #
# D-99 · Módulo MASIVAS: casos asociados, cierre en cascada y ubicación
# --------------------------------------------------------------------------- #
@router.get("/fallas-masivas/{id_falla}/casos", response_model=list[CasoAsociadoOut],
            summary="CASOS ASOCIADOS de la masiva (D-99 · RF-59)")
def listar_casos_asociados(
    id_falla: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
) -> list[CasoAsociadoOut]:
    """Casos vinculados a la masiva, con sus datos técnicos y la RUTA."""
    falla = _falla_de_usuario(db, id_falla, usuario)
    return svc_masivas.casos_asociados(db, falla)


@router.post("/fallas-masivas/{id_falla}/casos", response_model=list[CasoAsociadoOut],
             status_code=status.HTTP_201_CREATED,
             summary="Asociar casos a la masiva (D-99 · RF-59)")
def asociar_casos(
    id_falla: int,
    datos: AsociarCasosRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_escritura),
) -> list[CasoAsociadoOut]:
    falla = _o_404(db, id_falla)
    try:
        svc_masivas.asociar(db, falla, datos.ids_caso, usuario.p00)
    except svc_masivas.MasivaInvalida as exc:
        raise HTTPException(status_code=409 if not exc.no_encontrada else 404,
                            detail=exc.mensaje) from exc
    db.commit()
    db.refresh(falla)
    return svc_masivas.casos_asociados(db, falla)


@router.delete("/fallas-masivas/{id_falla}/casos", response_model=list[CasoAsociadoOut],
               summary="Quitar casos de la masiva (D-99 · RF-59)")
def desasociar_casos(
    id_falla: int,
    datos: AsociarCasosRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_escritura),
) -> list[CasoAsociadoOut]:
    falla = _o_404(db, id_falla)
    svc_masivas.desasociar(db, falla, datos.ids_caso)
    db.commit()
    db.refresh(falla)
    return svc_masivas.casos_asociados(db, falla)


@router.post("/fallas-masivas/{id_falla}/cierre", response_model=CierreMasivaOut,
             summary="Cerrar la masiva y sus casos asociados (D-99 · RF-61/RF-62)")
def cerrar_masiva(
    id_falla: int,
    datos: CierreMasivaRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_escritura),
) -> CierreMasivaOut:
    """Cierra la masiva y **todos sus casos asociados**.

    Exige la descripción del trabajo, el personal del CRASS que valida la
    reparación y las evidencias. Cada caso asociado se cierra con el mismo modo
    (IVR por defecto) y la descripción «Reparado en FDT»; los que ya estaban
    cerrados se omiten y se informan en el detalle.
    """
    falla = _o_404(db, id_falla)
    try:
        resultado = svc_masivas.cerrar(db, falla, datos, usuario)
    except svc_masivas.MasivaInvalida as exc:
        raise HTTPException(status_code=409 if not exc.no_encontrada else 404,
                            detail=exc.mensaje) from exc
    db.commit()
    return CierreMasivaOut(**resultado)


@router.get("/fallas-masivas/{id_falla}/ubicacion", response_model=UbicacionOut,
            summary="Ubicación geográfica y GPS del FAT afectado (D-99 · RF-60)")
def ubicacion_falla(
    id_falla: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
) -> UbicacionOut:
    falla = _falla_de_usuario(db, id_falla, usuario)
    return svc_masivas.ubicacion(db, falla)


@router.get("/fallas-masivas/{id_falla}/reporte",
            summary="Reporte imprimible de la masiva (D-99 · RF-60)")
def reporte_falla(
    id_falla: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
) -> HTMLResponse:
    """Genera el reporte de la masiva: datos, casos asociados, materiales y cierre."""
    falla = _falla_de_usuario(db, id_falla, usuario)
    salida = _salida1(db, falla)
    casos = svc_masivas.casos_asociados(db, falla)
    ubicacion = svc_masivas.ubicacion(db, falla)
    ordenes = list(db.scalars(
        select(OrdenMaterial).where(OrdenMaterial.id_falla == id_falla)
        .order_by(OrdenMaterial.id_orden)
    ).all())

    def _esc(valor: object) -> str:
        return (
            str(valor if valor is not None else "—")
            .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        )

    filas_casos = "".join(
        "<tr>"
        f"<td>{_esc(c.id_averia)}</td><td>{_esc(c.estado_actual)}</td>"
        f"<td>{_esc(c.ruta)}</td><td>{_esc(c.sector_nombre)}</td>"
        f"<td>{_esc(c.nombre_cliente)}</td><td>{_esc(c.direccion)}</td>"
        f"<td>{_esc(c.cuadrilla_codigo)}</td>"
        "</tr>"
        for c in casos
    )
    filas_ordenes = "".join(
        "<tr>"
        f"<td>{_esc(o.id_orden)}</td><td>{_esc(o.estado)}</td>"
        f"<td>{_esc(o.solicitante_usuario)}</td><td>{_esc(o.observacion)}</td>"
        f"<td>{_esc(o.fecha)}</td>"
        "</tr>"
        for o in ordenes
    )
    validador = salida.validador_crass
    html = f"""<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8">
<title>Reporte de masiva #{_esc(falla.id_falla)}</title>
<style>
 body {{ font-family: system-ui, "Segoe UI", Roboto, sans-serif; margin: 24px; color: #1c2733; }}
 h1 {{ font-size: 20px; }} h2 {{ font-size: 15px; margin-top: 22px; }}
 table {{ border-collapse: collapse; width: 100%; font-size: 12px; }}
 th, td {{ border: 1px solid #cbd5e1; padding: 5px 7px; text-align: left; }}
 th {{ background: #eef2f7; }}
 .datos th {{ width: 190px; background: #f8fafc; }}
 @media print {{ .no-imprimir {{ display: none; }} }}
</style></head><body>
<h1>Reporte de falla masiva #{_esc(falla.id_falla)}</h1>
<table class="datos"><tbody>
<tr><th>Estado</th><td>{_esc(salida.estado)}</td></tr>
<tr><th>Origen</th><td>{_esc(salida.origen)}</td></tr>
<tr><th>Concentración</th><td>{_esc(salida.clave_concentracion)}</td></tr>
<tr><th>Descripción</th><td>{_esc(salida.descripcion)}</td></tr>
<tr><th>ODN</th><td>{_esc(salida.odn)}</td></tr>
<tr><th>FAT</th><td>{_esc(salida.fat)}</td></tr>
<tr><th>RUTA</th><td>{_esc(salida.ruta)}</td></tr>
<tr><th>Dirección</th><td>{_esc(salida.direccion)}</td></tr>
<tr><th>Sector</th><td>{_esc(salida.sector_nombre)}</td></tr>
<tr><th>Cuadrilla</th><td>{_esc(salida.cuadrilla_codigo)}</td></tr>
<tr><th>Casos asociados</th><td>{len(casos)}</td></tr>
<tr><th>Casos cerrados</th><td>{_esc(salida.casos_cerrados)}</td></tr>
<tr><th>Detectada</th><td>{_esc(salida.fecha_deteccion)}</td></tr>
<tr><th>Planificación</th><td>{_esc(salida.planificacion)}</td></tr>
<tr><th>Ubicación</th><td>{_esc(ubicacion.latitud)}, {_esc(ubicacion.longitud)}
    ({_esc(ubicacion.origen)})</td></tr>
<tr><th>Descripción del cierre</th><td>{_esc(salida.descripcion_cierre)}</td></tr>
<tr><th>Valida (CRASS)</th><td>{_esc(validador.nombre if validador else None)}
    · {_esc(validador.unidad if validador else None)}
    · {_esc(validador.contacto if validador else None)}</td></tr>
<tr><th>Cerrada por / en</th><td>{_esc(salida.cerrada_por)} · {_esc(salida.cerrada_en)}</td></tr>
<tr><th>Evidencias del cierre</th><td>{_esc(", ".join(salida.evidencias_cierre))}</td></tr>
</tbody></table>

<h2>Casos asociados ({len(casos)})</h2>
<table><thead><tr><th>Avería</th><th>Estado</th><th>RUTA</th><th>Sector</th>
<th>Cliente</th><th>Dirección</th><th>Cuadrilla</th></tr></thead>
<tbody>{filas_casos or '<tr><td colspan="7">Sin casos asociados</td></tr>'}</tbody></table>

<h2>Materiales solicitados ({len(ordenes)})</h2>
<table><thead><tr><th>Orden</th><th>Estado</th><th>Solicitante</th>
<th>Observación</th><th>Fecha</th></tr></thead>
<tbody>{filas_ordenes or '<tr><td colspan="5">Sin órdenes de material</td></tr>'}</tbody></table>

<p class="no-imprimir" style="margin-top:22px">
  <button onclick="window.print()">Imprimir</button>
</p>
</body></html>"""
    return HTMLResponse(content=html)


# --------------------------------------------------------------------------- #
# Outbox de notificaciones (RNF-20)
# --------------------------------------------------------------------------- #
@router.get("/notificaciones", response_model=list[NotificacionOut],
            summary="Bandeja de notificaciones")
def listar_notificaciones(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
    estado: str | None = None,
    canal: str | None = None,
    limite: int = Query(default=100, ge=1, le=500),
) -> list[Notificacion]:
    stmt = select(Notificacion).order_by(Notificacion.id_notificacion.desc()).limit(limite)
    if usuario.rol.codigo == "COORDINADOR":
        central = resolver_central(db, None, cargar_config(db), usuario)
        casos_central = select(Caso.id_caso).where(Caso.id_central == central.id_central)
        stmt = stmt.where(Notificacion.id_caso.in_(casos_central))
    if estado:
        stmt = stmt.where(Notificacion.estado == estado)
    if canal:
        stmt = stmt.where(Notificacion.canal == canal)
    return list(db.scalars(stmt).all())


@router.post("/notificaciones/procesar", response_model=ProcesarOutboxOut,
             summary="Procesar el outbox (reintentos)")
def procesar_notificaciones(
    db: Session = Depends(get_db),
    _: Usuario = Depends(_escritura),
    limite: int = Query(default=50, ge=1, le=200),
) -> ProcesarOutboxOut:
    resultado = outbox.procesar(db, limite)
    db.commit()
    return ProcesarOutboxOut(**resultado)


# --------------------------------------------------------------------------- #
# Bot de Telegram (RF-06, RF-16)
# --------------------------------------------------------------------------- #
def _responder_telegram(db: Session, chat_id: str, texto: str) -> None:
    outbox.encolar(db, canal="TELEGRAM", destinatario=chat_id,
                   asunto="GGTO", cuerpo=texto)
    db.commit()
    outbox.procesar(db, limite=5)
    db.commit()


def _comando(db: Session, texto: str, chat_id: str) -> str:
    partes = texto.strip().split(maxsplit=1)
    comando = partes[0].lower().lstrip("/")
    argumento = partes[1].strip() if len(partes) > 1 else ""
    central = resolver_central(db, None, cargar_config(db))

    if comando in ("start", "ayuda", "help"):
        return ("GGTO — Central Francisco Salias\n"
                "Comandos: /estado · /caso <id_averia> · /falla <descripción>")
    if comando == "estado":
        pendientes = db.scalar(
            select(func.count()).select_from(Caso).where(
                Caso.id_central == central.id_central,
                Caso.estado_actual.notin_(("CERRADO", "CANCELADO")))
        ) or 0
        activas = db.scalar(
            select(func.count()).select_from(FallaMasiva).where(
                FallaMasiva.id_central == central.id_central,
                FallaMasiva.estado.in_(("DETECTADA", "PLANIFICADA")))
        ) or 0
        return (f"Casos pendientes: {pendientes}\n"
                f"Fallas masivas activas: {activas}")
    if comando == "caso":
        if not argumento:
            return "Uso: /caso <id_averia>"
        caso = db.scalar(select(Caso).where(Caso.id_averia == argumento))
        if caso is None:
            return f"No encontré el caso {argumento}"
        return (f"{caso.id_averia} · {caso.estado_actual}\n"
                f"{caso.nombre_cliente or ''} · {caso.telefono or ''}\n"
                f"{caso.direccion or ''}\nProblema: {caso.problema_reporte or '—'}")
    if comando == "falla":
        if not argumento:
            return "Uso: /falla <descripción de la falla>"
        falla = FallaMasiva(
            id_central=central.id_central,
            descripcion=f"[Telegram {chat_id}] {argumento}",
            origen="REPORTE_TECNICO",
            id_cuadrilla=svc_fallas.cuadrilla_cercana(db, central.id_central, None),
            estado="DETECTADA",
        )
        db.add(falla)
        db.flush()
        return f"✅ Falla masiva registrada (#{falla.id_falla}). Se notificó al supervisor."
    return "Comando no reconocido. Use /ayuda."


@router.post("/telegram/webhook", summary="Webhook del bot de Telegram")
async def telegram_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
) -> dict:
    config = cargar_config(db)
    esperado = str(config.get("telegram.webhook_secret") or "").strip('"')
    if esperado and x_telegram_bot_api_secret_token != esperado:
        raise HTTPException(status_code=403, detail="Secreto del webhook inválido")

    update: dict[str, Any] = await request.json()
    mensaje = update.get("message") or update.get("edited_message") or {}
    chat_id = str((mensaje.get("chat") or {}).get("id", ""))
    texto = mensaje.get("text") or ""
    if not chat_id or not texto:
        return {"ok": True, "ignorado": True}

    respuesta = _comando(db, texto, chat_id)
    _responder_telegram(db, chat_id, respuesta)
    return {"ok": True, "respuesta": respuesta}


# --------------------------------------------------------------------------- #
# Servidor MCP (RF-06)
# --------------------------------------------------------------------------- #
TOOLS = [
    {"name": "estado_central", "description": "Resumen de casos pendientes y fallas activas",
     "inputSchema": {"type": "object", "properties": {}}},
    {"name": "consultar_caso", "description": "Busca un caso por id de avería o teléfono",
     "inputSchema": {"type": "object", "properties": {"id_averia": {"type": "string"},
                                                      "telefono": {"type": "string"}}}},
    {"name": "reportar_falla", "description": "Registra una falla masiva reportada",
     "inputSchema": {"type": "object", "properties": {"descripcion": {"type": "string"}},
                     "required": ["descripcion"]}},
    {"name": "procesar_notificaciones", "description": "Procesa el outbox de notificaciones",
     "inputSchema": {"type": "object", "properties": {}}},
]


def _tool_estado(db: Session) -> dict:
    central = resolver_central(db, None, cargar_config(db))
    pendientes = db.scalar(
        select(func.count()).select_from(Caso).where(
            Caso.id_central == central.id_central,
            Caso.estado_actual.notin_(("CERRADO", "CANCELADO")))
    ) or 0
    activas = db.scalar(
        select(func.count()).select_from(FallaMasiva).where(
            FallaMasiva.id_central == central.id_central,
            FallaMasiva.estado.in_(("DETECTADA", "PLANIFICADA")))
    ) or 0
    return {"central": central.nombre_central, "casos_pendientes": pendientes,
            "fallas_activas": activas}


def _tool_caso(db: Session, argumentos: dict) -> dict:
    id_averia = (argumentos.get("id_averia") or "").strip()
    telefono = (argumentos.get("telefono") or "").strip()
    if not id_averia and not telefono:
        raise ValueError("Indique id_averia o telefono")
    stmt = select(Caso)
    stmt = stmt.where(Caso.id_averia == id_averia) if id_averia else stmt.where(
        Caso.telefono.ilike(f"%{telefono}%"))
    caso = db.scalar(stmt.limit(1))
    if caso is None:
        return {"encontrado": False}
    return {"encontrado": True, "id_averia": caso.id_averia, "estado": caso.estado_actual,
            "cliente": caso.nombre_cliente, "telefono": caso.telefono,
            "direccion": caso.direccion, "sector": caso.id_sector}


def _tool_falla(db: Session, argumentos: dict) -> dict:
    descripcion = (argumentos.get("descripcion") or "").strip()
    if len(descripcion) < 5:
        raise ValueError("La descripción es obligatoria (mínimo 5 caracteres)")
    central = resolver_central(db, None, cargar_config(db))
    falla = FallaMasiva(
        id_central=central.id_central, descripcion=f"[MCP] {descripcion}",
        origen="MCP", id_cuadrilla=svc_fallas.cuadrilla_cercana(db, central.id_central, None),
        estado="DETECTADA",
    )
    db.add(falla)
    db.flush()
    svc_fallas.alertar(db, falla)
    db.commit()
    return {"id_falla": falla.id_falla, "estado": falla.estado,
            "cuadrilla": falla.id_cuadrilla}


@router.post("/mcp", summary="Servidor MCP (JSON-RPC 2.0)")
async def mcp(
    request: Request,
    db: Session = Depends(get_db),
    x_mcp_key: str | None = Header(default=None),
) -> dict:
    config = cargar_config(db)
    esperada = str(config.get("mcp.api_key") or "").strip('"')
    if esperada and x_mcp_key != esperada:
        return {"jsonrpc": "2.0", "id": None,
                "error": {"code": -32001, "message": "Clave MCP inválida"}}

    cuerpo: dict[str, Any] = await request.json()
    metodo = cuerpo.get("method")
    ident = cuerpo.get("id")
    params = cuerpo.get("params") or {}

    if metodo == "initialize":
        resultado: Any = {
            "protocolVersion": "2024-11-05",
            "capabilities": {"tools": {}},
            "serverInfo": {"name": "ggto-mcp", "version": MCP_VERSION},
        }
    elif metodo == "tools/list":
        resultado = {"tools": TOOLS}
    elif metodo == "tools/call":
        nombre = params.get("name")
        argumentos = params.get("arguments") or {}
        try:
            if nombre == "estado_central":
                datos = _tool_estado(db)
            elif nombre == "consultar_caso":
                datos = _tool_caso(db, argumentos)
            elif nombre == "reportar_falla":
                datos = _tool_falla(db, argumentos)
            elif nombre == "procesar_notificaciones":
                datos = outbox.procesar(db, 20)
                db.commit()
            else:
                raise ValueError(f"Herramienta desconocida: {nombre}")
        except ValueError as exc:
            return {"jsonrpc": "2.0", "id": ident,
                    "error": {"code": -32602, "message": str(exc)}}
        resultado = {"content": [{"type": "text", "text": str(datos)}], "datos": datos}
    else:
        return {"jsonrpc": "2.0", "id": ident,
                "error": {"code": -32601, "message": f"Método no soportado: {metodo}"}}

    return {"jsonrpc": "2.0", "id": ident, "result": resultado}


# --------------------------------------------------------------------------- #
# Observabilidad (RNF-19)
# --------------------------------------------------------------------------- #
@router.get("/metricas", response_model=MetricasOut,
            summary="Métricas de negocio y estado de los canales")
def metricas(db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)) -> MetricasOut:
    por_estado = dict(db.execute(select(Caso.estado_actual, func.count()).group_by(Caso.estado_actual)).all())
    por_categoria = dict(db.execute(select(Caso.categoria, func.count()).group_by(Caso.categoria)).all())
    out = outbox.metricas(db)
    return MetricasOut(
        casos_total=sum(por_estado.values()),
        casos_por_estado=por_estado,
        casos_por_categoria=por_categoria,
        lotes_ingesta=db.scalar(select(func.count()).select_from(IngestaLote)) or 0,
        casos_ingeridos=db.scalar(
            select(func.count()).select_from(Caso).where(Caso.origen == "INGESTA_CSV")) or 0,
        fallas_activas=db.scalar(
            select(func.count()).select_from(FallaMasiva).where(
                FallaMasiva.estado.in_(("DETECTADA", "PLANIFICADA")))) or 0,
        notificaciones_pendientes=out["notificaciones_pendientes"],
        notificaciones_enviadas=out["notificaciones_enviadas"],
        notificaciones_fallidas=out["notificaciones_fallidas"],
        canales_configurados={
            "telegram": bool(os.environ.get("TELEGRAM_BOT_TOKEN")),
            "correo": bool(os.environ.get("SMTP_HOST")),
        },
    )
