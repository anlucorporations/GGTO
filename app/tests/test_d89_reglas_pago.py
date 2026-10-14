"""Pruebas unitarias del ciclo D-89 — reglas del identificador de pago (70*).

No requieren base de datos: cubren el normalizador (RN-IP-07), el patrón
parametrizable (DEC-IP-1), la clasificación 70*/contacto (RN-IP-01/02), la suma
idempotente a `informacion` y la validación del encabezado (RT-20).
"""

from __future__ import annotations

import pytest

from app.services.ingesta import columnas_encabezado, encabezado_valido
from app.services.pagos import (
    MOTIVO_NO_CUMPLE_PATRON,
    MOTIVO_SIN_NUMERO,
    PATRON_POR_DEFECTO,
    clasificar_numeros,
    compilar_patron,
    componer_informacion,
    dias_reincidencia,
    es_identificador_pago,
    normalizar_numero,
    patron_config,
)


def _csv(columnas: int) -> bytes:
    encabezado = ";".join(f"c{i}" for i in range(columnas))
    fila = ";".join("x" for _ in range(columnas))
    return f"{encabezado}\n{fila}\n".encode("iso-8859-1")


# --------------------------------------------------------------------------- #
# RN-IP-07 · Normalización
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize(
    ("entrada", "esperado"),
    [
        ("7014000848", "7014000848"),
        ("+58 0414-222-3344", "4142223344"),
        ("0058 701-400.0848", "7014000848"),
        ("0422-310-9000", "4223109000"),
        ("7014 000 848", "7014000848"),
        ("", ""),
        (None, ""),
        ("<TEL>", ""),
    ],
)
def test_normalizar_numero(entrada, esperado):
    assert normalizar_numero(entrada) == esperado


# --------------------------------------------------------------------------- #
# DEC-IP-1 · Patrón parametrizable
# --------------------------------------------------------------------------- #
def test_patron_por_defecto_y_configurado():
    assert patron_config({}) == PATRON_POR_DEFECTO
    assert patron_config({"pago.serie_regex": '"^70[0-9]{8}$"'}) == "^70[0-9]{8}$"
    assert patron_config({"pago.serie_regex": "^7[0-9]{9}$"}) == "^7[0-9]{9}$"


def test_patron_invalido_cae_al_de_por_defecto():
    patron = compilar_patron({"pago.serie_regex": "([0-9"})
    assert patron.pattern == PATRON_POR_DEFECTO


def test_cualquier_serie_70_es_identificador():
    patron = compilar_patron({})
    for numero in ("7001234567", "7014000848", "7029999999", "7030000000"):
        assert es_identificador_pago(numero, patron), numero
    for numero in ("04142223344", "4142223344", "70140008", "", "8012345678"):
        assert not es_identificador_pago(numero, patron), numero


def test_dias_reincidencia_configurable():
    assert dias_reincidencia({}) == 90
    assert dias_reincidencia({"pago.reincidencia_dias": 30}) == 30
    assert dias_reincidencia({"pago.reincidencia_dias": '"45"'}) == 45
    assert dias_reincidencia({"pago.reincidencia_dias": "no-es-numero"}) == 90


# --------------------------------------------------------------------------- #
# RN-IP-01/02 · Clasificación de los números de una fila
# --------------------------------------------------------------------------- #
def test_identificador_y_contacto():
    clasificacion = clasificar_numeros(
        {"telefono": "701-400.0848", "contacto_cliente": "0422-310-9000"},
        compilar_patron({}),
    )
    assert clasificacion.identificador == "7014000848"
    assert clasificacion.contacto_principal == "4223109000"
    assert clasificacion.contactos == ["4223109000"]
    assert not clasificacion.sin_identificador


def test_sin_identificador_por_numero_no_valido():
    clasificacion = clasificar_numeros(
        {"telefono": "0414-222-3344", "contacto_cliente": "0424-111-2233"},
        compilar_patron({}),
    )
    assert clasificacion.identificador is None
    assert clasificacion.contacto_principal == "4241112233"  # manda la columna 16
    assert clasificacion.contactos == ["4241112233", "4142223344"]
    assert clasificacion.motivo == MOTIVO_NO_CUMPLE_PATRON


def test_sin_numero_en_la_columna_13():
    clasificacion = clasificar_numeros(
        {"telefono": "", "contacto_cliente": "0422-310-9000"}, compilar_patron({})
    )
    assert clasificacion.sin_identificador
    assert clasificacion.motivo == MOTIVO_SIN_NUMERO
    assert clasificacion.contactos == ["4223109000"]


def test_un_70_en_la_columna_de_contacto_es_identificador():
    clasificacion = clasificar_numeros(
        {"telefono": "", "contacto_cliente": "7014000848"}, compilar_patron({})
    )
    assert clasificacion.identificador == "7014000848"
    assert clasificacion.contactos == []


def test_los_numeros_del_tecnico_no_son_contacto():
    fila = {
        "telefono": "7014000848",
        "contacto_cliente": "",
        "telefono_oficina": "02121234567",
        "telefono_movil": "04161112233",
    }
    clasificacion = clasificar_numeros(fila, compilar_patron({}))
    assert clasificacion.contactos == []


# --------------------------------------------------------------------------- #
# RN-IP-02 · Suma a `informacion`
# --------------------------------------------------------------------------- #
def test_componer_informacion_agrega_la_marca():
    assert componer_informacion("NAVEGA LENTO", ["4223109000"]) == (
        "NAVEGA LENTO\n[CONTACTO] 4223109000"
    )
    assert componer_informacion(None, ["4223109000"]) == "[CONTACTO] 4223109000"


def test_componer_informacion_es_idempotente():
    una = componer_informacion("NAVEGA LENTO", ["4223109000"])
    dos = componer_informacion(una, ["4223109000"])
    assert dos == una
    assert dos.count("[CONTACTO] 4223109000") == 1


def test_componer_informacion_con_varios_contactos():
    assert componer_informacion(None, ["4223109000", "4142223344"]) == (
        "[CONTACTO] 4223109000 | 4142223344"
    )


# --------------------------------------------------------------------------- #
# RT-20 · Encabezado de 80 columnas
# --------------------------------------------------------------------------- #
def test_encabezado_de_80_columnas_es_valido():
    assert columnas_encabezado(_csv(80)) == 80
    assert encabezado_valido(_csv(80))


def test_encabezado_con_79_columnas_no_es_valido():
    assert columnas_encabezado(_csv(79)) == 79
    assert not encabezado_valido(_csv(79))


def test_archivo_vacio_no_tiene_encabezado_valido():
    assert columnas_encabezado(b"") == 0
    assert not encabezado_valido(b"")
