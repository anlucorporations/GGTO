"""Pruebas de integración del Ciclo 1: autenticación, bloqueo y recuperación."""

from __future__ import annotations

import pytest
from sqlalchemy import func, select

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


# --------------------------------------------------------------------------- #
# Cambio de rol de la cuenta del técnico (D-68)
# --------------------------------------------------------------------------- #
def test_cambio_rol_solo_super_y_supervisor(client, admin_token, db_session):
    """El rol lo cambian SUPER y SUPERVISOR; ADMIN y TECNICO no (D-68)."""
    from app.models import Auditoria

    r = client.post(
        "/api/v1/tecnicos",
        json={"id_central": admin_token["id_central"], "nombre": "ROLESDOS", "p00": "TSTROL"},
        headers=admin_token["admin"],
    )
    assert r.status_code == 201, r.text
    id_tecnico = r.json()["id_tecnico"]
    assert r.json()["rol"] is None
    assert r.json()["estado_cuenta"] == "SIN_ALTA"

    # ADMIN y TECNICO no pueden cambiar roles
    assert client.patch(f"/api/v1/tecnicos/{id_tecnico}/rol", json={"rol": "SUPERVISOR"},
                        headers=admin_token["admin"]).status_code == 403
    assert client.patch(f"/api/v1/tecnicos/{id_tecnico}/rol", json={"rol": "SUPERVISOR"},
                        headers=admin_token["tecnico"]).status_code == 403

    # El SUPER sí: pre-crea la cuenta con el rol indicado
    r = client.patch(f"/api/v1/tecnicos/{id_tecnico}/rol", json={"rol": "SUPERVISOR"},
                     headers=admin_token["super"])
    assert r.status_code == 200, r.text
    assert r.json()["rol"] == "SUPERVISOR"
    assert r.json()["estado_cuenta"] == "SIN_ALTA"  # aún sin clave propia ni palabras

    # Con cuenta ya creada, el SUPERVISOR también puede reasignar
    r = client.patch(f"/api/v1/tecnicos/{id_tecnico}/rol", json={"rol": "TECNICO"},
                     headers=admin_token["supervisor"])
    assert r.status_code == 200, r.text
    assert r.json()["rol"] == "TECNICO"

    # SUPER no es asignable desde este endpoint
    assert client.patch(f"/api/v1/tecnicos/{id_tecnico}/rol", json={"rol": "SUPER"},
                        headers=admin_token["super"]).status_code == 422

    # La cuenta pre-creada tiene clave inalcanzable: nadie puede iniciar sesión
    assert client.post("/api/v1/auth/login",
                       json={"p00": "TSTROL", "clave": "cualquiera123"}).status_code == 401

    # El primer acceso conserva el rol asignado
    setup = client.post(
        "/api/v1/auth/setup",
        json={"p00": "TSTROL", "correo": "rol@cantv.com.ve",
              "clave": "clave12345", "confirmacion": "clave12345"},
    )
    assert setup.status_code == 200, setup.text
    fila = next(t for t in client.get("/api/v1/tecnicos",
                                      headers=admin_token["admin"]).json() if t["p00"] == "TSTROL")
    assert fila["rol"] == "TECNICO"
    assert fila["estado_cuenta"] == "ACTIVO"

    # Y cada cambio quedó en la auditoría
    movimientos = db_session.scalars(
        select(Auditoria).where(Auditoria.accion == "CAMBIO_ROL")
    ).all()
    assert len(movimientos) >= 2
    assert {m.datos_despues.get("rol") for m in movimientos} >= {"SUPERVISOR", "TECNICO"}


def test_cambio_rol_sin_cuenta_inexistente(client, admin_token):
    r = client.patch("/api/v1/tecnicos/999999/rol", json={"rol": "TECNICO"},
                     headers=admin_token["super"])
    assert r.status_code == 404


def test_setup_rechaza_correo_duplicado(client, admin_token):
    """Un correo ya registrado devuelve 409 claro, no un error 500 (D-69)."""
    compartido = "mismo@cantv.com.ve"
    for p00 in ("TSTCDPA", "TSTCDPB"):
        r = client.post(
            "/api/v1/tecnicos",
            json={"id_central": admin_token["id_central"], "nombre": p00, "p00": p00},
            headers=admin_token["admin"],
        )
        assert r.status_code == 201, r.text

    # El primer técnico activa su cuenta con ese correo
    primero = client.post(
        "/api/v1/auth/setup",
        json={"p00": "TSTCDPA", "correo": compartido,
              "clave": "clave12345", "confirmacion": "clave12345"},
    )
    assert primero.status_code == 200, primero.text

    # El segundo no puede reutilizarlo: 409 con mensaje claro (no un 500)
    segundo = client.post(
        "/api/v1/auth/setup",
        json={"p00": "TSTCDPB", "correo": compartido,
              "clave": "clave12345", "confirmacion": "clave12345"},
    )
    assert segundo.status_code == 409, segundo.text
    assert "correo" in segundo.json()["detail"].lower()

    # Con su propio correo sí puede activarse
    tercero = client.post(
        "/api/v1/auth/setup",
        json={"p00": "TSTCDPB", "correo": "otro@cantv.com.ve",
              "clave": "clave12345", "confirmacion": "clave12345"},
    )
    assert tercero.status_code == 200, tercero.text
    assert len(tercero.json()["palabras"]) == 12


