# Diagramas — Incremento **D-95 … D-98** · APK de Gestión (Supervisor · Administrador · Coordinador)

| Campo | Valor |
|---|---|
| Documento | Diagramas Mermaid del incremento (casos de uso, secuencias, estados, migración y arquitectura) |
| Estado | **v0.1 — coherente con los casos de uso v0.2 (24 CU) y el incremento v0.3.2** |
| Fecha | 2026-10-10 |
| Base | [`casos_uso_D95.md`](casos_uso_D95.md) · [`../incremento_D95_apk_gestion.md`](../incremento_D95_apk_gestion.md) · [`diagramas_D89.md`](diagramas_D89.md) (estilo de la casa) |
| Alcance | **D-95…D-98**: rol `COORDINADOR`, APK multi-rol, navegación por rol, caché de lectura y refresco de gestión, despacho, mensajería Coordinador → Supervisor, fallas masivas con orden de material, aislamiento por central y la migración de D-95 (§9.3 del incremento) |

> Los actores y los nombres de los casos de uso son **exactamente** los del documento
> de casos de uso: `SUP` Supervisor · `ADM` Administrador · `SUPER` Super Usuario ·
> `COO` Coordinador · `TEC` Técnico *(solo convivencia offline)*. Mismos códigos
> CU-D95-01…CU-D95-24.
>
> **Dos marcas que los diagramas respetan a propósito:** el **MFA no existe y queda diferido**
> (DEC-G14, riesgo aceptado **RA-01**) y la **caché local no se cifra** (DEC-G19, riesgo
> aceptado **RA-02**): ningún diagrama dibuja un segundo factor ni un cifrado que no se
> vaya a construir.

---

## Índice de figuras

