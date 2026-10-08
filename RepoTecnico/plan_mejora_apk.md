# Plan de mejora de la APK técnica — D-84 a D-88

- **Fuente:** `RepoTecnico/mejoras_APK.md` (10 observaciones del usuario).
- **Alcance:** APK **técnica** (`app_movil/`, «GGTO Técnico»). La APK v2 del
  supervisor queda como ciclo aparte.
- **Fecha:** 2026-10-07 · **Versión de partida:** `1.0.0+4`.
- **Estado:** plan **v2** con las decisiones del usuario cerradas (ver §0).

> **Nota de normalización:** el archivo original repite la numeración (dos «2.» y
> dos «3.2»). Aquí cada observación recibe un identificador estable **M-01…M-10**
> para poder trazarla a un requisito y a un ciclo.

---

## 0. Decisiones cerradas con el usuario (2026-10-07)

| # | Tema | Decisión |
|---|---|---|
| **DEC-1** | «No Contesta» | El caso pasa a **`CITADO`** con **cita para el día siguiente a las 08:00** y se registra una **actividad de `CONTACTO` con método `COS`** («informado al COS»). La «1ra visita» viaja en la **observación de la cita**. Reutiliza `POST /casos/{id}/cita` + el flujo de estado existente. |
| **DEC-2** | Borrado de mensajes | **No se borra nada.** Se resuelve con **filtros** (por tipo y por leído/no leído) y **marcado como leído individual y en grupo** (los endpoints `POST /mensajes/leidos` y `POST /mensajes/{id}/leido` ya existen). Sin migración de DDL. |
| **DEC-3** | Alcance del modo manual | **Todo manual, incluida la cola:** se elimina también el vaciado automático de `accion_pendiente` al recuperar la red. Solo **CARGA** y **DESCARGA** mueven datos de casos. Los mensajes siguen llegando solos cada 60 s. |
| **DEC-4** | Orden de la bandeja | **Más reciente arriba**, agrupado **por día**. |

> **Hallazgo para DEC-1:** el catálogo `catalogo_metodo` solo tiene `COS` en el
> dominio **`CIERRE`** (`RepoTecnico/db/schema.sql:802-812`; en `CONTACTO` solo
> existe `TELEFONO`). Para «informado al COS» hay que **añadir la fila**
> `('CONTACTO','COS','Cliente informado al COS')` — aditiva e idempotente
> (`ON CONFLICT (dominio, codigo) DO NOTHING`) — o reutilizar el método de
> `CIERRE`. Se implementa con la fila nueva de `CONTACTO` y su migración.

---

## 1. Observaciones analizadas contra el código actual

