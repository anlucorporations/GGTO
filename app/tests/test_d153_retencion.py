"""D-153 · retención por entidad (H-25).

La retención declarada en `requerimientos.md` §5.1 solo se aplicaba a mensajes,
`sync_log` y auditoría —y la auditoría se borraba al año en vez de a los tres—.
Estas pruebas fijan el comportamiento de cada entidad: qué se elimina, qué se
anonimiza y qué se conserva.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.models import (
    Actividad,
    Auditoria,
    Caso,
    CasoEspecial,
    Evidencia,
    IdentificadorPago,
    Notificacion,
    Solicitante,
)
from app.services import purga as svc

AHORA = datetime(2026, 10, 22, 12, 0, tzinfo=UTC)


def _hace(dias: int) -> datetime:
    return AHORA - timedelta(days=dias)


def _caso(db, id_central: int, id_averia: str, fecha: datetime, **extra) -> Caso:
    caso = Caso(id_central=id_central, id_averia=id_averia, fecha_reporte=fecha, **extra)
    db.add(caso)
    db.commit()
    return caso


def test_la_auditoria_se_conserva_tres_anios(db_session, admin_token):
    db = db_session
    id_central = admin_token["id_central"]
    db.add_all(
        [
            Auditoria(id_central=id_central, accion="D153_VIEJA", fecha_hora=_hace(1100)),
            Auditoria(id_central=id_central, accion="D153_LIMITE", fecha_hora=_hace(400)),
        ]
    )
    db.commit()

    resultado = svc.purgar(db, ahora=AHORA)
    db.expire_all()

    acciones = set(db.scalars(select(Auditoria.accion)).all())
    assert "D153_VIEJA" not in acciones, "más de 3 años: se borra"
    assert "D153_LIMITE" in acciones, "400 días: la retención es de 3 años, no de 365"
    assert resultado["retencion_auditoria_dias"] == 1095


def test_se_eliminan_las_notificaciones_de_mas_de_un_anio(db_session):
    db = db_session
    db.add_all(
        [
            Notificacion(canal="TELEGRAM", asunto="D153_VIEJA", creado_en=_hace(400)),
            Notificacion(canal="TELEGRAM", asunto="D153_LIMITE", creado_en=_hace(300)),
        ]
    )
    db.commit()

    resultado = svc.purgar(db, ahora=AHORA)
    db.expire_all()

    asuntos = set(db.scalars(select(Notificacion.asunto)).all())
    assert "D153_VIEJA" not in asuntos
    assert "D153_LIMITE" in asuntos
    assert resultado["retencion_notificacion_dias"] == 365


def test_se_elimina_la_evidencia_de_mas_de_dos_anios_con_su_imagen(
    db_session, tmp_path, monkeypatch
):
    monkeypatch.setenv("GGTO_EVIDENCIAS_DIR", str(tmp_path))
    relativa = "evidencias/vieja/foto.jpg"
    archivo = tmp_path / relativa
    archivo.parent.mkdir(parents=True)
    archivo.write_bytes(b"foto")

    db = db_session
    vieja = Evidencia(
        tipo="FALLA_MASIVA",
        serial_imagen="D153-VIEJA",
        ruta_local=f"/evidencias-locales/{relativa}",
        fecha_hora=_hace(800),
    )
    reciente = Evidencia(
        tipo="FALLA_MASIVA", serial_imagen="D153-RECIENTE", fecha_hora=_hace(600)
    )
    db.add_all([vieja, reciente])
    db.commit()

    resultado = svc.purgar(db, ahora=AHORA)
    db.expire_all()

    seriales = set(db.scalars(select(Evidencia.serial_imagen)).all())
    assert "D153-VIEJA" not in seriales
    assert "D153-RECIENTE" in seriales
    assert not archivo.exists(), "la imagen también se borra"
    assert resultado["evidencias_eliminadas"] >= 1
    assert resultado["retencion_evidencia_dias"] == 730


def test_se_anonimiza_el_caso_de_mas_de_cinco_anios(db_session, admin_token):
    db = db_session
    id_central = admin_token["id_central"]
    viejo = _caso(
        db,
        id_central,
        "TSTD153-CASO-VIEJO",
        _hace(2190),
        nombre_cliente="MARIA PEREZ",
        telefono="04141112233",
        contacto_cliente="04141112233",
        persona_reporta="JOSE PEREZ",
        direccion="CALLE 1 CASA 2",
        serial="SERIAL123",
        ultimo_comentario="llamar a Maria",
        informacion="dato libre",
        results="resuelto en sitio",
        problema_reporte="sin servicio",
        telefono_oficina="02121234567",
        telefono_movil="04149998877",
        asignado_a="TECNICO UNO",
        despacho_nombre="NOMBRE",
        despacho_apellido="APELLIDO",
        ayudantes=["AYUDANTE UNO"],
    )
    reciente = _caso(
        db,
        id_central,
        "TSTD153-CASO-RECIENTE",
        _hace(1460),
        nombre_cliente="ANA GOMEZ",
        telefono="04145556677",
        direccion="CALLE 3",
    )

    svc.purgar(db, ahora=AHORA)
    db.expire_all()
    db.refresh(viejo)
    db.refresh(reciente)

    assert viejo.nombre_cliente is None
    assert viejo.telefono is None
    assert viejo.contacto_cliente is None
    assert viejo.persona_reporta is None
    assert viejo.direccion is None
    assert viejo.serial is None
    assert viejo.informacion is None
    assert viejo.results is None
    assert viejo.problema_reporte is None
    assert viejo.ayudantes == []
    assert viejo.id_averia == "TSTD153-CASO-VIEJO", "la clave operativa se conserva"

    assert reciente.nombre_cliente == "ANA GOMEZ"
    assert reciente.telefono == "04145556677"


def test_se_anonimiza_la_actividad_de_mas_de_cinco_anios(db_session, admin_token):
    db = db_session
    id_central = admin_token["id_central"]
    caso = _caso(db, id_central, "TSTD153-ACT", _hace(1460))
    vieja = Actividad(
        id_caso=caso.id_caso,
        tipo="CIERRE",
        fecha_hora=_hace(2190),
        reporte_corto="CLIENTE MARIA 04141112233",
        latitud=10.1234567,
        longitud=-66.1234567,
    )
    reciente = Actividad(
        id_caso=caso.id_caso,
        tipo="CIERRE",
        fecha_hora=_hace(1460),
        reporte_corto="SIN NOVEDAD",
        latitud=10.5,
    )
    db.add_all([vieja, reciente])
    db.commit()

    svc.purgar(db, ahora=AHORA)
    db.expire_all()
    db.refresh(vieja)
    db.refresh(reciente)

    assert vieja.reporte_corto is None
    assert vieja.latitud is None
    assert vieja.longitud is None
    assert reciente.reporte_corto == "SIN NOVEDAD"
    assert reciente.latitud is not None


def test_se_anonimiza_el_solicitante_sin_casos_recientes(db_session):
    db = db_session
    viejo = Solicitante(
        unidad="UNIDAD 1",
        nombre="PEDRO PEREZ",
        contacto="04142223344",
        documento="V-12345678",
        creado_en=_hace(2190),
    )
    protegido = Solicitante(
        unidad="UNIDAD 2",
        nombre="LUISA DIAZ",
        contacto="04143334455",
        creado_en=_hace(2190),
    )
    reciente = Solicitante(
        unidad="UNIDAD 3",
        nombre="CARLOS RUIZ",
        contacto="04144445566",
        creado_en=_hace(1460),
    )
    db.add_all([viejo, protegido, reciente])
    db.flush()
    db.add(
        CasoEspecial(
            id_solicitante=protegido.id_solicitante,
            clasificacion="GOBIERNO",
            tipo_actividad="CONSTRUCCION",
            creado_en=_hace(30),
        )
    )
    db.commit()

    svc.purgar(db, ahora=AHORA)
    db.expire_all()
    db.refresh(viejo)
    db.refresh(protegido)
    db.refresh(reciente)

    assert viejo.nombre == svc.ANONIMIZADO
    assert viejo.contacto == svc.ANONIMIZADO
    assert viejo.documento is None
    assert protegido.nombre == "LUISA DIAZ", "un caso especial reciente lo mantiene vigente"
    assert reciente.nombre == "CARLOS RUIZ"


def test_se_anonimiza_el_titular_del_pago_sin_casos_recientes(db_session, admin_token):
    db = db_session
    id_central = admin_token["id_central"]
    viejo = IdentificadorPago(
        numero="7099999991",
        id_central=id_central,
        nombre_titular="TITULAR VIEJO",
        direccion_principal="CALLE VIEJA",
        creado_en=_hace(2190),
    )
    protegido = IdentificadorPago(
        numero="7099999992",
        id_central=id_central,
        nombre_titular="TITULAR VIGENTE",
        direccion_principal="CALLE VIGENTE",
        creado_en=_hace(2190),
    )
    reciente = IdentificadorPago(
        numero="7099999993",
        id_central=id_central,
        nombre_titular="TITULAR NUEVO",
        direccion_principal="CALLE NUEVA",
        creado_en=_hace(1460),
    )
    db.add_all([viejo, protegido, reciente])
    db.flush()
    _caso(
        db,
        id_central,
        "TSTD153-PAGO-VIGENTE",
        _hace(30),
        id_pago=protegido.id_pago,
        nombre_cliente="CLIENTE VIGENTE",
    )

    svc.purgar(db, ahora=AHORA)
    db.expire_all()
    db.refresh(viejo)
    db.refresh(protegido)
    db.refresh(reciente)

    assert viejo.nombre_titular is None
    assert viejo.direccion_principal is None
    assert viejo.numero == "7099999991", "el número se conserva para conciliación"
    assert protegido.nombre_titular == "TITULAR VIGENTE"
    assert reciente.nombre_titular == "TITULAR NUEVO"


def test_el_reporte_incluye_todas_las_entidades_y_es_idempotente(db_session):
    db = db_session
    primero = svc.purgar(db, ahora=AHORA)
    segundo = svc.purgar(db, ahora=AHORA)

    for clave in (
        "mensajes_eliminados",
        "sync_log_eliminadas",
        "auditorias_eliminadas",
        "notificaciones_eliminadas",
        "evidencias_eliminadas",
        "casos_anonimizados",
        "actividades_anonimizadas",
        "solicitantes_anonimizados",
        "pagos_anonimizados",
    ):
        assert clave in primero
        assert clave in segundo
    assert primero["retencion_caso_dias"] == 1825
    assert primero["retencion_actividad_dias"] == 1825
    assert primero["retencion_solicitante_dias"] == 1825
    assert primero["retencion_pago_dias"] == 1825
    # La segunda pasada no encuentra nada nuevo que anonimizar.
    assert segundo["casos_anonimizados"] == 0
    assert segundo["actividades_anonimizadas"] == 0
