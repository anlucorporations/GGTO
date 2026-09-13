# Reauditoría de Casos de Uso — GGTO-v1 (verificación del cierre de H-01 a H-35)

- **Proyecto:** GGTO-v1 — Página HTML de gestión de averías de la central telefónica **Francisco Salias (Área 4)**, CANTV, Venezuela.
- **Objeto reauditado (A AUDITAR):**
  - `RepoTecnico/casos_uso.md` — **1.573 líneas**, 22 casos de uso (CU-01 a CU-22), 217 criterios Gherkin y 174 restricciones EARS.
  - `RepoTecnico/casos_uso/diagramas.md` — **559 líneas**, 8 bloques Mermaid (3 de casos de uso, 3 de secuencia, 1 de estados y la vista completa).
- **Base normativa (leída, no modificada):** `requerimientos.md` (29 RF, **16 RNF**, 11 RT, 8 RN, **D-01 a D-52**, A-01 a A-18 cerradas), `casos_uso/auditoria_casos_uso.md` (informe anterior: 35 hallazgos H-01 a H-35), `diccionario_datos.md`, `entornos_globales.md`, `estado_proyecto.md`. Se consultaron además `PAGINA-GGTO-INICIAL.md` (brief) y `BRIEF-GGTO-INICIAL.md` como fuentes del usuario.
- **Fecha de la reauditoría:** 15/09/2026. **Naturaleza:** verificación del cierre de la brecha abierta por el veredicto **NO APTO** del informe anterior, tras las correcciones y las decisiones nuevas **D-42 a D-52**.
- **Metodología (skill `equipo-auditoria`, 3 fases):**
  1. **Fase 1 — Revisar:** 7 revisores en paralelo, uno por lente (R1 ambigüedad/testabilidad, R2 consistencia, R3 completitud RNF ISO 25010 y cobertura, R4 stakeholders y permisos, R5 trazabilidad con el brief, R6 riesgos técnicos y casos límite, R7 seguridad y legal). *(El orquestador `workflow` no está operativo en este checkout —falta `dsh-workflow-worker-thread/lib/worker.cjs`—, de modo que las 7 lentes se ejecutaron como agentes paralelos independientes con los mismos prompts.)*
  2. **Fase 2 — Verificar:** 3 verificadores adversariales que reabrieron **cada** afirmación contra el texto real, con la regla **«ante la duda, descartar»**. Resultado: **7 afirmaciones o cláusulas descartadas** con motivo (detalladas en §3.3) y severidades ajustadas (H-03 y H-11 bajadas de ALTA a MEDIA/BAJA).
  3. **Fase 3 — Sintetizar:** deduplicación cruzada, IDs únicos, estado hallazgo por hallazgo de los 35 anteriores y tabla de hallazgos nuevos por severidad.
- **Regla de evidencia:** toda afirmación lleva `archivo:línea`. **Numeración:** `casos_uso.md:1-1573` y `diagramas.md:1-559`, tal como los reporta el lector (**nota de compatibilidad:** el informe anterior citaba `casos_uso.md` de 1.238 líneas; al reescribirse el documento con EARS/Gherkin añadidos, las citas antiguas **no son intercambiables**). Lo que depende del puesto real o de datos no auditados se marca **necesita verificación**.
- **Alcance:** no se modificó ningún archivo de insumos; **no se leyeron** `CONTROL_DESPACHO_GGTO-v1.xlsm` ni los PDF `Despacho_Cuadrilla_*.pdf`.

---

## 1. Veredicto

> ## Veredicto: **APTO CON RESERVAS** — para pasar al documento técnico.

**Qué significa.** La brecha del informe anterior se cerró **en su mayor parte**: de los **35 hallazgos**, quedan **15 cerrados**, **17 parciales** y **3 no cerrados**; el único defecto crítico del corpus (la aritmética imposible de la clasificación) **ya no existe**, la autenticación con credencial real está especificada, los 6 supuestos fueron sustituidos, la matriz de permisos existe y los diagramas dejaron de atribuir a CU-10 una transición inexistente. **No hay ningún defecto que impida iniciar C1.**

**Por qué las reservas.** Quedan cuatro asuntos que sí afectan a la calidad de contrato de aceptación del corpus y que deben cerrarse **antes de que el documento técnico fije el modelo de datos**:

1. **D-52 contradice frontalmente CU-08, CU-15 y el diccionario** (col. 53 y 80: ¿se persisten o no?), lo que deja **tres criterios Gherkin y dos EARS inejecutables** y rompe lo que H-08 declaró resuelto. *(H-N-01)*
2. **El «modo descarga» de CU-22 elude D-50 y D-27**: sin sesión permite consultar y descargar el maestro completo con datos personales, en el mismo caso de uso cuyo CA-2 prueba que `datos/` no está publicado. *(H-N-02)*
3. **La matriz de permisos no está aplicada en CU-08 y CU-14** —justamente dos CU donde **el operador escribe**— y la tabla de actores §2 contradice la matriz, el índice y los diagramas (H-02 sigue **parcial** y las nuevas incoherencias son verificables). *(H-N-03, H-N-04, H-N-05)*
4. **Huecos de integridad y de prueba**: CU-09 escribe `averias.json` **fuera** del flujo D-42/RNF-15; la copia fechada de respaldo colisiona si hay dos respaldos el mismo día; y los flujos de **escritura verificada de CU-13/CU-14/CU-16, la reapertura de CU-12 y el cierre de jornada de CU-22** siguen sin criterio Gherkin. *(H-N-06 a H-N-12)*

**Condición de aprobación sugerida (antes del documento técnico):**
- **Bloqueante (S):** resolver H-N-01 (persistencia de 53/80 y su coherencia con D-52), H-N-02 (sesión en modo descarga), H-N-03/H-N-04/H-N-05 (permisos y actores), H-N-06 (D-42 en CU-09) y H-N-08 (nombre de la copia fechada).
- **Mejora obligatoria (M):** añadir los criterios Gherkin faltantes (**H-N-11** y **H-N-12**), regenerar las tablas §5.1/§5.2 (**H-N-16**, que mantiene **H-19 no cerrado**), y los residuos de H-03 (D-16 y el diccionario con «P00 o usuario», sin bloqueo por intentos: **H-N-07**).
- **Roadmap (L):** **H-N-22** (rangos de ejemplo que no son lunes–sábado), **H-N-27** (rango de decisiones D-51/D-52), **H-N-19** y **H-N-28** (sincronización de diagramas y de entornos), y el resto de residuos de redacción.

**Lo que NO cambia:** los 29 RF siguen cubiertos (0 huérfanos), los **RNF-01 a RNF-16 tienen CU asignado**, los 8 bloques Mermaid son sintácticamente válidos y los **casos límite del encargo están cubiertos** (detalle en §4).

---

## 2. Metodología y alcance de la verificación

### 2.1 Fase 1 — 7 lentes en paralelo

| Lente | Foco de esta reauditoría | Resultado |
|---|---|---|
| **R1** Ambigüedad y testabilidad | H-01, medibilidad de los 211/217 criterios, notación EARS, términos vagos | 0 términos vagos; 3 criterios no falsables; H-01 «casi cerrado» → verificado por V1 |
| **R2** Consistencia | H-04 (supuestos), D-42 a D-52 contra cada CU, recuentos, contradicciones internas | H-04 cerrado; D-51/D-52 ausentes; D-52 contradice CU-08/CU-15 |
| **R3** Completitud RNF (ISO 25010) | 29 RF, RNF-01 a RNF-16, H-05, H-16, H-25, H-26, H-27 | 29/29 y 16/16 con CU; sobre-declaración en §5.1 |
| **R4** Stakeholders y permisos | H-02, H-18, matriz §2.1, absorción del «administrador» | 18 de 22 CU completos; CU-08 y CU-14 en cero |
| **R5** Trazabilidad con el brief | requisitos inventados, H-19, H-20, H-32, H-35 | 0 requisitos inventados; brief intacto; tablas §5.x desalineadas |
| **R6** Riesgos técnicos y casos límite | H-06 a H-14, H-29, integridad, Mermaid, SPOF | casos límite cubiertos; huecos de D-42 y de colisión de respaldo |
| **R7** Seguridad y legal | H-03, H-12, H-13, H-28, H-31, D-50 | H-03/H-31 funcionalmente cerrados, con residuos y modo descarga |

### 2.2 Fase 2 — verificación adversarial («ante la duda, descartar»)

Los 3 verificadores reabrieron **todas** las citas con `read`/`grep`. Efecto neto:

- **Descartadas:** la afirmación de que CU-08 CA-3 no cierra en 51 (V1: `estatus` del CSV y `status` del maestro son campos distintos; la aritmética 14+37=51 sí cierra) y la de que RNF-13 «se contradice» por declararse transversal con verificación formal en 4 CU (V1/V2: el documento **distingue expresamente** transversalidad de verificación formal). V2 descartó la formulación de «H-19 no cerrado» referida a CU-10 (la fila `:1524` es D-41, no D-42) y **4 de 7 criterios** acusados de no ser medibles (`:239`, `:344`, `:445`, `:495` sí tienen cifra o resultado observable). V3 descartó que «nunca se relee el maestro» (los pasos `:541` y `:913` sí releen), que «el respaldo sin cifrado» sea incumplimiento (es decisión explícita de D-49) y que las «12 columnas» del diccionario contradigan las 15 canónicas (12 + 3 = 15).
- **Conservadas con severidad ajustada:** H-03 bajó de ALTA a **MEDIA** (puesto único en loopback, debilidad ya aceptada en la Nota 1 de §2) y H-11 de ALTA a **BAJA** (residuo documental del rótulo «escritura atómica»).
- **Confirmadas como críticas o altas:** D-52 contra CU-08/CU-15 (CRÍTICA, unánime), modo descarga sin sesión (ALTA), H-02 parcial (ALTA), tabla de actores §2 contra la matriz (ALTA) y CU-14 sin `Reparador Principal` (ALTA).

