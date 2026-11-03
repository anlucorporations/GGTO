"""Pruebas unitarias del parser del CSV (no requieren base de datos)."""

from __future__ import annotations

import pathlib
from datetime import datetime

from app.services.ingesta import (
    CAMPOS_DESTINO,
    CAMPOS_DESTINO_81,
    COLUMNAS_ESPERADAS,
    ESPECIFICACION,
    ESPECIFICACION_81,
    encabezado_valido,
    filtrar_por_central,
    normalizar,
    parse_fecha,
    parsear,
    parsear_encabezado,
)

RUTA_MUESTRA = (
    pathlib.Path(__file__).resolve().parents[2]
    / "RepoTecnico"
    / "muestras"
    / "detalle_averias_gpon_EJEMPLO.csv"
)
RUTA_MUESTRA_81 = (
    pathlib.Path(__file__).resolve().parents[2]
    / "RepoTecnico"
    / "muestras"
    / "detalle_averias_gpon_EJEMPLO_81.csv"
)


def _muestra_bytes() -> bytes:
    return RUTA_MUESTRA.read_bytes()


def _muestra81_bytes() -> bytes:
    return RUTA_MUESTRA_81.read_bytes()


def test_parse_fecha_formatos():
    assert parse_fecha("17/07/2026 11:38:20 a.m.") == datetime(2026, 7, 17, 11, 38, 20)
    assert parse_fecha("10/09/2026 12:00:13 p.m.") == datetime(2026, 9, 10, 12, 0, 13)
    assert parse_fecha("22/08/2026 10:00:00 a. m.") == datetime(2026, 8, 22, 10, 0, 0)
    assert parse_fecha("01/01/2026") == datetime(2026, 1, 1)
    assert parse_fecha("2026-01-01 08:00:00") == datetime(2026, 1, 1, 8, 0, 0)


def test_parse_fecha_vacia_o_invalida():
    assert parse_fecha("") is None
    assert parse_fecha(None) is None
    assert parse_fecha("   ") is None
    assert parse_fecha("no es una fecha") is None


def test_normalizar_quita_acentos_y_mayusculas():
    assert normalizar("  Fibra Dañada ") == "FIBRA DANADA"
    assert normalizar("Navegación Lenta") == "NAVEGACION LENTA"
    assert normalizar(None) == ""


def test_especificacion_cubre_49_campos():
    assert len(CAMPOS_DESTINO) == 49
    assert len(set(CAMPOS_DESTINO)) == 49


def test_encabezado_tiene_80_columnas():
    encabezado = parsear_encabezado(_muestra_bytes().decode("iso-8859-1"))
    assert len(encabezado) == COLUMNAS_ESPERADAS


def test_parsear_muestra_completa():
    filas, avisos = parsear(_muestra_bytes())
    assert len(filas) == 56, f"avisos: {avisos}"
    assert not avisos

    primera = filas[0]
    assert primera["id_averia"] == "DEMO-0001"
    assert primera["region"] == "CAPITAL"
    assert primera["codigo_central"] == "2324X"
    assert primera["nombre_central"].strip() == "FRANCISCO SALIAS"
    # `informacion` unifica las columnas 31, 32 y 52
    assert primera["informacion"]
    assert primera["ayudantes"] == []
    assert isinstance(primera["fecha_reporte"], datetime)
    assert primera["fecha_reporte"].year == 2026


def test_parsear_decodifica_iso8859():
    """El archivo lleva acentos en ISO-8859-1; no debe romper la decodificación."""
    filas, _ = parsear(_muestra_bytes())
    textos = " ".join(str(f.get("problema_reporte") or "") for f in filas).upper()
    assert "NAVEGA" in textos or "NO NAVEGA" in textos


def test_filtrar_por_central():
    """La muestra trae 3 centrales: 2324X (51), 2319X (4) y 2318X (1)."""
    filas, _ = parsear(_muestra_bytes())
    de_francisco = filtrar_por_central(filas, "2324X")
    assert len(de_francisco) == 51
    assert all(f["codigo_central"] == "2324X" for f in de_francisco)
    assert len(filas) - len(de_francisco) == 5
    assert filtrar_por_central(filas, "9999X") == []


def test_archivo_vacio():
    filas, avisos = parsear(b"")
    assert filas == []
    assert avisos


def test_archivo_con_encabezado_incorrecto():
    filas, avisos = parsear("a;b;c\n1;2;3\n")
    assert filas == []
    assert avisos and "columnas" in avisos[0].lower()


def _csv_minimo(overrides: dict[str, str]) -> bytes:
    """Construye un CSV válido de 80 columnas con los campos indicados."""
    from app.services.ingesta import ESPECIFICACION

    columnas = [""] * COLUMNAS_ESPERADAS
    for campo, indices, _tipo in ESPECIFICACION:
        if campo in overrides:
            for i in indices:
                columnas[i] = overrides[campo]
    columnas[8] = "2324X"
    columnas[10] = "X-0001"
    encabezado = ";".join(f"c{i}" for i in range(COLUMNAS_ESPERADAS))
    return (encabezado + "\n" + ";".join(columnas) + "\n").encode("iso-8859-1")


