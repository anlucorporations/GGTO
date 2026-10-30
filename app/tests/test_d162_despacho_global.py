"""D-162 · El proceso del despacho con el universo completo y el reporte en 3 columnas.

Petición del usuario (2026-10-30), siete puntos:

1. El proceso considera **todo** el universo del día: la reparación que ingresó
   por la ingesta (`COMUNES`), el `MANTENIMIENTO` y los **casos especiales**.
2. Las **construcciones** (REFERIDOS, EMPRESAS y GOBIERNOS, más las
   CONSTRUCCION de la ingesta) van a **una sola cuadrilla**, y a esa cuadrilla
   **no** se le asignan casos de reparación ni de mantenimiento.
3. El **mantenimiento** se asigna a las cuadrillas **según el sector**.
4. Las **averías masivas** son prioritarias: van primero en el despacho.
5. El **cuadro de resumen** del despacho y la **versión imprimible** incluyen
   todos los casos asignados a la cuadrilla.
6. Al procesar el despacho se **avisa a los usuarios** (mensajería interna).
7. Las **métricas globales del día** dividen el despacho en 3 columnas
   (Comunes, Referidos, Empresa) con Asignados/Cerrados/Citado/Diferidos
   desglosados en Reparaciones y Construcción, más Enrutado.

Las pruebas fijan el contrato del backend; la web y la APK consumen los mismos
campos (`columnas`, `construccion_bloque_total`, `mantenimientos_por_sector`).
"""

from __future__ import annotations

from datetime import date

import pytest
from sqlalchemy import select

from app.models import Caso, Cuadrilla, Despacho, DespachoCasos, Mensaje
from app.services.tiempo import hoy_operativo

BASE = "/api/v1/despachos"
MASIVAS = "/api/v1/fallas-masivas"
HOY = hoy_operativo().isoformat()


