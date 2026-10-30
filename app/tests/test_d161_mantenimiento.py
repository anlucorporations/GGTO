"""D-161 · El mantenimiento de las masivas es un tipo y bloque propio.

Petición del usuario (2026-10-29):
1. Los casos «JUSTIFICATIVO» generados por las fallas masivas se **reclasifican
   como MANTENIMIENTO** (ahora mismo nacen como CONSTRUCCION por omisión).
2. Los casos de mantenimiento se **agrupan por sector** y cada grupo se asigna,
   en el despacho, a la **cuadrilla de ese sector** (regla D-113; NO a una sola
   cuadrilla como la construcción de D-143).
3. El caso de mantenimiento es **independiente** de la masiva: cerrarlo no
   cierra la falla.

Estas pruebas fijan: la API acepta el nuevo tipo (PATCH), el despacho lo marca
con `tipo_asignacion = MANTENIMIENTO` repartido por sector, y el reporte de
producción lo cuenta aparte.
"""

from __future__ import annotations

import pytest
from sqlalchemy import select

from app.models import Caso, Cuadrilla, Despacho, DespachoCasos
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


def _caso(client, headers, id_averia: str, direccion: str) -> int:
    r = client.post(
        "/api/v1/casos",
        json={
            "id_averia": id_averia,
            "direccion": direccion,
            "nombre_cliente": f"JUSTIFICATIVO {id_averia}",
            "contacto_cliente": "04144445566",
            "id_pago": "7014003610",
            "tipo_reporte": "CONSTRUCCION",
            "tipo_problema": "SIN_SERVICIO",
        },
        headers=headers["admin"],
    )
    assert r.status_code == 201, r.text
    return r.json()["id_caso"]


def _reclasificar(client, headers, id_caso: int) -> None:
    r = client.patch(
        f"/api/v1/casos/{id_caso}",
        json={"tipo_caso": "MANTENIMIENTO", "categoria": "REFERIDO"},
        headers=headers["admin"],
    )
    assert r.status_code == 200, r.text


def _cuadrilla(db_session, id_central: int, codigo: str, nombre: str) -> Cuadrilla:
    cu = Cuadrilla(id_central=id_central, codigo=codigo, nombre=nombre)
    db_session.add(cu)
    db_session.flush()
    return cu


@pytest.fixture()
def entorno(client, admin_token, db_session):
    """Dos cuadrillas y tres mantenimientos (2 en el sector A, 1 en el B)."""
    id_central = admin_token["id_central"]
    id_sector_a = _sector(client, admin_token, "TSD161A", "Sector D161 A", "SECTOR D161A")
    id_sector_b = _sector(client, admin_token, "TSD161B", "Sector D161 B", "SECTOR D161B")

    ids = {
        "m1": _caso(client, admin_token, "TSTD161-M1", "SECTOR D161A FAT 1001"),
        "m2": _caso(client, admin_token, "TSTD161-M2", "SECTOR D161A FAT 1002"),
        "m3": _caso(client, admin_token, "TSTD161-M3", "SECTOR D161B FAT 1003"),
    }
    for clave in ids:
        _reclasificar(client, admin_token, ids[clave])

    # La sectorización por dirección no corre en las pruebas: se fija el sector.
    db_session.get(Caso, ids["m1"]).id_sector = id_sector_a
    db_session.get(Caso, ids["m2"]).id_sector = id_sector_a
    db_session.get(Caso, ids["m3"]).id_sector = id_sector_b
    db_session.commit()

    cu_a = _cuadrilla(db_session, id_central, "TC161A", "Cuadrilla D161 A")
    cu_b = _cuadrilla(db_session, id_central, "TC161B", "Cuadrilla D161 B")
    db_session.commit()
    return {
        "headers": admin_token["admin"],
        "id_central": id_central,
        "id_sector_a": id_sector_a,
        "id_sector_b": id_sector_b,
        "cu_a": cu_a.id_cuadrilla,
        "cu_b": cu_b.id_cuadrilla,
    }


