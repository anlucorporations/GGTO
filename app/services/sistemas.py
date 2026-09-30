"""Análisis de la estructura y del contenido de la base de datos (sección SISTEMAS).

Uso exclusivo del **Super Usuario** (D-69). Todo se lee del catálogo del sistema
(`information_schema` / `pg_catalog`). El nombre de la tabla se valida contra un
patrón de identificador y, además, contra el catálogo antes de usarlo, de modo
que nunca se interpola entrada sin comprobar.

El contenido de las filas se **ofusca** en las columnas sensibles: los secretos
(claves y palabras de seguridad) no son legables porque se guardan como hash
Argon2id, y los datos personales se muestran recortados.

Se inspecciona siempre el **esquema activo de la sesión** (`current_schema()`),
no `public` a pelo: así las pruebas, que corren con `search_path=ggto_test`,
nunca leen la base real.
"""

from __future__ import annotations

import re

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

IDENTIFICADOR = re.compile(r"^[a-z_][a-z0-9_]{0,62}$")

# Columnas cuyo valor es un secreto: se resume, no se muestra.
COLUMNAS_SECRETO = {
    "clave_hash",
    "palabras_hash",
    "clave_privada_ref",
    "documento_cifrado",
    "token",
    "secret",
}

# Columnas con datos personales: se muestran recortadas.
COLUMNAS_PII = {
    "correo",
    "email",
    "telefono",
    "contacto",
    "direccion",
    "cedula",
    "abonado",
    "nombre_cliente",
    "persona_reporta",
    "contacto_cliente",
    "documento",
}

MASCARA_SECRETO = "•••• hash no reversible"


def _validar_tabla(nombre: str) -> str:
    if not IDENTIFICADOR.match(nombre or ""):
        raise ValueError(f"Nombre de tabla no válido: {nombre!r}")
    return nombre


def _esquema(db: Session) -> str:
    return db.execute(text("SELECT current_schema()")).scalar_one() or "public"


def _sensibles(columnas: list[str]) -> list[str]:
    return sorted(c for c in columnas if c in COLUMNAS_SECRETO or c in COLUMNAS_PII)


def tablas(db: Session) -> list[str]:
    """Nombres de las tablas base del esquema activo."""
    filas: list[str] = list(db.execute(
        text(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = current_schema() AND table_type = 'BASE TABLE' "
            "ORDER BY table_name"
        )
    ).scalars().all())
    return filas


def _marcar(valor: object, columna: str) -> object:
    """Ofusca el valor según el tipo de columna."""
    if valor is None:
        return None
    if columna in COLUMNAS_SECRETO:
        texto = valor if isinstance(valor, str) else str(valor)
        return f"{MASCARA_SECRETO} ({len(texto)} car.)"
    if columna in COLUMNAS_PII:
        texto = valor if isinstance(valor, str) else str(valor)
        if len(texto) <= 6:
            return texto[:1] + "…"
        return texto[:4] + "…" + f"({len(texto)})"
    if isinstance(valor, (dict, list)):
        return f"<estructura {type(valor).__name__}: {len(valor)}>"
    return valor


