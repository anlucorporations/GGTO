"""D-120 · El caso especial se cierra cuando se cierra su caso.

El defecto reportado: el técnico cerraba el referido desde la APK, el **caso**
quedaba `CERRADO`, pero la fila `caso_especial` seguía en `ABIERTO`, así que la
lista de ESPECIALES (web y APK) lo mostraba como pendiente para siempre.

Se fijan las dos piezas de la corrección:

1. `clasificacion.estado_especial_visible` (función pura): el caso manda.
2. El camino único de estados (`resolucion.registrar_estado`) sincroniza la ficha
   del especial, y la lista de ESPECIALES lo refleja.
"""

from __future__ import annotations

import pytest
from sqlalchemy import select

from app.models import Caso, CasoEspecial, Notificacion
from app.services import clasificacion
from app.services.tiempo import hoy_operativo

CASOS = "/api/v1/casos"
ESPECIALES = "/api/v1/casos-especiales"


# --------------------------------------------------------------------------- #
# Función pura
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize(
    ("estado_especial", "estado_caso", "esperado"),
    [
        ("ABIERTO", "CERRADO", "CERRADO"),
        ("ABIERTO", "CANCELADO", "CERRADO"),
        ("ABIERTO", "ENRUTADO", "CERRADO"),
        ("ABIERTO", "CONTACTADO", "EN_PROCESO"),
        ("ABIERTO", "CITADO", "EN_PROCESO"),
        ("ABIERTO", "EN_GESTION", "EN_PROCESO"),
        ("ABIERTO", "NUEVO", "ABIERTO"),
        ("ABIERTO", "PENDIENTE", "ABIERTO"),
        # Un cierre manual no se reabre solo.
        ("ATENDIDO", "NUEVO", "ATENDIDO"),
        ("CERRADO", "CONTACTADO", "CERRADO"),
        # Un caso cerrado manda incluso sobre un ATENDIDO.
        ("ATENDIDO", "CERRADO", "CERRADO"),
    ],
)
def test_estado_visible_del_especial(estado_especial, estado_caso, esperado):
    assert clasificacion.estado_especial_visible(estado_especial, estado_caso) == esperado


def test_estado_especial_para_ignora_los_estados_sin_decision():
    assert clasificacion.estado_especial_para("NUEVO") is None
    assert clasificacion.estado_especial_para(None) is None
    assert clasificacion.estado_especial_para("CERRADO") == "CERRADO"


# --------------------------------------------------------------------------- #
# Integración: cerrar el caso cierra el especial
# --------------------------------------------------------------------------- #
@pytest.fixture()
def especial(client, admin_token, db_session):
    """Un caso REFERIDO con su ficha de especial, asignado a la cuadrilla de campo."""
    headers = admin_token["admin"]
    id_central = admin_token["id_central"]

    # D-122: el alta de un especial exige que la dirección sectorice.
    sector = client.post(
        "/api/v1/sectores",
        json={
            "id_central": id_central,
            "nombre": "Sector D-120",
            "codigo": "TSD120",
            "direcciones": [{"patron": "SECTOR D120"}],
        },
        headers=headers,
    )
    assert sector.status_code == 201, sector.text
    id_sector = sector.json()["id_sector"]

    r = client.post(
        ESPECIALES,
        json={
            "clasificacion": "REFERIDO",
            "tipo_actividad": "REPARACION",
            "prioridad": "MEDIA",
            "descripcion": "TEST D-120: referido que se cierra en campo",
            "id_averia": "TSTD120-1",
            "id_sector": id_sector,
            "crear_solicitante": {
                "unidad": "Unidad de Referidos",
                "nombre": "SOLICITANTE D120",
                "contacto": "04140000000",
                "canal": "TELEGRAM",
            },
            "direccion": "SECTOR D120 CASA 1",
            "nombre_cliente": "CLIENTE D120",
            "contacto_cliente": "04142223344",
            "telefono": "7014000999",
            "tipo_problema": "SIN_SERVICIO",
        },
        headers=headers,
    )
    assert r.status_code == 201, r.text
    cuerpo = r.json()
    # D-123: el cierre de campo exige que el caso sea de la cuadrilla del técnico.
    from app.tests.conftest import asignar_caso_al_tecnico

    asignar_caso_al_tecnico(db_session, admin_token, cuerpo["id_caso"])
    return {
        "headers": headers,
        "id_central": id_central,
        "id_especial": cuerpo["id_caso_especial"],
        "id_caso": cuerpo["id_caso"],
    }


def test_cerrar_el_caso_desde_campo_cierra_el_especial(client, admin_token, especial,
                                                       db_session):
    """El TÉCNICO cierra el caso y la ficha del especial queda CERRADA (D-120)."""
    # El caso se lleva a CONTACTADO (acción de campo) y luego se cierra.
    contacto = client.post(
        f"{CASOS}/{especial['id_caso']}/estado",
        json={"estado_actual": "CONTACTADO"},
        headers=admin_token["tecnico"],
    )
    assert contacto.status_code == 200, contacto.text

    ficha = db_session.scalar(
        select(CasoEspecial).where(CasoEspecial.id_caso_especial == especial["id_especial"])
    )
    assert ficha is not None
    assert ficha.estado == "EN_PROCESO", "un caso contactado deja el especial en proceso"

    cierre = client.post(
        f"{CASOS}/{especial['id_caso']}/cierre",
        json={"modo": "IVR", "descripcion": "Trabajo terminado en campo (D-120)"},
        headers=admin_token["tecnico"],
    )
    assert cierre.status_code == 200, cierre.text
    assert cierre.json()["estado_actual"] == "CERRADO"

    db_session.expire_all()
    ficha = db_session.scalar(
        select(CasoEspecial).where(CasoEspecial.id_caso_especial == especial["id_especial"])
    )
    assert ficha is not None
    assert ficha.estado == "CERRADO"

    # D-156: el solicitante externo queda avisado en el outbox. Sin token de
    # Telegram el aviso no se pierde: queda PENDIENTE para reintento.
    aviso = db_session.scalar(
        select(Notificacion).where(Notificacion.id_caso == especial["id_caso"])
    )
    assert aviso is not None
    assert aviso.canal == "TELEGRAM"
    assert aviso.estado == "PENDIENTE"
    assert aviso.destinatario == "04140000000"

    # Y la lista de ESPECIALES lo muestra cerrado y fuera de los pendientes.
    lista = client.get(ESPECIALES, headers=especial["headers"])
    assert lista.status_code == 200, lista.text
    fila = next(
        e for e in lista.json() if e["id_caso_especial"] == especial["id_especial"]
    )
    assert fila["estado"] == "CERRADO"
    assert fila["pendiente"] is False
    assert fila["estado_caso"] == "CERRADO"


