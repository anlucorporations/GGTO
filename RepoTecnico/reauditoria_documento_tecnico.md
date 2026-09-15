# Reauditoría del Documento Técnico — GGTO-v1

- **Proyecto:** GGTO-v1 — Página HTML de gestión de averías, central Francisco Salias (Área 4), CANTV.
- **Documento reauditado:** `RepoTecnico/documento_tecnico.md` — 16 archivos `.js` en `app/js/` (14 módulos y 2 núcleos puros), decisiones **D-01 a D-70** en el momento de emitir este informe (el anexo llega hoy a **D-76**). No se cita el número de líneas: es un documento vivo (hallazgo **R2-10**).
- **Informe previo:** `RepoTecnico/auditoria_documento_tecnico.md` (10 hallazgos A-01…A-10, 8 preguntas P1…P8).
- **Método:** skill `equipo-auditoria` — Fase 1 (7 lentes en paralelo), Fase 2 (verificación adversarial por dimensión: filtra falsos positivos, deduplica, ajusta severidades), Fase 3 (esta síntesis).
- **Alcance:** solo lectura y verificación. La única escritura es este informe. Cada afirmación cita `ruta:línea`.
- **Regla de admisión:** *ante la duda, DESCARTA*. Solo se promueven hallazgos con evidencia confirmada en los informes de verificación de las 7 dimensiones. No se añadió ningún hallazgo ausente de ellos.

> ### ESTADO FINAL (14/09/2026) — FASE 2 CERRADA
>
> El veredicto condicionado de §1 y los 22 hallazgos RN-01…RN-22 se conservan **como registro** de lo que
> encontró la reauditoría. Desde entonces: **RN-01** se resolvió con **D-71** (repositorios públicos +
> purga de datos personales), **RN-02** se resolvió **reformulando la evidencia** (S-RNF-02b queda
> «implementado y pendiente de medir en el puesto»), **RN-03/RN-04** se corrigieron en el código y
> **RN-05 a RN-22** quedaron resueltos o declarados con su riesgo aceptado (**D-72 a D-75**); el detalle
> está en **§10**. Además se **re-ejecutó el lente R2**, que en la primera pasada no había producido un
> pase válido: sus **13 hallazgos** de consistencia documento ↔ código están en **§11**, todos resueltos,
> verificados como falsos positivos o corregidos. Métricas finales: **150 pruebas** de módulos y
> contratos + **58 comprobaciones E2E**, sin fallos.

---

## 1. Resumen ejecutivo y veredicto

> ### VEREDICTO: **LA FASE 2 NO PUEDE CERRARSE TODAVÍA — CIERRE CONDICIONADO**
>
> El **documento técnico sí está generado y auditado** y **las 8 preguntas P1…P8 sí están resueltas** (cada una con su decisión: D-30, D-53, D-54, D-62/D-63, D-66, D-24, D-64, D-67). La base normativa está completa y es trazable: **29/29 RF** y **16/16 RNF** con módulo responsable, **14 módulos** documentados, **D-01 a D-70** registradas, **142 pruebas de módulos y contratos + 50 comprobaciones E2E en verde** (`informe_pruebas_fase4.md:17-19`). De los 10 hallazgos previos, **6 están cerrados con evidencia**, **3 necesitan verificación** y **2 son parciales**; además, la verificación adversarial hizo **sobrevivir 22 hallazgos nuevos confirmados**, entre ellos **2 de severidad crítica** y **6 altos**.
>
> **La Fase 2 no puede declararse cerrada por dos razones verificables:** (1) una **brecha activa de datos personales** — los dos repositorios que el corpus declara «privados» son **públicos** y versionan el CSV real con nombres, teléfonos, direcciones y C.I. de 51 abonados (`documento_tecnico.md:1025` vs. `api.github.com/repos/anlucorporations/GGTO`, `gitlab.com/api/v4/projects/anlucorporations%2Fggto`); y (2) el **criterio de terminado de C2 se declara verificado sin estarlo** — la prueba que acredita S-RNF-02b no reproduce el punto de medida que el propio documento fija (`documento_tecnico.md:1050` y `:1052` vs. `pruebas/pruebas_c2.mjs:47-48,161-164`).
>
> **Criterio de desbloqueo:** cerrar **RN-01** (incidente de datos, fuera de ciclo, con la acción sobre los repositorios) y las correcciones de **RN-02 a RN-07** (las de contrato, medición y legal, de esfuerzo S/M); RN-08 a RN-22 se resuelven con ediciones y ajustes de esfuerzo S/M detallados en §9. Ninguna de las 22 exige cambiar la base normativa: las recomendaciones de los verificadores **no introducen requisitos nuevos** (la única que toca un requisito se limita a sustituir «verificado» por «pendiente de medir en el puesto»).

**Conteo de hallazgos nuevos verificados:** Crítica **2** · Alta **6** · Media **10** · Baja **4** — total **22** (registro completo: RN-01 a RN-22).

**Estado de la reauditoría por dimensión:**

| Dimensión | Lente | Hallazgos verificados | Observación |
|---|---|---|---|
| R1 | Ambigüedad y testabilidad | 7 | El revisor entregó `null`; el verificador rehízo la comprobación y confirmó 7 defectos |
| R2 | Consistencia | 0 (1.ª pasada) → **13** (re-ejecutado, §11) | El revisor entregó una prueba mínima inválida; **sin pase real**. Re-ejecutado el 14/09/2026 contra el código vivo: 1 crítica, 3 altas, 4 medias y 5 bajas |
| R3 | Completitud RNF (ISO 25010) | 8 | 10 hallazgos del revisor; ninguno descartado por completo, todos fusionados/ajustados |
| R4 | Stakeholders | 0 | El revisor entregó un conjunto **vacío**; **dimensión sin revisar de origen** |
| R5 | Trazabilidad con el brief | 6 | 6 supervivientes con severidad ajustada (1 ALTA, 2 MEDIA, 3 BAJA) |
| R6 | Riesgos técnicos | 8 | 10 del revisor: 6 con igual severidad, 3 rebajados, 1 descartado |
| R7 | Seguridad y legal | 9 | 1 CRÍTICA, 2 ALTA, 3 MEDIA, 3 BAJA; 4 descartados |

---

## 2. Metodología

### Las 3 fases

| Fase | Qué se hizo | Resultado |
|---|---|---|
| **1 — Revisar** | 7 lentes en paralelo sobre `documento_tecnico.md`, con contraste contra `requerimientos.md`, `casos_uso.md`, `diccionario_datos.md`, `entornos_globales.md`, `estado_proyecto.md`, el código de `app/` y `C:\GGTO\datos` | Conjunto de hallazgos candidatos por lente |
| **2 — Verificar** | 7 verificadores adversariales, uno por lente: reabren cada cita `ruta:línea` contra el documento, el código y las pruebas; **filtran falsos positivos, deduplican y ajustan severidades con justificación** | 22 supervivientes + descartes motivados |
| **3 — Sintetizar** | Deduplicación cruzada entre lentes, IDs únicos **RN-01…RN-22**, priorización, redacción de este informe | 22 hallazgos + cierre de A-01…A-10 y P1…P8 |

### Las 7 lentes

| # | Lente | Foco |
|---|---|---|
| R1 | Ambigüedad y testabilidad | Términos vagos y criterios no medibles ni verificables en código o pruebas |
| R2 | Consistencia | Contradicciones internas documento↔código (nombres, estados, versiones, cifras) |
| R3 | Completitud RNF (ISO 25010) | Categorías de la norma ausentes y RNF sin criterio de aceptación |
| R4 | Stakeholders | Actores ausentes o sin rol definido |
| R5 | Trazabilidad con el brief | Deseos del cliente perdidos y requisitos inventados |
| R6 | Riesgos técnicos | Puntos únicos de fallo y riesgos de escala |
| R7 | Seguridad y legal | Exposición de PII, base legal del tratamiento, controles de acceso |

### Regla de descarte ante la duda

Todo hallazgo que un verificador no pudo confirmar con evidencia reproducible **se descartó** y quedó listado con su motivo; no se arrastró al informe. Se aplicó de forma estricta en dos casos de origen:

- **R2** entregó un hallazgo de prueba (`{"title":"t","detail":"d","evidence":"e"}`) sin cita `ruta:línea` ni contraste: **no hay material verificable** y la dimensión queda **sin pase real**.
- **R4** entregó un conjunto de hallazgos **vacío** (`findings: []`): no existe afirmación que verificar ni refutar, por lo que **nada puede sobrevivir** a la verificación adversarial. Conforme a la regla, no se promovió ningún hallazgo y **no se sustituyó al revisor inventando hallazgos propios**.

**Verificación de contraste de R4 (para descartar un falso negativo estructural):** los actores que la dimensión enumera **sí están tratados** en el documento — operador y supervisor en §3.3 (`documento_tecnico.md:239-251`) y §3.4 (`:253-279`); el emisor del CSV en §5.1 (`:771`) y **D-59** (`:1165`); el abonado como titular de datos personales en §8.1 (`:1024-1026`); la jefatura de central retirada expresamente como actor por **D-55** (`:1161`). El código confirma el alcance de roles: `app/js/nucleo.js:44` `ROLES: ['Operador','Supervisor']`, matriz de 22 acciones en `:311-332` y `permite()` en `:349-353`. La integridad de identificadores se comprobó: `RepoTecnico/requerimientos.md` contiene exactamente **29 RF, 16 RNF, 11 RT y 8 RN** (verificado por patrón), y D-65, D-66, D-69 y D-70 existen y coinciden.

---

## 3. Estado de calidad con métricas reales

