#!/usr/bin/env python3
"""Migración **D-89** — identificador de pago (70\\*) como eje del sistema.

=============================================================================
QUÉ HACE (aditivo y reversible)
    1. Crea la tabla `identificador_pago` (ficha **única global** por número, con
       RLS por central de origen / centrales con casos enlazados).
    2. Añade `caso.id_pago` (FK, `ON DELETE RESTRICT`) y sus índices.
    3. Amplía el CHECK de `tipo_caso` con **`REFERIDO`** e instala el **trigger**
       que reclasifica a REFERIDO toda REPARACIÓN sin 70\\* o sin avería real
       (`DEC-IP-3`: los históricos se marcan y se corrigen en su próximo cambio).
    4. Añade los contadores y `avisos` del lote de ingesta (RF-56).
    5. Instala el `CHECK ck_reparacion_con_ip` **NOT VALID** (red de seguridad).
    6. Inserta los parámetros `pago.serie_regex`, `pago.reincidencia_dias` y
       `referido.reclasificar_en_proximo_cambio`.
    7. **Backfill**: crea un identificador por cada número normalizado que cumpla
       el patrón y enlaza los casos (`caso.id_pago`), dejando `telefono` como alias.
    8. **Contactos** (opcional, activo por defecto): suma `[CONTACTO] <número>` a
       `informacion` de forma idempotente, con respaldo previo en `caso_d89_backup`.

SEGURIDAD
    · Por defecto es **simulación**: informa lo que haría y verifica, sin escribir.
    · Para aplicar: `--aplicar` (y `--si` para no pedir confirmación).
    · Escritura **aditiva e idempotente** (`IF NOT EXISTS`, `ON CONFLICT`).
    · Prohibido `DELETE` sin filtro (D-55); el respaldo permite revertir el backfill.

USO
    python3 scripts/migrar_d89_identificador_pago.py                    # simulación
    python3 scripts/migrar_d89_identificador_pago.py --aplicar --si      # aplica
    python3 scripts/migrar_d89_identificador_pago.py --aplicar --si --sin-contactos
    python3 scripts/migrar_d89_identificador_pago.py --dsn "postgresql://usuario:clave@host/base"

REGISTRO
    Cada ejecución queda anotada en RepoTecnico/BaseOperaciones/migracion_d89.log
=============================================================================
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
if str(RAIZ) not in sys.path:  # el normalizador es el de la aplicación
    sys.path.insert(0, str(RAIZ))

from app.services.pagos import PATRON_POR_DEFECTO, normalizar_numero  # noqa: E402

LOG = RAIZ / "RepoTecnico" / "BaseOperaciones" / "migracion_d89.log"

# --------------------------------------------------------------------------- #
# DDL (idempotente)
# --------------------------------------------------------------------------- #
DDL: tuple[tuple[str, str], ...] = (
    (
        "tabla identificador_pago",
        """
        CREATE TABLE IF NOT EXISTS identificador_pago (
            id_pago             bigserial    PRIMARY KEY,
            numero              varchar(15)  NOT NULL,
            id_central          integer      NOT NULL REFERENCES central(id_central),
            nombre_titular      varchar(160),
            direccion_principal text,
            estado              varchar(12)  NOT NULL DEFAULT 'ACTIVO'
                                CHECK (estado IN ('ACTIVO','SUSPENDIDO','BAJA')),
            creado_en           timestamptz  NOT NULL DEFAULT now(),
            actualizado_en      timestamptz  NOT NULL DEFAULT now(),
            CONSTRAINT uq_ip_numero UNIQUE (numero),
            CONSTRAINT ck_ip_serie  CHECK (numero ~ '^[0-9]{7,15}$')
        );
        """,
    ),
    (
        "columna caso.id_pago",
        """
        ALTER TABLE caso ADD COLUMN IF NOT EXISTS id_pago bigint;
        """,
    ),
    (
        "FK caso.id_pago → identificador_pago",
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_caso_id_pago') THEN
                ALTER TABLE caso ADD CONSTRAINT fk_caso_id_pago
                    FOREIGN KEY (id_pago) REFERENCES identificador_pago(id_pago)
                    ON DELETE RESTRICT;
            END IF;
        END;
        $$;
        """,
    ),
    (
        "índices de caso.id_pago",
        """
        CREATE INDEX IF NOT EXISTS ix_caso_id_pago       ON caso (id_pago);
        CREATE INDEX IF NOT EXISTS ix_caso_id_pago_fecha ON caso (id_pago, fecha_reporte);
        """,
    ),
    (
        "tipo_caso admite REFERIDO",
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'caso_tipo_caso_check') THEN
                ALTER TABLE caso DROP CONSTRAINT caso_tipo_caso_check;
            END IF;
            ALTER TABLE caso ADD CONSTRAINT caso_tipo_caso_check
                CHECK (tipo_caso IN ('AVERIA','REPARACION','CONSTRUCCION','REFERIDO'));
        END;
        $$;
        """,
    ),
    (
        "contadores y avisos del lote de ingesta",
        """
        ALTER TABLE ingesta_lote ADD COLUMN IF NOT EXISTS filas_sin_identificador_pago
            integer NOT NULL DEFAULT 0;
        ALTER TABLE ingesta_lote ADD COLUMN IF NOT EXISTS filas_con_contacto
            integer NOT NULL DEFAULT 0;
        ALTER TABLE ingesta_lote ADD COLUMN IF NOT EXISTS avisos
            jsonb NOT NULL DEFAULT '[]'::jsonb;
        """,
    ),
    (
        "trigger de reclasificación REPARACIÓN → REFERIDO",
        """
        CREATE OR REPLACE FUNCTION fn_caso_reparacion_a_referido()
        RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
            IF NEW.tipo_caso = 'REPARACION'
               AND (NEW.id_pago IS NULL OR NEW.id_averia LIKE 'REF-%') THEN
                NEW.tipo_caso := 'REFERIDO';
                IF NEW.categoria IN ('RESIDENCIAL', 'REFERIDO') THEN
                    NEW.categoria := 'REFERIDO';
                END IF;
            END IF;
            RETURN NEW;
        END;
        $$;

        DROP TRIGGER IF EXISTS trg_caso_reparacion_a_referido ON caso;
        CREATE TRIGGER trg_caso_reparacion_a_referido
            BEFORE INSERT OR UPDATE ON caso
            FOR EACH ROW EXECUTE FUNCTION fn_caso_reparacion_a_referido();
        """,
    ),
    (
        "CHECK ck_reparacion_con_ip (NOT VALID)",
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_reparacion_con_ip') THEN
                ALTER TABLE caso ADD CONSTRAINT ck_reparacion_con_ip
                    CHECK (tipo_caso <> 'REPARACION'
                           OR (id_pago IS NOT NULL AND id_averia NOT LIKE 'REF-%'))
                    NOT VALID;
            END IF;
        END;
        $$;
        """,
    ),
    (
        "RLS de identificador_pago",
        """
        ALTER TABLE identificador_pago ENABLE ROW LEVEL SECURITY;
        ALTER TABLE identificador_pago FORCE  ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS p_ip_central ON identificador_pago;
        CREATE POLICY p_ip_central ON identificador_pago
            USING      (app_central_actual() IS NULL
                        OR id_central = app_central_actual()
                        OR EXISTS (SELECT 1 FROM caso c
                                    WHERE c.id_pago = identificador_pago.id_pago
                                      AND c.id_central = app_central_actual()))
            WITH CHECK (app_central_actual() IS NULL OR id_central = app_central_actual());
        """,
    ),
    (
        "trigger actualizado_en de identificador_pago",
        """
        DROP TRIGGER IF EXISTS trg_identificador_pago_actualizado ON identificador_pago;
        CREATE TRIGGER trg_identificador_pago_actualizado
            BEFORE UPDATE ON identificador_pago
            FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();
        """,
    ),
    (
        "parámetros del identificador de pago",
        """
        INSERT INTO configuracion (clave, valor, descripcion) VALUES
          ('pago.serie_regex', to_jsonb('^70[0-9]{8}$'::text),
           'Patrón del identificador de pago (DEC-IP-1)'),
          ('pago.reincidencia_dias', to_jsonb(90),
           'Ventana en días para marcar reincidencia (RF-54)'),
          ('referido.reclasificar_en_proximo_cambio', to_jsonb(true),
           'Marcar REPARACIONES sin IP/avería y reclasificarlas al siguiente cambio (DEC-IP-3)')
        ON CONFLICT (clave) DO NOTHING;
        """,
    ),
    (
        "respaldo para revertir el backfill",
        """
        CREATE TABLE IF NOT EXISTS caso_d89_backup (
            id_caso          bigint PRIMARY KEY,
            telefono         varchar(30),
            contacto_cliente varchar(60),
            informacion      text,
            respaldado_en    timestamptz NOT NULL DEFAULT now()
        );
        """,
    ),
)