def test_valores_largos_se_recortan_sin_abortar():
    """Un valor que excede la columna se recorta y se avisa (la ingesta no falla)."""
    filas, avisos = parsear(_csv_minimo({"extra": "Z" * 300, "fat": "F" * 200}))
    assert len(filas) == 1
    assert filas[0]["extra"] == "Z" * 120      # límite de caso.extra
    assert filas[0]["fat"] == "F" * 80         # límite de caso.fat
    assert any("recortados" in a for a in avisos)


def test_campos_de_texto_no_se_recortan():
    largo = "L" * 500
    filas, _ = parsear(_csv_minimo({"ultimo_comentario": largo, "direccion": largo}))
    assert filas[0]["ultimo_comentario"] == largo
    assert filas[0]["direccion"] == largo


# --------------------------------------------------------------------------- #
# D-164 · estructura de 81 columnas con `telefono_ip`
# --------------------------------------------------------------------------- #
def test_especificacion_81_suma_telefono_ip_y_desplaza():
    """La especificación 81 inserta `telefono_ip` y desplaza +1 lo demás."""
    assert len(ESPECIFICACION_81) == len(ESPECIFICACION) + 1
    assert len(set(CAMPOS_DESTINO_81)) == len(CAMPOS_DESTINO) + 1
    assert "telefono_ip" in CAMPOS_DESTINO_81
    # los campos antes de la columna 15 conservan índices y orden
    assert CAMPOS_DESTINO_81[:11] == CAMPOS_DESTINO[:11]
    # el índice de fecha_reporte pasa de 14 a 15
    indices = {campo: indices for campo, indices, _ in ESPECIFICACION_81}
    assert indices["fecha_reporte"] == (15,)
    # las tres columnas de `informacion` también se desplazan
    assert indices["informacion"] == (31, 32, 52)


def test_muestra_81_valida_y_parsea_con_telefono_ip():
    assert encabezado_valido(_muestra81_bytes())
    filas, avisos = parsear(_muestra81_bytes())
    assert len(filas) == 56, f"avisos: {avisos}"
    assert not avisos
    # las filas de la muestra sintética que llevan teléfono IP se capturan
    con_ip = [f for f in filas if f["telefono_ip"]]
    assert con_ip and all(str(f["telefono_ip"]).startswith("21297547") for f in con_ip)
    # el mapeo desplazado sigue correcto: id_averia y fecha_reporte intactos
    primera = filas[0]
    assert primera["id_averia"] == "DEMO-0001"
    assert primera["codigo_central"] == "2324X"
    assert isinstance(primera["fecha_reporte"], datetime)
    assert primera["fecha_reporte"].year == 2026
    assert primera["informacion"]


def test_muestra_80_original_sigue_parseando():
    """La estructura original de 80 columnas NO se rompe (compatible atrás)."""
    filas, avisos = parsear(_muestra_bytes())
    assert len(filas) == 56
    assert not avisos
    assert filas[0]["id_averia"] == "DEMO-0001"
    assert "telefono_ip" not in filas[0]
    assert encabezado_valido(_muestra_bytes())


def test_encabezado_81_sin_telefono_ip_es_invalido():
    """81 columnas con otro nombre en la 15.ª posición NO es una estructura válida
    (evita mapear desalineado filas de 81 celdas contra la especificación 80)."""
    texto = ";".join(f"c{i}" for i in range(81)) + "\n" + ";".join([""] * 81) + "\n"
    bytes_archivo = texto.encode("iso-8859-1")
    assert len(parsear_encabezado(texto)) == 81
    assert not encabezado_valido(bytes_archivo)
    filas, avisos = parsear(bytes_archivo)
    assert filas == []
    assert avisos and "81" in avisos[0]


def test_fila_81_desalineada_se_descarta():
    """Una fila con columnas de más en un archivo de 80 se marca malformada."""
    texto = ";".join(parsear_encabezado(_muestra_bytes().decode("iso-8859-1"))) + "\n"
    fila = [""] * 81
    fila[0] = "ALGO"          # con contenido, para que no se salte como vacía
    texto += ";".join(fila) + "\n"
    filas, avisos = parsear(texto.encode("iso-8859-1"))
    assert filas == []
    assert any("malformadas" in a for a in avisos)


def test_telefono_ip_recorta_y_no_aborta():
    """Un teléfono IP demasiado largo se recorta al límite de 30 (LIMITES)."""
    texto = ";".join(parsear_encabezado(_muestra81_bytes().decode("iso-8859-1"))) + "\n"
    fila = [""] * 81
    fila[8] = "2324X"
    fila[10] = "X-0001"
    fila[14] = "9" * 40
    texto += ";".join(fila) + "\n"
    filas, avisos = parsear(texto.encode("iso-8859-1"))
    assert len(filas) == 1
    assert filas[0]["telefono_ip"] == "9" * 30
    assert any("recortados" in a for a in avisos)