### 3.1 Pruebas ejecutadas (Fase 4)

| Conjunto | Comprobaciones | Pasan | Fallan | Fuente |
|---|---|---|---|---|
| Pruebas de módulos y contratos (`node --test`) | **142** | **142** | **0** | `informe_pruebas_fase4.md:17` |
| Comprobación de interfaz E2E (Chrome/Edge headless sobre `index.html` real) | **50** | **50** | **0** | `informe_pruebas_fase4.md:18` |
| **Total** | **192** | **192** | **0** | `informe_pruebas_fase4.md:19` |

Defectos encontrados y corregidos en Fase 4: **7** (2 de contrato de datos, 3 de la hoja impresa, 1 de accesibilidad de funcionalidad y 1 de contradicción documental), ninguno abierto (`informe_pruebas_fase4.md:21-25`). Las 50 comprobaciones E2E incluyen la ingesta del CSV real con **56 leídas · 5 descartadas por central · 51 casos nuevos · 18 PEND + 33 GESTION** (`informe_pruebas_fase4.md:66-68`).

### 3.2 Cobertura de trazabilidad

| Verificación | Resultado | Evidencia |
|---|---|---|
| RF con módulo responsable | **29/29** | `documento_tecnico.md:731-761` |
| RNF con módulo responsable | **16/16** | `documento_tecnico.md:765-784` |
| RT tratados | 11/11 (RT-11 fuera del alcance de los módulos, tarea de entorno §7.1) | `documento_tecnico.md:785-791` |
| Módulos documentados | **14** (declarados) — el código entrega **16** (ver RN-10) | `documento_tecnico.md:76`, `:91` vs. `app/js/` (16 archivos `.js`) |
| Decisiones registradas | **D-01 a D-70** (el rango declarado en la cabecera y el anexo sigue en D-64: ver RN-09) | `documento_tecnico.md:1171-1176` |
| Requisitos derivados | S-RNF-02b declarado como derivado de CU-08 | `documento_tecnico.md:10`, `:961` |

### 3.3 Riesgos residuales que la propia Fase 4 declara

`informe_pruebas_fase4.md:111-119` deja fuera de la fase, entre otros: la prueba con los datos reales de una semana completa en el puesto (criterio de terminado de **C7**), la **impresión física**, y los **umbrales de desempeño (RNF-02, D-24) medidos con 1.000 casos** — «se miden en pruebas unitarias de lógica, no en un E2E con 1.000 casos en pantalla» → medición en el puesto. Esta declaración es coherente con RN-02, RN-08 y RN-11.

---

## 4. Cierre de la auditoría previa (A-01…A-10)

| ID | Sev. previa | Estado | Evidencia que lo cierra (decisión, línea o prueba) |
|---|---|---|---|
| **A-01** | CRÍTICA | **CERRADO** | **D-53** fija que las col. 53/80 «no se persisten» y §4.3 lo propaga: `documento_tecnico.md:1159` y `:424-425`; coherente con `requerimientos.md:102`. A-04 (col. 18) se separa y se cierra con **D-54** (`:1160`). *Hueco menor asociado:* el manifiesto real de `estructura.json` sigue sin documentarse (RN-04). |
| **A-02** | CRÍTICA | **NECESITA VERIFICACIÓN** | S-RNF-02b **sí** se incorporó como pendiente n.º 4, está asignado en §6.3 y declarado como criterio de C2: `documento_tecnico.md:1050`, `:961`, `:1065`. Pero la evidencia de cierre declarada en `:1052` («implementado y **verificado** en `pruebas/pruebas_c2.mjs`») **no reproduce el punto de medida** que el propio documento fija en `:1050`. Los verificadores de R1 y R6 **no pudieron acreditarlo**; se marca como no cerrado (RN-02), sin sustituir la afirmación por otra. |
| **A-03** | ALTA | **CERRADO** | Login con solo `P00` e intento fallido registrado: **D-57** (`documento_tecnico.md:1163`), **D-58** (`:1164`), **D-61 a D-63** (`:1167-1169`); E2E en verde: «la contraseña incorrecta **no** abre la sesión y **queda contada y registrada**» (`informe_pruebas_fase4.md:63-65`). |
| **A-04** | ALTA | **CERRADO** | **D-54** decide el destino de la col. 18 `fecha_compromiso` («no se persiste», ningún requisito la usa): `documento_tecnico.md:1160`; tabla de destinos en `:424-425`. |
| **A-05** | MEDIA | **NECESITA VERIFICACIÓN** | El recuento se corrigió a «14 módulos» con 14 filas y 14 nodos (`documento_tecnico.md:76`, `:91`), pero el código entrega **16** archivos en `app/js/` (incluidos `nucleo.js` e `ingesta_nucleo.js`), por lo que el defecto **persiste con otra cifra**. No se da por cerrado: ver RN-10. |
| **A-06** | MEDIA | **NECESITA VERIFICACIÓN** | El respaldo se documenta como **10 archivos** (`documento_tecnico.md:1007-1008`) y **D-49** lo fija (`:1155`), pero `C:\GGTO\datos` contiene **11 entradas** (los 10 más `estructura_2026-09-18_manual.bak`): el inventario real no coincide. No se da por cerrado: ver RN-11. |
| **A-07** | MEDIA | **CERRADO** | Alineación expresa de §6.1 con §6.3: «RNF-05 y RNF-11 (impresión y control documental) en `pdf.js` + `despacho.js`, **ya alineados con §6.1**» (`documento_tecnico.md:961`). |
| **A-08** | MEDIA | **CERRADO** | El corte semanal queda decidido por **D-66** (Sem 1 = primer lunes del año; semana operativa lunes–sábado) con `umbral_concentracion` editable a 3 por defecto: `documento_tecnico.md:1172` y `:562`. *Sobrevive un defecto distinto en la misma área:* exclusión de CNS sin decisión y mínimo del umbral (RN-17). |
| **A-09** | MEDIA | **PARCIAL** | El conteo de nodos se corrigió a 14 (`documento_tecnico.md:91`), pero el diagrama y la tabla de dependencias siguen declarando librerías inexistentes (nodo PAP y «jsPDF + autoTable», `documento_tecnico.md:142`, `:144`, `:189-192`) frente a un `app/lib/` con solo `chart.umd.min.js` y `jspdf.umd.min.js`: el diagrama no es la fuente fiable de dependencias que §2.4 pretende. Ver RN-09 y RN-12. |
| **A-10** | MEDIA | **CERRADO** | Nota de sincronización incorporada con la revisión de `casos_uso.md` declarada (15/09/2026) y las decisiones posteriores: `documento_tecnico.md:9-10`. *Su rango se desactualizó después:* ver RN-09. |

**Resumen:** **CERRADO 6** (A-01, A-03, A-04, A-07, A-08, A-10) · **NECESITA VERIFICACIÓN 3** (A-02, A-05, A-06) · **PARCIAL 1** (A-09).

---

## 5. Preguntas P1…P8 de la auditoría previa y decisión que las resuelve

| P | Pregunta previa | Decisión que la resuelve | Evidencia |
|---|---|---|---|
| **P1** | ¿El maestro conserva las col. 53/80 del CSV o las descarta? | **D-53** — no se persisten; el rastro de origen se limita a la col. 20 | `documento_tecnico.md:1159`, `:424-425` |
| **P2** | ¿La col. 18 `fecha_compromiso` se incorpora o se descarta? | **D-54** — no se persiste; ningún requisito la usa | `documento_tecnico.md:1160` |
| **P3** | ¿Se adopta `clave_cambio_obligatorio` en `tecnicos.json`? | **D-63** — formato de la credencial (SHA-256) y **D-62** — arranque en frío del primer supervisor | `documento_tecnico.md:1169`, `:1168` |
| **P4** | ¿Se fija el umbral S-RNF-02b (<3 s, 1.000 casos de maestro, 60 registros) o queda pendiente? | **D-24** lo alinea con RNF-02 y §8.3 lo registra como pendiente técnico n.º 4 **con punto de medida explícito** | `documento_tecnico.md:1050`, `:1130` |
| **P5** | ¿Corte de la «semana operativa» y umbral editable? | **D-66** — Sem 1 = primer lunes del año, lunes–sábado; umbral editable con 3 por defecto | `documento_tecnico.md:1172`, `:562` |
| **P6** | ¿C4 incluye la verificación formal de RNF-05 (carta horizontal)? | Criterio de terminado de **C4** con RNF-05 «verificado de forma formal» — *resuelta formalmente, pero sin volumen de referencia (RN-08)* | `documento_tecnico.md:1067` |
| **P7** | ¿El login rechaza `nombre` y registra el intento fallido, y dónde? | **D-57** (registro sin bloquear), **D-58** (log de 5 MB × 5) y **D-64** (destino `incidencias.log`, sin datos personales) | `documento_tecnico.md:1163`, `:1164`, `:1170` |
| **P8** | ¿Cuál es la ruta controlada exacta de los PDF de despacho? | **D-67** — `C:\GGTO\despachos`, carpeta autorizada aparte, verificación por relectura, sufijo `_rN`; «cierra la pregunta **P8**» | `documento_tecnico.md:1173` y `:1054` |

**Resultado: P1…P8 resueltas** (8/8). Tres de ellas (P1, P6 y P8) quedan resueltas formalmente pero arrastran defectos nuevos verificados en su misma área: RN-04 (contrato de `estructura.json`), RN-08 (RNF-05 sin volumen de referencia) y RN-15 (D-67/D-68 no propagadas a §2.2/§7.1/§5.2).

---

## 6. Tabla de hallazgos NUEVOS por severidad (solo verificados)

