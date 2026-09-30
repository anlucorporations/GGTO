"""Pruebas de integración del Ciclo 4: PANEL y CASOS."""

from __future__ import annotations

import pytest
from sqlalchemy import func, select

from app.models import Caso, CasoEstadoHist

BASE = "/api/v1/casos"
CASO_MANUAL = {
    "categoria": "RESIDENCIAL",
    "tipo_caso": "AVERIA",
    "nombre_cliente": "CLIENTE MANUAL",
    "telefono": "7001234567",
    "direccion": "CALLE VALLE ARRIBA 123",
    "informacion": "Prueba de alta manual",
    "problema_reporte": "NO NAVEGA",
}


@pytest.fixture()
def sector_valle(client, admin_token):
    r = client.post(
        "/api/v1/sectores",
        json={
            "id_central": admin_token["id_central"],
            "nombre": "Valle Test",
            "codigo": "TSV1",
            "direcciones": [{"patron": "VALLE ARRIBA"}],
        },
        headers=admin_token["admin"],
    )
    assert r.status_code == 201, r.text
    return r.json()


# --------------------------------------------------------------------------- #
# Acceso
# --------------------------------------------------------------------------- #
def test_sin_token(client):
    assert client.get(BASE).status_code == 401


def test_tecnico_puede_leer_pero_no_escribir(client, admin_token):
    assert client.get(BASE, headers=admin_token["tecnico"]).status_code == 200
    r = client.post(BASE, json=CASO_MANUAL, headers=admin_token["tecnico"])
    assert r.status_code == 403


# --------------------------------------------------------------------------- #
# Alta manual (RF-32)
# --------------------------------------------------------------------------- #
def test_alta_manual_genera_identificador_ref(client, admin_token):
    r = client.post(BASE, json=CASO_MANUAL, headers=admin_token["admin"])
    assert r.status_code == 201, r.text
    caso = r.json()
    assert caso["id_averia"].startswith("REF-2324X-")
    assert caso["origen"] == "MANUAL"
    assert caso["estado_actual"] == "NUEVO"
    assert caso["en_gestion_supervisor"] is False


def test_alta_manual_con_id_explicito(client, admin_token):
    r = client.post(BASE, json={**CASO_MANUAL, "id_averia": "MAN-0001"},
                    headers=admin_token["admin"])
    assert r.status_code == 201
    assert r.json()["id_averia"] == "MAN-0001"

    duplicado = client.post(BASE, json={**CASO_MANUAL, "id_averia": "MAN-0001"},
                            headers=admin_token["admin"])
    assert duplicado.status_code == 409


def test_alta_manual_sectoriza_por_direccion(client, admin_token, sector_valle):
    r = client.post(BASE, json={**CASO_MANUAL, "id_averia": "MAN-0002"},
                    headers=admin_token["admin"])
    assert r.status_code == 201
    assert r.json()["id_sector"] == sector_valle["id_sector"]


def test_alta_manual_registra_historial_inicial(client, admin_token, db_session):
    caso = client.post(BASE, json={**CASO_MANUAL, "id_averia": "MAN-0003"},
                       headers=admin_token["admin"]).json()
    hist = client.get(f"{BASE}/{caso['id_caso']}/historial", headers=admin_token["admin"]).json()
    assert len(hist) == 1
    assert hist[0]["estado_nuevo"] == "NUEVO"
    assert hist[0]["estado_anterior"] is None


# --------------------------------------------------------------------------- #
# Búsqueda (RF-30) y ficha (RF-31)
# --------------------------------------------------------------------------- #
def test_buscar_por_id_averia(client, admin_token):
    client.post(BASE, json={**CASO_MANUAL, "id_averia": "MAN-0010"},
                headers=admin_token["admin"])
    r = client.get(f"{BASE}/buscar", params={"id_averia": "MAN-0010"},
                   headers=admin_token["admin"])
    assert r.status_code == 200
    assert [c["id_averia"] for c in r.json()] == ["MAN-0010"]


def test_buscar_por_telefono(client, admin_token):
    client.post(BASE, json={**CASO_MANUAL, "id_averia": "MAN-0011",
                            "telefono": "7009998888"}, headers=admin_token["admin"])
    r = client.get(f"{BASE}/buscar", params={"telefono": "7009998888"},
                   headers=admin_token["admin"])
    assert r.status_code == 200
    assert any(c["id_averia"] == "MAN-0011" for c in r.json())


def test_buscar_sin_parametros(client, admin_token):
    r = client.get(f"{BASE}/buscar", headers=admin_token["admin"])
    assert r.status_code == 422


