# Casos de uso — Incremento **D-95 … D-98** · APK de Gestión (Supervisor · Administrador · Coordinador)

| Campo | Valor |
|---|---|
| Documento | Casos de uso bajo criterio de **analista funcional** (un CU por objetivo de actor) |
| Estado | **v0.2 — decisiones DEC-G11…DEC-G19 y hallazgos de la auditoría incorporados** |
| Fecha | 2026-10-10 |
| Requisitos | [`../incremento_D95_apk_gestion.md`](../incremento_D95_apk_gestion.md) **v0.3** (RF-APK-13…30 · RNF-APK-01…06 · RT-APK-01…05) |
| Decisiones | **DEC-G1…DEC-G19** ([`../incremento_D95_apk_gestion.md`](../incremento_D95_apk_gestion.md) §3 y §3.1) |
| Riesgos aceptados | **RA-01** — sin MFA (DEC-G14) · **RA-02** — caché local sin cifrar (DEC-G19) |
| Auditoría incorporada | [`../INFORME_OPTIMIZACION_D95_V1.md`](../INFORME_OPTIMIZACION_D95_V1.md) — 38 hallazgos (7 críticos): **H-01** acotado por central · **H-05** única escritura de fallas masivas · **H-06** prueba de carga · **H-07** alta y gobierno del rol |
| Reglas vigentes | [`../requerimientos.md`](../requerimientos.md) §5.2 (RBAC), RF-25 (cuadrilla 0), RNF-21/RNF-22 |
| Notación | Criterios funcionales en **Gherkin**; restricciones del sistema en **EARS**; 100 % testeables |
| Alcance | APK multi-rol (Supervisor · Administrador · Coordinador) + WEB del Coordinador. **Dentro:** alta manual de casos (RF-APK-29) y edición ligera (RF-APK-30), DEC-G12. **Fuera:** seguimiento, empresas, referidos, citas, configuración, ingesta e imprimibles del despacho (DEC-G12) |

**Actores:** `SUP` Supervisor · `ADM` Administrador · `SUPER` Super Usuario ·
`COO` Coordinador *(rol nuevo, DEC-G1)* · `TEC` Técnico *(solo convivencia, RNF-APK-03)*.

**Pantallas de la APK de gestión (nombres canónicos de este documento):**
`ACCESO` · `MONITOREO` · `ESPECIALES` · `DESPACHO` · `CASOS` · `GESTIÓN` ·
`ALERTAS` · `MENSAJES` · `USUARIO`.

**Fuera del alcance de este incremento (DEC-G12, exclusión expresa y verificable).** No se
construyen en la APK de gestión: **seguimiento** (`GET/POST/PATCH /seguimiento`,
`routes_especiales.py:486-552`) · **empresas** · **referidos** · **citas**
(`/citas`, `routes_especiales.py:388-474`) · **configuración** (`routes_config.py`) ·
**ingesta** (`routes_ingesta.py`) · **imprimibles del despacho**
(`GET /despachos/{id}/imprimible`, `routes_despachos.py:441`). El menú de la APK no las
ofrece y la navegación directa por ruta interna no las renderiza.

> **Cómo leer la marca «NUEVO — no existe en el backend vigente».** Cuando un caso de
> uso depende de algo que **hoy no está en el código**, se declara con esa marca y se
> cita la evidencia real de lo que sí existe. Hoy son seis:
> **1)** el rol `COORDINADOR` (0 coincidencias en todo el repo; semilla real de `rol` en
> `RepoTecnico/db/schema.sql:872-877` → `SUPER · ADMIN · SUPERVISOR · TECNICO`, y
> `app/api/deps.py:52-71` compara **solo** el código de rol);
> **2)** la mensajería Coordinador → Supervisor (`routes_mensajes.py:3` dice
> «unidireccional supervisor → técnicos»; `mensaje_entities.py:28` fija
> `TIPOS_DESTINO = ("TODOS","CUADRILLA","TECNICO")` y `:67-72` obliga a que el destino
> encaje en `id_cuadrilla` o `id_tecnico`);
> **3)** la APK de gestión (`app_movil/` es una sola app «GGTO Técnico» `1.1.0+9` y
> `sesion.dart:27-29` solo distingue `esTecnico`/`esSuper`/`soloLectura`, con navegación
> de campo: `/casos`, `/sync`, `/alertas`, `/mensajes`, `/usuario` en `main.dart:111-120`);
> **4)** la cuenta de gestión **separada de `tecnico`** (DEC-G16): `Usuario.id_tecnico` es
> *nullable* (`app/models/entities.py:80`) pero el **único** camino de alta/asignación de
> rol exige una fila previa en `tecnico` (`app/api/routes_config.py:349-383`, con
> `id_tecnico=obj.id_tecnico`) y `ROL_ASIGNABLE` no admite `COORDINADOR`
> (`app/schemas/config.py:132`);
> **5)** la **vista de auditoría en solo lectura** del SUPER (DEC-G17): las escrituras sí
> dejan traza en `auditoria` (`routes_auth.py:226,343,418,448,520`;
> `routes_config.py:389-398`; `routes_casos.py:793`) pero **no existe ningún endpoint
> `GET` de `auditoria`** (grep de `@router.get("/auditoria…")` = 0);
> **6)** el **acotado por central** (H-01): `resolver_central` acepta el `id_central` que
> manda el cliente **sin compararlo** con `usuario.id_central`
> (`app/services/consultas.py:20-29`) y la RLS es inerte porque la aplicación nunca fija
> el parámetro (`grep "SET LOCAL app.id_central"` en `app/**/*.py` = **0**; la política
> `p_caso_central` permite todo cuando el parámetro es NULL,
> `RepoTecnico/db/schema.sql:774-785`).
>
> **El MFA ya no es una marca de este documento: está FUERA de alcance** (DEC-G14, riesgo
> aceptado **RA-01**). No queda ningún criterio de aceptación que lo exija; RNF-APK-04 se
> declara **incumplido por decisión expresa** en CU-D95-02 y CU-D95-19.

---

## Índice de casos de uso

