#!/usr/bin/env python3
"""Limpieza definitiva de los datos de la PRUEBA DE CAMPO (D-112).

Borra de la base de datos todo lo que sembró
[`sembrar_campo_test.py`](pruebas/sembrar_campo_test.py) y lo que generaron las
corridas de la APK, **sin tocar ningún dato real**:

- los **30 casos** `TEST-CAMPO-*`, `TEST-MASIVA-*` y `TEST-ESP-*` con sus
  actividades, evidencias, citas, historial de estados y seguimiento;
- la **falla masiva** de la concentración `OLT-TEST-MASIVA` y sus asociaciones;
- los **despachos** de las cuatro cuadrillas de prueba y su reparto de sectores;
- los **mensajes** emitidos a esas cuadrillas;
- las **sincronizaciones** (`sync_log`) de los técnicos de prueba;
- los **3 técnicos** `990001…990003` con sus **usuarios** y dispositivos de
  seguridad, y las **4 cuadrillas** `C-990/C-992/C-994/C-996`;
- los **4 sectores** `TEST-*` con sus patrones de dirección y los
  **identificadores de pago** de los teléfonos de prueba.

Todo se ejecuta en **una transacción**: si algo falla, no se borra nada.
Primero simula (por defecto) y muestra cuántas filas tocaría; para borrar hay que
pasar `--aplicar --si`.

USO
    # 1) Simulación (no borra nada)
    python scripts/limpiar_datos_test.py --dsn "postgresql://usuario:clave@host:puerto/ggtov2"

    # 2) Borrado real
    python scripts/limpiar_datos_test.py --dsn "…" --aplicar --si

    # El DSN también se puede pasar en GGTO_TEST_DSN / DATABASE_URL.

SALIDA
    Informe por consola y en `RepoTecnico/BaseOperaciones/limpieza_datos_test.log`.
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import create_engine, text

RAIZ = Path(__file__).resolve().parents[1]
LOG = RAIZ / "RepoTecnico" / "BaseOperaciones" / "limpieza_datos_test.log"

#: Prefijos de los casos de la prueba.
PREFIJOS_CASO = ("TEST-CAMPO-", "TEST-MASIVA-", "TEST-ESP-")
#: Códigos de los catálogos de prueba.
CODIGOS_CUADRILLA = ("C-990", "C-992", "C-994", "C-996")
CODIGOS_SECTOR = ("TESTN", "TESTE", "TESTO", "TESTS")
P00S = ("990001", "990002", "990003")
#: Números de teléfono (identificador de pago) de los casos sembrados.
TELEFONOS = [str(7000001000 + n) for n in range(1, 11)]
TELEFONOS += [str(7000001100 + n) for n in range(1, 11)]
TELEFONOS += [str(7000001200 + n) for n in range(1, 11)]

#: SQL que identifica los casos de la prueba (se reutiliza en todas las consultas).
CASOS_TEST = "SELECT id_caso FROM caso WHERE id_averia LIKE 'TEST-%'"

#: (descripción, SQL) en el orden en que hay que borrar (respeta las claves foráneas).
BORRADOS: tuple[tuple[str, str], ...] = (
    (
        "órdenes de material de la masiva y de los casos TEST",
        "DELETE FROM orden_material WHERE id_falla IN (SELECT id_falla FROM falla_masiva "
        "WHERE clave_concentracion LIKE '%OLT-TEST-MASIVA%' OR descripcion LIKE 'TEST %') "
        "OR id_caso IN (" + CASOS_TEST + ") "
        "OR id_cuadrilla IN (SELECT id_cuadrilla FROM cuadrilla WHERE codigo IN ('C-990','C-992','C-994','C-996'))",
    ),
    (
        "asociaciones caso ↔ masiva",
        "DELETE FROM falla_masiva_caso WHERE id_caso IN (" + CASOS_TEST + ") "
        "OR id_falla IN (SELECT id_falla FROM falla_masiva "
        "WHERE clave_concentracion LIKE '%OLT-TEST-MASIVA%' OR descripcion LIKE 'TEST %')",
    ),
    (
        "falla masiva de la concentración de prueba",
        "DELETE FROM falla_masiva WHERE clave_concentracion LIKE '%OLT-TEST-MASIVA%' "
        "OR descripcion LIKE 'TEST %' OR id_sector IN "
        "(SELECT id_sector FROM sector WHERE codigo IN ('TESTN','TESTE','TESTO','TESTS'))",
    ),
    (
        "casos de los despachos de prueba",
        "DELETE FROM despacho_caso WHERE id_caso IN (" + CASOS_TEST + ") "
        "OR id_despacho IN (SELECT id_despacho FROM despacho WHERE id_cuadrilla IN "
        "(SELECT id_cuadrilla FROM cuadrilla WHERE codigo IN ('C-990','C-992','C-994','C-996')))",
    ),
    (
        "despachos de las cuadrillas de prueba",
        "DELETE FROM despacho WHERE id_cuadrilla IN "
        "(SELECT id_cuadrilla FROM cuadrilla WHERE codigo IN ('C-990','C-992','C-994','C-996'))",
    ),
    (
        "asignación diaria de sectores de las cuadrillas de prueba",
        "DELETE FROM cuadrilla_sector_dia WHERE id_cuadrilla IN "
        "(SELECT id_cuadrilla FROM cuadrilla WHERE codigo IN ('C-990','C-992','C-994','C-996')) "
        "OR id_sector IN (SELECT id_sector FROM sector WHERE codigo IN ('TESTN','TESTE','TESTO','TESTS'))",
    ),
    ("citas de los casos TEST", "DELETE FROM cita WHERE id_caso IN (" + CASOS_TEST + ")"),
    ("seguimiento de los casos TEST", "DELETE FROM seguimiento WHERE id_caso IN (" + CASOS_TEST + ")"),
    (
        "historial de estados de los casos TEST",
        "DELETE FROM caso_estado_hist WHERE id_caso IN (" + CASOS_TEST + ")",
    ),
    (
        "actividades de los casos TEST (arrastra sus evidencias)",
        "DELETE FROM actividad WHERE id_caso IN (" + CASOS_TEST + ")",
    ),
    (
        "casos especiales de prueba",
        "DELETE FROM caso_especial WHERE id_caso IN (" + CASOS_TEST + ")",
    ),
    (
        "los 30 casos TEST",
        "DELETE FROM caso WHERE id_averia LIKE 'TEST-%'",
    ),
    (
        "identificadores de pago de los teléfonos de prueba",
        "DELETE FROM identificador_pago WHERE numero IN :telefonos "
        "AND NOT EXISTS (SELECT 1 FROM caso c WHERE c.id_pago = identificador_pago.id_pago)",
    ),
    (
        "mensajes emitidos a las cuadrillas de prueba",
        "DELETE FROM mensaje WHERE id_cuadrilla IN "
        "(SELECT id_cuadrilla FROM cuadrilla WHERE codigo IN ('C-990','C-992','C-994','C-996')) "
        "OR id_caso IN (" + CASOS_TEST + ")",
    ),
    (
        "mensajes dirigidos a los técnicos de prueba",
        # El CHECK `ck_mensaje_destino_xor` exige un solo destinatario: al borrar
        # el técnico, `ON DELETE SET NULL` dejaría un mensaje TECNICO sin dueño y
        # la transacción fallaría. Estos mensajes son de la prueba, así que se
        # borran antes.
        "DELETE FROM mensaje WHERE id_tecnico IN "
        "(SELECT id_tecnico FROM tecnico WHERE p00 IN ('990001','990002','990003')) "
        "OR origen_p00 IN ('990001','990002','990003') "
        "OR id_usuario_destino IN ('990001','990002','990003')",
    ),
    (
        "sincronizaciones y cargas de los técnicos de prueba",
        "DELETE FROM sync_log WHERE p00 IN ('990001','990002','990003') "
        "OR id_cuadrilla IN (SELECT id_cuadrilla FROM cuadrilla "
        "WHERE codigo IN ('C-990','C-992','C-994','C-996'))",
    ),
    (
        "sincronizaciones de la web de los técnicos de prueba",
        "DELETE FROM sincronizacion WHERE id_tecnico IN "
        "(SELECT id_tecnico FROM tecnico WHERE p00 IN ('990001','990002','990003'))",
    ),
    (
        "movimientos de inventario de los técnicos de prueba",
        "DELETE FROM inventario_movimiento WHERE id_tecnico IN "
        "(SELECT id_tecnico FROM tecnico WHERE p00 IN ('990001','990002','990003'))",
    ),
    (
        "usuarios de los técnicos de prueba",
        "DELETE FROM usuario WHERE p00 IN ('990001','990002','990003')",
    ),
    (
        "fichas de los técnicos de prueba",
        "DELETE FROM tecnico WHERE p00 IN ('990001','990002','990003')",
    ),
    (
        "cuadrillas de prueba",
        "DELETE FROM cuadrilla WHERE codigo IN ('C-990','C-992','C-994','C-996')",
    ),
    (
        "sectores de prueba (arrastra sus patrones de dirección)",
        "DELETE FROM sector WHERE codigo IN ('TESTN','TESTE','TESTO','TESTS')",
    ),
    (
        "solicitante de prueba de los casos especiales",
        "DELETE FROM solicitante WHERE nombre = 'SOLICITANTE TEST CAMPO' "
        "AND NOT EXISTS (SELECT 1 FROM caso_especial ce WHERE ce.id_solicitante = solicitante.id_solicitante)",
    ),
)

def controles(ids_cuadrilla: list[int], ids_tecnico: list[int]) -> tuple[tuple[str, str], ...]:
    """Consultas de control (antes y después) con los ids capturados al inicio."""
    cuadrillas = ", ".join(str(i) for i in ids_cuadrilla) or "NULL"
    tecnicos = ", ".join(str(i) for i in ids_tecnico) or "NULL"
    return (
        ("casos TEST", "SELECT count(*) FROM caso WHERE id_averia LIKE 'TEST-%'"),
        (
            "actividades TEST",
            "SELECT count(*) FROM actividad a JOIN caso c ON c.id_caso = a.id_caso "
            "WHERE c.id_averia LIKE 'TEST-%'",
        ),
        (
            "evidencias TEST",
            "SELECT count(*) FROM evidencia e JOIN actividad a ON a.id_actividad = e.id_actividad "
            "JOIN caso c ON c.id_caso = a.id_caso WHERE c.id_averia LIKE 'TEST-%'",
        ),
        (
            "citas TEST",
            "SELECT count(*) FROM cita ci JOIN caso c ON c.id_caso = ci.id_caso "
            "WHERE c.id_averia LIKE 'TEST-%'",
        ),
        (
            "casos especiales TEST",
            "SELECT count(*) FROM caso_especial WHERE id_caso IN "
            "(SELECT id_caso FROM caso WHERE id_averia LIKE 'TEST-%')",
        ),
        (
            "fallas masivas TEST",
            "SELECT count(*) FROM falla_masiva WHERE descripcion LIKE 'TEST %' "
            "OR clave_concentracion LIKE '%OLT-TEST-MASIVA%'",
        ),
        (f"despachos de cuadrillas TEST", f"SELECT count(*) FROM despacho WHERE id_cuadrilla IN ({cuadrillas})"),
        (
            "cuadrillas TEST",
            "SELECT count(*) FROM cuadrilla WHERE codigo IN ('C-990','C-992','C-994','C-996')",
        ),
        ("sectores TEST", "SELECT count(*) FROM sector WHERE codigo IN ('TESTN','TESTE','TESTO','TESTS')"),
        ("técnicos TEST", "SELECT count(*) FROM tecnico WHERE p00 IN ('990001','990002','990003')"),
        ("usuarios TEST", "SELECT count(*) FROM usuario WHERE p00 IN ('990001','990002','990003')"),
        ("sync_log TEST", "SELECT count(*) FROM sync_log WHERE p00 IN ('990001','990002','990003')"),
        (f"mensajes a cuadrillas TEST", f"SELECT count(*) FROM mensaje WHERE id_cuadrilla IN ({cuadrillas})"),
        (f"sincronizaciones de técnicos TEST", f"SELECT count(*) FROM sincronizacion WHERE id_tecnico IN ({tecnicos})"),
    )

#: Total de casos reales (para comprobar que la limpieza no toca nada más).
CONTROL_TOTAL_CASOS = "SELECT count(*) FROM caso"


class Informe:
    """Escribe el informe por consola y en el archivo de bitácora."""

    def __init__(self) -> None:
        self.lineas: list[str] = []

    def __call__(self, mensaje: str = "") -> None:
        print(mensaje)
        self.lineas.append(mensaje)

    def guardar(self) -> None:
        LOG.parent.mkdir(parents=True, exist_ok=True)
        LOG.write_text("\n".join(self.lineas) + "\n", encoding="utf-8")


def ejecutar(engine, sql: str, **parametros) -> int:
    """Ejecuta una sentencia y devuelve las filas afectadas."""
    with engine.begin() as conexion:
        resultado = conexion.execute(text(sql), parametros)
        return resultado.rowcount if resultado.rowcount is not None else 0


def contar(engine, sql: str, **parametros) -> int:
    with engine.connect() as conexion:
        return int(conexion.execute(text(sql), parametros).scalar_one())


def main() -> int:
    parser = argparse.ArgumentParser(description="Limpieza de los datos de la prueba de campo (D-112)")
    parser.add_argument("--dsn", default=os.environ.get("GGTO_TEST_DSN") or os.environ.get("DATABASE_URL"))
    parser.add_argument("--aplicar", action="store_true", help="Borra de verdad (sin esto solo simula)")
    parser.add_argument("--si", action="store_true", help="Confirmación obligatoria junto a --aplicar")
    args = parser.parse_args()

    if not args.dsn:
        parser.error("indique --dsn (o GGTO_TEST_DSN / DATABASE_URL)")
    aplicar = bool(args.aplicar and args.si)
    if args.aplicar and not args.si:
        parser.error("--aplicar exige --si como confirmación")

    informe = Informe()
    # SQLAlchemy 2.x prefiere `psycopg` (v3) para `postgresql://`; en este
    # entorno el driver instalado es `psycopg2`, así que se fija explícitamente.
    dsn = args.dsn
    if dsn.startswith("postgresql://"):
        dsn = dsn.replace("postgresql://", "postgresql+psycopg2://", 1)
    motor = create_engine(dsn, pool_pre_ping=True)
    destino = args.dsn.split("@")[-1]
    informe("=" * 78)
    informe("LIMPIEZA DE LOS DATOS DE LA PRUEBA DE CAMPO (D-112)")
    informe(f"Base de datos : {destino}")
    informe(f"Modo          : {'APLICAR (borra)' if aplicar else 'SIMULACIÓN (no borra)'}")
    informe(f"Fecha         : {datetime.now(UTC).isoformat(timespec='seconds')}")
    informe("=" * 78)

    informe("\n== Antes ==")
    ids_cuadrilla = [
        int(fila[0])
        for fila in motor.connect().execute(
            text("SELECT id_cuadrilla FROM cuadrilla WHERE codigo IN ('C-990','C-992','C-994','C-996')")
        )
    ]
    ids_tecnico = [
        int(fila[0])
        for fila in motor.connect().execute(
            text("SELECT id_tecnico FROM tecnico WHERE p00 IN ('990001','990002','990003')")
        )
    ]
    controles_antes = controles(ids_cuadrilla, ids_tecnico)
    antes = {nombre: contar(motor, sql) for nombre, sql in controles_antes}
    total_antes = contar(motor, CONTROL_TOTAL_CASOS)
    for nombre, valor in antes.items():
        informe(f"  {nombre:<32} {valor}")
    informe(f"  {'casos en total (real + TEST)':<32} {total_antes}")

    if aplicar:
        informe("\n== Borrado (una transacción) ==")
        with motor.begin() as conexion:
            for descripcion, sql in BORRADOS:
                resultado = conexion.execute(
                    text(sql),
                    {
                        "telefonos": tuple(TELEFONOS),
                    },
                )
                filas = resultado.rowcount if resultado.rowcount is not None else 0
                informe(f"  {descripcion:<58} {filas:>4} fila(s)")
    else:
        informe("\n== Simulación: se ejecuta el borrado y se DESHACE (rollback) ==")
        with motor.connect() as conexion:
            transaccion = conexion.begin()
            try:
                for descripcion, sql in BORRADOS:
                    resultado = conexion.execute(text(sql), {"telefonos": tuple(TELEFONOS)})
                    filas = resultado.rowcount if resultado.rowcount is not None else 0
                    informe(f"  {descripcion:<58} {filas:>4} fila(s)")
            except Exception as error:  # noqa: BLE001 - informa y deshace
                informe(f"  ERROR en la simulación: {error}")
            finally:
                transaccion.rollback()

    informe("\n== Después ==")
    despues = {nombre: contar(motor, sql) for nombre, sql in controles_antes}
    total_despues = contar(motor, CONTROL_TOTAL_CASOS)
    for nombre, valor in despues.items():
        estado = "OK" if valor == 0 else "QUEDAN"
        informe(f"  {nombre:<32} {valor:>4}  {estado}")
    informe(f"  {'casos en total (real + TEST)':<32} {total_despues}")
    informe(f"  {'casos reales conservados':<32} {total_despues}")

    pendientes = [nombre for nombre, valor in despues.items() if valor != 0]
    informe("")
    if pendientes:
        informe(f"AVISO: quedan filas en {', '.join(pendientes)}")
    elif aplicar:
        informe("Limpieza completada: no queda ningún dato de la prueba.")
    else:
        informe("Simulación lista: vuelva a ejecutar con --aplicar --si para borrar.")
    informe.guardar()
    informe(f"\nInforme: {LOG}")
    return 0 if not pendientes or not aplicar else 1


if __name__ == "__main__":
    sys.exit(main())
