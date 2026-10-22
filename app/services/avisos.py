"""Avisos al solicitante externo (ACT-03 / RF-34).

El solicitante de un caso especial no tiene un portal público: se registró en el
catálogo con su canal de contacto. Al cerrar el caso se le informa por el
**outbox** existente, de modo que el aviso no se pierda si el canal no tiene
credenciales o si el contacto es manual.

Reglas de esta implementación:

- solo se avisa al pasar a ``CERRADO`` y solo si el caso quedó realmente
  ``CERRADO`` (no en ``ENRUTADO`` ni ``CANCELADO``);
- el aviso se deduplica por caso, canal y asunto;
- ``MANUAL`` y ``MCP_IA`` dejan la notificación **PENDIENTE** en el outbox
  (entrega manual por el supervisor), sin abrir una superficie pública;
- queda una fila de auditoría con el canal y el destinatario usado.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Auditoria, Caso, CasoEspecial, Notificacion, Solicitante
from . import outbox

CANALES_AUTOMATICOS = {"TELEGRAM", "CORREO"}
ACCION = "AVISO_CIERRE_SOLICITANTE"


def _cuerpo_aviso(caso: Caso, especial: CasoEspecial, solicitante: Solicitante) -> str:
    identificador = caso.id_averia or f"caso {caso.id_caso}"
    detalle = (especial.informe or especial.descripcion or "").strip()
    lineas = [
        f"Estimado(a) {solicitante.nombre} ({solicitante.unidad}):",
        "",
        f"Le informamos que el caso {identificador} fue cerrado.",
        f"Dirección: {caso.direccion or 'no registrada'}.",
    ]
    if detalle:
        lineas.append(f"Detalle de la atención: {detalle}")
    lineas += [
        "",
        "Este aviso se genera automáticamente desde GGTO. No responda a este mensaje.",
    ]
    return "\n".join(lineas)


def avisar_cierre_especial(
    db: Session, especial: CasoEspecial, caso: Caso
) -> Notificacion | None:
    """Encola el aviso de cierre al solicitante del especial.

    No hace ``commit``: se ejecuta dentro de la transacción del cierre del caso o
    del cambio de estado del especial. Devuelve la notificación creada o ``None``
    si no había solicitante, ya existía el aviso o no había caso asociado.
    """
    if especial.id_solicitante is None:
        return None
    solicitante = db.get(Solicitante, especial.id_solicitante)
    if solicitante is None:
        return None

    canal_solicitado = (solicitante.canal or "MANUAL").upper()
    canal = canal_solicitado if canal_solicitado in CANALES_AUTOMATICOS else "MANUAL"
    asunto = f"Cierre del caso {caso.id_averia or caso.id_caso}"
    ya_encolado = db.scalar(
        select(Notificacion.id_notificacion).where(
            Notificacion.id_caso == caso.id_caso,
            Notificacion.canal == canal,
            Notificacion.asunto == asunto,
        )
    )
    if ya_encolado is not None:
        return None

    notificacion = outbox.encolar(
        db,
        canal=canal,
        asunto=asunto,
        cuerpo=_cuerpo_aviso(caso, especial, solicitante),
        destinatario=solicitante.contacto,
        id_caso=caso.id_caso,
    )
    db.flush()
    db.add(
        Auditoria(
            id_central=caso.id_central,
            usuario="SISTEMA",
            accion=ACCION,
            entidad="caso_especial",
            id_entidad=str(especial.id_caso_especial),
            datos_despues={
                "id_caso": caso.id_caso,
                "id_averia": caso.id_averia,
                "id_solicitante": solicitante.id_solicitante,
                "canal_solicitado": canal_solicitado,
                "canal_outbox": canal,
                "destinatario": solicitante.contacto,
                "id_notificacion": notificacion.id_notificacion,
            },
        )
    )
    return notificacion