| ID | Sev. | Dimensión | Área | Hallazgo | Evidencia principal |
|---|---|---|---|---|---|
| **RN-01** | **CRÍTICA** | R7 | Seguridad y legal — exposición de datos personales | Los dos repositorios que el corpus declara «privados» son **PÚBLICOS** y versionan el CSV real, 3 PDF de despacho y el `.xlsm` con PII de abonados | `entornos_globales.md:391`; `requerimientos.md:108`; `documento_tecnico.md:1025`; API GitHub `"private":false`; API GitLab `"visibility":"public"`; `git ls-tree -r HEAD` |
| **RN-02** | **CRÍTICA** | R1, R6 | Ambigüedad y testabilidad / riesgos técnicos — S-RNF-02b | La prueba que acredita S-RNF-02b **no ejecuta el punto de medida declarado** (maestro y sectores vacíos, 56 filas, solo la función pura) y el pendiente n.º 4 figura a la vez como abierto y cerrado | `documento_tecnico.md:1050`, `:1052`, `:1065`; `pruebas/pruebas_c2.mjs:47-48,61,161-164`; `app/js/ingesta_nucleo.js:319,413,359-362,291-307` |
| **RN-03** | ALTA | R3, R7 | Contratos de datos / coherencia documento-código — D-65 | **D-65 no está implementada**: el código siembra 3 claves antiguas y el criterio de terminado de C2 (18 PEND + 33 GESTION) **no es reproducible en instalación nueva** (bandeja GESTION de 33 → 48 casos) | `documento_tecnico.md:559`, `:1171`; `app/js/nucleo.js:797`; `app/js/configuracion.js:765`; `C:\GGTO\datos\claves_clasificacion.json`; `pruebas/pruebas_c2.mjs:35,46` |
| **RN-04** | ALTA | R3, R5, R6 | Contratos de datos — `estructura.json` | El contrato documentado (19 campos, `version: 1`) no coincide con el real (**25 campos, `version: 2`**, `cabecera` por campo, `no_se_persisten: [18,53,80]`); el contrato inicial de un puesto nuevo (21 campos, **cero** `cabecera`) **no valida por nombre** lo que D-44 promete | `documento_tecnico.md:373`, `:377-390`, `:392-412`; `C:\GGTO\datos\estructura.json:2,210`; `app/js/ingesta_nucleo.js:104-128`; `app/js/nucleo.js:746-776`; `app/js/almacen.js:559-561` |
| **RN-05** | ALTA | R7 | Seguridad y legal — datos personales en el log | El asiento de entrega escribe el **nombre del receptor** en `incidencias.log` (texto libre), mientras cuatro afirmaciones del corpus niegan que el log tenga datos personales y la ficha de tratamiento no inventaría esa categoría | `app/js/pdf.js:171-174,196-197,208`; `app/js/despacho.js:476-477`; contra `documento_tecnico.md:288`, `:575`, `:861`, `:1170`; `diccionario_datos.md:259-270` sí lo documenta |
| **RN-06** | ALTA | R7 | Seguridad y legal — base legal del tratamiento | La ficha de tratamiento **no declara base de licitud ni plazo de conservación** por categoría, pese a que la propia base normativa derivada lo exige (H-13 sigue abierto) | `entornos_globales.md:376-394` (`:384`, `:392`, `:394`); exigido en `casos_uso.md:865`, `:1046`; antecedente `auditoria_fase1.md:108`, `:198` |
| **RN-07** | ALTA | R7 | Contratos de datos — parámetro de clasificación | `umbral_concentracion` (parámetro que decide la marca de avería concentrada de RF-26) **falta en el contrato declarado** de `claves_clasificacion.json` | `documento_tecnico.md:562`; `app/js/nucleo.js:800`; `app/js/configuracion.js:803`; contra `diccionario_datos.md:253-257` |
| **RN-08** | MEDIA | R1, R6 | RNF y verificación medible | **RNF-02** (1.000 casos / 1,5 s), **RNF-05** («volumen máximo previsto por cuadrilla», sin cifra en ningún documento) y **RNF-13** (contraste) siguen **sin medición ni valor de aceptación**, y C4/C5 se redactan como verificados | `requerimientos.md:167,170,178`; `documento_tecnico.md:1067`, `:1068`, `:1070`; `pruebas/pruebas_contratos.mjs:177-186`; `pruebas/pruebas_c4.mjs:226-234`; `informe_pruebas_fase4.md:118` |
| **RN-09** | MEDIA | R3, R5, R7 | Trazabilidad y registro de decisiones | Las cifras **14 PEND + 37 GESTION** subsisten en §1.2 y §9 contra D-38/D-65 y las pruebas (18/33); el **catálogo por defecto** de §4.5 es el antiguo; y el rango **«D-01 a D-64»** persiste en cabecera, §8.3 y título del anexo pese a que la tabla llega a D-70 | `documento_tecnico.md:36`, `:1065`, `:559`, `:9`, `:1041`, `:1103` contra `:1144`, `:1171-1176`; `pruebas/pruebas_c2.mjs:143-152` |
| **RN-10** | MEDIA | R3, R5, R6 | Arquitectura — inventario real del puesto (RT-07) | Se declaran **14 módulos** cuando el código entrega **16** (`nucleo.js` e `ingesta_nucleo.js` sin fila ni nodo), y **4 librerías** cuando `app/lib/` contiene **2**: PapaParse y jsPDF-AutoTable no existen ni se usan | `documento_tecnico.md:76`, `:91`, `:97`, `:142`, `:144`, `:187-192`, `:957`, `:1047`; `app/js/` (16 archivos); `app/lib/` (2 archivos); `app/js/pdf.js:52-165`; `app/index.html:156-162,167-168` |
| **RN-11** | MEDIA | R6 | Copia única y recuperación (§7.4, §8.1, D-49) | Un solo puesto, un solo disco y una sola copia local; el respaldo sale del equipo por un acto manual **sin verificación de salida**, la **pérdida del PC no figura en §8.1** y el RTO de 1 h no es alcanzable sin equipo sustituto | `documento_tecnico.md:975`, `:1001-1012`, `:1020-1028`, `:1155`; `app/js/nucleo.js:20-22`; `C:\GGTO\datos` (11 entradas); `pruebas/pruebas_c7.mjs:297-334` |
| **RN-12** | MEDIA | R6 | Arquitectura — lanzador y arranque (§3.1, RT-09) | Punto único de fallo del arranque: el lanzador **abre el navegador antes de arrancar el servidor** y sin Python ni Node no arranca (el modo descarga aborta en `file://`); el puerto alterno no está documentado | `servir-ggto.ps1:43-49`, `:52-56`, `:59-93`, `:23-41`, `:95-97`; `documento_tecnico.md:202-216`, `:35`, `:1064`, `:997-998`; `app/js/app.js:162-171`; `app/js/nucleo.js:23` |
| **RN-13** | MEDIA | R3 | Completitud RNF — ISO 25010 | **Cuatro categorías ISO 25010 siguen sin RNF propio** (mantenibilidad, disponibilidad/continuidad, observabilidad formal, cumplimiento legal/privacidad) y **RNF-01 no es medible** («sesión corta», sin umbral ni tasa de éxito); §6.3 audita «16 de 16 RNF» sin declarar esos huecos | `auditoria_fase1.md:189-199`, `:333`; `requerimientos.md:166`; `documento_tecnico.md:961`, `:1026`, `:1041`, `:1070` |
| **RN-14** | MEDIA | R3 | RNF-13 / accesibilidad | **RNF-13 se declara cubierta pero no tiene criterio de aceptación, verificación ni asignación** de los módulos que implementan la alternativa textual de los gráficos | `requerimientos.md:178`; `documento_tecnico.md:949`, `:1070`; `app/js/graficos.js:152,232,234`; `app/js/metricas.js:203,242-262`; `informe_pruebas_fase4.md:111-119` |
| **RN-15** | MEDIA | R3 | Coherencia normativa — diccionario de datos | El diccionario atribuye a la normalización una **tolerancia LOSS/LOS que el código no tiene** (NFD solo resuelve tildes), y es el propio archivo de configuración el que lo desmiente | `diccionario_datos.md:256`; `app/js/ingesta_nucleo.js:20-30`; `C:\GGTO\datos\claves_clasificacion.json` (campo `nota`); `pruebas/pruebas_c2.mjs:133-141` |
| **RN-16** | MEDIA | R7 | Seguridad y legal — control documental del papel | **D-67 y D-68 se citan con referencias internas que no contienen el procedimiento** (§3.5 es «Qué impide cada control», §4.7 «Contratos de operación») y el cuerpo no describe entrega→recogida→destrucción ni su constancia | `documento_tecnico.md:1173`, `:1174` contra `:281`, `:676`; `:800-801`, `:947`; `app/js/despacho.js:409-432,507-510`; procedimiento real en `entornos_globales.md:203-248` |
| **RN-17** | MEDIA | R3, R5 | Coherencia documental / pendientes | **§8.3 mezcla pendientes abiertos y cerrados**: el n.º 4 figura como abierto y como implementado, el n.º 1 sigue pidiendo versionar librerías que no se usan, y el título dice «antes de C4» cuando C4–C6 están cerrados | `documento_tecnico.md:1039`, `:1047`, `:1050` vs. `:1052`; `estado_proyecto.md:284-291`; `pruebas/pruebas_c2.mjs:161-163` |
| **RN-18** | MEDIA | R3 | Contratos de datos — ingesta (§4.7.1) | **§4.7.1 sigue declarando `telefono` y `direccion` como obligatorios bloqueantes**, contra D-69, contra `estructura.json` y contra el código (que solo rechaza `id_averia`); leerlo literalmente **rechazaría 4 de las 51 filas** del criterio de C2 | `documento_tecnico.md:685` vs. `:1175`; `C:\GGTO\datos\estructura.json` (`telefono` obligatorio, `direccion` no); `app/js/ingesta_nucleo.js:375-379`; `pruebas/pruebas_c2.mjs:130,235` |
| **RN-19** | BAJA | R6 | Riesgos técnicos — log de accesos (D-58, D-64) | Cada asiento de `incidencias.log` **relee y reescribe el archivo completo y sin protocolo de escritura verificada**: una caída a mitad de escritura puede truncar la evidencia de auditoría | `app/js/app.js:135-151` (`:138`, `:141`); `app/js/almacen.js:470-488` vs. `:309-344`; `documento_tecnico.md:564-578`, `:1036` |
| **RN-20** | BAJA | R6 | Riesgos técnicos — control documental (D-68, CU-17) | El control documental **no vive en la sesión sino en una variable de módulo** que persiste toda la página, y una recarga lo borra sin aviso: queda solo el asiento suelto del log, sin estado consolidado por cuadrilla | `app/js/despacho.js:287`, `:423`, `:472-511`, `:684-685` (sin llamadas); `documento_tecnico.md:1174`; `casos_uso.md:1264` |
| **RN-21** | BAJA | R5, R7 | RF-26 / averías concentradas (CU-20, D-25/D-66) | El código **excluye las construcciones (CNS)** del conteo de averías concentradas **sin decisión que lo respalde** y el mínimo del umbral (`min: '2'`) no admite el valor **1** que CU-20 declara válido; el corte semanal usa `ingreso \|\| fecha_reporte` sin decisión registrada | `app/js/reportes.js:72,87-88`; `app/js/configuracion.js:803,827`; `requerimientos.md:153`; `casos_uso.md:1316,1328,1338-1339,1501` |
| **RN-22** | BAJA | R7 | Documentación técnica — inventario de rutas | El árbol de §2.2 y la tabla de rutas de §7.1 **omiten `C:\GGTO\despachos`**, la cuarta carpeta autorizada y la única con datos personales impresos | `documento_tecnico.md:70-85`, `:969-977` contra `:99`, `:1173`; `app/js/nucleo.js:22`; `app/js/despacho.js:564-583`; `app/js/entorno.js:91-93` |

