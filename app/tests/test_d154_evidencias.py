"""D-154 · Almacenamiento durable y acceso acotado a las evidencias (H-05).

Defecto (auditoría V2): la revisión desplegada no tenía `GGTO_GCS_BUCKET` ni
credenciales, así que las fotos caían en el disco efímero del contenedor; la
subida nunca fallaba, la ruta `/evidencias-locales/...` devolvía el HTML de la
SPA y el `id_caso` se aceptaba aunque no existiera (evidencias huérfanas).

Esta suite fija el contrato nuevo:

- sin bucket en producción la subida responde **503** (la APK reintenta);
- con bucket, el objeto va a GCS y la ruta es `gcs://...`;
- los bytes se validan por **firma real**, no por `Content-Type`;
- un `id_caso` positivo inexistente responde **404**;
- hay cuota diaria por caso;
- la descarga usa el Bearer o la URL firmada de 15 minutos y respeta el
  alcance del caso (un técnico de otra cuadrilla recibe **404**).
"""

from __future__ import annotations

import io

import pytest
from sqlalchemy import select

from app.models import Configuracion, Evidencia
from app.services import storage
from app.tests.conftest import asignar_caso_al_tecnico

CASOS = "/api/v1/casos"
UPLOAD = "/api/v1/evidencias/upload"
EVID = "/api/v1/evidencias"
JPG = b"\xff\xd8\xff\xe0" + b"0" * 64
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 64


