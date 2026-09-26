# Estado del Proyecto — GGTO

| Campo | Valor |
|---|---|
| Proyecto | **GGTO** — Sistema de administración de reportes de avería y construcción de puntos ópticos |
| Cliente | **CANTV C.A.** — Central **Francisco Salias (Área 4)** |
| Fase actual | **Fase 1 — Concepto: COMPLETA. AUDITADA** — veredicto: apta **bajo condiciones** (4 CRÍTICOS abiertos) |
| Última actualización | 2026-09-25 |
| Rama git | `GGTOv2-DSH-GCP` (commits `f3d3cf7`, `b60b766`, `e5dcf81`) |
| Informe de auditoría | `INFORME_OPTIMIZACION_V1.md` (43 hallazgos: 4 CRÍTICA · 14 ALTA · 19 MEDIA · 6 BAJA) |
| Infraestructura | GCP `ggtov2` + PostgreSQL (instancia compartida `truekeate-db-dev`) |

> Memoria de trabajo del proyecto. Se actualiza de forma incremental, sin recargar todo el contexto.

---

## 1. Resumen de avances

- [x] Brief `BRIEF-GGTO-INICIAL.md` analizado (124 líneas, 4 secciones: OBJETIVO, CONTEXTO,
  GENERALIDADES, DETALLE, PROCEDIMIENTOS).
- [x] Muestra de datos `detalle_averias_gpon 12_09_2026.csv` inspeccionada: **80 columnas**,
  delimitador `;`, 56 registros, encabezados duplicados (`informacion` ×2, `descripcion` ×3).
- [x] Contexto GCP revisado (`GGTOv2_GCP.md`, `.env.global`, `gcp-env.sh`, scripts).
- [x] `requerimientos.md` generado (29 RF, **17 RNF** tras añadir RNF-16/17, 12 RT, 6 actores, 10 módulos, trazabilidad).
- [x] `diccionario_datos.md` generado (33 entidades lógicas → 35 tablas física; mapeo de las 80 columnas del CSV).
- [x] `entornos_globales.md` generado (GCP, PostgreSQL, variables, comandos, stack propuesto).
- [x] Entrevista Fase 1 respondida (bloques 1–5, respuestas en §5).
- [x] Repositorios GitLab/GitHub definidos (rama `GGTOv2-DSH-GCP`).
- [x] Configuración GCP confirmada (base `ggtov2` en `truekeate-db-dev`, despliegue local).
- [x] `modelo_er.md` y `db/schema.sql` generados (7 diagramas Mermaid, 35 tablas).
- [x] Auditoría de Fase 1 ejecutada → `INFORME_OPTIMIZACION_V1.md` (4 CRÍTICOS, 14 ALTOS).

---

## 2. Artefactos generados en `RepoTecnico/`

| Archivo | Contenido | Estado |
|---|---|---|
| `BRIEF-GGTO-INICIAL.md` | Brief original del cliente (entrada). | Recibido |
| `GGTOv2_GCP.md` | Habilitación de infraestructura GCP. | Existente |
| `detalle_averias_gpon 12_09_2026.csv` | Muestra del archivo matriz diario (80 cols). | Recibido |
| `scripts/*.sh` | Aprovisionamiento GCP (13 scripts). | Existente |
| `requerimientos.md` | RF/RNF/RT, actores, módulos, trazabilidad. | **v0.1** |
| `diccionario_datos.md` | Entidades, campos, mapeo CSV. | **v0.1** |
| `entornos_globales.md` | Configuración, rutas, variables, comandos. | **v0.1** |
| `modelo_er.md` | Diagrama Entidad-Relación completo en Mermaid (7 diagramas). | **v0.1** |
| `db/schema.sql` | Script DDL PostgreSQL (35 tablas + índices + triggers + datos iniciales). | **v0.1** |
| `muestras/detalle_averias_gpon_EJEMPLO.csv` | Muestra **pseudonimizada** (56×80, ISO-8859-1) para pruebas de ingesta. | **v1** |
| `INFORME_OPTIMIZACION_V1.md` | Auditoría de Fase 1 (7 lentes + verificación adversarial). | **V1** |
| `estado_proyecto.md` | Este archivo. | **v0.1** |

