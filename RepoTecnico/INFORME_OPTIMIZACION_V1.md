# INFORME DE OPTIMIZACIÓN V1 — Auditoría de la Fase 1 (GGTO / CANTV)

**Proyecto:** GGTO — Gestión de Órdenes de Trabajo y Despacho (CANTV, Central Francisco Salias / Área 4)
**Alcance auditado:** documentación de Fase 1 (Concepto) en `RepoTecnico/`
**Versión del informe:** V1
**Método:** 7 revisores en paralelo → 7 verificaciones adversariales → síntesis
**Naturaleza:** auditoría de documentación (lectura-only). **No existe código de aplicación, tests ni despliegue**, por lo que **no aplican métricas de tests, lint ni typecheck** y ninguna de esas cifras se reporta aquí (hacerlo sería inventarlas).

---

## 1. Resumen ejecutivo y veredicto

**Veredicto: la documentación de Fase 1 NO es aún apta para avanzar a la Fase 2 (Auditoría / casos de uso) en su estado actual; es apta para avanzar BAJO CONDICIONES.**

La base documental es sólida y poco común: cobertura funcional completa (RF-01..RF-29), 15 RNF, diccionario de datos, modelo E-R, DDL de 35 tablas, referencia GCP y un plan de entrevista ya respondido. Sin embargo, la verificación adversarial confirmó **4 hallazgos CRÍTICOS y 14 ALTOS** que bloquean o condicionan seriamente el arranque de la Fase 2:

1. **H-01 — PII real de suscriptores CANTV versionada en git**, con remotos GitHub/GitLab configurados y `.gitignore` que no la cubre.
2. **H-02 — Codificación del CSV:** el archivo real es ISO-8859-1 y la ingesta está configurada como UTF-8, con corrupción o aborto garantizado y efecto directo sobre la regla de negocio de la cuadrilla 0.
3. **H-03 — Punto único de fallo:** toda la persistencia depende de una instancia Cloud SQL compartida, zonal, sin backups, sin PITR y sin protección de borrado.
4. **H-04 — Criterio de la cuadrilla 0 mal modelado:** los requisitos solo implementan PROCEDIMIENTO 3 e ignoran GENERALIDADES 3.5, y con los datos reales del CSV prácticamente todos los casos irían al supervisor.

**Condiciones para pasar a Fase 2 (enumeradas como criterios de aceptación en §8):** cerrar los 4 CRÍTICOS y los hallazgos ALTOS de alcance/consistencia (H-05, H-06, H-07, H-08, H-09, H-10, H-11, H-16), decidir con el cliente el catálogo de canales, la volumetría y las métricas pendientes, y sincronizar `requerimientos.md` con las respuestas ya registradas en `estado_proyecto.md`.

Sin esas condiciones, la Fase 2 (casos de uso) construiría sobre decisiones abiertas, requisitos contradictorios y un modelo de datos que no soporta varios flujos del brief.

---

## 2. Metodología

Se ejecutó el proceso de auditoría en **3 fases**:

**Fase 1 — Revisar (7 revisores en paralelo, una lente cada uno):**

| # | Lente |
|---|-------|
| R1 | Ambigüedad y testabilidad |
| R2 | Consistencia (documentos ↔ DDL ↔ E-R) |
| R3 | Completitud de RNF (ISO 25010) |
| R4 | Stakeholders y roles |
| R5 | Trazabilidad con el brief |
| R6 | Riesgos técnicos y de operación |
| R7 | Seguridad y legal |

**Fase 2 — Verificar (7 verificadores adversariales, uno por lente):** cada verificador contrastó los hallazgos del revisor contra los archivos reales (read/grep/glob, `file`, `wc`, `git ls-files`), **filtró falsos positivos**, **deduplicó** y **ajustó severidades** con justificación. Regla aplicada: **ante la duda, descartar**. Los descartes se documentan en el Anexo (§9).

**Fase 3 — Sintetizar (este informe):** consolidación cruzada de los hallazgos supervivientes de las 7 dimensiones, deduplicación entre dimensiones, asignación de IDs únicos `H-01`…`H-43` y priorización por severidad.

**Aclaración sobre métricas:** el repositorio contiene únicamente documentación (`.md`), el DDL (`db/schema.sql`), el CSV de muestra y 13 scripts de aprovisionamiento GCP. **No hay código de aplicación, tests, lint ni despliegue**, de modo que las métricas de calidad de código (cobertura, lint, typecheck, tests) **no aplican y no se reportan**. Toda la evidencia del informe es documental y se cita como `ruta:línea`.

---

## 3. Estado de calidad documental (alcance revisado)

| Artefacto | Contenido verificado |
|---|---|
| `BRIEF-GGTO-INICIAL.md` | Brief original del cliente (fuente de deseos y reglas de negocio) |
| `requerimientos.md` | Visión, 6 actores (ACT-01..ACT-06), 10 módulos, **29 RF**, **15 RNF (RNF-01..RNF-15)**, **20 RT (RT-01..RT-20)**, 12 supuestos abiertos (S-01..S-12), criterios §10 |
| `diccionario_datos.md` | Inventario de entidades, dominios, mapeo de ingesta del CSV **por posición (80 columnas)**, 5 dudas abiertas |
| `modelo_er.md` | **7 bloques `erDiagram`** reales, entidades y relaciones |
| `db/schema.sql` | **35 `CREATE TABLE`** verificados, CHECKs, índices, triggers, `INSERT` de catálogos |
| `estado_proyecto.md` | Estado de fase, decisiones D-01..D-21, procesos P1.1–P5.3, criterios, próximos pasos |
| `entornos_globales.md` | Variables de entorno, infraestructura, dependencias externas (Telegram/SMTP/MCP) |
| `GGTOv2_GCP.md` | Referencia de infraestructura GCP, instancias, secretos, KMS, Storage |
| `detalle_averias_gpon 12_09_2026.csv` | Muestra real: **80 columnas × 56 registros**, ISO-8859, fechas `dd/mm/aaaa hh:mm:ss a.m./p.m.` |
| `scripts/` | **13 archivos `.sh`** de aprovisionamiento GCP (incluye `lib_gcp.sh`) |

Conteos de referencia usados en los hallazgos: 29 RF, 15 RNF, 20 RT, 6 actores, 10 filas de módulos, 35 tablas, 13 scripts, 56 registros de muestra.

---

## 4. Tabla resumen por severidad

| Severidad | Conteo | IDs |
|---|---:|---|
| **CRÍTICA** | 4 | H-01 … H-04 |
| **ALTA** | 14 | H-05 … H-18 |
| **MEDIA** | 19 | H-19 … H-37 |
| **BAJA** | 6 | H-38 … H-43 |
| **TOTAL** | **43** | |

Hallazgos descartados en verificación (con motivo): **16**, listados en el Anexo (§9).

Nota de deduplicación cruzada: los 43 IDs corresponden a hallazgos únicos. Varios consolidan formulaciones de más de una dimensión (p. ej. H-03 fusiona R3, R6 y R7; H-09 fusiona R2, R5 y R6; H-28 fusiona R1 y R3); cuando el mismo hallazgo aparecía en dos dimensiones se conservó un único ID.

---

## 5. Hallazgos detallados

### 5.1 CRÍTICA

#### H-01 — PII real de clientes CANTV versionada en git y no cubierta por `.gitignore`
- **Área:** Privacidad / Datos personales (PII).
- **Detalle:** CONFIRMADO. La muestra diaria del sistema interno CANTV está trackeada en el repositorio y contiene datos personales y de servicio reales de suscriptores: nombre del cliente que reporta, nombre del titular, teléfono de contacto, dirección completa con piso/apto, serial del ONT, OLT e IP de gestión, además de comentarios libres que repiten teléfono y serial. `git ls-files` la incluye y el `.gitignore` solo ignora `RepoTecnico/entrada/`, `salida/`, `evidencias/` y `*.zip`, por lo que no la cubre. Los remotos ya están configurados (GitHub `anlucorporations/GGTO`, GitLab `anlucorporations/ggto`), de modo que cualquier push expone PII de suscriptores fuera del control de CANTV. Es el hallazgo más grave y accionable.
- **Evidencia:** `git ls-files` incluye `RepoTecnico/detalle_averias_gpon 12_09_2026.csv`; la línea 53 contiene nombres reales, teléfonos, dirección completa, serial ONT e IP de OLT; `RepoTecnico/.gitignore` solo ignora `RepoTecnico/entrada/`, `RepoTecnico/salida/`, `RepoTecnico/evidencias/`, `*.zip`; `git remote -v` muestra GitHub y GitLab.
- **Recomendación:** antes de cualquier push, retirar el CSV del índice y purgarlo del historial (`git filter-repo`/BFG), añadir `RepoTecnico/**/*.csv` y `detalle_averias_gpon*.csv` al `.gitignore`, sustituir la muestra por un subconjunto pseudonimizado (teléfono/dirección/serial enmascarados) y notificar a CANTV si el repo ya tuvo exposición. Definir que los CSV diarios vivan en un bucket con CMEK y acceso auditado, nunca en el repositorio.

#### H-02 — El CSV maestro es ISO-8859-1 pero la ingesta está configurada como UTF-8
- **Área:** Ingesta de datos / codificación.
- **Detalle:** La muestra real no es UTF-8: `file` la reporta como `ISO-8859 text` y la decodificación UTF-8 estricta falla (`invalid continuation byte 0xd1` en el offset 13023), mientras `entornos_globales.md:123` fija `INGESTA_CSV_ENCODING=utf-8`. El impacto no es cosmético: hay texto acentuado real (`MAÑANA`, `DAÑADO`), de modo que un parser UTF-8 estricto aborta la ingesta y uno con `errors='replace'` corrompe esos campos en silencio. Afecta además a la regla de negocio de la cuadrilla 0, cuya frase `Fibra Dañada` no casaría con la `ñ` corrupta. Se suman riesgos de parsing confirmados: fechas `dd/mm/aaaa hh:mm:ss a.m./p.m.` en columnas `timestamptz` y `fecha_cita` vacía en 51/56 filas.
- **Evidencia:** `file` sobre el CSV → `ISO-8859 text`; fallo UTF-8 en byte `0xd1`; contenido acentuado en col. 27; `entornos_globales.md:123` (`INGESTA_CSV_ENCODING=utf-8`), `:110` (`APP_TIMEZONE=America/Caracas`); `db/schema.sql:732` (`Fibra Dañada`); `diccionario_datos.md:16` (formato de fecha).
- **Recomendación:** fijar la codificación real detectada (ISO-8859-1 / cp1252), decodificar a UTF-8 en la frontera de ingesta sin `errors='ignore'` (fallar ruidosamente), normalizar mayúsculas/acentos antes de cualquier comparación y definir un parser de fecha locale-aware que tolere celdas vacías. Añadir un test de ingesta con esta muestra real.

