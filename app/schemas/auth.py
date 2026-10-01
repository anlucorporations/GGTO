"""Esquemas Pydantic del Ciclo 1 (autenticación)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    p00: str = Field(min_length=3, max_length=20, examples=["2324X001"])
    clave: str = Field(min_length=4, max_length=128)


class UsuarioOut(BaseModel):
    p00: str
    correo: str | None = None
    rol: str
    id_rol: int
    id_central: int | None = None
    nombre: str | None = None
    apellido: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    usuario: UsuarioOut


class PalabraPosicion(BaseModel):
    pos: int = Field(ge=1, le=12, description="Posición de la palabra (1..12)")
    valor: str = Field(min_length=1, max_length=40)


class UnlockRequest(BaseModel):
    p00: str = Field(min_length=3, max_length=20)
    palabras: list[PalabraPosicion] = Field(min_length=3, max_length=3)


class ResetPasswordRequest(BaseModel):
    p00: str = Field(min_length=3, max_length=20)
    palabras: list[PalabraPosicion] = Field(min_length=3, max_length=3)
    nueva_clave: str = Field(min_length=8, max_length=128)


class SetupRequest(BaseModel):
    """Primer inicio de la app: fija la clave del P00 y genera las 12 palabras."""

    p00: str = Field(min_length=3, max_length=20)
    correo: str = Field(min_length=5, max_length=120)
    clave: str = Field(min_length=8, max_length=128)
    confirmacion: str = Field(min_length=8, max_length=128)


class SetupResponse(BaseModel):
    p00: str
    palabras: list[str]
    aviso: str = "Guarde estas 12 palabras: no se volverán a mostrar."


class PrimerAccesoOut(BaseModel):
    """Estado del P00 para ofrecer (o no) el proceso de primer acceso (D-67)."""

    p00: str
    registrado: bool
    estado: str
    puede_registrarse: bool = False
    nombre: str | None = None
    mensaje: str


class RegenerarPalabrasRequest(BaseModel):
    p00: str = Field(min_length=3, max_length=20)


class RegenerarPalabrasResponse(BaseModel):
    p00: str
    palabras: list[str]
    aviso: str = (
        "Entregue estas 12 palabras al técnico por un canal seguro: no se volverán a mostrar."
    )


# --------------------------------------------------------------------------- #
# Perfil y cuenta (D-72)
# --------------------------------------------------------------------------- #
class CambioClaveRequest(BaseModel):
    """Cambio de la propia clave: exige la clave actual (RNF-01)."""

    clave_actual: str = Field(min_length=1, max_length=128)
    clave_nueva: str = Field(min_length=8, max_length=128)
    confirmacion: str = Field(min_length=8, max_length=128)


class MeUpdate(BaseModel):
    """Edición del propio perfil: solo el correo por ahora (D-72)."""

    correo: str = Field(min_length=5, max_length=120)


class MiSeguridadOut(BaseModel):
    """Estado de las 12 palabras de seguridad (nunca devuelven valores)."""

    p00: str
    tiene_palabras: bool
    version: int | None = None
    cantidad: int = 0
    actualizado_en: str | None = None
    requiere_cambio_clave: bool = False
    bloqueado: bool = False
