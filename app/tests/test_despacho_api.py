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


def test_cuadrilla_0_recibe_los_casos_en_gestion(client, entorno, db_session):
    """D-77: los casos en GESTIÓN ya no se descartan; van a la cuadrilla 0."""
    caso = db_session.scalar(select(Caso).where(Caso.id_averia == "TSTD-A0"))
    caso.en_gestion_supervisor = True
    db_session.commit()

    p = _propuesta(client, entorno)
    grupos = {g["codigo"]: g for g in p["grupos"]}
    assert "C-00" in grupos, "debe existir el grupo de la cuadrilla 0"
    assert grupos["C-00"]["es_supervisor"] is True
    assert [c["id_averia"] for c in grupos["C-00"]["casos"]] == ["TSTD-A0"]
    # No se cuela en las cuadrillas de calle y el universo no pierde casos
    calle = [c["id_averia"] for cod, g in grupos.items() if cod != "C-00" for c in g["casos"]]
    assert "TSTD-A0" not in calle
    assert p["resumen"]["total_casos"] == 10
    assert p["reglas"]["gestion_cuadrilla0"] == 1


def test_excluye_casos_cerrados(client, entorno, db_session):
    caso = db_session.scalar(select(Caso).where(Caso.id_averia == "TSTD-B0"))
    caso.estado_actual = "CERRADO"
    db_session.commit()
    assert _propuesta(client, entorno)["resumen"]["total_casos"] == 9


def test_citado_en_gestion_no_se_pierde_y_va_a_la_cuadrilla_0(client, entorno, db_session):
    """D-77: un compromiso del día no se queda fuera; se despacha con la cuadrilla 0."""
    from datetime import datetime

    caso = db_session.scalar(select(Caso).where(Caso.id_averia == "TSTD-A1"))
    caso.en_gestion_supervisor = True
    caso.fecha_cita = datetime.fromisoformat(f"{HOY}T10:00:00")
    db_session.commit()

    p = _propuesta(client, entorno)
    grupos = {g["codigo"]: g for g in p["grupos"]}
    asignados = {c["id_averia"]: c for g in p["grupos"] for c in g["casos"]}
    assert "TSTD-A1" in asignados
    assert asignados["TSTD-A1"]["es_cita"] is True
    assert [c["id_averia"] for c in grupos["C-00"]["casos"]] == ["TSTD-A1"]


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
# Asignación diaria de sectores por cuadrilla (D-66)
# --------------------------------------------------------------------------- #
def _proceso(client, entorno, fecha=HOY):
    r = client.get(f"{BASE}/proceso", params={"fecha": fecha}, headers=entorno["headers"])
    assert r.status_code == 200, r.text
    return r.json()


def _asignar(client, entorno, nombre_a_codigo, fecha=HOY):
    """Asigna cada sector (por nombre) a la cuadrilla indicada por código."""
    p = _proceso(client, entorno, fecha)
    sectores = {s["nombre"]: s["id_sector"] for s in p["sectores"]}
    cuadrillas = {c["codigo"]: c["id_cuadrilla"] for c in p["cuadrillas"]}
    bloques: dict[int, list[int]] = {c["id_cuadrilla"]: [] for c in p["cuadrillas"]}
    for nombre, codigo in nombre_a_codigo.items():
        if nombre in sectores and codigo in cuadrillas:
            bloques[cuadrillas[codigo]].append(sectores[nombre])
    asignaciones = [{"id_cuadrilla": idc, "ids_sector": ids} for idc, ids in bloques.items()]
    r = client.put(
        f"{BASE}/asignacion",
        json={"fecha": fecha, "asignaciones": asignaciones},
        headers=entorno["headers"],
    )
    assert r.status_code == 200, r.text
    return r.json()


