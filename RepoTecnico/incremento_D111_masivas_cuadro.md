# Incremento D-111 — Cuadro de MASIVAS con el estilo de CASOS, indicadores y acciones con icono

| Campo | Valor |
|---|---|
| Petición | 1) mostrar el **cuadro de las MASIVAS** con el **estilo de CASOS** · 2) **columna con iconos** de **Planificación, Materiales y Asignación** (encendidos o apagados) · 3) **columna de acciones como iconos** · 4) **eliminar el texto de explicación de la sección**. En la **web** y en la **APK** |
| Fecha | 2026-10-17 |
| Alcance | Web (`pages/Masivas.tsx` + `masivas/*` + `styles.css`) · APK (`features/masivas/*`) · sin cambios de API ni de esquema |
| Autor | Dirección del proyecto |

---

## 1. Punto 1 — El cuadro de las masivas, con el estilo de CASOS

La sección abría en la pestaña **Búsqueda automática** y el listado solo aparecía dentro de
**Gestionar** y **Histórico**: al entrar no se veía ningún cuadro. Ahora, **encima de las pestañas**,
la página muestra siempre el **cuadro de las masivas**:

| Columna | Contenido |
|---|---|
| **ID masiva** | `id_falla` en monoespaciada |
| **Estado** | chip con el color de D-99 (CERRADA/ATENDIDA verde, DETECTADA rojo) y, debajo, el **origen** |
| **Sector** | nombre del sector y, debajo, la dirección corta |
| **Casos** | casos asociados |
| **Detección** | fecha y hora de detección |
| **Indicadores** | los tres iconos del punto 2 |
| **Acciones** | los cuatro iconos del punto 3 |

El estilo es el de **CASOS** (D-103): mismo `panel-bloque` con su `h2`, mismo `tabla-envoltura` +
`tabla-resumen`, **filas clicables** (`fila-clicable`, con `Enter`/`Espacio` y `focus-visible`) que
abren la ficha, y **pie con el total** (`PieTabla`). Archivos nuevos:

- `app/web/src/masivas/CuadroMasivas.tsx` — el cuadro completo.
- `app/web/src/masivas/CeldaIndicadores.tsx` — la columna de indicadores.
- `app/web/src/masivas/AccionesMasiva.tsx` — el botón de icono con nombre accesible.
- `app/web/src/masivas/estado.ts` — el color del estado, compartido con las tablas.

Se conservan las **siete pestañas** de D-99 (y sus cuadros de Gestionar, Generar reporte e
Histórico), que ahora **también** llevan la columna de indicadores y las acciones con icono.

---

## 2. Punto 2 — Columna INDICADORES (Planificación · Materiales · Asignación)

Una sola columna con **tres iconos** por masiva. **Encendido** = la masiva ya lo tiene (tinta de marca
sobre fondo claro); **apagado** = todavía no (gris, borde punteado). Las reglas son puras y salen de
los campos que ya entrega el listado:

| Indicador | Se enciende cuando… | Campo |
|---|---|---|
| **Planificación** | hay plan de atención (RF-17) | `planificacion` no vacío |
| **Materiales** | hay al menos una orden (RF-18) | `ordenes_count > 0` (web) · `ordenes` / `ordenes_count` (APK) |
| **Asignación** | tiene cuadrilla | `id_cuadrilla > 0` o `cuadrilla_codigo`/`cuadrilla_nombre` |

El nombre de cada valor no se pierde (**RNF-48**): va en el `title` (ratón) y en `aria-label` +
texto oculto (lectores de pantalla) en la web, y en el `Tooltip` + `semanticsLabel` en la APK. Ejemplos:
«Planificación: sin planificar», «Materiales: 2 orden(es) de material», «Asignación: cuadrilla TCD9A».

---

## 3. Punto 3 — Columna de acciones como iconos

Las cuatro acciones dejan de ser botones de texto y pasan a **botones cuadrados de 30 px** con su
icono, **conservando el nombre** en `title`/`aria-label` + texto oculto (los `getByRole('button', {
name: 'Gestionar' })` de las pruebas siguen funcionando):

