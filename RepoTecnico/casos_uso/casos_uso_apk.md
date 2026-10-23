# Casos de uso — GGTO V2 · APK Flutter (inventario funcional completo)

| Campo | Valor |
|---|---|
| Documento | Casos de uso del canal **APK Android (Flutter)** bajo criterio de **analista funcional** (un CU por objetivo de actor) |
| Estado | **v1.0** — redactado a partir del inventario real de pantallas del código |
| Fecha | 2026-10-23 |
| Fuente de verdad | Inventario auditado del código vigente (v84 · D-157 desplegados): `app_movil/lib/**` (24 superficies de usuario, 18 pantallas + overlays) |
| Documento complementario | [`casos_uso_web.md`](casos_uso_web.md) — los mismos RF en la WEB (`CU-W-xx`); varios CU existen en ambos canales y comparten backend |
| Requisitos | [`../requerimientos.md`](../requerimientos.md) — RF-01…RF-38 · RNF-01…RNF-25 · reglas RN-AL-01/02/03 |
| Roles vigentes | **SUPER** (acceso total, D-50) · **ADMIN** · **SUPERVISOR** · **TECNICO** · **COORDINADOR** — matriz `requerimientos.md` §5.2 |
| Notación | Criterios funcionales en **Gherkin** (`Dado/Cuando/Entonces`); restricciones del sistema en **EARS**; 100 % testeables |
| Convención de IDs | `CU-A-xx` = canal **APK Android (Flutter)** · `CU-W-xx` = canal **WEB** (documentado por separado) |
| Verificación sugerida | APK: `flutter test` (`app_movil/test`) + pruebas en dispositivo de campo |

**Actores:** `SUPER` Super Usuario · `ADM` Administrador · `SUP` Supervisor de la central ·
`TEC` Técnico de campo · `COO` Coordinador.

**Fuera del alcance de este documento (exclusión explícita y verificable):** los canales
**Telegram**, **WEB-MCP (IA)** y el **solicitante externo ACT-03**. Se cubre solo la
**APK**. Los CU heredan decisiones vigentes: **D-157 (los casos devueltos por cierre de
jornada dejan de descargarse y se purgan)**, D-156 (ZIP de jornada + aviso al solicitante),
D-100 (PIN sin conexión), D-105 (resueltos invisibles), D-115 (actualización única),
D-116 (pendientes visibles), D-117 (PIN/bloqueo sincronizados), D-144 (filtros de casos)
y RN-AL-03 (teléfono de contacto en la APK).

> **Cómo leer la trazabilidad.** Cada CU lista los RF que cubre. Los criterios citan la
> verificación (endpoint, tabla, pantalla o test existente). Nada aquí describe
> comportamiento inexistente: todo lo listado está en el código vigente al 2026-10-23.

---

## Índice

