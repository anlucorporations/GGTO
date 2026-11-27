#!/usr/bin/env python3
"""Volca los XLSX de `bandeja/` a GGTO por el camino canónico `POST /casos`.

=============================================================================
REGLAS
  · Idempotente: busca antes por `id_averia` marcador (BAN-ASF-* / BAN-ACO-*).
  · El archivo `Ordenes ASF Pendiente (2).xlsx` es un SUBCONJUNTO de
    `ASF pendiente.xlsx` (mismos seriales), por eso NO se carga: se evitan 6
    duplicados.
  · `Reporte Acometidas...` tiene 227 filas pero 225 IDs únicos; se deduplica
    por `ID Registro` (se conserva la primera fila).
  · Los archivos no traen identificador de pago 70*. Se usan marcadores
    temporales `7091000001…` (ASF) y `7092000001…` (acometidas), documentados
    en `informacion`, siguiendo el patrón ya usado por la carga FAT.
  · Sin sector explícito: el servidor intenta sectorizar por dirección.
  · Contactos ausentes -> "SIN CONTACTO" (el esquema exige el campo no vacío).

USO
  export GGTO_P00=123456 GGTO_CLAVE='...'
  python scripts/volcar_bandeja_ggto.py                 # simulación
  python scripts/volcar_bandeja_ggto.py --aplicar --limite 2
  python scripts/volcar_bandeja_ggto.py --aplicar --si
=============================================================================
"""
from __future__ import annotations

import argparse
import collections
import os
import sys
from pathlib import Path

import openpyxl
import requests

RAIZ = Path(__file__).resolve().parents[1]
BANDEJA = RAIZ / "bandeja"
BASE = os.environ.get("GGTO_API_URL", "https://ggto-web-695669822281.europe-west1.run.app/api/v1")

ASF = BANDEJA / "ASF pendiente.xlsx"
ACO = BANDEJA / "Reporte Acometidas Pendientes al 17.11.2026_CAPITAL (1).xlsx"


def filas(ruta: Path, hoja: str) -> list[dict]:
    wb = openpyxl.load_workbook(ruta, read_only=True, data_only=True)
    ws = wb[hoja]
    it = ws.iter_rows(values_only=True)
    cab = [str(c).strip() if c is not None else "" for c in next(it)]
    salida = []
    for row in it:
        if not any(v is not None for v in row):
            continue
        salida.append({k: ("" if v is None else str(v).strip()) for k, v in zip(cab, row)})
    wb.close()
    return salida


def txt(d: dict, *claves: str) -> str:
    return " ".join(str(d.get(c, "") or "").strip() for c in claves).strip()


def fecha_iso(valor: str) -> str | None:
    valor = (valor or "").strip()
    if not valor:
        return None
    return valor.replace(" ", "T")


def payload_asf(d: dict, i: int) -> dict:
    orden = d.get("Nrº Órden", "")
    rif = d.get("Rif / Cédula", "")
    cat = "EMPRESA" if rif.upper().startswith("J") else "RESIDENCIAL"
    direccion = txt(d, "Sector", "Inmueble", "Parroquia", "Municipio", "Estado")
    contacto = d.get("Contacto", "") or d.get("Contacto ", "") or "SIN CONTACTO"
    info = (
        f"BANDEJA · ASF pendiente.xlsx · Orden {orden} · RIF/Cédula {rif} · "
        f"Serial ONT {d.get('Serial ONT','')} · Región {d.get('Región','')} · "
        f"Estado {d.get('Estado','')} · Municipio {d.get('Municipio','')} · "
        f"Parroquia {d.get('Parroquia','')} · Sector {d.get('Sector','')} · "
        f"Inmueble {d.get('Inmueble','')} · Estatus {d.get('Estatus','')} · "
        f"Fecha creación {d.get('Fecha Creación','')} · Contacto archivo {contacto}. "
        "id_pago marcador temporal 70* (corregir con el identificador real)."
    )
    return {
        "id_averia": f"BAN-ASF-{orden}"[:30],
        "id_pago": f"70{91000000 + i:08d}",
        "tipo_reporte": "REPARACION",
        "tipo_problema": "NNV",
        "categoria": cat,
        "nombre_cliente": f"ASF {orden} ({rif})"[:160],
        "contacto_cliente": contacto[:60],
        "direccion": direccion or "DIRECCION SIN ESPECIFICAR",
        "problema_reporte": "Orden ASF pendiente (sin diagnóstico en el archivo)",
        "informacion": info,
        "persona_reporta": "BANDEJA · ASF",
        "fecha_reporte": fecha_iso(d.get("Fecha Creación", "")),
    }


