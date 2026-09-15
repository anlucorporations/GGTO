# Informe de pruebas — Fase 4 (GGTO-v1)

- **Proyecto:** GGTO-v1 — Página HTML de gestión de averías, central Francisco Salias (Área 4), CANTV.
- **Fase:** 4 (Pruebas). **Fecha del informe:** 14/09/2026. **Última regeneración:** 14/09/2026 (tras la reauditoría del documento técnico y los hallazgos del lente R2).
- **Alcance:** verificación completa del sistema entregado en la Fase 3 (ciclos C1 a C7) antes de darlo por cerrado.
- **Logs de la ejecución:** `RepoTecnico/logs/pruebas_fase4_modulos.log` (pruebas de módulos) y
  `RepoTecnico/logs/pruebas_fase4_interfaz.log` (comprobación de interfaz).

---

## 1. Resumen global

> ### VEREDICTO: **FASE 4 CUMPLIDA** — 201 comprobaciones, 0 fallos.

| Conjunto | Comprobaciones | Pasan | Fallan |
|---|---|---|---|
| Pruebas de módulos y contratos (`node --test`) | **149** | **149** | **0** |
| Comprobación de interfaz E2E (Chrome/Edge headless sobre `index.html` real) | **52** | **52** | **0** |
| **Total** | **201** | **201** | **0** |

> **Nota de recuento.** Las cifras de este informe se regeneran de una **única ejecución** de los dos
> arneses (los logs de §3 son la fuente); el desglose por batería es el número real de pruebas de cada
> archivo. Las cifras anteriores (142 + 50) quedaron desactualizadas al añadirse las pruebas de contrato
> de los hallazgos **R2-01, R2-02, R2-07 y R2-03** y las dos comprobaciones E2E de la ruta de REPORTES.

**Defectos encontrados y corregidos en esta fase: 10** (2 de contrato de datos, 3 de la hoja impresa,
1 de accesibilidad de funcionalidad, 1 de ruta de la interfaz, 1 de valores por defecto y 4 documentales,
estos últimos del lente R2 de la reauditoría). Ninguno queda abierto.
Dos de ellos hacían que una funcionalidad completa fuera **inalcanzable** o **incorrecta** para el
usuario, y ninguno era visible con las pruebas unitarias que ya existían: los destapó la combinación de
**pruebas de contrato** y **pruebas E2E sobre la página real**.

---

## 2. Método

| Tipo de prueba | Cómo se ejecuta | Qué cubre |
|---|---|---|
| **Unitarias y de integración** | `node --test` con la File System Access API simulada (carpetas y archivos falsos) | Lógica pura, protocolo de escritura verificada, ingesta, despacho, métricas, respaldo y diagnóstico |
| **De contrato** | `pruebas/pruebas_contratos.mjs` contra el **CSV real** del 12/09/2026 y los archivos reales de `C:\GGTO\datos` | `estructura.json` ↔ CSV, campos del maestro, 15 columnas de `despacho.json`, contenido y ancho de la hoja impresa, inventario de archivos, campos del historial |
| **E2E de navegador** | `pruebas/interfaz.mjs`: sirve `app/` por **HTTP en loopback**, abre `index.html` en Chrome/Edge headless, sustituye la carpeta de datos por un almacén simulado e **interactúa con la interfaz real** (pulsa botones, rellena formularios, carga el CSV real) | Sesión y permisos, las 8 vistas (las 7 pestañas de RF-01 y la sub-pestaña REPORTES de MONITOREO, D-76), ingesta del CSV real, PDF y su ruta controlada, control documental, respaldo, reporte, diagnóstico, rutas y librerías locales |

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
| `pruebas_c6.mjs` — reportes y averías concentradas | 11 | 11 | 0 |
| `pruebas_c7.mjs` — respaldo y restauración | 12 | 12 | 0 |
| `pruebas_cu22.mjs` — diagnóstico del entorno | 6 | 6 | 0 |
| `pruebas_contratos.mjs` — contratos de datos y de la hoja impresa | 14 | 14 | 0 |
| **Subtotal de módulos y contratos** | **149** | **149** | **0** |
| **`pruebas/interfaz.mjs`** — comprobaciones E2E en navegador | 52 | 52 | 0 |
| **Total** | **201** | **201** | **0** |

**Cobertura E2E destacada** (lo que la interfaz hace de verdad, extremo a extremo):

1. **Sesión (CU-01):** credencial real `P00` + contraseña con **hash SHA-256 y sal**; la contraseña
   incorrecta **no** abre la sesión y **queda contada y registrada**; la correcta abre la sesión,
   construye las **7 pestañas**, comprueba que cada una tiene su **sección real** en `index.html` y
   habilita las del supervisor.