def test_proceso_muestra_universo_sectores_y_cuadrillas(client, entorno):
    p = _proceso(client, entorno)

    assert p["universo"]["total"] == 10
    assert p["universo"]["comunes"] + p["universo"]["especiales"] == 10
    assert p["universo"]["especiales"] == 4  # 2 referidos + empresa + construcción/empresa
    assert len(p["universo"]["casos"]) == 10

    # Sectores con su total de casos
    totales = {s["nombre"]: s["total"] for s in p["sectores"]}
    assert totales == {"Alfa": 6, "Beta": 4}
    assert sum(totales.values()) == 10

    # Cuadrillas con los sectores asignados (propuesta automática la primera vez).
    # D-77: la cuadrilla 0 también viaja en el formulario, sin sectores.
    calle = [c for c in p["cuadrillas"] if not c["es_supervisor"]]
    assert len(calle) == 2
    c0 = [c for c in p["cuadrillas"] if c["es_supervisor"]]
    assert len(c0) == 1 and c0[0]["ids_sector"] == []
    assert p["asignacion_origen"] == "PROPUESTA"

    # Tras guardar, la asignación queda registrada
    p2 = _asignar(client, entorno, {"Alfa": "TCD1", "Beta": "TCD2"})
    assert p2["asignacion_origen"] == "GUARDADA"
    por_codigo = {c["codigo"]: set(c["ids_sector"]) for c in p2["cuadrillas"]}
    alfa = next(s["id_sector"] for s in p2["sectores"] if s["nombre"] == "Alfa")
    beta = next(s["id_sector"] for s in p2["sectores"] if s["nombre"] == "Beta")
    assert por_codigo["TCD1"] == {alfa}
    assert por_codigo["TCD2"] == {beta}


def test_reparto_por_sector_asignado(client, entorno):
    p = _asignar(client, entorno, {"Alfa": "TCD1", "Beta": "TCD2"})
    grupos = {g["codigo"]: {c["id_averia"] for c in g["casos"]} for g in p["grupos"]}

    # Cada cuadrilla recibe los casos de su sector (la construcción queda en Alfa)
    assert grupos["TCD1"] == {"TSTD-A0", "TSTD-A1", "TSTD-A2", "TSTD-A3", "TSTD-E0", "TSTD-C0"}
    assert grupos["TCD2"] == {"TSTD-B0", "TSTD-B1", "TSTD-R0", "TSTD-R1"}
    assert p["resumen"]["asignados"] == 10
    assert p["resumen"]["por_cuadrilla"] == {"TCD1": 6, "TCD2": 4}


def test_sector_sin_cuadrilla_queda_sin_asignar(client, entorno):
    # Solo Beta tiene cuadrilla; Alfa queda sin asignar
    p = _asignar(client, entorno, {"Beta": "TCD2"})
    sin_asignar = {c["id_averia"] for c in p["sin_asignar"]}
    assert "TSTD-A0" in sin_asignar
    assert p["reglas"]["sectores_sin_cuadrilla"]
    # Los referidos (Beta) sí se despachan
    grupos = {g["codigo"]: [c["id_averia"] for c in g["casos"]] for g in p["grupos"]}
    assert "TSTD-R0" in grupos["TCD2"]


def test_citado_sin_sector_asignado_no_se_pierde(client, entorno, db_session):
    from datetime import datetime

    caso = db_session.scalar(select(Caso).where(Caso.id_averia == "TSTD-B0"))
    caso.fecha_cita = datetime.fromisoformat(f"{HOY}T09:00:00")
    db_session.commit()

    # Alfa queda sin cuadrilla; el citado de Beta sí entra
    p = _asignar(client, entorno, {"Alfa": "TCD1"})
    asignados = {c["id_averia"] for g in p["grupos"] for c in g["casos"]}
    assert "TSTD-B0" in asignados
    assert p["reglas"]["citados_reasignados"] >= 1


def test_procesar_guarda_despachos_con_la_asignacion(client, entorno):
    _asignar(client, entorno, {"Alfa": "TCD1", "Beta": "TCD2"})

    r = client.post(
        f"{BASE}/procesar",
        json={"fecha": HOY, "asignaciones": [], "reemplazar": True},
        headers=entorno["headers"],
    )
    assert r.status_code == 201, r.text
    creados = r.json()
    assert len(creados) == 2

    # Re-procesar reemplaza los borradores (no duplica)
    r2 = client.post(
        f"{BASE}/procesar",
        json={"fecha": HOY, "asignaciones": [], "reemplazar": True},
        headers=entorno["headers"],
    )
    assert r2.status_code == 201
    assert len(r2.json()) == 2


