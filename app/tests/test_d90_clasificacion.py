"""Pruebas del ciclo D-90 — regla REPARACIÓN ⇐ 70* + ID de AVERÍA real.

Unitarias (sin base de datos) para los predicados y la marca derivada, e
integración (`GGTO_TEST_DB_URL`) para:

- alta de REPARACIÓN válida vs reclasificación a REFERIDO (RF-49);
- ficha `caso_especial` **idempotente** con `tiene_id_averia` real;
- respeto de la clasificación EMPRESA/GOBIERNO;
- regularización de un caso **marcado** en su próximo cambio (RF-50);
- excepción de los casos **terminales** (pendiente histórico);
- marcas expuestas en la ficha y métricas de reclasificados (RF-55).
"""

from __future__ import annotations

from sqlalchemy import func, select, text

from app.models import Auditoria, Caso, CasoEspecial
from app.services import clasificacion
from app.services.clasificacion import (
    MOTIVO_AMBOS,
    MOTIVO_SIN_AVERIA,
    MOTIVO_SIN_IP,
    clasificacion_especial,
    esta_marcado,
    motivo_marca,
    tiene_id_averia_real,
)

CASOS = "/api/v1/casos"
ESPECIALES = "/api/v1/casos-especiales"
METRICAS = "/api/v1/monitoreo/reclasificaciones"


# --------------------------------------------------------------------------- #
# Apoyo
# --------------------------------------------------------------------------- #
def _caso_sin_sesion(**campos) -> Caso:
    """Instancia de `Caso` en memoria (sin sesión) para probar los predicados."""
    base = {"id_central": 1, "id_averia": "TST-1", "tipo_caso": "REPARACION",
            "categoria": "RESIDENCIAL", "estado_actual": "NUEVO"}
    base.update(campos)
    return Caso(**base)


