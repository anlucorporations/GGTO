"""Crea la actividad de MANTENIMIENTO por FAT a partir de RepoTecnico/MANTENIMIENTO.

Cada archivo de la carpeta describe las ONTs atenuadas de una FAT (OLT de
Prados del Este): se registra **un caso `MANTENIMIENTO` por FAT** (D-161) con:

- solicitante ANGEL LUCCI · GGTO (id_solicitante 13);
- `id_pago` marcador temporal `70XXXXXXXX` (corregir a mano);
- dirección representativa del edificio predominante de la FAT;
- detalle completo (OLT, slot/puerto, serials, RX ONT/OLT, direcciones) en
  `informacion` y `problema_reporte`.

Reporte: RepoTecnico/MANTENIMIENTO/_reporte_carga_mantenimiento.json
"""

from __future__ import annotations

import json
import sys
import unicodedata
from pathlib import Path

import requests

BASE = "https://ggto-web-695669822281.europe-west1.run.app/api/v1"
P00, CLAVE = "123456", "KeLuDa.2324"
ID_SOLICITANTE = 13
CONTACTO = "04120358824"
ID_CENTRAL = 1

RAIZ = Path(__file__).resolve().parents[1]
DATOS = RAIZ / "RepoTecnico" / "MANTENIMIENTO" / "_fat_extraidos.json"
REPORTE = RAIZ / "RepoTecnico" / "MANTENIMIENTO" / "_reporte_carga_mantenimiento.json"


def normalizar(texto: str | None) -> str:
    if not texto:
        return ""
    sin_tildes = "".join(
        c for c in unicodedata.normalize("NFD", str(texto).upper())
        if unicodedata.category(c) != "Mn"
    )
    return " ".join(sin_tildes.split())


def principal() -> int:
    sesion = requests.Session()
    sesion.headers["Content-Type"] = "application/json"
    respuesta = sesion.post(f"{BASE}/auth/login", json={"p00": P00, "clave": CLAVE}, timeout=30)
    respuesta.raise_for_status()
    sesion.headers["Authorization"] = f"Bearer {respuesta.json()['access_token']}"

    patrones = [
        (s["id_sector"], s["nombre"], normalizar(p["patron"]))
        for s in sesion.get(f"{BASE}/sectores", timeout=30).json()
        if s["id_central"] == ID_CENTRAL and s.get("activo")
        for p in (s.get("direcciones") or [])
        if p.get("activo", True)
    ]

    def sector_de(direccion: str) -> tuple[int, str] | None:
        clave = normalizar(direccion)
        if not clave:
            return None
        # la dirección más específica gana: patrón más largo primero
        for id_sector, nombre, patron in sorted(patrones, key=lambda x: -len(x[2])):
            if patron and patron in clave:
                return id_sector, nombre
        return None

    fats = json.loads(DATOS.read_text(encoding="utf-8"))
    creados, fallidos = [], []
    for indice, f in enumerate(fats, start=1):
        # Edificio predominante: la dirección más repetida de la FAT.
        from collections import Counter
        direcciones = [o["direccion"] for o in f["onts"] if o["direccion"]]
        base = Counter(direcciones).most_common(1)[0][0] if direcciones else f["olt"]
        hallado = sector_de(base)
        seriales = "; ".join(
            f"{o['serial']} {o['modelo'] or ''} ONT-id {o['ont_id'] or '-'} "
            f"RX-ONT {o['rx_ont'] or '-'} / RX-OLT {o['rx_olt'] or '-'} · {o['direccion'] or 'SIN DIRECCION'}"
            for o in f["onts"]
        )
        cuerpo = {
            "id_central": ID_CENTRAL,
            "tipo_reporte": "MANTENIMIENTO",
            "categoria": "RESIDENCIAL",
            "id_solicitante": ID_SOLICITANTE,
            "nombre_cliente": f"MANTENIMIENTO {f['fat']} · {f['olt_nombre']} ({f['tipo']})",
            "contacto_cliente": CONTACTO,
            "id_pago": f"70{9000 + indice:08d}",
            "direccion": base,
            "persona_reporta": "ANGEL LUCCI · GGTO",
            "problema_reporte": (
                f"Actividad de mantenimiento preventivo por ONTs atenuadas. "
                f"OLT {f['olt']} · slot {f['slot']} / puerto {f['puerto']} · "
                f"{f['fat']} · {f['total_onts']} ONTs atenuadas "
                f"(RX-ONT -20 a -33 dBm / RX-OLT -29 a -31 dBm). "
                f"Origen: {f['archivo']}."
            ),
            "informacion": (
                f"MANTENIMIENTO FAT {f['fat']} · OLT {f['olt']} · slot/puerto "
                f"{f['slot']}/{f['puerto']} · {f['total_onts']} ONTs:\n" + seriales
            )[:3900],
        }
        if hallado:
            cuerpo["id_sector"] = hallado[0]
            sector_esperado = hallado[1]
        else:
            sector_esperado = None

        resp = sesion.post(f"{BASE}/casos", json=cuerpo, timeout=60)
        if resp.status_code >= 300:
            fallidos.append({
                "fat": f["fat"], "archivo": f["archivo"], "status": resp.status_code,
                "error": resp.text[:300],
            })
            print(f"  {f['fat']}: ERROR {resp.status_code} {resp.text[:120]}")
            continue
        datos = resp.json()
        creados.append({
            "fat": f["fat"], "archivo": f["archivo"], "olt": f["olt"],
            "slot_puerto": f"{f['slot']}/{f['puerto']}",
            "onts": f["total_onts"], "direccion_base": base,
            "id_caso": datos.get("id_caso"), "id_averia": datos.get("id_averia"),
            "sector": datos.get("sector_nombre") or sector_esperado,
            "estado": datos.get("estado_actual"),
        })
        print(f"  {f['fat']}: caso #{datos.get('id_caso')} ({datos.get('id_averia')}) "
              f"sector {datos.get('sector_nombre')} · {f['total_onts']} ONTs")

    REPORTE.write_text(
        json.dumps({"creados": creados, "fallidos": fallidos}, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
    print(f"\nCreados: {len(creados)} · Fallidos: {len(fallidos)}\nReporte: {REPORTE}")
    return 0 if not fallidos else 1


if __name__ == "__main__":
    sys.exit(principal())