| ID | Observación | Estado actual (evidencia) | Tipo |
|---|---|---|---|
| **M-01** | La APK no debe sincronizar los casos automáticamente: la gestión se hace con CARGA y DESCARGA; solo los mensajes se sincronizan solos | `casos_screen.dart:42` llama `cargar(silencioso: true)` **al abrir** la pantalla y `:205` **al volver** de la ficha → cada visita dispara `GET /sync/descarga`. Además `sync_provider.dart:136-142` vacía sola la cola al recuperar la red | Defecto de comportamiento |
| **M-02** | Los mensajes se sincronizan cada 60 s | `mensajes_provider.dart:22`: `Timer.periodic(Duration(seconds: 20))` → **20 s** (el propio comentario y el manual lo declaran) | Defecto (valor) |
| **M-03** | Las acciones sobre los casos deben verse localmente (offline) sin esperar la sincronización | `operaciones_service.dart:382-392`: sin red **encola** la acción pero **no toca `caso_local`**; el caso sigue mostrando el estado viejo. `CasosProvider.aplicarEstadoLocal()` (`casos_provider.dart:150`) existe, marca `pendiente_sync` y **nadie la llama**; `caso_card.dart:20` ya sabe pintar ese distintivo | Defecto de fondo (offline-first incompleto) |
| **M-04** | Los mensajes no se muestran correctamente: «el último en llegar es el primero que se muestra» | `mensajes_provider.dart:38` **anexa** cada lote y `services/mensajes.py:205` los devuelve por `id_mensaje` **ASC**: la primera carga (`desde=0&limit=50`) trae los **50 más antiguos**, así que con más de 50 mensajes los recientes tardan varios ciclos en aparecer. **DEC-4:** debe verse el más reciente **arriba**, agrupado por día | Defecto + UX |
| **M-05** | Poder borrar mensajes individualmente o en grupo | **No existe** borrado: en la APK (`mensajes_screen.dart`) no hay ninguna acción y `MensajesProvider` guarda los mensajes **solo en memoria**; en la API los endpoints son `GET /mensajes`, `/no-leidos`, `GET /bandeja`, `POST /mensajes`, `POST /leidos`, `POST /{id}/leido`. **DEC-2:** no se borra → se **filtra** y se marca leído | Funcionalidad nueva (reformulada) |
| **M-06** | Tras contactar, la ficha sigue mostrando «marcar como contactado» | `caso_detalle_screen.dart:12` recibe `caso` como **snapshot inmutable** (no se suscribe al proveedor) y `:96-117` muestra «Contactar / Agendar cita» siempre que el caso no esté cerrado: **no depende de `estado_actual`** | Defecto |
| **M-07** | Fichas con **CABECERA** (identifica + icono Editar), **CUERPO** (largo adaptable) y **PIE** (acciones) | Hoy es un `ListView` con 4 secciones (`Cliente`, `Administrativa`, `Técnica`, `Reporte`) y los botones al final del scroll: sin cabecera fija, sin pie, sin icono Editar | Rediseño de UI |
| **M-08** | Rediseño del flujo por estado: NUEVO → *Marcar contactado* + *No Contesta*; CONTACTADO → *Atender*; ATENDIDO/CITADO → info + conteo de imágenes y estado de sincronización en el pie | Hoy: dos botones genéricos («Contactar / Agendar cita», «Atender (cerrar / enrutar / diferir)») y pantallas separadas (`contactar_screen.dart`, `atender_screen.dart`); no existe «No Contesta», ni conteo de imágenes por caso, ni estado de sincronización en la ficha | Rediseño funcional |
| **M-09** | En NUEVO: editar solo **Dirección** y **Número de contacto** | No hay edición de campos del caso desde la APK (solo el flujo de contacto/cierre). El `PATCH /casos/{id}` restringido a esos dos campos no existe como caso de uso de campo | Funcionalidad nueva |
| **M-10** | En NUEVO con «No Contesta»: el caso pasa a **CITADO** para el día siguiente con la información de **1ra visita** y se agrega **INFORMADO AL COS** | Existe `marcarCitado` y `agendarCita`, pero **no** la regla compuesta. **DEC-1** fija la regla exacta (cita mañana 08:00 + actividad `CONTACTO`/`COS` + «1ra visita» en la observación) | Regla de negocio nueva |

**Ya resuelto y no requiere trabajo:** el orden de descarga por cuadrilla, el
contenido local (D-82) y el motivo de la DESCARGA (D-83).

---

## 2. Requerimientos extraídos (trazables y verificables)

