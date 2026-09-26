"""Pruebas unitarias de sectorización y del criterio de la cuadrilla 0."""

from __future__ import annotations

import pytest

from app.services.cuadrilla0 import evaluar
from app.services.sectorizacion import Patron, asignar_sector

# --------------------------------------------------------------------------- #
# Sectorización
# --------------------------------------------------------------------------- #

PATRONES = [
    Patron(id_sector=1, patron="VALLE ARRIBA"),
    Patron(id_sector=2, patron="CONCRESA"),
    Patron(id_sector=3, patron="PARQUE HUMBOLDT"),
    Patron(id_sector=2, patron="CUMBRES DE CURUMO"),
]


@pytest.mark.parametrize(
    ("direccion", "esperado"),
    [
        ("CUMBRES DE CURUMO AVENIDA PRINCIPAL S/N", 2),
        ("SECTOR VALLE ARRIBA CALLE 3", 1),
        ("RESIDENCIAS CONCRESA TORRE B", 2),
        ("AV PARQUE HUMBOLDT PISO 2", 3),
        ("DIRECCION DESCONOCIDA 123", None),
        (None, None),
        ("", None),
    ],
)
def test_asignar_sector_contiene(direccion, esperado):
    assert asignar_sector(direccion, PATRONES) == esperado


def test_asignar_sector_ignora_acentos_y_mayusculas():
    assert asignar_sector("valle arriba, casa 4", PATRONES) == 1


def test_patron_mas_largo_gana():
    patrones = [
        Patron(id_sector=10, patron="SANTA"),
        Patron(id_sector=20, patron="SANTA CRUZ"),
    ]
    assert asignar_sector("SECTOR SANTA CRUZ NORTE", patrones) == 20


def test_tipo_exacto_y_regex():
    exacto = [Patron(id_sector=5, patron="Calle 5", tipo_coincidencia="EXACTO")]
    assert asignar_sector("CALLE 5", exacto) == 5
    assert asignar_sector("CALLE 5 CON AV 3", exacto) is None

    regex = [Patron(id_sector=7, patron=r"SECTOR\s+\d+", tipo_coincidencia="REGEX")]
    assert asignar_sector("SECTOR 42 AV PRINCIPAL", regex) == 7


def test_regex_invalido_no_rompe():
    invalido = [Patron(id_sector=9, patron="([a-z", tipo_coincidencia="REGEX")]
    assert asignar_sector("cualquier cosa", invalido) is None


# --------------------------------------------------------------------------- #
# Cuadrilla 0
# --------------------------------------------------------------------------- #

CASO_CAMPO = {
    "problema_reporte": "LOSS ROJO EN EL POSTE",
    "ultimo_comentario": "",
    "informacion": "",
}
CASO_SUPERVISOR = {
    "problema_reporte": "PON INTERMITENTE",
    "ultimo_comentario": "",
    "informacion": "",
}
CASO_NEUTRO = {
    "problema_reporte": "SIN NOVEDAD",
    "ultimo_comentario": "cliente ausente",
    "informacion": "",
}


def test_modo_campo():
    assert evaluar(CASO_CAMPO, {"despacho.criterio_cuadrilla0": "CAMPO"}) is False
    assert evaluar(CASO_NEUTRO, {"despacho.criterio_cuadrilla0": "CAMPO"}) is True


def test_modo_supervisor():
    assert evaluar(CASO_SUPERVISOR, {"despacho.criterio_cuadrilla0": "SUPERVISOR"}) is True
    assert evaluar(CASO_CAMPO, {"despacho.criterio_cuadrilla0": "SUPERVISOR"}) is False


def test_modo_union_por_defecto():
    # Caso de campo explícito → no va al supervisor
    assert evaluar(CASO_CAMPO) is False
    # Frase de no-atención en casa → va al supervisor
    assert evaluar(CASO_SUPERVISOR) is True
    # Sin frases de campo → va al supervisor (PROCEDIMIENTO 3)
    assert evaluar(CASO_NEUTRO) is True


def test_frase_con_acentos_case_insensitive():
    caso = {"problema_reporte": "se detecta fibra dañada en el tramo", "ultimo_comentario": ""}
    assert evaluar(caso, {"despacho.criterio_cuadrilla0": "CAMPO"}) is False


def test_columnas_configurables():
    caso = {"problema_reporte": "", "ultimo_comentario": "", "informacion": "NAVEGACION LENTA"}
    assert evaluar(caso, {"despacho.criterio_cuadrilla0": "SUPERVISOR"}) is True
    solo_problema = {
        "despacho.criterio_cuadrilla0": "SUPERVISOR",
        "despacho.columnas_evaluar": ["problema_reporte"],
    }
    assert evaluar(caso, solo_problema) is False
