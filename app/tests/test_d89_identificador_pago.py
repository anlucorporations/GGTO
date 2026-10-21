"""Pruebas de integración del ciclo D-89 — identificador de pago (70*).

Requieren `GGTO_TEST_DB_URL`. Cubren:

- clasificación 70*/contacto en la ingesta y enlace al identificador (RF-45/46);
- `caso.telefono = NULL` cuando el número no es 70* (H-03);
- suma idempotente `[CONTACTO]` a `informacion` (RN-IP-02);
- contadores, `avisos` y contrato de `GET /ingesta/lotes/{id}` (RF-56);
- identificación 1 → N reportes y patrón parametrizable (DEC-IP-1/6);
- validación del encabezado de 80 columnas (RT-20);
- trigger de REPARACIÓN → REFERIDO y regularización de filas históricas (H-01);
- resolución idempotente/concurrente y migración idempotente (RT-17/RT-18).
"""

from __future__ import annotations

import importlib.util
import pathlib

from sqlalchemy import func, select, text

from app.models import IdentificadorPago
from app.models.caso_entities import Caso, IngestaLote
from app.services.pagos import (
    historico_por_identificador,
    normalizar_numero,
    resolver_identificador,
)

INGESTA = "/api/v1/ingesta"
CENTRAL = "2324X"
RAIZ = pathlib.Path(__file__).resolve().parents[2]


# --------------------------------------------------------------------------- #
# Apoyo
# --------------------------------------------------------------------------- #
def _fila(
    id_averia: str,
    telefono: str = "",
    contacto: str = "",
    direccion: str = "AVENIDA DEMO 1",
    nombre: str = "CLIENTE DEMO",
) -> list[str]:
    c = [""] * 80
    c[8], c[9], c[10] = CENTRAL, "CENTRAL DEMO", id_averia
    c[13], c[14], c[16] = telefono, "12/09/2026 10:00:00 a.m.", contacto
    c[32], c[33] = nombre, direccion
    return c


def _csv(filas: list[list[str]], columnas: int = 80) -> bytes:
    encabezado = ";".join(f"c{i}" for i in range(columnas))
    cuerpo = "\n".join(";".join(f) for f in filas)
    return f"{encabezado}\n{cuerpo}\n".encode("iso-8859-1")


def _subir(client, headers, contenido: bytes, endpoint: str = INGESTA):
    return client.post(
        endpoint,
        files={"archivo": ("detalle_averias_gpon.csv", contenido, "text/csv")},
        headers=headers,
    )


def _caso(db, id_averia: str) -> Caso:
    db.rollback()
    caso = db.scalar(select(Caso).where(Caso.id_averia == id_averia))
    assert caso is not None, f"no se encontró el caso {id_averia}"
    return caso


def _modulo_migracion():
    ruta = RAIZ / "scripts" / "migrar_d89_identificador_pago.py"
    spec = importlib.util.spec_from_file_location("migrar_d89", ruta)
    assert spec and spec.loader
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


def _cursor(engine):
    """Conexión cruda (psycopg2) para probar la migración como lo haría el script."""
    return engine.raw_connection()


