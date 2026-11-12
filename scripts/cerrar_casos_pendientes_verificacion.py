"""Cierre administrativo de las averías PENDIENTE (orden del SUPER).

Cierra —por la ruta del negocio (`services.resolucion.cerrar_caso`)— los casos
`tipo_caso = 'AVERIA'` que están en estado **PENDIENTE**, con:

* modo de cierre **SACAS**;
* descripción **VERIFICACION DE DATO**;
* `exigir_evidencias=False`: es un cierre **administrativo** (verificación de
  dato), sin las 2 evidencias POTENCIA que exige el cierre de campo
  (RN-EV-01). Es la misma exención que usa la cascada de masivas (D-99).

El actor es el usuario SUPER `123456`. Todo queda en la bitácora
(`caso_estado_hist`) y en `actividad` (`tipo='CIERRE'`, `id_metodo`→SACAS).

USO
    python scripts/cerrar_casos_pendientes_verificacion.py                 # simula
    python scripts/cerrar_casos_pendientes_verificacion.py --aplicar --si  # aplica

Conexión: variables `DB_*` (igual que la app) o `--dsn`.
Log: `RepoTecnico/BaseOperaciones/cierre_pendientes_sacas.log`.
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
if str(RAIZ) not in sys.path:
    sys.path.insert(0, str(RAIZ))
LOG = RAIZ / "RepoTecnico" / "BaseOperaciones" / "cierre_pendientes_sacas.log"

DESCRIPCION = "VERIFICACION DE DATO"
MODO = "SACAS"
P00_SUPER = "123456"

CRITERIO_SQL = """
WHERE tipo_caso = 'AVERIA'
  AND estado_actual = 'PENDIENTE'
"""

RESUMEN = f"""
SELECT estado_actual, count(*) AS casos
FROM caso
{CRITERIO_SQL}
GROUP BY estado_actual
"""

VERIFICACION = f"""
SELECT
    (SELECT count(*) FROM caso {CRITERIO_SQL}) AS por_cerrar,
    (SELECT count(*) FROM caso
      WHERE tipo_caso = 'AVERIA' AND estado_actual = 'CERRADO') AS cerrados_averia
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

    criterio = (Caso.tipo_caso == "AVERIA", Caso.estado_actual == "PENDIENTE")
    casos = db.scalars(select(Caso).where(*criterio)).all()
    # `EvidenciasInsuficientes` y `exigir_evidencias` solo existen en las versiones
    # del servicio con RN-EV-01 ampliado; el script se adapta a ambas.
    extraordinarias = getattr(resolucion, "EvidenciasInsuficientes", None)
    errores = (resolucion.CierreInvalido,) + ((extraordinarias,) if isinstance(extraordinarias, type) else ())
    kwargs: dict = {"modo": MODO, "descripcion": DESCRIPCION, "usuario": super_}
    import inspect

    if "exigir_evidencias" in inspect.signature(resolucion.cerrar_caso).parameters:
        # Cierre administrativo: sin las 2 evidencias POTENCIA de RN-EV-01.
        kwargs["exigir_evidencias"] = False
    cerrados, omitidos = 0, 0
    for caso in casos:
        try:
            resolucion.cerrar_caso(db, caso, **kwargs)
        except errores as exc:
            omitidos += 1
            registrar(f"OMITIDO {caso.id_averia}: {exc.mensaje}")
        else:
            cerrados += 1
            registrar(f"CERRADO {caso.id_averia} (id_caso={caso.id_caso})")
    db.commit()

    quedan = db.scalar(select(func.count()).select_from(Caso).where(*criterio))
    db.close()
    registrar(f"resumen del cierre: cerrados={cerrados} omitidos={omitidos} quedan={quedan}")
    return 0 if not quedan else 3


def main() -> int:
    p = argparse.ArgumentParser(
        description="Cierre administrativo (SACAS) de las averías PENDIENTE."
    )
    p.add_argument("--aplicar", action="store_true", help="Aplica el cierre (por defecto simula)")
    p.add_argument("--si", action="store_true", help="Omite la confirmación interactiva")
    p.add_argument("--dsn", default=None, help="Cadena de conexión (alternativa a DB_*)")
    args = p.parse_args()

    conn = conectar(args)
    try:
        conn.autocommit = False
        with conn.cursor() as cur:
            cur.execute(VERIFICACION)
            estado = dict(zip([d[0] for d in cur.description], cur.fetchone(), strict=True))
            registrar("=" * 78)
            registrar("CIERRE ADMINISTRATIVO DE AVERÍAS PENDIENTE (orden del SUPER)")
            registrar(f"modo de cierre = {MODO}; descripción = «{DESCRIPCION}»; actor = SUPER «{P00_SUPER}»")
            registrar("modo=APLICAR" if args.aplicar else "modo=SIMULACIÓN")

            cur.execute(RESUMEN)
            filas = cur.fetchall()
            if not filas:
                registrar(f"Nada por cerrar: la base ya está resuelta. verificación: {estado}")
                return 0
            descriptor = ", ".join(f"{f[0]}={f[1]}" for f in filas)
            registrar(f"a cerrar: {descriptor}; verificación: {estado}")
            if not args.aplicar:
                registrar("(simulación) Ejecuta con --aplicar --si para escribir.")
                return 0
    finally:
        conn.close()

    return aplicar()


if __name__ == "__main__":
    sys.exit(main())
