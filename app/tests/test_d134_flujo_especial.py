"""D-134 · El flujo del caso especial se valida (H-17).

Defecto (auditoría V3): `PATCH /casos-especiales/{id}` cambiaba `estado` a
**cualquier** valor sin validar el flujo: permitía cerrar saltándose pasos
(ABIERTO → CERRADO), **reabrir** un caso cerrado sin motivo y estados inventados.
Es la vía que usa el cierre administrativo.

Regla: ABIERTO → EN_PROCESO | ATENDIDO | CERRADO · EN_PROCESO → ATENDIDO | CERRADO ·
ATENDIDO → CERRADO; el retroceso solo lo autoriza el SUPER con `motivo_reversion`
(≥ 10 caracteres) y queda en la auditoría.
"""

from __future__ import annotations

import pytest
from sqlalchemy import select

from app.models import Auditoria

ESPECIALES = "/api/v1/casos-especiales"
SECTORES = "/api/v1/sectores"

INFORME = "Se atendió el referido y se verificó el servicio contratado (D-134)."


@pytest.fixture()
def entorno(client, admin_token):
    sector = client.post(
        SECTORES,
        json={
            "id_central": admin_token["id_central"],
            "codigo": "TSD134",
            "nombre": "Sector D-134",
            "patron_direccion": "SECTOR D134",
        },
        headers=admin_token["admin"],
    )
    assert sector.status_code in (201, 409), sector.text
    r = client.post(
        ESPECIALES,
        json={
            "clasificacion": "REFERIDO",
            "tipo_actividad": "REPARACION",
            "prioridad": "MEDIA",
            "descripcion": "Caso especial de prueba D-134",
            "requiere_informe": False,
            "id_sector": sector.json().get("id_sector") if sector.status_code == 201 else None,
            "crear_solicitante": {
                "nombre": "SOLICITANTE D134",
                "unidad": "GERENCIA D134",
                "contacto": "04141113344",
            },
            "direccion": "SECTOR D134 CASA 1",
            "telefono": "7014003421",
            "id_averia": "TSTD134-1",
            "nombre_cliente": "CLIENTE D134",
            "contacto_cliente": "04141113344",
            "id_pago": "7014003421",
            "tipo_reporte": "RECLAMO",
            "tipo_problema": "SIN_SERVICIO",
        },
        headers=admin_token["admin"],
    )
    assert r.status_code == 201, r.text
    return {
        "admin": admin_token["admin"],
        "super": admin_token["super"],
        "id": r.json()["id_caso_especial"],
        # El alta puede dejar el especial ya en EN_PROCESO (estado derivado del caso).
        "estado_inicial": r.json()["estado"],
    }


def _patch(client, headers, id_especial: int, **cambios):
    return client.patch(f"{ESPECIALES}/{id_especial}", json=cambios, headers=headers)


def test_el_avance_valido_se_permite(client, entorno):
    """Desde el estado de alta se avanza por el flujo (nunca se retrocede)."""
    destino = "EN_PROCESO" if entorno["estado_inicial"] == "ABIERTO" else "ATENDIDO"
    r = _patch(client, entorno["admin"], entorno["id"], estado=destino)
    assert r.status_code == 200, r.text
    assert r.json()["estado"] == destino


def test_en_proceso_a_atendido_se_permite(client, entorno):
    if entorno["estado_inicial"] == "ABIERTO":
        assert _patch(client, entorno["admin"], entorno["id"], estado="EN_PROCESO").status_code == 200
    r = _patch(client, entorno["admin"], entorno["id"], estado="ATENDIDO")
    assert r.status_code == 200, r.text
    assert r.json()["estado"] == "ATENDIDO"


def test_el_cierre_desde_un_estado_abierto_se_permite(client, entorno):
    r = _patch(client, entorno["admin"], entorno["id"], estado="CERRADO", informe=INFORME)
    assert r.status_code == 200, r.text
    assert r.json()["estado"] == "CERRADO"


def test_un_estado_inventado_se_rechaza(client, entorno):
    r = _patch(client, entorno["admin"], entorno["id"], estado="CERRADO")
    assert r.status_code == 200  # primer cierre válido
    r = _patch(client, entorno["admin"], entorno["id"], estado="PERDIDO")
    assert r.status_code == 422, r.text


def test_reabrir_como_admin_se_rechaza(client, entorno):
    assert _patch(client, entorno["admin"], entorno["id"], estado="CERRADO", informe=INFORME).status_code == 200
    r = _patch(client, entorno["admin"], entorno["id"], estado="ABIERTO")
    assert r.status_code == 409, r.text
    assert "SUPER" in r.json()["detail"]


def test_reabrir_como_super_exige_motivo(client, entorno):
    assert _patch(client, entorno["admin"], entorno["id"], estado="CERRADO", informe=INFORME).status_code == 200
    corto = _patch(client, entorno["super"], entorno["id"], estado="ABIERTO", motivo_reversion="ups")
    assert corto.status_code == 422, corto.text


def test_reabrir_como_super_con_motivo_queda_auditado(client, entorno, db_session):
    assert _patch(client, entorno["admin"], entorno["id"], estado="CERRADO", informe=INFORME).status_code == 200
    r = _patch(
        client,
        entorno["super"],
        entorno["id"],
        estado="ABIERTO",
        motivo_reversion="El cliente volvió a reportar la avería",
    )
    assert r.status_code == 200, r.text
    assert r.json()["estado"] == "ABIERTO"

    db_session.expire_all()
    fila = db_session.scalar(
        select(Auditoria).where(Auditoria.accion == "REVERSION_ESPECIAL")
    )
    assert fila is not None
    assert (fila.datos_despues or {}).get("estado") == "ABIERTO"
    assert fila.id_entidad == str(entorno["id"])


def test_mismo_estado_es_idempotente(client, entorno):
    r = _patch(client, entorno["admin"], entorno["id"], estado=entorno["estado_inicial"])
    assert r.status_code == 200, r.text