# --------------------------------------------------------------------------- #
# RF-45/RF-46/RF-56 · Clasificación en la ingesta
# --------------------------------------------------------------------------- #
def test_la_ingesta_clasifica_identificador_y_contacto(client, admin_token, db_session):
    contenido = _csv([
        _fila("TSTIP01", telefono="701-400.0848", contacto="0422-310-9000"),
        _fila("TSTIP02", telefono="0414-222-3344"),
        _fila("TSTIP03", telefono="7014000849"),
    ])
    r = _subir(client, admin_token["admin"], contenido)
    assert r.status_code == 201, r.text
    cuerpo = r.json()
    assert cuerpo["casos_nuevos"] == 3
    assert cuerpo["filas_sin_identificador_pago"] == 1
    assert cuerpo["filas_con_contacto"] == 2
    assert [a["id_averia"] for a in cuerpo["avisos_detalle"]] == ["TSTIP02"]
    assert cuerpo["avisos_detalle"][0]["motivo"] == "NO_CUMPLE_PATRON"

    # Con identificador y contacto: la marca se suma a informacion.
    uno = _caso(db_session, "TSTIP01")
    assert uno.telefono == "7014000848"
    assert uno.id_pago is not None
    assert uno.contacto_cliente == "4223109000"
    assert "[CONTACTO] 4223109000" in (uno.informacion or "")

    # Número no válido: no es identificador y `telefono` queda NULL (H-03).
    dos = _caso(db_session, "TSTIP02")
    assert dos.telefono is None
    assert dos.id_pago is None
    assert dos.contacto_cliente == "4142223344"
    assert "[CONTACTO] 4142223344" in (dos.informacion or "")

    # El identificador es una sola ficha por número.
    assert db_session.scalar(select(func.count()).select_from(IdentificadorPago)) == 2


def test_el_lote_expone_contadores_y_avisos(client, admin_token, db_session):
    contenido = _csv([
        _fila("TSTIP04", telefono="7014000850", contacto="0412-111-2233"),
        _fila("TSTIP05", telefono="0412-111-2244"),
    ])
    id_lote = _subir(client, admin_token["admin"], contenido).json()["id_lote"]

    r = client.get(f"{INGESTA}/lotes/{id_lote}", headers=admin_token["admin"])
    assert r.status_code == 200, r.text
    lote = r.json()
    assert lote["estado"] == "OK"
    assert lote["filas_sin_identificador_pago"] == 1
    assert lote["filas_con_contacto"] == 2
    assert lote["avisos"][0]["id_averia"] == "TSTIP05"


def test_un_identificador_agrupa_varios_reportes(client, admin_token, db_session):
    contenido = _csv([
        _fila("TSTIP10", telefono="7014000851"),
        _fila("TSTIP11", telefono="701-400.0851"),
        _fila("TSTIP12", telefono="7014000852"),
    ])
    r = _subir(client, admin_token["admin"], contenido)
    assert r.status_code == 201, r.text

    primero = _caso(db_session, "TSTIP10")
    segundo = _caso(db_session, "TSTIP11")
    tercero = _caso(db_session, "TSTIP12")
    assert primero.id_pago == segundo.id_pago
    assert tercero.id_pago != primero.id_pago
    assert db_session.scalar(select(func.count()).select_from(IdentificadorPago)) == 2

    historico = historico_por_identificador(db_session, primero.id_pago)
    assert {c.id_averia for c in historico} == {"TSTIP10", "TSTIP11"}


def test_la_reingesta_no_duplica_la_marca_de_contacto(client, admin_token, db_session):
    contenido = _csv([_fila("TSTIP20", telefono="7014000853", contacto="0416-555-6677")])
    assert _subir(client, admin_token["admin"], contenido).status_code == 201

    antes = _caso(db_session, "TSTIP20").informacion or ""
    assert antes.count("[CONTACTO] 4165556677") == 1

    segunda = _subir(client, admin_token["admin"], contenido)
    assert segunda.status_code == 201
    assert segunda.json()["casos_nuevos"] == 0

    despues = _caso(db_session, "TSTIP20").informacion or ""
    assert despues == antes
    assert despues.count("[CONTACTO]") == 1