| Acción | Icono | Efecto |
|---|---|---|
| **Gestionar** | maletín (`IconoGestion`), teñido | abre la ficha flotante |
| **Reporte** | hoja con líneas (`IconoReporte`, nuevo) | abre el HTML imprimible |
| **Ubicación** | chincheta (`IconoUbicacion`, nuevo) | salta a la pestaña Ubicación con el mapa |
| **Ver** | ojo (`IconoVer`, nuevo) | abre el detalle de solo lectura |

Al estar dentro de una fila clicable, el contenedor de acciones **detiene la propagación** del clic y
del teclado: pulsar «Ver» abre el detalle y **no** además la ficha de gestión (verificado).

**En la APK** las acciones son también iconos, con una particularidad útil en campo: cada una abre la
**ficha de la masiva en su pestaña** —`FichaMasivaScreen(pestanaInicial: …)`— y el **rol manda**, como
en las pestañas: TECNICO solo ve **Materiales**; ADMIN y SUPERVISOR ven **Planificar · Materiales ·
Cerrar**. Los indicadores, además, son tocables y llevan a la misma pestaña.

La tarjeta de la APK pasa al **estilo de CASOS** (`CasoCard`, D-101): identificador a 16 sp con cifras
tabulares, detalle a 14 sp con interlineado 1,4, **estado como icono** (`EstadoIcono`) y chevrón, con
una línea divisoria y, debajo, la fila de indicadores y acciones.

---

## 4. Punto 4 — Sin texto de explicación

En la web se elimina el párrafo que explicaba la sección bajo el título y también los recuadros azules
de explicación de las pestañas **Búsqueda automática**, **Agregar manual** y **Generar reporte**, y el
párrafo de **Gestionar**. La sección queda con títulos, controles y cuadros: el cuadro de masivas dice
por sí solo qué hay.

La APK **no tenía** texto de explicación en la pantalla MASIVAS, así que en el móvil no hubo nada que
quitar: el cambio allí es el cuadro (puntos 1-3).

### 4.1 Defecto colateral corregido: las pestañas se pintaban como botones del navegador

Al revisar la sección se vio que **`operacion-pestanas` / `operacion-pestana` no tenían CSS**: D-103
las borró de `styles.css` al sustituir OPERACIÓN por un tablero de fichas, pero **MENSAJES, MASIVAS,
SISTEMAS y el panel de GESTIÓN DIARIA siguen usándolas**. Se restauran las reglas de D-72 (subrayado
de marca, activa en azul claro) en `styles.css`, con una nota que explica por qué vuelven
(**DEC-111-5**).

---

## 5. Decisiones

| # | Decisión | Motivo |
|---|---|---|
| **DEC-111-1** | El cuadro vive **encima de las pestañas**; no se tocan los siete bloques de D-99 | Se ve el listado al entrar **sin** perder el flujo por pestañas (búsqueda, alta manual, reporte, ubicación, personal externo) ni romper las pruebas E2E de la sección |
| **DEC-111-2** | Los indicadores se derivan de `planificacion`, `ordenes`/`ordenes_count` y `id_cuadrilla`/`cuadrilla_codigo` | Son los campos que ya viajan en el listado web y en la DESCARGA de la APK: **sin API nueva** y funcionan sin conexión |
| **DEC-111-3** | El indicador **apagado se muestra igual** (gris punteado) | El valor de la columna es ver **lo que falta**, no solo lo que hay |
| **DEC-111-4** | Acciones con icono **con nombre accesible** (`title`/`aria-label`/`Tooltip`) | RNF-09/RNF-23/RNF-38: el icono nunca deja la acción sin nombre |
| **DEC-111-5** | Se restauran las reglas de las pestañas en `styles.css` | Cuatro pantallas usan esas clases; sin CSS se pintaban con el estilo del navegador |
| **DEC-111-6** | En la APK la acción abre la ficha **en su pestaña** y el rol decide cuáles se ven | Evita un paso y respeta el RBAC de D-99 (TECNICO en solo lectura) |

