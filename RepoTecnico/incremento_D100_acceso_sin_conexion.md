# Incremento D-100 — Acceso sin conexión de la APK (documento de credencial local)

| Campo | Valor |
|---|---|
| Documento | `incremento_D100_acceso_sin_conexion.md` |
| Estado | v1.0 |
| Fecha | 2026-10-15 |
| Origen | Petición directa del usuario: «en la APK verificar que el acceso se pueda realizar sin conexión a internet, agrega el documento de credencial con los datos necesarios en local» |
| Decisiones | DEC-PIN-1 … DEC-PIN-4 |
| Numeración | Continúa la del proyecto: **RF-73…RF-75** · **RNF-37** · **RT-25** (el máximo en uso era RF-72 / RNF-36 / RT-24) |

---

## 1. Problema y verificación previa

Se pidió **verificar** que el acceso funciona sin internet. La verificación dio
resultado **negativo**: la APK no podía entrar sin red.

| Punto | Estado encontrado |
|---|---|
| `main.dart` | `initialRoute: '/login'` **siempre**: aunque hubiera sesión guardada, el arranque caía en la pantalla de acceso. |
| `AuthProvider.restaurarSesion()` | Restauraba token y datos en memoria, pero nadie los usaba para entrar. |
| `AuthProvider.login()` | Llama **siempre** a `POST /auth/login`. Sin red, devuelve el error de red y el usuario se queda fuera. |
| `AuthProvider.desbloquear()` | Igual: `POST /auth/unlock` + `login`; sin red no hay desbloqueo. |
| `AuthStorage` | La sesión (token + datos) **sí** se guardaba cifrada en `flutter_secure_storage`, pero no había forma de validar al usuario sin servidor. |
| Token JWT | 480 min (8 h). Sin red no se puede renovar. |

Conclusión: faltaba el **documento de credencial** que permitiese comprobar la
identidad en el propio dispositivo.

---

## 2. Alcance

### Dentro
1. **Documento de credencial local**: una ficha por técnico, cifrada en el
   almacén del sistema, con lo necesario para validar el PIN y reconstruir la
   sesión sin servidor.
2. **Acceso sin conexión con PIN de 6 dígitos**, con PIN de fábrica y **cambio
   obligatorio** en el primer uso.
3. **Vigencia de 24 h** desde el último acceso con red.
4. Pantalla de PIN, botón «Acceso sin conexión» en el acceso, y gestión del PIN
   en la sección **Usuario** (cambiar, restablecer), más «Olvidé mi PIN».
5. Pruebas: derivación criptográfica contra los vectores del estándar, política
   del PIN y **flujo completo** con el almacén simulado.

### Fuera
- Autenticación **inicial** sin red: si un técnico nunca entró con internet, no
  hay credencial y no hay acceso sin conexión (por diseño).
- Acceso sin conexión para roles de gestión (ver DEC-PIN-1).
- MFA/TOTP (sigue diferido en el proyecto, DEC-G14).

---

## 3. Nuevos Requerimientos Funcionales (RF-73…RF-75)

| # | Enunciado | Prioridad |
|---|---|---|
| **RF-73** | Permitir el **acceso a la APK sin conexión a internet** mediante un **PIN local**, para el rol TÉCNICO, abriendo la sesión guardada del dispositivo. | Alta |
| **RF-74** | Mantener un **documento de credencial local** emitido en cada inicio de sesión con red correcto, con identidad, rol, verificador del PIN, procedencia y vigencia; el PIN arranca en el valor de fábrica y **debe cambiarse** en el primer uso; la credencial caduca a las **24 h** sin conexión. | Alta |
| **RF-75** | Permitir **gestionar el PIN** desde la sección Usuario (cambiarlo o restablecer el acceso sin conexión) y **recuperarse** del olvido («Olvidé mi PIN»), que descarta la credencial y exige un acceso con red. | Media |

**Totales del incremento:** **3 RF** (RF-73…RF-75) · **1 RNF** (RNF-37) · **1 RT** (RT-25).

---