def test_el_patron_del_identificador_es_configurable(client, admin_token, db_session):
    db_session.execute(
        text("UPDATE configuracion SET valor = '\"^703[0-9]{7}$\"'::jsonb "
             "WHERE clave = 'pago.serie_regex'")
    )
    db_session.commit()
    try:
        contenido = _csv([
            _fila("TSTIP30", telefono="7030000001"),
            _fila("TSTIP31", telefono="7014000854"),
        ])
        r = _subir(client, admin_token["admin"], contenido)
        assert r.status_code == 201, r.text
        assert r.json()["filas_sin_identificador_pago"] == 1

        con_patron_nuevo = _caso(db_session, "TSTIP30")
        assert con_patron_nuevo.id_pago is not None
        fuera_del_patron = _caso(db_session, "TSTIP31")
        assert fuera_del_patron.id_pago is None
        assert fuera_del_patron.telefono is None
    finally:
        db_session.execute(
            text("UPDATE configuracion SET valor = '\"^70[0-9]{8}$\"'::jsonb "
                 "WHERE clave = 'pago.serie_regex'")
        )
        db_session.commit()


# --------------------------------------------------------------------------- #
# RT-20 · Encabezado de 80 columnas
# --------------------------------------------------------------------------- #
def test_encabezado_invalido_rechaza_el_lote(client, admin_token, db_session):
    antes = db_session.scalar(select(func.count()).select_from(Caso))

    r = _subir(client, admin_token["admin"], _csv([_fila("TSTIP40")], columnas=79))
    assert r.status_code == 422, r.text
    assert "80" in r.text

    db_session.rollback()
    assert db_session.scalar(select(func.count()).select_from(Caso)) == antes
    ultimo = db_session.scalars(
        select(IngestaLote).order_by(IngestaLote.id_lote.desc()).limit(1)
    ).first()
    assert ultimo is not None and ultimo.estado == "ERROR"
    assert ultimo.filas_leidas == 0


def test_preview_tambien_valida_el_encabezado(client, admin_token):
    r = _subir(
        client, admin_token["admin"], _csv([_fila("TSTIP41")], columnas=79),
        endpoint=f"{INGESTA}/preview",
    )
    assert r.status_code == 422


# --------------------------------------------------------------------------- #
# RF-49 / H-01 · REPARACIÓN sin 70* o sin avería real
# --------------------------------------------------------------------------- #
def test_una_reparacion_sin_identificador_se_guarda_como_referido(db_session, admin_token):
    central = admin_token["id_central"]
    caso = Caso(
        id_central=central,
        id_averia="TSTREP01",
        tipo_caso="REPARACION",
        categoria="RESIDENCIAL",
        estado_actual="NUEVO",
        ayudantes=[],
    )
    db_session.add(caso)
    db_session.commit()
    db_session.refresh(caso)

    assert caso.tipo_caso == "REFERIDO"
    assert caso.categoria == "REFERIDO"


def test_una_reparacion_con_identificador_y_averia_real_se_conserva(db_session, admin_token):
    central = admin_token["id_central"]
    id_pago = resolver_identificador(db_session, "7014000856", central, "TITULAR", "DIR")
    caso = Caso(
        id_central=central,
        id_averia="TSTAV9001",
        tipo_caso="REPARACION",
        categoria="RESIDENCIAL",
        estado_actual="NUEVO",
        id_pago=id_pago,
        ayudantes=[],
    )
    db_session.add(caso)
    db_session.commit()
    db_session.refresh(caso)
    assert caso.tipo_caso == "REPARACION"


