"""MONITOREO, GRÁFICOS y REPORTES — RF-07, RF-26, RF-28 (ver `RepoTecnico/metricas.md`)."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query
from fastapi.responses import HTMLResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..core.html import CABECERAS_IMPRIMIBLE, escapar
from ..models import CuadrillaTecnico, Usuario
from ..services import monitoreo as svc
from ..services import pagos
from ..services.consultas import cargar_config, resolver_central
from .deps import get_current_user, require_roles

router = APIRouter(prefix="/api/v1", tags=["monitoreo y reportes"])

# D-90: métricas de la regla REPARACIÓN/REFERIDO (el TÉCNICO no las consulta).
_gestion = require_roles("ADMIN", "SUPERVISOR")


def _central(db: Session, id_central: int | None, usuario: Usuario):
    return resolver_central(db, id_central, cargar_config(db), usuario)


def _cuadrilla_tecnico(db: Session, usuario: Usuario) -> int | None:
    """D-72: cuadrilla activa del técnico vinculado a la cuenta (si la tiene)."""
    if usuario.id_tecnico is None:
        return None
    return db.scalar(
        select(CuadrillaTecnico.id_cuadrilla)
        .where(CuadrillaTecnico.id_tecnico == usuario.id_tecnico,
               CuadrillaTecnico.hasta.is_(None))
        .limit(1)
    )


def _alcance(db: Session, usuario: Usuario, id_cuadrilla: int | None) -> int | None:
    """Cuadrilla efectiva de las consultas de monitoreo (D-72).

    El rol **TECNICO** solo ve los datos de su cuadrilla: se fuerza la suya y
    se ignora cualquier parámetro. El SUPERVISOR (y demás roles de gestión) ve
    lo global o la cuadrilla que seleccione.
    """
    if usuario.rol is not None and usuario.rol.codigo == "TECNICO":
        return _cuadrilla_tecnico(db, usuario)
    return id_cuadrilla


# --------------------------------------------------------------------------- #
# MONITOREO
# --------------------------------------------------------------------------- #
@router.get("/monitoreo/diario", summary="Gestión diaria")
def diario(
    fecha: date | None = Query(default=None),
    id_central: int | None = Query(default=None),
    id_cuadrilla: int | None = Query(default=None, description="Limitar a una cuadrilla (D-72)"),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
) -> dict:
    central = _central(db, id_central, usuario)
    return svc.gestion_diaria(db, central.id_central, fecha or svc.hoy_operativo(),
                              _alcance(db, usuario, id_cuadrilla))


@router.get("/monitoreo/semanal", summary="Gestión semanal (curva lunes a sábado)")
def semanal(
    desde: date | None = Query(default=None),
    id_central: int | None = Query(default=None),
    id_cuadrilla: int | None = Query(default=None, description="Limitar a una cuadrilla (D-72)"),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
) -> dict:
    central = _central(db, id_central, usuario)
    return svc.gestion_semanal(db, central.id_central, desde or svc.hoy_operativo(),
                               _alcance(db, usuario, id_cuadrilla))


@router.get("/monitoreo/globales", summary="Casos globales: pendientes vs resueltos")
def globales(
    desde: date | None = Query(default=None),
    hasta: date | None = Query(default=None),
    id_central: int | None = Query(default=None),
    id_cuadrilla: int | None = Query(default=None, description="Limitar a una cuadrilla (D-72)"),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
) -> dict:
    central = _central(db, id_central, usuario)
    hoy = svc.hoy_operativo()
    return svc.casos_globales(db, central.id_central, desde or hoy.replace(day=1), hasta or hoy,
                              _alcance(db, usuario, id_cuadrilla))


@router.get("/monitoreo/reparacion", summary="Pendientes de reparación por tipo")
def reparacion(
    id_central: int | None = Query(default=None),
    id_cuadrilla: int | None = Query(default=None, description="Limitar a una cuadrilla (D-72)"),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
) -> dict:
    return svc.reparacion(db, _central(db, id_central, usuario).id_central,
                          _alcance(db, usuario, id_cuadrilla))


@router.get("/monitoreo/construccion", summary="Pendientes de construcción por tipo")
def construccion(
    id_central: int | None = Query(default=None),
    id_cuadrilla: int | None = Query(default=None, description="Limitar a una cuadrilla (D-72)"),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
) -> dict:
    return svc.construccion(db, _central(db, id_central, usuario).id_central,
                            _alcance(db, usuario, id_cuadrilla))


@router.get("/monitoreo/cuadrilla", summary="Asignados vs cerrados vs gestionados por cuadrilla")
def cuadrilla(
    desde: date | None = Query(default=None),
    dias: int = Query(default=6, ge=1, le=31),
    id_central: int | None = Query(default=None),
    id_cuadrilla: int | None = Query(default=None, description="Limitar a una cuadrilla (D-72)"),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
) -> dict:
    central = _central(db, id_central, usuario)
    base, _sab = svc.rango_semana(desde or svc.hoy_operativo())
    return svc.por_cuadrilla(db, central.id_central, base, dias,
                             _alcance(db, usuario, id_cuadrilla))


@router.get("/monitoreo/capacidad", summary="Capacidad operativa")
def capacidad(
    id_central: int | None = Query(default=None),
    id_cuadrilla: int | None = Query(default=None, description="Limitar a una cuadrilla (D-72)"),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
) -> dict:
    return svc.capacidad(db, _central(db, id_central, usuario).id_central,
                         _alcance(db, usuario, id_cuadrilla))


@router.get("/monitoreo/mensual", summary="Gestión mensual (D-96)")
def mensual(
    fecha: date | None = Query(default=None),
    id_central: int | None = Query(default=None),
    id_cuadrilla: int | None = Query(default=None),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
) -> dict:
    central = _central(db, id_central, usuario)
    return svc.gestion_mensual(
        db, central.id_central, fecha or svc.hoy_operativo(), _alcance(db, usuario, id_cuadrilla)
    )


@router.get("/monitoreo/casos-especiales", summary="Resumen de casos especiales (D-96)")
def casos_especiales(
    id_central: int | None = Query(default=None),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
) -> dict:
    return svc.casos_especiales_monitor(db, _central(db, id_central, usuario).id_central)


@router.get("/monitoreo/construcciones", summary="Monitoreo de construcciones (D-96)")
def construcciones(
    id_central: int | None = Query(default=None),
    id_cuadrilla: int | None = Query(default=None),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
) -> dict:
    return svc.construccion(
        db, _central(db, id_central, usuario).id_central, _alcance(db, usuario, id_cuadrilla)
    )


@router.get("/monitoreo/reclasificaciones",
            summary="Regla REPARACIÓN ⇐ 70* + avería real: reclasificados y pendientes (D-90)")
def reclasificaciones(
    id_central: int | None = Query(default=None),
    db: Session = Depends(get_db),
    _: Usuario = Depends(_gestion),
) -> dict:
    """Métricas de RF-49/RF-50/RF-55 (ADMIN/SUPERVISOR; el TÉCNICO no las ve)."""
    return svc.reclasificaciones(db, _central(db, id_central, _).id_central)


@router.get("/monitoreo/identificadores",
            summary="Métricas por identificador de pago: reincidencia y reportes (D-94)")
def identificadores(
    id_central: int | None = Query(default=None),
    limite: int = Query(default=10, ge=1, le=50, description="Cuántos identificadores listar"),
    db: Session = Depends(get_db),
    _: Usuario = Depends(_gestion),
) -> dict:
    """RF-54/RF-55 (ADMIN/SUPERVISOR): reportes por identificador y reincidentes."""
    return svc.identificadores(
        db,
        _central(db, id_central, _).id_central,
        pagos.dias_reincidencia(cargar_config(db)),
        limite,
    )


# --------------------------------------------------------------------------- #
# REPORTES
# --------------------------------------------------------------------------- #
@router.get("/reportes/trabajo", summary="Reporte de trabajo (diario/semanal/mensual)")
def reporte(
    periodo: str = Query(default="diario", pattern="^(diario|semanal|mensual)$"),
    fecha: date | None = Query(default=None),
    id_central: int | None = Query(default=None),
    id_cuadrilla: int | None = Query(default=None, description="Limitar a una cuadrilla (D-72)"),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
) -> dict:
    central = _central(db, id_central, usuario)
    return svc.reporte_trabajo(db, central.id_central, periodo, fecha or svc.hoy_operativo(),
                               _alcance(db, usuario, id_cuadrilla))


@router.get("/reportes/trabajo/imprimible", response_class=HTMLResponse,
            summary="Reporte de trabajo imprimible")
def reporte_imprimible(
    periodo: str = Query(default="diario", pattern="^(diario|semanal|mensual)$"),
    fecha: date | None = Query(default=None),
    id_central: int | None = Query(default=None),
    id_cuadrilla: int | None = Query(default=None, description="Limitar a una cuadrilla (D-72)"),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
) -> HTMLResponse:
    central = _central(db, id_central, usuario)
    datos = svc.reporte_trabajo(db, central.id_central, periodo, fecha or svc.hoy_operativo(),
                                _alcance(db, usuario, id_cuadrilla))
    d, g, r, c = datos["diario"], datos["globales"], datos["reparacion"], datos["construccion"]

    filas_diario = "".join(
        f"<tr><td>{escapar(k.replace('_', ' ').title(), '')}</td>"
        f"<td class='num'>{escapar(v, '')}</td></tr>"
        for k, v in d.items() if k != "fecha"
    )
    filas_semana = "".join(
        f"<tr><td>{escapar(dia['fecha'], '')}</td><td class='num'>{escapar(dia['asignados'], '')}</td>"
        f"<td class='num'>{escapar(dia['cerrados'], '')}</td>"
        f"<td class='num'>{escapar(dia['gestionados'], '')}</td></tr>"
        for dia in datos["semanal"]["dias"]
    )
    filas_cuadrilla = "".join(
        f"<tr><td>{escapar(cu['codigo'], '')} — {escapar(cu['nombre'], '')}</td>"
        f"<td class='num'>{escapar(cu['totales']['asignados'], '')}</td>"
        f"<td class='num'>{escapar(cu['totales']['cerrados'], '')}</td>"
        f"<td class='num'>{escapar(cu['totales']['gestionados'], '')}</td></tr>"
        for cu in datos["cuadrilla"]["cuadrillas"]
    )
    filas_estado = "".join(
        f"<tr><td>{escapar(k, '')}</td><td class='num'>{escapar(v, '')}</td></tr>"
        for k, v in g["por_estado"].items()
    )
    # D-94: el informe también se lee desde el identificador de pago (RF-55).
    ids = datos["identificadores"]
    recl = datos["reclasificaciones"]
    filas_identificadores = "".join(
        f"<tr><td>{escapar(fila['numero'], '')}</td><td class='num'>{escapar(fila['casos'], '')}</td>"
        f"<td class='num'>{escapar(fila['reportes_ventana'], '')}</td>"
        f"<td>{'Sí' if fila['reincidente'] else 'No'}</td></tr>"
        for fila in ids["top"]
    )
    filas_reclasificaciones = "".join(
        f"<tr><td>{etiqueta}</td><td class='num'>{recl[clave]}</td></tr>"
        for clave, etiqueta in (
            ("reparaciones_validas", "Reparaciones válidas (70* + avería real)"),
            ("referidos", "Casos REFERIDO"),
            ("reclasificadas", "Reparaciones reclasificadas a REFERIDO"),
            ("referidos_sin_ficha", "Referidos sin ficha de especial"),
            ("pendientes_historicos", "Reparaciones marcadas sin regularizar"),
        )
    )

    html = f"""<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Reporte {escapar(periodo, '')} · {escapar(datos['desde'], '')}</title>
