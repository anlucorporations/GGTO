"""Pruebas del incremento D-114: especiales separados y masivas por sector.

Cubren los tres puntos de la petición sobre el **proceso de despacho**:

1. los **especiales** dejan de ser un concepto único y se separan en
   **Especiales Reparación**, **Especiales Construcción** y **Especiales
   Gobierno**; la clasificación de gobierno suma a la actividad del caso;
2. esa separación llega al **resumen principal** (`universo`) y al **cuadro de
   sectores**, que expone las tres cifras por sector;
3. la tabla de sectores trae las **masivas del sector** y el formulario puede
   dejar fuera del despacho las que el sector no marque.

Los identificadores de prueba empiezan por `TSTD14`/`TCD14`/`TSD14`/`TSDG14`
para que el aseo de `conftest` los barra entre pruebas.
"""

from __future__ import annotations

from datetime import date

import pytest
from sqlalchemy import select

from app.models import Caso, Cuadrilla, Despacho, DespachoCasos
from app.services import despacho as svc
from app.services.tiempo import hoy_operativo

BASE = "/api/v1/despachos"
MASIVAS = "/api/v1/fallas-masivas"
HOY = hoy_operativo().isoformat()


@pytest.fixture()
def entorno(client, admin_token, db_session):
    """Dos sectores, dos cuadrillas y especiales de las tres categorías."""
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

    alfa = crear_sector("Alfa", "TSD14A", "SECTOR D114 ALFA")
    beta = crear_sector("Beta", "TSD14B", "SECTOR D114 BETA")

    for codigo, nombre in (("TCD14A", "Cuadrilla D114 1"), ("TCD14B", "Cuadrilla D114 2")):
        r = client.post(
            "/api/v1/cuadrillas",
            json={"id_central": id_central, "codigo": codigo, "nombre": nombre},
            headers=headers,
        )
        assert r.status_code == 201, r.text

    def crear(id_averia: str, direccion: str, **extra):
        cuerpo = {
            "id_averia": id_averia,
            "direccion": direccion,
            "nombre_cliente": f"CLIENTE {id_averia}",
            "contacto_cliente": "04140000000",
            "id_pago": "7000000000",
            "tipo_reporte": "REPARACION",
            "tipo_problema": "SIN_SERVICIO",
        }
        cuerpo.update(extra)
        r = client.post("/api/v1/casos", json=cuerpo, headers=headers)
        assert r.status_code == 201, r.text
        return r.json()

    # Alfa: 2 comunes + 1 referido + 1 empresa + 1 construcción de empresa.
    for i in range(2):
        crear(f"TSTD14-A{i}", f"SECTOR D114 ALFA CASA {i}")
    crear("TSTD14-R0", "SECTOR D114 ALFA CALLE 1", categoria="REFERIDO")
    crear("TSTD14-E0", "SECTOR D114 ALFA AV 2", categoria="EMPRESA")
    crear(
        "TSTD14-C0",
        "SECTOR D114 ALFA TORRE 1",
        tipo_reporte="CONSTRUCCION",
        tipo_problema=None,
        categoria="EMPRESA",
    )
    # Alfa: gobierno de reparación y gobierno de construcción.
    crear("TSTD14-G0", "SECTOR D114 ALFA GOB 1", categoria="GOBIERNO")
    crear(
        "TSTD14-G1",
        "SECTOR D114 ALFA GOB 2",
        tipo_reporte="CONSTRUCCION",
        tipo_problema=None,
        categoria="GOBIERNO",
    )
    # Beta: los dos casos de la masiva (comunes).
    masiva_casos = [crear(f"TSTD14-M{i}", f"SECTOR D114 BETA CASA {i}") for i in range(2)]
    for caso in masiva_casos:
        fila = db_session.get(Caso, caso["id_caso"])
        fila.olt, fila.slot, fila.puerto, fila.fat = (
            "OLT-D114", "3", "7", "FAT-D114",
        )
    db_session.commit()

    id_cuadrilla_a = {
        c["codigo"]: c["id_cuadrilla"]
        for c in client.get(
            "/api/v1/cuadrillas",
            params={"id_central": id_central},
            headers=headers,
        ).json()
    }["TCD14A"]
    r = client.post(
        MASIVAS,
        json={
            "descripcion": "Masiva D114 del FAT Beta",
            "id_sector": beta,
            "id_cuadrilla": id_cuadrilla_a,
            "olt": "OLT-D114",
            "slot": "3",
            "puerto": "7",
            "fat": "FAT-D114",
            "direccion": "SECTOR D114 BETA CASA 0",
            "ids_caso": [c["id_caso"] for c in masiva_casos],
        },
        headers=headers,
    )
    assert r.status_code == 201, r.text
    falla = r.json()
    assert falla["casos_asociados"] == 2

    yield {
        "headers": headers,
        "id_central": id_central,
        "sectores": {"Alfa": alfa, "Beta": beta},
        "id_falla": falla["id_falla"],
        "crear": crear,
    }


