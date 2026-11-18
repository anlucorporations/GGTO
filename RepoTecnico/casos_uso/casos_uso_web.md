# Casos de Uso — Aplicación Web GGTO (API `app/` + panel)

> Catálogo completo por dominio, generado desde el inventario de los 17 routers de `app/api`
> y `requerimientos.md`. Roles: ver matriz del [README](README.md).
> Gherkin para comportamientos; EARS para restricciones. Trazabilidad con identificadores reales.

---

## G1 · Autenticación y sesión — `routes_auth.py` (RF-20, RNF-01, RNF-22, RNF-21)

### CU-W-01 — Iniciar sesión
**Actor:** cualquier usuario con cuenta (ACT-01/02/04/07) · **Ruta:** `POST /api/v1/auth/login`
**Precondición:** cuenta activa, no bloqueada.
**Flujo:** `P00` + clave → JWT + sesión; el token acota el alcance a `id_central` (RLS, D-95); SUPER ve todas las centrales.
**Alternativos:** clave errática ×3 → bloqueo (CU-W-03 desbloqueo); cuenta inactiva/bloqueada → rechazo con motivo.
**Gherkin:**
```gherkin
Dado un usuario SUPERVISOR de la central 2324X con clave válida
Cuando inicia sesión
Entonces recibe un token y sus consultas quedan acotadas a la central 2324X.

Dado un usuario que ya registró 3 intentos fallidos
Cuando intenta iniciar sesión con la clave correcta
Entonces el acceso es rechazado por bloqueo y se exige desbloqueo con palabras.
```
**EARS:** Si la cuenta está bloqueada o inactiva, entonces el sistema negará el token.
**Trazabilidad:** RF-20, RNF-01, RNF-22, RNF-21, D-95.

### CU-W-02 — Activación en primer acceso / `setup` inicial
**Actor:** ACT-01/04 · `GET /primer-acceso`, `POST /setup` (sin guarda de rol: lo ejecuta el usuario nuevo en su primer acceso, D-67; el primer Super Usuario se crea con el procedimiento de instalación)
**Flujo:** primer acceso → activación con las palabras de seguridad; `setup` crea/ajusta el Super Usuario inicial.
**Gherkin:**
```gherkin
Dado una cuenta nueva sin clave definitiva
Cuando completa el primer acceso con sus palabras de seguridad
Entonces la cuenta queda activa y puede iniciar sesión con su clave.
```
**Trazabilidad:** RF-20, RNF-22.

### CU-W-03 — Desbloquear cuenta con palabras de seguridad
**Actor:** usuario bloqueado · `POST /unlock`
**Flujo:** demuestra **3 de las 12 palabras** → cuenta desbloqueada y marca para cambiar clave.
**Gherkin:**
```gherkin
Dado una cuenta bloqueada por 3 intentos fallidos
Cuando el usuario indica correctamente 3 de sus 12 palabras
Entonces la cuenta se desbloquea y se exige un cambio de clave en el siguiente acceso.
```
**EARS:** Si las 3 palabras indicadas no corresponden, entonces la cuenta seguirá bloqueada y el intento quedará registrado.
**Trazabilidad:** RF-20, RNF-01, RNF-22.

### CU-W-04 — Regenerar palabras de seguridad
**Actor:** ACT-04 SUPER · `POST /palabras/{p00}/regenerar` (solo SUPER)
**Gherkin:**
```gherkin
Dado un SUPER autenticado
Cuando regenera las palabras del p00 TECG001
Entonces el usuario recibe 12 palabras nuevas y las anteriores dejan de ser válidas.
```
**Trazabilidad:** RF-02, RNF-22.

### CU-W-05 — Restablecer contraseña de un usuario
**Actor:** ACT-04 SUPER · `POST /reset-password`
**Gherkin:**
```gherkin
Dado un usuario cuya clave se perdió
Cuando el SUPER ejecuta el restablecimiento
Entonces el usuario obtiene una clave temporal y debe cambiarla en el próximo acceso.
```
**Trazabilidad:** RF-02, RNF-22.

### CU-W-06 — Cambiar mi clave / editar mi perfil
**Actor:** cualquier usuario · `POST /cambio-clave`, `PATCH /me`
**Gherkin:**
```gherkin
Dado un usuario autenticado
Cuando cambia su clave cumpliendo la política de complejidad
Entonces la nueva clave pasa a ser la única válida y el cambio queda registrado.
```
**Trazabilidad:** RF-20, RNF-22.

### CU-W-07 — Consultar mi seguridad / mostrar palabras
**Actor:** cualquier usuario · `GET /mi-seguridad`, `POST /palabras/mostrar`
**Flujo:** estado de seguridad propio (bloqueos, última regeneración); mostrar palabras con confirmación.
**Gherkin:**
```gherkin
Dado un usuario autenticado
Cuando consulta GET /mi-seguridad
Entonces ve su estado de seguridad (bloqueos, ultima regeneracion de palabras)
Y al pedir mostrar palabras, estas se revelan solo tras la confirmacion del usuario.
```

**Trazabilidad:** RF-20, RNF-22.

---

## G2 · Ingesta y sincronización web — `routes_ingesta.py`, `routes_sincronizacion.py` (RF-01, RF-21, RF-22, RF-23, RF-29, RNF-08)