def test_despacho_incluye_casos_especiales(client, entorno):
    p = _propuesta(client, entorno)
    filas = [c for g in p["grupos"] for c in g["casos"]]
    categorias = {c["categoria"] for c in filas}
    assert {"REFERIDO", "EMPRESA"} <= categorias
    assert p["reglas"]["especiales_asignados"] >= 4
    assert all(c["especial"] for c in filas if c["categoria"] in ("REFERIDO", "EMPRESA", "GOBIERNO"))


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


def test_agrega_caso_de_cuadrilla_0_al_despacho_que_el_supervisor_elija(client, entorno, db_session):
    """D-77: el antiguo 409 desaparece; la asignación explícita del supervisor manda."""
    despachos = client.post(BASE, params={"fecha": HOY}, headers=entorno["headers"]).json()
    caso = db_session.scalar(select(Caso).where(Caso.id_averia == "TSTD-C0"))
    id_caso = caso.id_caso

    # El caso ya quedó repartido: se saca de su despacho para poder reasignarlo
    dueno = next(
        d for d in despachos
        if id_caso in [c["id_caso"] for c in client.get(
            f"{BASE}/{d['id_despacho']}", headers=entorno["headers"]).json()["casos"]]
    )
    assert client.delete(f"{BASE}/{dueno['id_despacho']}/casos/{id_caso}",
                         headers=entorno["headers"]).status_code == 200

    db_session.refresh(caso)
    caso.en_gestion_supervisor = True
    db_session.commit()

    otro = next(d for d in despachos if d["id_despacho"] != dueno["id_despacho"])
    r = client.post(f"{BASE}/{otro['id_despacho']}/casos", json={"id_caso": id_caso},
                    headers=entorno["headers"])
    assert r.status_code == 200, r.text
    assert id_caso in [c["id_caso"] for c in r.json()["casos"]]


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


# --------------------------------------------------------------------------- #
# Cuadrilla 0 en el proceso y asignación manual a cuadrillas (ciclo D-77)
# --------------------------------------------------------------------------- #
def _id_caso(db_session, id_averia: str) -> int:
    return int(db_session.scalar(select(Caso.id_caso).where(Caso.id_averia == id_averia)))


def _id_cuadrilla(db_session, codigo: str) -> int:
    return int(db_session.scalar(select(Cuadrilla.id_cuadrilla).where(Cuadrilla.codigo == codigo)))


def _grupo_de(db_session, id_caso: int) -> dict:
    """Devuelve el despacho BORRADOR del día que contiene el caso (o {})."""
    from app.models import Despacho, DespachoCasos

    despacho = db_session.scalar(
        select(Despacho)
        .join(DespachoCasos, DespachoCasos.id_despacho == Despacho.id_despacho)
        .where(DespachoCasos.id_caso == id_caso)
    )
    if despacho is None:
        return {}
    return {
        "id_despacho": despacho.id_despacho,
        "id_cuadrilla": despacho.id_cuadrilla,
        "estado": despacho.estado,
    }


def test_procesar_crea_despacho_de_la_cuadrilla_0(client, entorno, db_session):
    """D-77 (punto 3): al procesar, los casos en GESTIÓN se despachan a la cuadrilla 0."""
    from app.models import Despacho

    caso = db_session.scalar(select(Caso).where(Caso.id_averia == "TSTD-A0"))
    caso.en_gestion_supervisor = True
    db_session.commit()

    r = client.post(
        f"{BASE}/procesar",
        json={"fecha": HOY, "asignaciones": [], "reemplazar": True},
        headers=entorno["headers"],
    )
    assert r.status_code == 201, r.text
    despachos = r.json()
    assert len(despachos) == 3, "dos cuadrillas de calle + la cuadrilla 0"

    supervisor = db_session.scalar(
        select(Despacho).where(
            Despacho.fecha == date.fromisoformat(HOY),
            Despacho.id_cuadrilla == _id_cuadrilla(db_session, "C-00"),
        )
    )
    assert supervisor is not None and supervisor.estado == "BORRADOR"
    detalle = client.get(f"{BASE}/{supervisor.id_despacho}", headers=entorno["headers"]).json()
    assert [c["id_caso"] for c in detalle["casos"]] == [_id_caso(db_session, "TSTD-A0")]
    assert detalle["cuadrilla_codigo"] == "C-00"


