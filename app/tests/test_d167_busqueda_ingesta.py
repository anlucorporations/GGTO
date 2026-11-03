"""D-167 · La búsqueda por texto simple recorre **todos** los campos de la
tabla de ingesta.

Petición del usuario: «modifica la búsqueda por texto simple, amplía la
búsqueda a todos los criterios de la tabla de ingesta».

Antes, el texto libre del listado miraba solo identificador, teléfono,
contacto, nombre, dirección, tipo, clase, estado y sector; la búsqueda de
PANEL (RF-30) solo el identificador, el pago, el contacto, el nombre y la
dirección. Ahora ambos recorren **toda** la especificación de ingesta
(`services/ingesta.py`): datos técnicos FAT (OLT/slot/puerto/serial), quién
reporta y atiende, códigos VENAPP, unidad de negocio, comentarios, `telefono_ip`
(D-164) y hasta los ayudantes (JSONB comparado como texto).
"""

from __future__ import annotations

import pytest

from ..models import Caso

CASOS = "/api/v1/casos"
BUSCAR = "/api/v1/casos/buscar"


def _caso_base(client, headers, id_averia: str) -> int:
    r = client.post(
        CASOS,
        json={
            "id_averia": id_averia,
            "nombre_cliente": "CLIENTE CONTROL D167",
            "contacto_cliente": "04147771667",
            "id_pago": "7014167001",
            "direccion": "AV. DFOO 167 CASA 3",
            "tipo_reporte": "REPARACION",
            "tipo_problema": "SIN_SERVICIO",
        },
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()["id_caso"]


@pytest.fixture()
def entorno(client, admin_token, db_session):
    id_caso = _caso_base(client, admin_token["admin"], "TSTD167-1")
    caso = db_session.get(Caso, id_caso)
    # Campos que solo trae la tabla de ingesta (no van por la alta manual).
    caso.olt = "pde-olt-07"
    caso.slot = "9"
    caso.puerto = "4"
    caso.fat = "FAT 777"
    caso.serial = "SNTESTD167"
    caso.persona_reporta = "REPORTANTE D167"
    caso.asignado_a = "ATENDEDOR D167"
    caso.reparador_principal = "REPARADOR D167"
    caso.unidad_negocio = "PREPAGO D167"
    caso.ups = "UPS 167"
    caso.codigos_gestionados_venapp = "VENAPP-D167"
    caso.cuadrilla_externa = "SUBCONTRATADA D167"
    caso.flota_can = "CAN-167"
    caso.despacho_nombre = "NOMBRE D167"
    caso.despacho_apellido = "APELLIDO D167"
    caso.telefono_oficina = "02125051667"
    caso.telefono_movil = "04125151667"
    caso.telefono_ip = "02122174167"
    caso.informacion = "FUSION en FAT 777 (ingesta D-167)"
    caso.ultimo_comentario = "COMENTARIO D167"
    caso.results = "RESULTADO D167"
    caso.ayudantes = ["AYUDANTE D167", "OTRO"]
    db_session.commit()
    return {"headers": admin_token["admin"], "id_caso": id_caso}


@pytest.mark.parametrize(
    "unidad,termino", [
        ("olt", "pde-olt-07"),
        ("slot+puerto", "FAT 777"),
        ("serial", "SNTESTD167"),
        ("persona_reporta", "REPORTANTE D167"),
        ("asignado_a", "ATENDEDOR D167"),
        ("reparador_principal", "REPARADOR D167"),
        ("unidad_negocio", "PREPAGO D167"),
        ("ups", "UPS 167"),
        ("codigos_gestionados_venapp", "VENAPP-D167"),
        ("cuadrilla_externa", "SUBCONTRATADA D167"),
        ("flota_can", "CAN-167"),
        ("despacho_apellido", "APELLIDO D167"),
        ("ultimo_comentario", "COMENTARIO D167"),
        ("results", "RESULTADO D167"),
        ("ayudantes (JSONB)", "AYUDANTE D167"),
    ],
)
def test_el_texto_libre_del_listado_busca_todo_lo_ingestado(client, entorno, unidad, termino):
    r = client.get(CASOS, params={"q": termino, "solo_abiertos": "true"},
                   headers=entorno["headers"])
    assert r.status_code == 200, r.text
    assert entorno["id_caso"] in {c["id_caso"] for c in r.json()["items"]}, termino


@pytest.mark.parametrize(
    "termino", [
        "FAT 777",        # datos técnicos (antes fuera del buscador)
        "SNTESTD167",     # serial
        "VENAPP-D167",    # código VENAPP
        "AYUDANTE D167",  # ayudantes (JSONB)
        "02122174167",    # telefono_ip (D-164)
    ],
)
def test_la_busqueda_de_panel_tambien_ve_todo_lo_ingestado(client, entorno, termino):
    r = client.get(BUSCAR, params={"q": termino}, headers=entorno["headers"])
    assert r.status_code == 200, r.text
    ids = [c["id_caso"] for c in r.json()]
    assert entorno["id_caso"] in ids, termino
    # Sin sobre-entrega: si el término solo vive en ese caso, solo ese aparece.
    if termino in ("SNTESTD167", "VENAPP-D167"):
        assert ids == [entorno["id_caso"]]


def test_el_telefono_ip_se_busca_con_el_numero_completo(client, entorno):
    """D-164: el teléfono IP es un campo de contacto más (variantes D-144)."""
    r = client.get(CASOS, params={"q": "02122174167"}, headers=entorno["headers"])
    assert r.status_code == 200, r.text
    assert entorno["id_caso"] in {c["id_caso"] for c in r.json()["items"]}


def test_la_busqueda_sigue_acotada_a_la_central(client, entorno):
    """El texto no abre el recinto: la regla D-130 se conserva."""
    r = client.get(CASOS, params={"q": "ZZZ-NADA"}, headers=entorno["headers"])
    assert r.status_code == 200, r.text
    assert r.json()["items"] == []
