#!/usr/bin/env python3
"""Corrige el contacto de los 10 casos ASF volcados desde la bandeja.

El encabezado del XLSX es `Contacto ` (con espacio final); al normalizarlo se
perdió el valor en la primera carga. Este script reenvía solo `contacto_cliente`
a los casos con id_averia `BAN-ASF-*`.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import openpyxl
import requests

RAIZ = Path(__file__).resolve().parents[1]
ASF = RAIZ / "bandeja" / "ASF pendiente.xlsx"
BASE = os.environ.get("GGTO_API_URL", "https://ggto-web-695669822281.europe-west1.run.app/api/v1")


def main() -> int:
    user, clave = os.environ.get("GGTO_P00", ""), os.environ.get("GGTO_CLAVE", "")
    if not user or not clave:
        print("ERROR: defina GGTO_P00 y GGTO_CLAVE")
        return 2

    wb = openpyxl.load_workbook(ASF, read_only=True, data_only=True)
    ws = wb["Sheet1"]
    it = ws.iter_rows(values_only=True)
    cab = [str(c).strip() if c is not None else "" for c in next(it)]
    filas = [dict(zip(cab, r)) for r in it if any(v is not None for v in r)]
    wb.close()

    ses = requests.Session()
    ses.headers["Content-Type"] = "application/json"
    lr = ses.post(f"{BASE}/auth/login", json={"p00": user, "clave": clave}, timeout=30)
    lr.raise_for_status()
    ses.headers["Authorization"] = f"Bearer {lr.json()['access_token']}"

    ok = 0
    for r in filas:
        orden = str(r.get("Nrº Órden") or "").strip()
        contacto = str(r.get("Contacto") or r.get("Contacto ") or "").strip()
        if not orden or not contacto or contacto.lower() == "no quiere servicio":
            continue
        av = f"BAN-ASF-{orden}"[:30]
        bus = ses.get(f"{BASE}/casos", params={"id_averia": av, "page_size": 1}, timeout=30).json()
        items = bus.get("items") or []
        if not items:
            print(f"  ✗ {av}: caso no encontrado", file=sys.stderr)
            continue
        cid = items[0]["id_caso"]
        p = ses.patch(f"{BASE}/casos/{cid}", json={"contacto_cliente": contacto}, timeout=30)
        if p.status_code == 200:
            ok += 1
            print(f"  ✓ #{cid} {av} -> contacto {contacto}")
        else:
            print(f"  ✗ #{cid}: HTTP {p.status_code} {p.text[:150]}", file=sys.stderr)
    print(f"Contactos corregidos: {ok}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
