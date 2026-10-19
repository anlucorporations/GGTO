#!/usr/bin/env python3
"""Sembrado de 4 casos nuevos para cerrarlos desde la APK (cuadrilla 0).

Prepara, contra la API de la plataforma, el escenario mínimo para probar el
cierre de casos **desde la APK** en la cuadrilla 0 (la del supervisor):

1. **4 casos nuevos** de alta manual (`TEST-APK-0001…0004`), con identificador
   de pago único, contacto y dirección, marcados **TEST** para que el sembrado
   sea reconocible y reversible.
2. Su **asignación al despacho del día de la cuadrilla 0** (`C-00`), que es la
   cuadrilla del supervisor (`es_supervisor = true`). El despacho se crea en
   BORRADOR si no existía; con `--publicar` se publica como jornada del día.
3. Una **verificación de lectura**: el despacho con sus casos y, si se indican
   las credenciales de un técnico (`--tecnico-p00`/`--tecnico-clave`), el mismo
   payload que recibe la APK en `GET /sync/descarga` —con `ids_del_dia` e
   `ids_vigentes`— para confirmar que los casos viajan y no se purgan.

El script es **idempotente**: busca cada caso por `id_averia` antes de crearlo y
puede reasignar los que ya existan.

USO
    # 1) Simulación: solo consulta (no escribe nada)
    python RepoTecnico/pruebas/sembrar_cuadrilla0_apk.py --p00 123456 --clave '…'

    # 2) Aplicar el sembrado (crea o reutiliza los 4 casos y los despacha)
    python RepoTecnico/pruebas/sembrar_cuadrilla0_apk.py --p00 123456 --clave '…' --aplicar

    # 3) Además publicar la jornada de la cuadrilla 0
    python RepoTecnico/pruebas/sembrar_cuadrilla0_apk.py --p00 … --clave … --aplicar --publicar

    # 4) Verificar el payload que verá la APK de un técnico de esa cuadrilla
    python RepoTecnico/pruebas/sembrar_cuadrilla0_apk.py --p00 … --clave … \
        --tecnico-p00 153806 --tecnico-clave '…'

VARIABLES
    GGTO_API      URL base de la API (por defecto, producción)
    GGTO_P00      P00 del usuario que siembra (alternativa a --p00)
    GGTO_CLAVE    Clave de ese usuario (alternativa a --clave)
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

import requests

API = os.environ.get(
    "GGTO_API", "https://ggto-web-593453426217.europe-west1.run.app/api/v1"
)
ZONA = ZoneInfo("America/Caracas")

#: Marca del sembrado: todo lo creado lleva este prefijo en el `id_averia`.
PREFIJO = "TEST-APK"
#: Identificadores de pago de los 4 casos (7000001901…1904): únicos y reconocibles.
BASE_PAGO = 7000001900
#: Cuadrilla por defecto: la 0 (la del supervisor).
CUADRILLA = "C-00"
#: Cantidad de casos a sembrar.
CASOS = 4


# --------------------------------------------------------------------------- #
# Cliente mínimo de la API
# --------------------------------------------------------------------------- #
class Api:
    """Cliente HTTP con el token del usuario que siembra."""

    def __init__(self, base: str) -> None:
        self.base = base.rstrip("/")
        self.token: str | None = None
        self.sesion = requests.Session()

    def _cabeceras(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token}"} if self.token else {}

    def login(self, p00: str, clave: str) -> dict:
        respuesta = self.sesion.post(
            f"{self.base}/auth/login", json={"p00": p00, "clave": clave}, timeout=30
        )
        self._revisar(respuesta, "login")
        datos = respuesta.json()
        self.token = datos["access_token"]
        return datos

    def get(self, ruta: str, **params: Any) -> Any:
        respuesta = self.sesion.get(
            f"{self.base}{ruta}", params=params, headers=self._cabeceras(), timeout=90
        )
        self._revisar(respuesta, f"GET {ruta}")
        return respuesta.json()

    def post(self, ruta: str, cuerpo: dict | None = None) -> Any:
        respuesta = self.sesion.post(
            f"{self.base}{ruta}", json=cuerpo, headers=self._cabeceras(), timeout=120
        )
        self._revisar(respuesta, f"POST {ruta}")
        return respuesta.json() if respuesta.content else None

    def patch(self, ruta: str, cuerpo: dict) -> Any:
        respuesta = self.sesion.patch(
            f"{self.base}{ruta}", json=cuerpo, headers=self._cabeceras(), timeout=120
        )
        self._revisar(respuesta, f"PATCH {ruta}")
        return respuesta.json() if respuesta.content else None

    @staticmethod
    def _revisar(respuesta: requests.Response, que: str) -> None:
        if respuesta.status_code >= 400:
            raise SystemExit(
                f"ERROR {respuesta.status_code} en {que}: {respuesta.text[:600]}"
            )


# --------------------------------------------------------------------------- #
# Piezas del sembrado
# --------------------------------------------------------------------------- #
def _hoy() -> str:
    return datetime.now(ZONA).date().isoformat()


def _numero_caso(indice: int) -> str:
    return f"{PREFIJO}-{indice:04d}"


def _pago(indice: int) -> str:
    return str(BASE_PAGO + indice)


def _telefono(indice: int) -> str:
    return f"0424{1000000 + indice:07d}"[:11]


def casos_por_averia(api: Api) -> dict[str, int]:
    """`id_averia -> id_caso` de los casos del sembrado que ya existen."""
    pagina = api.get("/casos", q=PREFIJO, page_size=200, solo_abiertos=True)
    encontrados: dict[str, int] = {}
    for item in pagina.get("items", []):
        averia = str(item.get("id_averia", ""))
        if averia.startswith(PREFIJO):
            encontrados[averia] = int(item["id_caso"])
    return encontrados


def crear_caso(api: Api, indice: int, aplicar: bool) -> int | None:
    """Alta manual de un caso de reparación marcado TEST.

    Cumple las reglas de la alta manual (RN-AL-01 / DEC-IP-5): nombre, contacto,
    dirección, identificador de pago 70* y, por ser REPARACIÓN, id de avería y
    tipo de problema.
    """
    averia = _numero_caso(indice)
    cuerpo = {
        "id_central": 1,
        "tipo_reporte": "REPARACION",
        "id_averia": averia,
        "categoria": "RESIDENCIAL",
        "nombre_cliente": f"CLIENTE TEST APK {indice:02d}",
        "persona_reporta": f"CLIENTE TEST APK {indice:02d}",
        "contacto_cliente": _telefono(indice),
        "id_pago": _pago(indice),
        "direccion": (
            f"TEST CUADRILLA 0, AVENIDA PRINCIPAL, CALLE {indice}, CASA {indice}"
        ),
        "informacion": (
            f"TEST · caso sembrado para cerrar desde la APK (cuadrilla 0) · {averia}"
        ),
        "problema_reporte": "SIN SERVICIO · PRUEBA DE CIERRE DESDE LA APK",
        "tipo_problema": "SIN_SERVICIO",
        "tipo_servicio": "ABA ULTRA",
    }
    print(f"  {averia}: se crearía (REPARACION · SIN_SERVICIO · id_pago {_pago(indice)})")
    if not aplicar:
        return None
    creado = api.post("/casos", cuerpo)
    print(f"  {averia}: creado (id_caso #{creado['id_caso']})")
    return int(creado["id_caso"])


def resolver_cuadrilla(api: Api, codigo: str) -> dict:
    """Cuadrilla por código (por defecto `C-00`, la del supervisor)."""
    for cuadrilla in api.get("/cuadrillas"):
        if str(cuadrilla.get("codigo")) == codigo:
            return cuadrilla
    raise SystemExit(f"No existe la cuadrilla {codigo} en esta central")


def despacho_del_dia(api: Api, id_cuadrilla: int) -> dict | None:
    for despacho in api.get("/despachos", fecha=_hoy()):
        if int(despacho.get("id_cuadrilla")) == id_cuadrilla:
            return despacho
    return None


def verificar(api: Api, id_cuadrilla: int, ids_caso: list[int]) -> None:
    """Comprueba que los casos están en el despacho del día de la cuadrilla."""
    print("== Verificación del despacho ==")
    despacho = despacho_del_dia(api, id_cuadrilla)
    if despacho is None:
        print("  ✗ la cuadrilla no tiene despacho hoy")
        return
    detalle = api.get(f"/despachos/{despacho['id_despacho']}")
    ids = {int(c["id_caso"]) for c in detalle.get("casos") or []}
    faltan = [i for i in ids_caso if i not in ids]
    print(
        f"  despacho #{detalle['id_despacho']} · {detalle.get('estado')} · "
        f"{len(ids)} caso(s) · cuadrilla {detalle.get('cuadrilla_codigo')}"
    )
    for caso in detalle.get("casos") or []:
        print(
            f"    - caso #{caso['id_caso']} "
            f"· despacho {caso.get('estado')} "
            f"· {caso.get('tipo_asignacion') or '—'} · orden {caso.get('orden_visita')}"
        )
    if faltan:
        print(f"  ✗ faltan en el despacho: {faltan}")
    else:
        print("  ✓ los 4 casos del sembrado están en el despacho del día")


def verificar_sync(p00: str, clave: str, ids_caso: list[int]) -> None:
    """Payload real de la APK (`GET /sync/descarga`) para ese técnico."""
    print(f"== Verificación de la DESCARGA de la APK ({p00}) ==")
    api = Api(API)
    api.login(p00, clave)
    cuadrilla = api.get("/sync/cuadrilla")
    print(f"  cuadrilla resuelta: {cuadrilla}")
    descarga = api.get("/sync/descarga")
    casos = {int(c["id_caso"]): c for c in descarga.get("casos") or []}
    print(
        f"  motivo={descarga.get('motivo')} · casos={len(casos)} · "
        f"despacho_del_dia={descarga.get('despacho_del_dia')} · "
        f"ids_del_dia={descarga.get('ids_del_dia')} · "
        f"ids_vigentes={len(descarga.get('ids_vigentes') or [])}"
    )
    faltan = [i for i in ids_caso if i not in casos]
    for id_caso in ids_caso:
        caso = casos.get(id_caso)
        if caso is None:
            continue
        print(
            f"    - #{id_caso} {caso.get('id_averia')} · {caso.get('estado_actual')} "
            f"· {caso.get('direccion')}"
        )
    if faltan:
        print(f"  ✗ la descarga no trae: {faltan}")
    else:
        print("  ✓ los 4 casos llegan a la APK")


# --------------------------------------------------------------------------- #
# Principal
# --------------------------------------------------------------------------- #
def main() -> int:
    p = argparse.ArgumentParser(
        description="Siembra 4 casos TEST y los despacha a la cuadrilla 0 para "
                    "cerrarlos desde la APK.",
    )
    p.add_argument("--p00", default=os.environ.get("GGTO_P00"),
                   help="P00 del usuario que siembra (SUPER o SUPERVISOR)")
    p.add_argument("--clave", default=os.environ.get("GGTO_CLAVE"),
                   help="Clave de ese usuario")
    p.add_argument("--api", default=API, help="URL base de la API")
    p.add_argument("--cuadrilla", default=CUADRILLA, help="Código de la cuadrilla (C-00)")
    p.add_argument("--casos", type=int, default=CASOS, help="Cuántos casos sembrar (4)")
    p.add_argument("--aplicar", action="store_true", help="Escribe de verdad")
    p.add_argument("--publicar", action="store_true",
                   help="Publica el despacho del día de la cuadrilla")
    p.add_argument("--tecnico-p00", default=None,
                   help="Técnico con el que se simula la descarga de la APK")
    p.add_argument("--tecnico-clave", default=None)
    args = p.parse_args()

    if not args.p00 or not args.clave:
        p.error("indique --p00 y --clave (o GGTO_P00 / GGTO_CLAVE)")

    api = Api(args.api)
    datos = api.login(args.p00, args.clave)
    print(f"== Sesión: {datos['usuario']['p00']} · rol {datos['usuario']['rol']} ==")
    print(f"   API: {api.base}")

    cuadrilla = resolver_cuadrilla(api, args.cuadrilla)
    id_cuadrilla = int(cuadrilla["id_cuadrilla"])
    print(
        f"== Cuadrilla {cuadrilla['codigo']} (#{id_cuadrilla} {cuadrilla['nombre']}) "
        f"· supervisor={cuadrilla.get('es_supervisor')} =="
    )

    # --- 1. Casos --------------------------------------------------------- #
    print(f"== Casos {PREFIJO} ==")
    existentes = casos_por_averia(api)
    ids_caso: list[int] = []
    for indice in range(1, args.casos + 1):
        averia = _numero_caso(indice)
        if averia in existentes:
            print(f"  {averia}: ya existe (id_caso #{existentes[averia]})")
            ids_caso.append(existentes[averia])
            continue
        creado = crear_caso(api, indice, args.aplicar)
        if creado is not None:
            ids_caso.append(creado)

    if not args.aplicar:
        print("\n(simulación) vuelva a ejecutar con --aplicar para escribir")
        return 0

    # --- 2. Asignación al despacho de la cuadrilla 0 ---------------------- #
    print(f"== Asignación al despacho de hoy de {cuadrilla['codigo']} ==")
    asignacion = api.post("/despachos/asignar-casos", {
        "id_cuadrilla": id_cuadrilla,
        "ids_caso": ids_caso,
        "fecha": _hoy(),
        "id_central": 1,
    })
    print(f"  {asignacion.get('mensaje')}")
    if asignacion.get("omitidos"):
        print(f"  omitidos: {json.dumps(asignacion['omitidos'], ensure_ascii=False)}")

    # --- 3. Publicación opcional de la jornada ---------------------------- #
    if args.publicar:
        despacho = despacho_del_dia(api, id_cuadrilla)
        if despacho is None:
            print("  ✗ no hay despacho del día que publicar")
        elif despacho.get("estado") == "PUBLICADO":
            print(f"  el despacho #{despacho['id_despacho']} ya está publicado")
        else:
            api.patch(f"/despachos/{despacho['id_despacho']}", {"estado": "PUBLICADO"})
            print(f"  despacho #{despacho['id_despacho']} publicado")

    # --- 4. Verificación de lectura --------------------------------------- #
    verificar(api, id_cuadrilla, ids_caso)
    if args.tecnico_p00 and args.tecnico_clave:
        verificar_sync(args.tecnico_p00, args.tecnico_clave, ids_caso)

    print("\nListo: los casos quedan despachados a la cuadrilla 0 para cerrarlos "
          "desde la APK (Contactado → Atender → Cerrar).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
