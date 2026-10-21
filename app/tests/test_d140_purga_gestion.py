"""D-140 · La cuadrilla de gestión no purga aunque tenga casos (H-23).

Defecto (auditoría V3): la salvaguarda de la cuadrilla de gestión (C-00) solo se
activaba cuando la cuadrilla **no tenía casos**: `construir_descarga` devolvía
`CUADRILLA_GESTION` únicamente en la rama `not ids_cuadrilla`. Con C-00 llena, el
servidor respondía `OK`, la APK purgaba y la salvaguarda era inerte.

Corrección: la descarga lleva `purga_permitida` (`false` para una cuadrilla de
gestión, tenga o no casos) y la APK solo purga si es `true`.

Las pruebas **no modifican** la cuadrilla sembrada C-00: le asignan un técnico y un
caso, que es justo el escenario del defecto.
"""

from __future__ import annotations

from datetime import timedelta

from sqlalchemy import select

from app.core.security import hash_password
from app.models import (
    Cuadrilla,
    CuadrillaTecnico,
    Despacho,
    DespachoCasos,
    Rol,
    Tecnico,
    Usuario,
)
from app.services.tiempo import hoy_operativo
from app.tests.conftest import asignar_caso_al_tecnico

CASOS = "/api/v1/casos"
DESCARGA = "/api/v1/sync/descarga"
P00_GESTION = "TSTGEST"


def _caso(client, headers, id_averia: str, pago: str) -> int:
    r = client.post(
        CASOS,
        json={
            "id_averia": id_averia,
            "direccion": "SECTOR D140 CASA 1",
            "nombre_cliente": f"CLIENTE {id_averia}",
            "contacto_cliente": "04143334455",
            "id_pago": pago,
            "tipo_reporte": "REPARACION",
            "tipo_problema": "SIN_SERVICIO",
        },
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()["id_caso"]


def _tecnico_en_la_gestion(client, admin_token, db_session, id_caso: int):
    """Un técnico de la cuadrilla de gestión C-00, con el caso despachado."""
    id_central = admin_token["id_central"]
    c00 = db_session.scalar(
        select(Cuadrilla).where(
            Cuadrilla.id_central == id_central, Cuadrilla.es_supervisor.is_(True)
        )
    )
    assert c00 is not None, "falta la cuadrilla de gestión sembrada (C-00)"

    rol_tec = db_session.scalar(select(Rol).where(Rol.codigo == "TECNICO"))
    tec = Tecnico(id_central=id_central, nombre="GESTION", apellido="TEST", p00=P00_GESTION)
    db_session.add(tec)
    db_session.flush()
    db_session.add(
        Usuario(
            p00=P00_GESTION,
            clave_hash=hash_password("config12345"),
            id_rol=rol_tec.id_rol,
            id_tecnico=tec.id_tecnico,
            id_central=id_central,
        )
    )
    db_session.add(
        CuadrillaTecnico(
        id_cuadrilla=c00.id_cuadrilla,
        id_tecnico=tec.id_tecnico,
        desde=hoy_operativo() - timedelta(days=1),
    )
    )
    despacho = Despacho(
        id_central=id_central,
        fecha=hoy_operativo(),
        id_cuadrilla=c00.id_cuadrilla,
        estado="BORRADOR",
    )
    db_session.add(despacho)
    db_session.flush()
    db_session.add(
        DespachoCasos(
            id_despacho=despacho.id_despacho,
            id_caso=id_caso,
            estado="ASIGNADO",
            orden_visita=1,
            tipo_asignacion="REPARACION",
        )
    )
    db_session.commit()

    login = client.post(
        "/api/v1/auth/login", json={"p00": P00_GESTION, "clave": "config12345"}
    )
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_una_cuadrilla_de_gestion_no_purga_aunque_tenga_casos(client, admin_token,
                                                              db_session):
    id_caso = _caso(client, admin_token["admin"], "TSTD140-1", "7014003241")
    headers = _tecnico_en_la_gestion(client, admin_token, db_session, id_caso)

    r = client.post(DESCARGA, json={}, headers=headers)
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    ids = {c["id_caso"] for c in cuerpo["casos"]}
    assert id_caso in ids, f"motivo={cuerpo['motivo']} mensaje={cuerpo['mensaje']} cuadrilla={cuerpo['cuadrilla']}"
    assert cuerpo["purga_permitida"] is False, "una cuadrilla de gestión no purga nunca"


def test_una_cuadrilla_de_campo_si_purga(client, admin_token, db_session):
    id_caso = _caso(client, admin_token["admin"], "TSTD140-2", "7014003242")
    asignar_caso_al_tecnico(db_session, admin_token, id_caso)

    r = client.post(DESCARGA, json={}, headers=admin_token["tecnico"])
    assert r.status_code == 200, r.text
    assert r.json()["purga_permitida"] is True


def test_sin_cuadrilla_la_bandera_es_explicita(client, admin_token):
    """Sin cuadrilla la APK no purga por `cuadrillaResuelta` (D-115); la bandera
    sigue viajando para que el contrato no dependa del motivo."""
    r = client.post(DESCARGA, json={}, headers=admin_token["tecnico"])
    assert r.status_code == 200, r.text
    assert "purga_permitida" in r.json()