#### H-03 — Punto único de fallo: persistencia en instancia Cloud SQL compartida, zonal y sin backups/PITR
- **Área:** Base de datos / infraestructura (Fiabilidad y Seguridad).
- **Detalle:** CONFIRMADO y **fusionado** desde R3, R6 y R7. La persistencia de GGTO depende de la instancia reutilizada `truekeate-db-dev` del proyecto `truekeate-main`, `db-f1-micro`, 10 GB PD_SSD, disponibilidad ZONAL, compartida físicamente con la aplicación TrueKeate (separación solo lógica por base de datos). La documentación registra SSL no obligatorio (`ALLOW_UNENCRYPTED_AND_ENCRYPTED`), IP pública, backups ❌, PITR ❌ y protección de borrado ❌. Sin PITR no hay recuperación a un punto en el tiempo ante una ingesta diaria defectuosa; el tier micro zonal compartido no soporta carga concurrente ni está aislado. La migración a instancia propia (`ggtov2-pg`, REGIONAL, SSL obligatorio) está bloqueada por facturación. **No se descarta ninguna de sus sub-afirmaciones.**
- **Evidencia:** `GGTOv2_GCP.md:345-348` (`db-f1-micro`, ZONAL, SSL `ALLOW_UNENCRYPTED_AND_ENCRYPTED`, backups/PITR/protección ❌/❌/❌), `:281-284` (config segura solo para `ggtov2-pg`), `:390-393`; `entornos_globales.md:80-81`, `:119`, `:217`; `requerimientos.md:152-153` y §5 (sin RNF de backup/RPO/RTO).
- **Recomendación:** no cargar datos reales hasta: (a) fijar `sslMode=ENCRYPTED_ONLY` y conectar por Cloud SQL Auth Proxy/IP privada; (b) habilitar backups automáticos, PITR y `deletionProtectionEnabled`; (c) planificar la migración a `ggtov2-pg` con CMEK de disco; (d) documentar y probar un restore. Añadir RNF-16 de Backup/Recuperación con RPO/RTO y prueba de restauración periódica; registrar el riesgo residual por escrito.

#### H-04 — La cuadrilla 0 modela solo PROCEDIMIENTO 3, ignora GENERALIDADES 3.5 y no discrimina en los datos reales
- **Área:** Gestión automatizada / trazabilidad con el brief.
- **Detalle:** CONFIRMADO y **fusionado** desde R1 y R5. El brief da DOS criterios para los casos del supervisor (cuadrilla 0): (a) GENERALIDADES 3.5 —casos enviados a otras colas o con NAVEGACION LENTA, PON INTERMITENTE u otro adjetivo de no-atención en casa— y (b) PROCEDIMIENTO 3 —casos que NO tengan LOSS ROJO, FALLA FIBRA o Fibra Dañada. `requerimientos.md` solo modela (b) en RF-25 y omite por completo (a): no existe configuración ni regla para "enviado a otras colas" ni lista de frases de supervisor. Verificado en la muestra real: 3 ocurrencias de `PON INTERMITENTE` y 2 de `navegacion lenta`; **ninguna** de las frases modeladas. Como RF-25 asigna a cuadrilla 0 todo caso que no contenga las frases de exclusión, con los datos reales prácticamente todos los casos irían al supervisor, invirtiendo el despacho de calle. No hay decisión registrada que resuelva la relación/contradicción entre ambos criterios.
- **Evidencia:** `BRIEF-GGTO-INICIAL.md:45` (3.5) y `:93` (procedimiento 3); `requerimientos.md:108` (RF-25); `db/schema.sql:732` y `diccionario_datos.md:443` (`despacho.frases_excluir` sin `frases_supervisor`); CSV: 3×`PON INTERMITENTE`, 2×`navegacion lenta`, 0×frases modeladas.
- **Recomendación:** resolver con el usuario cuál criterio prevalece o cómo se combinan (bloque de entrevista) y registrarlo en `estado_proyecto.md`; modelar `PON INTERMITENTE / NAVEGACION LENTA / otras colas` como configuración (`despacho.frases_supervisor` y flag/seguimiento por cola) y añadir un caso de aceptación con la muestra real que cuente cuántos casos van a cuadrilla 0.

### 5.2 ALTA

#### H-05 — Las columnas de causa del CSV (56, 57 y 59) no tienen destino en `caso` y el diccionario describe el catálogo de causas de forma incompatible con el DDL
- **Área:** Consistencia `diccionario_datos.md` ↔ `db/schema.sql` ↔ `modelo_er.md` (ingesta CSV).
- **Detalle:** El mapeo de ingesta del diccionario (§3.2, por posición) asigna la col. 56 `codigo_causa` a un campo destino `codigo_causa`, la col. 57 `descripcion` a `descripcion_causa` y la col. 59 `descripcion` a `descripcion_subcausa`. Ninguno de esos tres campos existe en la tabla `caso` (solo existe `subcodigo_causa`, col. 58, y la FK `id_causa`); tampoco figuran en el modelo E-R. Además, §3.1 no lista `id_causa`, pese a que `schema.sql` y `modelo_er.md` sí lo incluyen. La sección de mapeo no indica que esas columnas se vuelquen al catálogo `causa`, de modo que la ingesta (RF-21/RF-22) y la carga del catálogo desde el CSV (D-08/P1.3) quedan sin destino explícito. Severidad ajustada de CRÍTICA a ALTA por existir un destino plausible (la tabla `causa`, que D-08 declara poblar desde el CSV).
- **Evidencia:** `diccionario_datos.md:279-282`, `:203-214`; `db/schema.sql:337`, `:341`, `:276`; `modelo_er.md:274`, `:253-261`; encabezado CSV verificado por posición.
- **Recomendación:** fijar un único modelo y sincronizar los tres artefactos: (a) poblar el catálogo `causa` (codigo_causa, subcodigo_causa, descripción) desde las cols. 56–59 y resolver `caso.id_causa` por lookup; o (b) añadir a `caso` las columnas desnormalizadas. Documentar la regla en §3.2, añadir `id_causa` a §3.1 y registrar la decisión.

#### H-06 — RF-25 filtra por la columna "Falla Reportada", que no existe en el CSV de 80 columnas ni en el diccionario ni en el DDL
- **Área:** Consistencia `requerimientos.md` ↔ CSV/diccionario/schema (RF-25).
- **Detalle:** RF-25 (cuadrilla 0) exige buscar las frases de exclusión en las columnas `Falla Reportada`, `Último Comentario` y `problema_reporte`. Al inspeccionar el encabezado real del CSV no existe ninguna columna `Falla Reportada`: las columnas de información disponibles son `ultimo_comentario` (col. 21), `problema_reporte` (col. 28), `informacion` ×2 (cols. 31–32) y `descripcion` ×3 (cols. 52, 57, 59). El diccionario mapea `ultimo_comentario` y `problema_reporte`; `schema.sql` solo define `ultimo_comentario`, `problema_reporte`, `informacion_1/2` y `descripcion_problema`. El texto de RF-25 es transcripción literal del brief, que también nombra una columna inexistente; el criterio no es implementable sin aclarar la fuente.
- **Evidencia:** `requerimientos.md:108`; `BRIEF-GGTO-INICIAL.md:93`; encabezado CSV real (col. 21, 28, 31–32, 52/57/59, sin `Falla Reportada`); `diccionario_datos.md:244,251`; `db/schema.sql:305,311`, `:732-733`.
- **Recomendación:** confirmar con el cliente a qué columna real corresponde `Falla Reportada` (probablemente `problema_reporte`/`descripcion_problema`) y corregir RF-25, el mapeo del diccionario y `despacho.frases_excluir`; si no existe, eliminar esa columna del criterio y dejar constancia en `estado_proyecto.md`.

#### H-07 — Alcance inconsistente de WhatsApp/Telegram: figura en la v1 de los requisitos pero D-12/P3.1 lo difiere a la v3
- **Área:** Consistencia de alcance entre requerimientos, decisiones y modelo de datos.
- **Detalle:** **Fusionado** desde R2 y R5. `requerimientos.md` mantiene WhatsApp como canal de la primera versión en RF-06, RF-27, el procedimiento de despacho, RNF-07, RNF-11, RT-06 y en ACT-02/ACT-03, mientras RF-10 y RF-16 lo mandan a la v3 y `estado_proyecto.md` D-12/P3.1 lo confirman ("Solo bot de Telegram en esta etapa"). En el modelo de datos la contradicción es simétrica: el diccionario aún incluye WHATSAPP en `caso.origen`, `solicitante.canal`, `despacho.enviado_canal` y `notificacion.canal`, mientras `schema.sql` y `modelo_er.md` ya lo excluyeron. `entornos_globales.md` ya está alineado con la v3. No es un deseo perdido (la decisión está respaldada por el usuario): es texto y criterios obsoletos que pueden forzar trabajo no acordado.
- **Evidencia:** `requerimientos.md:31,44-45,80,110,121,154,158,175` vs `:84,95`; `estado_proyecto.md:64,111`; `diccionario_datos.md:207,315,368,440`; `db/schema.sql:267,367,444,621`; `modelo_er.md:310,369,602`; `entornos_globales.md:189`.
- **Recomendación:** fijar WhatsApp como v3 (alineado a D-12) y actualizar `requerimientos.md` (RF-06, RF-27, procedimiento, RNF-07, RNF-11, RT-06, ACT-02/ACT-03) y los cuatro enums del diccionario para que coincidan con `schema.sql`/`modelo_er.md`/`entornos_globales.md`.

#### H-08 — `estado_proyecto.md` declara la Fase 1 COMPLETA con contradicciones internas, pero `requerimientos.md` sigue sin validar
- **Área:** Consistencia del estado de la Fase 1.
- **Detalle:** `estado_proyecto.md` marca la Fase 1 como COMPLETA y sus criterios como cumplidos, pero: (a) §1 deja sin marcar "Entrevista Fase 1 respondida" y "Repositorios/GCP" mientras §5/§6 los dan por cumplidos; (b) §4 "Próximos pasos" todavía pide "Realizar la entrevista de la Fase 1"; (c) `requerimientos.md` sigue en "Borrador v0.1 — requiere validación del usuario", mantiene S-01..S-12 como "A confirmar" pese a que P1.1–P5.3 ya están respondidas, y sus criterios §10 dejan sin marcar `diccionario_datos.md` y `entornos_globales.md` aunque ambos existen. Además, `schema.sql` ya fija de facto dominios que `requerimientos.md` declara abiertos (9 estados de caso, prioridad ALTA/MEDIA/BAJA, origen de falla masiva, catálogo `causa`) sin registrarlo como D-xx. Rompe el control de fase y la trazabilidad de decisiones.
- **Evidencia:** `requerimientos.md:11,203-214,232-233`; `estado_proyecto.md:7,23-25,26-28,79,95-129,139-147`; `db/schema.sql:272-274,379-380,473-474,51-61`; `estado_proyecto.md:60`.
- **Recomendación:** sincronizar `requerimientos.md` con las respuestas (cerrar S-01..S-12 o remitirlas a D-xx), marcar los criterios §10 y subir versión/estado; corregir §1 y §4 de `estado_proyecto.md`; registrar como D-22..D-24 las decisiones ya fijadas por el DDL antes de iniciar la Fase 2.

