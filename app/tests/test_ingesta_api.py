"""Pruebas de integración del Ciclo 3: ingesta del CSV y gestión automatizada."""

from __future__ import annotations

import pathlib

from sqlalchemy import func, select

from app.models import IngestaLote, Sector, SectorDireccion
from app.models.caso_entities import Caso

RUTA_MUESTRA = (
    pathlib.Path(__file__).resolve().parents[2]
    / "RepoTecnico"
    / "muestras"
    / "detalle_averias_gpon_EJEMPLO.csv"
)
TOTAL_FILAS_MUESTRA = 56
FILAS_CENTRAL = 51       # la muestra trae 3 centrales (2324X, 2319X, 2318X)
FILAS_DESCARTADAS = 5


def _subir(client, headers, endpoint="/api/v1/ingesta"):
    with RUTA_MUESTRA.open("rb") as fh:
        return client.post(
            endpoint,
            files={"archivo": ("detalle_averias_gpon.csv", fh, "text/csv")},
            headers=headers,
        )


def test_ingesta_sin_token(client):
    with RUTA_MUESTRA.open("rb") as fh:
        r = client.post("/api/v1/ingesta", files={"archivo": ("x.csv", fh, "text/csv")})
    assert r.status_code == 401


def test_ingesta_tecnico_no_puede(client, admin_token):
    r = _subir(client, admin_token["tecnico"])
    assert r.status_code == 403


def test_preview_no_guarda(client, admin_token, db_session):
    r = _subir(client, admin_token["admin"], "/api/v1/ingesta/preview")
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert cuerpo["filas_leidas"] == TOTAL_FILAS_MUESTRA
    assert cuerpo["filas_central"] == FILAS_CENTRAL
    assert cuerpo["casos_nuevos"] == FILAS_CENTRAL
    assert cuerpo["casos_descartados"] == FILAS_DESCARTADAS
    assert cuerpo["id_lote"] is None
    assert len(cuerpo["ejemplos"]) == 10

    assert db_session.scalar(select(func.count()).select_from(Caso)) == 0


def test_ingesta_inserta_y_deduplica(client, admin_token, db_session):
    r = _subir(client, admin_token["admin"])
    assert r.status_code == 201, r.text
    cuerpo = r.json()
    assert cuerpo["casos_nuevos"] == FILAS_CENTRAL
    assert cuerpo["casos_duplicados"] == 0
    assert cuerpo["casos_descartados"] == FILAS_DESCARTADAS
    assert cuerpo["id_lote"] is not None

    assert db_session.scalar(select(func.count()).select_from(Caso)) == FILAS_CENTRAL

    # Segunda carga del mismo archivo → todo duplicado (RF-22)
    segunda = _subir(client, admin_token["admin"])
    assert segunda.status_code == 201, segunda.text
    assert segunda.json()["casos_nuevos"] == 0
    assert segunda.json()["casos_duplicados"] == FILAS_CENTRAL
    assert db_session.scalar(select(func.count()).select_from(Caso)) == FILAS_CENTRAL


def test_ingesta_registra_el_lote(client, admin_token, db_session):
    r = _subir(client, admin_token["admin"])
    id_lote = r.json()["id_lote"]

    lotes = client.get("/api/v1/ingesta/lotes", headers=admin_token["admin"])
    assert lotes.status_code == 200
    assert any(lote["id_lote"] == id_lote for lote in lotes.json())

    detalle = client.get(f"/api/v1/ingesta/lotes/{id_lote}", headers=admin_token["admin"])
    assert detalle.status_code == 200
    assert detalle.json()["estado"] == "OK"
    assert detalle.json()["casos_nuevos"] == FILAS_CENTRAL

    assert db_session.scalar(select(func.count()).select_from(IngestaLote)) >= 1


