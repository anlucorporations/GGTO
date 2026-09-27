"""Pruebas de integración del Ciclo 7: monitoreo y reportes (ver `RepoTecnico/metricas.md`)."""

from __future__ import annotations

from datetime import date, datetime

import pytest

BASE = "/api/v1/monitoreo"
REPORTES = "/api/v1/reportes/trabajo"
HOY = date.today().isoformat()


@pytest.fixture()
def entorno(client, admin_token):
    headers = admin_token["admin"]
    id_central = admin_token["id_central"]

    client.post("/api/v1/sectores",
                json={"id_central": id_central, "nombre": "Alfa", "codigo": "TSA",
                      "direcciones": [{"patron": "SECTOR ALFA"}]}, headers=headers)
    for codigo in ("TCM1", "TCM2"):
        client.post("/api/v1/cuadrillas",
                    json={"id_central": id_central, "codigo": codigo, "nombre": f"Cuadrilla {codigo}"},
                    headers=headers)

    def crear(id_averia, **extra):
        cuerpo = {"id_averia": id_averia, "direccion": "SECTOR ALFA CASA 1",
                  "nombre_cliente": "CLIENTE", "telefono": "7000000000"}
        cuerpo.update(extra)
        r = client.post("/api/v1/casos", json=cuerpo, headers=headers)
        assert r.status_code == 201, r.text
        return r.json()

    casos = [crear(f"TSTM-{i}") for i in range(3)]
    casos.append(crear("TSTM-E", categoria="EMPRESA"))
    casos.append(crear("TSTM-C", categoria="EMPRESA", tipo_caso="CONSTRUCCION"))

    # Cerrar uno residencial para que cuente como resuelto del día
    cerrado = client.patch(f"/api/v1/casos/{casos[0]['id_caso']}",
                           json={"estado_actual": "CERRADO", "motivo_estado": "resuelto"},
                           headers=headers)
    assert cerrado.status_code == 200

    yield {"headers": headers, "id_central": id_central, "casos": casos,
           "id_caso_cerrado": casos[0]["id_caso"]}


# --------------------------------------------------------------------------- #
# Gestión diaria
# --------------------------------------------------------------------------- #
def test_gestion_diaria(client, entorno):
    r = client.get(f"{BASE}/diario", params={"fecha": HOY}, headers=entorno["headers"])
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["ingresos_nuevos"] == 5
    assert d["resueltos_residencial"] == 1
    assert d["resueltos_empresarial"] == 0
    # El cierre deja 4 pendientes (3 residenciales - 1 cerrado + empresa + construcción)
    assert d["pendientes_total"] == 4


def test_gestion_diaria_sin_datos(client, entorno):
    d = client.get(f"{BASE}/diario", params={"fecha": "2020-01-01"},
                   headers=entorno["headers"]).json()
    assert d["ingresos_nuevos"] == 0
    assert d["resueltos_residencial"] == 0


# --------------------------------------------------------------------------- #
# Globales, reparación y construcción
# --------------------------------------------------------------------------- #
def test_globales(client, entorno):
    g = client.get(f"{BASE}/globales", params={"desde": HOY, "hasta": HOY},
                   headers=entorno["headers"]).json()
    assert g["pendientes"] == 4
    assert g["resueltos"] == 1
    assert g["total"] == 5
    assert g["por_estado"].get("CERRADO") == 1
    assert g["por_categoria"].get("RESIDENCIAL") == 3


def test_reparacion_y_construccion(client, entorno):
    rep = client.get(f"{BASE}/reparacion", headers=entorno["headers"]).json()
    assert rep["residenciales_comunes"] == 2       # 3 residenciales - 1 cerrado
    assert rep["empresariales"] == 1
    assert rep["residenciales_referidos"] == 0
    assert rep["total"] == 3

    con = client.get(f"{BASE}/construccion", headers=entorno["headers"]).json()
    assert con["total"] == 1
    assert con["empresariales"] == 1
    assert con["residenciales"] == 0


def test_capacidad_operativa(client, entorno):
    cap = client.get(f"{BASE}/capacidad", headers=entorno["headers"]).json()
    assert cap["cuadrillas_activas"] == 2
    assert len(cap["cuadrillas"]) == 3  # incluye la cuadrilla 0 del supervisor
    assert cap["sectores_activos"] == 1
    # Sin integrantes ni flota, las cuadrillas quedan marcadas como incompletas
    de_calle = [c for c in cap["cuadrillas"] if not c["es_supervisor"]]
    assert all(c["completa"] is False for c in de_calle)


