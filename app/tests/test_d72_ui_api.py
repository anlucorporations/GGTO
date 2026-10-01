"""Pruebas del ciclo D-72 (reorganización del frontend con soporte en API).

Cubre los requisitos solicitados por el usuario:

- 1.3 MONITOREO: parámetro `id_cuadrilla` y alcance automático del rol TECNICO
  (solo ve los datos de su cuadrilla; el SUPERVISOR ve lo global).
- 2 CASOS: filtro por Cuadrilla (último despacho) y texto libre que busca en
  todos los renglones de la tabla.
- 3 ESPECIALES: filtros Actividad/Solicitante/Texto y columnas nuevas
  Dirección/Nombre provenientes del caso asociado.
- 4 AGENDA: filtros del calendario por Tipo y Clase del caso asociado.
- 6 PERFIL: cambio de clave propio, estado de las palabras (nunca los valores)
  y edición del correo.
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest
from sqlalchemy import select

from app.models import Despacho, DespachoCasos, Rol, Tecnico, Usuario

BASE_MON = "/api/v1/monitoreo"
CASOS = "/api/v1/casos"
ESPECIALES = "/api/v1/casos-especiales"
CITAS = "/api/v1/citas"
AUTH = "/api/v1/auth"


@pytest.fixture()
def entorno_d72(client, admin_token, db_session):
    """Dos cuadrillas y tres casos con historial de despachos cruzado.

    - C1 (TSTD72-1): HOY en la cuadrilla A, línea GESTIONADO.
    - C2 (TSTD72-2, CONSTRUCCION/GOBIERNO): HOY en la cuadrilla B.
    - C3 (TSTD72-3): pasó por A (ayer) y su ÚLTIMO despacho es B (hoy).

    TESTTEC es integrante de A: el alcance automático del técnico debe ver el
    historial de A = {C1, C3}.
    """
    headers = admin_token["admin"]
    id_central = admin_token["id_central"]

    r_sector = client.post(
        "/api/v1/sectores",
        json={"id_central": id_central, "nombre": "Omicron", "codigo": "TSO7",
              "direcciones": [{"patron": "SECTOR OMICRON"}]},
        headers=headers,
    )
    assert r_sector.status_code == 201, r_sector.text

    cuad_a = client.post("/api/v1/cuadrillas",
                         json={"id_central": id_central, "codigo": "TCZ1", "nombre": "Zeta Uno"},
                         headers=headers)
    cuad_b = client.post("/api/v1/cuadrillas",
                         json={"id_central": id_central, "codigo": "TCZ2", "nombre": "Zeta Dos"},
                         headers=headers)
    assert cuad_a.status_code == 201 and cuad_b.status_code == 201
    id_a = cuad_a.json()["id_cuadrilla"]
    id_b = cuad_b.json()["id_cuadrilla"]

    id_tecnico = db_session.scalar(select(Tecnico.id_tecnico).where(Tecnico.p00 == "TESTTEC"))
    assert id_tecnico is not None
    inc = client.post(f"/api/v1/cuadrillas/{id_a}/integrantes",
                      json={"id_tecnico": id_tecnico}, headers=headers)
    assert inc.status_code == 201, inc.text

    def crear(id_averia, **extra):
        cuerpo = {"id_averia": id_averia, "direccion": "SECTOR OMICRON 1",
                  "nombre_cliente": f"CLIENTE {id_averia[-1]}", "telefono": "7007000000"}
        cuerpo.update(extra)
        r = client.post(CASOS, json=cuerpo, headers=headers)
        assert r.status_code == 201, r.text
        return r.json()

    c1 = crear("TSTD72-1")
    c2 = crear("TSTD72-2", tipo_caso="CONSTRUCCION", categoria="GOBIERNO")
    c3 = crear("TSTD72-3")

    hoy = date.today()
    d_ayer_a = Despacho(id_central=id_central, fecha=hoy - timedelta(days=1),
                        id_cuadrilla=id_a, estado="PUBLICADO")
    d_hoy_a = Despacho(id_central=id_central, fecha=hoy, id_cuadrilla=id_a, estado="PUBLICADO")
    d_hoy_b = Despacho(id_central=id_central, fecha=hoy, id_cuadrilla=id_b, estado="PUBLICADO")
    db_session.add_all([d_ayer_a, d_hoy_a, d_hoy_b])
    db_session.flush()
    db_session.add_all([
        DespachoCasos(id_despacho=d_hoy_a.id_despacho, id_caso=c1["id_caso"], estado="GESTIONADO"),
        DespachoCasos(id_despacho=d_ayer_a.id_despacho, id_caso=c3["id_caso"], estado="ASIGNADO"),
        DespachoCasos(id_despacho=d_hoy_b.id_despacho, id_caso=c2["id_caso"], estado="ASIGNADO"),
        DespachoCasos(id_despacho=d_hoy_b.id_despacho, id_caso=c3["id_caso"], estado="ASIGNADO"),
    ])
    db_session.commit()

    yield {"headers": headers, "id_cuadrilla_a": id_a, "id_cuadrilla_b": id_b,
           "c1": c1, "c2": c2, "c3": c3, "hoy": hoy}


def _login(client, p00: str, clave: str) -> dict[str, str]:
    r = client.post(AUTH + "/login", json={"p00": p00, "clave": clave})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


# --------------------------------------------------------------------------- #
# 2 · CASOS
# --------------------------------------------------------------------------- #
def test_q_busca_en_toda_la_tabla_casos(client, entorno_d72):
    headers = entorno_d72["headers"]
    for termino in (
        "TSTD72-2",          # ID avería
        "CONSTRUCCION",      # Tipo
        "GOBIERNO",          # Clase
        "Omicron",           # Sector (nombre)
        "SECTOR OMICRON 1",  # Dirección
        "CLIENTE 2",         # Nombre
        "NUEVO",             # Estado
        "7007000000",        # Teléfono (visible en ficha/renglón)
    ):
        r = client.get(CASOS, params={"q": termino}, headers=headers)
        assert r.status_code == 200, r.text
        ids = [c["id_averia"] for c in r.json()["items"]]
        assert "TSTD72-2" in ids, f"«{termino}» no encontró el caso"

    vacio = client.get(CASOS, params={"q": "ZZZ-NO-EXISTE"}, headers=headers).json()
    assert vacio["total"] == 0


def test_filtro_por_cuadrilla_usa_el_ultimo_despacho(client, entorno_d72):
    headers = entorno_d72["headers"]
    en_a = client.get(CASOS, params={"id_cuadrilla": entorno_d72["id_cuadrilla_a"]},
                      headers=headers).json()
    ids_a = sorted(c["id_averia"] for c in en_a["items"])
    assert ids_a == ["TSTD72-1"]  # C3 cambió de cuadrilla: su último despacho es B

    en_b = client.get(CASOS, params={"id_cuadrilla": entorno_d72["id_cuadrilla_b"]},
                      headers=headers).json()
    ids_b = sorted(c["id_averia"] for c in en_b["items"])
    assert ids_b == ["TSTD72-2", "TSTD72-3"]


# --------------------------------------------------------------------------- #
# 3 · ESPECIALES
# --------------------------------------------------------------------------- #
def test_especiales_nuevos_filtros_y_columnas(client, entorno_d72):
    headers = entorno_d72["headers"]
    sol = client.post("/api/v1/solicitantes",
                      json={"unidad": "Gabinete D72", "nombre": "Solicitante Zodri",
                            "contacto": "7007654321"}, headers=headers)
    assert sol.status_code == 201, sol.text
    id_sol = sol.json()["id_solicitante"]

    r = client.post(ESPECIALES, json={
        "clasificacion": "GOBIERNO", "tipo_actividad": "CONSTRUCCION", "prioridad": "ALTA",
        "descripcion": "anillo de fibra institucional",
        "id_solicitante": id_sol,
        "nombre_cliente": "MINISTERIO DEMO", "telefono": "7001112233",
        "direccion": "SECTOR OMICRON 9",
    }, headers=headers)
    assert r.status_code == 201, r.text
    esp = r.json()
    # Columnas nuevas del listado: Dirección y Nombre (del caso asociado).
    assert esp["direccion"] == "SECTOR OMICRON 9"
    assert esp["nombre_cliente"] == "MINISTERIO DEMO"

    por_actividad = client.get(ESPECIALES, params={"tipo_actividad": "CONSTRUCCION"},
                               headers=headers).json()
    assert any(e["id_caso_especial"] == esp["id_caso_especial"] for e in por_actividad)
    por_actividad_otra = client.get(ESPECIALES, params={"tipo_actividad": "REPARACION"},
                                    headers=headers).json()
    assert all(e["id_caso_especial"] != esp["id_caso_especial"] for e in por_actividad_otra)

    por_solicitante = client.get(ESPECIALES, params={"id_solicitante": id_sol},
                                 headers=headers).json()
    assert [e["id_caso_especial"] for e in por_solicitante] == [esp["id_caso_especial"]]

    # Texto libre sobre todos los renglones (cliente, unidad, descripción, clase…).
    for termino in ("MINISTERIO", "Zodri", "institucional", "GOBIERNO", "OMICRON"):
        encontrados = client.get(ESPECIALES, params={"q": termino}, headers=headers).json()
        assert any(e["id_caso_especial"] == esp["id_caso_especial"] for e in encontrados), termino

    vacio = client.get(ESPECIALES, params={"q": "ZZZ-NO-EXISTE"}, headers=headers).json()
    assert vacio == []


# --------------------------------------------------------------------------- #
# 4 · AGENDA: filtros Tipo y Clase del caso asociado
# --------------------------------------------------------------------------- #
def test_citas_se_filtran_por_tipo_y_clase_del_caso(client, entorno_d72):
    headers = entorno_d72["headers"]
    cita = client.post(CITAS, json={
        "fecha_hora": f"{entorno_d72['hoy'].isoformat()}T10:00:00",
        "id_caso": entorno_d72["c2"]["id_caso"],
        "id_cuadrilla": entorno_d72["id_cuadrilla_b"],
    }, headers=headers)
    assert cita.status_code == 201, cita.text
    id_cita = cita.json()["id_cita"]

    por_tipo = client.get(CITAS, params={"tipo_caso": "CONSTRUCCION"}, headers=headers).json()
    assert any(c["id_cita"] == id_cita for c in por_tipo)
    por_tipo_no = client.get(CITAS, params={"tipo_caso": "AVERIA"}, headers=headers).json()
    assert all(c["id_cita"] != id_cita for c in por_tipo_no)

    por_clase = client.get(CITAS, params={"categoria": "GOBIERNO"}, headers=headers).json()
    assert any(c["id_cita"] == id_cita for c in por_clase)
    por_clase_no = client.get(CITAS, params={"categoria": "RESIDENCIAL"}, headers=headers).json()
    assert all(c["id_cita"] != id_cita for c in por_clase_no)


# --------------------------------------------------------------------------- #
# 1.3 · MONITOREO: alcance por cuadrilla (parámetro) y técnico (automático)
# --------------------------------------------------------------------------- #
def test_monitoreo_parametro_id_cuadrilla(client, entorno_d72):
    headers = entorno_d72["headers"]
    a = entorno_d72["id_cuadrilla_a"]
    b = entorno_d72["id_cuadrilla_b"]

    # El alcance del técnico/supervisor por cuadrilla usa TODO el historial de
    # despachos de la cuadrilla: A = {C1, C3}; B = {C2, C3}.
    glob_a = client.get(f"{BASE_MON}/globales", params={"id_cuadrilla": a},
                        headers=headers).json()
    glob_b = client.get(f"{BASE_MON}/globales", params={"id_cuadrilla": b},
                        headers=headers).json()
    assert glob_a["pendientes"] == 2
    assert glob_b["pendientes"] == 2

    diario_a = client.get(
        f"{BASE_MON}/diario",
        params={"fecha": entorno_d72["hoy"].isoformat(), "id_cuadrilla": a},
        headers=headers,
    ).json()
    diario_b = client.get(
        f"{BASE_MON}/diario",
        params={"fecha": entorno_d72["hoy"].isoformat(), "id_cuadrilla": b},
        headers=headers,
    ).json()
    assert diario_a["gestionados"] == 1 and diario_b["gestionados"] == 0

    cap_a = client.get(f"{BASE_MON}/capacidad", params={"id_cuadrilla": a},
                       headers=headers).json()
    assert [c["codigo"] for c in cap_a["cuadrillas"]] == ["TCZ1"]


def test_monitoreo_tecnico_ve_su_cuadrilla(client, entorno_d72):
    h = _login(client, "TESTTEC", "config12345")  # TESTTEC es integrante de TCZ1

    globales = client.get(f"{BASE_MON}/globales", headers=h).json()
    assert globales["pendientes"] == 2  # solo C1 y C3 (el historial de su cuadrilla)

    cap = client.get(f"{BASE_MON}/capacidad", headers=h).json()
    assert [c["codigo"] for c in cap["cuadrillas"]] == ["TCZ1"]

    diario = client.get(f"{BASE_MON}/diario",
                        params={"fecha": entorno_d72["hoy"].isoformat()}, headers=h).json()
    assert diario["gestionados"] == 1

    # Un parámetro id_cuadrilla ajeno NO saca al técnico de su cuadrilla.
    intentado = client.get(f"{BASE_MON}/globales",
                           params={"id_cuadrilla": entorno_d72["id_cuadrilla_b"]},
                           headers=h).json()
    assert intentado["pendientes"] == 2

    # El supervisor no tiene alcance forzado: ve el total (3 casos).
    h_spv = _login(client, "TESTSPV", "config12345")
    glob_spv = client.get(f"{BASE_MON}/globales", headers=h_spv).json()
    assert glob_spv["pendientes"] == 3


# --------------------------------------------------------------------------- #
# 6 · PERFIL Y CUENTA
# --------------------------------------------------------------------------- #
def test_cambio_clave_propio(client, admin_token):
    h = _login(client, "TESTADM", "config12345")
    r = client.post(AUTH + "/cambio-clave", headers=h, json={
        "clave_actual": "config12345", "clave_nueva": "nueva123456",
        "confirmacion": "nueva123456",
    })
    assert r.status_code == 200, r.text
    # La clave nueva funciona y la vieja ya no.
    assert client.post(AUTH + "/login",
                       json={"p00": "TESTADM", "clave": "nueva123456"}).status_code == 200
    assert client.post(AUTH + "/login",
                       json={"p00": "TESTADM", "clave": "config12345"}).status_code == 401


def test_cambio_clave_rechazos(client, admin_token):
    h = _login(client, "TESTADM", "config12345")
    mala_actual = client.post(AUTH + "/cambio-clave", headers=h, json={
        "clave_actual": "equivocada1", "clave_nueva": "nueva123456",
        "confirmacion": "nueva123456",
    })
    assert mala_actual.status_code == 401
    no_coincide = client.post(AUTH + "/cambio-clave", headers=h, json={
        "clave_actual": "config12345", "clave_nueva": "nueva123456",
        "confirmacion": "otra123456",
    })
    assert no_coincide.status_code == 422
    identica = client.post(AUTH + "/cambio-clave", headers=h, json={
        "clave_actual": "config12345", "clave_nueva": "config12345",
        "confirmacion": "config12345",
    })
    assert identica.status_code == 422
    sin_token = client.post(AUTH + "/cambio-clave", json={
        "clave_actual": "x", "clave_nueva": "nueva123456", "confirmacion": "nueva123456",
    })
    assert sin_token.status_code in (401, 403)


def test_mi_seguridad_sin_palabras(client, admin_token):
    h = _login(client, "TESTADM", "config12345")
    r = client.get(AUTH + "/mi-seguridad", headers=h)
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert cuerpo["p00"] == "TESTADM"
    assert cuerpo["tiene_palabras"] is False
    assert cuerpo["cantidad"] == 0
    # Nunca se devuelven los valores de las palabras.
    assert "palabras" not in cuerpo


def test_estado_de_palabras_tras_setup(client, admin_token, db_session):
    db_session.query(Usuario).filter(Usuario.p00 == "TSTPD72").delete()
    db_session.query(Tecnico).filter(Tecnico.p00 == "TSTPD72").delete()
    db_session.commit()
    rol = db_session.scalar(select(Rol).where(Rol.codigo == "TECNICO"))
    assert rol is not None
    tec = Tecnico(id_central=admin_token["id_central"], nombre="PAL", apellido="D72",
                  p00="TSTPD72", cedula="V-PALD72", status="ACTIVO")
    db_session.add(tec)
    db_session.commit()

    setup = client.post(AUTH + "/setup", json={
        "p00": "TSTPD72", "correo": "palabras.d72@example.test",
        "clave": "primer123456", "confirmacion": "primer123456",
    })
    assert setup.status_code == 200, setup.text
    assert len(setup.json()["palabras"]) == 12  # se muestran UNA sola vez

    h = _login(client, "TSTPD72", "primer123456")
    seg = client.get(AUTH + "/mi-seguridad", headers=h).json()
    assert seg["tiene_palabras"] is True
    assert seg["cantidad"] == 12
    assert seg["version"] >= 1
    assert "palabras" not in seg


def test_patch_me_actualiza_correo(client, admin_token):
    h = _login(client, "TESTADM", "config12345")
    r = client.patch(AUTH + "/me", headers=h, json={"correo": "nuevo.perfil@example.test"})
    assert r.status_code == 200, r.text
    assert r.json()["correo"] == "nuevo.perfil@example.test"
    me = client.get(AUTH + "/me", headers=h).json()
    assert me["correo"] == "nuevo.perfil@example.test"

    # Sin token no se puede editar el perfil.
    sin_token = client.patch(AUTH + "/me", json={"correo": "otro@example.test"})
    assert sin_token.status_code in (401, 403)
