"""Regresión: la cola offline de la APK puede traer el cierre sin `modo`.

Sin la normalización, `/sync/carga` rechazaba la actividad con
«El modo de cierre  no está en el catálogo» y el caso nunca se actualizaba.
"""

from app.services.sync import modo_cierre_de_carga


def test_modo_ausente_usa_ivr():
    assert modo_cierre_de_carga({}) == "IVR"
    assert modo_cierre_de_carga({"modo": None}) == "IVR"
    assert modo_cierre_de_carga({"modo": "   "}) == "IVR"


def test_modo_explicito_se_normaliza():
    assert modo_cierre_de_carga({"modo": " cos "}) == "COS"
    assert modo_cierre_de_carga({"modo": "sacas"}) == "SACAS"