def test_una_fila_historica_marcada_se_regulariza_en_su_proximo_cambio(
    db_session, admin_token
):
    """Simula una fila creada antes del CHECK/trigger y comprueba que su
    siguiente cambio no falla y la reclasifica (DEC-IP-3 / H-01)."""
    central = admin_token["id_central"]
    db_session.execute(text("ALTER TABLE caso DROP CONSTRAINT IF EXISTS ck_reparacion_con_ip"))
    db_session.execute(text("ALTER TABLE caso DISABLE TRIGGER trg_caso_reparacion_a_referido"))
    db_session.execute(
        text(
            "INSERT INTO caso (id_central, id_averia, tipo_caso, categoria, estado_actual) "
            "VALUES (:c, 'TSTLEG01', 'REPARACION', 'RESIDENCIAL', 'NUEVO')"
        ),
        {"c": central},
    )
    db_session.commit()
    try:
        db_session.execute(
            text("ALTER TABLE caso ENABLE TRIGGER trg_caso_reparacion_a_referido")
        )
        db_session.execute(
            text(
                "ALTER TABLE caso ADD CONSTRAINT ck_reparacion_con_ip "
                "CHECK (tipo_caso <> 'REPARACION' "
                "OR (id_pago IS NOT NULL AND id_averia NOT LIKE 'REF-%')) NOT VALID"
            )
        )
        db_session.commit()

        # El «próximo cambio» de la fila marcada no puede fallar.
        db_session.execute(
            text("UPDATE caso SET estado_actual = 'ASIGNADO' WHERE id_averia = 'TSTLEG01'")
        )
        db_session.commit()

        fila = db_session.execute(
            text("SELECT tipo_caso, categoria, estado_actual FROM caso "
                 "WHERE id_averia = 'TSTLEG01'")
        ).first()
        assert fila is not None
        assert fila[0] == "REFERIDO"
        assert fila[1] == "REFERIDO"
        assert fila[2] == "ASIGNADO"
    finally:
        db_session.rollback()


def test_no_quedan_filas_marcadas_tras_escribir(db_session, admin_token):
    central = admin_token["id_central"]
    for id_averia, con_ip in (("TSTREP10", False), ("TSTREP11", True)):
        id_pago = (
            resolver_identificador(db_session, "7014000857", central) if con_ip else None
        )
        db_session.add(
            Caso(
                id_central=central,
                id_averia=id_averia,
                tipo_caso="REPARACION",
                categoria="RESIDENCIAL",
                estado_actual="NUEVO",
                id_pago=id_pago,
                ayudantes=[],
            )
        )
    db_session.commit()
    db_session.rollback()

    marcados = db_session.execute(
        text(
            "SELECT count(*) FROM caso WHERE tipo_caso = 'REPARACION' "
            "AND (id_pago IS NULL OR id_averia LIKE 'REF-%')"
        )
    ).scalar()
    assert marcados == 0


# --------------------------------------------------------------------------- #
# RF-45 / H-07 · Resolución idempotente
# --------------------------------------------------------------------------- #
def test_resolver_identificador_es_idempotente(client, admin_token, db_session):
    central = admin_token["id_central"]
    primero = resolver_identificador(db_session, "701-400.0858", central, "TITULAR", "DIR")
    db_session.commit()
    segundo = resolver_identificador(db_session, "7014000858", central)
    db_session.commit()

    assert primero == segundo
    total = db_session.scalar(
        select(func.count()).select_from(IdentificadorPago).where(
            IdentificadorPago.numero == "7014000858"
        )
    )
    assert total == 1
    assert normalizar_numero("701-400.0858") == "7014000858"


# --------------------------------------------------------------------------- #
# RT-19 (adelanto) · Alta manual y edición con identificador de pago
# --------------------------------------------------------------------------- #
def test_el_alta_manual_enlaza_el_identificador(client, admin_token, db_session):
    r = client.post(
        "/api/v1/casos",
        json={
            "id_averia": "TSTMAN01",
            "tipo_reporte": "REPARACION",
            "tipo_problema": "SIN_SERVICIO",
            "nombre_cliente": "CLIENTE MANUAL",
            "contacto_cliente": "04127778899",
            "direccion": "CALLE MANUAL 1",
            "id_pago": "701-400.0860",
        },
        headers=admin_token["admin"],
    )
    assert r.status_code == 201, r.text
    cuerpo = r.json()
    assert cuerpo["tipo_caso"] == "REPARACION"  # no se reclasifica: tiene IP y avería real
    assert cuerpo["id_pago"] is not None
    assert cuerpo["telefono"] == "7014000860"

    # RN-AL-01: sin el identificador de pago (70*) el alta manual ya no entra.
    r2 = client.post(
        "/api/v1/casos",
        json={"id_averia": "TSTMAN02", "tipo_reporte": "REPARACION",
              "tipo_problema": "SIN_SERVICIO", "nombre_cliente": "CLIENTE MANUAL",
              "contacto_cliente": "0412-777-8899", "direccion": "CALLE MANUAL 2"},
        headers=admin_token["admin"],
    )
    assert r2.status_code == 422, r2.text


