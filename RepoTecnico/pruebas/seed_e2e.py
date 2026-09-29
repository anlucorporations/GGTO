#!/usr/bin/env python3
"""Datos deterministas para las pruebas E2E de la Fase 4.

Crea (o reinicia) un esquema **aislado** —por defecto `ggto_e2e`— a partir de
`RepoTecnico/db/schema.sql` y siembra usuarios, cuadrillas, sectores y casos
marcados con el prefijo `E2E-`. Nunca toca producción: aborta si el esquema es
`public`.

Uso:
    DB_SCHEMA=ggto_e2e python3 RepoTecnico/pruebas/seed_e2e.py
"""

from __future__ import annotations

import json
import os
import pathlib
import sys
from datetime import UTC, datetime, timedelta

RAIZ = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ))
os.environ.setdefault("DB_SCHEMA", "ggto_e2e")

from sqlalchemy import create_engine, select, text  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

from app.core.db import build_url  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models import (  # noqa: E402
    Caso,
    Causa,
    Central,
    Cuadrilla,
    CuadrillaTecnico,
    Flota,
    Rol,
    Sector,
    SectorDireccion,
    Tecnico,
    Usuario,
)

ESQUEMA = os.environ.get("DB_SCHEMA", "ggto_e2e")
CLAVE = "E2e.Clave.2026"
PREFIJO = "E2E-"

USUARIOS = [
    ("E2EADM", "ADMIN", "ADMIN", "E2E", "Administrador"),
    ("E2ESUP", "SUPERVISOR", "SUPERVISOR", "E2E", "Supervisor"),
    ("E2ETEC", "TECNICO", "TECNICO", "E2E", "Tecnico"),
    ("E2ESUPR", "SUPER", "SUPER", "E2E", "Super Usuario"),
]


def _abortar(mensaje: str) -> None:
    print(f"ERROR: {mensaje}", file=sys.stderr)
    raise SystemExit(1)


def preparar_esquema(engine) -> None:
    """Reinicia el esquema de pruebas y reaplica `schema.sql` (idempotente)."""
    with engine.begin() as conn:
        conn.exec_driver_sql(f'CREATE SCHEMA IF NOT EXISTS "{ESQUEMA}"')
        tablas = [
            fila[0]
            for fila in conn.execute(
                text(
                    "SELECT table_name FROM information_schema.tables "
                    "WHERE table_schema = :s AND table_type = 'BASE TABLE'"
                ),
                {"s": ESQUEMA},
            )
        ]
        if tablas:
            listado = ", ".join(f'"{ESQUEMA}"."{t}"' for t in tablas)
            conn.exec_driver_sql(f"TRUNCATE TABLE {listado} RESTART IDENTITY CASCADE")

    conexion = engine.raw_connection()
    try:
        cur = conexion.cursor()
        cur.execute((RAIZ / "RepoTecnico" / "db" / "schema.sql").read_text(encoding="utf-8"))
        conexion.commit()
    finally:
        conexion.close()


