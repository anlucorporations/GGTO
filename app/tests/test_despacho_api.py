"""Pruebas de integración del Ciclo 5: DESPACHO."""

from __future__ import annotations

from datetime import date

import pytest
from sqlalchemy import select

from app.models import Caso, Cuadrilla

BASE = "/api/v1/despachos"
HOY = date.today().isoformat()


@pytest.fixture()
def entorno(client, admin_token):
    """Dos sectores, dos cuadrillas y un universo de casos variado."""
    headers = admin_token["admin"]
    id_central = admin_token["id_central"]

    for nombre, codigo, patron in (("Alfa", "TSA", "SECTOR ALFA"), ("Beta", "TSB", "SECTOR BETA")):
        r = client.post("/api/v1/sectores",
                        json={"id_central": id_central, "nombre": nombre, "codigo": codigo,
                              "direcciones": [{"patron": patron}]},
                        headers=headers)
        assert r.status_code == 201, r.text

    for codigo, nombre in (("TCD1", "Cuadrilla 1"), ("TCD2", "Cuadrilla 2")):
        r = client.post("/api/v1/cuadrillas",
                        json={"id_central": id_central, "codigo": codigo, "nombre": nombre},
                        headers=headers)
        assert r.status_code == 201, r.text

    def crear(id_averia, direccion, **extra):
        cuerpo = {"id_averia": id_averia, "direccion": direccion,
                  "nombre_cliente": f"CLIENTE {id_averia}", "telefono": "7000000000"}
        cuerpo.update(extra)
        r = client.post("/api/v1/casos", json=cuerpo, headers=headers)
        assert r.status_code == 201, r.text
        return r.json()

    # 4 casos en Alfa y 2 en Beta (reparaciones residenciales)
    for i in range(4):
        crear(f"TSTD-A{i}", f"SECTOR ALFA CASA {i}")
    for i in range(2):
        crear(f"TSTD-B{i}", f"SECTOR BETA CASA {i}")
    # Reglas del brief: 2 referidos, 1 empresa y 1 construcción
    crear("TSTD-R0", "SECTOR BETA CALLE 1", categoria="REFERIDO")
    crear("TSTD-R1", "SECTOR BETA CALLE 2", categoria="REFERIDO")
    crear("TSTD-E0", "SECTOR ALFA AV 3", categoria="EMPRESA")
    crear("TSTD-C0", "SECTOR ALFA TORRE 1", tipo_caso="CONSTRUCCION", categoria="EMPRESA")

    yield {"headers": headers, "id_central": id_central}


def _propuesta(client, entorno, fecha=HOY):
    r = client.post(f"{BASE}/propuesta", params={"fecha": fecha}, headers=entorno["headers"])
    assert r.status_code == 200, r.text
    return r.json()


# --------------------------------------------------------------------------- #
# Propuesta
# --------------------------------------------------------------------------- #
def test_sin_token(client):
    assert client.post(f"{BASE}/propuesta").status_code == 401


def test_tecnico_no_puede_generar(client, admin_token):
    r = client.post(f"{BASE}/propuesta", headers=admin_token["tecnico"])
    assert r.status_code == 403


def test_propuesta_reparte_por_sector(client, entorno):
    p = _propuesta(client, entorno)
    assert p["resumen"]["total_casos"] == 10
    assert p["resumen"]["asignados"] == 10
    assert len(p["grupos"]) == 2

    # Todos los casos quedan asignados exactamente una vez
    ids = [c["id_caso"] for g in p["grupos"] for c in g["casos"]]
    assert len(ids) == len(set(ids)) == 10

    # Reglas del brief
    assert p["reglas"]["referidos_asignados"] >= 2
    assert p["reglas"]["empresas_asignadas"] >= 1
    assert p["reglas"]["construccion_en_una_sola"] is True
    assert p["reglas"]["construccion_cuadrilla"] is not None


def test_construccion_en_una_sola_cuadrilla(client, entorno):
    p = _propuesta(client, entorno)
    con_construccion = [g["codigo"] for g in p["grupos"]
                        if any(c["tipo_asignacion"] == "CONSTRUCCION" for c in g["casos"])]
    assert len(con_construccion) == 1


