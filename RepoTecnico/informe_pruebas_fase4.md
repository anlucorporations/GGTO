# Informe de pruebas — Fase 4 (GGTO-v1)

- **Proyecto:** GGTO-v1 — Página HTML de gestión de averías, central Francisco Salias (Área 4), CANTV.
- **Fase:** 4 (Pruebas). **Fecha del informe:** 14/09/2026.
- **Alcance:** verificación completa del sistema entregado en la Fase 3 (ciclos C1 a C7) antes de darlo por cerrado.
- **Logs de la ejecución:** `RepoTecnico/logs/pruebas_fase4_modulos.log` (pruebas de módulos) y
  `RepoTecnico/logs/pruebas_fase4_interfaz.log` (comprobación de interfaz).

---

## 1. Resumen global

> ### VEREDICTO: **FASE 4 CUMPLIDA** — 192 comprobaciones, 0 fallos.

| Conjunto | Comprobaciones | Pasan | Fallan |
|---|---|---|---|
| Pruebas de módulos y contratos (`node --test`) | **142** | **142** | **0** |
| Comprobación de interfaz E2E (Chrome/Edge headless sobre `index.html` real) | **50** | **50** | **0** |
| **Total** | **192** | **192** | **0** |

**Defectos encontrados y corregidos en esta fase: 7** (2 de contrato de datos, 3 de la hoja impresa,
1 de accesibilidad de funcionalidad y 1 de contradicción documental). Ninguno queda abierto.
Dos de ellos hacían que una funcionalidad completa fuera **inalcanzable** o **incorrecta** para el
usuario, y ninguno era visible con las pruebas unitarias que ya existían: los destapó la combinación de
**pruebas de contrato** y **pruebas E2E sobre la página real**.

---

## 2. Método

| Tipo de prueba | Cómo se ejecuta | Qué cubre |
|---|---|---|
| **Unitarias y de integración** | `node --test` con la File System Access API simulada (carpetas y archivos falsos) | Lógica pura, protocolo de escritura verificada, ingesta, despacho, métricas, respaldo y diagnóstico |
| **De contrato** | `pruebas/pruebas_contratos.mjs` contra el **CSV real** del 12/09/2026 y los archivos reales de `C:\GGTO\datos` | `estructura.json` ↔ CSV, campos del maestro, 15 columnas de `despacho.json`, contenido y ancho de la hoja impresa, inventario de archivos, campos del historial |
| **E2E de navegador** | `pruebas/interfaz.mjs`: sirve `app/` por **HTTP en loopback**, abre `index.html` en Chrome/Edge headless, sustituye la carpeta de datos por un almacén simulado e **interactúa con la interfaz real** (pulsa botones, rellena formularios, carga el CSV real) | Sesión y permisos, las 8 vistas, ingesta del CSV real, PDF y su ruta controlada, control documental, respaldo, reporte, diagnóstico, rutas y librerías locales |

> La comprobación E2E se sirve por **HTTP** y no por `file://` porque la propia página **aborta su
> arranque** en `file://` (D-15: no se pueden leer ni escribir los JSON): por ese camino no se
> conectarían los eventos de la interfaz y no se podría probar ni la sesión ni la ingesta.

---

## 3. Resultado por batería

| Batería | Comprobaciones | Pasan | Fallan |
|---|---|---|---|
| `pruebas_c1.mjs` — armazón, sesión, CRUD de padrones | 10 | 10 | 0 |
| `pruebas_almacen_c1.mjs` — persistencia verificada, `.bak`, conflicto, historial | 6 | 6 | 0 |
| `pruebas_c1b.mjs` — credencial, roles, rotación del log | 8 | 8 | 0 |
| `pruebas_c2.mjs` — ingesta del CSV real | 20 | 20 | 0 |
| `pruebas_c3.mjs` — PANEL, GESTION y alta manual | 17 | 17 | 0 |
| `pruebas_c4.mjs` — despacho y PDF | 17 | 17 | 0 |
| `pruebas_c4b.mjs` — ruta controlada del PDF y control documental | 13 | 13 | 0 |
| `pruebas_c5.mjs` — MONITOREO y GRAFICOS | 15 | 15 | 0 |
| `pruebas_c6.mjs` — reportes y averías concentradas | 9 | 9 | 0 |
| `pruebas_c7.mjs` — respaldo y restauración | 12 | 12 | 0 |
| `pruebas_cu22.mjs` — diagnóstico del entorno | 6 | 6 | 0 |
| `pruebas_contratos.mjs` — contratos de datos y de la hoja impresa | 9 | 9 | 0 |
| **`pruebas/interfaz.mjs`** — 50 comprobaciones E2E en navegador | 50 | 50 | 0 |

