"""D-128 · La evidencia nace ligada a su caso y solo la sube quien puede (H-11).

Defecto (auditoría V3): `/evidencias/upload` no guardaba a qué caso pertenecía la
foto ni validaba al usuario; quedaban evidencias huérfanas hasta que llegaba la
actividad de la CARGA, se podía subir contra un caso ajeno y la purga local podía
borrar la referencia.
"""

from __future__ import annotations

import io

import pytest
from sqlalchemy import select

from app.models import Evidencia
from app.tests.conftest import asignar_caso_al_tecnico

CASOS = "/api/v1/casos"
UPLOAD = "/api/v1/evidencias/upload"
JPG = b"\xff\xd8\xff\xe0" + b"0" * 64


def _caso(client, headers, id_averia: str, pago: str) -> int:
    r = client.post(
        CASOS,
        json={
            "id_averia": id_averia,
            "direccion": "SECTOR D128 CASA 1",
            "nombre_cliente": f"CLIENTE {id_averia}",
            "contacto_cliente": "04147778899",
            "id_pago": pago,
            "tipo_reporte": "REPARACION",
            "tipo_problema": "SIN_SERVICIO",
        },
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()["id_caso"]


def _subir(client, headers, id_caso: int, serial: str):
    return client.post(
        UPLOAD,
        files={"file": ("foto.jpg", io.BytesIO(JPG), "image/jpeg")},
        data={"id_caso": str(id_caso), "tipo": "DEMO", "serial_local": serial},
        headers=headers,
    )


@pytest.fixture()
def entorno(client, admin_token, db_session, tmp_path, monkeypatch):
    monkeypatch.setenv("GGTO_EVIDENCIAS_DIR", str(tmp_path))
    propio = _caso(client, admin_token["admin"], "TSTD128-1", "7014002821")
    ajeno = _caso(client, admin_token["admin"], "TSTD128-2", "7014002822")
    asignar_caso_al_tecnico(db_session, admin_token, propio)
    return {
        "headers": admin_token["tecnico"],
        "admin": admin_token["admin"],
        "propio": propio,
        "ajeno": ajeno,
    }


def test_la_evidencia_guarda_su_caso(client, entorno, db_session):
    r = _subir(client, entorno["headers"], entorno["propio"], "TSTD128-A")
    assert r.status_code == 200, r.text

    db_session.expire_all()
    evidencia = db_session.scalar(
        select(Evidencia).where(Evidencia.serial_imagen == "TSTD128-A")
    )
    assert evidencia is not None
    assert evidencia.id_caso == entorno["propio"], "la foto nació sin su caso"
    assert evidencia.id_actividad is None, "la actividad llega después, con la CARGA"


def test_subir_contra_un_caso_ajeno_se_rechaza(client, entorno, db_session):
    r = _subir(client, entorno["headers"], entorno["ajeno"], "TSTD128-B")
    assert r.status_code == 403, r.text
    assert "cuadrilla" in r.text.lower()

    db_session.expire_all()
    assert db_session.scalar(
        select(Evidencia).where(Evidencia.serial_imagen == "TSTD128-B")
    ) is None, "no debe quedar la fila de una subida rechazada"


def test_un_gestor_sube_contra_cualquier_caso(client, entorno, db_session):
    r = _subir(client, entorno["admin"], entorno["ajeno"], "TSTD128-C")
    assert r.status_code == 200, r.text
    db_session.expire_all()
    evidencia = db_session.scalar(
        select(Evidencia).where(Evidencia.serial_imagen == "TSTD128-C")
    )
    assert evidencia is not None and evidencia.id_caso == entorno["ajeno"]


def test_las_evidencias_de_falla_masiva_siguen_sin_caso(client, entorno, db_session):
    """El reporte de campo usa `id_caso = 0` (`FM-…`): se acepta sin vínculo."""
    r = _subir(client, entorno["headers"], 0, "TSTD128-FM")
    assert r.status_code == 200, r.text
    db_session.expire_all()
    evidencia = db_session.scalar(
        select(Evidencia).where(Evidencia.serial_imagen == "TSTD128-FM")
    )
    assert evidencia is not None
    assert evidencia.id_caso is None


def test_la_subida_es_idempotente_por_serial(client, entorno, db_session):
    primera = _subir(client, entorno["headers"], entorno["propio"], "TSTD128-D")
    segunda = _subir(client, entorno["headers"], entorno["propio"], "TSTD128-D")
    assert primera.status_code == 200 and segunda.status_code == 200
    assert primera.json()["id_evidencia"] == segunda.json()["id_evidencia"]
