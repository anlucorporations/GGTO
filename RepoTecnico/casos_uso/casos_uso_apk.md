# Casos de Uso — APK de campo `app_movil` (Flutter `ggto_tecnico` 1.15.22+47)

> Actor principal: **ACT-02 TÉCNICO** (rol `TECNICO`). El COORDINADOR (ACT-07) usa la app en
> modo **gestión** (consulta; sus restricciones: DEC-G11/G15/G16/G20). Fuente: inventario
> completo de `app_movil/` (20+ pantallas, 6 tablas SQLite `ggto.db` v5, Dio + outbox).

## Reglas globales de la APK (EARS, transversales)

- **R-A-1 (D-100):** Mientras el dispositivo esté bloqueado por PIN, el sistema no mostrará ningún dato de clientes.
- **R-A-2 (D-117):** Cuando un TECNICO acumule 2 minutos de inactividad, el sistema bloqueará la app y exigirá el PIN.
- **R-A-3 (D-123/D-130):** La descarga incluirá únicamente los casos de la cuadrilla del técnico.
- **R-A-4 (RNF-04/D-142):** La captura de evidencias usará exclusivamente la cámara; la selección desde galería estará bloqueada.
- **R-A-5 (RF-44, propuesta APK):** En cada inicio de sesión, el sistema mostrará el aviso legal
  (disclaimer) y exigirá su aceptación antes de mostrar datos. *(Decisión del usuario, bloque 3:
  aceptación EN CADA LOGIN — prevalece sobre la persistencia sugerida por la propuesta RF-44.)*
- **R-A-6 (SyncLock D-124):** Mientras exista una sincronización en curso, el sistema impedirá iniciar otra (dueño único).
- **R-A-7 (D-138):** El dispositivo quedará vinculado a la cuenta tras el primer login autorizado.

---

## A1 · Acceso y seguridad

### CU-A-01 — Iniciar sesión con disclaimer
**Pantallas:** login → disclaimer (RF-44)
**Flujo:** `P00` + clave → **3 intentos** máximo → aceptación del aviso legal **en cada inicio de sesión** (decisión del usuario, bloque 3) → dispositivo vinculado (D-138).
**Alternativos:** 3 fallos → bloqueo de la cuenta (desbloqueo con palabras es proceso web/SUPER); sin red → se permite entrar al modo local si hay datos.
**Gherkin:**
```gherkin
Dado un tecnico con cuenta activa
Cuando inicia sesion con su clave y acepta el disclaimer
Entonces la app descarga el estado inicial y vincula el dispositivo (D-138).

Dado el tercer intento fallido de clave
Cuando se envia
Entonces la cuenta queda bloqueada y la app indica acudir al Supervisor.
```
**Trazabilidad:** RF-20, RNF-01, RNF-22, RF-44 (disclaimer), D-138.

### CU-A-02 — Configurar y usar PIN (bloqueo de app)
**D-100** · **Flujo:** definir PIN de 4-6 dígitos tras el login → app bloqueable manualmente.
**Gherkin:**
```gherkin
Dado un PIN configurado
Cuando la app se bloquea (manual o por inactividad D-117)
Entonces solo el PIN correcto vuelve a mostrar datos y 0 datos quedan visibles en pantalla.
```
**Trazabilidad:** RNF-05, D-100, D-117.

### CU-A-03 — Bloqueo por inactividad
**D-117 (solo TECNICO)** · **Gherkin:**
```gherkin
Dado una sesion TECNICO sin interaccion durante 2 minutos
Cuando transcurre el tiempo
Entonces la app se bloquea y exige el PIN (R-A-2).
```
**Restricción (EARS):** Si el rol autenticado es TECNICO, entonces el sistema bloqueará la app tras 2 minutos de inactividad; los roles de gestión (COORDINADOR/SUPERVISOR/ADMIN) no se rigen por esta regla.
**Trazabilidad:** RNF-05, D-117.

### CU-A-04 — Modo sin conexión
**D-100/D-107/D-135** · **Flujo:** sin red, la app opera con los datos locales (`caso_local`, 7 tablas); las acciones se encolan en el outbox `accion_pendiente`; al recuperar red se sincronizan (CU-A-16).
**Gherkin:**
```gherkin
Dado el tecnico sin conexion con 3 casos descargados
Cuando registra un CONTACTADO en uno de ellos
Entonces el estado se refleja localmente y la accion queda en el outbox como PENDIENTE
Y al recuperar conexion la accion se envia sin duplicar (idempotencia del servidor).
```
**Trazabilidad:** RNF-06, D-100, D-107, D-135.