def resumen_estructura(db: Session) -> dict:
    """Vista general: renglones, tamaño, columnas y claves de cada tabla."""
    esquema = _esquema(db)
    filas = db.execute(
        text(
            """
            SELECT c.relname AS tabla,
                   obj_description(c.oid) AS comentario,
                   pg_total_relation_size(c.oid) AS bytes_total,
                   (SELECT count(*) FROM pg_attribute a
                     WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped) AS columnas,
                   (SELECT count(*) FROM pg_constraint k
                     WHERE k.conrelid = c.oid AND k.contype = 'p') AS claves_primarias,
                   (SELECT count(*) FROM pg_constraint k
                     WHERE k.conrelid = c.oid AND k.contype = 'f') AS claves_foraneas,
                   (SELECT count(*) FROM pg_constraint k
                     WHERE k.conrelid = c.oid AND k.contype = 'u') AS unicas,
                   (SELECT count(*) FROM pg_trigger t
                     WHERE t.tgrelid = c.oid AND NOT t.tgisinternal) AS disparadores,
                   (SELECT count(*) FROM pg_indexes i
                     WHERE i.schemaname = :e AND i.tablename = c.relname) AS indices
              FROM pg_class c
              JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = :e AND c.relkind = 'r'
             ORDER BY c.relname
            """
        ),
        {"e": esquema},
    ).mappings().all()

    info: list[dict] = []
    for f in filas:
        try:
            renglones = int(
                db.execute(
                    text(f'SELECT count(*) FROM "{esquema}"."{f["tabla"]}"')
                ).scalar_one()
            )
        except SQLAlchemyError:
            renglones = 0
        info.append(
            {
                "tabla": f["tabla"],
                "comentario": f["comentario"],
                "columnas": f["columnas"],
                "renglones": renglones,
                "bytes": int(f["bytes_total"] or 0),
                "kilobytes": round(int(f["bytes_total"] or 0) / 1024, 1),
                "claves_primarias": f["claves_primarias"],
                "claves_foraneas": f["claves_foraneas"],
                "unicas": f["unicas"],
                "indices": f["indices"],
                "disparadores": f["disparadores"],
            }
        )

    extensiones = db.execute(
        text("SELECT extname, extversion FROM pg_extension ORDER BY extname")
    ).mappings().all()

    return {
        "servidor": str(db.execute(text("SELECT version()")).scalar_one()).split(" on ")[0],
        "base": db.execute(text("SELECT current_database()")).scalar_one(),
        "esquema": esquema,
        "usuario": db.execute(text("SELECT current_user")).scalar_one(),
        "total_tablas": len(info),
        "total_renglones": sum(i["renglones"] for i in info),
        "total_bytes": sum(i["bytes"] for i in info),
        "extensiones": [{"nombre": e["extname"], "version": e["extversion"]} for e in extensiones],
        "tablas": info,
    }


