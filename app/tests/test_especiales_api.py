"""Pruebas de integración del Ciclo 6: seguimiento, casos especiales y agenda."""

from __future__ import annotations

from datetime import datetime, timedelta

import pytest
from sqlalchemy import select

from app.models import Auditoria, Caso, Notificacion

CITAS = "/api/v1/citas"
ESPECIALES = "/api/v1/casos-especiales"
SEGUIMIENTO = "/api/v1/seguimiento"


@pytest.fixture()
def entorno(client, admin_token):
    headers = admin_token["admin"]
    id_central = admin_token["id_central"]

    r = client.post("/api/v1/sectores",
                    json={"id_central": id_central, "nombre": "Alfa", "codigo": "TSA",
                          "direcciones": [{"patron": "SECTOR ALFA"}]}, headers=headers)
    assert r.status_code == 201, r.text

    cuadrilla = client.post("/api/v1/cuadrillas",
                            json={"id_central": id_central, "codigo": "TCE1", "nombre": "Cuadrilla E"},
                            headers=headers)
    assert cuadrilla.status_code == 201, cuadrilla.text

    caso = client.post("/api/v1/casos",
                       json={"id_averia": "TSTE-1", "direccion": "SECTOR ALFA CASA 1",
                             "nombre_cliente": "CLIENTE E",
                             "contacto_cliente": "04141112233",
                             "id_pago": "7014000800",
                             "tipo_reporte": "REPARACION",
                             "tipo_problema": "SIN_SERVICIO"}, headers=headers)
    assert caso.status_code == 201, caso.text

    yield {"headers": headers, "id_central": id_central,
           "id_cuadrilla": cuadrilla.json()["id_cuadrilla"], "id_caso": caso.json()["id_caso"]}


def _cita(entorno, **extra):
    cuerpo = {"fecha_hora": datetime.now().replace(microsecond=0).isoformat(),
              "id_caso": entorno["id_caso"], "id_cuadrilla": entorno["id_cuadrilla"]}
    cuerpo.update(extra)
    return cuerpo


# --------------------------------------------------------------------------- #
# Casos especiales (RF-35, RF-36)
# --------------------------------------------------------------------------- #
def test_ingresar_empresa_crea_caso_y_solicitante(client, entorno):
    r = client.post(ESPECIALES, json={
        "clasificacion": "EMPRESA", "tipo_actividad": "CONSTRUCCION", "prioridad": "ALTA",
        "descripcion": "Punto óptico solicitado por Unidad de Empresas",
        "crear_solicitante": {"unidad": "Unidad de Empresas", "nombre": "ANA PEREZ",
                              "contacto": "7001234567", "canal": "TELEGRAM"},
        "direccion": "SECTOR ALFA TORRE 2", "nombre_cliente": "EMPRESA DEMO CA",
        "contacto_cliente": "04142223344", "telefono": "7014000801",
        "tipo_problema": "PUNTO_OPTICO",
    }, headers=entorno["headers"])
    assert r.status_code == 201, r.text
    cuerpo = r.json()
    assert cuerpo["clasificacion"] == "EMPRESA"
    assert cuerpo["tipo_actividad"] == "CONSTRUCCION"
    assert cuerpo["prioridad"] == "ALTA"
    assert cuerpo["id_solicitante"] is not None
    assert cuerpo["id_caso"] is not None
    # RN-AL-01: los datos del alta y del solicitante quedan registrados.
    assert cuerpo["contacto_cliente"] == "4142223344"
    assert cuerpo["telefono"] == "7014000801"
    assert cuerpo["tipo_problema"] == "PUNTO_OPTICO"
    assert cuerpo["solicitante_nombre"] == "ANA PEREZ"
    # D-90: el id de avería sintético `REF-…` **no** cuenta como avería real.
    assert cuerpo["tiene_id_averia"] is False


