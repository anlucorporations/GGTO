"""Resolución del caso: cierre (RF-15 · RF-61/RF-62).

La lógica de cierre nació en `routes_casos.cerrar_caso` (D-70) y se extrajo aquí
en D-99 para que el **cierre en cascada de una masiva** cierre los casos asociados
exactamente por la misma vía que el cierre individual, sin duplicar reglas.

No hace `commit`: quien llama decide la unidad de trabajo, de modo que cerrar N
casos de una masiva sea una sola transacción.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Actividad, Caso, CasoEstadoHist, CatalogoMetodo, Evidencia, Usuario
from . import clasificacion


class CierreInvalido(Exception):
    """El cierre no procede (caso ya cerrado o modo inexistente en el catálogo)."""

    def __init__(self, mensaje: str, *, ya_cerrado: bool = False) -> None:
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.ya_cerrado = ya_cerrado


def metodo_cierre(db: Session, codigo: str) -> CatalogoMetodo:
    """Devuelve el método de cierre del catálogo (dominio CIERRE)."""
    metodo = db.scalar(
        select(CatalogoMetodo).where(
            CatalogoMetodo.dominio == "CIERRE", CatalogoMetodo.codigo == codigo
        )
    )
    if metodo is None:
        raise CierreInvalido(f"El modo de cierre {codigo} no está en el catálogo")
    return metodo


def registrar_estado(db: Session, caso: Caso, nuevo: str, motivo: str | None,
                     usuario: str | None) -> None:
    """Anota el cambio de estado en la bitácora y lo aplica al caso (RNF-12).

    D-120: es el camino **único** de los cambios de estado, así que aquí se
    sincroniza también la ficha del caso especial (`caso_especial.estado`): sin
    esto, cerrar un referido desde la APK dejaba su especial en `ABIERTO` para
    siempre y parecía que «no se cerraba».
    """
    if nuevo == caso.estado_actual:
        return
    db.add(
        CasoEstadoHist(
            id_caso=caso.id_caso,
            estado_anterior=caso.estado_actual,
            estado_nuevo=nuevo,
            motivo=motivo,
            usuario=usuario,
        )
    )
    caso.estado_actual = nuevo
    clasificacion.sincronizar_estado_especial(db, caso)


def cerrar_caso(
    db: Session,
    caso: Caso,
    *,
    modo: str,
    descripcion: str,
    evidencias: list[str] | None = None,
    id_causa: int | None = None,
    usuario: Usuario | None = None,
    p00: str | None = None,
    sincronizado: bool = True,
    id_actividad_local: int | None = None,
    dispositivo_id: str | None = None,
) -> Actividad:
    """Cierra el caso: actividad CIERRE + evidencias + estado CERRADO.

    `usuario` es el usuario de la API; `p00` permite cerrar en nombre del sistema
    (cierre en cascada de una masiva) sin un `Usuario` cargado.
    `id_actividad_local`/`dispositivo_id` (D-121) identifican la acción de la cola
    de la APK para que el reenvío del lote no duplique el cierre.
    """
    if caso.estado_actual == "CERRADO":
        raise CierreInvalido(
            "El caso ya está cerrado; reabra el estado antes de registrar otro cierre",
            ya_cerrado=True,
        )
    metodo = metodo_cierre(db, modo)
    autor = p00 if p00 is not None else (usuario.p00 if usuario else None)

    actividad = Actividad(
        id_caso=caso.id_caso,
        id_usuario=usuario.id_usuario if usuario else None,
        tipo="CIERRE",
        resultado="CERRADO",
        reporte_corto=descripcion,
        id_metodo=metodo.id_metodo,
        id_causa=id_causa,
        fecha_hora=datetime.now(UTC),
        sincronizado=sincronizado,
        id_actividad_local=id_actividad_local,
        dispositivo_id=dispositivo_id,
    )
    db.add(actividad)
    db.flush()

    ahora = datetime.now(UTC)
    for indice, serial in enumerate(evidencias or [], start=1):
        limpio = serial.strip()
        if not limpio:
            continue
        db.add(
            Evidencia(
                id_actividad=actividad.id_actividad,
                tipo="DEMO",
                # El serial debe ser único en toda la tabla: se incluye el id de la
                # actividad para poder cerrar/reabrir el mismo caso varias veces.
                serial_imagen=(
                    f"{caso.id_averia}-A{actividad.id_actividad}-CIERRE-{indice:02d}"[:160]
                ),
                ruta_remota=limpio[:255],
                fecha_hora=ahora,
                origen_camara=False,
            )
        )

    registrar_estado(db, caso, "CERRADO", f"Cierre con {modo}", autor)
    clasificacion.aplicar_en_cambio(db, caso, "CIERRE", autor)
    return actividad