---

## 3. Decisiones tomadas

| # | Decisión | Origen |
|---|---|---|
| D-01 | Base de datos **PostgreSQL** (no hoja de Excel). | Contexto del brief + `GGTOv2_GCP.md` |
| D-02 | Proyecto GCP **GGTOv2** (`ggtov2`) como destino de despliegue. | `GGTOv2_GCP.md` |
| D-03 | Reutilizar la instancia PostgreSQL `truekeate-db-dev` (base `ggtov2`) mientras se resuelve la facturación. | `GGTOv2_GCP.md` §6.5 |
| D-04 | Mapeo del CSV **por posición de columna** (encabezados duplicados). | Análisis del archivo |
| D-05 | Identificador de deduplicación de casos: **`id_averia`** (único **global**). | Brief, procedimiento 1 |
| D-06 | Diseño **multi-central** desde el inicio; v1 opera Francisco Salias. | Entrevista P1.1 |
| D-07 | **Sector** definido por el supervisor (nombre + lista de direcciones/alias); asignación por coincidencia sobre `direccion` del CSV. | Entrevista P1.2 |
| D-08 | Catálogo de **causas** se puebla desde el propio CSV. | Entrevista P1.3 |
| D-09 | Roles base: **Administrador, Supervisor, Técnico**. | Entrevista P2.1 |
| D-10 | Autenticación única **`P00` + clave** en web y APK. | Entrevista P2.2 |
| D-11 | App móvil en **Flutter + SQLite** (offline). | Entrevista P2.3 |
| D-12 | Mensajería v1: **bot de Telegram**; **WhatsApp se difiere a la v3**. | Entrevista P3.1 |
| D-13 | **MCP/IA**: ingesta + consultas + alertas. | Entrevista P3.2 |
| D-14 | Correo saliente: servicio gratuito integrable con GCP (SendGrid free tier; alternativa Gmail SMTP app password), cuenta `txbarlovento@gmail.com`. | Entrevista P3.3 |
| D-15 | Desarrollo contra la base `ggtov2` en **`truekeate-db-dev`**; despliegue **local** por ahora. | Entrevista P4.2 |
| D-16 | **Cloud Storage** para evidencias y **KMS/Secret Manager** desde el inicio. | Entrevista P4.3 |
| D-17 | Métricas de MONITOREO/GRÁFICOS: **definición diferida a la Fase 3**. | Entrevista P5.1 |
| D-18 | **Insumos = v2**; el modelo de datos los reserva. | Entrevista P5.2 |
| D-19 | Fallas masivas: **detección automática por concentración** (tras la ingesta) **+ reporte manual** de técnico vía MCP/Telegram; asignación por **proximidad de sector**. | Entrevista P5.3 |
| D-20 | Repositorios: GitHub `anlucorporations/GGTO`, GitLab `anlucorporations/ggto`, rama **`GGTOv2-DSH-GCP`**. | Entrevista P4.1 |
| D-21 | Modelo E-R documentado en **Mermaid** (`modelo_er.md`) y DDL PostgreSQL editable en `db/schema.sql` (35 tablas, se mantienen sincronizados). | Solicitud del usuario |
| D-22 | **Cuadrilla 0 = criterio combinado (H-04):** va al supervisor si **no** contiene frases de campo (`despacho.frases_campo`) **o** contiene frases de no-atención en casa (`despacho.frases_supervisor`) o está en otra cola. Modo configurable `despacho.criterio_cuadrilla0` = `CAMPO`/`SUPERVISOR`/`UNION` (por defecto `UNION`). | Entrevista H-04 |
| D-23 | **Referidos sin incidencia (H-09):** reciben identificador sintético `REF-<CÓDIGO_CENTRAL>-<NNNNNN>` (función `generar_id_averia_ref`); `caso.id_averia` sigue `NOT NULL UNIQUE`. | Entrevista H-09 |
| D-24 | **Quick wins de auditoría ejecutados:** QW-1 (PII fuera de git + historial purgado + muestra pseudonimizada), QW-2 (encoding ISO-8859-1 + parser de fecha), QW-3 (conteos), QW-5 (`Falla Reportada` aclarada), QW-6 (privilegios de BD endurecidos) y QW-7 (binding de secretos retirado). | Aprobación del usuario |
| D-25 | **H-33 aceptado con mitigación:** `ggtov2_app` conserva la membresía `cloudsqlsuperuser` (no revocable vía SQL en Cloud SQL) pero con `NOINHERIT`, sin `CREATEROLE`/`CREATEDB` y sin acceso a `truekeate`/`postgres`/`template1`. No se resetea la contraseña de `postgres`. | Aprobación del usuario |
| D-26 | **H-03 riesgo aceptado:** no se modifican backups/PITR/SSL de `truekeate-db-dev` (instancia compartida de TrueKeate). Dueño: Dirección del proyecto · Fecha: 2026-09-25 · Cierre: migrar a `ggtov2-pg` con backups+PITR+SSL al desbloquear facturación. **No cargar datos reales** hasta entonces. RNF-16/RNF-17 definidos. | Aprobación del usuario |
| D-27 | **Depuración del CSV (H-05):** se descartan **21 columnas** (`tipo_reporte`, `dac`, `ultimo_usuario`, `fecha_despacho`, `ciudad`, `servicio_off_on`, `cliente_notificado`, `fecha_instalacion`, `ip`, `tarjeta`, `ont_id`, `cvlan`, `dias transcurrido desde la apertura`, `area_resolutoria`, `usuario_acciona`, `fecha_acciona`, `codigo_causa`, `descripcion`×2, `Subcodigo_causa`, `con_serv_aba`) y se **unifican** `informacion`(31) + `informacion`(32) + `descripcion`(52) en `informacion`. Quedan **49 campos destino**. El catálogo `causa` pasa a ser **administrable** (ya no se puebla del CSV). | Entrevista H-05 |
| D-28 | **H-07 alineado:** canales de la v1 = **Telegram + correo + MCP/IA**. WhatsApp retirado de RF-06, RF-10, RF-16, RF-27, RNF-07, RNF-11, RT-06, ACT-02/ACT-03 y de los enums del diccionario; reservado a la **v3**. | Entrevista H-07 |

