"""Pruebas del incremento D-160 — corte nocturno a las 23:00.

El corte de jornada cambia de contrato a petición del cliente:

* se ejecuta **todos los días a las 23:00** vía el job de Cloud Scheduler
  `ggto-cierre-jornada` → `POST /api/v1/mantenimiento/cierre-jornada`
  (protegido por el token `X-Mantenimiento-Token` como los demás jobs);
* los casos **no atendidos** —todo lo que no esté `CERRADO`, `CANCELADO` o
  `ENRUTADO` (D-99, confirmado por el usuario en D-160)— vuelven a `PENDIENTE`;
  los `CITADO` conservan la fecha de su cita;
* las asignaciones se anulan (DEVUELTO, D-157);
* las **fallas masivas activas quedan sin cuadrilla** (`id_cuadrilla NULL`);
* el endpoint manual `POST /despachos/cierre-jornada` y el cierre perezoso
  pasan a aceptar **solo Supervisor y Super Usuario** (el ADMIN ya no).
"""

from __future__ import annotations

from datetime import datetime, timedelta

import pytest
from sqlalchemy import select

from app.models import Caso, Despacho, DespachoCasos, FallaMasiva
from app.services import jornada as svc_jornada
from app.services.tiempo import hoy_operativo

CASOS = "/api/v1/casos"
MASIVAS = "/api/v1/fallas-masivas"
DESPACHOS = "/api/v1/despachos"
AYER = (hoy_operativo() - timedelta(days=1)).isoformat()


@pytest.fixture()
def entorno(client, admin_token, db_session):
    """Cases of AYER, a cuadrilla y una masiva con cuadrilla asignada."""
    headers = admin_token["admin"]
    id_central = admin_token["id_central"]

    r = client.post("/api/v1/sectores",
                    json={"id_central": id_central, "nombre": "D160", "codigo": "TS16A",
                          "direcciones": [{"patron": "SECTOR D160"}]},
                    headers=headers)
    assert r.status_code == 201, r.text
    id_sector = r.json()["id_sector"]

    r = client.post("/api/v1/cuadrillas",
                    json={"id_central": id_central, "codigo": "TC16A",
                          "nombre": "Cuadrilla D160"},
                    headers=headers)
    assert r.status_code == 201, r.text
    id_cuadrilla = r.json()["id_cuadrilla"]

    def crear(id_averia: str):
        r = client.post(CASOS,
                        json={"id_averia": id_averia, "direccion": "SECTOR D160 CASA 1",
                              "nombre_cliente": f"CLIENTE {id_averia}",
                              "contacto_cliente": "04141616161", "id_pago": "7016161616",
                              "tipo_reporte": "REPARACION", "tipo_problema": "SIN_SERVICIO"},
                        headers=headers)
        assert r.status_code == 201, r.text
        return r.json()

    casos = [crear(f"TST16-D{i}") for i in range(3)]

    # D-160: primero se despachan (el universo del despacho excluye cerrados,
    # cancelados y enrutados) y después se marcan los estados "del día".
    r = client.post(f"{DESPACHOS}/procesar",
                    json={"fecha": AYER, "reemplazar": True, "asignaciones": []},
                    headers=headers)
    assert r.status_code == 201, r.text
    for caso, estado in zip(casos, ("CERRADO", "ENRUTADO", "DIFERIDO"), strict=True):
        fila = db_session.get(Caso, caso["id_caso"])
        fila.estado_actual = estado
    db_session.commit()

    # Masiva activa con cuadrilla asignada: el corte debe soltarla.
    db_session.get(Caso, casos[0]["id_caso"]).olt = "OLT-D160"
    db_session.get(Caso, casos[0]["id_caso"]).slot = "3"
    db_session.get(Caso, casos[0]["id_caso"]).puerto = "7"
    db_session.get(Caso, casos[0]["id_caso"]).fat = "FAT-D160"
    db_session.commit()
    r = client.post(MASIVAS,
                    json={"descripcion": "Masiva D160 con cuadrilla",
                          "olt": "OLT-D160", "slot": "3", "puerto": "7", "fat": "FAT-D160",
                          "direccion": "SECTOR D160 CASA 1",
                          "ids_caso": [casos[0]["id_caso"]], "id_sector": id_sector},
                    headers=headers)
    assert r.status_code == 201, r.text
    id_falla = r.json()["id_falla"]
    r = client.patch(f"{MASIVAS}/{id_falla}", json={"id_cuadrilla": id_cuadrilla},
                     headers=headers)
    assert r.status_code == 200, r.text

    yield {"headers": headers, "id_central": id_central, "id_cuadrilla": id_cuadrilla,
           "id_falla": id_falla, "casos": casos, "crear": crear}

    db_session.expire_all()


def _job_headers(monkeypatch) -> dict:
    from app.core.config import get_settings

    monkeypatch.setenv("MANTENIMIENTO_TOKEN", "tok-d160")
    get_settings.cache_clear()
    return {"X-Mantenimiento-Token": "tok-d160"}


def _llamar_job(client, monkeypatch) -> dict:
    headers = _job_headers(monkeypatch)
    try:
        r = client.post("/api/v1/mantenimiento/cierre-jornada", headers=headers)
        assert r.status_code == 200, r.text
        return r.json()
    finally:
        from app.core.config import get_settings
        get_settings.cache_clear()


