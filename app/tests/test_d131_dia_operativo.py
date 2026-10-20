"""D-131 · La lógica de negocio usa el día operativo, no la fecha del servidor (H-14).

Defecto (auditoría V3): la lógica de despachos, jornada, panel, mensajes y la
ventana de reasignación usaba `date.today()` —la fecha del **servidor**, en UTC—.
Entre las 20:00 y las 24:00 de Caracas el servidor ya está en «mañana», así que el
despacho «de hoy», la jornada y la ventana podían apuntar al día equivocado.

Estas pruebas: (1) fijan que ningún módulo de negocio vuelva a usar la fecha del
servidor y (2) comprueban que los endpoints sin `fecha` usan `hoy_operativo()`.
"""

from __future__ import annotations

import pathlib
from datetime import date

from app.api import routes_despachos
from app.services.tiempo import ahora_operativo, hoy_operativo

RAIZ = pathlib.Path(__file__).resolve().parents[1]
PRODUCCION = [*(RAIZ / "services").glob("*.py"), *(RAIZ / "api").glob("*.py")]

DESPACHOS = "/api/v1/despachos"


def test_ningun_modulo_de_negocio_usa_la_fecha_del_servidor():
    culpables = [
        f.relative_to(RAIZ).as_posix()
        for f in PRODUCCION
        if "date.today()" in f.read_text(encoding="utf-8")
    ]
    assert culpables == [], f"usan date.today() en lugar de hoy_operativo(): {culpables}"


def test_hoy_operativo_es_el_dia_de_caracas():
    assert hoy_operativo() == ahora_operativo().date()


def test_la_propuesta_sin_fecha_usa_el_dia_operativo(client, admin_token, monkeypatch):
    """El endpoint sin `fecha` se guía por `hoy_operativo()` (no por UTC)."""
    fijo = date(2026, 12, 31)
    monkeypatch.setattr(routes_despachos, "hoy_operativo", lambda: fijo)

    r = client.post(f"{DESPACHOS}/propuesta", headers=admin_token["admin"])
    assert r.status_code == 200, r.text
    assert r.json()["fecha"] == fijo.isoformat()


def test_el_dia_operativo_puede_diferir_del_servidor():
    """Documenta el caso que motivó el cambio: 20:00-24:00 de Caracas = mañana en UTC.

    No depende del reloj: compara la conversión de un instante conocido.
    """
    from datetime import UTC, datetime

    from app.services.tiempo import dia_operativo

    instante = datetime(2026, 10, 21, 1, 30, tzinfo=UTC)  # 21:30 del día 20 en Caracas
    assert dia_operativo(instante) == date(2026, 10, 20)
    assert instante.date() == date(2026, 10, 21), "la fecha del servidor ya era el día siguiente"
