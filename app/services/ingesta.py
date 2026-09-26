"""Parser del archivo diario `detalle_averias_gpon_<fecha>.csv`.

Reglas (RT-05 / D-27):
- delimitador `;`
- codificación **ISO-8859-1**
- **80 columnas mapeadas por posición**
- se descartan 21 columnas y se unifican `informacion`(31) + `informacion`(32) + `descripcion`(52)
- fechas `dd/mm/aaaa hh:mm:ss a.m./p.m.`
"""

from __future__ import annotations

import csv
import io
import re
import unicodedata
from datetime import datetime
from typing import Any

DELIMITADOR = ";"
CODIFICACION = "iso-8859-1"
COLUMNAS_ESPERADAS = 80
COLUMNAS_INFORMACION = (30, 31, 51)  # 0-based: cols. 31, 32 y 52 del archivo

# (campo destino, índices 0-based en el CSV, tipo)
ESPECIFICACION: tuple[tuple[str, tuple[int, ...], str], ...] = (
    ("region", (0,), "str"),
    ("estado_geografico", (1,), "str"),
    ("capital_estado", (2,), "str"),
    ("municipio", (3,), "str"),
    ("parroquia", (4,), "str"),
    ("estado_operativo", (5,), "str"),
    ("distrito", (6,), "str"),
    ("area", (7,), "str"),
    ("codigo_central", (8,), "str"),
    ("nombre_central", (9,), "str"),
    ("id_averia", (10,), "str"),
    ("telefono", (13,), "str"),
    ("fecha_reporte", (14,), "fecha"),
    ("persona_reporta", (15,), "str"),
    ("contacto_cliente", (16,), "str"),
    ("fecha_compromiso", (17,), "fecha"),
    ("fecha_cita", (18,), "fecha"),
    ("ultimo_comentario", (20,), "str"),
    ("results", (21,), "str"),
    ("asignado_a", (22,), "str"),
    ("cuadrilla_externa", (23,), "str"),
    ("estatus_origen", (26,), "str"),
    ("problema_reporte", (27,), "str"),
    ("informacion", COLUMNAS_INFORMACION, "unir"),
    ("nombre_cliente", (32,), "str"),
    ("direccion", (33,), "str"),
    ("olt", (35,), "str"),
    ("plan", (38,), "str"),
    ("slot", (39,), "str"),
    ("puerto", (40,), "str"),
    ("fat", (42,), "str"),
    ("serial", (43,), "str"),
    ("extra", (45,), "str"),
    ("area_trabajo", (46,), "str"),
    ("tipo_servicio", (49,), "str"),
    ("tipo_problema", (50,), "str"),
    ("dias_area_resolutoria", (54,), "int"),
    ("unidad_negocio", (60,), "str"),
    ("ups", (61,), "str"),
    ("codigos_gestionados_venapp", (62,), "str"),
    ("codigos_sin_gestion_venapp", (63,), "str"),
    ("reparador_principal", (64,), "str"),
    ("ayudantes", tuple(range(65, 74)), "lista"),
    ("flota_can", (74,), "str"),
    ("despacho_nombre", (75,), "str"),
    ("despacho_apellido", (76,), "str"),
    ("telefono_oficina", (77,), "str"),
    ("telefono_movil", (78,), "str"),
    ("fecha_hora_asignacion", (79,), "fecha"),
)

CAMPOS_DESTINO = tuple(campo for campo, _, _ in ESPECIFICACION)

# Longitudes máximas de los campos de texto (evita que un valor inesperado
# aborte la ingesta completa). Los campos `text` no tienen límite.
LIMITES: dict[str, int] = {
    "region": 80, "estado_geografico": 80, "capital_estado": 80, "municipio": 80,
    "parroquia": 80, "estado_operativo": 80, "distrito": 40, "area": 20,
    "codigo_central": 20, "nombre_central": 120, "id_averia": 30, "telefono": 30,
    "persona_reporta": 120, "contacto_cliente": 60, "asignado_a": 60,
    "cuadrilla_externa": 40, "estatus_origen": 20, "nombre_cliente": 160,
    "olt": 40, "plan": 60, "slot": 10, "puerto": 10, "fat": 80, "serial": 60,
    "extra": 120, "area_trabajo": 40, "tipo_servicio": 40, "tipo_problema": 20,
    "unidad_negocio": 40, "ups": 10, "codigos_gestionados_venapp": 60,
    "codigos_sin_gestion_venapp": 60, "reparador_principal": 20, "flota_can": 20,
    "despacho_nombre": 80, "despacho_apellido": 80, "telefono_oficina": 30,
    "telefono_movil": 30,
}