def test_el_job_nocturno_devuelve_los_libres_y_suelta_las_masivas(
        client, monkeypatch, entorno, db_session):
    """R1+R2+R4: 23:00, lo no atendido vuelve a PENDIENTE y las masivas pierden cuadrilla."""
    resultado = _llamar_job(client, monkeypatch)
    assert resultado["despachos_cerrados"] >= 1
    assert resultado["casos_pendientes"] >= 1  # el DIFERIDO es el liberado
    assert resultado["masivas_desasignadas"] >= 1
    assert resultado["hora_corte"].count(":") == 1

    db_session.expire_all()
    esperados = {"TST16-D0": "CERRADO", "TST16-D1": "ENRUTADO", "TST16-D2": "PENDIENTE"}
    for caso in entorno["casos"]:
        assert db_session.get(Caso, caso["id_caso"]).estado_actual == esperados[
            caso["id_averia"]], caso["id_averia"]

    # Las asignaciones de los liberados quedaron anuladas; las filas de los
    # resueltos (CERRADO/ENRUTADO) conservan su estado (historial)
    filas = db_session.scalars(
        select(DespachoCasos).where(DespachoCasos.id_caso.in_(
            [c["id_caso"] for c in entorno["casos"]]))).all()
    por_caso = {f.id_caso: f.estado for f in filas}
    assert por_caso[entorno["casos"][2]["id_caso"]] == "DEVUELTO"
    assert por_caso[entorno["casos"][0]["id_caso"]] != "DEVUELTO"
    assert por_caso[entorno["casos"][1]["id_caso"]] != "DEVUELTO"

    falla = db_session.get(FallaMasiva, entorno["id_falla"])
    assert falla.id_cuadrilla is None
    assert falla.estado in ("DETECTADA", "PLANIFICADA")  # sigue activa, sin cuadrilla

    despacho = db_session.scalar(
        select(Despacho).where(Despacho.id_despacho == filas[0].id_despacho))
    assert despacho.estado == "CERRADO" and despacho.cierre_auto is True


def test_el_job_es_idempotente(client, monkeypatch, entorno, db_session):
    """Un segundo disparo (o un job reprogramado) no repite el efecto."""
    _llamar_job(client, monkeypatch)
    segunda = _llamar_job(client, monkeypatch)
    assert segunda["despachos_cerrados"] == 0
    assert segunda["masivas_desasignadas"] == 0
    db_session.expire_all()
    assert db_session.get(Caso, entorno["casos"][2]["id_caso"]).estado_actual == "PENDIENTE"


def test_los_citados_conservan_la_fecha_de_su_cita(client, monkeypatch, entorno,
                                                   db_session):
    """R2 (aclaración): un CITADO vuelve a PENDIENTE sin perder `caso.fecha_cita`.

    El despacho del día siguiente la vuelve a detectar como cita con prioridad
    (`es_cita`), y la cita no se reagenda ni se borra en el corte.
    """
    citado = entorno["crear"]("TST16-CITA")
    r = client.post(f"{DESPACHOS}/procesar",
                    json={"fecha": AYER, "reemplazar": True, "asignaciones": []},
                    headers=entorno["headers"])
    assert r.status_code == 201, r.text
    # El técnico lo citó para el día siguiente al corte: la cita queda futura.
    manana = hoy_operativo() + timedelta(days=1)
    fila = db_session.get(Caso, citado["id_caso"])
    fila.estado_actual = "CITADO"
    fila.fecha_cita = datetime(manana.year, manana.month, manana.day, 8, 0)
    db_session.commit()

    resultado = _llamar_job(client, monkeypatch)
    assert resultado["despachos_cerrados"] >= 1

    db_session.expire_all()
    caso = db_session.get(Caso, citado["id_caso"])
    assert caso.estado_actual == "PENDIENTE"
    assert caso.fecha_cita is not None
    assert caso.fecha_cita.date() == manana, "la fecha de la cita se perdió"


def test_cortar_sin_job_resuelve_las_masivas_de_la_central(entorno, db_session):
    """La desasignación de masivas acompaña al servicio, filtrada por central."""
    svc_jornada.cerrar_jornada(db_session, id_central=entorno["id_central"],
                               solo_vencidos=True)
    db_session.expire_all()
    assert db_session.get(FallaMasiva,
                          entorno["id_falla"]).id_cuadrilla is None


def test_el_endpoint_manual_solo_acepta_supervisor_o_super(client, admin_token):
    """R5: el ADMIN y el Técnico quedan fuera del corte manual (D-160)."""
    for headers, esperado in (
        (admin_token["admin"], 403),
        (admin_token["tecnico"], 403),
        (admin_token["supervisor"], 200),
        (admin_token["super"], 200),
    ):
        r = client.post(f"{DESPACHOS}/cierre-jornada?solo_vencidos=true", headers=headers)
        assert r.status_code == esperado, (r.status_code, esperado, r.text)


def test_el_cierre_perezoso_ya_no_atiende_el_admin(client, admin_token, db_session):
    """R5: `quizas_cerrar` ignora a un usuario ADMIN (D-160)."""

    class UsuarioAux:
        rol = type("R", (), {"codigo": "ADMIN"})()
        id_central = admin_token["id_central"]
        p00 = "TEST-ADMIN"

    assert svc_jornada.quizas_cerrar(db_session, UsuarioAux()) is None