---

## 6. Trazabilidad

| ID | Requisito / regla |
|---|---|
| **RF-97** | La sección MASIVAS muestra el cuadro de las masivas con el estilo de CASOS (filas clicables, pie con el total) |
| **RF-98** | El cuadro indica con iconos si la masiva tiene Planificación, Materiales y Asignación |
| **RF-99** | Las acciones del cuadro son iconos con nombre accesible; en la APK abren la ficha en su pestaña |
| **RNF-48** | Los iconos conservan su nombre (ratón y lector de pantalla) y no se usa texto de explicación redundante |
| **RT-36** | Pruebas de D-111: 11 en Flutter (indicadores, acciones, pestaña inicial, widget) y verificación visual del bundle |
| **DEC-111-1…6** | Decisiones de este incremento |

---

## 7. Archivos

| Archivo | Cambio |
|---|---|
| `app/web/src/pages/Masivas.tsx` | cuadro encima de las pestañas, columna de indicadores, acciones con icono, textos de explicación fuera |
| `app/web/src/masivas/CuadroMasivas.tsx` | **nuevo** · el cuadro de las masivas |
| `app/web/src/masivas/CeldaIndicadores.tsx` | **nuevo** · columna INDICADORES (web) |
| `app/web/src/masivas/AccionesMasiva.tsx` | **nuevo** · botón de icono con nombre accesible |
| `app/web/src/masivas/estado.ts` | **nuevo** · color del estado compartido |
| `app/web/src/masivas/masivas.css` | estilos del cuadro, de los indicadores y de los botones de icono |
| `app/web/src/components/Iconos.tsx` | iconos nuevos `IconoReporte`, `IconoUbicacion`, `IconoVer` |
| `app/web/src/masivas/FichaMasiva.tsx` | fuera `IndicadoresMasiva` (chips), que sustituye la columna de iconos |
| `app/web/src/styles.css` | reglas de `operacion-pestanas`/`operacion-pestana` restauradas |
| `app_movil/lib/features/masivas/masivas_screen.dart` | tarjeta con el estilo de CASOS, indicadores y acciones con icono |
| `app_movil/lib/features/masivas/indicador_masiva.dart` | **nuevo** · indicador con icono, `Tooltip` y `Semantics` |
| `app_movil/lib/features/masivas/masivas_provider.dart` | ayudas puras `tienePlanificacion`, `ordenesDe`, `tieneMateriales`, `tieneAsignacion` |
| `app_movil/lib/features/masivas/ficha_masiva_screen.dart` | `pestanaInicial` + `indicePestana` |
| `app_movil/test/d111_masivas_test.dart` | **nuevo** · 11 pruebas |

---

## 8. Verificación

| Prueba | Resultado |
|---|---|
| `tsc` + `vite build` (web) | **en verde** — 102 módulos, bundle `index-BfEI_xw3.js`, CSS `index-CwYlSn18.css` |
| Render real del bundle con la API interceptada (Playwright) | el cuadro pinta **4 filas, 4 celdas de indicadores y 16 botones de icono**, **0 errores** de consola; Gestionar/Histórico muestran la columna INDICADORES; **«Ver» abre el detalle y «Gestionar» la ficha** (la propagación se detiene) |
| `flutter analyze` | **«No issues found!»** |
| `flutter test` | **194/194 en verde** (183 previos + **11 nuevos** de D-111) |
| Render del widget de la APK (golden temporal, borrado tras revisarlo) | tarjeta con cabecera de CASOS, tres indicadores (gris/encendido) y las acciones del rol, **sin desbordes** |

---

## 9. Entrega publicada (2026-10-17)

**APK `1.11.0+20`** — `python scripts/publicar_apk.py --confirmar`:

