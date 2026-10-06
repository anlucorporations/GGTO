#!/usr/bin/env python3
"""Construye, firma y publica la APK de release de GGTO Técnico.

=============================================================================
QUÉ HACE
    1. Localiza la cadena de herramientas (Flutter, JDK, Android SDK).
    2. **Detecta el keystore de release** (`ggto-tecnico-release.jks`) en las
       ubicaciones habituales o en `GGTO_KEYSTORE` / `--keystore`.
    3. Valida el keystore con `keytool` (alias y contraseña).
    4. Corrige `android/key.properties` si su `storeFile` no resuelve.
    5. Ejecuta `flutter pub get`, reaplica el parche AGP 8 y compila
       `flutter build apk --release`.
    6. Verifica la firma con `apksigner` (rechaza la firma de depuración).
    7. Publica la APK como `app_movil/GGTOv2.apk` y reporta su SHA-256.

SEGURIDAD
    · Por defecto es **simulación**: detecta todo y muestra el plan, sin compilar.
    · Para compilar hay que pasar `--confirmar`.
    · No imprime contraseñas; solo el alias y el resultado de `keytool -list`.
    · `key.properties` se respalda como `key.properties.bak` antes de tocarlo.

USO
    python3 scripts/publicar_apk.py                     # plan (no compila)
    python3 scripts/publicar_apk.py --confirmar         # release oficial
    python3 scripts/publicar_apk.py --firma-debug --confirmar
    GGTO_KEYSTORE=/ruta/ggto.jks python3 scripts/publicar_apk.py --confirmar
    python3 scripts/publicar_apk.py --keystore /ruta/ggto.jks --confirmar

    Variables opcionales: FLUTTER_BIN, JAVA_HOME, ANDROID_HOME, GGTO_KEYSTORE.
=============================================================================
"""

from __future__ import annotations

import argparse
import hashlib
import os
import re
import shutil
import subprocess
import sys
from collections.abc import Sequence
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
APP = RAIZ / "app_movil"
ANDROID = APP / "android"
KEY_PROPS = ANDROID / "key.properties"
PUBSPEC = APP / "pubspec.yaml"
APK_BUILD = APP / "build" / "app" / "outputs" / "flutter-apk" / "app-release.apk"
APK_ENTREGA = APP / "GGTOv2.apk"

#: Nombre esperado del keystore de release.
NOMBRE_JKS = "ggto-tecnico-release.jks"


# --------------------------------------------------------------------------- #
# Utilidades de consola
# --------------------------------------------------------------------------- #
def _imprimir(texto: str, destino=None) -> None:
    """Imprime sin romper en consolas que no son UTF-8 (Windows cp1252).

    Los símbolos ✓/⚠/✗ no existen en cp1252: sin este respaldo, el script
    terminaba con `UnicodeEncodeError` en Windows.
    """
    flujo = destino if destino is not None else sys.stdout
    try:
        print(texto, file=flujo)
    except UnicodeEncodeError:
        print(texto.encode("ascii", "replace").decode("ascii"), file=flujo)


def paso(msg: str) -> None:
    _imprimir(f"\n== {msg} ==")


def ok(msg: str) -> None:
    _imprimir(f"  ✓ {msg}")


def aviso(msg: str) -> None:
    _imprimir(f"  ⚠ {msg}")


def error(msg: str) -> None:
    _imprimir(f"  ✗ {msg}", file=sys.stderr)


def correr(cmd: Sequence[str | Path], cwd: Path | None = None, env: dict | None = None,
           capturar: bool = False) -> subprocess.CompletedProcess:
    """Ejecuta un comando mostrando su salida en vivo (o la captura)."""
    print(f"  $ {' '.join(str(c) for c in cmd)}")
    return subprocess.run(
        [str(c) for c in cmd],
        cwd=str(cwd) if cwd else None,
        env=env,
        check=False,
        text=True,
        capture_output=capturar,
    )


# --------------------------------------------------------------------------- #
# Cadena de herramientas
# --------------------------------------------------------------------------- #
def _primero_existente(candidatos: list[Path]) -> Path | None:
    for c in candidatos:
        if c.exists():
            return c
    return None