def test_ficha_y_404(client, admin_token):
    caso = client.post(BASE, json={**CASO_MANUAL, "id_averia": "MAN-0012"},
                       headers=admin_token["admin"]).json()
    ficha = client.get(f"{BASE}/{caso['id_caso']}", headers=admin_token["admin"])
    assert ficha.status_code == 200
    assert ficha.json()["id_averia"] == "MAN-0012"
    assert client.get(f"{BASE}/999999", headers=admin_token["admin"]).status_code == 404


# --------------------------------------------------------------------------- #
# Edición y bitácora (RF-31 / RNF-12)
# --------------------------------------------------------------------------- #
def test_edicion_registra_historial_de_estado(client, admin_token, db_session):
    caso = client.post(BASE, json={**CASO_MANUAL, "id_averia": "MAN-0020"},
                       headers=admin_token["admin"]).json()

    r = client.patch(
        f"{BASE}/{caso['id_caso']}",
        json={"estado_actual": "CONTACTADO", "motivo_estado": "Cliente contactado",
              "ultimo_comentario": "acordada visita"},
        headers=admin_token["admin"],
    )
    assert r.status_code == 200, r.text
    assert r.json()["estado_actual"] == "CONTACTADO"
    assert r.json()["ultimo_comentario"] == "acordada visita"

    hist = client.get(f"{BASE}/{caso['id_caso']}/historial", headers=admin_token["admin"]).json()
    assert len(hist) == 2
    assert hist[0]["estado_nuevo"] == "CONTACTADO"
    assert hist[0]["estado_anterior"] == "NUEVO"
    assert hist[0]["motivo"] == "Cliente contactado"
    assert hist[0]["usuario"] == "TESTADM"

    # Cambiar al mismo estado no añade bitácora
    client.patch(f"{BASE}/{caso['id_caso']}", json={"estado_actual": "CONTACTADO"},
                 headers=admin_token["admin"])
    assert len(client.get(f"{BASE}/{caso['id_caso']}/historial",
                          headers=admin_token["admin"]).json()) == 2

    assert db_session.scalar(select(func.count()).select_from(CasoEstadoHist)) == 2


def test_edicion_recalcula_sector(client, admin_token, sector_valle):
    caso = client.post(BASE, json={**CASO_MANUAL, "id_averia": "MAN-0021",
                                   "direccion": "OTRA DIRECCION"},
                       headers=admin_token["admin"]).json()
    assert caso["id_sector"] is None

    r = client.patch(f"{BASE}/{caso['id_caso']}",
                     json={"direccion": "SECTOR VALLE ARRIBA, CASA 9"},
                     headers=admin_token["admin"])
    assert r.status_code == 200
    assert r.json()["id_sector"] == sector_valle["id_sector"]


def test_estado_invalido(client, admin_token):
    caso = client.post(BASE, json={**CASO_MANUAL, "id_averia": "MAN-0022"},
                       headers=admin_token["admin"]).json()
    r = client.patch(f"{BASE}/{caso['id_caso']}", json={"estado_actual": "INVENTADO"},
                     headers=admin_token["admin"])
    assert r.status_code == 422


# --------------------------------------------------------------------------- #
# Listado con filtros (RF-33)
# --------------------------------------------------------------------------- #
def test_listado_filtros_y_paginacion(client, admin_token):
    for i in range(3):
        client.post(BASE, json={**CASO_MANUAL, "id_averia": f"MAN-003{i}",
                                "categoria": "EMPRESA"}, headers=admin_token["admin"])

    todos = client.get(BASE, headers=admin_token["admin"]).json()
    assert todos["total"] == 3

    empresas = client.get(BASE, params={"categoria": "EMPRESA"}, headers=admin_token["admin"]).json()
    assert empresas["total"] == 3

    residenciales = client.get(BASE, params={"categoria": "RESIDENCIAL"},
                               headers=admin_token["admin"]).json()
    assert residenciales["total"] == 0

    pagina = client.get(BASE, params={"page": 1, "page_size": 2}, headers=admin_token["admin"]).json()
    assert pagina["total"] == 3
    assert len(pagina["items"]) == 2
    assert pagina["pages"] == 2

    texto = client.get(BASE, params={"q": "MAN-0031"}, headers=admin_token["admin"]).json()
    assert texto["total"] == 1

    nuevos = client.get(BASE, params={"estado_actual": "NUEVO"}, headers=admin_token["admin"]).json()
    assert nuevos["total"] == 3

    supervisor = client.get(BASE, params={"en_gestion_supervisor": False},
                            headers=admin_token["admin"]).json()
    assert supervisor["total"] == 3


