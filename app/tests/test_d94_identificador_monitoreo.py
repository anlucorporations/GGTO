"""Pruebas del ciclo D-94 — día operativo y métricas por identificador de pago.

Unitarias e integración (`GGTO_TEST_DB_URL`):

- el **día operativo** es el de `America/Caracas` (RNF-13), también para el «hoy»
  por defecto de MONITOREO y REPORTES;
- `identificadores()` cuenta reportes, reincidentes y el reparto de casos con y
  sin 70* (RF-54/RF-55);
- el endpoint es de ADMIN/SUPERVISOR (el TÉCNICO recibe 403);
- el **informe imprimible** incluye el lado del identificador y el día operativo.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from app.models import Caso, IdentificadorPago
from app.services import monitoreo

MONITOREO = "/api/v1/monitoreo"
REPORTE = "/api/v1/reportes/trabajo/imprimible"


# --------------------------------------------------------------------------- #
# Apoyo
# --------------------------------------------------------------------------- #
def _identificador(db, numero: str, id_central: int) -> IdentificadorPago:
    fila = IdentificadorPago(
        numero=numero, id_central=id_central, nombre_titular="CLIENTE D94"
    )
    db.add(fila)
    db.flush()
    return fila


def _caso(db, id_central: int, id_averia: str, id_pago: int | None = None,
          creado_en: datetime | None = None) -> Caso:
    fila = Caso(
        id_central=id_central,
        id_averia=id_averia,
        tipo_caso="AVERIA",
        origen="MANUAL",
        categoria="RESIDENCIAL",
        estado_actual="NUEVO",
        nombre_cliente="CLIENTE D94",
        id_pago=id_pago,
    )
    if creado_en is not None:
        fila.creado_en = creado_en
    db.add(fila)
    db.commit()
    return fila


# --------------------------------------------------------------------------- #
# Día operativo
# --------------------------------------------------------------------------- #
def test_hoy_operativo_es_el_de_caracas():
    esperado = datetime.now(UTC).astimezone(ZoneInfo("America/Caracas")).date()
    assert monitoreo.ZONA_OPERATIVA == "America/Caracas"
    assert monitoreo.hoy_operativo() == esperado


def test_el_dia_operativo_incluye_la_noche_anterior(client, admin_token, db_session):
    """Un caso de las 22:30 de Caracas pertenece a ese día, no al siguiente (UTC)."""
    # 2026-01-14 22:30 en Caracas = 2026-01-15 02:30 UTC.
    _caso(db_session, admin_token["id_central"], "TSTD94-OP1",
          None, datetime(2026, 1, 15, 2, 30, tzinfo=UTC))

    dia_operativo = monitoreo.gestion_diaria(
        db_session, admin_token["id_central"], date(2026, 1, 14)
    )
    dia_utc = monitoreo.gestion_diaria(
        db_session, admin_token["id_central"], date(2026, 1, 15)
    )
    assert dia_operativo["ingresos_nuevos"] == 1
    assert dia_utc["ingresos_nuevos"] == 0


def test_el_diario_sin_fecha_usa_el_dia_operativo(client, admin_token):
    r = client.get(f"{MONITOREO}/diario", headers=admin_token["admin"])
    assert r.status_code == 200, r.text
    assert r.json()["fecha"] == monitoreo.hoy_operativo().isoformat()


# --------------------------------------------------------------------------- #
# Métricas por identificador de pago (RF-54/RF-55)
# --------------------------------------------------------------------------- #
def _escenario(db, id_central: int) -> None:
    """Dos identificadores (uno reincidente) y un caso sin 70*."""
    ip_a = _identificador(db, "7014000901", id_central)
    ip_b = _identificador(db, "7014000902", id_central)
    # «Recientes» de hace un par de horas: quedan dentro hasta de una ventana de 1 día.
    reciente = datetime.now(UTC) - timedelta(hours=2)
    antiguo = datetime.now(UTC) - timedelta(days=200)
    _caso(db, id_central, "TSTD94-A1", ip_a.id_pago, reciente)
    _caso(db, id_central, "TSTD94-A2", ip_a.id_pago, reciente)
    _caso(db, id_central, "TSTD94-A3", ip_a.id_pago, antiguo)  # fuera de la ventana
    _caso(db, id_central, "TSTD94-B1", ip_b.id_pago, reciente)
    _caso(db, id_central, "TSTD94-S1", None, reciente)


def test_identificadores_cuenta_reportes_y_reincidentes(admin_token, db_session):
    _escenario(db_session, admin_token["id_central"])
    datos = monitoreo.identificadores(db_session, admin_token["id_central"], dias=90)

    assert datos["con_casos"] == 2
    assert datos["casos_con_identificador"] == 4
    assert datos["casos_sin_identificador"] == 1
    assert datos["max_casos"] == 3
    assert datos["media_casos"] == 2.0
    # Solo el identificador con 2+ reportes en la ventana es reincidente (RF-54).
    assert datos["reincidentes"] == 1
    primero = datos["top"][0]
    assert primero["numero"] == "7014000901"
    assert primero["casos"] == 3
    assert primero["reportes_ventana"] == 2
    assert primero["reincidente"] is True
    assert datos["top"][1]["reincidente"] is False


def test_la_ventana_de_reincidencia_es_configurable(admin_token, db_session):
    _escenario(db_session, admin_token["id_central"])
    corta = monitoreo.identificadores(db_session, admin_token["id_central"], dias=1)
    # Con una ventana de 1 día, los dos reportes de hace un par de horas sí cuentan.
    assert corta["reincidentes"] == 1
    estrecha = monitoreo.identificadores(db_session, admin_token["id_central"], dias=0)
    assert estrecha["con_casos"] == 2
    assert estrecha["reincidentes"] == 0


def test_el_endpoint_es_de_gestion(client, admin_token, db_session):
    _escenario(db_session, admin_token["id_central"])

    r = client.get(f"{MONITOREO}/identificadores", headers=admin_token["admin"])
    assert r.status_code == 200, r.text
    datos = r.json()
    assert datos["reincidentes"] == 1
    assert datos["top"][0]["numero"] == "7014000901"
    assert datos["ventana_dias"] >= 1
    assert set(datos) == {
        "ventana_dias", "con_casos", "casos_con_identificador", "casos_sin_identificador",
        "media_casos", "max_casos", "reincidentes", "top",
    }

    assert client.get(f"{MONITOREO}/identificadores",
                      headers=admin_token["supervisor"]).status_code == 200
    assert client.get(f"{MONITOREO}/identificadores",
                      headers=admin_token["tecnico"]).status_code == 403


def test_el_limite_del_listado(client, admin_token, db_session):
    _escenario(db_session, admin_token["id_central"])
    r = client.get(f"{MONITOREO}/identificadores?limite=1", headers=admin_token["admin"])
    assert r.status_code == 200
    assert len(r.json()["top"]) == 1


# --------------------------------------------------------------------------- #
# Informe
# --------------------------------------------------------------------------- #
def test_el_informe_imprimible_muestra_el_identificador(client, admin_token, db_session):
    _escenario(db_session, admin_token["id_central"])
    r = client.get(REPORTE, headers=admin_token["admin"])
    assert r.status_code == 200, r.text
    html = r.text
    assert "Día operativo:" in html and "America/Caracas" in html
    assert "Identificadores de pago con más reportes" in html
    assert "7014000901" in html
    assert "Reincidentes" in html
    assert "Regla REPARACIÓN" in html
