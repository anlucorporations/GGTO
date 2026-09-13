# Estado del Proyecto — GGTO-v1

- **Proyecto:** Página HTML de gestión de averías — Central Francisco Salias (Área 4)
- **Fase actual:** 1 (Concepto) — en cierre
- **Última actualización:** 2026-09-12
- **Fuente primaria:** `RepoTecnico/PAGINA-GGTO-INICIAL.md`

---

## 1. Resumen ejecutivo

Se analizó el documento de concepto y se produjo una propuesta técnica completa para una página
HTML que gestione los reportes de avería de la central: 7 pestañas funcionales, ingesta diaria de
un CSV, dosificación del despacho por cuadrillas, sectores de averías concentradas, seguimiento
de casos especiales y reportes diario y semanal.

Se realizaron **9 bloques de entrevista** con los que se fijaron **59 decisiones**
y se cerraron **las 18 ambigüedades** del documento fuente: **no queda ninguna abierta** (las seis que tocaban el MVP se resolvieron con D-29 a D-35). No hay pendientes administrativos: los repositorios remotos están creados y sincronizados, y GCP quedó descartado.

---

## 2. Artefactos generados

| Archivo | Contenido | Estado |
|---|---|---|
| `RepoTecnico/PAGINA-GGTO-INICIAL.md` | Fuente primaria del usuario (concepto y estructuras). | Recibido |
| `RepoTecnico/PROPUESTA-PAGINA-GGTO.md` | Análisis, requerimientos, arquitectura, ciclos, decisiones D-01 a D-11 y ambigüedades A-01 a A-14. | Completado |
| `RepoTecnico/requerimientos.md` | 27 RF, 7 RNF, 7 RT, 8 reglas de negocio, glosario, alcance por ciclo y criterios de Fase 1. | Completado |
| `RepoTecnico/diccionario_datos.md` | Diccionario de `averias.json` (29 campos), `despacho.json`, `estructura.json` y 6 archivos de configuración, con integridad y formatos. | Completado |
| `RepoTecnico/entornos_globales.md` | Rutas, estructura de carpetas, stack, lanzador del servidor local, constantes y notas del host. | Completado |
| `RepoTecnico/estado_proyecto.md` | Este documento. | Vivo |

---

## 2.1 Repositorio local

- Se inicializó el repositorio git en la raíz del proyecto (`G:\Mi unidad\CANTV PDE\GGTO-v1`),
  rama `main`, con `.gitignore` (excluye `desktop.ini`, `.env*`, logs y respaldos de `datos/`).