def test_orden_de_visita_por_cuadrilla(client, entorno):
    p = _propuesta(client, entorno)
    for grupo in p["grupos"]:
        assert [c["orden_visita"] for c in grupo["casos"]] == list(range(1, grupo["total"] + 1))


def test_excluye_cuadrilla_0(client, entorno, db_session):
    caso = db_session.scalar(select(Caso).where(Caso.id_averia == "TSTD-A0"))
    caso.en_gestion_supervisor = True
    db_session.commit()

    p = _propuesta(client, entorno)
    ids = [c["id_averia"] for g in p["grupos"] for c in g["casos"]]
    assert "TSTD-A0" not in ids
    assert p["resumen"]["total_casos"] == 9


def test_excluye_casos_cerrados(client, entorno, db_session):
    caso = db_session.scalar(select(Caso).where(Caso.id_averia == "TSTD-B0"))
    caso.estado_actual = "CERRADO"
    db_session.commit()
    assert _propuesta(client, entorno)["resumen"]["total_casos"] == 9


def test_incluye_citados_del_dia_aunque_sean_cuadrilla_0(client, entorno, db_session):
    from datetime import datetime

    caso = db_session.scalar(select(Caso).where(Caso.id_averia == "TSTD-A1"))
    caso.en_gestion_supervisor = True
    caso.fecha_cita = datetime.fromisoformat(f"{HOY}T10:00:00")
    db_session.commit()

    p = _propuesta(client, entorno)
    asignados = {c["id_averia"]: c for g in p["grupos"] for c in g["casos"]}
    assert "TSTD-A1" in asignados
    assert asignados["TSTD-A1"]["es_cita"] is True


def test_propuesta_sin_cuadrillas(client, admin_token, db_session):
    for cu in db_session.scalars(select(Cuadrilla)).all():
        if not cu.es_supervisor:
            db_session.delete(cu)
    db_session.commit()

    r = client.post(f"{BASE}/propuesta", params={"fecha": HOY}, headers=admin_token["admin"])
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["grupos"] == []
    assert cuerpo["reglas"]["cuadrillas_activas"] == 0


# --------------------------------------------------------------------------- #
# Generación y edición
# --------------------------------------------------------------------------- #
def test_generar_persiste_y_no_duplica(client, entorno):
    r = client.post(BASE, params={"fecha": HOY}, headers=entorno["headers"])
    assert r.status_code == 201, r.text
    despachos = r.json()
    assert len(despachos) == 2

    # Segunda generación sin reemplazar → 409
    assert client.post(BASE, params={"fecha": HOY},
                       headers=entorno["headers"]).status_code == 409

    # Con reemplazar=true vuelve a generarse
    r2 = client.post(BASE, params={"fecha": HOY, "reemplazar": "true"}, headers=entorno["headers"])
    assert r2.status_code == 201
    assert len(r2.json()) == 2

    # Los casos ya despachados no vuelven a la propuesta
    p = _propuesta(client, entorno)
    assert p["resumen"]["total_casos"] == 0


def test_detalle_agregar_y_quitar_caso(client, entorno, db_session):
    despachos = client.post(BASE, params={"fecha": HOY}, headers=entorno["headers"]).json()
    id_despacho = despachos[0]["id_despacho"]

    detalle = client.get(f"{BASE}/{id_despacho}", headers=entorno["headers"]).json()
    assert detalle["cuadrilla_codigo"].startswith("TCD")
    assert len(detalle["casos"]) > 0

    # Quitar el primer caso
    id_caso = detalle["casos"][0]["id_caso"]
    quitado = client.delete(f"{BASE}/{id_despacho}/casos/{id_caso}", headers=entorno["headers"])
    assert quitado.status_code == 200
    assert all(c["id_caso"] != id_caso for c in quitado.json()["casos"])

    # Volver a agregarlo
    agregado = client.post(f"{BASE}/{id_despacho}/casos", json={"id_caso": id_caso},
                           headers=entorno["headers"])
    assert agregado.status_code == 200
    assert any(c["id_caso"] == id_caso for c in agregado.json()["casos"])

    # Duplicarlo → 409
    assert client.post(f"{BASE}/{id_despacho}/casos", json={"id_caso": id_caso},
                       headers=entorno["headers"]).status_code == 409

    # Cambiar el estado del caso en el despacho
    r = client.patch(f"{BASE}/{id_despacho}/casos/{id_caso}", json={"estado": "GESTIONADO"},
                     headers=entorno["headers"])
    assert r.status_code == 200


