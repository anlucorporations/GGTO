# Plan de desarrollo vertical — Incremento **D-95 … D-98** · APK de Gestión

> **Versión:** `v0.1` · **Fecha:** 2026-10-10 · **Rama:** `GGTOv2-DSH-GCP`
> **Base:** [`incremento_D95_apk_gestion.md`](incremento_D95_apk_gestion.md) **v0.3.2** (18 RF-APK nuevos,
> 6 RNF-APK, 12 RNF-34…45, 6 RT-APK, **19 decisiones**, 2 riesgos aceptados) ·
> [`casos_uso/casos_uso_D95.md`](casos_uso/casos_uso_D95.md) **v0.2** (24 casos de uso) ·
> [`INFORME_OPTIMIZACION_D95_V1.md`](INFORME_OPTIMIZACION_D95_V1.md) (plan de acción M-1…M-22).

> **Estado real al 2026-10-12:** D-95 está **parcial en el checkout y no desplegado**; hay migración/semilla local, mensajería alineada en ORM/DDL y guards parciales, sin ejecución sobre PostgreSQL ni pruebas actuales. D-96 ya tiene localmente los tres endpoints de monitoreo faltantes y una primera pantalla Flutter con selector de cinco vistas, temporizador de cinco minutos en primer plano y entrada diferenciada por rol. Caché offline, presupuesto/backoff, navegación por módulos, aislamiento y pruebas siguen pendientes. D-97/D-98 no están implementados. La APK firmada vigente permanece en `1.1.0+9`; no usar checks ni pruebas de una línea base anterior como evidencia de cierre. Consultar [`auditoria_estado_real_v2.md`](auditoria_estado_real_v2.md).

## 0. Principios de ejecución

1. **Cada ciclo es una entrega 100 % operativa**: nada de capas horizontales a medias. Al cerrar un
   ciclo el sistema funciona y se puede desplegar.
2. **Las pruebas que no necesitan base de datos se ejecutan en este entorno.** Línea base verificada:
   **44/44 unitarias en verde en 1,23 s** (`test_security`, `test_sync_unit`,
   `test_sectorizacion_cuadrilla0`, `test_ingesta_parser`) con Python 3.14.5 / pytest 9.1.1, e
   `import app.main` OK. Todo lo que toque BD se marca como **pendiente de BD real** y se prueba por
   contrato o con dobles.
3. **Migraciones**: convención vigente — script idempotente `scripts/migrar_dXX_*.py` (simulación por
   defecto, `--aplicar --si`, log en `RepoTecnico/BaseOperaciones/`) **más** `db/schema.sql`. Nunca
   `DELETE` sin filtro (D-55).
4. **Nada se promete que esté diferido o aceptado como riesgo**: el **MFA no se implementa**
   (**RA-01**, DEC-G14) y la **caché local no se cifra** (**RA-02**, DEC-G19).

---

## 1. Resumen de los ciclos

| Ciclo | Entrega | Requisitos | CU | Mejoras del informe | Criterio de cierre |
|---|---|---|---|---|---|
| **D-95** | **Fundaciones**: rol COORDINADOR, acotado real por central, mensajería rediseñada, guards por capacidad | RT-APK-01/03/05/06, RF-APK-22/24, RNF-38/41/42/44 | CU-01, 02, 12, 13, 19, 20, 22 | M-1, M-3, M-4, M-6, M-10, M-12, M-14, M-18, M-19 | Migración ensayada y aplicada; **batería negativa A→B en verde**; RBAC por endpoint (concedidos y denegados) en verde; sin BD real dañada |
| **D-96** | **APK base y MONITOREO**: navegación por rol, caché de lectura, refresco con presupuesto y **las 3 vistas que hay que construir** | RF-APK-13/27/28, RNF-APK-01/02/03/05/06, RNF-34/35/36/37/39 | CU-03, 04, 05, 06, 18, 21 | M-5 (parcial), M-7, M-8, M-11 | APK con menú por rol; refresco verificado con reloj simulado; API de las 3 vistas nuevas en verde |
| **D-97** | **Pantallas de gestión** del Supervisor y Administrador | RF-APK-14/15/16/17/24/25/29/30, RNF-40/43 | CU-07…11, 23, 24 | M-9, M-20 | Recorrido completo sobre datos reales; `flutter test` en verde; **prueba de carga** (RNF-34) |
| **D-98** | **Coordinador (APK y WEB)**, versión mínima, manuales y entrega | RF-APK-18/19/20/21/23/26, RNF-45 | CU-14…17 | M-13, M-17, M-21, M-22 | APK firmada publicada (⚠️ depende del keystore), manuales sincronizados, WEB del Coordinador verificada, **prueba de carga final** |