#### H-09 — `caso.id_averia` es NOT NULL UNIQUE, pero el brief admite REFERIDOS sin id de incidencia y el despacho exige incluirlos
- **Área:** Consistencia modelo de datos ↔ brief (casos sin id_averia). **Fusionado** desde R2, R5 y R6.
- **Detalle:** El brief define REFERIDOS como casos que "no poseen id de incidencia" (recogido en `caso_especial.tiene_id_averia`, default false) y exige despachar "al menos 2 reparaciones de referidos" por despacho. Pero `db/schema.sql` exige `caso.id_averia varchar(30) NOT NULL UNIQUE`; `despacho_caso.id_caso` y `actividad.id_caso` son NOT NULL FK→caso, y `caso_especial.id_caso` es nullable. No hay vía para que un referido sin id_averia entre al despacho ni reciba actividad/evidencias (solo las citas lo soportan vía `cita.id_caso_especial`). `despacho_caso.tipo_asignacion` sí admite `REFERIDO`, lo que hace la contradicción explícita.
- **Evidencia:** `BRIEF-GGTO-INICIAL.md:59,83`; `requerimientos.md:63,119`; `db/schema.sql:265,373,381,456,460-461,491`; `modelo_er.md:265,631`; `diccionario_datos.md:328,199`.
- **Recomendación:** definir el tratamiento: permitir `id_averia NULL` con índice único parcial (`WHERE id_averia IS NOT NULL`), o generar un identificador sintético prefijado por origen (`REF-…`), o hacer `despacho_caso`/`actividad` polimórficas hacia `caso_especial`. Añadir la regla a `modelo_er.md` §8 y un criterio de aceptación para el reporte de producción con referidos.

#### H-10 — El bloqueo de facturación deja sin destino real el bucket de evidencias y sin KMS/secretos propios la arquitectura declarada
- **Área:** Infraestructura GCP. **Fusionado** desde R6 y R7.
- **Detalle:** D-16 establece Cloud Storage para evidencias y Cloud KMS/Secret Manager "desde el inicio", y `STORAGE_BUCKET=ggtov2-assets-905974355709` se declara operativo. Pero la cuenta de facturación tiene sus 5 cupos agotados y `billingEnabled:false`, por lo que no se pueden crear bucket, llaves KMS, secretos propios, Artifact Registry, Cloud Run ni la instancia Cloud SQL propia. El bucket referenciado **no existe** y el flujo de subida de imágenes y del ZIP de evidencias carece de destino real. Severidad ajustada de CRÍTICA a ALTA por ser un bloqueo administrativo conocido, con remediación en un comando (`provision_all.sh`), despliegue local según D-15 y secretos de BD ya operativos en `truekeate-main`.
- **Evidencia:** `GGTOv2_GCP.md:35,197-210` (Storage/KMS/Secret Manager/Cloud Run/Cloud SQL ❌); `estado_proyecto.md:68` (D-16); `entornos_globales.md:57,65,150,213-214`.
- **Recomendación:** tratar el desbloqueo de facturación como dependencia bloqueante con dueño y fecha, o definir un plan v1 de contingencia (evidencias en disco local con ruta controlada y secretos en `truekeate-main`), documentando la deuda y el plan de migración a GCS/KMS. No iniciar la implementación de subida de evidencias hasta que exista bucket real o el fallback acordado.

#### H-11 — Tabla `caso` monolítica y desnormalizada, e incompatible con casos manuales/REFERIDO sin `id_averia`
- **Área:** Modelo de datos / tabla `caso`. **Fusionado** con el ángulo estructural de H-09.
- **Detalle:** `caso` concentra ~84 columnas (los 80 campos del CSV), con geografía copiada por fila (region, municipio, parroquia, distrito, area, nombre_central…) sin FK a `central`, `ayudantes` en jsonb y campos de despacho del origen. Esto duplica la geografía en cada caso, impide cambiar la configuración de la central sin tocar el histórico y castiga escritura/consulta. La clave natural obligatoria (ver H-09) contamina además la deduplicación global de RF-22 si se inventan `id_averia` para casos manuales.
- **Evidencia:** `db/schema.sql:260-360` (~84 columnas), `:265`, `:283-293`, `:371-388`; `requerimientos.md:63,80,105`; `diccionario_datos.md:36`.
- **Recomendación:** definir con el cliente la clave canónica de los casos manuales (ver H-09) y normalizar la geografía a FK `id_central`; mover los 80 campos de origen a una tabla `caso_origen_csv` (1:1) para aligerar la tabla caliente.

#### H-12 — Sincronización offline sin idempotencia ni resolución de conflictos definida
- **Área:** Sincronización offline / concurrencia. **Fusionado** desde R1 y R6.
- **Detalle:** La operación de campo es offline-first (Flutter + SQLite, D-11) y sincroniza al loguearse, pero el modelo solo marca `actividad.sincronizado boolean` y no aporta los elementos mínimos de una sincronización segura: no hay identificador generado por el cliente ni clave de idempotencia, no hay unicidad por (caso, tipo, fecha/hora) ni por dispositivo, no hay versión/vector de actualización y no hay política de conflicto. Si un técnico reintenta una subida parcial, dos dispositivos gestionan el mismo caso o se edita desde web y APK, el resultado previsible son actividades duplicadas, actualizaciones perdidas y estados inconsistentes. La regla "sin solapar citas" (RF-12) es solo de UI: `cita` no tiene constraint de solapamiento y su índice `(id_cuadrilla, fecha_hora)` no es único.
- **Evidencia:** `db/schema.sql:489-506`, `:416-433`, `:661`; `requerimientos.md:129,137,153`; `estado_proyecto.md:105`; `BRIEF-GGTO-INICIAL.md` (DISPOSITIVO/SINCRONIZAR).
- **Recomendación:** diseñar ya el protocolo: `sync_id` UUID generado en el dispositivo para actividades y evidencias, upsert idempotente, `UNIQUE` en la clave natural de cada operación, control de versión por fila (optimistic locking) y validación de solapamiento de citas en servidor (`tstzrange`). Documentar la política de conflicto y un procedimiento de reconciliación de evidencias huérfanas.

#### H-13 — No hay migraciones ni versionado del esquema: el DDL monolítico idempotente no admite cambios sobre una base ya creada
- **Área:** Base de datos / mantenibilidad.
- **Detalle:** `db/schema.sql` se aplica con `psql -f` y todo el DDL usa `CREATE TABLE IF NOT EXISTS`. Cualquier cambio futuro de columnas, constraints o índices (que ocurrirá en Fase 3 al definir métricas D-17, causas, prioridades S-11, etc.) NO se aplicará sobre una base ya creada: no hay `ALTER`, no hay tabla de versión de esquema, ni migraciones incrementales ni rollback. D-21 dice que el archivo "se edita a medida del desarrollo" contra la instancia compartida, de modo que base, DDL y diagramas pueden divergir sin control. Ya hay señal de deriva: el diagrama `CASO` de `modelo_er.md` documenta 27 campos frente a ~84 columnas reales en `caso`.
- **Evidencia:** `db/schema.sql:9-15` y 35 `CREATE TABLE IF NOT EXISTS`; `estado_proyecto.md:73` (D-21); `modelo_er.md:262-291` vs `db/schema.sql:260-360`.
- **Recomendación:** adoptar una herramienta de migraciones desde el primer commit (Alembic o Flyway), con carpeta `migrations/`, tabla de versión y rollback; generar el DDL base desde la migración inicial y añadir verificación automática que compare el esquema real con `modelo_er.md`/`diccionario_datos.md`.

#### H-14 — Telegram, correo y MCP sin fallback ni reintentos frente a un plazo operativo duro
- **Área:** Integraciones / notificaciones.
- **Detalle:** La operación v1 depende de un único bot de Telegram y de un servicio de correo (SendGrid free / Gmail), con WhatsApp diferido a v3. RF-10, RF-16 y RF-27 exigen enviar fichas de cuadrilla, alertas de falla masiva y el reporte de producción a las 16:00 (entregas con hora límite). `notificacion` registra estado `FALLIDO` y el error, pero no tiene intentos/backoff, cola de reintentos, canal secundario ni alerta cuando un envío falla; el MCP tampoco tiene fallback declarado. Un token revocado, el límite de 100 correos/día o una caída de Telegram dejarían el despacho y las alertas sin entregar sin que nadie lo detecte.
- **Evidencia:** `estado_proyecto.md:64,66`; `entornos_globales.md:127,135-147`; `requerimientos.md:84,95,110,158`; `db/schema.sql:619-631`.
- **Recomendación:** implementar patrón outbox: persistir la notificación y procesarla con reintentos exponenciales y estado terminal, con canal de fallback (correo como respaldo de Telegram) y alerta al supervisor cuando un envío crítico falle o no se confirme. Definir monitoreo de las entregas de las 16:00 y una alternativa manual documentada.

#### H-15 — Catálogo de roles reducido a 3 y sin matriz RBAC para los actores no-login
- **Área:** Stakeholders / Roles y RBAC. **Fusionado** desde R4 y R7.
- **Detalle:** El modelo fija exactamente tres roles base (ADMIN, SUPERVISOR, TECNICO) y no existe matriz rol × módulo × acción. Los demás stakeholders que el brief y el CSV evidencian (despachador, administrador de catálogos, flota/mantenimiento, almacén/insumos, auditoría, solicitante externo) no tienen rol, permiso ni ámbito asignado. `rol.permisos` es un jsonb vacío por defecto, sin matriz definida. Severidad ajustada de CRÍTICA a ALTA: no es una omisión silenciosa (P2.1/D-09 registra los 3 roles como respuesta explícita del usuario), pero el vacío de RBAC es material para Fase 2/3.
- **Evidencia:** `estado_proyecto.md:61,103`; `db/schema.sql:692-696,40-48`; `modelo_er.md:85-89`; `requerimientos.md:41-48`.
- **Recomendación:** elaborar la matriz RBAC (rol × módulo × acción) y decidir explícitamente qué roles existen en v1 (p. ej. DESPACHADOR, CATALOGOS, ALMACEN, AUDITOR) y cuáles quedan como permisos dentro de ADMIN/SUPERVISOR; registrarlo en `estado_proyecto.md` (nueva D-xx) y reflejarlo en `schema.sql` y `modelo_er.md`.

#### H-16 — RNF-08 "sin degradar la operación" y RNF-15 sin umbral numérico ni volumen base; volumetría y sectorización sin índices
- **Área:** RNF / Rendimiento y Capacidad. **Fusionado** desde R1, R3 y R6.
- **Detalle:** RNF-08 exige ingesta diaria del CSV "sin degradar la operación" y su criterio reconoce que el objetivo está "por definir". No hay p95/p99 de duración, ni N de filas del universo supuesto, ni entorno/concurrencia de medición, ni definición operativa de "degradar". RNF-15 tampoco fija volumen objetivo. La única referencia es la muestra de 56 registros, no representativa. Además, la asignación de sector (RF-23) se define por coincidencia de texto normalizado de `caso.direccion` contra `sector_direccion.patron`, pero no hay índice sobre `caso.direccion` ni índice trigram/GIN (`pg_trgm` ausente); un escaneo secuencial por cada patrón en cada ingesta/despacho se degrada linealmente con el histórico y la tabla `caso` no está particionada. Sumado al tier `db-f1-micro` compartido, el riesgo es alto y no medible. Severidad ajustada de CRÍTICA a ALTA por ser un vacío ya reconocido en el propio documento.
- **Evidencia:** `requerimientos.md:155,162`; `estado_proyecto.md:20-21`; `entornos_globales.md:71-81`; `diccionario_datos.md:98,112-114`; `db/schema.sql:119-135,648-665`.
- **Recomendación:** obtener de CANTV el perfil real de volumetría (casos/día, activos, acumulado, fotos/día) y convertir RNF-08/RNF-15 en SLO medibles con dataset de prueba versionado (N filas en <X min p95; respuesta de PANEL/despacho <X s); instalar `pg_trgm` con índice GIN sobre `caso.direccion` y `sector_direccion.patron`; materializar/cachear la asignación de sector; planificar particionado o archivado de `caso`; incorporar prueba de carga con un año de histórico simulado.

