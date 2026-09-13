# Auditoría del Documento Técnico — GGTO-v1

- **Proyecto:** GGTO-v1 — Página HTML de gestión de averías, central Francisco Salias (Área 4), CANTV.
- **Documento auditado:** `RepoTecnico/documento_tecnico.md` (982 líneas, v1, 13/09/2026).
- **Base normativa:** `requerimientos.md` (29 RF, 16 RNF, 11 RT, 8 RN, D-01 a D-52), `diccionario_datos.md` (36 campos, `despacho.json` de 15 columnas, `estructura.json` posicional, 6 archivos de configuración), `entornos_globales.md`, `casos_uso.md` (22 CU), `casos_uso/diagramas.md`, `estado_proyecto.md`.
- **Método:** skill `equipo-auditoria` en 3 fases — Fase 1 (7 lentes en paralelo: ambigüedad/testabilidad, consistencia, completitud RNF ISO 25010, stakeholders, trazabilidad con el brief, riesgos técnicos, seguridad y legal); Fase 2 (verificación adversarial por dimensión contra el texto real, con la regla *ante la duda, descartar*); Fase 3 (síntesis priorizada).
- **Alcance:** solo lectura y verificación documental. No se modificó ningún insumo. No se leyeron `CONTROL_DESPACHO_GGTO-v1.xlsm` ni los PDF `Despacho_Cuadrilla_*.pdf`. La única escritura es este informe.
- **Evidencia:** cada hallazgo cita `archivo:línea`. Lo no verificable se marca como tal; no se inventaron hallazgos.

---

## 1. Resumen ejecutivo y veredicto

> ### VEREDICTO: **APTO CON RESERVAS** para iniciar el ciclo C1

El documento técnico es sólido, verificable y trazable: los 29 RF y los 16 RNF tienen módulo responsable, los 11 RT están tratados, las 52 decisiones figuran en el anexo con resumen correcto, los contratos de datos del maestro y de `despacho.json` coinciden campo a campo con `diccionario_datos.md`, los 12 módulos cubren los ciclos C1–C7, las librerías son locales y no hay CDN, y las reglas vigentes de los procedimientos (validación bloqueante de 80 columnas, `ASGN`→`PEND`, cierre bloqueante, desempate D-32, escritura verificada D-42, conflicto D-41) están recogidas.

Las reservas son acotadas y localizadas:

1. **Una contradicción de contrato de datos (Crítica)** sobre el destino de las columnas 53 y 80 del CSV: el documento declara que «no se persisten» (§4.3) mientras la convención 15 de `casos_uso.md` y el paso 4 de CU-08 ordenan **conservarlas** como rastro de origen. Afecta a C2, no a C1.
2. **Un requisito derivado sin tratar (Crítica)**: el umbral de desempeño propio de la ingesta (**S-RNF-02b**) figura como pendiente técnico en `casos_uso.md` §5.1/§5.4 y no aparece en §8.3 del documento técnico. Afecta a C2 y a la verificación de RNF-02.
3. Dos reservas **Altas** (identificador del login sin excluir `nombre` y sin registro del intento fallido; columnas 15/20 en la tabla «sin copiarse al maestro») y seis **Medias** (conteo de módulos, archivos cargados vs. respaldados, asignaciones RNF en la matriz de despacho, corte semanal de concentradas, bordes del diagrama de componentes, alcance declarado de `casos_uso.md`).

**Criterio de desbloqueo:** las dos reservas críticas deben cerrarse **antes de iniciar C2**; ninguna impide abrir C1 (armazón, CONFIGURACION, sesión, CASOS con cierre bloqueante y persistencia), porque las dos viven en la ingesta. Las reservas altas y medias se cierran con ediciones puntuales del documento (esfuerzo S/M).

**Conteo de hallazgos:** Crítica **2** · Alta **2** · Media **6** · Baja **0** — total **10**.

---

## 2. Metodología aplicada (3 fases)

