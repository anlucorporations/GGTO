"""Cierre masivo de los CASOS COMUNES (orden del SUPER).

Cierra —con la misma ruta del cierre normal de la ficha (D-70/D-76):
actividad `CIERRE` + historial de estados + clasificación— todos los
casos «comunes» de producción:

* `categoria = 'RESIDENCIAL'` (la columna COMUNES del despacho, D-113/D-162);
* que NO sean `MANTENIMIENTO` (los casos de las fallas masivas, D-161);
* que NO estén marcados como falla masiva (`es_falla_masiva`);
* que NO estén ya en estado terminal (`CERRADO`/`CANCELADO`).

El modo de cierre es **COS** (el omiso de la ficha del caso en la web; el
panel de masivas documenta que COS/SACAS son los modos administrativos).
El actor es el usuario SUPER, como en la migración D-161.

USO
    python scripts/cerrar_casos_comunes.py                 # simula
    python scripts/cerrar_casos_comunes.py --aplicar --si  # aplica

Conexión: variables `DB_*` (igual que la app) o `--dsn`.
Log: `RepoTecnico/BaseOperaciones/cierre_casos_comunes.log`.
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
if str(RAIZ) not in sys.path:
    # Permite ejecutar el script directamente (`python scripts/…`) importando
    # los paquetes de la app del repositorio.
    sys.path.insert(0, str(RAIZ))
LOG = RAIZ / "RepoTecnico" / "BaseOperaciones" / "cierre_casos_comunes.log"

DESCRIPCION = "Cierre masivo de casos comunes, ordenado por el SUPER"
MODO = "COS"
P00_SUPER = "123456"

RESUMEN = """
SELECT estado_actual, tipo_caso, count(*) AS casos
FROM caso
WHERE categoria = 'RESIDENCIAL'
  AND coalesce(es_falla_masiva, false) = false
  AND tipo_caso <> 'MANTENIMIENTO'
  AND estado_actual NOT IN ('CERRADO', 'CANCELADO')
GROUP BY estado_actual, tipo_caso
ORDER BY estado_actual, tipo_caso
"""

VERIFICACION = """
SELECT
    (SELECT count(*) FROM caso
      WHERE categoria = 'RESIDENCIAL'
        AND coalesce(es_falla_masiva, false) = false
        AND tipo_caso <> 'MANTENIMIENTO'
        AND estado_actual NOT IN ('CERRADO', 'CANCELADO')) AS por_cerrar,
    (SELECT count(*) FROM caso
      WHERE categoria = 'RESIDENCIAL'
        AND coalesce(es_falla_masiva, false) = false
        AND tipo_caso <> 'MANTENIMIENTO'
        AND estado_actual = 'CERRADO') AS cerrados
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


def resumen(cur) -> list[tuple]:
    cur.execute(RESUMEN)
    return cur.fetchall()


def aplicar() -> int:
    """Cierra los casos por la ruta del negocio (services.resolucion.cerrar_caso)."""
    from sqlalchemy import func, select
    from sqlalchemy import text as sql_text

    from app.core.db import SessionLocal
    from app.models import Caso, Usuario
    from app.services import resolucion

    db = SessionLocal()
    # RLS (D-62): la sesión opera la central 1 (la única en producción).
    db.execute(sql_text("SELECT set_config('app.id_central', '1', true)"))
    super_ = db.scalar(select(Usuario).where(Usuario.p00 == P00_SUPER))
    if super_ is None:
        registrar(f"ERROR: no existe el usuario SUPER «{P00_SUPER}» (fail-closed)")
        return 5

    criterio = (
        Caso.categoria == "RESIDENCIAL",
        Caso.es_falla_masiva.isnot(True),
        Caso.tipo_caso != "MANTENIMIENTO",
        Caso.estado_actual.notin_(("CERRADO", "CANCELADO")),
    )
    casos = db.scalars(select(Caso).where(*criterio)).all()
    cerrados, omitidos = 0, 0
    for caso in casos:
        try:
            resolucion.cerrar_caso(
                db, caso,
                modo=MODO,
                descripcion=DESCRIPCION,
                usuario=super_,
            )
        except resolucion.CierreInvalido as exc:
            omitidos += 1
            registrar(f"OMITIDO {caso.id_averia}: {exc.mensaje}")
        else:
            cerrados += 1
            registrar(f"CERRADO {caso.id_averia} (id_caso={caso.id_caso})")
    db.commit()

    quedan = db.scalar(
        select(func.count()).select_from(Caso).where(*criterio)
    )
    db.close()
    registrar(f"resumen del cierre: cerrados={cerrados} omitidos={omitidos} quedan={quedan}")
    return 0 if not quedan else 3


def main() -> int:
    p = argparse.ArgumentParser(
        description="Cierre masivo de casos comunes (orden del SUPER)."
    )
    p.add_argument("--aplicar", action="store_true", help="Aplica el cierre (por defecto simula)")
    p.add_argument("--si", action="store_true", help="Omite la confirmación interactiva")
    p.add_argument("--dsn", default=None, help="Cadena de conexión (alternativa a DB_*)")
    args = p.parse_args()

    # La verificación previa se consulta por SQL directo; la escritura va por
    # la ruta del negocio (ORM + reglas de cierre).
    conn = conectar(args)
    try:
        conn.autocommit = False
        with conn.cursor() as cur:
            cur.execute(VERIFICACION)
            estado = dict(zip([d[0] for d in cur.description], cur.fetchone(), strict=True))
            registrar("=" * 78)
            registrar("CIERRE MASIVO DE CASOS COMUNES (categoria RESIDENCIAL, orden del SUPER)")
            registrar(f"modo de cierre = {MODO}; actor = SUPER «{P00_SUPER}»")
            registrar("modo=APLICAR" if args.aplicar else "modo=SIMULACIÓN")

            filas = resumen(cur)
            if not filas:
                registrar(f"Nada por cerrar: la base ya está resuelta. verificación: {estado}")
                return 0
            descriptor = ", ".join(f"{f[0]}/{f[1]}={f[2]}" for f in filas)
            registrar(f"a cerrar: {descriptor}")
            if not args.aplicar:
                registrar("(simulación) Ejecuta con --aplicar --si para escribir.")
                return 0
    finally:
        conn.close()

    return aplicar()


if __name__ == "__main__":
    sys.exit(main())