def test_el_alta_especial_exige_los_datos_obligatorios(client, entorno):
    """RN-AL-01: sin los datos del alta (y del solicitante) el alta da 422."""
    r = client.post(ESPECIALES, json={
        "clasificacion": "REFERIDO", "tipo_actividad": "REPARACION",
    }, headers=entorno["headers"])
    assert r.status_code == 422, r.text

    # Falta el teléfono con el identificador de pago (70*).
    r = client.post(ESPECIALES, json={
        "clasificacion": "REFERIDO", "tipo_actividad": "CONSTRUCCION",
        "nombre_cliente": "CLIENTE", "contacto_cliente": "04142223344",
        "direccion": "SECTOR ALFA CASA 3",
        "crear_solicitante": {"unidad": "Masivos", "nombre": "LUIS",
                              "contacto": "04142223344"},
    }, headers=entorno["headers"])
    assert r.status_code == 422, r.text

    # Una REPARACIÓN sin id de avería ni tipo de problema tampoco entra.
    r = client.post(ESPECIALES, json={
        "clasificacion": "REFERIDO", "tipo_actividad": "REPARACION",
        "nombre_cliente": "CLIENTE", "contacto_cliente": "04142223344",
        "direccion": "SECTOR ALFA CASA 3", "telefono": "7014000802",
        "crear_solicitante": {"unidad": "Masivos", "nombre": "LUIS",
                              "contacto": "04142223344"},
    }, headers=entorno["headers"])
    assert r.status_code == 422, r.text

    # Sin datos del solicitante tampoco.
    r = client.post(ESPECIALES, json={
        "clasificacion": "REFERIDO", "tipo_actividad": "CONSTRUCCION",
        "nombre_cliente": "CLIENTE", "contacto_cliente": "04142223344",
        "direccion": "SECTOR ALFA CASA 3", "telefono": "7014000803",
    }, headers=entorno["headers"])
    assert r.status_code == 422, r.text


def test_ingresar_referido_sin_id_averia(client, entorno):
    r = client.post(ESPECIALES, json={
        "clasificacion": "REFERIDO", "tipo_actividad": "REPARACION", "prioridad": "MEDIA",
        "descripcion": "Referido de otra área sin incidencia",
        "crear_solicitante": {"unidad": "Masivos", "nombre": "LUIS", "contacto": "7009998888"},
        "nombre_cliente": "CLIENTE REFERIDO", "contacto_cliente": "04143334455",
        "telefono": "7014000804", "direccion": "SECTOR ALFA CASA 4",
        "id_averia": "REF-2324X-900010", "tipo_problema": "SIN_SERVICIO",
    }, headers=entorno["headers"])
    assert r.status_code == 201, r.text
    cuerpo = r.json()
    # D-90: el `REF-…` informado es sintético y **no** cuenta como avería real.
    assert cuerpo["tiene_id_averia"] is False

    asociado = client.get(f"/api/v1/casos/{cuerpo['id_caso']}", headers=entorno["headers"]).json()
    assert asociado["id_averia"].startswith("REF-2324X-")
    assert asociado["categoria"] == "REFERIDO"


def test_filtros_y_actualizacion_de_especiales(client, entorno):
    creados = []
    for i, (clas, prio) in enumerate((("EMPRESA", "ALTA"), ("REFERIDO", "BAJA"), ("EMPRESA", "MEDIA"))):
        # D-90: la ficha del especial es **una por caso** (idempotente), así que
        # cada especial necesita su propio caso asociado.
        caso = client.post("/api/v1/casos",
                           json={"id_averia": f"TSTE-F{i}",
                                 "direccion": "SECTOR ALFA CASA 1",
                                 "nombre_cliente": f"CLIENTE E{i}",
                                 "contacto_cliente": "04141112233",
                                 "id_pago": f"70140009{i:02d}",
                                 "tipo_reporte": "CONSTRUCCION"},
                           headers=entorno["headers"]).json()
        r = client.post(ESPECIALES, json={
            "clasificacion": clas, "tipo_actividad": "REPARACION", "prioridad": prio,
            "descripcion": f"caso {i}", "id_caso": caso["id_caso"],
            "crear_solicitante": {"unidad": "Masivos", "nombre": f"SOL {i}",
                                  "contacto": "04141112233"},
        }, headers=entorno["headers"])
        assert r.status_code == 201, r.text
        creados.append(r.json()["id_caso_especial"])

    empresas = client.get(ESPECIALES, params={"clasificacion": "EMPRESA"},
                          headers=entorno["headers"]).json()
    assert len(empresas) == 2

    altas = client.get(ESPECIALES, params={"prioridad": "ALTA"},
                       headers=entorno["headers"]).json()
    assert len(altas) == 1

    # D-133: cerrar un especial que requiere informe exige el informe (H-16).
    r = client.patch(f"{ESPECIALES}/{creados[0]}", json={"estado": "ATENDIDO"},
                     headers=entorno["headers"])
    assert r.status_code == 422
    r = client.patch(
        f"{ESPECIALES}/{creados[0]}",
        json={
            "estado": "ATENDIDO",
            "informe": "Se atendió el referido y se verificó el servicio (D-133).",
        },
        headers=entorno["headers"],
    )
    assert r.status_code == 200
    assert r.json()["estado"] == "ATENDIDO"

    pendientes = client.get(ESPECIALES, params={"solo_pendientes": True},
                            headers=entorno["headers"]).json()
    assert all(e["estado"] in ("ABIERTO", "EN_PROCESO") for e in pendientes)