def test_proceso_muestra_la_cuadrilla_0_sin_sectores(client, entorno):
    """El formulario de proceso incluye la cuadrilla 0 (sin sectores) para poder asignarle."""
    proceso = client.get(f"{BASE}/proceso", params={"fecha": HOY}, headers=entorno["headers"]).json()
    por_codigo = {c["codigo"]: c for c in proceso["cuadrillas"]}
    assert "C-00" in por_codigo
    assert por_codigo["C-00"]["es_supervisor"] is True
    assert por_codigo["C-00"]["ids_sector"] == []


def test_asignar_casos_a_una_cuadrilla(client, entorno, db_session):
    """D-77 (punto 4): el supervisor asigna casos comunes a una cuadrilla."""
    id_caso = _id_caso(db_session, "TSTD-A0")
    id_cuadrilla = _id_cuadrilla(db_session, "TCD1")

    r = client.post(
        f"{BASE}/asignar-casos",
        json={"id_cuadrilla": id_cuadrilla, "ids_caso": [id_caso], "fecha": HOY},
        headers=entorno["headers"],
    )
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert cuerpo["agregados"] == 1
    assert cuerpo["cuadrilla_codigo"] == "TCD1"
    assert cuerpo["id_despacho"]

    grupo = _grupo_de(db_session, id_caso)
    assert grupo["id_cuadrilla"] == id_cuadrilla
    assert grupo["estado"] == "BORRADOR"
    detalle = client.get(f"{BASE}/{grupo['id_despacho']}", headers=entorno["headers"]).json()
    assert [c["id_caso"] for c in detalle["casos"]] == [id_caso]
    assert detalle["casos"][0]["orden_visita"] == 1


def test_asignar_caso_en_gestion_marca_y_desmarca(client, entorno, db_session):
    """Asignar a la cuadrilla 0 marca el caso; pasarlo a una de calle lo desmarca."""
    id_caso = _id_caso(db_session, "TSTD-A1")
    c0 = _id_cuadrilla(db_session, "C-00")
    c1 = _id_cuadrilla(db_session, "TCD1")

    assert client.post(
        f"{BASE}/asignar-casos",
        json={"id_cuadrilla": c0, "ids_caso": [id_caso], "fecha": HOY},
        headers=entorno["headers"],
    ).status_code == 200
    caso = db_session.get(Caso, id_caso)
    db_session.refresh(caso)
    assert caso.en_gestion_supervisor is True

    # Mover a una cuadrilla de calle: se mueve de despacho y se desmarca
    r = client.post(
        f"{BASE}/asignar-casos",
        json={"id_cuadrilla": c1, "ids_caso": [id_caso], "fecha": HOY},
        headers=entorno["headers"],
    )
    assert r.status_code == 200, r.text
    assert r.json()["movidos"] == 1 and r.json()["agregados"] == 0
    db_session.refresh(caso)
    assert caso.en_gestion_supervisor is False
    assert _grupo_de(db_session, id_caso)["id_cuadrilla"] == c1


