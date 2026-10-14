# Auditoría funcional adversarial — Casos de uso del incremento **D-95 … D-98** (APK de Gestión: Supervisor · Administrador · Coordinador)

| Campo | Valor |
|---|---|
| Documento auditado | `RepoTecnico/casos_uso/casos_uso_D95.md` **v0.2** (24 casos de uso, 105 bloques Gherkin, 2 matrices de trazabilidad, 9 dudas abiertas) |
| Requisitos de contraste | `RepoTecnico/incremento_D95_apk_gestion.md` **v0.3.2** — 18 RF-APK (13…30), 6 RNF-APK (01…06), **12 RNF del catálogo (RNF-34…45)**, 5 RT-APK (01…05), 19 decisiones DEC-G1…DEC-G19, RA-01/RA-02, §9.1–§9.4 |
| Fecha | 2026-10-10 |
| Auditor | Auditor funcional adversarial (agente DSH), lectura-only |
| Alcance | Contenido de los 24 CU (actor, precondición, flujo, alternativos, Gherkin, EARS), trazabilidad, aplicación de las 19 decisiones y consistencia con el código vigente |
| Fuera de alcance | La auditoría de los **requisitos** (`INFORME_OPTIMIZACION_D95_V1.md`, 38 hallazgos): aquí solo se comprueba si los CU los **incorporan**. No se modifica ningún archivo salvo este informe |
| Método | Lectura completa del documento + verificación línea a línea de **todas** las citas `archivo:línea` contra el código, `grep`/`glob` sobre el repositorio y conteo mecánico de bloques Gherkin; ante la duda, el hallazgo se descarta (anexo C) |

---

## 1. Veredicto

**NO APTOS para pasar a la Fase 3 (desarrollo) en su estado actual (v0.2).**

El **cuerpo funcional** de los 24 casos es de calidad alta y —hecho poco común— sus citas al código son **casi todas exactas** (ver §5, «Verificado sin hallazgos»): se comprobaron una por una más de 60 referencias `archivo:línea` y todas las verificables son correctas, incluida la filigrana `deps.py:65`, `mensaje_entities.py:67-72`, `consultas.py:20-29`, `schema.sql:767-769` y el «hoy no existe» en las seis marcas declaradas. Las decisiones de más riesgo (DEC-G14 MFA diferido, DEC-G19 solo enmascaramiento, DEC-G11 `403` al Coordinador, DEC-G15 fin del fallback, DEC-G16 cuenta sin `tecnico`) están **bien aplicadas**.

El documento, sin embargo, **no cubre el conjunto de requisitos vigente**: está anclado al incremento **v0.3** (`casos_uso_D95.md:8`) cuando la versión autoritativa es **v0.3.2**, que añadió **§4.6 con 12 RNF nuevos (RNF-34…45)** y **§9.4** con 10 stakeholders. Los RNF-34…45 aparecen **0 veces** en el documento de casos de uso (`grep "RNF-3[4-9]|RNF-4[0-5]"` = **0 coincidencias**): no hay columna en las matrices, ni EARS, ni un solo criterio. Cuatro de ellos (**RNF-38, RNF-41, RNF-42 y RNF-44**) son **entregables de cierre del propio ciclo D-95** (incremento v0.3.2 §4.6). Esto invalida la declaración de la §«Requisitos huérfanos» («Sin otros huérfanos…», `casos_uso_D95.md:1996`) y deja el cierre de D-95 sin criterios de aceptación para auditoría de escrituras, observabilidad, respaldo/rollback y retención.

Además, un defecto real declarado **entregable de D-95** por el incremento (H-13: `guardar_asignacion`/`asignacion_guardada` borran la asignación de **todas** las centrales del día) **no tiene caso de uso ni criterio**, y la batería negativa A→B de CU-D95-22 (el criterio de cierre de D-95) no lo incluye. Junto con el conflicto no declarado entre **RNF-37** (purga de la caché al cerrar sesión) y el EARS de **CU-D95-06** (RA-02), son las condiciones que impiden arrancar la Fase 3 sin retrabajo de requisitos.

**Resumen:** 19 hallazgos — **1 CRÍTICA · 6 ALTAS · 10 MEDIAS · 2 BAJAS** — y **12 requisitos huérfanos reales** (RNF-34…RNF-45). La corrección es mayoritariamente **aditiva** (12 filas de trazabilidad + EARS + 2-4 escenarios) y no cuestiona los flujos ya redactados.

## 2. Metodología y contraste con el código

