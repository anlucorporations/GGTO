# Incremento D-117 — Sincronizar, PIN de bloqueo y bloqueo por inactividad

| Campo | Valor |
|---|---|
| Petición | 1) la actualización en la sección **Sincronizar** · 2) no descartar los casos pendientes · 3) el panel principal solo lee el dispositivo · 4) restablecer el PIN al de fábrica y pedir cambio en el primer uso · 5) subir gestionados/contactados y retirar los no gestionados del registro local · 6) bloquear a los 2 minutos sin cerrar sesión y con pantalla de bloqueo |
| Fecha | 2026-10-19 |
| Alcance | APK (`app_movil`) · sin cambios de API ni de esquema · versión **`1.14.0+23`** (pendiente de publicar) |
| Autor | Dirección del proyecto |

---

## 1. La actualización vive en **Sincronizar**

La pantalla que antes se llamaba **Dispositivo** ahora es **Sincronizar**. Su
botón único ejecuta el proceso completo (`ActualizacionDatosService`):

1. **CARGA**: sube las evidencias y las actividades de los casos gestionados
   (cerrados, citados, enrutados, diferidos) y los contactados.
2. **Cola clásica**: envía lo que el lote no cubre (no contesta, citas,
   evidencias sueltas).
3. **DESCARGA**: trae los casos asignados por el **despacho del día** y aplica la
   purga de los no atendidos.

**DEC-117-1.** El panel **Casos** ya no descarga ni sube nada: solo lee la caché
local del dispositivo. El botón de la franja pasó de «Actualizar» a
**«Refrescar»**, y el gesto de refresco hace lo mismo (leer SQLite). El icono
*Sincronizar* de la barra superior abre la sección **Sincronizar**.

---

## 2. Los pendientes no se pierden

Un caso `PENDIENTE` es el que el **cierre de jornada** devolvió a la bolsa por no
haberse resuelto. En la sincronización:

- Si el caso **pertenece al despacho del día**, se conserva en el dispositivo
  (`idsDelDia` de `PurgaDespachos`).
- Si es de un despacho anterior y **ya no está en el despacho**, se retira del
  **registro local**, pero **no se borra del servidor**: el backend lo mantiene
  como pendiente para reasignarlo. La APK nunca elimina casos del servidor; solo
  deja de mostrarlos para no acumular trabajo viejo.

**DEC-117-2.** «No descartar los pendientes» significa **no perderlos en el
servidor** y **conservar los del despacho vigente**; el registro local del técnico
se limpia de los pendientes viejos que ya no le corresponden.

---

## 3. El panel principal solo lee el dispositivo

`CasosScreen` abre y refresca con `CasosProvider.refrescarLocal()`,
`MasivasProvider.refrescarLocal()` y `SyncProvider.refrescar()`: las tres leen
SQLite, no la red. La búsqueda del panel también es **local**
(`CasosProvider.buscar` filtra la caché) y el botón de reintento de la lista vacía
lleva a **Sincronizar**, no descarga. La barra de progreso sigue mostrando el
estado de la cola, pero no se dispara ninguna subida ni descarga desde ahí.

---

## 4. PIN: restablecer al de fábrica y primer uso

- **Restablecer PIN** (sección Usuario) ya **no borra** la credencial: la deja con
  el **PIN de fábrica** (`AppConstants.pinPorDefecto`) y `pinPorDefecto = true`
  (`CredencialService.restablecerPin`).
- La próxima vez que se use el PIN, `evaluarPin` devuelve `requiereCambio` y la
  pantalla de PIN **obliga a definir uno propio** antes de entrar.
- El PIN **solo** sirve para abrir la app sin internet y para desbloquear la
  pantalla. No se envía al servidor ni sustituye la clave: el acceso con red sigue
  siendo P00 + clave.

---

## 5. Qué se sube y qué se retira del registro

| Caso | En la sincronización |
|---|---|
| **CERRADO / CITADO / ENRUTADO / DIFERIDO** | Se sube su actividad/estado al servidor. |
| **CONTACTADO** | Se sube el contacto; si es de un despacho anterior y ya no está en el día, se retira del registro local. |
| **No gestionado** (nuevo, asignado, pendiente viejo) | **No se toca en el servidor**; se retira del registro local si no pertenece al despacho del día. |
| **Con trabajo sin enviar** (cola o foto pendiente) | Se conserva siempre: nunca se borra trabajo de campo. |
| **Del despacho del día** | Se conserva aunque siga pendiente. |