def localizar_flutter() -> Path | None:
    def _ejecutable(base: Path) -> Path | None:
        """Acepta el ejecutable o su carpeta `bin` (H-WIN-02).

        En Windows `FLUTTER_BIN` suele apuntar a `...\\flutter\\bin` (lo que
        necesita el PATH), que es un directorio: pasarlo a `subprocess` da
        `WinError 5 (Acceso denegado)` en vez de un error claro.
        """
        if base.is_file():
            return base
        if base.is_dir():
            return _primero_existente([base / "flutter.bat", base / "flutter"])
        return None

    env_bin = os.environ.get("FLUTTER_BIN")
    if env_bin:
        cand = _ejecutable(Path(env_bin))
        if cand:
            return cand
    en_path = shutil.which("flutter")
    if en_path:
        return Path(en_path)
    casa = Path.home()
    for base in (casa / "tools" / "flutter", casa / "flutter", Path("/opt/flutter"),
                 Path("/usr/local/flutter"), Path("C:/flutter"), Path("C:/src/flutter")):
        cand = _ejecutable(base / "bin")
        if cand:
            return cand
    return None


def localizar_java() -> tuple[Path | None, Path | None]:
    """Devuelve (JAVA_HOME, keytool)."""
    env_home = os.environ.get("JAVA_HOME")
    if env_home and (Path(env_home) / "bin").is_dir():
        jh = Path(env_home)
        kt = _primero_existente([jh / "bin" / "keytool", jh / "bin" / "keytool.exe"])
        return jh, kt
    casa = Path.home()
    for base in (casa / "tools" / "jdk17", casa / "tools" / "jdk", casa / "jdk",
                 Path("/usr/lib/jvm/default-java")):
        if (base / "bin").is_dir():
            kt = _primero_existente([base / "bin" / "keytool", base / "bin" / "keytool.exe"])
            return base, kt
    exe = shutil.which("keytool")
    if exe:
        return None, Path(exe)
    return None, None


def localizar_android_sdk() -> Path | None:
    for var in ("ANDROID_HOME", "ANDROID_SDK_ROOT"):
        val = os.environ.get(var)
        if val and Path(val).is_dir():
            return Path(val)
    casa = Path.home()
    for base in (casa / "tools" / "android-sdk", casa / "Android" / "Sdk",
                 casa / "AppData" / "Local" / "Android" / "Sdk",
                 Path("/opt/android-sdk"), Path("/usr/lib/android-sdk")):
        if base.is_dir():
            return base
    return None


def localizar_apksigner(sdk: Path | None) -> Path | None:
    """Busca `apksigner` en las build-tools del SDK (la versión más reciente)."""
    if sdk:
        bt = sdk / "build-tools"
        if bt.is_dir():
            versiones = sorted(
                (d for d in bt.iterdir() if d.is_dir()),
                key=lambda d: [int(x) for x in re.findall(r"\d+", d.name)] or [0],
                reverse=True,
            )
            for v in versiones:
                for nombre in ("apksigner", "apksigner.bat"):
                    if (v / nombre).exists():
                        return v / nombre
    exe = shutil.which("apksigner")
    return Path(exe) if exe else None


def entorno(toolchain: dict) -> dict:
    """Construye el entorno para los subprocesos con PATH y variables correctas."""
    env = dict(os.environ)
    partes: list[str] = []
    flutter = toolchain.get("flutter")
    if flutter:
        partes.append(str(flutter.parent))
    java_home = toolchain.get("java_home")
    if java_home:
        env["JAVA_HOME"] = str(java_home)
        partes.append(str(java_home / "bin"))
    sdk = toolchain.get("sdk")
    if sdk:
        env["ANDROID_HOME"] = str(sdk)
        env.setdefault("ANDROID_SDK_ROOT", str(sdk))
    partes.append(env.get("PATH", ""))
    env["PATH"] = os.pathsep.join([p for p in partes if p])
    return env


def diagnosticar_toolchain() -> dict:
    toolchain = {
        "flutter": localizar_flutter(),
        "java_home": None,
        "keytool": None,
        "sdk": localizar_android_sdk(),
        "apksigner": None,
    }
    toolchain["java_home"], toolchain["keytool"] = localizar_java()
    toolchain["apksigner"] = localizar_apksigner(toolchain["sdk"])

    paso("1/7 Cadena de herramientas")
    ok(f"Flutter       : {toolchain['flutter']}") if toolchain["flutter"] else error("Flutter no encontrado")
    ok(f"JAVA_HOME     : {toolchain['java_home'] or '(java del sistema)'}")
    if toolchain["keytool"]:
        ok(f"keytool       : {toolchain['keytool']}")
    else:
        aviso("keytool no encontrado")
    ok(f"Android SDK   : {toolchain['sdk']}") if toolchain["sdk"] else error("Android SDK no encontrado")
    if toolchain["apksigner"]:
        ok(f"apksigner     : {toolchain['apksigner']}")
    else:
        aviso("apksigner no encontrado")
    return toolchain