#### H-17 — Datos personales de clientes y trabajadores sin RNF de retención, minimización, anonimización ni base normativa
- **Área:** Cumplimiento normativo / Privacidad de PII. **Fusionado** desde R3, R4 y R7.
- **Detalle:** El modelo almacena PII de clientes CANTV (nombre_cliente, teléfono, dirección, teléfonos) y de trabajadores (cédula, teléfono, correo), pero no existe ningún RNF de privacidad sobre finalidad, retención, minimización, anonimización/enmascaramiento por rol ni eliminación. RNF-05 (etiquetado "Privacidad") solo cubre bloquear la app para no exponer información. No se cita marco normativo aplicable (protección de datos personales en Venezuela, CONATEL, políticas internas CANTV) ni se define quién ve PII ni por cuánto tiempo. La infraestructura prevista procesa en `europe-west1` y la instancia compartida actual en `southamerica-east1` (ambas fuera de Venezuela) y se planea correo por SendGrid/Gmail (EE. UU.), lo que constituye transferencia internacional no evaluada. El DLP está previsto pero bloqueado por facturación y sin RNF que lo respalde.
- **Evidencia:** `diccionario_datos.md:143-148,237,256-257,293-294`; `requerimientos.md:152` y §5; búsqueda negativa de `LOPDP/CONATEL/consentimiento/retención/ARCO` en `RepoTecnico/*.md`; `GGTOv2_GCP.md:210,260,407,275,341`; `entornos_globales.md:138-142`.
- **Recomendación:** añadir RNF de Privacidad/Cumplimiento: base legal y finalidad, aviso de privacidad, inventario y clasificación de PII, minimización, tabla de retención por entidad (caso, actividad, auditoría, evidencia, notificación), cifrado en reposo, enmascaramiento de teléfono/dirección para roles no autorizados, procedimiento de derechos del titular y DPA con proveedores. Nombrar un responsable de protección de datos del lado CANTV y validar con asesoría legal venezolana antes de la Fase 3.

#### H-18 — RF-09: "concentración de casos" y "mayor cercanía" sin umbral, radio, ventana temporal ni algoritmo
- **Área:** RF-09 / Fallas masivas.
- **Detalle:** RF-09 y D-19 definen la detección automática de fallas masivas "por concentración de casos" y la asignación "a la cuadrilla con mayor proximidad de sector". S-12 sigue marcando "Origen, detección y criterio de mayor cercanía" como "A confirmar". No se especifica qué cuenta como concentración (N casos en la misma FAT/OLT/sector/parroquia y en cuántas horas), si la cercanía es geográfica, por sector compartido o por contigüidad de códigos, ni el desempate. El modelo no guarda parámetros: `falla_masiva` no tiene umbral/ventana y `configuracion` no incluye claves de falla masiva. Comportamiento irreproducible y no testeable.
- **Evidencia:** `requerimientos.md:83,214`; `estado_proyecto.md:71,129`; `BRIEF-GGTO-INICIAL.md:24`; `diccionario_datos.md:383`; `db/schema.sql:468-483,726-736`.
- **Recomendación:** definir y persistir en `configuracion`: (a) métrica de concentración (p. ej. ≥N casos activos en el mismo fat/olt o sector dentro de H horas) con valores por defecto; (b) regla de "mayor cercanía" (sector compartido con más casos o distancia en metros) y desempate determinista; (c) si la detección es bloqueante o solo sugerencia. Añadir claves de configuración y un test con casos sembrados.

### 5.3 MEDIA

#### H-19 — RF-25: criterio abierto del brief ("u otro adjetivo…") no enumerable ni testeable; catálogo de frases fijo y no configurable
- **Área:** RF-25 / Gestión automatizada (cuadrilla 0). Complementa a H-04.
- **Detalle:** El brief define la cuadrilla 0 con un criterio semántico abierto ("NAVEGACION LENTA, PON INTERMITENTE u otro adjetivo que indique no ser de atención en casa del cliente"). RF-25 lo reduce a tres frases exactas (`LOSS ROJO`, `FALLA FIBRA`, `Fibra Dañada`) y tres columnas, sin catálogo de sinónimos ni criterio para "otro adjetivo" (¿quién lo mantiene?, ¿es configurable?). Aunque RNF-10 exige reglas configurables sin cambiar código, hoy `configuracion` solo trae 3 frases y el CSV real contiene variantes no contempladas (p. ej. `NAVEGA LENTO Y NO TIENE TONO PARA VOZ IP`). El comportamiento no puede validarse contra el deseo original.
- **Evidencia:** `BRIEF-GGTO-INICIAL.md:45,93`; `requerimientos.md:108,157`; `db/schema.sql:732-733`; CSV fila 2.
- **Recomendación:** transformar el criterio en catálogo configurable y enumerable (lista de frases/expresiones con operador contiene/case-insensitive/regex y columnas a evaluar, mantenida en CONFIGURACIÓN); documentar la semántica final con el cliente y añadir un lote de prueba con variantes reales (`NAVEGA LENTO`, `PON INTERMITENTE`, `SIN TONO`).

#### H-20 — RNF-01: "3 de 12 palabras" y bloqueo sin formato de verificación ni alcance definido
- **Área:** RNF-01 / Autenticación y recuperación.
- **Detalle:** RNF-01 y RF-20 definen bloqueo tras 3 intentos y desbloqueo con "3 de las 12 palabras de seguridad", pero no precisan si el orden importa, si se comparan normalizadas (tildes/mayúsculas/espacios), si las palabras se presentan para elegir o se escriben, si el bloqueo aplica a usuario, dispositivo o ambos, si el contador se reinicia al desbloquear y cuánto dura el bloqueo. `dispositivo_seguridad.palabras_hash` admite 12 hashes pero no documenta el algoritmo ni el protocolo de reto. La recuperación no es reproducible en pruebas.
- **Evidencia:** `requerimientos.md:148,99`; `diccionario_datos.md:424-426`; `db/schema.sql:538-547`; `BRIEF-GGTO-INICIAL.md:103`.
- **Recomendación:** especificar el protocolo (palabras exigidas y orden libre, normalización, almacenamiento con sal y algoritmo, alcance del bloqueo, política de reinicio/expiración y límite de intentos) y añadir tests de los caminos: 3 fallos, recuperación válida/inválida y bloqueo de app.

#### H-21 — RF-12: "sin solapar citas ya acordadas" sin granularidad, duración ni restricción verificable
- **Área:** RF-12 / Citas.
- **Detalle:** RF-12 exige seleccionar fecha/hora "sin solapar citas ya acordadas"; el diccionario anota "Sin solapamiento" y el schema comenta "sin solapamiento por cuadrilla" con índice sobre `(id_cuadrilla, fecha_hora)`. No se define el recurso a proteger (técnico, cuadrilla o ambos), la duración de una cita (la tabla no tiene hora_fin ni duración), la holgura, ni qué ocurre con estados CANCELADA/DIFERIDA. No existe constraint ni validación que impida el solape; el comentario del schema no es verificable por test. Sin duración, "solapar" es indeterminado.
- **Evidencia:** `requerimientos.md:129`; `diccionario_datos.md:348`; `db/schema.sql:415,416-430,661`; `modelo_er.md:336`.
- **Recomendación:** definir recurso protegido, duración por defecto y holgura, y estados que no bloquean; añadir `duracion_min`/`hora_fin` y una restricción de exclusión o validación transaccional; cubrir con tests (dos citas solapadas → rechazo; contiguas → aceptación; cancelada → no bloquea).

#### H-22 — RNF-06: operación offline "sin pérdida" sin reglas de resolución de conflictos ni criterio de consistencia
- **Área:** RNF-06 / Offline y sincronización. Complementa a H-12.
- **Detalle:** RNF-06 exige operación offline con sincronización asíncrona y verificación "sin pérdida", pero no define qué ocurre si un caso fue modificado en servidor mientras el dispositivo estaba offline (last-write-wins, gana servidor o merge por campo), cómo se evita duplicar actividades/evidencias si la sincronización se reintenta, ni qué pasa con citas creadas offline que chocan con las de web. `"Sin pérdida"` no es medible sin esas reglas.
- **Evidencia:** `requerimientos.md:137,153`; `db/schema.sql:489-506,550-563`; `estado_proyecto.md:105`.
- **Recomendación:** especificar política de sincronización (clave de idempotencia, resolución de conflictos por entidad/campo, tratamiento de citas offline) y un criterio verificable ("tras 5 ciclos offline/online con edición concurrente no se pierde ninguna actividad y no hay duplicados"), con tests de conflicto y reintento.

#### H-23 — El diccionario modela `actividad.metodo`/`codigo_causa` y `causa.codigo_causa` (PK) como texto, mientras `schema.sql`/`modelo_er.md` usan claves sustitutas
- **Área:** Consistencia de normalización de `causa` y `actividad`. **Fusionado** desde R2.
- **Detalle:** El diccionario describe `actividad.metodo` como varchar (`IVR`/`COS`/`SACAS` o cola) y `actividad.codigo_causa` como varchar FK→causa, y define `causa` con `codigo_causa` como PK y un campo `subcodigo`. `schema.sql` y `modelo_er.md` usan `actividad.id_metodo integer FK→catalogo_metodo` e `id_causa integer FK→causa`, y `causa` con `id_causa serial PK`, `subcodigo_causa` y `UNIQUE(codigo_causa, subcodigo_causa)`. La forma textual no puede satisfacer esas FK y contradice la normalización ya implementada; el diccionario tampoco lista `id_metodo`/`id_causa` ni refleja la clave compuesta, lo que afecta a la carga del catálogo desde el CSV (D-08).
- **Evidencia:** `diccionario_datos.md:401-402,438`; `db/schema.sql:499-500,51-61`; `modelo_er.md:441-442,253-261,476-480`.
- **Recomendación:** adoptar el modelo normalizado (`id_metodo`/`id_causa`, PK sustituta, `subcodigo_causa`) como canónico y corregir el diccionario §6.1 y §7; documentar la equivalencia con `catalogo_metodo` y `causa` y asegurar que la carga desde el CSV use la clave compuesta `(codigo_causa, subcodigo_causa)`.

