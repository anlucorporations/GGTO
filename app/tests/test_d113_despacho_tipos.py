"""Pruebas del incremento D-113: tipos a distribuir, pendientes y masivas.

Cubren los tres puntos de la petición sobre el **procesamiento del despacho**:

1. que el universo del proceso incluya los **casos PENDIENTES** que devolvió el
   cierre de jornada (hasta hoy quedaban fuera porque seguían vinculados a un
   despacho ya CERRADO);
2. que la **cuadrilla de una falla masiva** se pueda cambiar desde el formulario
   de proceso y que sus casos se despachen a esa cuadrilla;
3. que el **checklist de tipos** (Comunes, Especiales Reparación, Especiales
   Construcción, Especiales Gobierno y Masivas) limite lo que se distribuye, con
   **Comunes y Especiales Reparación** por defecto.

Los identificadores de prueba empiezan por `TST`/`TCD`/`TSD` para que el aseo de
`conftest` los barra entre pruebas.
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest
from sqlalchemy import select

from app.models import Caso, Cuadrilla, Despacho, DespachoCasos, FallaMasiva
from app.services.tiempo import hoy_operativo

BASE = "/api/v1/despachos"
MASIVAS = "/api/v1/fallas-masivas"
HOY = hoy_operativo().isoformat()
AYER = (hoy_operativo() - timedelta(days=1)).isoformat()


@pytest.fixture()
def entorno(client, admin_token, db_session):
    """Tres sectores, dos cuadrillas y los cinco tipos de caso del checklist."""
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

    alfa = crear_sector("Alfa", "TSD13A", "SECTOR D113 ALFA")
    beta = crear_sector("Beta", "TSD13B", "SECTOR D113 BETA")
    gamma = crear_sector("Gamma", "TSD13C", "SECTOR D113 GAMMA")

    for codigo, nombre in (("TCD13A", "Cuadrilla D113 1"), ("TCD13B", "Cuadrilla D113 2")):
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

    # Comunes (Alfa)
    for i in range(3):
        crear(f"TSTD13-A{i}", f"SECTOR D113 ALFA CASA {i}")
    # Referidos (Beta)
    crear("TSTD13-R0", "SECTOR D113 BETA CALLE 1", categoria="REFERIDO")
    crear("TSTD13-R1", "SECTOR D113 BETA CALLE 2", categoria="REFERIDO")
    # Empresa y construcción (Alfa)
    crear("TSTD13-E0", "SECTOR D113 ALFA AV 3", categoria="EMPRESA")
    crear(
        "TSTD13-C0",
        "SECTOR D113 ALFA TORRE 1",
        tipo_reporte="CONSTRUCCION",
        tipo_problema=None,
        categoria="EMPRESA",
    )
    # Comunes de la masiva (Gamma)
    masiva_casos = [crear(f"TSTD13-M{i}", f"SECTOR D113 GAMMA CASA {i}") for i in range(2)]
    for caso in masiva_casos:
        fila = db_session.get(Caso, caso["id_caso"])
        fila.olt, fila.slot, fila.puerto, fila.fat = (
            "OLT-D113", "3", "7", "FAT-D113",
        )
    db_session.commit()

    id_cuadrilla_a = {
        c["codigo"]: c["id_cuadrilla"]
        for c in client.get(
            "/api/v1/cuadrillas",
            params={"id_central": id_central},
            headers=headers,
        ).json()
    }["TCD13A"]
    # La masiva del FAT Gamma nace asignada a la cuadrilla A.
    r = client.post(
        MASIVAS,
        json={
            "descripcion": "Masiva D113 del FAT Gamma",
            "id_sector": gamma,
            "id_cuadrilla": id_cuadrilla_a,
            "olt": "OLT-D113",
            "slot": "3",
            "puerto": "7",
            "fat": "FAT-D113",
            "direccion": "SECTOR D113 GAMMA CASA 0",
            "ids_caso": [c["id_caso"] for c in masiva_casos],
        },
        headers=headers,
    )
    assert r.status_code == 201, r.text
    falla = r.json()
    assert falla["casos_asociados"] == 2, "la masiva debe asociar los 2 casos del FAT"

    yield {
        "headers": headers,
        "id_central": id_central,
        "sectores": {"Alfa": alfa, "Beta": beta, "Gamma": gamma},
        "id_falla": falla["id_falla"],
        "crear": crear,
        # D-160: el corte manual lo ejecuta el Super Usuario (el ADMIN ya no).
        "super": admin_token["super"],
    }


def _proceso(client, entorno, fecha: str = HOY):
    r = client.get(f"{BASE}/proceso", params={"fecha": fecha}, headers=entorno["headers"])
    assert r.status_code == 200, r.text
    return r.json()


def _asignar(client, entorno, nombre_a_codigo: dict[str, str], fecha: str = HOY):
    """Asigna cada sector (por nombre) a la cuadrilla indicada por código."""
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
    """`codigo_cuadrilla -> {id_averia}` de los despachos de la fecha."""
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


# --------------------------------------------------------------------------- #
# 1. Casos pendientes del cierre de jornada (punto 1 de la petición)
# --------------------------------------------------------------------------- #
def test_el_proceso_incluye_los_pendientes_del_cierre(client, entorno, db_session):
    """D-113: los casos que devuelve el cierre (PENDIENTE) vuelven al universo.

    Se procesa **ayer** para que el corte de jornada deje los casos en PENDIENTE
    dentro de un despacho CERRADO; el formulario de **hoy** debe listarlos y el
    procesamiento debe volver a despacharlos.
    """
    _asignar(client, entorno, {"Alfa": "TCD13A", "Beta": "TCD13B", "Gamma": "TCD13A"}, AYER)
    _procesar(client, entorno, AYER, tipos=["COMUNES", "ESPECIALES_REPARACION",
                                           "ESPECIALES_CONSTRUCCION",
                                           "ESPECIALES_GOBIERNO", "MASIVAS"])

    # D-160: el corte lo ejecuta el Super Usuario (el ADMIN ya no pasa).
    r = client.post(f"{BASE}/cierre-jornada", params={"solo_vencidos": "true"},
                    headers=entorno["super"])
    assert r.status_code == 200, r.text
    assert r.json()["casos_pendientes"] == 9

    db_session.expire_all()
    for id_averia in ("TSTD13-A0", "TSTD13-R0", "TSTD13-M0"):
        caso = db_session.scalar(select(Caso).where(Caso.id_averia == id_averia))
        assert caso is not None and caso.estado_actual == "PENDIENTE"

    # El formulario de hoy ve los 9 casos pendientes (antes: 0, porque seguían
    # en el despacho CERRADO de ayer).
    proceso = _proceso(client, entorno, HOY)
    assert proceso["universo"]["total"] == 9
    por_averia = {c["id_averia"]: c for c in proceso["universo"]["casos"]}
    assert por_averia["TSTD13-A0"]["estado_actual"] == "PENDIENTE"

    # Y el procesamiento de hoy los vuelve a despachar.
    _procesar(client, entorno, HOY,
              tipos=["COMUNES", "ESPECIALES_REPARACION", "ESPECIALES_CONSTRUCCION",
                     "ESPECIALES_GOBIERNO", "MASIVAS"])
    grupos = _despachos_del_dia(db_session, HOY)
    asignados = {averia for averias in grupos.values() for averia in averias}
    assert len(asignados) == 9, asignados
    assert {"TSTD13-A0", "TSTD13-R0", "TSTD13-M0"} <= asignados


# --------------------------------------------------------------------------- #
# 2. Checklist de tipos (punto 3 de la petición)
# --------------------------------------------------------------------------- #
def test_el_proceso_expone_el_checklist_con_el_nuevo_catalogo(client, entorno):
    """D-161: seis tipos y Comunes/Especiales Rep/Mantenimiento por defecto."""
    p = _proceso(client, entorno)
    tipos = {t["clave"]: t for t in p["tipos"]}

    assert list(tipos) == [
        "COMUNES",
        "ESPECIALES_REPARACION",
        "ESPECIALES_CONSTRUCCION",
        "MANTENIMIENTO",
        "ESPECIALES_GOBIERNO",
        "MASIVAS",
    ]
    assert tipos["COMUNES"]["total"] == 3
    assert tipos["ESPECIALES_REPARACION"]["total"] == 3  # 2 referidos + 1 empresa
    assert tipos["ESPECIALES_CONSTRUCCION"]["total"] == 1
    assert tipos["MANTENIMIENTO"]["total"] == 0
    assert tipos["ESPECIALES_GOBIERNO"]["total"] == 0
    assert tipos["MASIVAS"]["total"] == 2
    assert [t["clave"] for t in p["tipos"] if t["por_defecto"]] == [
        "COMUNES",
        "ESPECIALES_REPARACION",
        "MANTENIMIENTO",
    ]

    assert p["universo"]["por_tipo"] == {
        "COMUNES": 3,
        "ESPECIALES_REPARACION": 3,
        "ESPECIALES_CONSTRUCCION": 1,
        "MANTENIMIENTO": 0,
        "ESPECIALES_GOBIERNO": 0,
        "MASIVAS": 2,
    }
    # Cada caso del universo informa sus tipos de distribución.
    assert {
        tipo
        for c in p["universo"]["casos"]
        for tipo in c["tipos_distribucion"]
    } == {
        "COMUNES",
        "ESPECIALES_REPARACION",
        "ESPECIALES_CONSTRUCCION",
        "MASIVAS",
    }


def test_procesar_solo_distribuye_los_tipos_marcados(client, entorno, db_session):
    """D-113 · D-114: con Comunes y Especiales Reparación solo se despachan esos casos."""
    _asignar(client, entorno, {"Alfa": "TCD13A", "Beta": "TCD13B", "Gamma": "TCD13A"})
    crear = entorno["crear"]
    crear("TSTD13-Z0", "SECTOR D113 ALFA CASA 9")  # un común más

    _procesar(client, entorno, HOY, tipos=["COMUNES", "ESPECIALES_REPARACION"])

    filas = db_session.execute(
        select(DespachoCasos, Caso).join(Caso, Caso.id_caso == DespachoCasos.id_caso)
    ).all()
    tipos = {dc.tipo_asignacion for dc, _caso in filas}
    averias = {caso.id_averia for _dc, caso in filas}

    # 4 comunes + 2 referidos + 1 empresa; la construcción y las masivas quedan fuera.
    assert tipos == {"REPARACION", "REFERIDO", "EMPRESA"}
    assert len(averias) == 7
    assert {"TSTD13-E0"} <= averias
    assert not {"TSTD13-C0", "TSTD13-M0", "TSTD13-M1"} & averias


def test_procesar_sin_tipos_mantiene_el_comportamiento_anterior(client, entorno,
                                                               db_session):
    """La API sin `tipos` sigue distribuyendo todos los tipos (compatibilidad)."""
    _asignar(client, entorno, {"Alfa": "TCD13A", "Beta": "TCD13B", "Gamma": "TCD13A"})
    _procesar(client, entorno, HOY)

    grupos = _despachos_del_dia(db_session, HOY)
    averias = {averia for averias in grupos.values() for averia in averias}
    assert len(averias) == 9
    assert {"TSTD13-E0", "TSTD13-C0", "TSTD13-M0"} <= averias


def test_el_proceso_no_reofrece_los_casos_de_un_despacho_publicado(client, entorno,
                                                                  db_session):
    """D-113: lo que ya está en un despacho PUBLICADO no vuelve al universo.

    El borrador del día sí se reofrece (se reemplaza al reprocesar), pero una
    jornada ya publicada no se reprocesa: sus casos no aparecen como disponibles.
    """
    _asignar(client, entorno, {"Alfa": "TCD13A", "Beta": "TCD13B", "Gamma": "TCD13A"})
    creados = _procesar(client, entorno, HOY, tipos=["COMUNES", "ESPECIALES_REPARACION"])
    id_cuadrilla_a = _codigo_a_id(_proceso(client, entorno), "TCD13A")
    despacho_a = next(d for d in creados if d["id_cuadrilla"] == id_cuadrilla_a)
    assert client.patch(
        f"{BASE}/{despacho_a['id_despacho']}", json={"estado": "PUBLICADO"},
        headers=entorno["headers"],
    ).status_code == 200

    p = _proceso(client, entorno, HOY)
    averias = {c["id_averia"] for c in p["universo"]["casos"]}
    assert "TSTD13-A0" not in averias, "los casos publicados no se reofrecen"
    assert "TSTD13-R0" in averias, "el borrador del día sí se reofrece"
    assert p["reproceso"] is True


def test_los_tipos_invalidos_o_vacios_son_400(client, entorno):
    """D-113: nunca se procesa una jornada con una selección inválida."""
    for tipos in ([], [""], ["REPARACIONES"]):
        r = client.post(
            f"{BASE}/procesar",
            json={"fecha": HOY, "asignaciones": [], "tipos": tipos},
            headers=entorno["headers"],
        )
        assert r.status_code == 400, (tipos, r.text)


# --------------------------------------------------------------------------- #
# 3. Cambio de la asignación de masivas (punto 2 de la petición)
# --------------------------------------------------------------------------- #
def test_la_masiva_reasignada_arrastra_sus_casos_a_la_nueva_cuadrilla(
    client, entorno, db_session
):
    """D-113: la cuadrilla elegida en el proceso manda sobre el sector del caso."""
    # El sector de Gamma va a la cuadrilla B; la masiva está en la A.
    _asignar(client, entorno, {"Alfa": "TCD13A", "Beta": "TCD13B", "Gamma": "TCD13B"})
    id_falla = entorno["id_falla"]
    id_cuadrilla_b = _codigo_a_id(_proceso(client, entorno), "TCD13B")

    _procesar(
        client, entorno, HOY,
        tipos=["COMUNES", "ESPECIALES_REPARACION", "ESPECIALES_CONSTRUCCION",
               "ESPECIALES_GOBIERNO", "MASIVAS"],
        masivas=[{"id_falla": id_falla, "id_cuadrilla": id_cuadrilla_b}],
    )

    db_session.expire_all()
    falla = db_session.get(FallaMasiva, id_falla)
    assert falla is not None and falla.id_cuadrilla == id_cuadrilla_b

    grupos = _despachos_del_dia(db_session, HOY)
    assert {"TSTD13-M0", "TSTD13-M1"} <= grupos["TCD13B"]
    # Ya no se quedan en la cuadrilla que les tocaba por la masiva anterior.
    assert not {"TSTD13-M0", "TSTD13-M1"} & grupos.get("TCD13A", set())


def test_el_proceso_expone_los_casos_de_cada_masiva(client, entorno):
    """El formulario necesita los casos y la cuadrilla para poder reasignarla."""
    p = _proceso(client, entorno)
    masiva = next(m for m in p["masivas"] if m["id_falla"] == entorno["id_falla"])
    assert masiva["casos"] == 2
    assert len(masiva["ids_caso"]) == 2
    assert masiva["cuadrilla_codigo"] == "TCD13A"


def test_la_masiva_no_se_asigna_a_la_cuadrilla_0(client, entorno):
    """La cuadrilla del supervisor no atiende fallas masivas."""
    p = _proceso(client, entorno)
    id_supervisor = _codigo_a_id(p, "C-00")
    r = client.post(
        f"{BASE}/procesar",
        json={
            "fecha": HOY,
            "asignaciones": [],
            "masivas": [{"id_falla": entorno["id_falla"], "id_cuadrilla": id_supervisor}],
        },
        headers=entorno["headers"],
    )
    assert r.status_code == 400, r.text


# --------------------------------------------------------------------------- #
# Utilidades
# --------------------------------------------------------------------------- #
def _codigo_a_id(proceso: dict, codigo: str) -> int:
    return next(c["id_cuadrilla"] for c in proceso["cuadrillas"] if c["codigo"] == codigo)