| Fase | Qué se hizo | Resultado |
|---|---|---|
| **1 — Revisar** | 7 lentes en paralelo sobre `documento_tecnico.md` con contraste contra los 6 documentos normativos | 19 hallazgos candidatos |
| **2 — Verificar** | Contraste adversarial línea a línea contra `documento_tecnico.md`, `requerimientos.md`, `diccionario_datos.md`, `casos_uso.md`, `casos_uso/diagramas.md`, `entornos_globales.md`, `estado_proyecto.md` y la cabecera real del CSV (`detalle_averias_gpon 12_09_2026.csv`, 80 columnas verificadas) | 9 descartados, 10 supervivientes |
| **3 — Sintetizar** | Deduplicación cruzada entre lentes, IDs únicos A-01…, priorización y redacción de este informe | 10 hallazgos + 8 preguntas |

**Verificaciones mecánicas realizadas** (no son hallazgos, son comprobaciones de la auditoría):

- La cabecera real del CSV tiene **80 columnas** con `;`; las posiciones 18, 19, 20, 31, 32, 33, 34, 53 y 80 del Anexo A de `diccionario_datos.md:264-287` coinciden con el archivo real.
- `despacho.json`: los 15 campos de `documento_tecnico.md:326-342` coinciden uno a uno con `diccionario_datos.md:70-86` y con la lista canónica de CU-17 (`casos_uso.md:1079`).
- `averias.json`: los 36 campos y su orden coinciden con `diccionario_datos.md:19-56`, incluidos `fecha_asignacion` (36), `usuario_modificacion` (31), `fecha_modificacion` (32) y `tipo_abonado` (30).
- **Hallazgos descartados en la Fase 2** (por falso positivo o por falta de evidencia confirmable): (a) «no existe contrato para `datos/incidencias.log`» — D-46 lo define como registro de novedad, no como JSON de trabajo; (b) «la prueba de 404 por HTTP no está especificada» — es reproducible y está en CU-22 (`casos_uso.md:1379`); (c) «el maestro no declara campos obligatorios en el JSON» — el documento sí los marca con la columna OBL; (d) «D-52 contradice a D-21» — D-52 precisa D-21, no la contradice; (e) «los 3 intentos fallidos están inventados» — provienen de `BRIEF-GGTO-INICIAL.md:101` y de CU-01 4a (`casos_uso.md:159`).

---

## 3. Tabla de hallazgos por severidad