def test_cerrar_especial_avisa_al_solicitante_manual(client, entorno, db_session):
    """ACT-03/D-156: el cierre deja el aviso en el outbox sin abrir un portal."""
    r = client.post(ESPECIALES, json={
        "clasificacion": "REFERIDO", "tipo_actividad": "REPARACION",
        "descripcion": "Referido con solicitante externo manual",
        "id_caso": entorno["id_caso"],
        "crear_solicitante": {
            "unidad": "Unidad Externa", "nombre": "SOLICITANTE MANUAL",
            "contacto": "04147778899", "canal": "MANUAL",
        },
    }, headers=entorno["headers"])
    assert r.status_code == 201, r.text
    id_especial = r.json()["id_caso_especial"]

    r = client.patch(f"{ESPECIALES}/{id_especial}", json={
        "estado": "CERRADO",
        "informe": "Se atendió el referido y se verificó el servicio en sitio.",
    }, headers=entorno["headers"])
    assert r.status_code == 200, r.text

    aviso = db_session.scalar(
        select(Notificacion).where(Notificacion.id_caso == entorno["id_caso"])
    )
    assert aviso is not None
    assert aviso.canal == "MANUAL"
    assert aviso.estado == "PENDIENTE"
    assert aviso.destinatario == "04147778899"
    assert db_session.scalar(
        select(Auditoria).where(Auditoria.accion == "AVISO_CIERRE_SOLICITANTE")
    ) is not None


# --------------------------------------------------------------------------- #
# Agenda de citas (RF-12 / RNF-04)
# --------------------------------------------------------------------------- #
def test_crear_cita(client, entorno):
    r = client.post(CITAS, json=_cita(entorno), headers=entorno["headers"])
    assert r.status_code == 201, r.text
    assert r.json()["estado"] == "PROPUESTA"


def test_cita_requiere_referencia(client, entorno):
    r = client.post(CITAS, json={"fecha_hora": datetime.now().isoformat()},
                    headers=entorno["headers"])
    assert r.status_code == 422


def test_no_permite_solapamiento(client, entorno):
    base = datetime.now().replace(microsecond=0)
    primera = client.post(CITAS, json=_cita(entorno, fecha_hora=base.isoformat()),
                          headers=entorno["headers"])
    assert primera.status_code == 201, primera.text

    # 30 minutos después, dentro de la ventana de 60 min → 409
    solapada = client.post(CITAS, json=_cita(entorno, fecha_hora=(base + timedelta(minutes=30)).isoformat()),
                           headers=entorno["headers"])
    assert solapada.status_code == 409, solapada.text
    assert "ya tiene una cita" in solapada.json()["detail"]

    # Fuera de la ventana → se acepta
    libre = client.post(CITAS, json=_cita(entorno, fecha_hora=(base + timedelta(minutes=90)).isoformat()),
                        headers=entorno["headers"])
    assert libre.status_code == 201, libre.text


def test_cita_cancelada_no_bloquea(client, entorno):
    base = datetime.now().replace(microsecond=0)
    cita = client.post(CITAS, json=_cita(entorno, fecha_hora=base.isoformat()),
                       headers=entorno["headers"]).json()
    assert client.delete(f"{CITAS}/{cita['id_cita']}", headers=entorno["headers"]).status_code == 204

    otra = client.post(CITAS, json=_cita(entorno, fecha_hora=(base + timedelta(minutes=15)).isoformat()),
                       headers=entorno["headers"])
    assert otra.status_code == 201, otra.text


def test_actualizar_cita_valida_solape(client, entorno):
    base = datetime.now().replace(microsecond=0)
    creada = client.post(CITAS, json=_cita(entorno, fecha_hora=base.isoformat()),
                         headers=entorno["headers"])
    assert creada.status_code == 201
    b = client.post(CITAS, json=_cita(entorno, fecha_hora=(base + timedelta(hours=5)).isoformat()),
                    headers=entorno["headers"]).json()

    choca = client.patch(f"{CITAS}/{b['id_cita']}", json={"fecha_hora": base.isoformat()},
                         headers=entorno["headers"])
    assert choca.status_code == 409

    ok = client.patch(f"{CITAS}/{b['id_cita']}",
                      json={"fecha_hora": (base + timedelta(hours=7)).isoformat(), "estado": "CONFIRMADA"},
                      headers=entorno["headers"])
    assert ok.status_code == 200
    assert ok.json()["estado"] == "CONFIRMADA"


def test_listado_de_citas_por_rango(client, entorno):
    base = datetime.now().replace(microsecond=0)
    client.post(CITAS, json=_cita(entorno, fecha_hora=base.isoformat()), headers=entorno["headers"])
    listado = client.get(CITAS, params={"desde": base.isoformat(),
                                        "hasta": (base + timedelta(hours=1)).isoformat()},
                         headers=entorno["headers"])
    assert listado.status_code == 200
    assert len(listado.json()) >= 1


