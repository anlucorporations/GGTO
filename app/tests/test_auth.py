"""Pruebas de integración del Ciclo 1: autenticación, bloqueo y recuperación."""

from __future__ import annotations

import pytest
from sqlalchemy import select

from app.core.security import hash_password
from app.models import DispositivoSeguridad, Rol, Tecnico, Usuario

P00 = "TEST001"
CLAVE_INICIAL = "inicial12345"


@pytest.fixture()
def usuario_creado(db_session):
    """Crea un técnico y su usuario (simula lo que hará RF-02)."""
    rol = db_session.scalar(select(Rol).where(Rol.codigo == "TECNICO"))
    assert rol is not None, "el rol TECNICO debe existir (semilla de schema.sql)"

    # Limpieza de ejecuciones previas
    db_session.query(DispositivoSeguridad).filter(DispositivoSeguridad.p00 == P00).delete()
    previo = db_session.scalar(select(Usuario).where(Usuario.p00 == P00))
    if previo:
        db_session.delete(previo)
        db_session.flush()

    tecnico = db_session.scalar(select(Tecnico).where(Tecnico.p00 == P00))
    if tecnico is None:
        tecnico = Tecnico(id_central=1, nombre="PRUEBA", apellido="CICLO1", p00=P00, cedula="V-TEST")
        db_session.add(tecnico)
        db_session.flush()

    usuario = Usuario(
        p00=P00,
        clave_hash=hash_password(CLAVE_INICIAL),
        id_rol=rol.id_rol,
        id_tecnico=tecnico.id_tecnico,
        id_central=1,
    )
    db_session.add(usuario)
    db_session.commit()
    yield usuario

    db_session.query(DispositivoSeguridad).filter(DispositivoSeguridad.p00 == P00).delete()
    u = db_session.scalar(select(Usuario).where(Usuario.p00 == P00))
    if u:
        db_session.delete(u)
    t = db_session.scalar(select(Tecnico).where(Tecnico.p00 == P00))
    if t:
        db_session.delete(t)
    db_session.commit()


def test_login_correcto(client, usuario_creado):
    r = client.post("/api/v1/auth/login", json={"p00": P00, "clave": CLAVE_INICIAL})
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert cuerpo["token_type"] == "bearer"
    assert cuerpo["usuario"]["p00"] == P00
    assert cuerpo["usuario"]["rol"] == "TECNICO"


def test_login_p00_inexistente(client):
    r = client.post("/api/v1/auth/login", json={"p00": "NOEXISTE", "clave": "x" * 10})
    assert r.status_code == 401


def test_rate_limit_bloquea_rafagas(client):
    """RNF-22: el servidor limita los intentos por P00 + IP."""
    from app.core.config import get_settings

    limite = get_settings().rate_limit_intentos
    codigos = [
        client.post("/api/v1/auth/login", json={"p00": "RAFAGA001", "clave": "mala"}).status_code
        for _ in range(limite + 1)
    ]
    assert 429 in codigos, f"se esperaba un 429 en {codigos}"


def test_login_clave_incorrecta(client, usuario_creado):
    r = client.post("/api/v1/auth/login", json={"p00": P00, "clave": "clave-mala"})
    assert r.status_code == 401
    assert r.headers.get("X-Intentos-Restantes") == "2"


def test_bloqueo_a_los_tres_intentos(client, usuario_creado):
    for _ in range(2):
        assert client.post("/api/v1/auth/login", json={"p00": P00, "clave": "mala"}).status_code == 401
    tercera = client.post("/api/v1/auth/login", json={"p00": P00, "clave": "mala"})
    assert tercera.status_code == 423

    # Incluso con la clave correcta queda bloqueado.
    assert client.post("/api/v1/auth/login", json={"p00": P00, "clave": CLAVE_INICIAL}).status_code == 423


def test_setup_genera_doce_palabras(client, usuario_creado):
    r = client.post(
        "/api/v1/auth/setup",
        json={"p00": P00, "correo": "tecnico@cantv.com.ve",
              "clave": "nueva123456", "confirmacion": "nueva123456"},
    )
    assert r.status_code == 200, r.text
    palabras = r.json()["palabras"]
    assert len(palabras) == 12

    assert client.post("/api/v1/auth/login", json={"p00": P00, "clave": "nueva123456"}).status_code == 200