- Primer commit: `Fase 1: documentacion de concepto, propuesta y requerimientos de la pagina GGTO`.
- **Repositorios remotos: creados y sincronizados.** GitHub `https://github.com/anlucorporations/GGTO.git` (`origin`) y GitLab `https://gitlab.com/anlucorporations/ggto.git` (`gitlab`), ambos con las ramas `main` y `GGTOv1-DSH` en el mismo commit. Tenian solo un `README.md` inicial: la historia local se integro por merge, sin force-push.
- **Incidente resuelto (D-22):** Google Drive inyecto 75 archivos `desktop.ini` dentro de `.git` (incluido `.git\refs\`), lo que rompio `git fetch` con `fatal: bad object refs/desktop.ini`. El directorio de git se movio a `C:\GGTO\git\GGTO-v1.git` y la raiz apunta alli con un archivo `.git` (`gitdir:`). No se perdio ningun commit.
- **Incidente de cuota (13/09/2026):** Google Drive se quedó sin cuota y `Copy-Item` truncó `casos_uso.md` y `diagramas.md` a 0 bytes. Se recuperó el contenido desde la copia de la entrega y se commiteó por índice, sin escribir en Drive. Consecuencia: **D-51**, el proyecto pasa a `C:\GGTO\proyecto`.

### Archivos operativos detectados en la raíz (aún no analizados)

| Archivo | Relevancia |
|---|---|
| `detalle_averias_gpon 12_09_2026.csv` (43 KB) | Muestra real del CSV diario de entrada: permitiría verificar `estructura.json` (RF-16). |
| `alta_manual.csv` (20 KB) | Posible origen de la carga manual de casos (RF-04). |
| `Despacho_Cuadrilla_1/2/3_20260911.pdf` (3 archivos) | Despachos reales de 3 cuadrillas: referencia de formato para RF-10. |
| `CONTROL_DESPACHO_GGTO-v1.xlsm` (99 KB) | Libro con macros: posible proceso actual que la página reemplaza. |

> Su contenido no se ha leído: el alcance acordado se limitó a `PAGINA-GGTO-INICIAL.md`.
> Analizarlos requiere autorización explícita del usuario.
## 2.2 Verificación con los CSV reales (12/09/2026)

Autorizado por el usuario, se analizaron `detalle_averias_gpon 12_09_2026.csv` (muestra del CSV
diario) y `alta_manual.csv`. Resultado: **la premisa de D-08 no se sostiene** y el contrato de
ingesta debe rediseñarse.

| Hallazgo | Evidencia | Consecuencia |
|---|---|---|
| El CSV tiene **80 columnas**, no 19. | Fila de encabezado completa. | `estructura.json` debe rehacerse; se incorporó el Anexo A con las 80 columnas. |
| Separador `;` y codificación UTF-8 con acentos. | Verificado en ambos CSV. | Configurar PapaParse con `delimiter: ';'`. |
| Encabezados repetidos: `informacion` ×2, `nombre` ×2, `descripcion` ×3. | Agrupación de la cabecera. | El mapeo no puede ser por nombre: debe ser **posicional** (A-12). |
| Fechas con hora (`17/07/2026 11:38:20 a.m.`). | Columnas `fecha_reporte`, `fecha_compromiso`, `fecha_despacho`. | Definir si se recorta a fecha (A-16). |
| `estatus` del CSV: `PEND` (53) y **`ASGN`** (3). | Agrupación de la columna 27. | `ASGN` no está en el enum del fuente (A-15). |
| El archivo mezcla 3 centrales: FRANCISCO SALIAS (51), LAS MERCEDES CPA (4), EL HATILLO (1). | Agrupación de las columnas 8-10. | El filtro por `area`/`central`/`nombre central` es imprescindible (RT-03 confirmado). |
| `ups` = `RES` (55) / `NRES` (1); `unidad_negocio` = `CANTV RESIDENCIAL` / `CANTV EMPRESAS`. | Agrupaciones de las columnas 61-62. | Evidencia para resolver A-11. |
| Regla RN-03 en datos reales: 17 registros con palabras clave de fibra y 39 sin ellas. | Búsqueda sobre `ultimo_comentario`, `problema_reporte` e `informacion`. | Dividiría el día en 17 casos a PEND y 39 a GESTION. |
| `alta_manual.csv` (42 columnas) parece el registro manual vigente. | Caso `REF-REP-05`, `Sector` = «Prados del Este», «1ª Vez / Última Vez visto», «Historial (fecha:Grupo)». | Candidato a modelo de campos de CASOS y de casos especiales (A-17); su `Sector` es un **nombre**, no un número (A-04). |
| El proyecto **no tiene** `averias.json`, `despacho.json` ni `estructura.json`. | Listado de la raíz y de `RepoTecnico/`. | Los tres archivos se crean desde cero en el ciclo C1/C2. |
## 3. Decisiones tomadas (D-01 a D-11)

| ID | Decisión | Bloque |
|---|---|---|
| D-01 | Persistencia con servidor local mínimo + File System Access API (lectura y escritura de los JSON). | 1 |
| D-02 | Alcance: MVP primero = CONFIGURACION + CASOS + INGESTA + PANEL (ciclos C1–C3). | 1 |
| D-03 | Sectores = lista de calles/urbanizaciones, con emparejamiento normalizado y cola de asignación manual. | 1 |
| D-04 | La columna `extra` de `averias.json` es dato de Red / planta externa. | 2 |
| D-05 | RN-03: con palabras clave de fibra → `PEND`; sin ellas → `GESTION`. | 2 |
| D-06 | Todo caso ingerido entra `clase = REP`; la corrección a `CNS`/`REF` es manual. | 3 |
| D-07 | Ficha de cuadrilla: `id, nombre, técnicos[], vehículo, turno, sectores[], status`. | 3 |
| D-08 | **Revisada — sin efecto:** el CSV real tiene 80 columnas con `;` y encabezados repetidos; el contrato vigente es el mapa posicional de **D-12**. | 4 |
| D-12 | `estructura.json` = mapa posicional solo de las columnas necesarias. | 5 |
| D-13 | ~~`ASGN` como cuarto estado~~ — **sin efecto por D-38**. | 5 |
| D-14 | Se descartan los datos de `alta_manual.csv`; los casos se cargan manualmente. | 5 |
| D-15 | Servidor local solo en loopback y sirviendo únicamente el subdirectorio de la aplicación. | auditoría |
| D-16 | Identificación del operador en cada sesión contra `tecnicos.json` y registro de quién cambia cada caso. | 6 |
| D-17 | Campo nuevo `tipo_abonado` (RES/EMP) desde `unidad_negocio` y `ups` del CSV. | 6 |
| D-18 | Alta manual con lista cerrada de campos e `id_averia` automático `MAN-`. | 6 |
| D-19 | `datos/` sale de Google Drive y vive en disco local con respaldo periódico. | 7 |
| D-20 | Cierre bloqueante sin resolución y fecha, más validación de integridad en alta y edición. | 7 |
| D-21 | Ingesta estricta: validación bloqueante, fechas recortadas con original conservado y `ASGN` con precedencia. | 7 |
| D-22 | El directorio `.git` vive en disco local, fuera de Google Drive, tras la corrupción de `.git\refs` por `desktop.ini`. | 7 |
| D-23 | «Abierto» = status distinto de CERRADO; «tipo» = clase + nivel calculados en pantalla. | 8 |
| D-24 | Umbrales de desempeño: 1.000 casos, filtrado <1,5 s, gráficos <3 s. | 8 |
| D-25 | CRUD de sectores en C1 y avería concentrada = 3 casos abiertos por sector en la semana. | 8 |
| D-26 | Palabras clave por subcadena sobre texto normalizado, con vista previa del impacto. | 9 |
| D-27 | PDF con fecha, cuadrilla y nº de copia; registro de entrega y recogida; respaldo en ruta controlada. | 9 |
| D-28 | Retención indefinida de casos, finalidad documentada y riesgo legal aceptado. | 9 |
| D-29 | `P00` = código de empleado único; es la credencial de sesión del operador. | 10 |
| D-30 | «Citados del día» = casos con `fecha_cita` igual al día del despacho. | 10 |
| D-31 | `despacho.json` se amplía con sector, cuadrilla y fecha de despacho. | 10 |
| D-32 | Desempate de construcción: zona preferente → menor carga → id menor, con ajuste manual. | 10 |
| D-33 | Casos especiales = empresariales (EMP) o referidos (REF) abiertos. | 10 |
| D-34 | Despacho en pantalla + PDF; seguimiento semanal estadístico (ingreso vs. reparadas por día + línea de pendiente, Sem 1 a Sem 36). | 10 |
| D-35 | Permisos: operador solo cierra casos de su cuadrilla; supervisor hace todo, incluida la bandeja GESTION. | 11 |
| D-36 | Respaldo manual sin automatismo; CSV, PDF y `.xlsm` siguen versionados en el repositorio (riesgo aceptado). | 12 |
| D-37 | `cuadrillas.id` = `Reparador Principal`; la asignación del despacho se persiste en `averias.json`. | 12 |
| D-38 | `ASGN` se ingiere como `PEND` (51 de Francisco Salias → 14 PEND + 37 GESTION). | 11 |
| D-39 | Credencial de sesión: `P00` + contraseña de 8+ caracteres (hash con sal), cambio cada 90 días. | 12 |
| D-40 | RNF-13 de accesibilidad: teclado, foco visible, `label`, contraste 4,5:1 y alternativa textual en gráficos. | 13 |
| D-41 | Concurrencia sin bloqueo: detección de conflicto al guardar y decisión del operador. | 13 |
| D-42 | Escritura verificada con respaldo previo y 10 versiones `.bak` del maestro. | 14 |
| D-43 | Modo `estricta` = literal por subcadena, sin variantes; por defecto `normalizada`. | 14 |
| D-44 | Umbral de ingesta: aborta si no hay 80 columnas o si una declarada no coincide en posición. | 14 |
| D-45 | Sesión de 8 horas; se cierra al cerrar la pestaña. | 14 |
| D-46 | CSV ausente: se muestra «sin ingesta» y se registra la novedad, sin bloquear. | 14 |
| D-47 | El alta manual no incorpora Tipo/Actividad/Agente. | 14 |
| D-48 | `fecha_asignacion` en el maestro para la métrica «asignados por día». | 15 |
| D-49 | Respaldo diario al cierre en `C:\GGTO\respaldo\`, sin cifrado; RTO 1 h y RPO del día anterior. | 16 |
| D-50 | Sin sesión válida no se muestra ningún dato (solo el diálogo de acceso). | 16 |
| D-51 | El proyecto se muda a `C:\GGTO\proyecto`; Google Drive sale del flujo de trabajo. | 16 |
| D-52 | Detalles técnicos: `sectores.id` texto único e inicialización del rastro de auditoría. | 16 |
| D-53 | Las columnas 53 y 80 del CSV no se persisten; el rastro de origen se limita a la col. 20 y a la fecha de ingesta. | auditorías |
| D-54 | La col. 18 (`fecha_compromiso`) no se persiste. | auditorías |
| D-55 | Solo dos roles: operador y supervisor (sin «jefe de central» ni «auditoría»). | auditorías |
| D-56 | Historial inmutable de cambios en `C:\GGTO\datos\historial.jsonl` (append-only). | auditorías |
| D-57 | Los intentos fallidos de sesión se registran, sin bloquear la cuenta. | auditorías |
| D-58 | Datos personales: se mantiene D-36 y se documenta la ficha de tratamiento; log de 5 MB × 5 archivos. | auditorías |
| D-59 | El emisor del CSV solo participa en la ingesta (se retira su relación con CU-09). | auditorías |
| D-09 | El maestro de casos se llama `averias.json`. | 4 |
| D-10 | La `informacion` duplicada son dos columnas: `informacion_1` e `informacion_2`. | 4 |
| D-11 | Palabras clave de clasificación editables en CONFIGURACION con búsqueda normalizada. | 4 |

---

## 4. Ambigüedades

**Cerradas (18):** A-01 (D-09), A-02 (D-10), A-03 (D-07), A-06 (D-11), A-07 (D-05),
A-01 a A-18: **todas cerradas** (A-04 D-25, A-05 D-30, A-08 D-34, A-09 D-33, A-10 D-32, A-11 D-29, A-12 D-12, A-13 D-06, A-14 D-31, A-15 D-13, A-16 D-21, A-17 D-14, A-18 D-21, más A-01 D-09, A-02 D-10, A-03 D-07, A-06 D-11 y A-07 D-05).

**Abiertas: ninguna.**

| ID | Ambigüedad | Ciclo |
|---|---|---|









**A-11 bloquea C1**; A-04, A-16 y A-18 condicionan C2; A-05, A-10 y A-14 afectan a C4; A-08 y A-09 a C6. Corrección aplicada tras la auditoría (H-06).

---

## 5. Plan de desarrollo acordado

| Ciclo | Entrega | Estado |
|---|---|---|
| C1 | Armazón de pestañas + CONFIGURACION + tabla CASOS + flotante de cierre + persistencia JSON. | No iniciado |
| C2 | INGESTA del CSV diario (filtro, mapeo, dedupe, clasificación, sectores). | No iniciado |
| C3 | PANEL (búsqueda, actualización, alta) + GESTION telefónica. | No iniciado |
| C4 | DESPACHO por sector y cuadrilla + PDF por cuadrilla. | No iniciado |
| C5 | MONITOREO + GRAFICOS. | No iniciado |
| C6 | Reportes diario/semanal + casos especiales y averías concentradas. | No iniciado |
| C7 | Pruebas funcionales con datos reales, impresión y manual de usuario. | No iniciado |

---

## 6. Pendientes para cerrar la Fase 1

- [x] URLs de los repositorios remotos (GitHub y GitLab) y ramas: `main` y `GGTOv1-DSH`.
- [x] GCP no aplica: la página se ejecuta localmente en la central (decisión del 12/09/2026).
- [ ] Respuestas al bloque 4 de preguntas (A-04, A-05, A-08, A-09, A-10, A-11, A-14) o su
      diferimiento explícito a los ciclos C4–C6.

---

## 7. Próximos pasos

1. **Cerrar Fase 1** con los pendientes del §6.
2. **Fase 2 (Auditoría):** desplegar el equipo de auditoría sobre `requerimientos.md`,
   `diccionario_datos.md` y `entornos_globales.md`; elaborar los casos de uso con criterios
   Gherkin/EARS y trazabilidad a los RF; generar los diagramas (Mermaid/SVG); redactar y auditar
   el documento técnico.
3. **Fase 3 (Desarrollo):** iniciar el ciclo C1 (armazón + CONFIGURACION + CASOS).

---

## 8. Riesgos vigentes

| Riesgo | Impacto | Mitigación prevista |
|---|---|---|
| El CSV diario cambia de columnas sin aviso. | Rompe la ingesta. | La ingesta valida los encabezados contra `estructura.json` y avisa antes de insertar. |
| Direcciones que no coinciden con ningún sector. | Casos sin agrupar. | Cola de asignación manual (RN-04, D-03). |
| El operador abre `index.html` con doble clic (`file://`). | No se pueden leer ni escribir los JSON. | El lanzador abre siempre `http://localhost:8787` y la página avisa si detecta `file://`. |
| Pérdida de datos por edición concurrente o cierre accidental. | Casos perdidos. | Escritura inmediata en cada cambio (RN-07) y exportación de respaldo del JSON. |
| Typos en los textos del CSV. | Clasificación incorrecta. | Búsqueda normalizada y lista de claves editable (D-11). |
| Fallo de escritura por trabajar sobre Google Drive (`G:`). | No se guardan los documentos. | Escribir en `%TEMP%` y copiar al destino (ver `entornos_globales.md` §9). |
| Corrupción del repositorio por `desktop.ini` de Google Drive dentro de `.git`. | Fallan fetch/push y se pueden perder referencias. | **Ocurrió y se corrigió (D-22):** el directorio de git vive en `C:\GGTO\git\GGTO-v1.git`, fuera de la unidad sincronizada. |
| Retención indefinida de datos personales sin base legal documentada (H-13). | Riesgo de incumplimiento normativo y de reclamos. | **Riesgo aceptado (D-28):** se documenta finalidad y responsable; sin purga automática. Revisar con el área legal de CANTV antes de ampliar el uso. |
| Sin respaldo automático del maestro (H-09, H-25). | Una pérdida del archivo local se recupera hasta el cierre del día anterior. | **Atendido (D-42 + D-49):** escritura verificada con 10 versiones `.bak` y copia fechada al cerrar la jornada en `C:\GGTO\respaldo\` (RTO 1 h, RPO del día anterior). El maestro nunca está en Google Drive. |
| CSV, PDF de despacho y `.xlsm` versionados en GitHub y GitLab, con datos personales de abonados (H-13, P9). | Exposición de datos personales en repositorios y crecimiento del historial. | **Riesgo aceptado (D-36):** se mantiene el repositorio como está; revisar con el área legal antes de dar acceso a terceros. |

---

## 9. Auditoría de Fase 1 (12/09/2026)

Informe completo: `RepoTecnico/auditoria_fase1.md` (skill `equipo-auditoria`: 7 revisores en
paralelo → 7 verificadores adversariales → síntesis; 15 agentes).

| Aspecto | Resultado |
|---|---|
| Veredicto | **Apto con reservas** para iniciar C1; **no apto** para C2/C3 hasta cerrar A-04, A-11, A-16 y A-18. |
| Hallazgos | **29** verificados: 2 críticos, 12 altos, 15 medios. |
| Extras | 14 RNF faltantes (ISO 25010), 11 stakeholders faltantes, 12 huecos de trazabilidad, 6 descartados justificados. |

**Hallazgos críticos y su estado**

| ID | Hallazgo | Estado |
|---|---|---|
| H-01 | Servidor local sin `--bind`, sirviendo la raíz (exponía `datos/averias.json`) y sin roles ni permisos. | **Atendido:** D-15 (loopback + solo la aplicación) y D-16 (identificación del operador); RNF-08 creado. |
| H-02 | RF-04 pedía campos inexistentes (Tipo, Actividad, Agente) sin definir quién genera `id_averia`. | **Atendido:** D-18 (lista cerrada + id `MAN-` automático); RF-04 reescrito. |

**Hallazgos altos atendidos:** H-03 (D-08 contradictoria → D-08 sin efecto y D-12 vigente),
H-04 («Empresa» no representable → D-17 `tipo_abonado` y RF-28), H-06 (recuento real de
decisiones y ambigüedades corregido en §1 y §4).

**Hallazgos altos pendientes:** H-05 (agrupaciones de RF-23: «tipo», «abiertos/cerrados» y
cuadrilla sin definir), H-07 (RNF sin umbral ni ciclo de verificación), H-08 (algoritmo de
palabras clave sin especificar), H-09 (persistencia del maestro sobre Google Drive: riesgo de
escritura silenciosamente fallida), H-10 (faltan campos de auditoría en detalle, no solo el
último cambio), H-11 (invariantes del diccionario sin requisito), H-12 (datos personales en el
PDF de despacho y en los respaldos), H-13 (base legal, finalidad y retención de datos
personales) y H-14 (no hay RF de gestión de sectores ni criterio de «avería concentrada»).

**Preguntas de la auditoría pendientes de respuesta** (§9 del informe, 12 preguntas P1-P12).
Respondidas hasta ahora: P1 (D-15), P2 (D-16), P5 (D-12 + D-17), P6 (D-18), P7 (D-20),
P8 (D-19), P10 (D-21) y P11 (D-17).

**Actualización tras el bloque 7:** H-09 queda atendido con D-19 (datos fuera de Google Drive con
respaldo periódico) y H-11 con D-20 (cierre bloqueante y validación de integridad, RNF-10). H-10
queda atendido solo en su parte mínima (último cambio con operador y fecha): falta el historial
completo de valores anteriores. **Actualización (bloques 8 y 9):** H-05 con D-23, H-07 con D-24, H-14 con D-25, H-08 con D-26, H-12 con D-27 y H-13 con D-28 (histórico indefinido, finalidad documentada y **riesgo legal aceptado**). Con esto **los 29 hallazgos quedan atendidos o explícitamente aceptados** (2 críticos, 12 altos, 15 medios) y la Fase 1 se puede cerrar.
---

## 10. Estado de la Fase 2 (casos de uso y documento técnico)

| # | Paso | Entregable | Estado |
|---|---|---|---|
| 1 | Casos de uso con Gherkin/EARS y trazabilidad | `RepoTecnico/casos_uso.md` (22 CU, 130 criterios Gherkin, 96 restricciones EARS, 29/29 RF) | **Completado** (commit `d0c5933`) |
| 2 | Diagramas Mermaid | `RepoTecnico/casos_uso/diagramas.md` (8 bloques: CU por actor, 3 secuencias y estados del caso) | **Completado** |
| 3 | Auditoría de los casos de uso | `RepoTecnico/casos_uso/auditoria_casos_uso.md` | **En curso** |
| 4 | Resolución de las dudas de la auditoría con el usuario | decisiones nuevas en `requerimientos.md` | Pendiente |
| 5 | Documento técnico del proyecto | `RepoTecnico/documento_tecnico.md` | Pendiente |
| 6 | Auditoría del documento técnico y cierre de Fase 2 | informe + preguntas | Pendiente |

**Supuestos en los casos de uso:** ninguno pendiente. Las 6 ambigüedades que los originaban quedaron cerradas (A-05→D-30, A-08→D-34, A-09→D-33, A-10→D-32, A-11→D-29, A-14→D-31), por lo que `casos_uso.md` debe actualizarse para sustituir las marcas `[SUPUESTO: A-xx]` por las decisiones correspondientes.