# --------------------------------------------------------------------------- #
# Seguimiento (RF-34)
# --------------------------------------------------------------------------- #
def test_derivar_caso_y_devolverlo(client, entorno, db_session):
    r = client.post(SEGUIMIENTO, json={
        "id_caso": entorno["id_caso"], "instancia_destino": "COLA PLANTA EXTERNA",
        "motivo": "Requiere cuadrilla especializada",
    }, headers=entorno["headers"])
    assert r.status_code == 201, r.text
    creado = r.json()
    id_seg = creado["id_seguimiento"]
    # D-156: la respuesta ya trae los datos del caso para la vista SEGUIMIENTO.
    assert creado["id_averia"] == "TSTE-1"
    assert creado["nombre_cliente"] == "CLIENTE E"
    assert creado["direccion"] == "SECTOR ALFA CASA 1"
    assert creado["sector_nombre"] == "Alfa"
    assert creado["estado_caso"] == "ENRUTADO"

    caso = db_session.scalar(select(Caso).where(Caso.id_caso == entorno["id_caso"]))
    db_session.refresh(caso)
    assert caso.estado_actual == "ENRUTADO"

    # Un caso enrutado no entra al despacho de calle
    propuesta = client.post("/api/v1/despachos/propuesta", headers=entorno["headers"]).json()
    ids = [c["id_caso"] for g in propuesta["grupos"] for c in g["casos"]]
    assert entorno["id_caso"] not in ids

    # Al devolverlo, vuelve a estar disponible
    r2 = client.patch(f"{SEGUIMIENTO}/{id_seg}", json={"estado": "DEVUELTO"},
                      headers=entorno["headers"])
    assert r2.status_code == 200
    db_session.refresh(caso)
    assert caso.estado_actual == "NUEVO"


def test_seguimiento_de_caso_inexistente(client, entorno):
    r = client.post(SEGUIMIENTO, json={"id_caso": 999999, "instancia_destino": "X"},
                    headers=entorno["headers"])
    assert r.status_code == 404


def test_listado_y_filtros_de_seguimiento(client, entorno):
    for instancia in ("COLA A", "COLA B"):
        client.post(SEGUIMIENTO, json={"id_caso": entorno["id_caso"],
                                       "instancia_destino": instancia},
                    headers=entorno["headers"])
    todos = client.get(SEGUIMIENTO, headers=entorno["headers"]).json()
    assert len(todos) >= 2
    filtrado = client.get(SEGUIMIENTO, params={"instancia_destino": "COLA A"},
                          headers=entorno["headers"]).json()
    assert len(filtrado) == 1
    en_cola = client.get(SEGUIMIENTO, params={"estado": "EN_COLA"}, headers=entorno["headers"]).json()
    assert len(en_cola) >= 2
    por_texto = client.get(SEGUIMIENTO, params={"q": "TSTE-1"},
                           headers=entorno["headers"]).json()
    assert len(por_texto) >= 2
    assert all(f["id_averia"] == "TSTE-1" for f in por_texto)


# --------------------------------------------------------------------------- #
# RBAC
# --------------------------------------------------------------------------- #
def test_tecnico_solo_lectura(client, entorno, admin_token):
    tecnico = admin_token["tecnico"]
    assert client.get(CITAS, headers=tecnico).status_code == 200
    assert client.get(ESPECIALES, headers=tecnico).status_code == 200
    assert client.get(SEGUIMIENTO, headers=tecnico).status_code == 200

    assert client.post(ESPECIALES, json={"clasificacion": "REFERIDO",
                                         "tipo_actividad": "REPARACION"},
                       headers=tecnico).status_code == 403
    assert client.post(SEGUIMIENTO, json={"id_caso": entorno["id_caso"],
                                          "instancia_destino": "X"},
                       headers=tecnico).status_code == 403


def test_sin_token(client):
    assert client.get(CITAS).status_code == 401


def test_super_puede_forzar_solape(client, entorno, admin_token):
    base = datetime.now().replace(microsecond=0)
    assert client.post(CITAS, json=_cita(entorno, fecha_hora=base.isoformat()),
                       headers=entorno["headers"]).status_code == 201
    forzada = client.post(CITAS, json=_cita(entorno, fecha_hora=(base + timedelta(minutes=10)).isoformat(),
                                            permitir_solape=True),
                          headers=admin_token["super"])
    assert forzada.status_code == 201, forzada.text

    # Un ADMIN no puede forzarlo
    no_permitido = client.post(CITAS, json=_cita(entorno, fecha_hora=(base + timedelta(minutes=20)).isoformat(),
                                                 permitir_solape=True),
                               headers=entorno["headers"])
    assert no_permitido.status_code == 403