def test_la_api_acepta_el_nuevo_tipo(client, entorno):
    """El PATCH con tipo MANTENIMIENTO no puede quedar limitado por el Literal."""
    r = client.get("/api/v1/casos", params={"q": "TSTD161-M1"}, headers=entorno["headers"])
    assert r.status_code == 200, r.text
    [caso] = r.json()["items"]
    assert caso["tipo_caso"] == "MANTENIMIENTO"
    assert caso["categoria"] == "REFERIDO"


def test_el_mantenimiento_se_reparte_por_sector_y_cuadrilla(client, entorno, db_session):
    """Cada grupo por sector va a la cuadrilla de su sector (regla D-113)."""
    hoy = hoy_operativo()
    assert client.post(
        f"{DESPACHOS}/procesar",
        json={
            "fecha": hoy.isoformat(),
            "asignaciones": [
                {"id_cuadrilla": entorno["cu_a"], "ids_sector": [entorno["id_sector_a"]]},
                {"id_cuadrilla": entorno["cu_b"], "ids_sector": [entorno["id_sector_b"]]},
            ],
            "reemplazar": True,
        },
        headers=entorno["headers"],
    ).status_code == 201

    db_session.expire_all()
    filas = db_session.execute(
        select(Despacho.id_cuadrilla, DespachoCasos.id_caso)
        .join(DespachoCasos, DespachoCasos.id_despacho == Despacho.id_despacho)
        .where(DespachoCasos.tipo_asignacion == "MANTENIMIENTO")
    ).all()
    assert len(filas) == 3, "no se despachó todo el mantenimiento"
    # sector A → cu A (2 casos) · sector B → cu B (1 caso)
    por_cu = {}
    for id_cudp, id_caso in filas:
        por_cu.setdefault(id_cudp, []).append(id_caso)
    assert len(por_cu) == 2, "el mantenimiento se concentró en una sola cuadrilla"
    assert {len(v) for v in por_cu.values()} == {1, 2}


def test_el_mantenimiento_no_cuenta_como_referido(client, entorno):
    """Su categoría sigue siendo REFERIDO, pero no entra en la métrica referidos."""
    hoy = hoy_operativo()
    assert client.put(
        f"{DESPACHOS}/asignacion",
        json={
            "fecha": hoy.isoformat(),
            "asignaciones": [
                {"id_cuadrilla": entorno["cu_a"], "ids_sector": [entorno["id_sector_a"]]},
                {"id_cuadrilla": entorno["cu_b"], "ids_sector": [entorno["id_sector_b"]]},
            ],
        },
        headers=entorno["headers"],
    ).status_code == 200
    r = client.post(f"{DESPACHOS}/propuesta", headers=entorno["headers"])
    assert r.status_code == 200, r.text
    reglas = r.json()["reglas"]
    assert reglas["referidos_disponibles"] == 0, reglas
    assert reglas["mantenimientos_asignados"] == 3, reglas


def test_el_reporte_del_dia_cuenta_el_mantenimiento_aparte(client, entorno, db_session):
    hoy = hoy_operativo()
    assert client.post(
        f"{DESPACHOS}/procesar",
        json={
            "fecha": hoy.isoformat(),
            "asignaciones": [
                {"id_cuadrilla": entorno["cu_a"], "ids_sector": [entorno["id_sector_a"]]},
                {"id_cuadrilla": entorno["cu_b"], "ids_sector": [entorno["id_sector_b"]]},
            ],
            "reemplazar": True,
        },
        headers=entorno["headers"],
    ).status_code == 201

    # Se cierra UN mantenimiento para medir «realizados».
    db_session.expire_all()
    id_caso = db_session.scalar(
        select(DespachoCasos.id_caso).where(
            DespachoCasos.tipo_asignacion == "MANTENIMIENTO"
        ).limit(1)
    )
    caso = db_session.get(Caso, id_caso)
    caso.estado_actual = "CERRADO"
    db_session.commit()

    r = client.get(f"{DESPACHOS}/reporte/produccion", headers=entorno["headers"])
    assert r.status_code == 200, r.text
    totales = r.json()["totales"]
    assert totales["mantenimientos"] == 3
    assert totales["mantenimientos_cerradas"] == 1