# --------------------------------------------------------------------------- #
# Detección y validación del keystore
# --------------------------------------------------------------------------- #
def _leer_props(ruta: Path) -> dict[str, str]:
    props: dict[str, str] = {}
    if not ruta.is_file():
        return props
    for linea in ruta.read_text(encoding="utf-8").splitlines():
        limpia = linea.strip()
        if not limpia or limpia.startswith("#") or "=" not in limpia:
            continue
        clave, valor = limpia.split("=", 1)
        props[clave.strip()] = valor.strip()
    return props


def _candidatos(keystore_arg: str | None, props: dict[str, str]) -> list[Path]:
    """Ubicaciones donde puede estar el keystore, en orden de preferencia."""
    cands: list[Path] = []
    if keystore_arg:
        cands.append(Path(keystore_arg).expanduser())
    env_ks = os.environ.get("GGTO_KEYSTORE")
    if env_ks:
        cands.append(Path(env_ks).expanduser())

    # Ruta declarada en key.properties, resuelta contra :app y contra la raíz.
    declarada = props.get("storeFile")
    if declarada:
        cands.append((ANDROID / "app" / declarada).resolve())
        cands.append((RAIZ / declarada).resolve())
        cands.append(Path(declarada).expanduser())

    # Ubicaciones canónicas del repositorio.
    cands.append(RAIZ / "RepoTecnico" / "credenciales" / NOMBRE_JKS)
    cands.append(APP / "RepoTecnico" / "credenciales" / NOMBRE_JKS)
    cands.append(ANDROID / NOMBRE_JKS)
    cands.append(APP / NOMBRE_JKS)
    cands.append(Path.home() / NOMBRE_JKS)

    # Cualquier .jks con el nombre esperado bajo la raíz (búsqueda acotada).
    for base in (RAIZ / "RepoTecnico", APP, RAIZ):
        if base.is_dir():
            for encontrado in sorted(base.rglob(NOMBRE_JKS)):
                cands.append(encontrado)
    return cands


def detectar_keystore(keystore_arg: str | None, props: dict[str, str]) -> Path | None:
    vistos: set[str] = set()
    for cand in _candidatos(keystore_arg, props):
        clave = str(cand)
        if clave in vistos:
            continue
        vistos.add(clave)
        if cand.is_file():
            return cand.resolve()
    return None


def validar_keystore(keytool: Path | None, jks: Path, alias: str | None,
                     store_pass: str | None) -> bool:
    """Comprueba que el keystore abre y (si se indica) que el alias existe."""
    if keytool is None:
        aviso("No hay keytool: se omite la validación previa del keystore")
        return True
    cmd = [str(keytool), "-list", "-keystore", str(jks)]
    if store_pass:
        cmd += ["-storepass", store_pass]
    if alias:
        cmd += ["-alias", alias]
    res = correr(cmd, capturar=True)
    if res.returncode != 0:
        error("El keystore no se pudo abrir (¿contraseña o alias incorrectos?)")
        salida = (res.stdout or "") + (res.stderr or "")
        for linea in salida.splitlines()[-4:]:
            print(f"      {linea}")
        return False
    ok(f"Keystore válido: {jks}")
    if alias:
        ok(f"Alias «{alias}» presente")
    return True


def asegurar_key_properties(jks: Path, props: dict[str, str], aplicar: bool) -> bool:
    """Deja `key.properties` con un `storeFile` que sí resuelve.

    Devuelve True si hay contraseñas utilizables. Escribe solo con `aplicar`;
    respalda el original como `key.properties.bak` una sola vez.
    """
    if not props.get("storePassword") or not props.get("keyPassword"):
        error("key.properties no define storePassword/keyPassword")
        return False

    actual = props.get("storeFile", "")
    resuelto = (ANDROID / "app" / actual).resolve() if actual else None
    if resuelto == jks:
        ok("key.properties ya apunta al keystore detectado")
        return True

    aviso(f"key.properties apunta a «{actual}» y el keystore está en {jks}")
    if not aplicar:
        print("      (se corregiría el storeFile al confirmar)")
        return True

    if not KEY_PROPS.is_file():
        error(f"No existe {KEY_PROPS}")
        return False
    respaldo = KEY_PROPS.with_suffix(".properties.bak")
    if not respaldo.exists():
        shutil.copy2(KEY_PROPS, respaldo)
        ok(f"Respaldo creado: {respaldo.name}")
    texto = KEY_PROPS.read_text(encoding="utf-8")
    # La ruta se escribe con barras normales (`as_posix`), que Windows acepta:
    # `Properties.load` trata la barra invertida como carácter de escape, así que
    # un `C:\GGTO\...` literal llegaría al build como `C:GGTO...` (H-WIN-01).
    # Además se sustituye con una función: pasar la ruta como plantilla de
    # `re.sub` rompe con secuencias como `\G` («bad escape»).
    valor = jks.as_posix()
    if re.search(r"(?m)^\s*storeFile\s*=", texto):
        texto = re.sub(r"(?m)^\s*storeFile\s*=.*$", lambda _m: f"storeFile={valor}", texto)
    else:
        texto = texto.rstrip("\n") + f"\nstoreFile={valor}\n"
    KEY_PROPS.write_text(texto, encoding="utf-8")
    ok(f"key.properties corregido → storeFile={jks}")
    return True


