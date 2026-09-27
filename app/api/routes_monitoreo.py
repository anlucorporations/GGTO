"""MONITOREO, GRÁFICOS y REPORTES — RF-07, RF-26, RF-28 (ver `RepoTecnico/metricas.md`)."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..models import Usuario
from ..services import monitoreo as svc
from ..services.consultas import cargar_config, resolver_central
from .deps import get_current_user

router = APIRouter(prefix="/api/v1", tags=["monitoreo y reportes"])


def _central(db: Session, id_central: int | None):
    return resolver_central(db, id_central, cargar_config(db))


# --------------------------------------------------------------------------- #
# MONITOREO
# --------------------------------------------------------------------------- #
@router.get("/monitoreo/diario", summary="Gestión diaria")
def diario(
    fecha: date | None = Query(default=None),
    id_central: int | None = Query(default=None),
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
) -> dict:
    central = _central(db, id_central)
    return svc.gestion_diaria(db, central.id_central, fecha or date.today())


@router.get("/monitoreo/semanal", summary="Gestión semanal (curva lunes a sábado)")
def semanal(
    desde: date | None = Query(default=None),
    id_central: int | None = Query(default=None),
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
) -> dict:
    central = _central(db, id_central)
    return svc.gestion_semanal(db, central.id_central, desde or date.today())


@router.get("/monitoreo/globales", summary="Casos globales: pendientes vs resueltos")
def globales(
    desde: date | None = Query(default=None),
    hasta: date | None = Query(default=None),
    id_central: int | None = Query(default=None),
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
) -> dict:
    central = _central(db, id_central)
    hoy = date.today()
    return svc.casos_globales(db, central.id_central, desde or hoy.replace(day=1), hasta or hoy)


@router.get("/monitoreo/reparacion", summary="Pendientes de reparación por tipo")
def reparacion(
    id_central: int | None = Query(default=None),
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
) -> dict:
    return svc.reparacion(db, _central(db, id_central).id_central)


@router.get("/monitoreo/construccion", summary="Pendientes de construcción por tipo")
def construccion(
    id_central: int | None = Query(default=None),
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
) -> dict:
    return svc.construccion(db, _central(db, id_central).id_central)


@router.get("/monitoreo/cuadrilla", summary="Asignados vs cerrados vs gestionados por cuadrilla")
def cuadrilla(
    desde: date | None = Query(default=None),
    dias: int = Query(default=6, ge=1, le=31),
    id_central: int | None = Query(default=None),
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
) -> dict:
    central = _central(db, id_central)
    base, _sab = svc.rango_semana(desde or date.today())
    return svc.por_cuadrilla(db, central.id_central, base, dias)


@router.get("/monitoreo/capacidad", summary="Capacidad operativa")
def capacidad(
    id_central: int | None = Query(default=None),
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
) -> dict:
    return svc.capacidad(db, _central(db, id_central).id_central)


# --------------------------------------------------------------------------- #
# REPORTES
# --------------------------------------------------------------------------- #
@router.get("/reportes/trabajo", summary="Reporte de trabajo (diario/semanal/mensual)")
def reporte(
    periodo: str = Query(default="diario", pattern="^(diario|semanal|mensual)$"),
    fecha: date | None = Query(default=None),
    id_central: int | None = Query(default=None),
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
) -> dict:
    central = _central(db, id_central)
    return svc.reporte_trabajo(db, central.id_central, periodo, fecha or date.today())


@router.get("/reportes/trabajo/imprimible", response_class=HTMLResponse,
            summary="Reporte de trabajo imprimible")
def reporte_imprimible(
    periodo: str = Query(default="diario", pattern="^(diario|semanal|mensual)$"),
    fecha: date | None = Query(default=None),
    id_central: int | None = Query(default=None),
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
) -> HTMLResponse:
    central = _central(db, id_central)
    datos = svc.reporte_trabajo(db, central.id_central, periodo, fecha or date.today())
    d, g, r, c = datos["diario"], datos["globales"], datos["reparacion"], datos["construccion"]

    filas_diario = "".join(
        f"<tr><td>{k.replace('_', ' ').title()}</td><td class='num'>{v}</td></tr>"
        for k, v in d.items() if k != "fecha"
    )
    filas_semana = "".join(
        f"<tr><td>{dia['fecha']}</td><td class='num'>{dia['asignados']}</td>"
        f"<td class='num'>{dia['cerrados']}</td><td class='num'>{dia['gestionados']}</td></tr>"
        for dia in datos["semanal"]["dias"]
    )
    filas_cuadrilla = "".join(
        f"<tr><td>{cu['codigo']} — {cu['nombre']}</td>"
        f"<td class='num'>{cu['totales']['asignados']}</td>"
        f"<td class='num'>{cu['totales']['cerrados']}</td>"
        f"<td class='num'>{cu['totales']['gestionados']}</td></tr>"
        for cu in datos["cuadrilla"]["cuadrillas"]
    )
    filas_estado = "".join(
        f"<tr><td>{k}</td><td class='num'>{v}</td></tr>" for k, v in g["por_estado"].items()
    )

    html = f"""<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Reporte {periodo} · {datos['desde']}</title>
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
  <h1>GGTO — Reporte de trabajo ({periodo})</h1>
  <div class="sub">
    <strong>Central:</strong> {central.nombre_central} ({central.codigo_central}) ·
    <strong>Periodo:</strong> {datos['desde']} → {datos['hasta']}
  </div>

  <div class="tarjetas">
    <div class="tarjeta">Pendientes<b>{g['pendientes']}</b></div>
    <div class="tarjeta">Resueltos<b>{g['resueltos']}</b></div>
    <div class="tarjeta">Reparación<b>{r['total']}</b></div>
    <div class="tarjeta">Construcción<b>{c['total']}</b></div>
    <div class="tarjeta">Cuadrillas activas<b>{datos['capacidad']['cuadrillas_activas']}</b></div>
  </div>

  <h2>Gestión del día {d['fecha']}</h2>
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

  <p class="no-print"><button onclick="window.print()">Imprimir</button></p>
</body></html>"""
    return HTMLResponse(content=html)