### 2.3 Métricas de la reauditoría

| Métrica | Valor |
|---|---|
| Casos de uso | 22 / 22 con actor, precondiciones, postcondiciones, trazabilidad, flujo, alternativos, Gherkin y EARS |
| Criterios Gherkin | 217 en 22 bloques; **3 no falsables** (`casos_uso.md:756, 759, 1160`) |
| Restricciones EARS | 174; **0 redactadas como acción de usuario** (sujeto «el sistema» verificado) |
| RF cubiertos | **29 / 29** (0 huérfanos, 0 CU que citen un RF inexistente) |
| RNF con CU asignado | **16 / 16** (RNF-12, RNF-13, RNF-15 y RNF-16 son nuevos) |
| Marcas `[SUPUESTO: A-xx]` | **0** en los 5 documentos citados |
| Decisiones de `requerimientos.md` ausentes del corpus | **2** (D-51 y D-52: 0 apariciones en `casos_uso.md` y `diagramas.md`) |
| Bloques Mermaid | 8 / 8 con fences equilibrados, etiquetas `"<<include>>"`/`"<<extend>>"` normalizadas |
| Casos límite del encargo | **7 / 7** con flujo alternativo + Gherkin + EARS |

---

## 3. Estado hallazgo por hallazgo (H-01 a H-35)

**Resultado: 15 CERRADOS · 17 PARCIALES · 3 NO CERRADOS (35).** En el «no cerrado» se incluye **H-33**, rotulado «REABIERTO (BAJA)» porque su defecto original (etiquetas de relación) está corregido y lo que reaparece es un defecto nuevo de la misma familia (H-N-23).
*(Un hallazgo se considera CERRADO solo si su defecto ya no es verificable en el texto; PARCIAL si el defecto original se corrigió pero queda un residuo verificable o una parte acotada sin cerrar; NO CERRADO si el contraste con el texto reprodujo el defecto.)*

### 3.1 Tabla de estado