---

## 4. Próximos pasos

1. Resolver los **4 hallazgos CRÍTICOS** (H-01…H-04) del informe de auditoría.
2. Ejecutar los **Quick wins** aprobados (QW-1, QW-2, QW-3, QW-5) y los de infraestructura (QW-6, QW-7).
3. Sincronizar `requerimientos.md` con las respuestas de la entrevista y las decisiones D-22..D-24 (H-08).
4. Completar los RNF faltantes y la matriz RBAC (criterios §8 del informe).
5. Publicar en GitHub/GitLab bajo orden `/push` (rama `GGTOv2-DSH-GCP` limpia).
6. **Fase 2** — casos de uso (analista funcional, Gherkin/EARS), gráficos y documento técnico con `@audita`.

---

## 5. Preguntas de la entrevista (Fase 1)

> Se entregan por bloques de 3. Estado: `⏳ pendiente` / `✅ respondida`.

### Bloque 1 — Alcance y datos

| # | Pregunta | Estado | Respuesta |
|---|---|---|---|
| P1.1 | ¿La base de datos definitiva es **PostgreSQL** y diseño multi-central? | ✅ | **Sí.** PostgreSQL es la base definitiva (no Excel). La plataforma se diseña **multi-central** desde el inicio; v1 opera la Central Francisco Salias. |
| P1.2 | ¿Qué define un **"sector"** para agrupar casos y armar rutas? | ✅ | El **supervisor lo define en CONFIGURACIÓN** con un nombre (p. ej. `Norte 1`, `Norte 2`, `Sur 1`). Cada sector agrupa **varias direcciones** (ej. `Norte 1 = Valle Arriba, Concresa, Parque Humboldt`). La asignación se hace **por coincidencia sobre el campo `direccion`** del CSV contra los patrones/alias configurados por sector. |
| P1.3 | ¿Unicidad de `id_averia` y fuente del catálogo de causas? | ✅ | **`id_averia` es único global.** El **catálogo de causas se puebla desde el propio CSV** (`codigo_causa`, `subcodigo_causa` y sus descripciones). |