| Dato | Valor |
|---|---|
| Versión | **`1.11.0+20`** (`pubspec.yaml` y `lib/core/constants.dart`) |
| Firma | **keystore oficial** — `CN=GGTO Tecnico, OU=Proyecto GGTO, O=Ing. Angel H. Lucci, L=Caracas, ST=Miranda, C=VE` |
| SHA-256 | **`af7e2d0f4fc006c62f6a5f89769c95517c796f2d6bfdf4df21d08fa6157bd68a`** |
| Tamaño | 25 010 469 bytes (23,85 MB) |
| Publicada en | `app_movil/GGTOv2.apk` y `app/web/public/apk/ggto-tecnico.apk` + `apk.json` |

**Web desplegada** — `TAG=v42 RepoTecnico/scripts/11_desplegar_ggto_web.sh --confirmar`:

| Dato | Valor |
|---|---|
| Cloud Build | **SUCCESS**, 1M35S, imagen `ggto-web:v42` (digest `sha256:345e4645…`) |
| Cloud Run | revisión **`ggto-web-00055-sxl`** con **100 % del tráfico** (sustituye a `00054-tsx`/v41) |
| Humo en vivo | `/health`, `/ready`, `/`, `/manual/` y un HTML de manual → **200** |
| `/ready` | PostgreSQL **15.18**, base `ggtov2`, **43 tablas** (sin cambios de esquema) |
| Bundle servido | `index-BfEI_xw3.js` + `index-CwYlSn18.css`, **idénticos a la compilación local**, con `celda-indicadores`, `indicador-planificacion`, `indicador-off`, `btn-icono`, `celda-estado-masiva` y `operacion-pestanas`; y **ya sin** el texto de explicación |
| `/apk/apk.json` | sirve **`1.11.0+20`** con el **mismo SHA-256** que el binario local; `/apk/ggto-tecnico.apk` responde **200** (23,85 MB) |

**Push y redespliegue de confirmación (orden del usuario: «/push y despliegue»):**

| Dato | Valor |
|---|---|
| Commit | **`8c60ffe`** `feat(masivas): D-111 cuadro estilo CASOS, indicadores y acciones con icono (web y APK)` — **18 archivos, +1413/−155** |
| Remotos | **GitHub** (`anlucorporations/GGTO`) y **GitLab** (`anlucorporations/ggto`) en **`8c60ffe`** = HEAD local, verificado con `git ls-remote` |
| Seguridad previa | barrido del diff sin coincidencias de secretos; **ningún** `.apk`, keystore, `key.properties`, `credenciales/`, CSV con PII ni `node_modules`/`dist`; **`.agents/` excluido** como siempre |
| Redespliegue | imagen **`v43`** (Cloud Build **SUCCESS**, 1M45S, digest `sha256:abeaabc0…`) → revisión **`ggto-web-00056-nd7`** con **100 % del tráfico** |
| Verificación | `/health` `/ready` `/` `/manual/` y un manual → **200**; bundle `index-BfEI_xw3.js` + `index-CwYlSn18.css` y `apk.json` `1.11.0+20` **idénticos** a la entrega `v42` |

---

## 10. Pendiente

- **Prueba en dispositivo**: comprobar en campo que los indicadores se leen a la primera, que las
  acciones abren la ficha en su pestaña y que la APK se actualiza sola desde la franja de D-107.
- **E2E de la web** (`RepoTecnico/pruebas/e2e/tests/26-masivas.spec.js`): las siete pestañas siguen
  existiendo y la detección no cambia, pero estas pruebas **no se han ejecutado** en esta sesión
  (requieren PostgreSQL y el backend en marcha).
- **Observación de reproducibilidad**: `app/requirements.txt` **no fija versiones**; el `v43`
  resolvió `fastapi 0.145.0` donde el `v42` había tomado `0.143.3`. La aplicación funciona igual
  (`/ready` en verde y 43 tablas), pero conviene **pinnear** las dependencias del backend para que
  dos compilaciones del mismo commit den la misma imagen.
