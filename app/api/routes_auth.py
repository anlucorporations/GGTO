"""Endpoints de autenticación — RF-20 / RNF-01 / RNF-22."""

from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..core.db import get_db
from ..core.security import (
    create_access_token,
    hash_password,
    normalizar_palabra,
    verify_password,
)
from ..core.words import generar_palabras
from ..models import DispositivoSeguridad, Tecnico, Usuario
from ..schemas.auth import (
    LoginRequest,
    ResetPasswordRequest,
    SetupRequest,
    SetupResponse,
    TokenResponse,
    UnlockRequest,
    UsuarioOut,
)
from .deps import get_current_user

router = APIRouter(prefix="/api/v1/auth", tags=["autenticación"])

# --- Límite de intentos por p00+IP (RNF-22) ---------------------------------
_intentos: dict[str, deque[float]] = defaultdict(deque)


def _rate_limit(clave: str, maximo: int, ventana: int) -> None:
    ahora = time.monotonic()
    cola = _intentos[clave]
    while cola and ahora - cola[0] > ventana:
        cola.popleft()
    if len(cola) >= maximo:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiados intentos. Espere un momento.",
        )
    cola.append(ahora)


def _usuario_out(u: Usuario) -> UsuarioOut:
    return UsuarioOut(
        p00=u.p00,
        correo=u.correo,
        rol=u.rol.codigo if u.rol else "DESCONOCIDO",
        id_rol=u.id_rol,
        id_central=u.id_central,
        nombre=u.tecnico.nombre if u.tecnico else None,
        apellido=u.tecnico.apellido if u.tecnico else None,
    )


def _verificar_palabras(dispositivo: DispositivoSeguridad | None,
                        palabras: list) -> bool:
    """Comprueba 3 de las 12 palabras por posición (RF-20)."""
    if dispositivo is None or not dispositivo.palabras_hash:
        return False
    hashes: list[str] = dispositivo.palabras_hash
    for item in palabras:
        indice = item.pos - 1
        if indice < 0 or indice >= len(hashes):
            return False
        if not verify_password(hashes[indice], normalizar_palabra(item.valor)):
            return False
    return True


@router.post("/login", response_model=TokenResponse, summary="Iniciar sesión con P00 + clave")
def login(datos: LoginRequest, request: Request, db: Session = Depends(get_db)) -> TokenResponse:
    s = get_settings()
    ip = request.client.host if request.client else "desconocida"
    _rate_limit(f"{datos.p00}|{ip}", s.rate_limit_intentos, s.rate_limit_ventana_seg)

    usuario = db.scalar(select(Usuario).where(Usuario.p00 == datos.p00))
    if usuario is None:
        # Mensaje genérico: no se revela si el P00 existe.
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas")
    if not usuario.activo:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuario inactivo")
    if usuario.bloqueado:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Usuario bloqueado. Use la recuperación con sus palabras de seguridad.",
        )

    if not verify_password(usuario.clave_hash, datos.clave):
        usuario.intentos_fallidos = (usuario.intentos_fallidos or 0) + 1
        restantes = max(s.max_intentos - usuario.intentos_fallidos, 0)
        if usuario.intentos_fallidos >= s.max_intentos:
            usuario.bloqueado = True
        db.commit()
        detalle = ("Usuario bloqueado por superar los intentos permitidos"
                   if usuario.bloqueado else "Credenciales inválidas")
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED if usuario.bloqueado else status.HTTP_401_UNAUTHORIZED,
            detail=detalle,
            headers={"X-Intentos-Restantes": str(restantes)},
        )

    usuario.intentos_fallidos = 0
    usuario.bloqueado = False
    db.commit()

    token, expira = create_access_token(
        usuario.p00, usuario.rol.codigo if usuario.rol else "", 
        extra={"id_central": usuario.id_central},
    )
    return TokenResponse(access_token=token, expires_in=expira, usuario=_usuario_out(usuario))


