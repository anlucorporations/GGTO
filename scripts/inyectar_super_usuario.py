#!/usr/bin/env python3
"""Inyección controlada del **Super Usuario** de la plataforma GGTO.

=============================================================================
QUÉ HACE
    Crea (o actualiza) el Super Usuario en la base de datos PostgreSQL de GGTO:
      · cuenta en `usuario` con el rol SUPER (acceso total, ver app/api/deps.py)
      · ficha en `tecnico` asociada a la central
      · opcionalmente, las 12 palabras de seguridad en `dispositivo_seguridad`
    Es idempotente: si el P00 ya existe, actualiza sus datos y su clave.

SEGURIDAD
    · La clave NO se escribe en este archivo ni en la línea de comandos:
      se lee de la variable de entorno indicada por `--clave-env`
      (por defecto GGTO_SUPER_CLAVE) o se solicita de forma oculta.
    · Pide confirmación interactiva antes de escribir (salvo `--si`).
    · Registra cada ejecución en RepoTecnico/BaseOperaciones/inyeccion_super_usuario.log
    · NUNCA se ejecuta sola: hay que invocarla explícitamente.

USO
    export DB_HOST=... DB_NAME=ggtov2 DB_USER=ggtov2_app DB_PASSWORD='...'
    export GGTO_SUPER_CLAVE='...'
    python3 scripts/inyectar_super_usuario.py \
        --p00 123456 --correo usuario@dominio --nombre "NOMBRE APELLIDO" \
        [--apellido ""] [--rol SUPER] [--id-central 1] [--con-palabras] [--dry-run] [--si]

    # Simulación sin escribir nada:
    python3 scripts/inyectar_super_usuario.py --p00 123456 --correo x@y --nombre X --dry-run
=============================================================================
"""

from __future__ import annotations

import argparse
import getpass
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))

try:  # Reutiliza exactamente los mismos parámetros de hash y de palabras que la app
    from app.core.security import hash_password, normalizar_palabra
    from app.core.words import generar_palabras

    HASH_APP = True
except Exception:  # pragma: no cover - el script debe poder correr aislado
    HASH_APP = False

    from argon2 import PasswordHasher

    _ph = PasswordHasher()

    def hash_password(clave: str) -> str:  # type: ignore[misc]
        return _ph.hash(clave)

    def normalizar_palabra(valor: str) -> str:  # type: ignore[misc]
        return (valor or "").strip().lower()

    def generar_palabras(n: int = 12) -> list[str]:  # type: ignore[misc]
        import secrets

        base = [
            "agua", "arbol", "arena", "avion", "barco", "blanco", "boca", "brazo", "cable",
            "cafe", "calle", "campo", "carta", "casa", "cielo", "cobre", "codo", "copa",
            "costa", "cruz", "dado", "dedo", "disco", "duna", "enero", "faro", "fiesta",
            "fuego", "gafas", "gallo", "gato", "gota", "hielo", "higo", "hilo", "hoja",
            "hueso", "isla", "jabon", "juego", "lago", "lampara", "lapiz", "libro", "lima",
            "llave", "luna", "madera", "mano", "mapa", "mesa", "metal", "miel", "monte",
            "muro", "naranja", "nave", "nieve", "nube", "nudo", "obra", "ocaso", "ola",
            "oro", "oso", "palma", "pan", "papel", "parque", "pasto", "pera", "piedra",
            "pino", "plata", "playa", "pluma", "pozo", "puente", "puerta", "queso", "rama",
            "raton", "rayo", "red", "reloj", "rio", "roca", "rosa", "rueda", "sal", "sello",
            "silla", "sol", "sombra", "sopa", "taza", "techo", "tierra", "tigre", "tiza",
            "toro", "trigo", "tubo", "uva", "vaca", "valle", "vela", "viento", "vidrio",
            "zapato",
        ]
        return secrets.SystemRandom().sample(base, n)

LOG = RAIZ / "RepoTecnico" / "BaseOperaciones" / "inyeccion_super_usuario.log"


def registrar(mensaje: str) -> None:
    LOG.parent.mkdir(parents=True, exist_ok=True)
    linea = f"[{datetime.now(timezone.utc).isoformat(timespec='seconds')}] {mensaje}\n"
    with LOG.open("a", encoding="utf-8") as fh:
        fh.write(linea)
    print(mensaje)