| ID | Sev. | Ubicación | Descripción | Impacto | Recomendación |
|---|---|---|---|---|---|
| **A-01** | **CRÍTICA** | `documento_tecnico.md:396` (y `:882`) vs. `casos_uso.md:534`, `:599` | El documento declara que las columnas 53 (`usuario_acciona`) y 80 (`Fecha Hora Asignacion`) **no se persisten**; CU-08 ordena **conservarlas como rastro de origen** «tal como llegan, sin recortarlas ni reinterpretarlas», y lo repite en su restricción EARS | Dos contratos de ingesta incompatibles: C2 no sabe si el maestro guarda 36 campos o campos de rastro 53/80; riesgo de implementar de más o de menos y de incumplir D-16/RNF-09 | Fijar el contrato en un solo sentido y propagarlo: o se añaden los campos de rastro al maestro (y al diccionario) o se corrige CU-08 §4 y su EARS. Dejar el resultado en `diccionario_datos.md` §1 y en §4.3 de este documento |
| **A-02** | **CRÍTICA** | `documento_tecnico.md:871-881` (lista de 4 pendientes) | Falta el pendiente técnico **S-RNF-02b** (umbral de rendimiento de la ingesta, < 3 s con punto de medida explícito), que `casos_uso.md:576`, `:1126`, `:1478` y `:1559` declaran como pendiente técnico de implementación y criterio derivado del analista | El plan de C2 y la verificación de RNF-02 quedan sin umbral de aceptación; un pendiente declarado en la base normativa desaparece del documento técnico | Incorporarlo como quinto pendiente en §8.3 y citarlo en la matriz §6.3 (RNF-02, `ingesta.js`), con el punto de medida y el valor objetivo |
| **A-03** | **ALTA** | `documento_tecnico.md:226` | El paso 3 del login exige coincidencia exacta de `P00` con `status` activo, pero **no excluye `nombre` como identificador** (D-29: «el campo `nombre` no es un identificador válido», `casos_uso.md:148`, `:178`) ni registra el **intento fallido con fecha y hora** (`casos_uso.md:159`, `:195`) | Un implementador puede aceptar el nombre del compañero como identificador, debilitando la atribución de RNF-09 que el propio documento promete; el registro del intento es requisito de la base normativa | Añadir al paso 3: «solo `P00`; `nombre` no es identificador válido» y «rechaza con mensaje genérico y registra el intento con fecha y hora» |
| **A-04** | **ALTA** | `documento_tecnico.md:387-396` vs. `diccionario_datos.md:289-294` | La tabla «Columnas del CSV que se usan sin copiarse al maestro» omite la **col. 18** (`fecha_compromiso`), que el Anexo A del diccionario enumera como parte del subconjunto que alimenta el maestro. Además, las columnas **15** y **20** aparecen en esa tabla como «no copiadas» cuando sí producen campos del maestro (`fecha_reporte`/`fecha_reporte_original` y `usuario_modificacion`) | Ambigüedad sobre `fecha_compromiso` (¿se descarta o falta declararla?) y lectura confusa del origen real de dos campos | Completar la tabla con una columna «destino en el maestro» y decidir explícitamente el destino de la col. 18 (descarte justificado o campo `fecha_compromiso`) |
| **A-05** | MEDIA | `documento_tecnico.md:75` vs. `:87-101` | Se declaran «los **13** módulos de la aplicación», pero la tabla de módulos contiene **12** módulos (11 propios + la fila de capa de datos `almacen.js + app.js` sin módulo propio) y el diagrama de componentes dibuja **12** nodos | Conteo inconsistente en la sección que define la arquitectura y que la tarea de arquitectura usa como referencia | Corregir a «12 módulos» o explicitar que la fila de respaldo/contingencia es una responsabilidad compartida sin módulo propio (entonces 13 filas, 12 módulos) |
| **A-06** | MEDIA | `documento_tecnico.md:212` vs. `:839`, `:844` | §3.2 describe la carga como «`averias.json` y los 6 archivos de configuración» (7 archivos), mientras §7.4 pasos 3-4 respaldan **9 JSON** (los 7 + `despacho.json` + `estructura.json`) | Un implementador puede construir el respaldo con 7 archivos y romper el criterio «Respaldo verificado: 9 archivos» (CU-21, `casos_uso.md:1301`, `:1318`) | Unificar la cifra: 9 JSON de trabajo (`averias`, `despacho`, `estructura` + 6 de configuración), en la carga y en el respaldo |
| **A-07** | MEDIA | `documento_tecnico.md:718` vs. `:779` | La matriz §6.1 asigna a `despacho.js` solo RNF-01, RNF-10, RNF-11 y RT-05, mientras §6.3 asigna RNF-05 (impresión) y RNF-11 (control documental) a `pdf.js` + `despacho.js` y la tabla de módulos §2.3 implica a `despacho.js` en el control documental | Asignación doble/no uniforme de RNF-05 y RNF-11 entre dos secciones de trazabilidad; dificulta saber quién responde por el requisito | Alinear §6.1 con §6.3 (o justificar la diferencia) y citar CU-16 en la fila de RNF-05/RNF-11 |
| **A-08** | MEDIA | `documento_tecnico.md:880` | El pendiente 4 fija «el corte semanal exacto de la métrica de averías concentradas» como pendiente **técnico**, pero §8.3 afirma que «no hay decisiones de diseño pendientes»; `requerimientos.md:191` (RN-03/RN-04) y `casos_uso.md:1430` lo relacionan con el alcance de RF-26 y con A-04/D-25 | El lector puede creer que un parámetro del conteo de RF-26 ya está decidido; RF-26 queda marcado «Parcial» en la base normativa | Mantenerlo como pendiente técnico pero anotar el valor por defecto y quién lo confirma (umbral editable de `claves_clasificacion.umbral_concentracion`), alineado con CU-20 |
| **A-09** | MEDIA | `documento_tecnico.md:157`, `:160` vs. `:138-144` | Bordes del diagrama de componentes no declarados o no coincidentes: el nodo `DES` («despacho.json») no tiene ninguna arista en la lista de relaciones, `CONF` recibe entradas de `ING` y `DSP` que no figuran en la lista, y `ALM <--> AVE` se dibuja bidireccional mientras el resto se declara unidireccional | El diagrama deja de ser la fuente confiable de dependencias que el propio §2.4 pretende ser frente a la tabla de módulos y los CU | Completar la lista de aristas (`ALM --> DES`, `ING --> CONF`, `DSP --> CONF`) o retirar los bordes sobrantes del diagrama; homogeneizar la dirección de lectura/escritura |
| **A-10** | MEDIA | `documento_tecnico.md:9` vs. `casos_uso.md:5`, `:8`, `:35` | El documento cita `casos_uso.md` como fuente normativa con «CU-01 a CU-22» pero sin declarar su revisión: la base normativa vigente es la del **15/09/2026** (D-42 a D-50, RNF-15 y RNF-16), y el rango de decisiones de ese documento es D-01 a D-50, no D-52. El documento tampoco menciona `S-RNF-02b` ni el estado «Parcial» de RF-26 que allí figuran | Trazabilidad de versión incompleta: no se puede saber contra qué revisión de los casos de uso se redactó el documento técnico, lo que agrava A-01 y A-02 | Añadir la fecha de revisión de `casos_uso.md` en el encabezado y una nota de sincronización (D-51/D-52 posteriores a esa revisión) |