## 4. Nuevo Requerimiento No Funcional (RNF-37)

| # | Enunciado | Criterio de verificación |
|---|---|---|
| **RNF-37** | El PIN **nunca** se almacena en claro. Se guarda un **verificador PBKDF2-HMAC-SHA256** con sal aleatoria de 16 bytes por ficha, dentro del almacén cifrado del sistema (Keystore de Android). | La derivación se comprueba contra los vectores de prueba de RFC 8018 (`P=password`, `S=salt`, `c=1,2,4096`) y ninguna ruta del código escribe el PIN en disco. |

---

## 5. Requerimiento Técnico (RT-25)

| # | Enunciado |
|---|---|
| **RT-25** | La política del PIN —formato, vigencia, intentos fallidos, bloqueo y cambio obligatorio— vive en la función **pura** `evaluarPin()` de `credencial_service.dart`, separada del almacén. Así la decisión de seguridad se prueba sin canales de plataforma y el almacén se limita a leer y escribir el documento. |

---

## 6. Modelo del documento de credencial

Se guarda bajo la clave `credencial_local` del almacén cifrado, como un
documento versionado con una ficha por técnico:

| Campo | Tipo | Para qué |
|---|---|---|
| `p00`, `nombre`, `apellido`, `correo`, `rol`, `id_central`, `id_tecnico` | texto/entero | Identidad que se restaura al abrir la sesión sin red. |
| `sal` | base64 | Sal aleatoria del PBKDF2 (16 bytes). |
| `verificador` | base64 | PBKDF2-HMAC-SHA256 del PIN (32 bytes, 20 000 iteraciones). |
| `pin_por_defecto` | bool | Si es `true`, el acceso **obliga** a cambiarlo. |
| `emitida_en` | ISO-8601 | Cuándo se emitió la ficha. |
| `ultimo_acceso_con_red` | ISO-8601 | De aquí cuelgan las **24 h** de vigencia. |
| `intentos_fallidos` | entero | Se agota a los 3, igual que el bloqueo del servidor. |
| `version` (documento) | entero | Un documento de otra versión se descarta. |

---

## 7. Flujo

```
Arranque ──► /login (siempre)
                │
                ├── P00 + clave ──► POST /auth/login
                │        │                │
                │        │                └── OK ──► emite/renueva credencial ──► /inicio
                │        │
                │        └── falla de red + credencial del P00
                │                 └──► ofrece «Entrar con PIN»
                │
                └── «Acceso sin conexión (PIN)» ──► /pin
                          │
                          ├── PIN correcto y propio ──► abre sesión cacheada ──► /inicio
                          ├── PIN de fábrica ──► exige PIN nuevo ──► abre sesión
                          ├── PIN incorrecto ×3 ──► credencial bloqueada
                          └── «Olvidé mi PIN» ──► descarta credencial ──► /login
```

---

## 8. Decisiones (DEC-PIN-1 … DEC-PIN-4)

| # | Decisión | Motivo |
|---|---|---|
| **DEC-PIN-1** | **Solo el rol TÉCNICO** accede sin conexión. | Elección del usuario. Los roles de gestión manejan información de toda la central y no trabajan en campo, así que siempre exigen red. |
| **DEC-PIN-2** | El PIN arranca en el **de fábrica `824605`** para las cuentas ya dadas de alta y **obliga a cambiarlo** en el primer uso. | Elección del usuario: permite que un técnico que nunca configuró nada entre en campo, sin dejar un PIN conocido como puerta permanente. El PIN de fábrica deja de valer en cuanto se personaliza y no puede volver a ponerse. |
| **DEC-PIN-3** | La credencial **caduca a las 24 h** sin conexión. | Elección del usuario. Equilibra la disponibilidad en campo con la contención del riesgo si el equipo se pierde. |
| **DEC-PIN-4** | El PIN es **de la app**, no la clave de la cuenta; y la **identidad guardada debe coincidir** con la de la credencial. | Evita guardar la clave real en el dispositivo y evita un salto de identidad en dispositivos compartidos (abrir la credencial de A con la identidad que dejó B). |