### CU-W-08 — Cargar y previsualizar el archivo diario de averías
**Actor:** ACT-01 (`_escritura`) · `POST /api/v1/ingesta/preview` (+ confirmación de lote)
**Precondición:** CSV `detalle_averias_gpon_<fecha>.csv` del día disponible.
**Flujo:** cargar archivo → previsualización con nuevos/duplicados/excluidos → confirmar → inserción idempotente por `id_averia` (deduplicación RF-22), parser de 80/81 columnas (D-164), solo casos de la central (RF-21).
**Alternativos:** archivo con columnas inesperadas → rechazo o exclusión de filas con reporte; carga repetida del mismo archivo → 0 duplicados (idempotencia).
**Gherkin:**
```gherkin
Dado un CSV válido con 5 filas de la central 2324X y 2 id_averia ya existentes
Cuando el Supervisor carga y confirma la ingesta
Entonces se insertan 3 casos nuevos y 0 duplicados
Y el lote queda registrado con la cronología y el conteo por categoría (RF-29).

Dado que el mismo CSV se vuelve a cargar
Cuando se confirma
Entonces la ingesta reporta 0 casos nuevos (idempotente por id_averia, deduplicación RF-22).
```
**EARS:** De acuerdo con RNF-08 (D-33), la ingesta de hasta 20 000 filas deberá completarse en ≤ 5 minutos (p95).
**Trazabilidad:** RF-01, RF-21, RF-22, RF-29, RNF-08, RNF-15, D-164, RT-05. *(Nota: D-121 es la idempotencia de la CARGA de la APK, no de la ingesta web.)*

### CU-W-09 — Consultar lotes y cronología de ingesta
**Actor:** ACT-01 · `GET /lotes`, `GET /lotes/{id_lote}`
**Flujo:** listado de lotes con fecha, totales y detalle por carga; trazabilidad del origen.
**Gherkin:**
```gherkin
Dado 3 lotes de ingesta del dia
Cuando el Supervisor consulta GET /lotes
Entonces ve los 3 lotes con fecha y totales
Y el detalle de cada lote (GET /lotes/{id}) coincide con su cronologia registrada.
```

**Trazabilidad:** RF-29, RNF-12, RNF-19.

### CU-W-10 — Sectorizar direcciones pendientes
**Actor:** ACT-01 · `GET /direcciones-sin-sector`, `POST /sectorizar-pendientes`
**Flujo:** listar direcciones de casos activos sin sector → asignar sector (manual o regla) → casos actualizados (RF-23).
**Gherkin:**
```gherkin
Dado 4 casos activos con dirección sin sector
Cuando el Supervisor ejecuta la sectorización de pendientes
Entonces las 4 direcciones quedan asignadas a un sector
Y los casos pueden participar en la propuesta de despacho.
```
**Trazabilidad:** RF-23, RNF-10, D-27.

### CU-W-11 — Monitorear la sincronización (checklist)
**Actor:** ACT-01 · `GET /api/v1/sync/resumen|checklist|{id}`
**Flujo:** estado de ingesta/despacho/sync de campo con checklist de verificación.
**Gherkin:**
```gherkin
Dado una ingesta y un despacho del dia completados
Cuando se consulta GET /sync/resumen
Entonces el checklist refleja el estado de cada etapa (ingesta, despacho, sync de campo)
Y cada sync log individual es consultable por su id.
```

**Trazabilidad:** RF-26, RNF-19.

---

## G3 · Ciclo del caso — `routes_casos.py` (RF-30…RF-33, RF-36)

### CU-W-12 — Registrar caso manual
**Actor:** ACT-01 (`POST ""` → 201) · **Precondición:** sesión `_escritura`; datos mínimos RN-AL-01 (fecha, tipo, actividad, contacto, nombre, dirección, información).
**Flujo:** alta con datos sencillos → 201 con id_caso/id_averia; referidos sin `id_averia` reciben identificador `REF-…` (RF-36).
**Alternativos:** falta dato obligatorio → 422 con faltantes; referido sin id_averia → `REF-`.
**Gherkin:**
```gherkin
Dado un Supervisor con los datos mínimos de RN-AL-01
Cuando registra el caso manualmente
Entonces GGTO responde 201 con un identificador de caso y estado inicial canónico.

Dado un caso de tipo REFERIDO sin id_averia
Cuando se registra
Entonces el sistema genera el identificador REF-… y queda gestionable como REFERIDO (RF-36).
```
**Trazabilidad:** RF-32, RF-36, RN-AL-01, D-145, D-89.

### CU-W-13 — Buscar casos (universo/filtros y por identificador)
**Actor:** TECNICO+ADMIN+SUPERVISOR (`_lectura`; **COORDINADOR excluido**, DEC-G20) · `GET /buscar`
**Flujo:** por `id_averia`/teléfono (RF-30) o por filtros central/sector/estado/tipo/fechas (RF-33).
**Alternativos:** sin resultados → listado vacío con filtros aplicados; COORDINADOR → 403.
**Gherkin:**
```gherkin
Dado un caso 70123456 con teléfono 04141234567
Cuando un Supervisor busca por id_averia o por teléfono
Entonces la ficha completa se muestra en ≤ 10 s (RNF-09, D-37).

Dado un usuario COORDINADOR
Cuando intenta buscar casos en /casos
Entonces recibe 403 (exclusión DEC-G20).
```
**Trazabilidad:** RF-30, RF-33, RNF-09, RNF-21, DEC-G20.

### CU-W-14 — Ver ficha, historial y relacionados
**Actor:** `_lectura` · `GET /{id_caso}`, `GET /{id_caso}/historial`, `GET /{id_caso}/relacionados`
**Flujo:** ficha completa + bitácora de cambios (usuario/fecha, RNF-12) + casos vinculados (misma FAT/dirección).
**Gherkin:**
```gherkin
Dado un caso con 5 eventos registrados
Cuando se abre su ficha
Entonces la ficha muestra los datos completos y el historial con los 5 eventos con usuario y fecha
Y los casos relacionados (misma FAT/direccion) se listan.
```

**Trazabilidad:** RF-30, RF-33, RNF-12, H-09.

### CU-W-15 — Editar ficha del caso
**Actor:** ACT-01 (`_escritura`) · `PATCH /{id_caso}` (+ `PATCH /{id_caso}/contacto`)
**Flujo:** actualizar contacto, dirección, clasificación, campos de gestión (RF-31); cambio de clasificación marca `marcado_reclasificar` (D-89/D-90).
**Gherkin:**
```gherkin
Dado un caso con contacto desactualizado
Cuando el Supervisor actualiza el teléfono de contacto
Entonces la ficha refleja el nuevo dato y el cambio queda en el historial (RNF-12).

Dado un caso cuya clasificación se corrige
Cuando se guarda el cambio
Entonces el caso queda marcado_reclasificar según D-89/D-90.
```
**Trazabilidad:** RF-31, RNF-12, D-89, D-90, D-112.