def payload_aco(d: dict, i: int) -> dict:
    rid = d.get("ID Registro", "")
    cliente = d.get("Cliente", "") or f"Acometida {rid}"
    es_empresa = any(x in cliente.upper() for x in (" C.A", " C.A.", " CA ", "COMPAÑIA", "COMPANIA", "SRL"))
    direccion = txt(d, "Direccion de Inmueble o Local", "ODN", "Estado")
    contacto = d.get("Telefono Contacto", "") or "SIN CONTACTO"
    info = (
        f"BANDEJA · Reporte Acometidas Pendientes 17.11.2026 · ID {rid} · "
        f"Año {d.get('Año Venta','')} · Mes {d.get('Mes Venta','')} · "
        f"Región {d.get('Región','')} · Estado {d.get('Estado','')} · "
        f"ODN {d.get('ODN','')} · RIF {d.get('Rif','')} · "
        f"Estatus ventas {d.get('Estatus Ventas','')} · "
        f"Estatus construcción {d.get('Estatus Construcción','')} · "
        f"Renta {d.get('Renta ($)','')} · Fuga {d.get('Fuga ($)','')} · "
        f"Días gestión {d.get('Días en Gestión','')} · "
        f"Criticidad {d.get('Criticidad','')} · Envejecimiento {d.get('Rango Envejecimiento','')}. "
        "id_pago marcador temporal 70* (corregir con el identificador real)."
    )
    return {
        "id_averia": f"BAN-ACO-{rid}"[:30],
        "id_pago": f"70{92000000 + i:08d}",
        "tipo_reporte": "CONSTRUCCION",
        "categoria": "EMPRESA" if es_empresa else "RESIDENCIAL",
        "nombre_cliente": cliente[:160],
        "contacto_cliente": contacto[:60],
        "direccion": direccion or "DIRECCION SIN ESPECIFICAR",
        "problema_reporte": f"Acometida pendiente · ODN {d.get('ODN','')} · criticidad {d.get('Criticidad','')}",
        "informacion": info,
        "persona_reporta": "BANDEJA · ACOMETIDAS",
        "tipo_servicio": "ACOMETIDA",
        "fecha_reporte": fecha_iso(d.get("Fecha Solicitud", "")),
    }


def main() -> int:
    p = argparse.ArgumentParser(description="Volcar bandeja XLSX a GGTO.")
    p.add_argument("--aplicar", action="store_true", help="Escribe; por defecto simula.")
    p.add_argument("--si", action="store_true", help="Sin confirmación interactiva.")
    p.add_argument("--limite", type=int, default=0, help="Máximo de casos por archivo (0=todos).")
    args = p.parse_args()

    user = os.environ.get("GGTO_P00", "")
    clave = os.environ.get("GGTO_CLAVE", "")
    if not user or not clave:
        print("ERROR: defina GGTO_P00 y GGTO_CLAVE.")
        return 2

    ses = requests.Session()
    ses.headers["Content-Type"] = "application/json"
    lr = ses.post(f"{BASE}/auth/login", json={"p00": user, "clave": clave}, timeout=30)
    lr.raise_for_status()
    ses.headers["Authorization"] = f"Bearer {lr.json()['access_token']}"

    asf = filas(ASF, "Sheet1")
    aco = filas(ACO, "Reporte_Filtrado_GGEIP_2026-11-")
    vistos: set[str] = set()
    aco_unicos = []
    duplicados = 0
    for r in aco:
        key = r.get("ID Registro", "")
        if key in vistos:
            duplicados += 1
            continue
        vistos.add(key)
        aco_unicos.append(r)

    if args.limite:
        asf = asf[: args.limite]
        aco_unicos = aco_unicos[: args.limite]

    modo = "APLICAR" if args.aplicar else "SIMULACIÓN"
    print(f"Modo {modo} | ASF {len(asf)} | Acometidas únicas {len(aco_unicos)} (duplicados {duplicados})")
    if args.aplicar and not args.si:
        if input("¿Volcar la bandeja a GGTO? escribe SI: ").strip() != "SI":
            print("Cancelado.")
            return 0

    stats = {"creados": 0, "ya_existentes": 0, "errores": 0}
    motivos: collections.Counter[str] = collections.Counter()
    for origen, filas_x, fn in (("ASF", asf, payload_asf), ("ACOMETIDAS", aco_unicos, payload_aco)):
        for i, fila in enumerate(filas_x, start=1):
            body = fn(fila, i)
            av = body["id_averia"]
            chk = ses.get(f"{BASE}/casos", params={"id_averia": av, "page_size": 1}, timeout=30)
            if chk.status_code == 200 and (chk.json().get("items") or []):
                stats["ya_existentes"] += 1
                continue
            if not args.aplicar:
                print(f"  [SIM] {origen} {av} -> {body['tipo_reporte']}/{body['categoria']} {body['nombre_cliente'][:40]}")
                stats["creados"] += 1
                continue
            r = ses.post(f"{BASE}/casos", json=body, timeout=60)
            if r.status_code == 201:
                stats["creados"] += 1
                print(f"  ✓ {origen} {av} -> #{r.json().get('id_caso')} {r.json().get('id_averia')}")
            else:
                stats["errores"] += 1
                motivos[f"{r.status_code}: {r.text[:160]}"] += 1
                print(f"  ✗ {origen} {av}: HTTP {r.status_code} {r.text[:180]}", file=sys.stderr)

    print("Resumen:", stats)
    for motivo, n in motivos.most_common(10):
        print(f"  motivo x{n}: {motivo}")
    return 1 if stats["errores"] else 0


if __name__ == "__main__":
    sys.exit(main())