#### H-24 — Múltiples dominios de estado del diccionario no coinciden con los CHECK del DDL ni con el modelo E-R
- **Área:** Consistencia de enums (diccionario ↔ schema ↔ modelo).
- **Detalle:** Además de WHATSAPP (H-07), varios dominios fueron ampliados en `schema.sql` sin actualizar el diccionario: `flota.status` (dicc: DISPONIBLE/EN RUTA/MANTENIMIENTO; DDL añade FUERA_SERVICIO y usa EN_RUTA), `tecnico.status` (sin SUSPENDIDO), `herramienta.estado` (sin PERDIDA), `cuadrilla_tecnico.rol_cuadrilla` (sin SUPERVISOR), `cita.estado` (sin CANCELADA) y `catalogo_metodo.dominio` (sin CONTACTO). Incumple la regla de sincronización D-21.
- **Evidencia:** `diccionario_datos.md:165,150,174,189-190,350,439` vs `db/schema.sql:181,147,196,224,425,67`; `modelo_er.md:471`.
- **Recomendación:** reconciliar cada dominio con los CHECK vigentes (o revertir el DDL si se prefiere el valor documentado) y verificar contra el brief; mantener la regla D-21 entre diccionario, `modelo_er.md` y `schema.sql`.

#### H-25 — RF-23: regla de sectorización por coincidencia de texto sin semántica de prioridad ni umbral de cobertura
- **Área:** RF-23 / Sectorización.
- **Detalle:** La asignación de casos a sectores se define por coincidencia de texto sobre `caso.direccion`, con desempate "mayor prioridad de sector y mayor longitud de patrón" y tipo CONTIENE/EXACTO/REGEX. No se formaliza si la comparación es substring en cualquier posición, cómo se normalizan tildes/mayúsculas de forma idéntica en patrones y datos, si el regex es case-insensitive, qué pasa con múltiples coincidencias del mismo sector, ni si "mayor prioridad" es ascendente o descendente (`prioridad` default 100 sin semántica de orden). No hay umbral de cobertura ni alerta para casos "sin sector". El algoritmo está descrito en lo esencial (de ALTA a MEDIA).
- **Evidencia:** `diccionario_datos.md:100-114`; `db/schema.sql:119-129,105-116`; `estado_proyecto.md:96`.
- **Recomendación:** documentar pseudocódigo exacto de `asignar_sector(direccion)` (normalización Unicode/acentos/mayúsculas/espacios, orden de evaluación, múltiples patrones y regex inválido, resultado "sin sector"); fijar un KPI de cobertura sobre lote real (p. ej. ≥X % sectorizados) y exponer los casos sin sector en CONFIGURACIÓN.

#### H-26 — Sin RNF de observabilidad de aplicación: logs, métricas, trazas y alertas de negocio
- **Área:** Observabilidad / Monitoreo (ISO 25010).
- **Detalle:** La documentación solo describe observabilidad a nivel de infraestructura GCP (Cloud Logging/Monitoring/Trace, Query Insights y flags de PostgreSQL). No hay RNF de logs estructurados de aplicación, correlación/request-id, métricas de negocio (ingestas fallidas, notificaciones fallidas), alertas operativas ni retención de logs. RNF-12 es auditoría de cambios de caso, no observabilidad técnica. Tampoco hay requisito de fallback/alerta ante caída de servicios externos ni de detección de una ingesta diaria no ejecutada. (De ALTA a MEDIA.)
- **Evidencia:** `GGTOv2_GCP.md:245-246,262,140-146,286,287`; `requerimientos.md:159`; `db/schema.sql:619-631`.
- **Recomendación:** incorporar RNF de observabilidad (logs estructurados con request-id, métricas de ingesta/despacho/notificación, health checks, umbrales de alerta y retención de logs) e incluir fallback y alerta ante caída de Telegram/SMTP/MCP.

#### H-27 — Sin RNF de disponibilidad, SLA del servicio web ni resolución de conflictos offline↔servidor
- **Área:** Fiabilidad / Disponibilidad (ISO 25010).
- **Detalle:** El único RNF de confiabilidad (RNF-06) se limita a la operación offline del técnico. No se define disponibilidad objetivo (uptime) del backend/web, comportamiento ante caída de Cloud Run/Cloud SQL, política de reintentos ni degradación controlada. La app depende de servicios externos sin RNF de resiliencia. NOTA: se descarta la sub-afirmación de "idempotencia de ingesta ausente" (RF-22 ya deduplica por `id_averia` y RF-29 documenta cada lote). (De ALTA a MEDIA por ser MVP mono-central con despliegue local.)
- **Evidencia:** `requerimientos.md:153` y §5; `estado_proyecto.md:63,67`; `entornos_globales.md:135-147`; `requerimientos.md:105`.
- **Recomendación:** añadir RNF de disponibilidad (p. ej. ≥ 99 % en horario operativo), política de reintentos/backoff y reglas de sincronización/conflicto offline↔servidor; definir en Fase 2 el RTO del servicio y el comportamiento ante caída de dependencias externas.

#### H-28 — RNF-09 "fichas cómodas y visibles" y "pocos toques" sin valor de referencia ni tarea medible; accesibilidad ausente
- **Área:** RNF-09 / Usabilidad y Accesibilidad (ISO 25010). **Fusionado** desde R1 y R3.
- **Detalle:** RNF-09 reproduce literalmente el lenguaje del brief ("cómodas y visibles", "pocos toques") y su criterio es "Prueba heurística / tiempo de tarea" sin umbral (¿cuántos segundos?, ¿cuántos toques?, ¿qué tarea?). Sin tarea de referencia ni número no hay pass/fail: dos evaluadores pueden concluir lo opuesto. Es crítico para el flujo de campo offline. Además, la subcaracterística **Accesibilidad** no aparece en ningún RNF ni documento: no hay requisitos de contraste, tamaño mínimo de objetivo táctil, navegación por teclado, lectores de pantalla ni texto alternativo de evidencias.
- **Evidencia:** `requerimientos.md:156` y §5; `BRIEF-GGTO-INICIAL.md:98-100`; ausencia de los términos "accesibilidad/WCAG" en `RepoTecnico/*.md` (grep verificado).
- **Recomendación:** reescribir RNF-09 con tareas medibles ("CONTACTAR→(CONTACTADO|DIFERIDO) en ≤N toques y ≤T segundos"; "encontrar la ficha por teléfono en ≤T segundos desde login"), fijar dispositivo/condición (una mano, guantes, offline) y método (3-5 técnicos). Añadir RNF de Accesibilidad (WCAG 2.1 AA en web; directrices táctiles Android, contraste y tamaño mínimo en APK).

#### H-29 — Mantenibilidad limitada a configurabilidad: sin RNF de pruebas, CI/CD, migraciones ni paridad de entornos
- **Área:** Mantenibilidad / Portabilidad (ISO 25010).
- **Detalle:** RNF-10 reduce mantenibilidad a que catálogos y reglas sean configurables sin código. No hay RNF sobre estrategia de pruebas (unitarias/integración/E2E), umbral de cobertura, análisis estático, integración continua, migraciones versionadas, versionado de API ni documentación técnica. En portabilidad, RNF-07 cubre multiplataforma funcional, pero no la portabilidad de despliegue: existe `APP_ENV=development` sin exigencia de paridad dev/staging/producción, y el stack sigue "propuesto — a confirmar". Se descarta como hallazgo la parte de "push pendiente / stack sin cerrar" (es estado de proyecto, no un RNF).
- **Evidencia:** `requerimientos.md:157` y §5; `entornos_globales.md:108,180-191`; `RepoTecnico/scripts/` (solo aprovisionamiento, sin pipeline CI/CD).
- **Recomendación:** añadir RNF de Mantenibilidad/DevOps (umbral de cobertura, pipeline CI con tests y análisis estático, migraciones versionadas, política de versionado de API y entornos separados con paridad) y cerrar el stack tecnológico en Fase 2.

#### H-30 — Autorización/RBAC efectiva, gestión de sesiones y autenticación de canales externos sin RNF verificable
- **Área:** Seguridad (ISO 25010). Complementa a H-15 y H-31.
- **Detalle:** RNF-01..05 cubren autenticación, hash de claves, cifrado del documento de dispositivo y bloqueo de galería. Faltan requisitos verificables de: autorización/RBAC efectiva por endpoint, gestión/expiración de sesión o token, bloqueo por cuenta en web y autenticación fuerte de los canales externos (Telegram/MCP con `MCP_API_KEY`). RT-12 menciona cifrado en tránsito y control por rol, pero como requerimiento técnico genérico sin criterio de aceptación. NOTA: se descarta "ausencia total de cifrado en reposo" (`GGTOv2_GCP.md` sí prevé CMEK); el hueco es que no está elevado a RNF ni activo.
- **Evidencia:** `requerimientos.md:148-152,181`; `diccionario_datos.md:135`; `entornos_globales.md:147`; `GGTOv2_GCP.md:248,259,402`.
- **Recomendación:** añadir RNF de autorización (matriz rol×operación y pruebas de acceso denegado), gestión/expiración de sesiones/tokens y autenticación de canales externos, cada uno con criterio de verificación concreto; elevar a RNF el cifrado en reposo ya previsto.

#### H-31 — Autenticación solo P00+clave sin MFA, política de contraseñas, gestión de sesión ni rate limiting
- **Área:** Autenticación y control de sesión. **Fusionado** desde R3 y R7.
- **Detalle:** CONFIRMADO. Se define login con `P00` + clave y bloqueo a los 3 intentos, pero P00 es un identificador laboral numérico y secuencial, enumerable. No se especifican MFA para administradores/supervisores, política de complejidad/caducidad/historial de claves, gestión de sesión (timeout, revocación, rotación de tokens), protección CSRF/CORS ni limitación de velocidad/backoff del lado servidor. Nota: el contador `intentos_fallidos`/`bloqueado` sí reside en el servidor (tabla `usuario`), por lo que se descarta la afirmación de un contador evadible en cliente; el hallazgo se sostiene por las ausencias anteriores.
- **Evidencia:** `requerimientos.md:99,148-150`; `estado_proyecto.md:62,104`; `db/schema.sql:153-168,734-735`; `diccionario_datos.md:124`; grep negativo de MFA/2FA/rate limit/sesión/CSRF/CORS.
- **Recomendación:** añadir RNF de autenticación: Argon2id/bcrypt con parámetros y pepper; política de claves; MFA obligatorio para ADMIN/SUPERVISOR; bloqueo y rate limiting del lado servidor con backoff; expiración/rotación y revocación de sesión y tokens; CSRF/CORS; registro de eventos de login; no usar P00 como único factor.

#### H-32 — Aislamiento multi-central no resuelto (sin scoping por central ni RLS) y sin responsable de otras centrales
- **Área:** Control de acceso multi-central / Stakeholders. **Fusionado** desde R4 y R7.
- **Detalle:** El sistema se diseña multi-central (RNF-14) y varias tablas llevan `id_central`, pero `usuario` no tiene columna de central y `rol.permisos` es un jsonb vacío sin matriz definida. No existen políticas de Row Level Security ni modelo de autorización por central; la separación depende solo del filtro de consulta en la aplicación. Un supervisor/administrador de una central podría consultar o modificar casos de otra, y un fallo de autorización expondría PII entre centrales. Tampoco se define el stakeholder "responsable de otra central".
- **Evidencia:** `requerimientos.md:161,171`; `db/schema.sql:40-48,153-168,260-262`; grep negativo de `ROW LEVEL SECURITY`/`CREATE POLICY`; `estado_proyecto.md:58`; `db/schema.sql:136-150,104-116`.
- **Recomendación:** definir la matriz RBAC por rol y central; agregar `id_central` (o tabla de alcance) al usuario; implementar autorización en la capa de servicio y RLS en PostgreSQL como defensa en profundidad; documentar el rol del responsable de cada central; incluir pruebas negativas (central A no accede a datos de central B).

