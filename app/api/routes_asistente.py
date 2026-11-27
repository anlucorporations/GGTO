"""ASISTENTE VIRTUAL — historial de sesiones (propuesta v2.1, ciclo C4).

El asistente `asistente-ggto` registra cada turno del chat con su usuario de
servicio (rol SUPERVISOR/ADMIN): `POST /sesiones` guarda la entrada, la
intención y la respuesta; `GET /sesiones` consulta el historial.

Recinto (RNF-AV): la escritura fuerza la **central del usuario autenticado** —
nunca se acepta la del cuerpo para roles no SUPER — y la lectura se acota a esa
misma central. Roles de acceso: ADMIN y SUPERVISOR (el SUPER entra por bypass).
"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..models import (
    AsistenteGrupo,
    AsistenteGrupoMiembro,
    AsistenteRemitente,
    AsistenteSesion,
    Central,
    Usuario,
)
from ..schemas.asistente import (
    GrupoOut,
    MiembroOut,
    RemitenteAlta,
    RemitenteOut,
    RemitenteUpdate,
    TurnoEntrada,
    TurnoOut,
)
from .deps import require_roles

router = APIRouter(prefix="/api/v1/asistente", tags=["asistente virtual"])

_acceso = require_roles("ADMIN", "SUPERVISOR")
_solo_super = require_roles()  # sin roles explícitos: solo pasa SUPER (bypass ROL_SUPER)


def _recinto(usuario: Usuario, id_central: int | None) -> int | None:
    """Central del usuario salvo SUPER (que puede indicarla o ver todas).

    Recinto forzado: si el usuario tiene central asignada, el `id_central` de
    la query **no cruza el recinto** — se ignora y se usa su central (el
    supervisor de 2324X nunca opera la central ajena, aunque la pida).
    """
    if usuario.rol is not None and usuario.rol.codigo == "SUPER":
        return id_central
    if usuario.id_central is None:
        raise HTTPException(status_code=403, detail="Su usuario no tiene central asignada")
    return usuario.id_central


@router.post("/sesiones", response_model=TurnoOut, status_code=201,
             summary="Registrar un turno del asistente (usuario de servicio)")
def registrar_turno(
    datos: TurnoEntrada,
    id_central: int | None = Query(default=None),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_acceso),
) -> AsistenteSesion:
    central = _recinto(usuario, id_central)
    turno = AsistenteSesion(
        sesion_id=datos.sesion_id,
        canal=datos.canal,
        id_central=central,
        p00=datos.p00,
        texto_entrada=datos.texto_entrada,
        intencion=datos.intencion,
        detalle=datos.detalle,
        ficha_json=datos.ficha_json,
        respuesta=datos.respuesta,
        id_grupo=datos.id_grupo,
        mensaje_id=datos.mensaje_id,
        telegram_user_id=datos.telegram_user_id,
    )
    db.add(turno)
    db.commit()
    db.refresh(turno)
    return turno


@router.get("/sesiones", response_model=list[TurnoOut],
            summary="Historial de sesiones del asistente (acotado por central)")
def historial(
    sesion_id: str | None = Query(default=None, max_length=64),
    canal: str | None = Query(default=None, pattern="^(PANEL|TELEGRAM|TELEGRAM_GRUPO)$"),
    desde: datetime | None = Query(default=None),
    limite: int = Query(default=50, ge=1, le=200),
    id_central: int | None = Query(default=None),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_acceso),
) -> list[AsistenteSesion]:
    recinto = _recinto(usuario, id_central)
    condiciones = []
    if recinto is not None:
        condiciones.append(AsistenteSesion.id_central == recinto)
    if sesion_id:
        condiciones.append(AsistenteSesion.sesion_id == sesion_id)
    if canal:
        condiciones.append(AsistenteSesion.canal == canal)
    if desde:
        condiciones.append(AsistenteSesion.creado_en >= desde.astimezone(UTC))
    consulta = (
        select(AsistenteSesion)
        .where(*condiciones)
        .order_by(AsistenteSesion.id_turno.desc())
        .limit(limite)
    )
    return list(db.scalars(consulta))


# --------------------------------------------------------------------------- #
# C5: remitentes autorizados de Telegram (alta/desactivación solo SUPER)
# --------------------------------------------------------------------------- #
@router.post("/remitentes", response_model=RemitenteOut, status_code=201,
             summary="Alta de remitente de chat (solo SUPER)")
def alta_remitente(
    datos: RemitenteAlta,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_solo_super),
) -> AsistenteRemitente:
    central = db.get(Central, datos.id_central)
    if central is None:
        raise HTTPException(status_code=404, detail="Central no encontrada")
    ya = db.scalar(select(AsistenteRemitente).where(AsistenteRemitente.chat_id == datos.chat_id))
    if ya is not None:
        raise HTTPException(status_code=409, detail="Ese chat ya está registrado")
    remitente = AsistenteRemitente(
        id_central=datos.id_central, canal=datos.canal, chat_id=datos.chat_id,
        p00=datos.p00, nombre=datos.nombre, activo=datos.activo,
    )
    db.add(remitente)
    db.commit()
    db.refresh(remitente)
    return remitente


@router.get("/remitentes", response_model=list[RemitenteOut],
            summary="Remitentes autorizados (acotado por central; el SUPER ve todas)")
def listar_remitentes(
    canal: str | None = Query(default=None, pattern="^(TELEGRAM)$"),
    chat_id: str | None = Query(default=None, max_length=64),
    activo: bool | None = Query(default=None),
    id_central: int | None = Query(default=None),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_acceso),
) -> list[AsistenteRemitente]:
    recinto = _recinto(usuario, id_central)
    condiciones = []
    if recinto is not None:
        condiciones.append(AsistenteRemitente.id_central == recinto)
    if canal:
        condiciones.append(AsistenteRemitente.canal == canal)
    if chat_id:
        condiciones.append(AsistenteRemitente.chat_id == chat_id)
    if activo is not None:
        condiciones.append(AsistenteRemitente.activo == activo)
    return list(db.scalars(
        select(AsistenteRemitente).where(*condiciones).order_by(AsistenteRemitente.id_remitente)
    ))


@router.patch("/remitentes/{id_remitente}", response_model=RemitenteOut,
              summary="Actualizar remitente (activar/desactivar; solo SUPER)")
def actualizar_remitente(
    id_remitente: int,
    datos: RemitenteUpdate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_solo_super),
) -> AsistenteRemitente:
    remitente = db.get(AsistenteRemitente, id_remitente)
    if remitente is None:
        raise HTTPException(status_code=404, detail="Remitente no encontrado")
    cambios = datos.model_dump(exclude_unset=True)
    for campo, valor in cambios.items():
        setattr(remitente, campo, valor)
    db.commit()
    db.refresh(remitente)
    return remitente


# --------------------------------------------------------------------------- #
# v2 (F3-TG-1/2): grupo de Telegram y autorización por from.id (telegram_user_id)
# --------------------------------------------------------------------------- #
@router.get("/grupos", response_model=list[GrupoOut],
            summary="Grupos de Telegram dados de alta (motor del asistente)")
def listar_grupos(
    chat_id: int | None = Query(default=None),
    activo: bool | None = Query(default=None),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_acceso),
) -> list[AsistenteGrupo]:
    """El motor consulta el grupo por `chat.id`; la identidad del emisor es `from.id`."""
    condiciones = []
    if chat_id is not None:
        condiciones.append(AsistenteGrupo.chat_id == chat_id)
    if activo is not None:
        condiciones.append(AsistenteGrupo.activo == activo)
    return list(db.scalars(
        select(AsistenteGrupo).where(*condiciones).order_by(AsistenteGrupo.id_grupo)
    ))


@router.get("/grupos/{id_grupo}/miembros", response_model=list[MiembroOut],
            summary="Miembros autorizados del grupo (identidad por from.id)")
def listar_miembros(
    id_grupo: int,
    telegram_user_id: int | None = Query(default=None),
    activo: bool | None = Query(default=None),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(_acceso),
) -> list[AsistenteGrupoMiembro]:
    condiciones = [AsistenteGrupoMiembro.id_grupo == id_grupo]
    if telegram_user_id is not None:
        condiciones.append(AsistenteGrupoMiembro.telegram_user_id == telegram_user_id)
    if activo is not None:
        condiciones.append(AsistenteGrupoMiembro.activo == activo)
    return list(db.scalars(
        select(AsistenteGrupoMiembro).where(*condiciones).order_by(AsistenteGrupoMiembro.id_miembro)
    ))