2. **Ingesta del CSV real (CU-08):** se carga el archivo real en el bloque INGESTA y la revisión
   informa **56 leídas · 5 descartadas por central · 51 casos nuevos · 18 PEND + 33 GESTION**, sin
   escribir el maestro.
3. **Despacho y PDF (CU-16/CU-17):** generar el despacho, PDF a la ruta controlada, reemisión que no
   pisa la anterior, y el ciclo completo de **entrega → recogida → destrucción → cierre del día**.
4. **Respaldo (CU-21)**, **reporte (CU-19)** —alcanzado por su **ruta real**: MONITOREO → sub-pestaña
   «REPORTES y seguimiento» (D-76)— y **diagnóstico (CU-22)** ejercitados desde sus bloques.

---

## 4. Defectos encontrados y corregidos

### 4.1 Críticos de funcionalidad

| # | Defecto | Causa | Corrección | Prueba que lo cubre |
|---|---|---|---|---|
| **D-1** | **La ingesta del CSV no tenía punto de entrada**: `GGTO_INGESTA.render` no lo invocaba nadie, así que la capacidad central del MVP era **inalcanzable** desde la interfaz | El fuente define `[1. INGESTA]` como sección y CU-01 aclara que no es pestaña, pero ningún tab la alojaba | El bloque INGESTA se aloja en la pestaña **PANEL** (**D-70**), con el permiso de la matriz de §2.1 | `la vista PANEL aloja el bloque INGESTA (CU-08)` + las 5 comprobaciones de la ingesta real |
| **D-2** | **La hoja del despacho no llevaba 6 de las 15 columnas canónicas**: se imprimían 9 columnas y faltaban `nivel`, `clase`, `persona_reporta` y `sector` (las otras dos, `Reparador Principal` y `fecha_despacho`, van en el encabezado) | CU-17 CA-2 exige las 15 columnas; la tabla se definió con 9 | La tabla pasa a 13 columnas y, con el encabezado, cubre las 15 (**CU-17 CA-2**) | `la hoja del despacho muestra todas las columnas canónicas (CU-17 CA-2)` |
| **D-3** | **La tabla del PDF se salía del área imprimible**: medía 276 mm sobre 263,4 mm disponibles, de modo que la última columna se imprimía fuera del margen | El ancho de la última columna se forzaba a un mínimo de 30 mm sin comprobar el total | La última columna absorbe el resto exacto del área imprimible (`anchoTabla()`), y el ancho total se verifica | `la tabla del despacho cabe en el área imprimible de la hoja (RNF-05)` |
| **D-4** | **El texto de las celdas se recortaba a un tercio de lo que cabía**: se veían 5 caracteres donde caben 14, con pérdida de direcciones y comentarios | `truncar()` mezclaba **puntos** (cuerpo de letra) con **milímetros** (ancho): dividía por 3,75 en lugar de 1,32 | Se convierte el cuerpo de letra a milímetros (`MM_POR_PUNTO`) y se descuenta el relleno de la celda | Contrato de la hoja + paginación de `pruebas_c4` |
| **D-8** | **El módulo de REPORTES no era alcanzable**: `reportes.js` se exportaba pero **ninguna ruta de `app.js` lo invocaba**, no tenía sección en `index.html` y el E2E **fabricaba** la sección que faltaba, así que la comprobación pasaba sin que la ruta existiera (hallazgo **R2-03**) | El fuente describe REPORTES como salida de CU-19/CU-20, pero al implementar C6 solo se enrutaron las 7 pestañas de RF-01 | REPORTES pasa a ser la **sub-pestaña «REPORTES y seguimiento» de MONITOREO** —el mismo patrón con que CONFIGURACION aloja RESPALDO y ENTORNO— (**D-76**), y el arnés E2E deja de fabricar secciones: exige la **sección real** de cada pestaña y navega por la sub-pestaña | `REPORTES se alcanza desde MONITOREO y no como pestaña propia (RF-01, D-76)`, `cada pestaña de RF-01 tiene su sección real en index.html` y `la sub-pestaña REPORTES renderiza con la ruta real de la aplicación` |

### 4.2 De contrato de datos