### Bloque 2 — Usuarios y seguridad

| # | Pregunta | Estado | Respuesta |
|---|---|---|---|
| P2.1 | ¿Roles del sistema? | ✅ | **Administrador, Supervisor y Técnico** (tres roles base). |
| P2.2 | ¿Autenticación en web y APK? | ✅ | **Solo `P00` + clave** en web y APK. Aplica el bloqueo a los 3 intentos y las 12 palabras de seguridad. |
| P2.3 | ¿Tecnología de la app móvil? | ✅ | **Flutter** (híbrida) con **SQLite** local para operación offline. |

### Bloque 3 — Canales e integraciones

| # | Pregunta | Estado | Respuesta |
|---|---|---|---|
| P3.1 | ¿Disponibilidad de WhatsApp/Telegram? | ✅ | **Solo bot de Telegram** en esta etapa. La integración con **WhatsApp queda para la 3.ª versión**. |
| P3.2 | ¿Alcance del WEB-MCP/IA? | ✅ | **Ingesta de casos + consultas + alertas.** |
| P3.3 | ¿Servicio de correo saliente? | ✅ | Servicio **gratuito y de fácil integración con GCP**, cuenta `txbarlovento@gmail.com`. Propuesta: **SendGrid free tier** (100 correos/día, disponible en GCP Marketplace); alternativa: **Gmail SMTP con contraseña de aplicación**. |

### Bloque 4 — Despliegue, repositorios y GCP

| # | Pregunta | Estado | Respuesta |
|---|---|---|---|
| P4.1 | ¿URLs de repositorios GitLab/GitHub y rama? | ✅ (parcial) | El usuario **ya dispone de repositorios** y proporcionará las **URLs y la rama**. ⚠️ **Pendiente de recibir los valores.** |
| P4.2 | ¿Despliegue GCP y base de datos? | ✅ | Se continúa con **`truekeate-db-dev`** (base `ggtov2`) y se **despliega local** por ahora; se migrará a instancia propia al resolver la facturación. |
| P4.3 | ¿Evidencias y secretos? | ✅ | **Cloud Storage** para evidencias + **Cloud KMS / Secret Manager** desde el inicio. |

### Bloque 5 — Métricas, catálogos e insumos

| # | Pregunta | Estado | Respuesta |
|---|---|---|---|
| P5.1 | ¿Fórmula exacta de las métricas de MONITOREO/GRÁFICOS? | ✅ | **Se difiere a la Fase 3.** Se avanza con la estructura de los tableros. |
| P5.2 | ¿Insumos/inventario en v2? | ✅ | **Confirmado: insumos (RF-05) van para la 2.ª versión.** |
| P5.3 | ¿Origen de fallas masivas y "mayor cercanía"? | ✅ | **Ambos:** (a) **detección automática por concentración de casos** tras cargar el CSV del día, y (b) **reporte manual** de un técnico en calle vía **MCP/Telegram**. La asignación es por **proximidad de sector**. |

### Pendiente de valores

| # | Dato | Estado |
|---|---|---|
| P4.1 | **Repositorios**: GitHub `https://github.com/anlucorporations/GGTO.git` · GitLab `https://gitlab.com/anlucorporations/ggto.git` · **rama `GGTOv2-DSH-GCP`** (debe quedar limpia). | ✅ Recibido |

---

## 6. Auditoría de Fase 1 (resultado)

**Informe:** `INFORME_OPTIMIZACION_V1.md` · **Método:** 7 revisores en paralelo → 7 verificadores adversariales → síntesis.
**Veredicto:** la documentación **NO es apta aún** para la Fase 2 en su estado actual; es apta **bajo condiciones**.
16 hallazgos fueron descartados en la verificación (anexo §9 del informe).

### 6.1 Hallazgos CRÍTICOS (bloqueantes)