---

## 4. Hallazgos críticos detallados

### A-01 — Contradicción de contrato: columnas 53 y 80 del CSV

**Evidencia.**
- `documento_tecnico.md:396`: «Rastro de origen (D-16, D-52) | 20, 53, 80 | La **col. 20** (`ultimo_usuario`) inicializa `usuario_modificacion` …; las columnas **53 y 80 no se persisten** (D-52)».
- `documento_tecnico.md:882`: «el destino de las columnas 53 y 80 del CSV —no se persisten—».
- `documento_tecnico.md:982` (anexo D-52): «las columnas 53 y 80 del CSV no se persisten».
- Enfrente: `casos_uso.md:534` (CU-08 paso 4): «**conserva como rastro de origen del dato** las columnas 20 (`ultimo_usuario`), 53 (`usuario_acciona`) y 80 (`Fecha Hora Asignacion`) tal como llegan, sin recortarlas ni reinterpretarlas (H-08)», y su restricción EARS equivalente; `casos_uso.md:599` cierra el CU con la misma exigencia.
- Verificación independiente: la cabecera real del CSV confirma que la col. 53 es `usuario_acciona` y la col. 80 es `Fecha Hora Asignacion` (archivo `detalle_averias_gpon 12_09_2026.csv`, 80 columnas).

**Descripción.** El documento técnico zanja como «resuelto» un punto que su fuente normativa resuelve en sentido contrario. `requerimientos.md:102` (D-52) solo dice que esas columnas «no se persisten»; `casos_uso.md` las exige conservar. Como el documento técnico se declara derivado de `casos_uso.md` (línea 9), la contradicción es real y no un simple matiz de redacción.

**Impacto.** Alto y de ciclo: la ingesta es C2. Un implementador que siga el documento técnico descarta el rastro de origen; uno que siga CU-08 añade campos al maestro que el diccionario de datos (36 campos, `diccionario_datos.md:19-56`) no declara, rompiendo la verificación de contrato de la tarea de datos y la comparación campo a campo. Afecta también a RNF-09 (auditoría) y a la promesa de trazabilidad D-16.

