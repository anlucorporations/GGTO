"""D-133 · `requiere_informe` se exige al cerrar el especial (H-16).

Defecto (auditoría V3): `requiere_informe` se mostraba y se editaba, pero **ningún
camino** exigía el informe: ni la APK, ni la web, ni el backend. Un especial podía
pasar a ATENDIDO/CERRADO sin la menor constancia de la atención.

Regla: con `requiere_informe = true`, el paso a ATENDIDO/CERRADO exige un
`informe` de al menos 20 caracteres; queda guardado en `caso_especial.informe`.
"""

from __future__ import annotations

import pytest

ESPECIALES = "/api/v1/casos-especiales"
SECTORES = "/api/v1/sectores"

INFORME = "Se atendió al suscriptor y se verificó la potencia de la línea (D-133)."


@pytest.fixture()
def especial(client, admin_token):
    sector = client.post(
        SECTORES,
        json={
            "id_central": admin_token["id_central"],
            "codigo": "TSD133",
            "nombre": "Sector D-133",
            "patron_direccion": "SECTOR D133",
        },
        headers=admin_token["admin"],
    )
    assert sector.status_code in (201, 409), sector.text
    r = client.post(
        ESPECIALES,
        json={
            "clasificacion": "REFERIDO",
            "tipo_actividad": "REPARACION",
            "prioridad": "MEDIA",
            "descripcion": "Caso especial de prueba D-133",
            "requiere_informe": True,
            "id_sector": sector.json().get("id_sector") if sector.status_code == 201 else None,
            "crear_solicitante": {
                "nombre": "SOLICITANTE D133",
                "unidad": "GERENCIA D133",
                "contacto": "04141112233",
            },
            "direccion": "SECTOR D133 CASA 1",
            "telefono": "7014003321",
            "id_averia": "TSTD133-1",
            "nombre_cliente": "CLIENTE D133",
            "contacto_cliente": "04141112233",
            "id_pago": "7014003321",
            "tipo_reporte": "RECLAMO",
            "tipo_problema": "SIN_SERVICIO",
        },
        headers=admin_token["admin"],
    )
    assert r.status_code == 201, r.text
    return {"headers": admin_token["admin"], "id": r.json()["id_caso_especial"]}


def _patch(client, entorno, **cambios):
    return client.patch(
        f"{ESPECIALES}/{entorno['id']}", json=cambios, headers=entorno["headers"]
    )


def test_cerrar_sin_informe_se_rechaza(client, especial):
    r = _patch(client, especial, estado="CERRADO")
    assert r.status_code == 422, r.text
    assert "informe" in r.json()["detail"].lower()


def test_un_informe_demasiado_corto_se_rechaza(client, especial):
    r = _patch(client, especial, estado="ATENDIDO", informe="listo")
    assert r.status_code == 422, r.text


def test_con_informe_se_cierra_y_queda_guardado(client, especial):
    r = _patch(client, especial, estado="CERRADO", informe=INFORME)
    assert r.status_code == 200, r.text
    assert r.json()["estado"] == "CERRADO"
    assert r.json()["informe"] == INFORME

    # Y queda persistido: la siguiente lectura lo devuelve.
    leido = client.get(f"{ESPECIALES}/{especial['id']}", headers=especial["headers"])
    assert leido.status_code == 200, leido.text
    assert leido.json()["informe"] == INFORME


def test_el_informe_previo_sirve_para_cerrar(client, especial):
    """Si el informe ya se había guardado, no hay que reescribirlo al cerrar."""
    assert _patch(client, especial, informe=INFORME).status_code == 200
    r = _patch(client, especial, estado="CERRADO")
    assert r.status_code == 200, r.text


def test_sin_requiere_informe_no_se_exige(client, especial):
    assert _patch(client, especial, requiere_informe=False).status_code == 200
    r = _patch(client, especial, estado="CERRADO")
    assert r.status_code == 200, r.text


def test_un_estado_no_final_no_exige_informe(client, especial):
    r = _patch(client, especial, estado="EN_PROCESO")
    assert r.status_code == 200, r.text