### CU-W-16 — Cambiar el estado del caso
**Actor:** `_gestion` (D-112) · `POST /{id_caso}/estado`
**Flujo:** registrar el cambio de estado por el **camino único de estado** (D-120: desbloqueo de especiales delegado al caso) → nuevo estado + bitácora de estado.
**EARS:** Mientras el caso esté en un estado terminal (CERRADO/CANCELADO/ENRUTADO), el sistema impedirá registrar nuevos cambios de estado por el camino único (409).
**Gherkin:**
```gherkin
Dado un caso activo en cualquier estado no terminal
Cuando se registra un cambio de estado por POST /{id_caso}/estado
Entonces el estado cambia y queda en la bitácora de estado con usuario y fecha.

Dado un caso en estado CERRADO
Cuando se intenta registrar un cambio de estado
Entonces el sistema rechaza el cambio (409) y el estado se mantiene.
```
**Criterios aspiracionales (RN-EST-01, requisito nuevo aprobado — pendiente de implementación, ver [`requisitos_nuevos.md`](requisitos_nuevos.md)):**
```gherkin
Dado un caso en un estado que no permite ir a CERRADO directamente
Cuando se solicita ese cambio con la matriz RN-EST-01 vigente
Entonces el sistema responde 409 con las transiciones validas desde el estado actual.
```
**Trazabilidad:** RF-31, D-120 (camino único de estado), D-112, RNF-12. *(RN-EST-01 definirá la matriz de transiciones formales — requisito nuevo, pendiente de implementación.)*

### CU-W-17 — Agendar cita
**Actor:** `_gestion` · `POST /{id_caso}/cita`
**Flujo:** registrar/modificar fecha-hora de cita → caso queda citado; visible en agenda (CU-W-35) y en APK.
**Gherkin:**
```gherkin
Dado un caso CONTACTADO
Cuando se agenda una cita para dd/mm/aaaa hh:mm
Entonces el caso queda con cita registrada y aparece en la agenda del día.
```
**Trazabilidad:** RF-12, D-112, D-120.

### CU-W-18 — Registrar NO CONTESTA (D-88)
**Actor:** `_gestion` (incluye al TECNICO: es gestión del caso que atiende) · `POST /{id_caso}/no-contesta` · **RF-APK-12**
**Flujo (una sola transacción, D-88):** el caso pasa a **CITADO** con su bitácora de estado → se agenda la cita de **1ª visita** para el día siguiente a las 08:00 (hora enviada por la APK, que conoce la zona del dispositivo) → se registra la actividad de CONTACTO con método **COS** («informado al COS»). La APK lo encola si no hay red (CU-A-12).
**Alternativos:** caso en estado terminal (CERRADO/CANCELADO/ENRUTADO) → **409** sin cambios; método COS ausente del catálogo → 422.
**Gherkin:**
```gherkin
Dado un caso activo al que el tecnico no pudo contactar
Cuando se registra el NO CONTESTA
Entonces el caso queda CITADO
Y existe una cita de 1ra visita para el dia siguiente a las 08:00
Y la actividad de CONTACTO con metodo COS queda registrada (D-88).

Dado un caso en estado CERRADO
Cuando se intenta registrar NO CONTESTA
Entonces la respuesta es 409 y no cambia ningun dato.
```
**Trazabilidad:** RF-13, RF-APK-12, D-88, D-112.
**Criterio aspiracional (RN-NC-01, requisito nuevo aprobado — pendiente de implementación):**
```gherkin
Dado un caso con 3 registros de NO CONTESTA (N = 3, configurable)
Cuando se registra el tercero
Entonces el caso vuelve a la cola de despacho y la cita de 1ra visita se cancela.
```

### CU-W-19 — Registrar comentario / actividad
**Actor:** `_gestion` · `PATCH /{id_caso}`
**Flujo:** comentario o actividad documentada (RF-13) con historial.
**Gherkin:**
```gherkin
Dado un caso activo
Cuando se registra un comentario via PATCH /{id_caso}
Entonces el comentario queda en el historial con autor y fecha.
```

**Trazabilidad:** RF-13, RNF-12.

### CU-W-20 — Cerrar caso (resolución IVR / COS / SACAS)
**Actor:** `_gestion` · `POST /{id_caso}/cierre`
**Flujo:** registrar resolución con método/causa del catálogo → estado RESUELTO/CERRADO; cierre en cascada si pertenece a masiva (D-99). El cierre no exige evidencias por tipo (esa regla no existe en el código; la única cuantificación es el reporte de masiva con máx. 2 fotos, D-82).
**Alternativos:** caso ya cerrado → **409 `CierreInvalido`** (reactivar vía CU-W-22); método/causa inexistente en catálogo → 422.
**Gherkin:**
```gherkin
Dado un caso activo
Cuando se cierra con metodo IVR y causa valida del catalogo
Entonces el caso queda en estado cerrado con la resolucion registrada.

Dado un caso ya cerrado
Cuando se intenta cerrar de nuevo
Entonces el sistema rechaza con 409 CierreInvalido.
```
**Criterio aspiracional (RN-EV-01, requisito nuevo aprobado — pendiente de implementación, ver [`requisitos_nuevos.md`](requisitos_nuevos.md)):**
```gherkin
Dado un caso con solo 1 evidencia de POTENCIA
Cuando se intenta cerrar con IVR/COS/SACAS
Entonces el sistema rechaza el cierre indicando que faltan 2 evidencias de potencia.
```
**Trazabilidad:** RF-15, RF-33, D-99, D-128, D-154, D-112.