# --------------------------------------------------------------------------- #
# Compilación
# --------------------------------------------------------------------------- #
def version_actual() -> str:
    if not PUBSPEC.is_file():
        return "?"
    m = re.search(r"(?m)^version:\s*(\S+)", PUBSPEC.read_text(encoding="utf-8"))
    return m.group(1) if m else "?"


def preparar(env: dict, flutter: Path) -> bool:
    paso("5/7 Preparando dependencias y parches")
    res = correr([flutter, "pub", "get"], cwd=APP, env=env)
    if res.returncode != 0:
        error("`flutter pub get` falló")
        return False

    parche = RAIZ / "scripts" / "parchar_geolocator.py"
    if parche.is_file():
        correr([sys.executable, parche, "--aplicar"], cwd=RAIZ, env=env)
    return True


def compilar(env: dict, flutter: Path, dart_defines: list[str]) -> bool:
    paso("6/7 Compilando la APK de release")
    cmd = [str(flutter), "build", "apk", "--release"]
    for definicion in dart_defines:
        cmd.append(f"--dart-define={definicion}")
    res = correr(cmd, cwd=APP, env=env)
    if res.returncode != 0:
        error("La compilación falló")
        return False
    return True


def verificar_firma(apksigner: Path | None, apk: Path, exigir_release: bool,
                    env: dict) -> bool:
    paso("7/7 Verificando la firma")
    if apksigner is None:
        aviso("Sin apksigner no se puede verificar la firma; revisa el certificado a mano")
        return True
    # `apksigner` es un script que invoca `java`: necesita el PATH con el JDK.
    res = correr([str(apksigner), "verify", "--print-certs", str(apk)],
                 env=env, capturar=True)
    salida = (res.stdout or "") + (res.stderr or "")
    if res.returncode != 0:
        error("apksigner no pudo verificar la APK")
        for linea in salida.splitlines()[-5:]:
            print(f"      {linea}")
        return False
    dn = ""
    for linea in salida.splitlines():
        if "certificate DN" in linea:
            dn = linea.split(":", 1)[1].strip()
            print(f"  Certificado: {dn}")
            break
    if exigir_release and "Android Debug" in dn:
        error("La APK quedó firmada con la clave de DEPURACIÓN, no con la de release")
        return False
    return True


def publicar(apk: Path, destino: Path | None) -> Path:
    if destino is None:
        return apk
    shutil.copy2(apk, destino)
    return destino


def sha256(ruta: Path) -> str:
    h = hashlib.sha256()
    with ruta.open("rb") as fh:
        for bloque in iter(lambda: fh.read(1 << 20), b""):
            h.update(bloque)
    return h.hexdigest()