#### H-33 — El usuario de base de datos `ggtov2_app` tiene privilegios cuasi-superusuario sobre una instancia compartida
- **Área:** Control de acceso / Mínimo privilegio.
- **Detalle:** CONFIRMADO. En la instancia compartida, `ggtov2_app` quedó con `createrole=True`, `createdb=True`, `cloudsqlsuperuser=True` y `CREATE` sobre el esquema `public`. En una instancia que aloja también TrueKeate, ese nivel permite crear roles/bases, alterar o enumerar objetos y potencialmente cruzar el aislamiento entre aplicaciones si se compromete la app GGTO. Contradice el mínimo privilegio declarado (RT-02/RT-11).
- **Evidencia:** `GGTOv2_GCP.md:364-366` (`createrole=True createdb=True; cloudsqlsuperuser=True`), `:392-393`.
- **Recomendación:** revocar `CREATEROLE`/`CREATEDB`/`cloudsqlsuperuser` y `CREATE` sobre `public`; otorgar solo los privilegios DML/DDL necesarios sobre un esquema dedicado con `search_path`; ejecutar migraciones con un usuario distinto del runtime; verificar con `pg_roles` e `information_schema.role_table_grants`.

#### H-34 — Bitácora de auditoría sin rol de solo lectura, integridad de identidad ni política de retención; auditoría de accesos GCP no persistida
- **Área:** Auditabilidad y trazabilidad (ISO 25010). **Fusionado** desde R3, R4 y R7.
- **Detalle:** RNF-12 exige registrar usuario, fecha/hora y cambios sobre cada caso, y el DDL crea la tabla `auditoria`, pero no existe rol AUDITOR ni actor de auditoría interna, `auditoria.usuario` es varchar sin FK a usuario, y no hay previsión de permisos de lectura/exportación ni retención/append-only. La auditoría de accesos a datos en GCP quedó intentada pero no persistida (`auditConfigs`). La tabla almacena `datos_antes`/`datos_despues` en jsonb (con PII) sin retención ni cifrado específico. Tampoco se define retención de notificaciones ni de evidencias. Se mantiene MEDIA (en Fase 1, sin código, la falta de triggers es esperable; lo material es la configuración GCP no persistida y la ausencia de política).
- **Evidencia:** `requerimientos.md:159`; `db/schema.sql:633-643,665,666-682,692-696`; `GGTOv2_GCP.md:140-146,406,409,585`; `diccionario_datos.md:444`; `modelo_er.md` (entidad auditoría).
- **Recomendación:** crear el rol de auditoría interna (solo lectura), convertir `auditoria.usuario` en FK a `usuario.p00`, definir retención mínima y almacenamiento append-only con permisos restringidos, reintentar y verificar `auditConfigs`, y evitar volcar PII completa en `datos_antes`/`datos_despues`.

#### H-35 — Sin dueño definido para el catálogo de causas y los catálogos maestros
- **Área:** Stakeholders / Administrador de catálogos.
- **Detalle:** El catálogo de causas "se puebla desde el propio CSV" (D-08/P1.3) y el diccionario deja abierta la pregunta "quién lo mantiene". Métodos de cierre/enrutado, sectores y frases de exclusión tampoco tienen responsable nominal con ciclo de vida (altas, bajas, versionado). ACT-04 "Administrador del sistema" es genérico y no cubre el gobierno del dato de catálogo.
- **Evidencia:** `diccionario_datos.md:480`; `estado_proyecto.md:60`; `db/schema.sql:51-72`; `requerimientos.md:46`.
- **Recomendación:** asignar el rol/figura "administrador de catálogos" con responsable humano y proceso de actualización desde el CSV y control de cambios; decidir si el catálogo es editable en UI o solo por ingesta y registrarlo en `estado_proyecto.md`.

#### H-36 — Sin actor que ejecute mantenimiento de flota ni que apruebe/entregue órdenes de material
- **Área:** Stakeholders / Flota, mantenimiento y almacén.
- **Detalle:** El modelo soporta estados MANTENIMIENTO/FUERA_SERVICIO, incidentes de flota/herramienta y órdenes de material con estados APROBADA/RECHAZADA/ENTREGADA, pero solo el técnico reporta incidentes y el supervisor "gestiona flota". No hay rol que ejecute el mantenimiento, apruebe la orden ni gestione inventario; `orden_material` no registra aprobador/entregador. Aunque insumos es v2 (D-18), la ausencia de dueño impide cerrar el flujo al activarse.
- **Evidencia:** `db/schema.sql:171-187,523-535,581-592`; `BRIEF-GGTO-INICIAL.md:20`; `estado_proyecto.md:70`; `requerimientos.md:43`.
- **Recomendación:** definir los roles/figuras de mantenimiento de flota y almacén/insumos (aunque sea para v2) y añadir a `orden_material` los campos de responsable de aprobación y de entrega, con trazabilidad.

#### H-37 — Serial de evidencia colisionable e idempotencia de subida sin definir (ZIP + Cloud Storage)
- **Área:** Evidencias / Cloud Storage.
- **Detalle:** El brief exige que al final de la jornada la app genere un ZIP `central+cuadrilla+fecha` con el despacho modificado y todas las evidencias, y que las imágenes se serialicen como `N.º caso + id_averia + tipo + fecha/hora`. El modelo guarda `evidencia.serial_imagen` como `NOT NULL UNIQUE` y `sincronizacion.archivo_zip` como varchar sin ruta ni destino. Lo propio y verificable de este hallazgo es la idempotencia: con el serial derivado de caso+id_averia+tipo+fecha/hora, un reintento del mismo evento reenvía el mismo serial y, sin `ON CONFLICT`, viola el UNIQUE y bloquea la sincronización completa; dos dispositivos con relojes desincronizados pueden colisionar; y el nombre del ZIP no distingue dispositivo ni intento, por lo que una resubida sobrescribe.
- **Evidencia:** `db/schema.sql:508-521` (`serial_imagen` UNIQUE), `:550-563`; `BRIEF-GGTO-INICIAL.md:118-119`; `requerimientos.md:135`; `entornos_globales.md:150`.
- **Recomendación:** definir el contrato de subida (URL firmada y carga resumable con reintentos y checksum; clave de objeto con `id_cuadrilla/fecha/device_id/uuid`, no dependiente del nombre del ZIP); hacer `serial_imagen` idempotente (upsert por serial) o añadir sufijo de dispositivo/intento; incluir una prueba de sincronización interrumpida y resumida.

### 5.4 BAJA

#### H-38 — La categoría GOBIERNO existe en el brief y en el modelo de datos, pero no tiene RF ni módulo propio
- **Área:** Trazabilidad `requerimientos.md` (casos GOBIERNO).
- **Detalle:** El brief incluye GOBIERNOS entre las clasificaciones de casos especiales, y el modelo incorpora GOBIERNO en `caso.categoria` y `caso_especial.clasificacion`; `requerimientos.md` lo menciona en la visión y en ACT-03. Sin embargo, el catálogo de módulos §3 solo incluye EMPRESAS y REFERIDOS, y RF-06 enumera "Referidos de reparación, construcción residencial, construcción empresa, etc." sin nombrar gobiernos. Se rebaja de MEDIA a BAJA porque RF-06 (con "etc.") y ACT-03 ya cubren funcionalmente la captura.
- **Evidencia:** `BRIEF-GGTO-INICIAL.md:9`; `requerimientos.md:28,45,62-63,80`; `diccionario_datos.md:209,325`; `db/schema.sql:271,376`; `modelo_er.md:268,297`.
- **Recomendación:** nombrar explícitamente GOBIERNO en RF-06 (o crear un RF/módulo propio) y en la tabla de trazabilidad §7, o retirarlo del modelo si no aplica en v1; registrar la decisión.

#### H-39 — El diccionario declara `sector.codigo` y `cuadrilla.codigo` únicos globales aunque el DDL los hace únicos por central; los conteos de entidades y scripts no cuadran
- **Área:** Consistencia multi-central y conteos.
- **Detalle:** Con el diseño multi-central adoptado (D-06/P1.1), `schema.sql` define `UNIQUE (id_central, codigo)` en `sector` y `cuadrilla`, correcto para multi-central, pero el diccionario marca ambos como `UQ` global, lo que impediría reutilizar códigos como 'N1' o 'C-01' en otra central. Además, los conteos declarados no coinciden: dice "33 entidades" cuando `schema.sql` tiene 35 `CREATE TABLE` (la entidad `sector_direccion` no figura como fila del inventario §1 y `orden_material`/`orden_material_detalle` comparten fila), y dice "12 scripts" cuando hay 13 archivos `.sh` (incluye `lib_gcp.sh`).
- **Evidencia:** `diccionario_datos.md:92,182,36,100-111`; `db/schema.sql:115,213` (35 tablas verificadas); `estado_proyecto.md:24,39,58`.
- **Recomendación:** corregir el diccionario a UQ compuesto por central (o documentar la intención global) y actualizar los conteos de `estado_proyecto.md` (35 tablas, 13 scripts) o declarar explícitamente que "entidades" cuenta filas del inventario y que `lib_gcp.sh` es una librería.

#### H-40 — Trazabilidad RF ↔ Módulos: los RF referencian módulos no catalogados, varios módulos no tienen RF y el conteo no cuadra
- **Área:** Trazabilidad `requerimientos.md` ↔ `estado_proyecto.md`.
- **Detalle:** La columna "Módulo" de los RF referencia 'Ingesta', 'Alertas', 'Seguridad', 'Insumos', 'Gestión técnica' y 'Gestión automatizada', que no existen como filas del catálogo §3 (que lista PANEL, MONITOREO, GRÁFICOS, CASOS, DESPACHO, SEGUIMIENTO, EMPRESAS, REFERIDOS, CONFIGURACIÓN y GESTIÓN = 10 filas; además la numeración salta de 6 a 8). A la inversa, PANEL, CASOS, SEGUIMIENTO, EMPRESAS y REFERIDOS no tienen ningún RF dedicado. `estado_proyecto.md` afirma "11 módulos" cuando §3 contiene 10 filas.
- **Evidencia:** `requerimientos.md:54-65,75,79,90,95,99,108`; `estado_proyecto.md:23`.
- **Recomendación:** añadir al catálogo §3 los módulos realmente usados por los RF (o reasignar cada RF a módulos existentes), crear RF para PANEL/CASOS/SEGUIMIENTO/EMPRESAS/REFERIDOS, corregir la numeración y el conteo en `estado_proyecto.md` y completar la tabla de trazabilidad §7.

#### H-41 — La figura del "despachador" aparece en los datos pero no se define si es un actor distinto del supervisor
- **Área:** Stakeholders / Despachador.
- **Detalle:** El CSV trae Nombre, Apellido, Teléfono Oficina y Teléfono Móvil de una persona que el diccionario etiqueta explícitamente como "despachador/asignado" y que se almacena en campos `despacho_*`. El brief asigna el despacho diario al supervisor (ACT-01). No se aclara si el despachador es el supervisor, un rol separado o personal del sistema origen; sin ello, la atribución y los permisos del despacho quedan indefinidos. Se mantiene BAJA (necesita verificación con el cliente).
- **Evidencia:** `diccionario_datos.md:291-294`; `db/schema.sql:352-355`; `requerimientos.md:43`.
- **Recomendación:** confirmar con el cliente si existe un despachador distinto del supervisor; si existe, crear el rol/permiso y su relación con cuadrilla/central; si no, documentar que los campos del CSV son solo referencia histórica del sistema origen.