| ID | Nombre | Actor(es) | Ciclo |
|---|---|---|---|
| [CU-D95-01](#cu-d95-01--ingresar-en-la-apk-de-gestion-con-autenticacion-por-rol) | Ingresar en la APK de gestión con autenticación por rol | SUP, ADM, COO | D-96 |
| [CU-D95-02](#cu-d95-02--ingresar-los-roles-de-gestion-sin-segundo-factor) ✏️ | Ingresar los roles de gestión sin segundo factor | ADM, SUP, COO | D-95 |
| [CU-D95-03](#cu-d95-03--navegar-por-la-apk-segun-el-rol-autenticado) | Navegar por la APK según el rol autenticado | SUP, ADM, COO, TEC | D-96 |
| [CU-D95-04](#cu-d95-04--consultar-el-monitoreo-de-la-gestion-en-sus-5-vistas) | Consultar el monitoreo de la gestión en sus 5 vistas | SUP, ADM, COO | D-97/D-98 |
| [CU-D95-05](#cu-d95-05--refrescar-automaticamente-cada-5-minutos-con-presupuesto-de-peticiones) ✏️ | Refrescar automáticamente cada 5 minutos con presupuesto de peticiones | SUP, ADM, COO | D-96 |
| [CU-D95-06](#cu-d95-06--consultar-sin-conexion-con-enmascaramiento-visual-y-cache-sin-cifrar) ✏️ | Consultar sin conexión con enmascaramiento visual y caché sin cifrar | SUP, ADM, COO | D-96 |
| [CU-D95-07](#cu-d95-07--listar-filtrar-y-abrir-la-ficha-de-un-caso-especial) | Listar, filtrar y abrir la ficha de un caso especial | SUP, ADM | D-97 |
| [CU-D95-08](#cu-d95-08--crear-un-caso-especial-con-su-caso-asociado) | Crear un caso especial con su caso asociado | COO, SUP, ADM | D-98 |
| [CU-D95-09](#cu-d95-09--armar-y-publicar-el-despacho-del-dia) | Armar y publicar el despacho del día | SUP, ADM | D-97 |
| [CU-D95-10](#cu-d95-10--asignar-y-quitar-un-caso-del-despacho-de-la-cuadrilla) | Asignar y quitar un caso del despacho de la cuadrilla | SUP, ADM | D-97 |
| [CU-D95-11](#cu-d95-11--operar-la-pantalla-gestion-de-la-cuadrilla-0) | Operar la pantalla GESTIÓN de la cuadrilla 0 | SUP, ADM | D-97 |
| [CU-D95-12](#cu-d95-12--gestionar-la-bandeja-de-mensajes-del-supervisor) | Gestionar la bandeja de mensajes del Supervisor | SUP, ADM | D-95/D-97 |
| [CU-D95-13](#cu-d95-13--enviar-un-mensaje-a-un-supervisor-concreto-de-su-central) ✏️ | Enviar un mensaje a un Supervisor concreto de su central | COO | D-95/D-98 |
| [CU-D95-14](#cu-d95-14--monitorear-las-alertas-sin-actuar-las-fallas-masivas-y-la-bandeja-de-notificaciones) ✏️ | Monitorear las alertas sin actuar, las fallas masivas y la bandeja de notificaciones | SUP, ADM, COO | D-97/D-98 |
| [CU-D95-15](#cu-d95-15--consultar-una-falla-masiva-con-detalle-de-planificacion-y-materiales) | Consultar una falla masiva con detalle de planificación y materiales | COO, SUP, ADM | D-98 |
| [CU-D95-16](#cu-d95-16--solicitar-material-para-una-falla-masiva) ✏️ | Solicitar material para una falla masiva | COO | D-95/D-98 |
| [CU-D95-17](#cu-d95-17--usar-la-web-del-coordinador-con-las-mismas-capacidades) | Usar la WEB del Coordinador con las mismas capacidades | COO | D-98 |
| [CU-D95-18](#cu-d95-18--conservar-el-flujo-offline-del-tecnico-con-cargadescarga-manual) | Conservar el flujo offline del Técnico con CARGA/DESCARGA manual | TEC | D-96 |
| [CU-D95-19](#cu-d95-19--dar-de-alta-la-cuenta-de-gestion-del-coordinador-y-acotar-el-rbac) ✏️ | Dar de alta la cuenta de gestión del Coordinador y acotar el RBAC | SUPER | D-95 |
| [CU-D95-20](#cu-d95-20--habilitar-el-modelo-de-mensajeria-por-destinatario-usuario) ✏️ | Habilitar el modelo de mensajería por destinatario usuario | SUPER | D-95 |
| [CU-D95-21](#cu-d95-21--publicar-la-apk-multi-rol-con-su-version-y-firma) | Publicar la APK multi-rol con su versión y firma | SUPER | D-96/D-98 |
| [CU-D95-22](#cu-d95-22--aislar-por-central-los-datos-de-la-apk-de-gestion) 🆕 | **NUEVO** · Aislar por central los datos de la APK de gestión | SUPER | D-95 |
| [CU-D95-23](#cu-d95-23--dar-de-alta-manualmente-un-caso-de-gestion) 🆕 | **NUEVO** · Dar de alta manualmente un caso de gestión | SUP, ADM | D-97 |
| [CU-D95-24](#cu-d95-24--editar-ligeramente-un-caso-desde-la-apk) 🆕 | **NUEVO** · Editar ligeramente un caso desde la APK | SUP, ADM | D-97 |

**Total: 24 casos de uso** — 21 de la v0.1 (8 ampliados o reescritos: CU-D95-02, 05, 06, 13,
14, 16, 19 y 20) y **3 nuevos** (CU-D95-22, 23 y 24).

---

## CU-D95-01 · Ingresar en la APK de gestión con autenticación por rol

| | |
|---|---|
| **Actor** | `SUP`, `ADM`, `COO` |
| **Objetivo** | Abrir sesión en la APK de gestión y quedar ubicado en el menú de su rol |
| **Precondición** | La cuenta existe, está `ACTIVO`, no está bloqueada y pertenece a una central (`usuario.id_central`) |
| **Postcondición** | Sesión iniciada; la APK conoce `rol`, `id_central` y `id_tecnico`; se abre `MONITOREO` |
| **Requisitos** | RF-APK-27, RNF-APK-04, RT-APK-01 |
| **Decisiones** | DEC-G1, DEC-G2, DEC-G6, DEC-G14 |

**Flujo principal**

1. La APK muestra `ACCESO` con los campos **P00/correo** y **clave**.
2. El usuario envía las credenciales al endpoint vigente `POST /api/v1/auth/login` (`routes_auth.py:89`).
3. El servidor valida `usuario.p00` + clave Argon2id y **emite el token en un solo paso**:
   el login vigente no tiene segundo factor (`routes_auth.py:106-128`), conforme a
   **DEC-G14 / RA-01**; el detalle del ingreso sin MFA está en CU-D95-02.
4. El sistema devuelve el objeto `usuario` con `p00`, `nombre`, `apellido`, `correo`, `rol`, `id_central`, `id_tecnico`.
5. La APK guarda la sesión (`sesion.dart`) y aplica la navegación por rol de CU-D95-03.
6. La APK abre `MONITOREO` (vista Diaria) de la central del usuario.

**Flujos alternativos**

- **A1 (credenciales inválidas o token expirado).** `401` con «Credenciales inválidas o token expirado» (`deps.py:22-26`); la APK vuelve a `ACCESO` y no conserva caché de sesión.
- **A2 (usuario bloqueado).** `423` con «Usuario bloqueado» (`deps.py:47-48`); la APK informa y no permite reintentar más de 3 veces en 10 minutos.
- **A3 (rol `TECNICO`).** **NUEVO — no existe en el backend vigente** como ruta de gestión: hoy el TÉCNICO entra por el mismo login pero la APK lo lleva a `/casos` (`main.dart:115`). Con DEC-G2 debe seguir entrando a su flujo de campo (CU-D95-18), nunca a `MONITOREO`.
- **A4 (rol `COORDINADOR`).** **NUEVO — no existe en el backend vigente**: sin RT-APK-01 el login devuelve `rol = COORDINADOR` pero ningún endpoint lo reconoce; ver CU-D95-19.
- **A5 (el usuario tiene un solo central).** DEC-G6: la APK **no** muestra selector de central; el `id_central` sale de `usuario.id_central` (`resolver_central`).

**Criterios de aceptación**

```gherkin
Dado un usuario COORDINADOR activo de la central FRANCISCO SALIAS
Cuando ingresa su P00 y su clave en la APK
Entonces la APK abre la pantalla MONITOREO de su central
Y el menú muestra 6 secciones: MONITOREO, ESPECIALES, FALLAS MASIVAS (solo lectura + material), ALERTAS, MENSAJES y USUARIO
Y no muestra GESTIÓN ni DESPACHO ni CASOS
```

```gherkin
Dado un usuario con estado bloqueado
Cuando intenta iniciar sesión en la APK
Entonces la API responde 423 con el detalle "Usuario bloqueado"
Y la APK muestra el aviso y no abre ninguna pantalla de gestión
```

```gherkin
Dado un usuario TECNICO activo
Cuando inicia sesión en la APK
Entonces la APK abre la pantalla CASOS de su cuadrilla
Y no instala el temporizador de refresco de 5 minutos
```

**Restricciones (EARS)**

- Mientras el usuario autenticado tenga rol `TECNICO`, el sistema **no deberá** habilitar ninguna pantalla de gestión (RF-APK-27).
- Mientras RNF-APK-04 no se implemente, el sistema **deberá** emitir el token con `P00` + clave y **sin** segundo factor para `ADMIN`, `SUPERVISOR` y `COORDINADOR` (DEC-G14, riesgo aceptado **RA-01**; ver CU-D95-02). Hoy el login solo contabiliza `usuario.intentos_fallidos` y **no** escribe en `auditoria` (`routes_auth.py:106-122`); registrar el evento de acceso es una mejora pendiente (duda abierta nº 6, H-26).
- El sistema **deberá** resolver la central exclusivamente desde `usuario.id_central` (DEC-G6) sin aceptar un `id_central` de pantalla en las escrituras; **hoy no lo garantiza** y su corrección es CU-D95-22 (H-01).

---

## CU-D95-02 · Ingresar los roles de gestión sin segundo factor

| | |
|---|---|
| **Actor** | `ADM`, `SUP`, `COO` (el `SUPER` usa el mismo login) |
| **Objetivo** | Ingresar con `P00` + clave **en un solo paso**, con bloqueo a los 3 intentos y recuperación con 3 de las 12 palabras |
| **Precondición** | La cuenta existe, está `ACTIVO` y tiene clave fijada |
| **Postcondición** | Token emitido **sin segundo factor**; los intentos fallidos quedan contabilizados en `usuario.intentos_fallidos` |
| **Requisitos** | RNF-APK-04, RT-APK-01 |
| **Decisiones** | DEC-G14 (riesgo aceptado **RA-01**) |
| **Estado del requisito** | **RNF-APK-04 (MFA obligatorio) INCUMPLIDO POR DECISIÓN EXPRESA** en este incremento |

**Flujo principal**

1. El usuario introduce `P00` y clave en `ACCESO`; la APK llama `POST /api/v1/auth/login` (`routes_auth.py:88`).
2. El servidor aplica el límite de intentos por `p00|IP` (`_rate_limit`, `routes_auth.py:48-58`) y verifica `usuario.clave_hash` (Argon2id, `routes_auth.py:106`).
3. Si la clave es correcta, se reinician `intentos_fallidos` y `bloqueado` (`routes_auth.py:120-122`) y se emite el token en **un solo paso** (`routes_auth.py:124-128`), **sin** pantalla de segundo factor (DEC-G14).
4. La APK continúa en CU-D95-01 paso 4.
5. Recuperación: con **3 de las 12 palabras** de seguridad el usuario desbloquea (`POST /auth/unlock`, `routes_auth.py:356`) o restablece su clave (`POST /auth/reset-password`, `routes_auth.py:375`).

**Flujos alternativos**

- **A1 (clave incorrecta).** Se incrementa `intentos_fallidos` y la API responde `401` «Credenciales inválidas» con la cabecera `X-Intentos-Restantes` (`routes_auth.py:107-118`).
- **A2 (tercer intento fallido).** `intentos_fallidos >= max_intentos` (valor vigente **3**, `app/core/config.py:31`) → `bloqueado = True` y `423` «Usuario bloqueado por superar los intentos permitidos» (`routes_auth.py:109-116`).
- **A3 (cuenta ya bloqueada).** `423` «Usuario bloqueado. Use la recuperación con sus palabras de seguridad.» (`routes_auth.py:100-104`).
- **A4 (demasiados intentos en la ventana).** `429` «Demasiados intentos. Espere un momento.» (`routes_auth.py:53-57`).
- **A5 (recuperación con palabras incorrectas).** `401` «Palabras de seguridad incorrectas» (`routes_auth.py:365` y `:384`); la cuenta sigue bloqueada y no se emite token.
- **A6 (el segundo factor — FUERA DE ALCANCE).** **NUEVO — no existe en el backend vigente**: no hay ninguna coincidencia de `MFA`, `otp` ni `totp` en `app/`; `routes_auth.py:106-128` implementa solo usuario + clave y la documentación vigente lo declara «**No implementado (no hay TOTP ni OTP en el código)**». Por **DEC-G14** no se construye en este incremento: queda diferido como **RA-01**, con dueño (Dirección del proyecto) y fecha (ciclo propio posterior a D-98).

**Criterios de aceptación**

```gherkin
Dado un usuario COORDINADOR activo con 0 intentos fallidos
Cuando introduce su clave correcta en la APK
Entonces la API responde 200 con un token en una sola petición
Y la APK abre MONITOREO sin pedir ningún código adicional
```

```gherkin
Dado un usuario ADMIN activo con clave válida
Cuando envía una clave incorrecta 3 veces consecutivas
Entonces el primer y el segundo intento responden 401 con X-Intentos-Restantes = 2 y 1
Y el tercer intento responde 423 y deja usuario.bloqueado = true
Y ninguna de las 3 respuestas contiene un token
```

```gherkin
Dado un usuario SUPERVISOR bloqueado con sus 12 palabras de seguridad registradas
Cuando envía 3 de sus palabras correctas a POST /api/v1/auth/unlock
Entonces la API responde 200 con {"bloqueado": false}
Y el usuario puede iniciar sesión con su clave en el siguiente intento
```

```gherkin
Dado un usuario COORDINADOR recién autenticado en la APK
Cuando la APK construye la pantalla ACCESO y el flujo posterior
Entonces no existe ninguna pantalla, campo ni petición de segundo factor
Y no se invoca ningún endpoint de MFA, otp ni totp
```

```gherkin
Dado un usuario ADMIN activo
Cuando llega al login con su P00 y su clave
Entonces NO se exige ningún código de 6 dígitos
Y el sistema registra el inicio de sesión con el rol resultante
```

**Restricciones (EARS)**

- Mientras RNF-APK-04 no se implemente, el sistema **deberá** emitir el token con `P00` + clave y **sin** segundo factor para `ADMIN`, `SUPERVISOR` y `COORDINADOR` (DEC-G14).
- **RNF-APK-04 (MFA obligatorio para los roles de gestión) queda incumplido por decisión expresa**: la dirección del proyecto acepta el riesgo **RA-01** con dueño y fecha de cierre, y el incumplimiento se documenta en el manual de seguridad (DEC-G14, §3.2 del incremento).
- Cuando la clave falle **3** veces consecutivas, el sistema **deberá** bloquear la cuenta (`usuario.bloqueado = true`) y responder `423` (RNF-22, `routes_auth.py:109-116`).
- Cuando el usuario aporte **3** de sus **12** palabras correctas, el sistema **deberá** desbloquear la cuenta o restablecer la clave según el endpoint invocado (`routes_auth.py:364-391`).

---

## CU-D95-03 · Navegar por la APK según el rol autenticado

| | |
|---|---|
| **Actor** | `SUP`, `ADM`, `COO`, `TEC` |
| **Objetivo** | Ver únicamente las secciones del rol y abrir cualquiera de ellas en un toque |
| **Precondición** | Sesión iniciada (CU-D95-01) |
| **Postcondición** | Se muestra la sección elegida; ninguna sección fuera del rol es accesible |
| **Requisitos** | RF-APK-27, RNF-APK-05 |
| **Decisiones** | DEC-G2, DEC-G3, DEC-G7, DEC-G16 |

**Flujo principal**

1. La APK calcula el menú a partir de `SesionUsuario.rol`.
2. `SUPERVISOR` y `ADMIN` (mismo alcance, DEC-G3) ven **8** secciones: `MONITOREO`, `ESPECIALES`, `DESPACHO`, `CASOS`, `GESTIÓN`, `ALERTAS`, `MENSAJES`, `USUARIO`.
3. `COORDINADOR` ve **6** secciones: `MONITOREO`, `ESPECIALES` (crear), `FALLAS MASIVAS` (lectura + material), `ALERTAS`, `MENSAJES`, `USUARIO`; **no** ve `GESTIÓN` (DEC-G7) ni `DESPACHO`.
4. `TECNICO` conserva su menú de campo vigente: `CASOS`, `ALERTAS`, `MENSAJES`, `USUARIO`.
5. Al pulsar una sección, la APK abre la pantalla y arranca el refresco de 5 min (CU-D95-05).
6. El botón **Atrás** vuelve al menú sin cerrar la sesión; **Salir** limpia la sesión y el temporizador.

**Flujos alternativos**

- **A1 (rol desconocido o vacío).** La APK muestra solo `USUARIO` y `Salir`; ninguna pantalla de datos se abre.
- **A2 (navegación directa por ruta interna a una sección prohibida).** La APK redirige a `MONITOREO` (o a `CASOS` si el rol es `TECNICO`) y no renderiza la pantalla; en WEB el guard `RutaGestion` (`app/web/src/components/RutaGestion.tsx:13`) redirige al TÉCNICO a `/`.
- **A3 (`SUPER`).** Acceso total: ve las 8 secciones de gestión **y** las de campo; es el único que además ve `SISTEMAS` y la **vista de auditoría en solo lectura** sobre `auditoria` (DEC-G17; **NUEVO — no existe en el backend vigente**: hoy no hay ningún `GET` de `auditoria`).
- **A4 (sesión expirada en segundo plano).** Al volver a primer plano, un `401` devuelve a `ACCESO` (patrón vigente en `api_client.dart`, interceptor `onSesionExpirada`).

**Criterios de aceptación**

```gherkin
Dado un usuario SUPERVISOR autenticado en la APK
Cuando abre el menú principal
Entonces ve exactamente 8 secciones: MONITOREO, ESPECIALES, DESPACHO, CASOS, GESTIÓN, ALERTAS, MENSAJES, USUARIO
```

```gherkin
Dado un usuario ADMIN autenticado en la APK
Cuando abre el menú principal
Entonces ve las mismas 8 secciones que el SUPERVISOR
Y no ve la sección SISTEMAS
```

```gherkin
Dado un usuario COORDINADOR autenticado en la APK
Cuando abre el menú principal
Entonces NO ve la sección GESTIÓN
Y NO ve la sección DESPACHO
Y SÍ ve MONITOREO, ESPECIALES, FALLAS MASIVAS, ALERTAS, MENSAJES y USUARIO
```

```gherkin
Dado un usuario TECNICO autenticado en la APK
Cuando abre el menú principal
Entonces ve CASOS, ALERTAS, MENSAJES y USUARIO
Y no ve ninguna de las 8 secciones de gestión
```

**Restricciones (EARS)**

- Mientras el rol autenticado sea `TECNICO`, el sistema **no deberá** ofrecer ninguna entrada de menú de gestión (RF-APK-27).
- Si el rol es `ADMIN`, entonces el sistema **deberá** habilitar exactamente el mismo menú de gestión que `SUPERVISOR` (DEC-G3).
- El sistema **deberá** mantener los objetivos táctiles ≥ 48 dp, el contraste ≥ 4.5:1 y el texto ≥ 16 sp en el menú y las pantallas nuevas (RNF-APK-05).

---

## CU-D95-04 · Consultar el monitoreo de la gestión en sus 5 vistas

| | |
|---|---|
| **Actor** | `SUP`, `ADM` (gestión) · `COO` (solo lectura) |
| **Objetivo** | Ver el estado de la gestión en la vista Diaria, Semanal, Mensual, Casos especiales o Construcciones |
| **Precondición** | Sesión iniciada; hay datos de la central del usuario en el período elegido |
| **Postcondición** | Se muestran los indicadores de la vista elegida, sin modificar datos |
| **Requisitos** | RF-APK-13, RF-APK-18, RNF-APK-01, RNF-APK-02, RNF-APK-06 |
| **Decisiones** | DEC-G1, DEC-G3, DEC-G5, DEC-G6, DEC-G18 |

**Flujo principal**

1. El usuario abre `MONITOREO`; la APK carga por defecto la vista **Diaria** con la fecha operativa de hoy.
2. El sistema pide `GET /api/v1/monitoreo/diario?fecha=<hoy>` (`routes_monitoreo.py:56`) y pinta las fichas del día.
3. El usuario cambia el selector a **Semanal** → `GET /monitoreo/semanal?desde=<lunes>` (curva lunes a sábado).
4. El usuario cambia a **Mensual** → `GET /monitoreo/globales?desde=<día 1>&hasta=<hoy>`.
5. El usuario cambia a **Casos especiales** → `GET /monitoreo/reparacion` + `GET /casos-especiales` (`routes_especiales.py:128`).
6. El usuario cambia a **Construcciones** → `GET /monitoreo/construccion`.
7. En `SUPERVISOR`/`ADMIN` se añaden las fichas de gestión `GET /monitoreo/reclasificaciones` y `GET /monitoreo/identificadores` (`routes_monitoreo.py:145` y `:156`, ambas con `require_roles("ADMIN","SUPERVISOR")`).
8. La pantalla muestra `actualizado hh:mm` y el botón de refresco manual (CU-D95-05).

**Flujos alternativos**

- **A1 (`COORDINADOR`).** **NUEVO — no existe en el backend vigente** para las métricas de gestión: los endpoints de gestión exigen `ADMIN`/`SUPERVISOR` (`_gestion` en `routes_monitoreo.py:22`) y hoy el `COORDINADOR` no existe; RT-APK-05 debe acotar ese `require_roles`. Sin ese cambio, el Coordinador recibe `403` en las fichas de reclasificaciones e identificadores y la pantalla las oculta.
- **A2 (`TECNICO`).** El endpoint es accesible con `get_current_user`, pero `_alcance()` (`routes_monitoreo.py:41-50`) **fuerza su cuadrilla** e ignora cualquier `id_cuadrilla` enviado. La APK no ofrece esta pantalla al TÉCNICO (CU-D95-03).
- **A3 (período sin datos).** Se muestra «Sin casos en el período» con el rango consultado; no se pinta una tabla vacía.
- **A4 (filtro por cuadrilla).** El parámetro `id_cuadrilla` limita el resultado; la APK lo ofrece como filtro y conserva la selección al cambiar entre las 5 vistas.
- **A5 (sin conexión).** Se muestra la última lectura cacheada con el aviso «sin conexión» (CU-D95-06).

**Criterios de aceptación**

```gherkin
Dado un Supervisor autenticado con 12 casos gestionados hoy en su central
Cuando abre la vista Diaria de MONITOREO
Entonces la pantalla muestra los indicadores del día con fecha igual a la fecha operativa
Y el encabezado muestra "actualizado" con la hora de la consulta
```

```gherkin
Dado un Supervisor en MONITOREO
Cuando cambia el selector a Semanal
Entonces la pantalla muestra la curva de lunes a sábado con 6 filas de día
Y la petición enviada es GET /api/v1/monitoreo/semanal?desde=<lunes de la semana>
```

```gherkin
Dado un Coordinador autenticado
Cuando abre la vista Mensual de MONITOREO
Entonces la pantalla muestra los indicadores de la central de su usuario
Y la petición enviada es GET /api/v1/monitoreo/globales?desde=<día 1>&hasta=<hoy>
Y no muestra las fichas de reclasificaciones ni de identificadores de pago
```

```gherkin
Dado un Supervisor en MONITOREO con el filtro de cuadrilla "C-002" seleccionado
Cuando cambia de la vista Diaria a la vista Construcciones
Entonces las dos vistas conservan el filtro de cuadrilla C-002
```

**Restricciones (EARS)**

- El sistema **deberá** ofrecer exactamente **5** vistas de monitoreo: Diaria, Semanal, Mensual, Casos especiales y Construcciones (RF-APK-13, RF-APK-18).
- Mientras el rol sea `COORDINADOR`, el sistema **deberá** mostrar las 5 vistas en solo lectura, sin ninguna acción de escritura (DEC-G1, DEC-G13).
- El sistema **deberá** acotar todas las consultas de monitoreo a `usuario.id_central`, derivando la central del token y **rechazando con `403`** cualquier `id_central` de la petición que no coincida con `usuario.id_central` (DEC-G6, **H-01**). **A implementar**: hoy `resolver_central` acepta el `id_central` del cliente sin compararlo (`app/services/consultas.py:20-29`) — ver CU-D95-22.
- El sistema **deberá** responder las pantallas de monitoreo con p95 ≤ 2 s y **0 errores 5xx** (RNF-APK-06, DEC-G18).

---

## CU-D95-05 · Refrescar automáticamente cada 5 minutos con presupuesto de peticiones

| | |
|---|---|
| **Actor** | `SUP`, `ADM`, `COO` |
| **Objetivo** | Mantener fresca **solo la pantalla visible** sin intervención, con refresco manual y con un tope de peticiones medible |
| **Precondición** | Hay **una** pantalla de gestión en primer plano y sesión válida |
| **Postcondición** | La pantalla visible se recarga cada 5 min ±30 s dentro del presupuesto de peticiones y muestra `actualizado hh:mm` |
| **Requisitos** | RF-APK-28, RNF-APK-01, RNF-APK-02, RNF-APK-06 |
| **Decisiones** | DEC-G4, DEC-G5, DEC-G18 (H-06/H-11) |

**Flujo principal**

1. Al abrir una pantalla de gestión, la APK arranca **un solo** temporizador de `5 min` para esa pantalla.
2. Al cumplirse el intervalo, la APK reejecuta la consulta de **la pantalla visible**; las pantallas no visibles (pestañas y vistas no seleccionadas) **no** generan peticiones.
3. Al terminar, actualiza el indicador de frescura a `actualizado hh:mm` e incrementa el contador de peticiones del token.
4. El botón **Actualizar** relanza la consulta de inmediato y reinicia el temporizador.
5. Si el usuario pasa la app a segundo plano, la APK cancela el temporizador; al volver a primer plano lo rearranca y refresca una vez.

**Flujos alternativos**

- **A1 (la respuesta anterior sigue en vuelo).** El refresco **no** se solapa: el temporizador no dispara una segunda petición hasta que la primera termina.
- **A2 (falla de red en el refresco).** Se conserva el contenido anterior y el indicador pasa a `sin conexión · actualizado hh:mm`; el temporizador sigue vivo y reintenta en el siguiente ciclo.
- **A3 (`401` en el refresco).** Sesión expirada: se cancela el temporizador y la APK vuelve a `ACCESO`.
- **A4 (`403` en el refresco).** Se muestra «No tiene permisos para esta sección» y **no** se reintenta esa pantalla.
- **A5 (pantalla de formulario de escritura abierta).** El refresco automático **se pausa** mientras hay un formulario con cambios sin guardar, para no perder lo tecleado; el botón manual sigue disponible y avisa antes de recargar.
- **A6 (tope de peticiones del token alcanzado).** La APK **no** dispara la petición del ciclo, muestra `sin refrescar · tope alcanzado` conservando el contenido anterior y **no** encadena reintentos; el usuario solo puede refrescar con el botón manual.
- **A7 (fallo reiterado del refresco).** Tras **3** refrescos consecutivos fallidos la APK pasa a **backoff** (el intervalo se duplica hasta 20 min), mantiene el aviso `sin conexión · actualizado hh:mm` y deja de golpear el endpoint; al primer éxito vuelve a 5 min.
- **A8 (pérdida de foco de la pantalla visible).** Si el usuario cambia de pantalla, el temporizador se **reasigna** a la nueva pantalla visible: nunca hay dos temporizadores activos a la vez.

**Criterios de aceptación**

```gherkin
Dado un Supervisor en la pantalla MONITOREO con reloj simulado
Cuando transcurren 5 minutos y 00 segundos en primer plano
Entonces la APK ejecuta exactamente 1 petición de refresco
Y el indicador de frescura muestra la hora de esa respuesta
Y a los 10 minutos acumulados se han ejecutado exactamente 2 refrescos
```

```gherkin
Dado un Supervisor en la pantalla GESTIÓN con una consulta en curso
Cuando el temporizador cumple su intervalo
Entonces la APK no lanza una segunda petición hasta que la primera termine
Y solo hay una petición en vuelo en todo momento
```

```gherkin
Dado un Supervisor en la pantalla ALERTAS
Cuando pulsa el botón "Actualizar"
Entonces la APK ejecuta la consulta de inmediato
Y el contador del temporizador se reinicia a 5 minutos
```

```gherkin
Dado un Supervisor en la pantalla DESPACHO con un formulario de asignación a medio llenar
Cuando el temporizador cumple su intervalo
Entonces la APK no recarga la pantalla
Y los valores ya introducidos siguen visibles
```

```gherkin
Dado un Supervisor en la pantalla MONITOREO
Cuando la app pasa a segundo plano y vuelve a primer plano a los 30 minutos
Entonces no se ejecutan 6 refrescos acumulados
Y se ejecuta 1 solo refresco al volver
```

```gherkin
Dado un Supervisor con MONITOREO abierto y la pestaña "Casos especiales" sin seleccionar
Cuando transcurren 30 minutos en primer plano sin cambiar de pestaña
Entonces la APK ejecuta exactamente 6 refrescos, todos de la pantalla visible
Y no ejecuta ninguna petición de refresco de la pestaña no seleccionada
```

```gherkin
Dado un Coordinador con el tope de refrescos por token configurado en 12 peticiones/hora
Cuando el temporizador cumple su intervalo por decimotercera vez en la hora
Entonces la APK no envía la petición
Y muestra el aviso "sin refrescar · tope alcanzado" conservando el contenido anterior
Y el usuario puede seguir usando el botón manual
```

```gherkin
Dado un Supervisor en la pantalla ALERTAS con la red caída
Cuando el refresco automático falla 3 veces consecutivas
Entonces la APK aplica backoff y no repite la petición antes de 10 minutos
Y mantiene la banda "sin conexión · actualizado hh:mm"
Y al recuperar la red el intervalo vuelve a 5 minutos
```

**Restricciones (EARS)**

- Mientras haya una pantalla de gestión en primer plano, el sistema **deberá** refrescar su contenido cada **5 minutos ±30 s** (RNF-APK-01).
- Mientras la aplicación esté en segundo plano, el sistema **deberá** mantener cancelado el temporizador de refresco (RNF-APK-01).
- El sistema **deberá** ejecutar como máximo **una** petición de refresco simultánea por pantalla (RNF-APK-01).
- El sistema **deberá** mostrar en cada pantalla de gestión la marca `actualizado hh:mm` y un botón de refresco manual (RF-APK-28).
- El sistema **deberá** refrescar **únicamente la pantalla visible**, con un tope de peticiones por token configurable, y **no deberá** encadenar peticiones cuando el refresco falle (RNF-APK-06, DEC-G18).
- Cuando el refresco falle **3** veces consecutivas, el sistema **deberá** aplicar backoff duplicando el intervalo hasta un máximo de **20** minutos (RNF-APK-06).
- El sistema **deberá** sostener p95 ≤ 2 s y **0 errores 5xx** en las pantallas de gestión, con **prueba de carga obligatoria** antes del cierre de D-97 y D-98 (RNF-APK-06, DEC-G18).

---

## CU-D95-06 · Consultar sin conexión con enmascaramiento visual y caché sin cifrar

| | |
|---|---|
| **Actor** | `SUP`, `ADM`, `COO` |
| **Objetivo** | Revisar el último contenido conocido sin red, con los datos personales **enmascarados en pantalla** según el rol, sin poder escribir |
| **Precondición** | Existe al menos una lectura previa guardada en la caché local de esa pantalla |
| **Postcondición** | Se muestra el contenido cacheado con aviso y con la PII enmascarada visualmente; ninguna escritura se envía |
| **Requisitos** | RNF-APK-02, RNF-APK-01 |
| **Decisiones** | DEC-G4, DEC-G19 (riesgo aceptado **RA-02**) |
| **Estado del requisito** | La caché local **NO se cifra** en este incremento: solo hay enmascaramiento visual (DEC-G19) |

**Flujo principal**

1. Sin conexión, el usuario abre una pantalla de gestión.
2. La APK detecta la ausencia de red y **no** intenta la petición.
3. Muestra el último contenido cacheado con la banda `Sin conexión · último dato hh:mm dd/mm`.
4. Antes de pintar, la APK aplica el **enmascaramiento visual por rol** de la PII (teléfono `70*`, nombre y dirección).
5. Las acciones de escritura (`Asignar`, `Quitar del despacho`, `Crear especial`, `Enviar mensaje`, `Solicitar material`, `Nuevo caso`, `Editar`) se muestran **deshabilitadas**.
6. Al recuperar la conexión, el sistema refresca la pantalla y habilita las acciones.

**Flujos alternativos**

- **A1 (no hay caché de esa pantalla).** Se muestra «Sin datos guardados: conéctese para consultar» y **no** se inventa un contenido vacío.
- **A2 (el usuario pulsa una acción de escritura desde una pantalla cacheada).** La APK informa «Esta acción requiere conexión» **antes** de intentarla y no la envía; no queda en cola (a diferencia del flujo del TÉCNICO, CU-D95-18).
- **A3 (se cae la red entre la apertura y el envío de una escritura).** La API no recibe la petición; la APK informa el fallo y ofrece reintentar; no se muestra éxito falso.
- **A4 (dato antiguo).** Si el último dato tiene más de 24 h, la banda lo rotula además con `dato antiguo`. Es **solo un rótulo visual**: la copia **no** caduca, **no** se purga y **no** se cifra (RA-02).
- **A5 (PII en la copia local — riesgo aceptado).** La caché guarda el JSON con `telefono`, `nombre_cliente` y `direccion` **en claro**, sin cifrado ni borrado al cerrar sesión: la base local vigente ya lo hace así (`app_movil/lib/core/database.dart:37-46,214-247`). El enmascaramiento del paso 4 es de **presentación** y no altera el contenido almacenado.

**Criterios de aceptación**

```gherkin
Dado un Supervisor con "C-001" en la caché de GESTIÓN de las 09:15 de hoy
Cuando abre GESTIÓN en modo avión
Entonces la pantalla muestra los mismos 8 casos del caché
Y muestra la banda "Sin conexión · último dato 09:15"
Y los botones Asignar y Quitar del despacho están deshabilitados
Y no se envía ninguna petición HTTP
```

```gherkin
Dado un Coordinador sin conexión en la pantalla ESPECIALES
Cuando pulsa "Crear caso especial"
Entonces la APK muestra "Esta acción requiere conexión"
Y no envía la petición ni la deja en cola
```

```gherkin
Dado un Supervisor sin conexión que nunca abrió la pantalla ALERTAS
Cuando abre ALERTAS en modo avión
Entonces la pantalla muestra "Sin datos guardados: conéctese para consultar"
Y no muestra una tabla vacía
```

```gherkin
Dado un caso cacheado con teléfono 7012345678, nombre "María Pérez" y dirección "Av. Sucre 45"
Cuando un Coordinador abre esa pantalla desde la caché
Entonces ve el teléfono como "70*******"
Y ve el nombre como "M. P."
Y ve la dirección sin el número de casa
Y no ve la cadena "7012345678" ni "Av. Sucre 45" en ningún campo de la pantalla
```

```gherkin
Dado un caso cacheado con teléfono 7012345678 y nombre "María Pérez"
Cuando un Supervisor o un Administrador abre esa pantalla
Entonces ve el teléfono, el nombre y la dirección completos
Y la caché en disco sigue conteniendo el valor "7012345678" en claro
Y la APK no declara que el dato esté cifrado
```

**Restricciones (EARS)**

- Mientras no haya conexión, el sistema **deberá** mostrar el último contenido cacheado con su marca de hora y el aviso «sin conexión» (RNF-APK-02).
- Si no existe caché de la pantalla, entonces el sistema **deberá** informar la ausencia de datos sin simular un contenido vacío (RNF-APK-02).
- El sistema **deberá** exigir conexión para **toda** escritura de las pantallas de gestión e informarlo antes de intentarla (RNF-APK-02, DEC-G4).
- Cuando la pantalla muestre PII, el sistema **deberá** aplicar el reparto de enmascaramiento visual por rol: `COORDINADOR` → teléfono `70*` como `70*******`, nombre como iniciales y dirección sin número de casa; `SUPERVISOR`/`ADMIN` → valores completos (DEC-G19, RNF-18).
- **RA-02 (riesgo aceptado formalmente):** el sistema **no deberá** cifrar la caché local, ni aplicarle TTL, ni activar `FLAG_SECURE`, ni bloquear la app con PIN o biometría en este incremento; el riesgo se reevalúa cuando CANTV designe responsable de protección de datos (DEC-G19, §3.2 del incremento).
- El sistema **no deberá** mostrar al usuario ningún texto que afirme que la copia local está cifrada, protegida o se borra al cerrar sesión (DEC-G19).

---

## CU-D95-07 · Listar, filtrar y abrir la ficha de un caso especial

| | |
|---|---|
| **Actor** | `SUP`, `ADM` (acceso pleno) · `COO` (solo lectura) |
| **Objetivo** | Encontrar un caso especial y abrir su ficha con el caso asociado |
| **Precondición** | Sesión iniciada; existen casos especiales en la central |
| **Postcondición** | Se muestra la ficha del especial y su caso asociado, sin modificar datos |
| **Requisitos** | RF-APK-14, RNF-APK-01 |
| **Decisiones** | DEC-G3, DEC-G6 |

**Flujo principal**

1. El usuario abre `ESPECIALES`; la APK pide `GET /api/v1/casos-especiales` (`routes_especiales.py:128`).
2. La APK pinta la tabla con: sector, solicitante (nombre y unidad), dirección, nombre del caso, clasificación, tipo de actividad, prioridad y estado.
3. El usuario filtra por clasificación, estado, prioridad, tipo de actividad o texto libre (`q`, que busca en avería, dirección, nombre, teléfono, sector, solicitante, clasificación, tipo, prioridad, estado y descripción).
4. La APK envía los filtros como parámetros del mismo endpoint (`clasificacion`, `estado`, `prioridad`, `tipo_actividad`, `id_solicitante`, `q`, `solo_pendientes`).
5. El usuario toca un renglón; la APK pide `GET /casos-especiales/{id_caso_especial}` (`routes_especiales.py:242`) y pide el caso asociado con `GET /casos/{id_caso}`.
6. La ficha muestra los iconos ya calculados por el servidor: `pendiente`, `asignado`, `citado`, `gestion` y la cuadrilla del último despacho (`_resumen_especiales`, `routes_especiales.py:269-353`).

**Flujos alternativos**

- **A1 (`COORDINADOR`).** **NUEVO — no existe en el backend vigente**: el listado y la ficha usan `get_current_user` (no exigen rol de escritura), pero hoy no hay rol `COORDINADOR`; RT-APK-05 debe confirmarlo. El Coordinador **no** ve los botones de edición.
- **A2 (sin resultados).** Se muestra «Sin casos especiales con esos filtros» y el botón para limpiarlos.
- **A3 (`403`).** Se oculta la sección y se informa; no se reintenta.
- **A4 (especial sin caso asociado).** La ficha muestra «Sin caso asociado» y las columnas derivadas quedan vacías (`caso = None` en `_resumen_especiales`).
- **A5 (especial citado o en gestión).** El icono correspondiente se pinta con el color del estado; el caso asociado abre la ficha con la pestaña de agenda o de despacho.

**Criterios de aceptación**

```gherkin
Dado un Supervisor con 34 casos especiales en su central, 6 de clasificación EMPRESA
Cuando abre ESPECIALES y filtra clasificación = EMPRESA
Entonces la tabla muestra exactamente 6 renglones
Y la petición enviada es GET /api/v1/casos-especiales?clasificacion=EMPRESA
```

```gherkin
Dado un Supervisor en la tabla de ESPECIALES
Cuando toca el renglón del especial 118
Entonces la APK pide GET /api/v1/casos-especiales/118
Y muestra sector, solicitante, dirección, prioridad y estado
Y muestra el enlace al caso asociado
```

```gherkin
Dado un Coordinador en la ficha de un caso especial
Cuando abre la ficha
Entonces ve todos los datos de lectura
Y no ve ningún botón de edición ni de cambio de estado
```

**Restricciones (EARS)**

- Mientras el rol sea `COORDINADOR`, el sistema **deberá** mostrar `ESPECIALES` en modo solo lectura (DEC-G1).
- El sistema **deberá** calcular los iconos de pendiente/asignado/citado/gestion en el servidor, de modo que la APK y la WEB muestren el mismo valor (D-72/D-80).
- El sistema **deberá** acotar el listado y la ficha a `usuario.id_central` (DEC-G6, **H-01**). **A implementar**: hoy `GET /casos-especiales` y su ficha usan `get_current_user` sin filtro de central (`routes_especiales.py:128-144,242-249`) — ver CU-D95-22.

---

## CU-D95-08 · Crear un caso especial con su caso asociado

| | |
|---|---|
| **Actor** | `COO` · `SUP`, `ADM` |
| **Objetivo** | Registrar un caso especial (empresa, referido o gobierno) con su caso asociado, solicitante, clasificación, actividad y prioridad |
| **Precondición** | Sesión iniciada; el rol puede escribir; hay conexión |
| **Postcondición** | Existe una fila de `caso_especial` con su caso asociado y su `id_averia` |
| **Requisitos** | RF-APK-19, RF-APK-18, RNF-APK-02 |
| **Decisiones** | DEC-G1, DEC-G4, DEC-G8 |

**Flujo principal**

1. El usuario abre `ESPECIALES` y pulsa **Nuevo**.
2. La APK exige **conexión**; sin ella informa y no abre el formulario (CU-D95-06/A2).
3. El usuario completa: `clasificacion` (EMPRESA/REFERIDO/GOBIERNO), `tipo_actividad` (REPARACION/CONSTRUCCION), `prioridad`, `descripcion`, `nombre_cliente`, `direccion`, `telefono` y el solicitante (existente por `id_solicitante` **o** nuevo con `crear_solicitante`).
4. La APK envía `POST /api/v1/casos-especiales` (`routes_especiales.py:189`).
5. El servidor crea el caso asociado (`_crear_caso_asociado`, `routes_especiales.py:73`): genera `id_averia` con `generar_id_averia_ref` si no se indicó, clasifica el teléfono con la regla vigente (70\* → identificador de pago; otro → contacto) y sectoriza la dirección.
6. El servidor aplica la regla REPARACIÓN ⇐ 70\* + avería real (D-90) y crea o actualiza la ficha **idempotente** del especial.
7. La APK refresca el listado y muestra la ficha creada con su `id_caso_especial`.

**Flujos alternativos**

- **A1 (se envían `id_solicitante` y `crear_solicitante` juntos).** `422` «Indique `id_solicitante` o `crear_solicitante`, no ambos» (`routes_especiales.py:196-200`).
- **A2 (`id_averia` ya existente).** `409` «Ya existe un caso con id_averia …» (`routes_especiales.py:79-80`); la APK ofrece abrir el caso existente.
- **A3 (`id_caso` inexistente).** `404` «Caso no encontrado».
- **A4 (teléfono que cumple el patrón del identificador de pago).** Se resuelve/crea la ficha de `identificador_pago` y se enlaza; **no** se guarda como contacto (`_crear_caso_asociado`, `routes_especiales.py:91-95`).
- **A5 (REPARACIÓN sin 70\* o sin avería real).** La regla D-90 reclasifica el caso a `REFERIDO` con chip de causa; la ficha del especial igualmente se crea.
- **A6 (doble pulsación de Guardar).** La ficha del especial es idempotente (una sola por caso, `routes_especiales.py:224-227`); la APK deshabilita el botón mientras hay una petición en vuelo.
- **A7 (aviso de posible duplicado).** **NUEVO — no existe en el backend vigente**: el riesgo R3 del incremento pide avisar de duplicados; hoy solo lo acota la unicidad de `id_averia`. La APK debe mostrar un aviso cuando el `id_averia` o el teléfono tecleados coincidan con un especial de los últimos 30 días.

**Criterios de aceptación**

```gherkin
Dado un Coordinador con conexión en el formulario de caso especial
Cuando registra una EMPRESA con actividad REPARACION y prioridad ALTA sin indicar id_averia
Entonces la API responde 201 con un caso_especial de clasificacion EMPRESA
Y el caso asociado recibe un id_averia con el formato REF-<CÓDIGO_CENTRAL>-<NNNNNN>
Y la ficha del especial muestra esa clasificación, esa actividad y esa prioridad
```

```gherkin
Dado un Coordinador en el formulario de caso especial
Cuando envía id_solicitante = 7 y además los datos de crear_solicitante
Entonces la API responde 422 con "Indique `id_solicitante` o `crear_solicitante`, no ambos"
Y no se crea ningún caso especial
```

```gherkin
Dado un caso con id_averia "REF-FS-000412"
Cuando el Coordinador crea un especial indicando ese mismo id_averia
Entonces la API responde 409
Y la APK ofrece abrir el caso existente
```

```gherkin
Dado un Coordinador sin conexión en la pantalla ESPECIALES
Cuando pulsa "Nuevo"
Entonces la APK muestra "Esta acción requiere conexión"
Y no abre el formulario
```

**Restricciones (EARS)**

- Si el rol es `COORDINADOR`, entonces el sistema **deberá** permitir **únicamente el alta** de casos especiales, sin edición ni cambio de estado (DEC-G1, §5 de RBAC propuesta).
- Cuando se cree un caso especial sin `id_averia`, el sistema **deberá** generar uno con `generar_id_averia_ref(:central)`.
- El sistema **deberá** crear a lo sumo **una** fila de `caso_especial` por caso (idempotencia D-90).
- El sistema **deberá** crear el caso asociado **en la central del usuario autenticado** (`usuario.id_central`), sin aceptar `id_central` de la petición (DEC-G6, **H-01**). **A implementar**: hoy `_crear_caso_asociado` resuelve la central con `resolver_central(db, None, config)`, es decir la de `ingesta.central_codigo`, **no** la del usuario (`routes_especiales.py:73-78`) — ver CU-D95-22.
- El sistema **no deberá** conceder al rol `COORDINADOR` ninguna escritura sobre fallas masivas distinta de la orden de material (DEC-G8, **H-05**).

---

## CU-D95-09 · Armar y publicar el despacho del día

| | |
|---|---|
| **Actor** | `SUP`, `ADM` |
| **Objetivo** | Repartir el universo de casos por cuadrilla y publicar el despacho del día |
| **Precondición** | Sesión iniciada; hay cuadrillas activas del día y casos elegibles en la central |
| **Postcondición** | Despachos del día en estado `PUBLICADO` y notificación enviada a cada cuadrilla |
| **Requisitos** | RF-APK-15, RNF-APK-02 |
| **Decisiones** | DEC-G3, DEC-G4 |

**Flujo principal**

1. El usuario abre `DESPACHO` (pestaña **Proceso**).
2. La APK pide `GET /api/v1/despachos/proceso?fecha=<hoy>` (`routes_despachos.py:179`) y pinta el universo de casos, los sectores y la asignación por cuadrilla del día.
3. El usuario ajusta los sectores de cada cuadrilla y guarda con `PUT /api/v1/despachos/asignacion` (`routes_despachos.py:192`), que devuelve el proceso recalculado.
4. El usuario pulsa **Procesar**; la APK envía `POST /api/v1/despachos/procesar` (`routes_despachos.py:209`) con `fecha`, `id_central`, `asignaciones` y `reemplazar`.
5. El servidor genera los borradores con `construir_propuesta` + `guardar_propuesta` y responde `201` con la lista de `DespachoOut`.
6. El usuario publica cada cuadrilla con `PATCH /api/v1/despachos/{id_despacho}` estado `PUBLICADO` (`routes_despachos.py:272`), que fija `enviado_en`.
7. El usuario puede imprimir la ficha con `GET /despachos/{id}/imprimible` o enviarla con `POST /despachos/{id}/enviar?canal=TELEGRAM|CORREO` (`routes_despachos.py:441` y `:576`).

**Flujos alternativos**

- **A1 (ya hay despachos `PUBLICADO` o `CERRADO` para esa fecha).** `409` «Ya hay despachos publicados o cerrados para esa fecha» (`routes_despachos.py:227-231`); la APK informa y bloquea la publicación.
- **A2 (ya existe un despacho del día y no se pidió `reemplazar`).** `409` «Ya existe un despacho para esa fecha (use reemplazar=true)».
- **A3 (dos supervisores editando el mismo despacho, riesgo R2).** El segundo recibe `409` al procesar; la APK muestra el mensaje y **no** descarta silenciosamente lo que el otro guardó.
- **A4 (cuadrilla 0).** La cuadrilla 0 **no** recibe sectores: solo los casos en GESTIÓN (`routes_despachos.py` D-77). La APK la muestra como un bloque sin sectores seleccionables.
- **A5 (envío de ficha con Telegram no configurado).** `POST /despachos/{id}/enviar` devuelve `estado = FALLIDO` con el error y guarda la notificación; la APK muestra el fallo y ofrece reenviar.
- **A6 (sin conexión).** No se puede procesar ni publicar; la APK muestra la última lectura del proceso con el aviso (CU-D95-06).

**Criterios de aceptación**

```gherkin
Dado un Supervisor con 3 cuadrillas de calle y la cuadrilla 0 activas y 120 casos elegibles
Cuando abre DESPACHO y procesa el día sin indicar reemplazar
Entonces la API responde 201
Y se crean 4 despachos en estado BORRADOR
Y el bloque de la cuadrilla 0 no presenta sectores seleccionables
```

```gherkin
Dado un despacho del día ya PUBLICADO
Cuando un segundo Supervisor intenta procesar la misma fecha
Entonces la API responde 409 con "Ya hay despachos publicados o cerrados para esa fecha"
Y la APK muestra ese motivo
Y el despacho publicado no cambia
```

```gherkin
Dado un Supervisor en la pestaña Proceso de DESPACHO
Cuando guarda la asignación de sectores de la cuadrilla C-002
Entonces la API responde 200 con el proceso recalculado
Y la pantalla refleja los sectores guardados de C-002
```

**Restricciones (EARS)**

- Si para la fecha ya existe un despacho `PUBLICADO` o `CERRADO`, entonces el sistema **deberá** rechazar el reproceso con `409`.
- El sistema **deberá** despachar los casos de la cuadrilla 0 a la propia cuadrilla 0, sin repartirlos por sector (D-77).
- El sistema **deberá** exigir conexión para guardar la asignación, procesar y publicar (DEC-G4).

---

## CU-D95-10 · Asignar y quitar un caso del despacho de la cuadrilla

| | |
|---|---|
| **Actor** | `SUP`, `ADM` |
| **Objetivo** | Ver los datos del caso y moverlo a la cuadrilla correcta (o sacarlo del despacho) desde su ficha |
| **Precondición** | Sesión iniciada y conexión; el caso no está en un despacho `PUBLICADO`/`CERRADO` |
| **Postcondición** | El caso queda en el borrador de la cuadrilla destino (o fuera del despacho del día) y la APK informa el resultado |
| **Requisitos** | RF-APK-16, RF-APK-17, RNF-APK-02 |
| **Decisiones** | DEC-G3, DEC-G7 |

**Flujo principal**

1. El usuario abre `CASOS` (`GET /api/v1/casos` con filtros de sector, estado, tipo, cuadrilla y fechas, `routes_casos.py:180`) o llega desde `GESTIÓN` (CU-D95-11).
2. Abre la ficha del caso (`GET /api/v1/casos/{id_caso}`, `routes_casos.py:444`) y consulta sus datos: avería, cliente, dirección, sector, tipo, clase, estado, identificador de pago y contacto.
3. El usuario pulsa **Asignar a cuadrilla**, elige la cuadrilla destino y confirma.
4. La APK envía `POST /api/v1/despachos/asignar-casos` (`routes_despachos.py:388`) con `id_cuadrilla`, `fecha`, `ids_caso` e `ids_caso_especial`.
5. El servidor crea o reutiliza el **borrador** del día de esa cuadrilla, agrega los casos y responde con `agregados`, `movidos`, `omitidos` y un `mensaje` («Cuadrilla C-002: 3 agregado(s), 1 movido(s) de otra cuadrilla, 2 omitido(s).»).
6. La APK muestra ese mensaje tal cual, refresca la ficha y el listado, y marca el caso como asignado.
7. Para desasignar, el usuario pulsa **Quitar del despacho**: la APK envía `POST /api/v1/despachos/quitar-casos` (`routes_despachos.py:419`) y muestra «N caso(s) fuera del despacho del día».

**Flujos alternativos**

- **A1 (no se indica cuadrilla).** `400` «Indique la cuadrilla destino» (`routes_despachos.py:400-401`).
- **A2 (casos omitidos por estar en despacho publicado o cerrado).** La respuesta los cuenta en `omitidos`; la APK los lista con nombre y motivo y **no** los presenta como asignados.
- **A3 (el caso se mueve de otra cuadrilla).** Se reporta en `movidos` y desaparece del borrador anterior.
- **A4 (asignar a la cuadrilla 0).** El servidor marca `en_gestion_supervisor = true` y el caso aparece en `GESTIÓN` (CU-D95-11); al asignarlo a una cuadrilla de calle, la marca se retira.
- **A5 (sin conexión).** La acción se bloquea con el aviso previo; no se encola (a diferencia del TÉCNICO).
- **A6 (caso especial en vez de caso común).** La APK envía su `ids_caso_especial`; el servidor lo asigna por la misma vía.

**Criterios de aceptación**

```gherkin
Dado un Supervisor con el caso AV-99812 en el borrador de la cuadrilla C-001 y en estado NUEVO
Cuando lo asigna a la cuadrilla C-002 desde su ficha
Entonces la API responde 200 con agregados = 1 y movidos = 1
Y el mensaje de la pantalla es "Cuadrilla C-002: 1 agregado(s), 1 movido(s) de otra cuadrilla."
Y el caso ya no figura en el borrador de C-001
```

```gherkin
Dado un caso incluido en un despacho PUBLICADO de C-001
Cuando el Supervisor lo asigna a C-002
Entonces la API responde 200 con omitidos = 1
Y la APK muestra el caso en la lista de omitidos con su motivo
Y el despacho publicado de C-001 no cambia
```

```gherkin
Dado un Supervisor que pulsa "Asignar a cuadrilla" sin elegir cuadrilla
Cuando confirma
Entonces la API responde 400 con "Indique la cuadrilla destino"
Y no se modifica ningún despacho
```

```gherkin
Dado un caso asignado a la cuadrilla 0
Cuando el Supervisor lo asigna a la cuadrilla C-003
Entonces el caso deja de aparecer en la pantalla GESTIÓN
Y aparece en el borrador de C-003
```

**Restricciones (EARS)**

- Si el caso está en un despacho `PUBLICADO` o `CERRADO`, entonces el sistema **deberá** omitirlo y reportarlo en `omitidos`.
- Cuando el destino sea la cuadrilla 0, el sistema **deberá** marcar el caso como gestión del supervisor (D-77).
- El sistema **deberá** informar en la APK los contadores `agregados`, `movidos` y `omitidos` que devuelve la API.

---

## CU-D95-11 · Operar la pantalla GESTIÓN de la cuadrilla 0

| | |
|---|---|
| **Actor** | `SUP`, `ADM` (el `COO` **no** la ve, DEC-G7) |
| **Objetivo** | Trabajar la bandeja de la cuadrilla 0: ver solo esos casos y poder asignarlos, quitarlos del despacho o abrir su ficha |
| **Precondición** | Sesión iniciada y conexión; la central tiene una cuadrilla 0 (`ux_cuadrilla_supervisor`) |
| **Postcondición** | El caso sale de la bandeja (asignado a una cuadrilla de calle) o se mantiene en ella, sin duplicar el filtro «Cuadrilla 0» de `CASOS` |
| **Requisitos** | RF-APK-17, RNF-APK-01 |
| **Decisiones** | DEC-G3, DEC-G7 |

**Flujo principal**

1. El usuario abre `GESTIÓN` (sección propia en el menú, DEC-G7).
2. La APK consulta **el mismo endpoint** de casos con el filtro de la cuadrilla 0: `GET /api/v1/casos?id_cuadrilla=<id de la cuadrilla 0>&page=1&page_size=25`; como respaldo equivalente, `GET /api/v1/casos?en_gestion_supervisor=true` (`routes_casos.py:193` y `:203`). **La pantalla es una vista, no lógica nueva** (riesgo R5).
3. La tabla muestra: avería, cliente, dirección, sector, tipo, clase, estado, fecha de reporte, cuadrilla del último despacho e identificador de pago.
4. La APK resuelve el `id` de la cuadrilla 0 desde `GET /api/v1/despachos/proceso` (bloque sin sectores, D-77) o desde el catálogo de cuadrillas; **nunca** lo teclea el usuario.
5. Cada renglón ofrece **tres** acciones: **Asignar**, **Quitar del despacho** y **Abrir ficha**.
6. Al asignar o quitar, la APK reutiliza los endpoints de CU-D95-10 y refresca la bandeja.
7. La pantalla muestra `actualizado hh:mm` y el botón de refresco manual (CU-D95-05).

**Flujos alternativos**

- **A1 (la central no tiene cuadrilla 0 configurada).** La APK muestra «Esta central no tiene cuadrilla 0» y **no** ofrece la sección en el menú.
- **A2 (bandeja vacía).** «No hay casos en gestión de la cuadrilla 0» con la fecha de consulta.
- **A3 (el usuario intenta cambiar el filtro de cuadrilla).** El filtro está **fijado** a la cuadrilla 0 y no es editable: si quiere otro universo usa `CASOS`.
- **A4 (más de 25 casos).** Paginación de 25 renglones con el total que devuelve `PaginaCasos.total`.
- **A5 (sin conexión).** Se muestra la última lectura con el aviso; las tres acciones quedan deshabilitadas.
- **A6 (`COORDINADOR` o `TECNICO` por ruta interna).** La sección no se renderiza y se redirige a `MONITOREO` (o a `CASOS`).

**Criterios de aceptación**

```gherkin
Dado un Supervisor de una central con 8 casos en la cuadrilla 0 y 300 casos en total
Cuando abre la pantalla GESTIÓN
Entonces la tabla muestra exactamente 8 renglones
Y la petición enviada es GET /api/v1/casos?id_cuadrilla=<id de la cuadrilla 0>&page=1&page_size=25
Y cada renglón ofrece Asignar, Quitar del despacho y Abrir ficha
```

```gherkin
Dado un Supervisor en GESTIÓN con el caso AV-99812 en la bandeja
Cuando lo asigna a la cuadrilla C-003 y el servidor responde agregados = 1
Entonces el caso desaparece de la bandeja de GESTIÓN
Y aparece en el borrador de C-003
```

```gherkin
Dado un Coordinador autenticado en la APK
Cuando abre el menú y navega a la sección GESTIÓN
Entonces la sección no está en el menú
Y la navegación directa a GESTIÓN lo redirige a MONITOREO
```

```gherkin
Dado un Supervisor en GESTIÓN con 60 casos en la bandeja
Cuando consulta la bandeja
Entonces ve 25 renglones en la primera página
Y el paginador indica un total de 60
```

**Restricciones (EARS)**

- Mientras el rol sea `ADMIN` o `SUPERVISOR`, el sistema **deberá** ofrecer la pantalla GESTIÓN con las acciones de asignar, quitar y abrir ficha (DEC-G7).
- Si el rol es `COORDINADOR` o `TECNICO`, entonces el sistema **no deberá** mostrar la pantalla GESTIÓN.
- El sistema **deberá** obtener los casos de la cuadrilla 0 del mismo endpoint que alimenta el filtro «Cuadrilla 0» de `CASOS`, sin lógica de filtrado propia (R5).

---

## CU-D95-12 · Gestionar la bandeja de mensajes del Supervisor

| | |
|---|---|
| **Actor** | `SUP`, `ADM` |
| **Objetivo** | Leer los mensajes recibidos del Coordinador y revisar los enviados a los técnicos |
| **Precondición** | Sesión iniciada; el Supervisor tiene cuenta con rol de gestión |
| **Postcondición** | Los mensajes del Coordinador figuran como leídos; no se modifica ningún caso |
| **Requisitos** | RF-APK-24, RT-APK-03 |
| **Decisiones** | DEC-G9, DEC-G15 |

**Flujo principal**

1. El usuario abre `MENSAJES`; la APK carga la **bandeja de recibidos** con `GET /api/v1/mensajes?ultimos=20` (`routes_mensajes.py:32`, parámetro de primera carga D-86).
2. La APK marca los visibles como leídos con `POST /api/v1/mensajes/leidos` (`routes_mensajes.py:71`) y consulta el contador con `GET /mensajes/no-leidos`.
3. El usuario cambia a la pestaña **Enviados**: la APK pide `GET /api/v1/mensajes/bandeja` (`routes_mensajes.py:53`), que hoy exige `require_roles("ADMIN","SUPERVISOR")`.
4. El usuario puede redactar un mensaje a los técnicos: `POST /api/v1/mensajes` con `destino_tipo` en `TODOS | CUADRILLA | TECNICO` y `tipo = TEXTO` (`routes_mensajes.py:61`, `mensaje_entities.py:26-28`).
5. La APK muestra, en cada mensaje recibido, el autor, la fecha y el cuerpo.

**Flujos alternativos**

- **A1 (bandeja de recibidos vacía).** «No tiene mensajes».
- **A2 (mensaje recibido de un Coordinador).** **NUEVO — no existe en el backend vigente**: el modelo actual no admite un destinatario-usuario (`mensaje_entities.py:28` y `:67-72`), `mensaje_destino` tiene clave `(id_mensaje, id_tecnico)` (`:81-86`) y `routes_mensajes.py:3` declara la mensajería «unidireccional supervisor → técnicos». Con **DEC-G15** el destino pasa a ser un **usuario** y se añade el fan-out al Supervisor: eso es CU-D95-20, del que este caso depende.
- **A3 (`403` en la pestaña Enviados).** Si el rol no está en `_envio`, la sección se oculta; con el rol `COORDINADOR` la bandeja de enviados debe resolverla RT-APK-05 (hoy `_envio` no lo incluye).
- **A4 (mensaje expirado).** El modelo exige `expira_en > creado_en` (`mensaje_entities.py:66`); los vencidos no se listan.
- **A5 (sin conexión).** Se muestra la última lectura cacheada con su hora; el envío queda deshabilitado.
- **A6 (cuerpo mayor de 500 caracteres).** La APK limita el campo a 500 caracteres (límite de `mensaje.cuerpo`, `mensaje_entities.py:48`).

**Criterios de aceptación**

```gherkin
Dado un Supervisor con 3 mensajes sin leer, uno de ellos del Coordinador
Cuando abre la pestaña de recibidos en MENSAJES
Entonces la petición enviada es GET /api/v1/mensajes?ultimos=20
Y ve los 3 mensajes con su autor y su fecha
Y al abrir el mensaje del Coordinador queda marcado como leído
Y el contador de GET /mensajes/no-leidos baja a 2
```

```gherkin
Dado un Supervisor en MENSAJES
Cuando envía un mensaje de tipo TEXTO a la cuadrilla C-001
Entonces la API responde 201 con destino_tipo = "CUADRILLA"
Y el mensaje aparece en la pestaña Enviados del Supervisor
```

```gherkin
Dado un Supervisor autenticado
Cuando intenta enviar un mensaje con destino_tipo = "SUPERVISOR"
Entonces la API responde 422
Y la APK no muestra el mensaje como enviado
```

**Restricciones (EARS)**

- El sistema **deberá** permitir al `SUPERVISOR` y al `ADMIN` enviar mensajes a los destinos `TODOS`, `CUADRILLA` y `TECNICO` (vigente, D-81).
- El sistema **no deberá** aceptar que un `SUPERVISOR` envíe con `destino_tipo = SUPERVISOR`: ese destino queda **reservado al `COORDINADOR`** (DEC-G9, DEC-G15).
- El sistema **deberá** limitar el cuerpo de un mensaje a 500 caracteres.
- Cuando el usuario destinatario sea un Supervisor, el sistema **deberá** entregarle el mensaje en su bandeja de recibidos y permitirle marcarlo como leído, con el mismo contador de no leídos (DEC-G15, RT-APK-03).

---

## CU-D95-13 · Enviar un mensaje a un Supervisor concreto de su central

| | |
|---|---|
| **Actor** | `COO` |
| **Objetivo** | Comunicar una novedad de su central a un **Supervisor concreto** y, si no hay ninguno disponible, **escalar al ADMIN** de su central |
| **Precondición** | Sesión de Coordinador iniciada; hay conexión; existe al menos un usuario `SUPERVISOR` activo en su central (o un `ADMIN` para el escalado) |
| **Postcondición** | El mensaje queda creado con origen `COORDINADOR` y destinatario **usuario** (Supervisor concreto, o el `ADMIN` de la central cuando se escala), visible en su bandeja |
| **Requisitos** | RF-APK-22, RT-APK-03, RNF-APK-02 |
| **Decisiones** | DEC-G1, DEC-G4, DEC-G9, DEC-G15 |

**Flujo principal**

1. El usuario abre `MENSAJES` (pestaña **Redactar**).
2. La APK exige conexión; sin ella muestra el aviso y deshabilita el envío (CU-D95-06/A2).
3. El usuario escribe el cuerpo (≤ 500 caracteres) y opcionalmente asocia un `id_caso` o una falla.
4. La APK pide la lista de **usuarios** con rol `SUPERVISOR` activos de su central y muestra el selector de **Supervisor concreto**; no permite elegir un Supervisor de otra central.
5. El usuario elige el Supervisor destinatario y pulsa **Enviar**.
6. La APK llama al endpoint dedicado del Coordinador con `destino_tipo = "SUPERVISOR"` y `id_usuario_destino` del elegido (RT-APK-03).
7. El servidor graba `mensaje.origen_p00` = P00 del Coordinador, valida que el destinatario es un usuario `SUPERVISOR` **activo de la misma central** y materializa el fan-out **al usuario** (una fila por destinatario-usuario).
8. La APK confirma el envío y muestra el mensaje en la pestaña **Enviados**; el Supervisor lo ve en su bandeja de recibidos.

**Flujos alternativos**

- **A1 (el rol `COORDINADOR` no está en `_envio`).** **NUEVO — no existe en el backend vigente**: `routes_mensajes.py:29` fija `_envio = require_roles("ADMIN","SUPERVISOR")`. DEC-G15 exige un **endpoint dedicado** para el Coordinador en lugar de ampliar `_envio`, que hoy aceptaría `TODOS`, `CUADRILLA` y `TECNICO` sin distinguir el rol del emisor (`routes_mensajes.py:61-68`, `services/mensajes.py:130-157`) — **H-10**.
- **A2 (`destino_tipo = "SUPERVISOR"` no admitido por el modelo).** **NUEVO — no existe en el backend vigente**: `TIPOS_DESTINO` es `("TODOS","CUADRILLA","TECNICO")` (`mensaje_entities.py:28`), el `CHECK ck_mensaje_destino_tipo` (`:59-61`) lo rechazaría y `ck_mensaje_destino_xor` (`:67-72`) obliga a que el destino encaje en `id_cuadrilla` o `id_tecnico`, de modo que un destino-usuario no tiene columna que lo satisfaga. Requiere DDL + migración idempotente (RT-APK-03, CU-D95-20).
- **A3 (el Supervisor elegido dejó de estar activo).** La API responde `422` «El Supervisor seleccionado no está disponible» y la APK ofrece el escalado del paso A4; no se crea el mensaje.
- **A4 (escalado: la central no tiene ningún `SUPERVISOR` activo).** La APK ofrece escalar y, al aceptar, envía el mensaje al **`ADMIN` de la misma central**, dejando constancia del motivo `SUPERVISOR_AUSENTE_ESCALADO_ADMIN` en la observación del mensaje; si tampoco hay `ADMIN` activo, responde `422` «No hay destinatario de gestión disponible en su central» y **no** crea el mensaje.
- **A5 (la app intenta responder un mensaje recibido).** DEC-G9: **no** se habilita Supervisor → Coordinador; la APK no ofrece el botón «Responder» y solo permite redactar un mensaje nuevo.
- **A6 (cuerpo vacío).** La APK no habilita el botón Enviar hasta que haya al menos 1 carácter.
- **A7 (fallo de red entre la apertura y el envío).** La APK informa el error y conserva el texto tecleado para reintentar; no muestra un éxito falso.
- **A8 (el Coordinador intenta difundir a técnicos).** Con `destino_tipo` en `TODOS`, `CUADRILLA` o `TECNICO` la API responde `403` y no se crea el mensaje (DEC-G9, H-10).

**Criterios de aceptación**

```gherkin
Dado un Coordinador de la central FRANCISCO SALIAS con 2 supervisores activos (S-1 y S-2)
Cuando envía el mensaje "Falla masiva en el sector 14" eligiendo al Supervisor S-2
Entonces la API responde 201 con origen COORDINADOR y destino_tipo SUPERVISOR
Y el mensaje queda destinado al usuario S-2
Y S-2 lo ve en su bandeja de recibidos
Y S-1 no lo ve en su bandeja
```

```gherkin
Dado un Coordinador cuya central no tiene ningún usuario SUPERVISOR activo y sí 1 ADMIN activo
Cuando envía un mensaje al Supervisor y acepta el escalado
Entonces la API responde 201 con el mensaje destinado al ADMIN de su central
Y la observación del mensaje registra el motivo "SUPERVISOR_AUSENTE_ESCALADO_ADMIN"
```

```gherkin
Dado un Coordinador autenticado
Cuando intenta enviar un mensaje con destino_tipo "TODOS"
Entonces la API responde 403
Y no se crea ningún mensaje
```

```gherkin
Dado un Supervisor de la central FRANCISCO SALIAS
Cuando recibe un mensaje de un Coordinador y lo abre
Entonces no ve ningún botón "Responder"
Y la única acción disponible es leerlo y marcarlo como leído
```

```gherkin
Dado un Coordinador sin conexión en la pestaña Redactar
Cuando pulsa "Enviar"
Entonces la APK muestra "Esta acción requiere conexión"
Y el texto escrito se conserva en pantalla
```

**Restricciones (EARS)**

- Si el rol es `COORDINADOR`, entonces el sistema **deberá** permitir **solo** el destino `SUPERVISOR` con un **usuario concreto** de su central y **no** el envío a técnicos, cuadrillas ni a `TODOS` (DEC-G9, DEC-G15, H-10).
- El sistema **deberá** ser de **una sola vía**: no se habilitará `SUPERVISOR → COORDINADOR` (DEC-G9).
- El sistema **deberá** registrar el origen del mensaje en `mensaje.origen_p00` con el P00 del Coordinador.
- Cuando la central no tenga ningún usuario `SUPERVISOR` activo, el sistema **deberá** escalar el mensaje al `ADMIN` de la misma central y registrar el motivo del escalado (DEC-G15).
- El sistema **deberá** rechazar con `403` cualquier mensaje cuyo destinatario-usuario no pertenezca a `usuario.id_central` del emisor (DEC-G6, H-01).

---

## CU-D95-14 · Monitorear las alertas sin actuar, las fallas masivas y la bandeja de notificaciones

| | |
|---|---|
| **Actor** | `SUP`, `ADM` (acceso pleno) · `COO` (**ver todo y abrir fichas, sin actuar**) |
| **Objetivo** | Ver las fallas masivas activas, la bandeja de notificaciones y la ficha de una falla con sus casos afectados, planificación y materiales, **sin** declarar, planificar, cerrar ni cambiar estado |
| **Precondición** | Sesión iniciada; existen fallas o notificaciones de la central |
| **Postcondición** | Se muestran las alertas y las notificaciones; **ninguna** mutación de fallas (DEC-G13) |
| **Requisitos** | RF-APK-25, RF-APK-23, RNF-APK-01, RNF-APK-02 |
| **Decisiones** | DEC-G1, DEC-G3, DEC-G8, DEC-G11, DEC-G13 |

**Flujo principal**

1. El usuario abre `ALERTAS`.
2. La APK pide `GET /api/v1/fallas-masivas?solo_activas=true` (`routes_alertas.py:153`) y `GET /api/v1/notificaciones?limite=100` (`routes_alertas.py:355`).
3. La tabla de fallas muestra: descripción, origen, sector, cuadrilla, estado, ruta (Tarjeta/FAT), dirección corta, casos afectados, nº de órdenes de material y hasta 2 evidencias (`_salida`, `routes_alertas.py:112-143`).
4. La bandeja de notificaciones muestra canal, destinatario, asunto, estado, error y fecha de envío.
5. Al tocar una falla, la APK abre su ficha (`GET /fallas-masivas/{id_falla}`, `routes_alertas.py:301`) con **casos afectados, planificación y materiales** → CU-D95-15.
6. La pantalla muestra `actualizado hh:mm` y botón de refresco manual.

**Flujos alternativos**

- **A1 (sin fallas activas).** «No hay fallas masivas activas».
- **A2 (filtro `estado` o `id_central`).** La APK ofrece ambos filtros; la central se **deriva del usuario** y un `id_central` distinto se rechaza con `403` (DEC-G6, H-01, CU-D95-22).
- **A3 (notificación en estado `FALLIDO`).** Se muestra con su `error` y el canal; **solo** `ADMIN`/`SUPERVISOR` pueden reintentar el envío del outbox con `POST /notificaciones/procesar` (`routes_alertas.py:372-376`, exige `_escritura`).
- **A4 (`COORDINADOR`: ver sin actuar, DEC-G13).** Ve todo y **abre** la ficha de la falla con sus casos afectados, planificación y materiales, pero **no** ve ningún botón de declarar, detectar, planificar, cerrar ni cambiar estado, y **no** puede procesar el outbox. Si los invoca por API, `PATCH /fallas-masivas/{id}` exige `_escritura` (`routes_alertas.py:267`) y responde `403`.
- **A5 (el `TECNICO` reporta una falla — DEC-G11).** El Técnico usa `POST /fallas-masivas/reporte-campo` (`routes_alertas.py:203`), que registra origen `REPORTE_TECNICO` con hasta 2 fotos. **A implementar:** hoy ese endpoint exige únicamente `get_current_user` (`routes_alertas.py:209`), de modo que **cualquier autenticado —incluido el Coordinador— puede declarar una falla por esa vía**; DEC-G11 lo acota a `TECNICO`, `SUPERVISOR`, `ADMIN` y `SUPER`, y el Coordinador debe recibir `403`.
- **A6 (sin conexión).** Última lectura con aviso; ninguna acción de escritura disponible.

**Criterios de aceptación**

```gherkin
Dado un Supervisor con 2 fallas activas (DETECTADA y PLANIFICADA) y 40 fallas históricas
Cuando abre ALERTAS
Entonces la tabla muestra exactamente 2 fallas
Y la petición enviada es GET /api/v1/fallas-masivas?solo_activas=true
Y la bandeja de notificaciones se pide con GET /api/v1/notificaciones?limite=100
```

```gherkin
Dado un Coordinador en la pantalla ALERTAS
Cuando abre la ficha de una falla detectada
Entonces ve descripción, sector, ruta, los casos afectados, la planificación y las órdenes de material
Y no ve los botones de declarar, detectar, planificar, cerrar ni cambiar estado
Y no ve el botón de procesar el outbox de notificaciones
```

```gherkin
Dado un Coordinador autenticado con cualquier rol de sesión válida
Cuando invoca POST /api/v1/fallas-masivas/reporte-campo
Entonces la API responde 403
Y no se crea ninguna falla masiva
```

```gherkin
Dado un Técnico en campo que reporta una falla con ODN, dirección y 2 fotos
Cuando el Supervisor refresca ALERTAS
Entonces la falla aparece con origen "REPORTE_TECNICO"
Y muestra 2 evidencias
```

```gherkin
Dado un Supervisor en ALERTAS sin conexión
Cuando abre la pantalla
Entonces ve el último contenido guardado con la banda "Sin conexión · último dato hh:mm"
Y no puede declarar, planificar ni cerrar fallas
```

**Restricciones (EARS)**

- Mientras el rol sea `COORDINADOR`, el sistema **deberá** mostrar `ALERTAS` y `FALLAS MASIVAS` con **acceso total de lectura** (listar, abrir ficha, ver casos afectados, planificación y materiales) y **sin ninguna acción de mutación**, salvo la orden de material (DEC-G8, DEC-G13, CU-D95-16).
- El sistema **no deberá** ofrecer al `COORDINADOR` ninguna acción de declarar, detectar, planificar, cerrar ni cambiar el estado de una falla masiva (DEC-G13).
- Si el rol es `COORDINADOR`, entonces `POST /fallas-masivas/reporte-campo` **deberá** responder `403`, quedando reservado a `TECNICO`, `SUPERVISOR`, `ADMIN` y `SUPER` (DEC-G11). **A implementar**: hoy el endpoint solo exige autenticación (`routes_alertas.py:203-210`).
- El sistema **deberá** mostrar en la tabla de fallas el número de casos afectados y el de órdenes de material vinculadas.
- El sistema **deberá** mostrar en la bandeja de notificaciones el estado y el error de cada envío.

---

## CU-D95-15 · Consultar una falla masiva con detalle de planificación y materiales

| | |
|---|---|
| **Actor** | `COO` · `SUP`, `ADM` |
| **Objetivo** | Ver la ficha completa de una falla: casos afectados, planificación, evidencias y órdenes de material |
| **Precondición** | Sesión iniciada; la falla existe en la central |
| **Postcondición** | Se muestra la ficha; no se modifica nada |
| **Requisitos** | RF-APK-20, RNF-APK-02 |
| **Decisiones** | DEC-G6, DEC-G8, DEC-G13 |

**Flujo principal**

1. El usuario abre la ficha de la falla: `GET /api/v1/fallas-masivas/{id_falla}` (`routes_alertas.py:301`).
2. La APK muestra descripción, origen, estado, sector, cuadrilla, ODN, dirección, FAT, ruta, evidencias y planificación.
3. La APK pide `GET /api/v1/fallas-masivas/{id_falla}/ordenes` (`routes_alertas.py:311`) y lista las órdenes con su estado y solicitante.
4. La APK pide los casos afectados con `GET /api/v1/casos?es_falla_masiva=true` (`routes_casos.py:204`) y muestra el conteo devuelto por `casos_afectos`.
5. El usuario puede abrir cualquiera de los casos afectados.

**Flujos alternativos**

- **A1 (`id_falla` inexistente).** `404` «Falla masiva no encontrada» (`routes_alertas.py:50`).
- **A2 (falla sin órdenes).** «Sin órdenes de material» y el botón **Solicitar material** visible solo para el Coordinador (CU-D95-16).
- **A3 (falla manual sin `clave_concentracion`).** Los casos afectados se cuentan por sector (`_caso_representativo`, `routes_alertas.py:82-109`); la APK lo indica con la etiqueta «por sector».
- **A4 (falla con órdenes históricas).** El listado incluye las que solo guardaban el marcador `[Falla N]` en la observación (compatibilidad D-75, `routes_alertas.py:320-326`).
- **A5 (`COORDINADOR` intentando editar).** No hay acciones de edición visibles; si las invocara por API, `PATCH /fallas-masivas/{id}` exige `ADMIN`/`SUPERVISOR` y responde `403`.

**Criterios de aceptación**

```gherkin
Dado una falla 42 con 28 casos afectados y 3 órdenes de material
Cuando el Coordinador abre su ficha
Entonces ve los 28 casos afectados y las 3 órdenes con su estado
Y ve la planificación y las 2 evidencias adjuntas
Y no ve botones para cambiar el estado de la falla
```

```gherkin
Dado una falla manual sin clave de concentración con sector 14
Cuando el Coordinador abre su ficha
Entonces el bloque de casos afectados se rotula "por sector"
Y el conteo corresponde a los casos del sector 14 de su central
```

```gherkin
Dado un Coordinador con la falla 42 abierta
Cuando intenta llamar a PATCH /api/v1/fallas-masivas/42 cambiando el estado
Entonces la API responde 403
Y el estado de la falla no cambia
```

**Restricciones (EARS)**

- El sistema **deberá** permitir al `COORDINADOR` la lectura completa de las fallas masivas de su central: descripción, estado, planificación, evidencias, casos afectados y órdenes de material (RF-APK-20, DEC-G13).
- El sistema **no deberá** ofrecer al `COORDINADOR` ninguna acción de mutación en esta ficha: la única escritura que le concede el sistema sobre fallas masivas es la orden de material (DEC-G8, DEC-G13, **H-05**).
- Si la falla no tiene `clave_concentracion`, entonces el sistema **deberá** contar los casos afectados por `id_sector`.
- El sistema **deberá** listar, junto a las órdenes vinculadas por `id_falla`, las históricas cuyo texto empiece por `[Falla <id>]`.
- El sistema **deberá** acotar la ficha y sus conteos a `usuario.id_central` (DEC-G6, H-01). **A implementar**: hoy `GET /fallas-masivas/{id}` y `/{id}/ordenes` no filtran por central (`routes_alertas.py:301-327`) — ver CU-D95-22.

---

## CU-D95-16 · Solicitar material para una falla masiva

| | |
|---|---|
| **Actor** | `COO` (también `SUP`/`ADM`) |
| **Objetivo** | Crear la orden de material que la falla necesita y consultarla después |
| **Precondición** | Sesión iniciada y conexión; la falla existe y no está cerrada |
| **Postcondición** | Existe una fila de `orden_material` con `id_falla`, estado `SOLICITADA` y solicitante |
| **Requisitos** | RF-APK-21, RNF-APK-02, RT-APK-05 |
| **Decisiones** | DEC-G4, DEC-G8, DEC-G13 |

**Flujo principal**

1. El usuario abre la ficha de la falla (CU-D95-15) y pulsa **Solicitar material**.
2. La APK exige conexión; sin ella informa y no abre el formulario.
3. El formulario pide **descripción** (obligatoria) y **cuadrilla** (opcional; por defecto la de la falla).
4. La APK envía `POST /api/v1/fallas-masivas/{id_falla}/material` con `MaterialRequest` (`routes_alertas.py:330`).
5. El servidor crea la orden con `id_falla` real, `estado = "SOLICITADA"`, `solicitante_usuario` = P00 del usuario y observación `[Falla <id>] <descripción>`.
6. La APK refresca el bloque de órdenes de la ficha y muestra la nueva con su estado.

**Flujos alternativos**

- **A1 (`COORDINADOR` bloqueado por rol).** **NUEVO — no existe en el backend vigente**: `solicitar_material` exige `_escritura = require_roles("ADMIN","SUPERVISOR")` (`routes_alertas.py:43` y `:336`); sin RT-APK-05 el Coordinador recibe `403`. Es la **única** escritura que DEC-G8/DEC-G13 le conceden sobre fallas masivas (**H-05**).
- **A2 (descripción vacía o en blanco).** `422` del esquema; la APK no habilita el botón Guardar.
- **A3 (falla cerrada).** La APK muestra «La falla está cerrada: no admite nuevas órdenes de material» y oculta el botón.
- **A4 (cuadrilla indicada distinta a la de la falla).** La orden queda con `id_cuadrilla` = la indicada; el bloque de la ficha lo refleja.
- **A5 (doble pulsación).** La APK deshabilita el botón mientras hay una petición en vuelo; si llegan dos, se crean dos órdenes (el endpoint no es idempotente) y la APK debe advertirlo.
- **A6 (consulta posterior).** El usuario ve las órdenes con `GET /fallas-masivas/{id_falla}/ordenes` en cualquier momento.

**Criterios de aceptación**

```gherkin
Dado un Coordinador con la falla 42 abierta
Cuando solicita material con la descripción "300 m de cable ADSS y 2 cajas de empalme"
Entonces la API responde 201 con estado "SOLICITADA" e id_falla 42
Y solicitante_usuario es el P00 del Coordinador
Y la orden aparece en el bloque de órdenes de la ficha de la falla 42
```

```gherkin
Dado un Coordinador con la falla 42 abierta
Cuando intenta declarar la falla o cambiar su estado a PLANIFICADA
Entonces la API responde 403
Y la única escritura que la API le acepta sobre la falla es POST /fallas-masivas/42/material
```

```gherkin
Dado un Coordinador autenticado
Cuando invoca, una por una, POST /fallas-masivas, POST /fallas-masivas/detectar, POST /fallas-masivas/42/planificacion y POST /notificaciones/procesar
Entonces las cuatro peticiones responden 403
Y ninguna de ellas modifica una falla ni una notificación
```

```gherkin
Dado un formulario de solicitud de material con la descripción vacía
Cuando el Coordinador intenta guardar
Entonces la API responde 422
Y no se crea ninguna orden de material
```

**Restricciones (EARS)**

- Si el rol es `COORDINADOR`, entonces el sistema **deberá** aceptar su escritura **únicamente** en `POST /fallas-masivas/{id_falla}/material` —y en la lectura—, y **no** en ninguna otra ruta de fallas masivas ni del outbox de notificaciones (DEC-G8, DEC-G11, DEC-G13, RT-APK-05, **H-05**).
- Cuando se cree una orden de material, el sistema **deberá** grabar `id_falla` real, `estado = SOLICITADA` y el P00 del solicitante.
- El sistema **deberá** exigir conexión para crear la orden (DEC-G4).

---

## CU-D95-17 · Usar la WEB del Coordinador con las mismas capacidades

| | |
|---|---|
| **Actor** | `COO` |
| **Objetivo** | Disponer en la SPA de las mismas capacidades del punto 2 de la petición, con menú y guards por rol |
| **Precondición** | Sesión web iniciada con rol `COORDINADOR` |
| **Postcondición** | La SPA muestra solo las secciones del Coordinador y opera con los mismos contratos que la APK |
| **Requisitos** | RF-APK-26, RF-APK-18…23 |
| **Decisiones** | DEC-G1, DEC-G8, DEC-G9, DEC-G13, DEC-G15 |

**Flujo principal**

1. El Coordinador entra en la SPA (`app/web/src/App.tsx`) y el contexto de autenticación (`AuthContext.tsx`) resuelve su rol.
2. La SPA muestra las secciones homólogas de la APK: `MONITOREO` (pestaña de OPERACIÓN), `ESPECIALES`, `FALLAS MASIVAS` (lectura + material), `ALERTAS` (pestaña de OPERACIÓN), `MENSAJES`.
3. La SPA **no** muestra `DESPACHO`, `CASOS` de gestión, `GESTIÓN`, `CONFIGURACIÓN`, `SISTEMAS`/`AUDITORÍA` ni las pantallas de alta manual (RF-APK-29) y edición ligera (RF-APK-30), que son de Supervisor/Administrador; el guard vigente `RutaGestion` (`app/web/src/components/RutaGestion.tsx:13`) solo redirige al `TECNICO` a `/` y debe convertirse en **lista blanca por rol** (H-08).
4. La SPA usa los mismos endpoints que la APK, de modo que un cambio de rol no cambia el dato mostrado.
5. La SPA respeta la matriz RBAC propuesta (§5 del incremento) para mostrar u ocultar acciones, incluida la **matriz ALERTAS corregida** (H-21).

**Flujos alternativos**

- **A1 (`COORDINADOR` accediendo por URL a `/despacho`, `/tecnicos` o `/parametros`).** El guard lo redirige a `/` (OPERACIÓN) sin renderizar la página.
- **A2 (`COORDINADOR` abriendo `ESPECIALES`).** Ve el botón **Nuevo** (alta permitida) y **no** ve los de edición ni cambio de estado.
- **A3 (`COORDINADOR` abriendo `MENSAJES`).** Redacta a un **Supervisor concreto** de su central, con escalado al ADMIN si no hay ninguno activo (DEC-G15); **no** ve el formulario de envío a técnicos ni a cuadrillas (DEC-G9) ni el botón de reportar una falla masiva (DEC-G11).
- **A4 (rol no contemplado).** El guard manda a `/`; no hay pantalla en blanco.
- **A5 (`TECNICO` en la WEB).** Conserva el comportamiento vigente: `RutaGestion` lo redirige a `/` y `AuthContext` marca `soloLectura` (`AuthContext.tsx:82`).
- **A6 (`COORDINADOR` abriendo `CASOS`).** No existe la sección para su rol; si escribe `/casos` el guard lo redirige a `/` y no ve el alta manual (RF-APK-29) ni la edición ligera (RF-APK-30).

**Criterios de aceptación**

```gherkin
Dado un usuario COORDINADOR autenticado en la SPA
Cuando abre la página principal
Entonces ve las secciones MONITOREO, ESPECIALES, FALLAS MASIVAS, ALERTAS y MENSAJES
Y no ve DESPACHO, CONFIGURACIÓN ni SISTEMAS
```

```gherkin
Dado un usuario COORDINADOR autenticado en la SPA
Cuando escribe la URL /despacho en el navegador
Entonces el guard lo redirige a la página OPERACIÓN
Y la página DESPACHO no se renderiza
```

```gherkin
Dado un usuario COORDINADOR en la página ESPECIALES de la SPA
Cuando abre la tabla de casos especiales
Entonces ve el botón "Nuevo"
Y no ve botones de editar ni de cambiar estado
```

```gherkin
Dado un usuario COORDINADOR autenticado en la SPA
Cuando abre la ficha de una falla masiva activa
Entonces ve los casos afectados, la planificación y las órdenes de material
Y no ve botones de declarar, detectar, planificar, cerrar ni procesar notificaciones
```

```gherkin
Dado un usuario COORDINADOR autenticado en la SPA
Cuando intenta invocar POST /api/v1/fallas-masivas/reporte-campo
Entonces la API responde 403
Y no se crea ninguna falla masiva
```

**Restricciones (EARS)**

- El sistema **deberá** aplicar en la WEB el mismo alcance por rol que en la APK para el rol `COORDINADOR` (RF-APK-26).
- Si el rol es `TECNICO`, entonces la SPA **deberá** seguir redirigiéndolo a la página OPERACIÓN (`RutaGestion` vigente).
- El sistema **deberá** usar los mismos contratos HTTP en la WEB y en la APK para las capacidades del Coordinador.
- El sistema **deberá** convertir `RutaGestion` en lista blanca por rol: las páginas de despacho, casos de gestión y configuración no se renderizan para el `COORDINADOR` aunque se invoquen por URL (H-08).

---

## CU-D95-18 · Conservar el flujo offline del Técnico con CARGA/DESCARGA manual

| | |
|---|---|
| **Actor** | `TEC` |
| **Objetivo** | Seguir trabajando en campo sin conexión con descargas y subidas explícitas, sin que la APK de gestión altere su comportamiento |
| **Precondición** | Sesión de Técnico iniciada; el dispositivo tiene la base local (SQLite) y su cuadrilla activa |
| **Postcondición** | El Técnico descarga y carga solo cuando lo pide; no hay ninguna descarga automática |
| **Requisitos** | RNF-APK-03, RF-APK-27 |
| **Decisiones** | DEC-G2, DEC-G4, DEC-G5, DEC-G11 |

**Flujo principal**

1. El Técnico entra en la APK y cae en `CASOS` (`main.dart:115`), no en `MONITOREO`.
2. Pulsa **DESCARGA**: la APK llama `GET /api/v1/sync/descarga` (`routes_sync.py:62`) y guarda los casos de su cuadrilla y la marca de agua `ultima_descarga_ts` (`download_service.dart:59`).
3. Trabaja offline sobre los casos locales (contactar, atender, cerrar, diferir, evidencias).
4. Pulsa **CARGA**: la APK envía `POST /api/v1/sync/carga` (`routes_sync.py:154`) con las actividades y estados acumulados.
5. El sondeo de mensajes sigue como está: `Timer.periodic(Duration(seconds: 60))` (`mensajes_provider.dart:50`).
6. El Técnico reporta una falla masiva desde el campo con `POST /fallas-masivas/reporte-campo` (`routes_alertas.py:203`, hasta 2 evidencias).

**Flujos alternativos**

- **A1 (el sistema de gestión introduce un temporizador global de 5 min).** Es el **riesgo R1**: reabriría el defecto que D-84 corrigió. El temporizador solo debe instalarse para roles de gestión (CU-D95-05).
- **A2 (sin cuadrilla activa).** La descarga responde con `motivo = SIN_CUADRILLA` y su mensaje (`download_service.dart:26-33`); la APK lo explica en vez de decir «no hay casos nuevos».
- **A3 (cuadrilla de gestión).** `motivo = CUADRILLA_GESTION`: el Técnico no recibe casos de la cuadrilla 0.
- **A4 (carga con errores parciales).** Los envíos fallidos quedan en la cola local con reintento y backoff (`sync_provider.dart:233`); no se pierden.
- **A5 (APK antigua `1.1.0+8`).** Sigue leyendo y escribiendo con normalidad; las pantallas de gestión no existen para ella.
- **A6 (reporte de campo y rol — DEC-G11).** El Técnico **conserva** `POST /fallas-masivas/reporte-campo`, pero ese endpoint deja de ser accesible a cualquier autenticado: queda restringido a `TECNICO`, `SUPERVISOR`, `ADMIN` y `SUPER`, y el **Coordinador recibe `403`** (CU-D95-14/A5, CU-D95-19).

**Criterios de aceptación**

```gherkin
Dado un Técnico autenticado con su cuadrilla C-001 activa
Cuando permanece 20 minutos en la pantalla CASOS sin pulsar DESCARGA
Entonces la APK no ejecuta ninguna petición a GET /api/v1/sync/descarga
Y no existe ningún temporizador de 5 minutos activo en la sesión del Técnico
```

```gherkin
Dado un Técnico en pantalla CASOS
Cuando pulsa DESCARGA
Entonces la APK llama exactamente 1 vez a GET /api/v1/sync/descarga
Y guarda la marca de agua ultima_descarga_ts con el server_ts recibido
```

```gherkin
Dado un Técnico sin cuadrilla asignada
Cuando pulsa DESCARGA
Entonces la respuesta trae motivo = "SIN_CUADRILLA"
Y la APK muestra el mensaje explicativo del servidor en vez de "No hay casos nuevos ni cambios"
```

```gherkin
Dado un Técnico con 3 actividades pendientes de subir y sin red
Cuando pulsa CARGA
Entonces la APK no pierde ninguna actividad
Y las reintenta con backoff al recuperar la conexión
```

**Restricciones (EARS)**

- Mientras el rol sea `TECNICO`, el sistema **no deberá** emitir descargas automáticas ni instalar el temporizador de 5 minutos (RNF-APK-03, D-84).
- El sistema **deberá** mantener la CARGA y la DESCARGA como acciones **explícitas** del Técnico.
- El sistema **deberá** conservar el sondeo de mensajes cada 60 s tal como está hoy (`mensajes_provider.dart:22`).
- Si el rol es `TECNICO`, entonces el sistema **deberá** aceptar su `POST /fallas-masivas/reporte-campo` y **no deberá** aceptarlo para el rol `COORDINADOR` (DEC-G11).

---

## CU-D95-19 · Dar de alta la cuenta de gestión del Coordinador y acotar el RBAC

| | |
|---|---|
| **Actor** | `SUPER` (con la dirección del proyecto) |
| **Objetivo** | Dejar el rol `COORDINADOR` operativo en el catálogo, en la matriz RBAC y en los `require_roles`, con una vía de alta de **usuario de gestión separada de `tecnico`** y con su gobierno declarado |
| **Precondición** | Base respaldada; el script de migración disponible; la matriz RBAC propuesta aprobada |
| **Postcondición** | Migración idempotente aplicada; existe una cuenta `COORDINADOR` **sin fila en `tecnico`**; el Coordinador no aparece en cuadrillas, flota ni despacho; gobierno del rol declarado |
| **Requisitos** | RT-APK-01, RT-APK-05 |
| **Decisiones** | DEC-G1, DEC-G11, DEC-G14, DEC-G16, DEC-G17 |

**Flujo principal**

1. El sistema ejecuta el script en **simulación** e imprime el inventario: filas de `rol` existentes (semilla vigente de 4 roles, `RepoTecnico/db/schema.sql:872-877`), endpoints con `require_roles`, valor vigente de `ROL_ASIGNABLE` (`app/schemas/config.py:132` → `TECNICO`, `SUPERVISOR`, `ADMIN`) y de `TIPOS_DESTINO`, y nº de usuarios con `id_tecnico` NULL.
2. Con `--aplicar --si` inserta la fila `COORDINADOR` en el catálogo `rol` de forma idempotente y actualiza la semilla de `schema.sql`.
3. Suma `COORDINADOR` a `ROL_ASIGNABLE` (`app/schemas/config.py:132`) y actualiza la matriz RBAC de `requerimientos.md` §5.2.
4. **Vía de alta de usuario de gestión (DEC-G16).** Habilita el alta de la cuenta `COORDINADOR` como **usuario de gestión**: `usuario` con `p00`, `correo`, `id_rol = COORDINADOR` y `id_central`, **sin** `id_tecnico` y **sin** crear fila en `tecnico`. El modelo ya lo admite (`Usuario.id_tecnico` es *nullable*, `app/models/entities.py:80`); hoy el **único** camino de asignación de rol exige la fila en `tecnico` (`app/api/routes_config.py:349-383`, que crea la cuenta con `id_tecnico=obj.id_tecnico`): **NUEVO — no existe en el backend vigente**.
5. Acota `require_roles` **por capacidad**, sin ampliar las dependencias compartidas `_escritura` (`routes_alertas.py:43`) ni `_envio` (`routes_mensajes.py:29`), para no inducir elevación de privilegios (H-09/H-10): el Coordinador solo entra en el alta de casos especiales, la orden de material, la lectura de monitoreo/alertas/fallas y el envío al Supervisor.
6. Verifica: **1** fila `COORDINADOR` en `rol`; **0** endpoints de escritura de despacho/casos accesibles al Coordinador; **403** en `POST /fallas-masivas/reporte-campo` (DEC-G11); **0** apariciones del Coordinador en cuadrillas, flota ni despacho.
7. Deja constancia en `auditoria` del alta del rol y de cada endpoint modificado.
8. Declara el **gobierno** del rol (DEC-G17) en `requerimientos.md` §5.3: dueño funcional y soporte de 1.º/2.º nivel = **SUPERVISOR** de la central; **keystore y publicación de la APK** = **Super Usuario**; **auditoría de las acciones del Coordinador** = **SUPER en solo lectura** sobre `auditoria`. Habilita esa vista de solo lectura: **NUEVO — no existe en el backend vigente** (las escrituras sí dejan traza, pero no hay ningún `GET` de `auditoria`).

**Flujos alternativos**

- **A1 (el script ya se aplicó).** Informa «ya migrada» y no modifica nada.
- **A2 (conflicto: la fila `COORDINADOR` ya existe con otro `id_rol`).** Se detiene, lo lista y no deja la base a medias (transacción única).
- **A3 (endpoint que debe seguir cerrado al Coordinador).** La verificación falla y el script lo nombra; no se declara éxito.
- **A4 (rollback).** Procedimiento documentado: retirar la fila de `rol`, revertir `ROL_ASIGNABLE` y los `require_roles`; el script informa que las cuentas ya creadas con ese rol quedan inutilizables hasta reaplicar.
- **A5 (segundo factor).** **FUERA DE ALCANCE por DEC-G14**: no se implementa MFA para el rol; RNF-APK-04 queda **incumplido por decisión expresa** (riesgo aceptado **RA-01**, ver CU-D95-02/A6). El alta del rol **no** queda condicionada a un segundo factor inexistente.
- **A6 (el alta de gestión intenta crear una fila en `tecnico`).** La verificación falla: la cuenta del Coordinador debe quedar con `id_tecnico = NULL` y **no** debe aparecer en `GET /cuadrillas`, en la flota ni en el despacho.
- **A7 (nombre y apellido del Coordinador).** `_usuario_out` toma `nombre`/`apellido` de `u.tecnico` (`routes_auth.py:68-69`), de modo que una cuenta sin fila `tecnico` devolvería ambos en `null`: la vía de alta de gestión **debe** fijarlos y la respuesta del login debe seguir mostrando el nombre completo.

**Criterios de aceptación**

```gherkin
Dado un entorno con los 4 roles vigentes (SUPER, ADMIN, SUPERVISOR, TECNICO)
Cuando se ejecuta el script de alta del Coordinador con --aplicar --si
Entonces la tabla rol contiene 5 filas, incluida COORDINADOR
Y ROL_ASIGNABLE acepta el valor "COORDINADOR"
Y ninguna fila de rol preexistente cambió sus permisos
```

```gherkin
Dado el rol COORDINADOR ya creado y un Supervisor con P00 "V-12345678"
Cuando el Super Usuario da de alta la cuenta de gestión del Coordinador en la central FRANCISCO SALIAS
Entonces la tabla usuario tiene una fila con rol COORDINADOR, id_central de FRANCISCO SALIAS e id_tecnico NULL
Y no se ha insertado ninguna fila nueva en la tabla tecnico
Y el Coordinador no aparece en GET /api/v1/cuadrillas ni en la flota
```

```gherkin
Dado el rol COORDINADOR ya creado
Cuando el Coordinador llama a POST /api/v1/despachos/procesar
Entonces la API responde 403
Y cuando llama a GET /api/v1/monitoreo/diario responde 200
```

```gherkin
Dado el rol COORDINADOR ya creado
Cuando el Coordinador llama a POST /api/v1/fallas-masivas/reporte-campo
Entonces la API responde 403
Y la falla no se crea
```

```gherkin
Dado un Coordinador con acciones registradas en la tabla auditoria
Cuando el Super Usuario abre la vista de auditoría
Entonces puede consultar las acciones del Coordinador con su actor, entidad y fecha
Y la vista no ofrece ninguna acción de escritura ni de borrado sobre auditoria
```

```gherkin
Dado un entorno ya migrado
Cuando se vuelve a ejecutar el script
Entonces informa "ya migrada"
Y no inserta una segunda fila COORDINADOR
Y no modifica ningún endpoint
```

**Restricciones (EARS)**

- El sistema **deberá** crear el rol `COORDINADOR` con una migración **idempotente** y una semilla en `schema.sql` (RT-APK-01).
- El sistema **deberá** dar de alta la cuenta del `COORDINADOR` como **usuario de gestión sin fila en `tecnico`** (`id_tecnico` NULL), y **no deberá** incluirla en cuadrillas, flota ni despacho (DEC-G16).
- Si el endpoint pertenece a despacho, casos, gestión de cuadrilla 0 o configuración, entonces el sistema **no deberá** concederlo al rol `COORDINADOR` (RT-APK-05, DEC-G8).
- Si el rol es `COORDINADOR`, entonces `POST /fallas-masivas/reporte-campo` **deberá** responder `403` (DEC-G11).
- **RNF-APK-04 (MFA obligatorio) queda incumplido por decisión expresa** para este rol: el sistema **no deberá** exigir segundo factor al `COORDINADOR` mientras RA-01 siga vigente (DEC-G14).
- El sistema **deberá** mantener el bypass del rol `SUPER` en `require_roles` (`deps.py:65`) sin cambios.
- El sistema **deberá** declarar el gobierno del rol (dueño funcional, soporte de 1.º/2.º nivel, custodia del keystore y publicación, y auditoría en solo lectura por el SUPER) en `requerimientos.md` §5.3 (DEC-G17).
- El sistema **deberá** ofrecer al `SUPER` una vista de **solo lectura** sobre `auditoria` para revisar las acciones del Coordinador, sin ninguna operación de escritura sobre esa tabla (DEC-G17).

---

## CU-D95-20 · Habilitar el modelo de mensajería por destinatario usuario

| | |
|---|---|
| **Actor** | `SUPER` (con la dirección del proyecto) |
| **Objetivo** | Rediseñar el modelo `mensaje` para que el destinatario sea un **usuario** (no solo técnico o cuadrilla), con nuevos `CHECK`, fan-out al Supervisor y registro en `auditoria` |
| **Precondición** | El rol `COORDINADOR` existe (CU-D95-19) y la base está respaldada |
| **Postcondición** | El modelo admite el destino-usuario; el Coordinador entrega a un Supervisor concreto; el Supervisor lo recibe y lo marca leído; `SUPERVISOR → COORDINADOR` sigue prohibido |
| **Requisitos** | RT-APK-03, RF-APK-22, RF-APK-24 |
| **Decisiones** | DEC-G9, DEC-G15 |

**Flujo principal**

1. El sistema ejecuta la migración en simulación e imprime el estado real: `TIPOS_DESTINO = ("TODOS","CUADRILLA","TECNICO")` (`mensaje_entities.py:28`), los `CHECK` `ck_mensaje_destino_tipo` (`:59-61`) y `ck_mensaje_destino_xor` (`:67-72`), la clave primaria de `mensaje_destino` = `(id_mensaje, id_tecnico)` (`:81-86`), el nº de mensajes existentes y el nº de supervisores por central.
2. Con `--aplicar --si` amplía `TIPOS_DESTINO` con `SUPERVISOR` y recrea el `CHECK` de destino.
3. Redefine `ck_mensaje_destino_xor`: **el `XOR` vigente no representa un destino sin `id_cuadrilla` ni `id_tecnico`** (`mensaje_entities.py:67-72`), de modo que un destino-usuario necesita su propia columna o tabla (`id_usuario_destino`, o `mensaje_destino_usuario` con PK `(id_mensaje, p00)`). **NUEVO — no existe en el backend vigente** (H-03).
4. Añade la **rama explícita** `SUPERVISOR` en `resolver_destinatarios` (`app/services/mensajes.py:55-83`) y convierte en `raise`/`422` el tramo que hoy se comporta como `TODOS` (`:72-83`): sin esa rama, un destino nuevo haría fan-out a **todos** los técnicos de la central (H-03/H-10).
5. Crea la dependencia **por capacidad** del envío del Coordinador (destino forzado `SUPERVISOR`), **sin** ampliar `_envio = require_roles("ADMIN","SUPERVISOR")` (`routes_mensajes.py:29`), que hoy aceptaría difusión a `TODOS`/`CUADRILLA`/`TECNICO` (H-10).
6. Separa «recibidos» de «enviados» en el contrato y extiende `marcar_leido` y `contar_no_leidos` al **destinatario-usuario** (hoy `mensaje_destino` solo indexa técnicos).
7. Resuelve el **escalado** cuando no hay Supervisor activo: el fan-out entrega al `ADMIN` de la misma central (DEC-G15, CU-D95-13/A4).
8. Verifica: **0** mensajes históricos inválidos; el mensaje del Coordinador llega **solo** al Supervisor elegido; **0** mensajes `SUPERVISOR → COORDINADOR` aceptados; `403` al Coordinador con destino `TODOS`, `CUADRILLA` o `TECNICO`.
9. Registra en `auditoria` el alta del mensaje con su origen y su destino.

**Flujos alternativos**

- **A1 (la migración ya se aplicó).** «ya migrada»; no se recrea el `CHECK` ni se duplican mensajes.
- **A2 (mensajes históricos con destinos antiguos).** Quedan válidos: la ampliación del `CHECK` es un superconjunto de `('TODOS','CUADRILLA','TECNICO')`.
- **A3 (intento de `SUPERVISOR → COORDINADOR`).** Se rechaza con `422` por regla de rol, aunque el `CHECK` sí admita el destino (DEC-G9).
- **A4 (rollback).** Se restaura el `CHECK` original solo si no existen mensajes con destino `SUPERVISOR`; si existen, el script se detiene e informa.
- **A5 (contrato roto en pruebas).** `test_contratos.py` debe cubrir los enums `TIPOS_DESTINO` y `ROL_ASIGNABLE` (riesgo R4).
- **A6 (destino desconocido).** Se responde `422` y **no** se materializa ningún destinatario: cierra el fallback implícito a `TODOS` de `resolver_destinatarios`.
- **A7 (destinatario-usuario sin fila `tecnico`).** El Coordinador es cuenta de gestión (DEC-G16) y puede no tener `id_tecnico`: `mensaje_destino` no puede ser su tabla de lectura; por eso el fan-out se materializa por **usuario**, no por técnico.
- **A8 (retención).** Se conserva la retención vigente configurable (`mensajeria.retencion_dias`, por defecto **5** días, `services/mensajes.py:107-119`) y se aplica también al nuevo destino; su plazo para la mensajería de gestión debe quedar declarado (H-24).

**Criterios de aceptación**

```gherkin
Dado un entorno con la mensajería vigente y 250 mensajes históricos
Cuando se aplica la migración del modelo por destinatario usuario
Entonces el CHECK ck_mensaje_destino_tipo admite el valor "SUPERVISOR"
Y los 250 mensajes históricos siguen siendo válidos
Y TIPOS_DESTINO contiene "SUPERVISOR"
```

```gherkin
Dado un Coordinador sin fila en tecnico y un Supervisor activo de su misma central
Cuando el Coordinador envía un mensaje al Supervisor
Entonces el mensaje queda con origen_p00 del Coordinador y destino_tipo SUPERVISOR
Y se materializa exactamente 1 fila de destinatario-usuario
Y el Supervisor lo ve en su bandeja de recibidos, con contador de no leídos incrementado
Y queda registrado en auditoría con su origen y su destino
```

```gherkin
Dado un Supervisor autenticado
Cuando intenta enviar un mensaje con destino_tipo "COORDINADOR"
Entonces la API responde 422
Y no se crea ningún mensaje
```

```gherkin
Dado un mensaje con destino_tipo "DESCONOCIDO"
Cuando el servicio resuelve sus destinatarios
Entonces responde 422
Y no se inserta ninguna fila de destinatario
Y no se hace fan-out a los técnicos de la central
```

**Restricciones (EARS)**

- El sistema **deberá** admitir `SUPERVISOR` como valor de `destino_tipo` mediante una migración idempotente, con el destinatario identificado por **usuario** y no por técnico (RT-APK-03, DEC-G15).
- Si el emisor es `SUPERVISOR`, entonces el sistema **no deberá** aceptar el destino `COORDINADOR` (DEC-G9).
- Cuando el destino sea `SUPERVISOR`, el sistema **deberá** materializar el fan-out por destinatario-usuario y resolver su lectura y su contador de no leídos.
- Si el destino no es uno de los valores admitidos, el sistema **deberá** responder `422` y **no deberá** resolverlo como `TODOS` (DEC-G15, H-03).
- El sistema **no deberá** ampliar la dependencia `_envio` para el Coordinador: el envío al Supervisor usa una dependencia por capacidad (RT-APK-05, H-10).
- Cuando se cree un mensaje del Coordinador, el sistema **deberá** auditar origen, destino y fecha.
- El sistema **deberá** aplicar al nuevo destino la retención vigente de la mensajería (`mensajeria.retencion_dias`) y declarar su plazo (H-24).

---

## CU-D95-21 · Publicar la APK multi-rol con su versión y firma

| | |
|---|---|
| **Actor** | `SUPER` (con la dirección del proyecto) |
| **Objetivo** | Entregar a CANTV una sola APK que sirve a los cuatro roles, firmada y versionada, sin romper la APK del Técnico |
| **Precondición** | Los ciclos D-95 a D-98 están cerrados y las pruebas en verde; el keystore oficial disponible |
| **Postcondición** | `app_movil/GGTOv2.apk` firmada, con `version` nueva y el flujo del Técnico intacto |
| **Requisitos** | RT-APK-04, RNF-APK-03, RNF-APK-05, RNF-APK-06 |
| **Decisiones** | DEC-G2, DEC-G17, DEC-G18 |

**Flujo principal**

1. El sistema incrementa `version` en `pubspec.yaml` (hoy `1.1.0+9`, `pubspec.yaml:5`) y la constante de versión en `constants.dart`.
2. El **Super Usuario**, único custodio del **keystore** y responsable de la publicación (DEC-G17), compila la APK con el keystore oficial y verifica la firma.
3. Verifica el menú por rol: `SUPERVISOR`/`ADMIN` con 8 secciones (incluidas `NUEVO` caso y `EDITAR` ligera, RF-APK-29/30), `COORDINADOR` con 6 y `TECNICO` con su menú de campo.
4. Verifica los criterios de accesibilidad de las pantallas nuevas: objetivos táctiles ≥ 48 dp, contraste ≥ 4.5:1, texto ≥ 16 sp.
5. Exige la **prueba de carga** de RNF-APK-06 (p95 ≤ 2 s y 0 errores 5xx en las pantallas de gestión) **antes del cierre de D-97 y D-98**, con su evidencia registrada en `RepoTecnico/pruebas/` (DEC-G18, H-06).
6. Publica el artefacto en `app_movil/GGTOv2.apk` y deja constancia de la versión en los manuales.
7. Ejecuta `flutter test` y `pytest`; el conjunto verde cierra el ciclo.

**Flujos alternativos**

- **A1 (el Técnico pierde su flujo).** Cualquier regresión del flujo offline (CU-D95-18) bloquea la publicación: RNF-APK-03 es criterio de cierre.
- **A2 (`versionCode` no crece).** La entrega a CANTV se rechaza: el `+N` debe crecer en **cada** entrega (`pubspec.yaml:4`).
- **A3 (objetivos táctiles por debajo de 48 dp).** Se corrige antes de publicar; la medición se documenta pantalla por pantalla.
- **A4 (APK antigua instalada).** El Técnico con `1.1.0+8` sigue operando; las pantallas de gestión solo existen en la versión nueva (RF-APK-27).
- **A5 (firma distinta a la oficial).** El artefacto no se entrega; se recompila con el keystore oficial; la custodia del keystore y la publicación son del **Super Usuario** (DEC-G17).
- **A6 (prueba de carga no ejecutada o con 5xx).** La publicación **se bloquea** hasta que exista la evidencia de RNF-APK-06 con p95 ≤ 2 s y 0 errores 5xx (DEC-G18).

**Criterios de aceptación**

```gherkin
Dado el código del incremento cerrado y las pruebas en verde
Cuando se compila la APK de gestión
Entonces pubspec.yaml declara una version con un versionCode mayor que 9
Y el artefacto app_movil/GGTOv2.apk queda firmado con el keystore oficial
Y el menú del rol TECNICO sigue mostrando solo CASOS, ALERTAS, MENSAJES y USUARIO
```

```gherkin
Dado un Técnico con la APK 1.1.0+8 instalada
Cuando se publica la APK multi-rol 1.2.0+10
Entonces el Técnico puede seguir descargando y cargando sus casos sin cambiar su forma de trabajo
```

```gherkin
Dado un revisor de accesibilidad sobre las 6 pantallas nuevas de gestión
Cuando mide los controles de acción
Entonces todos tienen un área táctil de al menos 48 dp
Y el contraste de texto es de al menos 4.5:1
Y el tamaño de texto es de al menos 16 sp
```

```gherkin
Dado el incremento D-97 o D-98 en su cierre
Cuando se publica la APK o se declara cerrado el ciclo
Entonces existe en RepoTecnico/pruebas/ una prueba de carga con p95 <= 2 s
Y el informe declara 0 respuestas 5xx en las pantallas de gestión
Y sin esa evidencia la publicación queda bloqueada
```

**Restricciones (EARS)**

- El sistema **deberá** entregarse como **una sola** APK multi-rol (DEC-G2).
- Si el flujo del Técnico se altera, entonces el incremento **no podrá** publicarse (RNF-APK-03).
- El sistema **deberá** cumplir ≥ 48 dp de objetivo táctil, ≥ 4.5:1 de contraste y ≥ 16 sp de texto en las pantallas nuevas (RNF-APK-05).
- Mientras no exista la evidencia de la prueba de carga con p95 ≤ 2 s y **0** errores 5xx, el sistema **no deberá** declarar cerrado D-97 ni D-98 ni publicar la APK (RNF-APK-06, DEC-G18).
- El sistema **deberá** custodiar el keystore y publicar la APK bajo la responsabilidad del **Super Usuario** (DEC-G17).

---

## CU-D95-22 · Aislar por central los datos de la APK de gestión

| | |
|---|---|
| **Actor** | `SUPER` (con la dirección del proyecto) |
| **Objetivo** | Hacer del acotado por central un **invariante del servidor**: derivar la central de `usuario.id_central` e impedir que un usuario lea o escriba datos de otra central, **incluso forzando `id_central`** en la URL o en el cuerpo |
| **Precondición** | Base respaldada; existen **dos** centrales con datos distinguibles (p. ej. FRANCISCO SALIAS y una segunda) |
| **Postcondición** | Todas las lecturas y escrituras de la APK de gestión quedan acotadas a `usuario.id_central`; la RLS deniega por defecto; existe la batería negativa A→B como criterio de cierre de D-95 |
| **Requisitos** | **RT-APK-02** |
| **Decisiones** | DEC-G6 (corregida), DEC-G18 |
| **Hallazgo** | **H-01 (crítico)** — RT-APK-02 deja de ser «impacto ninguno»: es un entregable técnico con objetivo propio |

**Estado real verificado (no es una garantía: es trabajo a hacer)**

| Comprobación | Evidencia `archivo:línea` | Veredicto |
|---|---|---|
| La aplicación fija la central en la sesión de BD | `grep "SET LOCAL app.id_central"` sobre `app/**/*.py` = **0 coincidencias** (solo aparece en manuales) | ❌ **No se fija** |
| La RLS deniega por defecto | `p_caso_central` = `app_central_actual() IS NULL OR id_central = app_central_actual()` (`RepoTecnico/db/schema.sql:782-785`); con el parámetro NULL la política **permite todo** (`:769`) | ❌ **RLS inerte** |
| La central se deriva del usuario | `resolver_central` acepta el `id_central` de la petición y, si no viene, usa `ingesta.central_codigo`; **nunca** `usuario.id_central` (`app/services/consultas.py:20-29`) | ❌ **No se compara** |
| El alta de un especial usa la central del usuario | `_crear_caso_asociado` llama `resolver_central(db, None, config)` (`app/api/routes_especiales.py:73-78`) | ❌ **Usa la central configurada** |
| `require_roles` comprueba la central | `deps.py:52-71` compara **solo** el código de rol | ❌ **No la comprueba** |
| El reporte de campo acota por el reportante | `reportar_falla_campo` también resuelve la central con `resolver_central(db, None, …)` (`app/api/routes_alertas.py:220`) | ❌ **Usa la central configurada** |

**Flujo principal**

1. El sistema fija `SET LOCAL app.id_central = '<usuario.id_central>'` en **cada** petición autenticada, antes de ejecutar la consulta.
2. Retira de las políticas RLS la cláusula `app_central_actual() IS NULL OR …` para que sean **denegar por defecto** (`RepoTecnico/db/schema.sql:769,782-805`).
3. Deriva la central de `usuario.id_central` en **todos** los endpoints de la matriz §5.2 y **rechaza con `403`** un `id_central` de la petición (query o cuerpo) distinto del del usuario, salvo el rol `SUPER`.
4. Corrige el alta de casos especiales y el reporte de campo para que el caso y la falla se creen en `usuario.id_central` (`routes_especiales.py:73-78`, `routes_alertas.py:220`).
5. Sustituye los endpoints que hoy solo exigen `get_current_user` por lectura acotada por central: casos y su búsqueda (`routes_casos.py:180,278,444`), especiales (`routes_especiales.py:128,242`), fallas masivas y sus órdenes (`routes_alertas.py:153,301,311`), monitoreo (`routes_monitoreo.py:56-187`) y despacho (`routes_despachos.py:179`).
6. Ejecuta la **batería negativa A→B por endpoint** y la deja como criterio de cierre de D-95.

**Flujos alternativos**

- **A1 (`SUPER`).** Acceso multi-central explícito: puede enviar `id_central` y el sistema lo respeta (el bypass de `deps.py:65` se mantiene), dejando traza en `auditoria`.
- **A2 (usuario sin `id_central`).** Se responde `403` «Su usuario no tiene central asignada» y no se devuelve ningún dato.
- **A3 (parámetro `id_central` de otra central).** `403` y **0** filas; el intento se registra para la observabilidad de las acciones de gestión (H-26).
- **A4 (reporte de campo de fallas masivas).** Se acota también por central y por rol: el Coordinador queda fuera por DEC-G11 (CU-D95-14/A5) y la falla se registra en la central del reportante.
- **A5 (imprimible del despacho).** Su rótulo fijo «FRANCISCO SALIAS» debe pasar a la central real del despacho (defecto colateral de H-01). **Fuera de alcance de la APK**, pero se corrige en el mismo ciclo.

**Criterios de aceptación**

```gherkin
Dado un usuario SUPERVISOR de la central A y 20 casos de la central A y 35 de la central B
Cuando abre CASOS y fuerza ?id_central=<central B> en la URL
Entonces la API responde 403
Y la respuesta no contiene ningún id_averia, teléfono ni dirección de la central B
Y la pantalla no muestra ningún caso de la central B
```

```gherkin
Dado un usuario COORDINADOR de la central A autenticado
Cuando llama a GET /api/v1/casos sin parámetros
Entonces la respuesta contiene únicamente casos con id_central = central A
Y el número de filas es exactamente el de casos de A y no el total de las dos centrales
```

```gherkin
Dado un usuario de la central A
Cuando invoca GET /api/v1/casos-especiales, GET /api/v1/fallas-masivas y GET /api/v1/monitoreo/diario
Entonces las tres respuestas solo contienen datos de la central A
Y ninguna de las tres responde 200 con datos de la central B
```

```gherkin
Dado un Coordinador de la central A que crea un caso especial con dirección del sector 14
Cuando la API responde 201
Entonces el caso asociado queda con id_central = central A
Y no queda en la central configurada en ingesta.central_codigo si es distinta de A
```

```gherkin
Dado un entorno con dos centrales
Cuando se ejecuta la batería negativa A→B de todos los endpoints de la matriz §5.2
Entonces el 100 % de los casos de prueba responde 403 o devuelve 0 filas de la otra central
```

**Restricciones (EARS)**

- El sistema **deberá** fijar el parámetro de sesión `app.id_central` por petición y las políticas RLS **deberán** denegar por defecto (RT-APK-02, H-01).
- El sistema **deberá** derivar la central de `usuario.id_central` en toda lectura y escritura de las pantallas de gestión y **no deberá** aceptar el `id_central` del cliente cuando difiera del suyo (respuesta `403`), salvo el rol `SUPER` (DEC-G6, RT-APK-02).
- Cuando un usuario de la central A solicite datos de la central B —por parámetro, por URL o por cuerpo—, el sistema **deberá** responder `403` y devolver **0** filas de la otra central (RNF-21).
- El sistema **deberá** mantener p95 ≤ 2 s y **0 errores 5xx** tras activar el acotado (RNF-APK-06, DEC-G18).
- El sistema **no deberá** declarar cerrado D-95 sin la batería negativa A→B en verde con **dos** centrales.

---

## CU-D95-23 · Dar de alta manualmente un caso de gestión

| | |
|---|---|
| **Actor** | `SUP`, `ADM` |
| **Objetivo** | Registrar un caso que no llega por ingesta ni tiene avería, con el identificador `REF-…` |
| **Precondición** | Sesión iniciada y conexión; el rol puede escribir; la central y los sectores están cargados |
| **Postcondición** | Existe una fila de `caso` con `origen = MANUAL`, `estado_actual = NUEVO`, `id_averia` `REF-…` y `creado_por` = P00 del usuario |
| **Requisitos** | **RF-APK-29**, RNF-APK-02 |
| **Decisiones** | DEC-G12, DEC-G4, DEC-G6 |

**Flujo principal**

1. El usuario abre `CASOS` y pulsa **Nuevo caso**. La APK exige conexión; sin ella informa y no abre el formulario (CU-D95-06/A2).
2. El formulario pide: fecha de reporte, tipo de caso, tipo de actividad, contacto, nombre del cliente, dirección, información y teléfono.
3. La APK envía `POST /api/v1/casos` (`routes_casos.py:365`), protegido por `_escritura = require_roles("ADMIN","SUPERVISOR")` (`routes_casos.py:51`).
4. Si no se indicó `id_averia`, el servidor genera uno con `generar_id_averia_ref(:central)` (`routes_casos.py:379-382`), con formato `REF-<CÓDIGO_CENTRAL>-<NNNNNN>`.
5. Un teléfono `70*` se resuelve y enlaza como identificador de pago; cualquier otro número queda como contacto y se refleja en `informacion` (`routes_casos.py:389-398`).
6. El sector es el indicado o el que resulte de sectorizar la dirección (`routes_casos.py:400-404`).
7. El servidor crea el caso en estado `NUEVO` con su historial (`routes_casos.py:410-435`) y la APK abre la ficha creada.

**Flujos alternativos**

- **A1 (`id_averia` ya existente).** `409` «Ya existe un caso con id_averia …» (`routes_casos.py:384-385`); la APK ofrece abrir el caso existente y no crea nada.
- **A2 (`id_averia` provisto por el usuario).** Se respeta tal cual si no existe: el endpoint acepta un `id_averia` ajeno y solo genera `REF-…` cuando llega vacío (`routes_casos.py:378-382`).
- **A3 (REPARACIÓN sin `70*` ni avería real — D-90).** La regla de clasificación **reclasifica** el caso a `REFERIDO` en el alta (`clasificacion.aplicar_regla_reparacion`, invocada en `routes_casos.py:424-426`; implementación en `app/services/clasificacion.py:121-149`, que fija `caso.tipo_caso = "REFERIDO"` en `:147` y registra `ACCION_RECLASIFICADO` en `:31`). La APK muestra la ficha resultante como REFERIDO.
- **A4 (sector inexistente).** `404` «Sector no encontrado» (`routes_casos.py:403-404`) y no se crea el caso.
- **A5 (dirección que no casa con ningún patrón).** El caso se crea con `id_sector` nulo; la ficha lo indica y el Supervisor puede asignarlo después (CU-D95-10).
- **A6 (doble pulsación de Guardar).** La APK deshabilita el botón mientras hay una petición en vuelo; el `id_averia` generado evita el duplicado.
- **A7 (`id_central` forzado en el cuerpo).** `403`: la central se deriva del usuario (CU-D95-22).
- **A8 (rol `COORDINADOR`).** `403`: la matriz §5 le da «—» en CASOS; la APK no le ofrece la pantalla (CU-D95-03).

**Criterios de aceptación**

```gherkin
Dado un Supervisor de la central FRANCISCO SALIAS con conexión
Cuando registra un caso sin indicar id_averia, con dirección del sector 14
Entonces la API responde 201
Y el caso tiene id_averia con formato "REF-<CÓDIGO_CENTRAL>-<NNNNNN>", origen "MANUAL" y estado_actual "NUEVO"
Y creado_por es el P00 del Supervisor
Y el contador de casos de la central aumenta en 1
```

```gherkin
Dado un caso con id_averia "REF-FS-000412"
Cuando el Administrador crea un caso indicando ese mismo id_averia
Entonces la API responde 409 con "Ya existe un caso con id_averia REF-FS-000412"
Y no se crea un segundo caso
```

```gherkin
Dado un caso nuevo con categoría RESIDENCIAL y tipo_caso REPARACION, sin id_averia y con un teléfono que no cumple el patrón 70*
Cuando el Supervisor lo registra desde la APK
Entonces el caso queda con tipo_caso "REFERIDO"
Y la ficha muestra la marca de reclasificación de D-90
```

```gherkin
Dado un Supervisor en el formulario de alta con el sector 999 inexistente
Cuando guarda
Entonces la API responde 404 "Sector no encontrado"
Y no se crea ningún caso
```

```gherkin
Dado un Coordinador autenticado en la APK
Cuando intenta invocar POST /api/v1/casos
Entonces la API responde 403
Y no se crea ningún caso
```

**Restricciones (EARS)**

- Cuando se cree un caso sin `id_averia`, el sistema **deberá** generarlo con `generar_id_averia_ref(:central)` en formato `REF-<CÓDIGO_CENTRAL>-<NNNNNN>` (RF-APK-29).
- Cuando el tipo sea REPARACIÓN y no haya identificador `70*` ni avería real, el sistema **deberá** clasificar el caso como `REFERIDO` y registrar la acción en `auditoria` (D-90).
- El sistema **deberá** crear el caso en la central de `usuario.id_central` y responder `403` si la petición fuerza otra (DEC-G6, CU-D95-22).
- El sistema **deberá** exigir conexión para el alta y no dejarla en cola (RNF-APK-02, DEC-G4).
- Si el rol es `COORDINADOR`, entonces el sistema **no deberá** aceptar el alta de casos comunes (matriz §5.2: CASOS «—»).

---

## CU-D95-24 · Editar ligeramente un caso desde la APK

| | |
|---|---|
| **Actor** | `SUP`, `ADM` |
| **Objetivo** | Corregir exactamente **tres** campos del caso —**Sector · Fecha de cita · Información**— reutilizando las reglas vigentes de la ficha web |
| **Precondición** | Sesión iniciada y conexión; el caso existe y es de su central; el rol puede escribir |
| **Postcondición** | El caso refleja los tres campos; no se altera estado, causa, cuadrilla, teléfono ni identificador de pago |
| **Requisitos** | **RF-APK-30**, RNF-APK-02 |
| **Decisiones** | DEC-G12, DEC-G4, DEC-G6 |

**Flujo principal**

1. El usuario abre la ficha del caso y pulsa **Editar**.
2. La APK exige conexión; sin ella muestra el aviso y no abre el formulario (CU-D95-06/A2).
3. La APK ofrece **solo tres** campos editables: `id_sector` (**Sector**), `fecha_cita` (**Fecha de cita**) e `informacion` (**Información**).
4. El campo **Información** se limita a **200** caracteres con contador visible (`n/200`), la misma regla vigente de la ficha web (`app/web/src/components/FichaCaso.tsx:445` y `:449`, `maxLength={200}`; esquema de referencia D-70/D-76).
5. La APK envía `PATCH /api/v1/casos/{id_caso}` (`routes_casos.py:450`) con **solo** esos campos.
6. El servidor valida el sector y responde `404` si no existe (`routes_casos.py:503-506`), guarda la fecha de cita y la información, y regulariza la marca de clasificación si corresponde (`clasificacion.aplicar_en_cambio`, `routes_casos.py:514-515`).
7. La APK refresca la ficha y el listado y muestra los tres valores actualizados.

**Flujos alternativos**

- **A1 (el backend admite más campos que la APK).** `CasoUpdate` acepta además `estado_actual`, `id_pago`, `direccion`, `tipo_caso`, `categoria`, `id_causa`, `en_gestion_supervisor`, `es_falla_masiva`, etc. (`app/schemas/casos.py:148-172`). La **edición ligera es una restricción de la APK**: el cliente no envía ninguno de esos campos, y quien los invoque por API queda fuera del alcance declarado (DEC-G12).
- **A2 (sector inexistente).** `404` «Sector no encontrado» (`routes_casos.py:504-505`); al no confirmarse la transacción (`get_db` solo cierra la sesión, `app/core/db.py:43-49`) no se guarda ninguno de los tres campos.
- **A3 (información de más de 200 caracteres).** La APK **no permite** teclear el carácter 201 ni guardarlo. El backend no impone ese límite (`informacion` no declara `max_length`, `app/schemas/casos.py:156`); la regla de 200 es de interfaz (D-70/D-76).
- **A4 (el usuario intenta editar la dirección).** Fuera de alcance: la dirección recalcularía el sector por patrón (`routes_casos.py:507-509`) y ese campo no se ofrece.
- **A5 (`COORDINADOR`).** No ve el botón **Editar** y la API le responde `403` (matriz §5: CASOS «—»); el Coordinador **no** edita casos.
- **A6 (caso de otra central).** `403` por el acotado por central (CU-D95-22).
- **A7 (red caída durante la edición).** La APK informa el fallo, conserva lo tecleado y no muestra un éxito falso.

**Criterios de aceptación**

```gherkin
Dado un Supervisor con el caso AV-99812 de su central
Cuando edita el sector a 14, la fecha de cita al 2026-10-20 y la información a un texto de 200 caracteres
Entonces la API responde 200
Y la ficha muestra el sector 14, la fecha de cita 2026-10-20 y el contador de información 200/200
Y el estado, la cuadrilla y el identificador de pago del caso no cambiaron
```

```gherkin
Dado un Supervisor en el formulario de edición ligera de un caso
Cuando inspecciona los campos habilitados
Entonces hay exactamente 3: Sector, Fecha de cita e Información
Y no hay campos de estado, causa, cuadrilla, teléfono, dirección, identificador de pago ni gestion de cuadrilla 0
```

```gherkin
Dado un Supervisor escribiendo en el campo Información
Cuando intenta teclear el carácter número 201
Entonces la APK no lo acepta y el contador se queda en 200/200
```

```gherkin
Dado un Coordinador que abre la ficha de un caso
Cuando busca la acción de edición
Entonces no ve el botón "Editar"
Y si invoca PATCH /api/v1/casos/99812 recibe 403
Y el caso no cambia
```

```gherkin
Dado un Supervisor que edita un caso indicando el sector 999 inexistente
Cuando guarda
Entonces la API responde 404 "Sector no encontrado"
Y los tres campos del caso conservan su valor anterior
```

**Restricciones (EARS)**

- Mientras el rol sea `SUPERVISOR` o `ADMIN`, el sistema **deberá** permitir la edición de **exactamente** `id_sector` (Sector), `fecha_cita` (Fecha de cita) e `informacion` (Información) desde la APK de gestión (RF-APK-30, DEC-G12).
- El sistema **deberá** limitar el campo Información a **200** caracteres con contador visible, conforme a la regla vigente de la ficha web (D-70/D-76).
- Si el rol es `COORDINADOR`, entonces el sistema **no deberá** ofrecer ni aceptar la edición de casos (matriz §5.2: CASOS «—»).
- Si un `id_sector` no existe, entonces el sistema **deberá** responder `404` sin guardar ninguno de los tres campos.
- El sistema **deberá** exigir conexión para la edición y no dejarla en cola (RNF-APK-02, DEC-G4).
- El sistema **deberá** acotar la edición al caso de `usuario.id_central` y responder `403` en caso contrario (CU-D95-22).

---

## Matriz de trazabilidad

| Caso de uso | RF-APK | RNF-APK | RT-APK | Decisiones | Actor(es) |
|---|---|---|---|---|---|
| CU-D95-01 Ingresar por rol | 27 | 04 | 01 | G1, G2, G6, G14 | SUP / ADM / COO |
| CU-D95-02 Ingresar sin segundo factor | — | 04 | 01 | G14 (**RA-01**) | ADM / SUP / COO |
| CU-D95-03 Navegar por rol | 27 | 05 | — | G2, G3, G7, G16 | SUP / ADM / COO / TEC |
| CU-D95-04 Monitoreo 5 vistas | 13, 18 | 01, 02, 06 | — | G1, G3, G5, G6, G18 | SUP / ADM / COO |
| CU-D95-05 Refresco con presupuesto | 28 | 01, 02, 06 | — | G4, G5, G18 | SUP / ADM / COO |
| CU-D95-06 Caché y enmascaramiento | — | 01, 02 | — | G4, G19 (**RA-02**) | SUP / ADM / COO |
| CU-D95-07 Listar especiales | 14 | 01 | — | G3, G6 | SUP / ADM |
| CU-D95-08 Crear especial | 18, 19 | 02 | — | G1, G4, G8 | COO / SUP / ADM |
| CU-D95-09 Armar despacho | 15 | 02 | — | G3, G4 | SUP / ADM |
| CU-D95-10 Asignar a cuadrilla | 16, 17 | 02 | — | G3, G7 | SUP / ADM |
| CU-D95-11 Pantalla GESTIÓN | 17 | 01 | — | G3, G7 | SUP / ADM |
| CU-D95-12 Bandeja del Supervisor | 24 | — | 03 | G9, G15 | SUP / ADM |
| CU-D95-13 Mensaje a un Supervisor concreto | 22 | 02 | 03 | G1, G4, G9, G15 | COO |
| CU-D95-14 Monitorear alertas sin actuar | 23, 25 | 01, 02, 06 | — | G1, G3, G8, G11, G13 | SUP / ADM / COO |
| CU-D95-15 Ficha de falla | 20 | 02 | — | G6, G8, G13 | COO / SUP / ADM |
| CU-D95-16 Orden de material | 21 | 02 | 05 | G4, G8, G13 | COO |
| CU-D95-17 WEB del Coordinador | 26, 18, 19, 20, 21, 22, 23 | 02 | 05 | G1, G8, G9, G13, G15 | COO |
| CU-D95-18 Flujo del Técnico | 27 | 03 | — | G2, G4, G5, G11 | TEC |
| CU-D95-19 Alta de la cuenta de gestión y RBAC | — | 04 | 01, 05 | G1, G11, G14, G16, G17 | SUPER |
| CU-D95-20 Modelo de mensajería por destinatario usuario | 22, 24 | — | 03 | G9, G15 | SUPER |
| CU-D95-21 APK multi-rol | 27, 29, 30 | 03, 05, 06 | 04 | G2, G17, G18 | SUPER |
| **CU-D95-22 Aislar por central** 🆕 | — | 06 | **02** | G6, G18 | SUPER |
| **CU-D95-23 Alta manual de un caso** 🆕 | **29** | 02 | — | G4, G6, G12 | SUP / ADM |
| **CU-D95-24 Edición ligera de un caso** 🆕 | **30** | 02 | — | G4, G6, G12 | SUP / ADM |

### Cobertura requisito → caso de uso

| Requisito | Casos de uso |
|---|---|
| RF-APK-13 Monitoreo SUP/ADM | CU-D95-04 |
| RF-APK-14 Especiales SUP/ADM | CU-D95-07 |
| RF-APK-15 Despacho | CU-D95-09 |
| RF-APK-16 Casos: ver y asignar | CU-D95-10 |
| RF-APK-17 Pantalla GESTIÓN | CU-D95-10, CU-D95-11 |
| RF-APK-18 Monitoreo Coordinador | CU-D95-04, CU-D95-08, CU-D95-17 |
| RF-APK-19 Crear especiales | CU-D95-08, CU-D95-17 |
| RF-APK-20 Fallas masivas lectura | CU-D95-15, CU-D95-17 |
| RF-APK-21 Orden de material | CU-D95-16, CU-D95-17 |
| RF-APK-22 Mensaje al Supervisor | CU-D95-13, CU-D95-17, CU-D95-20 |
| RF-APK-23 Alertas del Coordinador | CU-D95-14, CU-D95-17 |
| RF-APK-24 Bandeja del Supervisor | CU-D95-12, CU-D95-20 |
| RF-APK-25 Alertas SUP/ADM | CU-D95-14 |
| RF-APK-26 WEB del Coordinador | CU-D95-17 |
| RF-APK-27 Navegación por rol | CU-D95-01, CU-D95-03, CU-D95-18, CU-D95-21 |
| RF-APK-28 Indicador y refresco manual | CU-D95-05 |
| **RF-APK-29 Alta manual de un caso** | **CU-D95-23**, CU-D95-21 |
| **RF-APK-30 Edición ligera de un caso** | **CU-D95-24**, CU-D95-21 |
| RNF-APK-01 Refresco 5 min | CU-D95-04, CU-D95-05, CU-D95-06, CU-D95-07, CU-D95-11, CU-D95-14 |
| RNF-APK-02 Caché y escritura online | CU-D95-04, CU-D95-05, CU-D95-06, CU-D95-08, CU-D95-09, CU-D95-10, CU-D95-13, CU-D95-14, CU-D95-15, CU-D95-16, CU-D95-17, CU-D95-23, CU-D95-24 |
| RNF-APK-03 Coexistencia con D-84 | CU-D95-18, CU-D95-21 |
| RNF-APK-04 MFA obligatorio | CU-D95-01, CU-D95-02, CU-D95-19 — **declarado incumplido por decisión expresa (RA-01)** |
| RNF-APK-05 Accesibilidad | CU-D95-03, CU-D95-21 |
| **RNF-APK-06 Rendimiento y prueba de carga** | CU-D95-04, CU-D95-05, CU-D95-14, CU-D95-21, CU-D95-22 |
| RT-APK-01 Alta del rol COORDINADOR | CU-D95-01, CU-D95-02, CU-D95-19 |
| **RT-APK-02 Acotado por central** | **CU-D95-22** (y transversal en CU-D95-01, 04, 07, 08, 10, 11, 13, 14, 15, 17, 19, 23, 24) |
| RT-APK-03 Mensajería por destinatario usuario | CU-D95-12, CU-D95-13, CU-D95-20 |
| RT-APK-04 APK multi-rol | CU-D95-21 |
| RT-APK-05 Acotar `require_roles` | CU-D95-14, CU-D95-16, CU-D95-18, CU-D95-19 |

### Cobertura caso de uso → decisión (DEC-G1…DEC-G19)

| Decisión | Casos de uso que la realizan |
|---|---|
| DEC-G1 (rol COORDINADOR) | CU-D95-01, 08, 13, 14, 17, 19 |
| DEC-G2 (una sola APK multi-rol) | CU-D95-01, 03, 18, 21 |
| DEC-G3 (ADMIN = SUPERVISOR) | CU-D95-03, 04, 07, 09, 10, 11, 14 |
| DEC-G4 (online con caché) | CU-D95-05, 06, 08, 09, 10, 13, 16, 18, 23, 24 |
| DEC-G5 (refresco 5 min) | CU-D95-04, 05, 18 |
| DEC-G6 (una central por usuario) | CU-D95-01, 04, 07, 08, 13, 15, 22, 23, 24 |
| DEC-G7 (GESTIÓN sin Coordinador) | CU-D95-03, 10, 11 |
| DEC-G8 (alcance del Coordinador en fallas) | CU-D95-08, 14, 15, 16, 17, 19 |
| DEC-G9 (mensajería de una vía) | CU-D95-12, 13, 17, 20 |
| DEC-G10 (reescrita por DEC-G14) | CU-D95-02 (sustituida) |
| **DEC-G11** (reporte de campo excluye al Coordinador) | **CU-D95-14, CU-D95-18, CU-D95-19** |
| **DEC-G12** (alta manual y edición ligera) | **CU-D95-23, CU-D95-24** (+ verificación en CU-D95-21) |
| **DEC-G13** (monitorear sin actuar) | **CU-D95-14, CU-D95-15, CU-D95-16, CU-D95-17** |
| **DEC-G14** (MFA diferido · RA-01) | **CU-D95-02, CU-D95-19** |
| **DEC-G15** (mensajería por destinatario usuario) | **CU-D95-12, CU-D95-13, CU-D95-17, CU-D95-20** |
| **DEC-G16** (cuenta de gestión separada de `tecnico`) | **CU-D95-03, CU-D95-19** |
| **DEC-G17** (gobierno del rol) | **CU-D95-03, CU-D95-19, CU-D95-21** |
| **DEC-G18** (rendimiento y prueba de carga) | **CU-D95-04, CU-D95-05, CU-D95-21, CU-D95-22** |
| **DEC-G19** (PII: solo enmascaramiento visual · RA-02) | **CU-D95-06** |

### Matriz ALERTAS corregida (H-21)

La fila ALERTAS de la matriz RBAC de `requerimientos.md` §5.2 debe reflejar los `require_roles` reales
y no el CRUD del Técnico:

| Acción de alertas | SUPER | ADMIN | SUPERVISOR | COORDINADOR | TECNICO |
|---|---|---|---|---|---|
| Ver fallas masivas, ficha y órdenes | CRUD | Lectura | Lectura | **Lectura** | Lectura |
| Declarar / detectar / planificar / cerrar falla | CRUD | Escritura | Escritura | **—** (403) | **—** |
| Orden de material | CRUD | Escritura | Escritura | **Crear / consultar** | **—** |
| **Reporte de campo** (`/fallas-masivas/reporte-campo`) | Sí | Sí | Sí | **—** (403, DEC-G11) | **Sí** |
| Procesar el outbox de notificaciones | CRUD | Escritura | Escritura | **—** | **—** |

> Evidencia del estado real: `_escritura = require_roles("ADMIN","SUPERVISOR")` protege declarar,
> detectar, `PATCH`, planificar, material y procesar el outbox (`app/api/routes_alertas.py:43,177,251,267,283,336,376`);
> el Técnico **solo** dispone de `reporte-campo`, que hoy exige únicamente autenticación
> (`routes_alertas.py:203-210`) y que DEC-G11 debe cerrar al Coordinador.

**Requisitos huérfanos (declaración explícita):**

| Requisito | Situación | Motivo y dónde queda cubierto |
|---|---|---|
| *(ninguno)* | — | **RT-APK-02 dejó de ser huérfano en la v0.2**: al ser H-01 un defecto real (la RLS está inerte y `resolver_central` acepta el `id_central` del cliente), el acotado por central es ahora un objetivo con actor propio y tiene su caso: **CU-D95-22**, con la batería negativa A→B como criterio de cierre. |

**Requisitos declarados sin cumplimiento (no son huérfanos, son riesgos aceptados):**

| Requisito | Situación | Decisión y dónde se declara |
|---|---|---|
| **RNF-APK-04** — MFA obligatorio para los roles de gestión | **INCUMPLIDO POR DECISIÓN EXPRESA** en este incremento | **DEC-G14**, riesgo aceptado **RA-01** con dueño (Dirección del proyecto) y fecha (ciclo propio posterior a D-98). Se declara en CU-D95-01, CU-D95-02 y CU-D95-19; **ningún** criterio de aceptación del documento exige MFA. |
| **RNF-22** (vigente) — «MFA obligatorio para ADMIN y SUPERVISOR» | **INCUMPLIDO** y arrastrado como deuda | Mismo RA-01; el incumplimiento se documenta en el manual de seguridad (DEC-G14). |
| **RNF-18** (vigente) — enmascaramiento de PII por rol | **Cubierto SOLO en pantalla** | **DEC-G19**, riesgo aceptado **RA-02** (caché local sin cifrar, sin TTL, sin `FLAG_SECURE`, sin PIN/biometría). Se declara en CU-D95-06. |
| **RNF-13/16** (vigente) — retención y respaldo de los datos nuevos | **Pendiente de declarar** | La retención de la mensajería de gestión se menciona en CU-D95-20/A8; el respaldo/RPO/RTO de los datos nuevos queda como duda abierta nº 6 (H-24, H-25). |

> **Sin otros huérfanos:** los **18 RF-APK nuevos de este incremento** (RF-APK-13…30), los
> **6 RNF-APK** (01…06) y los **5 RT-APK** (01…05) quedan cubiertos por al menos un caso de uso
> según las tablas anteriores. Los RF-APK-01…12 pertenecen a incrementos previos y no se
> re-auditan aquí.

---

## Dudas abiertas / pendientes de confirmar

| # | Tema | Estado | Impacto si no se confirma |
|---|---|---|---|
| **1** | **¿El Coordinador puede crear el solicitante en línea (`crear_solicitante`) o solo elegir uno existente?** El endpoint lo permite hoy (`routes_especiales.py:203-207`), pero la matriz RBAC le concede «CRUD (alta)» solo sobre especiales. | **Pendiente de confirmar** | Afecta a CU-D95-08 y al acotado de RT-APK-05. |
| **2** | **Pantalla GESTIÓN: ¿filtro por la cuadrilla 0 (`id_cuadrilla`) o por la marca `en_gestion_supervisor`?** Los dos existen y pueden divergir: un caso con la marca pero sin despacho de cuadrilla 0 no aparece por `id_cuadrilla`, porque el filtro usa el **último despacho** (`routes_casos.py:155-177`). | **Pendiente de decisión** (afecta al riesgo R5 y a CU-D95-11) | Si se elige la marca, la columna «Cuadrilla» de la pantalla mostrará otra cuadrilla; hay que fijar cuál es la verdad. |
| **3** | **Almacén local de la APK multi-rol: ¿namespace por usuario y rol?** La decisión de **no cifrar** ya está tomada (DEC-G19/RA-02), pero sigue abierto el diseño del almacén: base o tablas separadas por usuario, purga de la caché y de la cola en el cierre de sesión, y migración versionada del esquema local, porque hoy `leerCasos()` devuelve todo `caso_local` sin distinguir usuario (`app_movil/lib/core/database.dart:37-98,214-247`) y `AuthStorage.limpiarSesion()` no borra la base (`auth_storage.dart:55-58`). | **Pendiente de decisión de diseño** (H-14) | Un dispositivo compartido deja la caché del usuario anterior y `ids_conocidos` de una sesión puede viajar bajo el token de otra. |
| **4** | **¿El indicador de frescura debe mostrar también la antigüedad cuando el dato supera 24 h?** CU-D95-06/A4 lo propone como **rótulo visual** (no hay TTL ni purga, RA-02). | **Propuesta, pendiente de aceptar** | Solo afecta al texto de la banda, no al contrato. |
| **5** | **`SUPER` en la APK de gestión**: ¿se le ofrece el menú completo (8 secciones + campo y la vista de auditoría en solo lectura de DEC-G17) como dice el bypass de `deps.py:65`, o se excluye de la APK por ser la cuenta de administración? | **Pendiente de confirmar** | Cambia CU-D95-03/A3, CU-D95-19 y el menú de CU-D95-21. |
| **6** | **Retención, respaldo y RPO/RTO de los datos nuevos** (mensajería de gestión con destinatario usuario y auditoría de las acciones del Coordinador). La retención vigente es configurable (`mensajeria.retencion_dias`, por defecto 5 días, `services/mensajes.py:107-119`) y la instancia provisional no tiene respaldo (riesgo aceptado D-26). | **Pendiente de declarar** (H-24, H-25) | Sin plazo ni respaldo, el cierre de D-95 no puede declarar el ciclo completo. |
| **7** | **Versión mínima soportada de la APK**: no hay mecanismo de versión mínima ni negociación (`grep version_minima|X-App-Version` = 0), de modo que el backend no puede avisar ni bloquear una APK antigua. | **Pendiente de decisión** (H-36) | Coexistencia con `1.1.0+8` sin aviso; afecta a CU-D95-21/A4. |
| **8** | **Responsable de protección de datos y firmante del DPA** con CANTV, exigido por RNF-18 y por el riesgo aceptado **RA-02** (caché local con PII en claro). | **Pendiente externo** (H-04) | RA-02 no puede reevaluarse sin responsable designado. |
| **9** | **¿El reporte de campo de fallas masivas debe además acotarse por central y por cuadrilla?** DEC-G11 ya cierra el rol (403 al Coordinador), pero hoy el endpoint resuelve la central con `resolver_central(db, None, …)` en lugar de la del reportante (`routes_alertas.py:220`). | **Pendiente de confirmar** (se resuelve en CU-D95-22/A4) | Si no se acota, el reporte de un Técnico puede caer en la central configurada, no en la suya. |

## Historial de versiones

| Versión | Fecha | Cambio |
|---|---|---|
| **v0.1** | 2026-10-10 | Emisión inicial: **21 casos de uso** con flujo principal y alternativos, criterios Gherkin y restricciones EARS, matriz de trazabilidad, declaración del único huérfano (RT-APK-02, transversal) y 8 dudas abiertas. Verificación contra el código vigente con la marca «NUEVO — no existe en el backend vigente» en el rol Coordinador, la mensajería Coordinador → Supervisor, la APK de gestión y el MFA. |
| **v0.2** | 2026-10-10 | **24 casos de uso** (3 nuevos: **CU-D95-22**, **CU-D95-23**, **CU-D95-24**; 8 reescritos o ampliados: CU-D95-02, 05, 06, 13, 14, 16, 19, 20). Incorpora las **9 decisiones DEC-G11…DEC-G19** (§3.1 del incremento v0.3) y los hallazgos de `INFORME_OPTIMIZACION_D95_V1.md` (**H-01**, H-05, H-06, H-07; y el resto de críticas a través de las decisiones). Ver **Nota de cambios v0.2** al final. |

---

## Nota de cambios v0.2

**a) Las 9 decisiones nuevas (DEC-G11…DEC-G19).** Cada una tiene su reflejo verificable en los casos:

1. **DEC-G11 · El Coordinador queda excluido del reporte de campo de fallas masivas.** CU-D95-14/A5 y
   CU-D95-19 lo fijan con el criterio `403` al Coordinador en `POST /fallas-masivas/reporte-campo`;
   la matriz ALERTAS corregida (H-21) lo resume. Hoy el endpoint solo exige autenticación
   (`routes_alertas.py:203-210`): es el agujero que se cierra.
2. **DEC-G12 · Se amplía el alcance: RF-APK-29 (alta manual) y RF-APK-30 (edición ligera).**
   Se crean **CU-D95-23** (identificador `REF-…` cuando no hay avería) y **CU-D95-24** (Sector ·
   Fecha de cita · Información de 200 caracteres, con la regla vigente de la ficha web:
   `app/web/src/components/FichaCaso.tsx:445,449`). En la cabecera se declara la **exclusión expresa**
   de seguimiento, empresas, referidos, citas, configuración, ingesta e imprimibles del despacho.
3. **DEC-G13 · «Monitorear las alertas» = ver todo y abrir fichas, sin actuar.** CU-D95-14 (A4 y EARS)
   y CU-D95-15: el Coordinador consulta alertas diarias, fallas masivas y la bandeja, abre la ficha de
   la falla con **casos afectados, planificación y materiales**, y **no** declara, planifica, cierra ni
   cambia el estado.
4. **DEC-G14 · El MFA se difiere (RA-01).** **CU-D95-02 reescrito**: ingreso con `P00` + clave en un
   solo paso, bloqueo a los **3** intentos (`app/core/config.py:31`) y recuperación con **3 de las 12**
   palabras; restricción EARS que declara **RNF-APK-04 incumplido por decisión expresa** con dueño y
   fecha. Se eliminó **todo** criterio de aceptación que exigía un segundo factor (`MFA`, `otp`, `totp`
   ya no aparecen como requisito en ningún Gherkin).
5. **DEC-G15 · Rediseño del modelo de mensajería.** **CU-D95-20 reescrito** (destinatario-usuario,
   nuevos `CHECK`, rama explícita en `resolver_destinatarios`, fin del fallback implícito a `TODOS`) y
   **CU-D95-13 reescrito** (Supervisor **concreto**, con escalado al **ADMIN de su central** cuando no
   esté); CU-D95-12 refleja la bandeja del destinatario-usuario.
6. **DEC-G16 · Cuenta de gestión separada de `tecnico`.** **CU-D95-19**: vía de alta de usuario de
   gestión con `id_tecnico` NULL (el modelo ya lo admite, `app/models/entities.py:80`; el único camino
   actual exige fila en `tecnico`: `routes_config.py:349-383`) y verificación de que el Coordinador no
   aparece en cuadrillas, flota ni despacho.
7. **DEC-G17 · Gobierno.** CU-D95-19 declara dueño funcional y soporte de 1.º/2.º nivel =
   **SUPERVISOR**; keystore y publicación = **SUPER** (CU-D95-21); auditoría de las acciones del
   Coordinador = **SUPER en solo lectura** sobre `auditoria` (vista **nueva**: hoy no hay ningún `GET`
   de auditoría).
8. **DEC-G18 · RNF-APK-06.** CU-D95-05 incorpora el **presupuesto de peticiones** (refresco solo de la
   pantalla visible, tope por token, backoff a partir de 3 fallos) y CU-D95-05, CU-D95-04, CU-D95-14,
   CU-D95-21 y CU-D95-22 exigen p95 ≤ 2 s, **0 errores 5xx** y **prueba de carga obligatoria** antes
   del cierre de D-97 y D-98.
9. **DEC-G19 · PII: solo enmascaramiento visual (RA-02).** **CU-D95-06 reescrito**: enmascaramiento por
   rol en pantalla (regla concreta para el Coordinador) y restricción EARS del riesgo aceptado; **no**
   se promete cifrado, TTL, `FLAG_SECURE` ni PIN/biometría.

**b) Los hallazgos de la auditoría.**

- **H-01 (crítico) — el acotado por central no se aplica.** Se añade el caso **CU-D95-22** con la tabla
  de estado real verificado (`SET LOCAL app.id_central` = 0 coincidencias en `app/**/*.py`;
  `resolver_central` acepta el `id_central` del cliente, `app/services/consultas.py:20-29`; la política
  `p_caso_central` permite todo con el parámetro NULL, `RepoTecnico/db/schema.sql:774-785`), el
  criterio de que un usuario de la central A **no** puede leer datos de B **ni forzando `id_central`**
  en la URL, y la exigencia de tratar el acotado como **comportamiento a implementar** en CU-D95-01,
  04, 07, 08, 10, 11, 13, 14, 15, 17, 19, 23 y 24. **RT-APK-02 deja de ser huérfano.**
- **H-05 — contradicción de alcance en fallas masivas.** CU-D95-16 y CU-D95-14 fijan que la **orden de
  material es la única escritura** del Coordinador sobre fallas masivas, con Gherkin que prueba el
  `403` en declarar, detectar, planificar y procesar el outbox.
- **H-06 — SLO sin reconfirmar.** RNF-APK-06 con p95 ≤ 2 s, 0 errores 5xx y prueba de carga
  obligatoria; CU-D95-21/A6 bloquea la publicación sin esa evidencia.
- **H-07 — sin camino de alta ni gobierno.** Resuelto por DEC-G16 y DEC-G17 dentro de CU-D95-19.

**c) Otros ajustes de coherencia.** Se corrigió el menú del Coordinador en CU-D95-01 (6 secciones, sin
`GESTIÓN`, coherente con DEC-G7 y CU-D95-03); se marcaron como **NUEVO — no existe en el backend
vigente** la cuenta de gestión separada de `tecnico` y la vista de auditoría en solo lectura; se retiró
el MFA de la nota de marcas (ya no es alcance) y se actualizaron los conteos a **18 RF-APK nuevos**
(RF-APK-13…30), 6 RNF-APK (01…06) y 5 RT-APK (01…05).
