#!/usr/bin/env python3
"""Sembrado de la PRUEBA DE CAMPO de la APK (D-112).

Prepara, contra la API de la plataforma, el escenario completo de una prueba de
campo real:

1. **4 cuadrillas de prueba** `C-990`, `C-992`, `C-994` y `C-996`.
2. **4 sectores de prueba** (`TEST-NORTE`, `TEST-ESTE`, `TEST-OESTE`, `TEST-SUR`)
   con un patrón de dirección propio, para que la sectorización de la ingesta no
   dependa de las direcciones reales de producción.
3. **3 técnicos de prueba** (`990001`, `990002`, `990003`) con su cuenta de
   usuario activada (rol TECNICO) y su clave de campo.
4. **10 casos comunes** por **INGESTA** (`TEST-CAMPO-0001…0010`), repartidos en
   los cuatro sectores: 3 · 3 · 2 · 2.
5. **10 casos de una MASIVA** por ingesta (`TEST-MASIVA-0001…0010`), todos en
   `TEST-OESTE` y con la misma OLT/FAT, más la falla masiva que los agrupa.
6. **10 casos especiales** de alta manual (`TEST-ESP-0001…0010`).
7. **Despacho del día** con los cuatro sectores asignados a las cuatro cuadrillas.

Todo el texto que viaja a la plataforma lleva la marca **TEST** para que el
sembrado sea reconocible y reversible. El script es **idempotente**: busca lo que
ya existe antes de crearlo.

USO
    # 1) Simulación: solo consulta (no escribe nada)
    python RepoTecnico/pruebas/sembrar_campo_test.py --p00 <SUPER> --clave <clave>

    # 2) Aplicar el sembrado
    python RepoTecnico/pruebas/sembrar_campo_test.py --p00 <SUPER> --clave <clave> --aplicar

    # 3) Rehacer el despacho de hoy (reproceso) sin volver a sembrar
    python RepoTecnico/pruebas/sembrar_campo_test.py --p00 … --clave … --solo-despacho --aplicar

VARIABLES
    GGTO_API      URL base de la API (por defecto, producción)
    GGTO_P00      P00 del usuario que siembra (alternativa a --p00)
    GGTO_CLAVE    Clave de ese usuario (alternativa a --clave)

SALIDA
    Imprime el resumen y escribe `salida_sembrado_campo.json` en el directorio
    temporal del sistema, con los identificadores creados.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

API = os.environ.get(
    "GGTO_API", "https://ggto-web-593453426217.europe-west1.run.app/api/v1"
)
ZONA = ZoneInfo("America/Caracas")

#: Clave que se fija en el primer acceso de los técnicos de prueba.
CLAVE_CAMPO = "Campo.Test.2026"
#: Identificador de pago (70*) de los casos sembrados: 7000001001, 7000001002…
BASE_PAGO = 7000001000

SECTORES = (
    ("TESTN", "TEST-NORTE", "TEST GGTO NORTE"),
    ("TESTE", "TEST-ESTE", "TEST GGTO ESTE"),
    ("TESTO", "TEST-OESTE", "TEST GGTO OESTE"),
    ("TESTS", "TEST-SUR", "TEST GGTO SUR"),
)
CUADRILLAS = (
    ("C-990", "CUADRILLA TEST 990", "TESTN"),
    ("C-992", "CUADRILLA TEST 992", "TESTE"),
    ("C-994", "CUADRILLA TEST 994", "TESTO"),
    ("C-996", "CUADRILLA TEST 996", "TESTS"),
)
TECNICOS = (
    ("990001", "TEST", "CAMPO UNO", "990-001"),
    ("990002", "TEST", "CAMPO DOS", "990-002"),
    ("990003", "TEST", "CAMPO TRES", "990-003"),
)
#: Reparto de los 10 casos comunes por sector.
REPARTO_COMUNES = {"TESTN": 3, "TESTE": 3, "TESTO": 2, "TESTS": 2}
#: Los 10 casos de la masiva viven en este sector.
SECTOR_MASIVA = "TESTO"
#: Cuadrilla que atiende la masiva (y su sector).
CUADRILLA_MASIVA = "C-994"

# Cabecera de 80 columnas del contrato de interfaz (mismo orden que producción).
ENCABEZADO = [
    "region", "estado geografico", "capital estado geografico", "municipio",
    "parroquia", "estado operativo", "distrito", "area", "central",
    "nombre central", "id_averia", "tipo_reporte", "dac", "telefono",
    "fecha_reporte", "persona_reporta", "contacto", "fecha_compromiso",
    "fecha_cita", "ultimo_usuario", "ultimo_comentario", "results",
    "asignado_a", "cuadrilla", "fecha_despacho", "ciudad", "estatus",
    "problema_reporte", "servicio_off_on", "cliente_notificado", "informacion",
    "informacion", "nombre", "direccion", "fecha_instalacion", "olt", "ip",
    "tarjeta", "plan", "slot", "puerto", "ont_id", "fat", "serial", "cvlan",
    "extra", "area_trabajo", "dias transcurrido desde la apertura",
    "area_resolutoria", "tipo_servicio", "tipo_problema", "descripcion",
    "usuario_acciona", "fecha_acciona", "dias transcurrido en area resolutoria",
    "codigo_causa", "descripcion", "Subcodigo_causa", "descripcion",
    "con_serv_aba", "unidad_negocio", "ups", "codigos_gestionados_en_VENAPP",
    "codigos_sin_gestion_en_VENAPP", "Reparador Principal", "Ayudante 1",
    "Ayudante 2", "Ayudante 3", "Ayudante 4", "Ayudante 5", "Ayudante 6",
    "Ayudante 7", "Ayudante 8", "Ayudante 9", "Flota (CAN)", "Nombre",
    "Apellido", "Telefono Oficina", "Telefono Movil",
    "Fecha Hora Asignacion",
]


def _fecha_csv(momento: datetime) -> str:
    """`dd/mm/aaaa hh:mm:ss a.m./p.m.`, el formato del contrato."""
    sufijo = "a.m." if momento.hour < 12 else "p.m."
    hora12 = momento.hour % 12 or 12
    return (
        f"{momento.day:02d}/{momento.month:02d}/{momento.year} "
        f"{hora12:02d}:{momento.minute:02d}:{momento.second:02d} {sufijo}"
    )


class Api:
    """Cliente mínimo de la plataforma (con el token ya adjunto)."""

    def __init__(self, base: str, token: str | None = None) -> None:
        self.base = base.rstrip("/")
        self.token = token
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

    def get(self, ruta: str, **params) -> object:
        respuesta = self.sesion.get(
            f"{self.base}{ruta}", params=params, headers=self._cabeceras(), timeout=60
        )
        self._revisar(respuesta, f"GET {ruta}")
        return respuesta.json()

    def post(self, ruta: str, cuerpo: dict | None = None, **kwargs) -> object:
        respuesta = self.sesion.post(
            f"{self.base}{ruta}", json=cuerpo, headers=self._cabeceras(),
            timeout=120, **kwargs
        )
        self._revisar(respuesta, f"POST {ruta}")
        return respuesta.json() if respuesta.content else None

    def put(self, ruta: str, cuerpo: dict) -> object:
        respuesta = self.sesion.put(
            f"{self.base}{ruta}", json=cuerpo, headers=self._cabeceras(), timeout=120
        )
        self._revisar(respuesta, f"PUT {ruta}")
        return respuesta.json() if respuesta.content else None

    def patch(self, ruta: str, cuerpo: dict) -> object:
        respuesta = self.sesion.patch(
            f"{self.base}{ruta}", json=cuerpo, headers=self._cabeceras(), timeout=120
        )
        self._revisar(respuesta, f"PATCH {ruta}")
        return respuesta.json() if respuesta.content else None

    def subir(self, ruta: str, nombre: str, contenido: bytes) -> object:
        respuesta = self.sesion.post(
            f"{self.base}{ruta}",
            files={"archivo": (nombre, contenido, "text/csv")},
            headers=self._cabeceras(),
            timeout=180,
        )
        self._revisar(respuesta, f"POST {ruta} (archivo)")
        return respuesta.json()

    @staticmethod
    def _revisar(respuesta: requests.Response, que: str) -> None:
        if respuesta.status_code >= 400:
            detalle = respuesta.text[:600]
            raise SystemExit(f"ERROR {respuesta.status_code} en {que}: {detalle}")


# --------------------------------------------------------------------------- #
# Archivo de ingesta
# --------------------------------------------------------------------------- #
def fila_csv(
    *, id_averia: str, nombre: str, direccion: str, telefono: str, olt: str,
    fat: str, serial: str, ruta: str, problema: str, cuando: datetime,
) -> list[str]:
    """Una fila de 80 columnas coherente con la plataforma y marcada TEST."""
    fila = [""] * 80
    valores = {
        0: "CAPITAL", 1: "BOLIVARIANO MIRANDA", 2: "LOS TEQUES", 3: "BARUTA",
        4: "BARUTA", 5: "MIRANDA-2", 6: "10204", 7: "AREA 4", 8: "2324X",
        9: "FRANCISCO SALIAS", 10: id_averia, 11: "INTERNO", 12: "100",
        13: telefono, 14: _fecha_csv(cuando), 15: "COORDINACION TEST",
        16: telefono, 17: _fecha_csv(cuando + timedelta(days=2)),
        19: "SUPERVISOR TEST", 20: problema, 25: "CARACAS", 26: "PEND",
        27: f"TEST {problema}", 28: "SIN_SERVICIO", 29: "0",
        30: f"TEST {problema}", 32: nombre, 33: direccion, 35: olt,
        38: "ABA ULTRA TEST", 39: "1", 40: "2", 42: fat, 43: serial,
        45: ruta, 46: "PTAEXT", 49: "ABA ULTRA", 50: "NL",
        51: f"TEST {problema}", 60: "CANTV RESIDENCIAL", 61: "RES",
    }
    for indice, valor in valores.items():
        fila[indice] = valor
    return fila


def construir_csv(filas: list[list[str]]) -> bytes:
    """CSV del contrato: `;`, ISO-8859-1 y CRLF."""
    lineas = [";".join(ENCABEZADO)]
    lineas += [";".join(fila) for fila in filas]
    return ("\r\n".join(lineas) + "\r\n").encode("iso-8859-1")


def casos_comunes(cuando: datetime) -> list[list[str]]:
    """Los 10 casos comunes: 3 · 3 · 2 · 2 por sector.

    Cada caso lleva su **propia OLT** y su propio FAT: así la detección
    automática de masivas (5 casos en 24 h por OLT) no los agrupa y llegan al
    despacho como casos comunes de calle.
    """
    filas: list[list[str]] = []
    numero = 1
    for codigo_sector, cantidad in REPARTO_COMUNES.items():
        patron = next(p for c, _, p in SECTORES if c == codigo_sector)
        for _ in range(cantidad):
            filas.append(fila_csv(
                id_averia=f"TEST-CAMPO-{numero:04d}",
                nombre=f"CLIENTE TEST CAMPO {numero:02d}",
                direccion=f"{patron}, CALLE {numero} CON AVENIDA {numero + 1}, CASA {numero}",
                telefono=str(BASE_PAGO + numero),
                olt=f"OLT-TEST-C{numero:02d}",
                fat=f"FAT-TEST-C{numero:02d}",
                serial=f"SERIAL-TEST-C{numero:04d}",
                ruta=f"TEST RUTA CAMPO / C{numero:02d}",
                problema="FALLA FIBRA EN DOMICILIO, CORTE TOTAL DEL SERVICIO",
                cuando=cuando,
            ))
            numero += 1
    return filas


def casos_masiva(cuando: datetime) -> list[list[str]]:
    """Los 10 casos de la masiva: mismo sector, misma OLT y mismo FAT.

    La **misma OLT** en los diez es deliberada: concentra 10 casos en 24 h y la
    detección automática de la ingesta (umbral 5 por OLT) crea la falla masiva
    que los agrupa, sin inventar una masiva a mano.
    """
    patron = next(p for c, _, p in SECTORES if c == SECTOR_MASIVA)
    filas: list[list[str]] = []
    for numero in range(1, 11):
        filas.append(fila_csv(
            id_averia=f"TEST-MASIVA-{numero:04d}",
            nombre=f"CLIENTE TEST MASIVA {numero:02d}",
            direccion=f"{patron}, SECTOR MASIVA, MANZANA {numero}, CASA {numero}",
            telefono=str(BASE_PAGO + 100 + numero),
            olt="OLT-TEST-MASIVA",
            fat="FAT-TEST-MASIVA",
            serial=f"SERIAL-TEST-M{numero:04d}",
            ruta="TEST RUTA MASIVA / TARJETA 1 / PUERTO 1",
            problema="FALLA FIBRA MASIVA: AFECTACION DEL FAT COMPLETO",
            cuando=cuando,
        ))
    return filas


def ids_caso_por_prefijo(api: "Api", prefijo: str) -> list[int]:
    """`id_caso` de los casos cuyo `id_averia` empieza por el prefijo."""
    pagina = api.get("/casos", q=prefijo, page_size=100, solo_abiertos=True)
    return [
        item["id_caso"]
        for item in pagina.get("items", [])
        if str(item.get("id_averia", "")).startswith(prefijo)
    ]


# --------------------------------------------------------------------------- #
# Sembrado
# --------------------------------------------------------------------------- #
def sembrar(api: Api, aplicar: bool, solo_despacho: bool) -> dict:
    hoy = datetime.now(ZONA).date()
    ahora = datetime.now(ZONA).replace(microsecond=0)
    resumen: dict = {"fecha": str(hoy), "aplicado": aplicar, "api": api.base}

    print(f"== Catálogos existentes ({api.base}) ==")
    sectores = {s["codigo"]: s for s in api.get("/sectores")}
    cuadrillas = {c["codigo"]: c for c in api.get("/cuadrillas")}
    tecnicos = {t["p00"]: t for t in api.get("/tecnicos")}
    print(f"  sectores={len(sectores)} cuadrillas={len(cuadrillas)} tecnicos={len(tecnicos)}")

    if solo_despacho:
        resumen["despacho"] = despachar(api, sectores, cuadrillas, hoy, aplicar)
        return resumen

    # --- 1. Sectores de prueba ------------------------------------------- #
    print("== Sectores de prueba ==")
    ids_sector: dict[str, int] = {}
    for codigo, nombre, patron in SECTORES:
        existente = sectores.get(codigo)
        if existente:
            ids_sector[codigo] = existente["id_sector"]
            print(f"  {codigo}: ya existe (#{existente['id_sector']} {existente['nombre']})")
            continue
        if not aplicar:
            print(f"  {codigo}: se crearía con el patrón «{patron}»")
            continue
        creado = api.post("/sectores", {
            "id_central": 1, "nombre": nombre, "codigo": codigo,
            "descripcion": "TEST · sector de la prueba de campo (D-112)",
            "prioridad": 50, "activo": True,
            "direcciones": [{
                "patron": patron, "tipo_coincidencia": "CONTIENE",
                "normalizar": True, "activo": True,
            }],
        })
        ids_sector[codigo] = creado["id_sector"]
        print(f"  {codigo}: creado (#{creado['id_sector']} {creado['nombre']})")
    resumen["sectores"] = ids_sector

    # --- 2. Cuadrillas ---------------------------------------------------- #
    print("== Cuadrillas de prueba ==")
    ids_cuadrilla: dict[str, int] = {}
    for codigo, nombre, _sector in CUADRILLAS:
        existente = cuadrillas.get(codigo)
        if existente:
            ids_cuadrilla[codigo] = existente["id_cuadrilla"]
            print(f"  {codigo}: ya existe (#{existente['id_cuadrilla']} {existente['nombre']})")
            continue
        if not aplicar:
            print(f"  {codigo}: se crearía ({nombre})")
            continue
        creada = api.post("/cuadrillas", {
            "id_central": 1, "codigo": codigo, "nombre": nombre,
            "es_supervisor": False, "activa": True,
            "integrantes": [], "herramientas": [],
        })
        ids_cuadrilla[codigo] = creada["id_cuadrilla"]
        print(f"  {codigo}: creada (#{creada['id_cuadrilla']})")
    resumen["cuadrillas"] = ids_cuadrilla

    # --- 3. Técnicos ------------------------------------------------------ #
    print("== Técnicos de prueba ==")
    ids_tecnico: dict[str, int] = {}
    for p00, nombre, apellido, _interno in TECNICOS:
        existente = tecnicos.get(p00)
        if existente:
            ids_tecnico[p00] = existente["id_tecnico"]
            print(f"  {p00}: ya existe (#{existente['id_tecnico']} {existente['nombre']})")
            continue
        if not aplicar:
            print(f"  {p00}: se crearía ({nombre} {apellido}) y se activaría su cuenta")
            continue
        creado = api.post("/tecnicos", {
            "id_central": 1, "nombre": nombre, "apellido": apellido,
            "cedula": f"V-{p00}", "p00": p00,
            "correo": f"test.campo.{p00}@example.invalid",
            "especialidad": "TEST CAMPO", "status": "ACTIVO",
        })
        ids_tecnico[p00] = creado["id_tecnico"]
        # Primer acceso: crea el usuario TECNICO con su clave de campo.
        api.post("/auth/setup", {
            "p00": p00,
            "correo": f"test.campo.{p00}@example.invalid",
            "clave": CLAVE_CAMPO,
            "confirmacion": CLAVE_CAMPO,
        })
        print(f"  {p00}: creado (#{creado['id_tecnico']}) y cuenta activada")
    resumen["tecnicos"] = ids_tecnico
    resumen["clave_campo"] = CLAVE_CAMPO

    # --- 4. Integrantes de cuadrilla -------------------------------------- #
    print("== Integrantes de cuadrilla (técnico → cuadrilla) ==")
    asignacion_tecnico = dict(zip(
        [p for p, *_ in TECNICOS],
        [c for c, *_ in CUADRILLAS],
        strict=False,
    ))
    for p00, codigo_cuadrilla in asignacion_tecnico.items():
        id_tecnico = ids_tecnico.get(p00)
        id_cuadrilla = ids_cuadrilla.get(codigo_cuadrilla)
        if not id_tecnico or not id_cuadrilla:
            print(f"  {p00} → {codigo_cuadrilla}: pendiente (simulación)")
            continue
        actuales = api.get(f"/cuadrillas/{id_cuadrilla}").get("integrantes", [])
        if any(i["id_tecnico"] == id_tecnico for i in actuales):
            print(f"  {p00} → {codigo_cuadrilla}: ya es integrante")
            continue
        if not aplicar:
            print(f"  {p00} → {codigo_cuadrilla}: se añadiría")
            continue
        api.post(f"/cuadrillas/{id_cuadrilla}/integrantes", {
            "id_tecnico": id_tecnico, "rol_cuadrilla": "REPARADOR_PRINCIPAL",
        })
        print(f"  {p00} → {codigo_cuadrilla}: añadido")

    # --- 5. Ingesta: 10 casos comunes ------------------------------------- #
    print("== Ingesta: 10 casos comunes (TEST-CAMPO-*) ==")
    comunes = casos_comunes(ahora)
    if aplicar:
        resumen_comunes = api.subir("/ingesta", "test_campo_comunes.csv", construir_csv(comunes))
        print(
            f"  nuevas={resumen_comunes.get('casos_nuevos')} "
            f"duplicadas={resumen_comunes.get('casos_duplicados')} "
            f"sectorizados={resumen_comunes.get('sectorizados')} "
            f"sin_sector={resumen_comunes.get('sin_sector')} "
            f"cuadrilla0={resumen_comunes.get('cuadrilla0')}"
        )
        resumen["ingesta_comunes"] = resumen_comunes
    else:
        print(f"  se subirían {len(comunes)} filas")

    # --- 6. Ingesta: 10 casos de la masiva -------------------------------- #
    print("== Ingesta: 10 casos de la masiva (TEST-MASIVA-*) ==")
    masiva = casos_masiva(ahora)
    if aplicar:
        resumen_masiva = api.subir("/ingesta", "test_campo_masiva.csv", construir_csv(masiva))
        print(
            f"  nuevas={resumen_masiva.get('casos_nuevos')} "
            f"duplicadas={resumen_masiva.get('casos_duplicados')} "
            f"sectorizados={resumen_masiva.get('sectorizados')} "
            f"sin_sector={resumen_masiva.get('sin_sector')}"
        )
        resumen["ingesta_masiva"] = resumen_masiva
    else:
        print(f"  se subirían {len(masiva)} filas")

    # --- 7. Falla masiva que agrupa los 10 casos -------------------------- #
    print("== Falla masiva de los 10 casos TEST-MASIVA-* ==")
    id_sector_masiva = ids_sector.get(SECTOR_MASIVA) or next(
        (s["id_sector"] for s in api.get("/sectores") if s["codigo"] == SECTOR_MASIVA), None
    )
    id_cuadrilla_masiva = ids_cuadrilla.get(CUADRILLA_MASIVA) or next(
        (c["id_cuadrilla"] for c in api.get("/cuadrillas")
         if c["codigo"] == CUADRILLA_MASIVA), None
    )
    if not aplicar:
        print("  pendiente (simulación)")
    else:
        falla = None
        for candidata in api.get("/fallas-masivas", limite=50):
            clave = str(candidata.get("clave_concentracion") or "")
            if "OLT-TEST-MASIVA" in clave or "TEST-MASIVA" in clave:
                falla = candidata
                break
        if falla:
            print(
                f"  detectada por concentración: #{falla['id_falla']} · "
                f"{falla.get('casos_asociados')} caso(s) · «{str(falla.get('descripcion'))[:60]}»"
            )
        else:
            # La detección automática no la creó: se crea a mano y se asocian
            # exactamente los diez casos (sin `id_sector`, para no arrastrar
            # otros casos del sector — advertencia A13).
            ids = ids_caso_por_prefijo(api, "TEST-MASIVA-")
            if not ids:
                print("  AVISO: no se encontraron los casos TEST-MASIVA-*; sin masiva")
            else:
                falla = api.post("/fallas-masivas", {
                    "descripcion": "TEST MASIVA CAMPO · afectación del FAT completo",
                    "id_cuadrilla": id_cuadrilla_masiva,
                    "origen": "REPORTE_TECNICO",
                    "odn": "ODN-TEST-MASIVA",
                    "direccion": "TEST GGTO OESTE, SECTOR MASIVA",
                    "fat": "FAT-TEST-MASIVA",
                })
                print(f"  creada a mano #{falla['id_falla']}")
                api.post(f"/fallas-masivas/{falla['id_falla']}/casos", {"ids_caso": ids})
                print(f"  asociados {len(ids)} caso(s)")
        if falla:
            falla = api.patch(f"/fallas-masivas/{falla['id_falla']}", {
                "id_cuadrilla": id_cuadrilla_masiva,
                "id_sector": id_sector_masiva,
            })
            print(
                f"  cuadrilla #{id_cuadrilla_masiva} · sector #{id_sector_masiva} · "
                f"{falla.get('casos_asociados')} caso(s) asociado(s)"
            )
            resumen["masiva"] = {
                "id_falla": falla.get("id_falla"),
                "clave_concentracion": falla.get("clave_concentracion"),
                "casos_asociados": falla.get("casos_asociados"),
                "id_cuadrilla": falla.get("id_cuadrilla"),
            }

    # --- 8. Casos especiales (10, alta manual) ---------------------------- #
    print("== Casos especiales de prueba (TEST-ESP-*) ==")
    clasificaciones = ("REFERIDO", "EMPRESA", "GOBIERNO")
    prioridades = ("ALTA", "MEDIA", "BAJA")
    id_solicitante = None
    creados_especiales: list[dict] = []
    for numero in range(1, 11):
        if not aplicar:
            print(f"  TEST-ESP-{numero:04d}: se crearía")
            continue
        cuerpo: dict = {
            "clasificacion": clasificaciones[(numero - 1) % 3],
            "tipo_actividad": "REPARACION",
            "prioridad": prioridades[(numero - 1) % 3],
            "descripcion": (
                f"TEST ESPECIAL {numero:02d} · caso especial de la prueba de campo "
                f"(D-112), registrado a mano para seguimiento del supervisor"
            ),
            "requiere_informe": True,
            "id_averia": f"TEST-ESP-{numero:04d}",
            "nombre_cliente": f"CLIENTE TEST ESPECIAL {numero:02d}",
            "contacto_cliente": f"0414-000{numero:04d}",
            # El endpoint exige el identificador de pago (70*): 10 dígitos.
            "telefono": str(BASE_PAGO + 200 + numero),
            "direccion": f"TEST GGTO ESTE, AVENIDA ESPECIAL {numero}, EDIFICIO {numero}",
            "tipo_problema": "NL",
        }
        if id_solicitante is None:
            cuerpo["crear_solicitante"] = {
                "unidad": "UNIDAD TEST CAMPO",
                "nombre": "SOLICITANTE TEST CAMPO",
                "contacto": "0414-0009999",
                "canal": "MANUAL",
                "tipo": "SOLICITANTE",
            }
        else:
            cuerpo["id_solicitante"] = id_solicitante
        try:
            especial = api.post("/casos-especiales", cuerpo)
        except SystemExit as exc:
            print(f"  TEST-ESP-{numero:04d}: {exc}")
            break
        id_solicitante = (especial.get("solicitante") or {}).get("id_solicitante") or id_solicitante
        creados_especiales.append(especial)
        print(
            f"  #{especial.get('id_caso_especial')} TEST-ESP-{numero:04d} "
            f"{especial.get('clasificacion')} · {especial.get('prioridad')}"
        )
    resumen["especiales"] = [e.get("id_caso_especial") for e in creados_especiales]

    # --- 9. Despacho del día --------------------------------------------- #
    resumen["despacho"] = despachar(api, sectores, cuadrillas, hoy, aplicar)
    return resumen


def despachar(api: Api, sectores: dict, cuadrillas: dict, hoy: date, aplicar: bool) -> dict:
    """Asigna cada sector de prueba a su cuadrilla y procesa el despacho."""
    print(f"== Despacho del día {hoy} ==")
    asignaciones = []
    for codigo_cuadrilla, _nombre, codigo_sector in CUADRILLAS:
        cuadrilla = cuadrillas.get(codigo_cuadrilla)
        sector = sectores.get(codigo_sector)
        if not cuadrilla or not sector:
            # En una segunda corrida los catálogos se recargan abajo.
            continue
        asignaciones.append({
            "id_cuadrilla": cuadrilla["id_cuadrilla"],
            "ids_sector": [sector["id_sector"]],
        })
    if len(asignaciones) < len(CUADRILLAS):
        # Recargar catálogos (primera corrida: se acaban de crear).
        sectores_nuevos = {s["codigo"]: s for s in api.get("/sectores")}
        cuadrillas_nuevas = {c["codigo"]: c for c in api.get("/cuadrillas")}
        asignaciones = []
        for codigo_cuadrilla, _nombre, codigo_sector in CUADRILLAS:
            cuadrilla = cuadrillas_nuevas.get(codigo_cuadrilla)
            sector = sectores_nuevos.get(codigo_sector)
            if cuadrilla and sector:
                asignaciones.append({
                    "id_cuadrilla": cuadrilla["id_cuadrilla"],
                    "ids_sector": [sector["id_sector"]],
                })
    print("  asignación: " + ", ".join(
        f"C#{b['id_cuadrilla']}←S#{b['ids_sector'][0]}" for b in asignaciones
    ))
    if not aplicar:
        print("  se procesaría el despacho (simulación)")
        return {"asignaciones": asignaciones}
    if asignaciones:
        api.put("/despachos/asignacion", {
            "fecha": str(hoy), "id_central": 1, "asignaciones": asignaciones,
        })
    despachos = api.post("/despachos/procesar", {
        "fecha": str(hoy), "id_central": 1,
        "asignaciones": asignaciones, "reemplazar": True,
    })
    salida = []
    for despacho in despachos:
        print(
            f"  despacho #{despacho.get('id_despacho')} · cuadrilla "
            f"{despacho.get('id_cuadrilla')} · {len(despacho.get('casos') or [])} caso(s)"
        )
        salida.append({
            "id_despacho": despacho.get("id_despacho"),
            "id_cuadrilla": despacho.get("id_cuadrilla"),
            "casos": len(despacho.get("casos") or []),
        })
    return {"asignaciones": asignaciones, "despachos": salida}


def reiniciar_casos(api: "Api", aplicar: bool) -> dict:
    """Devuelve a `NUEVO` los casos de la prueba, para repetirla.

    La prueba de campo mueve los casos (CONTACTADO, CERRADO, CITADO, DIFERIDO).
    Antes de cada corrida hay que dejarlos como recién ingresados; si no, la APK
    ya no ofrece las acciones de la ficha.
    """
    prefijos = ("TEST-CAMPO-", "TEST-MASIVA-", "TEST-ESP-")
    pagina = api.get("/casos", q="TEST", page_size=100, solo_abiertos=False)
    casos = [
        item for item in pagina.get("items", [])
        if str(item.get("id_averia", "")).startswith(prefijos)
    ]
    print(f"== Reinicio de {len(casos)} caso(s) TEST a NUEVO ==")
    reiniciados: list[dict] = []
    for caso in casos:
        estado = str(caso.get("estado_actual") or "").upper()
        if estado == "NUEVO":
            continue
        if not aplicar:
            print(f"  {caso['id_averia']}: {estado} → NUEVO (simulación)")
            continue
        api.post(f"/casos/{caso['id_caso']}/estado", {
            "estado_actual": "NUEVO",
            "motivo_estado": "Reinicio de la prueba de campo TEST (D-112)",
        })
        print(f"  {caso['id_averia']}: {estado} → NUEVO")
        reiniciados.append({"id_caso": caso["id_caso"], "id_averia": caso["id_averia"]})
    print(f"  reiniciados: {len(reiniciados)}")
    return {"reiniciados": reiniciados}


def main() -> int:
    parser = argparse.ArgumentParser(description="Sembrado de la prueba de campo (D-112)")
    parser.add_argument("--p00", default=os.environ.get("GGTO_P00"), help="P00 que siembra")
    parser.add_argument("--clave", default=os.environ.get("GGTO_CLAVE"), help="Clave de ese P00")
    parser.add_argument("--api", default=API, help=f"URL de la API (por defecto {API})")
    parser.add_argument("--aplicar", action="store_true", help="Escribe en la plataforma")
    parser.add_argument(
        "--solo-despacho", action="store_true",
        help="Solo rehace la asignación y el despacho del día",
    )
    parser.add_argument(
        "--reiniciar-casos", action="store_true",
        help="Devuelve a NUEVO los casos TEST (para repetir la prueba de campo)",
    )
    args = parser.parse_args()

    if not args.p00 or not args.clave:
        parser.error("indique --p00 y --clave (o GGTO_P00 / GGTO_CLAVE)")

    api = Api(args.api)
    usuario = api.login(args.p00, args.clave)
    print(
        f"Conectado a {args.api} como {usuario['usuario']['p00']} "
        f"(rol {usuario['usuario']['rol']}, central {usuario['usuario']['id_central']})"
    )
    if not args.aplicar:
        print("MODO SIMULACIÓN · no se escribe nada (use --aplicar)\n")

    if args.reiniciar_casos:
        reiniciar_casos(api, args.aplicar)
        return 0

    resumen = sembrar(api, args.aplicar, args.solo_despacho)

    destino = Path(tempfile.gettempdir()) / "ggto-field" / "salida_sembrado_campo.json"
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps(resumen, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nResumen escrito en {destino}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