1. **Lectura íntegra** de `casos_uso_D95.md` (2 088 líneas), `incremento_D95_apk_gestion.md` (v0.3.2, 341 líneas), `INFORME_OPTIMIZACION_D95_V1.md` (referenciado en §9) y `auditoria_D89_casos_uso.md` (estilo de la casa).
2. **Verificación de cada cita `archivo:línea`** con lectura directa de: `app/api/routes_monitoreo.py`, `routes_alertas.py`, `routes_casos.py`, `routes_especiales.py`, `routes_despachos.py`, `routes_mensajes.py`, `routes_auth.py`, `routes_config.py`, `routes_sync.py`, `app/api/deps.py`; `app/models/mensaje_entities.py`, `app/models/entities.py`; `app/services/consultas.py`, `services/mensajes.py`, `services/despacho.py`; `app/schemas/casos.py`, `app/schemas/config.py`; `app/core/config.py`; `app/web/src/components/RutaGestion.tsx`, `FichaCaso.tsx`, `app/web/src/auth/AuthContext.tsx`; `app_movil/lib/core/sesion.dart`, `auth_storage.dart`, `database.dart`, `main.dart`, `features/sync/download_service.dart`, `sync_provider.dart`, `features/mensajes/mensajes_provider.dart`, `pubspec.yaml`; `RepoTecnico/db/schema.sql`.
3. **Búsquedas dirigidas de cobertura**: `grep` de `RNF-34…RNF-45` (0), `RNF-3[4-9]` (0), `cuadrilla_sector_dia|concurrencia|H-12|H-13|H-18` (0 en el documento de CU), `SET LOCAL app.id_central` en `app/**/*.py` (**0**, confirmado), `@router.get("/auditoria…")` (**0**, confirmado), `/usuarios` (**0** endpoints, confirmado).
4. **Conteo mecánico del Gherkin**: 105 fences ```` ```gherkin ````, 105 líneas `Dado`, 105 `Cuando`, 105 `Entonces` → **ningún bloque carece de resultado observable** y no hay bloques sin `Entonces`.
5. **Validación de referencias cruzadas**: 24/24 IDs `CU-D95-01…24` existen; el grafo de referencias (334 menciones) no contiene IDs fuera de rango ni referencias a otros incrementos.
6. **Regla de descarte**: solo se reporta lo verificable en este repositorio; todo lo dudoso baja de severidad o pasa al anexo C.

## 3. Tabla priorizada de hallazgos

| # | Severidad | Caso / artefacto | Hallazgo (1 línea) | Evidencia principal |
|---|---|---|---|---|
| **H-01** | **CRÍTICA** | Todo el documento · `casos_uso_D95.md:8`, `:1876-2000` | El documento se ancla al incremento **v0.3** y **no incorpora los 12 RNF-34…45 de la v0.3.2** (§4.6): 0/12 trazados, 0 EARS, 0 criterios; 4 de ellos (RNF-38/41/42/44) cierran **D-95** | `grep RNF-34…45` = **0**; `casos_uso_D95.md:8`; `incremento:146-165`, `:341` |
| **H-02** | **ALTA** | CU-D95-06 · `:546-553` | El EARS de RA-02 prohíbe explícitamente el **borrado de la caché al cerrar sesión** (y `FLAG_SECURE`), mientras **RNF-37** (v0.3.2) los **exige** y el alcance de D-96 pide «caché purgada al cerrar sesión»; el CU no declara el conflicto | `casos_uso_D95.md:552`, `:502`; `incremento:157`, `:199`, `:77` |
| **H-03** | **ALTA** | CU-D95-22 · `:1678-1683` | El Gherkin da al **COORDINADOR** lectura de `GET /api/v1/casos` (200 con datos de la central A) contra la matriz §5.2 (**CASOS «—»**) y contra CU-D95-03/17/23/24 → el criterio de cierre de H-01 es autocontradictorio | `casos_uso_D95.md:1679-1683` vs `:283-285`, `:1257`, `:1745`; `incremento:174` |
| **H-04** | **ALTA** | (falta CU) · incremento §6 y §9.3 | **H-13**, declarado entregable de **D-95** (el `DELETE` de `guardar_asignacion` borra la asignación de **todas** las centrales), **no tiene caso de uso ni criterio**; la batería A→B de CU-D95-22 no incluye `PUT /despachos/asignacion` | `incremento:198`, `:282`, `:311`; `app/services/despacho.py:272`, `:225-230`; `casos_uso_D95.md:1651-1658` |
| **H-05** | **ALTA** | CU-D95-11 · `:836`, `:854-860` | **H-16**: la pantalla GESTIÓN mantiene `id_cuadrilla` (cuadrilla del **último despacho**) como vía principal y deja la marca `en_gestion_supervisor` «como respaldo equivalente»; la divergencia queda en la duda 2 y el criterio «exactamente 8 renglones» no es determinable | `casos_uso_D95.md:836`, `:858`, `:2008`; `app/services/despacho.py:132-145`; `app/api/routes_casos.py:155-177` |
| **H-06** | **ALTA** | CU-D95-04 · `:314-368` | **H-18/R6**: las 5 vistas se presentan servidas por endpoints existentes **sin marca «NUEVO»**, y la vista «Casos especiales» se mapea a `/monitoreo/reparacion` (métrica de reparación), que **no** es un monitoreo de casos especiales | `casos_uso_D95.md:319-321`, `:365`; `app/api/routes_monitoreo.py:82,97,108`; `incremento:239`, `:279` |
| **H-07** | **ALTA** | CU-D95-09 · `:708` | **DEC-G12**: el paso 7 ofrece el **imprimible del despacho** (`GET /despachos/{id}/imprimible`) mientras la cabecera del mismo documento (líneas 23-29) lo declara **fuera de alcance** | `casos_uso_D95.md:708` vs `:23-29`; `app/api/routes_despachos.py:441` |
| **H-08** | MEDIA | CU-D95-02 · `:222-227` | El Gherkin afirma «el sistema **registra** el inicio de sesión con el rol resultante», contra el EARS de CU-D95-01 («hoy el login **no** escribe en `auditoria`») y sin requisito que lo respalde | `casos_uso_D95.md:224-226` vs `:157`; `app/api/routes_auth.py:106-122` |
| **H-09** | MEDIA | CU-D95-01 · `:124` | A1 promete que al expirar el token la APK «**no conserva caché de sesión**», contra CU-D95-06/A5 («sin cifrado **ni borrado** al cerrar sesión») y contra la duda 3 (purga pendiente de diseño) | `casos_uso_D95.md:124` vs `:502`, `:2009` |
| **H-10** | MEDIA | Matriz · `:1878-1903` | **Desajustes ficha ↔ matriz**: CU-D95-14 recibe RNF-APK-06 en la matriz sin mencionarlo en ficha ni en el cuerpo; CU-D95-17 (+RNF-APK-02, +RT-APK-05), CU-D95-19 (+RNF-APK-04) y CU-D95-22 (+RNF-APK-06) igual | `casos_uso_D95.md:1043` vs `:1893`; `:1250` vs `:1896`; `:1392` vs `:1898`; `:1636` vs `:1901` |
| **H-11** | MEDIA | CU-D95-13 · `:969` | El paso 4 exige «la lista de **usuarios** con rol SUPERVISOR activos de su central»: **no existe** endpoint de usuarios (solo `/tecnicos`), no lleva la marca «NUEVO» ni se traza a RT-APK-05/RT-APK-03 | `casos_uso_D95.md:969`; `grep "/usuarios"` en `app/api/*.py` = **0**; `app/api/routes_config.py:300-349` |
| **H-12** | MEDIA | CU-D95-12 · `:914` | A3 propone que la bandeja de enviados del COORDINADOR la resuelva RT-APK-05 «hoy `_envio` no lo incluye», lo que sugiere **ampliar `_envio`** — exactamente lo que **H-10** prohíbe y CU-D95-20 paso 5 evita | `casos_uso_D95.md:914` vs `:1493`, `:1550`; `app/api/routes_mensajes.py:29` |
| **H-13** | MEDIA | CU-D95-05 · `:448` | El tope se prueba con «**12 peticiones/hora**» sin que ningún requisito fije unidad, clave de configuración ni valor; RNF-35 (no incorporado) habla de peticiones **por usuario/minuto** | `casos_uso_D95.md:448`, `:469`; `incremento:155` |
| **H-14** | MEDIA | CU-D95-21 · `:1603` | «Dado un revisor de accesibilidad sobre **las 6 pantallas nuevas** de gestión»: el conjunto **no se enumera** en ningún punto (el menú de gestión tiene 8 secciones) → criterio de accesibilidad no acotado | `casos_uso_D95.md:1603` vs `:252`, `:1571` |
| **H-15** | MEDIA | CU-D95-06 · `:530-536`, `:551` | La máscara «**70\*\*\*\*\*\*\***» tiene 9 caracteres para un número de **10 dígitos** (`7012345678`): el propio criterio de aceptación no puede pasar tal como está escrito | `casos_uso_D95.md:532`, `:551` |
| **H-16** | MEDIA | CU-D95-06 · `:501` | A4 usa como criterio el rótulo «dato antiguo» (>24 h) que la duda 4 declara «**propuesta, pendiente de aceptar**» | `casos_uso_D95.md:501` vs `:2010` |
| **H-17** | MEDIA | CU-D95-09 · `:714` | **H-12** (concurrencia optimista y borrado no destructivo del despacho, entregable de D-97) no tiene caso ni criterio: A3 solo describe el `409` vigente | `casos_uso_D95.md:714`; `incremento:283`; `app/services/despacho.py:272` |
| **H-18** | BAJA | CU-D95-19 · `:1449-1452` | El Gherkin exige la vista de auditoría del SUPER con «actor, entidad y fecha» sin declarar el **contrato** (endpoint, filtros, orden, paginación) del artefacto que hay que construir | `casos_uso_D95.md:1449-1452`, `:49-52` |
| **H-19** | BAJA | CU-D95-03/19/21 · `:2011` | La duda 5 (¿el `SUPER` entra en la APK?) condiciona un **criterio de cierre** (CU-D95-21 paso 3 y Gherkin) sin resolver | `casos_uso_D95.md:2011`, `:262`, `:1571` |

---

## 4. Hallazgos CRÍTICOS y ALTOS — detalle, evidencia y corrección

### H-01 · CRÍTICA — Los 12 RNF nuevos del catálogo (RNF-34…45) no están incorporados; el documento se ancla al incremento v0.3

**Evidencia.**
- Cabecera del documento: «Requisitos | `../incremento_D95_apk_gestion.md` **v0.3** (RF-APK-13…30 · RNF-APK-01…06 · RT-APK-01…05)» — `casos_uso_D95.md:8`. La versión vigente del incremento es **v0.3.2** (`incremento_D95_apk_gestion.md:3`) y fue precisamente la v0.3.2 la que añadió **§4.6 con RNF-34…RNF-45** (`incremento:146-165`) y **§9.4** con los 10 stakeholders (`incremento:314-329`), según su propio historial (`incremento:341`).
- Búsqueda en el documento de casos de uso: `grep "RNF-3[4-9]|RNF-4[0-5]"` → **0 coincidencias**; tampoco aparecen `RNF-34`, `RNF-37`, `RNF-44` de forma individual.
- La matriz de trazabilidad (`casos_uso_D95.md:1878-1903`) tiene columnas `RF-APK | RNF-APK | RT-APK | Decisiones | Actores`: **no hay columna RNF-34…45**. La tabla «Cobertura requisito → caso de uso» (`:1907-1937`) cubre RF-APK-13…30, RNF-APK-01…06 y RT-APK-01…05 y **se detiene ahí**.
- La declaración de la §«Requisitos huérfanos» afirma: «**Sin otros huérfanos:** … quedan cubiertos por al menos un caso de uso según las tablas anteriores» (`:1996-1999`), omitiendo los 12 RNF del catálogo. Los 12 son huérfanos **reales**.
- Cuatro de los doce son de **cierre de D-95** por la columna «Ciclo» de §4.6: **RNF-38** (retención de la mensajería de gestión y de la auditoría, «con plazo y acción al vencer»), **RNF-41** (observabilidad: evento auditable con `request-id` y alertas operativas), **RNF-42** (respaldo verificado, **rollback probado** y RPO/RTO o aceptación de D-26) y **RNF-44** (traza obligatoria en `auditoria` **con prueba por acción** para el **alta de especiales**, la **orden de material** y **asignar/quitar del despacho**). Ninguno tiene EARS ni escenario: CU-D95-08 (alta de especial), CU-D95-16 (orden de material) y CU-D95-10 (asignar/quitar) son exactamente las tres escrituras de RNF-44 y **ninguna menciona la auditoría**; CU-D95-19 paso 7 y CU-D95-20 paso 9 sí exigen traza, pero para el alta del rol y del mensaje, no para esas tres.
- Otros dos RNF no incorporados con criterios ya redactados que los rozan sin citarlos: **RNF-35** (presupuesto del refresco «por usuario/minuto») frente al «12 peticiones/hora» de CU-D95-05 (`:448`), y **RNF-45** (versión mínima del APK consultada al arrancar, D-98) frente a CU-D95-21/A4, que solo afirma que la APK antigua sigue operando (`:1582`).

**Impacto.** El documento es el **entregable de Fase 2** que alimenta la Fase 3. Con 12/12 RNF sin trazar, el equipo de desarrollo no tiene criterio de aceptación para cuatro entregables de D-95; la prueba de cierre de D-95 («migración idempotente + RBAC + aislamiento por central con dos centrales en verde», `incremento:198`) puede darse por buena sin auditoría de escrituras ni respaldo/rollback. La afirmación «sin huérfanos» es, hoy, **falsa**.

**Corrección concreta.**
1. Actualizar la cabecera a **v0.3.2** y añadir en el documento una tercera matriz «**Cobertura RNF del catálogo (RNF-34…45) → caso de uso**» con los 12 requisitos.
2. Añadir a los CU ya existentes, como mínimo:
   - **RNF-44** → CU-D95-08, CU-D95-10 y CU-D95-16: EARS «Cuando se cree/actualice \<entidad\>, el sistema **deberá** escribir en `auditoria` (acción, actor, entidad, central, resultado)» + Gherkin de prueba por acción, p. ej. `Dado un Supervisor que crea un caso especial EMPRESA / Cuando la API responde 201 / Entonces existe 1 fila nueva en auditoria con accion='ALTA_CASO_ESPECIAL' y usuario=P00 del Supervisor`.
   - **RNF-41** → CU-D95-19: eventos con `request-id` y alerta operativa ante «refresco fallido reiterado, error de escritura e intento denegado por rol».
   - **RNF-42** → CU-D95-19 (precondición y A4): respaldo verificado **antes** de la migración, rollback probado y RPO/RTO declarados; hoy solo hay «procedimiento documentado».
   - **RNF-38** → CU-D95-20/A8 y CU-D95-19: plazo de retención de la mensajería de gestión y de la auditoría de las acciones nuevas, con acción al vencer (hoy la duda 6 lo deja «pendiente de declarar»).
   - **RNF-35** → CU-D95-05: fijar la unidad y la clave del tope y alinear el Gherkin con RNF-35 (peticiones por usuario/minuto).
   - **RNF-45** → CU-D95-21: mecanismo de versión mínima al arrancar + prueba de contrato con la APK `1.1.0+8` (hoy duda 7).
3. Retirar de la §«Requisitos huérfanos» la frase «sin otros huérfanos» mientras la matriz no cubra RNF-34…45.

### H-02 · ALTA — CU-D95-06 (RA-02) contradice RNF-37 sobre la purga de la caché al cerrar sesión

**Evidencia.**
- EARS del caso: «**RA-02** (riesgo aceptado formalmente): el sistema **no deberá** cifrar la caché local, ni aplicarle TTL, ni activar `FLAG_SECURE`, ni bloquear la app con PIN o biometría en este incremento» — `casos_uso_D95.md:552`; y A5: «la caché guarda el JSON … **en claro**, sin cifrado **ni borrado al cerrar sesión**» — `:502`.
- Requisito incorporado en v0.3.2: **RNF-37** — «**PII en dispositivo móvil**: `FLAG_SECURE`, alcance limitado y **borrado de la caché al cerrar sesión** — sin cifrado ni TTL por decisión expresa (RA-02)» — `incremento:157`.
- El alcance del ciclo lo confirma: D-96 incluye «caché de lectura **particionada por usuario y purgada al cerrar sesión** (H-14)» — `incremento:199`; y §9.2 H-14 lo repite — `incremento:286`.
- El propio DEC-G19 lista «borrado al cerrar sesión» entre lo **no** implementado — `incremento:77` — de modo que el incremento **se contradice a sí mismo** (RNF-37 vs DEC-G19) y el CU-D95-06 se alinea con DEC-G19 sin **declarar** la contradicción ni trazar RNF-37.
- Coherencia con el código: cierta, la caché sobrevive — `AuthStorage.limpiarSesion()` solo borra `token` y `sesion` (`app_movil/lib/core/auth_storage.dart:55-58`) y `leerCasos()` devuelve todo `caso_local` sin distinguir usuario (`app_movil/lib/core/database.dart:221-223`).

**Impacto.** Un implementador que siga el CU **no purgará**; uno que siga RNF-37/D-96 **sí**. En un dispositivo compartido, la caché con `telefono`, `nombre_cliente` y `direccion` del usuario anterior queda accesible (riesgo de PII ya reconocido en RA-02). El conflicto afecta a D-96 y a la aceptación de RNF-37.

**Corrección concreta.** Añadir a CU-D95-06 una nota de conflicto y una decisión explícita, por ejemplo: «**Conflicto declarado:** RNF-37 exige el borrado de la caché al cerrar sesión y el alcance de D-96 lo incluye (`incremento:157,199`); RA-02/DEC-G19 solo difiere cifrado, TTL, `FLAG_SECURE` y PIN/biometría. Se implementa la **purga de la caché y de la cola en el cierre de sesión** (H-14) y se mantiene el resto en RA-02». Y el escenario:
```gherkin
Dado un Supervisor con la caché de GESTIÓN cargada
Cuando cierra sesión en la APK
Entonces la base local no contiene ninguna fila de caso_local del usuario anterior
Y la cola de acciones pendientes queda vacía
```

### H-03 · ALTA — CU-D95-22 concede al COORDINADOR lectura de `GET /casos`, contra la matriz RBAC y contra otros tres casos

**Evidencia.**
- Gherkin 2 de CU-D95-22 (`casos_uso_D95.md:1678-1683`): «Dado un usuario **COORDINADOR** de la central A autenticado / Cuando llama a `GET /api/v1/casos` sin parámetros / Entonces la respuesta contiene únicamente casos con `id_central` = central A / Y el número de filas es exactamente el de casos de A» → presupone **200**.
- Matriz RBAC autoritativa §5 (`incremento:174`): «CASOS (ver, asignar a cuadrilla) | … | **COORDINADOR —** | Lectura de sus casos».
- El propio documento lo niega en tres sitios: CU-D95-03 (el Coordinador **no** ve CASOS; `:253`, `:283-285`), CU-D95-17 (guard y A6: si escribe `/casos` se le redirige; `:1257`, `:1268`) y CU-D95-23/A8 (matriz «—» en CASOS, `:1745`).
- El mismo CU-D95-22 exige además `403` ante un `id_central` ajeno (`:1655`, `:1708`), lo que es compatible solo si el rol tuviera acceso a `GET /casos`.

**Impacto.** El escenario es el **criterio de cierre de H-01** («batería negativa A→B en verde», `:1711`). Al ser autocontradictorio, la prueba se escribirá de dos formas incompatibles (200 acotado vs `403`) y el cierre de D-95 no será verificable de forma unívoca.

**Corrección concreta.** Sustituir el Gherkin 2 por un rol con acceso a CASOS y añadir la prueba negativa del Coordinador:
```gherkin
Dado un usuario SUPERVISOR de la central A autenticado
Cuando llama a GET /api/v1/casos sin parámetros
Entonces la respuesta contiene únicamente casos con id_central = central A
Y el número de filas es exactamente el de casos de A y no el total de las dos centrales

Dado un usuario COORDINADOR de la central A autenticado
Cuando llama a GET /api/v1/casos sin parámetros
Entonces la API responde 403
Y la respuesta no contiene ningún dato de ninguna central
```

### H-04 · ALTA — H-13 (borrado cruzado de `cuadrilla_sector_dia`), entregable de D-95, no tiene caso de uso ni criterio

**Evidencia.**
- El incremento declara H-13 como trabajo del ciclo D-95 en **tres** lugares: §6 ciclo D-95 («**corrección del borrado cruzado de `cuadrilla_sector_dia`**», `incremento:198`), §9.2 («`guardar_asignacion`/`asignacion_guardada` **no filtran `id_central`** — guardar la asignación de una central **borra** la de las demás centrales del mismo día», `incremento:282`) y §9.3 fila 7 (`incremento:311`).
- El defecto existe y es verificable: `app/services/despacho.py:272` ejecuta `db.execute(delete(CuadrillaSectorDia).where(CuadrillaSectorDia.fecha == fecha))` **sin** `id_central`, y `asignacion_guardada` lee por fecha sin central (`app/services/despacho.py:225-230`).
- En el documento de casos de uso: `grep "cuadrilla_sector_dia|H-13"` = **0 coincidencias**; CU-D95-22 (el único caso que trata el aislamiento por central) enumera en su paso 5 los endpoints a acotar — `routes_casos.py:180,278,444`, `routes_especiales.py:128,242`, `routes_alertas.py:153,301,311`, `routes_monitoreo.py:56-187` y `routes_despachos.py:179` — y **no incluye** `PUT /despachos/asignacion` (`routes_despachos.py:192`) ni el `DELETE` del servicio. La batería A→B (`:1699-1703`) se ejecuta «de todos los endpoints de la matriz §5.2», donde la asignación de sectores no aparece como caso de prueba con dos centrales.
- H-13 tampoco está trazado a ningún RT-APK en el incremento (RT-APK-02 se limitó a «acotado por central: `usuario.id_central` + RLS»), por lo que **no hay requisito que lo cubra**: es un vacío doble (requisito y caso de uso).

**Impacto.** El criterio de cierre de D-95 («aislamiento por central con dos centrales en verde») puede pasar en verde y, aun así, **perder la asignación de sectores de la otra central** en producción. Es una pérdida de datos operativa (el reparto de sectores del día), no un defecto cosmético.

**Corrección concreta.** Añadir a CU-D95-22 un flujo alternativo y un escenario propios, y trazar H-13 a RT-APK-02:
```gherkin
Dado un entorno con dos centrales A y B y una asignación de sectores guardada para hoy en B
Cuando un Supervisor de la central A guarda la asignación de sectores de hoy
Entonces la asignación de la central B sigue existiendo sin cambios
Y el número de filas de cuadrilla_sector_dia de B es el mismo antes y después
```
y extender el paso 5 con «`PUT /api/v1/despachos/asignacion` y `services/despacho.guardar_asignacion` corrigen el `SELECT`/`DELETE` por `id_central` (H-13)».

### H-05 · ALTA — H-16: la pantalla GESTIÓN sigue anclada al criterio divergente de `id_cuadrilla`

**Evidencia.**
- CU-D95-11 paso 2 (`:836`): «La APK consulta **el mismo endpoint** de casos con el filtro de la cuadrilla 0: `GET /api/v1/casos?id_cuadrilla=<id de la cuadrilla 0>&page=1&page_size=25`; como respaldo equivalente, `GET /api/v1/casos?en_gestion_supervisor=true`». El criterio principal es, por tanto, la **cuadrilla del último despacho** (`app/api/routes_casos.py:155-177`).
- El incremento fija otro criterio y exige que la pantalla use **ese**: «la «cuadrilla 0» **no es `id_cuadrilla = 0`**: se materializa con la cuadrilla marcada `es_supervisor` y la bandeja de gestión (`en_gestion_supervisor` / estado `EN_GESTION`), como hace `app/services/despacho.py:132-145`. La pantalla GESTIÓN usa **ese mismo criterio** y ninguna lógica propia; su criterio de pertenencia es **medible**» (`incremento:238`, R5; H-16 en `:285`). El código lo confirma: `en_gestion()` es `en_gestion_supervisor or estado_actual == "EN_GESTION"` y `cuadrilla_supervisor()` es la cuadrilla con `es_supervisor` (`app/services/despacho.py:132-145`).
- El propio documento reconoce que los dos universos **pueden divergir** y lo deja abierto: duda 2 (`:2008`) — «un caso con la marca pero sin despacho de cuadrilla 0 no aparece por `id_cuadrilla`, porque el filtro usa el **último despacho**».
- Los criterios que dependen de esta decisión quedan indeterminados: «la tabla muestra **exactamente 8 renglones**» (`:857`) y «60 casos en la bandeja → 25 renglones y total 60» (`:877-880`).

**Impacto.** La prueba de la pantalla GESTIÓN —requisito RF-APK-17 y riesgo R5 declarado— no define su universo de datos; dos implementaciones distintas pasan o fallan la misma prueba. Además CU-D95-10/A4 exige que al asignar a la cuadrilla 0 el servidor marque `en_gestion_supervisor = true` (`:778`), con lo que la fuente de verdad declarada en ese punto es la marca, no el despacho.

**Corrección concreta.** Resolver la duda 2 **antes** de la Fase 3 y reflejar la decisión en el flujo: si se adopta H-16/R5, reescribir el paso 2 de CU-D95-11 como «la APK consulta `GET /api/v1/casos?en_gestion_supervisor=true` y resuelve el `id` de la cuadrilla 0 solo para mostrar su código/columna» y fijar los Gherkin con la marca:
```gherkin
Dado un Supervisor de una central con 8 casos en gestión del supervisor, de los cuales 2 no están en ningún despacho de cuadrilla 0
Cuando abre la pantalla GESTIÓN
Entonces la tabla muestra exactamente 8 renglones
Y los 2 casos sin despacho también aparecen
```

### H-06 · ALTA — H-18: las 5 vistas de MONITOREO se presentan como existentes y «Casos especiales» se mapea a una métrica de reparación

**Evidencia.**
- CU-D95-04 encadena las 5 vistas a endpoints vigentes sin marca «NUEVO»: paso 4 «Mensual → `GET /monitoreo/globales?desde=<día 1>&hasta=<hoy>`»; paso 5 «Casos especiales → `GET /monitoreo/reparacion` + `GET /casos-especiales`»; paso 6 «Construcciones → `GET /monitoreo/construccion`» (`casos_uso_D95.md:319-321`); y el EARS declara «exactamente **5** vistas» como si fueran una capacidad disponible (`:365`).
- Verificado en el código: `/monitoreo/globales` **existe** y por defecto va del día 1 a hoy (`app/api/routes_monitoreo.py:82-94`); `/monitoreo/construccion` **existe** (`:108`); `/monitoreo/reparacion` **existe** pero es «**Pendientes de reparación por tipo**» (`:97`), **no** un monitoreo de casos especiales. No hay ningún endpoint de monitoreo de casos especiales.
- El incremento ordena lo contrario: H-18 «Las «5 vistas» de MONITOREO **no existen** … hay que **construir** el monitoreo mensual, de especiales y de construcciones (API + pantallas)» (`incremento:279`), con el riesgo R6 asociado (`incremento:239`), y el ciclo D-96 lo incluye como entregable (`incremento:199`).
- El criterio de la vista Mensual hereda la ambigüedad: «Entonces la pantalla muestra los indicadores de la central de su usuario / Y la petición enviada es `GET /api/v1/monitoreo/globales?desde=<día 1>&hasta=<hoy>`» (`:349-355`) describe el informe pendientes/resueltos, no una vista mensual de gestión.

**Impacto.** El implementador daría por hecha una capacidad que —al menos en la vista «Casos especiales»— hay que construir, y el criterio de aceptación de Mensual/Especiales no prueba lo que RF-APK-13/18 exigen. El desvío arrastra al dimensionamiento de D-96/D-97 (R6).

**Corrección concreta.** Marcar explícitamente en CU-D95-04, con la marca «**NUEVO — no existe en el backend vigente**», la vista **Casos especiales** (y declarar el endpoint a construir, p. ej. `GET /monitoreo/especiales?desde=&hasta=`), y precisar para **Mensual** qué indicadores propios la distinguen de `/monitoreo/globales`; añadir el escenario de la vista nueva:
```gherkin
Dado un Supervisor en MONITOREO
Cuando selecciona la vista "Casos especiales"
Entonces la petición enviada es GET /api/v1/monitoreo/especiales?desde=<día 1>&hasta=<hoy>
Y la pantalla muestra el conteo de casos especiales por clasificación, no el de pendientes de reparación
```
(Nota honesta: la parte de H-18 que afirma que tampoco existen «mensual» ni «construcciones» **no** se sostiene contra el código —ver anexo C—; el hallazgo se limita a la falta de marca para lo que sí hay que construir y al mapeo semánticamente incorrecto de «Casos especiales».)

### H-07 · ALTA — DEC-G12: CU-D95-09 ofrece el imprimible del despacho que el propio documento excluye

**Evidencia.**
- Cabecera, exclusión expresa de DEC-G12: «**Fuera del alcance de este incremento** … No se construyen en la APK de gestión: seguimiento … configuración … ingesta … **imprimibles del despacho** (`GET /despachos/{id}/imprimible`, `routes_despachos.py:441`)» — `casos_uso_D95.md:23-29`.
- CU-D95-09 paso 7 (`:708`): «El usuario **puede imprimir la ficha** con `GET /despachos/{id}/imprimible` o enviarla con `POST /despachos/{id}/enviar?canal=TELEGRAM|CORREO`». El endpoint existe (`app/api/routes_despachos.py:441`).
- El mismo CU vuelve a citar el imprimible en la nota de marcas? No: la exclusión solo está en la cabecera y en la Nota de cambios (`:2038`).

**Impacto.** Un lector de la Fase 3 encuentra dos instrucciones opuestas para la misma pantalla; si se implementa el paso 7 se construye una capacidad excluida por decisión (y no cubierta por RF-APK-15, que no incluye imprimibles); si se ignora, el paso 7 es un requisito fantasma.

**Corrección concreta.** Eliminar del paso 7 la parte del imprimible (dejar solo el envío por mensajería, que sí pertenece a DESPACHO) o convertirla en «**Fuera de alcance (DEC-G12)**: la APK **no** ofrece el imprimible del despacho; el envío si está en alcance». Añadir el escenario negativo:
```gherkin
Dado un Supervisor en la pestaña Proceso de DESPACHO
Cuando revisa las acciones disponibles de un despacho del día
Entonces no aparece ninguna acción "Imprimir"
Y no existe ninguna pantalla de la APK que invoque GET /despachos/{id}/imprimible
```

---

## 5. Cobertura verificada

### 5.1 Requisito → caso de uso (18 RF-APK nuevos, 6 RNF-APK, 5 RT-APK)

| Requisito | Casos declarados | ¿Verificado? |
|---|---|---|
| RF-APK-13 Monitoreo 5 vistas | CU-D95-04 | ✅ (con H-06 sobre las vistas nuevas) |
| RF-APK-14 Especiales SUP/ADM | CU-D95-07 | ✅ |
| RF-APK-15 Despacho | CU-D95-09 | ✅ (con H-07 sobre el imprimible) |
| RF-APK-16 Casos: ver y asignar | CU-D95-10 | ✅ |
| RF-APK-17 Pantalla GESTIÓN | CU-D95-10, CU-D95-11 | ✅ (con H-05) |
| RF-APK-18 Monitoreo Coordinador | CU-D95-04, CU-D95-08, CU-D95-17 | ✅ (con H-06) |
| RF-APK-19 Crear especiales | CU-D95-08, CU-D95-17 | ✅ |
| RF-APK-20 Fallas masivas lectura | CU-D95-15, CU-D95-17 | ✅ |
| RF-APK-21 Orden de material | CU-D95-16, CU-D95-17 | ✅ (con H-01/RNF-44 por la auditoría) |
| RF-APK-22 Mensaje al Supervisor | CU-D95-13, CU-D95-17, CU-D95-20 | ✅ |
| RF-APK-23 Alertas del Coordinador | CU-D95-14, CU-D95-17 | ✅ |
| RF-APK-24 Bandeja del Supervisor | CU-D95-12, CU-D95-20 | ✅ |
| RF-APK-25 Alertas SUP/ADM | CU-D95-14 | ✅ |
| RF-APK-26 WEB del Coordinador | CU-D95-17 | ✅ |
| RF-APK-27 Navegación por rol | CU-D95-01, CU-D95-03, CU-D95-18, CU-D95-21 | ✅ |
| RF-APK-28 Indicador y refresco manual | CU-D95-05 | ✅ |
| **RF-APK-29 Alta manual de un caso** | **CU-D95-23**, CU-D95-21 | ✅ **verificado** (el caso existe y su evidencia al código es correcta) |
| **RF-APK-30 Edición ligera de un caso** | **CU-D95-24**, CU-D95-21 | ✅ **verificado** (3 campos; `FichaCaso.tsx:445,449` `maxLength={200}` confirmado) |
| RNF-APK-01 Refresco 5 min | CU-D95-04/05/06/07/11/14 | ✅ |
| RNF-APK-02 Caché y escritura online | 13 casos | ✅ (con H-02 y H-09) |
| RNF-APK-03 Coexistencia con D-84 | CU-D95-18, CU-D95-21 | ✅ |
| RNF-APK-04 MFA obligatorio | CU-D95-01, CU-D95-02, CU-D95-19 | ✅ **declarado incumplido por decisión expresa (RA-01)**; ningún Gherkin lo exige |
| RNF-APK-05 Accesibilidad | CU-D95-03, CU-D95-21 | ✅ (con H-14 sobre el conjunto de pantallas) |
| RNF-APK-06 Rendimiento y prueba de carga | CU-D95-04/05/14/21/22 | ⚠️ matriz sí; **CU-D95-14 no lo menciona en ficha ni en cuerpo** (H-10) |
| RT-APK-01 Alta del rol COORDINADOR | CU-D95-01, CU-D95-02, CU-D95-19 | ✅ |
| **RT-APK-02 Acotado por central** | **CU-D95-22** (+ transversal) | ✅ **ya no es huérfano**: cubierto por CU-D95-22, con actor propio y batería A→B (con H-03 y H-04) |
| RT-APK-03 Mensajería por destinatario usuario | CU-D95-12, CU-D95-13, CU-D95-20 | ✅ |
| RT-APK-04 APK multi-rol | CU-D95-21 | ✅ |
| RT-APK-05 Acotar `require_roles` | CU-D95-14, CU-D95-16, CU-D95-18, CU-D95-19 | ✅ |

### 5.2 Requisitos **huérfanos reales**

Los **12 RNF del catálogo incorporados en la v0.3.2** no figuran en ningún caso de uso, ni en las matrices, ni como EARS ni como criterio:

| Requisito | Ciclo declarado (§4.6) | Situación en los casos de uso |
|---|---|---|
| RNF-34 Rendimiento y capacidad | D-96/97/98 | ❌ 0 menciones (solo se cubre el equivalente RNF-APK-06) |
| RNF-35 Presupuesto de carga del refresco | D-96 | ❌ 0 menciones (CU-D95-05 usa «12 peticiones/hora» sin trazarlo) |
| RNF-36 Privacidad y enmascaramiento por rol | D-96 | ❌ 0 menciones (CU-D95-06 enmascara, sin trazarlo ni incluir la prueba negativa) |
| RNF-37 PII en dispositivo móvil | D-96 | ❌ 0 menciones y **contradicho** por CU-D95-06 (H-02) |
| **RNF-38 Retención de los datos nuevos** | **D-95** | ❌ 0 menciones; solo duda 6 |
| RNF-39 Mantenibilidad de dos arquitecturas de datos | D-96 | ❌ 0 menciones; parcialmente duda 3 |
| RNF-40 Portabilidad | D-97 | ❌ 0 menciones |
| **RNF-41 Observabilidad de las acciones de gestión** | **D-95/D-98** | ❌ 0 menciones |
| **RNF-42 Backup y recuperación de los datos nuevos** | **D-95** | ❌ 0 menciones; parcialmente CU-D95-19/A4 (rollback sin RPO/RTO) |
| RNF-43 Usabilidad medible | D-97/98 | ❌ 0 menciones |
| **RNF-44 Auditoría de las escrituras nuevas** | **D-95** | ❌ 0 menciones para sus tres acciones (alta de especial, orden de material, asignar/quitar) |
| RNF-45 Compatibilidad de versiones del APK | D-98 | ❌ 0 menciones; parcialmente CU-D95-21/A4 y duda 7 |

**Otros huérfanos: ninguno.** Verificados uno por uno: los **18 RF-APK (13…30)**, los **6 RNF-APK (01…06)** y los **5 RT-APK (01…05)** aparecen al menos en un caso de uso y en la matriz. RT-APK-02 (el huérfano declarado en la v0.1) quedó cubierto por CU-D95-22. No hay casos de uso sin requisito: los 24 tienen el campo «Requisitos» poblado.

### 5.3 Verificado sin hallazgos (delinea el alcance de esta auditoría)

- **Citas al código**: se contrastaron línea a línea y son correctas, entre otras, `routes_monitoreo.py:22,41-50,56,145,156` · `routes_alertas.py:43,50,82-109,112-143,153,203-210,220,267,301,311,320-326,330,336,355,372-376` · `routes_casos.py:51,155-177,180,193,203,204,278,365,378-385,389-404,410-435,444,450,503-506,514-515,793` · `routes_especiales.py:73-80,91-95,128,189,196-200,203-207,224-227,242,388-474,486-552` · `routes_despachos.py:179,192,209,227-231,272,388,400-401,419,441,576` · `routes_mensajes.py:3,29,32,53,61,71` · `routes_auth.py:48-58,68-69,89,100-128,356,365,375,384` · `routes_config.py:349-383,389-398` · `deps.py:20,22-26,47-48,52-71,65` · `core/config.py:31` · `schemas/config.py:132` · `schemas/casos.py:148-172,156` · `entities.py:76,80` · `mensaje_entities.py:28,48,59-61,66,67-72,81-86` · `mensajes.py:55-83,107-119,130-157` · `consultas.py:20-29` · `despacho.py:132-145,225-230,272` · `schema.sql:767-769,774-785,872-877,978,989-993` · `sesion.dart:27-29` · `main.dart:111-120` · `database.dart:37-46,214-247` · `auth_storage.dart:55-58` · `mensajes_provider.dart:22,50` · `download_service.dart:26-33,59` · `sync_provider.dart:233` · `routes_sync.py:62,154` · `pubspec.yaml:4,5` · `RutaGestion.tsx:13` · `AuthContext.tsx:82` · `FichaCaso.tsx:445,449`.
- **`SET LOCAL app.id_central`**: **0** coincidencias en `app/**/*.py` (confirmado); la RLS es inerte por la cláusula `app_central_actual() IS NULL` (`schema.sql:767-769,782-785`) y `resolver_central` acepta el `id_central` del cliente sin compararlo (`consultas.py:20-29`). La tabla de «estado real verificado» de CU-D95-22 (`:1640-1649`) es **exacta**.
- **Ausencia de endpoint `GET /auditoria`**: confirmada (0 coincidencias); la marca «NUEVO» de la vista de auditoría del SUPER (DEC-G17) es correcta.
- **MFA**: **ningún** criterio de aceptación del documento exige segundo factor; las 18 menciones son negativas o de alcance (DEC-G14/RA-01 correctamente aplicada).
- **DEC-G19**: ningún criterio promete cifrado, TTL, `FLAG_SECURE` ni PIN/biometría; CU-D95-06 los **niega** expresamente.
- **DEC-G11**: el `403` al Coordinador en `POST /fallas-masivas/reporte-campo` se exige por API en CU-D95-14 (A5 + EARS), CU-D95-17 y CU-D95-19, no solo ocultando el botón; el endpoint hoy solo pide autenticación (`routes_alertas.py:203-210`), tal como el CU denuncia.
- **DEC-G15**: CU-D95-20 elimina el **fallback** de `resolver_destinatarios` (rama explícita `SUPERVISOR` + `raise/422`), que hoy cae en el fan-out a `TODOS` (`services/mensajes.py:72-83`).
- **DEC-G16**: CU-D95-19 exige cuenta de gestión con `id_tecnico` NULL, sin fila en `tecnico` y fuera de cuadrillas/flota/despacho; coincide con el modelo (`entities.py:80`) y con el único camino actual (`routes_config.py:349-383`).
- **DEC-G8/G13**: el Coordinador lee todo y **solo** escribe la orden de material; los Gherkin prueban `403` en declarar, detectar, planificar y procesar el outbox (`:1213-1225`).
- **DEC-G7**: la pantalla GESTIÓN es de SUP/ADM con acciones y el Coordinador no la ve (CU-D95-03, CU-D95-10, CU-D95-11).
- **H-09/H-10**: CU-D95-19 paso 5 y CU-D95-20 paso 5 ordenan **separar** las dependencias por capacidad en lugar de ampliar `_escritura` (`routes_alertas.py:43`) y `_envio` (`routes_mensajes.py:29`).
- **Estructura de los 24 CU**: los 24 tienen actor, objetivo, precondición, postcondición, requisitos, flujo principal, flujos alternativos, criterios Gherkin y restricciones EARS; el actor es coherente con el objetivo.
- **Gherkin**: 105 bloques, 105 `Dado`, 105 `Cuando`, 105 `Entonces` → **todos** tienen resultado observable; no hay bloques sin `Entonces`.
- **Testeabilidad léxica**: no aparecen «rápido», «adecuado», «varios», «lo antes posible» ni plazos sin unidad en los criterios.
- **Referencias cruzadas**: 24/24 IDs existen; ninguna referencia fuera de rango; el changelog y el índice son coherentes con el cuerpo (v0.2 = 24 CU, 8 ampliados ✏️ y 3 nuevos 🆕).

---

## 6. Preguntas para el usuario

### Bloque 1 — requisitos y seguridad (bloquea la Fase 3)

1. **Sincronización con el incremento v0.3.2.** ¿Se actualiza `casos_uso_D95.md` a la versión autoritativa y se añaden los 12 RNF-34…45 (con las 4 filas de D-95: RNF-38, RNF-41, RNF-42 y RNF-44) más los 10 stakeholders de §9.4, antes de abrir la Fase 3?
   - *Si no se añaden, el veredicto se mantiene: el documento no cubre el conjunto de requisitos vigente.*
2. **RNF-37 frente a DEC-G19 (purga de la caché).** ¿Se implementa el **borrado de la caché y de la cola al cerrar sesión** (y solo se difieren cifrado, TTL, `FLAG_SECURE` y PIN/biometría), como exige RNF-37 y el alcance de D-96? ¿O se modifica RNF-37 para declarar formalmente que tampoco hay purga (RA-02 ampliado)?
3. **Acceso del COORDINADOR a CASOS.** ¿El Coordinador debe recibir `403` en `GET /api/v1/casos` (matriz §5.2: CASOS «—») o se le concede lectura acotada por central (en cuyo caso hay que corregir la matriz y CU-D95-03/17/23/24)?

### Bloque 2 — alcance de los ciclos

4. **Criterio de la pantalla GESTIÓN (H-16).** ¿El universo es la **marca** `en_gestion_supervisor`/`EN_GESTION` (criterio del despacho, recomendado por R5) o la **cuadrilla 0 del último despacho** (`id_cuadrilla`)? La respuesta fija los Gherkin de CU-D95-11 y el riesgo R5.
5. **Vistas de MONITOREO (H-18/R6).** ¿Se acepta construir la vista de **casos especiales** (y las que falten) y se marcan en CU-D95-04 con «NUEVO — no existe en el backend vigente», con su endpoint y su criterio propios?
6. **H-13 y H-12 en los casos de uso.** ¿Se añaden a CU-D95-22 el escenario del borrado cruzado de `cuadrilla_sector_dia` (H-13, cierre de D-95) y a CU-D95-09 el control de concurrencia optimista del despacho (H-12, D-97), con sus criterios de aceptación?

---

## Anexo A — Índice de evidencia del informe

`casos_uso_D95.md` (todas las líneas citadas) · `incremento_D95_apk_gestion.md:3,8,77,146-165,174-175,182,198-201,238-239,279-288,297-312,314-341` · `app/api/deps.py:52-71` · `routes_auth.py:48-58,68-69,88-128,187,356,365,375,384` · `routes_monitoreo.py:22,41-50,56,82-94,97,108,145,156` · `routes_alertas.py:43,50,82-109,112-143,153,203-210,220,267,301,311,320-326,330,336,355,372-376` · `routes_casos.py:51,155-177,180,193,203-204,278,365-438,444-519,793` · `routes_especiales.py:73-80,91-95,128-186,189-239,242-249,388-474,486-552` · `routes_despachos.py:179,192,209-262,272,388-435,441,576` · `routes_mensajes.py:3,29,32,53,61,71` · `routes_config.py:300-349,349-383,389-398` · `routes_sync.py:62,154` · `app/models/entities.py:76,80` · `app/models/mensaje_entities.py:26-28,48,59-72,81-86` · `app/services/consultas.py:20-29` · `app/services/mensajes.py:55-83,107-119,130-157` · `app/services/despacho.py:132-145,225-230,272` · `app/schemas/casos.py:148-172` · `app/schemas/config.py:132` · `app/core/config.py:31` · `app/web/src/components/RutaGestion.tsx:13` · `app/web/src/auth/AuthContext.tsx:82` · `app/web/src/components/FichaCaso.tsx:445,449` · `app_movil/lib/core/{sesion.dart:27-29,auth_storage.dart:55-58,database.dart:37-46,214-247}` · `app_movil/lib/main.dart:111-120` · `app_movil/lib/features/{sync/download_service.dart:26-33,59,sync/sync_provider.dart:233,mensajes/mensajes_provider.dart:22,50}` · `app_movil/pubspec.yaml:4-5` · `RepoTecnico/db/schema.sql:767-769,774-785,872-877,978,989-993` · `RepoTecnico/auditoria_D89_casos_uso.md` (estilo) · `RepoTecnico/INFORME_OPTIMIZACION_D95_V1.md` (referencia).

## Anexo B — Trazabilidad de las 19 decisiones (verificación rápida)

| Decisión | Aplicación en los CU | Veredicto |
|---|---|---|
| DEC-G1 rol COORDINADOR | CU-D95-01/08/13/14/17/19 | ✅ |
| DEC-G2 una APK multi-rol | CU-D95-01/03/18/21 | ✅ |
| DEC-G3 ADMIN = SUPERVISOR | CU-D95-03/04/07/09/10/11/14 | ✅ |
| DEC-G4 online con caché | 10 casos | ✅ |
| DEC-G5 refresco 5 min | CU-D95-04/05/18 | ✅ |
| DEC-G6 una central por usuario | CU-D95-01/04/07/08/13/15/22/23/24 | ✅ (con H-03) |
| DEC-G7 GESTIÓN sin Coordinador | CU-D95-03/10/11 | ✅ |
| DEC-G8 alcance del Coordinador en fallas | CU-D95-08/14/15/16/17/19 | ✅ |
| DEC-G9 mensajería de una vía | CU-D95-12/13/17/20 | ✅ |
| DEC-G10 → reescrita por DEC-G14 | CU-D95-02 | ✅ |
| DEC-G11 reporte de campo excluye al Coordinador | CU-D95-14/18/19 | ✅ (con `403` por API, no solo ocultar) |
| DEC-G12 alta manual y edición ligera | CU-D95-23/24 (+21) | ⚠️ con H-07 (imprimible) |
| DEC-G13 monitorear sin actuar | CU-D95-14/15/16/17 | ✅ |
| DEC-G14 MFA diferido · RA-01 | CU-D95-02/19 | ✅ (0 criterios lo exigen) |
| DEC-G15 mensajería por destinatario usuario | CU-D95-12/13/17/20 | ✅ (fallback eliminado) |
| DEC-G16 cuenta sin `tecnico` | CU-D95-03/19 | ✅ |
| DEC-G17 gobierno del rol | CU-D95-03/19/21 | ⚠️ con H-18 (contrato de la vista de auditoría) |
| DEC-G18 rendimiento y prueba de carga | CU-D95-04/05/21/22 | ✅ (con H-10 en CU-D95-14) |
| DEC-G19 solo enmascaramiento visual · RA-02 | CU-D95-06 | ⚠️ con H-02 (RNF-37) y H-15 (máscara) |

## Anexo C — Hallazgos descartados (y por qué)

| # | Candidato | Motivo del descarte |
|---|---|---|
| D-1 | «H-18 afirma que no existen las vistas mensual ni de construcciones» | **No verificado**: `/monitoreo/globales` (`routes_monitoreo.py:82-94`, por defecto día 1 → hoy) y `/monitoreo/construccion` (`:108`) **sí existen**. H-06 conserva solo lo probado: la falta de marca «NUEVO» y el mapeo de «Casos especiales» a `/monitoreo/reparacion`. |
| D-2 | «RT-APK-02 sigue huérfano» | **Falso**: CU-D95-22 lo declara en su ficha (`:1636`) y en la matriz (`:1901`, `:1934`). |
| D-3 | «Algún criterio exige MFA» | **Falso**: 18 menciones, todas negativas o de alcance; ningún `Entonces` pide segundo factor. |
| D-4 | «CU-D95-06 promete cifrado/TTL/`FLAG_SECURE`/PIN» | **Falso**: el EARS de RA-02 los prohíbe expresamente (`:552`). |
| D-5 | «El caso permite que el Coordinador reporte fallas de campo solo ocultando el botón» | **Falso**: CU-D95-14/A5+EARS, CU-D95-17 y CU-D95-19 exigen `403` por API. |
| D-6 | «`resolver_destinatarios` conserva el fallback a `TODOS`» | **Falso**: CU-D95-20 paso 4 y A6 exigen rama explícita y `422`, y la matriz lo traza. |
| D-7 | «La pantalla GESTIÓN usa literalmente `id_cuadrilla = 0`» | **No probado**: CU-D95-11 resuelve el id de la cuadrilla 0 desde `/despachos/proceso` y nunca lo teclea el usuario (`:838`). H-05 se limita a la divergencia de criterio declarada en la duda 2. |
| D-8 | «El documento promete 72 bloques Gherkin y hay 105» | **Descartado**: «72+» es un umbral del encargo, no una afirmación del documento; los 105 bloques tienen `Entonces` (105/105/105). |
| D-9 | «CU-D95-24 permite editar más de tres campos» | **Falso**: RF-APK-30 y el caso limitan a `id_sector`, `fecha_cita` e `informacion`; A1 declara explícitamente que es una restricción de la APK. |
| D-10 | «CU-D95-08/CU-D95-16 conceden al Coordinador escrituras de más» | **Falso**: se limitan al alta de especiales y a la orden de material (DEC-G8/G13). |
| D-11 | «Hay IDs de caso citados que no existen» | **Falso**: 24/24 existen; 0 referencias fuera de rango en 334 menciones. |
| D-12 | «Hay casos inventados sin requisito» | **Falso**: los 24 tienen el campo «Requisitos» poblado y trazado. |
| D-13 | «CU-D95-03/A3 (el SUPER ve todo) contradice la matriz» | **Descartado como hallazgo propio**: está declarado en la duda 5 (`:2011`); se recoge como H-19 (BAJA) por condicionar un criterio de cierre. |
| D-14 | «CU-D95-19 no declara el incumplimiento de RNF-22» | **No sostenido**: el incumplimiento de RNF-22 se declara en la tabla de requisitos sin cumplimiento (`:1992`), aunque no en la ficha del caso; insuficiente para un hallazgo. |
| D-15 | «El conteo “6 secciones” del Coordinador no cuadra con las 8 de SUP/ADM» | **No es defecto**: son menús distintos por rol, coherentes entre CU-D95-01, CU-D95-03 y la matriz. |

---

## Historial de versiones

| Versión | Fecha | Cambio |
|---|---|---|
| v1.0 | 2026-10-10 | Auditoría adversarial de `casos_uso/casos_uso_D95.md` **v0.2** contra el incremento **v0.3.2** y el código vigente: **19 hallazgos** (1 CRÍTICA, 6 ALTAS, 10 MEDIAS, 2 BAJAS), **12 huérfanos reales** (RNF-34…RNF-45), verificación de las 19 decisiones, las 60+ citas al código y los 105 bloques Gherkin, y **15 hallazgos descartados**. Veredicto: **NO APTOS**. |