def conectar(args):
    import psycopg2

    if args.dsn:
        return psycopg2.connect(args.dsn)

    faltan = [v for v in ("DB_NAME", "DB_USER", "DB_PASSWORD") if not os.environ.get(v)]
    if faltan and not args.dry_run:
        registrar(f"ERROR: faltan variables de entorno: {', '.join(faltan)}")
        sys.exit(2)

    return psycopg2.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        port=int(os.environ.get("DB_PORT", "5432")),
        dbname=os.environ.get("DB_NAME", "ggtov2"),
        user=os.environ.get("DB_USER", "ggtov2_app"),
        password=os.environ.get("DB_PASSWORD", ""),
        sslmode=os.environ.get("DB_SSLMODE", "prefer"),
        connect_timeout=20,
    )


def resolver_rol(cur, codigo: str) -> int:
    cur.execute("SELECT id_rol FROM rol WHERE codigo = %s", (codigo,))
    fila = cur.fetchone()
    if fila:
        return fila[0]
    if codigo.upper() == "SUPER":
        cur.execute(
            "INSERT INTO rol (codigo, nombre, descripcion) VALUES ('SUPER','Super Usuario',"
            "'Acceso total a todas las secciones y funciones de la plataforma') RETURNING id_rol"
        )
        registrar("Rol SUPER creado (no existía en el catálogo).")
        return cur.fetchone()[0]
    registrar(f"ERROR: el rol {codigo} no existe y no se crea automáticamente.")
    sys.exit(3)


def resolver_central(cur, id_central: int | None) -> tuple[int, str]:
    if id_central:
        cur.execute(
            "SELECT id_central, codigo_central FROM central WHERE id_central = %s", (id_central,)
        )
    else:
        cur.execute(
            "SELECT id_central, codigo_central FROM central WHERE activa ORDER BY id_central LIMIT 1"
        )
    fila = cur.fetchone()
    if not fila:
        registrar("ERROR: no hay ninguna central configurada.")
        sys.exit(4)
    return fila[0], fila[1]