def _proceso(client, entorno, fecha: str = HOY):
    r = client.get(f"{BASE}/proceso", params={"fecha": fecha}, headers=entorno["headers"])
    assert r.status_code == 200, r.text
    return r.json()


def _asignar(client, entorno, nombre_a_codigo: dict[str, str], fecha: str = HOY):
    p = _proceso(client, entorno, fecha)
    sectores = {s["nombre"]: s["id_sector"] for s in p["sectores"]}
    cuadrillas = {c["codigo"]: c["id_cuadrilla"] for c in p["cuadrillas"]}
    bloques: dict[int, list[int]] = {c["id_cuadrilla"]: [] for c in p["cuadrillas"]}
    for nombre, codigo in nombre_a_codigo.items():
        if nombre in sectores and codigo in cuadrillas:
            bloques[cuadrillas[codigo]].append(sectores[nombre])
    asignaciones = [{"id_cuadrilla": idc, "ids_sector": ids} for idc, ids in bloques.items()]
    r = client.put(
        f"{BASE}/asignacion",
        json={"fecha": fecha, "asignaciones": asignaciones},
        headers=entorno["headers"],
    )
    assert r.status_code == 200, r.text
    return r.json()


def _procesar(client, entorno, fecha: str = HOY, tipos=None, masivas=None):
    cuerpo: dict = {"fecha": fecha, "asignaciones": [], "reemplazar": True}
    if tipos is not None:
        cuerpo["tipos"] = tipos
    if masivas is not None:
        cuerpo["masivas"] = masivas
    r = client.post(f"{BASE}/procesar", json=cuerpo, headers=entorno["headers"])
    assert r.status_code == 201, r.text
    return r.json()


def _despachos_del_dia(db_session, fecha: str = HOY) -> dict[str, set[str]]:
    filas = db_session.execute(
        select(Despacho, Cuadrilla, Caso)
        .join(Cuadrilla, Cuadrilla.id_cuadrilla == Despacho.id_cuadrilla)
        .join(DespachoCasos, DespachoCasos.id_despacho == Despacho.id_despacho)
        .join(Caso, Caso.id_caso == DespachoCasos.id_caso)
        .where(Despacho.fecha == date.fromisoformat(fecha))
    ).all()
    salida: dict[str, set[str]] = {}
    for _despacho, cuadrilla, caso in filas:
        salida.setdefault(cuadrilla.codigo, set()).add(caso.id_averia)
    return salida


def _por_averia(proceso: dict) -> dict[str, dict]:
    return {c["id_averia"]: c for c in proceso["universo"]["casos"]}


