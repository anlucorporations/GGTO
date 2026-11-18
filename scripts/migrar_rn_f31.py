"""Migración F3-1: RN-EST-01 + RN-NC-01 (matriz de transiciones y NO CONTESTA).

Aplica los dos requisitos nuevos aprobados en la auditoría del catálogo
(`RepoTecnico/casos_uso/requisitos_nuevos.md`):

1. **RN-EST-01** — tabla `estado_transicion` (origen x destino) con semilla
   *permissiva sin regresión*: se permite todo par de estados distintos SALVO
   los que salen de un estado terminal (`CERRADO`, `CANCELADO`, `ENRUTADO`),
   que solo pueden ir a `PENDIENTE` (corte 23:00 / reapertura) o `NUEVO`
   (retorno de un derivado, D-157 vía `seguimiento`). Entre terminales nunca.
2. **RN-NC-01** — columna `caso.intentos_no_contesta` (contador acumulativo)
   y las claves de configuración `rn_est01_activo` (interruptor de la matriz)
   y `rn_nc01_n_intentos` (N de «No Contesta», 3 por defecto).

Idempotente: re-ejecutar no duplica filas ni altera columnas existentes.

USO
    python scripts/migrar_rn_f31.py                 # simula
    python scripts/migrar_rn_f31.py --aplicar --si  # aplica

Conexión: variables `DB_*` (igual que la app) o `--dsn`.
Log: `RepoTecnico/BaseOperaciones/migracion_f3_1.log`.
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
LOG = RAIZ / "RepoTecnico" / "BaseOperaciones" / "migracion_f3_1.log"

#: Estados canónicos del ciclo del caso (los que valida la CARGA en
#: `app/services/sync.py` más `PENDIENTE`/`NUEVO` del ciclo de despacho).
ESTADOS = (
    "NUEVO", "PENDIENTE", "ASIGNADO", "EN_GESTION", "CONTACTADO",
    "CITADO", "DIFERIDO", "ENRUTADO", "CERRADO", "CANCELADO",
)
#: Estados terminales: solo salen hacia PENDIENTE/NUEVO (nunca a otro terminal).
TERMINALES = ("CERRADO", "CANCELADO", "ENRUTADO")
#: Únicos destinos válidos desde un estado terminal.
SALIDA_TERMINAL = ("PENDIENTE", "NUEVO")

DDLA = """
CREATE TABLE IF NOT EXISTS estado_transicion (
    id_transicion  serial PRIMARY KEY,
    estado_origen  varchar(20) NOT NULL,
    estado_destino varchar(20) NOT NULL,
    activo         boolean NOT NULL DEFAULT true,
    creado_en      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT estado_transicion_origen_destino_key UNIQUE (estado_origen, estado_destino)
);
CREATE INDEX IF NOT EXISTS ix_estado_transicion_origen ON estado_transicion(estado_origen);
ALTER TABLE caso ADD COLUMN IF NOT EXISTS intentos_no_contesta smallint NOT NULL DEFAULT 0;
"""

SEMILLA_CONFIG = """
INSERT INTO configuracion (clave, valor, descripcion) VALUES
    ('rn_est01_activo', 'true'::jsonb,
     'RN-EST-01: valida el cambio de estado contra la matriz estado_transicion'),
    ('rn_nc01_n_intentos', '3'::jsonb,
     'RN-NC-01: N intentos de «No Contesta» antes de devolver el caso a la cola'),
    ('rn_ev01_activo', 'false'::jsonb,
     'RN-EV-01: exige evidencias mínimas (2 POTENCIA al cierre, 3 DEMO al '
     'diferido, 1 al enrutado) — se activa al desplegar el build F3-1 de la APK')