def test_setup_confirmacion_no_coincide(client, usuario_creado):
    r = client.post(
        "/api/v1/auth/setup",
        json={"p00": P00, "correo": "x@y.com", "clave": "nueva123456", "confirmacion": "otra123456"},
    )
    assert r.status_code == 422


def test_desbloqueo_con_tres_palabras(client, usuario_creado):
    setup = client.post(
        "/api/v1/auth/setup",
        json={"p00": P00, "correo": "tecnico@cantv.com.ve",
              "clave": "nueva123456", "confirmacion": "nueva123456"},
    ).json()
    palabras = setup["palabras"]

    for _ in range(3):
        client.post("/api/v1/auth/login", json={"p00": P00, "clave": "mala"})
    assert client.post("/api/v1/auth/login", json={"p00": P00, "clave": "nueva123456"}).status_code == 423

    r = client.post(
        "/api/v1/auth/unlock",
        json={"p00": P00, "palabras": [
            {"pos": 1, "valor": palabras[0]},
            {"pos": 5, "valor": palabras[4]},
            {"pos": 9, "valor": palabras[8]},
        ]},
    )
    assert r.status_code == 200, r.text
    assert r.json()["bloqueado"] is False

    assert client.post("/api/v1/auth/login", json={"p00": P00, "clave": "nueva123456"}).status_code == 200


def test_desbloqueo_con_palabras_incorrectas(client, usuario_creado):
    client.post(
        "/api/v1/auth/setup",
        json={"p00": P00, "correo": "tecnico@cantv.com.ve",
              "clave": "nueva123456", "confirmacion": "nueva123456"},
    )
    r = client.post(
        "/api/v1/auth/unlock",
        json={"p00": P00, "palabras": [
            {"pos": 1, "valor": "incorrecta"},
            {"pos": 2, "valor": "incorrecta"},
            {"pos": 3, "valor": "incorrecta"},
        ]},
    )
    assert r.status_code == 401


def test_me_requiere_token(client, usuario_creado):
    assert client.get("/api/v1/auth/me").status_code == 401
    token = client.post(
        "/api/v1/auth/login", json={"p00": P00, "clave": CLAVE_INICIAL}
    ).json()["access_token"]
    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["p00"] == P00


def test_restablecer_clave_con_palabras(client, usuario_creado):
    palabras = client.post(
        "/api/v1/auth/setup",
        json={"p00": P00, "correo": "tecnico@cantv.com.ve",
              "clave": "nueva123456", "confirmacion": "nueva123456"},
    ).json()["palabras"]

    r = client.post(
        "/api/v1/auth/reset-password",
        json={"p00": P00, "nueva_clave": "otraclave789",
              "palabras": [
                  {"pos": 2, "valor": palabras[1]},
                  {"pos": 6, "valor": palabras[5]},
                  {"pos": 12, "valor": palabras[11]},
              ]},
    )
    assert r.status_code == 200, r.text
    assert client.post("/api/v1/auth/login", json={"p00": P00, "clave": "otraclave789"}).status_code == 200


# --------------------------------------------------------------------------- #
# Primer acceso, estado de la cuenta y regeneración de palabras (D-67)
# --------------------------------------------------------------------------- #
P00_NUEVO = "TSTNUEVO"


def _crear_tecnico(client, admin_token, p00=P00_NUEVO):
    r = client.post(
        "/api/v1/tecnicos",
        json={"id_central": admin_token["id_central"], "nombre": "NUEVO",
              "apellido": "TECNICO", "p00": p00},
        headers=admin_token["admin"],
    )
    assert r.status_code == 201, r.text
    return r.json()


def test_primer_acceso_p00_inexistente(client):
    r = client.get("/api/v1/auth/primer-acceso", params={"p00": "TSTNOEXISTE"})
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert cuerpo["registrado"] is False
    assert cuerpo["estado"] == "INEXISTENTE"
    assert cuerpo["puede_registrarse"] is False


