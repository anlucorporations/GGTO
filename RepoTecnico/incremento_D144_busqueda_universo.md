# Incremento D-144 — Búsqueda en todo el universo y filtro por CERRADOS

| Campo | Valor |
|---|---|
| Petición | «modifica en la WEB/APK para que la búsqueda por texto libre se aplique a todo el universo de casos (abiertos, cerrados, etc.); también incorpora en la selección de estados el poder filtrar por casos CERRADOS» |
| Fecha | 2026-10-21 |
| Alcance | Backend + web + APK · **`1.15.16+41`** publicada · despliegue **v76** |
| Autor | Dirección del proyecto |

---

## 1. El defecto

- **Web (CASOS)**: el listado enviaba `solo_abiertos=true` **siempre**, así que un
  caso cerrado no aparecía ni buscándolo por su avería, su teléfono o su nombre; y
  el selector **Estado** no ofrecía `CERRADO` ni `CANCELADO`, de modo que no había
  forma de listar el trabajo resuelto.
- **APK**: la consulta local sí buscaba en toda la caché, pero el listado volvía a
  **ocultar** los casos gestionados (D-101) aunque la búsqueda los hubiera
  encontrado, y no existía un filtro de estado.
- **Backend**: el texto libre del listado (`/casos`) no buscaba el número de
  **contacto** (solo el identificador de pago), y el contacto está normalizado
  (`+58…`), así que escribir el número local no encontraba nada.

---

## 2. Corrección

### 2.1 Web — CASOS

| Antes | Ahora |
|---|---|
| `solo_abiertos: true` siempre | `solo_abiertos` solo cuando **no** hay texto de búsqueda **ni** estado elegido |
| Selector sin estados resueltos | Selector con **CERRADO** y **CANCELADO** |
| Sin aviso del alcance | Aviso: «Buscando en todo el universo: se incluyen casos cerrados y cancelados» o «Filtrando por estado X…» |

El comportamiento por defecto se conserva (RN-AL-02: la sección lista trabajo
abierto).

### 2.2 Backend — texto libre más útil

- `GET /casos?q=` busca también `contacto_cliente`.
- Si el término es un número de teléfono (≥ 7 dígitos), se busca **además** sin los
  ceros iniciales: escribir `04147770002` encuentra el contacto guardado como
  `+584147770002`.

### 2.3 APK — búsqueda en todo el universo + filtro de estado

- `casosVisiblesDe(...)` (función **pura**): con texto de búsqueda devuelve **todo**
  el universo (abiertos, cerrados, cancelados) y gana un parámetro
  `filtroEstado` (`TODOS` / `ABIERTOS` / `CERRADOS`).
- `CasosProvider`: `filtroEstado`, `cambiarFiltroEstado(...)` y el conteo
  `cerrados`.
- Pantalla de casos: fila de chips **Todos · Abiertos · Cerrados** (con el chip de
  «Resueltos» de D-105 al lado).
- La búsqueda local añade `problema_reporte` y `estado_actual` a los campos: se
  puede encontrar un caso escribiendo «cerrado».

---

## 3. Verificación

| Comprobación | Resultado |
|---|---|
| Backend (suite completa) | **520/520 en verde** (4 nuevas de D-144) |
| Pruebas nuevas (backend) | el texto libre encuentra un caso **cerrado**; el filtro `estado_actual=CERRADO` devuelve solo cerrados; el texto libre busca el **contacto** en formato local; sin búsqueda ni estado el listado sigue siendo solo abierto |
| APK | **274/274 en verde** (7 nuevas de D-144), `flutter analyze` sin hallazgos |
| Web | `tsc --noEmit` y `npm run build` limpios |
| Producción (v76) | `q=TEST-APK` → **4** casos (2 cerrados); `estado_actual=CERRADO` → **61**; el bundle desplegado incluye CERRADO/CANCELADO y los avisos |

---

## 4. Cambios por archivo

| Archivo | Cambio |
|---|---|
| `app/web/src/pages/Casos.tsx` | `solo_abiertos` condicional, estados CERRADO/CANCELADO y aviso del alcance. |
| `app/api/routes_casos.py` | `q` busca `contacto_cliente` (con variante sin ceros). |
| `app/tests/test_d144_busqueda_universo.py` | **Nuevo**: 4 pruebas. |
| `app_movil/lib/features/casos/acciones_caso.dart` | `casosVisiblesDe(..., filtroEstado, consulta)` + constantes y opciones. |
| `app_movil/lib/features/casos/casos_provider.dart` | Filtro de estado, `cerrados` y búsqueda sobre todo el universo. |
| `app_movil/lib/features/casos/casos_screen.dart` | Chips Todos/Abiertos/Cerrados. |
| `app_movil/lib/core/database.dart` | La búsqueda local cubre problema y estado. |
| `app_movil/test/d144_busqueda_universo_test.dart` | **Nuevo**: 7 pruebas. |
| `app_movil/pubspec.yaml`, `core/constants.dart` | Versión **1.15.16+41**. |

---

## 5. Nota operativa

Los casos **cerrados por la oficina** siguen sin llegar al teléfono (la descarga es
el trabajo vigente de la cuadrilla); la búsqueda del APK cubre todo lo que el
dispositivo tiene. Si quieres que la APK descargue también los cerrados recientes
(p. ej. los últimos 7 días de la cuadrilla) para consultarlos sin conexión, es un
cambio aparte en `/sync/descarga` que puedo hacer cuando lo indiques.