| ID | Requisito | Origen | Criterio de aceptación (resumen) |
|---|---|---|---|
| **RF-APK-01** | Sincronización **totalmente manual** (casos **y** cola) | M-01, DEC-3 | *EARS*: Cuando el técnico abre «Mis casos», el sistema deberá mostrar el contenido local **sin** invocar `/sync/descarga`; Mientras una acción esté pendiente, el sistema deberá enviarla **solo** con la CARGA. *Gherkin*: Dado un dispositivo con 3 casos locales y 2 acciones en cola, Cuando se abre la pantalla y se recupera la red, Entonces se ven los 3 casos y **no** se emite ninguna petición de descarga ni de carga. |
| **RF-APK-02** | Sondeo de mensajes cada **60 s** | M-02 | *EARS*: El sistema deberá sondear `/mensajes` cada 60 s ±2 s **solo en primer plano**. *Gherkin*: Cuando el supervisor envía un mensaje, Entonces aparece en la bandeja en ≤60 s sin interacción. |
| **RF-APK-03** | Acciones con **efecto local inmediato** | M-03 | *Gherkin*: Dado un caso `NUEVO` sin conexión, Cuando se pulsa «Marcar como contactado», Entonces la ficha y el listado muestran `CONTACTADO` con el distintivo «pendiente de sincronizar»; Y al reabrir la app el estado persiste; Y tras la CARGA el distintivo desaparece y el servidor queda en `CONTACTADO`. |
| **RF-APK-04** | **Orden y agrupación** de la bandeja | M-04, DEC-4 | *EARS*: La primera carga deberá traer los **últimos 50** mensajes (no los 50 más antiguos) y la lista deberá mostrarse **del más reciente al más antiguo**, agrupada por día. |
| **RF-APK-05** | **Filtrado y marcado masivo** (sin borrado) | M-05, DEC-2 | *Gherkin*: Dado un técnico con 30 mensajes, Cuando filtra por «no leídos», Entonces ve solo los no leídos y el contador coincide; Cuando pulsa «marcar todos como leídos», Entonces todos quedan leídos y el filtro devuelve 0. |
| **RF-APK-06** | Acciones **por estado** | M-06, M-08 | *Gherkin*: Dado un caso `CONTACTADO`, Cuando se abre la ficha, Entonces el pie muestra «Atender» y **no** muestra «Marcar como contactado». |
| **RF-APK-07** | Ficha **CABECERA/CUERPO/PIE** | M-07 | *EARS*: La cabecera (nombre + teléfono + Editar) deberá permanecer visible al desplazar el cuerpo; el pie con las acciones deberá quedar fijo; los objetivos táctiles serán ≥48 dp (RNF-23). |
| **RF-APK-08** | Flujo **NUEVO** | M-08 | *Gherkin*: Dado un caso `NUEVO`, Cuando se abre la ficha, Entonces la cabecera muestra nombre y teléfono (700/701/702), el cuerpo la información del contacto y el pie «Marcar como contactado» + «No Contesta». |
| **RF-APK-09** | Flujo **CONTACTADO** | M-08 | *Gherkin*: Dado un caso `CONTACTADO`, Cuando se abre la ficha, Entonces el cuerpo muestra **todos** los grupos de información (cada uno desplegable) y el pie el botón «Atender». |
| **RF-APK-10** | Flujo **ATENDIDO/CITADO** | M-08 | *Gherkin*: Dado un caso `ATENDIDO` o `CITADO`, Cuando se abre la ficha, Entonces el cuerpo muestra los grupos **más el conteo de imágenes cargadas** y el pie el **estado de sincronización** (pendiente/enviado/con error). |
| **RF-APK-11** | Edición de **Dirección** y **Teléfono** | M-09 | *Gherkin*: Dado un caso `NUEVO`, Cuando el técnico edita la dirección o el teléfono, Entonces el cambio se guarda primero en local, se refleja en la ficha y viaja al servidor en la CARGA con su traza de auditoría. Validación: teléfono de la serie 700/701/702. |
| **RF-APK-12** | «**No Contesta**» = CITADO + 1ra visita + informado al COS | M-10, DEC-1 | *Gherkin*: Dado un caso `NUEVO` en el que el cliente no contesta, Cuando el técnico pulsa «No Contesta», Entonces el caso queda `CITADO`, con cita para el **día siguiente a las 08:00** y «1ra visita» en la observación, Y se registra una **actividad `CONTACTO` con método `COS`**. |

---

## 3. Ciclos propuestos (verticales, cada uno entregable y desplegable)

### D-84 · Sincronización bajo control del técnico — `RF-APK-01`, `RF-APK-02`
**Objetivo:** que nada se mueva solo: ni casos ni cola.
- Quitar la descarga automática: `casos_screen.initState` y el refresco al volver
  de la ficha leen **solo** la caché local.
- **Desactivar el vaciado automático de la cola** (`sync_provider.dart:136-142`):
  la recuperación de red deja de disparar el envío; el contador de pendientes y el
  botón CARGA pasan a ser la única vía (**DEC-3**).
- Barra de estado en «Mis casos»: «Última descarga: dd/mm hh:mm · N casos · N
  pendientes de enviar» con accesos **Descargar** / **Cargar**.
- Sondeo de mensajes a **60 s**, solo en primer plano (`AppLifecycleState`).
- **Pruebas:** widget test que falla si se invoca `/sync/descarga` o `/sync/carga`
  al abrir o al recuperar la red; prueba del temporizador a 60 s; regresión de la
  barra de progreso (D-82).
- **Entrega:** APK `1.0.0+5` (sin cambios de backend).

> **Estado de ejecución:** D-84 y D-85 se implementaron **juntos** en una sola
> entrega, la **`1.0.0+5`** (el usuario pidió encadenarlos). Ver §7.

### D-85 · Acciones locales inmediatas (offline-first real) — `RF-APK-03`
**Objetivo:** que un cambio se vea al instante y sobreviva al reinicio.
- `OperacionesService`: toda acción escribe el estado en `caso_local` **antes** de
  intentar el envío (escritura optimista) y marca `pendiente_sync`.
- Cablear `CasosProvider.aplicarEstadoLocal()` (hoy código muerto) en la ficha y
  el listado; `caso_card.dart` ya pinta el distintivo.
- Reconciliación al terminar la CARGA: quitar `pendiente_sync` y refrescar del
  servidor; si el servidor **rechaza** (403/409/422), revertir el cambio local y
  avisar.