def sembrar(db) -> dict:
    central = db.scalar(select(Central).where(Central.codigo_central == "2324X"))
    if central is None:
        _abortar("la central 2324X no existe tras aplicar schema.sql")
    roles = {r.codigo: r for r in db.scalars(select(Rol)).all()}

    # --- Técnicos y usuarios (uno por rol para RBAC) ---
    tecnicos = {}
    for p00, _rol, nombre, apellido, _etiqueta in [
        (u[0], u[1], u[2], u[3], u[4]) for u in USUARIOS
    ]:
        tecnico = Tecnico(id_central=central.id_central, nombre=nombre, apellido=apellido,
                          p00=p00, status="ACTIVO")
        db.add(tecnico)
        tecnicos[p00] = tecnico
    db.flush()

    for p00, rol, _nombre, _apellido, _etiqueta in USUARIOS:
        db.add(
            Usuario(
                p00=p00,
                correo=f"{p00.lower()}@e2e.local",
                clave_hash=hash_password(CLAVE),
                id_rol=roles[rol].id_rol,
                id_tecnico=tecnicos[p00].id_tecnico,
                id_central=central.id_central,
            )
        )

    # --- Sector con su patrón de direcciones ---
    sector = Sector(id_central=central.id_central, nombre="SECTOR E2E", codigo="E2E-S1",
                    descripcion="Sector sintético para pruebas E2E", prioridad=10, activo=True)
    db.add(sector)
    db.flush()
    db.add(SectorDireccion(id_sector=sector.id_sector, patron="CALLE E2E",
                           tipo_coincidencia="CONTIENE", normalizar=True, activo=True))

    # Segundo sector sin casos: permite probar la asignación dinámica (D-66).
    sector2 = Sector(id_central=central.id_central, nombre="SECTOR E2E 2", codigo="E2E-S2",
                     descripcion="Sector sintético secundario", prioridad=20, activo=True)
    db.add(sector2)
    db.flush()
    db.add(SectorDireccion(id_sector=sector2.id_sector, patron="CALLE E2E DOS",
                           tipo_coincidencia="CONTIENE", normalizar=True, activo=True))

    # --- Flota, cuadrillas de calle y cuadrilla 0 (supervisor ya existe: C-00) ---
    flota = Flota(id_central=central.id_central, can="E2ECAN01", tipo="Camioneta",
                  marca="Toyota", modelo="Hilux", placa="E2E001", status="DISPONIBLE")
    db.add(flota)
    db.flush()
    cuadrilla = Cuadrilla(id_central=central.id_central, codigo="E2E-C1", nombre="Cuadrilla E2E 1",
                          id_flota=flota.id_flota, es_supervisor=False, activa=True)
    db.add(cuadrilla)
    db.flush()
    db.add(CuadrillaTecnico(id_cuadrilla=cuadrilla.id_cuadrilla,
                            id_tecnico=tecnicos["E2ETEC"].id_tecnico,
                            rol_cuadrilla="REPARADOR_PRINCIPAL"))

    # Segunda cuadrilla de calle (para la asignación dinámica de sectores).
    cuadrilla2 = Cuadrilla(id_central=central.id_central, codigo="E2E-C2",
                           nombre="Cuadrilla E2E 2", es_supervisor=False, activa=True)
    db.add(cuadrilla2)
    db.flush()

    # --- Causa ---
    causa = Causa(codigo_causa="E2E", subcodigo_causa="01", descripcion="Causa E2E",
                  descripcion_subcodigo="Causa sintética de pruebas", tipo="AVERIA", activo=True)
    db.add(causa)
    db.flush()

    # --- Casos: 6 concentrados en un OLT (dispara RF-09 con umbral 5) ---
    ahora = datetime.now(UTC)
    definiciones = [
        ("E2E-0001", "RESIDENCIAL", "NUEVO", "e2e-olt-00", "AVERIA"),
        ("E2E-0002", "RESIDENCIAL", "NUEVO", "e2e-olt-00", "AVERIA"),
        ("E2E-0003", "RESIDENCIAL", "ASIGNADO", "e2e-olt-00", "AVERIA"),
        ("E2E-0004", "RESIDENCIAL", "NUEVO", "e2e-olt-00", "AVERIA"),
        ("E2E-0005", "RESIDENCIAL", "NUEVO", "e2e-olt-00", "AVERIA"),
        ("E2E-0006", "REFERIDO", "CITADO", "e2e-olt-00", "AVERIA"),
        ("E2E-0007", "EMPRESA", "NUEVO", "e2e-olt-01", "REPARACION"),
        ("E2E-0008", "GOBIERNO", "NUEVO", "e2e-olt-01", "CONSTRUCCION"),
    ]
    for indice, (id_averia, categoria, estado, olt, tipo) in enumerate(definiciones):
        db.add(
            Caso(
                id_central=central.id_central,
                id_averia=id_averia,
                origen="MANUAL",
                tipo_caso=tipo,
                categoria=categoria,
                estado_actual=estado,
                id_sector=sector.id_sector,
                id_causa=causa.id_causa,
                nombre_cliente=f"Cliente E2E {indice + 1}",
                telefono=f"0414000{indice:04d}",
                direccion=f"CALLE E2E, CASA {indice + 1}, SECTOR E2E",
                problema_reporte="FALLA FIBRA E2E" if indice % 2 == 0 else "NAVEGACION LENTA E2E",
                olt=olt,
                codigo_central=central.codigo_central,
                nombre_central=central.nombre_central,
                creado_por="E2EADM",
                fecha_cita=ahora + timedelta(days=1) if estado == "CITADO" else None,
                creado_en=ahora - timedelta(hours=1),
            )
        )

    db.commit()
    return {
        "esquema": ESQUEMA,
        "central": central.codigo_central,
        "usuarios": {u[0]: {"rol": u[1], "clave": CLAVE} for u in USUARIOS},
        "sector": sector.codigo,
        "cuadrilla": cuadrilla.codigo,
        "cuadrillas": [cuadrilla.codigo, cuadrilla2.codigo],
        "casos": len(definiciones),
    }


def main() -> None:
    if ESQUEMA in ("", "public"):
        _abortar("DB_SCHEMA debe apuntar a un esquema de pruebas (se rechazó 'public')")
    engine = create_engine(build_url(), future=True)
    preparar_esquema(engine)
    fabrica = sessionmaker(bind=engine, expire_on_commit=False)
    with fabrica() as db:
        resumen = sembrar(db)
    engine.dispose()
    print(json.dumps(resumen, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
