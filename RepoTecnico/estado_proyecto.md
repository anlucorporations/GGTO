# Estado del Proyecto — GGTO

| Campo | Valor |
|---|---|
| Proyecto | **GGTO** — Sistema de administración de reportes de avería y construcción de puntos ópticos |
| Cliente | **CANTV C.A.** — Central **Francisco Salias (Área 4)** |
| Fase actual | **Fase 1 — Concepto: COMPLETA**, a la espera de confirmación para pasar a Fase 2 |
| Última actualización | 2026-09-25 |
| Rama git | `GGTOv2-DSH-GCP` (commit inicial `f3d3cf7`) |
| Infraestructura | GCP `ggtov2` + PostgreSQL (instancia compartida `truekeate-db-dev`) |

> Memoria de trabajo del proyecto. Se actualiza de forma incremental, sin recargar todo el contexto.

---

## 1. Resumen de avances

- [x] Brief `BRIEF-GGTO-INICIAL.md` analizado (124 líneas, 4 secciones: OBJETIVO, CONTEXTO,
  GENERALIDADES, DETALLE, PROCEDIMIENTOS).
- [x] Muestra de datos `detalle_averias_gpon 12_09_2026.csv` inspeccionada: **80 columnas**,
  delimitador `;`, 56 registros, encabezados duplicados (`informacion` ×2, `descripcion` ×3).
- [x] Contexto GCP revisado (`GGTOv2_GCP.md`, `.env.global`, `gcp-env.sh`, scripts).
- [x] `requerimientos.md` generado (29 RF, 15 RNF, 12 RT, 6 actores, 11 módulos, trazabilidad).
- [x] `diccionario_datos.md` generado (33 entidades + mapeo de las 80 columnas del CSV).
- [x] `entornos_globales.md` generado (GCP, PostgreSQL, variables, comandos, stack propuesto).
- [ ] Entrevista Fase 1 respondida (bloques 1–5).
- [ ] Repositorios GitLab/GitHub definidos.
- [ ] Configuración GCP confirmada.

---

## 2. Artefactos generados en `RepoTecnico/`

| Archivo | Contenido | Estado |
|---|---|---|
| `BRIEF-GGTO-INICIAL.md` | Brief original del cliente (entrada). | Recibido |
| `GGTOv2_GCP.md` | Habilitación de infraestructura GCP. | Existente |
| `detalle_averias_gpon 12_09_2026.csv` | Muestra del archivo matriz diario (80 cols). | Recibido |
| `scripts/*.sh` | Aprovisionamiento GCP (12 scripts). | Existente |
| `requerimientos.md` | RF/RNF/RT, actores, módulos, trazabilidad. | **v0.1** |
| `diccionario_datos.md` | Entidades, campos, mapeo CSV. | **v0.1** |
| `entornos_globales.md` | Configuración, rutas, variables, comandos. | **v0.1** |
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

---

## 4. Próximos pasos

1. Realizar la entrevista de la Fase 1 (bloques de 3 preguntas).
2. Registrar respuestas y actualizar `requerimientos.md` / `diccionario_datos.md` / `entornos_globales.md`.
3. Pedir URLs de repositorios GitLab/GitHub y rama de trabajo.
4. Confirmar credenciales y configuración GCP.
5. Cerrar Fase 1 y solicitar confirmación para pasar a **Fase 2 (Auditoría)** con `@audita`.

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

## 6. Criterios de aceptación — Fase 1

- [x] Los 3 archivos `.md` base existen en `RepoTecnico/`.
- [x] Preguntas de la entrevista respondidas (bloques 1–5).
- [x] URLs de repositorios definidas (GitHub `GGTO`, GitLab `ggto`, rama `GGTOv2-DSH-GCP`).
- [x] Configuración GCP confirmada (base `ggtov2` en `truekeate-db-dev`, despliegue local).
- [x] Repositorio git local inicializado con la rama `GGTOv2-DSH-GCP` y commit inicial `f3d3cf7`.
- [ ] **Push a remotos** (requiere orden explícita `/push`; la rama remota `GGTOv2-DSH-GCP` ya tiene contenido que debe reemplazarse).
- [ ] Confirmación del usuario para pasar a **Fase 2 (Auditoría)**.

---

## 7. Historial

| Fecha | Evento |
|---|---|
| 2026-09-25 | Fase 1 iniciada: brief analizado, `requerimientos.md`, `diccionario_datos.md`, `entornos_globales.md`, `estado_proyecto.md` generados. |
| 2026-09-25 | Entrevista Fase 1 completada (bloques 1–5). Repositorio git local creado en la rama `GGTOv2-DSH-GCP`. |
