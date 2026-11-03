"""Búsqueda por texto simple sobre **todos los criterios de la tabla de
ingesta** (RF-30 / RF-33 · D-167).

El archivo diario `detalle_averias_gpon` alimenta la especificación de
`services/ingesta.py` (D-27 · D-164): geografía, central, contactos y
teléfonos, comentarios y resultados, datos técnicos (OLT, slot, puerto, FAT,
serial, ruta en `extra`), quién atendió y códigos VENAPP, despacho, etc. La
búsqueda de texto libre recorre **todos** esos campos, con las reglas ya
vigentes:

* emparejamiento `ILIKE %termino%` (semántica de texto simple, sin cambiar);
* **D-144**: los campos de contacto/teléfono también se buscan con el número
  sin los ceros iniciales (el contacto se guarda normalizado `+58…`);
* los campos `NULL` no molestan: el `ILIKE` sobre NULL no empareja;
* `ayudantes` es `JSONB` — se compara como texto plano (cast `TEXT`), así que
  un ayudante buscado por su nombre se encuentra igual que el resto.
"""

from __future__ import annotations

import re

from sqlalchemy import ColumnElement, func, or_
from sqlalchemy.sql.sqltypes import Text as TipoTexto

from ..models import Caso

#: Campos de la tabla de ingesta que se incluyen en la búsqueda libre
#: (todo lo de `ESPECIFICACION`/`ESPECIFICACION_81` menos las fechas y el
#: entero `dias_area_resolutoria`, que no son texto de búsqueda).
CAMPOS_INGESTA: tuple[str, ...] = (
    # Geografía
    "region", "estado_geografico", "capital_estado", "municipio",
    "parroquia", "estado_operativo", "distrito", "area",
    # Central e identificador
    "codigo_central", "nombre_central", "id_averia",
    # Contactos y teléfonos (D-144 + D-164 `telefono_ip`)
    "telefono", "telefono_ip", "contacto_cliente", "telefono_oficina",
    "telefono_movil", "persona_reporta",
    # Comentarios, resultados y quién atiende
    "ultimo_comentario", "results", "asignado_a", "cuadrilla_externa",
    "estatus_origen", "problema_reporte", "informacion",
    # Cliente
    "nombre_cliente", "direccion",
    # Datos técnicos del FTTH
    "olt", "plan", "slot", "puerto", "fat", "serial", "extra",
    "area_trabajo", "tipo_servicio", "tipo_problema",
    "unidad_negocio", "ups", "codigos_gestionados_venapp",
    "codigos_sin_gestion_venapp", "reparador_principal", "ayudantes",
    "flota_can", "despacho_nombre", "despacho_apellido",
)

#: Campos de contacto que participan de la variante D-144 (número sin ceros).
CAMPOS_CONTACTO = frozenset({
    "telefono", "telefono_ip", "contacto_cliente", "telefono_oficina",
    "telefono_movil",
})


def _columna(campo: str) -> ColumnElement[str]:
    columna = getattr(Caso, campo)
    if campo == "ayudantes":  # JSONB → texto para poder ILIKE
        return func.cast(columna, TipoTexto)
    return columna


def condiciones(termino: str) -> list[ColumnElement[bool]]:
    """Condiciones `ILIKE` del texto libre sobre **todos** los campos de la
    ingesta. Se añaden a un `or_()` del que llama."""
    patron = f"%{termino}%"
    variantes: tuple[str, ...] = (patron,)
    # D-144: el contacto se guarda normalizado (+58…), así que el número local
    # («0414…») no coincidía; se busca también sin los ceros iniciales.
    solo_digitos = re.sub(r"\D", "", termino)
    if len(solo_digitos) >= 7:
        variantes += (f"%{solo_digitos.lstrip('0')}%",)
    salida: list[ColumnElement[bool]] = []
    for campo in CAMPOS_INGESTA:
        columna = _columna(campo)
        if campo in CAMPOS_CONTACTO:
            salida.extend(columna.ilike(v) for v in variantes)
        else:
            salida.append(columna.ilike(patron))
    return salida


def condicion(termino: str) -> ColumnElement[bool] | None:
    """El `or_()` completo del texto libre (None si no hay término vacío)."""
    partes = condiciones(termino)
    return or_(*partes) if partes else None
