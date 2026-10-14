"""Dependencias de la API: sesión de BD, usuario autenticado y RBAC."""

from __future__ import annotations

from collections.abc import Callable

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..core.security import decode_token
from ..models import Usuario

bearer = HTTPBearer(auto_error=False)

#: Rol con acceso total a todas las secciones y funciones de la plataforma.
ROL_SUPER = "SUPER"

CREDENCIALES_INVALIDAS = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Credenciales inválidas o token expirado",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    cred: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> Usuario:
    if cred is None or not cred.credentials:
        raise CREDENCIALES_INVALIDAS
    try:
        payload = decode_token(cred.credentials)
    except jwt.PyJWTError as exc:  # token inválido/expirado
        raise CREDENCIALES_INVALIDAS from exc

    p00 = payload.get("sub")
    if not p00:
        raise CREDENCIALES_INVALIDAS

    usuario = db.scalar(select(Usuario).where(Usuario.p00 == p00))
    if usuario is None or not usuario.activo:
        raise CREDENCIALES_INVALIDAS
    if usuario.bloqueado:
        raise HTTPException(status_code=status.HTTP_423_LOCKED, detail="Usuario bloqueado")

    # D-95: Acotado real por central en la sesión de base de datos
    if db.bind and db.bind.dialect.name == "postgresql":
        if usuario.rol and usuario.rol.codigo == ROL_SUPER:
            db.execute(text("SELECT set_config('app.sin_acotar', 'on', true)"))
        if usuario.id_central is not None:
            db.execute(
                text("SELECT set_config('app.id_central', :c, true)"),
                {"c": str(usuario.id_central)},
            )

    return usuario


def require_roles(*roles: str) -> Callable[[Usuario], Usuario]:
    """Fábrica de dependencia para exigir uno de los roles indicados (RNF-21).

    El rol **SUPER** (Super Usuario) tiene acceso total: se le concede cualquier
    operación sin necesidad de enumerarlo en cada endpoint.
    """

    def _check(usuario: Usuario = Depends(get_current_user)) -> Usuario:
        if usuario.rol is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tiene permisos para esta operación",
            )
        if usuario.rol.codigo == ROL_SUPER or usuario.rol.codigo in roles:
            return usuario
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene permisos para esta operación",
        )

    return _check


# Guards por capacidad (D-95 / H-09 / H-10 / DEC-G8 / DEC-G9 / DEC-G17)
_material = require_roles("ADMIN", "SUPERVISOR", "COORDINADOR")
_especial_alta = require_roles("ADMIN", "SUPERVISOR", "COORDINADOR")
_envio_supervisor = require_roles("COORDINADOR")
_falla_escritura = require_roles("ADMIN", "SUPERVISOR")
_auditoria_lectura = require_roles()  # solo SUPER pasa gracias al bypass ROL_SUPER