### CU-W-21 — Enrutar caso (a otra cola/instancia)
**Actor:** `_gestion` · `POST /{id_caso}/enrutado`
**Flujo:** derivar a instancia/cola con motivo → caso sale del flujo activo y entra a seguimiento (RF-34).
**Gherkin:**
```gherkin
Dado un caso activo
Cuando se deriva con POST /{id_caso}/enrutado e instancia y motivo
Entonces el caso queda enrutado y aparece en el seguimiento correspondiente.
```

**Trazabilidad:** RF-34, D-112.

### CU-W-22 — Reactivar caso cerrado
**Actor:** `_escritura` · `POST /{id_caso}/reactivar`
**Flujo:** reabrir con motivo → estado activo + historial.
**Gherkin:**
```gherkin
Dado un caso cerrado
Cuando el Supervisor lo reactiva con motivo
Entonces el caso vuelve a estado activo y conserva su historial íntegro.
```
**Trazabilidad:** RF-33, RNF-12.

---

## G4 · Despachos — `routes_despachos.py` (RF-08, RF-10, RF-24, RF-25, RF-27)

### CU-W-23 — Generar propuesta de despacho
**Actor:** ACT-01 (`_escritura`) · `POST /propuesta`
**Flujo:** el sistema agrupa casos activos por sector/área y propone distribución entre cuadrillas activas del día (RF-24); **cuadrilla 0** recibe los casos por criterio combinado D-22 (RF-25: PROCEDIMIENTO 3, sin contacto, masivas…).
**Gherkin:**
```gherkin
Dado 30 casos activos sectorizados y 3 cuadrillas activas
Cuando se genera la propuesta
Entonces cada caso recibe una cuadrilla propuesta agrupada por área geográfica
Y los casos del criterio D-22 van a la cuadrilla 0 (supervisor).
```
**Trazabilidad:** RF-08, RF-24, RF-25, D-22.

### CU-W-24 — Procesar el despacho del día
**Actor:** ACT-01 · `POST /procesar`, `PUT /asignacion`
**Flujo:** convertir propuesta en despacho oficial del día; ajustes de asignación manual previos.
**Gherkin:**
```gherkin
Dado una propuesta con 30 casos distribuidos en 3 cuadrillas
Cuando se procesa el despacho
Entonces el despacho queda oficial para el dia con sus asignaciones
Y un ajuste posterior via PUT /asignacion queda registrado.
```

**Trazabilidad:** RF-08, RF-24, D-113, D-162.

### CU-W-25 — Gestionar casos de un despacho
**Actor:** ACT-01 · `POST /{id}/casos`, `DELETE /{id}/casos/{id_caso}`, `PATCH /{id}/casos/{id_caso}`
**Flujo:** añadir/quitar/mover casos entre cuadrillas del despacho del día.
**EARS:** Si un caso ya fue descargado por la cuadrilla (estado de campo), entonces el sistema impedirá su reasignación sin control de conflicto (merge «pendiente manda», D-126).
**Gherkin:**
```gherkin
Dado un despacho con 10 casos y la cuadrilla 3 con 12
Cuando se anade 1 caso a la cuadrilla 3 y se quita otro
Entonces el despacho refleja 11 casos en la cuadrilla 3
Y cada movimiento queda en el historial de los casos.
```

**Trazabilidad:** RF-08, D-123, D-126, D-162.

### CU-W-26 — Enviar despacho a la cuadrilla
**Actor:** ACT-01/ACT-04 (`_escritura` ADMIN+SUPERVISOR, `routes_despachos.py`) · `POST /{id}/enviar`
**Flujo:** enviar ficha de cuadrilla + sectores del día por Telegram/correo (RF-10) o habilitar descarga en APK. *(DEC-G9 reserva al COORDINADOR el envío de MENSAJES al Supervisor, no el envío de despachos.)*
**Gherkin:**
```gherkin
Dado un despacho procesado con 3 cuadrillas
Cuando se envía
Entonces cada cuadrilla recibe su ficha por el canal configurado (Telegram/correo)
Y los casos quedan disponibles para descarga diferencial en la APK.
```
**Trazabilidad:** RF-10, RNF-11, RT-06, D-113.

### CU-W-27 — Consultar e imprimir el despacho
**Actor:** ACT-01/ACT-07 (`_lectura_gestion`) · `GET /{id}`, `GET /{id}/imprimible`, `GET /{id}/reporte`
**Flujo:** detalle del despacho + versión imprimible tamaño carta (RT-08).
**Gherkin:**
```gherkin
Dado un despacho del dia procesado
Cuando se consulta GET /despachos/{id} (o se ajusta via PATCH /{id_despacho})
Entonces se muestra el detalle completo con sus casos y cuadrillas
Y la version imprimible (GET /imprimible) genera el documento tamano carta.
```

**Trazabilidad:** RF-08, RT-08.

### CU-W-28 — Cierre de jornada
**Actor:** ACT-01 · `POST /cierre-jornada`
**Flujo:** cierre del día: contadores, casos no atendidos y devoluciones.
**EARS:** Cuando el corte nocturno de las 23:00 (D-160) se ejecuta, el sistema devolverá a DEVUELTO (D-157) todos los casos PENDIENTES sin despachar.
**Gherkin:**
```gherkin
Dado un día cerrado con 5 casos PENDIENTE sin despachar
Cuando se ejecuta el corte nocturno (D-160, 23:00)
Entonces los 5 casos quedan en estado DEVUELTO (D-157)
Y el reporte de jornada refleja la devolución.
```
**Trazabilidad:** RF-08, RF-28, D-157, D-160.

### CU-W-29 — Reporte de producción (16:00)
**Actor:** ACT-01/ACT-05 · `GET /reporte/produccion`
**Flujo:** producción del día (atendidos, citados, referidos…) para envío por Telegram/correo (RF-27).
**Gherkin:**
```gherkin
Dado un dia con 100 casos gestionados
Cuando se consulta GET /reportes/produccion
Entonces el reporte contiene los contadores del dia (atendidos, citados, referidos, cerrados)
Y esta listo para su envio por Telegram/correo.
```