---

## 2. D-95 — Fundaciones

**Objetivo:** que el rol nuevo exista **sin abrir ningún agujero de seguridad**. Es el ciclo de mayor
riesgo porque toca autenticación, RLS y una tabla viva con PII.

| # | Tarea | Requisitos / hallazgos | Evidencia de partida |
|---|---|---|---|
| D95-01 | **Migración del rol**: insertar `COORDINADOR` en el catálogo `rol` (idempotente) y añadirlo a `ROL_ASIGNABLE` | RT-APK-01 · DEC-G1/G16 | `RepoTecnico/db/schema.sql:872-876`; `app/schemas/config.py:132` |
| D95-02 | **`nombre`/`apellido` en `usuario`**: la cuenta de gestión no tiene dónde guardar el nombre | §9.5 · H-07 | `app/models/entities.py:76-89` (no existen) |
| D95-03 | **Pre-alta de la cuenta de gestión** (endpoint nuevo): crea `Usuario` con `id_tecnico = NULL`, rol `COORDINADOR`, central, clave aleatoria inalcanzable y nombre | DEC-G16 · H-07 | `app/api/routes_config.py:349-383` exige fila en `tecnico` (`:365`) |
| D95-04 | **`GET` de auditoría** para el SUPER (no existe) | RT-APK-06 · DEC-G17 | Sin coincidencias de lectura de `auditoria` en el contrato |
| D95-05 | **Acotado real por central**: `SET LOCAL app.id_central` por petición; **retirar la cláusula `IS NULL`** de las políticas; derivar la central de `usuario.id_central` en `resolver_central` | **H-01** · M-1 · RT-APK-02 | `schema.sql:767-785`; `app/services/consultas.py:20-29` |
| **D95-05b** | ⚠️ **PRECONDICIÓN BLOQUEANTE de D95-05 (riesgo `R7`, verificado):** las tres tablas con RLS tienen **`FORCE ROW LEVEL SECURITY`** (`schema.sql:781,788,797`), de modo que la política aplica **incluso al propietario**, y **ningún** servicio fija el parámetro (`set_config`/`SET LOCAL` en `app/services/` = **0 coincidencias**). **Antes** de retirar la cláusula `IS NULL OR` hay que fijar `app.id_central` en **todos** los caminos: API por petición (`set_config(..., true)`), **`services/ingesta.py`**, **`services/purga.py`** y los **scripts**, con una única vía de escape **explícita, acotada y auditada** (SUPER y tareas de sistema). Si se retira la cláusula sin esto, **la ingesta diaria deja de escribir** | **R7** · H-01 · RNF-42 | Verificado por el director: `FORCE` en las 3 tablas y 0 usos de `set_config` |
| D95-06 | **Corregir el borrado cruzado de `cuadrilla_sector_dia`** (un guardado de una central borra el de las demás) | **H-13** · M-10 | `app/services/despacho.py:225-334` |
| **D95-06b** | ⚠️ **H-13 es PEOR de lo diagnosticado (verificado por el director):** la tabla tiene hoy **`UNIQUE (fecha, id_sector)` sin la central** (`RepoTecnico/db/schema.sql:509`), de modo que **dos centrales no pueden ni asignar el mismo sector el mismo día** — la segunda viola la restricción (defecto **latente**, más allá del `DELETE`). La migración debe **eliminar ese `UNIQUE`** y **recrearlo como `(fecha, id_central, id_sector)`**, comprobando antes si hay datos que lo impidan | **H-13** · RNF-42 | `schema.sql:501-512` |
| D95-07 | **Guards por capacidad**: separar `_escritura` de alertas y `_envio` de mensajería | **H-09, H-10** · M-6 | `routes_alertas.py:43`; `routes_mensajes.py:29` |
| D95-08 | **Rediseño de la mensajería**: destinatario-usuario, nuevos `CHECK`, PK polimórfica de `mensaje_destino`, **Supervisor concreto** y **escalado al ADMIN**; **eliminar el fallback** de `resolver_destinatarios` | DEC-G15 · RT-APK-03 · M-3, M-4 | `app/models/mensaje_entities.py:28,60,67-72,81-86` |
| **D95-08b** | ⚠️ **Consecuencia verificada del cambio de PK (no estaba en las auditorías):** la identidad compuesta de `mensaje_destino` se usa en **`app/services/mensajes.py:229`** (`db.get(MensajeDestino, (id_mensaje, usuario.id_tecnico))`) y **una prueba existente la afirma**: `app/tests/test_d81_unit.py:67-69` exige `pk == ["id_mensaje","id_tecnico"]` — es una de las **44 pruebas de la línea base**. Hay que actualizar el `db.get`, el `INSERT` de `:124`, los filtros de bandeja (`:207-265`) **y esa prueba**, sin romper la línea base | DEC-G15 · H-03 · RNF-39 | Verificado por el director |
| D95-09 | **Exclusión del Coordinador del reporte de campo** (`POST /fallas-masivas/reporte-campo` → **403**) | DEC-G11 · CU-14 | `app/api/routes_alertas.py:203-230` |
| D95-10 | **Traza en `auditoria`** de las escrituras nuevas (alta de especial, orden de material, asignar/quitar del despacho) | RNF-44 · M-14 | `routes_especiales.py:101-125`; `routes_alertas.py:330-349` |
| D95-11 | **Retención de los datos nuevos** (mensajería de gestión y auditoría) | RNF-38 · M-19 | `app/services/purga.py:95-97` |
| D95-12 | **Defectos colaterales C-1/C-2**: la central escrita a mano en el imprimible del despacho y en el aviso de Telegram/MCP | §9.6 | `routes_despachos.py:486`; `routes_alertas.py:402` |
| D95-13 | **Respaldo verificado y rollback probado ANTES** de aplicar la migración | RNF-42 · M-18 | Riesgo aceptado D-26 (instancia sin respaldo) |
| D95-14 | **Pruebas**: contrato RBAC por endpoint (concedidos **y denegados**), aislamiento A→B con **dos centrales**, mensajería nueva, migración idempotente y rollback | RT-APK-05 · H-01 · RNF-41 | Se ejecutan **sin BD** donde sea posible |

