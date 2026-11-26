"""Repara cordis.patch.yml del perfil web: elimina el bloque google duplicado
que añadió aplicar-up-dsh.mjs y mete los modelos UP en el bloque google original."""
from pathlib import Path

RUTA = Path("/home/lucci/.dsh/profiles/web/cordis.patch.yml")
UPS = [
    "gemini-3.1-flash-lite",
    "gemini-3.1-flash-lite-preview",
    "gemini-flash-lite-latest",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
]

lineas = RUTA.read_text(encoding="utf-8").splitlines()

# 1) eliminar el bloque duplicado (comentario → antes de '- id: agent-default-model')
i = next(n for n, l in enumerate(lineas) if l.strip().startswith("# --- google: añadido"))
j = next(n for n, l in enumerate(lineas) if l.startswith("- id: agent-default-model"))
del lineas[i:j]

# 2) insertar models: con los UP tras el apiKeyEnv del bloque google original
k = next(n for n, l in enumerate(lineas) if l.strip() == 'apiKeyEnv: "GEMINI_API_KEY"')
ins = ["        models:"] + [f"          - id: {u}" for u in UPS]
lineas[k + 1:k + 1] = ins

RUTA.write_text("\n".join(lineas) + "\n", encoding="utf-8")
print("ok, lineas:", len(lineas))
