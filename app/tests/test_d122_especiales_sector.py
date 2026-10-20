"""D-122 Â· Alta de un caso especial: exige sector y avisa si no llegarÃ¡ hoy.

H-04 de la auditorÃ­a V3: el caso `REF-â€¦` de un especial creado **despuÃ©s** de
procesar la jornada no tenÃ­a fila en `despacho_caso`, asÃ­ que `GET /sync/descarga`
nunca lo devolvÃ­a y el tÃ©cnico no podÃ­a cerrarlo. DecisiÃ³n del usuario: **exigir
sector y avisar** cuando la jornada ya estÃ¡ publicada (o el sector no tiene
cuadrilla asignada hoy).
"""

from __future__ import annotations

import pytest

from app.models import Cuadrilla, CuadrillaSectorDia, Despacho
from app.services.tiempo import hoy_operativo

ESPECIALES = "/api/v1/casos-especiales"


def _alta(direccion: str, **extra) -> dict:
    cuerpo = {
        "clasificacion": "REFERIDO",
        "tipo_actividad": "CONSTRUCCION",
        "prioridad": "MEDIA",
        "descripcion": "TEST D-122: alta de especial con sector",
        "crear_solicitante": {
            "unidad": "Unidad D-122",
            "nombre": "SOLICITANTE D122",
            "contacto": "04140000122",
            "canal": "TELEGRAM",
        },
        "direccion": direccion,
        "nombre_cliente": "CLIENTE D122",
        "contacto_cliente": "04142223344",
        "telefono": "7014001220",
        "tipo_problema": "SIN_SERVICIO",
    }
    cuerpo.update(extra)
    return cuerpo


@pytest.fixture()
def sector(client, admin_token):
    r = client.post(
        "/api/v1/sectores",
        json={
            "id_central": admin_token["id_central"],
            "nombre": "Sector D-122",
            "codigo": "TSD122",
            "direcciones": [{"patron": "SECTOR D122"}],
        },
        headers=admin_token["admin"],
    )
    assert r.status_code == 201, r.text
    return {"id": r.json()["id_sector"], "id_central": admin_token["id_central"]}


def test_alta_sin_sector_se_rechaza(client, admin_token):
    """Sin sector el caso no se puede despachar: el alta responde 422."""
    r = client.post(
        ESPECIALES,
        json=_alta("DIRECCION QUE NO PERTENECE A NINGUN SECTOR"),
        headers=admin_token["admin"],
    )
    assert r.status_code == 422, r.text
    detalle = r.text.lower()
    assert "sector" in detalle and ("no coincide" in detalle or "no se puede despachar" in detalle)


def test_alta_con_sector_y_cuadrilla_asignada_no_avisa(client, admin_token, sector,
                                                       db_session):
    """Con sector y cuadrilla del dÃ­a, el especial entra en el reparto sin aviso."""
    cuadrilla = Cuadrilla(
        id_central=sector["id_central"], codigo="TCD122", nombre="Cuadrilla D-122"
    )
    db_session.add(cuadrilla)
    db_session.flush()
    db_session.add(
        CuadrillaSectorDia(
            id_central=sector["id_central"],
            id_cuadrilla=cuadrilla.id_cuadrilla,
            id_sector=sector["id"],
            fecha=hoy_operativo(),
        )
    )
    db_session.commit()

    r = client.post(ESPECIALES, json=_alta("SECTOR D122 CASA 5"),
                    headers=admin_token["admin"])
    assert r.status_code == 201, r.text
    cuerpo = r.json()
    assert cuerpo["sector_nombre"] == "Sector D-122"
    assert cuerpo["aviso"] is None


def test_alta_con_sector_sin_cuadrilla_avisa(client, admin_token, sector):
    """Si el sector no tiene cuadrilla hoy, se avisa en la respuesta."""
    r = client.post(ESPECIALES, json=_alta("SECTOR D122 CASA 6"),
                    headers=admin_token["admin"])
    assert r.status_code == 201, r.text
    aviso = r.json()["aviso"]
    assert aviso and "cuadrilla" in aviso.lower()


def test_alta_con_jornada_publicada_avisa(client, admin_token, sector, db_session):
    """Con la jornada de hoy ya publicada, el especial no llega hoy: se avisa."""
    cuadrilla = Cuadrilla(
        id_central=sector["id_central"], codigo="TCD123", nombre="Cuadrilla D-123"
    )
    db_session.add(cuadrilla)
    db_session.flush()
    db_session.add_all([
        CuadrillaSectorDia(
            id_central=sector["id_central"],
            id_cuadrilla=cuadrilla.id_cuadrilla,
            id_sector=sector["id"],
            fecha=hoy_operativo(),
        ),
        Despacho(
            id_central=sector["id_central"],
            fecha=hoy_operativo(),
            id_cuadrilla=cuadrilla.id_cuadrilla,
            estado="PUBLICADO",
        ),
    ])
    db_session.commit()

    r = client.post(ESPECIALES, json=_alta("SECTOR D122 CASA 7"),
                    headers=admin_token["admin"])
    assert r.status_code == 201, r.text
    aviso = r.json()["aviso"]
    assert aviso and "publicada" in aviso.lower()


def test_alta_con_sector_explicito_evita_el_rechazo(client, admin_token, sector):
    """Indicando `id_sector` se puede dar de alta una direcciÃ³n sin patrÃ³n."""
    r = client.post(
        ESPECIALES,
        json=_alta("DIRECCION SIN PATRON CONOCIDO", id_sector=sector["id"]),
        headers=admin_token["admin"],
    )
    assert r.status_code == 201, r.text
    assert r.json()["sector_nombre"] == "Sector D-122"


def test_alta_con_sector_de_otra_central_se_rechaza(client, admin_token):
    """Un `id_sector` inexistente o de otra central no puede usarse."""
    r = client.post(
        ESPECIALES,
        json=_alta("SECTOR D122 CASA 8", id_sector=999999),
        headers=admin_token["admin"],
    )
    assert r.status_code == 422, r.text
    assert "sector" in r.text.lower()