---

## A2 · Sincronización

### CU-A-05 — Descarga diferencial del despacho del día
**D-105/D-119/D-127** · `GET/POST /sync/descarga`
**Flujo:** la app envía `ids_conocidos` → el servidor devuelve solo **nuevos y cambios** → merge local con «pendiente manda» (D-126) → **la descarga nunca borra casos locales** (D-119).
**Gherkin:**
```gherkin
Dado la cuadrilla 3 con 10 casos y 2 con acciones pendientes en el outbox
Cuando la app descarga diferencialmente
Entonces solo llegan los casos nuevos/cambiados (ids_conocidos, D-105/D-127)
Y los 2 casos con pendiente conservan el estado local que manda sobre el del servidor (D-126)
Y ningún caso local desaparece (D-119).
```
**Trazabilidad:** RF-11, D-105, D-119, D-126, D-127, R-A-3.

### CU-A-06 — Sincronización con dueño único (SyncLock)
**D-124** · **Gherkin:**
```gherkin
Dado una sincronizacion en curso en la app
Cuando se intenta lanzar otra
Entonces la app rechaza el segundo intento indicando que ya hay una sync activa (R-A-6).
```
**Trazabilidad:** D-124, RNF-06.

### CU-A-07 — Carga del outbox al servidor
**`POST /sync/carga`, outbox `accion_pendiente`** · **Flujo:** backoff 1, 2, 4… 60 min, **máximo 5 intentos**; **403/409/404/422 son definitivos** (no se reintenta).
**Gherkin:**
```gherkin
Dado 3 acciones pendientes con la red recuperada
Cuando corre la carga
Entonces se envian en orden y las exitosas quedan ENVIADAS.

Dado una accion que recibe 422 del servidor
Cuando se procesa el resultado
Entonces la accion queda en estado terminal ERROR sin mas reintentos (definitivo).

Dado una accion que falla por red
Cuando se reintenta
Entonces el proximo intento usa el backoff (1,2,4...60 min, maximo 5).
```
**Trazabilidad:** RNF-06, RNF-20, D-135.

### CU-A-08 — Purga protegida de datos locales
**D-132** · **Flujo:** purga de datos antiguos; **nunca** borra casos con trabajo sin enviar.
**Gherkin:**
```gherkin
Dado un caso cerrado hace 10 dias con una accion aun sin enviar
Cuando corre la purga local
Entonces el caso NO se purga (D-132) hasta que su outbox quede limpio.
```
**Trazabilidad:** D-132, RNF-06.

---

## A3 · Trabajo de campo (ciclo del caso)

### CU-A-09 — Ver bandeja y ficha del caso
**Pantallas:** bandeja del día, ficha
**Flujo:** lista de casos de su cuadrilla (R-A-3) → ficha completa (solo lectura de datos de gestión; el técnico no edita fichas). La descarga valida primero la cuadrilla del dispositivo (`GET /sync/cuadrilla`) y las evidencias ya subidas son consultables (`GET /evidencias/{id}`).
**Gherkin:**
```gherkin
Dado la bandeja de la cuadrilla 3 con 10 casos
Cuando el tecnico abre la app
Entonces ve solo los 10 casos de su cuadrilla
Y ningun caso de otra cuadrilla es visible ni descargable.
```
**Trazabilidad:** RF-11, D-123, D-130.

### CU-A-10 — Contactar / registrar CONTACTADO
**RF-12, RNF-09 (D-37): ≤ 3 toques y ≤ 20 s** · **Flujo:** CONTACTADO con hora → si el cliente no está, NO CONTESTA (CU-A-12); si sí, cita (CU-A-11) o actividad (CU-A-13).
**Gherkin:**
```gherkin
Dado un caso ASIGNADO en la bandeja
Cuando el tecnico registra CONTACTADO
Entonces el estado local pasa a CONTACTADO en ≤ 3 toques y ≤ 20 s (D-37)
Y la accion queda en el outbox.
```
**Trazabilidad:** RF-12, RF-13, RNF-09, D-37.

### CU-A-11 — Acordar cita con el cliente
**RF-12** · **Flujo:** registrar fecha/hora de encuentro → caso citado (coherente con CU-W-17).
**Gherkin:**
```gherkin
Dado un caso CONTACTADO
Cuando el tecnico registra la cita para el dia siguiente a las 10:00
Entonces el caso queda citado con esa fecha y hora
Y la accion queda en el outbox para la CARGA.
```