# --------------------------------------------------------------------------- #
# Sección Usuario de la APK (D-82): perfil, cambio de clave y palabras
# --------------------------------------------------------------------------- #
def _token(client, p00: str, clave: str) -> dict:
    r = client.post("/api/v1/auth/login", json={"p00": p00, "clave": clave})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_ver_palabras_de_seguridad_exige_la_clave_actual(client, usuario_creado, db_session):
    """`POST /auth/palabras/mostrar` (sección Usuario de la APK): solo con la
    contraseña actual, regenera las 12 palabras, se audita y las anteriores
    quedan invalidadas."""
    clave = "nueva123456"
    setup = client.post(
        "/api/v1/auth/setup",
        json={"p00": P00, "correo": "tecnico@cantv.com.ve",
              "clave": clave, "confirmacion": clave},
    )
    assert setup.status_code == 200, setup.text
    viejas = setup.json()["palabras"]
    assert len(viejas) == 12

    cabeceras = _token(client, P00, clave)

    # Sin la clave correcta no se muestran (403).
    malo = client.post("/api/v1/auth/palabras/mostrar", json={"clave": "incorrecta"},
                       headers=cabeceras)
    assert malo.status_code == 403, malo.text

    estado = client.get("/api/v1/auth/mi-seguridad", headers=cabeceras)
    assert estado.status_code == 200, estado.text
    assert estado.json()["tiene_palabras"] is True
    assert estado.json()["cantidad"] == 12
    version_antes = estado.json()["version"]

    # Se audita solo el movimiento de esta llamada (la tabla no se limpia entre
    # corridas y puede conservar filas de ejecuciones anteriores).
    from app.models import Auditoria

    ultimo_id = db_session.scalar(select(func.max(Auditoria.id_auditoria))) or 0

    # Con la clave actual se devuelven las 12 palabras (regeneradas).
    r = client.post("/api/v1/auth/palabras/mostrar", json={"clave": clave},
                    headers=cabeceras)
    assert r.status_code == 200, r.text
    nuevas = r.json()["palabras"]
    assert len(nuevas) == 12
    assert nuevas != viejas
    assert r.json()["p00"] == P00

    # Queda registrado en la auditoría, sin guardar los valores.
    movimientos = db_session.scalars(
        select(Auditoria).where(
            Auditoria.id_auditoria > ultimo_id,
            Auditoria.accion == "REGENERAR_PALABRAS_PROPIO",
        )
    ).all()
    assert len(movimientos) == 1
    assert movimientos[0].usuario == P00
    # La auditoría guarda solo el contador de versión, nunca los valores.
    assert set(movimientos[0].datos_despues) == {"version_palabras"}
    assert set(movimientos[0].datos_antes or {}) == {"version_palabras"}

    # La versión sube y las palabras nuevas desbloquean la cuenta.
    despues = client.get("/api/v1/auth/mi-seguridad", headers=cabeceras).json()
    assert despues["version"] == (version_antes or 0) + 1

    def tres(lista):
        return [{"pos": 1, "valor": lista[0]},
                {"pos": 5, "valor": lista[4]},
                {"pos": 9, "valor": lista[8]}]

    assert client.post("/api/v1/auth/unlock",
                       json={"p00": P00, "palabras": tres(nuevas)}).status_code == 200
    # Las anteriores ya no sirven.
    assert client.post("/api/v1/auth/unlock",
                       json={"p00": P00, "palabras": tres(viejas)}).status_code == 401


def test_cambio_de_clave_desde_la_seccion_usuario(client, usuario_creado):
    """`POST /auth/cambio-clave` exige la clave actual y deja entrar con la nueva."""
    cabeceras = _token(client, P00, CLAVE_INICIAL)

    assert client.post("/api/v1/auth/cambio-clave", json={
        "clave_actual": "incorrecta",
        "clave_nueva": "nueva123456",
        "confirmacion": "nueva123456",
    }, headers=cabeceras).status_code == 401

    assert client.post("/api/v1/auth/cambio-clave", json={
        "clave_actual": CLAVE_INICIAL,
        "clave_nueva": "nueva123456",
        "confirmacion": "otra123456",
    }, headers=cabeceras).status_code == 422

    r = client.post("/api/v1/auth/cambio-clave", json={
        "clave_actual": CLAVE_INICIAL,
        "clave_nueva": "nueva123456",
        "confirmacion": "nueva123456",
    }, headers=cabeceras)
    assert r.status_code == 200, r.text

    assert client.post("/api/v1/auth/login",
                       json={"p00": P00, "clave": CLAVE_INICIAL}).status_code == 401
    assert client.post("/api/v1/auth/login",
                       json={"p00": P00, "clave": "nueva123456"}).status_code == 200


def test_perfil_propio_muestra_datos_personales_y_permite_el_correo(client, usuario_creado):
    """`GET /auth/me` (datos personales) y `PATCH /auth/me` (correo)."""
    cabeceras = _token(client, P00, CLAVE_INICIAL)

    perfil = client.get("/api/v1/auth/me", headers=cabeceras)
    assert perfil.status_code == 200, perfil.text
    assert perfil.json()["p00"] == P00
    assert perfil.json()["rol"] == "TECNICO"
    assert perfil.json()["id_central"] == 1

    actualizado = client.patch("/api/v1/auth/me", json={"correo": "nuevo@cantv.com.ve"},
                               headers=cabeceras)
    assert actualizado.status_code == 200, actualizado.text
    assert actualizado.json()["correo"] == "nuevo@cantv.com.ve"