- Evitar el doble envío de la misma acción (`RF-APK-03` EARS).
- **Pruebas:** unitarias del repositorio local (sin red); widget test «contactar
  sin conexión → reabrir → CARGA».
- **Entrega:** incluida en la **`1.0.0+5`** junto con D-84 (el usuario pidió
  encadenar ambos ciclos; ver §7).

### D-86 · Mensajería legible (orden, agrupación y filtros) — `RF-APK-04`, `RF-APK-05`
**Objetivo:** bandeja ordenada y sin ruido, **sin borrar nada** (DEC-2).
- Primera carga = **últimos 50** (consulta descendente + inversión), luego
  incremental por `id_mensaje`; render **más reciente arriba** agrupado por día.
- **Filtros:** por tipo (`TEXTO`, `RECORDATORIO_CITA`, `ESTADO_SYNC`,
  `ALARMA_DESPACHO`) y por leído/no leído; contador de no leídos coherente.
- **Marcado masivo como leído** con el endpoint existente `POST /mensajes/leidos`
  (y `POST /mensajes/{id}/leido` al tocar uno).
- Persistencia local de los últimos N (tabla `mensaje_local`) para leer **sin
  conexión**; no requiere DDL en el servidor.
- **Pruebas:** API existente (`test_d81_mensajes_api.py`) + widget test de filtros
  y del marcado masivo.
- **Entrega:** APK `1.0.0+7`.

### D-87 · Ficha de caso con CABECERA / CUERPO / PIE — `RF-APK-06`, `RF-APK-07`
**Objetivo:** la ficha deja de ser una lista plana y refleja el estado real.
- Componentes nuevos `FichaCabecera` (nombre + teléfono 700/701/702 + icono
  **Editar**), `FichaCuerpo` (grupos colapsables, alto adaptable) y `FichaPie`
  (acciones del estado, fijo, con `SafeArea`).
- La ficha se **suscribe** al `CasosProvider` por `id_averia` en lugar de recibir
  el caso congelado → arregla **M-06**.
- **Pruebas:** widget tests por estado (`NUEVO`, `CONTACTADO`, `ATENDIDO`,
  `CITADO`, `CERRADO`) verificando el contenido del pie.
- **Entrega:** APK `1.0.0+8`.

### D-88 · Flujo de campo completo y entrega — `RF-APK-08` … `RF-APK-12`
**Objetivo:** cerrar el proceso de trabajo pedido, con evidencia y manuales.
- **NUEVO:** «Marcar como contactado» + «No Contesta» (`DEC-1`).
- **CONTACTADO:** «Atender» (reutiliza `atender_screen` como hoja del pie).
- **ATENDIDO/CITADO:** grupos + **conteo de imágenes** por caso (tabla
  `evidencia_local`, ya indexada por caso) + **estado de sincronización** en el pie.
- **Edición** de Dirección y Teléfono con validación y auditoría (`RF-APK-11`).
- **Backend:** fila nueva en el catálogo `('CONTACTO','COS','Cliente informado al
  COS')` + migración idempotente; composición «No Contesta» (estado `CITADO` +
  cita de mañana 08:00 con observación «1ra visita» + actividad de contacto `COS`).
- **Pruebas:** `integration_test` del recorrido completo (NUEVO → contactado →
  atendido → CARGA), contrato del PATCH restringido y prueba de la regla
  «No Contesta» (estado + cita + actividad `COS`).
- **Entrega:** APK **`1.1.0+9`**, manuales 11/12 actualizados, aviso legal y
  publicación en `/apk/`.

---

## 4. Trazabilidad observación → requisito → ciclo

| Obs. | Requisito | Ciclo |
|---|---|---|
| M-01 | RF-APK-01 | D-84 |
| M-02 | RF-APK-02 | D-84 |
| M-03 | RF-APK-03 | D-85 |
| M-04 | RF-APK-04 | D-86 |
| M-05 | RF-APK-05 | D-86 |
| M-06 | RF-APK-06 | D-87 |
| M-07 | RF-APK-07 | D-87 |
| M-08 | RF-APK-06, 08, 09, 10 | D-87, D-88 |
| M-09 | RF-APK-11 | D-88 |
| M-10 | RF-APK-12 | D-88 |

---

## 5. Orden, esfuerzo y riesgos

