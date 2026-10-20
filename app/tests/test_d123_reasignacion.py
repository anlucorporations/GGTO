"""D-123 · Un caso reasignado a mitad de jornada no pierde el trabajo hecho (H-06).

Defecto (auditoría V3): `aplicar_carga` autorizaba por el **último despacho** del
caso; si el supervisor lo reasignaba a otra cuadrilla, todo lo que el técnico ya
tenía encolado se rechazaba para siempre (y el cierre online entraba por otra vía
que **no** validaba la cuadrilla: bypass silencioso).

Criterio acordado con el usuario: **aceptar el trabajo de las últimas 24 h** —el
caso sigue siendo gestionable por el técnico que lo recibió aunque ya no sea el
último despacho— y aplicar **el mismo criterio** en los endpoints de resolución de
campo.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy import select

from app.models import (
    Cuadrilla,
    CuadrillaTecnico,
    Despacho,
    DespachoCasos,
    Tecnico,
    Usuario,
)
from app.services import sync as svc_sync
from app.services.tiempo import hoy_operativo

CASOS = "/api/v1/casos"
SYNC = "/api/v1/sync/carga"


def _caso(client, headers, id_averia: str, pago: str) -> int:
    r = client.post(
        CASOS,
        json={
            "id_averia": id_averia,
            "direccion": "SECTOR D123 CASA 1",
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


def _cuadrilla(db_session, id_central: int, codigo: str, id_tecnico: int | None,
               desde: date | None = None) -> Cuadrilla:
    c = Cuadrilla(id_central=id_central, codigo=codigo, nombre=f"Cuadrilla {codigo}")
    db_session.add(c)
    db_session.flush()
    if id_tecnico is not None:
        db_session.add(
            CuadrillaTecnico(
                id_cuadrilla=c.id_cuadrilla,
                id_tecnico=id_tecnico,
                desde=desde or (hoy_operativo() - timedelta(days=2)),
            )
        )
        db_session.flush()
    return c


def _despachar(db_session, id_central: int, id_cuadrilla: int, fecha: date,
               id_caso: int, estado: str = "BORRADOR") -> Despacho:
    d = Despacho(
        id_central=id_central, fecha=fecha, id_cuadrilla=id_cuadrilla, estado=estado
    )
    db_session.add(d)
    db_session.flush()
    db_session.add(
        DespachoCasos(
            id_despacho=d.id_despacho,
            id_caso=id_caso,
            estado="ASIGNADO",
            orden_visita=1,
            tipo_asignacion="REPARACION",
        )
    )
    db_session.flush()
    return d


@pytest.fixture()
def reasignado(client, admin_token, db_session):
    """Caso que estuvo en la cuadrilla A y hoy está en la B; el técnico es de A."""
    id_central = admin_token["id_central"]
    id_tecnico = db_session.scalar(
        select(Tecnico.id_tecnico).where(Tecnico.p00 == "TESTTEC")
    )
    assert id_tecnico is not None
    id_caso = _caso(client, admin_token["admin"], "TSTD123-1", "7014002321")

    ayer = hoy_operativo() - timedelta(days=1)
    a = _cuadrilla(db_session, id_central, "TCD123A", id_tecnico)
    b = _cuadrilla(db_session, id_central, "TCD123B", None)
    # Ayer el caso fue de A; hoy el supervisor lo movió a B.
    _despachar(db_session, id_central, a.id_cuadrilla, ayer, id_caso, estado="CERRADO")
    _despachar(db_session, id_central, b.id_cuadrilla, hoy_operativo(), id_caso)
    db_session.commit()
    return {
        "headers": admin_token["tecnico"],
        "id_caso": id_caso,
        "id_cuadrilla_a": a.id_cuadrilla,
        "id_cuadrilla_b": b.id_cuadrilla,
    }


def test_el_trabajo_del_caso_reasignado_se_acepta(client, reasignado, db_session):
    """D-123 · H-06: el cierre encolado ayer en A se sube aunque hoy sea de B."""
    carga = client.post(
        SYNC,
        json={
            "dispositivo_id": "DEV-D123",
            "actividades": [
                {
                    "id_actividad_local": 31,
                    "id_caso": reasignado["id_caso"],
                    "tipo": "CIERRE",
                    "modo": "COS",
                    "reporte_corto": "Trabajo hecho ayer en la cuadrilla A (D-123)",
                    "fecha_hora": datetime.now(UTC).isoformat(),
                    "evidencias": [],
                }
            ],
            "estados": [],
        },
        headers=reasignado["headers"],
    )
    assert carga.status_code == 200, carga.text
    cuerpo = carga.json()
    assert cuerpo["items"][0]["aceptada"] is True, cuerpo
    assert cuerpo["aceptadas"] == 1

    caso = client.get(f"{CASOS}/{reasignado['id_caso']}", headers=reasignado["headers"])
    assert caso.json()["estado_actual"] == "CERRADO"


def test_el_cierre_online_del_caso_reasignado_se_permite(client, reasignado):
    """El cierre de la ficha usa el **mismo** criterio que la carga (sin bypass)."""
    r = client.post(
        f"{CASOS}/{reasignado['id_caso']}/cierre",
        json={"modo": "IVR", "descripcion": "Cierre online del caso reasignado"},
        headers=reasignado["headers"],
    )
    assert r.status_code == 200, r.text
    assert r.json()["estado_actual"] == "CERRADO"


def test_un_tecnico_no_puede_cerrar_un_caso_ajeno(client, admin_token, db_session):
    """Un caso que **nunca** estuvo en su cuadrilla responde 403 (sin bypass)."""
    id_central = admin_token["id_central"]
    id_caso = _caso(client, admin_token["admin"], "TSTD123-2", "7014002322")
    id_tecnico = db_session.scalar(
        select(Tecnico.id_tecnico).where(Tecnico.p00 == "TESTTEC")
    )
    a = _cuadrilla(db_session, id_central, "TCD123C", id_tecnico)
    b = _cuadrilla(db_session, id_central, "TCD123D", None)
    assert a.id_cuadrilla != b.id_cuadrilla
    _despachar(db_session, id_central, b.id_cuadrilla, hoy_operativo(), id_caso)
    db_session.commit()

    r = client.post(
        f"{CASOS}/{id_caso}/cierre",
        json={"modo": "IVR", "descripcion": "Intento de cierre de un caso ajeno"},
        headers=admin_token["tecnico"],
    )
    assert r.status_code == 403, r.text
    assert "cuadrilla" in r.text.lower()


def test_un_supervisor_cierra_cualquier_caso(client, admin_token, db_session):
    """Los roles de gestión no tienen restricción de cuadrilla."""
    id_caso = _caso(client, admin_token["admin"], "TSTD123-3", "7014002323")
    r = client.post(
        f"{CASOS}/{id_caso}/cierre",
        json={"modo": "SACAS", "descripcion": "Cierre del supervisor (D-123)"},
        headers=admin_token["supervisor"],
    )
    assert r.status_code == 200, r.text
    assert r.json()["estado_actual"] == "CERRADO"


def test_casos_permitidos_incluye_la_ventana_y_excluye_lo_ajeno(client, admin_token,
                                                               reasignado, db_session):
    """La función que comparten la carga y la ficha: ventana + fail-closed."""
    usuario = db_session.scalar(select(Usuario).where(Usuario.p00 == "TESTTEC"))
    assert usuario is not None
    permitidos = svc_sync.casos_permitidos(db_session, usuario)
    assert permitidos is not None
    assert reasignado["id_caso"] in permitidos, "el caso reasignado sigue en la ventana"

    # Sin cuadrilla vigente, el conjunto es vacío (fail-closed).
    usuario.id_tecnico = None
    db_session.flush()
    assert svc_sync.casos_permitidos(db_session, usuario) == set()