def test_listado_incluye_casos_ingeridos(client, admin_token):
    """Los casos creados por la ingesta aparecen en el listado y en la búsqueda."""
    import pathlib

    ruta = (pathlib.Path(__file__).resolve().parents[2]
            / "RepoTecnico" / "muestras" / "detalle_averias_gpon_EJEMPLO.csv")
    with ruta.open("rb") as fh:
        r = client.post("/api/v1/ingesta",
                        files={"archivo": ("detalle.csv", fh, "text/csv")},
                        headers=admin_token["admin"])
    assert r.status_code == 201, r.text

    listado = client.get(BASE, params={"origen": "INGESTA_CSV"}, headers=admin_token["admin"]).json()
    assert listado["total"] == 51

    busqueda = client.get(f"{BASE}/buscar", params={"id_averia": "DEMO-0001"},
                          headers=admin_token["admin"]).json()
    assert len(busqueda) == 1
    assert busqueda[0]["id_averia"] == "DEMO-0001"

    # El listado expone el caso con su central y su lote de ingesta
    assert busqueda[0]["id_lote_ingesta"] is not None
    assert busqueda[0]["codigo_central"] == "2324X"


def test_listado_ordenado_por_fecha_descendente(client, admin_token):
    for i, fecha in enumerate(("2026-01-01T10:00:00", "2026-06-01T10:00:00")):
        client.post(BASE, json={**CASO_MANUAL, "id_averia": f"MAN-004{i}",
                                "fecha_reporte": fecha}, headers=admin_token["admin"])
    items = client.get(BASE, headers=admin_token["admin"]).json()["items"]
    assert items[0]["id_averia"] == "MAN-0041"


def test_modelo_caso_no_se_duplica(client, admin_token, db_session):
    client.post(BASE, json={**CASO_MANUAL, "id_averia": "MAN-0050"},
                headers=admin_token["admin"])
    assert db_session.scalar(
        select(func.count()).select_from(Caso).where(Caso.id_averia == "MAN-0050")
    ) == 1


# --------------------------------------------------------------------------- #
# Gestión del estado por el rol TECNICO (D-68)
# --------------------------------------------------------------------------- #
def test_tecnico_puede_cambiar_el_estado_desde_la_gestion(client, admin_token, db_session):
    """El TECNICO no edita casos, pero sí mueve su estado con bitácora (D-68)."""
    from app.models import CasoEstadoHist

    creado = client.post(
        "/api/v1/casos",
        json={"id_averia": "TSTG01", "direccion": "CALLE TST G01", "nombre_cliente": "GESTION"},
        headers=admin_token["admin"],
    )
    assert creado.status_code == 201, creado.text
    id_caso = creado.json()["id_caso"]

    # La edición completa sigue vedada para TECNICO
    assert client.patch(f"/api/v1/casos/{id_caso}", json={"nombre_cliente": "X"},
                        headers=admin_token["tecnico"]).status_code == 403

    # El cambio de estado por gestión sí está permitido
    r = client.post(
        f"/api/v1/casos/{id_caso}/estado",
        json={"estado_actual": "ASIGNADO", "motivo_estado": "Cuadrilla en ruta"},
        headers=admin_token["tecnico"],
    )
    assert r.status_code == 200, r.text
    assert r.json()["estado_actual"] == "ASIGNADO"

    # Queda registrado en la bitácora con el autor (el alta ya dejó el registro
    # inicial NUEVO, así que se esperan dos movimientos)
    historial = list(
        db_session.scalars(
            select(CasoEstadoHist)
            .where(CasoEstadoHist.id_caso == id_caso)
            .order_by(CasoEstadoHist.id_hist)
        ).all()
    )
    assert len(historial) == 2
    assert historial[0].estado_anterior is None and historial[0].estado_nuevo == "NUEVO"
    assert historial[1].estado_anterior == "NUEVO"
    assert historial[1].estado_nuevo == "ASIGNADO"
    assert historial[1].usuario == "TESTTEC"
    assert historial[1].motivo == "Cuadrilla en ruta"

    # El mismo estado se rechaza para no duplicar la bitácora
    assert client.post(f"/api/v1/casos/{id_caso}/estado", json={"estado_actual": "ASIGNADO"},
                       headers=admin_token["tecnico"]).status_code == 409

    # Y sin token no se puede gestionar
    assert client.post(f"/api/v1/casos/{id_caso}/estado",
                       json={"estado_actual": "CERRADO"}).status_code == 401