@pytest.fixture()
def entorno(client, admin_token, db_session):
    """Tres sectores, tres cuadrillas y un caso de cada bloque del despacho."""
    headers = admin_token["admin"]
    id_central = admin_token["id_central"]

    def crear_sector(nombre: str, codigo: str, patron: str) -> int:
        r = client.post(
            "/api/v1/sectores",
            json={
                "id_central": id_central,
                "nombre": nombre,
                "codigo": codigo,
                "direcciones": [{"patron": patron}],
            },
            headers=headers,
        )
        assert r.status_code == 201, r.text
        return r.json()["id_sector"]

    alfa = crear_sector("Alfa", "TSD162A", "SECTOR D162 ALFA")
    beta = crear_sector("Beta", "TSD162B", "SECTOR D162 BETA")
    gamma = crear_sector("Gamma", "TSD162C", "SECTOR D162 GAMMA")

    for codigo, nombre in (
        ("TCD162A", "Cuadrilla D162 A"),
        ("TCD162B", "Cuadrilla D162 B"),
        ("TCD162C", "Cuadrilla D162 C"),
    ):
        r = client.post(
            "/api/v1/cuadrillas",
            json={"id_central": id_central, "codigo": codigo, "nombre": nombre},
            headers=headers,
        )
        assert r.status_code == 201, r.text

    consecutivo = {"n": 0}

    def crear(id_averia: str, direccion: str, **extra) -> dict:
        consecutivo["n"] += 1
        cuerpo = {
            "id_averia": id_averia,
            "direccion": direccion,
            "nombre_cliente": f"CLIENTE {id_averia}",
            "contacto_cliente": "04140000000",
            "id_pago": f"70000000{consecutivo['n']:02d}",
            "tipo_reporte": "REPARACION",
            "tipo_problema": "SIN_SERVICIO",
        }
        cuerpo.update(extra)
        r = client.post("/api/v1/casos", json=cuerpo, headers=headers)
        assert r.status_code == 201, r.text
        return r.json()

    # 1 · Comunes de la ingesta (Alfa).
    crear("TSTD162-A0", "SECTOR D162 ALFA CASA 0")
    crear("TSTD162-A1", "SECTOR D162 ALFA CASA 1")
    # 2 · Mantenimiento (Beta) — nace CONSTRUCCION y se reclasifica (D-161).
    man = crear(
        "TSTD162-M0",
        "SECTOR D162 BETA FAT 1",
        tipo_reporte="CONSTRUCCION",
        tipo_problema=None,
        nombre_cliente="JUSTIFICATIVO TSTD162-M0",
    )
    r = client.patch(
        f"/api/v1/casos/{man['id_caso']}",
        json={"tipo_caso": "MANTENIMIENTO", "categoria": "REFERIDO"},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    # 3 · Especiales: referido (Beta), empresa (Alfa), gobierno y construcción (Gamma).
    crear("TSTD162-R0", "SECTOR D162 BETA CALLE 1", categoria="REFERIDO")
    crear("TSTD162-E0", "SECTOR D162 ALFA AV 3", categoria="EMPRESA")
    crear("TSTD162-G0", "SECTOR D162 GAMMA PLAZA 4", categoria="GOBIERNO")
    crear(
        "TSTD162-C0",
        "SECTOR D162 GAMMA TORRE 5",
        tipo_reporte="CONSTRUCCION",
        tipo_problema=None,
        categoria="EMPRESA",
    )
    # 4 · Comunes de una falla masiva (Gamma).
    masiva_casos = [
        crear("TSTD162-F0", "SECTOR D162 GAMMA CASA 8"),
        crear("TSTD162-F1", "SECTOR D162 GAMMA CASA 9"),
    ]
    for caso in masiva_casos:
        fila = db_session.get(Caso, caso["id_caso"])
        fila.olt, fila.slot, fila.puerto, fila.fat = (
            "OLT-D162", "4", "9", "FAT-D162",
        )
    db_session.commit()

    cuadrillas = {
        c["codigo"]: c["id_cuadrilla"]
        for c in client.get(
            "/api/v1/cuadrillas",
            params={"id_central": id_central},
            headers=headers,
        ).json()
    }
    r = client.post(
        MASIVAS,
        json={
            "descripcion": "Masiva D162 del FAT Gamma",
            "id_sector": gamma,
            "id_cuadrilla": cuadrillas["TCD162A"],
            "olt": "OLT-D162",
            "slot": "4",
            "puerto": "9",
            "fat": "FAT-D162",
            "direccion": "SECTOR D162 GAMMA CASA 8",
            "ids_caso": [c["id_caso"] for c in masiva_casos],
        },
        headers=headers,
    )
    assert r.status_code == 201, r.text
    assert r.json()["casos_asociados"] == 2

    # La sectorización del alta ya asignó el sector por la dirección.
    yield {
        "headers": headers,
        "id_central": id_central,
        "sectores": {"Alfa": alfa, "Beta": beta, "Gamma": gamma},
        "cuadrillas": cuadrillas,
        "id_falla": r.json()["id_falla"],
        "crear": crear,
    }


def _proceso(client, entorno, fecha: str = HOY) -> dict:
    r = client.get(f"{BASE}/proceso", params={"fecha": fecha}, headers=entorno["headers"])
    assert r.status_code == 200, r.text
    return r.json()


def _asignar(client, entorno, nombre_a_codigo: dict[str, str], fecha: str = HOY) -> None:
    p = _proceso(client, entorno, fecha)
    sectores = {s["nombre"]: s["id_sector"] for s in p["sectores"]}
    cuadrillas = {c["codigo"]: c["id_cuadrilla"] for c in p["cuadrillas"]}
    bloques: dict[int, list[int]] = {c["id_cuadrilla"]: [] for c in p["cuadrillas"]}
    for nombre, codigo in nombre_a_codigo.items():
        bloques[cuadrillas[codigo]].append(sectores[nombre])
    r = client.put(
        f"{BASE}/asignacion",
        json={
            "fecha": fecha,
            "asignaciones": [
                {"id_cuadrilla": idc, "ids_sector": ids} for idc, ids in bloques.items()
            ],
        },
        headers=entorno["headers"],
    )
    assert r.status_code == 200, r.text


def _procesar(client, entorno, fecha: str = HOY, **extra):
    cuerpo = {"fecha": fecha, "asignaciones": [], "reemplazar": True}
    cuerpo.update(extra)
    r = client.post(f"{BASE}/procesar", json=cuerpo, headers=entorno["headers"])
    assert r.status_code == 201, r.text
    return r.json()


def _grupos(db_session, fecha: str = HOY) -> dict[str, list[DespachoCasos]]:
    """`codigo_cuadrilla` → filas del despacho ordenadas por `orden_visita`."""
    filas = db_session.execute(
        select(Despacho, Cuadrilla, DespachoCasos)
        .join(Cuadrilla, Cuadrilla.id_cuadrilla == Despacho.id_cuadrilla)
        .join(DespachoCasos, DespachoCasos.id_despacho == Despacho.id_despacho)
        .where(Despacho.fecha == date.fromisoformat(fecha))
        .order_by(Cuadrilla.codigo, DespachoCasos.orden_visita)
    ).all()
    salida: dict[str, list[DespachoCasos]] = {}
    for _despacho, cuadrilla, dc in filas:
        salida.setdefault(cuadrilla.codigo, []).append(dc)
    return salida


def _averias_por_cuadrilla(db_session, fecha: str = HOY) -> dict[str, set[str]]:
    filas = db_session.execute(
        select(Cuadrilla.codigo, Caso.id_averia)
        .join(Despacho, Despacho.id_cuadrilla == Cuadrilla.id_cuadrilla)
        .join(DespachoCasos, DespachoCasos.id_despacho == Despacho.id_despacho)
        .join(Caso, Caso.id_caso == DespachoCasos.id_caso)
        .where(Despacho.fecha == date.fromisoformat(fecha))
    ).all()
    salida: dict[str, set[str]] = {}
    for codigo, averia in filas:
        salida.setdefault(codigo, set()).add(averia)
    return salida


# --------------------------------------------------------------------------- #
# Punto 1 · universo completo (Comunes + Mantenimiento + especiales + masivas)
# --------------------------------------------------------------------------- #
def test_el_proceso_arranca_con_todo_el_universo_marcado(client, entorno):
    """D-162: el checklist viene marcado con los seis tipos, no solo Comunes."""
    p = _proceso(client, entorno)
    assert [t["clave"] for t in p["tipos"] if t["por_defecto"]] == [
        "COMUNES",
        "ESPECIALES_REPARACION",
        "ESPECIALES_CONSTRUCCION",
        "MANTENIMIENTO",
        "ESPECIALES_GOBIERNO",
        "MASIVAS",
    ]
    assert p["universo"]["por_tipo"] == {
        "COMUNES": 2,  # la reparación común que ingresó por la ingesta
        "ESPECIALES_REPARACION": 3,  # referido + empresa + gobierno (suma a su actividad)
        "ESPECIALES_CONSTRUCCION": 1,  # la construcción especial
        "MANTENIMIENTO": 1,
        "ESPECIALES_GOBIERNO": 1,
        "MASIVAS": 2,
    }
    assert p["universo"]["total"] == 9
    assert p["resumen"]["mantenimientos"] == 1


def test_procesar_sin_checklist_distribuye_el_universo_completo(client, entorno, db_session):
    _asignar(client, entorno, {"Alfa": "TCD162A", "Beta": "TCD162B", "Gamma": "TCD162C"})
    _procesar(client, entorno)
    averias = {a for grupo in _averias_por_cuadrilla(db_session).values() for a in grupo}
    assert averias == {
        "TSTD162-A0", "TSTD162-A1", "TSTD162-M0", "TSTD162-R0",
        "TSTD162-E0", "TSTD162-G0", "TSTD162-C0", "TSTD162-F0", "TSTD162-F1",
    }


# --------------------------------------------------------------------------- #
# Punto 2 · construcciones en una cuadrilla exclusiva
# --------------------------------------------------------------------------- #
def test_el_bloque_de_construcciones_va_a_una_cuadrilla_exclusiva(
    client, entorno, db_session
):
    """REFERIDO + EMPRESA + GOBIERNO + CONSTRUCCION en una cuadrilla sin reparaciones."""
    _asignar(client, entorno, {"Alfa": "TCD162A", "Beta": "TCD162B", "Gamma": "TCD162C"})
    _procesar(client, entorno)

    grupos = _grupos(db_session)
    con_bloque = {
        codigo for codigo, filas in grupos.items()
        if {dc.tipo_asignacion for dc in filas}
        & {"CONSTRUCCION", "REFERIDO", "EMPRESA"}
    }
    assert len(con_bloque) == 1, f"el bloque de construcciones se repartió: {con_bloque}"
    [codigo] = list(con_bloque)

    tipos = {dc.tipo_asignacion for dc in grupos[codigo]}
    assert "REPARACION" not in tipos
    assert "MANTENIMIENTO" not in tipos
    # La masiva sí puede quedarse: es prioritaria y no se desaloja (punto 4).
    assert "FALLA_MASIVA" in tipos

    # Las cuatro construcciones/especiales están en esa cuadrilla.
    averias = _averias_por_cuadrilla(db_session)[codigo]
    assert {"TSTD162-R0", "TSTD162-E0", "TSTD162-G0", "TSTD162-C0"} <= averias

    # Y las reparaciones comunes salieron de ella.
    assert not {"TSTD162-A0", "TSTD162-A1"} & averias


def test_las_reglas_del_bloque_se_informan_en_la_propuesta(client, entorno):
    _asignar(client, entorno, {"Alfa": "TCD162A", "Beta": "TCD162B", "Gamma": "TCD162C"})
    r = client.post(f"{BASE}/propuesta", headers=entorno["headers"])
    assert r.status_code == 200, r.text
    reglas = r.json()["reglas"]
    assert reglas["construccion_bloque_total"] == 4
    assert reglas["construccion_total"] == 1
    assert reglas["construccion_desalojados"] == 2
    assert reglas["construccion_cuadrilla_exclusiva"] is True
    assert reglas["construccion_en_una_sola"] is True
    assert reglas["masivas_prioritarias"] is True
    assert reglas["mantenimientos_por_sector"] is True

    # Los mismos datos viajan en el bloque `construccion` del formulario: las
    # claves deben estar **declaradas** en `ConstruccionProcesoOut` o Pydantic
    # las descarta al serializar (defecto detectado en el humo de v90).
    construccion = _proceso(client, entorno)["construccion"]
    assert construccion["bloque_total"] == 4
    assert construccion["total"] == 1
    assert construccion["excluye_reparaciones"] is True
    assert construccion["desalojados"] == 2


# --------------------------------------------------------------------------- #
# Punto 3 · mantenimiento por sector
# --------------------------------------------------------------------------- #
def test_el_mantenimiento_va_a_la_cuadrilla_de_su_sector(client, entorno, db_session):
    _asignar(client, entorno, {"Alfa": "TCD162A", "Beta": "TCD162B", "Gamma": "TCD162C"})
    _procesar(client, entorno)
    grupos = _grupos(db_session)
    ubicacion = {
        codigo: {dc.tipo_asignacion for dc in filas} for codigo, filas in grupos.items()
    }
    assert "MANTENIMIENTO" in ubicacion["TCD162B"], ubicacion
    assert "MANTENIMIENTO" not in ubicacion.get("TCD162A", set()), ubicacion


# --------------------------------------------------------------------------- #
# Punto 4 · masivas primero en el despacho
# --------------------------------------------------------------------------- #
def test_las_masivas_van_primero_en_el_orden_de_visita(client, entorno, db_session):
    _asignar(client, entorno, {"Alfa": "TCD162A", "Beta": "TCD162B", "Gamma": "TCD162C"})
    _procesar(client, entorno)
    filas = _grupos(db_session)["TCD162A"]
    assert [dc.tipo_asignacion for dc in filas[:2]] == ["FALLA_MASIVA", "FALLA_MASIVA"]
    assert [dc.orden_visita for dc in filas[:2]] == [1, 2]


# --------------------------------------------------------------------------- #
# Punto 5 · el imprimible incluye todos los casos de la cuadrilla
# --------------------------------------------------------------------------- #
def test_el_imprimible_lista_todos_los_casos_y_su_desglose(client, entorno, db_session):
    _asignar(client, entorno, {"Alfa": "TCD162A", "Beta": "TCD162B", "Gamma": "TCD162C"})
    creados = _procesar(client, entorno)
    from app.models import Cuadrilla as _Cuadrilla

    for despacho in creados:
        cuadrilla = db_session.get(_Cuadrilla, despacho["id_cuadrilla"])
        r = client.get(
            f"{BASE}/{despacho['id_despacho']}/imprimible", headers=entorno["headers"]
        )
        assert r.status_code == 200, r.text
        html = r.text
        esperadas = _averias_por_cuadrilla(db_session)[cuadrilla.codigo]
        for averia in esperadas:
            assert averia in html, f"{averia} no aparece en el imprimible"
        # Cabecera con el desglose por tipo (punto 5 de la petición).
        assert "Desglose por tipo" in html
        assert f"<strong>Casos:</strong> {len(esperadas)}" in html


# --------------------------------------------------------------------------- #
# Punto 6 · aviso a los usuarios al procesar
# --------------------------------------------------------------------------- #
def test_procesar_avisa_a_las_cuadrillas(client, entorno, db_session):
    _asignar(client, entorno, {"Alfa": "TCD162A", "Beta": "TCD162B", "Gamma": "TCD162C"})
    creados = _procesar(client, entorno)

    db_session.expire_all()
    mensajes = db_session.scalars(
        select(Mensaje).where(Mensaje.tipo == "ALARMA_DESPACHO")
    ).all()
    assert len(mensajes) == len(creados) >= 2
    for mensaje in mensajes:
        assert "DESPACHO DEL DÍA" in (mensaje.cuerpo or "")
        assert mensaje.id_cuadrilla is not None


# --------------------------------------------------------------------------- #
# Punto 7 · reporte del día en 3 columnas
# --------------------------------------------------------------------------- #
def test_el_reporte_del_dia_desglosa_el_despacho_en_tres_columnas(
    client, entorno, db_session
):
    _asignar(client, entorno, {"Alfa": "TCD162A", "Beta": "TCD162B", "Gamma": "TCD162C"})
    _procesar(client, entorno)

    # Desenlaces de la jornada para ejercitar el cruce completo.
    db_session.expire_all()
    estados = {
        "TSTD162-A0": "CERRADO",
        "TSTD162-A1": "CITADO",
        "TSTD162-R0": "ENRUTADO",
        "TSTD162-E0": "DIFERIDO",
        "TSTD162-C0": "CERRADO",
    }
    for averia, estado in estados.items():
        caso = db_session.scalar(select(Caso).where(Caso.id_averia == averia))
        caso.estado_actual = estado

    # D-162 · punto 7: una jornada despachada **antes** de D-161 conserva
    # `despacho_caso.tipo_asignacion = CONSTRUCCION` en los «JUSTIFICATIVO» ya
    # asignados. El reporte debe contarlos por su categoría (Comunes si son
    # residenciales) para que la reconciliación cuadre con el total.
    legacy = db_session.scalar(
        select(DespachoCasos)
        .join(Caso, Caso.id_caso == DespachoCasos.id_caso)
        .where(Caso.id_averia == "TSTD162-F0")
    )
    legacy.tipo_asignacion = "CONSTRUCCION"
    db_session.commit()

    r = client.get(f"{BASE}/reporte/produccion", headers=entorno["headers"])
    assert r.status_code == 200, r.text
    reporte = r.json()
    totales = reporte["totales"]

    comunes = totales["columnas"]["comunes"]
    # 2 comunes + el «JUSTIFICATIVO» legacy (CONSTRUCCION en el despacho, pero
    # residencial por categoría) = 3 asignados de reparación.
    assert comunes["asignados"] == 3
    assert comunes["asignados_reparacion"] == 3
    assert comunes["asignados_construccion"] == 0
    assert comunes["cerrados"] == 1 and comunes["cerrados_reparacion"] == 1
    assert comunes["citado"] == 1 and comunes["citado_reparacion"] == 1
    assert comunes["enrutado"] == 0 and comunes["diferidos"] == 0

    referidos = totales["columnas"]["referidos"]
    assert referidos["asignados"] == 1
    assert referidos["enrutado"] == 1

    empresa = totales["columnas"]["empresa"]
    assert empresa["asignados"] == 3
    assert empresa["asignados_reparacion"] == 2
    assert empresa["asignados_construccion"] == 1
    assert empresa["cerrados"] == 1 and empresa["cerrados_construccion"] == 1
    assert empresa["diferidos"] == 1 and empresa["diferidos_reparacion"] == 1

    # Mantenimiento y masivas se informan aparte y el total cuadra.
    assert totales["mantenimientos"] == 1
    # Solo el caso masivo que conserva `tipo_asignacion = FALLA_MASIVA`.
    assert totales["casos_masiva"] == 1
    assert totales["masivas"] == 1  # una falla masiva cubierta
    suma_columnas = sum(
        totales["columnas"][clave]["asignados"]
        for clave in ("comunes", "referidos", "empresa")
    )
    assert suma_columnas + totales["mantenimientos"] + totales["casos_masiva"] == (
        totales["asignados"]
    )
    assert totales["asignados"] == 9