> **Fuera de D-95 por decisión:** **M-2 (implementar el MFA)** — diferido, riesgo aceptado **RA-01**.
> No entra en ningún ciclo de este incremento.

---

## 3. D-96 — APK base y MONITOREO

| # | Tarea | Requisitos | Nota de partida |
|---|---|---|---|
| D96-01 | **Navegación por rol** en la APK multi-rol: el menú y las rutas se arman según el rol, con guardia en el router | RF-APK-27 · DEC-G2/G3 | `app_movil/lib/main.dart:106-121` (7 rutas fijas); `core/sesion.dart:27-29` |
| D96-02 | **Caché de lectura particionada por usuario** y **purga al cerrar sesión** | RNF-37 · H-14 · M-11 | `core/database.dart:11-18`; `main.dart:32` |
| D96-03 | **Refresco de 5 min con presupuesto**: temporizador único, solo la pantalla visible, pausa con formulario abierto, tope por token, backoff tras 3 fallos | RNF-APK-06 · RNF-35 · M-8 | Modelado en `casos_uso/diagramas_D95.md` §4 — **implementarlo tal cual** |
| D96-04 | **Construir las 3 vistas de MONITOREO que faltan**: **mensual**, **casos especiales** y **construcciones** (API + pantallas) | **H-18** · RF-APK-13 | `app/api/routes_monitoreo.py` solo tiene diaria, semanal, reparación, construcción por cuadrilla y capacidad |
| D96-05 | **Enmascaramiento por rol** en pantalla (PII) | RNF-36 · H-04 | Solo enmascaramiento: **sin cifrado ni TTL** (**RA-02**) |
| D96-06 | **Prueba de que el TÉCNICO no descarga automáticamente** (coexistencia con D-84) | RNF-APK-03 · RF-APK-18 (CU-18) | `plan_mejora_apk.md:85-102` |

---

## 4. D-97 — Pantallas de gestión del Supervisor y Administrador

| # | Tarea | Requisitos | Nota de partida |
|---|---|---|---|
| D97-01 | **ESPECIALES**: listar, filtrar y abrir la ficha | RF-APK-14 | `routes_especiales.py` |
| D97-02 | **DESPACHO**: universo, asignación de sectores por cuadrilla del día, procesar y publicar | RF-APK-15 | `routes_despachos.py` (`/proceso`, `/asignacion`, `/procesar`) |
| D97-03 | **Concurrencia del despacho**: bloqueo por (central, fecha), `409` ante conflicto y borrado no destructivo | **H-12** · M-9 | `routes_despachos.py:209-262` (check-then-act) |
| D97-04 | **CASOS**: ver datos y **asignar/quitar de cuadrilla** desde la ficha | RF-APK-16 | D-78/D-79 (`/despachos/asignar-casos`, `/quitar-casos`) |
| D97-05 | **Alta manual de caso** (con `REF-…`) y **edición ligera** (Sector · Fecha de cita · Información 200) | RF-APK-29/30 · DEC-G12 | Endpoints **ya existen** (`routes_casos.py:365,450`): falta la pantalla. Aplicar el límite de 200 en la APK |
| D97-06 | **Pantalla GESTIÓN** (cuadrilla 0) anclada a **`es_supervisor` + `en_gestion_supervisor`** | RF-APK-17 · **H-16** · DEC-G7 | `app/services/despacho.py:132-145` |
| D97-07 | **ALERTAS** y **bandeja de mensajes recibidos del Supervisor** | RF-APK-24/25 | `routes_alertas.py`; mensajería de D-95 |
| D97-08 | **Aviso a la cuadrilla afectada** al asignar, mover o quitar casos del despacho | **H-31** · M-20 | `services/despacho.py:654-746` |
| D97-09 | **Usabilidad y portabilidad**: umbrales medibles y validación con 3–5 usuarios reales; matriz de dispositivos | RNF-43 · RNF-40 | H-37, H-29 |
| D97-10 | **Prueba de carga** de las pantallas de gestión | RNF-34 · DEC-G18 | p95 ≤ 2 s y 0 errores 5xx |