def test_un_especial_historico_abierto_se_muestra_cerrado_si_su_caso_lo_esta(
    client, especial, db_session
):
    """Las fichas viejas que quedaron ABIERTO no se ven pendientes (lectura derivada)."""
    caso = db_session.get(Caso, especial["id_caso"])
    assert caso is not None
    caso.estado_actual = "CERRADO"
    db_session.commit()

    lista = client.get(ESPECIALES, headers=especial["headers"])
    assert lista.status_code == 200, lista.text
    fila = next(
        e for e in lista.json() if e["id_caso_especial"] == especial["id_especial"]
    )
    assert fila["estado"] == "CERRADO", "la ficha ABIERTO debe mostrarse cerrada"
    assert fila["pendiente"] is False


def test_el_especial_expone_el_caso_asociado_para_cerrarlo_desde_la_apk(
    client, especial
):
    """La APK recibe `id_averia` y `estado_caso` para cerrar el caso del especial."""
    lista = client.get(ESPECIALES, headers=especial["headers"])
    fila = next(
        e for e in lista.json() if e["id_caso_especial"] == especial["id_especial"]
    )
    assert fila["id_averia"], "sin id de avería la APK no puede abrir el caso"
    assert fila["estado_caso"] in {"NUEVO", "PENDIENTE", "ASIGNADO"}


def test_el_cierre_que_llega_por_la_carga_offline_cierra_el_especial(
    client, admin_token, especial, db_session
):
    """Un cierre hecho **sin conexión** (cola de la APK) también cierra el especial.

    La APK encola el cierre y lo envía en `POST /sync/carga` como una actividad
    `CIERRE`; ese camino tiene que dejar la ficha del especial en CERRADO.
    """
    from datetime import UTC, datetime

    from app.models import Cuadrilla, CuadrillaTecnico, Despacho, DespachoCasos, Tecnico

    # D-121 · H-02: la carga es fail-closed, así que el técnico necesita una
    # cuadrilla vigente y el caso despachado en ella.
    id_tecnico = db_session.scalar(
        select(Tecnico.id_tecnico).where(Tecnico.p00 == "TESTTEC")
    )
    assert id_tecnico is not None
    cuadrilla = Cuadrilla(
        id_central=especial["id_central"], codigo="TCD120", nombre="Cuadrilla D-120"
    )
    db_session.add(cuadrilla)
    db_session.flush()
    db_session.add(
        CuadrillaTecnico(
            id_cuadrilla=cuadrilla.id_cuadrilla, id_tecnico=id_tecnico, desde=hoy_operativo()
        )
    )
    despacho = Despacho(
        id_central=especial["id_central"],
        fecha=hoy_operativo(),
        id_cuadrilla=cuadrilla.id_cuadrilla,
        estado="BORRADOR",
    )
    db_session.add(despacho)
    db_session.flush()
    db_session.add(
        DespachoCasos(
            id_despacho=despacho.id_despacho,
            id_caso=especial["id_caso"],
            estado="ASIGNADO",
            orden_visita=1,
            tipo_asignacion="REFERIDO",
        )
    )
    db_session.commit()

    carga = client.post(
        "/api/v1/sync/carga",
        json={
            "actividades": [
                {
                    "id_caso": especial["id_caso"],
                    "tipo": "CIERRE",
                    "modo": "COS",
                    "reporte_corto": "Cierre en campo sin conexión (D-120)",
                    "fecha_hora": datetime.now(UTC).isoformat(),
                    "evidencias": [],
                }
            ],
            "estados": [],
        },
        headers=admin_token["tecnico"],
    )
    assert carga.status_code == 200, carga.text
    assert carga.json()["aceptadas"] >= 1, carga.text

    db_session.expire_all()
    ficha = db_session.scalar(
        select(CasoEspecial).where(CasoEspecial.id_caso_especial == especial["id_especial"])
    )
    assert ficha is not None
    assert ficha.estado == "CERRADO", "la carga offline debe cerrar la ficha del especial"
    caso = db_session.get(Caso, especial["id_caso"])
    assert caso is not None and caso.estado_actual == "CERRADO"


def test_carga_sin_cuadrilla_se_rechaza(client, admin_token):
    """D-121 · H-02: un TÉCNICO sin cuadrilla vigente no puede cargar (403).

    Era el fail-open de la auditoría V3: sin cuadrilla, `ids_permitidos` quedaba
    en `None` y la carga aceptaba cualquier caso de la central.
    """
    carga = client.post(
        "/api/v1/sync/carga",
        json={"actividades": [], "estados": []},
        headers=admin_token["tecnico"],
    )
    assert carga.status_code == 403, carga.text