| ID | Hallazgo | Verificación del director | Acción |
|---|---|---|---|
| **H-01** | CSV real con PII de suscriptores (nombre, teléfono, dirección, serial, IP) versionado en git y **no** cubierto por `.gitignore`; remotos GitHub/GitLab ya configurados. | ✅ Confirmado (`git ls-files`) | Retirar del índice, purgar historial, pseudonimizar muestra |
| **H-02** | El CSV real es **ISO-8859-1** y la ingesta está configurada como UTF-8 → aborto o corrupción (afecta la frase `Fibra Dañada`). | ✅ Confirmado (`file`, `UnicodeDecodeError 0xd1`) | Fijar codificación real + parser de fechas `a.m./p.m.` |
| **H-03** | Persistencia en instancia **compartida, zonal, sin backups/PITR/protección de borrado**, SSL no obligatorio. | ✅ Confirmado | Habilitar backups/PITR/SSL o registrar riesgo aceptado |
| **H-04** | La cuadrilla 0 modela solo PROCEDIMIENTO 3 e **ignora GENERALIDADES 3.5**; con datos reales casi todo iría al supervisor. | ✅ Confirmado | Resolver criterio con el usuario y modelarlo por configuración |

### 6.2 Hallazgos ALTOS destacados

H-05 (columnas de causa sin destino), H-06 (columna `Falla Reportada` inexistente), H-07 (WhatsApp v1 vs v3),
H-08 (Fase 1 declarada completa con contradicciones), H-09 (`id_averia` NOT NULL impide referidos sin incidencia),
H-10 (bloqueo de facturación sin destino de bucket/KMS), H-11 (tabla `caso` monolítica), H-12/H-22 (sincronización offline),
H-13 (sin migraciones), H-14 (sin fallback de notificaciones), H-15/H-30/H-31/H-32 (RBAC, sesiones, multi-central),
H-16 (RNF sin umbral), H-17 (PII sin retención ni base legal), H-18 (fallas masivas sin algoritmo).

### 6.3 Plan de acción


Quick wins **ejecutados** (D-24): QW-1 (retirar CSV/PII de git + purga de historial + muestra
pseudonimizada en `muestras/`), QW-2 (codificación ISO-8859-1 + parser de fecha), QW-3 (conteos) y
QW-5 (aclarar `Falla Reportada` en RF-25).
Quick wins **pendientes**: QW-4 (alinear enums/WhatsApp v3 — H-07/H-24), QW-6 (revocar privilegios de
`ggtov2_app` — H-33) y QW-7 (binding de secretos).El detalle completo (Quick wins QW-1..QW-7, Mejoras M-1..M-13, Roadmap R-1..R-10) está en el informe §7.
Los 24 criterios de aceptación para cerrar la Fase 1 están en el informe §8.

### 6.4 Erratas del informe


Corregidos en el informe §10: RT reales = **12** (no 20), módulos = **10** filas, y `RF-0` en `requerimientos.md` §1 es un typo que debe referenciar `S-01`.

---

## 7. Criterios de aceptación — Fase 1

### 7.1 Criterios base

- [x] Los 3 archivos `.md` base existen en `RepoTecnico/`.
- [x] Preguntas de la entrevista respondidas (bloques 1–5).
- [x] URLs de repositorios definidas (GitHub `GGTO`, GitLab `ggto`, rama `GGTOv2-DSH-GCP`).
- [x] Configuración GCP confirmada (base `ggtov2` en `truekeate-db-dev`, despliegue local).
- [x] Repositorio git local inicializado con la rama `GGTOv2-DSH-GCP`.
- [x] Modelo E-R y script DDL generados.
- [x] Auditoría de Fase 1 ejecutada (`INFORME_OPTIMIZACION_V1.md`).

### 7.2 Criterios de auditoría (ver informe §8: C1–C5)