**Recomendación.** Decidir el destino de la col. 53 y de la col. 80 con el usuario (§6, P1) y aplicar el resultado en los tres documentos: `diccionario_datos.md` §1 (lista de campos), `documento_tecnico.md` §4.1 y §4.3, y `casos_uso.md` CU-08 (paso 4 y EARS). Si se conservan, deben entrar como campos explícitos con tipo y origen; si se descartan, hay que justificar la pérdida de rastro y corregir CU-08.

### A-02 — Requisito derivado S-RNF-02b ausente de los pendientes

**Evidencia.**
- `casos_uso.md:576` (CA-14 de CU-08): «… transcurren menos de 3 s (punto de medida explícito, alineado con D-24; umbral derivado **S-RNF-02b**, pendiente **técnico** de calibración en la implementación, no una decisión del usuario)».
- `casos_uso.md:1478`: fila «S-RNF-02b (derivado) | CU-08 | **Derivado del analista** — requiere confirmación del usuario (ver §5.4)».
- `casos_uso.md:1559`: pendiente técnico n.º 1: «Umbral de desempeño propio de la ingesta (criterio derivado S-RNF-02b: < 3 s con punto de medida explícito)».
- `documento_tecnico.md:871-881`: la tabla de pendientes técnicos tiene exactamente 4 filas (versiones de librerías, historial inmutable, canal de escalamiento, corte semanal) y **ninguna** menciona S-RNF-02b; la línea 882 cierra con «Ya resueltos (no son pendientes)» sin incluirlo.

**Descripción.** El documento técnico absorbe tres de los cinco pendientes de `casos_uso.md` §5.4 (versiones, historial, escalamiento) y el cuarto de forma equivalente (corte semanal), pero omite el quinto. Al no citarlo en §6.3 (cobertura de RNF) ni en §9 (criterios de C2), el umbral de rendimiento de la ingesta queda sin dueño ni valor objetivo.

**Impacto.** Medio-alto: RNF-02 (desempeño, `requerimientos.md:149`) fija 1,5 s de filtrado y 3 s de MONITOREO sobre 1.000 casos, pero no fija nada para la ingesta; sin S-RNF-02b, el criterio de terminado de C2 no es medible y la auditoría de C2 no tendría contra qué verificar. No es «requisito inventado»: es un **hueco de completitud** heredado de la base normativa.

**Recomendación.** Añadirlo como pendiente n.º 5 en §8.3 con referencia `casos_uso.md` §5.1/§5.4 y CU-08 CA-14, y citarlo en §6.3 junto a RNF-02 (`ingesta.js`). Si el usuario confirma el umbral, registrarlo como decisión nueva (D-53) para que deje de ser derivado.

---

## 5. Huecos de trazabilidad y de contratos

### 5.1 Trazabilidad módulo → CU → RF/RNF

| Verificación | Resultado |
|---|---|
| Los 29 RF con módulo responsable | **Cumple.** `documento_tecnico.md:731-761` cubre RF-01 a RF-29 (29/29), sin huecos ni dobles asignaciones contradictorias; las dobles (RF-05, RF-07, RF-17, RF-18, RF-25, RF-26, RF-27, RF-28) están desambiguadas con el módulo principal y el de soporte |
| Los 16 RNF con módulo responsable | **Cumple.** `documento_tecnico.md:765-784` cubre RNF-01 a RNF-16 (16/16) |
| Los 11 RT tratados | **Cumple.** `documento_tecnico.md:785-791`: RT-01 a RT-10 con módulo, RT-11 declarado fuera del alcance de los módulos (tarea de entorno, §7.1) |
| Los 22 CU cubiertos por algún módulo | **Cumple**, aunque de forma indirecta: el documento se declara «módulo → caso de uso → RF/RNF/RT» (línea 709) y §6.1 lista CU por módulo; la cobertura se reconstruye desde §6.2 (RF→CU) y no desde una matriz CU→módulo explícita. **Se verificó CU por CU** contra los módulos de §2.3: los 22 tienen al menos un módulo responsable (p. ej. CU-15 → `casos.js` + `almacen.js`; CU-20 → `reportes.js`) |
| Huecos de trazabilidad detectados | **A-02** (S-RNF-02b), **A-07** (RNF-05/RNF-11 en `despacho.js`), **A-10** (revisión de `casos_uso.md` no declarada). No se detectaron RF ni RNF huérfanos ni módulos sin responsabilidad |

