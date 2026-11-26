"""Genera el base64 del cuerpo SCRIPT_PY del generador del Job."""
import base64
from pathlib import Path

texto = Path(__file__).parent.joinpath("job_borrar_guatire.py").read_text(encoding="utf-8")
inicio = texto.index("SCRIPT_PY = r'''") + len("SCRIPT_PY = r'''")
fin = texto.index("'''", inicio)
b64 = base64.b64encode(texto[inicio:fin].encode()).decode()
Path(__file__).parent.joinpath("_b64.txt").write_text(b64)
print("b64 len:", len(b64))
