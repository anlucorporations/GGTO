"""Pruebas unitarias del servicio de sincronización móvil (D-73).

No requieren base de datos: se simula la sesión SQLAlchemy con `unittest.mock`
para verificar la lógica pura de resolución de cuadrilla y aplicación de carga.
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from app.services.sync import _estado_por_tipo, _registrar_estado


class TestEstadoPorTipo:
    @pytest.mark.parametrize(
        ("tipo", "esperado"),
        [
            ("CONTACTO", "CONTACTADO"),
            ("CIERRE", "CERRADO"),
            ("CITA", "CITADO"),
            ("ENRUTADO", "ENRUTADO"),
            ("DIFERIDO", "DIFERIDO"),
            ("DESCONOCIDO", None),
        ],
    )
    def test_mapeo(self, tipo: str, esperado: str | None) -> None:
        assert _estado_por_tipo(tipo) == esperado


class TestRegistrarEstado:
    def test_no_registra_si_igual(self) -> None:
        from unittest.mock import MagicMock

        db = MagicMock()
        caso = MagicMock()
        caso.estado_actual = "ASIGNADO"
        _registrar_estado(db, caso, "ASIGNADO", None, "P00")
        db.add.assert_not_called()
        assert caso.estado_actual == "ASIGNADO"

    def test_registra_y_asigna(self) -> None:
        from unittest.mock import MagicMock

        db = MagicMock()
        caso = MagicMock()
        caso.id_caso = 1
        caso.estado_actual = "ASIGNADO"
        _registrar_estado(db, caso, "CERRADO", "cierre ok", "P00")
        assert db.add.call_count == 1
        hist = db.add.call_args[0][0]
        assert hist.estado_anterior == "ASIGNADO"
        assert hist.estado_nuevo == "CERRADO"
        assert caso.estado_actual == "CERRADO"


class TestSchemasSync:
    def test_sync_carga_in_valida(self) -> None:
        from app.schemas.sync import SyncCargaIn

        payload: dict = {
            "dispositivo_id": "dev-1",
            "version_app": "1.0.0",
            "actividades": [
                {
                    "id_caso": 10,
                    "tipo": "CIERRE",
                    "fecha_hora": datetime.now(UTC).isoformat(),
                    "evidencias": ["serial-1"],
                }
            ],
            "estados": [{"id_caso": 10, "estado_nuevo": "CERRADO"}],
        }
        m = SyncCargaIn(**payload)
        assert len(m.actividades) == 1
        assert m.actividades[0].tipo == "CIERRE"

    def test_actividad_maximo_5_evidencias(self) -> None:
        from pydantic import ValidationError

        from app.schemas.sync import ActividadSyncIn

        with pytest.raises(ValidationError):
            ActividadSyncIn(
                id_caso=1,
                tipo="CIERRE",
                fecha_hora=datetime.now(UTC),
                evidencias=[f"s{i}" for i in range(6)],
            )