#### H-42 — Sin actor ni canal de soporte para usuarios y para la propia plataforma/APK
- **Área:** Stakeholders / Soporte y helpdesk.
- **Detalle:** Se modelan incidentes de flota y herramienta reportados por técnicos, pero no existe actor ni canal de soporte para problemas de la plataforma, la APK offline, credenciales/bloqueos o la integración con Telegram/MCP. Es relevante porque RF-20 contempla bloqueo y recuperación con 12 palabras y RNF-06 exige sincronización offline; sin embargo el brief nunca menciona un helpdesk, por lo que se mantiene BAJA.
- **Evidencia:** `requerimientos.md:52-66,99,153`; `db/schema.sql:523-535`.
- **Recomendación:** definir quién da soporte de primer y segundo nivel (interno CANTV o proveedor) y por qué canal, y un mecanismo de tickets o registro de incidencias de plataforma; reflejarlo como stakeholder en `estado_proyecto.md`.

#### H-43 — El módulo PANEL (búsqueda por id_averia/teléfono, actualización y alta manual) no tiene ningún RF asociado
- **Área:** Requerimientos funcionales (deseo del brief).
- **Detalle:** El brief describe el módulo 0 PANEL con búsqueda de un caso por Id de avería o teléfono, actualización de casos y alta manual de casos nuevos. En `requerimientos.md` PANEL solo aparece en la tabla de módulos (§3); la lista RF-01..RF-29 no incluye búsqueda/actualización de casos ni alta manual genérica (RF-06 cubre solo casos especiales). Sin RF ni criterio de aceptación, el panel puede quedar fuera del alcance de desarrollo por omisión, pese a que el diccionario asume su existencia (`telefono` → "Búsqueda en PANEL").
- **Evidencia:** `BRIEF-GGTO-INICIAL.md:51`; `requerimientos.md:56,69-112`; `diccionario_datos.md:237`.
- **Recomendación:** crear RF explícito(s) para PANEL (búsqueda por id_averia/teléfono, edición de caso y alta manual) con criterio de aceptación.

---

## 6. RNF faltantes (ISO 25010) y stakeholders faltantes

### 6.1 Categorías RNF ausentes o no verificables

`requerimientos.md` §5 contiene exactamente **15 RNF (RNF-01..RNF-15)**. Se confirma la ausencia de:

| Categoría ISO 25010 | Estado | Hallazgo |
|---|---|---|
| **Fiabilidad — Backup/Recuperación** | Ausente (sin RPO/RTO ni prueba de restauración) | H-03 |
| **Rendimiento / Eficiencia (umbrales)** | Presente pero no medible (RNF-08 "objetivo por definir"; RNF-15 sin cifras) | H-16 |
| **Capacidad / Volumetría** | Ausente (sin casos/día, pico, histórico, retención/particionado) | H-16 |
| **Disponibilidad / SLA** | Ausente (sin uptime, reintentos ni degradación controlada) | H-27 |
| **Observabilidad de aplicación** | Ausente (solo infra; sin logs estructurados, métricas ni alertas) | H-26 |
| **Usabilidad** | Presente pero no medible (RNF-09 sin umbral) | H-28 |
| **Accesibilidad** | Ausente por completo (ni WCAG ni directrices táctiles) | H-28 |
| **Seguridad — Autorización/RBAC y sesiones** | Ausente como RNF verificable | H-15, H-30, H-31 |
| **Seguridad — Autenticación de canales externos** | Ausente (MCP/Telegram sin RNF) | H-30 |
| **Privacidad / PII (retención, minimización, anonimización)** | Ausente | H-17 |
| **Cumplimiento normativo (Venezuela)** | Ausente por completo | H-17 |
| **Mantenibilidad (pruebas, CI, migraciones, versionado API)** | Reducida a configurabilidad (RNF-10) | H-13, H-29 |
| **Portabilidad de despliegue (paridad de entornos)** | Ausente | H-29 |
| **Auditabilidad (retención e inmutabilidad)** | Auditoría presente sin política (RNF-12) | H-34 |
| **Cifrado en reposo elevado a RNF** | Previsto en GCP pero no activo ni exigido por RNF | H-10, H-30 |
| **Fiabilidad — resiliencia de dependencias externas** | Ausente (Telegram/SMTP/MCP sin fallback) | H-14 |

### 6.2 Stakeholders faltantes o sin rol definido

| Stakeholder | Estado | Hallazgo |
|---|---|---|
| **Despachador** | Aparece en el CSV, sin definir si es distinto del supervisor | H-41 |
| **Administrador de catálogos** | Sin dueño del catálogo de causas y maestros | H-35 |
| **Mantenimiento de flota** | Sin actor que ejecute el mantenimiento | H-36 |
| **Almacén / insumos** | Sin actor que apruebe/entregue órdenes de material | H-36 |
| **Auditoría interna** | Sin rol de solo lectura sobre la bitácora | H-34 |
| **Responsable de protección de datos** | Sin designar (PII de suscriptores) | H-17 |
| **Responsable de otra central** | Sin rol ni ámbito definido (multi-central) | H-32 |
| **Operador de red GPON / dueño del sistema origen CANTV** | Sin identificar ni acuerdo de entrega del CSV | *(reportado por R4; no elevado a ID propio, ver §8 C24)* |
| **Soporte / helpdesk** | Sin actor ni canal para la plataforma y la APK | H-42 |
| **Solicitante externo (ACT-03)** | Sin identidad de canal ni destinatario verificable | *(reportado por R4; cubierto por el catálogo de canales, §8 C11)* |
| **Roles no-login (RBAC)** | 3 roles base sin matriz rol × módulo × acción | H-15 |

---

## 7. Plan de acción

### 7.1 Quick wins (≤ 1 día, alto impacto, sin dependencias externas)

| # | Acción | Responsable sugerido | Esfuerzo |
|---|---|---|---|
| QW-1 | Retirar el CSV del índice git, añadirlo al `.gitignore` y purgar el historial | Ingeniero de repositorio / DevOps | S |
| QW-2 | Corregir `INGESTA_CSV_ENCODING` a ISO-8859-1/cp1252 y documentar parser de fecha | Backend | S |
| QW-3 | Corregir los conteos (35 tablas, 13 scripts) y los checkboxes/§4 de `estado_proyecto.md` | Director de proyecto | S |
| QW-4 | Alinear los enums del diccionario con los CHECK del DDL (H-24) y marcar WhatsApp como v3 (H-07) | Analista de datos | M |
| QW-5 | Resolver la contradicción de la columna `Falla Reportada` en RF-25 (H-06) | Analista funcional / cliente | S |
| QW-6 | Revocar `CREATEROLE`/`CREATEDB`/`cloudsqlsuperuser` a `ggtov2_app` (H-33) | DBA / DevOps | S |
| QW-7 | Eliminar el binding de `truekeate-app-sa` sobre los secretos de GGTO | DevOps / Seguridad | S |

### 7.2 Mejoras (1–3 días, requieren decisión o coordinación)

| # | Acción | Responsable sugerido | Esfuerzo |
|---|---|---|---|
| M-1 | Resolver con el cliente el criterio de la cuadrilla 0 (H-04/H-19) y modelar `frases_supervisor` + colas | Analista funcional + Backend | M |
| M-2 | Habilitar backups/PITR/`deletionProtectionEnabled` y `sslMode=ENCRYPTED_ONLY`; documentar RTO/RPO | DBA / DevOps | M |
| M-3 | Levantar volumetría real y convertir RNF-08/RNF-15 en SLO medibles (H-16) | Director de proyecto + Backend | M |
| M-4 | Definir catálogo de canales de ingesta y de notificación (H-07) | Analista funcional | M |
| M-5 | Añadir tabla de definiciones de métricas (fórmula, entidad, ventana, redondeo) para D-17/RF-26/RF-28 | Analista funcional + Backend | M |
| M-6 | Especificar protocolo de sincronización offline (idempotencia, conflictos, citas) (H-12, H-22) | Arquitecto + Backend | M |
| M-7 | Definir matriz RBAC y ámbito por central (H-15, H-31, H-32) | Arquitecto + Seguridad | M |
| M-8 | Decidir el tratamiento de REFERIDOS sin `id_averia` y corregir el DDL (H-09, H-11) | Arquitecto + DBA | M |
| M-9 | Reescribir RNF-09 con tareas medibles y añadir RNF de accesibilidad (H-28) | Analista funcional | S/M |
| M-10 | Especificar el protocolo de recuperación "3 de 12 palabras" (H-20) | Seguridad + Backend | S |
| M-11 | Fijar parámetros de evidencia (resolución, calidad, tamaño, precisión GPS, EXIF) (H-37) | Analista funcional + Backend | M |
| M-12 | Asignar dueños de catálogos, flota/almacén, auditoría, privacidad y soporte (H-34, H-35, H-36, H-42) | Director de proyecto | S |
| M-13 | Sincronizar `requerimientos.md` con S-01..S-12 y registrar D-22..D-24 (H-08) | Director de proyecto | M |

### 7.3 Roadmap (esfuerzos mayores, dependen de terceros o de la Fase 3)

| # | Acción | Responsable sugerido | Esfuerzo |
|---|---|---|---|
| R-1 | Desbloquear facturación y crear bucket/KMS/Cloud Run/Cloud SQL propios (H-10) | Dirección + DevOps | L |
| R-2 | Adoptar herramienta de migraciones y verificación automática de esquema (H-13) | Backend / DBA | M/L |
| R-3 | Normalizar `caso`: clave canónica, geografía por FK, tabla `caso_origen_csv` (H-11) | Arquitecto + DBA | L |
| R-4 | Instrumentar observabilidad de aplicación y patrón outbox de notificaciones (H-14, H-26) | Backend / DevOps | L |
| R-5 | Instalar `pg_trgm`, índices GIN y plan de particionado; prueba de carga con histórico (H-16) | DBA + Backend | M/L |
| R-6 | Marco normativo de PII y evaluación legal con CANTV (LOPDP/CONATEL) (H-17) | Dirección + Asesoría legal | L |
| R-7 | Definir marco de disponibilidad/SLA y resiliencia de dependencias (H-27) | Arquitecto | M/L |
| R-8 | Completar trazabilidad RF↔módulos y crear los RF faltantes (PANEL, GOBIERNO, etc.) (H-38, H-40, H-43) | Analista funcional | M |
| R-9 | Identificar dueño del sistema origen CANTV y formalizar acuerdo de interfaz | Director de proyecto | M |
| R-10 | Reabrir S-09 y obtener 3-5 archivos diarios para validar el catálogo de causas | Analista funcional + cliente | M |

---

## 8. Criterios de aceptación para cerrar la Fase 1 y pasar a la Fase 2

La Fase 1 se considerará cerrada (y habilitada la Fase 2 — Auditoría / casos de uso) cuando se cumplan **los siguientes criterios verificables**:

