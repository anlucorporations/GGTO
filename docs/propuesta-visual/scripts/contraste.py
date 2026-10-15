"""Verifica el contraste WCAG 2.2 de la paleta propuesta (GGTO · CANTV).

Uso: python contraste.py
Salida: docs/propuesta-visual/recursos/contraste.json + tabla por consola.
"""

from __future__ import annotations

import json
from itertools import combinations
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
SALIDA = RAIZ / "recursos" / "contraste.json"

COLORES = {
    "azul-electrico": "#0B1BB4",
    "azul-profundo": "#050B3D",
    "azul-accion": "#1030C9",
    "violeta": "#6A13A1",
    "purpura": "#8F0EA1",
    "magenta": "#C905A5",
    "fucsia": "#E003A0",
    "turquesa": "#00B8C4",
    "turquesa-claro": "#5CE1E6",
    "ambar-marca": "#FFDD00",
    "rojo-marca": "#EC2E38",
    "azul-marca": "#0033AA",
    "violeta-degradado": "#7C12AF",
    "superficie": "#FFFFFF",
    "fondo": "#F4F7FC",
    "borde": "#DCE3F0",
    "texto": "#131A2A",
    "texto-suave": "#5A6684",
    "exito": "#1F7A4D",
    "alerta": "#8A6100",
    "error": "#B3261E",
}

PAREJAS_OBLIGATORIAS = [
    ("texto", "superficie"), ("texto", "fondo"), ("texto-suave", "superficie"),
    ("texto-suave", "fondo"), ("superficie", "azul-accion"), ("superficie", "azul-electrico"),
    ("superficie", "azul-profundo"), ("superficie", "violeta"), ("superficie", "purpura"),
    ("superficie", "magenta"), ("superficie", "fucsia"), ("superficie", "exito"),
    ("superficie", "alerta"), ("superficie", "error"), ("superficie", "azul-marca"),
    ("texto", "turquesa"), ("azul-profundo", "turquesa"), ("azul-profundo", "turquesa-claro"),
    ("texto", "ambar-marca"), ("superficie", "fucsia"),
    ("azul-marca", "violeta-degradado"), ("azul-marca", "magenta"),
]


def a_rgb(hexa: str) -> tuple[int, int, int]:
    hexa = hexa.lstrip("#")
    return tuple(int(hexa[i:i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def luminancia(hexa: str) -> float:
    def canal(v: int) -> float:
        v /= 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4

    r, g, b = a_rgb(hexa)
    return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b)


def contraste(a: str, b: str) -> float:
    la, lb = luminancia(a), luminancia(b)
    claro, oscuro = max(la, lb), min(la, lb)
    return round((claro + 0.05) / (oscuro + 0.05), 2)


def main() -> None:
    tabla = [{"a": a, "b": b, "ratio": contraste(COLORES[a], COLORES[b])}
             for a, b in PAREJAS_OBLIGATORIAS]
    matriz = {f"{a}/{b}": contraste(COLORES[a], COLORES[b])
              for a, b in combinations(COLORES, 2)}
    datos = {"colores": COLORES, "parejas": tabla, "matriz": matriz}
    SALIDA.write_text(json.dumps(datos, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"{'A':<18}{'B':<18}{'ratio':>7}  veredicto")
    print("-" * 62)
    for fila in tabla:
        r = fila["ratio"]
        if r >= 4.5:
            veredicto = "AA texto normal"
        elif r >= 3:
            veredicto = "AA solo texto grande / UI"
        else:
            veredicto = "NO APTO texto"
        print(f"{fila['a']:<18}{fila['b']:<18}{r:>7}  {veredicto}")


if __name__ == "__main__":
    main()
