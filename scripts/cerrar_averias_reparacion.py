#!/usr/bin/env python3
"""Cierra en masa los casos de **averías** (tipo AVERIA) del peticionario SUPER.

 =============================================================================
 QUÉ HACE
     Por orden directa del SUPER (04/11/2026): todos los casos de tipo
     `AVERIA` pasan a estado `CERRADO`. El cambio se hace por el camino
     canónico de la API (`POST /api/v1/casos/{id}/estado`), de modo que:

     · cada caso recibe su renglón de `caso_estado_hist` con el motivo;
     · `services.resolucion.registrar_estado` sincroniza la ficha del caso
       especial cuando la hay (los casos AVERIA normalmente no tienen);
     · queda la auditoría HTTP regular (usuario/rol/evento).
     Los casos que ya están `CERRADO` (o terminales) se omiten (no-op).

 SEGURIDAD
     · Sin secretos en el repo: la URL y el JWT van por entorno
       (`GGTO_URL`, `GGTO_TOKEN`); el token lo genera el operador con el
       login del SUPER y no se escribe en ningún archivo.
     · Tokens por defecto no: simula (lista lo que haría); escribe con
       `--aplicar`.
     · Motivo de la bitácora configurable con `--motivo`.

 USO (PowerShell)
     $tok = ... (login del SUPER) ...
     $env:GGTO_URL  = 'https://ggto-web-XXXX.run.app'
     $env:GGTO_TOKEN = $tok
     python scripts/cerrar_averias_reparacion.py              # simulación
     python scripts/cerrar_averias_reparacion.py --aplicar
 =============================================================================
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request

MOTIVO_POR_DEFECTO = (
    "Cerrado por instrucción del SUPER: se retira el caso de reparación"
)

TIMEOUT = 30


def pedir(url: str, token: str, *, metodo: str = "GET", cuerpo: dict | None = None):
    """Petición HTTP JSON con el JWT del SUPER; devuelve (estado, datos)."""
    datos = None
    if cuerpo is not None:
        datos = json.dumps(cuerpo).encode("utf-8")
    peticion = urllib.request.Request(
        url, data=datos, method=metodo,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(peticion, timeout=TIMEOUT) as respuesta:
            return respuesta.status, json.loads(respuesta.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        try:
            return exc.code, json.loads(exc.read().decode("utf-8"))
        except Exception:
            return exc.code, {}


def recolectar(base: str, token: str) -> list[dict]:
    """Recorre el listado paginado y deja los AVERIA no terminales."""
    casos: list[dict] = []
    page = 1
    while True:
        estado, datos = pedir(
            f"{base}/api/v1/casos", token,
            cuerpo=None,
        )
        # El listado es GET con query: compón a mano.
        consulta = f"{base}/api/v1/casos?tipo_caso=AVERIA&page={page}&page_size=200"
        estado, datos = pedir(consulta, token)
        if estado != 200:
            sys.exit(f"ERROR listando casos: HTTP {estado}: {datos}")
        items = datos.get("items", [])
        casos.extend(items)
        if datos.get("page", page) >= (datos.get("pages") or 1):
            break
        page += 1
    return [c for c in casos if c["estado_actual"] not in ("CERRADO", "CANCELADO")]


def main() -> int:
    p = argparse.ArgumentParser(
        description="D-oper: cierra en masa los casos AVERIA (orden del SUPER)."
    )
    p.add_argument("--aplicar", action="store_true",
                   help="Ejecuta el cierre (por defecto simula)")
    p.add_argument("--si", action="store_true",
                   help="Omite la confirmación interactiva")
    p.add_argument("--motivo", default=MOTIVO_POR_DEFECTO,
                   help="Texto que queda en caso_estado_hist")
    args = p.parse_args()

    base = (os.environ.get("GGTO_URL") or "").rstrip("/")
    token = os.environ.get("GGTO_TOKEN") or ""
    if not base or not token:
        print("ERROR: exporta GGTO_URL y GGTO_TOKEN antes de ejecutar.")
        return 2

    pendientes = recolectar(base, token)
    modo = "APLICAR" if args.aplicar else "SIMULACIÓN"
    print(f"modo={modo} | AVERIA a cerrar: {len(pendientes)}")
    for c in pendientes:
        print(f"   #{c['id_caso']} {c['id_averia']} ({c['estado_actual']})")
    if not pendientes:
        print("Nada que cerrar.")
        return 0
    if not args.aplicar:
        print("SIMULACIÓN: no se escribió nada (usa --aplicar).")
        return 0

    if not args.si:
        can_confirm = input(f"¿Cerrar {len(pendientes)} caso(s) AVERIA? escribe 'SI': ").strip()
        if can_confirm != "SI":
            print("Confirmación rechazada: no se escribió nada.")
            return 0

    cerrados = fallidos = 0
    for c in pendientes:
        estado, datos = pedir(
            f"{base}/api/v1/casos/{c['id_caso']}/estado", token,
            metodo="POST",
            cuerpo={"estado_actual": "CERRADO", "motivo_estado": args.motivo},
        )
        if estado == 200:
            cerrados += 1
            print(f"   ✓ #{c['id_caso']} {c['id_averia']} → CERRADO")
        else:
            fallidos += 1
            print(f"   ✗ #{c['id_caso']} {c['id_averia']}: HTTP {estado}: {datos}")
    print(f"Listo: {cerrados} cerrado(s), {fallidos} fallido(s).")
    return 1 if fallidos else 0


if __name__ == "__main__":
    sys.exit(main())