<style>
  @page {{ size: letter; margin: 1cm; }}
  body {{ font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; }}
  h1 {{ font-size: 15px; margin: 0 0 2px; }}
  h2 {{ font-size: 12px; margin: 12px 0 4px; border-bottom: 1px solid #999; }}
  .sub {{ font-size: 10px; color: #444; margin-bottom: 8px; }}
  table {{ width: 100%; border-collapse: collapse; margin-bottom: 6px; }}
  th, td {{ border: 1px solid #999; padding: 2px 4px; }}
  th {{ background: #eee; font-size: 9px; text-transform: uppercase; }}
  td.num, th.num {{ text-align: right; }}
  .tarjetas {{ display: flex; gap: 8px; margin: 6px 0; }}
  .tarjeta {{ border: 1px solid #999; padding: 6px 10px; flex: 1; text-align: center; }}
  .tarjeta b {{ display: block; font-size: 16px; }}
  @media print {{ .no-print {{ display: none; }} }}
</style></head>
<body>
  <h1>GGTO — Reporte de trabajo ({escapar(periodo, '')})</h1>
  <div class="sub">
    <strong>Central:</strong> {escapar(central.nombre_central, '')} ({escapar(central.codigo_central, '')}) ·
    <strong>Periodo:</strong> {escapar(datos['desde'], '')} → {escapar(datos['hasta'], '')} ·
    <strong>Día operativo:</strong> {escapar(svc.ZONA_OPERATIVA, '')}
  </div>

  <div class="tarjetas">
    <div class="tarjeta">Pendientes<b>{g['pendientes']}</b></div>
    <div class="tarjeta">Resueltos<b>{g['resueltos']}</b></div>
    <div class="tarjeta">Reparación<b>{r['total']}</b></div>
    <div class="tarjeta">Construcción<b>{c['total']}</b></div>
    <div class="tarjeta">Cuadrillas activas<b>{datos['capacidad']['cuadrillas_activas']}</b></div>
  </div>

  <div class="tarjetas">
    <div class="tarjeta">Identificadores de pago<b>{ids['con_casos']}</b></div>
    <div class="tarjeta">Reincidentes ({ids['ventana_dias']} d)<b>{ids['reincidentes']}</b></div>
    <div class="tarjeta">Casos sin 70*<b>{ids['casos_sin_identificador']}</b></div>
    <div class="tarjeta">Reportes por 70* (media)<b>{ids['media_casos']}</b></div>
  </div>

  <h2>Gestión del día {escapar(d['fecha'], '')}</h2>
  <table><tbody>{filas_diario}</tbody></table>

  <h2>Gestión semanal (lunes a sábado)</h2>
  <table><thead><tr><th>Fecha</th><th class="num">Asignados</th><th class="num">Cerrados</th>
  <th class="num">Gestionados</th></tr></thead><tbody>{filas_semana}</tbody></table>

  <h2>Producción por cuadrilla (semana)</h2>
  <table><thead><tr><th>Cuadrilla</th><th class="num">Asignados</th><th class="num">Cerrados</th>
  <th class="num">Gestionados</th></tr></thead><tbody>{filas_cuadrilla}</tbody></table>

  <h2>Pendientes por estado</h2>
  <table><thead><tr><th>Estado</th><th class="num">Casos</th></tr></thead>
  <tbody>{filas_estado}</tbody></table>

  <h2>Identificadores de pago con más reportes (últimos {ids['ventana_dias']} días)</h2>
  <table><thead><tr><th>Identificador (70*)</th><th class="num">Casos</th>
  <th class="num">En la ventana</th><th>Reincidente</th></tr></thead>
  <tbody>{filas_identificadores}</tbody></table>

  <h2>Regla REPARACIÓN ⇐ 70* + avería real</h2>
  <table><thead><tr><th>Indicador</th><th class="num">Casos</th></tr></thead>
  <tbody>{filas_reclasificaciones}</tbody></table>

  <p class="no-print"><button onclick="window.print()">Imprimir</button></p>
</body></html>"""
    return HTMLResponse(content=html, headers=CABECERAS_IMPRIMIBLE)