| # | Defecto | Causa | Corrección | Prueba que lo cubre |
|---|---|---|---|---|
| **D-5** | **`estructura.json` declaraba `direccion` como obligatoria y el dato real la incumple**: 4 de 51 filas del archivo del 12/09/2026 llegan sin dirección, y CU-08 exige insertar las 51 | La obligación se declaró al diseñar el contrato y nunca se contrastó con el archivo real; además la ingesta no la aplicaba | La columna deja de ser obligatoria **en el contrato del CSV** (sigue siéndolo en el maestro): esas filas entran y quedan en la **cola de sectores** (CU-09) — **D-69** | `cada campo declarado apunta a una columna existente y los obligatorios se cumplen` + `una fila sin dirección entra igualmente y queda en la cola de sectores` |
| **D-6** | **`COLUMNAS_DESPACHO` declaraba 10 columnas** y contradecía las 15 canónicas de D-31/RT-05; además una prueba fijaba ese contrato equivocado | Lista escrita antes de D-31 y nunca usada (código muerto) | La lista pasa a ser las 15 canónicas y la prueba se corrige; la reauditoría añade la comprobación de que la constante coincide, en orden, con lo que escribe `filasDespacho` (**R2-02**) | `la proyección de despacho escribe las 15 columnas canónicas` y `la constante COLUMNAS_DESPACHO del módulo son las 15 canónicas (D-31, R2-02)` |
| **D-9** | **El respaldo de claves de CONFIGURACION traía 3 claves en vez de las 6 del catálogo por defecto**: sin `claves_clasificacion.json` en disco, la sub-pestaña PALABRAS CLAVE mostraba un catálogo reducido con el que **no se reproduce el reparto documentado** (faltaban «LOS ROJO» y «FALLA DE FIBRA», hallazgo **R2-07**) | El respaldo se escribió a mano, en paralelo a la semilla del núcleo, y quedó desincronizado | El catálogo por defecto es una **constante única** del núcleo (`CONST.CLAVES_CLASIFICACION`) que usan la semilla y el respaldo de la interfaz | `el catálogo de claves por defecto es uno solo y tiene las 6 claves de D-65 (R2-07)` y `una instalación nueva reproduce el reparto documentado (D-65, RN-03)` |

### 4.3 Documentales

| # | Defecto | Corrección |
|---|---|---|
| **D-7** | **CU-01 CA-12 se contradecía con §2.1 y con CU-08**: afirmaba que el bloque INGESTA «queda bloqueado por la matriz» para un operador, cuando la matriz lo permite a los dos roles. La guía de prueba manual repetía el error («solo supervisor») | CU-01 CA-12 reescrito y guía §3.5 corregida: la INGESTA se muestra también al operador (**D-70**) |
| **D-10** | **Cifras y referencias del corpus que no cuadraban** (lente R2 de la reauditoría): §1.2 del documento técnico declaraba «14 PEND + 37 GESTION» frente al 18/33 real (**R2-01**); el informe y `estado_proyecto.md` daban tres totales distintos de pruebas (**R2-04**); §4.3 describía `estructura.json` **v1 con 19 campos** cuando el contrato vivo es **v2 con 25 campos y `cabecera`** (**R2-06**); D-65 y D-66 apuntaban a §§ que no contenían lo que afirmaban (**R2-08**); §7.2 seguía diciendo que el CSV y el `.xlsm` se versionan, contra D-71 (**R2-13**); y los conteos de decisiones, RF, RNF y RT de `estado_proyecto.md` estaban desfasados (**R2-09**) | Corregidos uno a uno (§1.2, §4.3 con nota de versiones, §7.2, referencias de D-65/D-66, conteos de `estado_proyecto.md`, informe y guía §3.10). Se añade una **comprobación de consistencia de las cifras del CSV** (56 = 51 + 5 y 51 = 18 + 33) para que no vuelvan a divergir (**R2-01**) |
| **D-11** | **El conteo de «10 archivos de trabajo» se leía como el contenido del directorio** (**R2-05**): `C:\GGTO\datos` puede traer respaldos `.bak` del maestro y copias manuales de otros archivos | El documento técnico (y la guía §1) aclaran que **10 es la lista blanca** que se copia, que los `.bak` del maestro son la rotación de D-42 y que una copia manual de otro archivo queda fuera de la copia de cierre |
| **D-12** | **La ubicación del metadata de git difería entre documentos y con el filesystem** (**R2-11**): el documento técnico decía `C:\GGTO\proyecto\.git` y `entornos_globales.md`/`estado_proyecto.md` que la raíz apuntaba con `gitdir:` a `C:\GGTO\git\GGTO-v1.git` | Verificado con `git rev-parse --git-dir`: **`.git` es un directorio** en `C:\GGTO\proyecto` y el repositorio anterior se conserva **solo como copia histórica**. Se unifica la redacción en los tres documentos (y en RT-11) |

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

El sistema pasa **las 201 comprobaciones** (149 de módulos y contratos + 52 E2E) y los **10 defectos**
detectados en la fase quedan corregidos, con su prueba de regresión correspondiente y su constancia en
`estado_proyecto.md`. Se cumple el criterio de aceptación de la Fase 4 («100% de pruebas pasando, sin
errores funcionales») para todo lo verificable **sin el puesto de la central**; lo que exige el puesto
(datos reales de una semana, impresión y modo degradado real) queda listado como riesgo residual y como
criterio de terminado de C7.

**Siguiente paso:** al haberse acordado **omitir la Fase 5 (Manuales)**, el proyecto queda a la espera
de la prueba en el puesto para cerrar C7 y hacer la entrega.