Además de los anteriores, los verificadores confirmaron **tres defectos de forma** que se mantienen como parte de otros hallazgos por su causa raíz común (no se listan dos veces): la cita **«CU-01-6»** que apunta al criterio equivocado —el correcto es **CU-01 CA-14**, `documento_tecnico.md:194` vs. `casos_uso.md:183`, `:192`— y la contradicción **D-68 vs. §2.3:99 y §6.3:947** («registro de entrega» persistido), ambas absorbidas por RN-16; y el **inventario de librerías** de `entornos_globales.md:63`, `:76` y `:78`, absorbido por RN-10.

---

## 7. Hallazgos críticos y altos detallados

### RN-01 — CRÍTICA · Los repositorios declarados «privados» son públicos y exponen datos personales de abonados

**Evidencia.**
- **Declaración del corpus:** `entornos_globales.md:391` («siguen versionados en los repositorios **privados** de GitHub y GitLab (D-36, D-58)»); `requerimientos.md:108` (D-58: «repositorios **privados**»); `documento_tecnico.md:1025` clasifica el riesgo como «Aceptado (D-36, H-13, P9)».
- **Verificación externa propia (HTTP 200):** `https://api.github.com/repos/anlucorporations/GGTO` → `"private":false`, `"visibility":"public"`; `https://gitlab.com/api/v4/projects/anlucorporations%2Fggto` → `"visibility":"public"`.
- **Verificación local:** `git ls-tree -r HEAD --name-only` versiona `detalle_averias_gpon 12_09_2026.csv`, `alta_manual.csv`, los tres `Despacho_Cuadrilla_*_20260911.pdf` y `CONTROL_DESPACHO_GGTO-v1.xlsm`; el `.gitignore` no los excluye (solo ignora `*.log` con excepción de los logs de pruebas, `.env`, `.tmp`, `desktop.ini` y `datos/backup/`).
- **Contenido:** el CSV tiene 80 columnas y 56 filas, 51 de la central Francisco Salias, con `nombre`, `telefono`, `direccion`, C.I. y correo: **PII de titulares identificables**. La ficha de tratamiento no la declara como categoría expuesta en un tercero.

**Impacto.** La aceptación del riesgo presupone un repositorio privado de la corporación: **el control declarado no existe** y la base de la ficha de tratamiento se apoya en un hecho hoy falso. No es un «riesgo aceptado», es una **brecha activa y verificable**. Afecta a la promesa legal del proyecto y a la validez de §8.1.

**Recomendación.**
1. Pasar **ambos repositorios a privados** y verificar con la API que devuelvan `private:true` / `visibility:private`.
2. Tratarlo como **incidente de datos personales**: identificar titulares afectados, registrarlo y consultarlo con el área legal de CANTV (la ficha ya tiene «Revisión pendiente», `entornos_globales.md:394`).
3. **Sacar los CSV/PDF/`.xlsm` reales del control de versiones** (`git rm --cached` + reglas en `.gitignore`) y sustituirlos por muestras anonimizadas. Atención: `pruebas/pruebas_c2.mjs:22` y `:32-35` leen el CSV real y `C:\GGTO\datos\claves_clasificacion.json`, así que hay que decidir dónde vive la muestra y ajustar la prueba de contrato.
4. Corregir `entornos_globales.md:391` y `requerimientos.md:108` para que la afirmación sea verificable, y reescribir `documento_tecnico.md:1025` mientras el repositorio no sea privado.

**Responsable sugerido:** Supervisor + área legal de CANTV (con apoyo del responsable del repositorio). **Esfuerzo: S** (configuración) + **M** (purga de datos y adaptación de pruebas). **Bloquea la Fase 2.**

---

### RN-02 — CRÍTICA · El criterio de terminado de C2 se declara verificado sin que la prueba reproduzca el punto de medida

**Evidencia.**
- **Lo que el documento fija:** `documento_tecnico.md:1050` establece el punto de medida —«desde el clic en *Confirmar ingesta* hasta que el resumen aparece en pantalla, con 1.000 casos de maestro y 60 registros de CSV»— y `:1065` lo eleva a **criterio de terminado de C2**; `:1052` lo declara «implementado y **verificado** en `pruebas/pruebas_c2.mjs`».
- **Lo que la prueba hace:** `pruebas/pruebas_c2.mjs:47-48` llama a `I.ingerir` con `maestro: []` y `sectores: []`; `:61` usa el archivo real de **56 filas**; `:161-164` cronometra `r.resumen.ms`, que `app/js/ingesta_nucleo.js:319` y `:413` calcula **dentro de la propia función pura**. No hay clic, no hay 1.000 casos, no hay 60 registros y no hay pintado del resumen.
- **Lo que queda fuera de la medición:** el índice de deduplicación recorre el maestro (`app/js/ingesta_nucleo.js:359-362`) y la asignación de sector recorre filas × sectores × vías con `normalizar()` por comparación (`:291-307`); con 0 sectores, `:154-158` confirma que los 51 casos quedan en cola.
- **Contradicciones internas:** en la misma página, `:1050` mantiene S-RNF-02b como pendiente n.º 4 y `:1052` afirma que «solo queda abierto el n.º 2»; `:1043` lista los 4 pendientes. `informe_pruebas_fase4.md:118` deja los umbrales de 1.000 casos como **riesgo residual no cubierto**.

**Impacto.** El cuello real de escala (maestro poblado y catálogo de sectores) no lo detecta ninguna prueba, y el criterio de aceptación de C2 se aprueba con evidencia que no le corresponde. Severidad máxima mantenida: los verificadores de R1 y R6 no encontraron evidencia en contrario.

**Recomendación.** Reescribir la prueba para replicar el punto de medida declarado (maestro sembrado con 1.000 casos, CSV de 60 registros, catálogo de sectores poblado y cronómetro desde el manejador de *Confirmar ingesta* hasta el resumen pintado) **o**, si la medición se limita a la función pura, **rebajar la afirmación de `:1052`** a «implementado, pendiente de medir en el puesto» y mantener S-RNF-02b como pendiente abierto en §8.3. **No requiere ningún requisito nuevo.**

**Responsable sugerido:** Desarrollador + analista de pruebas. **Esfuerzo: M.** **Bloquea el cierre de C2.**

---

### RN-03 — ALTA · D-65 no está implementada: el criterio de C2 no es reproducible en instalación nueva

**Evidencia.** El anexo D-65 afirma que la lista de claves por defecto «incluye **LOS ROJO** y **FALLA DE FIBRA**» (`documento_tecnico.md:1171`), pero §4.5 del mismo documento sigue publicando las tres claves antiguas (`:559`) y el código siembra esas tres (`app/js/nucleo.js:797`; `app/js/configuracion.js:765`). Medición reproducida por el verificador de R3 con Node sobre el CSV real del 12/09/2026 con `estructura.json`, `central.json` y el CSV reales: con los **defaults del código** el resultado es `{insertadas: 51, conClaves: 0, pend: 3, gestion: 48}`; con el archivo `C:\GGTO\datos\claves_clasificacion.json` (6 claves) es `{conClaves: 17, pend: 18, gestion: 33}`. `pruebas/pruebas_c2.mjs:35` y `:46` leen las claves del **archivo de datos**, no de los defaults.