def test_la_edicion_interpreta_el_telefono(client, admin_token, db_session):
    creado = client.post(
        "/api/v1/casos",
        json={"id_averia": "TSTMAN03", "nombre_cliente": "CLIENTE EDIT",
              "contacto_cliente": "04123334455", "direccion": "CALLE EDIT 3",
              "tipo_reporte": "CONSTRUCCION", "id_pago": "7014000862"},
        headers=admin_token["admin"],
    ).json()
    id_caso = creado["id_caso"]

    # Un número que no es 70* pasa a contacto y el alias queda NULL.
    r = client.patch(
        f"/api/v1/casos/{id_caso}",
        json={"telefono": "0412-333-4455"},
        headers=admin_token["admin"],
    )
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert cuerpo["telefono"] is None
    assert cuerpo["contacto_cliente"] == "4123334455"

    caso = _caso(db_session, "TSTMAN03")
    assert "[CONTACTO] 4123334455" in (caso.informacion or "")
    assert caso.id_pago is not None  # el identificador anterior se conserva

    # Un 70* se resuelve como identificador y queda como alias.
    r2 = client.patch(
        f"/api/v1/casos/{id_caso}",
        json={"id_pago": "701-400.0863"},
        headers=admin_token["admin"],
    )
    assert r2.status_code == 200, r2.text
    assert r2.json()["telefono"] == "7014000863"


# --------------------------------------------------------------------------- #
# RT-17 / RT-18 · Migración
# --------------------------------------------------------------------------- #
def test_la_migracion_es_idempotente(engine, admin_token):
    modulo = _modulo_migracion()
    conexion = _cursor(engine)
    try:
        cur = conexion.cursor()
        for _ in range(2):  # aplicar el DDL dos veces no debe fallar
            for _titulo, sql in modulo.DDL:
                cur.execute(sql)
        conexion.commit()

        patron = modulo.patron_vigente(cur)
        assert patron == "^70[0-9]{8}$"
        assert modulo.verificar(cur) == []

        cur.execute(
            "SELECT count(*) FROM pg_policies "
            "WHERE policyname = 'p_ip_central' AND schemaname = current_schema()"
        )
        assert cur.fetchone()[0] == 1
    finally:
        conexion.rollback()
        conexion.close()


def test_el_backfill_enlaza_un_caso_legado(engine, db_session, admin_token):
    modulo = _modulo_migracion()
    central = admin_token["id_central"]
    db_session.add(
        Caso(
            id_central=central,
            id_averia="TSTIP50",
            tipo_caso="AVERIA",
            categoria="RESIDENCIAL",
            estado_actual="NUEVO",
            telefono="701-400.0859",  # legado: sin normalizar
            ayudantes=[],
        )
    )
    db_session.commit()

    conexion = _cursor(engine)
    try:
        cur = conexion.cursor()
        resultado = modulo.aplicar_backfill(cur, "^70[0-9]{8}$", con_contactos=False)
        conexion.commit()
        assert resultado["casos_enlazados"] >= 1

        cur.execute(
            "SELECT c.id_pago, c.telefono, ip.numero FROM caso c "
            "JOIN identificador_pago ip ON ip.id_pago = c.id_pago "
            "WHERE c.id_averia = 'TSTIP50'"
        )
        fila = cur.fetchone()
        assert fila is not None
        assert fila[1] == "7014000859"
        assert fila[2] == "7014000859"
    finally:
        conexion.rollback()
        conexion.close()