# --------------------------------------------------------------------------- #
# Consultas de apoyo
# --------------------------------------------------------------------------- #
CASOS_A_ENLAZAR = """
SELECT id_caso, id_central, telefono, nombre_cliente, direccion
  FROM caso
 WHERE id_pago IS NULL AND telefono IS NOT NULL AND btrim(telefono) <> ''
 ORDER BY id_caso
"""

UPSERT_IDENTIFICADOR = """
INSERT INTO identificador_pago (numero, id_central, nombre_titular, direccion_principal)
VALUES (%s, %s, %s, %s)
ON CONFLICT (numero) DO NOTHING
"""

SELECCIONAR_IDENTIFICADOR = "SELECT id_pago FROM identificador_pago WHERE numero = %s"

CASOS_CON_CONTACTO = """
SELECT id_caso, contacto_cliente, informacion
  FROM caso
 WHERE contacto_cliente IS NOT NULL AND btrim(contacto_cliente) <> ''
 ORDER BY id_caso
"""

CASOS_CON_ALIAS_INVALIDO = """
SELECT id_caso, telefono, contacto_cliente, informacion
  FROM caso
 WHERE id_pago IS NULL
   AND telefono IS NOT NULL AND btrim(telefono) <> ''
 ORDER BY id_caso
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


def patron_vigente(cur) -> str:
    cur.execute("SELECT valor FROM configuracion WHERE clave = 'pago.serie_regex'")
    fila = cur.fetchone()
    if not fila or fila[0] is None:
        return PATRON_POR_DEFECTO
    valor = fila[0]
    return str(valor).strip('"') if not isinstance(valor, str) else valor.strip('"')


def inventario(cur, patron: str) -> dict[str, object]:
    """Inventario previo (paso 1) y conciliación pre-migración (H-20)."""
    import re

    cur.execute(
        """
        SELECT count(*) FROM caso
         WHERE telefono IS NULL OR btrim(telefono) = ''
        """
    )
    sin_numero = cur.fetchone()[0]
    cur.execute("SELECT id_caso, telefono FROM caso WHERE telefono IS NOT NULL")
    validos, invalidos = 0, 0
    por_numero: dict[str, list[int]] = {}
    for id_caso, telefono in cur.fetchall():
        numero = normalizar_numero(telefono)
        if numero and re.fullmatch(patron, numero):
            validos += 1
            por_numero.setdefault(numero, []).append(id_caso)
        else:
            invalidos += 1
    repetidos = {n: ids for n, ids in por_numero.items() if len(ids) > 1}
    cur.execute(
        """
        SELECT count(*) FROM caso
         WHERE tipo_caso = 'REPARACION'
           AND (id_pago IS NULL OR id_averia LIKE 'REF-%')
        """
    )
    marcados = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM caso WHERE id_pago IS NOT NULL")
    ya_enlazados = cur.fetchone()[0]
    return {
        "sin_numero": sin_numero,
        "validos": validos,
        "invalidos": invalidos,
        "identificadores_distintos": len(por_numero),
        "repetidos": repetidos,
        "marcados": marcados,
        "ya_enlazados": ya_enlazados,
    }


def aplicar_backfill(cur, patron: str, con_contactos: bool) -> dict[str, int]:
    """Crea los identificadores, enlaza los casos y suma los contactos."""
    import re

    creados = enlazados = contactos = 0
    cache: dict[str, int] = {}

    cur.execute(CASOS_A_ENLAZAR)
    for id_caso, id_central, telefono, nombre, direccion in cur.fetchall():
        numero = normalizar_numero(telefono)
        if not numero or not re.fullmatch(patron, numero):
            continue
        id_pago = cache.get(numero)
        if id_pago is None:
            cur.execute(UPSERT_IDENTIFICADOR, (numero, id_central, nombre, direccion))
            cur.execute(SELECCIONAR_IDENTIFICADOR, (numero,))
            fila = cur.fetchone()
            if fila is None:  # pragma: no cover
                continue
            id_pago = fila[0]
            cache[numero] = id_pago
            creados += 1
        cur.execute(
            """
            INSERT INTO caso_d89_backup (id_caso, telefono, contacto_cliente, informacion)
            SELECT id_caso, telefono, contacto_cliente, informacion FROM caso WHERE id_caso = %s
            ON CONFLICT (id_caso) DO NOTHING
            """,
            (id_caso,),
        )
        cur.execute(
            "UPDATE caso SET id_pago = %s, telefono = %s WHERE id_caso = %s",
            (id_pago, numero, id_caso),
        )
        enlazados += 1

    # Alias `telefono`: un número que no es 70* no puede quedarse en el alias del
    # identificador (H-03). Se mueve a contacto y el alias queda NULL.
    alias_limpiados = 0
    cur.execute(CASOS_CON_ALIAS_INVALIDO)
    for id_caso, telefono, contacto_cliente, _informacion in cur.fetchall():
        numero = normalizar_numero(telefono)
        cur.execute(
            """
            INSERT INTO caso_d89_backup (id_caso, telefono, contacto_cliente, informacion)
            SELECT id_caso, telefono, contacto_cliente, informacion FROM caso WHERE id_caso = %s
            ON CONFLICT (id_caso) DO NOTHING
            """,
            (id_caso,),
        )
        if numero and numero not in (contacto_cliente or ""):
            cur.execute(
                """
                UPDATE caso
                   SET telefono = NULL,
                       contacto_cliente = coalesce(contacto_cliente, %s),
                       informacion = CASE
                           WHEN coalesce(informacion, '') LIKE '%%[CONTACTO] ' || %s || '%%'
                                THEN informacion
                           ELSE coalesce(informacion || E'\\n', '')
                                || '[CONTACTO] ' || %s
                         END
                 WHERE id_caso = %s
                """,
                (numero, numero, numero, id_caso),
            )
        else:
            cur.execute("UPDATE caso SET telefono = NULL WHERE id_caso = %s", (id_caso,))
        alias_limpiados += 1

    if con_contactos:
        cur.execute(CASOS_CON_CONTACTO)
        for id_caso, contacto, informacion in cur.fetchall():
            numero = normalizar_numero(contacto)
            if not numero or f"[CONTACTO] {numero}" in (informacion or ""):
                continue
            cur.execute(
                """
                INSERT INTO caso_d89_backup (id_caso, telefono, contacto_cliente, informacion)
                SELECT id_caso, telefono, contacto_cliente, informacion
                  FROM caso WHERE id_caso = %s
                ON CONFLICT (id_caso) DO NOTHING
                """,
                (id_caso,),
            )
            cur.execute(
                """
                UPDATE caso
                   SET contacto_cliente = %s,
                       informacion = CASE
                           WHEN coalesce(informacion, '') LIKE '%%[CONTACTO] ' || %s || '%%'
                                THEN informacion
                           ELSE coalesce(informacion || E'\\n', '')
                                || '[CONTACTO] ' || %s
                         END
                 WHERE id_caso = %s
                """,
                (numero, numero, numero, id_caso),
            )
            contactos += 1

    return {"identificadores_creados": creados, "casos_enlazados": enlazados,
            "contactos_sumados": contactos, "alias_limpiados": alias_limpiados}


def verificar(cur) -> list[str]:
    """Verificaciones post-migración: devuelve la lista de fallos."""
    fallos: list[str] = []
    cur.execute(
        """
        SELECT count(*) FROM caso
         WHERE id_pago IS NULL AND telefono IS NOT NULL AND btrim(telefono) <> ''
           AND telefono ~ '^70[0-9]{8}$'
        """
    )
    pendientes = cur.fetchone()[0]
    if pendientes:
        fallos.append(f"{pendientes} casos con número válido y sin id_pago")
    cur.execute("SELECT count(*) FROM identificador_pago")
    total_ip = cur.fetchone()[0]
    cur.execute("SELECT count(DISTINCT id_pago) FROM caso WHERE id_pago IS NOT NULL")
    distintos = cur.fetchone()[0]
    if distintos > total_ip:
        fallos.append("hay casos enlazados a identificadores inexistentes")
    cur.execute(
        """
        SELECT count(*) FROM pg_constraint
         WHERE conname = 'ck_reparacion_con_ip'
           AND connamespace = current_schema()::regnamespace
        """
    )
    if cur.fetchone()[0] == 0:
        fallos.append("falta la restricción ck_reparacion_con_ip")
    return fallos


def main() -> int:
    p = argparse.ArgumentParser(description="Migración D-89: identificador de pago (70*).")
    p.add_argument("--aplicar", action="store_true", help="Escribe de verdad")
    p.add_argument("--si", action="store_true", help="No pide confirmación")
    p.add_argument("--dsn", default=None, help="Cadena de conexión (alternativa a DB_*)")
    p.add_argument("--sin-contactos", action="store_true",
                   help="No sumar [CONTACTO] a informacion en el backfill")
    p.add_argument("--validar-check", action="store_true",
                   help="Ejecuta VALIDATE CONSTRAINT si no quedan violaciones")
    args = p.parse_args()

    registrar("=" * 74)
    registrar(f"MIGRACIÓN D-89 (identificador de pago 70*) — "
              f"{'APLICAR' if args.aplicar else 'SIMULACIÓN'}")

    conn = conectar(args)
    try:
        conn.autocommit = False
        cur = conn.cursor()

        patron = patron_vigente(cur)
        registrar(f"Patrón vigente del identificador: {patron}")

        if not args.aplicar:
            inv = inventario(cur, patron)
            registrar(
                "Inventario (solo lectura): "
                f"casos sin número={inv['sin_numero']}, con 70* válido={inv['validos']}, "
                f"con número no válido={inv['invalidos']}, "
                f"identificadores distintos={inv['identificadores_distintos']}, "
                f"ya enlazados={inv['ya_enlazados']}, "
                f"REPARACIONES marcadas={inv['marcados']}"
            )
            if inv["repetidos"]:
                registrar(f"Identificadores compartidos por varios casos: {inv['repetidos']}")
            registrar("Simulación: se aplicaría el DDL, el backfill y los avisos del lote.")
            registrar("Vuelve a ejecutar con --aplicar para escribir.")
            return 0

        if not args.si:
            respuesta = input("¿Aplicar la migración D-89 en esta base? [s/N] ").strip().lower()
            if respuesta not in {"s", "si", "sí", "y"}:
                registrar("Cancelado por el usuario.")
                return 0

        for titulo, sql in DDL:
            cur.execute(sql)
            registrar(f"DDL aplicado: {titulo}")
        conn.commit()

        resultado = aplicar_backfill(cur, patron, con_contactos=not args.sin_contactos)
        conn.commit()
        registrar(f"Backfill: {resultado}")

        fallos = verificar(cur)
        if fallos:
            registrar(f"AVISO: verificaciones pendientes → {fallos}")
        else:
            registrar("Verificaciones post-migración: OK")

        inv = inventario(cur, patron)
        registrar(
            f"Inventario final: identificadores distintos={inv['identificadores_distintos']}, "
            f"casos enlazados={inv['ya_enlazados']}, REPARACIONES marcadas={inv['marcados']} "
            "(se reclasifican en su próximo cambio, DEC-IP-3)"
        )

        if args.validar_check and not inv["marcados"]:
            cur.execute("ALTER TABLE caso VALIDATE CONSTRAINT ck_reparacion_con_ip")
            conn.commit()
            registrar("VALIDATE CONSTRAINT ck_reparacion_con_ip: OK")
        elif args.validar_check:
            registrar("VALIDATE omitido: quedan REPARACIONES marcadas (DEC-IP-3)")

        registrar("MIGRACIÓN D-89: OK")
        return 0
    except Exception as exc:  # se reporta y se revierte la transacción
        conn.rollback()
        registrar(f"ERROR: {exc}")
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