# --------------------------------------------------------------------------- #
# 1. Resumen principal: especiales separados (punto 2 de la petición)
# --------------------------------------------------------------------------- #
def test_el_resumen_principal_separa_los_especiales(client, entorno):
    p = _proceso(client, entorno)
    universo = p["universo"]

    # 4 comunes + 5 especiales (referido, empresa, construcción y 2 gobiernos).
    assert universo["total"] == 9
    assert universo["comunes"] == 4
    assert universo["especiales"] == 5
    # Gobierno suma a su actividad: 3 reparación + 2 construcción y 2 gobierno.
    assert universo["especiales_reparacion"] == 3
    assert universo["especiales_construccion"] == 2
    assert universo["especiales_gobierno"] == 2

    assert p["resumen"]["especiales_reparacion"] == 3
    assert p["resumen"]["especiales_construccion"] == 2
    assert p["resumen"]["especiales_gobierno"] == 2


def test_cada_gobierno_cuenta_en_su_actividad_y_en_gobierno(client, entorno):
    casos = _por_averia(_proceso(client, entorno))

    assert casos["TSTD14-G0"]["tipos_distribucion"] == [
        "ESPECIALES_REPARACION",
        "ESPECIALES_GOBIERNO",
    ]
    assert casos["TSTD14-G1"]["tipos_distribucion"] == [
        "ESPECIALES_CONSTRUCCION",
        "ESPECIALES_GOBIERNO",
    ]
    # Un especial de reparación normal no es de gobierno.
    assert casos["TSTD14-R0"]["tipos_distribucion"] == ["ESPECIALES_REPARACION"]
    # La construcción de empresa no es de gobierno.
    assert casos["TSTD14-C0"]["tipos_distribucion"] == ["ESPECIALES_CONSTRUCCION"]


def test_el_cuadro_de_sectores_trae_las_tres_columnas(client, entorno):
    p = _proceso(client, entorno)
    sector = {s["nombre"]: s for s in p["sectores"]}

    assert sector["Alfa"]["total"] == 7
    assert sector["Alfa"]["especiales"] == 5
    assert sector["Alfa"]["especiales_reparacion"] == 3
    assert sector["Alfa"]["especiales_construccion"] == 2
    assert sector["Alfa"]["especiales_gobierno"] == 2

    assert sector["Beta"]["total"] == 2
    assert sector["Beta"]["especiales"] == 0
    assert sector["Beta"]["especiales_reparacion"] == 0
    assert sector["Beta"]["especiales_construccion"] == 0
    assert sector["Beta"]["especiales_gobierno"] == 0


def test_el_checklist_usa_las_categorias_del_catalogo(client, entorno):
    p = _proceso(client, entorno)
    tipos = {t["clave"]: t["total"] for t in p["tipos"]}

    assert list(tipos) == [
        "COMUNES",
        "ESPECIALES_REPARACION",
        "ESPECIALES_CONSTRUCCION",
        "MANTENIMIENTO",
        "ESPECIALES_GOBIERNO",
        "MASIVAS",
    ]
    assert tipos == {
        # Los dos casos de la masiva no son «comunes» para el checklist: van a
        # MASIVAS. El total de `universo.comunes` sí los cuenta (no son especiales).
        "COMUNES": 2,
        "ESPECIALES_REPARACION": 3,
        "ESPECIALES_CONSTRUCCION": 2,
        "MANTENIMIENTO": 0,
        "ESPECIALES_GOBIERNO": 2,
        "MASIVAS": 2,
    }
    # D-162: el formulario arranca con todo el universo marcado.
    assert [t["clave"] for t in p["tipos"] if t["por_defecto"]] == [
        "COMUNES",
        "ESPECIALES_REPARACION",
        "ESPECIALES_CONSTRUCCION",
        "MANTENIMIENTO",
        "ESPECIALES_GOBIERNO",
        "MASIVAS",
    ]


def test_los_tipos_antiguos_ya_no_se_aceptan(client, entorno):
    r = client.post(
        f"{BASE}/procesar",
        json={"fecha": HOY, "asignaciones": [], "tipos": ["REFERIDOS"]},
        headers=entorno["headers"],
    )
    assert r.status_code == 400, r.text


