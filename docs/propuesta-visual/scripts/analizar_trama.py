"""Localiza el patron de trama de puntos en la imagen de referencia.

Devuelve las cajas donde hay puntos (resaltado local sobre el fondo) y el
color de esos puntos, para poder reproducir la trama en CSS/SVG.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

RAIZ = Path(__file__).resolve().parents[1]
IMG = RAIZ / "recursos" / "referencia-autogestion.jpg"
SALIDA = RAIZ / "recursos" / "trama_puntos.json"


def main() -> None:
    arr = np.asarray(Image.open(IMG).convert("RGB")).astype(float)
    brillo = arr.mean(axis=2)
    fondo = np.asarray(
        Image.fromarray(brillo.astype(np.uint8)).filter(ImageFilter.GaussianBlur(9))
    ).astype(float)
    resalte = brillo - fondo  # puntos claros sobre fondo oscuro
    mascara = resalte > 12

    alto, ancho = mascara.shape
    celdas = []
    for f in range(12):
        for c in range(6):
            bloque = mascara[f * alto // 12:(f + 1) * alto // 12, c * ancho // 6:(c + 1) * ancho // 6]
            pct = 100 * float(bloque.mean())
            if pct > 1.0:
                celdas.append({
                    "fila": f, "col": c,
                    "y_pct": round(100 * f / 12, 1),
                    "x_pct": round(100 * c / 6, 1),
                    "cobertura_pct": round(pct, 2),
                })

    pixeles = arr[mascara]
    color_punto = "#{:02x}{:02x}{:02x}".format(*[int(v) for v in pixeles.mean(axis=0).round()]) if len(pixeles) else None
    # Delta medio de luminancia entre punto y fondo local.
    delta = float(resalte[mascara].mean()) if mascara.any() else 0.0

    # Espaciado: autocorrelacion vertical/horizontal sobre una zona con puntos.
    espaciado = None
    mask = np.argwhere(mascara)
    if len(mask):
        y0, x0 = mask.min(axis=0)
        y1, x1 = mask.max(axis=0)
        recorte = mascara[y0:y1 + 1, x0:x1 + 1].astype(float)
        if recorte.shape[0] > 20:
            perfil = recorte.mean(axis=1)
            ac = np.correlate(perfil - perfil.mean(), perfil - perfil.mean(), mode="full")[len(perfil) - 1:]
            ac /= ac[0] if ac[0] else 1
            picos = [i for i in range(3, min(len(ac) - 1, 40)) if ac[i] > ac[i - 1] and ac[i] >= ac[i + 1] and ac[i] > 0.2]
            if picos:
                espaciado = {"espaciado_vertical_px": int(picos[0]), "confianza": round(float(ac[picos[0]]), 3)}
        caja = {"x0": int(x0), "y0": int(y0), "x1": int(x1), "y1": int(y1),
                "x_pct": round(100 * x0 / ancho, 1), "y_pct": round(100 * y0 / alto, 1),
                "ancho_pct": round(100 * (x1 - x0) / ancho, 1), "alto_pct": round(100 * (y1 - y0) / alto, 1)}
    else:
        caja = None

    datos = {
        "color_punto_medio": color_punto,
        "delta_brillo_medio": round(delta, 1),
        "caja_puntos": caja,
        "espaciado": espaciado,
        "celdas_con_puntos": celdas,
    }
    SALIDA.write_text(json.dumps(datos, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(datos, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
