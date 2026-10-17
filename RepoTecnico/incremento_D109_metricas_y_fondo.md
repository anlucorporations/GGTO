# Incremento D-109 — Mensajes en segundo plano, envío ligero de lo atendido y métricas con gráficos

| Campo | Valor |
|---|---|
| Petición | 1) mensajes cada 60 s en segundo plano · 2) cada 5 min subir **solo** los datos de los casos atendidos (mínimo tráfico, métricas y monitoreo al día) · 3) en Supervisor/Administrador/SuperUser/Coordinador, el mismo esquema de métricas que la web, **con gráficos** |
| Fecha | 2026-10-17 |
| Alcance | APK (`app_movil`) |
| Versión | **`1.10.0+19`** |

---

## 1. Qué se hizo

### 1.1 Mensajes cada 60 s también en segundo plano (RF-92)

`MensajesProvider` sondeaba `/mensajes` cada 60 s **solo con la app en primer plano** (`_enPrimerPlano`).
Ahora el temporizador corre siempre: el técnico recibe los mensajes del supervisor y los
recordatorios de cita mientras trabaja fuera de la app, y al volver se refresca al instante. El
sondeo ya era incremental por `desde` (solo trae lo nuevo), así que el costo de datos es mínimo.

### 1.2 Envío ligero de los casos atendidos cada 5 minutos (RF-93 · RNF-46)

`SyncProvider` arranca un `Timer.periodic` de **5 minutos** que ejecuta `enviarAtendidos()`:

- solo si hay **acciones pendientes** en la cola (que son exactamente los datos de los casos
  atendidos: cierre, contacto, cita, diferido, enrutado, corrección de contacto);
- solo con red;
- mediante `sincronizar(silencioso: true)`, que **envía** la cola y **no descarga** casos ni sube
  fotos: es la información mínima que mantiene al día las métricas y el monitoreo de la web;
- también se dispara al **recuperar la conectividad**, sin esperar el ciclo.

Se expone `ultimoEnvioAuto` para que la interfaz pueda informarlo.

### 1.3 Métricas de la web en la APK, con gráficos (RF-94)

La pantalla MONITOREO volcaba el JSON en tarjetas de texto. Ahora replica el esquema de la web con
**gráficos dibujados en la propia app** (sin librerías nuevas):

| Sección | Contenido |
|---|---|
| Resumen del día | 6 KPI (ingresos, resueltos, citados, diferidos, gestionados, pendientes) + **barras** de las 8 métricas del día |
| Globales del mes | KPI pendientes/resueltos/total + **barras por estado** (ordenadas) |
| Curva semanal | **líneas** de asignados/cerrados/gestionados (lunes a sábado) + tabla por día |
| Pendientes por tipo | **donut** de reparación (comunes, referidos, empresariales) y **donut** de construcción |
| Por cuadrilla | **barras agrupadas** por cuadrilla (asignados/cerrados/gestionados) + detalle |
| Capacidad operativa | KPI de cuadrillas, técnicos, flota, herramientas y sectores + estado por cuadrilla |
| Otras vistas | selector con las pestañas secundarias de la web (mensual, casos especiales, construcciones) |

Consultas: los mismos endpoints (`/monitoreo/diario`, `/semanal`, `/globales`, `/reparacion`,
`/construccion`, `/cuadrilla`, `/capacidad`) en paralelo; el alcance por central/cuadrilla lo
resuelve el servidor, así que **las cifras coinciden con la web**. Refresco automático cada 5 min
con la pantalla abierta, al volver a ella y con el botón de la barra.

Piezas nuevas: `monitoreo_api.dart` (modelos y consultas), `grafico.dart` (barras, barras
agrupadas, líneas y donut con `CustomPainter`) y `monitoreo_screen.dart` reescrita.

---

## 2. Decisiones

| ID | Decisión |
|---|---|
| **DEC-109-1** | El sondeo de mensajes **no** depende del ciclo de vida: 60 s siempre (el incremental ya evita tráfico) |
| **DEC-109-2** | El envío automático es **solo de la cola de acciones** (casos atendidos): ni descarga de casos ni subida de fotos |
| **DEC-109-3** | El tablero de monitoreo usa los **mismos endpoints** que la web y gráficos propios (sin dependencias nuevas) |

---

## 3. Trazabilidad

| ID | Requisito / regla |
|---|---|
| RF-92 | Los mensajes se reciben aunque la app esté en segundo plano |
| RF-93 | Los datos de los casos atendidos se envían solos cada 5 minutos |
| RF-94 | Supervisor, Administrador, Super Usuario y Coordinador ven en la APK el mismo esquema de métricas que la web, con gráficos |
| RNF-46 | El envío automático es de tráfico mínimo: solo acciones pendientes, sin fotos ni descargas |
| RT-34 | Pruebas de cadencias, interpretación de las respuestas de monitoreo y aritmética/dibujo de los gráficos |

---

## 4. Archivos

| Archivo | Cambio |
|---|---|
| `app_movil/lib/features/mensajes/mensajes_provider.dart` | Sondeo sin condición de primer plano |
| `app_movil/lib/features/sync/sync_provider.dart` | `intervaloAutoEnvio`, `enviarAtendidos()`, `ultimoEnvioAuto` |
| `app_movil/lib/features/monitoreo/monitoreo_api.dart` | **Nuevo**: modelos y consultas de MONITOREO |
| `app_movil/lib/features/monitoreo/grafico.dart` | **Nuevo**: barras, agrupadas, líneas y donut |
| `app_movil/lib/features/monitoreo/monitoreo_screen.dart` | Tablero con el esquema de la web |
| `app_movil/test/d109_metricas_y_fondo_test.dart` | **Nuevo**: 11 pruebas |
| `app_movil/lib/core/constants.dart`, `pubspec.yaml` | Versión `1.10.0+19` |

---

## 5. Verificación

| Prueba | Resultado |
|---|---|
| `flutter analyze` | **«No issues found!»** |
| `flutter test` | **183/183 en verde** (172 + **11 nuevos** de D-109) |
| APK de release | **`1.10.0+19`** firmada con el keystore oficial, SHA-256 `392a2f7e…` |
| Sitio | `/apk/apk.json` sirve **`1.10.0+19`** con el SHA-256 del binario |

**Pruebas nuevas:** cadencias (60 s y 5 min) · interpretación del diario, semanal, globales,
reparación, construcción, cuadrillas y capacidad · tolerancia a textos/nulos · proporciones,
máximos y porcentajes · dibujo y anuncio accesible de barras, donut, líneas y barras agrupadas.

---

## 6. Pendiente

- **Prueba en dispositivo**: (a) mensajes llegando con la app en segundo plano; (b) una acción de
  cierre hecha sin conexión que se envía sola en ≤ 5 min y se refleja en MONITOREO de la web;
  (c) el tablero de MONITOREO con gráficos en los cuatro roles.
- Límite conocido de Android: si el sistema **mata** el proceso de la app (no solo la manda al
  fondo), los temporizadores se detienen hasta reabrirla. Para una garantía total habría que añadir
  un `WorkManager` nativo; se deja como mejora si la operación lo exige.