### 5.2 Contratos de datos

| Contrato | Verificación | Resultado |
|---|---|---|
| `averias.json` — 36 campos | Cotejo campo a campo con `diccionario_datos.md:19-56` | **Coincide**, incluidos `fecha_asignacion` (`documento_tecnico.md:313`), `usuario_modificacion` (`:308`), `fecha_modificacion` (`:309`) y `tipo_abonado` (`:307`). Tipos, dominios y obligatoriedad consistentes |
| `despacho.json` — 15 campos | Cotejo con `diccionario_datos.md:70-86` y con la lista canónica de CU-17 (`casos_uso.md:1079`) | **Coincide**: 12 del fuente + `sector` + `Reparador Principal` + `fecha_despacho` (D-31, RT-05) |
| `estructura.json` — mapa posicional | `documento_tecnico.md:344-398` | **Cumple**: se declara expresamente posicional y no por nombre (D-12, D-21), con `columnas_esperadas: 80`, separador `;`, UTF-8 y los encabezados repetidos documentados (`informacion` ×2, `nombre` ×2, `descripcion` ×3), coherente con el Anexo A y con la cabecera real verificada |
| Credencial del técnico | `documento_tecnico.md:417-430` | **Coincide** en `clave_hash`, `clave_sal` y `clave_fecha_cambio`. **Único punto a vigilar:** el campo `clave_cambio_obligatorio` (B, obligatorio en `diccionario_datos.md:152` para RF-12/D-39) **no aparece en la tabla de `tecnicos.json`** del documento técnico ni en `casos_uso.md` (0 menciones en CU-01/CU-03); el mecanismo queda cubierto funcionalmente por el paso 4 de §3.3 («cambio obligatorio a los 90 días»). No se eleva a hallazgo porque el comportamiento exigido sí está documentado, pero conviene nombrar el campo para que la ficha de TECNICOS lo persista |
| Configuración (6 archivos) | `documento_tecnico.md:400-475` | **Cumple**: `central` (10 campos), `tecnicos`, `flota`, `cuadrillas`, `sectores` y `claves_clasificacion` coinciden con el diccionario; `umbral_concentracion` (N) es una adición del documento técnico coherente con D-25/RF-26 |
| Huecos de contrato detectados | — | **A-01** (columnas 53/80), **A-04** (col. 18 y origen de 15/20), **A-06** (7 vs. 9 JSON). El diagrama ER (`:479-542`) simplifica entidades respecto al diccionario (no dibuja `claves_clasificacion` completo ni los 9 archivos), lo que es aceptable por ser un diagrama, pero conviene una nota |

### 5.3 RNF y stakeholders (lentes ISO 25010 y actores)

- **No se detectaron RNF faltantes**: las 16 categorías de `requerimientos.md` cubren usabilidad, desempeño, portabilidad, integridad, impresión, fechas, nomenclatura, control de acceso, auditoría, integridad de datos, control documental, permisos, accesibilidad, concurrencia, escritura verificada y respaldo. La única categoría débil es la **verificación medible** de alguno de ellos (A-02), no su existencia.
- **No se detectaron stakeholders ausentes**: operador, supervisor (absorbe administrador, D-35), cuadrilla/técnico de calle, emisor del CSV, auditoría/control interno y soporte TI están en `casos_uso.md:52-59` y se reflejan en §3.4 y §7.3 del documento técnico.
- **Riesgos aceptados**: §8.1 declara sin TLS y el historial incompleto, y marca como **ya no aplicable** el «sin respaldo automático» (`documento_tecnico.md:855`), coherente con D-42/D-49. No se encontraron riesgos ya mitigados que sigan listados como abiertos.