**Trazabilidad:** RF-12, D-112.

### CU-A-12 — Registrar NO CONTESTA (D-88)
**RF-13, RF-APK-12** · `POST /casos/{id}/no-contesta` (encolado en el outbox sin red)
**Flujo (una sola transacción, D-88):** el caso pasa a **CITADO** → se agenda la cita de **1ª visita** al día siguiente a las **08:00** (hora que envía la APK según la zona del dispositivo) → actividad de CONTACTO con método **COS** («informado al COS»).
**Alternativos:** caso CERRADO/CANCELADO/ENRUTADO → el servidor responde **409** y la acción queda en ERROR definitivo.
**Gherkin:**
```gherkin
Dado un caso activo al que el cliente no contesto
Cuando el tecnico registra NO CONTESTA (o lo encola offline)
Entonces al sincronizar el caso queda CITADO con cita de 1ra visita a las 08:00 del dia siguiente
Y la actividad CONTACTO con metodo COS queda registrada (D-88).
```
**Trazabilidad:** RF-13, RF-APK-12, D-88. *(RN-NC-01 añadirá el contador y la devolución a cola tras N intentos — requisito nuevo, pendiente de implementación.)*

### CU-A-13 — Documentar actividad / comentario
**RF-13** · **Flujo:** texto de actividad realizada (offline permitido, outbox).
**Gherkin:**
```gherkin
Dado un caso atendido
Cuando el tecnico registra el comentario de la actividad
Entonces el comentario queda local y en outbox
Y al sincronizar aparece en el historial del caso con autor y fecha.
```

**Trazabilidad:** RF-13, RNF-12.

### CU-A-14 — Capturar evidencias (solo cámara)
**RF-14, RNF-04** · **Reglas:** solo cámara (R-A-4), **máximo 5 por caso**, **3 MB por imagen**, GPS + fecha/hora (RNF-13), tipos POTENCIA|NAVEGACION|DEMO|FALLA_MASIVA; upload `POST /evidencias/upload` cuando hay red.
**Gherkin:**
```gherkin
Dado un caso con 5 evidencias registradas
Cuando el tecnico intenta capturar una sexta
Entonces la app lo impide indicando el maximo de 5 por caso.

Dado un intento de cargar una imagen de 4 MB
Cuando se adjunta
Entonces la app la rechaza por exceder 3 MB.
```
**EARS:** ver R-A-4.
**Trazabilidad:** RF-14, RNF-04, RNF-13, D-128, D-154.

### CU-A-15 — Cerrar caso con resolución (IVR/COS/SACAS)
**RF-15** · `operaciones_service.dart` (cierre con modo, descripción y evidencias, §4.2)
**Flujo:** registrar modo + descripción + evidencias adjuntas (sin cuota obligatoria por tipo) → cierre local + outbox → al sincronizar, el servidor registra la resolución canónica (si el caso ya estaba cerrado, responde **409 `CierreInvalido`** y la acción queda en ERROR definitivo).
**Gherkin:**
```gherkin
Dado un caso CONTACTADO en la bandeja
Cuando el tecnico cierra con modo IVR, descripcion y sus evidencias
Entonces el cierre queda local y en outbox
Y al sincronizar el servidor registra la resolucion canonica.

Dado un caso ya cerrado en el servidor
Cuando la accion de cierre llega en la CARGA
Entonces el servidor responde 409 CierreInvalido
Y la accion queda en estado terminal ERROR (definitivo, sin reintentos).
```
**Trazabilidad:** RF-15, RF-APK (cierre de campo), D-128.
**Criterios aspiracionales (RN-EV-01, requisito nuevo aprobado — pendiente de implementación, ver [`requisitos_nuevos.md`](requisitos_nuevos.md)):**
```gherkin
Dado un caso con solo 1 evidencia de POTENCIA
Cuando el tecnico intenta el cierre
Entonces la app bloquea el cierre indicando que faltan 2 evidencias de potencia.

Dado un caso con 2 evidencias DEMO
Cuando el tecnico intenta marcar DIFERIDO
Entonces la app bloquea indicando que faltan 3 demostrativas.
```

### CU-A-16 — Diferir caso
**D-125** · **Flujo:** DIFERIDO con motivo (y evidencias demostrativas opcionales según flujo del dispositivo); al sincronizar el servidor aplica el estado.
**Gherkin:**
```gherkin
Dado un caso sin poder resolverse en la visita
Cuando el tecnico marca DIFERIDO con motivo
Entonces el estado local queda DIFERIDO y en outbox
Y al sincronizar el servidor aplica el estado (RN-EV-01 exigira las evidencias DEMO al implementarse).
```

