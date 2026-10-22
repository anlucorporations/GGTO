"""H-06: escapado de los documentos imprimibles que genera el servidor."""

from __future__ import annotations

from app.core.html import CABECERAS_IMPRIMIBLE, escapar


def test_escapar_neutraliza_marcado_y_comillas():
    crudo = "<script>alert(\"x\")</script> & 'foto'"
    limpio = escapar(crudo)
    assert "<script>" not in limpio
    assert "&lt;script&gt;" in limpio
    assert "&quot;" in limpio
    assert "&#x27;" in limpio
    assert "&amp;" in limpio


def test_escapar_usa_el_defecto_para_vacios():
    assert escapar(None) == "—"
    assert escapar("") == "—"
    assert escapar(None, "") == ""


def test_escapar_convierte_los_numeros():
    assert escapar(0, "") == "0"
    assert escapar(42) == "42"


def test_las_cabeceras_bloquean_scripts():
    csp = CABECERAS_IMPRIMIBLE["Content-Security-Policy"]
    assert "default-src 'none'" in csp
    assert "script-src" not in csp  # los scripts caen en default-src 'none'
    assert CABECERAS_IMPRIMIBLE["X-Content-Type-Options"] == "nosniff"