| Figura | Tipo | Título | Casos de uso |
|---|---|---|---|
| [§1](#1-diagrama-de-casos-de-uso-uml) | `flowchart` | Diagrama de casos de uso (UML) del incremento | CU-D95-01…24 |
| [§2](#2-secuencia--ingreso-en-la-apk-de-gestión-sin-segundo-factor-cu-d95-01-cu-d95-02) | `sequenceDiagram` | Ingreso en la APK de gestión **sin segundo factor** | CU-D95-01, CU-D95-02 |
| [§3](#3-secuencia--navegación-por-rol-y-menú-por-rol-cu-d95-03-cu-d95-18) | `sequenceDiagram` | Navegación por rol y menú por rol | CU-D95-03, CU-D95-18 |
| [§4](#4-secuencia--refresco-automático-de-5-min-con-presupuesto-de-peticiones-cu-d95-05) | `sequenceDiagram` | Refresco automático de 5 min con presupuesto de peticiones | CU-D95-05 |
| [§5](#5-secuencia--armar-y-publicar-el-despacho-con-dos-supervisores-cu-d95-09) | `sequenceDiagram` | Armar y publicar el despacho (concurrencia entre dos Supervisores) | CU-D95-09 |
| [§6](#6-secuencia--mensaje-del-coordinador-al-supervisor-con-escalado-al-admin-cu-d95-13-cu-d95-20) | `sequenceDiagram` | Mensaje del Coordinador al Supervisor, con escalado al ADMIN | CU-D95-13, CU-D95-20 |
| [§7](#7-secuencia--solicitar-material-para-una-falla-la-única-escritura-del-coordinador-cu-d95-16) | `sequenceDiagram` | Solicitar material para una falla (única escritura del Coordinador) | CU-D95-15, CU-D95-16 |
| [§8](#8-secuencia--aislamiento-por-central-el-usuario-de-la-central-a-fuerza-id_central-de-la-central-b-cu-d95-22) | `sequenceDiagram` | Aislamiento por central: forzar `id_central` de otra central | CU-D95-22 (+ transversal) |
| [§9](#9-estados-de-una-falla-masiva) | `stateDiagram-v2` | Estados de una falla masiva | CU-D95-14, CU-D95-15, CU-D95-16 |
| [§10](#10-estados-de-la-cuenta-de-gestión) | `stateDiagram-v2` | Estados de la cuenta de gestión (alta → activa → bloqueada) | CU-D95-01, CU-D95-02, CU-D95-19 |
| [§11](#11-superficie-de-migración-de-d-95-8-objetos) | `flowchart` | Superficie de migración de D-95 (8 objetos de §9.3) | CU-D95-19, CU-D95-20, CU-D95-22 |
| [§12](#12-arquitectura-de-la-apk-multi-rol) | `flowchart` | Arquitectura de la APK multi-rol (TÉCNICO offline vs GESTIÓN online) | CU-D95-03, CU-D95-05, CU-D95-06, CU-D95-18 |

**Total: 12 figuras** (1 de casos de uso, 7 de secuencia, 2 de estados y 2 de estructura).
Las §13 y §14 son tablas de trazabilidad y de historial, no figuras.

---

## 1. Diagrama de casos de uso (UML)

Actores a la izquierda y a la derecha, los **24 casos de uso** agrupados por módulo y las
relaciones `include` / `extend` que existen de verdad: el refresco de 5 min y la caché de
lectura los **incluyen** las pantallas de gestión; la **orden de material** es una
**extensión** de la consulta de la falla; el **escalado al ADMIN** es una extensión del
mensaje al Supervisor; y el **alta y la edición ligera de casos** extienden el ciclo de
vida de un caso de la APK.

```mermaid
flowchart TB
    subgraph ACT["Actores"]
        SUP["Supervisor"]
        ADM["Administrador"]
        COO["Coordinador"]
        TEC["Tecnico"]
        SUPER["Super Usuario"]
    end

    subgraph SIS["Sistemas externos"]
        API["Backend / API GGTO"]
        ING["Ingesta"]
    end

    subgraph M_GEN["GGTO - APK de Gestion por modulo"]
        CU01["CU-D95-01<br/>Ingresar en la APK de gestion con autenticacion por rol"]
        CU02["CU-D95-02<br/>Ingresar los roles de gestion sin segundo factor"]
        CU03["CU-D95-03<br/>Navegar por la APK segun el rol autenticado"]
        CU05["CU-D95-05<br/>Refrescar automaticamente cada 5 minutos con presupuesto de peticiones"]
        CU06["CU-D95-06<br/>Consultar sin conexion con enmascaramiento visual y cache sin cifrar"]
        CU18["CU-D95-18<br/>Conservar el flujo offline del Tecnico con CARGA/DESCARGA manual"]
        CU21["CU-D95-21<br/>Publicar la APK multi-rol con su version y firma"]
    end

    subgraph M_MON["Modulo MONITOREO"]
        CU04["CU-D95-04<br/>Consultar el monitoreo de la gestion en sus 5 vistas"]
    end

    subgraph M_ESP["Modulo ESPECIALES"]
        CU07["CU-D95-07<br/>Listar, filtrar y abrir la ficha de un caso especial"]
        CU08["CU-D95-08<br/>Crear un caso especial con su caso asociado"]
    end

    subgraph M_DES["Modulo DESPACHO y GESTION"]
        CU09["CU-D95-09<br/>Armar y publicar el despacho del dia"]
        CU10["CU-D95-10<br/>Asignar y quitar un caso del despacho de la cuadrilla"]
        CU11["CU-D95-11<br/>Operar la pantalla GESTION de la cuadrilla 0"]
    end

    subgraph M_CAS["Modulo CASOS"]
        CU23["CU-D95-23<br/>Dar de alta manualmente un caso de gestion"]
        CU24["CU-D95-24<br/>Editar ligeramente un caso desde la APK"]
    end

    subgraph M_ALE["Modulo ALERTAS y FALLAS MASIVAS"]
        CU14["CU-D95-14<br/>Monitorear las alertas sin actuar, las fallas masivas y la bandeja de notificaciones"]
        CU15["CU-D95-15<br/>Consultar una falla masiva con detalle de planificacion y materiales"]
        CU16["CU-D95-16<br/>Solicitar material para una falla masiva"]
    end

    subgraph M_MEN["Modulo MENSAJES"]
        CU12["CU-D95-12<br/>Gestionar la bandeja de mensajes del Supervisor"]
        CU13["CU-D95-13<br/>Enviar un mensaje a un Supervisor concreto de su central"]
    end

    subgraph M_ADM["Modulo ADMINISTRACION y SEGURIDAD"]
        CU19["CU-D95-19<br/>Dar de alta la cuenta de gestion del Coordinador y acotar el RBAC"]
        CU20["CU-D95-20<br/>Habilitar el modelo de mensajeria por destinatario usuario"]
        CU22["CU-D95-22<br/>Aislar por central los datos de la APK de gestion"]
    end

    subgraph M_WEB["Canal WEB"]
        CU17["CU-D95-17<br/>Usar la WEB del Coordinador con las mismas capacidades"]
    end

    SUP --> CU01
    SUP --> CU03
    SUP --> CU04
    SUP --> CU07
    SUP --> CU08
    SUP --> CU09
    SUP --> CU10
    SUP --> CU11
    SUP --> CU12
    SUP --> CU14
    SUP --> CU15
    SUP --> CU16
    SUP --> CU23
    SUP --> CU24

    ADM --> CU01
    ADM --> CU03
    ADM --> CU04
    ADM --> CU07
    ADM --> CU08
    ADM --> CU09
    ADM --> CU10
    ADM --> CU11
    ADM --> CU12
    ADM --> CU14
    ADM --> CU15
    ADM --> CU16
    ADM --> CU23
    ADM --> CU24

    COO --> CU01
    COO --> CU03
    COO --> CU04
    COO --> CU07
    COO --> CU08
    COO --> CU13
    COO --> CU14
    COO --> CU15
    COO --> CU16
    COO --> CU17

    TEC --> CU03
    TEC --> CU18
    SUPER --> CU19
    SUPER --> CU20
    SUPER --> CU21
    SUPER --> CU22

    API -.-> CU21
    API -.-> CU22
    ING -.-> CU22

    CU01 -.->|include| CU02
    CU03 -.->|include| CU05
    CU03 -.->|include| CU06
    CU04 -.->|include| CU05
    CU07 -.->|include| CU05
    CU11 -.->|include| CU05
    CU14 -.->|include| CU05
    CU14 -.->|include| CU15
    CU15 -.->|extend<br/>si el usuario pide la orden de material| CU16
    CU13 -.->|extend<br/>si no hay Supervisor activo: escala al ADMIN| CU20
    CU12 -.->|extend<br/>destino_tipo = SUPERVISOR| CU20
    CU07 -.->|extend<br/>el Coordinador crea el especial| CU08
    CU10 -.->|extend<br/>alta manual sin averia| CU23
    CU10 -.->|extend<br/>edicion de Sector, Fecha de cita e Informacion| CU24
    CU08 -.->|include<br/>acotado a usuario.id_central| CU22
    CU16 -.->|include<br/>acotado a usuario.id_central| CU22
    CU17 -.->|include| CU13

    linkStyle 0,1,2,3,4,5,6,7,8,9,10,11,12,13 stroke:#1f6feb,stroke-width:1px
    linkStyle 14,15,16,17,18,19,20,21,22,23,24,25,26,27 stroke:#2da44e,stroke-width:1px
    linkStyle 28,29,30,31,32,33,34,35,36 stroke:#bf8700,stroke-width:1px
    linkStyle 37,38,39,40 stroke:#8250df,stroke-width:1px
    linkStyle 41,42,43 stroke:#cf222e,stroke-width:1px
    linkStyle 44,45,46,47,48,49,50,51,52,53,54,55,56,57,58 stroke:#57606a,stroke-width:1px,stroke-dasharray:4 3
```

> **Lectura del diagrama.** `SUP` y `ADM` comparten menú de gestión (DEC-G3); el `COO` **no**
> llega a CU-D95-09, CU-D95-10, CU-D95-11, CU-D95-23 ni CU-D95-24 (matriz §5: DESPACHO «—»,
> GESTIÓN «—», CASOS «—»); el `TEC` **solo** aparece en CU-D95-03 y CU-D95-18 — nunca en las
> pantallas de gestión ni en el temporizador de refresco (RNF-APK-03, D-84); el `SUPER` es el
> único actor de la migración, el modelo de mensajería, la publicación y el aislamiento por
> central. CU-D95-02 y CU-D95-06 son el reflejo en el diagrama de los riesgos aceptados
> **RA-01** y **RA-02**.

---

## 2. Secuencia — Ingreso en la APK de gestión **sin segundo factor** (CU-D95-01, CU-D95-02)

El login vigente emite el token en **un solo paso**: no hay pantalla de código de 6 dígitos,
ni endpoint `MFA`/`otp`/`totp`, ni rama de verificación. RNF-APK-04 queda **incumplido por
decisión expresa** (DEC-G14, riesgo aceptado **RA-01**). El bloqueo a los 3 intentos y la
recuperación con 3 de las 12 palabras sí se dibujan porque **existir, existen**.

```mermaid
sequenceDiagram
    autonumber
    actor USU as SUP / ADM / COO
    participant ACCESO as ACCESO (Flutter, sesion.dart)
    participant API as POST /api/v1/auth/login
    participant AUTH as routes_auth + Argon2id
    participant DB as PostgreSQL (usuario)

    USU->>ACCESO: Escribe P00/correo y clave
    ACCESO->>API: POST /api/v1/auth/login (p00, clave)
    API->>AUTH: _rate_limit por p00 + IP
    alt demasiados intentos en la ventana
        AUTH-->>API: 429 "Demasiados intentos. Espere un momento."
    else ventana en orden
        AUTH->>DB: SELECT usuario WHERE p00
        alt usuario.bloqueado = true
            AUTH-->>API: 423 "Usuario bloqueado. Use la recuperacion con sus palabras."
        else cuenta ACTIVO
            AUTH->>DB: verificar clave_hash (Argon2id)
            alt clave incorrecta
                AUTH->>DB: intentos_fallidos = intentos_fallidos + 1
                alt tercer fallo consecutivo
                    AUTH->>DB: bloqueado = true
                    AUTH-->>API: 423 "Usuario bloqueado por superar los intentos permitidos"
                else primer o segundo fallo
                    AUTH-->>API: 401 "Credenciales invalidas" + X-Intentos-Restantes
                end
            else clave correcta
                AUTH->>DB: intentos_fallidos = 0 y bloqueado = false
                Note over AUTH,DB: Token emitido en un solo paso. NO existe segundo factor conforme a DEC-G14 y al riesgo RA-01
                AUTH-->>API: 200 token + usuario (p00, nombre, apellido, correo, rol, id_central, id_tecnico)
            end
        end
    end
    API-->>ACCESO: respuesta (401 / 423 / 429 / 200)
    alt 200 y rol de gestion
        ACCESO->>ACCESO: guarda la sesion y aplica la navegacion por rol (CU-D95-03)
        ACCESO-->>USU: abre MONITOREO (vista Diaria) de su central
    else 200 y rol TECNICO
        ACCESO-->>USU: abre CASOS de su cuadrilla, sin temporizador de 5 min (CU-D95-18)
    else 401 / 423
        ACCESO-->>USU: vuelve a ACCESO sin conservar cache de sesion
    end

    Note over ACCESO,API: No hay ninguna pantalla, campo ni peticion de segundo factor (CU-D95-02)
    Note over USU,DB: Recuperacion: POST /auth/unlock o /auth/reset-password con 3 de las 12 palabras
```

---

## 3. Secuencia — Navegación por rol y menú por rol (CU-D95-03, CU-D95-18)

Un solo binario, tres menús: **8 secciones** para `SUPERVISOR`/`ADMIN` (DEC-G3), **6** para el
`COORDINADOR` (sin `GESTIÓN` ni `DESPACHO`, DEC-G7) y el menú de campo del `TÉCNICO`. La
navegación directa por ruta interna **no renderiza** la pantalla prohibida.

```mermaid
sequenceDiagram
    autonumber
    actor USU as USUARIO autenticado
    participant APK as APK multi-rol (menu por rol)
    participant GUARD as Guard de ruta (lista blanca por rol)
    participant FLUJO as Flujo del rol
    participant API as API GGTO
    participant WEB as SPA (guard RutaGestion)

    USU->>APK: Abre el menu principal
    alt sesion.rol = SUPERVISOR o ADMIN
        APK-->>USU: 8 secciones: MONITOREO, ESPECIALES, DESPACHO, CASOS, GESTION, ALERTAS, MENSAJES, USUARIO
    else sesion.rol = COORDINADOR
        APK-->>USU: 6 secciones: MONITOREO, ESPECIALES (crear), FALLAS MASIVAS (lectura + material), ALERTAS, MENSAJES, USUARIO
        Note over APK: No ve GESTION (DEC-G7) ni DESPACHO ni el alta manual de casos
    else sesion.rol = TECNICO
        APK-->>USU: Menu de campo: CASOS, ALERTAS, MENSAJES, USUARIO
        Note over APK,API: Sin temporizador de 5 min y sin descarga automatica (RNF-APK-03, D-84)
    else rol desconocido o vacio
        APK-->>USU: solo USUARIO y Salir, no abre pantallas de datos
    end

    USU->>GUARD: Navega a una seccion
    alt la seccion pertenece al rol
        GUARD->>FLUJO: abre la pantalla
        alt rol de gestion (SUP / ADM / COO)
            FLUJO->>FLUJO: instala un unico temporizador de 5 min (CU-D95-05)
        else rol TECNICO
            FLUJO->>FLUJO: NO instala temporizador, CARGA y DESCARGA son manuales
        end
    else la seccion esta prohibida para el rol
        GUARD-->>USU: redirige a MONITOREO (o a CASOS si es TECNICO) sin renderizar
    end

    USU->>WEB: (COORDINADOR) escribe /despacho o /casos en la URL
    WEB-->>USU: el guard de lista blanca lo redirige a la OPERACION y la pagina no se renderiza (H-08)

    USU->>APK: Pulsa Atras
    APK-->>USU: vuelve al menu sin cerrar sesion
    USU->>APK: Pulsa Salir
    APK->>APK: limpia la sesion y cancela el temporizador
    APK-->>USU: vuelve a ACCESO
```

---

## 4. Secuencia — Refresco automático de 5 min con **presupuesto de peticiones** (CU-D95-05)

Solo la pantalla visible, una petición en vuelo como máximo, tope por token y política de
fallo definida (backoff a partir de 3 fallos consecutivos). El `TÉCNICO` **no aparece** en
este diagrama: su temporizador no se instala (RNF-APK-03, riesgo R1).

```mermaid
sequenceDiagram
    autonumber
    actor USU as SUP / ADM / COO
    participant APK as Pantalla de gestion (primer plano)
    participant TIMER as Temporizador 5 min (uno solo)
    participant API as Endpoint de la pantalla
    participant CACHE as Cache de lectura local

    USU->>APK: Abre la pantalla de gestion
    APK->>TIMER: arranca 5 min para ESTA pantalla
    APK->>API: consulta inicial de la pantalla visible
    API-->>APK: datos
    APK->>CACHE: guarda la lectura con su hora
    APK-->>USU: pinta los datos y "actualizado hh:mm"

    loop cada 5 min +-30 s en primer plano
        TIMER->>APK: cumple el intervalo
        alt hay una peticion anterior en vuelo
            APK->>APK: no dispara una segunda peticion, nunca se solapa
        else hay un formulario con cambios sin guardar
            APK->>APK: pausa el refresco y conserva lo tecleado
        else se alcanzo el tope de peticiones del token
            APK-->>USU: "sin refrescar - tope alcanzado" con el contenido anterior
            Note over APK,USU: no encadena reintentos, el boton manual sigue disponible
        else toca refrescar
            APK->>API: reejecuta la consulta de la pantalla visible
            alt 200
                API-->>APK: datos frescos
                APK->>CACHE: actualiza la lectura
                APK-->>USU: "actualizado hh:mm" y contador de peticiones +1
            else fallo de red
                APK-->>USU: "sin conexion - actualizado hh:mm" conservando el contenido
                Note over APK: a partir del fallo numero 3 aplica backoff (hasta 20 min)
            else 401 sesion expirada
                APK->>TIMER: cancela el temporizador
                APK-->>USU: vuelve a ACCESO
            else 403 sin permisos
                APK-->>USU: "No tiene permisos para esta seccion" y no reintenta
            end
        end
    end

    USU->>APK: Pulsa "Actualizar"
    APK->>API: relanza la consulta de inmediato
    APK->>TIMER: reinicia el contador a 5 min
    USU->>APK: Pasa la app a segundo plano
    APK->>TIMER: cancela (no acumula refrescos)
    USU->>APK: Vuelve a primer plano
    APK->>TIMER: rearranca y refresca una sola vez
    USU->>APK: Cambia de pantalla
    APK->>TIMER: reasigna el temporizador a la nueva pantalla visible
    Note over APK: nunca hay dos temporizadores activos a la vez
```

---

## 5. Secuencia — Armar y publicar el despacho, con dos Supervisores (CU-D95-09)

El conflicto de la concurrencia (riesgo R2 / H-12) se resuelve en el servidor con `409`: el
segundo Supervisor **no descarta en silencio** lo que el otro guardó.

```mermaid
sequenceDiagram
    autonumber
    actor S1 as Supervisor A
    actor S2 as Supervisor B
    participant UI as DESPACHO (pestana Proceso)
    participant API as routes_despachos
    participant DES as services/despacho
    participant DB as PostgreSQL

    S1->>UI: Abre DESPACHO del dia
    UI->>API: GET /api/v1/despachos/proceso?fecha=hoy
    API->>DES: universo de casos y cuadrillas del dia
    DES->>DB: SELECT casos elegibles, cuadrilla_sector_dia
    DB-->>DES: universo + asignacion por cuadrilla
    DES-->>UI: proceso (bloque de cuadrilla 0 sin sectores seleccionables)
    UI-->>S1: pinta el proceso

    S1->>UI: Ajusta los sectores de la cuadrilla C-002 y guarda
    UI->>API: PUT /api/v1/despachos/asignacion
    API->>DES: guardar_asignacion
    Note over DES,DB: D-95 corrige el filtro por id_central (H-13):<br/>guardar A no borra la asignacion de B
    DES->>DB: DELETE + INSERT de la asignacion de SU central y SU fecha
    API-->>UI: 200 con el proceso recalculado

    S1->>UI: Pulsa Procesar
    UI->>API: POST /api/v1/despachos/procesar (fecha, id_central, asignaciones, reemplazar)
    API->>DES: construir_propuesta + guardar_propuesta
    DES->>DB: SELECT despachos de la fecha
    alt ya hay despacho PUBLICADO o CERRADO de esa fecha
        DES-->>API: 409 "Ya hay despachos publicados o cerrados para esa fecha"
        API-->>UI: 409
        UI-->>S1: muestra el motivo y bloquea la publicacion
    else ya existe un despacho del dia y no se pidio reemplazar
        DES-->>API: 409 "Ya existe un despacho para esa fecha (use reemplazar=true)"
        API-->>UI: 409
        UI-->>S1: informa y no cambia nada
    else se puede procesar
        DES->>DB: INSERT despachos en estado BORRADOR (uno por cuadrilla, incluida la 0)
        API-->>UI: 201 con la lista de DespachoOut
        UI-->>S1: muestra los borradores

        Note over S1,S2: S2 proceso la misma fecha en paralelo
        S2->>UI: Procesa la misma fecha
        UI->>API: POST /api/v1/despachos/procesar
        API->>DES: guardar_propuesta
        DES->>DB: SELECT despachos de la fecha
        S1->>UI: Publica la cuadrilla C-002
        UI->>API: PATCH /api/v1/despachos/{id} estado=PUBLICADO
        API->>DB: estado = PUBLICADO y enviado_en = now()
        API-->>UI: 200
        UI-->>S1: despacho C-002 publicado
        DES-->>API: 409 conflicto de concurrencia (H-12)
        API-->>UI: 409 al segundo Supervisor
        UI-->>S2: muestra el mensaje y NO descarta lo que S1 guardo
    end

    S1->>UI: Envia la ficha por canal
    UI->>API: POST /despachos/{id}/enviar?canal=TELEGRAM o CORREO
    alt Telegram no configurado
        API-->>UI: notificacion con estado FALLIDO y su error
        UI-->>S1: muestra el fallo y ofrece reenviar
    else canal en orden
        API-->>UI: notificacion enviada
    end
    Note over UI,API: Sin conexion no se procesa ni se publica: solo la ultima lectura con aviso (CU-D95-06)
```

---

## 6. Secuencia — Mensaje del Coordinador al Supervisor, con **escalado al ADMIN** (CU-D95-13, CU-D95-20)

El destino es un **usuario concreto de su central** (DEC-G15). Si no hay ningún `SUPERVISOR`
activo, el mensaje **escala al `ADMIN` de la misma central** y deja constancia del motivo.
La vía es de **una sola dirección**: el Supervisor no tiene botón «Responder» (DEC-G9).

```mermaid
sequenceDiagram
    autonumber
    actor COO as Coordinador
    participant UI as MENSAJES (pestana Redactar)
    participant API as Endpoint del Coordinador (capacidad dedicada)
    participant MSG as services/mensajes
    participant RES as resolver_destinatarios
    participant DB as PostgreSQL (mensaje, mensaje_destino)

    COO->>UI: Abre Redactar
    UI->>UI: exige conexion, sin red informa y deshabilita Enviar
    COO->>UI: Escribe el cuerpo (max 500 caracteres) y opcional id_caso
    UI->>API: GET usuarios SUPERVISOR activos de su central
    API->>DB: SELECT usuario por rol SUPERVISOR, activo, id_central = usuario.id_central
    DB-->>API: supervisores de la central
    alt no hay ningun SUPERVISOR activo en la central
        API-->>UI: sin supervisores disponibles
        UI-->>COO: ofrece escalar el mensaje al ADMIN de su central
        COO->>UI: Acepta el escalado
        UI->>API: envia con destino SUPERVISOR y escalado al ADMIN
        Note over API,DB: observacion = SUPERVISOR_AUSENTE_ESCALADO_ADMIN
    else hay supervisores
        UI-->>COO: selector de Supervisor concreto
        COO->>UI: Elige al Supervisor S-2 y pulsa Enviar
    end

    UI->>API: POST (destino_tipo = "SUPERVISOR", id_usuario_destino)
    API->>DB: verifica que el destinatario es SUPERVISOR activo de la MISMA central
    alt destinatario de otra central
        API-->>UI: 403 y no se crea el mensaje
    else el Supervisor dejo de estar activo
        API-->>UI: 422 "El Supervisor seleccionado no esta disponible"
        UI-->>COO: ofrece el escalado del ADMIN
    else destino_tipo TODOS, CUADRILLA o TECNICO
        API-->>UI: 403 (el Coordinador no difunde a tecnicos, DEC-G9 / H-10)
    else destino valido
        API->>MSG: crear mensaje
        MSG->>DB: INSERT mensaje (origen_p00 = P00 del Coordinador, destino_tipo = SUPERVISOR)
        MSG->>RES: resolver_destinatarios
        Note over RES: rama explicita SUPERVISOR.<br/>Se elimina el fallback implicito a TODOS (H-03 / H-10)
        alt el destino no es uno de los admitidos
            RES-->>MSG: 422 y no se materializa ningun destinatario
        else destino admitido
            RES->>DB: INSERT mensaje_destino por destinatario-USUARIO (no por tecnico)
            MSG->>DB: INSERT en auditoria (origen, destino y fecha)
            API-->>UI: 201 con destino_tipo = SUPERVISOR
        end
    end

    UI-->>COO: confirma el envio y lo muestra en la pestana Enviados
    Note over COO,DB: El Supervisor S-2 lo ve en su bandeja de recibidos y S-1 no lo ve
    Note over UI: NO existe boton "Responder": Supervisor a Coordinador esta prohibido (DEC-G9)
    Note over UI,DB: La respuesta del Supervisor no se dibuja porque el sistema no la admite
```

---

## 7. Secuencia — Solicitar material para una falla: la **única escritura** del Coordinador (CU-D95-16)

Es también la **única** extensión de la consulta de la falla: todo lo demás que el Coordinador
intenta sobre fallas masivas responde `403` (DEC-G8, DEC-G13, **H-05**).

```mermaid
sequenceDiagram
    autonumber
    actor COO as Coordinador
    participant FICHA as Ficha de la falla
    participant API as routes_alertas
    participant GUARD as Guard por capacidad
    participant DB as PostgreSQL (orden_material)

    COO->>FICHA: Abre la falla 42 y pulsa "Solicitar material"
    FICHA->>FICHA: exige conexion, sin red no abre el formulario
    COO->>FICHA: Descripcion obligatoria y cuadrilla opcional (por defecto, la de la falla)
    FICHA->>API: POST /api/v1/fallas-masivas/42/material
    API->>GUARD: guard por capacidad (el Coordinador SI puede en esta operacion)
    alt descripcion vacia o en blanco
        API-->>FICHA: 422 y no se crea ninguna orden
    else la falla esta cerrada
        API-->>FICHA: no admite nuevas ordenes de material
        FICHA-->>COO: mensaje y boton oculto
    else falla abierta
        API->>DB: INSERT orden_material (id_falla = 42, estado = SOLICITADA, solicitante_usuario = P00)
        API->>DB: observacion = "[Falla 42] <descripcion>"
        DB-->>API: orden creada
        API-->>FICHA: 201 con estado SOLICITADA
        FICHA->>FICHA: refresca el bloque de ordenes
        FICHA-->>COO: muestra la orden nueva con su estado
    end

    COO->>FICHA: Pulsa Guardar dos veces rapido
    Note over FICHA,API: el endpoint NO es idempotente:<br/>la APK deshabilita el boton mientras hay peticion en vuelo

    COO->>API: Intentos de escritura NO concedidos
    API->>GUARD: POST /fallas-masivas (declarar)
    GUARD-->>API: 403
    API->>GUARD: POST /fallas-masivas/detectar
    GUARD-->>API: 403
    API->>GUARD: POST /fallas-masivas/42/planificacion
    GUARD-->>API: 403
    API->>GUARD: POST /notificaciones/procesar
    GUARD-->>API: 403
    API-->>COO: las cuatro responden 403 y no modifican nada (DEC-G13, H-05)

    COO->>FICHA: Consulta posterior
    FICHA->>API: GET /fallas-masivas/42/ordenes
    API->>DB: SELECT ordenes por id_falla y las historicas "[Falla 42]"
    DB-->>FICHA: ordenes con su estado y solicitante
```

---

## 8. Secuencia — Aislamiento por central: el usuario de la central A fuerza `id_central` de la central B (CU-D95-22)

Hoy la RLS es **inerte** (con el parámetro `NULL` la política permite todo) y `resolver_central`
acepta el `id_central` del cliente sin compararlo: el diagrama muestra el comportamiento
**a implementar** en D-95 (H-01), con el `403` y las **0 filas** de la otra central como
criterio de cierre.

```mermaid
sequenceDiagram
    autonumber
    actor SUP as Supervisor de la central A
    participant UI as Pantalla CASOS (APK o WEB)
    participant API as Endpoint de gestión
    participant SES as Sesión de BD (SET LOCAL)
    participant RLS as Políticas RLS
    participant DB as PostgreSQL
    participant OTRA as Datos de la central B

    SUP->>UI: Abre CASOS
    UI->>API: GET /api/v1/casos?id_central=<central B>
    API->>SES: SET LOCAL app.id_central = '<usuario.id_central de A>'
    Note over SES,RLS: D-95: el parámetro se fija en CADA petición autenticada (hoy no se fija nunca)
    API->>API: compara el id_central pedido con usuario.id_central
    alt el id_central pedido es distinto y el rol NO es SUPER
        API->>DB: consulta acotada a la central A
        DB->>RLS: evalúa app_central_actual()
        Note over RLS: D-95 retira la cláusula "IS NULL OR" de la política:<br/>denegar por defecto (hoy permite todo)
        RLS-->>DB: 0 filas de la central B
        API-->>UI: 403 "Su usuario no tiene central asignada o la central no coincide"
        UI-->>SUP: no muestra ningún caso de la central B
        Note over API,OTRA: El intento se registra para la observabilidad de las acciones de gestión (H-26)
    else el usuario no tiene id_central
        API-->>UI: 403 "Su usuario no tiene central asignada" sin devolver datos
    else el rol es SUPER
        Note over API,DB: Acceso multi-central explícito y con traza en auditoria (bypass de deps.py)
        API->>DB: consulta la central pedida
        API-->>UI: 200 con los datos de la central B
    else peticion válida dentro de la central A
        API->>DB: consulta acotada a usuario.id_central
        DB-->>API: solo casos de la central A
        API-->>UI: 200 con las filas de A (no el total de las dos centrales)
    end

    SUP->>API: Alta de caso especial o reporte de campo
    API->>API: _crear_caso_asociado y reportar_falla_campo usan usuario.id_central
    Note over API,DB: D-95 corrige resolver_central(db, None, config):<br/>hoy caen en la central de ingesta.central_codigo, no en la del usuario
    API-->>SUP: 201 con el caso creado en la central A

    Note over API,OTRA: Batería negativa A a B por endpoint: criterio de cierre de D-95 con DOS centrales
```

> **Defecto colateral que el mismo ciclo corrige:** el imprimible del despacho lleva el rótulo
> fijo «FRANCISCO SALIAS» en vez de la central real del despacho (CU-D95-22/A5). Está **fuera
> del alcance de la APK**, pero se cierra en D-95.

---

## 9. Estados de una falla masiva

Estados reales del modelo (`FallaMasiva.estado`, `app/models/despacho_entities.py:125`) y del
esquema de `PATCH` (`app/schemas/alertas.py:86`): `DETECTADA`, `PLANIFICADA`, `ATENDIDA` y
`CERRADA`. El Coordinador **no puede** recorrer ninguna transición: solo leer y pedir material
(DEC-G13).

```mermaid
stateDiagram-v2
    [*] --> DETECTADA : deteccion automatica (origen AUTOMATICA)
    [*] --> DETECTADA : reporte de campo del TECNICO (origen REPORTE_TECNICO, hasta 2 fotos)
    DETECTADA --> PLANIFICADA : PATCH /fallas-masivas/{id} (SUPERVISOR o ADMIN)
    PLANIFICADA --> ATENDIDA : atencion en campo
    ATENDIDA --> CERRADA : PATCH /fallas-masivas/{id} estado CERRADA
    PLANIFICADA --> CERRADA : cierre directo con la falla ya resuelta
    DETECTADA --> CERRADA : cierre sin planificacion previa
    CERRADA --> [*]

    state ACTIVAS <<choice>>
    DETECTADA --> ACTIVAS
    PLANIFICADA --> ACTIVAS
    note right of ACTIVAS
        El listado de ALERTAS pide solo_activas=true:
        devuelve las fallas en DETECTADA o PLANIFICADA.
        ATENDIDA y CERRADA quedan fuera de la bandeja activa.
    end note

    note right of DETECTADA
        El COORDINADOR no puede declarar, detectar, planificar,
        cerrar ni cambiar el estado: la API responde 403
        (DEC-G8, DEC-G13, H-05).
    end note

    note left of PLANIFICADA
        Unica escritura del COORDINADOR sobre una falla:
        POST /fallas-masivas/{id}/material -> orden_material
        en estado SOLICITADA (no cambia el estado de la falla).
    end note
```

---

## 10. Estados de la cuenta de gestión

`usuario` no tiene columna `estado`: la cuenta se gobierna con `bloqueado` e
`intentos_fallidos` (`app/models/entities.py:82-83`) y con la recuperación de 3 de las 12
palabras. El alta la realiza el `SUPER` **sin fila en `tecnico`** (DEC-G16).

```mermaid
stateDiagram-v2
    [*] --> ALTA_GESTION : el SUPER crea la cuenta (p00, correo, id_rol, id_central, id_tecnico NULL)
    ALTA_GESTION --> ACTIVA : cuenta utilizable (intentos_fallidos = 0, bloqueado = false)
    ACTIVA --> ACTIVA : login correcto (reinicia intentos_fallidos y bloqueado)
    ACTIVA --> INTENTOS_FALLIDOS : 1.er o 2.o fallo (401 + X-Intentos-Restantes)
    INTENTOS_FALLIDOS --> ACTIVA : clave correcta
    INTENTOS_FALLIDOS --> INTENTOS_FALLIDOS : nuevo fallo, quedan intentos
    INTENTOS_FALLIDOS --> BLOQUEADA : 3.er fallo consecutivo (423, bloqueado = true)
    ACTIVA --> BLOQUEADA : la cuenta ya llegaba bloqueada
    BLOQUEADA --> ACTIVA : POST /auth/unlock con 3 de las 12 palabras correctas (200 bloqueado = false)
    BLOQUEADA --> ACTIVA : POST /auth/reset-password y despues login con la clave nueva
    BLOQUEADA --> BLOQUEADA : palabras incorrectas (401, sigue bloqueada y no emite token)
    ACTIVA --> [*] : cierre de sesion

    note right of BLOQUEADA
        La cuenta no se borra ni se desactiva: se bloquea.
        RNF-APK-04 (segundo factor) NO se exige:
        DEC-G14, riesgo aceptado RA-01.
    end note

    note left of ALTA_GESTION
        id_tecnico NULL y sin fila en tecnico (DEC-G16):
        el Coordinador no aparece en cuadrillas, flota ni despacho.
    end note
```

---

## 11. Superficie de migración de D-95 (8 objetos)

Los **8 objetos** de la tabla §9.3 del incremento, con su estado vigente y **qué cambia** en
cada uno. La migración es idempotente (`scripts/migrar_dXX_*.py`, simulación por defecto,
`--aplicar --si`, log en `RepoTecnico/BaseOperaciones/` y reflejo en `db/schema.sql`).

```mermaid
flowchart TB
    subgraph VIG["Estado vigente verificado linea a linea"]
        O1V["1 - Catalogo rol<br/>4 filas: SUPER, ADMIN, SUPERVISOR, TECNICO<br/>(schema.sql:872-876)"]
        O2V["2 - ROL_ASIGNABLE<br/>Literal TECNICO, SUPERVISOR, ADMIN<br/>(schemas/config.py:132)"]
        O3V["3 - mensaje.destino_tipo<br/>CHECK EN LINEA con nombre autogenerado<br/>(schema.sql:978)"]
        O4V["4 - ck_mensaje_destino_xor<br/>3 ramas: TODOS, CUADRILLA, TECNICO<br/>sin rama para destino sin cuadrilla ni tecnico"]
        O5V["5 - mensaje_destino<br/>PK compuesta (id_mensaje, id_tecnico)<br/>con FK a tecnico: fan-out por TECHNICO"]
        O6V["6 - usuario<br/>id_tecnico nullable y p00 sin FK a tecnico<br/>(entities.py:76,80)"]
        O7V["7 - cuadrilla_sector_dia<br/>guardar_asignacion y asignacion_guardada<br/>SIN filtro id_central"]
        O8V["8 - caso y despacho (RLS)<br/>politicas con app_central_actual() IS NULL<br/>que permiten TODO (schema.sql:783-805)"]
    end

    subgraph MIG["Cambio de D-95"]
        O1N["INSERT de COORDINADOR<br/>idempotente: ON CONFLICT DO NOTHING<br/>+ semilla en schema.sql"]
        O2N["Añadir COORDINADOR a ROL_ASIGNABLE<br/>y a la matriz RBAC de requerimientos.md seccion 5.2"]
        O3N["DROP + ADD CONSTRAINT y añadir SUPERVISOR<br/>Tabla VIVA con PII: ensayo previo y ventana (H-15)"]
        O4N["Nueva rama destino_tipo = SUPERVISOR<br/>con su columna de destinatario (H-03)"]
        O5N["Añadir destinatario de gestion (p00 o id_usuario)<br/>y marca de lectura: fan-out polimorfico"]
        O6N["SIN cambio de esquema.<br/>Falta el FLUJO de alta y descolgar la asignacion de rol de /tecnicos/{id}"]
        O7N["Corregir SELECT y DELETE por central para no borrar<br/>la asignacion de las demas centrales (H-13)"]
        O8N["SET LOCAL app.id_central por peticion<br/>y retirar la clausula IS NULL: denegar por defecto (H-01)"]
    end

    O1V -->|migra| O1N
    O2V -->|migra| O2N
    O3V -->|migra| O3N
    O4V -->|migra| O4N
    O5V -->|migra| O5N
    O6V -->|migra| O6N
    O7V -->|migra| O7N
    O8V -->|migra| O8N

    O3N -.->|"requiere ventana y respaldo (RNF-42)"| VEN["Ensayo previo sobre copia<br/>y rollback probado"]
    O5N -.->|"0 mensajes historicos invalidos"| VER["Verificacion de la migracion"]
    O8N -.->|"bateria negativa A a B con DOS centrales"| VER
    O1N -.->|"1 fila COORDINADOR y 0 en cuadrillas, flota y despacho"| VER
    O6N -.->|"la cuenta queda con id_tecnico NULL"| VER
    O7N -.->|"prueba de dos centrales el mismo dia"| VER
```

> **Orden de la migración.** `rol` y `ROL_ASIGNABLE` van primero (sin ellos el Coordinador no
> existe); después la mensajería (3, 4 y 5, que dependen entre sí); `usuario` no cambia de
> esquema, solo de flujo; y el aislamiento por central (7 y 8) se activa **al final**, porque
> a partir de ese momento toda lectura sin `app.id_central` deja de devolver datos.

---

## 12. Arquitectura de la APK multi-rol

Una sola APK (DEC-G2) con **dos arquitecturas de datos conviviendo**: el flujo del **TÉCNICO**
(offline, CARGA/DESCARGA manual, intacto por D-84) y el flujo de **GESTIÓN** (online con caché
de lectura y refresco de 5 min). El temporizador de gestión **nunca** entra en el flujo del
TÉCNICO (riesgo R1).

```mermaid
flowchart TB
    ACCESO["ACCESO<br/>POST /api/v1/auth/login: P00 + clave, un solo paso"]

    subgraph ROL["Navegacion por rol - un solo binario (DEC-G2)"]
        MENU_SUP["Menu SUPERVISOR y ADMIN - 8 secciones<br/>MONITOREO, ESPECIALES, DESPACHO, CASOS,<br/>GESTION, ALERTAS, MENSAJES, USUARIO"]
        MENU_COO["Menu COORDINADOR - 6 secciones<br/>MONITOREO, ESPECIALES (crear), FALLAS MASIVAS,<br/>ALERTAS, MENSAJES, USUARIO"]
        MENU_TEC["Menu TECNICO - campo<br/>CASOS, ALERTAS, MENSAJES, USUARIO"]
        MENU_SUPER["Menu SUPER USUARIO<br/>acceso total + SISTEMAS y auditoria en solo lectura"]
        GUARD["Guard de ruta: lista blanca por rol<br/>la seccion prohibida no se renderiza (H-08)"]
    end

    ACCESO --> GUARD
    GUARD --> MENU_SUP
    GUARD --> MENU_COO
    GUARD --> MENU_TEC
    GUARD --> MENU_SUPER

    subgraph GEST["Flujo GESTION - SUP, ADM, COO y SUPER"]
        MOD_MON["Modulo MONITOREO<br/>5 vistas: Diaria, Semanal, Mensual, Especiales, Construcciones"]
        MOD_ESP["Modulo ESPECIALES<br/>listar, filtrar, ficha y crear (COO: solo alta)"]
        MOD_DES["Modulo DESPACHO y GESTION<br/>CU-D95-09 a CU-D95-11 (el COO no los ve)"]
        MOD_CAS["Modulo CASOS<br/>alta manual CU-D95-23 y edicion ligera CU-D95-24"]
        MOD_ALE["Modulo ALERTAS y FALLAS MASIVAS<br/>leer todo; el COO escribe solo la orden de material"]
        MOD_MEN["Modulo MENSAJES<br/>bandeja del Supervisor y redaccion del Coordinador"]
        ONLINE["Escrituras ONLINE obligatorias<br/>asignar, quitar, crear, enviar, material, nuevo, editar"]
    end

    MENU_SUP --> GEST
    MENU_COO --> GEST
    MENU_SUPER --> GEST
    GEST --> ONLINE

    subgraph CACHE["Cache de lectura local - sin cifrar (RA-02, DEC-G19)"]
        CACHE_DB["Almacen local de lectura<br/>guarda telefono, nombre y direccion EN CLARO"]
        CACHE_PART["Particion por usuario y purga al cerrar sesion (H-14)"]
        MASK["Enmascaramiento visual por rol, solo en presentacion<br/>COO: telefono 70*******, iniciales y direccion sin numero de casa<br/>SUP y ADM: valores completos"]
        BANDA["Banda de estado<br/>Sin conexion - ultimo dato hh:mm dd/mm o dato antiguo (mas de 24 h)"]
    end

    GEST -->|lectura| CACHE
    MENU_COO -->|lectura sin red| MASK
    MASK --> BANDA
    CACHE --> CACHE_DB
    CACHE --> CACHE_PART

    subgraph REFRESCO["Refresco de gestion - CU-D95-05 (RNF-APK-01 y 06)"]
        TIMER["Un solo temporizador de 5 min +-30 s"]
        VISIBLE["Refresca UNICAMENTE la pantalla visible<br/>reejecuta la consulta de esa pantalla"]
        PRESUP["Presupuesto: 1 peticion en vuelo como maximo<br/>tope de peticiones por token (12 peticiones/hora configurables)"]
        MANUAL["Botón Actualizar: relanza y reinicia el contador"]
        FRESCO["Indicador actualizado hh:mm"]
        FALLO["Politica ante fallo<br/>sin conexion y backoff al 3.er fallo consecutivo; 401 vuelve a ACCESO"]
    end

    GEST --> TIMER
    TIMER --> VISIBLE
    VISIBLE --> PRESUP
    PRESUP --> FRESCO
    MANUAL --> TIMER
    VISIBLE --> FALLO
    FALLO -->|exito| FRESCO
    GEST -->|actualiza| CACHE_DB

    subgraph TECFLOW["Flujo TECNICO - offline, INTACTO por D-84 (RNF-APK-03)"]
        SQLITE["SQLite local (caso_local)<br/>casos de su cuadrilla"]
        DESC["DESCARGA explicita<br/>GET /api/v1/sync/descarga y marca de agua ultima_descarga_ts"]
        TRABAJO["Trabajo offline<br/>contactar, atender, cerrar, diferir, evidencias"]
        CARGA["CARGA explicita<br/>POST /api/v1/sync/carga con la cola local"]
        COLA["Cola con reintento y backoff<br/>no se pierde ninguna actividad"]
        SINCRONO["Sondeo de mensajes cada 60 s (vigente)"]
        CAMPORE["Reporte de campo de falla masiva<br/>POST /fallas-masivas/reporte-campo"]
    end

    MENU_TEC --> SQLITE
    DESC --> SQLITE
    SQLITE --> TRABAJO
    TRABAJO --> CARGA
    CARGA --> COLA
    COLA -->|red disponible| SQLITE
    SQLITE -.->|"NO hay descarga automatica ni temporizador de 5 min"| TXT_NOAUTO["El TECNICO no instala el temporizador de gestion<br/>y no existe sondeo de descarga"]
    SQLITE --> SINCRONO
    SQLITE --> CAMPORE
```

> **Lo que el diagrama afirma con letra pequeña.** (1) El TÉCNICO **no** comparte el
> temporizador: su bloque `TECFLOW` está aislado del bloque `REFRESCO`. (2) La caché local
> guarda PII **en claro** y el enmascaramiento es de presentación: el diagrama no dibuja ningún
> cifrado, TTL, `FLAG_SECURE` ni PIN (RA-02, DEC-G19). (3) Toda escritura de gestión exige red
> y **no se encola**, a diferencia de la cola del TÉCNICO (CU-D95-06/A2 frente a CU-D95-18/A4).

---

## 13. Trazabilidad de los diagramas

| Figura | Casos de uso | Requisitos | Decisiones / hallazgos |
|---|---|---|---|
| §1 Casos de uso | CU-D95-01…24 | RF-APK-13…30, RNF-APK-01…06, RT-APK-01…05 | DEC-G1…G19 |
| §2 Ingreso sin segundo factor | CU-D95-01, CU-D95-02 | RNF-APK-04, RT-APK-01 | DEC-G14 (**RA-01**), H-02 |
| §3 Navegación por rol | CU-D95-03, CU-D95-18 | RF-APK-27, RNF-APK-03, RNF-APK-05 | DEC-G2, G3, G7, G16; H-08 |
| §4 Refresco con presupuesto | CU-D95-05 | RNF-APK-01, RNF-APK-06, RF-APK-28 | DEC-G4, G5, G18; H-11 |
| §5 Armar y publicar el despacho | CU-D95-09 | RF-APK-15, RNF-APK-02 | DEC-G3, G4; R2, H-12, H-13 |
| §6 Mensaje al Supervisor con escalado | CU-D95-13, CU-D95-20 | RF-APK-22, RF-APK-24, RT-APK-03, RNF-APK-02 | DEC-G9, G15; H-03, H-10 |
| §7 Orden de material | CU-D95-15, CU-D95-16 | RF-APK-20, RF-APK-21, RT-APK-05 | DEC-G8, G13, G11; **H-05** |
| §8 Aislamiento por central | CU-D95-22 (y CU-D95-01, 04, 07, 08, 10, 11, 13, 14, 15, 17, 19, 23, 24) | **RT-APK-02**, RNF-21, RNF-APK-06 | DEC-G6 (corregida), G18; **H-01** |
| §9 Estados de la falla masiva | CU-D95-14, CU-D95-15, CU-D95-16 | RF-APK-20, RF-APK-21, RF-APK-25 | DEC-G8, G11, G13 |
| §10 Estados de la cuenta de gestión | CU-D95-01, CU-D95-02, CU-D95-19 | RNF-APK-04, RT-APK-01 | DEC-G14, G16, G17 |
| §11 Superficie de migración | CU-D95-19, CU-D95-20, CU-D95-22 | RT-APK-01, RT-APK-02, RT-APK-03, RT-APK-05 | §9.3 del incremento; H-01, H-03, H-13, H-15 |
| §12 Arquitectura de la APK multi-rol | CU-D95-03, CU-D95-04, CU-D95-05, CU-D95-06, CU-D95-18 | RF-APK-27, RNF-APK-01, RNF-APK-02, RNF-APK-03, RNF-APK-06 | DEC-G2, G4, G5, G19 (**RA-02**); H-14, R1 |

---

## 14. Historial de versiones

| Versión | Fecha | Cambio |
|---|---|---|
| **v0.1** | 2026-10-10 | Emisión inicial: **12 diagramas Mermaid** coherentes con los casos de uso v0.2 (24 CU) y el incremento v0.3.2 — casos de uso UML, **7 secuencias** (ingreso sin segundo factor, navegación por rol, refresco con presupuesto, despacho con dos supervisores, mensaje con escalado al ADMIN, orden de material, aislamiento por central), **2 diagramas de estados** (falla masiva y cuenta de gestión), **superficie de migración** de los 8 objetos de §9.3 y **arquitectura de la APK multi-rol**. Los 12 bloques se validaron con el analizador de Mermaid: parseo y render correctos. Sin modificar ningún otro archivo. |