### Decisiones de implementación derivadas

| # | Decisión | Motivo |
|---|---|---|
| **D-100-a** | El **token es opcional** en la sesión sin conexión. | Sin red el token no interviene, y tras una caducidad se descarta. Exigirlo habría dejado el acceso limitado a las 8 h del JWT en lugar de a las 24 h de la credencial. |
| **D-100-b** | Al caducar el token se borra **solo el token**, conservando `sesion_usuario`. | Es lo que permite seguir entrando con el PIN dentro de las 24 h. Antes, el 401 borraba la sesión completa y dejaba al técnico sin salida sin red. |
| **D-100-c** | El 401 solo cierra la sesión si la petición **llevaba** `Bearer`. | Un 401 sin token significa «no autenticado», no «sesión expirada»: no debe destruir la credencial de acceso sin conexión. |
| **D-100-d** | El PIN se guarda como **verificador PBKDF2**, no cifrado reversible. | Aunque el almacén se descifrase, el PIN no se recupera. Se implementa sobre `package:crypto` (ya presente como dependencia transitiva) para no añadir binarios nativos a la APK. |

---

## 9. Riesgos

| # | Riesgo | Mitigación |
|---|---|---|
| R-100-1 | El PIN de fábrica `824605` es conocido. | Cambio **obligatorio** en el primer uso; no puede volver a ponerse; el acceso avisa de forma destacada mientras siga activo; y sigue haciendo falta el **P00** de un técnico que ya entró con red en ese dispositivo. |
| R-100-2 | Un PIN de 6 dígitos tiene 10⁶ combinaciones. | Tres intentos y bloqueo (igual que el servidor), vigencia de 24 h, verificador PBKDF2 y almacén cifrado con el Keystore. |
| R-100-3 | El dispositivo perdido conserva acceso sin conexión. | La credencial caduca en 24 h y **toda** la vía sin conexión se revoca desde la sección Usuario o con «Olvidé mi PIN», además de cerrar la sesión. Revocación remota queda fuera de alcance. |
| R-100-4 | La identidad cacheada y la credencial podrían desincronizarse en un equipo compartido. | `entrarSinConexion` exige que el P00 coincida y devuelve `sesionIncoherente` si no (cubierto por prueba). |

---

## 10. Verificación

| Ámbito | Evidencia |
|---|---|
| Criptografía | Los tres vectores de RFC 8018 para PBKDF2-HMAC-SHA256 (c=1, c=2, c=4096 con `P=password`, `S=salt`) dan el resultado esperado. |
| Política del PIN | `evaluarPin` cubierto en sus siete desenlaces: sin credencial, P00 ajeno, caducada, correcto, de fábrica, incorrecto (con recuento) y bloqueada. |
| Documento | Alta, renovación (conserva el verificador), inserción/reemplazo/baja por P00, viaje a JSON y descarte de documentos de otra versión o fichas corruptas. |
| **Extremo a extremo** | Con `FlutterSecureStorage.setMockInitialValues`, se ejercita de verdad: emisión al entrar con red, **cambio obligatorio** del PIN de fábrica, el PIN de fábrica deja de valer, el rol de gestión **no** recibe credencial, bloqueo a los 3 intentos, olvido, **apertura de la sesión sin red**, rechazo por identidad incoherente y apertura **sin token** (token caducado). |
| Suite completa | `flutter analyze` → **«No issues found!»**; `flutter test` → **114/114** (80 previos + 34 nuevos de `app_movil/test/d100_credencial_local_test.dart`). |
| APK | `1.3.0+12` firmada con el keystore oficial y publicada en `app/web/public/apk/` para la descarga desde el acceso. |

### Lo que **no** se ha podido ejercitar aquí

- La migración real del almacén y el flujo en un **dispositivo/emulador**
  (`flutter build apk` sí, instalación y uso real no).
- La revocación de la credencial desde el servidor (fuera de alcance).
- El comportamiento con conectividad intermitente real (se ha razonado y
  cubierto con las pruebas del 401 y de la sesión sin token).
