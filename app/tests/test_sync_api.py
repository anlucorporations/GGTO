"""Pruebas de integración de la sincronización móvil (D-73, Ciclo 8).

Cubren la cadena que usa la APK:

- `GET /api/v1/sync/cuadrilla`: cuadrilla vigente del técnico logueado.
- `GET /api/v1/sync/descarga`: casos **de su cuadrilla**, con los **últimos**
  despachos como criterio (un caso reasignado a otra cuadrilla no debe seguir
  llegando), y el modo diferencial (`desde` / `ids_conocidos`).
- `POST /api/v1/sync/carga`: alta de la actividad, cambio de estado y bitácora;
  rechazo de casos ajenos a la cuadrilla del técnico.
- `POST /api/v1/evidencias/upload`: foto de campo (multipart) y sus validaciones.

Se ejecutan contra un esquema aislado (`GGTO_TEST_SCHEMA`), nunca producción.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy import select

from app.models import Cuadrilla, CuadrillaTecnico, Despacho, DespachoCasos, Tecnico, Usuario

BASE = "/api/v1"
SYNC = f"{BASE}/sync"
CASOS = f"{BASE}/casos"

P00_TEC = "TESTTEC"
P00_ADMIN = "TESTADM"


@pytest.fixture()
def entorno_sync(client, admin_token, db_session):
    """Dos cuadrillas, tres casos y la reasignación de uno de ellos.

    - `TESTTEC` queda inscrito en la cuadrilla **A**.
    - `c_a`   : último despacho en A → debe llegarle al técnico de A.
    - `c_b`   : último despacho en B → NO debe llegarle.
    - `c_mov` : despacho de AYER en A y de HOY en B → su último despacho es B,
      así que tampoco debe llegarle a A (caso reasignado).
    """
    headers = admin_token["admin"]
    id_central = admin_token["id_central"]

    r_sector = client.post(
        f"{BASE}/sectores",
        json={"id_central": id_central, "nombre": "Sync Sector", "codigo": "TSY1",
              "direcciones": [{"patron": "SECTOR SYNC"}]},
        headers=headers,
    )
    assert r_sector.status_code == 201, r_sector.text

    cuad_a = client.post(f"{BASE}/cuadrillas",
                         json={"id_central": id_central, "codigo": "TCS1", "nombre": "Sync Uno"},
                         headers=headers)
    cuad_b = client.post(f"{BASE}/cuadrillas",
                         json={"id_central": id_central, "codigo": "TCS2", "nombre": "Sync Dos"},
                         headers=headers)
    assert cuad_a.status_code == 201 and cuad_b.status_code == 201, (cuad_a.text, cuad_b.text)
    id_a = cuad_a.json()["id_cuadrilla"]
    id_b = cuad_b.json()["id_cuadrilla"]

    id_tecnico = db_session.scalar(select(Tecnico.id_tecnico).where(Tecnico.p00 == P00_TEC))
    assert id_tecnico is not None
    inc = client.post(f"{BASE}/cuadrillas/{id_a}/integrantes",
                      json={"id_tecnico": id_tecnico}, headers=headers)
    assert inc.status_code == 201, inc.text

    def crear(id_averia: str, **extra: object) -> dict:
        r = client.post(CASOS, json={"id_averia": id_averia, "direccion": "SECTOR SYNC 1",
                                     "nombre_cliente": f"CLIENTE {id_averia}",
                                     "telefono": "7007000000"}, headers=headers)
        assert r.status_code == 201, r.text
        caso = r.json()
        # Un caso recién creado nace NUEVO; aquí se deja ASIGNADO salvo que el
        # llamador pida conservarlo NUEVO (que es como lo deja el despacho real).
        if extra.get("_conservar_nuevo"):
            cuerpo = dict(caso)
            cuerpo["estado_actual"] = "NUEVO"
            return cuerpo
        p = client.patch(f"{CASOS}/{caso['id_caso']}", json={"estado_actual": "ASIGNADO"},
                         headers=headers)
        assert p.status_code == 200, p.text
        return p.json()

    c_a = crear("TSTSYNC-A")
    c_b = crear("TSTSYNC-B")
    c_mov = crear("TSTSYNC-M")
    # Caso recién despachado que sigue NUEVO (estado real tras generar despacho).
    c_nuevo = crear("TSTSYNC-N", _conservar_nuevo=True)

    hoy = date.today()
    d_ayer_a = Despacho(id_central=id_central, fecha=hoy - timedelta(days=1),
                        id_cuadrilla=id_a, estado="PUBLICADO")
    d_hoy_a = Despacho(id_central=id_central, fecha=hoy, id_cuadrilla=id_a, estado="PUBLICADO")
    d_hoy_b = Despacho(id_central=id_central, fecha=hoy, id_cuadrilla=id_b, estado="PUBLICADO")
    db_session.add_all([d_ayer_a, d_hoy_a, d_hoy_b])
    db_session.flush()
    db_session.add_all([
        DespachoCasos(id_despacho=d_hoy_a.id_despacho, id_caso=c_a["id_caso"],
                      estado="ASIGNADO", orden_visita=1, tipo_asignacion="REPARACION"),
        DespachoCasos(id_despacho=d_hoy_a.id_despacho, id_caso=c_nuevo["id_caso"],
                      estado="ASIGNADO", orden_visita=4, tipo_asignacion="REPARACION"),
        DespachoCasos(id_despacho=d_hoy_b.id_despacho, id_caso=c_b["id_caso"],
                      estado="ASIGNADO", orden_visita=2, tipo_asignacion="REPARACION"),
        DespachoCasos(id_despacho=d_ayer_a.id_despacho, id_caso=c_mov["id_caso"],
                      estado="ASIGNADO", orden_visita=1, tipo_asignacion="REPARACION"),
        DespachoCasos(id_despacho=d_hoy_b.id_despacho, id_caso=c_mov["id_caso"],
                      estado="ASIGNADO", orden_visita=3, tipo_asignacion="REPARACION"),
    ])
    db_session.commit()

    yield {
        "admin": headers,
        "tecnico": admin_token["tecnico"],
        "supervisor": admin_token["supervisor"],
        "id_cuadrilla_a": id_a,
        "id_cuadrilla_b": id_b,
        "c_a": c_a,
        "c_b": c_b,
        "c_mov": c_mov,
        "c_nuevo": c_nuevo,
    }


# --------------------------------------------------------------------------- #
# Cuadrilla del usuario
# --------------------------------------------------------------------------- #
def test_cuadrilla_del_tecnico_es_la_suya(client, entorno_sync):
    r = client.get(f"{SYNC}/cuadrilla", headers=entorno_sync["tecnico"])
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert cuerpo["id_cuadrilla"] == entorno_sync["id_cuadrilla_a"]
    assert cuerpo["codigo"] == "TCS1"
    assert cuerpo["desde"] is not None


def test_cuadrilla_de_un_admin_sin_asignacion_es_nula(client, entorno_sync):
    r = client.get(f"{SYNC}/cuadrilla", headers=entorno_sync["admin"])
    assert r.status_code == 200, r.text
    assert r.json()["id_cuadrilla"] is None


# --------------------------------------------------------------------------- #
# DESCARGA
# --------------------------------------------------------------------------- #
def test_descarga_trae_solo_los_casos_de_su_cuadrilla(client, entorno_sync):
    r = client.get(f"{SYNC}/descarga", headers=entorno_sync["tecnico"])
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    ids = {c["id_caso"] for c in cuerpo["casos"]}

    assert entorno_sync["c_a"]["id_caso"] in ids, "falta el caso asignado a su cuadrilla"
    assert entorno_sync["c_nuevo"]["id_caso"] in ids, "falta el caso NUEVO recién despachado"
    assert entorno_sync["c_b"]["id_caso"] not in ids, "se filtró un caso de otra cuadrilla"

    # Los catálogos viajan siempre para poder operar sin conexión.
    assert cuerpo["catalogos"]["modelos"], "sin catálogo de métodos"
    assert cuerpo["server_ts"]


def test_descarga_no_incluye_caso_reasignado_a_otra_cuadrilla(client, entorno_sync):
    """El criterio es el ÚLTIMO despacho: si el caso pasó a B, A ya no lo baja."""
    r = client.get(f"{SYNC}/descarga", headers=entorno_sync["tecnico"])
    ids = {c["id_caso"] for c in r.json()["casos"]}
    assert entorno_sync["c_mov"]["id_caso"] not in ids, (
        "un caso reasignado a otra cuadrilla sigue llegando al técnico anterior"
    )


def test_descarga_incluye_orden_de_visita(client, entorno_sync):
    r = client.get(f"{SYNC}/descarga", headers=entorno_sync["tecnico"])
    caso = next(c for c in r.json()["casos"] if c["id_caso"] == entorno_sync["c_a"]["id_caso"])
    assert caso["orden_visita"] == 1
    assert caso["tipo_asignacion"] == "REPARACION"


def test_descarga_diferencial_por_ids_conocidos(client, entorno_sync):
    """`ids_conocidos` permite a la APK pedir solo lo que aún no tiene."""
    id_a = entorno_sync["c_a"]["id_caso"]
    r = client.get(f"{SYNC}/descarga", params={"ids_conocidos": [id_a]},
                   headers=entorno_sync["tecnico"])
    assert r.status_code == 200, r.text
    ids = {c["id_caso"] for c in r.json()["casos"]}
    assert id_a not in ids
    assert entorno_sync["c_b"]["id_caso"] not in ids


def test_descarga_diferencial_por_fecha(client, entorno_sync):
    futuro = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    r = client.get(f"{SYNC}/descarga", params={"desde": futuro},
                   headers=entorno_sync["tecnico"])
    assert r.status_code == 200, r.text
    assert r.json()["casos"] == [], "`desde` futuro no debería devolver casos"

    pasado = (datetime.now(UTC) - timedelta(days=1)).isoformat()
    r2 = client.get(f"{SYNC}/descarga", params={"desde": pasado},
                    headers=entorno_sync["tecnico"])
    assert r2.status_code == 200
    assert any(c["id_caso"] == entorno_sync["c_a"]["id_caso"] for c in r2.json()["casos"])


def test_descarga_de_un_admin_sin_cuadrilla_no_falla(client, entorno_sync):
    r = client.get(f"{SYNC}/descarga", headers=entorno_sync["admin"])
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert cuerpo["casos"] == []
    assert cuerpo["catalogos"]["modelos"], "los catálogos deben viajar aunque no haya casos"
    # D-83: la APK ya no dice «no hay casos nuevos»: explica el motivo real.
    assert cuerpo["motivo"] == "SIN_CUADRILLA"
    assert "cuadrilla vigente" in cuerpo["mensaje"]
    assert cuerpo["cuadrilla"] is None


# --------------------------------------------------------------------------- #
# DESCARGA · motivo explícito (D-83)
# --------------------------------------------------------------------------- #
def _id_tecnico_de_prueba(db_session) -> int:
    id_tecnico = db_session.scalar(select(Tecnico.id_tecnico).where(Tecnico.p00 == P00_TEC))
    assert id_tecnico is not None
    return id_tecnico


def _agregar_a_cuadrilla(client, headers, id_cuadrilla: int, id_tecnico: int,
                         rol: str = "REPARADOR_PRINCIPAL") -> None:
    r = client.post(
        f"{BASE}/cuadrillas/{id_cuadrilla}/integrantes",
        json={"id_tecnico": id_tecnico, "rol_cuadrilla": rol},
        headers=headers,
    )
    assert r.status_code == 201, r.text


def _cuadrilla(client, headers, id_central: int, codigo: str, nombre: str,
               es_supervisor: bool = False) -> int:
    r = client.post(
        f"{BASE}/cuadrillas",
        json={"id_central": id_central, "codigo": codigo, "nombre": nombre,
              "es_supervisor": es_supervisor},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()["id_cuadrilla"]


def _cuadrilla_de_gestion(db_session, id_central: int) -> Cuadrilla:
    """Cuadrilla de gestión (C-00) sembrada por `schema.sql`.

    Solo puede existir **una** por central (índice único parcial sobre
    `es_supervisor`), así que no se puede crear otra en las pruebas.
    """
    cuadrilla = db_session.scalar(
        select(Cuadrilla).where(
            Cuadrilla.id_central == id_central, Cuadrilla.es_supervisor.is_(True)
        )
    )
    assert cuadrilla is not None, "falta la cuadrilla de gestión sembrada (C-00)"
    return cuadrilla


def test_descarga_en_cuadrilla_de_gestion_explica_el_motivo(client, entorno_sync, admin_token,
                                                            db_session):
    """La cuadrilla de gestión (C-00) no recibe despacho de campo.

    Era el caso de producción: el técnico quedaba en C-00, la DESCARGA devolvía
    cero casos y la APK lo anunciaba como «No hay casos nuevos ni cambios».
    """
    headers = admin_token["admin"]
    id_tecnico = _id_tecnico_de_prueba(db_session)
    gestion = _cuadrilla_de_gestion(db_session, admin_token["id_central"])

    retiro = client.delete(
        f"{BASE}/cuadrillas/{entorno_sync['id_cuadrilla_a']}/integrantes/{id_tecnico}",
        headers=headers,
    )
    assert retiro.status_code == 204, retiro.text
    _agregar_a_cuadrilla(client, headers, gestion.id_cuadrilla, id_tecnico, "SUPERVISOR")

    r = client.get(f"{SYNC}/descarga", headers=entorno_sync["tecnico"])
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert cuerpo["casos"] == []
    assert cuerpo["motivo"] == "CUADRILLA_GESTION"
    assert cuerpo["cuadrilla"]["codigo"] == gestion.codigo
    assert cuerpo["cuadrilla"]["es_supervisor"] is True
    assert "gestión" in cuerpo["mensaje"]
    assert cuerpo["catalogos"]["modelos"], "los catálogos viajan aunque no haya casos"


def test_descarga_prefiere_la_cuadrilla_de_campo(client, entorno_sync, admin_token, db_session):
    """Con dos cuadrillas vigentes gana la de campo (D-83)."""
    headers = admin_token["admin"]
    id_tecnico = _id_tecnico_de_prueba(db_session)
    gestion = _cuadrilla_de_gestion(db_session, admin_token["id_central"])
    _agregar_a_cuadrilla(client, headers, gestion.id_cuadrilla, id_tecnico, "SUPERVISOR")

    cuerpo = client.get(f"{SYNC}/descarga", headers=entorno_sync["tecnico"]).json()
    assert cuerpo["cuadrilla"]["id_cuadrilla"] == entorno_sync["id_cuadrilla_a"]
    assert cuerpo["motivo"] == "OK"
    ids = {c["id_caso"] for c in cuerpo["casos"]}
    assert entorno_sync["c_a"]["id_caso"] in ids, "perdió el trabajo de la cuadrilla de campo"


def test_descarga_sin_despacho_explica_el_motivo(client, entorno_sync, admin_token, db_session):
    """Cuadrilla de campo sin casos despachados."""
    headers = admin_token["admin"]
    id_tecnico = _id_tecnico_de_prueba(db_session)
    id_vacia = _cuadrilla(client, headers, admin_token["id_central"], "TCS3", "Sin despacho")
    retiro = client.delete(
        f"{BASE}/cuadrillas/{entorno_sync['id_cuadrilla_a']}/integrantes/{id_tecnico}",
        headers=headers,
    )
    assert retiro.status_code == 204, retiro.text
    _agregar_a_cuadrilla(client, headers, id_vacia, id_tecnico)

    cuerpo = client.get(f"{SYNC}/descarga", headers=entorno_sync["tecnico"]).json()
    assert cuerpo["casos"] == []
    assert cuerpo["motivo"] == "SIN_DESPACHO"
    assert cuerpo["cuadrilla"]["codigo"] == "TCS3"
    assert "no tiene casos despachados" in cuerpo["mensaje"]


def test_descarga_sin_tecnico_vinculado_explica_el_motivo(client, entorno_sync, db_session):
    """Cuenta de usuario sin técnico vinculado (no debe quedar en silencio)."""
    usuario = db_session.scalar(select(Usuario).where(Usuario.p00 == P00_ADMIN))
    assert usuario is not None
    usuario.id_tecnico = None
    db_session.commit()

    cuerpo = client.get(f"{SYNC}/descarga", headers=entorno_sync["admin"]).json()
    assert cuerpo["casos"] == []
    assert cuerpo["motivo"] == "SIN_TECNICO"
    assert "no está vinculada a un técnico" in cuerpo["mensaje"]
    assert cuerpo["cuadrilla"] is None


def test_descarga_sin_cambios_explica_el_motivo(client, entorno_sync):
    """El diferencial vacío ya no se confunde con «no hay trabajo»."""
    futuro = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    cuerpo = client.get(f"{SYNC}/descarga", params={"desde": futuro},
                        headers=entorno_sync["tecnico"]).json()
    assert cuerpo["casos"] == []
    assert cuerpo["motivo"] == "SIN_CAMBIOS"
    assert cuerpo["casos_cuadrilla"] > 0, "debe informar cuántos casos tiene la cuadrilla"
    assert "no hay cambios" in cuerpo["mensaje"]


def test_descarga_indica_la_cuadrilla_y_su_total(client, entorno_sync):
    cuerpo = client.get(f"{SYNC}/descarga", headers=entorno_sync["tecnico"]).json()
    assert cuerpo["motivo"] == "OK"
    assert cuerpo["cuadrilla"]["codigo"] == "TCS1"
    assert cuerpo["cuadrilla"]["es_supervisor"] is False
    assert cuerpo["casos_cuadrilla"] >= len(cuerpo["casos"])


# --------------------------------------------------------------------------- #
# Integrantes de cuadrilla (D-83)
# --------------------------------------------------------------------------- #
def test_integrante_duplicado_da_409(client, entorno_sync, admin_token, db_session):
    """No se admite dos veces la misma pertenencia activa."""
    id_tecnico = _id_tecnico_de_prueba(db_session)
    r = client.post(
        f"{BASE}/cuadrillas/{entorno_sync['id_cuadrilla_a']}/integrantes",
        json={"id_tecnico": id_tecnico, "rol_cuadrilla": "SUPERVISOR"},
        headers=admin_token["admin"],
    )
    assert r.status_code == 409, r.text
    assert "activo" in r.json()["detail"]


def test_retirar_integrante_cierra_las_pertenencias_activas(client, entorno_sync, admin_token,
                                                            db_session):
    """Un duplicado heredado también queda cerrado al retirar al técnico."""
    id_a = entorno_sync["id_cuadrilla_a"]
    id_tecnico = _id_tecnico_de_prueba(db_session)
    db_session.add(
        CuadrillaTecnico(
            id_cuadrilla=id_a,
            id_tecnico=id_tecnico,
            rol_cuadrilla="SUPERVISOR",
            desde=date.today() - timedelta(days=1),
        )
    )
    db_session.commit()

    r = client.delete(f"{BASE}/cuadrillas/{id_a}/integrantes/{id_tecnico}",
                      headers=admin_token["admin"])
    assert r.status_code == 204, r.text
    activos = db_session.scalars(
        select(CuadrillaTecnico).where(
            CuadrillaTecnico.id_cuadrilla == id_a,
            CuadrillaTecnico.id_tecnico == id_tecnico,
            CuadrillaTecnico.hasta.is_(None),
        )
    ).all()
    assert list(activos) == [], "quedó una pertenencia activa"


def test_descarga_incluye_caso_recien_despachado_en_nuevo(client, entorno_sync):
    """Un caso recién despachado está `NUEVO` y aun así es trabajo del técnico.

    Era el defecto que dejaba la DESCARGA vacía en producción: el despacho marca
    `despacho_caso.estado = ASIGNADO` pero no cambia `caso.estado_actual`.
    """
    r = client.get(f"{SYNC}/descarga", headers=entorno_sync["tecnico"])
    assert r.status_code == 200, r.text
    ids = {c["id_caso"] for c in r.json()["casos"]}
    assert entorno_sync["c_nuevo"]["id_caso"] in ids, (
        "un caso NUEVO asignado a la cuadrilla debe descargarse"
    )


def test_descarga_excluye_casos_cerrados(client, entorno_sync, db_session):
    """Los casos cerrados ya no son trabajo de campo."""
    id_caso = entorno_sync["c_a"]["id_caso"]
    r = client.patch(f"{CASOS}/{id_caso}", json={"estado_actual": "CERRADO"},
                     headers=entorno_sync["admin"])
    assert r.status_code == 200, r.text

    r = client.get(f"{SYNC}/descarga", headers=entorno_sync["tecnico"])
    ids = {c["id_caso"] for c in r.json()["casos"]}
    assert id_caso not in ids


# --------------------------------------------------------------------------- #
# CARGA
# --------------------------------------------------------------------------- #
def _actividad(id_caso: int, **extra) -> dict:
    base = {
        "id_caso": id_caso,
        "tipo": "CONTACTO",
        "resultado": "EXITOSO",
        "reporte_corto": "Se contactó al abonado",
        "fecha_hora": datetime.now(UTC).isoformat(),
        "latitud": 10.5,
        "longitud": -66.9,
    }
    base.update(extra)
    return base


def test_carga_registra_actividad_y_cambia_estado(client, entorno_sync):
    id_caso = entorno_sync["c_a"]["id_caso"]
    r = client.post(f"{SYNC}/carga",
                    json={"dispositivo_id": "test-dev", "version_app": "test",
                          "actividades": [_actividad(id_caso)], "estados": []},
                    headers=entorno_sync["tecnico"])
    assert r.status_code == 200, r.text
    resumen = r.json()
    assert resumen["aceptadas"] == 1, resumen
    assert resumen["errores"] == []

    # La actividad quedó registrada y el caso pasó a CONTACTADO (bitácora).
    hist = client.get(f"{CASOS}/{id_caso}/historial", headers=entorno_sync["tecnico"])
    assert hist.status_code == 200, hist.text
    assert any(h["estado_nuevo"] == "CONTACTADO" for h in hist.json())


def test_carga_aplica_estados_explicitos(client, entorno_sync):
    id_caso = entorno_sync["c_a"]["id_caso"]
    r = client.post(f"{SYNC}/carga",
                    json={"actividades": [],
                          "estados": [{"id_caso": id_caso, "estado_nuevo": "DIFERIDO",
                                       "motivo": "Cliente ausente"}]},
                    headers=entorno_sync["tecnico"])
    assert r.status_code == 200, r.text
    assert r.json()["aceptadas"] == 1

    caso = client.get(f"{CASOS}/{id_caso}", headers=entorno_sync["tecnico"]).json()
    assert caso["estado_actual"] == "DIFERIDO"


def test_carga_rechaza_caso_de_otra_cuadrilla(client, entorno_sync):
    """Un técnico no puede reportar trabajo sobre casos que no son de su cuadrilla."""
    id_ajeno = entorno_sync["c_b"]["id_caso"]
    r = client.post(f"{SYNC}/carga",
                    json={"actividades": [_actividad(id_ajeno)], "estados": []},
                    headers=entorno_sync["tecnico"])
    assert r.status_code == 200, r.text
    resumen = r.json()
    assert resumen["aceptadas"] == 0
    assert resumen["rechazadas"] == 1
    assert resumen["errores"], "debe explicar por qué se rechazó"

    # El caso ajeno no cambió de estado.
    caso = client.get(f"{CASOS}/{id_ajeno}", headers=entorno_sync["tecnico"]).json()
    assert caso["estado_actual"] == "ASIGNADO"


def test_carga_rechaza_estado_invalido(client, entorno_sync):
    id_caso = entorno_sync["c_a"]["id_caso"]
    r = client.post(f"{SYNC}/carga",
                    json={"actividades": [],
                          "estados": [{"id_caso": id_caso, "estado_nuevo": "INVENTADO"}]},
                    headers=entorno_sync["tecnico"])
    assert r.status_code == 200, r.text
    assert r.json()["rechazadas"] == 1


def test_carga_cierre_con_resultado_de_campo(client, entorno_sync):
    """La APK envía `resultado: EXITOSO`; el DDL solo admite nombres de estado.

    El servidor debe normalizarlo (CERRADO) en vez de reventar contra el CHECK,
    que es lo que rompía el cierre desde el móvil.
    """
    id_caso = entorno_sync["c_a"]["id_caso"]
    r = client.post(f"{SYNC}/carga",
                    json={"actividades": [_actividad(
                        id_caso, tipo="CIERRE", resultado="EXITOSO",
                        reporte_corto="Se reemplazó el conector")], "estados": []},
                    headers=entorno_sync["tecnico"])
    assert r.status_code == 200, r.text
    assert r.json()["aceptadas"] == 1, r.json()

    caso = client.get(f"{CASOS}/{id_caso}", headers=entorno_sync["tecnico"]).json()
    assert caso["estado_actual"] == "CERRADO"


def test_carga_cierre_resuelve_el_modo(client, entorno_sync, db_session):
    """El cierre de campo viaja con `modo` (IVR/COS/SACAS) y llega al catálogo."""
    from app.models import Actividad, CatalogoMetodo

    id_caso = entorno_sync["c_a"]["id_caso"]
    r = client.post(f"{SYNC}/carga",
                    json={"actividades": [_actividad(
                        id_caso, tipo="CIERRE", resultado="EXITOSO", modo="IVR",
                        reporte_corto="Cierre por IVR desde el móvil")], "estados": []},
                    headers=entorno_sync["tecnico"])
    assert r.status_code == 200, r.text
    assert r.json()["aceptadas"] == 1, r.json()

    db_session.expire_all()
    actividad = db_session.scalar(
        select(Actividad).where(Actividad.id_caso == id_caso, Actividad.tipo == "CIERRE")
    )
    assert actividad is not None, "no se registró la actividad de cierre"
    assert actividad.resultado == "CERRADO"
    assert actividad.id_metodo is not None, "se perdió el modo del cierre"
    metodo = db_session.get(CatalogoMetodo, actividad.id_metodo)
    assert metodo is not None and metodo.codigo == "IVR"


def test_carga_enrutado_normaliza_el_tipo(client, entorno_sync):
    """La APK envía `ENRUTADO`; la tabla `actividad` usa `ENRUTE`."""
    id_caso = entorno_sync["c_a"]["id_caso"]
    r = client.post(f"{SYNC}/carga",
                    json={"actividades": [_actividad(
                        id_caso, tipo="ENRUTADO", resultado="ENRUTADO",
                        reporte_corto="Pasa a planta externa")], "estados": []},
                    headers=entorno_sync["tecnico"])
    assert r.status_code == 200, r.text
    assert r.json()["aceptadas"] == 1, r.json()

    caso = client.get(f"{CASOS}/{id_caso}", headers=entorno_sync["tecnico"]).json()
    assert caso["estado_actual"] == "ENRUTADO"


def test_carga_de_cita_no_escribe_actividad(client, entorno_sync):
    """Una CITA no tiene fila propia en `actividad`: solo cambia el estado."""
    id_caso = entorno_sync["c_a"]["id_caso"]
    r = client.post(f"{SYNC}/carga",
                    json={"actividades": [_actividad(id_caso, tipo="CITA")], "estados": []},
                    headers=entorno_sync["tecnico"])
    assert r.status_code == 200, r.text
    assert r.json()["aceptadas"] == 1, r.json()

    caso = client.get(f"{CASOS}/{id_caso}", headers=entorno_sync["tecnico"]).json()
    assert caso["estado_actual"] == "CITADO"


# --------------------------------------------------------------------------- #
# Evidencias (foto de campo)
# --------------------------------------------------------------------------- #
def test_upload_de_evidencia(client, entorno_sync, tmp_path, monkeypatch):
    monkeypatch.setenv("GGTO_EVIDENCIAS_DIR", str(tmp_path))
    id_caso = entorno_sync["c_a"]["id_caso"]
    archivo = {"file": ("foto.jpg", b"\xff\xd8\xff\xe0foto-de-prueba", "image/jpeg")}
    r = client.post(f"{BASE}/evidencias/upload", files=archivo,
                    data={"id_caso": str(id_caso), "tipo": "DEMO",
                          "serial_local": "TSSYNC-A-EVID-01"},
                    headers=entorno_sync["tecnico"])
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert cuerpo["serial_imagen"] == "TSSYNC-A-EVID-01"
    assert cuerpo["ruta_remota"]


def test_upload_rechaza_formato_no_imagen(client, entorno_sync, tmp_path, monkeypatch):
    monkeypatch.setenv("GGTO_EVIDENCIAS_DIR", str(tmp_path))
    archivo = {"file": ("notas.txt", b"texto plano", "text/plain")}
    r = client.post(f"{BASE}/evidencias/upload", files=archivo,
                    data={"id_caso": str(entorno_sync["c_a"]["id_caso"])},
                    headers=entorno_sync["tecnico"])
    assert r.status_code == 422, r.text


def test_upload_rechaza_foto_demasiado_grande(client, entorno_sync, tmp_path, monkeypatch):
    monkeypatch.setenv("GGTO_EVIDENCIAS_DIR", str(tmp_path))
    grande = b"\xff\xd8\xff\xe0" + b"0" * (3 * 1024 * 1024 + 10)
    archivo = {"file": ("grande.jpg", grande, "image/jpeg")}
    r = client.post(f"{BASE}/evidencias/upload", files=archivo,
                    data={"id_caso": str(entorno_sync["c_a"]["id_caso"])},
                    headers=entorno_sync["tecnico"])
    assert r.status_code == 413, r.text