def normalizar(texto: str | None) -> str:
    """Mayúsculas, sin acentos y sin espacios sobrantes (para comparar frases)."""
    base = unicodedata.normalize("NFKD", (texto or "").strip().upper())
    sin_acentos = "".join(c for c in base if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", sin_acentos)


def _normalizar_fecha(valor: str) -> str:
    v = valor.strip()
    reemplazos = (
        ("a. m.", "AM"), ("p. m.", "PM"), ("a.m.", "AM"), ("p.m.", "PM"),
        ("a. m", "AM"), ("p. m", "PM"), ("a.m", "AM"), ("p.m", "PM"),
    )
    for viejo, nuevo in reemplazos:
        v = v.replace(viejo, nuevo)
        v = v.replace(viejo.upper(), nuevo)
    return re.sub(r"\s+", " ", v).upper()


def parse_fecha(valor: str | None) -> datetime | None:
    """Convierte `dd/mm/aaaa hh:mm:ss a.m./p.m.` (o variantes) en datetime."""
    if not valor or not valor.strip():
        return None
    texto = _normalizar_fecha(valor)
    for formato in (
        "%d/%m/%Y %I:%M:%S %p",
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y %I:%M %p",
        "%d/%m/%Y %H:%M",
        "%d/%m/%Y",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
    ):
        try:
            return datetime.strptime(texto, formato)
        except ValueError:
            continue
    return None


def _limpiar(valor: str | None) -> str | None:
    v = (valor or "").strip()
    return v or None


def _convertir(valor: str, tipo: str) -> Any:
    if tipo == "fecha":
        return parse_fecha(valor)
    if tipo == "int":
        try:
            return int(float(valor.strip()))
        except (TypeError, ValueError):
            return None
    return _limpiar(valor)


def decodificar(contenido: bytes) -> str:
    """Decodifica en ISO-8859-1 con fallo ruidoso (H-02)."""
    try:
        return contenido.decode(CODIFICACION)
    except UnicodeDecodeError as exc:  # pragma: no cover - latin-1 no falla
        raise ValueError(f"No se pudo decodificar el archivo como {CODIFICACION}") from exc


def parsear_encabezado(contenido: str) -> list[str]:
    lector = csv.reader(io.StringIO(contenido), delimiter=DELIMITADOR)
    try:
        return next(lector)
    except StopIteration:
        return []


def parsear(contenido: bytes | str) -> tuple[list[dict[str, Any]], list[str]]:
    """Devuelve (filas mapeadas, avisos) sin tocar la base de datos."""
    texto = decodificar(contenido) if isinstance(contenido, bytes) else contenido
    texto = texto.lstrip("\ufeff")
    lector = csv.reader(io.StringIO(texto), delimiter=DELIMITADOR)

    try:
        encabezado = next(lector)
    except StopIteration:
        return [], ["El archivo está vacío"]

    avisos: list[str] = []
    if len(encabezado) != COLUMNAS_ESPERADAS:
        avisos.append(
            f"El encabezado tiene {len(encabezado)} columnas; se esperaban {COLUMNAS_ESPERADAS}"
        )

    filas: list[dict[str, Any]] = []
    malformadas = 0
    recortados = 0
    for cruda in lector:
        if not any(celda.strip() for celda in cruda):
            continue
        if len(cruda) != COLUMNAS_ESPERADAS:
            malformadas += 1
        fila: dict[str, Any] = {}
        for campo, indices, tipo in ESPECIFICACION:
            if tipo == "unir":
                partes = [cruda[i].strip() for i in indices if i < len(cruda) and cruda[i].strip()]
                fila[campo] = " | ".join(partes) if partes else None
            elif tipo == "lista":
                fila[campo] = [
                    cruda[i].strip() for i in indices if i < len(cruda) and cruda[i].strip()
                ]
            else:
                valor = cruda[indices[0]] if indices[0] < len(cruda) else ""
                convertido = _convertir(valor, tipo)
                limite = LIMITES.get(campo)
                if isinstance(convertido, str) and limite and len(convertido) > limite:
                    convertido = convertido[:limite]
                    recortados += 1
                fila[campo] = convertido
        if not fila.get("id_averia"):
            malformadas += 1
            continue
        filas.append(fila)

    if malformadas:
        avisos.append(f"{malformadas} filas malformadas o sin id_averia (descartadas)")
    if recortados:
        avisos.append(
            f"{recortados} valores recortados por exceder la longitud de su campo"
        )
    return filas, avisos


def filtrar_por_central(filas: list[dict[str, Any]], codigo_central: str) -> list[dict[str, Any]]:
    """Conserva solo los casos de la central configurada (RF-21)."""
    objetivo = normalizar(codigo_central)
    return [f for f in filas if normalizar(f.get("codigo_central")) == objetivo]