**Trazabilidad:** RF-27, RT-06.

### CU-W-30 — Consultar efectividad
**Actor:** ACT-01/ACT-07 · `GET /efectividad`
**Flujo:** efectividad por cuadrilla/técnico/día (D-146/D-147; reglas de cómputo en servidor, no visibles para manipulación en APK).
**Gherkin:**
```gherkin
Dado cierres del dia de 3 cuadrillas
Cuando se consulta GET /efectividad
Entonces se muestra la efectividad por cuadrilla/tecnico calculada en el servidor (D-146/D-147).
```

**Trazabilidad:** RF-26, RF-28, D-146, D-147.

### CU-W-31 — Seguimiento de construcciones
**Actor:** ACT-01/ACT-07 · `GET /construcciones/seguimiento`
**Flujo:** avance de casos de construcción por etapa.
**Gherkin:**
```gherkin
Dado casos de construccion en curso
Cuando se consulta GET /construcciones/seguimiento
Entonces se muestra el avance por etapa de cada construccion.
```

**Trazabilidad:** RF-06, RF-34.

---

## G5 · Casos especiales, empresas, referidos, agenda y seguimiento — `routes_especiales.py` (RF-06, RF-34, RF-35, RF-36)

### CU-W-32 — Gestionar solicitantes
**Actor:** ACT-01 (`_escritura`) · CRUD `solicitantes`
**Flujo:** alta/edición/baja de unidades solicitantes (referidos, empresas, gobiernos) con Unidad+Nombre+Contacto.
**Gherkin:**
```gherkin
Dado un solicitante nuevo (Unidad + Nombre + Contacto)
Cuando el Supervisor lo da de alta
Entonces queda disponible para las altas de casos especiales
Y su edicion/baja se refleja en los usos siguientes.
```

**Trazabilidad:** RF-06, D-156.

### CU-W-33 — Registrar y atender un caso especial
**Actor:** ACT-01 y ACT-07 alta (`_especial_alta`); **reversión solo SUPER** · `POST/GET/PATCH /casos-especiales`
**Flujo:** alta con solicitante/tipo (REFERIDO/EMPRESA/GOBIERNO) → máquina de estados D-134 → si `requiere_informe`, informe ≥ 20 caracteres (D-133) al cerrar → notificación al solicitante por outbox (D-156).
**Alternativos:** cierre sin informe requerido → rechazo 422; reversión por no-SUPER → 403.
**Gherkin:**
```gherkin
Dado un caso especial REFERIDO en trámite segun la maquina de estados D-134
Cuando se cierra y requiere_informe es verdadero
Entonces el sistema exige un informe de al menos 20 caracteres (D-133).

Dado un caso especial cerrado
Cuando un SUPERVISOR intenta revertirlo
Entonces recibe 403 (la reversion es exclusiva de SUPER).
```
**EARS:** Cuando el cierre del caso especial se completa, el sistema encolará el aviso al solicitante en el outbox (D-156); si el canal es manual, el aviso quedará pendiente de entrega por el Supervisor.
**Trazabilidad:** RF-06, RF-35, RF-36, D-133, D-134, D-156, RNF-20.

### CU-W-34 — Gestionar agenda de citas
**Actor:** ACT-01/ACT-07 · CRUD `citas`
**Flujo:** listar/reprogramar/cancelar citas del día/semana (especiales y casos).
**Gherkin:**
```gherkin
Dado 4 citas del dia
Cuando se consulta la agenda
Entonces aparecen las 4 citas ordenadas por hora
Y una reprogramacion (PATCH) o cancelacion (DELETE) se refleja en la agenda y en el caso.
```

**Trazabilidad:** RF-12, RF-35.

### CU-W-35 — Gestionar seguimiento de derivados
**Actor:** ACT-01 (`_escritura`) · CRUD `seguimiento`
**Flujo:** registrar instancia/estado/fechas de casos derivados (RF-34); consulta por caso.
**Gherkin:**
```gherkin
Dado un caso derivado a otra instancia
Cuando se consulta el seguimiento
Entonces se muestran instancia, motivo, fechas y estado del derivado.
```

**Trazabilidad:** RF-34, RF-06.

---

## G6 · Fallas masivas y alertas — `routes_alertas.py` (RF-09, RF-16, RF-17, RF-18)

### CU-W-36 — Registrar falla masiva manual
**Actor:** ACT-01 (`_falla_escritura`) · `POST /fallas-masivas`
**Precondición (D-118):** OLT + slot + puerto + FAT + dirección + **al menos 1 caso** asociado.
**Gherkin:**
```gherkin
Dado una falla en OLT/SLOT/PUERTO/FAT con 8 casos afectados
Cuando el Supervisor la registra
Entonces la masiva queda activa con los 8 casos vinculados
Y los casos muestran el indicador de masiva en web y APK.

Dado un intento de alta sin FAT o sin casos asociados
Cuando se envía
Entonces el sistema rechaza el alta exigiendo los datos de D-118.
```
**Trazabilidad:** RF-09, D-118, D-99.

### CU-W-37 — Detección automática por concentración
**Actor:** ACT-05 (y ACT-01 dispara) · `POST /fallas-masivas/detectar`
**Flujo:** tras la ingesta, análisis de concentración (D-168): agrupa por los **5 campos** OLT/SLOT/PUERTO/FAT/EXTRA y propone masiva cuando el umbral es **≥ 3 casos** por misma llave → confirmación del Supervisor.
**Gherkin:**
```gherkin
Dado una ingesta con 3 casos nuevos de la misma llave OLT/SLOT/PUERTO/FAT/EXTRA
Cuando corre la deteccion (D-168)
Entonces se propone una falla masiva con esos 3 casos como candidatos (umbral = 3).

Dado solo 2 casos de la misma llave
Cuando corre la deteccion
Entonces NO se propone ninguna masiva (bajo el umbral).
```
**Trazabilidad:** RF-09, D-168.