**Cobertura E2E destacada** (lo que la interfaz hace de verdad, extremo a extremo):

1. **Sesión (CU-01):** credencial real `P00` + contraseña con **hash SHA-256 y sal**; la contraseña
   incorrecta **no** abre la sesión y **queda contada y registrada**; la correcta abre la sesión,
   construye las **7 pestañas** y habilita las del supervisor.
2. **Ingesta del CSV real (CU-08):** se carga el archivo real en el bloque INGESTA y la revisión
   informa **56 leídas · 5 descartadas por central · 51 casos nuevos · 18 PEND + 33 GESTION**, sin
   escribir el maestro.
3. **Despacho y PDF (CU-16/CU-17):** generar el despacho, PDF a la ruta controlada, reemisión que no
   pisa la anterior, y el ciclo completo de **entrega → recogida → destrucción → cierre del día**.
4. **Respaldo (CU-21)**, **reporte (CU-19)** y **diagnóstico (CU-22)** ejercitados desde sus bloques.

---

## 4. Defectos encontrados y corregidos

### 4.1 Críticos de funcionalidad

| # | Defecto | Causa | Corrección | Prueba que lo cubre |
|---|---|---|---|---|
| **D-1** | **La ingesta del CSV no tenía punto de entrada**: `GGTO_INGESTA.render` no lo invocaba nadie, así que la capacidad central del MVP era **inalcanzable** desde la interfaz | El fuente define `[1. INGESTA]` como sección y CU-01 aclara que no es pestaña, pero ningún tab la alojaba | El bloque INGESTA se aloja en la pestaña **PANEL** (**D-70**), con el permiso de la matriz de §2.1 | `la vista PANEL aloja el bloque INGESTA (CU-08)` + las 5 comprobaciones de la ingesta real |
| **D-2** | **La hoja del despacho no llevaba 6 de las 15 columnas canónicas**: se imprimían 9 columnas y faltaban `nivel`, `clase`, `persona_reporta` y `sector` (las otras dos, `Reparador Principal` y `fecha_despacho`, van en el encabezado) | CU-17 CA-2 exige las 15 columnas; la tabla se definió con 9 | La tabla pasa a 13 columnas y, con el encabezado, cubre las 15 (**CU-17 CA-2**) | `la hoja del despacho muestra todas las columnas canónicas (CU-17 CA-2)` |
| **D-3** | **La tabla del PDF se salía del área imprimible**: medía 276 mm sobre 263,4 mm disponibles, de modo que la última columna se imprimía fuera del margen | El ancho de la última columna se forzaba a un mínimo de 30 mm sin comprobar el total | La última columna absorbe el resto exacto del área imprimible (`anchoTabla()`), y el ancho total se verifica | `la tabla del despacho cabe en el área imprimible de la hoja (RNF-05)` |
| **D-4** | **El texto de las celdas se recortaba a un tercio de lo que cabía**: se veían 5 caracteres donde caben 14, con pérdida de direcciones y comentarios | `truncar()` mezclaba **puntos** (cuerpo de letra) con **milímetros** (ancho): dividía por 3,75 en lugar de 1,32 | Se convierte el cuerpo de letra a milímetros (`MM_POR_PUNTO`) y se descuenta el relleno de la celda | Contrato de la hoja + paginación de `pruebas_c4` |

### 4.2 De contrato de datos