@router.get("/me", response_model=UsuarioOut, summary="Datos del usuario autenticado")
def me(usuario: Usuario = Depends(get_current_user)) -> UsuarioOut:
    return _usuario_out(usuario)


@router.post(
    "/setup",
    response_model=SetupResponse,
    summary="Primer inicio: fija la clave y genera 12 palabras",
)
def setup(datos: SetupRequest, db: Session = Depends(get_db)) -> SetupResponse:
    """El P00 debe existir (creado por el supervisor en CONFIGURACIÓN — RF-02)."""
    if datos.clave != datos.confirmacion:
        raise HTTPException(status_code=422, detail="La clave y su confirmación no coinciden")

    usuario = db.scalar(select(Usuario).where(Usuario.p00 == datos.p00))
    if usuario is None:
        raise HTTPException(status_code=404, detail="El P00 no está registrado por el supervisor")

    s = get_settings()
    palabras = generar_palabras(s.palabras_seguridad)
    hashes = [hash_password(normalizar_palabra(p)) for p in palabras]

    usuario.clave_hash = hash_password(datos.clave)
    usuario.correo = datos.correo
    usuario.intentos_fallidos = 0
    usuario.bloqueado = False
    usuario.requiere_cambio_clave = False

    dispositivo = db.scalar(
        select(DispositivoSeguridad).where(DispositivoSeguridad.p00 == datos.p00)
    )
    if dispositivo is None:
        dispositivo = DispositivoSeguridad(p00=datos.p00)
        db.add(dispositivo)
    dispositivo.palabras_hash = hashes
    dispositivo.version = (dispositivo.version or 0) + 1
    dispositivo.bloqueado = False

    # Sincroniza el correo del técnico asociado, si existe.
    if usuario.id_tecnico:
        tecnico = db.get(Tecnico, usuario.id_tecnico)
        if tecnico:
            tecnico.correo = datos.correo

    db.commit()
    return SetupResponse(p00=datos.p00, palabras=palabras)


@router.post("/unlock", summary="Desbloquear con 3 de las 12 palabras de seguridad")
def unlock(datos: UnlockRequest, db: Session = Depends(get_db)) -> dict:
    usuario = db.scalar(select(Usuario).where(Usuario.p00 == datos.p00))
    if usuario is None:
        raise HTTPException(status_code=404, detail="P00 no encontrado")
    dispositivo = db.scalar(
        select(DispositivoSeguridad).where(DispositivoSeguridad.p00 == datos.p00)
    )
    if not _verificar_palabras(dispositivo, datos.palabras):
        raise HTTPException(status_code=401, detail="Palabras de seguridad incorrectas")

    usuario.bloqueado = False
    usuario.intentos_fallidos = 0
    if dispositivo:
        dispositivo.bloqueado = False
    db.commit()
    return {"p00": usuario.p00, "bloqueado": False, "mensaje": "Usuario desbloqueado"}


@router.post("/reset-password", summary="Restablecer la clave con 3 de las 12 palabras")
def reset_password(datos: ResetPasswordRequest, db: Session = Depends(get_db)) -> dict:
    usuario = db.scalar(select(Usuario).where(Usuario.p00 == datos.p00))
    if usuario is None:
        raise HTTPException(status_code=404, detail="P00 no encontrado")
    dispositivo = db.scalar(
        select(DispositivoSeguridad).where(DispositivoSeguridad.p00 == datos.p00)
    )
    if not _verificar_palabras(dispositivo, datos.palabras):
        raise HTTPException(status_code=401, detail="Palabras de seguridad incorrectas")

    usuario.clave_hash = hash_password(datos.nueva_clave)
    usuario.bloqueado = False
    usuario.intentos_fallidos = 0
    usuario.requiere_cambio_clave = False
    db.commit()
    return {"p00": usuario.p00, "mensaje": "Clave restablecida"}
