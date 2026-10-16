"""Verificación de contraste WCAG 2.2 de la propuesta para la APK (GGTO Técnico).

Compara los colores de estado que usa hoy `lib/widgets/estado_icono.dart`
(constantes de Material) con los de la propuesta, y deja el resultado en
`recursos/contraste_apk.json`.

Uso: python docs/propuesta-visual-apk/scripts/contraste_apk.py
"""

from __future__ import annotations

import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
SALIDA = RAIZ / "recursos" / "contraste_apk.json"

# Colores de estado ACTUALES (estado_icono.dart · constantes de Material).
ACTUALES = {
    "NUEVO · indigo": "#3F51B5",
    "ASIGNADO · blue": "#2196F3",
    "CONTACTADO · orange": "#FF9800",
    "CITADO · purple": "#9C27B0",
    "DIFERIDO · red": "#F44336",
    "ENRUTADO · teal": "#009688",
    "CERRADO · green": "#4CAF50",
    "CANCELADO · blueGrey": "#607D8B",
    "EN_GESTION · brown": "#795548",
    "DESCONOCIDO · grey": "#9E9E9E",
}

# Colores de la PROPUESTA: tinta sobre su fondo claro y sobre blanco.
PROPUESTOS = {
    "Nuevo": ("#0B1BB4", "#E7ECFF"),
    "Asignado": ("#0B1BB4", "#E7ECFF"),
    "Contactado": ("#8A6100", "#FFF4D6"),
    "Citado": ("#6A13A1", "#F3E9FB"),
    "Diferido": ("#B3261E", "#FDECEA"),
    "Enrutado": ("#0F6F7A", "#E0F5F7"),
    "Cerrado": ("#1F7A4D", "#E6F5EC"),
    "Cancelado": ("#5A6684", "#EEF3FD"),
    "En gestión": ("#7A4C0B", "#FBEEDC"),
    "Desconocido": ("#5A6684", "#EEF3FD"),
}

OTROS = {
    "Texto principal sobre fondo": ("#131A2A", "#F4F7FC"),
    "Texto suave sobre blanco": ("#5A6684", "#FFFFFF"),
    "Blanco sobre azul GGTO": ("#FFFFFF", "#0B1BB4"),
    "Blanco sobre la barra de marca": ("#FFFFFF", "#050B3D"),
    "Turquesa claro sobre azul profundo": ("#5CE1E6", "#050B3D"),
    "Blanco sobre magenta del degradado": ("#FFFFFF", "#C905A5"),
    "Blanco sobre fucsia del degradado": ("#FFFFFF", "#E003A0"),
}


def luminancia(hexa: str) -> float:
    hexa = hexa.lstrip("#")
    r, g, b = (int(hexa[i:i + 2], 16) / 255 for i in (0, 2, 4))

    def canal(v: float) -> float:
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4

    return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b)


def contraste(a: str, b: str) -> float:
    la, lb = luminancia(a), luminancia(b)
    return round((max(la, lb) + 0.05) / (min(la, lb) + 0.05), 2)


def veredicto(ratio: float) -> str:
    if ratio >= 4.5:
        return "AA texto normal"
    if ratio >= 3:
        return "solo texto grande / gráficos"
    return "NO APTO (RNF-APK-05 exige 4.5:1)"


def main() -> None:
    filas_actuales = [
        {"estado": k, "hex": v, "sobre_blanco": contraste(v, "#FFFFFF"),
         "veredicto": veredicto(contraste(v, "#FFFFFF"))}
        for k, v in ACTUALES.items()
    ]
    filas_propuestas = [
        {"estado": k, "tinta": tinta, "fondo": fondo,
         "tinta_sobre_fondo": contraste(tinta, fondo),
         "tinta_sobre_blanco": contraste(tinta, "#FFFFFF"),
         "veredicto": veredicto(contraste(tinta, fondo))}
        for k, (tinta, fondo) in PROPUESTOS.items()
    ]
    filas_otros = [
        {"par": k, "a": a, "b": b, "ratio": contraste(a, b), "veredicto": veredicto(contraste(a, b))}
        for k, (a, b) in OTROS.items()
    ]

    datos = {
        "actuales_estado_icono_dart": filas_actuales,
        "propuesta_estado": filas_propuestas,
        "propuesta_otros": filas_otros,
    }
    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    SALIDA.write_text(json.dumps(datos, ensure_ascii=False, indent=2), encoding="utf-8")

    print("ACTUAL (estado_icono.dart) — icono sobre blanco")
    print("-" * 66)
    for f in filas_actuales:
        print(f"  {f['estado']:<22}{f['hex']:<10}{f['sobre_blanco']:>6}  {f['veredicto']}")

    print("\nPROPUESTA — tinta sobre el fondo claro del chip")
    print("-" * 66)
    for f in filas_propuestas:
        print(f"  {f['estado']:<14}{f['tinta_sobre_fondo']:>6}  {f['veredicto']}")

    print("\nPROPUESTA — otros pares")
    print("-" * 66)
    for f in filas_otros:
        print(f"  {f['par']:<38}{f['ratio']:>6}  {f['veredicto']}")

    print(f"\nEvidencia: {SALIDA.relative_to(RAIZ.parent.parent)}")


if __name__ == "__main__":
    main()