def test_estado_invalido_en_gestion(client, admin_token):
    creado = client.post(
        "/api/v1/casos",
        json={"id_averia": "TSTG02", "direccion": "CALLE TST G02"},
        headers=admin_token["admin"],
    ).json()
    r = client.post(f"/api/v1/casos/{creado['id_caso']}/estado",
                    json={"estado_actual": "INVENTADO"}, headers=admin_token["admin"])
    assert r.status_code == 422


# --------------------------------------------------------------------------- #
# Resolución del caso: cierre, cita, enrutado e histórico (D-70)
# --------------------------------------------------------------------------- #
def _caso_con_telefono(client, admin_token, id_averia="TSTRES01", telefono="+582121111111"):
    r = client.post(
        "/api/v1/casos",
        json={
            "id_averia": id_averia,
            "direccion": "CALLE TST RESUELVE",
            "telefono": telefono,
            "nombre_cliente": "RESOLUCION",
            "problema_reporte": "SIN SERVICIO GPON",
        },
        headers=admin_token["admin"],
    )
    assert r.status_code == 201, r.text
    return r.json()


def test_cierre_registra_actividad_evidencias_y_estado(client, admin_token, db_session):
    """El cierre guarda la actividad con su modo del catálogo y sus evidencias."""
    from app.models import Actividad, Evidencia

    caso = _caso_con_telefono(client, admin_token, "TSTRES02")
    r = client.post(
        f"/api/v1/casos/{caso['id_caso']}/cierre",
        json={"modo": "COS", "descripcion": "Se restableció el enlace y se verificó navegación",
              "evidencias": ["EVD-001", "EVD-002"]},
        headers=admin_token["admin"],
    )
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert cuerpo["accion"] == "CIERRE" and cuerpo["estado_actual"] == "CERRADO"

    actividad = db_session.get(Actividad, cuerpo["id_actividad"])
    assert actividad is not None
    assert actividad.tipo == "CIERRE" and actividad.resultado == "CERRADO"
    assert actividad.id_metodo == 2  # COS en el catálogo sembrado
    evidencias = db_session.scalars(
        select(Evidencia).where(Evidencia.id_actividad == actividad.id_actividad)
    ).all()
    assert len(evidencias) == 2
    # El serial lleva el id de la actividad para garantizar unicidad (D-70)
    seriales = {e.serial_imagen for e in evidencias}
    assert len(seriales) == 2
    assert all(s.startswith(f"TSTRES02-A{actividad.id_actividad}-CIERRE-") for s in seriales)

    # El TECNICO no puede cerrar (edición reservada a ADMIN/SUPERVISOR/SUPER)
    assert client.post(f"/api/v1/casos/{caso['id_caso']}/cierre",
                       json={"modo": "IVR", "descripcion": "intenta cerrar"},
                       headers=admin_token["tecnico"]).status_code == 403


def test_cierre_rechaza_modo_inexistente_y_descripcion_corta(client, admin_token):
    """El modo solo admite IVR/COS/SACAS y la descripción no puede ser vacía."""
    caso = _caso_con_telefono(client, admin_token, "TSTRES03")
    # Modo fuera del enumerado -> validación de esquema (422)
    assert client.post(f"/api/v1/casos/{caso['id_caso']}/cierre",
                       json={"modo": "MAGIA", "descripcion": "una descripcion larga"},
                       headers=admin_token["admin"]).status_code == 422
    # Descripción demasiado corta -> 422
    assert client.post(f"/api/v1/casos/{caso['id_caso']}/cierre",
                       json={"modo": "IVR", "descripcion": "muy corta"},
                       headers=admin_token["admin"]).status_code == 422
    # Sin autenticación no se cierra
    assert client.post(f"/api/v1/casos/{caso['id_caso']}/cierre",
                       json={"modo": "IVR", "descripcion": "se verifico el enlace"}).status_code == 401


def test_agendar_cita_desde_la_ficha(client, admin_token, db_session):
    from app.models import Cita

    caso = _caso_con_telefono(client, admin_token, "TSTRES04")
    r = client.post(
        f"/api/v1/casos/{caso['id_caso']}/cita",
        json={"fecha_hora": "2026-10-05T09:30:00+00:00", "tipo": "ATENCION",
              "observacion": "Cliente solicita atención en la mañana"},
        headers=admin_token["supervisor"],
    )
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert cuerpo["accion"] == "CITA" and cuerpo["id_cita"]

    cita = db_session.get(Cita, cuerpo["id_cita"])
    assert cita is not None and cita.id_caso == caso["id_caso"]
    assert cita.tipo == "ATENCION" and cita.estado == "PROPUESTA"
    actualizado = client.get(f"/api/v1/casos/{caso['id_caso']}",
                             headers=admin_token["admin"]).json()
    assert actualizado["fecha_cita"] is not None