**Impacto.** En un puesto recién instalado, la bandeja GESTION del día pasa de **33 a 48 casos (+45%)** y §4.7.3:708 no cubre el caso (la lista no está vacía y no hay confirmación). El criterio de terminado de C2 no es reproducible con lo que el repositorio entrega por defecto.

**Recomendación.** Fijar una sola fuente de verdad: actualizar `app/js/nucleo.js:797` y `app/js/configuracion.js:765` al catálogo de D-65 (6 claves) **o** rebajar D-65 a «catálogo configurado en `C:\GGTO\datos`», sin llamarlo valor por defecto; propagarlo a `documento_tecnico.md:559` y a `diccionario_datos.md`; y añadir a `pruebas_c2.mjs` un caso que clasifique el CSV real **con los defaults del código** (`estructurasIniciales`).

**Responsable sugerido:** Desarrollador. **Esfuerzo: S.**

---

### RN-04 — ALTA · El contrato de `estructura.json` documentado no coincide con el real y no valida por nombre en un puesto nuevo

**Evidencia.** Tres fuentes en conflicto:
1. **Documento:** `documento_tecnico.md:392-412` enumera **19 campos** y el ejemplo JSON usa `version: 1` sin `cabecera` (`:377-390`); sin embargo `:373` promete que el contrato «compara posición y **nombre**».
2. **Archivo real:** `C:\GGTO\datos\estructura.json:2` es `version 2`, con **25 campos** y `cabecera` en todos ellos; `:210` declara `no_se_persisten: [18,53,80]`. Faltan en el documento seis columnas: `fecha_reporte` (15), `fecha_cita` (19) —usada por el propio documento en `:339` y `:423`—, `ultimo_usuario` (20) —usada en `:424`—, `estatus` (27), `unidad_negocio` (61) y `Reparador Principal` (65).
3. **Código:** `app/js/ingesta_nucleo.js:118` compara el nombre **solo si `campo.cabecera` existe**; el contrato inicial que la aplicación crea en un puesto nuevo (`app/js/nucleo.js:746-776`, invocado por `app/js/almacen.js:559-561`) es `version 1`, declara 21 campos y tiene **cero** ocurrencias de `cabecera`.

**Impacto.** Agrava el riesgo ya declarado en `estado_proyecto.md:210` («el CSV diario cambia de columnas sin aviso»): su mitigación anunciada —«la ingesta valida los encabezados… y avisa antes de insertar»— **queda inerte en instalaciones nuevas**. La prueba de contrato pasa porque lee el archivo de disco (`pruebas/pruebas_contratos.mjs:39`, `:76-90`), que sí está alineado, no porque el documento o el contrato inicial lo estén. Seguir el documento produce un `estructura.json` que la ingesta rechaza por nombre de cabecera.

**Recomendación.** Alinear §4.3 con el contrato real (25 campos, `cabecera` por campo, `version 2`, `nota`, `filtro_central.claves`, `no_se_persisten: [18,53,80]`) y añadir `cabecera` a las 21 entradas de `estructurasIniciales()` para que un puesto nuevo ejecute la validación por nombre que D-44 y `:373` prometen; añadir a `pruebas_contratos.mjs` un contraste automático documento ↔ archivo ↔ contrato inicial y una prueba que altere una cabecera y exija el error tipo `nombre`.

**Responsable sugerido:** Desarrollador + responsable del diccionario de datos. **Esfuerzo: M.**

---

### RN-05 — ALTA · El log de accesos escribe el nombre del receptor mientras el corpus niega que contenga datos personales

**Evidencia.** `documento_tecnico.md:288` afirma que en el log quedan «fecha/hora, `P00` intentado y motivo, **sin datos personales**», y `:575` lo repite como fila de contrato («Datos personales | **Ninguno**»); lo mismo en D-64 (`:1170`) y §5.4 (`:861`). La implementación lo contradice: `app/js/pdf.js:171-174` compone `... | receptor=<texto libre> | p00=...` y `:208` lo envía a `ctx.registrarLog`; `app/js/despacho.js:476-477` hace lo propio con `despacho | ENTREGA HOJA | ... | receptor=...`. El propio corpus documenta ese campo en `entornos_globales.md:240` y `diccionario_datos.md:259-270`. La interfaz lo pide expresamente («¿A quién se entrega la copia impresa…?», `app/js/pdf.js:196-197`), así que puede identificar a una persona física.

**Impacto.** (a) La garantía «sin datos personales» es **falsa** en un control presentado como tal; (b) el log rota por tamaño y descarta el más antiguo (`documento_tecnico.md:581-589`) y no entra en la copia de cierre (`:579`), por lo que ese dato personal **no tiene plazo ni borrado definido**; (c) la ficha de tratamiento (`entornos_globales.md:384`) **no inventaría esta categoría**.

**Recomendación.** Elegir una vía y propagarla a los cuatro documentos: **(a)** sustituir el texto libre del receptor por un identificador no personal (P00 del receptor o «no informado»), ajustando `app/js/pdf.js:172`, `app/js/despacho.js:477` y el contrato de `entornos_globales.md:240`; **o (b)** mantener el nombre y entonces declararlo como dato tratado en `entornos_globales.md:384`, matizar las cinco afirmaciones «sin datos personales» y fijar retención y borrado del log. En ambos casos, añadir la prueba de contrato que verifique que una línea del log no contiene nombres ni teléfonos.

**Responsable sugerido:** Desarrollador + responsable de la ficha de tratamiento. **Esfuerzo: S/M.**

---

### RN-06 — ALTA · La ficha de tratamiento no declara base de licitud ni plazo de conservación

**Evidencia.** `entornos_globales.md:376-394` cubre finalidad, responsable, datos, origen, controles, trazabilidad, respaldo y derechos del titular, pero **no declara base de licitud ni plazo de conservación por categoría**: la fila «Retención» (`:392`) remite a «histórica, sin purga automática (D-28)» y la única mención procesal es «Confirmar con el área legal de CANTV la normativa aplicable» (`:394`). No es un requisito inventado por el verificador: la propia base normativa derivada lo exige —`casos_uso.md:1046` y `:865` piden que la ficha (D-28) documente «responsable, **base de licitud** y canal del titular»— y la auditoría de Fase 1 ya lo registró como **H-13** (`auditoria_fase1.md:108`, `:198`).

**Impacto.** El déficit documental persiste tras D-53 a D-70 y sostiene el riesgo legal que `documento_tecnico.md:1026` declara «Aceptado (D-28, H-13)». Combinado con RN-01 y RN-05, deja el tratamiento de datos personales sin base declarada, sin plazo y sin constancia de la categoría expuesta.

**Recomendación.** Completar la ficha con dos filas exigidas por D-28/H-13 —**base de licitud** (dato operativo de la relación contractual del abonado con CANTV, o la que confirme el área legal) y **plazo o regla de conservación por categoría**, incluyendo expresamente el PDF de despacho y el log de accesos—; dar a la ficha una **ruta propia** y citarla como artefacto versionable desde `documento_tecnico.md:1054` y `casos_uso.md:1046`.

**Responsable sugerido:** Área legal de CANTV + responsable de la ficha. **Esfuerzo: M.**

---

### RN-07 — ALTA · `umbral_concentracion` decide la marca de avería concentrada pero no está en el contrato declarado

**Evidencia.** `documento_tecnico.md:562` declara el campo `umbral_concentracion` (N, opcional, 3 por defecto, editable) en `claves_clasificacion.json`, y el código lo implementa (`app/js/nucleo.js:800`, `app/js/configuracion.js:803`; lo consume `app/js/reportes.js`). Pero `diccionario_datos.md:253-257` define únicamente `claves`, `normalizacion` y `campos_evaluados`: **el parámetro que decide cuándo un sector se marca «concentrado» (RF-26) no está en el contrato declarado del archivo**.

**Impacto.** El contrato del archivo de configuración está incompleto respecto a la funcionalidad que RF-26 exige; un implementador o auditor que reconstruya el archivo desde el diccionario pierde el umbral y la métrica queda sin parámetro gobernado.

**Recomendación.** Añadir `umbral_concentracion` (N, opcional, 3 por defecto) a `diccionario_datos.md` §5.6 y a la prueba de contrato del archivo. **No introduce requisitos nuevos:** documenta un campo ya declarado por el documento técnico y ya implementado.

**Responsable sugerido:** Responsable del diccionario de datos. **Esfuerzo: S.**

---

*(Los hallazgos medios RN-08 a RN-18 y bajos RN-19 a RN-22 se detallan en la tabla de la sección 6, con su evidencia `ruta:línea`; los diez medios no alcanzan el umbral de detalle crítico/alto y no se repiten aquí para no duplicar citas.)*

**Recomendaciones de los hallazgos medios, en una línea cada una:**