# --------------------------------------------------------------------------- #
# Semanal y por cuadrilla
# --------------------------------------------------------------------------- #
def test_gestion_semanal_devuelve_seis_dias(client, entorno):
    s = client.get(f"{BASE}/semanal", params={"desde": HOY}, headers=entorno["headers"]).json()
    assert len(s["dias"]) == 6
    assert s["desde"] <= s["hasta"]
    for dia in s["dias"]:
        assert set(dia) == {"fecha", "asignados", "cerrados", "gestionados"}


def test_monitoreo_por_cuadrilla(client, entorno):
    # La semana operativa es lunes-sábado: usamos el lunes de esta semana
    from app.services.monitoreo import rango_semana

    lunes = rango_semana(date.today())[0].isoformat()
    prop = client.post("/api/v1/despachos/propuesta", params={"fecha": lunes},
                       headers=entorno["headers"])
    assert prop.status_code == 200
    generado = client.post("/api/v1/despachos", params={"fecha": lunes}, headers=entorno["headers"])
    assert generado.status_code == 201, generado.text
    id_despacho = generado.json()[0]["id_despacho"]

    detalle = client.get(f"/api/v1/despachos/{id_despacho}", headers=entorno["headers"]).json()
    id_caso = detalle["casos"][0]["id_caso"]
    assert client.patch(f"/api/v1/despachos/{id_despacho}/casos/{id_caso}",
                        json={"estado": "GESTIONADO"},
                        headers=entorno["headers"]).status_code == 200

    c = client.get(f"{BASE}/cuadrilla", params={"desde": lunes}, headers=entorno["headers"]).json()
    assert len(c["cuadrillas"]) == 2
    total_asignados = sum(cu["totales"]["asignados"] for cu in c["cuadrillas"])
    total_gestionados = sum(cu["totales"]["gestionados"] for cu in c["cuadrillas"])
    assert total_asignados == 4      # los 4 pendientes entran al despacho
    assert total_gestionados == 1
    assert len(c["cuadrillas"][0]["dias"]) == 6


def test_semanal_refleja_los_cierres(client, entorno):
    """La semana es lunes-sábado; si hoy es domingo, el cierre queda fuera de la ventana."""
    s = client.get(f"{BASE}/semanal", params={"desde": HOY}, headers=entorno["headers"]).json()
    total_cerrados = sum(d["cerrados"] for d in s["dias"])
    esperado = 1 if date.today().weekday() < 6 else 0
    assert total_cerrados == esperado


# --------------------------------------------------------------------------- #
# Reportes
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize("periodo", ["diario", "semanal", "mensual"])
def test_reporte_trabajo(client, entorno, periodo):
    r = client.get(REPORTES, params={"periodo": periodo, "fecha": HOY},
                   headers=entorno["headers"])
    assert r.status_code == 200, r.text
    datos = r.json()
    assert datos["periodo"] == periodo
    for clave in ("diario", "semanal", "globales", "reparacion", "construccion",
                  "cuadrilla", "capacidad"):
        assert clave in datos
    if periodo == "mensual":
        assert datos["desde"].endswith("-01")
    if periodo == "semanal":
        assert len(datos["semanal"]["dias"]) == 6


def test_reporte_imprimible(client, entorno):
    r = client.get(f"{REPORTES}/imprimible", params={"periodo": "diario", "fecha": HOY},
                   headers=entorno["headers"])
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/html")
    assert "size: letter" in r.text
    assert "Reporte de trabajo" in r.text
    assert "Gestión semanal" in r.text


def test_periodo_invalido(client, entorno):
    assert client.get(REPORTES, params={"periodo": "anual"},
                      headers=entorno["headers"]).status_code == 422


# --------------------------------------------------------------------------- #
# Acceso
# --------------------------------------------------------------------------- #
def test_sin_token(client):
    assert client.get(f"{BASE}/diario").status_code == 401


def test_tecnico_puede_consultar(client, entorno, admin_token):
    for ruta in ("/diario", "/semanal", "/globales", "/reparacion", "/construccion",
                 "/cuadrilla", "/capacidad"):
        assert client.get(f"{BASE}{ruta}", headers=admin_token["tecnico"]).status_code == 200, ruta
    assert client.get(REPORTES, headers=admin_token["tecnico"]).status_code == 200


def test_cita_cuenta_en_el_dia(client, entorno):
    hoy = datetime.now().replace(microsecond=0)
    r = client.post("/api/v1/citas",
                    json={"fecha_hora": hoy.isoformat(), "id_caso": entorno["id_caso_cerrado"]},
                    headers=entorno["headers"])
    assert r.status_code == 201, r.text
    d = client.get(f"{BASE}/diario", params={"fecha": HOY}, headers=entorno["headers"]).json()
    assert d["citados"] == 1
