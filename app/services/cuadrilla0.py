"""Criterio combinado de la cuadrilla 0 del supervisor (RF-25 / D-22).

Modos (`despacho.criterio_cuadrilla0`):
- `CAMPO`      → solo PROCEDIMIENTO 3: va al supervisor si **no** amerita campo.
- `SUPERVISOR` → solo GENERALIDADES 3.5: va si contiene frases de no-atención en casa.
- `UNION`      → cualquiera de los dos (por defecto).
"""

from __future__ import annotations

from typing import Any

from .ingesta import normalizar

MODO_POR_DEFECTO = "UNION"
FRASES_CAMPO_POR_DEFECTO = ("LOSS ROJO", "FALLA FIBRA", "FIBRA DANADA")
FRASES_SUPERVISOR_POR_DEFECTO = ("NAVEGACION LENTA", "PON INTERMITENTE", "SIN TONO")
COLUMNAS_POR_DEFECTO = ("problema_reporte", "ultimo_comentario", "informacion")


def _lista(config: dict[str, Any], clave: str, defecto: tuple[str, ...]) -> tuple[str, ...]:
    valor = config.get(clave)
    if isinstance(valor, (list, tuple)) and valor:
        return tuple(str(v) for v in valor)
    return defecto


def evaluar(fila: dict[str, Any], config: dict[str, Any] | None = None) -> bool:
    """Devuelve True si el caso debe ir a la cuadrilla 0 del supervisor."""
    config = config or {}
    columna = _lista(config, "despacho.columnas_evaluar", COLUMNAS_POR_DEFECTO)
    frases_campo = [normalizar(f) for f in _lista(config, "despacho.frases_campo", FRASES_CAMPO_POR_DEFECTO)]
    frases_supervisor = [
        normalizar(f) for f in _lista(config, "despacho.frases_supervisor", FRASES_SUPERVISOR_POR_DEFECTO)
    ]
    modo = str(config.get("despacho.criterio_cuadrilla0") or MODO_POR_DEFECTO).upper()

    texto = normalizar(" ".join(str(fila.get(c) or "") for c in columna))
    tiene_campo = any(frase in texto for frase in frases_campo)
    tiene_supervisor = any(frase in texto for frase in frases_supervisor)

    if modo == "CAMPO":
        return not tiene_campo
    if modo == "SUPERVISOR":
        return tiene_supervisor
    return tiene_supervisor or not tiene_campo
