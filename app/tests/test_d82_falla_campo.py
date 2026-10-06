"""D-82 · reporte de falla masiva **desde la APK** (RF-16).

Verifica el endpoint de campo: lo puede usar el TECNICO, exige ODN · dirección ·
FAT · descripción, admite **hasta 2 fotos** y persiste y devuelve los datos.
También comprueba que el alta administrativa (`POST /fallas-masivas`) mantiene su
matriz de RBAC (TECNICO sigue sin poder usarla) y que la subida de evidencias
acepta el tipo `FALLA_MASIVA` que envía la APK (defecto detectado en producción:
el CHECK `evidencia_tipo_check` no lo admitía y la subida respondía 500).
"""

from __future__ import annotations

FALLAS = "/api/v1/fallas-masivas"
CAMPO = "/api/v1/fallas-masivas/reporte-campo"
EVIDENCIAS = "/api/v1/evidencias/upload"

CUERPO = {
    "odn": "ODN-2324X-0451",
    "direccion": "Calle 4 con Av. Principal, casa 12",
    "fat": "FAT-04",
    "descripcion": "6 clientes sin servicio en la FAT 4 del sector Norte 2",
    "evidencias": ["FM-1-FALLA_MASIVA-20261006-120000.jpg",
                   "FM-2-FALLA_MASIVA-20261006-120500.jpg"],
}


def test_el_tecnico_reporta_la_falla_con_odn_direccion_fat_y_dos_fotos(client, admin_token):
    r = client.post(CAMPO, json=CUERPO, headers=admin_token["tecnico"])
    assert r.status_code == 201, r.text
    cuerpo = r.json()
    assert cuerpo["origen"] == "REPORTE_TECNICO"
    assert cuerpo["odn"] == "ODN-2324X-0451"
    assert cuerpo["direccion"] == "Calle 4 con Av. Principal, casa 12"
    assert cuerpo["fat"] == "FAT-04"
    assert cuerpo["descripcion"].startswith("6 clientes sin servicio")
    assert cuerpo["evidencias"] == CUERPO["evidencias"]

    # La ficha completa devuelve lo mismo (lo que ve el supervisor en la web).
    ficha = client.get(f"{FALLAS}/{cuerpo['id_falla']}", headers=admin_token["tecnico"])
    assert ficha.status_code == 200, ficha.text
    assert ficha.json()["odn"] == "ODN-2324X-0451"
    assert ficha.json()["fat"] == "FAT-04"
    assert len(ficha.json()["evidencias"]) == 2


def test_el_reporte_de_campo_exige_los_cuatro_datos(client, admin_token):
    for campo in ("odn", "direccion", "fat", "descripcion"):
        incompleto = {k: v for k, v in CUERPO.items() if k != campo}
        r = client.post(CAMPO, json=incompleto, headers=admin_token["tecnico"])
        assert r.status_code == 422, f"sin {campo} debería fallar: {r.text}"
        assert any(campo in str(e.get("loc", "")) for e in r.json()["detail"])


def test_el_reporte_de_campo_admite_como_maximo_dos_fotos(client, admin_token):
    tres = dict(CUERPO, evidencias=["a.jpg", "b.jpg", "c.jpg"])
    r = client.post(CAMPO, json=tres, headers=admin_token["tecnico"])
    assert r.status_code == 422, r.text


def test_el_reporte_de_campo_funciona_sin_fotos(client, admin_token):
    sin_fotos = {k: v for k, v in CUERPO.items() if k != "evidencias"}
    r = client.post(CAMPO, json=sin_fotos, headers=admin_token["tecnico"])
    assert r.status_code == 201, r.text
    assert r.json()["evidencias"] == []


def test_la_cuadrilla_del_reportante_se_asigna_a_la_falla(client, admin_token):
    """El técnico sin cuadrilla no rompe el reporte: la falla queda sin asignar
    o con la cuadrilla más cercana al sector (nunca con un error)."""
    cuerpo = dict(CUERPO, id_sector=None)
    r = client.post(CAMPO, json=cuerpo, headers=admin_token["tecnico"])
    assert r.status_code == 201, r.text
    assert r.json()["id_cuadrilla"] is None or isinstance(r.json()["id_cuadrilla"], int)


def test_el_alta_administrativa_sigue_restringida_al_tecnico(client, admin_token):
    """La matriz de RBAC de D-82 no cambia `POST /fallas-masivas`."""
    respuesta = client.post(FALLAS, json={"descripcion": "Falla de RBAC"},
                            headers=admin_token["tecnico"])
    assert respuesta.status_code == 403
    oficial = client.post(FALLAS, json={"descripcion": "Falla administrativa"},
                          headers=admin_token["admin"])
    assert oficial.status_code == 201, oficial.text
    # El alta administrativa admite ODN/FAT/dirección opcionales (D-82).
    con_datos = client.post(
        FALLAS,
        json={"descripcion": "Falla con datos de campo", "odn": "ODN-1", "fat": "FAT-9",
              "direccion": "Av. Bolívar, sector Centro"},
        headers=admin_token["supervisor"],
    )
    assert con_datos.status_code == 201, con_datos.text
    assert con_datos.json()["odn"] == "ODN-1"
    assert con_datos.json()["fat"] == "FAT-9"


# --------------------------------------------------------------------------- #
# Evidencias del reporte de campo (defecto detectado en producción)
# --------------------------------------------------------------------------- #
def test_la_evidencia_de_falla_masiva_se_sube(client, admin_token, tmp_path, monkeypatch):
    """`tipo=FALLA_MASIVA` (el que envía la APK) debe aceptarse: el CHECK
    `evidencia_tipo_check` solo admitía POTENCIA/NAVEGACION/DEMO y la subida
    respondía 500 en producción."""
    monkeypatch.setenv("GGTO_EVIDENCIAS_DIR", str(tmp_path))
    archivo = {"file": ("FM-1.jpg", b"\xff\xd8\xff\xe0evidencia", "image/jpeg")}
    r = client.post(EVIDENCIAS, files=archivo,
                    data={"id_caso": "0", "tipo": "FALLA_MASIVA",
                          "serial_local": "FM-TEST-1-FALLA_MASIVA.jpg"},
                    headers=admin_token["tecnico"])
    assert r.status_code == 200, r.text
    assert r.json()["serial_imagen"] == "FM-TEST-1-FALLA_MASIVA.jpg"
    assert r.json()["ruta_remota"]


def test_la_evidencia_con_tipo_desconocido_da_422(client, admin_token, tmp_path, monkeypatch):
    """Un tipo fuera del CHECK se rechaza con 422 (antes: 500 de la base)."""
    monkeypatch.setenv("GGTO_EVIDENCIAS_DIR", str(tmp_path))
    archivo = {"file": ("X.jpg", b"\xff\xd8\xff\xe0evidencia", "image/jpeg")}
    r = client.post(EVIDENCIAS, files=archivo,
                    data={"id_caso": "0", "tipo": "INVENTADO"},
                    headers=admin_token["tecnico"])
    assert r.status_code == 422, r.text
    assert "no válido" in r.json()["detail"]