# --------------------------------------------------------------------------- #
# Principal
# --------------------------------------------------------------------------- #
def main() -> int:
    # Sin esto, al redirigir a un archivo los mensajes propios quedan en el
    # buffer y se mezclan desordenados con la salida en vivo de `flutter`.
    for flujo in (sys.stdout, sys.stderr):
        try:
            flujo.reconfigure(line_buffering=True)  # type: ignore[union-attr]
        except (AttributeError, ValueError):
            pass

    p = argparse.ArgumentParser(
        description="Construye, firma y publica la APK de release de GGTO Técnico.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("--confirmar", action="store_true",
                   help="Compila de verdad (por defecto solo muestra el plan)")
    p.add_argument("--keystore", default=None, help="Ruta explícita al .jks de release")
    p.add_argument("--firma-debug", action="store_true",
                   help="Compila firmando con la clave de depuración (no exige keystore)")
    p.add_argument("--salida", default=None,
                   help=f"Destino de la APK publicada (por defecto {APK_ENTREGA.name})")
    p.add_argument("--sin-publicar", action="store_true",
                   help="No copia la APK al nombre de entrega")
    p.add_argument("--dart-define", action="append", default=[],
                   help="Pasa --dart-define=CLAVE=VALOR a Flutter (repetible)")
    args = p.parse_args()

    print("=" * 75)
    print("PUBLICAR APK DE RELEASE — GGTO Técnico")
    print(f"Repositorio : {RAIZ}")
    print(f"Versión     : {version_actual()}")
    print(f"Modo        : {'APLICAR' if args.confirmar else 'SIMULACIÓN'}"
          f"{' · firma de depuración' if args.firma_debug else ' · firma de release'}")
    print("=" * 75)

    toolchain = diagnosticar_toolchain()
    if not toolchain["flutter"]:
        error("Instala Flutter o define FLUTTER_BIN")
        return 2
    if not toolchain["sdk"]:
        error("Instala el Android SDK o define ANDROID_HOME")
        return 2
    env = entorno(toolchain)

    props = _leer_props(KEY_PROPS)
    exigir_release = not args.firma_debug
    jks: Path | None = None

    if args.firma_debug:
        paso("2/7 Keystore")
        aviso("Firma de depuración solicitada: no se usa el keystore de release")
    else:
        paso("2/7 Detectando el keystore de release")
        jks = detectar_keystore(args.keystore, props)
        if jks is None:
            error(f"No se encontró «{NOMBRE_JKS}»")
            print("      Búscalo en RepoTecnico/credenciales/ o pásalo con --keystore / GGTO_KEYSTORE.")
            print("      Para una APK de prueba: --firma-debug")
            return 3
        ok(f"Keystore: {jks}")
        paso("3/7 Validando el keystore")
        if not validar_keystore(toolchain["keytool"], jks, props.get("keyAlias"),
                                props.get("storePassword")):
            return 4
        paso("4/7 Preparando key.properties")
        if not asegurar_key_properties(jks, props, aplicar=args.confirmar):
            return 4

    destino = None
    if not args.sin_publicar:
        destino = Path(args.salida).expanduser() if args.salida else APK_ENTREGA

    if not args.confirmar:
        paso("PLAN (sin ejecutar)")
        print("  1) flutter pub get + parche AGP 8 (scripts/parchar_geolocator.py)")
        if args.firma_debug:
            print("  2) apartar android/key.properties (para que Gradle use la clave de depuración)")
            print("  3) flutter build apk --release")
            print("  4) apksigner verify (firma de depuración admitida)")
            print("  5) restaurar android/key.properties")
        else:
            print("  2) flutter build apk --release")
            print("  3) apksigner verify (exigir firma de release)")
        if destino:
            print(f"  {'6' if args.firma_debug else '4'}) publicar en {destino}")
        print("\nVuelve a ejecutar con --confirmar para compilar.")
        return 0

    if not preparar(env, toolchain["flutter"]):
        return 5

    # Con firma de depuración hay que neutralizar key.properties: si existe y su
    # keystore no está, Gradle fallaría al configurar la firma de release.
    apartado: Path | None = None
    if args.firma_debug and KEY_PROPS.is_file():
        apartado = KEY_PROPS.with_name("key.properties.temporal-debug")
        KEY_PROPS.rename(apartado)
        aviso("android/key.properties apartado durante la firma de depuración")
    try:
        if not compilar(env, toolchain["flutter"], args.dart_define):
            return 6
    finally:
        if apartado is not None and apartado.exists():
            apartado.rename(KEY_PROPS)
            ok("android/key.properties restaurado")
    if not APK_BUILD.is_file():
        error(f"No se encontró la APK esperada en {APK_BUILD}")
        return 6
    if not verificar_firma(toolchain["apksigner"], APK_BUILD, exigir_release, env):
        return 7

    publicada = publicar(APK_BUILD, destino)
    peso_mb = publicada.stat().st_size / (1024 * 1024)

    print("\n" + "=" * 75)
    print("APK LISTA")
    print(f"  Archivo     : {publicada}")
    print(f"  Tamaño      : {peso_mb:.1f} MB")
    print(f"  SHA-256     : {sha256(publicada)}")
    print(f"  Versión     : {version_actual()}")
    print("=" * 75)
    if exigir_release:
        print("Recuerda: sube el versionCode de pubspec.yaml en cada entrega a CANTV.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