---

## 5. D-98 — Coordinador, versión mínima, manuales y entrega

| # | Tarea | Requisitos | Nota de partida |
|---|---|---|---|
| D98-01 | **Crear casos especiales** desde la APK del Coordinador | RF-APK-19 | `POST /casos-especiales` (hoy ADMIN/SUPERVISOR) |
| D98-02 | **Fallas masivas**: consulta completa (casos afectados, planificación, materiales) **y solo** la **orden de material** como escritura | RF-APK-20/21 · DEC-G8/G13 | `GET /fallas-masivas…`; `orden_material` |
| D98-03 | **Enviar mensaje al Supervisor** desde la APK del Coordinador | RF-APK-22 · DEC-G9 | Endpoint dedicado de D-95 |
| D98-04 | **Monitoreo de alertas** del Coordinador (ver y abrir fichas, **sin actuar**) | RF-APK-23 · DEC-G13 | `routes_alertas.py` |
| D98-05 | **WEB del Coordinador**: las mismas capacidades en la SPA, con menú y guard **por enumeración** (no por excepción) | RF-APK-26 · **H-08** · M-7 | `app/web/src/components/RutaGestion.tsx:13` (niega por excepción) |
| D98-06 | **Cerrar los canales externos por defecto** y enmascarar PII en Telegram/MCP; acotar por central | **H-23** · M-13 · C-2 | `routes_alertas.py:417-425,449-451,504-511` |
| D98-07 | **Versión mínima del APK** soportada, con aviso al arrancar | RNF-45 · H-36 · M-22 | Sin mecanismo hoy |
| D98-08 | **Aviso de privacidad** del personal de gestión y resolución de la contradicción «no publicar / APK publicada» | **H-32** · M-17 | `app_movil/assets/disclaimer.txt` |
| D98-09 | **Observabilidad** de las acciones de gestión y del refresco fallido | RNF-41 · M-21 | `ObservabilidadMiddleware` |
| D98-10 | **Manuales** (técnico + literal + HTML/PDF + AYUDA) y **APK firmada** | — | ✅ **El keystore oficial SÍ está** (`RepoTecnico/credenciales/ggto-tecnico-release.jks`, cabecera JKS verificada; datos en `credenciales/CREDENCIALES-APK.md`). Solo hace falta que el custodio aporte la **contraseña**. Usar `scripts/publicar_apk.py` con `--confirmar` |
| D98-11 | **Prueba de carga final** y cierre del incremento | RNF-34 | — |

### Estado de implementación local — 2026-10-13

- **D-96:** ya están las cinco vistas seleccionables (Diaria, Semanal, Mensual, Casos especiales y Construcciones) con actualización al entrar y temporizador de cinco minutos en primer plano. Falta el refresco unificado con presupuesto/backoff, privacidad de PII y sus verificaciones.
- **D-97:** GESTIÓN/CASOS permiten consultar y asignar; ESPECIALES permite alta, lectura y edición básica; DESPACHO permite listar por fecha, generar el día, publicar y cerrar. La operación completa por sectores (`/proceso`, `/asignacion`, `/procesar`), alta/edición manual de casos y carga con usuarios reales siguen pendientes.
- **D-98:** Coordinación puede crear casos especiales, consultar alertas/fallas y solicitar materiales, y enviar mensajes al Supervisor desde APK y WEB. La ficha de fallas se presenta de solo lectura salvo materiales. Faltan las pruebas de seguridad negativas, prueba en base de datos y completar/validar el alcance de la WEB.
- Flutter Analyzer no reporta problemas y `npm run build` termina correctamente. La APK debug no se ha generado porque el host agotó memoria durante la compilación Dart. No se ha ejecutado migración de datos ni pruebas automatizadas; la compilación firmada release también queda pendiente.