**DEC-117-3.** El objetivo es que la APK no acumule casos de despachos anteriores;
el servidor conserva la historia y los pendientes.

---

## 6. Bloqueo por inactividad y pantalla de bloqueo

- `BloqueoInactividad` envuelve la app y, tras **2 minutos** sin toques
  (`AppConstants.bloqueoInactividadMinutos`), muestra la **pantalla de bloqueo**.
- **No cierra la sesión**: no llama a `cerrarSesion`; solo pide el PIN para volver
  a la misma pantalla. El token y los datos locales siguen intactos.
- La pantalla pide el **PIN**; si es el de fábrica, exige cambiarlo antes de
  desbloquear. Si el PIN falla, muestra el error y respeta los intentos.
- Se reinicia con cualquier toque y al volver del segundo plano; al reanudar
  comprueba el tiempo transcurrido (un temporizador de Android puede quedar
  pausado).
- Aplica a la sesión **TÉCNICO**, que es la que tiene PIN local; los roles de
  gestión no tienen credencial sin conexión.
- El temporizador solo se arma cuando la sesión se **abrió en esta ejecución**
  (`AuthProvider.sesionActiva`), no al arrancar con un token cacheado: la pantalla
  de acceso no aparece bloqueada.

**DEC-117-4.** El bloqueo es de **pantalla**, no de sesión: el técnico no pierde
su trabajo ni tiene que volver a iniciar sesión.

---

## 7. Cambios por archivo

| Archivo | Cambio |
|---|---|
| `app_movil/lib/features/sync/sync_screen.dart` | Sección **Sincronizar**, botón único y texto del proceso. |
| `app_movil/lib/features/casos/casos_screen.dart` | Panel principal **solo local**; botón **Refrescar**. |
| `app_movil/lib/features/auth/credencial_service.dart` | `restablecerPin` + `fichaConPinPorDefecto` (PIN de fábrica). |
| `app_movil/lib/features/auth/auth_provider.dart` | `restablecerPinLocal`. |
| `app_movil/lib/features/usuario/usuario_screen.dart` | «Restablecer PIN» conserva la credencial y vuelve al PIN de fábrica. |
| `app_movil/lib/features/auth/lock_controller.dart` | **Nuevo**: estado del bloqueo. |
| `app_movil/lib/features/auth/lock_screen.dart` | **Nuevo**: pantalla de bloqueo con PIN y cambio de PIN de fábrica. |
| `app_movil/lib/widgets/bloqueo_inactividad.dart` | **Nuevo**: temporizador de 2 minutos y capa de bloqueo. |
| `app_movil/lib/main.dart` | Proveedor del bloqueo y `builder` de la app. |
| `app_movil/lib/features/sync/purga_despachos.dart` | Documenta la regla de los pendientes (servidor vs. dispositivo). |
| `app_movil/pubspec.yaml`, `lib/core/constants.dart` | Versión **`1.14.0+23`**. |
| `app_movil/test/d117_bloqueo_inactividad_test.dart` | **Nuevo**: controlador, pantalla y temporizador. |
| `app_movil/test/d100_credencial_local_test.dart` | Prueba del PIN restablecido al de fábrica. |
| `app_movil/test/d104_purga_despachos_test.dart` | Un `PENDIENTE` del día se conserva. |
| `app_movil/test/d84_d85_sincronizacion_test.dart` | El panel ofrece **Refrescar**, no sincronización. |
| `app_movil/test/d115_actualizacion_unica_test.dart` | La sección se llama **Sincronizar**. |

---

## 8. Verificación

| Comprobación | Resultado |
|---|---|
| `flutter analyze` | **No issues found!** |
| `flutter test` | **208/208 en verde** |
| Backend | Sin cambios; se mantiene la prueba D-116 del pendiente descargable y gestionable |
| Versión APK | **`1.14.0+23`** (pendiente de compilar y publicar) |

**Pendiente:** compilar y publicar la APK `1.14.0+23`; probar en dispositivo el
bloqueo a los 2 minutos, el PIN restablecido y la sincronización con una jornada
real.
