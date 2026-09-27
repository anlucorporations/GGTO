"""ALERTAS, Telegram y MCP — RF-06, RF-09, RF-16, RF-17, RF-18 / RNF-19, RNF-20."""

from __future__ import annotations

import os
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..models import Caso, FallaMasiva, IngestaLote, Notificacion, OrdenMaterial, Usuario
from ..schemas.alertas import (
    FallaMasivaManual,
    FallaMasivaOut,
    FallaMasivaUpdate,
    MaterialRequest,
    MetricasOut,
    NotificacionOut,
    PlanificacionRequest,
    ProcesarOutboxOut,
)
from ..services import fallas as svc_fallas
from ..services import outbox
from ..services.consultas import cargar_config, resolver_central
from .deps import get_current_user, require_roles

router = APIRouter(prefix="/api/v1", tags=["alertas, telegram y mcp"])
_escritura = require_roles("ADMIN", "SUPERVISOR")
MCP_VERSION = "0.1.0"


def _o_404(db: Session, id_falla: int) -> FallaMasiva:
    falla = db.get(FallaMasiva, id_falla)
    if falla is None:
        raise HTTPException(status_code=404, detail="Falla masiva no encontrada")
    return falla


# --------------------------------------------------------------------------- #
# Fallas masivas (RF-09, RF-16, RF-17)
# --------------------------------------------------------------------------- #
@router.get("/fallas-masivas", response_model=list[FallaMasivaOut],
            summary="Fallas masivas registradas")
def listar_fallas(
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
    estado: str | None = None,
    id_central: int | None = None,
    solo_activas: bool = Query(default=False),
) -> list[FallaMasiva]:
    stmt = select(FallaMasiva).order_by(FallaMasiva.id_falla.desc())
    if estado:
        stmt = stmt.where(FallaMasiva.estado == estado)
    if id_central:
        stmt = stmt.where(FallaMasiva.id_central == id_central)
    if solo_activas:
        stmt = stmt.where(FallaMasiva.estado.in_(("DETECTADA", "PLANIFICADA")))
    return list(db.scalars(stmt).all())


@router.post("/fallas-masivas", response_model=FallaMasivaOut,
             status_code=status.HTTP_201_CREATED, summary="Reportar una falla masiva")
def reportar_falla(
    datos: FallaMasivaManual,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_escritura),
) -> FallaMasiva:
    central = resolver_central(db, None, cargar_config(db))
    id_cuadrilla = datos.id_cuadrilla or svc_fallas.cuadrilla_cercana(
        db, central.id_central, datos.id_sector)
    falla = FallaMasiva(
        id_central=central.id_central,
        descripcion=datos.descripcion,
        origen=datos.origen,
        id_sector=datos.id_sector,
        id_cuadrilla=id_cuadrilla,
        estado="DETECTADA",
    )
    db.add(falla)
    db.flush()
    svc_fallas.alertar(db, falla)
    db.commit()
    db.refresh(falla)
    return falla


@router.post("/fallas-masivas/detectar", response_model=list[FallaMasivaOut],
             summary="Detectar fallas masivas por concentración")
def detectar_fallas(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_escritura),
) -> list[FallaMasiva]:
    central = resolver_central(db, None, cargar_config(db))
    creadas = svc_fallas.detectar(db, central.id_central)
    db.commit()
    for falla in creadas:
        db.refresh(falla)
    return creadas


@router.patch("/fallas-masivas/{id_falla}", response_model=FallaMasivaOut,
              summary="Actualizar estado o cuadrilla de la falla")
def actualizar_falla(
    id_falla: int,
    datos: FallaMasivaUpdate,
    db: Session = Depends(get_db),
    _: Usuario = Depends(_escritura),
) -> FallaMasiva:
    falla = _o_404(db, id_falla)
    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(falla, campo, valor)
    db.commit()
    db.refresh(falla)
    return falla


@router.post("/fallas-masivas/{id_falla}/planificacion", response_model=FallaMasivaOut,
             summary="Documentar la planificación de atención (RF-17)")
def planificar_falla(
    id_falla: int,
    datos: PlanificacionRequest,
    db: Session = Depends(get_db),
    _: Usuario = Depends(_escritura),
) -> FallaMasiva:
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
    return falla


@router.post("/fallas-masivas/{id_falla}/material", status_code=status.HTTP_201_CREATED,
             summary="Solicitar material para la falla (RF-18)")
def solicitar_material(
    id_falla: int,
    datos: MaterialRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_escritura),
) -> dict:
    falla = _o_404(db, id_falla)
    orden = OrdenMaterial(
        id_cuadrilla=datos.id_cuadrilla or falla.id_cuadrilla,
        solicitante_usuario=usuario.p00,
        estado="SOLICITADA",
        observacion=f"[Falla {falla.id_falla}] {datos.descripcion}",
    )
    db.add(orden)
    db.commit()
    db.refresh(orden)
    return {"id_orden": orden.id_orden, "estado": orden.estado,
            "observacion": orden.observacion, "id_falla": falla.id_falla}


# --------------------------------------------------------------------------- #
# Outbox de notificaciones (RNF-20)
# --------------------------------------------------------------------------- #
@router.get("/notificaciones", response_model=list[NotificacionOut],
            summary="Bandeja de notificaciones")
def listar_notificaciones(
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
    estado: str | None = None,
    canal: str | None = None,
    limite: int = Query(default=100, ge=1, le=500),
) -> list[Notificacion]:
    stmt = select(Notificacion).order_by(Notificacion.id_notificacion.desc()).limit(limite)
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