---

## 6. Orden, dependencias y esfuerzo

```
D-95 ──► D-96 ──► D-97 ──► D-98
 │         │        │
 │         └── D-97 depende de la navegación y la caché de D-96
 └── D-95 bloquea a todos: sin rol, sin acotado por central y sin mensajería
     no se puede construir ninguna pantalla de gestión
```

| Ciclo | Esfuerzo | Riesgo principal |
|---|---|---|
| **D-95** | **L** | Toca autenticación, RLS y una tabla viva con PII; la migración del `CHECK` en línea exige ventana y rollback |
| **D-96** | **L** | Las 3 vistas de monitoreo son **trabajo nuevo** que la petición del usuario daba por existente (H-18) |
| **D-97** | **L** | Concurrencia del despacho y la validación de usabilidad con usuarios reales |
| **D-98** | **L** | Cerrar los canales externos sin romper la operación; el **keystore** para firmar |

---

## 7. Definición de terminado (por ciclo)

1. Código con `ruff` y `mypy` sin hallazgos; `tsc` y `npm run build` en verde cuando toque frontend.
2. `flutter analyze` sin hallazgos y `flutter test` en verde cuando toque APK.
3. Pruebas del ciclo en verde, **incluidas las negativas** (lo que debe ser denegado se prueba denegado).
4. Migración ensayada en simulación, con respaldo y rollback documentados, **antes** de aplicarla.
5. Documentación actualizada: `estado_proyecto.md`, el manual técnico y el literal que correspondan.
6. Sin criterios de aceptación sin probar: si algo no se pudo probar, queda escrito como **pendiente**.

---

## 8. Insumos externos que bloquean o condicionan el plan

| # | Insumo | Bloquea | Estado |
|---|---|---|---|
| 1 | **Keystore oficial** de CANTV | Firmar la APK en **release** (D-98) | ✅ **PRESENTE — corrección del 2026-10-11:** está en `RepoTecnico/credenciales/ggto-tecnico-release.jks` (cabecera JKS `FE ED FE ED` verificada) y sus datos en `credenciales/CREDENCIALES-APK.md`. **La firma en release SÍ es posible**; ver `credenciales/ACCESO-REPOSITORIOS.md` §8 |
| 2 | **Responsable de protección de datos y DPA** (CANTV) | Cerrar **RA-02** (caché sin cifrar) | ⛔ Pendiente externo |
| 3 | **Credenciales de Telegram y correo** | Que las notificaciones salgan (`canales_configurados=false`) | ⛔ Pendiente externo |
| 4 | **Centrales reales** para la prueba de aislamiento A→B | Criterio de cierre de **D-95** | ⚠️ Hoy hay una sola central (2324X) |
| 5 | **Instancia propia con respaldo/PITR** | Cerrar el riesgo aceptado **D-26** | ⛔ Depende de la facturación GCP |
| 6 | **Usuarios reales** (3–5 supervisores/coordinadores) | Validación de usabilidad (RNF-43, D-97) | ⛔ Pendiente de coordinar con CANTV |

---

## 9. Riesgos del plan

| # | Riesgo | Mitigación |
|---|---|---|
| P-1 | D-95 toca la RLS y una tabla viva con PII: un error afecta a **producción** | Migración idempotente con respaldo verificado y rollback probado (D95-13); ensayo en esquema aislado (`ggto_test`) |
| P-2 | Las 3 vistas de monitoreo son **trabajo no previsto** y pueden desbordar D-96 | Criterio de cierre propio; si no cabe, la vista restante se entrega en D-98 y se declara |
| P-3 | El aislamiento por central no se puede probar con una sola central | Sembrar una **segunda central de prueba** en el esquema aislado; nunca en producción |
| P-4 | Sin keystore no hay APK en release | Se puede verificar con firma de prueba (`publicar_apk.py --firma-debug`) y dejar la firma oficial para cuando se aporte |
| P-5 | El MFA diferido deja los roles de gestión sin segundo factor | **Riesgo aceptado RA-01** con dueño y fecha; se documenta en el manual de seguridad |

---

## 10. Historial

| Versión | Fecha | Cambio |
|---|---|---|
| **v0.1** | 2026-10-10 | Plan vertical de los 4 ciclos (D-95…D-98) con tareas, requisitos, CU, mejoras del informe, criterios de cierre, dependencias, insumos externos y riesgos. Incorpora la línea base de **44/44 pruebas unitarias sin BD en verde**. |