def test_enrutado_crea_seguimiento_y_estado(client, admin_token, db_session):
    from app.models import Actividad, Seguimiento

    caso = _caso_con_telefono(client, admin_token, "TSTRES05")
    r = client.post(
        f"/api/v1/casos/{caso['id_caso']}/enrutado",
        json={"destino": "Planta externa Baruta", "motivo": "Requiere obra civil"},
        headers=admin_token["supervisor"],
    )
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert cuerpo["accion"] == "ENRUTE" and cuerpo["estado_actual"] == "ENRUTADO"

    seguimiento = db_session.get(Seguimiento, cuerpo["id_seguimiento"])
    assert seguimiento.instancia_destino == "Planta externa Baruta"
    actividad = db_session.get(Actividad, cuerpo["id_actividad"])
    assert actividad.tipo == "ENRUTE" and actividad.resultado == "ENRUTADO"


def test_relacionados_agrupa_antecedentes_por_telefono(client, admin_token):
    """La pestaña Histórico muestra ids anteriores con su cierre y justificación."""
    telefono = "+582129999888"
    viejo = _caso_con_telefono(client, admin_token, "TSTHIST01", telefono)
    nuevo = _caso_con_telefono(client, admin_token, "TSTHIST02", telefono)

    # Sin antecedentes todavía para el primero
    assert client.get(f"/api/v1/casos/{nuevo['id_caso']}/relacionados",
                      headers=admin_token["admin"]).json()[0]["id_averia"] == "TSTHIST01"

    # Se cierra el viejo con SACAS: la justificación debe aparecer
    cerrado = client.post(
        f"/api/v1/casos/{viejo['id_caso']}/cierre",
        json={"modo": "SACAS", "descripcion": "Reparación de acometida ejecutada"},
        headers=admin_token["admin"],
    )
    assert cerrado.status_code == 200, cerrado.text

    relacionados = client.get(f"/api/v1/casos/{nuevo['id_caso']}/relacionados",
                              headers=admin_token["admin"]).json()
    assert len(relacionados) == 1
    antecedente = relacionados[0]
    assert antecedente["id_averia"] == "TSTHIST01"
    assert antecedente["fecha_cierre"] is not None
    assert antecedente["problema_reporte"] == "SIN SERVICIO GPON"
    assert "SACAS" in antecedente["justificacion_cierre"]
    assert "Reparación de acometida" in antecedente["justificacion_cierre"]

    # Un caso sin teléfono no tiene antecedentes
    suelto = client.post("/api/v1/casos",
                         json={"id_averia": "TSTHIST03", "direccion": "CALLE TST SUELTO"},
                         headers=admin_token["admin"]).json()
    assert client.get(f"/api/v1/casos/{suelto['id_caso']}/relacionados",
                      headers=admin_token["admin"]).json() == []


def test_no_se_puede_cerrar_dos_veces_y_los_seriales_no_colisionan(client, admin_token):
    """Regresión D-70: el segundo cierre responde 409 y los seriales son únicos."""
    caso = _caso_con_telefono(client, admin_token, "TSTRES06")
    primero = client.post(
        f"/api/v1/casos/{caso['id_caso']}/cierre",
        json={"modo": "SACAS", "descripcion": "Reparacion de acometida ejecutada",
              "evidencias": ["EVD-01", "EVD-02"]},
        headers=admin_token["admin"],
    )
    assert primero.status_code == 200, primero.text

    # Reabrir y volver a cerrar con las mismas referencias no debe chocar por UNIQUE
    assert client.post(f"/api/v1/casos/{caso['id_caso']}/estado",
                       json={"estado_actual": "EN_GESTION"},
                       headers=admin_token["admin"]).status_code == 200
    segundo = client.post(
        f"/api/v1/casos/{caso['id_caso']}/cierre",
        json={"modo": "COS", "descripcion": "Segunda verificacion del enlace GPON",
              "evidencias": ["EVD-01", "EVD-02"]},
        headers=admin_token["admin"],
    )
    assert segundo.status_code == 200, segundo.text
    assert segundo.json()["id_actividad"] != primero.json()["id_actividad"]

    # Cerrar un caso ya cerrado: 409 claro, no un error de base de datos
    tercero = client.post(
        f"/api/v1/casos/{caso['id_caso']}/cierre",
        json={"modo": "IVR", "descripcion": "Intento de cierre duplicado"},
        headers=admin_token["admin"],
    )
    assert tercero.status_code == 409, tercero.text
    assert "cerrado" in tercero.json()["detail"].lower()
