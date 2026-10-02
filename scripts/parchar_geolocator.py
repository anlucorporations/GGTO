#!/usr/bin/env python3
"""Re-aplica el parche de compatibilidad AGP 8 a los plugins Groovy legados.

Contexto (D-73)
---------------
Flutter 3.24 + Android Gradle Plugin 8.x rompen la compilación de la APK porque
ciertos plugins declaran, dentro de su bloque android{}:

    compileSdk flutter.compileSdkVersion
    minSdkVersion flutter.minSdkVersion

Con AGP 8 el delegado interno del closure android{} es la LibraryExtension, que ya
NO resuelve la propiedad `flutter` contra el proyecto → MissingPropertyException
durante la evaluación; compileSdk queda null y el listener global del FlutterPlugin
(`detectLowCompileSdkVersionOrNdkVersion`) hace `.substring(8)` sobre null.

Este script reescribe esas referencias en el cache local de pub por equivalentes
que sí resuelven con AGP 8: `project.android.compileSdkVersion` se sustituye por
el valor numérico que usa el proyecto :app (se lee de android/app/build.gradle),
manteniendo semántica idéntica sin tocar código propio versionado.

Es idempotente y NO forma parte del build: ejecútalo tras cada `flutter pub get`
que refresque ~/.pub-cache. Ver RepoTecnico/estado_proyecto.md (D-73).
"""

from __future__ import annotations

import argparse
import pathlib
import re
import sys

RAIZ = pathlib.Path(__file__).resolve().parents[1]
PLUGINS_FILE = RAIZ / "app_movil" / ".flutter-plugins"
APP_GRADLE = RAIZ / "app_movil" / "android" / "app" / "build.gradle"


def leer_valores_app() -> dict[str, int]:
    """Extrae compileSdk/minSdk/targetSdk declarados en el :app."""
    txt = APP_GRADLE.read_text(encoding="utf-8")

    def grab(patron: str) -> int | None:
        m = re.search(patron, txt)
        return int(m.group(1)) if m else None

    vals = {
        "compileSdk": grab(r"compileSdk\s*=\s*(\d+)"),
        "minSdk": grab(r"minSdk\s*=\s*(\d+)"),
        "targetSdk": grab(r"targetSdk\s*=\s*(\d+)"),
    }
    # Fallbacks seguros coherentes con el SDK instalado.
    vals["compileSdk"] = vals["compileSdk"] or 35
    vals["minSdk"] = vals["minSdk"] or 21
    vals["targetSdk"] = vals["targetSdk"] or 35
    return vals


def plugins_a_parchear() -> list[pathlib.Path]:
    if not PLUGINS_FILE.exists():
        return []
    rutas: list[pathlib.Path] = []
    for line in PLUGINS_FILE.read_text(encoding="utf-8").splitlines():
        if line.startswith("#") or "=" not in line:
            continue
        base = line.split("=", 1)[1].strip()
        bg = pathlib.Path(base) / "android" / "build.gradle"
        if bg.exists():
            rutas.append(bg)
    return rutas


def parchear(bg: pathlib.Path, vals: dict[str, int], aplicar: bool) -> list[str]:
    txt = bg.read_text(encoding="utf-8")
    original = txt
    cambios: list[str] = []
    sust = {
        r"\bflutter\.compileSdkVersion\b": str(vals["compileSdk"]),
        r"\bflutter\.minSdkVersion\b": str(vals["minSdk"]),
        r"\bflutter\.targetSdkVersion\b": str(vals["targetSdk"]),
    }
    for patron, valor in sust.items():
        nuevo = re.sub(patron, valor, txt)
        if nuevo != txt:
            n = len(re.findall(patron, txt))
            cambios.append(f"{patron.strip(chr(92)+'b')}→{valor} ({n})")
            txt = nuevo
    if txt != original and aplicar:
        bg.write_text(txt, encoding="utf-8")
    return cambios


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--aplicar", action="store_true", help="Escribe los cambios (por defecto simula)")
    args = p.parse_args()

    vals = leer_valores_app()
    print(f"[parchar] valores del :app → {vals}")
    total = 0
    for bg in plugins_a_parchear():
        cambios = parchear(bg, vals, args.aplicar)
        if cambios:
            total += 1
            marca = "PARCHADO" if args.aplicar else "a-parchear"
            print(f"  [{marca}] {bg.parent.name}: {'; '.join(cambios)}")
    if total == 0:
        print("[parchar] ningún plugin necesita parche (ya compatible o sin referencias).")
    elif not args.aplicar:
        print("[parchar] simulación: añade --aplicar para escribir.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