def test_autoalta_del_tecnico(client, admin_token, db_session):
    """El supervisor crea el P00; el técnico activa su cuenta y recibe 12 palabras."""
    creado = _crear_tecnico(client, admin_token)
    assert creado["estado_cuenta"] == "SIN_ALTA"

    # El sistema detecta que el P00 está dado de alta y ofrece el proceso
    r = client.get("/api/v1/auth/primer-acceso", params={"p00": P00_NUEVO})
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["registrado"] is True
    assert cuerpo["estado"] == "PENDIENTE"
    assert cuerpo["puede_registrarse"] is True

    # Un P00 no registrado no puede autoregistrarse
    r = client.post(
        "/api/v1/auth/setup",
        json={"p00": "TSTFANTASMA", "correo": "x@y.com",
              "clave": "clave12345", "confirmacion": "clave12345"},
    )
    assert r.status_code == 404

    # Alta de primer acceso: crea la cuenta, la clave y las 12 palabras
    r = client.post(
        "/api/v1/auth/setup",
        json={"p00": P00_NUEVO, "correo": "nuevo@cantv.com.ve",
              "clave": "clave12345", "confirmacion": "clave12345"},
    )
    assert r.status_code == 200, r.text
    palabras = r.json()["palabras"]
    assert len(palabras) == 12

    # Ya puede iniciar sesión y su estado pasa a ACTIVO
    assert client.post("/api/v1/auth/login",
                       json={"p00": P00_NUEVO, "clave": "clave12345"}).status_code == 200
    r = client.get("/api/v1/auth/primer-acceso", params={"p00": P00_NUEVO})
    assert r.json()["estado"] == "ACTIVO"

    # No se puede repetir el alta (debe usar la recuperación)
    r = client.post(
        "/api/v1/auth/setup",
        json={"p00": P00_NUEVO, "correo": "nuevo@cantv.com.ve",
              "clave": "otra12345", "confirmacion": "otra12345"},
    )
    assert r.status_code == 409

    # El listado de técnicos refleja el estado de la cuenta
    listado = client.get("/api/v1/tecnicos", headers=admin_token["admin"]).json()
    fila = next(t for t in listado if t["p00"] == P00_NUEVO)
    assert fila["estado_cuenta"] == "ACTIVO"


def test_estado_cuenta_bloqueado_tras_intentos(client, admin_token):
    _crear_tecnico(client, admin_token, p00="TSTBLOQ")
    client.post(
        "/api/v1/auth/setup",
        json={"p00": "TSTBLOQ", "correo": "b@cantv.com.ve",
              "clave": "clave12345", "confirmacion": "clave12345"},
    )
    for _ in range(3):
        client.post("/api/v1/auth/login", json={"p00": "TSTBLOQ", "clave": "mala"})

    listado = client.get("/api/v1/tecnicos", headers=admin_token["admin"]).json()
    fila = next(t for t in listado if t["p00"] == "TSTBLOQ")
    assert fila["estado_cuenta"] == "BLOQUEADO"


def test_regenerar_palabras_solo_super_usuario(client, admin_token, db_session):
    _crear_tecnico(client, admin_token, p00="TSTRECUP")
    client.post(
        "/api/v1/auth/setup",
        json={"p00": "TSTRECUP", "correo": "r@cantv.com.ve",
              "clave": "clave12345", "confirmacion": "clave12345"},
    )

    # ADMIN y TECNICO no pueden regenerar
    assert client.post("/api/v1/auth/palabras/TSTRECUP/regenerar",
                       headers=admin_token["admin"]).status_code == 403
    assert client.post("/api/v1/auth/palabras/TSTRECUP/regenerar",
                       headers=admin_token["tecnico"]).status_code == 403

    # El Super Usuario sí, y obtiene 12 palabras nuevas
    r = client.post("/api/v1/auth/palabras/TSTRECUP/regenerar",
                    headers=admin_token["super"])
    assert r.status_code == 200, r.text
    palabras = r.json()["palabras"]
    assert len(palabras) == 12

    # Las palabras nuevas sirven para desbloquear/recuperar la cuenta
    tres = [{"pos": 1, "valor": palabras[0]},
            {"pos": 5, "valor": palabras[4]},
            {"pos": 9, "valor": palabras[8]}]
    assert client.post("/api/v1/auth/unlock",
                       json={"p00": "TSTRECUP", "palabras": tres}).status_code == 200

    # Queda registrado en la auditoría
    from app.models import Auditoria
    fila = db_session.scalar(
        select(Auditoria).where(Auditoria.accion == "REGENERAR_PALABRAS")
    )
    assert fila is not None
    assert fila.id_entidad == "TSTRECUP"