def detalle_tabla(db: Session, nombre: str) -> dict:
    """Estructura de una tabla: columnas, claves, índices y referencias."""
    tabla = _validar_tabla(nombre)
    if tabla not in tablas(db):
        raise ValueError(f"La tabla {tabla} no existe en el esquema actual")
    esquema = _esquema(db)
    par = {"t": tabla, "e": esquema}

    columnas = db.execute(
        text(
            """
            SELECT a.attname AS nombre,
                   format_type(a.atttypid, a.atttypmod) AS tipo,
                   NOT a.attnotnull AS admite_nulo,
                   pg_get_expr(d.adbin, d.adnum) AS valor_por_defecto,
                   col_description(a.attrelid, a.attnum) AS comentario
              FROM pg_attribute a
              LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
             WHERE a.attrelid = (:e || '.' || quote_ident(:t))::regclass
               AND a.attnum > 0 AND NOT a.attisdropped
             ORDER BY a.attnum
            """
        ),
        par,
    ).mappings().all()

    primarias: list[str] = list(db.execute(
        text(
            """
            SELECT a.attname AS columna
              FROM pg_constraint k
              JOIN unnest(k.conkey) WITH ORDINALITY x(attnum, orden) ON true
              JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = x.attnum
             WHERE k.conrelid = (:e || '.' || quote_ident(:t))::regclass AND k.contype = 'p'
             ORDER BY x.orden
            """
        ),
        par,
    ).scalars().all())

    unicas = db.execute(
        text(
            """
            SELECT k.conname AS nombre,
                   string_agg(la.attname, ', ' ORDER BY la.attname) AS columnas
              FROM pg_constraint k
              JOIN unnest(k.conkey) lk(attnum) ON true
              JOIN pg_attribute la ON la.attrelid = k.conrelid AND la.attnum = lk.attnum
             WHERE k.conrelid = (:e || '.' || quote_ident(:t))::regclass AND k.contype = 'u'
             GROUP BY k.conname
             ORDER BY k.conname
            """
        ),
        par,
    ).mappings().all()

    foraneas = db.execute(
        text(
            """
            SELECT k.conname AS nombre,
                   string_agg(DISTINCT la.attname, ', ') AS columnas,
                   confrelid::regclass::text AS tabla_referenciada,
                   CASE k.confdeltype
                     WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE'
                     WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' ELSE k.confdeltype::text
                   END AS on_delete
              FROM pg_constraint k
              JOIN unnest(k.conkey) lk(attnum) ON true
              JOIN pg_attribute la ON la.attrelid = k.conrelid AND la.attnum = lk.attnum
             WHERE k.conrelid = (:e || '.' || quote_ident(:t))::regclass AND k.contype = 'f'
             GROUP BY k.conname, confrelid, k.confdeltype
             ORDER BY k.conname
            """
        ),
        par,
    ).mappings().all()

    recibidas = db.execute(
        text(
            """
            SELECT conrelid::regclass::text AS tabla_origen, conname AS constraint
              FROM pg_constraint
             WHERE confrelid = (:e || '.' || quote_ident(:t))::regclass AND contype = 'f'
             ORDER BY 1, 2
            """
        ),
        par,
    ).mappings().all()

    indices = db.execute(
        text(
            "SELECT indexname AS nombre, indexdef AS definicion FROM pg_indexes "
            "WHERE schemaname = :e AND tablename = :t ORDER BY indexname"
        ),
        par,
    ).mappings().all()

    pk = set(primarias)
    nombres = [c["nombre"] for c in columnas]

    return {
        "tabla": tabla,
        "esquema": esquema,
        "comentario": db.execute(
            text("SELECT obj_description((:e || '.' || quote_ident(:t))::regclass)"), par
        ).scalar_one(),
        "renglones": int(
            db.execute(text(f'SELECT count(*) FROM "{esquema}"."{tabla}"')).scalar_one()
        ),
        "columnas": [
            {
                "nombre": c["nombre"],
                "tipo": c["tipo"],
                "nulo": bool(c["admite_nulo"]),
                "por_defecto": c["valor_por_defecto"],
                "comentario": c["comentario"],
                "es_clave": c["nombre"] in pk,
                "sensible": c["nombre"] in COLUMNAS_SECRETO or c["nombre"] in COLUMNAS_PII,
            }
            for c in columnas
        ],
        "claves_primarias": list(primarias),
        "unicas": [{"nombre": u["nombre"], "columnas": u["columnas"]} for u in unicas],
        "claves_foraneas": [
            {
                "nombre": f["nombre"],
                "columnas": f["columnas"],
                "hacia": f["tabla_referenciada"],
                "on_delete": f["on_delete"],
            }
            for f in foraneas
        ],
        "referencias_recibidas": [
            {"tabla": r["tabla_origen"], "constraint": r["constraint"]} for r in recibidas
        ],
        "indices": [{"nombre": i["nombre"], "definicion": i["definicion"]} for i in indices],
        "total_columnas": len(nombres),
        "columnas_ofuscadas": _sensibles(nombres),
    }


def contenido_tabla(db: Session, nombre: str, pagina: int, tamano: int) -> dict:
    """Contenido paginado de una tabla, con las columnas sensibles ofuscadas."""
    tabla = _validar_tabla(nombre)
    if tabla not in tablas(db):
        raise ValueError(f"La tabla {tabla} no existe en el esquema actual")
    esquema = _esquema(db)

    pagina = max(1, pagina)
    tamano = min(max(1, tamano), 100)
    offset = (pagina - 1) * tamano

    columnas: list[str] = list(
        db.execute(
            text(
                "SELECT a.attname AS nombre FROM pg_attribute a "
                "WHERE a.attrelid = (:e || '.' || quote_ident(:t))::regclass "
                "AND a.attnum > 0 AND NOT a.attisdropped ORDER BY a.attnum"
            ),
            {"t": tabla, "e": esquema},
        ).scalars().all()
    )

    seleccion = ", ".join(f'"{c}"' for c in columnas)
    filas = db.execute(
        text(f'SELECT {seleccion} FROM "{esquema}"."{tabla}" LIMIT :l OFFSET :o'),
        {"l": tamano, "o": offset},
    ).mappings().all()

    total = int(
        db.execute(text(f'SELECT count(*) FROM "{esquema}"."{tabla}"')).scalar_one()
    )

    return {
        "tabla": tabla,
        "esquema": esquema,
        "columnas": columnas,
        "filas": [{c: _marcar(fila[c], c) for c in columnas} for fila in filas],
        "total": total,
        "pagina": pagina,
        "tamano": tamano,
        "paginas": max(1, -(-total // tamano)),
        "ofuscadas": _sensibles(columnas),
    }