**Trazabilidad:** RF-15, D-125, D-128. *(RN-EV-01 aplica también aquí: 3 evidencias DEMO requeridas — pendiente de implementación.)*

### CU-A-17 — Enrutar caso
**D-112** · **Flujo:** derivar con motivo (evidencia opcional hoy); el caso sale de su bandeja al sincronizar.
**Gherkin:**
```gherkin
Dado un caso que no es de la competencia de la cuadrilla
Cuando el tecnico lo enruta con motivo
Entonces el caso queda ENRUTADO en el outbox
Y al sincronizar sale de su bandeja.
```

**Trazabilidad:** RF-34, D-112. *(RN-EV-01 exigirá 1 evidencia — pendiente de implementación.)*

### CU-A-18 — Reasignación dentro de la cuadrilla
**D-123** · **Flujo:** mover un caso a otro integrante de **su** cuadrilla (nunca fuera de ella).
**Gherkin:**
```gherkin
Dado un caso de la cuadrilla 3
Cuando el tecnico lo reasigna a otro integrante de la misma cuadrilla
Entonces la reasignacion queda en outbox y al sincronizar el servidor la aplica
Y nunca es posible reasignar a una cuadrilla distinta (D-123).
```

**Trazabilidad:** RF-08, D-123, D-130.

---

## A4 · Alertas y comunicación

### CU-A-19 — Reportar falla masiva desde campo
**RF-09, RF-16** · `POST /fallas-masivas/reporte-campo` (TECNICO permitido)
**Flujo:** reporte con evidencia tipo FALLA_MASIVA → candidata de masiva en web.
**Gherkin:**
```gherkin
Dado 5 averias de la misma FAT detectadas en calle
Cuando el tecnico reporta la falla con su evidencia
Entonces el Supervisor recibe la alerta y la masiva puede registrarse (CU-W-36/37).
```
**Trazabilidad:** RF-09, RF-16, D-82 (reporte de campo: ODN/dirección/FAT + máx. 2 fotos, `maxEvidenciasFallaMasiva = 2`).

### CU-A-20 — Mensajería interna de campo
**D-81/D-86/D-95** · `GET /sync/*` + `mensaje_local`
**Flujo:** bandeja offline del Supervisor; «leído pegajoso» (cursor `maxIdMensaje`); el técnico responde solo a su Supervisor (DEC-G15 desde campo).
**Gherkin:**
```gherkin
Dado 2 mensajes nuevos del Supervisor con la app sin red
Cuando la app recupera conexion y descarga
Entonces los mensajes aparecen como no leidos
Y al abrirlos la marca de leido es pegajosa: no se revierte en la proxima descarga (D-86).
```
**Trazabilidad:** D-81, D-86, D-95, DEC-G15.

---

## A5 · Mantenimiento de la app

### CU-A-21 — Actualización de la APK
**D-102/D-108/D-115** · **Flujo:** la app consulta la versión vigente (contrato de versión D-102) → aviso de descarga (D-108) → **actualización única forzada** cuando el servidor exige mínimo (D-115).
**Gherkin:**
```gherkin
Dado la version instalada 1.15.22 y una minima requerida mayor
Cuando la app consulta el contrato de version
Entonces se muestra el aviso de actualizacion (D-108) y el uso queda bloqueado hasta actualizar (D-115).
```
**Trazabilidad:** D-102, D-108, D-115.

### CU-A-22 — Ranking y efectividad propia
**D-109/D-146/D-147** · **Flujo:** el técnico consulta su producción/ranking; el cómputo vive en el servidor (D-146/D-147), la APK solo lo muestra.
**Gherkin:**
```gherkin
Dado cierres registrados del tecnico en el dia
Cuando consulta su produccion
Entonces ve su ranking/efectividad calculada por el servidor (D-146/D-147)
Y ningun dato de otros tecnicos queda editable desde la APK.
```

**Trazabilidad:** RF-26, D-109, D-146, D-147.

---

## B · Modo GESTIÓN — COORDINADOR (ACT-07, DEC-G16)

> Cuenta de gestión separada de `tecnico` (DEC-G16); al iniciar sesión con rol COORDINADOR la
> app muestra el menú de gestión (RF-APK-27, navegación por rol). Alcance del COORDINADOR:
> consulta de monitoreo/masivas/especiales, mensajes **solo al Supervisor** (DEC-G9/G15) y la
> **solicitud de material** como única escritura. No ve fichas del universo de casos (DEC-G20)
> ni actúa sobre alertas.