def _caso(client, headers, id_averia: str, pago: str) -> int:
    r = client.post(
        CASOS,
        json={
            "id_averia": id_averia,
            "direccion": "SECTOR D154 CASA 1",
            "nombre_cliente": f"CLIENTE {id_averia}",
            "contacto_cliente": "04146667788",
            "id_pago": pago,
            "tipo_reporte": "REPARACION",
            "tipo_problema": "SIN_SERVICIO",
        },
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()["id_caso"]


def _subir(client, headers, id_caso: int, serial: str, contenido: bytes = JPG):
    return client.post(
        UPLOAD,
        files={"file": ("foto.jpg", io.BytesIO(contenido), "image/jpeg")},
        data={"id_caso": str(id_caso), "tipo": "DEMO", "serial_local": serial},
        headers=headers,
    )


@pytest.fixture()
def entorno(client, admin_token, db_session, tmp_path, monkeypatch):
    monkeypatch.setenv("GGTO_EVIDENCIAS_DIR", str(tmp_path))
    monkeypatch.delenv("GGTO_GCS_BUCKET", raising=False)
    monkeypatch.setenv("APP_ENV", "development")
    propio = _caso(client, admin_token["admin"], "TSTD154-1", "7015002821")
    ajeno = _caso(client, admin_token["admin"], "TSTD154-2", "7015002822")
    asignar_caso_al_tecnico(db_session, admin_token, propio)
    return {
        "headers": admin_token["tecnico"],
        "admin": admin_token["admin"],
        "propio": propio,
        "ajeno": ajeno,
    }


# --------------------------------------------------------------------------- #
# Unidad: detección de imagen y modo de almacenamiento
# --------------------------------------------------------------------------- #
def test_detecta_el_tipo_real_por_bytes_magicos():
    assert storage.detectar_tipo_imagen(JPG) == "image/jpeg"
    assert storage.detectar_tipo_imagen(PNG) == "image/png"
    assert storage.detectar_tipo_imagen(b"RIFF" + b"0" * 4 + b"WEBP" + b"0" * 8) == "image/webp"
    assert storage.detectar_tipo_imagen(b"<html>no es una foto</html>") is None


def test_modo_de_almacenamiento(monkeypatch):
    monkeypatch.delenv("GGTO_GCS_BUCKET", raising=False)
    monkeypatch.setenv("APP_ENV", "development")
    assert storage.modo_almacenamiento() == "local"

    monkeypatch.setenv("APP_ENV", "production")
    assert storage.modo_almacenamiento() == "no_configurado"

    monkeypatch.setenv("GGTO_GCS_BUCKET", "bucket-d154")
    assert storage.modo_almacenamiento() == "gcs"


# --------------------------------------------------------------------------- #
# Subida
# --------------------------------------------------------------------------- #
def test_sin_bucket_en_produccion_falla_cerrado(client, entorno, db_session, monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    r = _subir(client, entorno["headers"], entorno["propio"], "TSTD154-PROD")
    assert r.status_code == 503, r.text
    assert "reintent" in r.text.lower()

    db_session.expire_all()
    assert (
        db_session.scalar(select(Evidencia).where(Evidencia.serial_imagen == "TSTD154-PROD"))
        is None
    ), "una subida fallida no debe dejar la fila"


def test_con_bucket_sube_a_gcs(client, entorno, monkeypatch):
    monkeypatch.setenv("GGTO_GCS_BUCKET", "bucket-d154")
    monkeypatch.setattr(storage, "_token_gcs", lambda: "token-falso")
    llamadas: dict[str, object] = {}

    class Respuesta:
        status_code = 200

    def falso_post(url, **kwargs):
        llamadas["url"] = url
        llamadas["params"] = kwargs.get("params")
        return Respuesta()

    monkeypatch.setattr(storage.httpx, "post", falso_post)

    r = _subir(client, entorno["headers"], entorno["propio"], "TSTD154-GCS")
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert cuerpo["ruta_remota"].startswith("gcs://bucket-d154/evidencias/")
    assert llamadas["params"]["uploadType"] == "media"
    assert llamadas["params"]["name"] in cuerpo["ruta_remota"]
    assert "/api/v1/evidencias/" in cuerpo["url_firmada"]


def test_rechaza_bytes_que_no_son_imagen(client, entorno):
    r = _subir(
        client, entorno["headers"], entorno["propio"], "TSTD154-FALSA", b"no soy una foto"
    )
    assert r.status_code == 422, r.text
    assert "imagen" in r.text.lower()


def test_un_caso_inexistente_no_deja_evidencia_huerfana(client, entorno, db_session):
    r = _subir(client, entorno["headers"], 99999999, "TSTD154-HUERFANA")
    assert r.status_code == 404, r.text
    db_session.expire_all()
    assert (
        db_session.scalar(
            select(Evidencia).where(Evidencia.serial_imagen == "TSTD154-HUERFANA")
        )
        is None
    )


def test_no_se_puede_secuestrar_un_serial_ajeno(client, entorno):
    ajena = _subir(client, entorno["admin"], entorno["ajeno"], "TSTD154-SERIAL")
    assert ajena.status_code == 200, ajena.text

    r = _subir(client, entorno["headers"], entorno["propio"], "TSTD154-SERIAL")
    assert r.status_code == 409, r.text


def test_cuota_diaria_por_caso(client, entorno, db_session):
    config = db_session.scalar(
        select(Configuracion).where(Configuracion.clave == "evidencia.max_por_caso_dia")
    )
    assert config is not None
    config.valor = 2
    db_session.commit()

    assert _subir(client, entorno["headers"], entorno["propio"], "TSTD154-Q1").status_code == 200
    assert _subir(client, entorno["headers"], entorno["propio"], "TSTD154-Q2").status_code == 200
    tercera = _subir(client, entorno["headers"], entorno["propio"], "TSTD154-Q3")
    assert tercera.status_code == 429, tercera.text
    assert "límite" in tercera.text.lower() or "limite" in tercera.text.lower()

    # El reintento del mismo serial no consume cuota ni se bloquea.
    repetida = _subir(client, entorno["headers"], entorno["propio"], "TSTD154-Q1")
    assert repetida.status_code == 200, repetida.text


# --------------------------------------------------------------------------- #
# Descarga acotada
# --------------------------------------------------------------------------- #
def test_descarga_con_la_url_firmada(client, entorno):
    subida = _subir(client, entorno["headers"], entorno["propio"], "TSTD154-FIRMA")
    assert subida.status_code == 200, subida.text
    url = subida.json()["url_firmada"]
    assert url.startswith(f"/api/v1/evidencias/{subida.json()['id_evidencia']}?token=")

    descarga = client.get(url)  # sin cabecera Authorization
    assert descarga.status_code == 200, descarga.text
    assert descarga.headers["content-type"].startswith("image/jpeg")
    assert descarga.content == JPG


def test_la_url_firmada_solo_sirve_para_su_evidencia(client, entorno):
    una = _subir(client, entorno["headers"], entorno["propio"], "TSTD154-UNO").json()
    otra = _subir(client, entorno["headers"], entorno["propio"], "TSTD154-DOS").json()
    token = una["url_firmada"].split("token=", 1)[1]

    r = client.get(f"{EVID}/{otra['id_evidencia']}", params={"token": token})
    assert r.status_code == 401, r.text


def test_un_tecnico_no_ve_la_evidencia_de_un_caso_ajeno(client, entorno):
    subida = _subir(client, entorno["admin"], entorno["ajeno"], "TSTD154-AJENA")
    assert subida.status_code == 200, subida.text

    r = client.get(f"{EVID}/{subida.json()['id_evidencia']}", headers=entorno["headers"])
    assert r.status_code == 404, r.text


def test_la_evidencia_sin_caso_solo_la_abren_las_jefaturas(client, entorno):
    subida = _subir(client, entorno["headers"], 0, "TSTD154-FM")
    assert subida.status_code == 200, subida.text
    id_evidencia = subida.json()["id_evidencia"]

    assert client.get(f"{EVID}/{id_evidencia}", headers=entorno["headers"]).status_code == 404
    assert client.get(f"{EVID}/{id_evidencia}", headers=entorno["admin"]).status_code == 200


def test_descarga_sin_credenciales_es_401(client, entorno):
    subida = _subir(client, entorno["headers"], entorno["propio"], "TSTD154-SINCRED").json()
    r = client.get(f"{EVID}/{subida['id_evidencia']}")
    assert r.status_code in (401, 403), r.text
