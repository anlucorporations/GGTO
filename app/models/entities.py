"""Modelos SQLAlchemy del Ciclo 1 (se mapean al esquema ya desplegado en `db/schema.sql`)."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.db import Base


class Rol(Base):
    __tablename__ = "rol"

    id_rol: Mapped[int] = mapped_column(Integer, primary_key=True)
    codigo: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    nombre: Mapped[str] = mapped_column(String(80), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text)
    permisos: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Central(Base):
    __tablename__ = "central"

    id_central: Mapped[int] = mapped_column(Integer, primary_key=True)
    region: Mapped[str] = mapped_column(String(80), nullable=False)
    estado_geografico: Mapped[str] = mapped_column(String(80), nullable=False)
    capital_estado: Mapped[str | None] = mapped_column(String(80))
    municipio: Mapped[str] = mapped_column(String(80), nullable=False)
    parroquia: Mapped[str] = mapped_column(String(80), nullable=False)
    estado_operativo: Mapped[str | None] = mapped_column(String(80))
    distrito: Mapped[str | None] = mapped_column(String(40))
    area: Mapped[str] = mapped_column(String(20), nullable=False)
    codigo_central: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    nombre_central: Mapped[str] = mapped_column(String(120), nullable=False)
    activa: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    actualizado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Tecnico(Base):
    __tablename__ = "tecnico"

    id_tecnico: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_central: Mapped[int] = mapped_column(ForeignKey("central.id_central"), nullable=False)
    nombre: Mapped[str] = mapped_column(String(80), nullable=False)
    apellido: Mapped[str | None] = mapped_column(String(80))
    cedula: Mapped[str | None] = mapped_column(String(20), unique=True)
    p00: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    telefono: Mapped[str | None] = mapped_column(String(30))
    correo: Mapped[str | None] = mapped_column(String(120))
    especialidad: Mapped[str | None] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVO")
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    actualizado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Usuario(Base):
    __tablename__ = "usuario"

    id_usuario: Mapped[int] = mapped_column(Integer, primary_key=True)
    p00: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    correo: Mapped[str | None] = mapped_column(String(120), unique=True)
    clave_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    id_rol: Mapped[int] = mapped_column(ForeignKey("rol.id_rol"), nullable=False)
    id_tecnico: Mapped[int | None] = mapped_column(ForeignKey("tecnico.id_tecnico"))
    id_central: Mapped[int | None] = mapped_column(ForeignKey("central.id_central"))
    intentos_fallidos: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    bloqueado: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    bloqueo_cliente: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    requiere_cambio_clave: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    ultimo_acceso: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    actualizado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    rol: Mapped[Rol] = relationship(lazy="joined")
    tecnico: Mapped[Tecnico | None] = relationship(lazy="joined")


class DispositivoSeguridad(Base):
    __tablename__ = "dispositivo_seguridad"

    id_dispositivo: Mapped[int] = mapped_column(Integer, primary_key=True)
    p00: Mapped[str] = mapped_column(
        ForeignKey("usuario.p00", ondelete="CASCADE"), unique=True, nullable=False
    )
    palabras_hash: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    clave_privada_ref: Mapped[str | None] = mapped_column(String(255))
    documento_cifrado: Mapped[str | None] = mapped_column(Text)
    bloqueado: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    actualizado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Auditoria(Base):
    """Bitácora de acciones sensibles (RF de gobernanza / D-67).

    El acceso y la regeneración de palabras de seguridad quedan registrados
    aquí para que el Super Usuario pueda auditar la recuperación de cuentas.
    """

    __tablename__ = "auditoria"

    id_auditoria: Mapped[int] = mapped_column(Integer, primary_key=True)
    usuario: Mapped[str | None] = mapped_column(String(20))
    accion: Mapped[str] = mapped_column(String(60), nullable=False)
    entidad: Mapped[str | None] = mapped_column(String(60))
    id_entidad: Mapped[str | None] = mapped_column(String(40))
    datos_antes: Mapped[dict | None] = mapped_column(JSONB)
    datos_despues: Mapped[dict | None] = mapped_column(JSONB)
    fecha_hora: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Actividad(Base):
    """Acción de campo sobre un caso: contacto, cierre, enrutado o diferido.

    Es la tabla que usa la app móvil (Ciclo 8); el escritorio también registra
    aquí los cierres y enrutados hechos desde la ficha del caso (D-70), para no
    duplicar el modelo. `id_metodo` apunta al catálogo (IVR/COS/SACAS en CIERRE).
    """

    __tablename__ = "actividad"

    id_actividad: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_caso: Mapped[int] = mapped_column(
        ForeignKey("caso.id_caso", ondelete="CASCADE"), nullable=False
    )
    id_usuario: Mapped[int | None] = mapped_column(ForeignKey("usuario.id_usuario"))
    id_cuadrilla: Mapped[int | None] = mapped_column(ForeignKey("cuadrilla.id_cuadrilla"))
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)
    resultado: Mapped[str | None] = mapped_column(String(20))
    reporte_corto: Mapped[str | None] = mapped_column(Text)
    id_metodo: Mapped[int | None] = mapped_column(ForeignKey("catalogo_metodo.id_metodo"))
    id_causa: Mapped[int | None] = mapped_column(ForeignKey("causa.id_causa"))
    fecha_hora: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    latitud: Mapped[float | None] = mapped_column(Numeric(10, 7))
    longitud: Mapped[float | None] = mapped_column(Numeric(10, 7))
    sincronizado: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Evidencia(Base):
    """Evidencia asociada a una actividad (potencia, navegación o demostración)."""

    __tablename__ = "evidencia"

    id_evidencia: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_actividad: Mapped[int] = mapped_column(
        ForeignKey("actividad.id_actividad", ondelete="CASCADE"), nullable=False
    )
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)
    serial_imagen: Mapped[str] = mapped_column(String(160), nullable=False, unique=True)
    ruta_local: Mapped[str | None] = mapped_column(String(255))
    ruta_remota: Mapped[str | None] = mapped_column(String(255))
    latitud: Mapped[float | None] = mapped_column(Numeric(10, 7))
    longitud: Mapped[float | None] = mapped_column(Numeric(10, 7))
    fecha_hora: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    origen_camara: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
