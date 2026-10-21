"""D-145 · Ingesta manual: id automático, referido, solicitante y mapa por dirección.

Petición del usuario (5 puntos):
1. el ID de avería se genera solo con el formato `REF-(CONS/REP)-[correlativo]`;
2. todos los casos de ingesta manual son **referidos**;
3. el solicitante sale del **personal externo** (unidad → nombre → número);
4. «Personal externo» pasa de MASIVAS a la configuración de técnicos (web);
5. MASIVAS ubica el FAT en el mapa por **dirección** o coordenadas.

Este archivo fija lo del backend: 1, 2, 3 y los enlaces del mapa (5).
"""

from __future__ import annotations

import pytest
from sqlalchemy import select

from app.models import CasoEspecial, Solicitante
from app.services import geocodificacion

CASOS = "/api/v1/casos"
SOLICITANTES = "/api/v1/solicitantes"


def _alta(client, headers, **extra):
    cuerpo = {
        "tipo_reporte": "REPARACION",
        # D-145: la web de alta manual envía la categoría de referido.
        "categoria": "REFERIDO",
        "tipo_problema": "SIN_SERVICIO",
        "nombre_cliente": "CLIENTE D145",
        "contacto_cliente": "04147770011",
        "id_pago": "7014003801",
        "direccion": "SECTOR D145 CASA 1",
        "problema_reporte": "SIN SERVICIO",
    }
    cuerpo.update(extra)
    return client.post(CASOS, json=cuerpo, headers=headers)


@pytest.fixture()
def entorno(client, admin_token, db_session):
    r = client.post(
        SOLICITANTES,
        json={
            "unidad": "GERENCIA D145",
            "nombre": "ANA SOLICITANTE",
            "contacto": "04143334455",
            "canal": "MANUAL",
        },
        headers=admin_token["admin"],
    )
    assert r.status_code == 201, r.text
    return {"headers": admin_token["admin"], "id_solicitante": r.json()["id_solicitante"]}


def test_el_id_se_genera_con_el_prefijo_de_la_actividad(client, entorno):
    reparacion = _alta(client, entorno["headers"])
    assert reparacion.status_code == 201, reparacion.text
    assert reparacion.json()["id_averia"].startswith("REF-REP-")

    construccion = _alta(
        client,
        entorno["headers"],
        tipo_reporte="CONSTRUCCION",
        tipo_problema=None,
        id_pago="7014003802",
    )
    assert construccion.status_code == 201, construccion.text
    assert construccion.json()["id_averia"].startswith("REF-CONS-")


def test_todo_alta_manual_es_referido(client, entorno):
    for tipo in ("REPARACION", "CONSTRUCCION"):
        r = _alta(
            client,
            entorno["headers"],
            tipo_reporte=tipo,
            tipo_problema="SIN_SERVICIO" if tipo == "REPARACION" else None,
            id_pago="7014003803" if tipo == "REPARACION" else "7014003804",
        )
        assert r.status_code == 201, r.text
        cuerpo = r.json()
        assert cuerpo["categoria"] == "REFERIDO"
        assert cuerpo["tipo_caso"] == ("REFERIDO" if tipo == "REPARACION" else "CONSTRUCCION")


def test_el_solicitante_queda_en_la_ficha_del_referido(client, entorno, db_session):
    r = _alta(client, entorno["headers"], id_solicitante=entorno["id_solicitante"])
    assert r.status_code == 201, r.text
    id_caso = r.json()["id_caso"]

    db_session.expire_all()
    especial = db_session.scalar(
        select(CasoEspecial).where(CasoEspecial.id_caso == id_caso)
    )
    assert especial is not None
    assert especial.clasificacion == "REFERIDO"
    assert especial.tipo_actividad == "REPARACION"
    assert especial.id_solicitante == entorno["id_solicitante"]


def test_un_solicitante_inexistente_se_rechaza(client, entorno):
    r = _alta(client, entorno["headers"], id_solicitante=999999)
    assert r.status_code == 404, r.text


def test_la_construccion_conserva_su_actividad_en_la_ficha(client, entorno, db_session):
    r = _alta(
        client,
        entorno["headers"],
        tipo_reporte="CONSTRUCCION",
        tipo_problema=None,
        id_pago="7014003805",
        id_solicitante=entorno["id_solicitante"],
    )
    assert r.status_code == 201, r.text
    db_session.expire_all()
    especial = db_session.scalar(
        select(CasoEspecial).where(CasoEspecial.id_caso == r.json()["id_caso"])
    )
    assert especial is not None and especial.tipo_actividad == "CONSTRUCCION"


# --------------------------------------------------------------------------- #
# D-145 · enlaces del mapa (punto 5)
# --------------------------------------------------------------------------- #
def test_los_enlaces_del_mapa_se_calculan_sin_red():
    assert geocodificacion.normalizar_consulta("CALLE 1", None, " ", "FAT A") == "CALLE 1, FAT A"
    assert geocodificacion.url_mapa(None, None) is None
    enlace = geocodificacion.url_mapa(10.123456, -66.987654)
    assert enlace is not None and "mlat=10.123456" in enlace and "mlon=-66.987654" in enlace
    busqueda = geocodificacion.url_busqueda("AV. LIBERTADOR, CARACAS")
    assert busqueda is not None and "openstreetmap.org/search" in busqueda
    assert geocodificacion.url_busqueda("   ") is None


def test_la_ubicacion_sin_gps_ofrece_el_enlace_de_busqueda(client, entorno, db_session):
    """Sin coordenadas, la ubicación trae `url_busqueda` con la dirección del FAT."""
    from app.models import Despacho, FallaMasiva

    r = _alta(client, entorno["headers"])
    assert r.status_code == 201, r.text

    falla = FallaMasiva(
        id_central=1,
        descripcion="FAT sin GPS",
        direccion="AV. LIBERTADOR, CARACAS",
        fat="FAT-D145",
        estado="DETECTADA",
    )
    db_session.add(falla)
    db_session.commit()

    ubicacion = client.get(
        f"/api/v1/fallas-masivas/{falla.id_falla}/ubicacion",
        headers=entorno["headers"],
    )
    assert ubicacion.status_code == 200, ubicacion.text
    cuerpo = ubicacion.json()
    assert cuerpo["latitud"] is None
    assert cuerpo["url_mapa"] is None
    assert cuerpo["url_busqueda"] and "AV.%20LIBERTADOR" in cuerpo["url_busqueda"]