| Ciclo | Alcance | Esfuerzo | Riesgo | Depende de |
|---|---|---|---|---|
| D-84 | pequeña | 0,5–1 día | bajo (cambio de hábito: hay que pulsar DESCARGAR) | — |
| D-85 | media | 1,5–2 días | **medio** (coherencia local/servidor y conflictos) | D-84 |
| D-86 | pequeña-media | **1 día** (sin borrado ni DDL) | bajo | — |
| D-87 | media-alta | 2–3 días | bajo (UI) | D-85 (estado vivo) |
| D-88 | alta | 2–3 días | **alto** (regla «No Contesta» y edición de campos) | D-87 |

**Riesgos principales**
1. **Doble fuente de verdad** (SQLite vs servidor) en D-85: se resuelve con
   `pendiente_sync`, reconciliación en la CARGA y reversión ante rechazo.
2. **«No Contesta»** compone tres efectos (estado, cita y actividad `COS`): si la
   actividad falla a medias hay que dejar el caso consistente (transacción local +
   acciones encoladas en orden).
3. **Método `COS` de `CONTACTO`**: hoy **no existe** en el catálogo (solo en
   `CIERRE`); la migración es aditiva e idempotente, pero el backend debe aceptar
   ese `id_metodo` en la actividad de contacto (validación por dominio).
4. **Modo totalmente manual** (DEC-3): si el técnico olvida pulsar CARGA, el
   trabajo queda en el teléfono; la barra de pendientes debe ser muy visible.

---

## 6. Estado de las decisiones

- **Cerradas:** DEC-1 (No Contesta), DEC-2 (sin borrado: filtros), DEC-3 (todo
  manual), DEC-4 (más reciente arriba). Ver §0.
- **Sin decisiones pendientes para arrancar.** Cualquier ajuste fino (hora por
  defecto de la cita, textos del pie) se resuelve dentro de D-88.

---

## 7. Ejecución — D-84 y D-85 entregados en la `1.0.0+5` (2026-10-07)

| Archivo | Cambio |
|---|---|
| `features/casos/casos_screen.dart` | `initState` ya **no descarga**: llama `refrescarLocal()` y `sync.refrescar()`; al volver de la ficha se relee **lo local** (`refrescarLocal()`), no la red. La franja muestra «N por enviar» y los botones **Descargar** y **Cargar (N)** |
| `features/sync/sync_provider.dart` | Se elimina el **vaciado automático de la cola** al recuperar la red (DEC-3) y el `Timer` asociado; la conectividad solo alimenta el indicador |
| `features/mensajes/mensajes_provider.dart` | `intervaloSondeo = 60 s` (era 20) y sondeo **solo en primer plano** (`WidgetsBindingObserver`), con sondeo inmediato al volver a la app |
| `features/casos/casos_provider.dart` | Nuevo `refrescarLocal()`: relee SQLite **sin** marcar «sin conexión» (abrir una pantalla no es sincronizar) |
| `core/database.dart` | `aplicarCambioLocal()`: **fusiona** el cambio sobre `datos_json` (no reemplaza la fila y **no** toca `actualizado_en`, que es la marca del diferencial); `limpiarPendienteSync(idCaso)` para el reconciliado tras la CARGA |
| `features/casos/operaciones_service.dart` | `conCambioLocal()` (función **pura** y testeable) + **escritura optimista** en `_enviarEstado`, `agendarCita`, `cerrar` y `enrutar`: el cambio se guarda en el dispositivo con el distintivo «pendiente de sincronizar» y los mensajes pasan a «…quedó guardado en el dispositivo» |
| `features/sync/upload_service.dart` | Al confirmarse el lote se **limpia el distintivo** de los casos enviados (`idsCasoBatch`). **Defecto corregido:** `version_app` viajaba **fijo** como `'1.0.0'` en la CARGA, lo que ensuciaba la trazabilidad del `sync_log` (en la DESCARGA sí era real); ahora usa `AppConstants.version` |
| `features/casos/caso_detalle_screen.dart` | La ficha sigue el estado **vivo** del caso (se suscribe a `CasosProvider` por `id_averia`) y muestra «Por sincronizar» cuando hay cambios sin enviar |
| `pubspec.yaml` · `core/constants.dart` | Versión **`1.0.0+5`** |

**Verificación:** `flutter analyze` **sin hallazgos** · `flutter test`
**31/31** (6 pruebas nuevas en `test/d84_d85_sincronizacion_test.dart`: periodo de
60 s, «abrir Mis casos no descarga» con proveedores espía, la franja con
«Cargar (N)», y la fusión del cambio local sin perder campos).

**Pendiente:** D-86 (mensajería legible), D-87 (ficha CABECERA/CUERPO/PIE) y
D-88 (flujo de campo completo y entrega `1.1.0`).