def _crear(client, headers, **campos):
    cuerpo = {"id_averia": "TSTD90-01", "tipo_reporte": "REPARACION",
              "tipo_problema": "SIN_SERVICIO", "direccion": "SECTOR ALFA CASA 1",
              "contacto_cliente": "04140000000", "id_pago": "7000000000",
              "nombre_cliente": "CLIENTE D90"}
    cuerpo.update(campos)
    r = client.post(CASOS, json=cuerpo, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _especial_de(db, id_caso: int) -> CasoEspecial | None:
    db.rollback()
    return db.scalar(select(CasoEspecial).where(CasoEspecial.id_caso == id_caso))


def _fila_legado_marcada(db, id_central: int, id_averia: str, estado: str = "NUEVO") -> int:
    """Inserta una REPARACIÓN marcada como existiría antes de D-89.

    Se desactivan el trigger y el CHECK el tiempo justo de la inserción, porque en
    un esquema nuevo la regla impide crear la fila.
    """
    db.execute(text("ALTER TABLE caso DROP CONSTRAINT IF EXISTS ck_reparacion_con_ip"))
    db.execute(text("ALTER TABLE caso DISABLE TRIGGER trg_caso_reparacion_a_referido"))
    db.execute(
        text(
            "INSERT INTO caso (id_central, id_averia, tipo_caso, categoria, estado_actual) "
            "VALUES (:c, :a, 'REPARACION', 'RESIDENCIAL', :e)"
        ),
        {"c": id_central, "a": id_averia, "e": estado},
    )
    db.commit()
    db.execute(text("ALTER TABLE caso ENABLE TRIGGER trg_caso_reparacion_a_referido"))
    db.execute(
        text(
            "ALTER TABLE caso ADD CONSTRAINT ck_reparacion_con_ip "
            "CHECK (tipo_caso <> 'REPARACION' "
            "OR (id_pago IS NOT NULL AND id_averia NOT LIKE 'REF-%')) NOT VALID"
        )
    )
    db.commit()
    return int(db.scalar(select(Caso.id_caso).where(Caso.id_averia == id_averia)))


# --------------------------------------------------------------------------- #
# Predicados (unitarias)
# --------------------------------------------------------------------------- #
def test_tiene_id_averia_real():
    assert tiene_id_averia_real(_caso_sin_sesion(id_averia="AV-99812"))
    assert not tiene_id_averia_real(_caso_sin_sesion(id_averia="REF-2324X-000001"))
    assert not tiene_id_averia_real(_caso_sin_sesion(id_averia="ref-2324x-000002"))
    assert not tiene_id_averia_real(_caso_sin_sesion(id_averia=""))
    assert not tiene_id_averia_real(_caso_sin_sesion(id_averia=None))


def test_esta_marcado_y_motivo():
    sin_ip = _caso_sin_sesion(id_pago=None, id_averia="AV-1")
    assert esta_marcado(sin_ip) and motivo_marca(sin_ip) == MOTIVO_SIN_IP

    sin_averia = _caso_sin_sesion(id_pago=7, id_averia="REF-2324X-1")
    assert esta_marcado(sin_averia) and motivo_marca(sin_averia) == MOTIVO_SIN_AVERIA

    ambas = _caso_sin_sesion(id_pago=None, id_averia="REF-2324X-1")
    assert esta_marcado(ambas) and motivo_marca(ambas) == MOTIVO_AMBOS

    valida = _caso_sin_sesion(id_pago=7, id_averia="AV-1")
    assert not esta_marcado(valida) and motivo_marca(valida) is None

    averia = _caso_sin_sesion(tipo_caso="AVERIA", id_pago=None, id_averia="AV-1")
    assert not esta_marcado(averia) and motivo_marca(averia) is None


def test_clasificacion_especial_respeta_empresa_y_gobierno():
    assert clasificacion_especial(_caso_sin_sesion(categoria="RESIDENCIAL")) == "REFERIDO"
    assert clasificacion_especial(_caso_sin_sesion(categoria="REFERIDO")) == "REFERIDO"
    assert clasificacion_especial(_caso_sin_sesion(categoria="EMPRESA")) == "EMPRESA"
    assert clasificacion_especial(_caso_sin_sesion(categoria="GOBIERNO")) == "GOBIERNO"


# --------------------------------------------------------------------------- #
# RF-49 · Alta de REPARACIÓN
# --------------------------------------------------------------------------- #
def test_la_reparacion_valida_se_conserva(client, admin_token, db_session):
    caso = _crear(client, admin_token["admin"], id_averia="TSTAV9001", id_pago="7014000870")
    assert caso["tipo_caso"] == "REPARACION"
    assert caso["id_pago"] is not None
    assert caso["marcado_reclasificar"] is False
    assert caso["motivo_marca"] is None
    assert caso["tiene_identificador_pago"] is True
    assert caso["tiene_id_averia_real"] is True
    assert _especial_de(db_session, caso["id_caso"]) is None


def test_la_reparacion_sin_identificador_de_pago_se_rechaza(client, admin_token):
    """RN-AL-01: el alta manual exige el teléfono con el identificador de pago (70*)."""
    r = client.post(
        CASOS,
        json={"id_averia": "TSTAV9002", "tipo_reporte": "REPARACION",
              "tipo_problema": "SIN_SERVICIO", "direccion": "SECTOR ALFA CASA 1",
              "nombre_cliente": "CLIENTE D90", "contacto_cliente": "0412-555-6677",
              "telefono": "0412-555-6677"},
        headers=admin_token["admin"],
    )
    assert r.status_code == 422, r.text


def test_la_reparacion_sin_averia_real_se_registra_como_referido(client, admin_token, db_session):
    # Un id de avería sintético (`REF-…`) mantiene viva la regla de D-90.
    caso = _crear(client, admin_token["admin"], id_averia="REF-2324X-900002",
                  id_pago="7014000871")
    assert caso["tipo_caso"] == "REFERIDO"
    assert caso["tiene_id_averia_real"] is False

    especial = _especial_de(db_session, caso["id_caso"])
    assert especial is not None and especial.tiene_id_averia is False

    traza = db_session.scalar(
        select(Auditoria).where(
            Auditoria.accion == clasificacion.ACCION_RECLASIFICADO,
            Auditoria.id_entidad == str(caso["id_caso"]),
        )
    )
    assert traza is not None
    assert traza.datos_despues["motivo"] == MOTIVO_SIN_AVERIA
    assert traza.datos_despues["origen"] == "ALTA_MANUAL"


def test_la_clasificacion_empresa_se_respeta(client, admin_token, db_session):
    caso = _crear(client, admin_token["admin"], id_averia="REF-2324X-900003",
                  categoria="EMPRESA")
    assert caso["tipo_caso"] == "REFERIDO"
    assert caso["categoria"] == "EMPRESA"
    especial = _especial_de(db_session, caso["id_caso"])
    assert especial is not None and especial.clasificacion == "EMPRESA"


# --------------------------------------------------------------------------- #
# RF-50 · Regularización del caso marcado
# --------------------------------------------------------------------------- #
def test_el_cambio_regulariza_el_caso_marcado(client, admin_token, db_session):
    id_caso = _fila_legado_marcada(db_session, admin_token["id_central"], "TSTD90-LEG1")

    r = client.patch(f"{CASOS}/{id_caso}", json={"informacion": "se intenta regularizar"},
                     headers=admin_token["admin"])
    assert r.status_code == 200, r.text
    assert r.json()["tipo_caso"] == "REFERIDO"
    assert r.json()["categoria"] == "REFERIDO"
    assert _especial_de(db_session, id_caso) is not None


def test_el_cambio_con_las_claves_conserva_la_reparacion(client, admin_token, db_session):
    id_caso = _fila_legado_marcada(db_session, admin_token["id_central"], "TSTD90-LEG2")

    r = client.patch(f"{CASOS}/{id_caso}", json={"id_pago": "7014000872"},
                     headers=admin_token["admin"])
    assert r.status_code == 200, r.text
    assert r.json()["tipo_caso"] == "REPARACION"
    assert r.json()["marcado_reclasificar"] is False
    assert _especial_de(db_session, id_caso) is None


def test_un_caso_marcado_se_regulariza_al_cambiar_de_estado(
    client, admin_token, db_session
):
    """Cualquier escritura regulariza la fila marcada.

    La excepción «un cambio de estado en un caso ya terminal no reclasifica» es
    **inexecutable** con el `CHECK` de D-89 (bloquearía ese `UPDATE`) y el trigger
    de la base la convierte igualmente; por eso la regla se aplica siempre y los
    casos marcados que no se han reescrito se informan en MONITOREO.
    """
    id_caso = _fila_legado_marcada(db_session, admin_token["id_central"], "TSTD90-LEG3",
                                   estado="CERRADO")

    r = client.patch(f"{CASOS}/{id_caso}", json={"estado_actual": "CANCELADO"},
                     headers=admin_token["admin"])
    assert r.status_code == 200, r.text
    assert r.json()["tipo_caso"] == "REFERIDO"
    assert r.json()["categoria"] == "REFERIDO"
    assert r.json()["marcado_reclasificar"] is False
    assert _especial_de(db_session, id_caso) is not None


# --------------------------------------------------------------------------- #
# Ficha del especial (idempotente y con `tiene_id_averia` real)
# --------------------------------------------------------------------------- #
def test_la_ficha_del_especial_es_idempotente(client, admin_token, db_session):
    caso = _crear(client, admin_token["admin"], id_averia="REF-2324X-900004")
    assert _especial_de(db_session, caso["id_caso"]) is not None

    r = client.post(
        ESPECIALES,
        json={"id_caso": caso["id_caso"], "clasificacion": "REFERIDO",
              "tipo_actividad": "REPARACION", "prioridad": "ALTA",
              "crear_solicitante": {"unidad": "Masivos", "nombre": "LUIS",
                                    "contacto": "04121112233"}},
        headers=admin_token["admin"],
    )
    assert r.status_code == 201, r.text
    total = db_session.scalar(
        select(func.count()).select_from(CasoEspecial).where(
            CasoEspecial.id_caso == caso["id_caso"])
    )
    assert total == 1
    assert r.json()["prioridad"] == "ALTA"


def test_tiene_id_averia_refleja_la_realidad(client, admin_token, db_session):
    r = client.post(
        ESPECIALES,
        json={"id_averia": "REF-2324X-999999", "clasificacion": "REFERIDO",
              "tipo_actividad": "REPARACION", "tipo_problema": "SIN_SERVICIO",
              "nombre_cliente": "CLIENTE D90", "contacto_cliente": "04121112233",
              "telefono": "7014000874", "direccion": "SECTOR ALFA CASA 9",
              "crear_solicitante": {"unidad": "Masivos", "nombre": "LUIS",
                                    "contacto": "04121112233"}},
        headers=admin_token["admin"],
    )
    assert r.status_code == 201, r.text
    assert r.json()["tiene_id_averia"] is False


# --------------------------------------------------------------------------- #
# RF-55 · Métricas de reclasificados
# --------------------------------------------------------------------------- #
def test_las_metricas_de_reclasificacion(client, admin_token, db_session):
    _crear(client, admin_token["admin"], id_averia="TSTAV9005", id_pago="7014000873")
    _crear(client, admin_token["admin"], id_averia="REF-2324X-900006")
    _fila_legado_marcada(db_session, admin_token["id_central"], "TSTD90-LEG4", estado="CERRADO")

    r = client.get(METRICAS, headers=admin_token["admin"])
    assert r.status_code == 200, r.text
    datos = r.json()
    assert datos["reparaciones_validas"] >= 1
    assert datos["referidos"] >= 1
    assert datos["reclasificadas"] >= 1
    assert datos["pendientes_historicos"] >= 1
    assert datos["pendientes_historicos_en_terminal"] >= 1
    assert datos["referidos_sin_ficha"] == 0


def test_el_tecnico_no_ve_las_metricas(client, admin_token):
    r = client.get(METRICAS, headers=admin_token["tecnico"])
    assert r.status_code == 403
