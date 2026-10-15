"""Analiza la imagen de referencia (autogestion) y extrae su paleta real.

Genera docs/propuesta-visual/recursos/paleta_referencia.json con:
  - k-means de la imagen completa (8 grupos) con su porcentaje de area
  - bandas verticales (degradado dominante arriba -> abajo)
  - bandas horizontales
  - colores extremos (oscuridad maxima, saturacion maxima)
  - puntos claros (patron de trama/trama de puntos) por cuadrante
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image

RAIZ = Path(__file__).resolve().parents[1]
IMG = RAIZ / "recursos" / "referencia-autogestion.jpg"
SALIDA = RAIZ / "recursos" / "paleta_referencia.json"


def hex_de(rgb: np.ndarray) -> str:
    return "#{:02x}{:02x}{:02x}".format(*(int(c) for c in rgb))


def kmeans(pixeles: np.ndarray, k: int = 8, iteraciones: int = 40, semilla: int = 7):
    rng = np.random.default_rng(semilla)
    centroides = pixeles[rng.choice(len(pixeles), k, replace=False)].astype(float)
    for _ in range(iteraciones):
        dist = ((pixeles[:, None, :] - centroides[None, :, :]) ** 2).sum(axis=2)
        etiquetas = dist.argmin(axis=1)
        for i in range(k):
            grupo = pixeles[etiquetas == i]
            if len(grupo):
                centroides[i] = grupo.mean(axis=0)
    dist = ((pixeles[:, None, :] - centroides[None, :, :]) ** 2).sum(axis=2)
    etiquetas = dist.argmin(axis=1)
    conteo = np.bincount(etiquetas, minlength=k)
    orden = np.argsort(-conteo)
    return [
        {
            "hex": hex_de(centroides[i].round()),
            "rgb": [int(c) for c in centroides[i].round()],
            "porcentaje": round(100 * conteo[i] / len(pixeles), 2),
        }
        for i in orden
    ]


def main() -> None:
    img = Image.open(IMG).convert("RGB")
    ancho, alto = img.size
    arr = np.asarray(img)
    plano = arr.reshape(-1, 3).astype(float)

    # Muestra reducida para el k-means (rapidez) pero representativa.
    idx = np.linspace(0, len(plano) - 1, min(40000, len(plano))).astype(int)
    grupos = kmeans(plano[idx], k=8)

    def banda(y0: float, y1: float, x0: float = 0.0, x1: float = 1.0):
        sub = arr[int(y0 * alto):int(y1 * alto), int(x0 * ancho):int(x1 * ancho)]
        return hex_de(sub.reshape(-1, 3).mean(axis=0).round())

    vertical = {
        "0-10%": banda(0.0, 0.10),
        "10-25%": banda(0.10, 0.25),
        "25-40%": banda(0.25, 0.40),
        "40-55%": banda(0.40, 0.55),
        "55-70%": banda(0.55, 0.70),
        "70-85%": banda(0.70, 0.85),
        "85-100%": banda(0.85, 1.0),
    }
    horizontal = {
        "izq": banda(0.0, 1.0, 0.0, 0.10),
        "centro-izq": banda(0.0, 1.0, 0.35, 0.45),
        "centro": banda(0.0, 1.0, 0.45, 0.55),
        "centro-der": banda(0.0, 1.0, 0.55, 0.65),
        "der": banda(0.0, 1.0, 0.90, 1.0),
    }

    brillo = plano.mean(axis=1)
    hsv = np.asarray(Image.open(IMG).convert("HSV")).reshape(-1, 3).astype(float)
    saturacion = hsv[:, 1]
    matiz = hsv[:, 0]

    claros = arr.reshape(-1, 3)[brillo > 200]
    esquinas = {
        "sup-izq": hex_de(arr[8, 8]),
        "sup-der": hex_de(arr[8, ancho - 9]),
        "centro": hex_de(arr[alto // 2, ancho // 2]),
        "inf-izq": hex_de(arr[alto - 9, 8]),
        "inf-der": hex_de(arr[alto - 9, ancho - 9]),
    }

    # Trama de puntos: densidad de pixeles claros en rejilla 6x10.
    celdas = []
    for f in range(10):
        fila = []
        for c in range(6):
            bloque = brillo.reshape(alto, ancho)[
                f * alto // 10:(f + 1) * alto // 10, c * ancho // 6:(c + 1) * ancho // 6
            ]
            fila.append(round(100 * float((bloque > 170).mean()), 2))
        celdas.append(fila)

    datos = {
        "imagen": str(IMG.name),
        "dimensiones": {"ancho": ancho, "alto": alto, "relacion": round(ancho / alto, 3)},
        "kmeans": grupos,
        "bandas_verticales": vertical,
        "bandas_horizontales": horizontal,
        "esquinas": esquinas,
        "matiz_dominante_grados": round(float(np.median(matiz)) / 255 * 360, 1),
        "saturacion_media": round(float(saturacion.mean()) / 255, 3),
        "brillo_medio": round(float(brillo.mean()), 1),
        "mas_claro": hex_de(claros.mean(axis=0).round()) if len(claros) else None,
        "pixeles_muy_claros_pct": round(100 * float((brillo > 200).mean()), 2),
        "densidad_trama_6x10_pct": celdas,
    }

    SALIDA.write_text(json.dumps(datos, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(datos, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
