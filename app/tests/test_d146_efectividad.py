"""D-146 · Efectividad y ranking de cuadrillas.

El método: `puntaje = 100 * (0.45·cierre + 0.25·oportunidad + 0.20·calidad +
0.10·reapertura)`, medido sobre el trabajo despachado en el periodo. Estas pruebas
fijan la **función pura** (para que el número sea reproducible) y el **ranking**
con datos reales de dos cuadrillas.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.models import (
    Caso,
    CasoEstadoHist,
    Cuadrilla,
    Despacho,
    DespachoCasos,
    Evidencia,
)
from app.services import efectividad
from app.services.tiempo import hoy_operativo

CASOS = "/api/v1/casos"
EFECTIVIDAD = "/api/v1/despachos/efectividad"


# --------------------------------------------------------------------------- #
# Función pura
# --------------------------------------------------------------------------- #
def test_una_cuadrilla_perfecta_saca_100():
    calculo = efectividad.puntaje(
        efectividad.Conteos(
            asignados=10, cerrados=10, en_plazo=10, con_evidencia=10, reaperturas=0
        )
    )
    assert calculo["puntaje"] == 100.0
    assert calculo["etiqueta"] == "EXCELENTE"
    assert calculo["muestra_suficiente"] is True


def test_sin_cierres_el_puntaje_es_bajo():
    calculo = efectividad.puntaje(efectividad.Conteos(asignados=10, cerrados=0))
    # Solo suma el 10 % de «sin reapertura» (no hay cerrados que reabrir).
    assert calculo["puntaje"] == pytest.approx(10.0)
    assert calculo["etiqueta"] == "BAJO"


def test_los_pesos_suman_uno_y_la_formula_es_explicita():
    assert abs(sum(efectividad.PESOS.values()) - 1.0) < 1e-9
    conteos = efectividad.Conteos(
        asignados=20, cerrados=10, en_plazo=5, con_evidencia=2, reaperturas=1
    )
    esperado = 100 * (
        0.45 * (10 / 20) + 0.25 * (5 / 10) + 0.20 * (2 / 10) + 0.10 * (1 - 1 / 10)
    )
    assert efectividad.puntaje(conteos)["puntaje"] == pytest.approx(round(esperado, 1))


def test_la_muestra_minima_se_marca():
    calculo = efectividad.puntaje(efectividad.Conteos(asignados=3, cerrados=3))
    assert calculo["muestra_suficiente"] is False


def test_las_etiquetas_cualitativas():
    assert efectividad._etiqueta(90) == "EXCELENTE"
    assert efectividad._etiqueta(75) == "BUENO"
    assert efectividad._etiqueta(60) == "REGULAR"
    assert efectividad._etiqueta(20) == "BAJO"


# --------------------------------------------------------------------------- #
# Ranking con datos
# --------------------------------------------------------------------------- #
def _caso(client, headers, id_averia: str, pago: str) -> int:
    r = client.post(
        CASOS,
        json={
            "id_averia": id_averia,
            "direccion": "SECTOR D146 CASA 1",
            "nombre_cliente": f"CLIENTE {id_averia}",
            "contacto_cliente": "04146665544",
            "id_pago": pago,
            "tipo_reporte": "REPARACION",
            "tipo_problema": "SIN_SERVICIO",
        },
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()["id_caso"]


@pytest.fixture()
def dos_cuadrillas(client, admin_token, db_session):
    """Una cuadrilla que cierra y otra que deja todo abierto, con evidencias."""
    id_central = admin_token["id_central"]
    buena = Cuadrilla(id_central=id_central, codigo="TC146A", nombre="Cuadrilla D146 A")
    mala = Cuadrilla(id_central=id_central, codigo="TC146B", nombre="Cuadrilla D146 B")
    db_session.add_all([buena, mala])
    db_session.flush()

    ayer = hoy_operativo() - timedelta(days=1)
    despacho_a = Despacho(
        id_central=id_central, fecha=ayer, id_cuadrilla=buena.id_cuadrilla, estado="CERRADO"
    )
    despacho_b = Despacho(
        id_central=id_central, fecha=ayer, id_cuadrilla=mala.id_cuadrilla, estado="CERRADO"
    )
    db_session.add_all([despacho_a, despacho_b])
    db_session.flush()

    for indice in range(6):
        id_caso = _caso(client, admin_token["admin"], f"TSTD146-A{indice}", f"70140039{indice:02d}")
        db_session.add(
            DespachoCasos(
                id_despacho=despacho_a.id_despacho, id_caso=id_caso,
                estado="ASIGNADO", tipo_asignacion="REPARACION",
            )
        )
        caso = db_session.get(Caso, id_caso)
        caso.estado_actual = "CERRADO"
        db_session.add(
            CasoEstadoHist(
                id_caso=id_caso, estado_anterior="NUEVO", estado_nuevo="CERRADO",
                motivo="prueba D-146", usuario="TESTADM",
                fecha_hora=datetime.now(UTC) - timedelta(days=1),
            )
        )
        db_session.add(
            Evidencia(
                id_caso=id_caso, tipo="DEMO", serial_imagen=f"TSTD146A{indice}",
                ruta_remota="https://storage/x.jpg", fecha_hora=datetime.now(UTC),
                origen_camara=True,
            )
        )
    for indice in range(5):
        id_caso = _caso(client, admin_token["admin"], f"TSTD146-B{indice}", f"70140039{50 + indice:02d}")
        db_session.add(
            DespachoCasos(
                id_despacho=despacho_b.id_despacho, id_caso=id_caso,
                estado="ASIGNADO", tipo_asignacion="REPARACION",
            )
        )
        # El cierre de jornada devuelve el caso a PENDIENTE (no se atendió).
        db_session.get(Caso, id_caso).estado_actual = "PENDIENTE"
    db_session.commit()
    return {
        "headers": admin_token["admin"],
        "dias": ((hoy_operativo() - timedelta(days=3)).isoformat(), hoy_operativo().isoformat()),
    }


def test_el_ranking_ordena_por_efectividad(client, dos_cuadrillas):
    r = client.get(
        EFECTIVIDAD,
        params={"desde": dos_cuadrillas["dias"][0], "hasta": dos_cuadrillas["dias"][1]},
        headers=dos_cuadrillas["headers"],
    )
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    filas = {f["codigo"]: f for f in cuerpo["ranking"]}
    assert "TC146A" in filas and "TC146B" in filas

    buena = filas["TC146A"]
    mala = filas["TC146B"]
    assert buena["cerrados"] == 6 and buena["asignados"] == 6
    assert buena["puntaje"] > mala["puntaje"]
    assert mala["cerrados"] == 0 and mala["devueltos"] == 5
    # La buena va primera entre las que tienen muestra.
    assert buena["posicion"] == 1
    # El ranking explica sus pesos y criterios.
    assert cuerpo["pesos"]["cierre"] == 0.45
    assert "cierre" in cuerpo["criterios"]


def test_una_cuadrilla_sin_trabajo_no_entra_al_ranking(client, dos_cuadrillas, db_session):
    id_central = db_session.scalar(
        select(Cuadrilla.id_central).where(Cuadrilla.codigo == "TC146A")
    )
    db_session.add(Cuadrilla(id_central=id_central, codigo="TC146C", nombre="Cuadrilla D146 C"))
    db_session.commit()

    r = client.get(
        EFECTIVIDAD,
        params={"desde": dos_cuadrillas["dias"][0], "hasta": dos_cuadrillas["dias"][1]},
        headers=dos_cuadrillas["headers"],
    )
    assert r.status_code == 200, r.text
    filas = {f["codigo"]: f for f in r.json()["ranking"]}
    assert filas["TC146C"]["posicion"] is None
    assert filas["TC146C"]["muestra_suficiente"] is False


def test_el_periodo_invertido_se_rechaza(client, admin_token):
    hoy = hoy_operativo()
    r = client.get(
        EFECTIVIDAD,
        params={"desde": hoy.isoformat(), "hasta": (hoy - timedelta(days=3)).isoformat()},
        headers=admin_token["admin"],
    )
    assert r.status_code == 422, r.text