[CU-A-01](#cu-a-01--aceptar-el-aviso-de-uso-restringido-en-la-apk)…[CU-A-07](#cu-a-07--cerrar-sesión-descargar-los-datos-y-restablecer-la-apk) Sesión ·
[CU-A-08](#cu-a-08--consultar-mis-casos-fuera-de-línea)…[CU-A-17](#cu-a-17--capturar-evidencias-con-cámara-y-gps) Campo técnico ·
[CU-A-18](#cu-a-18--trabajar-fuera-de-línea-con-cola-local-y-envío-automático)…[CU-A-22](#cu-a-22--actualizar-la-apk-desde-la-propia-app) Sincronización/Jornada ·
[CU-A-23](#cu-a-23--reportar-una-falla-masiva-desde-el-campo)…[CU-A-28](#cu-a-28--cerrar-una-falla-masiva-y-sus-casos-asociados) Alertas/Masivas ·
[CU-A-29](#cu-a-29--operar-la-bandeja-de-la-cuadrilla-0-en-la-apk)…[CU-A-35](#cu-a-35--leer-la-bandeja-de-mensajes-del-técnico) Gestión/Coordinación ·
[CU-A-36](#cu-a-36--administrar-el-perfil-y-los-datos-del-dispositivo) Usuario.

---

> **Modelo de operación:** las pantallas de campo (casos, atender/contactar, alertas,
> masivas en lista, sincronizar, usuario) funcionan **fuera de línea primero** (SQLite
> local + cola `accion_pendiente` con envío automático cada 5 min con red); las pantallas
> de gestión (GESTIÓN, DESPACHO, MONITOREO, COORDINACIÓN, ESPECIALES, mensajes del
> coordinador, ficha masiva de lectura) son **en línea** con auto-refresco cada 5 min.

## 2.1 Sesión y seguridad

### CU-A-01 — Aceptar el aviso de uso restringido en la APK
**Actor(es):** Todos · D-71 · RNF-18
**Precondición:** App recién instalada, primera ejecución o aceptación pendiente.
**Flujo principal:**
1. Al arrancar, la APK presenta el **aviso de uso restringido** (texto local empaquetado).
2. El usuario puede **Compartir** o **Copiar** el texto y pulsa **«He leído y acepto el aviso»** para continuar a ACCESO.
**Alternativos:** **No acepto** → bloquea el ingreso con aviso; la aceptación persiste en almacenamiento seguro.
**Criterios de aceptación:**
```gherkin
Dado una instalación nueva
Cuando el usuario acepta el aviso
Entonces la aceptación queda guardada y el aviso no vuelve a mostrarse en las próximas ejecuciones
```
```gherkin
Dado el aviso sin aceptar
Cuando se pulsa "No acepto"
Entonces la APK impide el ingreso a la sesión
```

### CU-A-02 — Iniciar sesión en la APK (P00 + clave, bloqueo al 3.er intento)
**Actor(es):** Todos · **RF:** RF-20 · RNF-01
**Flujo principal:**
1. Ingresa `P00` y clave (con visibilidad opcional) y **Ingresar**.
2. Con sesión válida: `TEC` va a sus casos (/casos) y los roles de gestión a su barra (/inicio).
**Alternativos:**
- A1 errores de credenciales: 3 intentos bloquean la cuenta; se muestra el número de intentos restantes.
- A2 **sin conexión** con credencial local: se ofrece **Acceso sin conexión (PIN)** (CU-A-03).
- A3 cuenta bloqueada: desbloqueo por palabras (CU-A-04).
- A4 cuenta sin clave: **Primer acceso** (CU-A-05).
**Criterios de aceptación:**
```gherkin
Dado un técnico con la cuenta habilitada y credencial local guardada
Cuando inicia sesión con red
Entonces la sesión queda activa y la navegación corresponde al rol autenticado
```
```gherkin
Dado 2 intentos fallidos precedentes
Cuando se ingresa el 3.er intento errado
Entonces el sistema bloquea la cuenta y ofrece el desbloqueo por 3 palabras de seguridad
```

### CU-A-03 — Acceso sin conexión con PIN
**Actor(es):** `TEC` · D-100 · RNF-06
**Precondición:** Credencial local vigente (≤ 24 h) y PIN definido.
**Flujo principal:**
1. Desde el login (o tras fallar el login por red) se elige **Acceso sin conexión**.
2. `P00` + PIN de 6 dígitos abren la sesión con los datos del último acceso en línea.
**Alternativos:**
- PIN de fábrica → cambio obligatorio antes de entrar (nuevo + confirmación).
- **Olvidé mi PIN** → descarta la credencial local y vuelve a la clave en red.
- Vigencia vencida → exige re-login con conexión.
**Criterios de aceptación:**
```gherkin
Dado un técnico en campo sin cobertura con PIN propio definido
Cuando ingresa P00 + PIN
Entonces accede a su flujo offline con sus datos del último acceso con conexión, sin llamadas a la red
```
```gherkin
Dado el PIN por defecto guardado
Cuando intenta entrar sin cambiarlo
Entonces la APK exige definir un PIN nuevo válido antes de proseguir
```

### CU-A-04 — Desbloquear la cuenta con 3 palabras de seguridad
**Actor(es):** Todos · **RF:** RF-20 · RNF-01
**Flujo principal:** formulario con P00, clave y **3 palabras elegidas con posición (1–12)** → `POST /auth/unlock` y encadenamiento del login con la clave.
**Criterios de aceptación:**
```gherkin
Dado una cuenta bloqueada
Cuando el titular responde correctamente sus 3 palabras en las posiciones correctas y su clave
Entonces el estado pasa a desbloqueado e ingresa
```

### CU-A-05 — Primer acceso y 12 palabras de seguridad
**Actor(es):** Todos (cuentas pre-registradas) · **RF:** RF-20 · RNF-01/02
**Flujo principal:**
1. **Comprobar P00** valida la elegibilidad; luego correo + clave (≥ 8) + confirmación.
2. **Crear mi acceso** muestra las **12 palabras una sola vez**, con **Copiar las 12 palabras**, y remite al acceso.
**Criterios de aceptación:**
```gherkin
Dado un técnico pre-registrado
Cuando completa correo, clave (≥ 8) y confirmación
Entonces se muestran las 12 palabras una sola vez, copiables, y quedan vigentes para desbloquear su cuenta
```

### CU-A-06 — Bloqueo de la sesión por inactividad
**Actor(es):** Todos · **RF:** RF-20, RF-05 (no exponer datos) · RNF-05 · D-117
**Precondición:** Sesión activa y tiempo de inactividad configurado alcanzado.
**Flujo principal:**
1. Se superpone la pantalla de bloqueo sobre toda la app sin cerrar la sesión.
2. El usuario re-entra con **PIN** (o con su clave si «olvidé el PIN» — requiere red); el cierre de sesión desde ahí conserva casos y cola.
**Criterios de aceptación:**
```gherkin
Dado una sesión activa tras alcanzar los minutos de inactividad configurados
Cuando se superpone LockScreen sin cortar la sesión
Entonces no se ve ningún dato del cliente ni del sistema mientras esté bloqueado
```
```gherkin
Dado un bloqueo con el PIN de fábrica establecido
Cuando se intenta desbloquear
Entonces la app exige definir y validar el PIN nuevo antes de permitir el flujo
```

### CU-A-07 — Cerrar sesión, descargar los datos y restablecer la APK
**Actor(es):** Todos (USUARIO) · RF-20 · **Precondición:** Sesión activa.
**Flujo principal:**
1. **Borrar los casos descargados**: borra casos y masivas locales (conserva sesión, PIN y cola de acciones).
2. **Restablecer la aplicación**: deja la app «como recién instalada» (datos, fotos, PIN y sesión) → vuelve al login.
3. **Cerrar sesión** simple → vuelve al login.
**Criterios de aceptación:**
```gherkin
Dado un dispositivo con 30 casos y 8 fotos locales
Cuando se restablece la aplicación (tras confirmar el aviso rojo)
Entonces la memoria local queda como de fábrica y el login reaparece sin datos residuales
```
```gherkin
Dado una cola de acciones sin enviar
Cuando se pulsa "Borrar los casos descargados"
Entonces la cola de acciones pendientes se conserva para el próximo sincronizar
```
## 2.2 Campo técnico (rol TECNICO)

### CU-A-08 — Consultar «Mis casos» fuera de línea
**Actor(es):** `TEC` · **RF:** RF-11 · D-116, D-105, RN-AL-03
**Precondición:** Sesión activa; despacho descargado (CU-A-19) para la cuadrilla del técnico.
**Flujo principal:**
1. La pantalla siempre pinta **el contenido local** (SQLite): título con nombre del técnico, casos de su cuadrilla, contadores de la franja «Contenido local» y fecha de actualización.
2. Búsqueda por **avería/teléfono/cliente/dirección** mientras se escribe; **filtros de estado**: `Todos / Abiertos / Cerrados` (D-144); *pull-to-refresh* **solo relee local**.
3. Toca una tarjeta → ficha del caso (CU-A-13).
**Alternativos:** vacío con explicación según el motivo del servidor (sin técnico, sin cuadrilla, cuadrilla de gestión); cerrar/reabrir la app no descarga nada.
**Criterios de aceptación:**
```gherkin
Dado un técnico con 7 casos de su cuadrilla descargados (3 gestionados)
Cuando aun sin conexión abre Mis casos con filtro Abiertos
Entonces ve 4 casos abiertos y sus tarjetas sin tocar la red
```
```gherkin
Dado el teléfono del cliente registrado como 70* y un contacto aparte
Cuando el técnico ve la ficha para llamar
Entonces el número presentado para contactar es el contacto, nunca el 70* (RN-AL-03)
```

### CU-A-09 — Ver/ocultar los casos resueltos
**Actor(es):** `TEC` · D-105
**Flujo principal:**
1. El chip **resueltos** alterna la visibilidad de los casos ya gestionados (`CERRADO/CANCELADO/ENRUTADO/DIFERIDO/CITADO`).
2. Con la lista vacía el botón "Ver resueltos" sigue disponible.
**Criterios de aceptación:**
```gherkin
Dado 3 casos cerrados y 4 abiertos
Como primera vista
Entonces el listado solo muestra los abiertos
```
```gherkin
Dado el chip "resueltos" activado
Cuando se toca
Entonces los cerrados sean visibles o invisibles sin recargar la red
```

### CU-A-10 — Contactar al cliente y marcar el caso
**Actor(es):** `TEC` · **RF:** RF-12 · RNF-09 (≤ 3 toques / ≤ 20 s)
**Precondición:** Caso en `NUEVO/PENDIENTE/ASIGNADO/EN_GESTION`.
**Flujo principal:**
1. En la ficha, el botón **CONTACTADO** marca el estado con observación opcional.
2. Con red: `POST` directo; sin red: la acción queda en cola (franja «pendiente de sincronizar»).
**Criterios de aceptación:**
```gherkin
Dado un caso asignado
Cuando se toca "Contactado" con observación
Entonces el caso pasa a CONTACTADO en la ficha (local; en servidor en línea si hay red)
```
```gherkin
Dado la app fuera de línea
Cuando se marca "Contactado"
Entonces la acción queda en cola con la información completa para subirse después
```

### CU-A-11 — Reportar «No contesta» y citar por defecto
**Actor(es):** `TEC`
**Flujo principal:**
1. El botón **No contesta** pide confirmación y deja el caso en `CITADO` con cita de primera visita (mañana 08:00) con constancia para el COS.
**Criterios de aceptación:**
```gherkin
Dado un caso asignado sin respuesta tras llamar
Cuando usa "No contesta"
Entonces el caso queda CITADO con la cita de mañana y la constancia registrada
```

### CU-A-12 — Agendar cita (contactar)
**Actor(es):** `TEC`
**Precondición:** Caso asignado.
**Flujo principal:**
1. **Agendar** abre el selector de fecha (+ máx. 120 días) y hora, con observación.
2. Al confirmar el caso queda `CITADO`; la cita se valida como futura antes de guardarse.
**Criterios de aceptación:**
```gherkin
Dado un caso asignado
Cuando agenda en 3 días a las 14:00
Entonces la cita queda registrada y el caso pasa a CITADO con lo agendado
```
```gherkin
Dado un intento de cita en fecha pasada
Cuando se confirma
Entonces la app impide guardar con aviso de fecha inválida
```

### CU-A-13 — Corregir los datos del caso en campo
**Actor(es):** `TEC`
**Flujo principal:**
1. El botón **Editar** de la ficha (si el estado no es terminal) permite corregir **dirección** y **número de contacto**.
2. Un número 70* ingresado como contacto se registra automáticamente como identificador de pago.
**Criterios de aceptación:**
```gherkin
Dado una dirección mal capturada
Cuando el técnico la edita y guarda en campo sin conexión
Entonces la corrección queda en cola para el servidor, con los cambios del cliente y el carácter local del caso
```

### CU-A-14 — Atender y CERRAR el caso
**Actor(es):** `TEC` · **RF:** RF-13, RF-14, RF-15
**Precondición:** Caso `CONTACTADO/CITADO`.
**Flujo principal:**
1. **Atender** abre la pantalla con **Procedimiento: CERRAR / ENRUTAR / DIFERIR**; la sección **Administrativa** (número, plan, serial del equipo, tipo de servicio) y **Técnica** (OLT, slot, puerto, ruta, FAT) son consultables.
2. **CERRAR**: método de cierre `IVR/COS/SACAS`, descripción de lo realizado (≥ 10 car.) y evidencias de **potencia o navegación** (máx. 2).
3. **Registrar CERRAR** guarda y cierra el caso.
**Criterios de aceptación:**
```gherkin
Dado un caso CONTACTADO con prueba de navegación satisfactoria
Cuando se cierra con el método IVR + 2 fotos de potencia
Entonces el caso queda CERRADO con método, descripción y las evidencias registradas
```
```gherkin
Dado un intento de cerrar sin descripción
Cuando se pulsa registrar
Entonces la app pide descripción mínima y no guarda
```

### CU-A-15 — Atender y ENRUTAR el caso
**Actor(es):** `TEC` · RF-13
**Flujo principal:** **ENRUTAR**: elige instancia destino (Planta externa, Cola de seguimiento, Unidad de masivos, Unidad de empresas, Otra), motivo (≥ 5 car.) y evidencia de potencia (máx. 1) → el caso va a la cola elegida.
**Criterios de aceptación:**
```gherkin
Dado un caso que requiere planta externa
Cuando se enruta con motivo y foto de potencia
Entonces el caso queda ENRUTADO a Planta externa y sale de los casos abiertos de la cuadrilla
```

### CU-A-16 — Atender y DIFERIR el caso
**Actor(es):** `TEC` · RF-13
**Flujo principal:** **DIFERIR**: justificación (≥ 5 car.), hasta **3 fotos demostrativas** y causa del listado → el caso queda diferido y no aparece en la bandeja del día hasta la re-gestión.
**Criterios de aceptación:**
```gherkin
Dado un cliente ausente en la visita
Cuando se difiere con causa y 2 fotos demostrativas
Entonces el caso queda DIFERIDO con motivo, causa y evidencias de bitácora
```

### CU-A-17 — Capturar evidencias con cámara y GPS
**Actor(es):** `TEC` (y roles en masivas/alertas) · **RF:** RF-14 · RNF-04
**Flujo principal:**
1. El botón **Tomar foto** abre la cámara (máx. definido por el tipo: 5/caso, 2 máx. en masiva-alerta…).
2. Antes de capturar se consulta el **GPS** (card de Ubicación con "Actualizar ubicación").
3. Cada foto se comprime, guarda con **serial = n.º de caso + id de avería + tipo + fecha/hora** y no existe **ningún acceso a la galería**.
**Criterios de aceptación:**
```gherkin
Dado el flujo de evidencias de un caso
Cuando se toma una foto con la cámara
Entonces se captura con GPS y fecha/hora y no aparece ninguna opción de galería
```
```gherkin
Dado las fotos nuevas
Cuando se registran o suben
Entonces el serial guarda caso + tipo + fecha/hora y la imagen se comprime antes de subirse
```
## 2.3 Sincronización y cierre de jornada

### CU-A-18 — Trabajar fuera de línea con cola local y envío automático
**Actor(es):** `TEC` · RNF-06 · D-116
**Flujo principal:**
1. Cada acción de campo (estado, cierre, enrutado, diferido, cita, masiva, evidencias) se ejecuta contra el servidor si hay red; **sin red queda en cola** con su `payload` exacto (snackbar naranja).
2. `SyncProvider` **auto-envía cada 5 min** cuando hay red; `offline_banner` avisa «Sin conexión — trabaje normal» con el contador de cambios en cola.
3. La franja de progreso (verde/ámbar/rojo) refleja pendientes, reintentos y errores en CASOS, ALERTAS, MENSAJES y SINCRONIZAR.
**Criterios de aceptación:**
```gherkin
Dado un técnico en zona sin cobertura
Cuando completa contactar + cerrar + 2 fotos
Entonces todo queda en cola local sin pérdida y con indicadores de pendientes visibles
```
```gherkin
Dado una cola con 3 acciones y la red restablecida
Cuando pasan 5 minutos
Entonces el auto-envío las sube y la cola queda vacía o en reintentos contables
```

### CU-A-19 — Sincronizar el dispositivo (CARGA + DESCARGA con purga)
**Actor(es):** Todos · D-115/D-142 · D-104 · **D-157**
**Precondición:** Sesión activa (preferiblemente online).
**Flujo principal:**
1. Botón **SINCRONIZAR** (una sola acción) con diálogo que advierte que los no atendidos de jornadas anteriores **se quitan del teléfono**.
2. Secuencia: ① **CARGA** de evidencias + cola (`/sync/carga`), ② carga del resto de acciones de la cola, ③ **DESCARGA** del despacho del día con **purga de no atendidos** (D-157: los devueltos por cierre de jornada dejan de descargarse).
3. Resumen con resultado y **checklist** (GCP · login · descarga · carga).
**Criterios de aceptación:**
```gherkin
Dado un caso devuelto ayer por cierre de jornada y sin atender
Cuando el técnico sincroniza hoy
Entonces el caso queda excluido de la descarga y se purga del dispositivo como no atendido
```
```gherkin
Dado un caso trabajado con cierre pendiente en la cola
Cuando la sincronización termina
Entonces el cierre se registra online y el caso queda CERRADO tanto en local como en el servidor
```

### CU-A-20 — Generar y compartir el ZIP de la jornada
**Actor(es):** `TEC` · D-156
**Flujo principal:**
1. En SINCRONIZAR: **GENERAR Y COMPARTIR ZIP** crea el archivo con nombre `central+cuadrilla+fecha` con `despacho.csv` + `despacho.json` + `evidencias/` + `LEEME.txt` (**despacho local ya con los cambios del técnico** y todas las fotos del dispositivo).
2. **Share nativo** (correo/mensajería) dirigido al supervisor; se muestran resumen y ruta.
**Criterios de aceptación:**
```gherkin
Dado la jornada con 9 casos gestionados y evidencias
Cuando se genera y comparte el ZIP
Entonces el archivo contiene el despacho actualizado y toda la carpeta de evidencias, listo para enviar al supervisor
```

### CU-A-21 — Gestionar la cola de acciones (reintentar / descartar)
**Actor(es):** Todos · D-116
**Flujo principal:**
1. En SINCRONIZAR cada acción en cola se muestra con su tipo, endpoint, estado, intentos y último error.
2. Menú por acción: **Reintentar ahora** o **Descartar**; **Olvidé mi PIN** en UNLOCK/usuario reemplaza credenciales.
**Criterios de aceptación:**
```gherkin
Dado una acción en estado ERROR
Cuando se usa "Reintentar ahora"
Entonces se envía de nuevo al servidor y el estado se actualiza en la cola
```

### CU-A-22 — Actualizar la APK desde la propia app
**Actor(es):** Todos · D-102/D-107/D-115/D-108
**Flujo principal:**
1. **Tarjeta de Versión** (USUARIO) o **Banner de actualización**: la app consulta la última APK publicada y ofrece **Actualizar/Instalar** con descarga e instalador del sistema, con progreso.
2. Sin conexión el banner es silencioso (no interrumpe el trabajo de campo).
**Criterios de aceptación:**
```gherkin
Dado una versión publicada superior a la instalada
Cuando se abre USUARIO
Entonces el banner "Actualización {versión} disponible" aparece con la opción de instalar
```

## 2.4 Alertas y masivas desde la APK

### CU-A-23 — Reportar una falla masiva desde el campo
**Actor(es):** `TEC` · **RF:** RF-16 · RNF-04 · **Precondición:** Cámara + GPS disponibles.
**Flujo principal:**
1. Formulario **Falla masiva**: OLT*, SLOT*, PUERTO*, ODN*, Dirección* (≥ 5), FAT*, Descripción* (5–400), sector opcional.
2. Hasta **2 fotos de evidencia** con cámara + GPS (quitar foto disponible).
3. **Reportar falla masiva**: con red registra la falla con seriales de fotos; sin red **el reporte + seriales quedan en cola**.
**Criterios de aceptación:**
```gherkin
Dado 12 clientes caídos en el mismo ODN
Cuando el técnico reporta la falla masiva con 2 fotos
Entonces la falla queda registrada (o en cola sin red) y visible en las alertas de la central
```
```gherkin
Dado campos obligatorios sin completar (ejemplo: FAT en blanco)
Cuando se intenta reportar
Entonces la app impide guardar y señala el campo como obligatorio
```

### CU-A-24 — Consultar las masivas vigentes en la APK
**Actor(es):** Todos · RF-09, RF-11
**Flujo principal:**
1. La lista **Masivas** abre con **caché local** y refresca si hay red (auto cada 5 min en primer plano).
2. Cada tarjeta muestra estado, descripción, sector, casos afectados, órdenes y los indicadores planificación/materiales/asignación; `TEC` llega por el bloque fijo de CASOS.
**Criterios de aceptación:**
```gherkin
Dado una masiva activa de la zona
Cuando el técnico abre Masivas sin conexión
Entonces ve la ficha básica por la caché local de la última descarga
```

### CU-A-25 — Consultar la ficha masiva (casos y datos técnicos)
**Actor(es):** Todos · RF-11
**Flujo principal:** la ficha **Masiva #id** se abre con datos de la descarga local; **Casos asociados** muestra cliente, 70*, dirección, datos técnicos y **RUTA**, y toca → ficha del caso; **Datos técnicos** detalla ODN/FAT/RUTA/OLT/slot/puerto y estados.
**Criterios de aceptación:**
```gherkin
Dado N casos en una masiva activa
Cuando se consulta la ficha masiva en la APK
Entonces la pantalla lista los casos con su RUTA para organizar la ruta de trabajo
```

### CU-A-26 — Planificar una masiva desde la APK
**Actor(es):** `ADM`, `SUP` (TEC solo consulta) · **RF:** RF-17
**Flujo principal:** pestaña **Planificar** (requiere red): plan de atención obligatorio, reporte simple, evidencias (cámara/seriales) → **Guardar la planificación** → estado `PLANIFICADA`.
**Criterios de aceptación:**
```gherkin
Dado una masiva activa asignada al supervisor
Cuando planifica y guarda
Entonces queda PLANIFICADA y los indicadores de la APK se marcan
```

### CU-A-27 — Solicitar material para la masiva
**Actor(es):** `ADM`, `SUP`, `COO` · **RF:** RF-18
**Flujo principal:** pestaña **Materiales** lista las órdenes (`Recargar las órdenes`); los roles permitidos registran la solicitud con texto **«Material requerido»** (≥ 3 car.).
**Criterios de aceptación:**
```gherkin
Dado un requerimiento de material para la masiva
Cuando el coordinador lo solicita en la APK
Entonces la orden se registra y queda visible en la masiva (web y APK)
```

### CU-A-28 — Cerrar una falla masiva y sus casos asociados
**Actor(es):** `ADM`, `SUP` · **RF:** RF-17 · D-99
**Flujo principal:**
1. Pestaña **Cerrar** (online): descripción del trabajo, **validador del CRASS** (personal activo) y modo IVR/COS/SACAS, texto que quedará en cada caso y evidencias.
2. Diálogo de confirmación irreversible → **cierre en cascada** con resumen (casos cerrados/omitidos).
**Criterios de aceptación:**
```gherkin
Dado una masiva planificada con 12 casos de la central
Cuando el supervisor elige el validador CRASS activo de su central y cierra
Entonces la masiva y los 12 casos quedan cerrados con el texto definido y el resumen del cierre
```
```gherkin
Dado un validador del CRASS de otra central
Cuando se intenta cerrar
Entonces la APK rechaza y muestra el motivo (mismo D-99 que en la web, CU-W-45)
```
## 2.5 Gestión y coordinación en la APK

### CU-A-29 — Operar la bandeja de la cuadrilla 0 en la APK
**Actor(es):** `SUP`, `ADM`, `SUPER` · **RF:** RF-25, RF-37 · D-22/D-59
**Precondición:** Sesión de gestión (online).
**Flujo principal:**
1. **GESTIÓN · Cuadrilla 0** lista los casos de gestión (auto-refresco 5 min, paginado, búsqueda local).
2. Botón **Asignar** → selector de cuadrilla activa de la central → `POST /despachos/asignar-casos` (día de hoy); **Quitar** saca el caso asignado.
3. El detalle (bottom sheet) muestra 14 campos del caso.
**Criterios de aceptación:**
```gherkin
Dado casos en la bandeja de la cuadrilla 0
Cuando el supervisor los asigna a una cuadrilla de calle
Entonces el caso sale de la bandeja y entra al despacho de hoy de esa cuadrilla
```

### CU-A-30 — Consultar el monitoreo en la APK
**Actor(es):** `SUP`, `ADM`, `SUPER`, `COO` · **RF:** RF-26, RF-28 · D-72
**Flujo principal:**
1. Tablero con **resumen del día** (8 indicadores + barras), **globales del mes**, curva semanal, pendientes por tipo (Reparación/Construcción), **por cuadrilla** y **capacidad operativa**.
2. «Otras vistas»: Solo tablero / Gestión mensual / Casos especiales / Construcciones; `Actualizar ahora` + auto-refresco 5 min.
**Criterios de aceptación:**
```gherkin
Dado la jornada con cierres de todas las cuadrillas
Cuando el coordinador consulta el monitoreo
Entonces los 8 indicadores del día se balancean con la curva semanal y los casos por cuadrilla
```

### CU-A-31 — Gestionar el despacho desde la APK
**Actor(es):** `SUP`, `ADM`, `SUPER` · **RF:** RF-08, RF-24, RF-10 · D-113
**Flujo principal:**
1. Consulta por **fecha** (date picker) con tarjetas de despacho expansibles (casos en orden de visita, estado, tipo de asignación).
2. **Sectores** → asignación de cuadrilla por sector / **Procesar** (checklist por tipos y zonas) / **Generar** (día sin despacho).
3. Ciclo de vida de cada despacho: **Publicar** (BORRADOR→PUBLICADO) y **Cerrar despacho** (PUBLICADO→CERRADO).
**Criterios de aceptación:**
```gherkin
Dado el despacho del día en borrador con cuadrillas por sector
Cuando se procesa y publica
Entonces los casos quedan asignados y las cuadrillas ya los reciben al sincronizar
```

### CU-A-32 — Consultar y crear casos especiales desde la APK
**Actor(es):** creación `ADM/SUP/SUPER/COO`; gestión `ADM/SUP` · **RF:** RF-06 · D-95…D-98
**Flujo principal:**
1. **ESPECIALES**: lista con búsqueda, creación (diálogo con clasificación/tipo/prioridad/solicitante registrado o nuevo/datos del contacto/dirección/descripción/informe si lo requiere) y avisos de sincronización.
2. `COO` entra en **solo lectura** (consulta la ficha sin editar).
**Criterios de aceptación:**
```gherkin
Dado un caso especial de REFERIDO de reparación con todos los datos obligatorios
Cuando se crea en la APK
Entonces aparece en la lista con el aviso de que no llegará hoy al técnico de campo y el flujo del especial sigue en la web
```

### CU-A-33 — Cerrar un caso especial con informe en la APK
**Actor(es):** `ADM`, `SUP`, `SUPER` · RF-06 · D-156
**Flujo principal:**
1. Icono **Cerrar el caso**: modo IVR/COS/SACAS, descripción (≥ 10) e **informe obligatorio (≥ 20)** si el especial lo requiere → cierra el caso asociado y guarda el informe.
2. Con el cierre se genera el **aviso al solicitante por outbox** (D-156).
**Criterios de aceptación:**
```gherkin
Dado un especial con requiere_informe
Cuando se cierra en la APK
Entonces el informe es obligatorio para cerrar y el aviso al solicitante queda encolado en el outbox
```

### CU-A-34 — Coordinador: solicitar material y escribir al Supervisor
**Actor(es):** `COO` · **RF:** RF-18 · D-81 · D-95…D-98
**Flujo principal:**
1. La pantalla de coordinación lista **fallas activas** (con órdenes) y **alertas del sistema**; solo puede **Solicitar materiales** (no planificar ni cerrar).
2. Mensajería al **Supervisor**: selector de supervisor destinatario, cuerpo ≤ 500 y switch **Escalar al Administrador** cuando no hay supervisor activo.
**Criterios de aceptación:**
```gherkin
Dado una masiva activa
Cuando el coordinador solicita material
Entonces la orden se registra y su rol no puede cambiar el estado de la masiva
```
```gherkin
Dado una central sin Supervisor activo
Cuando el coordinador envía con "Escalar al Administrador"
Entonces el mensaje llega al Administrador de la central y queda en la bandeja correcta
```

### CU-A-35 — Leer la bandeja de mensajes del técnico
**Actor(es):** Todos · D-81
**Flujo principal:**
1. La bandeja muestra los mensajes agrupados por día con el sondeo en línea; filtros **No leídos / Todos / por tipo**; toca mensaje → leído; `Marcar todos como leídos` disponible.
2. Badge de no leídos en la barra de CASOS y en la franja de progreso de sincronización.
**Criterios de aceptación:**
```gherkin
Dado 4 mensajes, de los cuales 2 no leídos
Cuando se leen ambos con el filtro "No leídos" activo y luego se cambia a "Todos"
Entonces el badge queda en cero y la lista muestra el historial completo
```

### CU-A-36 — Administrar el perfil y los datos del dispositivo
**Actor(es):** Todos · RF-20 · RNF-22 · D-117
**Flujo principal:**
1. **Datos personales** (nombre, P00 fijo, correo editable) y **datos administrativos** (rol, cuadrilla +desde, central, dispositivo, versión app) — primero se pintan locales y luego se ajustan con red.
2. **Cambiar contraseña** (actual + nueva ≥ 8 + confirmación, online).
3. **Acceso sin conexión (PIN)**: ficha de la credencial (emisión, vigencia 24 h, intentos) y acciones **Definir/Cambiar PIN** y **Restablecer PIN** (vuelve al de fábrica).
4. **Palabras de seguridad** (estado/versión); al verlas el servidor puede regenerar las 12 con contraseña actual.
5. **Datos en el dispositivo**: contadores de casos/fotos/acciones → `Borrar los casos descargados` y `Restablecer la aplicación` (CU-A-07).
**Criterios de aceptación:**
```gherkin
Dado un técnico con PIN propio y 40 casos locales
Cuando consulta "Perfil y seguridad" con red
Entonces ve su ficha al día con vigencia del PIN y los contadores del dispositivo
```
```gherkin
Dado un técnico con sus palabras vigentes
Cuando consulta sus palabras con su clave actual
Entonces la lista se entrega de forma segura bajo verificación previa y sin exposición a terceros
```

## 3.1 Matriz RF → casos de uso (WEB + APK)

| RF | Requerimiento (síntesis) | CUs web | CUs APK |
|---|---|---|---|
| RF-01 | Cargar CSV diario | W-11 | — |
| RF-02 | Perfiles/accesos de trabajadores | W-50, W-51 | A-05 |
| RF-03 | Flota | W-52 | — |
| RF-04 | Cuadrillas | W-53 | A-29 |
| RF-05 | Insumos/medios (v2) | W-50 (órdenes) | A-27 |
| RF-06 | Casos especiales | W-13, W-26, W-27, W-28, W-37 | A-32, A-33 |
| RF-07 | Reportes capacidad/fn diaria | W-15, W-36 | A-30 |
| RF-08 | Despacho diario | W-31…W-35, W-22, W-38 | A-31 |
| RF-09 | Fallas masivas | W-16, W-17, W-39, W-40, W-41, W-42, W-47 | A-23, A-24, A-25 |
| RF-10 | Envío ficha de cuadrilla/sectores; reporte 16:00 | W-34, W-35, W-57 | A-31 |
| RF-11 | Ficha de casos asignados | W-19, W-20 | A-08, A-24, A-25 |
| RF-12 | Contactar/agendar | W-29, W-30 | A-10, A-11, A-12 |
| RF-13 | Documentar actividad | W-20, W-21 | A-14, A-15, A-16 |
| RF-14 | Fotos GPS+fecha (sin galería) | — | A-17, A-23 |
| RF-15 | Documentar resolución | W-21 | A-14…A-16 |
| RF-16 | Alertar falla masiva | W-17, W-39 | A-23 |
| RF-17 | Planificar masivas | W-18, W-43, W-45, W-46, W-47 | A-26, A-28 |
| RF-18 | Solicitud de material | W-18, W-44 | A-27, A-34 |
| RF-19 | Incidentes flota/herramientas | W-17 (manual) | — |
| RF-20 | Login/bloqueo/12 palabras/PIN | W-01…W-06, W-59, W-60 | A-01…A-07, A-36 |
| RF-21 | Ingesta SAS/filtro | W-11 | — |
| RF-22 | Deduplicación | W-11 | — |
| RF-23 | Sectores | W-12, W-49 | — |
| RF-24 | Propuesta despacho | W-31, W-32 | A-31 |
| RF-25 | Cuadrilla 0 criterio combinado | W-13, W-31, W-55 | A-29 |
| RF-26 | Tableros monitoreo/gráficos | W-14, W-23 | A-30 |
| RF-27 | Reporte producción 16:00 | W-36 | A-31 |
| RF-28 | Reporte trabajo d/s/m | W-14, W-15 | A-30 |
| RF-29 | Documentar cada carga | W-11 | — |
| RF-30 | Buscar caso | W-07, W-08 | A-08 |
| RF-31 | Actualizar/editar caso | W-20, W-21 | A-13 |
| RF-32 | Alta manual | W-09 | — |
| RF-33 | Universo de casos | W-19, W-21 | A-09 |
| RF-34 | Seguimiento | W-24, W-25 | — |
| RF-35 | Empresas | W-26 (clasificación), W-29 | — |
| RF-36 | Referidos prioritarios | W-26, W-29 | — |
| RF-37 | Gestión cuadrilla 0 | W-13 | A-29 |
| RF-38 | Central/sectores config | W-48, W-49 | — |

## 3.2 RNF y decisiones cubiertas

| RNF | Criterio | CUs de cobertura |
|---|---|---|
| RNF-01 | Bloqueo 3 intentos + 12 palabras | W-02/03/04, A-02/04/05 |
| RNF-04 | Solo cámara (sin galería) | A-17, A-23 |
| RNF-05 | Bloqueo app por privacidad | A-06 |
| RNF-06 | Operación offline + sinc. async. | A-03, A-08, A-18, A-19 |
| RNF-09 | Usabilidad de campo (3 toques / 20 s) | A-10, A-14 |
| RNF-10 | Configuración sin código | W-49, W-54, W-55 |
| RNF-12 | Bitácora por caso y despacho | W-20, W-21, W-32, W-61 |
| RNF-13 | Español + formato dd/mm/aaaa | W-15, W-23, W-35, W-46 |
| RNF-18 | Aviso legal/PII | W-01, A-01 |
| RNF-19/20 | Observabilidad + outbox | W-16, W-34, W-61 |
| RNF-21 | RBAC y alcance por central | W-14/19/20/47/62, A-14 |
| RNF-22 | Endurecimiento de acceso | W-02/03/04/59/60, A-02/03/04/05/06 |
| — | D-71 aviso de uso | W-01, A-01 |
| — | D-81 mensajería + sistemas | W-57/58/61, A-34/35 |
| — | D-99 validador CRASS | W-45, A-28 |
| — | D-100 PIN sin conexión | A-03 |
| — | D-105 resueltos invisibles | W-13, A-09 |
| — | D-113 checklist por tipos | W-33, A-31 |
| — | D-115 actualización única | A-22 |
| — | D-116 pendientes en APK | A-18, A-21 |
| — | D-123 trabajo reciente | W-38, A-19 |
| — | D-144 filtros de casos | A-08 |
| — | D-146 ranking de efectividad | W-36 |
| — | **D-157 devolución de asignados** | W-38, A-19 |

## 3.3 Notas de testeabilidad y verificación

1. **Cada criterio de aceptación es comprobable** con el harness vigente:
   - API → `app/tests/*_api.py` (pytest con PostgreSQL temporal, `scripts/tmp_pg_pytest.ps1`).
   - Web → pruebas de contrato por pantalla (`npm run build` verde + Playwright sobre el bundle).
   - APK → `flutter test / app_movil/test` (d93, d156, d157 ya existentes) + pruebas manuales en dispositivo de campo.
2. **Severidad de lo no cubierto en este documento:** los canales Telegram/WEB-MCP (RF-06/16/25 vía IA y bot) y el flujo del solicitante externo ACT-03 requieren su propio documento de casos de uso; no se inventó funcionalidad.
3. **Marca de rendimiento:** los SLO p95 de RNF-08 (despacho ≤ 2 s, panel ≤ 2 s) se verifican en la fase de pruebas, no como criterio de cada CU.
4. **Convergencia de doble canal:** varios CUs existen en web y APK (ej. cierre de masiva W-45/A-28, especial W-26/A-32). Ambos comparten el mismo backend; las pruebas de contrato se corren una vez por endpoint y por pantalla una vez por canal.

---