### CU-W-38 — Reporte de masiva desde campo
**Actor:** ACT-02 TECNICO (línea 309: TECNICO/ADMIN/SUPERVISOR) · `POST /fallas-masivas/reporte-campo`
**Flujo:** el técnico reporta la masiva con evidencia desde la APK → masiva candidata/activa.
**Gherkin:**
```gherkin
Dado 12 casos nuevos de la misma llave OLT/SLOT/PUERTO/FAT/EXTRA
Cuando ACT-05 dispara la deteccion
Entonces se propone la masiva correspondiente
Y sin confirmacion del Supervisor no se crea ninguna masiva definitiva.
```

**Trazabilidad:** RF-09, RF-16, D-82 (reporte de campo: ODN/dirección/FAT + máx. 2 fotos).

### CU-W-39 — Planificar la atención de la masiva
**Actor:** ACT-01 · `POST /fallas-masivas/{id}/planificacion`
**Flujo:** reporte de planificación + evidencias fotográficas (RF-17).
**Gherkin:**
```gherkin
Dado una masiva activa
Cuando se registra su planificacion con reporte y evidencias
Entonces la planificacion queda asociada a la masiva y visible en su reporte.
```

**Trazabilidad:** RF-17, D-118.

### CU-W-40 — Gestionar casos de la masiva
**Actor:** ACT-01 · `GET /casos-candidatos`, `POST|DELETE /{id}/casos`
**Flujo:** ver candidatos por FAT/OLT → añadir/quitar casos de la masiva.
**Gherkin:**
```gherkin
Dado una masiva con 12 candidatos
Cuando se consultan los candidatos
Entonces se listan los 12
Y al anadir/quitar casos (POST/DELETE) el vinculo se refleja en ambos sentidos.
```

**Trazabilidad:** RF-09, D-118.

### CU-W-41 — Registrar material de la masiva
**Actor:** ACT-01/ACT-07 (`_material`) · `POST /{id}/material`
**Flujo:** solicitud/preparación de material (RF-18).
**Gherkin:**
```gherkin
Dado una masiva activa
Cuando se registra material via POST /{id}/material
Entonces la solicitud queda asociada a la masiva y visible para el Supervisor.
```

**Trazabilidad:** RF-18, DEC-G (material COORDINADOR).

### CU-W-42 — Cierre en cascada de la masiva
**Actor:** ACT-01 · `POST /{id}/cierre`
**Precondición (D-99):** CRASS registrado + evidencias.
**Gherkin:**
```gherkin
Dado una masiva activa con 8 casos y CRASS + evidencias registrados
Cuando el Supervisor ejecuta el cierre
Entonces los 8 casos pasan a cerrado en cascada (D-99)
Y la masiva queda CERRADA con su reporte.
```
**EARS:** Si falta el CRASS o las evidencias mínimas, entonces el sistema impedirá el cierre en cascada.
**Trazabilidad:** RF-09, RF-15, D-99, D-118.

### CU-W-43 — Consultar masivas, ubicación y reporte
**Actor:** ACT-01/ACT-07 · `GET /fallas-masivas`, `/{id}`, `/{id}/ubicacion`, `/{id}/ordenes`, `/{id}/reporte`
**Flujo:** listado de masivas activas/históricas, ubicación (OLT/FAT), órdenes y reporte (ACT-07 consulta sin actuar).
**Rutas:** incluye tambien `PATCH /fallas-masivas/{id_falla}` (edicion) y `GET /metricas` del dominio.
**Gherkin:**
```gherkin
Dado 3 masivas activas
Cuando se consulta GET /fallas-masivas
Entonces se listan las 3 con su ubicacion (OLT/FAT), ordenes y estado
Y el reporte (GET /reporte) consolida el detalle; la edicion (PATCH) y las metricas quedan registradas.
```

**Trazabilidad:** RF-09, RF-26.

### CU-W-44 — Notificaciones y alertas
**Actor:** ACT-05/ACT-01 · `GET /notificaciones`, `POST /notificaciones/procesar`
**Flujo:** outbox de notificaciones (Telegram/correo/MCP) con reintentos (RNF-20); procesar envía pendientes.
**EARS:** Cuando un envío falla, el sistema aplicará reintentos exponenciales con estado terminal tras el máximo de reintentos configurado (RNF-20, outbox).
**Gherkin:**
```gherkin
Dado 2 notificaciones pendientes en el outbox
Cuando se ejecuta POST /notificaciones/procesar
Entonces las 2 se envian por su canal
Y las que fallan quedan en reintento con su proximo intento programado.
```

**Trazabilidad:** RF-16, RNF-20, RT-06.

### CU-W-45 — Alerta por Telegram / WEB-MCP
**Actor:** ACT-05 · `POST /telegram/webhook`, `POST /mcp`
**Flujo:** canal de alertas/mensajería automática (RF-16, RNF-11).
**Gherkin:**
```gherkin
Dado una alerta de masiva registrada
Cuando el canal Telegram/MCP recibe el evento
Entonces el destinatario configurado recibe el aviso
Y el envio queda registrado en el outbox (RNF-11).
```

**Trazabilidad:** RF-16, RNF-11, RT-06, RT-07.

---

## G7 · Monitoreo, panel y reportes — `routes_panel.py`, `routes_monitoreo.py` (RF-26, RF-28, RF-07)

### CU-W-46 — Panel de gestión diaria
**Actor:** ACT-01 (`_gestion`) · `GET /gestion-diaria`
**Flujo:** resumen del día (cola, despachos, masivas, citas) para operar.
**Gherkin:**
```gherkin
Dado un dia con casos en cola, despachos y 1 masiva activa
Cuando el Supervisor abre el panel de gestion diaria
Entonces ve el resumen consolidado del dia
Y desde el panel puede acceder a las acciones de su dominio.
```

**Trazabilidad:** RF-26, RF-30.

