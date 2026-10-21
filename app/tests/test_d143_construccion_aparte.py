"""D-143 · La construcción se procesa aparte y se mide aparte (H-25 bis).

Petición del usuario:
1. Al procesar el despacho, los casos de **construcción** se tratan aparte: el
   formulario muestra un cuadro con los **sectores y sus cantidades** y la
   construcción completa se asigna a **una** cuadrilla.
2. En la métrica del despacho del día se **separa la construcción** para medir
   cuántas se realizaron, y ese dato queda para el **seguimiento global**.

Estas pruebas fijan las tres piezas del backend: la cuadrilla elegida manda, el
reporte separa construcción asignada/cerrada y el seguimiento devuelve la serie
diaria con totales.
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest
from sqlalchemy import select

from app.models import Caso, Cuadrilla, Despacho, DespachoCasos, Sector
from app.services.tiempo import hoy_operativo

DESPACHOS = "/api/v1/despachos"
SECTORES = "/api/v1/sectores"


def _sector(client, headers, codigo: str, nombre: str, patron: str) -> int:
    r = client.post(
        SECTORES,
        json={
            "id_central": headers["id_central"],
            "codigo": codigo,
            "nombre": nombre,
            "patron_direccion": patron,
        },
        headers=headers["admin"],
    )
    assert r.status_code in (201, 409), r.text
    if r.status_code == 201:
        return r.json()["id_sector"]
    raise AssertionError("sector duplicado en la prueba")


def _caso(client, headers, id_averia: str, pago: str, direccion: str,
          tipo_reporte: str = "REPARACION") -> int:
    r = client.post(
        "/api/v1/casos",
        json={
            "id_averia": id_averia,
            "direccion": direccion,
            "nombre_cliente": f"CLIENTE {id_averia}",
            "contacto_cliente": "04144445566",
            "id_pago": pago,
            "tipo_reporte": tipo_reporte,
            "tipo_problema": "SIN_SERVICIO",
        },
        headers=headers["admin"],
    )
    assert r.status_code == 201, r.text
    return r.json()["id_caso"]


def _cuadrilla(db_session, id_central: int, codigo: str, nombre: str) -> Cuadrilla:
    cu = Cuadrilla(id_central=id_central, codigo=codigo, nombre=nombre)
    db_session.add(cu)
    db_session.flush()
    return cu


@pytest.fixture()
def entorno(client, admin_token, db_session):
    """Dos cuadrillas y tres construcciones en dos sectores."""
    id_central = admin_token["id_central"]
    id_sector_a = _sector(client, admin_token, "TSD143A", "Sector D143 A", "SECTOR D143A")
    id_sector_b = _sector(client, admin_token, "TSD143B", "Sector D143 B", "SECTOR D143B")

    ids = {
        "c1": _caso(client, admin_token, "TSTD143-C1", "7014003601", "SECTOR D143A CASA 1", "CONSTRUCCION"),
        "c2": _caso(client, admin_token, "TSTD143-C2", "7014003602", "SECTOR D143A CASA 2", "CONSTRUCCION"),
        "c3": _caso(client, admin_token, "TSTD143-C3", "7014003603", "SECTOR D143B CASA 1", "CONSTRUCCION"),
        "r1": _caso(client, admin_token, "TSTD143-R1", "7014003604", "SECTOR D143A CASA 3"),
    }
    # La sectorización por dirección no corre en las pruebas: se fija el sector.
    for clave in ("c1", "c2", "r1"):
        db_session.get(Caso, ids[clave]).id_sector = id_sector_a
    db_session.get(Caso, ids["c3"]).id_sector = id_sector_b
    db_session.commit()

    cu_a = _cuadrilla(db_session, id_central, "TC143A", "Cuadrilla D143 A")
    cu_b = _cuadrilla(db_session, id_central, "TC143B", "Cuadrilla D143 B")
    db_session.commit()
    return {
        "headers": admin_token["admin"],
        "id_central": id_central,
        "id_sector_a": id_sector_a,
        "id_sector_b": id_sector_b,
        "cu_a": cu_a.id_cuadrilla,
        "cu_b": cu_b.id_cuadrilla,
    }


def test_el_proceso_trae_el_bloque_de_construccion_con_sus_sectores(client, entorno):
    r = client.get(f"{DESPACHOS}/proceso", headers=entorno["headers"])
    assert r.status_code == 200, r.text
    bloque = r.json()["construccion"]
    assert bloque["total"] == 3, bloque
    cantidades = {s["id_sector"]: s["cantidad"] for s in bloque["por_sector"]}
    assert cantidades[entorno["id_sector_a"]] == 2
    assert cantidades[entorno["id_sector_b"]] == 1


def test_toda_la_construccion_va_a_la_cuadrilla_elegida(client, entorno, db_session):
    """Aunque los sectores se asignen a cuadrillas distintas, la construcción va a una."""
    r = client.post(
        f"{DESPACHOS}/procesar",
        json={
            "fecha": hoy_operativo().isoformat(),
            "asignaciones": [
                {"id_cuadrilla": entorno["cu_a"], "ids_sector": [entorno["id_sector_a"]]},
                {"id_cuadrilla": entorno["cu_b"], "ids_sector": [entorno["id_sector_b"]]},
            ],
            "tipos": ["COMUNES", "ESPECIALES_CONSTRUCCION"],
            "construccion_cuadrilla": entorno["cu_b"],
            "reemplazar": True,
        },
        headers=entorno["headers"],
    )
    assert r.status_code == 201, r.text

    db_session.expire_all()
    filas = db_session.execute(
        select(Despacho.id_cuadrilla, DespachoCasos.tipo_asignacion)
        .join(DespachoCasos, DespachoCasos.id_despacho == Despacho.id_despacho)
        .where(DespachoCasos.tipo_asignacion == "CONSTRUCCION")
    ).all()
    assert filas, "no se despachó ninguna construcción"
    assert {f[0] for f in filas} == {entorno["cu_b"]}, "la construcción se repartió"


def test_el_reporte_del_dia_separa_la_construccion(client, entorno, db_session):
    hoy = hoy_operativo()
    assert client.post(
        f"{DESPACHOS}/procesar",
        json={
            "fecha": hoy.isoformat(),
            "asignaciones": [
                {"id_cuadrilla": entorno["cu_a"], "ids_sector": [entorno["id_sector_a"]]},
                {"id_cuadrilla": entorno["cu_b"], "ids_sector": [entorno["id_sector_b"]]},
            ],
            "tipos": ["COMUNES", "ESPECIALES_CONSTRUCCION"],
            "construccion_cuadrilla": entorno["cu_b"],
            "reemplazar": True,
        },
        headers=entorno["headers"],
    ).status_code == 201

    # Se cierra UNA construcción para medir «realizadas».
    db_session.expire_all()
    id_caso = db_session.scalar(
        select(DespachoCasos.id_caso).where(
            DespachoCasos.tipo_asignacion == "CONSTRUCCION"
        ).limit(1)
    )
    caso = db_session.get(Caso, id_caso)
    caso.estado_actual = "CERRADO"
    db_session.commit()

    r = client.get(f"{DESPACHOS}/reporte/produccion", headers=entorno["headers"])
    assert r.status_code == 200, r.text
    totales = r.json()["totales"]
    assert totales["construcciones"] == 3
    assert totales["construcciones_cerradas"] == 1


def test_el_seguimiento_global_devuelve_la_serie_diaria(client, entorno, db_session):
    hoy = hoy_operativo()
    assert client.post(
        f"{DESPACHOS}/procesar",
        json={
            "fecha": hoy.isoformat(),
            "asignaciones": [
                {"id_cuadrilla": entorno["cu_a"], "ids_sector": [entorno["id_sector_a"]]},
                {"id_cuadrilla": entorno["cu_b"], "ids_sector": [entorno["id_sector_b"]]},
            ],
            "tipos": ["COMUNES", "ESPECIALES_CONSTRUCCION"],
            "construccion_cuadrilla": entorno["cu_b"],
            "reemplazar": True,
        },
        headers=entorno["headers"],
    ).status_code == 201

    r = client.get(
        f"{DESPACHOS}/construcciones/seguimiento",
        params={"desde": (hoy - timedelta(days=2)).isoformat(), "hasta": hoy.isoformat()},
        headers=entorno["headers"],
    )
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert cuerpo["totales"]["asignadas"] == 3
    assert cuerpo["totales"]["cerradas"] == 0
    assert cuerpo["por_dia"][-1]["fecha"] == hoy.isoformat()
    assert cuerpo["por_dia"][-1]["asignadas"] == 3
    # La tabla por sector suma lo mismo.
    assert sum(s["asignadas"] for s in cuerpo["por_sector"]) == 3


def test_el_seguimiento_valida_el_periodo(client, admin_token):
    hoy = hoy_operativo()
    r = client.get(
        f"{DESPACHOS}/construcciones/seguimiento",
        params={
            "desde": hoy.isoformat(),
            "hasta": (hoy - timedelta(days=5)).isoformat(),
        },
        headers=admin_token["admin"],
    )
    assert r.status_code == 422, r.text
