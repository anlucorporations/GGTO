#!/usr/bin/env python3
"""Ingesta diaria 04/11/2026 y devolución a PENDIENTE de los casos CERRADO que reaparecen.

=============================================================================
QUÉ HACE
    1. Lee de `detalle_averias_gpon 04_11_2026.csv` los `id_averia` del archivo.
    2. Consulta los casos AVERIA en CERRADO y cruza con esos `id_averia`.
    3. (--aplicar) Ejecuta la ingesta oficial `POST /api/v1/ingesta`.
    4. (--aplicar) Pasa a PENDIENTE cada caso CERRADO reaparecido con
       `POST /api/v1/casos/{id}/estado` (bitácora caso_estado_hist, D-120).
    5. (--aplicar) Ejecuta la detección de masivas RF-09.

USO (PowerShell)
    $env:GGTO_URL   = 'https://ggto-web-593453426217.europe-west1.run.app'
    $env:GGTO_TOKEN = $tok   # JWT del SUPER
    python scripts/ejecutar_ingesta_04_11.py                # simulación
    python scripts/ejecutar_ingesta_04_11.py --aplicar --si
=============================================================================
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request

MOTIVO = "Reingresado por la ingesta diaria del 04/11/2026 (sigue en el archivo de la central)"
CSV_PATH = r"C:\GGTO\GGTOv2-DSH-GCCP\RepoTecnico\detalle_averias_gpon 04_11_2026.csv"
COLUMNA_AVERIA = "id_averia"
TIMEOUT = 60


def leer_averias_csv(ruta: str) -> set[str]:
    with open(ruta, mode="r", encoding="iso-8859-1", newline="") as f:
        lector = csv.reader(f, delimiter=";")
        encabezado = [h.strip().lower() for h in next(lector)]
        idx = encabezado.index(COLUMNA_AVERIA)
        return {fila[idx].strip() for fila in lector if len(fila) > idx and fila[idx].strip()}


def pedir_json(url: str, token: str, *, metodo: str = "GET", cuerpo: dict | None = None):
    datos = json.dumps(cuerpo).encode("utf-8") if cuerpo is not None else None
    req = urllib.request.Request(
        url, data=datos, method=metodo,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        try:
            return exc.code, json.loads(exc.read().decode("utf-8"))
        except Exception:
            return exc.code, {}


def subir_ingesta(url: str, token: str, ruta: str, *, preview: bool) -> dict:
    destino = f"{url}/api/v1/ingesta/preview" if preview else f"{url}/api/v1/ingesta"
    cmd = ["curl.exe", "-s", "-X", "POST", destino,
           "-H", f"Authorization: Bearer {token}",
           "-F", f"archivo=@{ruta}"]
    salida = subprocess.run(cmd, capture_output=True, text=True, check=False).stdout
    return json.loads(salida)


def main() -> int:
    p = argparse.ArgumentParser(description="Ingesta 04/11 + devolución a PENDIENTE de cerrados")
    p.add_argument("--aplicar", action="store_true", help="Ejecuta (por defecto simula)")
    p.add_argument("--si", action="store_true", help="Omite la confirmación interactiva")
    p.add_argument("--sin-ingesta", action="store_true",
                   help="No vuelve a cargar el archivo (la ingesta ya corrió)")
    args = p.parse_args()

    base = (os.environ.get("GGTO_URL") or "").rstrip("/")
    token = os.environ.get("GGTO_TOKEN") or ""
    if not base or not token:
        print("ERROR: exporta GGTO_URL y GGTO_TOKEN antes de ejecutar.")
        return 2

    averias_csv = leer_averias_csv(CSV_PATH)
    print(f"CSV: {len(averias_csv)} id_averia distintos")

    prev = subir_ingesta(base, token, CSV_PATH, preview=True)
    print("== preview de la ingesta:")
    for clave in ("filas_leidas", "filas_central", "casos_nuevos",
                  "casos_duplicados", "casos_descartados"):
        print(f"   {clave}: {prev.get(clave)}")

    estado, cerrados = pedir_json(
        f"{base}/api/v1/casos?tipo_caso=AVERIA&estado_actual=CERRADO&page_size=200", token)
    if estado != 200:
        print(f"ERROR listando CERRADO: HTTP {estado}")
        return 1
    a_reabrir = [c for c in cerrados.get("items", []) if c["id_averia"] in averias_csv]
    print(f"== casos CERRADO que reaparecen en el archivo: {len(a_reabrir)}")
    for c in a_reabrir:
        print(f"   #{c['id_caso']} {c['id_averia']}")

    if not args.aplicar:
        print("SIMULACIÓN: no se escribió nada (usa --aplicar --si).")
        return 0
    if not args.si and input(f"¿Ingestar y pasar {len(a_reabrir)} caso(s) a PENDIENTE? escribe 'SI': ").strip() != "SI":
        print("Cancelado: no se escribió nada.")
        return 0

    if not args.sin_ingesta:
        carga = subir_ingesta(base, token, CSV_PATH, preview=False)
        print(f"== ingesta: lote #{carga.get('id_lote')} | nuevos {carga.get('casos_nuevos')} | "
              f"duplicados {carga.get('casos_duplicados')} | masivas {carga.get('fallas_masivas')}")

    ok = 0
    for c in a_reabrir:
        st, res = pedir_json(
            f"{base}/api/v1/casos/{c['id_caso']}/reactivar", token, metodo="POST",
            cuerpo={"estado": "NUEVO", "motivo": MOTIVO})
        if st == 200:
            ok += 1
            print(f"   ✓ #{c['id_caso']} {c['id_averia']} → NUEVO (cola abierta)")
        else:
            print(f"   ✗ #{c['id_caso']} {c['id_averia']}: HTTP {st} {res}")
    print(f"Listo: {ok}/{len(a_reabrir)} reabiertos a NUEVO.")

    st, det = pedir_json(f"{base}/api/v1/fallas-masivas/detectar", token, metodo="POST", cuerpo={})
    print(f"detectar masivas: HTTP {st} → {len(det) if isinstance(det, list) else det}")
    return 0 if ok == len(a_reabrir) else 1


if __name__ == "__main__":
    sys.exit(main())
