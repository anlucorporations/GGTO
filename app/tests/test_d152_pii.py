"""D-152 · PII: la ficha, el historial y los relacionados respetan el alcance.

D-130 acotó el **listado** y la **búsqueda**, pero `GET /casos/{id}`,
`GET /casos/{id}/historial` y `GET /casos/{id}/relacionados` seguían devolviendo
cualquier caso a cualquier TÉCNICO: recorriendo identificadores se leían nombre,
teléfono y dirección de abonados de otras cuadrillas —y de otras centrales—.
Además, `/configuracion/tecnicos` exponía cédula, teléfono y correo de todo el
personal a **cualquier autenticado**.
"""

from __future__ import annotations

import pytest
from sqlalchemy import select

from app.models import Despacho
from app.tests.conftest import asignar_caso_al_tecnico

CASOS = "/api/v1/casos"
TECNICOS = "/api/v1/tecnicos"


def _caso(client, headers, id_averia: str, pago: str, telefono: str) -> int:
    r = client.post(
        CASOS,
        json={
            "id_averia": id_averia,
            "direccion": f"SECTOR {id_averia} CASA 1",
            "nombre_cliente": f"CLIENTE {id_averia}",
            "contacto_cliente": telefono,
            "id_pago": pago,
            "tipo_reporte": "REPARACION",
            "tipo_problema": "SIN_SERVICIO",
        },
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()["id_caso"]


@pytest.fixture()
def entorno(client, admin_token, db_session):
    propio = _caso(client, admin_token["admin"], "TSTD152-1", "7014004021", "04149991021")
    ajeno = _caso(client, admin_token["admin"], "TSTD152-2", "7014004022", "04149991022")
    id_cuadrilla = asignar_caso_al_tecnico(db_session, admin_token, propio)
    despacho = db_session.scalar(
        select(Despacho)
        .where(Despacho.id_cuadrilla == id_cuadrilla)
        .order_by(Despacho.id_despacho.desc())
    )
    return {
        "tecnico": admin_token["tecnico"],
        "admin": admin_token["admin"],
        "propio": propio,
        "ajeno": ajeno,
        "id_despacho": despacho.id_despacho if despacho else None,
    }


def test_el_tecnico_sigue_leyendo_su_ficha(client, entorno):
    r = client.get(f"{CASOS}/{entorno['propio']}", headers=entorno["tecnico"])
    assert r.status_code == 200, r.text
    assert r.json()["nombre_cliente"] == "CLIENTE TSTD152-1"


def test_el_tecnico_no_lee_la_ficha_de_otra_cuadrilla(client, entorno):
    r = client.get(f"{CASOS}/{entorno['ajeno']}", headers=entorno["tecnico"])
    assert r.status_code == 404, r.text
    assert entorno["ajeno"] != entorno["propio"]


def test_el_tecnico_no_lee_el_historial_ajeno(client, entorno):
    r = client.get(f"{CASOS}/{entorno['ajeno']}/historial", headers=entorno["tecnico"])
    assert r.status_code == 404, r.text


def test_el_tecnico_no_lee_los_relacionados_ajenos(client, entorno):
    r = client.get(f"{CASOS}/{entorno['ajeno']}/relacionados", headers=entorno["tecnico"])
    assert r.status_code == 404, r.text


def test_el_admin_sigue_leyendo_los_casos_de_su_central(client, entorno):
    for id_caso in (entorno["propio"], entorno["ajeno"]):
        r = client.get(f"{CASOS}/{id_caso}", headers=entorno["admin"])
        assert r.status_code == 200, r.text


def test_el_tecnico_no_puede_listar_el_personal(client, entorno):
    """`/tecnicos` devuelve cédula, teléfono y correo: solo gestión."""
    r = client.get(TECNICOS, headers=entorno["tecnico"])
    assert r.status_code == 403, r.text

    r = client.get(f"{TECNICOS}/1", headers=entorno["tecnico"])
    assert r.status_code == 403, r.text


def test_el_admin_si_lista_el_personal(client, entorno):
    r = client.get(TECNICOS, headers=entorno["admin"])
    assert r.status_code == 200, r.text
    assert r.json(), "el ADMIN debe seguir viendo a su personal"


def test_el_tecnico_no_puede_imprimir_el_despacho(client, entorno):
    """La ficha impresa lleva nombre, dirección y teléfono: solo gestión."""
    r = client.get(
        f"/api/v1/despachos/{entorno['id_despacho']}/imprimible",
        headers=entorno["tecnico"],
    )
    assert r.status_code == 403, r.text


def test_el_admin_puede_imprimir_el_despacho(client, entorno):
    r = client.get(
        f"/api/v1/despachos/{entorno['id_despacho']}/imprimible",
        headers=entorno["admin"],
    )
    assert r.status_code == 200, r.text
    assert r.headers["content-type"].startswith("text/html")