def main() -> int:
    p = argparse.ArgumentParser(description="Inyecta el Super Usuario de GGTO.")
    p.add_argument("--p00", required=True, help="Identificador laboral (login)")
    p.add_argument("--correo", required=True)
    p.add_argument("--nombre", required=True, help="Nombre visible (p. ej. ANLUcorporations)")
    p.add_argument("--apellido", default="")
    p.add_argument("--rol", default="SUPER")
    p.add_argument("--id-central", type=int, default=None)
    p.add_argument("--clave-env", default="GGTO_SUPER_CLAVE",
                   help="Variable de entorno que contiene la clave")
    p.add_argument("--dsn", default=None, help="Cadena de conexión completa (alternativa a DB_*)")
    p.add_argument("--con-palabras", action="store_true",
                   help="Genera y guarda las 12 palabras de seguridad (se muestran una vez)")
    p.add_argument("--dry-run", action="store_true", help="Simula sin escribir en la base")
    p.add_argument("--si", action="store_true", help="Omite la confirmación interactiva")
    args = p.parse_args()

    clave = os.environ.get(args.clave_env)
    if not clave:
        if args.dry_run:
            clave = "simulada"
        else:
            clave = getpass.getpass("Clave del Super Usuario: ")
    if not args.dry_run and len(clave) < 8:
        registrar("ERROR: la clave debe tener al menos 8 caracteres.")
        return 5

    registrar("=" * 78)
    registrar(f"INYECCIÓN DE SUPER USUARIO · P00={args.p00} · rol={args.rol} · dry_run={args.dry_run}")
    registrar(f"hash con la app: {HASH_APP}")

    if not args.si:
        respuesta = input(f"¿Crear/actualizar el Super Usuario {args.p00}? (s/n): ").strip().lower()
        if respuesta != "s":
            registrar("Cancelado por el usuario.")
            return 0

    conexion = conectar(args)
    conexion.autocommit = False
    try:
        with conexion.cursor() as cur:
            id_rol = resolver_rol(cur, args.rol)
            id_central, codigo_central = resolver_central(cur, args.id_central)
            registrar(f"Rol {args.rol} (id={id_rol}) · central {codigo_central} (id={id_central})")

            # --- Ficha del técnico ---
            cur.execute("SELECT id_tecnico FROM tecnico WHERE p00 = %s", (args.p00,))
            fila = cur.fetchone()
            if fila:
                id_tecnico = fila[0]
                cur.execute(
                    "UPDATE tecnico SET id_central=%s, nombre=%s, apellido=%s, correo=%s, "
                    "status='ACTIVO', actualizado_en=now() WHERE id_tecnico=%s",
                    (id_central, args.nombre, args.apellido or None, args.correo, id_tecnico),
                )
                registrar(f"Técnico {args.p00} actualizado (id={id_tecnico}).")
            else:
                cur.execute(
                    "INSERT INTO tecnico (id_central, nombre, apellido, p00, correo, status) "
                    "VALUES (%s,%s,%s,%s,%s,'ACTIVO') RETURNING id_tecnico",
                    (id_central, args.nombre, args.apellido or None, args.p00, args.correo),
                )
                id_tecnico = cur.fetchone()[0]
                registrar(f"Técnico {args.p00} creado (id={id_tecnico}).")

            # --- Cuenta de usuario ---
            hash_clave = hash_password(clave)
            cur.execute("SELECT id_usuario FROM usuario WHERE p00 = %s", (args.p00,))
            fila = cur.fetchone()
            if fila:
                cur.execute(
                    "UPDATE usuario SET correo=%s, clave_hash=%s, id_rol=%s, id_tecnico=%s, "
                    "id_central=%s, activo=true, bloqueado=false, intentos_fallidos=0, "
                    "requiere_cambio_clave=false, actualizado_en=now() WHERE id_usuario=%s",
                    (args.correo, hash_clave, id_rol, id_tecnico, id_central, fila[0]),
                )
                registrar(f"Usuario {args.p00} actualizado (id={fila[0]}): clave y acceso total.")
            else:
                cur.execute(
                    "INSERT INTO usuario (p00, correo, clave_hash, id_rol, id_tecnico, id_central, "
                    "activo, bloqueado, intentos_fallidos) VALUES (%s,%s,%s,%s,%s,%s,true,false,0) "
                    "RETURNING id_usuario",
                    (args.p00, args.correo, hash_clave, id_rol, id_tecnico, id_central),
                )
                registrar(f"Usuario {args.p00} creado (id={cur.fetchone()[0]}): clave y acceso total.")

            # --- Palabras de seguridad (opcional) ---
            palabras: list[str] = []
            if args.con_palabras:
                palabras = generar_palabras(12)
                hashes = [hash_password(normalizar_palabra(w)) for w in palabras]
                import json

                cur.execute(
                    "INSERT INTO dispositivo_seguridad (p00, palabras_hash, version) "
                    "VALUES (%s, %s::jsonb, 1) "
                    "ON CONFLICT (p00) DO UPDATE SET palabras_hash=EXCLUDED.palabras_hash, "
                    "version=dispositivo_seguridad.version+1, actualizado_en=now()",
                    (args.p00, json.dumps(hashes)),
                )
                registrar("12 palabras de seguridad guardadas (hashes).")

            if args.dry_run:
                conexion.rollback()
                registrar("SIMULACIÓN: no se escribió nada (rollback).")
            else:
                conexion.commit()
                registrar("COMMIT realizado.")

        # Verificación
        if not args.dry_run:
            with conexion.cursor() as cur:
                cur.execute(
                    "SELECT u.p00, u.correo, r.codigo, u.activo, u.bloqueado, u.id_central, "
                    "t.nombre, t.apellido FROM usuario u JOIN rol r ON r.id_rol=u.id_rol "
                    "LEFT JOIN tecnico t ON t.id_tecnico=u.id_tecnico WHERE u.p00=%s",
                    (args.p00,),
                )
                f = cur.fetchone()
                registrar(f"VERIFICADO → P00={f[0]} correo={f[1]} rol={f[2]} activo={f[3]} "
                          f"bloqueado={f[4]} central={f[5]} nombre={f[6]} {f[7] or ''}")
    finally:
        conexion.close()

    if palabras:
        registrar("PALABRAS DE SEGURIDAD (se muestran una sola vez, guárdelas):")
        for i, w in enumerate(palabras, start=1):
            registrar(f"  {i:2d}. {w}")

    registrar("Listo. El Super Usuario tiene acceso total (rol SUPER) a todas las secciones.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