**C1 — Seguridad de la información (bloqueantes):**
1. El CSV con PII está fuera del repositorio, purgado del historial y cubierto por `.gitignore`; la muestra versionada está pseudonimizada. *(H-01)*
2. `ggtov2_app` no tiene `CREATEROLE`/`CREATEDB`/`cloudsqlsuperuser` ni `CREATE` sobre `public`. *(H-33)*
3. El binding de `truekeate-app-sa` sobre los secretos de GGTO fue eliminado. *(hallazgo de R7, sin ID propio; ver §6.2)*
4. Existe constancia escrita (riesgo aceptado con fecha y dueño) o están activos `sslMode=ENCRYPTED_ONLY`, backups, PITR y `deletionProtectionEnabled`. *(H-03)*

**C2 — Integridad de la ingesta (bloqueante):**
5. `entornos_globales.md` fija la codificación real (ISO-8859-1/cp1252), define el parser de fecha `a.m./p.m.` y existe un test de ingesta contra la muestra real que verifica acentos y frases de negocio. *(H-02)*
6. Todas las columnas del mapeo de ingesta tienen destino explícito en el DDL o en un catálogo, documentado en `diccionario_datos.md` §3.2. *(H-05)*
7. Queda resuelta la contradicción de la columna `Falla Reportada` de RF-25. *(H-06)*

**C3 — Requisitos y alcance (bloqueantes):**
8. El criterio de la cuadrilla 0 está cerrado con el cliente y modelado como configuración (frases + colas), con caso de aceptación sobre la muestra real. *(H-04, H-19)*
9. WhatsApp queda fijado como v3 en todos los RF/RNF/RT y en los enums del diccionario, alineado con D-12. *(H-07)*
10. Se decidió el tratamiento de REFERIDOS sin `id_averia` y el DDL/`modelo_er.md` lo reflejan. *(H-09, H-11)*
11. Está definido el catálogo único de canales de ingesta y de notificación, y la identidad de canal del solicitante externo. *(H-07; hallazgo de R4 sobre ACT-03)*
12. `requerimientos.md` está sincronizado con las respuestas de la entrevista (S-01..S-12 cerradas o remitidas a D-xx) y su versión/estado reflejan "validado". *(H-08)*
13. `estado_proyecto.md` no presenta contradicciones internas y sus conteos coinciden con los artefactos. *(H-08, H-39)*

**C4 — Requisitos no funcionales (bloqueantes):**
14. RNF-08 y RNF-15 tienen volumetría y umbrales numéricos con dataset de prueba versionado. *(H-16)*
15. Existe RNF de Backup/Recuperación (RPO/RTO) y prueba de restauración. *(H-03)*
16. Existen RNF de Privacidad/Retención de PII y de Cumplimiento legal, validados con CANTV/asesoría legal. *(H-17)*
17. Existen RNF de Observabilidad, Disponibilidad/SLA y resiliencia de dependencias externas. *(H-14, H-26, H-27)*
18. Existen RNF de Autorización/RBAC, gestión de sesión y autenticación de canales externos. *(H-15, H-30, H-31)*
19. RNF-09 está reescrito con métricas objetivas y existe RNF de Accesibilidad. *(H-28)*
20. Existe RNF de Mantenibilidad/DevOps (pruebas, CI, migraciones, versionado de API, paridad de entornos). *(H-13, H-29)*

**C5 — Trazabilidad y gobernanza:**
21. Existe matriz RBAC y ámbito por central (o decisión explícita de alcance v1 registrada). *(H-15, H-31, H-32)*
22. Están asignados los dueños de catálogos, flota/almacén, auditoría, privacidad y soporte, o registrada su exclusión de v1. *(H-34, H-35, H-36, H-42)*
23. El módulo PANEL, GOBIERNO y los RF de búsqueda/alta manual tienen RF explícito o constancia de exclusión. *(H-38, H-40, H-43)*
24. Existe acuerdo de interfaz con el responsable del sistema origen CANTV. *(hallazgo de R4, sin ID propio; ver §6.2)*

Los criterios C1–C4 son **bloqueantes**; C5 puede cerrarse con decisiones documentadas de alcance. Cumplidos C1–C4, la Fase 2 puede iniciar en paralelo con el roadmap (R-1..R-10).

---

## 9. Anexo: hallazgos descartados en verificación

Se descartaron **16** hallazgos o sub-afirmaciones (regla: ante la duda, descartar). Se listan con su motivo.

| # | Título | Motivo del descarte |
|---|---|---|
| D-1 | Encoding de ingesta declarado (utf-8) contradice el archivo real (ISO-8859) *(R1)* | Cierto, pero su núcleo es consistencia/configuración (dimensión R2), no ambigüedad/testabilidad. **No se pierde**: se reencaminó y sobrevive como H-02. |
| D-2 | RNF-07 exige WhatsApp/Telegram en v1 mientras RF-10/RF-16 difieren WhatsApp a v3 *(R1)* | Conflicto real, pero es alcance por versión/consistencia (R2), no ambigüedad. **No se pierde**: sobrevive como H-07. |
| D-3 | La PK y los campos de `causa` difieren entre diccionario y DDL/E-R *(R2)* | DEDUPLICADO con el hallazgo de normalización causa/actividad; fusionado en H-23. |
| D-4 | El DDL resuelve decisiones marcadas como abiertas (S-09..S-12) sin registrarlas *(R2)* | ABSORBIDO en el hallazgo de desincronización de Fase 1 (H-08) como evidencia, no como hallazgo independiente. |
| D-5 | Sub-afirmación "idempotencia de la ingesta ausente" *(R3)* | Falso positivo parcial: RF-22 deduplica por `id_averia` y RF-29 documenta `ingesta_lote`. Se limitó al SLA (H-27). |
| D-6 | Sub-afirmación "ausencia total de cifrado en reposo" *(R3)* | Falso positivo parcial: `GGTOv2_GCP.md` sí prevé CMEK para bucket/disco; el hueco es que no está elevado a RNF (H-30). |
| D-7 | Cita de la muestra de 56 registros en `entornos_globales.md:175` *(R3)* | Cita imprecisa: ese punto solo confirma las 80 columnas; las 56 filas están en `estado_proyecto.md:21`. Se corrigió la evidencia, no se descartó el hallazgo. |
| D-8 | Sub-afirmación "push pendiente" y "stack propuesto" como incumplimiento RNF *(R3)* | Es estado de proyecto, no un requisito no funcional; ya registrado como pendiente. H-29 se limita a la ausencia real de RNF. |
| D-9 | El personal del CSV (reparador, ayudantes, flota) no se mapea a entidades ni es atribuible *(R4)* | Falso positivo: es materia de normalización; `cuadrilla_tecnico` con roles REPARADOR_PRINCIPAL/AYUDANTE y `ayudantes jsonb` documentan la procedencia (D-04). |
| D-10 | ACT-03 "no es rastreable" *(R4)* | Refutado: `caso_especial.id_solicitante` enlaza al solicitante. La parte accionable (identidad de canal) se conserva en §8 C11. |
| D-11 | El cliente final no figura como actor del sistema *(R4)* | Es sujeto de datos, no usuario/actor de la plataforma. La parte accionable sobrevive como H-17. |
| D-12 | La impresión tamaño carta y el documento de despacho en el ZIP no tienen criterio de aceptación *(R5)* | El deseo del brief SÍ está recogido (RT-08, `sincronizacion.archivo_zip`). Es testabilidad (R1), no deseo perdido. |
| D-13 | El primer inicio de la app pierde la captura del correo exigida por el brief *(R5)* | Evidencia desmentida: `requerimientos.md:138` incluye la captura del correo y `usuario.correo` existe. |
| D-14 | Clasificación y falla masiva modeladas por duplicado *(R5)* | Es normalización/redundancia interna (R2), no trazabilidad con el brief. Fuera de alcance de R5. |
| D-15 | Sin plan de observabilidad y auditoría no persistida *(R6)* | Solapa con R3/R7; la `auditConfigs` no persistida ya está reconocida como pendiente con script de reintento. No se duplica (queda en H-26/H-34). |
| D-16 | El DDL no puede aplicarse ni validarse localmente (sin psql/docker y sin `.env.ggto`) *(R6)* | Limitación del entorno del revisor, no riesgo del proyecto; ya documentado en `entornos_globales.md`. Su parte útil queda absorbida en H-13. |
| D-17 | Modelo de recuperación de la APK débil: clave privada embebida y 12 palabras como documento cifrado *(R7)* | Especulativo e internamente contradictorio: `clave_privada_ref` apunta a custodia por referencia y `dispositivo_seguridad` guarda a la vez `palabras_hash` y `documento_cifrado` (verificar y recuperar). Pregunta abierta de diseño, no defecto confirmado. |

---

*Fin del informe — INFORME_OPTIMIZACION_V1.md*
*Generado por el sintetizador de la auditoría de Fase 1 (GGTO) a partir de los 7 informes verificados (R1–R7). No se añadieron hallazgos ajenos a dichos informes ni se inventaron métricas.*

---

## 10. Erratas de verificación (revisión del director de proyecto)

Añadido por el `@asistenteProyecto` tras verificar manualmente las afirmaciones del informe.
**No se modifica ningún hallazgo**; solo se corrigen conteos de la sección 3.

| # | Sección | Dice | Correcto (verificado) |
|---|---|---|---|
| E-1 | §3 (tabla, fila `requerimientos.md`) | "**20 RT (RT-01..RT-20)**" | **12 RT (RT-01..RT-12)**. El conteo real en `requerimientos.md` §6 es 12. Los hallazgos H-29/H-30 que citan "RT-02/RT-11/RT-12" siguen siendo válidos. |
| E-2 | §3 | "10 módulos" | El catálogo §3 de `requerimientos.md` tiene **10 filas** (la numeración salta de 6 a 8); `estado_proyecto.md` decía "11". Es el mismo defecto de conteo reportado en H-40. |
| E-3 | `requerimientos.md` §1 | Referencia "`RF-0`" al confirmar la base de datos | Es un **error tipográfico**: debe referenciar `S-01`. Detectado al verificar el conteo de RF (29 RF reales, no 30). Se corrige en la sincronización de H-08. |

**Confirmaciones independientes de los 4 hallazgos CRÍTICOS** (ejecutadas por el director de proyecto, no por los revisores):

| Hallazgo | Verificación | Resultado |
|---|---|---|
| H-01 | `git ls-files \| grep detalle_averias_gpon` | **1** → el CSV con PII está versionado. **Confirmado.** |
| H-02 | `file` + decodificación en Python | `ISO-8859 text`; `UnicodeDecodeError: byte 0xd1 en posición 13023` con UTF-8. **Confirmado.** |
| H-03 | `GGTOv2_GCP.md:345-348,390-393` | `db-f1-micro`, ZONAL, SSL `ALLOW_UNENCRYPTED_AND_ENCRYPTED`, backups/PITR/protección ❌/❌/❌. **Confirmado.** |
| H-04 | Cruce `BRIEF-GGTO-INICIAL.md:45,93` y muestra real | El brief da DOS criterios y RF-25 solo modela uno; la muestra no contiene las frases modeladas. **Confirmado.** |
| H-33 | `GGTOv2_GCP.md:364-366` | `createrole=True createdb=True cloudsqlsuperuser=True`. **Confirmado.** |