### CU-A-23 — Iniciar sesión en modo gestión
**RF-APK-27** · `inicio_gestion_screen`
**Flujo:** `P00` + clave (sin MFA, diferido RA-01) → navegación por rol: el COORDINADOR ve el menú de gestión (gestión, coordinación, especiales, monitoreo, mensajes) y NO las pantallas de campo (bandeja de cuadrilla, evidencias).
**Gherkin:**
```gherkin
Dado un usuario con rol COORDINADOR
Cuando inicia sesion en la APK
Entonces la navegacion muestra unicamente las pantallas de gestion (RF-APK-27)
Y ninguna pantalla de campo (bandeja de cuadrilla) es accesible.
```
**Trazabilidad:** RF-20, RF-APK-27, DEC-G16, RA-01 (MFA diferido).

### CU-A-24 — Consultar fallas masivas y solicitar material
**RF-APK-20, RF-APK-21** · `coordinacion_screen`
**Flujo:** ver masivas activas en **solo lectura** → crear la **orden de material** (su única escritura en la APK) → el Supervisor la recibe/atiende.
**Gherkin:**
```gherkin
Dado una falla masiva activa
Cuando el Coordinador la consulta en la APK
Entonces ve su detalle sin poder cerrarla ni planificarla (solo lectura, RF-APK-20)
Y puede crear una orden de material que llega al Supervisor (RF-APK-21).
```
**Trazabilidad:** RF-09, RF-18, RF-APK-20, RF-APK-21, DEC-G (material COORDINADOR).

### CU-A-25 — Consultar casos especiales
**RF-APK-14, RF-APK-19** · `especiales_screen`
**Flujo:** listar/ver especiales y **crear** uno nuevo (alta permitida al COORDINADOR, `_especial_alta`); sin reversiones ni cierres administrativos de reversión (solo SUPER).
**Gherkin:**
```gherkin
Dado 5 casos especiales abiertos
Cuando el Coordinador consulta especiales en la APK
Entonces ve los 5 con su estado de la maquina D-134
Y puede crear uno nuevo (RF-APK-19) sin poder revertir cierres (solo SUPER).
```

**Trazabilidad:** RF-06, RF-APK-14, RF-APK-19, D-134, D-156.

### CU-A-26 — Mensajes al Supervisor desde la APK
**RF-APK-22** · `mensajes_coordinador_screen`
**Flujo:** redactar → destino forzado al Supervisor (DEC-G9/G15) → aparece en la bandeja del Supervisor (web/APK) con autor y hora.
**Gherkin:**
```gherkin
Dado un Coordinador en la APK
Cuando envia un mensaje
Entonces el destino es siempre el Supervisor de su central (DEC-G9)
Y el mensaje queda registrado con autor y hora.
```
**Trazabilidad:** RF-APK-22, DEC-G9, DEC-G15.

### CU-A-27 — Tablero de monitoreo del Coordinador
**RF-APK-13, RF-APK-18, D-109** · `monitoreo_screen`
**Flujo:** tablero con sus vistas de monitoreo (5 vistas RF-APK-13 + las del Coordinador RF-APK-18), con indicador y refresco manual (RF-APK-28); sin acceso a fichas de casos (DEC-G20).
**Gherkin:**
```gherkin
Dado el tablero de monitoreo del Coordinador
Cuando refresa manualmente (RF-APK-28)
Entonces las vistas muestran los indicadores actualizados
Y ninguna vista ofrece fichas del universo de casos (DEC-G20).
```

**Trazabilidad:** RF-26, RF-APK-13, RF-APK-18, RF-APK-28, DEC-G1, DEC-G20.

### CU-A-28 — ZIP de jornada (descarga de cierre del día)
**RF-65/RF-66 (jornada, D-99)** · descarga del paquete de cierre
**Flujo:** tras el cierre de jornada, la app de gestión permite descargar el paquete (ZIP) del día con la información consolidada.
**Gherkin:**
```gherkin
Dado el cierre de jornada ejecutado
Cuando el Coordinador descarga el ZIP de jornada
Entonces obtiene el paquete consolidado del dia
Y si el cierre no se ejecuto, la descarga no esta disponible.
```

**Trazabilidad:** RF-65, RF-66, D-99. *(Detalles de jornada: ver `casos_uso_D99`/incremento D-99.)*
