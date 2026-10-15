"""Pruebas del incremento D-99: módulo MASIVAS y jornada de despacho.

Cubren lo que el incremento añade sobre el comportamiento ya probado:

* asociación explícita caso ↔ masiva (`falla_masiva_caso`) y CASOS ASOCIADOS;
* RUTA tomada de la columna EXTRA del archivo de ingesta;
* cierre en cascada exigiendo descripción, validador del CRASS y evidencias;
* catálogo de personal externo (solicitante / CRASS);
* corte de jornada a las 23:50 con los casos de vuelta a PENDIENTE;
* reporte de producción con ABIERTOS/ENRUTADO y la marca `es_masiva`;
* aviso «DESPACHO ACTUALIZADO» a los técnicos al reprocesar;
* la descarga de la APK entrega las masivas y los datos técnicos del caso.

Los identificadores de prueba empiezan por `TST`/`TCD`/`TSD` para que el aseo de
`conftest` los barra entre pruebas.
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest
from sqlalchemy import select

from app.models import Actividad, Caso, FallaMasiva, FallaMasivaCaso, Mensaje

MASIVAS = "/api/v1/fallas-masivas"
DESPACHOS = "/api/v1/despachos"
PERSONAL = "/api/v1/solicitantes"
CASOS = "/api/v1/casos"
AYER = (date.today() - timedelta(days=1)).isoformat()
HOY = date.today().isoformat()
#: Texto exacto que el cierre deja en cada caso asociado (RF-62).
CIERRE_CASO = "Reparado en FDT"


@pytest.fixture()
def entorno(client, admin_token):
    """Un sector, dos cuadrillas y un puñado de casos con OLT y RUTA."""
    headers = admin_token["admin"]
    id_central = admin_token["id_central"]

    r = client.post("/api/v1/sectores",
                    json={"id_central": id_central, "nombre": "Alfa", "codigo": "TSD9A",
                          "direcciones": [{"patron": "SECTOR D99 ALFA"}]},
                    headers=headers)
    assert r.status_code == 201, r.text
    id_sector = r.json()["id_sector"]

    for codigo, nombre in (("TCD9A", "Cuadrilla D99 1"), ("TCD9B", "Cuadrilla D99 2")):
        r = client.post("/api/v1/cuadrillas",
                        json={"id_central": id_central, "codigo": codigo, "nombre": nombre},
                        headers=headers)
        assert r.status_code == 201, r.text

    def crear(id_averia: str, **extra):
        cuerpo = {"id_averia": id_averia, "direccion": "SECTOR D99 ALFA CASA 1",
                  "nombre_cliente": f"CLIENTE {id_averia}",
                  "contacto_cliente": "04140000000", "id_pago": "7000000000",
                  "tipo_reporte": "REPARACION", "tipo_problema": "SIN_SERVICIO"}
        cuerpo.update(extra)
        r = client.post(CASOS, json=cuerpo, headers=headers)
        assert r.status_code == 201, r.text
        return r.json()

    yield {"headers": headers, "id_central": id_central, "id_sector": id_sector,
           "crear": crear}


def _marcar_tecnico(db_session, ids_caso, **campos) -> None:
    """Fija campos que el alta manual no acepta (olt, extra, estado...)."""
    for id_caso in ids_caso:
        caso = db_session.get(Caso, id_caso)
        for campo, valor in campos.items():
            setattr(caso, campo, valor)
    db_session.commit()


def _crear_personal(client, headers, nombre="VALIDADOR CRASS", tipo="CRASS"):
    r = client.post(PERSONAL, json={"nombre": nombre, "unidad": "CRASS MIRANDA",
                                    "contacto": "02121234567", "tipo": tipo},
                    headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _procesar(client, entorno, fecha: str):
    r = client.post(f"{DESPACHOS}/procesar",
                    json={"fecha": fecha, "reemplazar": True, "asignaciones": []},
                    headers=entorno["headers"])
    assert r.status_code == 201, r.text
    return r.json()


# --------------------------------------------------------------------------- #
# 1. Asociación explícita y CASOS ASOCIADOS
# --------------------------------------------------------------------------- #
def test_alta_manual_asocia_los_casos_del_sector_y_expone_la_ruta(client, entorno,
                                                                  db_session):
    """RF-58/RF-59: el alta manual asocia los casos y la RUTA sale de EXTRA."""
    headers, id_sector = entorno["headers"], entorno["id_sector"]
    casos = [entorno["crear"](f"TSTD99-M{i}") for i in range(3)]
    # La RUTA viaja en la columna EXTRA del archivo de ingesta.
    _marcar_tecnico(db_session, [c["id_caso"] for c in casos],
                    extra="TARJETA 3 / PUERTO 7 / FAT C-01", olt="OLT-D99")

    r = client.post(MASIVAS, json={"descripcion": "Masiva manual del sector Alfa",
                                   "id_sector": id_sector}, headers=headers)
    assert r.status_code == 201, r.text
    falla = r.json()
    assert falla["casos_asociados"] == 3

    r = client.get(f"{MASIVAS}/{falla['id_falla']}/casos", headers=headers)
    assert r.status_code == 200, r.text
    asociados = r.json()
    assert len(asociados) == 3
    assert {a["id_caso"] for a in asociados} == {c["id_caso"] for c in casos}
    assert all(a["ruta"] == "TARJETA 3 / PUERTO 7 / FAT C-01" for a in asociados)
    assert all(a["origen_asociacion"] == "AUTO" for a in asociados)
    # La marca del caso queda sincronizada con la asociación.
    assert all(db_session.get(Caso, c["id_caso"]).es_falla_masiva for c in casos)


def test_la_deteccion_automatica_materializa_la_concentracion(client, entorno,
                                                              db_session):
    """RF-58: la detección por concentración crea la falla y sus asociaciones."""
    headers = entorno["headers"]
    casos = [entorno["crear"](f"TSTD99-D{i}") for i in range(5)]
    _marcar_tecnico(db_session, [c["id_caso"] for c in casos], olt="OLT-CONCENTRADA")

    r = client.post(f"{MASIVAS}/detectar", headers=headers)
    assert r.status_code == 200, r.text
    creadas = [f for f in r.json() if f["clave_concentracion"] == "olt:OLT-CONCENTRADA"]
    assert creadas, r.text
    falla = creadas[0]
    assert falla["casos_asociados"] == 5

    filas = db_session.scalars(
        select(FallaMasivaCaso).where(FallaMasivaCaso.id_falla == falla["id_falla"])
    ).all()
    assert len(filas) == 5
    assert {f.origen for f in filas} == {"AUTO"}


def test_asociar_y_quitar_casos_a_mano(client, entorno):
    """RF-59: el usuario puede agregar y quitar casos de la masiva."""
    headers, id_sector = entorno["headers"], entorno["id_sector"]
    dentro = entorno["crear"]("TSTD99-AS1")
    fuera = entorno["crear"]("TSTD99-AS2")
    r = client.post(MASIVAS, json={"descripcion": "Masiva para asociar a mano",
                                   "id_sector": id_sector}, headers=headers)
    falla = r.json()
    # El alta asoció los dos casos del sector.
    assert falla["casos_asociados"] == 2

    r = client.request("DELETE", f"{MASIVAS}/{falla['id_falla']}/casos",
                       json={"ids_caso": [fuera["id_caso"]]}, headers=headers)
    assert r.status_code == 200, r.text
    assert [a["id_caso"] for a in r.json()] == [dentro["id_caso"]]

    r = client.post(f"{MASIVAS}/{falla['id_falla']}/casos",
                    json={"ids_caso": [fuera["id_caso"]]}, headers=headers)
    assert r.status_code == 201, r.text
    restantes = r.json()
    assert {a["id_caso"] for a in restantes} == {dentro["id_caso"], fuera["id_caso"]}
    assert {a["origen_asociacion"] for a in restantes} == {"AUTO", "MANUAL"}


# --------------------------------------------------------------------------- #
# 2. Personal externo (solicitantes y CRASS)
# --------------------------------------------------------------------------- #
def test_catalogo_de_personal_externo(client, entorno):
    """RF-63: alta, filtro por tipo, edición y baja lógica si está en uso."""
    headers = entorno["headers"]
    creado = _crear_personal(client, headers, nombre="ANA CRASS", tipo="CRASS")
    assert creado["tipo"] == "CRASS"
    assert creado["activo"] is True
    assert creado["id_central"] == entorno["id_central"]

    r = client.get(f"{PERSONAL}?tipo=CRASS", headers=headers)
    assert r.status_code == 200, r.text
    assert [p["id_solicitante"] for p in r.json()] == [creado["id_solicitante"]]

    r = client.patch(f"{PERSONAL}/{creado['id_solicitante']}",
                     json={"unidad": "CRASS LOS TEQUES"}, headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["unidad"] == "CRASS LOS TEQUES"

    # En uso por una masiva cerrada: la baja desactiva en vez de borrar.
    id_sector = entorno["id_sector"]
    entorno["crear"]("TSTD99-P1")
    r = client.post(MASIVAS, json={"descripcion": "Masiva con validador del CRASS",
                                   "id_sector": id_sector}, headers=headers)
    falla = r.json()
    r = client.post(f"{MASIVAS}/{falla['id_falla']}/cierre",
                    json={"descripcion": "Se reparó el tramo y se validó en sitio",
                          "id_validador_crass": creado["id_solicitante"]},
                    headers=headers)
    assert r.status_code == 200, r.text

    r = client.delete(f"{PERSONAL}/{creado['id_solicitante']}", headers=headers)
    assert r.status_code == 204, r.text
    r = client.get(f"{PERSONAL}?solo_activos=false", headers=headers)
    fila = next(p for p in r.json() if p["id_solicitante"] == creado["id_solicitante"])
    assert fila["activo"] is False, "el registro en uso debe desactivarse, no borrarse"


# --------------------------------------------------------------------------- #
# 3. Cierre de la masiva (RF-61 / RF-62)
# --------------------------------------------------------------------------- #
def test_cierre_en_cascada_cierra_todos_los_casos(client, entorno, db_session):
    """RF-62: al cerrar la masiva se cierran los casos con IVR y «Reparado en FDT»."""
    headers, id_sector = entorno["headers"], entorno["id_sector"]
    casos = [entorno["crear"](f"TSTD99-C{i}") for i in range(3)]
    # Uno ya estaba cerrado: debe omitirse, no fallar.
    _marcar_tecnico(db_session, [casos[0]["id_caso"]], estado_actual="CERRADO")
    validador = _crear_personal(client, headers)

    r = client.post(MASIVAS, json={"descripcion": "Masiva para cerrar en cascada",
                                   "id_sector": id_sector}, headers=headers)
    falla = r.json()
    assert falla["casos_asociados"] == 3

    r = client.post(f"{MASIVAS}/{falla['id_falla']}/cierre",
                    json={"descripcion": "Se reemplazó el tramo de fibra dañado",
                          "id_validador_crass": validador["id_solicitante"],
                          "evidencias": ["EVID-D99-1.jpg", "EVID-D99-2.jpg"],
                          "modo": "IVR"},
                    headers=headers)
    assert r.status_code == 200, r.text
    resultado = r.json()
    assert resultado["estado"] == "CERRADA"
    assert resultado["casos_cerrados"] == 2
    assert resultado["casos_omitidos"] == 1

    db_session.expire_all()
    for caso in casos[1:]:
        vivo = db_session.get(Caso, caso["id_caso"])
        assert vivo.estado_actual == "CERRADO", vivo.id_averia

    falla_db = db_session.get(FallaMasiva, falla["id_falla"])
    assert falla_db.estado == "CERRADA"
    assert falla_db.id_validador_crass == validador["id_solicitante"]
    assert falla_db.casos_cerrados == 2
    assert falla_db.evidencias_cierre and "EVID-D99-1.jpg" in falla_db.evidencias_cierre

    # La descripción que queda en el caso es «Reparado en FDT» (RF-62).
    actividad = db_session.scalar(
        select(Actividad).where(Actividad.id_caso == casos[1]["id_caso"],
                                Actividad.tipo == "CIERRE")
    )
    assert actividad.reporte_corto == CIERRE_CASO

    # Un segundo cierre se rechaza.
    r = client.post(f"{MASIVAS}/{falla['id_falla']}/cierre",
                    json={"descripcion": "Otro cierre cualquiera del mismo día",
                          "id_validador_crass": validador["id_solicitante"]},
                    headers=headers)
    assert r.status_code == 409, r.text


def test_el_cierre_exige_validador_del_crass_activo(client, entorno):
    """RF-61: sin validador del CRASS válido el cierre no procede."""
    headers, id_sector = entorno["headers"], entorno["id_sector"]
    entorno["crear"]("TSTD99-V1")
    r = client.post(MASIVAS, json={"descripcion": "Masiva sin validador válido",
                                   "id_sector": id_sector}, headers=headers)
    id_falla = r.json()["id_falla"]

    cuerpo = {"descripcion": "Trabajo realizado y verificado en sitio",
              "id_validador_crass": 999999}
    r = client.post(f"{MASIVAS}/{id_falla}/cierre", json=cuerpo, headers=headers)
    assert r.status_code == 404, r.text

    inactivo = _crear_personal(client, headers, nombre="CRASS INACTIVO")
    client.patch(f"{PERSONAL}/{inactivo['id_solicitante']}", json={"activo": False},
                 headers=headers)
    cuerpo["id_validador_crass"] = inactivo["id_solicitante"]
    r = client.post(f"{MASIVAS}/{id_falla}/cierre", json=cuerpo, headers=headers)
    assert r.status_code == 409, r.text
    assert "inactivo" in r.json()["detail"]


# --------------------------------------------------------------------------- #
# 4. Jornada del despacho (RF-65 / RF-66)
# --------------------------------------------------------------------------- #
def test_el_corte_de_jornada_cierra_el_despacho_y_devuelve_los_casos(client, entorno,
                                                                    db_session):
    """RF-65/RF-66: a las 23:50 el despacho se cierra y lo no cerrado va a PENDIENTE."""
    headers = entorno["headers"]
    casos = [entorno["crear"](f"TSTD99-J{i}") for i in range(3)]
    creados = _procesar(client, entorno, AYER)
    assert creados, "no se generó ningún despacho para ayer"

    r = client.post(f"{DESPACHOS}/cierre-jornada?solo_vencidos=true", headers=headers)
    assert r.status_code == 200, r.text
    resultado = r.json()
    assert resultado["despachos_cerrados"] >= 1
    assert resultado["casos_pendientes"] >= 1

    db_session.expire_all()
    for caso in casos:
        assert db_session.get(Caso, caso["id_caso"]).estado_actual == "PENDIENTE"

    # El corte informa su hora configurada.
    assert resultado["hora_corte"].count(":") == 1


def test_el_caso_cerrado_sobrevive_al_corte_de_jornada(client, entorno, db_session):
    """El corte respeta los casos que ya tuvieron desenlace."""
    headers = entorno["headers"]
    casos = [entorno["crear"](f"TSTD99-K{i}") for i in range(2)]
    _marcar_tecnico(db_session, [casos[0]["id_caso"]], estado_actual="CERRADO")
    _marcar_tecnico(db_session, [casos[1]["id_caso"]], estado_actual="ENRUTADO")
    _procesar(client, entorno, AYER)
    client.post(f"{DESPACHOS}/cierre-jornada?solo_vencidos=true", headers=headers)
    db_session.expire_all()
    assert db_session.get(Caso, casos[0]["id_caso"]).estado_actual == "CERRADO"
    assert db_session.get(Caso, casos[1]["id_caso"]).estado_actual == "ENRUTADO"


# --------------------------------------------------------------------------- #
# 5. Reporte de producción (RF-70 / RF-71)
# --------------------------------------------------------------------------- #
def test_reporte_de_produccion_con_abiertos_y_marca_de_masiva(client, entorno,
                                                              db_session):
    """RF-70/RF-71: el aro necesita ABIERTOS y ENRUTADO, y el icono MASIVA."""
    headers, id_sector = entorno["headers"], entorno["id_sector"]
    casos = [entorno["crear"](f"TSTD99-R{i}") for i in range(3)]
    _procesar(client, entorno, HOY)
    _marcar_tecnico(db_session, [casos[0]["id_caso"]], estado_actual="CERRADO")
    _marcar_tecnico(db_session, [casos[1]["id_caso"]], estado_actual="ENRUTADO")

    r = client.post(MASIVAS, json={"descripcion": "Masiva con cuadrilla asignada",
                                   "id_sector": id_sector}, headers=headers)
    id_falla = r.json()["id_falla"]
    falla = db_session.get(FallaMasiva, id_falla)
    if falla.id_cuadrilla is None:
        from app.models import Cuadrilla

        id_cuadrilla = db_session.scalar(select(Cuadrilla.id_cuadrilla).where(
            Cuadrilla.id_central == entorno["id_central"]))
        r = client.patch(f"{MASIVAS}/{id_falla}", json={"id_cuadrilla": id_cuadrilla},
                         headers=headers)
        assert r.status_code == 200, r.text

    r = client.get(f"{DESPACHOS}/reporte/produccion?fecha={HOY}", headers=headers)
    assert r.status_code == 200, r.text
    reporte = r.json()
    for clave in ("abiertos", "cerrados", "enrutado", "diferidos", "citados"):
        assert clave in reporte["totales"], clave
    assert reporte["totales"]["cerrados"] == 1
    assert reporte["totales"]["enrutado"] == 1
    assert reporte["totales"]["abiertos"] == 1
    assert any(fila.get("es_masiva") for fila in reporte["por_cuadrilla"])
    assert reporte["totales"]["masivas"] >= 1


# --------------------------------------------------------------------------- #
# 6. Proceso del despacho y aviso a los técnicos (RF-67 / RF-69)
# --------------------------------------------------------------------------- #
def test_el_proceso_marca_la_primera_vez_y_el_reproceso(client, entorno):
    """RF-67: sin sectores guardados es el primer procesamiento de la jornada."""
    r = client.get(f"{DESPACHOS}/proceso?fecha={HOY}", headers=entorno["headers"])
    assert r.status_code == 200, r.text
    primero = r.json()
    assert primero["primera_vez"] is True
    assert primero["reproceso"] is False

    entorno["crear"]("TSTD99-PV1")
    _procesar(client, entorno, HOY)

    r = client.get(f"{DESPACHOS}/proceso?fecha={HOY}", headers=entorno["headers"])
    segundo = r.json()
    assert segundo["reproceso"] is True


def test_el_reproceso_avisa_con_despacho_actualizado(client, entorno, db_session):
    """RF-69: cada procesamiento avisa a la cuadrilla por mensajería interna."""
    entrada = entorno["crear"]("TSTD99-AV1")
    _procesar(client, entorno, HOY)
    db_session.expire_all()
    cuerpo = db_session.scalar(
        select(Mensaje.cuerpo).where(Mensaje.cuerpo.like("DESPACHO DEL D%")).limit(1)
    )
    assert cuerpo, "no se emitió el aviso del primer procesamiento"

    # Reproceso: el aviso cambia de etiqueta.
    r = client.post(f"{CASOS}/{entrada['id_caso']}/estado",
                    json={"estado_actual": "DIFERIDO",
                          "motivo_estado": "cliente ausente"},
                    headers=entorno["headers"])
    assert r.status_code in (200, 201, 204), r.text
    _procesar(client, entorno, HOY)
    db_session.expire_all()
    actualizados = db_session.scalars(
        select(Mensaje.cuerpo).where(Mensaje.cuerpo.like("DESPACHO ACTUALIZADO%"))
    ).all()
    assert actualizados, "el reproceso no emitió DESPACHO ACTUALIZADO"


# --------------------------------------------------------------------------- #
# 7. Descarga de la APK (RF-72)
# --------------------------------------------------------------------------- #
def test_la_descarga_entrega_masivas_y_datos_tecnicos(client, entorno, admin_token,
                                                      db_session):
    """RF-72: la APK recibe las masivas de su cuadrilla y la RUTA del caso."""
    headers, id_sector = entorno["headers"], entorno["id_sector"]
    from app.models import CuadrillaTecnico, Despacho, DespachoCasos, Tecnico

    caso = entorno["crear"]("TSTD99-SY1")
    _marcar_tecnico(db_session, [caso["id_caso"]],
                    extra="RUTA EXTRA 9/2/1", olt="OLT-SYNC")
    _procesar(client, entorno, HOY)

    # La cuadrilla que recibió el caso en el despacho de hoy.
    cuadrilla = db_session.scalar(
        select(Despacho.id_cuadrilla)
        .join(DespachoCasos, DespachoCasos.id_despacho == Despacho.id_despacho)
        .where(DespachoCasos.id_caso == caso["id_caso"])
    )
    assert cuadrilla is not None, "el caso no quedó despachado"

    # La masiva se asigna a esa misma cuadrilla.
    r = client.post(MASIVAS, json={"descripcion": "Masiva que debe viajar a la APK",
                                   "id_sector": id_sector, "id_cuadrilla": cuadrilla},
                    headers=headers)
    assert r.status_code == 201, r.text
    id_falla = r.json()["id_falla"]

    tecnico = db_session.scalar(select(Tecnico).where(Tecnico.p00 == "TESTTEC"))
    db_session.add(CuadrillaTecnico(id_cuadrilla=cuadrilla,
                                    id_tecnico=tecnico.id_tecnico,
                                    desde=date.today()))
    db_session.commit()

    r = client.get("/api/v1/sync/descarga", headers=admin_token["tecnico"])
    assert r.status_code == 200, r.text
    payload = r.json()

    masiva = next((m for m in payload["masivas"] if m["id_falla"] == id_falla), None)
    assert masiva is not None, "la masiva de la cuadrilla no viajó en la descarga"
    assert masiva["casos_asociados"] >= 1
    assert masiva["casos"] and masiva["casos"][0]["ruta"] == "RUTA EXTRA 9/2/1"

    # Los datos técnicos del caso también viajan (el bloque «Técnica» de la APK).
    tecnicos = [c for c in payload["casos"] if c["id_caso"] == caso["id_caso"]]
    assert tecnicos, payload["motivo"]
    assert tecnicos[0]["extra"] == "RUTA EXTRA 9/2/1"
    assert tecnicos[0]["olt"] == "OLT-SYNC"
    assert tecnicos[0]["es_falla_masiva"] is True