def test_publicar_despacho(client, entorno):
    despachos = client.post(BASE, params={"fecha": HOY}, headers=entorno["headers"]).json()
    id_despacho = despachos[0]["id_despacho"]
    r = client.patch(f"{BASE}/{id_despacho}", json={"estado": "PUBLICADO"},
                     headers=entorno["headers"])
    assert r.status_code == 200
    assert r.json()["estado"] == "PUBLICADO"
    assert r.json()["enviado_en"] is not None


def test_no_agrega_caso_de_cuadrilla_0(client, entorno, db_session):
    despachos = client.post(BASE, params={"fecha": HOY}, headers=entorno["headers"]).json()
    id_despacho = despachos[0]["id_despacho"]
    caso = db_session.scalar(select(Caso).where(Caso.id_averia == "TSTD-C0"))
    caso.en_gestion_supervisor = True
    db_session.commit()

    r = client.post(f"{BASE}/{id_despacho}/casos", json={"id_caso": caso.id_caso},
                    headers=entorno["headers"])
    assert r.status_code == 409


# --------------------------------------------------------------------------- #
# Impresión, reporte y envío
# --------------------------------------------------------------------------- #
def test_imprimible_es_html_carta(client, entorno):
    despachos = client.post(BASE, params={"fecha": HOY}, headers=entorno["headers"]).json()
    r = client.get(f"{BASE}/{despachos[0]['id_despacho']}/imprimible",
                   headers=entorno["headers"])
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/html")
    assert "size: letter" in r.text
    assert "Despacho de cuadrilla" in r.text
    assert "ID avería" in r.text


def test_reporte_produccion(client, entorno):
    despachos = client.post(BASE, params={"fecha": HOY}, headers=entorno["headers"]).json()
    id_despacho = despachos[0]["id_despacho"]

    r = client.get(f"{BASE}/{id_despacho}/reporte", headers=entorno["headers"])
    assert r.status_code == 200
    assert r.json()["totales"]["asignados"] > 0

    global_ = client.get(f"{BASE}/reporte/produccion", params={"fecha": HOY},
                         headers=entorno["headers"])
    assert global_.status_code == 200
    assert global_.json()["totales"]["asignados"] >= r.json()["totales"]["asignados"]


def test_envio_queda_pendiente_sin_credenciales(client, entorno):
    despachos = client.post(BASE, params={"fecha": HOY}, headers=entorno["headers"]).json()
    id_despacho = despachos[0]["id_despacho"]
    r = client.post(f"{BASE}/{id_despacho}/enviar",
                    params={"canal": "TELEGRAM", "destinatario": "-1001234567890"},
                    headers=entorno["headers"])
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["canal"] == "TELEGRAM"
    # Sin token de Telegram configurado la notificación no se pierde: queda PENDIENTE
    assert cuerpo["estado"] == "PENDIENTE"
    assert "TELEGRAM_BOT_TOKEN" in (cuerpo["error"] or "")

    notifs = client.get(f"{BASE}/{id_despacho}/notificaciones", headers=entorno["headers"])
    assert notifs.status_code == 200
    assert len(notifs.json()) == 1


# --------------------------------------------------------------------------- #
# Fallas masivas
# --------------------------------------------------------------------------- #
def test_fallas_masivas(client, entorno):
    r = client.post(f"{BASE}/fallas-masivas", json={"descripcion": "Corte de fibra sector Alfa"},
                    headers=entorno["headers"])
    assert r.status_code == 201, r.text
    assert r.json()["estado"] == "DETECTADA"

    listado = client.get(f"{BASE}/fallas-masivas", headers=entorno["headers"])
    assert listado.status_code == 200
    assert len(listado.json()) == 1
    assert listado.json()[0]["descripcion"].startswith("Corte de fibra")