- [ ] **C1 Seguridad** — [x] H-01 (PII fuera de git + historial purgado); [~] H-33 (mitigado con `NOINHERIT` + aislamiento, D-25); [x] binding de secretos; [~] H-03 (**riesgo aceptado**, D-26 → RNF-16/RNF-17).
- [ ] **C2 Ingesta** — [x] H-02 (encoding/parser); [x] H-05 (columnas de causa descartadas y `informacion` unificada, D-27); [x] H-06 (`Falla Reportada` aclarada en RF-25).
- [ ] **C3 Requisitos y alcance** — [x] H-04/H-19 (cuadrilla 0 combinada, D-22); [x] H-07 (canales v1 = Telegram+correo+MCP, D-28); [x] H-09/H-11 (referidos `REF-…`, D-23); [ ] H-08 (sincronización de docs).
- [ ] **C4 RNF** — H-16 (umbrales), H-03 (backup), H-17 (PII/legal), H-14/H-26/H-27 (observabilidad/disponibilidad), H-15/H-30/H-31 (seguridad), H-28 (usabilidad/accesibilidad), H-13/H-29 (mantenibilidad).
- [ ] **C5 Gobernanza** — RBAC y ámbito por central, dueños de catálogos/flota/almacén/auditoría/privacidad, RF de PANEL/GOBIERNO, acuerdo con el sistema origen.
- [ ] **Push a remotos** (requiere orden explícita `/push`; la rama remota `GGTOv2-DSH-GCP` ya tiene contenido que debe reemplazarse).
- [ ] Confirmación del usuario para pasar a **Fase 2**.

---

## 8. Historial

| Fecha | Evento |
|---|---|
| 2026-09-25 | Fase 1 iniciada: brief analizado, `requerimientos.md`, `diccionario_datos.md`, `entornos_globales.md`, `estado_proyecto.md` generados. |
| 2026-09-25 | Entrevista Fase 1 completada (bloques 1–5). Repositorio git local creado en la rama `GGTOv2-DSH-GCP`. |
| 2026-09-25 | Generados `modelo_er.md` (diagramas Mermaid) y `db/schema.sql` (DDL PostgreSQL, 35 tablas). |
| 2026-09-25 | Auditoría de Fase 1 ejecutada (7 lentes + verificación adversarial) → `INFORME_OPTIMIZACION_V1.md`: 43 hallazgos (4 CRÍTICA, 14 ALTA, 19 MEDIA, 6 BAJA), veredicto "apta bajo condiciones". |
| 2026-09-25 | Quick wins aprobados y ejecutados (D-24): PII fuera de git e **historial purgado**, codificación ISO-8859-1, conteos corregidos, `Falla Reportada` aclarada. Decisiones D-22 (cuadrilla 0 combinada) y D-23 (`REF-…`). |
| 2026-09-25 | ⚠️ La purga de historial (`git filter-branch`) eliminó también el **CSV real del disco**; no hay copia local. Se conserva la muestra pseudonimizada. Pendiente: que el usuario re-aporte un archivo diario real (quedará fuera de git). |
| 2026-09-25 | **QW-6/QW-7 sobre `truekeate-main`:** revocados `CREATEROLE`/`CREATEDB` y aplicado `NOINHERIT` a `ggtov2_app`; revocado `PUBLIC` en `truekeate`/`postgres`/`template1` (ggtov2_app ya no puede acceder a la base de TrueKeate, que sigue operando); retirado el binding de `truekeate-app-sa` sobre los secretos de GGTO. Riesgo residual: membresía `cloudsqlsuperuser` no revocable vía SQL (D-25). |
| 2026-09-25 | ⚠️ **Exposición de secreto (RESUELTA):** un error de Node imprimió la contraseña del usuario `app` de `truekeate-main`. Se rotó la contraseña, se creó la versión 3 del secreto `DATABASE_URL` y se desplegó `truekeate-api-00034-hvk` (Ready, 100 % tráfico, sin errores de auth). |
| 2026-09-25 | **H-03 riesgo aceptado (D-26):** no se modifican backups/PITR/SSL de la instancia compartida; se añaden RNF-16 (backup, RPO/RTO) y RNF-17 (disponibilidad). |
| 2026-09-25 | **H-05 resuelto (D-27):** depurado el mapeo del CSV (se descartan 21 columnas y se unifica `informacion`); actualizados `diccionario_datos.md`, `db/schema.sql`, `modelo_er.md` y `requerimientos.md` (RF-25, RT-05). C2 completado. |
| 2026-09-25 | **H-07 resuelto (D-28):** canales v1 alineados a Telegram + correo + MCP; WhatsApp retirado de RF/RNF/RT, actores y enums, reservado a la v3. |