| # | Defecto | Causa | Corrección | Prueba que lo cubre |
|---|---|---|---|---|
| **D-5** | **`estructura.json` declaraba `direccion` como obligatoria y el dato real la incumple**: 4 de 51 filas del archivo del 12/09/2026 llegan sin dirección, y CU-08 exige insertar las 51 | La obligación se declaró al diseñar el contrato y nunca se contrastó con el archivo real; además la ingesta no la aplicaba | La columna deja de ser obligatoria **en el contrato del CSV** (sigue siéndolo en el maestro): esas filas entran y quedan en la **cola de sectores** (CU-09) — **D-69** | `cada campo declarado apunta a una columna existente y los obligatorios se cumplen` + `una fila sin dirección entra igualmente y queda en la cola de sectores` |
| **D-6** | **`COLUMNAS_DESPACHO` declaraba 10 columnas** y contradecía las 15 canónicas de D-31/RT-05; además una prueba fijaba ese contrato equivocado | Lista escrita antes de D-31 y nunca usada (código muerto) | La lista pasa a ser las 15 canónicas y la prueba se corrige | `la proyección de despacho escribe las 15 columnas canónicas` y `las columnas del despacho son las 15 canónicas` |

### 4.3 Documentales

| # | Defecto | Corrección |
|---|---|---|
| **D-7** | **CU-01 CA-12 se contradecía con §2.1 y con CU-08**: afirmaba que el bloque INGESTA «queda bloqueado por la matriz» para un operador, cuando la matriz lo permite a los dos roles. La guía de prueba manual repetía el error («solo supervisor») | CU-01 CA-12 reescrito y guía §3.5 corregida: la INGESTA se muestra también al operador (**D-70**) |

### 4.4 Falsos positivos descartados

- **«La ingesta debería inicializar el rastro de auditoría en blanco»**: se descartó. La ingesta **sí**
  inicializa `usuario_modificacion` con la columna 20 del CSV y `fecha_modificacion` con la fecha de
  ingesta, que es exactamente lo que fijan **D-52 y D-53**. El error estaba en la expectativa de la
  prueba, no en el código.
- **Fallo de captura de Chrome por tubería**: el entorno no devuelve la salida de Chrome por *pipe* y
  `spawnSync` se bloquea porque sus procesos hijo heredan el descriptor. No es un defecto del sistema
  probado: el arnés se cambió a salida por archivo con sondeo.

---

## 5. Riesgos residuales (no cubiertos por esta fase)

| Riesgo | Por qué queda fuera | Mitigación prevista |
|---|---|---|
| **Prueba con los datos reales de una semana completa** en el puesto | Requiere la central y los CSV de la semana | Es el criterio de terminado de **C7**; planificada en el puesto |
| **Impresión física** del despacho | Requiere la impresora de la central | Verificación manual en el puesto (`guia_prueba_manual.md` §3.8) |
| **Cierre de caso y reclasificación en GESTION** no se accionan por E2E | Su lógica está cubierta por pruebas unitarias (17 de C3) y su render por E2E; falta la interacción completa del flotante | Ampliar el E2E en la siguiente pasada o validarlo en la prueba de puesto |
| **Umbrales de desempeño (RNF-02, D-24)** medidos con 1.000 casos | Se miden en pruebas unitarias de lógica, no en un E2E con 1.000 casos en pantalla | Medición en el puesto con el maestro real |
| **Modo degradado (Firefox/Safari)** | El E2E corre en Chromium | CU-22 muestra el aviso y habilita solo el modo descarga; validar en el puesto |

---

## 6. Conclusión

El sistema pasa **las 192 comprobaciones** y los **7 defectos** detectados en la fase quedan corregidos,
con su prueba de regresión correspondiente y su constancia en `estado_proyecto.md`. Se cumple el
criterio de aceptación de la Fase 4 («100% de pruebas pasando, sin errores funcionales») para todo lo
verificable **sin el puesto de la central**; lo que exige el puesto (datos reales de una semana,
impresión y modo degradado real) queda listado como riesgo residual y como criterio de terminado de C7.

**Siguiente paso:** al haberse acordado **omitir la Fase 5 (Manuales)**, el proyecto queda a la espera
de la prueba en el puesto para cerrar C7 y hacer la entrega.