---

## 6. Preguntas para el usuario (agrupadas de 3 en 3)

**Bloque 1 — Contratos de datos (desbloquea A-01 y A-04)**

- **P1.** ¿El maestro debe **conservar** las columnas 53 (`usuario_acciona`) y 80 (`Fecha Hora Asignacion`) del CSV como rastro de origen —como ordena CU-08— o **descartarlas**, como dice §4.3 del documento técnico? (Respuesta esperada: una sola, aplicada en los tres documentos.)
- **P2.** ¿La columna 18 (`fecha_compromiso`) se incorpora al maestro como campo propio o se descarta? Hoy el Anexo A del diccionario la enumera entre las que alimentan el maestro y §4.3 no la menciona.
- **P3.** ¿Se adopta `clave_cambio_obligatorio` como campo explícito de `tecnicos.json` (además de la caducidad a 90 días) para que la ficha de TECNICOS pueda marcar el cambio obligatorio tras un restablecimiento del supervisor?

**Bloque 2 — Umbrales y criterios de terminado (desbloquea A-02 y A-08)**

- **P4.** ¿Se fija el umbral de rendimiento de la ingesta (**S-RNF-02b**: resumen en pantalla en menos de 3 s con 1.000 casos de maestro y 60 registros de CSV) y se registra como decisión nueva, o se mantiene como pendiente técnico de calibración en C2?
- **P5.** ¿El corte de la «semana operativa» para las averías concentradas (3 o más casos abiertos del mismo sector) es lunes–sábado con la semana del año, y el umbral queda editable en `claves_clasificacion.umbral_concentracion` con valor por defecto 3?
- **P6.** ¿Se acepta que el criterio de terminado de C4 incluya la verificación formal de RNF-05 (carta horizontal con el volumen máximo por cuadrilla), hoy asignado a `pdf.js` pero sin criterio de aceptación explícito en el plan?

**Bloque 3 — Alcance, sesión y salidas (cierra los puntos menores)**

- **P7.** ¿El login debe rechazar explícitamente el campo `nombre` como identificador y registrar cada intento fallido con fecha y hora (como CU-01), y ese registro va a `datos/incidencias.log` o a un archivo de auditoría propio?
- **P8.** ¿Cuál es la **ruta controlada** exacta de los PDF de despacho (D-27) y qué capacidad de la matriz de permisos la habilita? Hoy no está fijada en ningún documento del corpus.

---

## 7. Criterios de aceptación para cerrar las reservas

1. **Antes de iniciar C2:** A-01 y A-02 resueltos y propagados a `diccionario_datos.md` y `casos_uso.md`; sin contradicción de contrato en la ingesta y con umbral de desempeño declarado.
2. **Antes de iniciar C1:** A-03 (login: solo `P00` e intento fallido registrado), A-05 (conteo de módulos) y A-09 (aristas del diagrama) corregidos; son ediciones de esfuerzo S que no cambian el alcance.
3. **Antes de iniciar C4:** A-04, A-06, A-07, A-08 y A-10 cerrados y la nota de revisión de `casos_uso.md` incorporada al encabezado del documento técnico.
4. **Reauditoría:** una vez apliquen las correcciones, verificar por diferencia (`git diff`) que no se introdujeron requisitos nuevos ni se alteraron los identificadores RF/RNF/RT/RN/D/CU, y repetir la comprobación campo a campo de los contratos.

---

*Informe emitido por el equipo de auditoría (skill `equipo-auditoria`, 3 fases). Solo lectura sobre los insumos; el presente archivo es el único artefacto escrito.*