| ID | Recomendación |
|---|---|
| RN-08 | Fijar los tres umbrales antes de la prueba de puesto: número de casos por cuadrilla que define «volumen máximo» (y prueba con ese volumen), medición de RNF-02 con 1.000 casos en el maestro (queda cubierta si se siembra el maestro como pide RN-02) y medición de contraste (≥ 4,5:1, D-40) como paso explícito de la guía manual. |
| RN-09 | Corregir `:36` y `:1065` a «18 PEND + 33 GESTION (D-38, D-65)», sustituir la fila de defaults de `:559` por el catálogo de D-65 y ampliar el rango a «D-01 a D-70» en `:9`, `:10`, `:1041` y `:1103`. |
| RN-10 | Fijar el inventario desplegado («16 módulos», con `nucleo.js` e `ingesta_nucleo.js` con fila y nodo) y dejar **2** librerías reales (Chart.js 4.4.7 y jsPDF 2.5.2), retirando PapaParse y autoTable de §2.3, §2.4, §2.5, §5.1 y §6.3. |
| RN-11 | Añadir a §8.1 el riesgo «pérdida del puesto o del disco», definir en §7.4 un paso **verificable** de salida de la copia y registrar el inventario real de `datos/` (incluidos los `.bak`) en la comprobación de cierre de `entorno.js` (CU-22). |
| RN-12 | En `servir-ggto.ps1`, arrancar el servidor y **esperar a que el puerto escuche** antes de `Start-Process`, llevar la copia de §3.1 a paridad con el script real (puerto alterno y orden de intérpretes) y documentar en §7.3 el procedimiento del puesto sin Python ni Node. |
| RN-13 | Declarar formalmente en §6.3 las cuatro categorías ISO sin RNF (añadirlas con acuerdo del usuario o declararlas fuera de alcance con justificación) y dar a **RNF-01** un objetivo numérico (tiempo por tarea y tasa de éxito sin ayuda) en §6.3 y en el criterio de C7. |
| RN-14 | Añadir RNF-13 (y RNF-10/RNF-16) al criterio de terminado de C7 con la prueba explícita de teclado y contraste, sumar esas comprobaciones al E2E de `pruebas/interfaz.mjs`, asignar RNF-13 también a `graficos.js` y `metricas.js` e incluir la accesibilidad como riesgo residual declarado. |
| RN-15 | Corregir `diccionario_datos.md:256` para describir exactamente la normalización implementada (mayúsculas, sin tildes por NFD y espacios colapsados), precisar que las variantes léxicas LOSS/LOS se cubren **enumerándolas** en `claves` (D-65) y añadir la prueba unitaria que fije esa semántica. |
| RN-16 | Añadir al documento una sección propia «§5.5 Control documental del despacho (D-27, D-67, D-68)» con ruta controlada, nomenclatura `_rN`, verificación por relectura, asientos por acción y consecuencia de pérdida al recargar; corregir las referencias muertas de `:1173` y `:1174`. |
| RN-17 | Sacar de la tabla los pendientes n.º 1, 3 y 4 (dejándolos solo en la nota de cierres), retirar PapaParse/autoTable del enunciado del n.º 1 y retitular la sección conforme al ciclo realmente en curso (C7). |
| RN-18 | Reescribir la fila de §4.7.1 conforme a D-69 (único obligatorio bloqueante `id_averia`; `direccion` no bloqueante; `telefono` según `estructura.json`) y alinear el código con lo que declare el contrato. |

---

## 8. RNF faltantes y stakeholders faltantes

### 8.1 RNF faltantes (verificado)

La base normativa contiene exactamente **RNF-01 a RNF-16** (16 identificadores, sin RNF-17/18/19: `requerimientos.md:164-181`). De las categorías que `auditoria_fase1.md:189-199` declaró ausentes, ocho se cerraron con RNF-08 a RNF-16, pero **cuatro siguen sin requisito propio**:

| Categoría ISO 25010 sin RNF | Situación verificada |
|---|---|
| **Mantenibilidad** | Sin RNF de documentación de código, convenciones, estrategia de pruebas ni empaquetado, pese a 16 módulos y ausencia de paso de compilación (`app/js/`: 16 archivos) |
| **Disponibilidad / continuidad operativa** | El «modo descarga» solo se nombra dentro de RNF-03 y §3.2 (`documento_tecnico.md:235`), sin requisito ni criterio de continuidad del puesto |
| **Observabilidad formal** | El log de accesos cuelga de D-57/D-58/D-64 y de RNF-08, sin RNF propio de mensajes accionables, informe de filas rechazadas ni versión visible |
| **Cumplimiento legal / privacidad** | `documento_tecnico.md:1026` mantiene la retención indefinida «sin base legal verificada» como riesgo aceptado (D-28) |

**Defectos de medibilidad asociados (RN-08 y RN-13):** **RNF-01** no es medible («una sesión corta», sin umbral de tiempo por tarea ni tasa de éxito, `requerimientos.md:166`); **RNF-02** (1.000 casos / 1,5 s), **RNF-05** («volumen máximo previsto por cuadrilla», sin cifra en ningún documento) y **RNF-13** (contraste con herramienta automática) **no tienen medición**.

**Nota de alcance.** Crear RNF nuevos exige tocar la base normativa, lo que es **un acto de alcance del usuario y no un defecto de este documento**; lo subsanable en el documento técnico es **declarar el hueco** en §6.3 y §8.3 en lugar de auditar «16 de 16 RNF» (`documento_tecnico.md:961`) como cobertura completa y afirmar que «no hay decisiones de diseño pendientes» (`:1041`).

### 8.2 Stakeholders faltantes

**No hay hallazgos verificados de stakeholders.** El lente R4 entregó un conjunto de hallazgos **vacío**, por lo que la dimensión quedó **sin revisar de origen** y no se promovió ningún hallazgo.

Lo que **sí** se verificó como tratado: operador y supervisor (§3.3 `documento_tecnico.md:239-251`; §3.4 `:253-279`), emisor del CSV (§5.1 `:771`; D-59 `:1165`), abonado como titular de datos personales (§8.1 `:1024-1026`), jefatura de central retirada expresamente por **D-55** (`:1161`), soporte del puesto cubierto vía §7.3 (`:990-999`) y el bloque ENTORNO de `app/js/entorno.js` —sin rol de actor propio—. El código confirma los roles: `app/js/nucleo.js:44` `ROLES: ['Operador','Supervisor']`, matriz de 22 acciones en `:311-332`, `permite()` en `:349-353`.

**Observación de alcance (NO elevada a hallazgo, por falta de revisión de origen y de evidencia adversarial suficiente):** el documento asigna deberes operativos a operador y supervisor, pero **no define rol ni responsable para el soporte TI del puesto, el área legal de CANTV ni el abonado como titular con derechos**. Se deja constancia para que un **pase real de R4** lo evalúe con evidencia y severidad justificada, en lugar de arrastrarlo sin confirmar. Esto refuerza los hallazgos RN-06 (base legal) y RN-11 (soporte y continuidad del puesto).

### 8.3 Dimensiones sin pase válido (limitación declarada)

| Dimensión | Motivo | Efecto |
|---|---|---|
| **R2 — Consistencia** | El revisor entregó un hallazgo de prueba (`title:"t"`) sin cita `ruta:línea`, sin evidencia y sin contraste | No hay material verificable; **la consistencia no fue auditada en esta pasada** (los defectos de consistencia que sí afloraron llegaron por R3, R5, R6 y R7) |
| **R4 — Stakeholders** | El revisor entregó `findings: []` («Prueba mínima») | **Sin revisar de origen**; se recomienda un pase real con evidencia antes de dar la Fase 2 por cerrada |

**Limitación adicional del verificador de R3:** no pudo ejecutar la batería completa (142 + 50) en su turno; las cifras citadas provienen de la ejecución y de los logs de Fase 4 y de su propia medición puntual con Node. No se pudo confirmar la cobertura de RNF-17/18/19 porque **no existen** (verificado por grep).

---

## 9. Plan de acción

### Quick wins — esfuerzo S, sin cambio de alcance ni de requisitos

| # | Acción | Hallazgo | Responsable sugerido | Esfuerzo |
|---|---|---|---|---|
| 1 | **Pasar los dos repositorios a privados** y verificar con la API (`private:true`) | RN-01 (parte inmediata) | Supervisor / responsable del repositorio | S |
| 2 | Corregir las cifras **14/37 → 18/33** en `:36` y `:1065` y el rango **D-01 a D-70** en `:9`, `:10`, `:1041`, `:1103` | RN-09 | Redactor del documento | S |
| 3 | Reescribir la fila de §4.7.1 conforme a **D-69** (solo `id_averia` bloqueante) | RN-18 | Redactor del documento | S |
| 4 | Corregir la cita **«CU-01-6» → «CU-01 CA-14»** y unificar el formato de cita de criterios | RN-16 (absorbido) | Redactor del documento | S |
| 5 | Añadir `umbral_concentracion` al contrato de §5.6 del diccionario y a la prueba del archivo | RN-07 | Responsable del diccionario | S |
| 6 | Añadir `C:\GGTO\despachos` al árbol de §2.2 y a la tabla de rutas de §7.1 | RN-22 | Redactor del documento | S |
| 7 | Retirar PapaParse y jsPDF-AutoTable de §2.3, §2.4, §2.5, §5.1, §6.3 y del pendiente n.º 1 | RN-10 | Redactor del documento | S |
| 8 | Actualizar `app/js/nucleo.js:797` y `app/js/configuracion.js:765` al catálogo de **D-65** | RN-03 | Desarrollador | S |
| 9 | Reescribir `:1052`: sustituir «verificado» por «pendiente de medir en el puesto» | RN-02 (parte documental) | Redactor del documento | S |
| 10 | Corregir `entornos_globales.md:391` y `requerimientos.md:108` (afirmación de repositorios privados) | RN-01 | Redactor del documento | S |
| 11 | Corregir `diccionario_datos.md:256` (normalización real: NFD, sin tolerancia LOSS/LOS) | RN-15 | Responsable del diccionario | S |
| 12 | Marcar como cerrados los pendientes de `diccionario_datos.md:404-407` y unificar el metadata de git en RT-11 | RN-16 (absorbido) | Responsable del diccionario | S |

### Mejoras — esfuerzo M, antes de cerrar la Fase 2