### CU-W-47 — Consultar tableros de monitoreo
**Actor:** ACT-01/ACT-07 · `GET /monitoreo/{diario|semanal|globales|reparacion|construccion|cuadrilla|capacidad|mensual|casos-especiales|construcciones|reclasificaciones|identificadores}`
**Flujo:** las 12 vistas de monitoreo con datos para gráficos (RT-10); ACT-07 tiene sus 5 vistas (DEC-G1).
**Gherkin:**
```gherkin
Dado un dia con 100 casos gestionados
Cuando el Coordinador consulta su vista de monitoreo
Entonces recibe los indicadores de su alcance sin acceso a fichas de casos (DEC-G20).
```
**Trazabilidad:** RF-26, RF-28, RF-07, RT-10, DEC-G1, DEC-G20.

### CU-W-48 — Generar reporte de trabajo
**Actor:** ACT-01 · `GET /reportes/trabajo`, `/imprimible`
**Flujo:** reporte diario/semanal/mensual (RF-28) versión imprimible.
**Gherkin:**
```gherkin
Dado un mes completo de operacion
Cuando se consulta GET /reportes/trabajo
Entonces se genera el reporte con los datos del periodo
Y su version imprimible esta disponible.
```

**Trazabilidad:** RF-28, RT-08.

---

## G8 · Mensajería interna — `routes_mensajes.py` (D-81/D-95)

### CU-W-49 — Enviar mensaje a técnico / supervisor
**Actor:** ACT-01/ACT-04 (`_envio` ADMIN+SUPERVISOR) vía `POST /mensajes` («»); el COORDINADOR usa `POST /mensajes/supervisor` (`_envio_supervisor`, destino forzado al Supervisor — DEC-G9/G15)
**Flujo:** redactar → enviar a técnico(s)/cuadrilla → aparece en bandeja de la APK (D-86) y web.
**Gherkin:**
```gherkin
Dado un Supervisor que necesita avisar a la cuadrilla 3
Cuando envía el mensaje
Entonces los integrantes lo ven en su bandeja como no leído
Y el envío queda registrado con autor y hora (RNF-12).
```
**Trazabilidad:** D-81, D-95, DEC-G9, DEC-G15.

### CU-W-50 — Consultar bandeja y marcar leído
**Actor:** cualquier usuario con bandeja · `GET /bandeja`, `GET /no-leidos`, `POST /leidos`, `POST /{id}/leido`
**Flujo:** bandeja con no leídos; lectura registra marca (en APK «leído pegajoso» D-86).
**Rutas:** incluye tambien `GET /mensajes/supervisores` (supervisores disponibles como destino).
**Gherkin:**
```gherkin
Dado 2 mensajes nuevos en la bandeja
Cuando el usuario consulta GET /bandeja
Entonces los 2 aparecen como no leidos
Y al marcarlos leidos el contador de no leidos baja a 0.
```

**Trazabilidad:** D-81, D-86.

---

## G9 · Configuración — `routes_config.py` (RF-02, RF-03, RF-04, RF-38, RNF-10)

### CU-W-51 — Configurar central y sectores
**Actor:** ACT-01/ACT-04 (`_escritura`) · CRUD `central`, `sectores`, direcciones por sector
**Flujo:** datos operativos de la central (2324X) y sectores con direcciones/alias (D-27/P1.2).
**Gherkin:**
```gherkin
Dado una nueva zona de trabajo
Cuando el Supervisor crea el sector con sus direcciones
Entonces la sectorización y la propuesta de despacho lo usan de inmediato (RNF-10: sin cambio de código).
```
**Trazabilidad:** RF-38, RNF-10, D-27, RNF-14.

### CU-W-52 — Gestionar técnicos, roles y usuarios de gestión
**Actor:** ACT-01/ACT-04 · CRUD `tecnicos`, `PATCH /{id}/rol`, `POST /usuarios-gestion`
**Flujo:** alta/edición/baja de técnicos, cambio de rol, cuentas de gestión (COORDINADOR separado de tecnico, DEC-G16; DEC-G11).
**EARS:** De acuerdo con RNF-21, el sistema validará toda acción contra la matriz rol × módulo × acción.
**Gherkin:**
```gherkin
Dado un tecnico nuevo de la central
Cuando se da de alta con rol TECNICO y se asigna a una cuadrilla
Entonces puede iniciar sesion y su alcance queda acotado a la central (RNF-21)
Y un cambio de rol via PATCH /{id}/rol se aplica en su proximo acceso.
```

**Trazabilidad:** RF-02, RNF-21, DEC-G11, DEC-G16, H-15.

### CU-W-53 — Gestionar flota
**Actor:** ACT-01/ACT-04 · CRUD `flota`
**Gherkin:**
```gherkin
Dado un vehiculo nuevo de la central
Cuando se da de alta en flota
Entonces queda disponible para las cuadrillas
Y su edicion/baja se refleja en los reportes de flota (RF-07).
```

**Trazabilidad:** RF-03 (gestión de flota), RF-19 (reporte de incidentes con flota/herramientas).

### CU-W-54 — Gestionar cuadrillas e integrantes
**Actor:** ACT-01/ACT-04 · CRUD `cuadrillas`, integrantes (asociar/quitar técnico)
**Flujo:** cuadrilla = técnicos + flota + herramientas; la APK descarga solo los casos de su cuadrilla (D-123/D-130).
**Gherkin:**
```gherkin
Dado el tecnico TECG001 recien asignado a la cuadrilla 3
Cuando la APK sincroniza
Entonces TECG001 descarga unicamente los casos de la cuadrilla 3 (D-123/D-130).
```
**Trazabilidad:** RF-04, D-123, D-130.

### CU-W-55 — Gestionar catálogos y configuración
**Actor:** ACT-01/ACT-04 · `catalogos/causas|metodos`, `configuracion` (GET/PUT por clave)
**Flujo:** causas/métodos de resolución, parámetros (frases de exclusión, umbrales) sin tocar código (RNF-10).
**Gherkin:**
```gherkin
Dado una nueva causa de resolucion
Cuando se agrega al catalogo de causas
Entonces esta disponible para los cierres sin desplegar codigo (RNF-10)
Y un cambio de configuracion via PUT /configuracion/{clave} se aplica a la operacion.
```