def test_sectorizacion_y_cuadrilla0(client, admin_token, db_session):
    # Dos sectores que cubren direcciones presentes en la muestra
    for nombre, codigo, patrones in (
        ("Norte Test", "TS1", ["CUMBRES DE CURUMO"]),
        ("Sur Test", "TS2", ["SECTOR SANTA CRUZ"]),
    ):
        r = client.post(
            "/api/v1/sectores",
            json={
                "id_central": admin_token["id_central"],
                "nombre": nombre,
                "codigo": codigo,
                "direcciones": [{"patron": p} for p in patrones],
            },
            headers=admin_token["admin"],
        )
        assert r.status_code == 201, r.text

    r = _subir(client, admin_token["admin"])
    assert r.status_code == 201, r.text
    resumen = r.json()

    assert resumen["sectorizados"] > 0
    assert resumen["sectorizados"] + resumen["sin_sector"] == resumen["casos_nuevos"]
    assert resumen["cuadrilla0"] >= 0

    # Todos los casos sectorizados apuntan a un sector existente
    con_sector = db_session.scalar(
        select(func.count()).select_from(Caso).where(Caso.id_sector.is_not(None))
    )
    assert con_sector == resumen["sectorizados"]

    # La marca de cuadrilla 0 quedó persistida
    en_gestion = db_session.scalar(
        select(func.count()).select_from(Caso).where(Caso.en_gestion_supervisor.is_(True))
    )
    assert en_gestion == resumen["cuadrilla0"]

    # El patrón quedó registrado (RNF-10: configurables)
    assert db_session.scalar(select(func.count()).select_from(SectorDireccion)) == 2
    assert db_session.scalar(select(func.count()).select_from(Sector)) == 2


def test_direcciones_sin_sector_se_reportan_y_se_gestionan(client, admin_token, db_session):
    """Sin sectores, la ingesta avisa de las direcciones nuevas y permite gestionarlas (D-66)."""
    r = _subir(client, admin_token["admin"], "/api/v1/ingesta/preview")
    assert r.status_code == 200, r.text
    resumen = r.json()
    assert resumen["sectorizados"] == 0
    assert resumen["sin_sector"] == resumen["casos_nuevos"]
    pendientes = resumen["direcciones_sin_sector"]
    assert pendientes, "debe reportar las direcciones sin sector"
    con_direccion = sum(p["total"] for p in pendientes)
    # Solo se pueden gestionar los casos con dirección (algunos vienen sin ella)
    assert 0 < con_direccion <= resumen["sin_sector"]
    primera = pendientes[0]
    assert primera["direccion"]
    assert primera["ejemplo_id_averia"]

    # Carga real: los casos quedan sin sector
    r = _subir(client, admin_token["admin"])
    assert r.status_code == 201, r.text
    assert r.json()["sin_sector"] == FILAS_CENTRAL

    # El supervisor agrega la dirección a un sector nuevo y re-sectoriza
    r = client.post(
        "/api/v1/sectores",
        json={
            "id_central": admin_token["id_central"],
            "nombre": "Sector Nuevo",
            "codigo": "TSTN1",
            "direcciones": [{"patron": primera["direccion"]}],
        },
        headers=admin_token["admin"],
    )
    assert r.status_code == 201, r.text

    r = client.post("/api/v1/ingesta/sectorizar-pendientes", headers=admin_token["admin"])
    assert r.status_code == 200, r.text
    resultado = r.json()
    assert resultado["revisados"] == con_direccion
    assert resultado["asignados"] >= primera["total"]
    assert resultado["asignados"] + resultado["sin_sector"] == resultado["revisados"]

    con_sector = db_session.scalar(
        select(func.count()).select_from(Caso).where(Caso.id_sector.is_not(None))
    )
    assert con_sector == resultado["asignados"]


def test_sectorizar_pendientes_requiere_escritura(client, admin_token):
    r = client.post("/api/v1/ingesta/sectorizar-pendientes", headers=admin_token["tecnico"])
    assert r.status_code == 403