| # | Acción | Hallazgo | Responsable sugerido | Esfuerzo |
|---|---|---|---|---|
| 13 | **Sacar CSV/PDF/`.xlsm` reales del control de versiones**, sustituirlos por muestras anonimizadas y ajustar `pruebas_c2.mjs:22,32-35` | RN-01 | Desarrollador + responsable de datos | M |
| 14 | **Reescribir la prueba de S-RNF-02b** para replicar el punto de medida (1.000 casos de maestro + 60 registros desde el clic) | RN-02 | Desarrollador + analista de pruebas | M |
| 15 | Alinear §4.3 con el contrato real (25 campos, `version 2`, `cabecera`, `no_se_persisten`) y añadir `cabecera` a `estructurasIniciales()` | RN-04 | Desarrollador + diccionario | M |
| 16 | Decidir el receptor del log: identificador no personal **o** declararlo dato tratado; propagarlo a los cuatro documentos y añadir la prueba de contrato | RN-05 | Desarrollador + ficha de tratamiento | M |
| 17 | **Completar la ficha de tratamiento** con base de licitud y plazo por categoría, y darle ruta propia versionable | RN-06 | Área legal de CANTV | M |
| 18 | Añadir el riesgo «pérdida del puesto o del disco» a §8.1 y un paso **verificable** de salida de la copia en §7.4 | RN-11 | Redactor + supervisor | M |
| 19 | Añadir al documento la sección «§5.5 Control documental del despacho» y corregir las referencias de D-67/D-68 | RN-16 | Redactor del documento | M |
| 20 | Fijar el volumen de referencia por cuadrilla y añadir la prueba con ese volumen | RN-08 | Analista de pruebas | M |
| 21 | Declarar en §6.3 las cuatro categorías ISO sin RNF y dar objetivo numérico a RNF-01 | RN-13 | Analista + usuario (alcance) | M |
| 22 | Añadir RNF-13 al criterio de C7 con prueba de teclado y contraste, y asignar `graficos.js`/`metricas.js` | RN-14 | Analista de pruebas | M |
| 23 | Corregir `servir-ggto.ps1` (esperar al puerto antes de abrir el navegador) y documentar el puerto alterno | RN-12 | Desarrollador | M |
| 24 | Reescribir el asiento del log con *append* real o aplicarle el protocolo de D-42 al rotar | RN-19 | Desarrollador | M |
| 25 | **Pase real del lente R2 (consistencia) y del lente R4 (stakeholders)** con evidencia `ruta:línea` | §8.3 | Equipo de auditoría | M |

### Roadmap — esfuerzo L, posterior al cierre o con decisión de alcance

| # | Acción | Hallazgo | Responsable sugerido | Esfuerzo |
|---|---|---|---|---|
| 26 | **Incidente de datos personales**: identificación de titulares afectados, registro y consulta legal | RN-01 | Área legal de CANTV | L |
| 27 | Decidir sobre las cuatro categorías ISO sin RNF (crear RNF-17 a RNF-20 con acuerdo del usuario o declararlas fuera de alcance) | RN-13, RN-08 | Usuario + analista | L |
| 28 | Aviso de pérdida del control documental al recargar y volcado consolidado por cuadrilla al log, o ajuste de D-68 | RN-20 | Desarrollador + analista | L |
| 29 | Registrar las decisiones sobre el conteo **CNS** y la fecha de asignación semanal de RF-26, y alinear el mínimo del umbral con CU-20 (≥ 1) | RN-21 | Usuario + analista | L |
| 30 | Añadir pruebas del parser propio (comillas escapadas y BOM), hoy sin cobertura específica | RN-18 (nota de cobertura) | Analista de pruebas | L |
| 31 | Prueba en el puesto: datos reales de una semana, impresión física, contraste y umbrales de desempeño, restauración desde medio externo | RN-08, RN-11, RN-14 | Supervisor de la central | L |

---

## 10. Criterios de aceptación para cerrar la Fase 2

La Fase 2 podrá declararse **cerrada** cuando se cumplan **todos** los criterios siguientes, verificados por diferencia (`git diff`) y sin alteración de los identificadores RF/RNF/RT/RN/D/CU:

### Bloqueantes (impiden el cierre)

1. **RN-01 resuelto:** ambos repositorios verificados como **privados** por API, PII real fuera del control de versiones y sustituida por muestras anonimizadas, y la afirmación de `entornos_globales.md:391` / `requerimientos.md:108` corregida o eliminada.
2. **RN-02 resuelto:** o bien existe una prueba que mida **exactamente** el punto de medida declarado en `documento_tecnico.md:1050` (1.000 casos de maestro + 60 registros de CSV, del clic en *Confirmar ingesta* al resumen en pantalla), o bien la afirmación de `:1052` se rebaja a «pendiente de medir en el puesto» y S-RNF-02b deja de figurar a la vez como abierto y cerrado en §8.3 (`:1043`, `:1050` vs. `:1052`).
3. **Criterio de terminado de C2 reproducible:** con el catálogo por defecto del código (instalación nueva) el CSV del 12/09/2026 produce **18 PEND + 33 GESTION** (RN-03).
4. **Contrato de `estructura.json` coherente en las tres fuentes** —documento, archivo versionado y contrato inicial— y validación **por nombre** operativa en un puesto nuevo (RN-04).
5. **A-05, A-06 y A-09 reclasificados con evidencia:** recuento de módulos igual al desplegado (**16**), inventario de respaldo igual al real (**11** entradas en `C:\GGTO\datos`, con `D-49` precisado), y diagrama/tabla de dependencias sin librerías inexistentes (RN-10, RN-11, RN-22).
6. **A-02 marcado como CERRADO con evidencia** o degradado explícitamente a pendiente abierto; no puede quedar en el estado ambiguo actual.

### De cierre documental y legal (esfuerzo S/M)

7. **RN-05 resuelto** con una de las dos vías (receptor no personal o declaración como dato tratado), con las cinco afirmaciones «sin datos personales» corregidas y prueba de contrato del log.
8. **RN-06 resuelto:** ficha de tratamiento con **base de licitud** y **plazo de conservación** por categoría, con ruta propia versionable y citable.
9. **RN-07 y RN-15 resueltos:** `umbral_concentracion` en el contrato del diccionario y normalización descrita como está implementada.
10. **RN-09 resuelto:** una sola cifra de ingesta (**18/33**) y un solo rango de decisiones (**D-01 a D-70**) en cabecera, cuerpo, §8.3 y anexo.
11. **RN-13, RN-14, RN-17 y RN-18 resueltos:** §8.3 sin pendientes duplicados ni obsoletos, cuatro categorías ISO declaradas (con RNF o fuera de alcance), RNF-01 con objetivo numérico, RNF-13 con criterio de aceptación, prueba y asignación de módulos, y §4.7.1 alineado con D-69.

### De verificación (no bloquean el cierre, sí lo condicionan)

12. **Pase real de los lentes R2 (consistencia) y R4 (stakeholders)** con hallazgos citados `ruta:línea`, o declaración expresa y firmada de que esas dos dimensiones quedan **fuera del alcance** de la Fase 2.
13. **No se introdujeron requisitos nuevos ni se alteraron identificadores**: los 29 RF, 16 RNF, 11 RT, 8 RN y D-01 a D-70 conservan su numeración y su sentido (`requerimientos.md`, verificado por patrón).
14. **Se mantienen las métricas:** 142 pruebas de módulos y contratos + 50 comprobaciones E2E en verde (`informe_pruebas_fase4.md:17-19`), sin regresiones tras las correcciones.
15. **Riesgos residuales declarados y aceptados por el usuario** con nombre y fecha, incluidos los que exigen el puesto de la central (`informe_pruebas_fase4.md:111-119`).

---

## 10. Estado de resolución al 14/09/2026

> **Sección añadida después de emitir el informe.** El veredicto de §1 y los 22 hallazgos se conservan
> como registro de lo que encontró la reauditoría; aquí se anota qué se ha corregido desde entonces.
> **Estado final: los 22 hallazgos quedan resueltos o declarados y la Fase 2 se cierra.**

### Bloqueantes

| Hallazgo | Estado | Detalle |
|---|---|---|
| **RN-01** (crítica) — repositorios declarados «privados» que son públicos con datos de abonados | **RESUELTO por decisión del usuario (D-71):** se mantiene la visibilidad **pública** y se **purgan** los archivos con datos personales | Los 6 archivos (CSV diario, `alta_manual.csv`, los 3 PDF de despacho y el `.xlsm`) salieron del índice, entraron en `.gitignore` y se **purgaron de todo el historial local** (`filter-branch` + limpieza de objetos; verificado: 0 commits los contienen y 0 de los 168 identificadores reales permanecen). Las pruebas dejaron de depender del archivo real: se versiona una **muestra anonimizada** (`pruebas/fixtures/detalle_averias_gpon_muestra.csv`, con 0 valores reales y las cifras documentadas 56/5/51 y 18 PEND + 33 GESTION) regenerable con `pruebas/herramientas/anonimizar_csv.mjs`. Además se detectaron y sustituyeron valores reales que quedaban en `pruebas_c3.mjs` y en un ejemplo de `app/js/panel.js`. **Subida:** GitHub limpio (ambas ramas). **GitLab:** rama `GGTOv1-DSH` limpia; **`main` sigue protegida** con `allow_force_push: false`, así que la reescritura fue rechazada: requiere que se permita el *force push* o se desproteja temporalmente para completar la purga. |
| **RN-02** (crítica) — el criterio de C2 se declara verificado sin medir el punto de medida | **RESUELTO por reformulación honesta de la evidencia** | El criterio de terminado de C2 (§1.3 y §9 del documento técnico) ya **no declara verificado** S-RNF-02b: se anota como **implementado y pendiente de medir en el puesto** con el punto de medida declarado (1.000 casos de maestro, 60 registros de CSV, catálogo de sectores poblado y cronómetro desde el clic hasta el resumen pintado), y la limitación consta en §8.3 (pendiente n.º 4) y en los riesgos residuales de la Fase 4. |

