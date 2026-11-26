"""Carga los casos de RepoTecnico/ESPECIALES como Casos Especiales de CONSTRUCCION.

- Solicitante: ANGEL LUCCI · GGTO (id_solicitante 13, ya existe en el catálogo).
- tipo_actividad: CONSTRUCCION para todos (solo exigen nombre, contacto,
  dirección y teléfono 70*; id_averia/tipo_problema son de REPARACION).
- Sector: se resuelve contra los patrones de la central del usuario (GET
  /sectores); si la dirección no coincide, se intenta con el campo
  sector/ODN y, si nada encaja, el caso se omite y queda en el reporte.
- Telefono (identificador de pago 70*): marcador temporal `70<NNNNNNNN>`; se
  corrige a mano después (lo acordado con el usuario).
"""

from __future__ import annotations

import json
import sys
import unicodedata
from pathlib import Path

import requests

BASE = "https://ggto-web-695669822281.europe-west1.run.app/api/v1"
P00, CLAVE = "123456", "KeLuDa.2324"
ID_SOLICITANTE = 13  # ANGEL LUCCI · GGTO
ID_CENTRAL = 1       # FRANCISCO SALIAS

RAIZ = Path(__file__).resolve().parents[1]
DATOS = RAIZ / "RepoTecnico" / "ESPECIALES" / "_casos_extraidos.json"
REPORTE = RAIZ / "RepoTecnico" / "ESPECIALES" / "_reporte_carga_especiales.json"

CLASIFICACION = {
    "ACOMETIDAS_RC_20_10_2026": "EMPRESA",
    "ACOMETIDAS_FS_7_10_2026": "EMPRESA",
    "DEMANDA_FS": "REFERIDO",
    "EMPRESAS_GOBIERNO_MIRANDA_04112026": "GOBIERNO",
}
PRIORIDAD_CRITICIDAD = {"CRITICO": "ALTA", "CRÍTICO": "ALTA", "BUENO": "MEDIA", "REGULAR": "MEDIA"}


def normalizar(texto: str | None) -> str:
    if not texto:
        return ""
    limpio = unicodedata.normalize("NFKD", str(texto).upper())
    return " ".join(
        "".join(c for c in unicodedata.normalize("NFD", limpio) if unicodedata.category(c) != "Mn").split()
    )


def principal() -> int:
    sesion = requests.Session()
    sesion.headers["Content-Type"] = "application/json"
    respuesta = sesion.post(f"{BASE}/auth/login", json={"p00": P00, "clave": CLAVE}, timeout=30)
    respuesta.raise_for_status()
    sesion.headers["Authorization"] = f"Bearer {respuesta.json()['access_token']}"

    sectores = sesion.get(f"{BASE}/sectores", timeout=30).json()
    patrones = [
        (s["id_sector"], s["nombre"], normalizar(p["patron"]))
        for s in sectores
        if s["id_central"] == ID_CENTRAL and s.get("activo")
        for p in (s.get("direcciones") or [])
        if p.get("activo", True)
    ]
    print(f"Patrones de sector cargados: {len(patrones)} ({len(sectores)} sectores)")

    def buscar(texto: str) -> tuple[int, str] | None:
        clave = normalizar(texto)
        if not clave:
            return None
        for id_sector, nombre, patron in patrones:
            if patron and patron in clave:
                return id_sector, nombre
        return None

    registros = json.loads(DATOS.read_text(encoding="utf-8"))
    creados, fallidos = [], []

    for indice, r in enumerate(registros, start=1):
        origen = r["origen"]
        cliente = r.get("cliente") or "CLIENTE SIN NOMBRE"
        contacto = r.get("contacto") or "SIN CONTACTO"
        # Dirección: la más completa disponible por origen.
        partes = [
            r.get("direccion"), r.get("calle"), r.get("edificio"), r.get("extra"),
            r.get("sector"), r.get("odn"),
        ]
        direccion = ", ".join(p for p in partes if p)
        prioridad = PRIORIDAD_CRITICIDAD.get(normalizar(r.get("criticidad") or ""), "MEDIA")
        telefono = f"70{indice:08d}"  # marcador temporal (identificador de pago)

        detalle = {k: v for k, v in r.items() if k not in ("origen", "cliente", "contacto") and v}
        cuerpo = {
            "clasificacion": CLASIFICACION[origen],
            "tipo_actividad": "CONSTRUCCION",
            "prioridad": prioridad,
            "descripcion": (
                f"ESPECIAL CONSTRUCCION · {origen} · {cliente} · "
                + "; ".join(f"{k}={v}" for k, v in detalle.items())
            )[:3900],
            "requiere_informe": True,
            "id_solicitante": ID_SOLICITANTE,
            "nombre_cliente": cliente,
            "contacto_cliente": str(contacto),
            "telefono": telefono,
            "direccion": direccion,
        }
        if r.get("id_averia"):
            cuerpo["id_averia"] = str(r["id_averia"])

        try:
            especial = sesion.post(f"{BASE}/casos-especiales", json=cuerpo, timeout=60)
            # Sin sector: intentar con el campo sector/ODN antes de rendirse.
            if especial.status_code == 400 and "sector" in especial.json().get("detail", ""):
                pista = r.get("sector") or r.get("odn")
                hallado = buscar(pista or "")
                if hallado:
                    cuerpo["id_sector"], nombre_sector = hallado
                    especial = sesion.post(f"{BASE}/casos-especiales", json=cuerpo, timeout=60)
            if especial.status_code >= 300:
                fallidos.append({"origen": origen, "cliente": cliente, "status": especial.status_code,
                                 "error": especial.text[:300]})
                print(f"  [{origen}] {cliente}: ERROR {especial.status_code}")
                continue
            datos = especial.json()
            creados.append({
                "origen": origen, "cliente": cliente,
                "id_caso_especial": datos.get("id_caso_especial"),
                "id_caso": datos.get("id_caso"),
                "id_averia": datos.get("id_averia"),
                "sector": datos.get("sector_nombre"),
                "prioridad": datos.get("prioridad"),
            })
            print(f"  [{origen}] {cliente}: especial #{datos.get('id_caso_especial')} "
                  f"(caso {datos.get('id_caso')}, sector {datos.get('sector_nombre')})")
        except Exception as exc:  # red / timeout: dejar constancia y seguir
            fallidos.append({"origen": origen, "cliente": cliente, "error": str(exc)[:300]})

    REPORTE.write_text(
        json.dumps({"creados": creados, "fallidos": fallidos}, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
    print(f"\nCreados: {len(creados)} · Fallidos/omitidos: {len(fallidos)}")
    print(f"Reporte: {REPORTE}")
    return 0 if not fallidos else 1


if __name__ == "__main__":
    sys.exit(principal())