def test_procesar_con_especiales_gobierno_los_despacha(client, entorno, db_session):
    _asignar(client, entorno, {"Alfa": "TCD14A", "Beta": "TCD14B"})
    _procesar(
        client, entorno, HOY,
        tipos=["COMUNES", "ESPECIALES_REPARACION", "ESPECIALES_CONSTRUCCION",
               "ESPECIALES_GOBIERNO", "MASIVAS"],
    )
    grupos = _despachos_del_dia(db_session)
    averias = {averia for ids in grupos.values() for averia in ids}
    assert {"TSTD14-G0", "TSTD14-G1", "TSTD14-R0", "TSTD14-C0"} <= averias


# --------------------------------------------------------------------------- #
# 2. Masivas del sector: se incluyen o se dejan fuera (punto 3 de la petición)
# --------------------------------------------------------------------------- #
def test_el_proceso_expone_la_masiva_con_su_sector(client, entorno):
    p = _proceso(client, entorno)
    masiva = next(m for m in p["masivas"] if m["id_falla"] == entorno["id_falla"])

    assert masiva["id_sector"] == entorno["sectores"]["Beta"]
    assert masiva["sector_nombre"] == "Beta"
    assert masiva["incluida"] is True
    assert masiva["casos"] == 2


def test_la_masiva_del_sector_que_no_se_marca_queda_fuera(client, entorno, db_session):
    """D-114: `incluida=False` deja los casos de la masiva fuera del despacho."""
    _asignar(client, entorno, {"Alfa": "TCD14A", "Beta": "TCD14B"})
    id_beta = next(
        c["id_cuadrilla"] for c in _proceso(client, entorno)["cuadrillas"]
        if c["codigo"] == "TCD14B"
    )

    _procesar(
        client, entorno, HOY,
        tipos=["COMUNES", "ESPECIALES_REPARACION", "ESPECIALES_CONSTRUCCION",
               "ESPECIALES_GOBIERNO", "MASIVAS"],
        masivas=[{"id_falla": entorno["id_falla"], "id_cuadrilla": id_beta,
                  "incluida": False}],
    )

    grupos = _despachos_del_dia(db_session)
    averias = {averia for ids in grupos.values() for averia in ids}
    assert "TSTD14-A0" in averias, "el resto de la jornada se sigue despachando"
    assert not {"TSTD14-M0", "TSTD14-M1"} & averias


def test_la_masiva_incluida_se_despacha_a_su_cuadrilla(client, entorno, db_session):
    """D-114: con la masiva marcada, sus casos entran con la cuadrilla elegida."""
    _asignar(client, entorno, {"Alfa": "TCD14A", "Beta": "TCD14B"})
    p = _proceso(client, entorno)
    id_beta = next(c["id_cuadrilla"] for c in p["cuadrillas"] if c["codigo"] == "TCD14B")

    _procesar(
        client, entorno, HOY,
        tipos=["COMUNES", "ESPECIALES_REPARACION", "ESPECIALES_CONSTRUCCION",
               "ESPECIALES_GOBIERNO", "MASIVAS"],
        masivas=[{"id_falla": entorno["id_falla"], "id_cuadrilla": id_beta,
                  "incluida": True}],
    )

    grupos = _despachos_del_dia(db_session)
    assert {"TSTD14-M0", "TSTD14-M1"} <= grupos["TCD14B"]


def test_la_propuesta_informa_los_casos_excluidos_por_masiva(db_session, entorno):
    """El servicio cuenta los casos que la selección de masivas deja fuera."""
    resultado = svc.construir_propuesta(
        db_session,
        entorno["id_central"],
        date.fromisoformat(HOY),
        tipos=["COMUNES", "ESPECIALES_REPARACION", "ESPECIALES_CONSTRUCCION",
               "ESPECIALES_GOBIERNO", "MASIVAS"],
        masivas_incluidas=set(),
    )
    assert resultado.reglas["casos_excluidos_por_masiva"] == 2
    assert resultado.reglas["masivas_incluidas"] == []
    assert resultado.resumen["excluidos_por_masiva"] == 2