### De contrato de datos (código)

| Hallazgo | Estado | Detalle |
|---|---|---|
| **RN-03** (alta) — D-65 no implementada: el código sembraba el catálogo antiguo | **RESUELTO** | `nucleo.js` siembra el catálogo de D-65 (`LOS ROJO`, `FALLA DE FIBRA` y variantes) y una **prueba nueva** acredita que una **instalación nueva reproduce 18 PEND + 33 GESTION** con la semilla del núcleo. El lente **R2** encontró después un segundo frente del mismo defecto (**R2-07**, el respaldo de CONFIGURACION con 3 claves): **resuelto** con una **constante única** (`CONST.CLAVES_CLASIFICACION`) que usan la semilla y la interfaz. |
| **RN-04** (alta) — el contrato de `estructura.json` no coincide con el real y la semilla está incompleta | **RESUELTO** | La semilla pasa a ser el **contrato completo** (25 campos con `cabecera`, `version: 2`, `filtro_central` y `no_se_persisten`). El defecto era real y grave: al faltar `estatus` (col. 27), una instalación nueva **no aplicaba la precedencia de `ASGN` de D-38** y daba 17 PEND + 34 GESTION. La propagación a la documentación que quedaba pendiente la cerró el lente **R2-06**: §4.3 del documento técnico ya describe la **v2 con sus 25 campos** y una nota de versiones. |

### Resueltos o declarados en el resto del plan

| Bloque | Hallazgos | Estado |
|---|---|---|
| Contrato, permisos y datos personales | **RN-05** (el asiento de entrega escribía el receptor) → **D-73**; **RN-10** (16 archivos y 2 librerías), **RN-15**/**RN-07** (contrato del diccionario con `umbral_concentracion`), **RN-17**, **RN-18**, **RN-22** | **Corregidos** con prueba de regresión |
| Comportamiento en el puesto | **RN-08** (volumen de referencia y criterios de C4/C5), **RN-12** (el lanzador abría el navegador antes que el servidor) | **RN-12 corregido en código**; **RN-08 rebajado a «pendiente de medir»** y declarado como riesgo residual |
| Riesgos y legal | **RN-06** (base de licitud y plazo por categoría, pendiente de validación legal), **RN-11**/**RN-19** (continuidad/RTO y log sin escritura verificada) → **D-74**, **RN-N-02**, **RN-N-04** | **Declarados y aceptados** (D-74) con su constancia documental |
| Coherencia documental | **RN-09**, **RN-13**, **RN-14**, **RN-16**, **RN-21** → **D-72** | **Corregidos**; el resto de coherencia lo cerró el lente **R2** (§11) |

**Métricas tras las correcciones:** **150 pruebas** de módulos y contratos + **58 comprobaciones E2E**
en verde, sin regresiones.

---

## 11. Lente R2 (consistencia documento ↔ código) — hallazgos y resolución

> **Sección añadida después de emitir el informe.** El lente **R2** de la reauditoría se ejecutó sobre el
> documento técnico **comparándolo con el código vivo** (`app/js/*.js`, `pruebas/`, `index.html`) y con
> los archivos de `C:\GGTO\datos`. Emitió **13 hallazgos** (1 crítico, 3 altos, 4 medios y 5 bajos),
> descartó explícitamente 3 falsos positivos y marcó 2 que ya se habían corregido en paralelo. Aquí se
> anota la resolución de cada uno.

| # | Sev. | Hallazgo | Resolución |
|---|---|---|---|
| **R2-01** | Crítica | §1.2 declaraba «14 `PEND` + 37 `GESTION`» frente al **18 + 33** del resto del mismo documento, de D-38/D-65 y de las pruebas | **Corregido** en §1.2 (18 + 33, D-38/D-65) y **blindado**: la prueba `las cifras documentadas del archivo real cuadran entre sí` verifica que 51 = 18 + 33 y que 56 = 51 + 5 |
| **R2-02** | Alta | `COLUMNAS_DESPACHO` declaraba 9 columnas frente a las 15 documentadas | **Verificado como corregido**: la constante tiene las **15 canónicas en su orden** y es la lista de referencia de `filasDespacho`. Se añade la comprobación `la constante COLUMNAS_DESPACHO del módulo son las 15 canónicas` para que no vuelva a divergir |
| **R2-03** | Alta | El módulo **REPORTES no era alcanzable**: `reportes.js` se exportaba pero ninguna ruta lo renderizaba, no había sección y el E2E **fabricaba** la que faltaba | **Corregido (D-76):** REPORTES es la **sub-pestaña «REPORTES y seguimiento» de MONITOREO** (patrón de CONFIGURACION con RESPALDO/ENTORNO). El E2E **ya no fabrica secciones**: exige la sección real de cada pestaña y navega por la sub-pestaña. Añadida la prueba de contrato `REPORTES se alcanza desde MONITOREO y no como pestaña propia` |
| **R2-04** | Alta | El informe de Fase 4 y `estado_proyecto.md` daban tres totales de pruebas distintos y desgloses desactualizados | **Corregido**: una **única ejecución** como fuente (**150** módulos y contratos + **58** E2E = **208**), con el desglose real por batería en el informe, en `estado_proyecto.md` (§11, §11.2, §11.3) y en la guía (§7) |
| **R2-05** | Media | El documento afirmaba «10 archivos» en `C:\GGTO\datos` y el directorio tiene 11 (incluido un `.bak` de `estructura.json`) | **Aclarado** en §5.4 y en la guía §1: el 10 es la **lista blanca** que se copia (9 JSON + `historial.jsonl`), los `.bak` del maestro son la rotación de D-42 y una copia manual de otro archivo queda **fuera** de la copia de cierre |
| **R2-06** | Media | §4.3 describía `estructura.json` como **v1 con 19 campos**, cuando el contrato vivo es **v2 con 25 campos y `cabecera`** | **Corregido**: §4.3 muestra la **v2** (con `cabecera`, `filtro_central` y `no_se_persisten`), enumera los **25 campos** y añade una **nota de versiones** que explica qué era la v1 |
| **R2-07** | Media | El respaldo de claves de CONFIGURACION traía **3 claves** y el catálogo por defecto documentado es de **6** | **Corregido en código**: catálogo **único** en `CONST.CLAVES_CLASIFICACION`, usado por la semilla y por la interfaz; prueba `el catálogo de claves por defecto es uno solo y tiene las 6 claves de D-65` |
| **R2-08** | Media | **D-65** y **D-66** apuntaban a §§ que no contenían lo que afirmaban (§4.6/§5.2) | **Corregido**: D-65 → «§4.5 y §4.7.3»; D-66 → «§8.3, §9 y §10». Revisado el resto de referencias del anexo |
| **R2-09** | Baja | `estado_proyecto.md` declaraba 66 decisiones, «27 RF, 7 RNF, 7 RT» y el documento técnico «Pendiente», con ciclos «No iniciado» | **Corregido**: **78 decisiones** (D-01 a D-78), **29 RF, 16 RNF y 11 RT**, artefactos al día (documento técnico reauditado, informe de pruebas, guía), ciclos C1–C6 cerrados y C7 en curso, y Fase 2 cerrada |
| **R2-10** | Baja | No cuadraban los recuentos de líneas que se citaban como métrica de estado | **Corregido**: se **renuncia a citar el número de líneas** como métrica (el documento es vivo) y se fechan las cifras que se conservan |
| **R2-11** | Baja | La ubicación del metadata de git difería entre documentos y con el filesystem | **Corregido** en los tres documentos y en RT-11: verificado con `git rev-parse --git-dir`, **`.git` es un directorio** en `C:\GGTO\proyecto` y el antiguo `C:\GGTO\git\GGTO-v1.git` se conserva **solo como copia histórica** |
| **R2-12** | Baja | La tabla de Fase 2 de `estado_proyecto.md` seguía marcando los pasos 3, 5 y 6 como «En curso»/«Pendiente» | **Corregido**: los seis pasos figuran **completados** y la Fase 2 **cerrada** |
| **R2-13** | Baja | §7.2 afirmaba que el CSV y el `.xlsm` siguen versionados, contra **D-71** | **Corregido** en §7.2 y en la fila **D-36** de `requerimientos.md`: el CSV diario, `alta_manual.csv`, los PDF y el `.xlsm` **no se versionan** y se purgaron; solo se versiona la muestra anonimizada |

**Falsos positivos descartados por el propio lente (no requieren acción):** que `despacho.json` no se
escribiera (`despacho.js` lo guarda y lo verifica), los recuentos de 16 archivos `.js` / 14 módulos /
2 núcleos puros / 7 pestañas / 8 subpestañas de CONFIGURACION, y los recuentos de campos de
`averias.json` (36) y `tecnicos.json` (12).

**Criterio de cierre cumplido:** los 22 hallazgos de la reauditoría y los 13 del lente R2 quedan
**resueltos, verificados como falsos positivos o declarados con su riesgo aceptado**, la batería de
**150 pruebas de módulos y contratos** y las **58 comprobaciones E2E** pasan sin fallos, y el corpus
no conserva ninguna cifra, referencia o contrato que contradiga al código. **La Fase 2 se declara
CERRADA.**

---

*Informe emitido por el equipo de auditoría (skill `equipo-auditoria`, 3 fases). Solo lectura sobre los insumos; el presente archivo es el único artefacto escrito. No se añadió ningún hallazgo ausente de los informes de verificación de las 7 dimensiones.*
