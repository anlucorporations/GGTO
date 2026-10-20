"""D-137 · Solo el dueño (o un gestor) cierra una sesión de sincronización (H-20).

Defecto (auditoría V3): `PATCH /sync/sesion/{id}` no validaba a quién pertenecía la
sesión. Cualquier usuario autenticado podía **cerrar** la sesión de otro técnico y
escribir sus contadores (IDOR).

Regla: la sesión la cierra su **dueño** (`sync_log.p00`); los roles de gestión
(ADMIN, SUPERVISOR, SUPER) pueden cerrarla para dar soporte. Cualquier otro → 403.
"""

from __future__ import annotations

import pytest

SESION = "/api/v1/sync/sesion"


@pytest.fixture()
def sesiones(client, admin_token, db_session):
    """Dos técnicos de la misma central para probar el cruce de sesiones."""
    from app.core.security import hash_password
    from app.models import Tecnico, Usuario

    rol_tec = db_session.scalar(select_rol(db_session, "TECNICO"))
    tec = Tecnico(
        id_central=admin_token["id_central"], nombre="OTRO", apellido="TEST", p00="TSTIDOR"
    )
    db_session.add(tec)
    db_session.flush()
    db_session.add(
        Usuario(
            p00="TSTIDOR",
            clave_hash=hash_password("config12345"),
            id_rol=rol_tec.id_rol,
            id_tecnico=tec.id_tecnico,
            id_central=admin_token["id_central"],
        )
    )
    db_session.commit()
    login = client.post("/api/v1/auth/login", json={"p00": "TSTIDOR", "clave": "config12345"})
    assert login.status_code == 200, login.text

    abierta = client.post(
        SESION,
        json={"tipo": "DESCARGA", "dispositivo_id": "DEV-IDOR"},
        headers=login.json() and {"Authorization": f"Bearer {login.json()['access_token']}"},
    )
    assert abierta.status_code == 201, abierta.text
    return {
        "ajeno": {"Authorization": f"Bearer {login.json()['access_token']}"},
        "id_sesion": abierta.json()["id_sync_log"],
        "admin": admin_token["admin"],
        "tecnico": admin_token["tecnico"],
    }


def select_rol(db_session, codigo: str):
    from sqlalchemy import select

    from app.models import Rol

    return select(Rol).where(Rol.codigo == codigo)


def _cerrar(client, headers, id_sesion: int, **cambios):
    cuerpo = {"recibidos": 1, "procesados": 1, "errores": 0, "estado": "OK"}
    cuerpo.update(cambios)
    return client.patch(f"{SESION}/{id_sesion}", json=cuerpo, headers=headers)


def test_otro_tecnico_no_puede_cerrar_la_sesion(client, sesiones):
    r = _cerrar(client, sesiones["tecnico"], sesiones["id_sesion"])
    assert r.status_code == 403, r.text
    assert "no le pertenece" in r.json()["detail"]


def test_el_dueno_si_puede_cerrarla(client, sesiones):
    r = _cerrar(client, sesiones["ajeno"], sesiones["id_sesion"])
    assert r.status_code == 200, r.text
    # Sin cuadrilla resuelta la sesión se cierra como ERROR (regla de D-81): lo que
    # se prueba aquí es que el **dueño** puede cerrarla.
    assert r.json()["estado"] in {"OK", "ERROR"}


def test_un_gestor_puede_cerrarla_para_soporte(client, sesiones):
    r = _cerrar(client, sesiones["admin"], sesiones["id_sesion"])
    assert r.status_code == 200, r.text


def test_rechazo_no_altera_los_contadores(client, sesiones, db_session):
    from app.models import SyncLog

    assert _cerrar(client, sesiones["tecnico"], sesiones["id_sesion"], recibidos=999).status_code == 403
    db_session.expire_all()
    sesion = db_session.get(SyncLog, sesiones["id_sesion"])
    assert sesion is not None
    assert sesion.estado == "EN_PROCESO"
    assert sesion.recibidos == 0, "el rechazo no debe escribir contadores"