**Trazabilidad:** RF-33 (catálogos), RNF-10, RNF-12.

---

## G10 · Auditoría y sistemas — `routes_auditoria.py`, `routes_sistemas.py` (RNF-12, DEC-G17)

### CU-W-56 — Consultar la traza de auditoría
**Actor:** ACT-04 SUPER (exclusivo, solo lectura) · `GET /api/v1/auditoria`
**Flujo:** filtros por usuario/acción/entidad/central/fechas, paginado; incluye auditoría de acciones del COORDINADOR (DEC-G17).
**Gherkin:**
```gherkin
Dado la accion «alta de caso especial» del p00 COOR001
Cuando el SUPER consulta la auditoria con filtro usuario=COOR001
Entonces la traza muestra accion, entidad, fecha/hora y central
Y un ADMIN obtiene 403 (la auditoria es exclusiva de SUPER).
```
**Trazabilidad:** RNF-12, DEC-G17, RT-APK-06.

### CU-W-57 — Explorar estructura y datos del sistema
**Actor:** ACT-04 SUPER · `GET /estructura|tablas|tabla/{nombre}(/datos)`
**Flujo:** introspección solo-lectura del esquema y tablas.
**Gherkin:**
```gherkin
Dado el esquema de la base de datos
Cuando el SUPER consulta GET /sistemas/estructura y /tablas
Entonces recibe la lista de tablas y sus columnas
Y los datos de una tabla (GET /tabla/{nombre}/datos) son de solo lectura.
```

**Trazabilidad:** RNF-12. *(La introspección comparte la guarda exclusiva de SUPER con la auditoría.)*

---

## G11 · Mantenimiento — `routes_mantenimiento.py` (D-132, D-153, D-160)

**Guarda transversal:** token `X-Mantenimiento-Token`; **fail-closed 503** si falta o es inválido.

### CU-W-58 — Purgar datos con protección
**Actor:** ACT-05 (proceso con token) · `POST /purgar`
**EARS:** Si un caso tiene trabajo sin enviar desde campo, entonces la purga NO lo eliminará (D-132); la retención de datos aplicará según RNF-18 / D-153 / D-34. *(D-140 es otra regla: la cuadrilla de gestión no purga aunque tenga casos.)*
**Gherkin:**
```gherkin
Dado un job de purga con token valido
Cuando se ejecuta
Entonces se purgan los datos elegibles y se conservan los protegidos (D-132)
Y sin token el endpoint responde 503.
```
**Trazabilidad:** D-132, D-153, RNF-18, RNF-16.

### CU-W-59 — Cerrar sesiones activas
**Actor:** ACT-04/ACT-05 · `POST /cerrar-sesiones`
**Flujo:** invalida sesiones/JWT activos (cierre operativo o compromiso).
**Gherkin:**
```gherkin
Dado 5 sesiones JWT activas
Cuando se ejecuta POST /mantenimiento/cerrar-sesiones
Entonces las 5 sesiones quedan invalidadas
Y el siguiente request con esos tokens devuelve 401.
```

**Trazabilidad:** RNF-22, RF-20.

### CU-W-60 — Tareas programadas nocturnas
**Actor:** ACT-05 · `POST /recordatorios-citas`, `/alarmas-despacho`, `/cierre-jornada`
**Flujo:** recordatorios de citas del día siguiente, alarmas de despacho y el corte nocturno 23:00 (D-160 → DEVUELTO D-157, ver CU-W-28).
**Gherkin:**
```gherkin
Dado 3 citas para el dia siguiente y casos PENDIENTE a las 23:00
Cuando se ejecutan las tareas nocturnas
Entonces se envian los recordatorios de citas y las alarmas de despacho
Y el corte nocturno devuelve los PENDIENTE a DEVUELTO (D-157/D-160).
```

**Trazabilidad:** RF-12, RF-27, D-157, D-160, RNF-19.

---

## G12 · Asistente virtual (lado GGTO) — `routes_asistente.py`

### CU-W-61 — Gestionar sesiones del asistente
**Actor:** ACT-01 (ADMIN+SUPERVISOR, `_acceso`) · `POST/GET /api/v1/asistente/sesiones`
**Flujo:** abrir turno del asistente y consultar historial acotado a su central.
**Gherkin:**
```gherkin
Dado un turno del asistente con 3 intercambios
Cuando un SUPERVISOR consulta GET /api/v1/asistente/sesiones
Entonces ve las sesiones de su central con su historial
Y el alta de turno via POST /sesiones queda acotada a su central.
```

**Trazabilidad:** RNF-AV, RNF-21, RNF-12. Detalle: [`casos_uso_asistente.md`](casos_uso_asistente.md) CU-AV-08.

### CU-W-62 — Gestionar remitentes de Telegram
**Actor:** ACT-04 SUPER (`_solo_super`) · `POST/GET/PATCH /remitentes/{id}`
**Gherkin:**
```gherkin
Dado un SUPER autenticado
Cuando consulta GET /api/v1/asistente/remitentes
Entonces ve los remitentes registrados con su chat_id, p00 y central
Y puede editarlos o desactivarlos via PATCH.
```

**Trazabilidad:** RNF-21, H-15. Detalle: CU-AV-09.

---

## G13 · Salud del servicio — `routes_health.py` (ACT-05, RNF-17, RNF-19)

### CU-W-63 — Supervisar la salud del servicio
**Actor:** ACT-05/infraestructura · `GET /health`, `/ready`, `/api/v1/info`, `/api/v1/resumen`
**Gherkin:**
```gherkin
Dado el backend en operacion
Cuando se consulta /ready
Entonces responde 200 si DB y dependencias estan listas
Y /health expone el estado para el monitoreo de disponibilidad (RNF-17).
```
**Trazabilidad:** RNF-17, RNF-19.