| ID | Sev. orig. | Estado | Título | Evidencia (líneas actuales) |
|---|---|---|---|---|
| **H-01** | CRÍTICA | **CERRADO** | Cifras reales de la ingesta y bandeja de CU-13 | `casos_uso.md:33`, `:564` (14 PEND + 37 GESTION; 14+37=51), CU-13 `:843` («**37 casos**»), `:851` («el contador es **37**»), CA-1 `:872`; §5 RF-15 `:1419`, §5.4 `:1567`; `diagramas.md:328` («51 casos nuevos (14 PEND + 37 GESTION)»). *V1 descartó la objeción aritmética: `estatus` (col. 27 del CSV) y `status` (maestro) son campos distintos.* **Residuo menor → H-N-13** (`:33` dice «37 sin claves» cuando el desglose de `:564` implica 38). |
| **H-02** | CRÍTICA | **PARCIAL** | Matriz de permisos (D-35, RNF-12): existe y se aplica en 18 de 22 CU | Matriz `:61-84` + reglas R1-R5 `:86-92` + nota de roles `:50`; **CU-08** (`:520` precondición solo «sesión identificada», `:523` trazabilidad sin RNF-12/D-35, `:543-558` sin flujo de denegación, `:560-580` sin Gherkin negativo, `:582-600` sin EARS de autorización) y **CU-14** (`:900`, `:903`, `:916-926`, `:930-937`, `:941-948`) **no declaran rol en ninguna de las cuatro formas**; CU-01 y CU-22 en 3 de 4 (`:164`, `:1350`). |
| **H-03** | CRÍTICA | **CERRADO (funcional)** | Sesión con `P00` + contraseña, hash con sal y caducidad de 90 días | CU-01 `:145-152` (campos, ≥8 caracteres, SHA-256 + sal, genérico, caducidad), CA 1-7 `:169-175`, EARS `:193-196`; RNF-08 `requerimientos.md:155`; D-39 `requerimientos.md:89`. **Ningún texto afirma ya que baste el `P00`.** Residuos → **H-N-14** (D-16 `requerimientos.md:66` y diccionario `:51` siguen diciendo «P00 o usuario»; `:159` permite 3 intentos **sin bloqueo** y ningún CA lo prueba). |
| **H-04** | CRÍTICA | **CERRADO** | 0 marcas `[SUPUESTO: A-xx]` y sustituciones D-29 a D-34 aplicadas | grep `[SUPUESTO` = **0** en `casos_uso.md`, `diagramas.md`, `requerimientos.md`, `diccionario_datos.md`, `entornos_globales.md`; tabla de sustitución §5.3 `:1541-1549` y verificación mecánica `:1551`; A-05→D-30 (`:1005`, `:1015`, `:1043`), A-08→D-34 (`:1124`, `:1182`, `:1221-1224`), A-09→D-33 (`:1238`, `:1249`, `:1256`), A-10→D-32 (`:1017`, `:1039-1041`), A-11→D-29/D-39 (`:145`, `:261`), A-14→D-31 (`:399`, `:1006`, `:1072`, `:1190`). Las únicas menciones del literal son históricas (`estado_proyecto.md:256`, `documento_tecnico.md:882`). |
| **H-05** | CRÍTICA | **CERRADO** | Accesibilidad (D-40, RNF-13) con criterios verificables | CU-01 CA 15-16 `:183-184` y EARS `:200`; CU-10 CA 11-13 `:704-706` y EARS `:717`; CU-18 CA 10-11 `:1160-1161` y EARS `:1172`; CU-19 CA 9-10 `:1217-1218` y EARS `:1228`; RNF-13 `requerimientos.md:160`; D-40 `:90`. §1.13 `:39` declara la cobertura transversal y la verificación formal. *La medición real de contraste/teclado **necesita verificación** en el puesto (lo reconoce §2.1 R5 `:92`).* |
| **H-06** | ALTA | **PARCIAL** | Dirección única de include/extend, sin nodos duplicados | Las 16 relaciones de §1 (`diagramas.md:95-110`) usan una sola dirección y §2.1-§2.3 la respetan; el nodo duplicado `CU06_EXT` desapareció; etiquetas normalizadas (`:555`). **Residuo → H-N-16:** `CU05 include CU06` existe en §2.3 (`diagramas.md:242`, respaldada por `casos_uso.md:366`) y **falta en §1**; el inventario `:552` afirma que las 16 relaciones de §1 «se repiten con la misma dirección en los bloques por actor» y eso no se cumple (3 de CU-08 no aparecen en ningún bloque por actor, y §2.3 aporta una 17.ª). |
| **H-07** | ALTA | **CERRADO** | Sin transición `PEND → GESTION` atribuida a CU-10 y sin cuarto estado | `diagramas.md:471` elimina explícitamente la transición y las guardas sin dueño (`:528-533`); §4 declara tres estados (`:12`, `:470`); CU-10 solo edita `clase`/`nivel`/`tipo_abonado` (`casos_uso.md:674`) y el `ASGN` entra como `PEND` (D-38: `:565`, `:591-592`). |
| **H-08** | ALTA | **PARCIAL** | Rastro de origen de CU-15 y valor probatorio | CU-15 declara el rastro y el alcance MVP (`:966`, `:974`, `:992-993`) y CU-08 lo ingiere (`:521`, `:533`, `:575`, `:593`). **Residuo → H-N-01:** D-52 (`requerimientos.md:102`) dice que las columnas 53 y 80 **no se persisten** y que `usuario_modificacion` se inicializa con la col. 20, con lo que el rastro prometido es inexistente y tres CA quedan inejecutables; ni CU-08 (`:523`) ni CU-15 (`:961`) citan D-52. |
| **H-09** | ALTA | **CERRADO** | `id_averia` vacío, duplicado dentro del lote y prefijo `MAN-` | Flujo `:534` (bloqueante por fila), alternativos `:549-551`, CA 7-9 `:569-571`, EARS `:587-589`; CU-14 trata la colisión `MAN-` (`:921-922`, CA 2 `:931`). |
| **H-10** | ALTA | **PARCIAL** | Concurrencia sin bloqueo (D-41, RNF-14) e historial de auditoría | D-41 aplicado a todos los archivos compartidos (`:40`, `:234`, `:287`, …) con **dos ventanas simultáneas** probadas en CU-12 CA 11-13 (`:821-823`); historial inmutable sigue declarado pendiente (`:974`, `:993`, `:1560`). **Residuo → H-N-17:** los intentos fallidos y las denegaciones por rol no tienen archivo ni campo donde registrarse, pese a que `:195`, `:198` y `:1374` los exigen. |
| **H-11** | ALTA | **PARCIAL** | Escritura verificada con `.bak` ×10 y relectura (D-42, RNF-15) | D-42 redactado con `.bak` + temporal + relectura comparada + restauración en CU-08 `:558`, `:578`, `:598`; CU-12 `:793`, `:805`, `:828`; CU-13 `:868`, `:887`; CU-14 `:926`, `:948`; CU-16 `:1060`; CU-21 `:1301`; convención §1.15 `:41`; `diagramas.md:315-329`, `:372-382`. **Residuos:** CU-09 escribe `averias.json` **fuera** de §1.15 y de la lista de D-42 (**H-N-06**, `:612`, `:620`); CU-14 aplica D-42 sin declararlo en su trazabilidad (`:903`); y las menciones de «escritura **atómica**» (`:1397`, `:1565`, `:1567`; `diagramas.md:533`) prometen más de lo que D-42 especifica (**H-N-18**). |
| **H-12** | ALTA | **PARCIAL** | Respaldo al cierre en `C:\GGTO\respaldo\` con RTO 1 h y RPO del día anterior (D-49, RNF-16) | CU-21 `:1291-1304`, CA 1 `:1318`, CA 8c `:1326` (RTO 09:05→09:40, RPO del cierre anterior); convención §1.16 `:42`; RNF-16 `requerimientos.md:163`. **Residuos:** nombre `averias_AAAA-MM-DD.json` sin hora → dos respaldos del mismo día colisionan (**H-N-08**); D-27 exige que las hojas «se recogen **y destruyen**» (`requerimientos.md:77`) y CU-17 solo las recoge (**H-N-09**, `:1072`, `:1085`, `:1102`, `:1112`). |
| **H-13** | ALTA | **PARCIAL** | Retención, finalidad y base legal | D-28 mantiene retención indefinida con riesgo aceptado (`requerimientos.md:78`) y CU-12/CU-15 lo citan (`:831`, `:995`). **Residuo → H-N-10:** ningún documento nombra finalidad, base de licitud, responsable ni plazo; `casos_uso.md:831` y `estado_proyecto.md:199` afirman una «finalidad documentada» que no existe. **Necesita verificación** la base legal aplicable (política CANTV / normativa venezolana). |
| **H-14** | ALTA | **CERRADO** | CSV de solo encabezado o cuerpo malformado | Validación previa bloqueante `:527` (a-d) con «al menos 1 registro de datos»; alternativo 2d `:547` («aborta sin escribir el maestro, sin disparar el respaldo y sin confirmar»); CA 6 `:568`; EARS `:585`. |
| **H-15** | ALTA | **CERRADO** | Semántica del modo `estricta` | D-43 aplicada en CU-07 CA 5 `:499` (subcadena literal, sensible a mayúsculas y tildes, sin variantes) y en el EARS `:507`; `claves_clasificacion.json` sigue con `normalizada` por defecto (`diccionario_datos.md:199`). |
| **H-16** | ALTA | **PARCIAL** | Cifras del MONITOREO y de los reportes sin definición | El corte ya está en el «Dado» de CU-18 CA 3-4 (`:1152-1154`, con `fechaResolucion` dentro del corte). **Residuo → H-N-19:** «gestionados por día» (zona Cuadrilla, `:1131`) y «El periodo tuvo N cambios desde la última emisión» (`:1193`, `:1215`) siguen sin fórmula ni huella de comparación. |
| **H-17** | ALTA | **CERRADO** | Afirmación de cobertura de la Fase 1 | El encabezado ya no dice «atendidos o aceptados» en bloque: `:12` enumera H-10, H-28, H-21 y sus cierres, y §5.4 `:1565-1567` declara qué quedó cerrado y qué es pendiente técnico. |
| **H-18** | MEDIA | **PARCIAL** | «Soporte TI del puesto» sin rol propio | Registrado como actor secundario `:59` y presente en CU-01, CU-21 y CU-22 (con *modo descarga* y diagnóstico en CU-22 `:1355-1374`). **Residuo → H-N-05:** no tiene criterio de aceptación propio y el resto «administrador» sigue en `:1379`; además «jefe de central» actúa en CU-18/19/20 (`:1121`, `:1179`, `:1235`) sin estar en §2. |
| **H-19** | MEDIA | **NO CERRADO** | Tabla inversa §5.1/§5.2 desalineada con la línea Trazabilidad | §5.1 `:1439` se declara regenerada «desde la línea Trazabilidad» (fuente única), pero: RNF-12 «aplicado en los 22 CU» (`:1454`) con CU-08 (`:523`) y CU-14 (`:903`) sin citarlo; RNF-15 + D-42 atribuidos a CU-10 en hipótesis (`:1457`, `:1525`); D-49/RNF-16 «citada en CU-15» (`:1458`, `:1532`) cuando `:961` no lo cita; CU-22 usa D-46/D-49/RNF-16 en el cuerpo (`:1362`, `:1371`, `:1397`) sin declararlos en `:1353`; D-04 atribuido a CU-11 (`:1487`) sin respaldo en `:730`; D-22 sigue en la trazabilidad de CU-01 (`:139`) pese a declararse fuera de alcance (`:1469`, `:1505`). |
| **H-20** | MEDIA | **PARCIAL** | Atribuciones de trazabilidad sobre-declaradas | D-22 se retiró correctamente de §5.2 (`:1505`) y RT-11 se declara fuera de alcance (`:1469`), pero la fila RF-01 (`:1405`) vuelve a usar un rango («+ los CU que declaran su pestaña … CU-02 a CU-22») que incluye CU sin pestaña (**H-N-20**), y D-22 permanece en `:139`. |
| **H-21** | MEDIA | **CERRADO** | CU-09 sin precondiciones | `casos_uso.md:609` declara sesión identificada, `sectores.json` disponible y existencia de la cola de pendientes. |
| **H-22** | MEDIA | **CERRADO** | Dueño único del cierre y del camino «desde el flotante» | CU-12 es el dueño (`:775-834`) y CU-11 solo invoca el botón (`:739`); `diagramas.md:101` fija `CU12 include CU11`. **Residuo → H-N-11:** el CA 8 de CU-12 (`:818`) prueba que se *ofrece* reabrir, no el paso a `GESTION` con la marca «Reapertura DD/MM/AAAA hh:mm por &lt;operador&gt;» del flujo 1a (`:804`). |
| **H-23** | MEDIA | **CERRADO** | Salida de reportes conforme a D-34 (sin XLSX, Sem 1 a Sem 36) | CU-19 postcondición `:1182`, pasos 2-5 `:1189-1192`, flujos 1a y 4b `:1198`, `:1202`, CA 1-5 `:1209-1213`, EARS `:1222-1224`; CU-18 asume la zona semanal (`:1124`, `:1134`, `:1158`). |
| **H-24** | MEDIA | **CERRADO** | Lista canónica de columnas del despacho | 15 columnas enumeradas en CU-17 postcondición `:1072`, paso 2 `:1079`, CA 2 `:1099` y EARS `:1109`; CU-19 `:1190`; diccionario §2 `:84-88` (12 del fuente + 3 de D-31 = 15). No queda ninguna mención vigente de «12 columnas». |
| **H-25** | MEDIA | **PARCIAL** | Flujos alternativos sin criterio que los pruebe | Cerrados los que el informe anterior listaba en CU-08 (5b `:567`, 12a vía 15 `:577`, 12c vía 15c `:578`, 2c `:556`, 6a `:580`), CU-12 7a `:805`, CU-20 4a/7a `:1271`. **Residuo → H-N-11/H-N-12:** siguen sin criterio la escritura verificada de CU-13 5b (`:868`), CU-14 7b (`:926`) y CU-16 (`:1060`); la reapertura de CU-12 (`:804`); «Número equivocado» (`:861`), «Enum inválido» (`:862`), «bandeja vacía» (`:864`) y «contraseña caducada» (`:866`) de CU-13; el fallo de PDF de CU-17 (`:1091`); y tres criterios no falsables (`:756`, `:759`, `:1160`). |
| **H-26** | MEDIA | **PARCIAL** | Restauración y contingencia sin criterio | CU-21 quedó cubierto (CA 7 `:1324` respaldo previo, CA 8c `:1326` RTO/RPO, CA 8b `:1327` conflicto). **Residuo → H-N-12:** en CU-22 no hay criterio para el día «sin ingesta» (D-46, `:1362`) ni para la verificación del cierre (`:1363`); el modo descarga sí está probado (CA 3 `:1380`, CA 6 `:1383`) y el log solo se prueba en el fallo de escritura (CA 7 `:1384`). |
| **H-27** | MEDIA | **PARCIAL** | Umbrales de desempeño con punto de medida y alcance | Puntos de medida explícitos: CU-08 CA 14 `:576` (1.000 casos / CSV de 60, &lt;3 s desde el clic), CU-10 CA 1-2 `:693-694`, CU-18 CA 1 `:1150`. **Residuo → H-N-21:** el derivado S-RNF-02b no está registrado en la tabla de RNF de `requerimientos.md` (§5) y §5.1 `:1478` pide «confirmación del usuario» mientras §5.4 `:1559` lo declara pendiente técnico. |
| **H-28** | MEDIA | **PARCIAL** | Prueba de no-exposición de `datos/` por HTTP | CA-2 de CU-22 **ya es discriminante** (`:1379`: `Get-NetTCPConnection -LocalPort 8787` y 404 sobre `127.0.0.1`, no la IP del equipo). **Residuo → H-N-22:** `entornos_globales.md` mantiene la opción alterna sirviendo la raíz (`:109`), `datos/` dentro del árbol (`:46`, `:128-129`) y `RUTA_DATOS = ./datos/` (`:138`), contra D-15/D-19/D-49, y no registra `C:\GGTO\respaldo\`. |
| **H-29** | MEDIA | **NO CERRADO** | Filtro por rango sobre un campo de texto | CU-15 paso 5 (`:969`) filtra «por rango de fechas y por operador» y CA 6 (`:985`) usa 01/09/2026–13/09/2026 sobre `fecha_modificacion`, que `diccionario_datos.md:52` declara **TEXTO** `DD/MM/AAAA hh:mm`; no hay comparador, parseo ni formato de orden declarado (riesgo real: `13/09/2026` &lt; `05/10/2026` en orden lexicográfico) y tampoco se fija el formato exacto que compara D-41 (`casos_uso.md:40`). |
| **H-30** | MEDIA | **PARCIAL** | §1.8/§1.9/§5.3 y rango de decisiones desactualizados | §5.3 se reescribió como «Decisiones aplicadas en lugar de supuestos» (`:1537-1551`) y §1.8/§1.9 declaran las 18 ambigüedades cerradas (`:34-35`). **Residuo → H-N-15:** el rango declarado sigue siendo «D-01 a D-50» (`:8`, `:35`) y §5.2 termina en D-50 (`:1533`), con D-51 y D-52 vigentes en `requerimientos.md:101-102`. |
| **H-31** | MEDIA | **CERRADO** | «Modo consulta» anónimo eliminado | D-50 aplicado: CU-11 `:750` zanja el modo anónimo, CU-10 `:686`, CU-18 `:1145`, CU-19 `:1205`, CU-20 `:1260` y el EARS de CU-01 `:203-204`; `requerimientos.md:100`, RNF-08 `:155`. El «modo consulta global de solo lectura» que subsiste (`:164`, `:660`) es de una sesión **ya identificada** sin cuadrilla. **Residuo → H-N-02:** el modo descarga de CU-22 reabre una vista sin sesión. |
| **H-32** | BAJA | **PARCIAL** | Recuentos del encabezado | «8 RN», «29 RF», «16 RNF», «11 RT» ya son correctos (`:8`, y contrastados con `requerimientos.md:140, 163, 181, 196`). **Residuo:** el rango de decisiones → **H-N-15**. |
| **H-33** | BAJA | **REABIERTO (BAJA)** | Etiquetas y coherencia de relaciones en los diagramas | Las tres etiquetas con comilla faltante están normalizadas (`diagramas.md:555`) y no hay nodos duplicados; **pero** reaparece un defecto de la misma familia: `diagramas.md:242` (`CU05 include CU06`) no está en §1 ni en el inventario `:552` → **H-N-16**. |
| **H-34** | BAJA | **CERRADO** | Numeración de los 8 bloques Mermaid | Encabezado `:15` enumera los 8 bloques y la tabla §5 (`:539-548`) los referencia con la misma numeración; los 8 fences están equilibrados y las etiquetas de relación son uniformes. |
| **H-35** | BAJA | **PARCIAL** | Alcance del control de cobertura | §5.1 lleva nota de método y RT-11 se declara fuera de alcance (`:1439`, `:1469`). **Residuo → H-19/H-N-23:** §5.2 no tiene estado por fila y su nota de verificación (`:1535`) declara un contraste con la línea Trazabilidad que varias filas desmienten. |

### 3.2 Los 16 puntos de verificación del encargo

| # | Punto del encargo | Resultado |
|---|---|---|
| 1 | **H-01** cifras reales y bandeja 37 | **CERRADO.** `casos_uso.md:33`, `:564` (14+37=51), CU-13 `:843`/`:851`/`:872`, `diagramas.md:328`. El CA-3 cierra en 51; `estatus` (CSV) y `status` (maestro) son campos distintos (V1). Residuo de redacción en H-N-13. |
| 2 | **H-02** matriz en los 22 CU y absorción del «administrador» | **PARCIAL.** Matriz §2.1 `:61-84`; 18/22 CU con los 4 elementos; CU-08 y CU-14 sin ninguno. «Administrador» absorbido (`:50`, `:125`; `diagramas.md:10`, `:211`), con resto en `:1379`. |
| 3 | **H-03** `P00` + contraseña 8+, hash y sal, 90 días, sin textos «basta el P00» | **CERRADO en lo funcional.** CU-01 `:145-152`, `:169-175`, `:193-196`. Residuos en D-16 (`requerimientos.md:66`) y diccionario `:51` («P00 o usuario»), y 3 intentos sin bloqueo (`:159`) → H-N-14. |
| 4 | **H-04** cero `[SUPUESTO: A-xx]` y D-29 a D-34 en paso, Gherkin, EARS y trazabilidad | **CERRADO.** grep = 0; §5.3 `:1541-1551`; verificado A-05→D-30, A-08→D-34, A-09→D-33, A-10→D-32, A-11→D-29, A-14→D-31. |
| 5 | **H-05** accesibilidad en CU-01, CU-10, CU-18, CU-19 y tabla de RNF | **CERRADO.** `:183-184`, `:200`; `:704-706`, `:717`; `:1160-1161`, `:1172`; `:1217-1218`, `:1228`; RNF-13 `requerimientos.md:160`. |
| 6 | **H-06/H-07** dirección única, sin nodos duplicados, sin PEND→GESTION sin dueño, 8 Mermaid válidos | **H-07 CERRADO** (`diagramas.md:471`, `:528-533`); **H-06 PARCIAL:** falta `CU05 include CU06` en §1 (`diagramas.md:242` vs `:95-110`) y el inventario `:552` no se cumple. Los 8 bloques son válidos. |
| 7 | **H-08** coherencia CU-08 ↔ CU-15 y D-52 | **PARCIAL / contradicción abierta:** D-52 (`requerimientos.md:102`, cols. 53/80 no persistidas; col. 20 inicializa `usuario_modificacion`) contra CU-08 (`:521`, `:533`, `:575`, `:593`), CU-15 (`:958`, `:966`, `:981`, `:992`) y `diccionario_datos.md:292` → **H-N-01 (CRÍTICA)**. |
| 8 | **H-11/H-12/H-13** D-42/RNF-15, D-49/RNF-16, D-41/RNF-14 | **D-41 CERRADO** (dos ventanas, CU-12 CA 11-13 `:821-823`); **D-42 PARCIAL** (CU-09 fuera del flujo → H-N-06; rótulo «atómica» → H-N-18); **D-49 PARCIAL** (colisión de nombres → H-N-08); D-27 sin destrucción de hojas → H-N-09; D-28 sin ficha de tratamiento → H-N-10. |
| 9 | **Casos límite** (CSV solo encabezado, `id_averia` vacío, duplicados del lote, colisión `MAN-`, escritura fallida, sesión sin identificar, dos ventanas) | **7/7 CUBIERTOS** (detalle en §4): `:527`/`:547`/`:568`; `:534`/`:549`/`:569`; `:534`/`:550`/`:570`; `:921-922`/`:931`; `:554`/`:577`/`:597`; `:43`/`:186`/`:686`; `:821-823`. |
| 10 | **Decisiones nuevas D-43 a D-50** sin contradicción con ningún CU | **SÍ, con una excepción:** D-43 (`:499`, `:507`), D-44 (`:529`, `:545`, `:567`), D-45 (`:165`, `:185`, `:202`), D-46 (`:556`, `:599`), D-47 (`:924`, `:936`, `:946`), D-48 (`:1006`, `:1020`, `:1059`, `:1156`), D-49 (`:1292-1336`), D-50 (`:43`, `:186`, `:203-204`) son coherentes **salvo** D-52, que contradice CU-08/CU-15/diccionario, y **D-50 contra el modo descarga de CU-22** (`:1361`). |
| 11 | **Cobertura** 29 RF y RNF-01 a RNF-16 | **29/29 RF** (0 huérfanos) y **16/16 RNF** con CU asignado y trazabilidad (verificado por inventario automático de las 22 líneas Trazabilidad). |
| 12 | **Testabilidad** cifras en Gherkin y EARS como restricciones | 217 criterios, **3 no falsables** (`:756`, `:759`, `:1160`); 0 EARS redactadas como acción de usuario; 174 restricciones en los cinco patrones EARS. |
| 13 | **D-52** col. 20 / cols. 53-80 | **Contradicción verificada** → H-N-01. |
| 14 | **D-51** | Fuera del alcance funcional (ubicación del proyecto), pero **no declarada** en §5.2 ni en §1.9: el rango sigue en D-50 → H-N-15. |
| 15 | **D-44** umbral de ingesta | **CERRADO:** binario, sin umbral porcentual (`:529`, `:545`, CA 5b `:567`). |
| 16 | **D-46** CSV ausente | **CERRADO en CU-08** (`:556`, `:599`) y en `diagramas.md:269-273`; **sin criterio Gherkin** en CU-08 y CU-22 → H-N-12. |

### 3.3 Descartado en la Fase 2 (falsos positivos filtrados)

| Afirmación descartada | Motivo |
|---|---|
| «CU-08 CA-3 no cierra en 51» / «11+3+37 ≠ 51» | `estatus` (col. 27 del CSV) y `status` (maestro) son campos distintos; 11+3+37 = 51 y 14+37 = 51 (`casos_uso.md:535`, `:564`; `diccionario_datos.md:45`). |
| «CU-10 no menciona la relectura ni RNF-15» y «D-42 se atribuye a CU-10» | La fila `:1524` es **D-41**; D-42 está en `:1525` y **no** incluye CU-10; CU-10 declara RNF-15 y D-42 en `:663` y ordena persistir y releer en `:675`/`:711`. Lo que falta en CU-10 es el flujo `.bak` (recogido en dirección contraria como H-N-21). |
| «§5.1/§5.2 citan D-49 en CU-14/15/22 y eso es falso» | `:923` (CU-14), `:995` (CU-15) y `:1371` (CU-22) **sí** citan D-49/RNF-16 en el cuerpo; lo que falta es la mención en las líneas Trazabilidad de CU-15 (`:961`) y CU-22 (`:1353`). |
| «RNF-13 se contradice por declararse transversal con verificación formal en 4 CU» | `:39` y `:1455` distinguen expresamente cobertura transversal de verificación formal. |
| «Los criterios `:239`, `:344`, `:445` y `:495` no son medibles» | Tienen cifra o resultado observable («los 10 campos» y relectura; el total del padrón/catálogo no cambia; tres conteos + lista de `id_averia`). Solo `:756`, `:759` y `:1160` carecen de cifra o mensaje. |
| «Nunca se relee el maestro tras reemplazarlo» | CU-08 paso 12 (`:541`), CU-14 paso 7 (`:913`) y `diagramas.md:326` releen el archivo escrito. |
| «D-49 incumple por copiar los 9 JSON sin cifrado» | «Sin cifrado» es decisión explícita de D-49 (`requerimientos.md:99`) y está declarada en `casos_uso.md:1300`, `:1335`; no hay omisión. |
| «Las 12 columnas del diccionario contradicen las 15 canónicas» | `diccionario_datos.md:84-88` tiene 15 filas = 12 del fuente + 3 de D-31, y coinciden con `casos_uso.md:1079`. D-31 sí está reflejado. |
| «CU-21 se contradice con D-36 por «sin rotación»» | Los 10 `.bak` son del camino de escritura del maestro y la copia de D-49 es manual/a oferta; D-36 actualizado remite a D-42/D-49 (`requerimientos.md:86`). Queda solo la imprecisión de redacción (no elevada). |

---

## 4. Casos límite del encargo: cobertura verificada

| Caso límite exigido | Estado | Evidencia |
|---|---|---|
| **CSV de solo encabezado** | **Cubierto** | Validación previa `casos_uso.md:527(c)`; flujo 2d `:547`; CA 6 `:568`; EARS `:585`; `diagramas.md:274-276` |
| **`id_averia` vacío o solo espacios** | **Cubierto** | Flujo `:534`; alternativo 5b `:549`; CA 7 `:569`; EARS `:587` |
| **Duplicados dentro del lote** | **Cubierto** | Flujo `:534` (solo la primera aparición, con número de fila); 5c `:550`; CA 8 `:570`; EARS `:588` |
| **Colisión de `MAN-`** | **Cubierto** | Ingesta la rechaza por reserva de prefijo (`:534`, 5d `:551`, CA 9 `:571`, EARS `:589`); alta manual rechaza el candidato y sugiere el consecutivo libre (5a `:921`, 5b `:922`, CA 2 `:931`, EARS `:942`) |
| **Escritura fallida** | **Cubierto** | CU-02 6a `:231`; CU-08 12a `:554` + CA 15 `:577` + EARS `:597`; CU-12 7a `:805`; CU-13 5b `:868`; CU-14 7a `:923`; CU-16 9a `:1029`; CU-17 5a `:1091`; CU-21 3a `:1308`; CU-22 CA 7 `:1384`. *(Sin criterio propio: CU-13, CU-14 y CU-16 → H-N-11)* |
| **Sesión sin identificar** | **Cubierto** | D-50 en §1.17 `:43`; CU-01 CA 8 y 18 `:176`, `:186`; CU-09 `:640`; CU-10 1a `:686`; CU-11 `:750`; CU-18 1b `:1145`; CU-19 1c `:1205`; CU-20 1b `:1260`. *(Excepción: modo descarga de CU-22 → H-N-02)* |
| **Dos ventanas simultáneas** | **Cubierto** | CU-12 CA 11-13 `:821-823` (conflicto, Recargar y Sobrescribir con conservación de ambos cierres); D-41 en `:40` y en cada CU que escribe; `diagramas.md:396-399` |

---

## 5. Hallazgos nuevos por severidad

**Totales: 1 CRÍTICO · 5 ALTOS · 17 MEDIOS · 7 BAJOS (30 hallazgos nuevos consolidados: H-N-01 a H-N-30; H-N-31 es informativo y se detalla fuera de la tabla, en §6).**
La columna «Origen» identifica la lente que lo detectó (R1-R7) y el verificador que lo sostuvo (V1-V3); los descartados en Fase 2 **no** figuran.

### 5.1 CRÍTICA

| ID | Título | Evidencia | Impacto y recomendación |
|---|---|---|---|
| **H-N-01** | **D-52 contradice CU-08, CU-15 y el diccionario: las columnas 53 y 80 del CSV no se persisten, pero tres CA y dos EARS exigen conservarlas y mostrarlas** | `requerimientos.md:102` (D-52) vs `casos_uso.md:521`, `:533`, `:575`, `:593` (CU-08), `:958`, `:966`, `:981`, `:992` (CU-15); `diccionario_datos.md:292` las declara «rastro de origen» y su §1 (`:19-56`) **no tiene campos** para ellas; D-52 no aparece en `:523` ni `:961` | **Ruptura entre la decisión vigente y el contrato de aceptación:** un implementador que siga D-52 incumple 2 criterios Gherkin y 1 EARS de CU-08 y el CA-2 de CU-15; el «Dado» de `:981` es hoy inejecutable. Además `casos_uso.md:912`/`:934` inicializan `usuario_modificacion` con el operador de la sesión, no con la col. 20 como manda D-52. **Recomendación:** decidir una sola versión (persistir 53/80 como campos del maestro, o retirar 53/80 de CU-08/CU-15 y del diccionario dejando solo la col. 20 → `usuario_modificacion`) y citar D-52 en las trazabilidades de CU-08 y CU-15. **Requiere decisión del usuario.** |

### 5.2 ALTA

| ID | Título | Evidencia | Impacto y recomendación |
|---|---|---|---|
| **H-N-02** | El **modo descarga** de CU-22 permite consultar y descargar el maestro completo sin sesión, eludiendo D-50 y D-27 | Precondición `casos_uso.md:1350` («sesión identificada … para las acciones de escritura»), paso 5 `:1361` (consultar el maestro y guardar el JSON completo), `:1372`; contra §1.17 `:43`, CA-18 `:186`, RNF-08 `requerimientos.md:100` y D-27 `:77` («no a Descargas»); la trazabilidad `:1353` no cita D-50/RNF-08 | Es la **única ruta que elude D-50**: sin identificación se ven nombre, teléfono y dirección de los abonados, y la copia completa sale a la carpeta de Descargas sin borrado ni registro. **Recomendación:** exigir identificación válida antes de habilitar el modo descarga, restringir los campos visibles, fijar destino controlado y añadir el CA «sin sesión no se carga el maestro». |
| **H-N-03** | **H-02 sigue parcial:** CU-08 y CU-14 no declaran rol en ninguna de las cuatro formas (precondición, flujo de denegación, Gherkin negativo, EARS), y son dos CU donde **el operador escribe** | CU-08: `:520` (precondición), `:523` (trazabilidad sin RNF-12/D-35), `:543-558` (sin 1a), `:560-580` (sin negativo), `:582-600` (sin EARS de autorización); CU-14: `:900`, `:903`, `:916-926`, `:930-937`, `:941-948`. CU-01 y CU-22 cubren 3 de 4 (`:164`, `:1350`) | Sin estos cuatro elementos no puede probarse ningún caso negativo de permisos en la ingesta ni en el alta manual; la afirmación de §5.1 `:1454` («aplicado en los 22 CU») es hoy inexacta. **Recomendación:** añadir a CU-08 y CU-14 la precondición de rol (con la excepción ya decidida: el operador puede ingerir y dar de alta), el flujo «acción no permitida», un Gherkin negativo y el EARS de autorización; completar el flujo literal en CU-01 y la precondición de rol en CU-22. |
| **H-N-04** | La tabla de actores §2 contradice la matriz §2.1, el índice §3 y los diagramas | `casos_uso.md:54` (operador «CU-08 a CU-14», que **incluye CU-13**, prohibido en `:72`, asignado al supervisor en `:114` y con precondición de supervisor en `:843`); `:55` (supervisor «CU-01 a CU-07, CU-10 a CU-22», que **excluye CU-08 y CU-09**, permitidos en `:70-71` y en `:517`); `:81` atribuye el «cambio de umbral» a CU-21 cuando es de CU-20 (`:1237`, `:1247`; D-25 en `:1508`); `diagramas.md:68-86` y `:183-193` no dibujan `SUP --- CU14` | La tabla de actores es la primera pieza que lee el desarrollador: con CU-13 incluido en el alcance del operador y CU-08/CU-09 excluidos del supervisor, la asignación de pestañas y permisos queda ambigua justo en tres CU del MVP. **Recomendación:** derivar la columna «Casos de uso» de §2 desde §2.1, mover el umbral a CU-20 y añadir (o retirar) la relación `SUP --- CU14` en los dos bloques de diagramas. |
| **H-N-05** | CU-14 no asigna `Reparador Principal` ni `fecha_asignacion` pese a que la matriz promete que el caso «se crea para su cuadrilla»; tampoco lo hace CU-08 con los casos que ingiere | `casos_uso.md:69` (matriz) vs postcondición `:901`, pasos `:905-914` y CA `:930-937`; `:521` (postcondición de CU-08) y `:668` (ámbito de visibilidad del operador en CU-10); `diccionario_datos.md:25`, `:56` | Un operador que ingiere 51 casos o crea uno manual **no ve ninguno** después: quedan sin `Reparador Principal`, de modo que el ámbito por cuadrilla de CU-10/CU-11/CU-12 los excluye. **Recomendación:** asignar en el paso 6 de CU-14 el `Reparador Principal` = cuadrilla del operador (o vacío explícito si no tiene) con `fecha_asignacion` (D-37, D-48), declarar en CU-08 la regla de visibilidad de los recién ingeridos y probarlo con un CA de ámbito. |
| **H-N-06** | CU-09 escribe `averias.json` **fuera** del flujo D-42/RNF-15 y CU-14 no declara D-42 en su trazabilidad | CU-09 `:612` (trazabilidad solo con D-41), `:620` («escribe `averias.sector`, relee el archivo»), `:639`, `:651`; §1.15 `:41` (lista de CU que aplican D-42) y §5.2 `:1525` no incluyen CU-09; CU-14 `:903` (trazabilidad sin D-42/RNF-15) frente a `:926` y `:948` | Hay un camino de escritura del maestro sin `.bak`, sin archivo temporal y sin comparación, contra RNF-15 y contra la propia nota de verificación `:1535`; la asignación de sector es una operación de uso diario. **Recomendación:** añadir CU-09 a §1.15 y a la fila de D-42, dotarlo de EARS y CA de escritura verificada, y completar la trazabilidad de CU-14. |

### 5.3 MEDIA

| ID | Título | Evidencia | Impacto y recomendación |
|---|---|---|---|
| **H-N-07** | El bloqueo tras intentos fallidos **no existe** en el corpus (y la fuente sí lo pedía) | `casos_uso.md:159` (3 intentos «antes de volver al paso 3», sin bloqueo); CA 3, 4 y 10 (`:171`, `:172`, `:178`) solo llegan a 1 intento; `BRIEF-GGTO-INICIAL.md:101` («tiene hasta 3 intentos y después se bloquea»); residuos «P00 o usuario» en `requerimientos.md:66` (D-16) y `diccionario_datos.md:51` | El control de fuerza bruta se perdió entre el brief y la especificación; el dominio «P00 o usuario» admite texto libre en el campo de auditoría, contra D-29 y RNF-09. **Recomendación:** definir el bloqueo (temporal o por supervisor) con su CA, o justificar el no bloqueo con el control compensatorio ya anotado en §2 Nota 1 (`:94`); reescribir D-16 y el diccionario a «`P00`». |
| **H-N-08** | La copia fechada de respaldo colisiona si hay dos respaldos el mismo día | `casos_uso.md:1299` («Respaldar ahora», a demanda), `:1300` y `:1318` (`averias_AAAA-MM-DD.json`), `:1335`; sin `_HHMM` (a diferencia del `.bak` de D-42) | Dos corridas del mismo día sobrescriben la copia anterior sin aviso ni versionado, y la restauración se vuelve irreversible (la copia consumida no se conserva). **Recomendación:** añadir hora o consecutivo al nombre, o exigir confirmación y conservar la anterior; registrar qué copia se consumió. |
| **H-N-09** | Nadie destruye las hojas del despacho, como exige D-27 | `requerimientos.md:77` («se recogen **y destruyen** al cierre del día») vs `casos_uso.md:1072` (postcondición: solo «se recogen»), `:1085` (paso 8), `:1102` (CA 5), `:1112` (EARS); grep de «destru» en `RepoTecnico/`: solo D-27 | El control documental del PDF —mitigación del riesgo de datos personales— queda **sin cerrar en la práctica**: las hojas con nombre, dirección y teléfono pueden salir del puesto y no volver. **Recomendación:** añadir paso, EARS y CA de destrucción registrada («Hojas destruidas: 3 de 3 cuadrillas») y su asiento con operador y hora. |
| **H-N-10** | La «finalidad documentada» de D-28 no existe en ningún documento | `casos_uso.md:831` y `:995` («con finalidad documentada»), `estado_proyecto.md:199` («se documenta finalidad y responsable»); ningún archivo nombra finalidad, base de licitud, responsable ni plazo | Se afirma una documentación inexistente sobre datos personales de abonados y trabajadores; el riesgo está aceptado (D-28) pero la afirmación no se sostiene. **Recomendación:** redactar la ficha de tratamiento (finalidad, base, responsable, plazo, canal del titular) o cambiar `:831`/`:995`/`estado_proyecto.md:199` por «riesgo aceptado, sin documento de tratamiento». **Necesita verificación** la política de CANTV y la normativa aplicable. |
| **H-N-11** | Flujos de **escritura verificada** y de **reapertura** sin criterio Gherkin | Sin criterio: CU-13 5b `:868`, CU-14 7b `:926`, CU-16 EARS `:1060`, CU-12 reapertura `:804` (el CA 8 `:818` solo prueba que se *ofrece* reabrir), CU-13 4b/5a/2a/1b (`:861`, `:862`, `:864`, `:866`), CU-17 5a `:1091` | Los flujos donde más se arriesga el trabajo del día (fallo de la copia previa, restauración del respaldo, reapertura con conservación de la resolución anterior) no están protegidos por ninguna prueba de aceptación. **Recomendación:** un criterio por flujo, con el estado del maestro y el conteo de registros antes y después. |
| **H-N-12** | El «sin ingesta» (D-46) y el cierre de jornada de CU-22 no tienen criterio | `casos_uso.md:1362` (sin ingesta + `datos/incidencias.log`), `:1363` (última escritura, último respaldo, errores del día); CA de CU-22 `:1378-1385` (el modo descarga sí está cubierto en `:1380` y `:1383`) | D-46 es una decisión nueva y el caso más probable en la operación diaria (el archivo no llega), pero ningún criterio prueba que el día quede marcado, que el maestro anterior no se altere ni que la novedad se registre. **Recomendación:** añadir CAs de «sin ingesta» y del resumen de cierre, y definir formato y rotación del log. |
| **H-N-13** | `clave_cambio_obligatorio` no se evalúa al iniciar sesión | `diccionario_datos.md:152` (campo) y `casos_uso.md:271`, `:274`, `:307` (CU-03 lo marca) vs CU-01 `:150`, `:162`, `:174-175` (solo caducidad por 90 días) | Un restablecimiento de contraseña del supervisor quedaría vigente **indefinidamente**: el técnico opera con la contraseña temporal sin cambiarla, y el control de D-39 se degrada. **Recomendación:** añadir en CU-01 el paso, el EARS y el CA de `clave_cambio_obligatorio = SI` (mismo flujo del paso 9) y declararlo en su trazabilidad. |
| **H-N-14** | Dos EARS del mismo CU-01 ordenan cosas distintas al expirar la sesión | `casos_uso.md:202` (D-45: reingreso «para cualquier acción de **escritura**») y `:165` vs `:187` (CA-19: se ocultan tabla, conteos y gráficos) y `:204` (ocultar «de inmediato») | Un implementador puede dejar viva la **consulta** tras la expiración, contradiciendo D-50/RNF-08 y el propio CA-19. **Recomendación:** unificar `:165` y `:202` con `:187`/`:204`: la expiración devuelve al diálogo de acceso y no deja ningún dato visible. |
| **H-N-15** | CA-12 de CU-01 enumera pestañas que no existen | `casos_uso.md:180` («habilita CASOS, PANEL e INGESTA» / «no habilita … ni RESPALDO») vs `:153` (las 7 pestañas reales) y `requerimientos.md:110` (RF-01); INGESTA es un bloque de CU-08 (`:530`) y RESPALDO un bloque de CU-21 (`:1298`) | El criterio de permisos de la sesión no es ejecutable contra la interfaz y sugiere un armazón distinto del decidido en RF-01. **Recomendación:** reescribir el CA-12 con las 7 pestañas reales y mencionar INGESTA/RESPALDO como bloques. |
| **H-N-16** | Trazabilidad y tablas §5.x desalineadas (H-19 sigue vivo) | RNF-12 «aplicado en los 22 CU» `:1454` vs `:523` y `:903`; RNF-15/D-42 a CU-10 en hipótesis (`:1457`, `:1525`); D-49/RNF-16 «citada en CU-15» (`:1458`, `:1532`) vs `:961`; CU-22 sin D-46/D-49/RNF-16 en `:1353`; D-04 atribuido a CU-11 (`:1487`) sin respaldo en `:730`; D-22 aún en la trazabilidad de CU-01 (`:139`) | Las tablas son el instrumento de control de cobertura del documento y su propia nota de método (`:1439`, `:1535`) declara un contraste línea a línea que varias filas desmienten. **Recomendación:** regenerar §5.1/§5.2 desde las 22 líneas Trazabilidad (fuente única), añadir columna de estado por fila y quitar D-22 de `:139`. |
| **H-N-17** | Los intentos fallidos y las acciones denegadas no tienen dónde registrarse | `casos_uso.md:195`, `:198`, `:1374` ordenan registrarlos; RNF-09 (`requerimientos.md:156`) promete operador y fecha/hora por cambio; el maestro solo conserva `usuario_modificacion`/`fecha_modificacion` (`diccionario_datos.md:51-52`) y el historial inmutable sigue pendiente (`:974`, `:993`, `:1560`) | La cadena de auditoría que exige el control de acceso (RNF-12) queda sin destino para el evento más relevante: la denegación y el intento no autorizado. **Recomendación:** definir el archivo de registro (JSONL append-only) como requisito, con formato, retención, responsable y criterio de inalterabilidad. |
| **H-N-18** | Se atribuye a D-42 una «escritura atómica» que D-42 no promete | `casos_uso.md:1397`, `:1565`, `:1567`; `diagramas.md:533`; D-42 (`requerimientos.md:92`) solo especifica respaldo previo, temporal, relectura comparada y restauración; el reemplazo del maestro no está especificado (`diagramas.md:320`) | Promesa documental por encima del diseño: ante una interrupción durante el reemplazo, el maestro podría quedar a medias. **Recomendación:** sustituir «escritura atómica» por «escritura verificada con respaldo previo» y especificar el reemplazo (rename o relectura final del maestro) y el diagnóstico «última escritura confirmada» en CU-22. |
| **H-N-19** | Diagramas sin D-45 ni D-50: no hay rama de expiración de sesión ni guarda de «nada visible sin sesión» | `diagramas.md:5` (la revisión solo menciona D-42 y D-46), ausencia total de D-45/D-50 y de «expira»/«sesión» en los 8 bloques | Las dos decisiones nuevas de mayor impacto de interfaz no están en el mapa: ni la secuencia de acceso/expiración ni el bloqueo de renderizado sin identificación. **Recomendación:** añadir la secuencia de CU-01 (acceso → expiración/cierre → ocultar datos) y citar D-45/D-50 en el encabezado. |
| **H-N-20** | «Jefe de central» actúa en 3 CU y no existe en la tabla de actores; «Auditoría / control interno» tiene una función que la matriz le prohíbe | `casos_uso.md:1121`, `:1179`, `:1235` (jefe de central) vs §2 `:52-59` y `diagramas.md` (no aparece); `:58` atribuye CU-15 y CU-17 a auditoría, pero CU-15 exige rol supervisor (`:958`) y la matriz solo tiene dos roles (`:63`, `:82`) | El actor que consume las cifras no tiene rol ni permisos definidos, y el de control interno no puede ejercer su función declarada. **Recomendación:** registrar ambos (con rol de solo lectura para auditoría) o retirarlos de los CU. |
| **H-N-21** | «Gestionados por día» y «cambios desde la última emisión» siguen sin fórmula ni huella | `casos_uso.md:1131` y `:1169` (solo define «asignados por día»), `:1193` y `:1215`; `requerimientos.md:114` (RF-05) | Cifras no reproducibles en MONITOREO y en el reporte: dos ejecuciones pueden dar valores distintos y ningún probador puede decidir si el número es correcto. **Recomendación:** definir la fórmula, el campo de fecha y la huella de comparación de la reemisión; añadir un caso negativo con cierres de días anteriores. |
| **H-N-22** | Cuatro «Dados» de ejemplo usan un rango que no es la semana operativa lunes–sábado | `casos_uso.md:1151` (08/09–13/09/2026 «6 puntos: lunes…sábado»), `:1210` (misma semana), `:1254` y `:1265` (CU-20) vs RN-08 (`requerimientos.md:196`) y el EARS `:1165`. **Calendario verificado: 08/09/2026 = martes y 13/09/2026 = domingo** | Los criterios se contradicen a sí mismos: el rango citado abarca martes–domingo, de modo que no puede producir «lunes…sábado y ningún punto de domingo». **Recomendación:** sustituir por 07/09–12/09/2026 (lunes a sábado) y añadir un caso negativo sobre el corte del domingo. |
| **H-N-23** | El inventario de relaciones de `diagramas.md` es incorrecto en los dos sentidos | `diagramas.md:242` (`CU05 include CU06` en §2.3, respaldada por `casos_uso.md:366`) ausente de §1 (`:95-110`) y del inventario `:552`, que afirma que las 16 relaciones de §1 «se repiten con la misma dirección en los bloques por actor»; a su vez, `CU08 include CU02/CU06/CU07` (§1) no aparece en ningún bloque por actor | La vista canónica no es cerrable y la afirmación de coherencia de H-06 no se sostiene: el lector no puede saber si la dependencia CU-05 → CU-06 existe en el modelo. **Recomendación:** añadir la arista a §1 (o retirarla de §2.3) y recalcular el inventario con el número real de aristas por bloque. |

### 5.4 BAJA

| ID | Título | Evidencia | Recomendación |
|---|---|---|---|
| **H-N-24** | Tres criterios Gherkin no son falsables (sin cifra, mensaje ni campo esperado) | `casos_uso.md:756` («muestra la ficha del caso»), `:759` («la ficha se abre con normalidad») y `:1160` («los mismos valores … que el gráfico»). *Las otras 4 acusaciones fueron descartadas por V2.* | Reescribir con los campos, la cifra y el mensaje literal esperados. |
| **H-N-25** | `casos_uso.md:33` cuadra mal el desglose «con/sin claves» del encabezado | `:33` dice «37 sin claves» pero `:564` informa 1 registro `ASGN` **sin** claves (serían 13 con claves y 38 sin ellas); el documento mezcla «`estatus` del CSV» y «`status` del maestro» en la misma frase | Rotular «`estatus` del CSV» y cuadrar el desglose (13/38) sin tocar los 14 PEND + 37 GESTION. |
| **H-N-26** | CU-11 tiene dos flujos alternativos rotulados «5a» | `casos_uso.md:748` («el caso ya está `CERRADO`») y `:751` («pérdida de la sesión», además después de 1a `:750`) | Renumerar (p. ej. 5b) y revisar CU-15 y CU-20. |
| **H-N-27** | D-51 y D-52 no aparecen en el corpus y el encabezado declara «D-01 a D-50» | `casos_uso.md:8`, `:35`; §5.2 termina en D-50 (`:1533`); grep «D-5[12]» = **0**; `requerimientos.md:101-102` | Actualizar el rango, añadir la fila de D-51 (fuera del alcance de los CU, como D-22/RT-11) y la de D-52 con sus CU, y fechar la revisión. |
| **H-N-28** | `entornos_globales.md` mantiene la raíz servida, `datos/` en el árbol y `RUTA_DATOS = ./datos/` | `entornos_globales.md:109` (opción B sirve `$raiz`), `:46` y `:128-129` (árbol con `datos/`), `:138` (`RUTA_DATOS = ./datos/`); no registra `C:\GGTO\respaldo\` | Llevar la opción B a `--directory $app`, sacar `datos/` del árbol, fijar `RUTA_DATOS = C:\GGTO\datos\` y añadir la ruta de respaldo (D-19, D-49). |
| **H-N-29** | El diccionario sigue rezagado respecto de A-04/D-52 y del resto de decisiones | `diccionario_datos.md:189` («numeración por precisar, A-04» con A-04 cerrada en `requerimientos.md:221` y D-52 fijando texto único); `:51-52` (origen «Manual» de los campos de auditoría, que la ingesta inicializa) | Corregir §4.5 a «texto único (D-52)» y alinear §1/§7 con D-52. |
| **H-N-30** | Uso de identificadores de auditoría (H-xx) como etiquetas de requisito dentro de los CU | `casos_uso.md:767`, `:1257` («[H-19]»), `:1373`, `:1393` («[H-20]») y `:1391` («[H-25]»); §1.3 `:24` solo legitima RF/RNF/RT/RN y D-xx | Declarar la convención (H-xx = origen del hallazgo) o sustituir esas marcas por el requisito aplicable. |

---

## 6. RNF y stakeholders: estado

**RNF (ISO 25010).** Los 16 RNF tienen CU asignado y verificable. Estado de las categorías:

| Categoría | Estado tras la reauditoría |
|---|---|
| Usabilidad, portabilidad, impresión, integridad, formato, nomenclatura | **Cubiertas** (RNF-01 a RNF-07, con criterios en varios CU) |
| Seguridad y control de acceso | **Parcial:** RNF-08 y RNF-12 existen (D-39, D-50, matriz §2.1), pero faltan el bloqueo por intentos (H-N-07), el registro de denegaciones (H-N-17) y el cierre del modo descarga (H-N-02) |
| Accesibilidad | **Cubierta** en RNF-13 con 11 criterios verificables en CU-01/CU-10/CU-18/CU-19; el resto de CU con formularios depende de la declaración transversal (verificación en el puesto: **necesita verificación**) |
| Integridad ante concurrencia y de escritura | **Parcial:** RNF-14 cerrado (dos ventanas probadas); RNF-15 con el hueco de CU-09 (H-N-06) |
| Respaldo y recuperación | **Parcial:** RNF-16 con RTO/RPO y prueba en C7, pero con colisión de nombres (H-N-08) y sin traslado externo verificado (**necesita verificación** en el puesto) |
| Observabilidad / log | **Sin RNF propio:** el log se exige en un EARS de CU-22 (`:1393`) y en D-46, sin formato, rotación ni retención, y solo se prueba en el CA de fallo de escritura (`:1384`) |
| Mantenibilidad | **Sin RNF:** la única traza es el EARS de versiones fijadas de `lib/` (`:1394`) y el pendiente 5 de §5.4 (`:1563`) |
| Cumplimiento legal / privacidad | **Riesgo aceptado (D-28) sin control aterrizado:** falta la ficha de tratamiento (H-N-10) y persiste la exposición documental de datos personales en el paquete de respaldo y en los artefactos versionados (H-N-31, más abajo) |

**Stakeholders.**

| Actor | Estado |
|---|---|
| Operador de la central, Supervisor (absorbe la función administrativa) | **Registrados** con matriz de permisos (§2.1) y aplicados en 18 de 22 CU |
| Cuadrilla / técnico de calle | **Cubierto:** actor secundario `:56`, entrega y recogida en CU-17 (`:1101-1102`) y `CUA` en `diagramas.md:417`, `:454-461` |
| Emisor del CSV | **Parcial:** declarado (`:57`), pero el escalamiento cuando el archivo no llega sigue como pendiente técnico sin responsable ni canal (`:1562`) |
| Soporte TI del puesto | **Parcial:** registrado (`:59`), sin criterio de aceptación propio y con el resto «administrador» en `:1379` |
| Auditoría / control interno | **No viable como está:** se le atribuye CU-15/CU-17 (`:58`) pero no existe rol de auditoría y CU-15 exige rol supervisor (`:958`) |
| Jefe de central | **Ausente de la tabla de actores** aunque actúa en CU-18, CU-19 y CU-20 (`:1121`, `:1179`, `:1235`) |

**H-N-31 (informativo, fuera del alcance documental — necesita verificación).** El repositorio de trabajo versiona y publica artefactos con datos personales: los **6 archivos** `detalle_averias_gpon 12_09_2026.csv`, `alta_manual.csv`, `CONTROL_DESPACHO_GGTO-v1.xlsm` y los 3 PDF `Despacho_Cuadrilla_*` están **rastreados por git** (verificado con `git ls-files` en `C:\GGTO\proyecto`), el `.gitignore` **no** los excluye y `entornos_globales.md:170-171` publica los remotos de GitHub y GitLab con dos ramas cada uno. D-36 acepta el riesgo «hasta revisar con el área legal», pero **no se ha verificado** si los repositorios son privados ni su historial: **necesita verificación** (fuera del alcance de los cinco documentos auditados).

---

## 7. Plan de acción

### Quick wins (S — menos de 1 día, sin decisión pendiente)

| # | Acción | Hallazgo |
|---|---|---|
| 1 | Reescribir el CA-12 de CU-01 (`:180`) con las 7 pestañas reales y mencionar INGESTA/RESPALDO como bloques | H-N-15 |
| 2 | Renumerar el segundo flujo «5a» de CU-11 (`:751`) | H-N-26 |
| 3 | Corregir los 4 rangos de fecha martes–domingo por 07/09–12/09/2026 en CU-18, CU-19 y CU-20 (`:1151`, `:1210`, `:1254`, `:1265`) | H-N-22 |
| 4 | Quitar «ni rotación» de CU-21 paso 2 (`:1299`) y sustituir «escritura atómica» por «escritura verificada con respaldo previo» (`:1397`, `:1565`, `:1567`; `diagramas.md:533`) | H-N-18 |
| 5 | Sustituir «el administrador del puesto» por «Soporte TI del puesto» (`:1379`) y quitar D-22 de la trazabilidad de CU-01 (`:139`) | H-N-16, H-N-20 |
| 6 | Actualizar el rango de decisiones a D-01 a D-52 en `:8` y `:35` y añadir las filas D-51/D-52 a §5.2 | H-N-27 |

### Mejoras (M — 1 a 3 días, requiere completar y verificar)

| # | Acción | Hallazgo |
|---|---|---|
| 7 | Añadir a CU-08 y CU-14 la precondición de rol, el flujo «acción no permitida para su rol», un Gherkin negativo y el EARS de autorización; completar CU-01 y CU-22 | H-N-03 |
| 8 | Derivar la columna «Casos de uso» de §2 desde §2.1, mover el «cambio de umbral» a CU-20 y añadir `SUP --- CU14` a los diagramas | H-N-04 |
| 9 | Asignar `Reparador Principal`/`fecha_asignacion` en CU-14 y declarar la visibilidad de los casos recién ingeridos en CU-08, con CA de ámbito | H-N-05 |
| 10 | Incorporar CU-09 al flujo D-42/RNF-15 (§1.15, EARS, CA y trazabilidad) y completar la trazabilidad de CU-14 | H-N-06 |
| 11 | Regenerar §5.1/§5.2 desde las 22 líneas Trazabilidad, con columna de estado por fila | H-N-16 |
| 12 | Añadir los criterios Gherkin de escritura verificada (CU-13 5b, CU-14 7b, CU-16), de la reapertura de CU-12 y de los flujos de error de CU-13 y CU-17 | H-N-11 |
| 13 | Escribir los CA de «sin ingesta» y del cierre de jornada de CU-22, y definir formato y rotación del log | H-N-12 |
| 14 | Añadir el paso/EARS/CA de `clave_cambio_obligatorio = SI` en CU-01 y unificar los EARS de expiración con el CA-19 | H-N-13, H-N-14 |
| 15 | Añadir hora o consecutivo al nombre de la copia fechada, o confirmar antes de sobrescribir | H-N-08 |
| 16 | Añadir paso, EARS y CA de destrucción de hojas en CU-17 | H-N-09 |
| 17 | Reescribir `:756`, `:759` y `:1160` con campos, cifra y mensaje; cuadrar el desglose 13/38 de `:33` | H-N-24, H-N-25 |
| 18 | Reescribir D-16 (`requerimientos.md:66`) y `diccionario_datos.md:51` a «`P00`», y decidir el bloqueo por intentos con su CA | H-N-07 |

### Roadmap (L — decisiones de usuario o trabajo de especificación)

| # | Acción | Hallazgo |
|---|---|---|
| 19 | **Decidir** la persistencia de las columnas 53/80 y propagar D-52 a CU-08, CU-15 y el diccionario | **H-N-01 (CRÍTICA)** |
| 20 | **Decidir** la regla de sesión/visibilidad del modo descarga y el destino de la copia (D-50/D-27) | **H-N-02** |
| 21 | Redactar la ficha de tratamiento (finalidad, base, responsable, retención) o degradar formalmente D-28 | H-N-10 |
| 22 | Sincronizar `diagramas.md` con D-45 y D-50 (secuencia de CU-01) y `entornos_globales.md` con `--directory app`, `C:\GGTO\datos` y `C:\GGTO\respaldo\` | H-N-19, H-N-28 |
| 23 | Definir el registro append-only de intentos fallidos y denegaciones (RNF-09 + RNF-12) | H-N-17 |
| 24 | Cerrar la cobertura de observabilidad, mantenibilidad y privacidad con RNF propios, y decidir sobre la exposición de los artefactos con datos personales | §6, H-N-31 |

---

## 8. Preguntas para el usuario (agrupadas de 3 en 3)

**Bloque 1 — El rastro de auditoría y la decisión D-52 (cierra H-N-01 y H-N-16).**
1. **P1.** D-52 dice que las columnas 53 (`usuario_acciona`) y 80 (`Fecha Hora Asignacion`) del CSV **no se persisten** y que `usuario_modificacion`/`fecha_modificacion` se inicializan con la **col. 20** y la fecha de ingesta. CU-08 y CU-15, en cambio, conservan y muestran las tres columnas (col. 20, 53 y 80) y tres criterios Gherkin dependen de ello. **¿Cuál es la regla vigente?** (a) se persisten las tres columnas en el maestro (y se corrige D-52); (b) solo se persiste la col. 20 como `usuario_modificacion` inicial y se retiran 53/80 de CU-08 y CU-15 (y del diccionario §1/§7).
2. **P2.** Si se adopta la opción (b): ¿se acepta que **se pierde** el rastro de quién accionó el caso en el origen (`usuario_acciona`) y **desde cuándo** estaba asignado (`Fecha Hora Asignacion`), que son justamente los datos con valor probatorio ante un reclamo?
3. **P3.** Al restaurar un respaldo, ¿debe quedar registro **inmutable** de qué copia se consumió (y de quién la restauró)? Hoy CU-21 registra la restauración pero no impide que la copia se sobrescriba al día siguiente.

**Bloque 2 — Permisos, ámbito y personal sin cuadrilla (cierra H-N-03, H-N-04 y H-N-05).**
4. **P4.** Con D-35, la bandeja GESTION es exclusiva del supervisor y la ingesta está permitida al operador: **¿el operador que ingiere o crea casos manuales debe verlos**, aunque todavía no tengan `Reparador Principal`? Si sí, ¿se le asignan automáticamente a su cuadrilla (`Reparador Principal` + `fecha_asignacion`) o se define un estado «sin asignar» visible para él en solo lectura?
5. **P5.** La matriz de permisos tiene dos roles y la tabla de actores atribuye al operador «CU-08 a CU-14» (que incluye CU-13, prohibido) y al supervisor «CU-01 a CU-07, CU-10 a CU-22» (que excluye CU-08/CU-09, permitidos): **¿confirmamos que la fuente única es la matriz §2.1** (y que §2 se regenera desde ella, incluida la relación `SUP → CU-14` que falta en los diagramas)?
6. **P6.** ¿Quién ejerce la función de **«jefe de central»** que consume las cifras de MONITOREO y reportes, y qué rol tiene? ¿Y **«auditoría / control interno»**? (hoy CU-15 exige rol supervisor: si la auditoría debe consultar por separado, hace falta un tercer rol de solo lectura).

**Bloque 3 — Integridad de escritura y respaldo (cierra H-N-06, H-N-08 y H-N-17).**
7. **P7.** CU-09 escribe `averias.sector` en `averias.json` **sin** el flujo D-42 (respaldo previo, temporal, relectura comparada). **¿Se extiende RNF-15 a todos los CU que escriben el maestro (CU-09 incluido)** o se acepta que la asignación de sector no lo requiera, dejándolo declarado?
8. **P8.** El respaldo fechado se llama `averias_AAAA-MM-DD.json` y el supervisor puede ejecutarlo varias veces al día: **¿se añade hora/consecutivo al nombre, o se exige confirmación y se conserva la copia anterior** para no perder la versión que se quiere preservar?
9. **P9.** RNF-09 y RNF-12 exigen registrar los intentos fallidos y las acciones denegadas, pero el maestro solo guarda el último cambio. **¿Se implementa el registro append-only (JSONL) en el MVP** para cierres, reclasificaciones, intentos y denegaciones, con retención y responsable?

**Bloque 4 — Operación diaria, control documental y datos personales (cierra H-N-02, H-N-07, H-N-09, H-N-10 y H-N-31).**
10. **P10.** El **modo descarga** (sin servidor local) permite consultar el maestro y descargarlo completo **sin identificación** y a la carpeta de Descargas, contra D-50 y D-27. **¿Se exige la misma sesión `P00` + contraseña antes de habilitarlo** (y un destino controlado), o se acepta como modo degradado de emergencia con un control compensatorio documentado?
11. **P11.** El brief pedía **bloqueo tras 3 intentos fallidos** y D-27 pedía **destruir las hojas** del despacho al cierre: ninguna de las dos cosas está hoy en los casos de uso. **¿Se incorporan ambas** (con su criterio de aceptación y registro en la interfaz) o se desechan formalmente?
12. **P12.** D-28 acepta la retención indefinida y afirma que «se documenta finalidad y responsable», pero **no existe ese documento**. ¿Se redacta la ficha de tratamiento, y qué hacemos con los CSV/PDF/`.xlsm` con datos personales que están **versionados y publicados** en los repositorios (verificado con `git ls-files`)?

---

*Informe emitido por el equipo de auditoría (skill `equipo-auditoria`): 7 revisores en paralelo → 3 verificadores adversariales → síntesis. Todos los hallazgos con evidencia `archivo:línea` reverificada; los no confirmados se descartaron y se listan en §3.3. No se modificó ningún archivo de insumos durante la reauditoría; el único archivo escrito es este informe.*