def test_asignar_caso_especial_a_una_cuadrilla(client, entorno, db_session):
    """D-77 (punto 4): también los casos especiales se asignan a una cuadrilla."""
    especial = client.post(
        "/api/v1/casos-especiales",
        json={"descripcion": "Poste caído frente a la escuela",
              "clasificacion": "GOBIERNO", "prioridad": "ALTA",
              "tipo_actividad": "REPARACION",
              "direccion": "SECTOR ALFA CALLE 9"},
        headers=entorno["headers"],
    )
    assert especial.status_code == 201, especial.text
    id_especial = especial.json()["id_caso_especial"]
    id_caso = especial.json()["id_caso"]
    assert id_caso, "el especial debe tener un caso asociado"

    id_cuadrilla = _id_cuadrilla(db_session, "TCD2")
    r = client.post(
        f"{BASE}/asignar-casos",
        json={"id_cuadrilla": id_cuadrilla, "ids_caso_especial": [id_especial], "fecha": HOY},
        headers=entorno["headers"],
    )
    assert r.status_code == 200, r.text
    assert r.json()["agregados"] == 1
    assert _grupo_de(db_session, id_caso)["id_cuadrilla"] == id_cuadrilla


def test_quitar_casos_del_despacho(client, entorno, db_session):
    """D-77: quitar saca el caso del borrador y borra el despacho que queda vacío."""
    from app.models import Despacho

    id_caso = _id_caso(db_session, "TSTD-B0")
    id_cuadrilla = _id_cuadrilla(db_session, "TCD1")
    alta = client.post(
        f"{BASE}/asignar-casos",
        json={"id_cuadrilla": id_cuadrilla, "ids_caso": [id_caso], "fecha": HOY},
        headers=entorno["headers"],
    ).json()
    id_despacho = alta["id_despacho"]

    r = client.post(
        f"{BASE}/quitar-casos",
        json={"ids_caso": [id_caso], "fecha": HOY},
        headers=entorno["headers"],
    )
    assert r.status_code == 200, r.text
    assert r.json()["quitados"] == 1
    assert _grupo_de(db_session, id_caso) == {}
    assert db_session.get(Despacho, id_despacho) is None, "el borrador vacío se elimina"


def test_no_se_puede_asignar_en_despacho_publicado(client, entorno, db_session):
    """Un despacho publicado no se modifica: el caso queda en `omitidos`."""
    id_caso = _id_caso(db_session, "TSTD-B1")
    c1 = _id_cuadrilla(db_session, "TCD1")
    alta = client.post(
        f"{BASE}/asignar-casos",
        json={"id_cuadrilla": c1, "ids_caso": [id_caso], "fecha": HOY},
        headers=entorno["headers"],
    ).json()
    assert client.patch(f"{BASE}/{alta['id_despacho']}", json={"estado": "PUBLICADO"},
                        headers=entorno["headers"]).status_code == 200

    c2 = _id_cuadrilla(db_session, "TCD2")
    r = client.post(
        f"{BASE}/asignar-casos",
        json={"id_cuadrilla": c2, "ids_caso": [id_caso], "fecha": HOY},
        headers=entorno["headers"],
    )
    assert r.status_code == 200, r.text
    assert id_caso in r.json()["omitidos"]
    assert _grupo_de(db_session, id_caso)["id_cuadrilla"] == c1

    # Quitar tampoco lo toca
    q = client.post(f"{BASE}/quitar-casos", json={"ids_caso": [id_caso], "fecha": HOY},
                    headers=entorno["headers"]).json()
    assert q["quitados"] == 0 and id_caso in q["omitidos"]


def test_asignar_sin_cuadrilla_es_400(client, entorno, db_session):
    r = client.post(f"{BASE}/asignar-casos",
                    json={"ids_caso": [_id_caso(db_session, "TSTD-A0")], "fecha": HOY},
                    headers=entorno["headers"])
    assert r.status_code == 400
    assert client.post(f"{BASE}/quitar-casos", json={"fecha": HOY},
                       headers=entorno["headers"]).status_code == 400


def test_tecnico_no_asigna_casos(client, entorno, admin_token, db_session):
    r = client.post(f"{BASE}/asignar-casos",
                    json={"id_cuadrilla": _id_cuadrilla(db_session, "TCD1"),
                          "ids_caso": [_id_caso(db_session, "TSTD-A0")], "fecha": HOY},
                    headers=admin_token["tecnico"])
    assert r.status_code == 403
