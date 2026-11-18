# -*- coding: utf-8 -*-
"""Configura mcp.api_key en la BD de producción (vm-databases por Tailscale).
Patrón D-55/D-164: solo UPDATE puntual con WHERE exacto, sin DELETE, con log."""
import json
import os
import sys

import psycopg2

CLAVE_NUEVA = "48f7714adc9562b41cd448cafa67caa3a389d2ab1a5ccdf6"

def main():
    clave_db = os.environ["PGCLAVE"]
    conn = psycopg2.connect(
        host="vm-databases.tailb951ba.ts.net", port=5432, dbname="ggtov2",
        user="ggtov2_app", password=clave_db, sslmode="disable", connect_timeout=15)
    cur = conn.cursor()
    cur.execute("select clave, valor from configuracion where clave = 'mcp.api_key'")
    antes = cur.fetchone()
    print("ANTES:", antes)
    if input("¿Aplicar la nueva clave MCP? (escribe 'si'): ").strip().lower() != "si":
        print("Cancelado — nada escrito."); conn.close(); return
    cur.execute(
        "insert into configuracion (clave, valor, descripcion) values (%s, %s, %s) "
        "on conflict (clave) do update set valor = excluded.valor, actualizado_en = now()",
        ("mcp.api_key", json.dumps(CLAVE_NUEVA),
         "Clave X-MCP-Key del servidor MCP para el asistente-ggto (OpenRouter tools)"))
    cur.execute("select clave, valor from configuracion where clave = 'mcp.api_key'")
    print("DESPUES:", cur.fetchone())
    conn.commit()
    cur.close(); conn.close()
    print("OK")

if __name__ == "__main__":
    sys.exit(main())
