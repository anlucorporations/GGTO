"""Sectorización de casos por coincidencia sobre `direccion` (RF-23 / D-07)."""

from __future__ import annotations

import re
from dataclasses import dataclass

from .ingesta import normalizar


@dataclass(frozen=True)
class Patron:
    id_sector: int
    patron: str
    tipo_coincidencia: str = "CONTIENE"
    normalizar: bool = True


def _preparar(texto: str, aplicar_normalizacion: bool) -> str:
    return normalizar(texto) if aplicar_normalizacion else (texto or "").strip()


def asignar_sector(direccion: str | None, patrones: list[Patron]) -> int | None:
    """Devuelve el `id_sector` que corresponde a la dirección, o `None`.

    Orden de evaluación: mayor longitud de patrón primero (más específico gana),
    y a igualdad, el orden en que llegan los patrones (ya vienen ordenados por
    prioridad de sector desde la consulta).
    """
    if not direccion:
        return None

    ordenados = sorted(patrones, key=lambda p: len(p.patron), reverse=True)
    objetivo_normalizado = normalizar(direccion)
    objetivo_crudo = direccion.strip()

    for p in ordenados:
        if not p.patron:
            continue
        if p.tipo_coincidencia == "REGEX":
            try:
                if re.search(p.patron, objetivo_normalizado if p.normalizar else objetivo_crudo,
                             re.IGNORECASE):
                    return p.id_sector
            except re.error:
                continue
            continue

        aguja = _preparar(p.patron, p.normalizar)
        pajar = objetivo_normalizado if p.normalizar else objetivo_crudo
        if not aguja:
            continue
        if p.tipo_coincidencia == "EXACTO":
            if pajar == aguja:
                return p.id_sector
        elif aguja in pajar:  # CONTIENE
            return p.id_sector
    return None
