"""Utilidades para el HTML que genera el servidor (H-06).

Los reportes imprimibles interpolan datos que escribe el usuario (nombres,
direcciones, problemas reportados, identificadores de pago, nombres de
cuadrilla). Todo valor dinámico debe pasar por `escapar` para que el navegador
lo trate como texto y nunca como marcado.
"""

from __future__ import annotations

from html import escape

#: Cabeceras de los documentos imprimibles.
#:
#: Sin scripts ni recursos externos: aunque un valor se colara sin escapar, el
#: navegador no ejecutaría JavaScript. `X-Content-Type-Options` impide que el
#: documento se interprete como otro tipo.
CABECERAS_IMPRIMIBLE = {
    "Content-Security-Policy": (
        "default-src 'none'; style-src 'unsafe-inline'; img-src data:; "
        "base-uri 'none'; form-action 'none'"
    ),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
}


def escapar(valor: object, defecto: str = "—") -> str:
    """Escapa un valor para usarlo como texto o dentro de un atributo HTML.

    Las comillas también se escapan, de modo que el resultado sirve tanto para
    el contenido de una celda como para `title="…"` o `value="…"`.
    """
    if valor is None or valor == "":
        return defecto
    return escape(str(valor), quote=True)