ON CONFLICT (clave) DO NOTHING;
"""


def filas_matriz() -> list[tuple[str, str]]:
    """Pares (origen, destino) permitidos según las reglas del F3-1."""
    pares: list[tuple[str, str]] = []
    for origen in ESTADOS:
        for destino in ESTADOS:
            if origen == destino:
                continue  # sin auto-transiciones (el servidor ya las ignora)
            if origen in TERMINALES:
                if destino not in SALIDA_TERMINAL:
                    continue
            pares.append((origen, destino))
    return pares


def semilla_matriz() -> str:
    """INSERT idempotente de la semilla (ON CONFLICT DO NOTHING)."""
    valores = ",\n".join(
        f"    ('{origen}', '{destino}')" for origen, destino in filas_matriz()
    )
    return (
        "INSERT INTO estado_transicion (estado_origen, estado_destino) VALUES\n"
        + valores
        + "\nON CONFLICT (estado_origen, estado_destino) DO NOTHING;"
    )


VERIFICACION = """
SELECT
    (SELECT count(*) FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'estado_transicion') AS tabla_ok,
    (SELECT count(*) FROM estado_transicion) AS transiciones,
    (SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'caso'
        AND column_name = 'intentos_no_contesta') AS columna_nc,
    (SELECT count(*) FROM configuracion
      WHERE clave IN ('rn_est01_activo', 'rn_nc01_n_intentos')) AS claves
"""


def registrar(mensaje: str) -> None:
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with LOG.open("a", encoding="utf-8") as fh:
        fh.write(f"[{datetime.now(UTC).isoformat(timespec='seconds')}] {mensaje}\n")
    try:
        print(mensaje)
    except UnicodeEncodeError:
        print(mensaje.encode("ascii", "replace").decode("ascii"))


def conectar(args: argparse.Namespace):
    import psycopg2

    if args.dsn:
        return psycopg2.connect(args.dsn, connect_timeout=20)
    faltan = [v for v in ("DB_NAME", "DB_USER", "DB_PASSWORD") if not os.environ.get(v)]
    if faltan:
        registrar(f"ERROR: faltan variables de entorno: {', '.join(faltan)} (o usa --dsn)")
        sys.exit(2)
    return psycopg2.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        port=int(os.environ.get("DB_PORT", "5432")),
        dbname=os.environ["DB_NAME"],
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        sslmode=os.environ.get("DB_SSLMODE", "prefer"),
        connect_timeout=20,
    )


def estado_actual(conn) -> dict:
    with conn.cursor() as cur:
        cur.execute(VERIFICACION)
        cols = [d[0] for d in cur.description]
        return dict(zip(cols, cur.fetchone(), strict=True))


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--aplicar", action="store_true", help="Aplica el cambio (requiere --si)")
    p.add_argument("--si", action="store_true", help="Confirmación explícita")
    p.add_argument("--dsn", help="DSN completo de conexión")
    args = p.parse_args()

    matriz = semilla_matriz()
    registrar("=== migración F3-1: RN-EST-01 + RN-NC-01 ===")
    conn = conectar(args)
    estado = estado_actual(conn)
    esperadas = len(filas_matriz())
    if estado["tabla_ok"] and estado["columna_nc"] and estado["claves"] >= 3:
        if int(estado["transiciones"]) >= esperadas:
            registrar(
                "Ya aplicada "
                f"({int(estado['transiciones'])}/{esperadas} transiciones, "
                f"{int(estado['claves'])}/3 claves): nada por hacer."
            )
            conn.close()
            return 0
    registrar(f"Estado actual: {estado}")
    registrar(f"Semilla: {esperadas} transiciones permitidas de {len(ESTADOS) ** 2} pares posibles.")
    registrar("CAMBIO a aplicar:\n" + DDLA + "\n" + matriz + "\n" + SEMILLA_CONFIG)
    if not (args.aplicar and args.si):
        registrar("SIMULACIÓN — no se aplicó nada. Ejecuta con --aplicar --si para confirmar.")
        conn.close()
        return 0
    with conn.cursor() as cur:
        cur.execute(DDLA)
        cur.execute(matriz)
        cur.execute(SEMILLA_CONFIG)
    conn.commit()
    despues = estado_actual(conn)
    registrar(f"Aplicado. Verificación: {despues}")
    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
