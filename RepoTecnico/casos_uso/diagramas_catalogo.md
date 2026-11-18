# Diagramas del Catálogo de Casos de Uso — GGTO v2 (Mermaid)

> Generados el 2026-11-12 (`/graficos`) a partir de los casos de uso **auditados y corregidos**
> (`README.md`, `casos_uso_web.md`, `casos_uso_apk.md`, `casos_uso_asistente.md`).
> Coherencia garantizada: mismos actores, mismos IDs de CU y mismas reglas citadas.
> Los bloques Mermaid se renderizan en GitHub, GitLab, VS Code y cualquier visor Mermaid.

*(Nota: la APK crea **6 tablas** SQLite — `caso_local`, `accion_pendiente`, `evidencia_local`,
`app_meta`, `mensaje_local`, `masiva_local` — versión 5 de `ggto.db`.)*

---

## 1 · Panorama general — actores ↔ paquetes funcionales

```mermaid
flowchart LR
  subgraph ACTORES["Actores"]
    A01["ACT-01<br/>Supervisor"]
    A02["ACT-02<br/>Técnico de campo"]
    A04["ACT-04<br/>ADMIN / SUPER"]
    A05["ACT-05<br/>Sistema"]
    A06["ACT-06<br/>WEB-MCP (IA)"]
    A07["ACT-07<br/>Coordinador"]
  end

  subgraph WEB["Web (CU-W)"]
    G1["G1 Auth/sesión<br/>CU-W-01…07"]
    G2["G2 Ingesta<br/>CU-W-08…11"]
    G3["G3 Ciclo del caso<br/>CU-W-12…22"]
    G4["G4 Despachos<br/>CU-W-23…31"]
    G5["G5 Especiales/agenda<br/>CU-W-32…35"]
    G6["G6 Masivas/alertas<br/>CU-W-36…45"]
    G7["G7 Monitoreo/reportes<br/>CU-W-46…48"]
    G8["G8 Mensajería<br/>CU-W-49/50"]
    G9["G9 Configuración<br/>CU-W-51…55"]
    G10["G10 Auditoría/sistemas<br/>CU-W-56/57 (solo SUPER)"]
    G11["G11 Mantenimiento<br/>CU-W-58…60"]
  end

  subgraph APK["APK (CU-A)"]
    A1["A1 Acceso/seguridad<br/>CU-A-01…04"]
    A2["A2 Sincronización<br/>CU-A-05…08"]
    A3["A3 Trabajo de campo<br/>CU-A-09…18"]
    A4["A4 Alertas/comunicación<br/>CU-A-19/20"]
    A5["A5 Mantenimiento<br/>CU-A-21/22"]
    B1["B Modo GESTIÓN<br/>CU-A-23…28"]
  end

  subgraph AV["Asistente virtual (CU-AV)"]
    V1["asistente-ggto<br/>CU-AV-01…10"]
  end

  A01 --> WEB
  A02 --> A1 & A2 & A3 & A4
  A04 --> G10 & G11 & V1
  A07 --> G7 & B1
  A05 --> G11 & G6 & G13
  A06 --> G6
  A01 & A04 & A07 --> G8
```

---

## 2 · G1 — Autenticación y sesión (relaciones include/extend)

```mermaid
flowchart LR
  U(["Usuario (ACT-01/02/04/07)"])
  S(["ACT-04 SUPER"])

  W01["CU-W-01 Iniciar sesión"]
  W02["CU-W-02 Primer acceso / setup"]
  W03["CU-W-03 Desbloqueo con palabras"]
  W04["CU-W-04 Regenerar palabras"]
  W05["CU-W-05 Reset de contraseña"]
  W06["CU-W-06 Cambiar clave / perfil"]
  W07["CU-W-07 Mi seguridad"]

  U --> W01
  U --> W02
  U -. "«extend» bloqueado ×3" .-> W03
  W03 -. "«extend» cambiar clave" .-> W06
  U --> W06
  U --> W07
  S --> W04
  S --> W05

  note1["EARS: si la cuenta está bloqueada<br/>o inactiva → se niega el token"]
  note1 -.-> W01
```

---

## 3 · G2/G3 — Ingesta y ciclo del caso (núcleo)

```mermaid
flowchart LR
  SUP(["ACT-01 Supervisor"])
  TEC(["ACT-02 Técnico (_lectura)"])
  SYS(["ACT-05 Sistema"])

  W08["CU-W-08 Cargar CSV (preview)"]
  W09["CU-W-09 Lotes/cronología"]
  W10["CU-W-10 Sectorizar pendientes"]
  W12["CU-W-12 Alta manual / REF-"]
  W13["CU-W-13 Buscar casos"]
  W14["CU-W-14 Ficha + historial"]
  W15["CU-W-15 Editar ficha"]
  W16["CU-W-16 Cambiar estado"]
  W17["CU-W-17 Agendar cita"]
  W18["CU-W-18 NO CONTESTA (D-88)"]
  W19["CU-W-19 Comentario/actividad"]
  W20["CU-W-20 Cierre IVR/COS/SACAS"]
  W21["CU-W-21 Enrutado"]
  W22["CU-W-22 Reactivar"]

  SUP --> W08 --> W09
  SYS -. "deduplicación por id_averia (RF-22)" .-> W08
  SUP --> W10
  SUP --> W12 & W15 & W16 & W17 & W18 & W19 & W20 & W21 & W22
  TEC --> W13 --> W14
  W17 -. "«extend» cliente no contesta" .-> W18
  W20 -. "«extend» caso cerrado por error" .-> W22
  W15 -. "marcado_reclasificar D-89/90" .-> W15
```

---

## 4 · G4 — Despacho diario

```mermaid
flowchart LR
  SUP(["ACT-01 Supervisor"])
  COO(["ACT-07 Coordinador (lectura)"])
  SYS(["ACT-05 Corte 23:00 (D-160)"])

  W23["CU-W-23 Propuesta (D-22 cuadrilla 0)"]
  W24["CU-W-24 Procesar + asignación"]
  W25["CU-W-25 Gestionar casos (D-126)"]
  W26["CU-W-26 Enviar (RF-10)"]
  W27["CU-W-27 Consultar/imprimir"]
  W28["CU-W-28 Cierre de jornada"]
  W29["CU-W-29 Reporte producción 16:00"]
  W30["CU-W-30 Efectividad (D-146/147)"]
  W31["CU-W-31 Seguimiento construcciones"]
  W60["CU-W-60 Tareas nocturnas"]

  SUP --> W23 --> W24 --> W26
  SUP --> W25
  SUP & COO --> W27 & W30 & W31
  SUP --> W29
  SYS --> W60 -. "incluye" .-> W28
  W28 -. "PENDIENTE → DEVUELTO (D-157)" .-> SYS
```

---

## 5 · G5/G6 — Especiales y fallas masivas

```mermaid
flowchart LR
  SUP(["ACT-01 Supervisor"])
  COO(["ACT-07 Coordinador (alta especial + material)"])
  TEC(["ACT-02 Técnico (reporte campo)"])
  SYS(["ACT-05 Sistema / outbox"])

  W32["CU-W-32 Solicitantes (D-156)"]
  W33["CU-W-33 Caso especial (D-134)"]
  W34["CU-W-34 Agenda de citas"]
  W35["CU-W-35 Seguimiento (RF-34)"]
  W36["CU-W-36 Masiva manual (D-118)"]
  W37["CU-W-37 Detección (D-168, umbral 3)"]
  W38["CU-W-38 Reporte desde campo (D-82)"]
  W39["CU-W-39 Planificación (RF-17)"]
  W40["CU-W-40 Gestión de casos de la masiva"]
  W41["CU-W-41 Material (RF-18)"]
  W42["CU-W-42 Cierre en cascada (D-99)"]
  W44["CU-W-44 Notificaciones/outbox"]

  SUP --> W32 --> W33
  COO -. "alta (no reversión: solo SUPER)" .-> W33
  SUP --> W34 & W35
  SUP --> W36 & W39 & W40 & W42
  TEC --> W38
  SYS -. "detectar tras ingesta" .-> W37
  COO --> W41
  W33 -. "cierre → aviso outbox (D-156)" .-> SYS
  W42 -. "CRASS + evidencias obligatorios" .-> W42
```

---

## 6 · G7–G11 — Monitoreo, mensajería, configuración, auditoría y mantenimiento

```mermaid
flowchart LR
  SUP(["ACT-01 Supervisor"])
  COO(["ACT-07 Coordinador (5 vistas, DEC-G1)"])
  SUPER(["ACT-04 SUPER exclusivo"])
  SYS(["ACT-05 Sistema"])

  W46["CU-W-46 Panel gestión diaria"]
  W47["CU-W-47 12 vistas monitoreo"]
  W48["CU-W-48 Reporte trabajo"]
  W49["CU-W-49 Enviar mensajes"]
  W50["CU-W-50 Bandeja / leídos"]
  W51["CU-W-51 Central/sectores (D-27)"]
  W52["CU-W-52 Técnicos/roles/usuarios"]
  W53["CU-W-53 Flota"]
  W54["CU-W-54 Cuadrillas (D-123/130)"]
  W55["CU-W-55 Catálogos/config (RNF-10)"]
  W56["CU-W-56 Auditoría (solo SUPER)"]
  W57["CU-W-57 Sistemas (solo SUPER)"]
  W58["CU-W-58 Purga (D-132, token)"]

  SUP --> W46 & W48 & W49 & W51 & W52 & W53 & W54 & W55
  COO --> W47 & W49
  SUPER --> W56 & W57
  SYS --> W58
  SUP -. "bandeja" .-> W50
```

---

## 7 · APK del TÉCNICO (CU-A-01…22)

```mermaid
flowchart LR
  TEC(["ACT-02 Técnico"])
  SERV(["API GGTO"])

  A01["CU-A-01 Login + disclaimer (RF-44)"]
  A02["CU-A-02 PIN (D-100)"]
  A04["CU-A-04 Modo offline"]
  A05["CU-A-05 Descarga diferencial (D-105/127)"]
  A07["CU-A-07 Carga del outbox (backoff ×5)"]
  A09["CU-A-09 Bandeja/ficha (D-123/130)"]
  A10["CU-A-10 CONTACTADO (D-37)"]
  A11["CU-A-11 Cita (RF-12)"]
  A12["CU-A-12 NO CONTESTA (D-88)"]
  A14["CU-A-14 Evidencias solo cámara (máx 5 / 3 MB)"]
  A15["CU-A-15 Cierre IVR/COS/SACAS"]
  A19["CU-A-19 Reportar masiva (D-82)"]
  A20["CU-A-20 Mensajería (D-86)"]
  A21["CU-A-21 Actualización (D-102/108/115)"]

  TEC --> A01 -. "bloqueo inactividad 2 min (D-117)" .-> A02
  A01 --> A05
  SERV -. "ids_conocidos; merge pendiente manda (D-126); SyncLock (D-124)" .-> A05
  A05 --> A09 --> A10
  A10 --> A11
  A10 -. "no hay respuesta" .-> A12
  A10 --> A14
  A14 --> A15
  A04 -. "acciones encoladas" .-> A07
  A15 & A12 & A11 --> A07
  A19 & A20 & A21 --> TEC
```

---

## 8 · APK modo GESTIÓN — Coordinador (CU-A-23…28)

```mermaid
flowchart LR
  COO(["ACT-07 Coordinador"])
  SUP(["Supervisor (destino)"])

  A23["CU-A-23 Sesión modo gestión (RF-APK-27)"]
  A24["CU-A-24 Masivas lectura + material (RF-APK-20/21)"]
  A25["CU-A-25 Especiales (RF-APK-14/19)"]
  A26["CU-A-26 Mensajes solo al Supervisor (DEC-G9)"]
  A27["CU-A-27 Monitoreo (RF-APK-13/18, D-109)"]
  A28["CU-A-28 ZIP de jornada (RF-65/66)"]

  COO --> A23 --> A24 & A25 & A26 & A27 & A28
  A26 --> SUP
  A24 -. "única escritura del rol" .-> A24
```

---

## 9 · Asistente virtual (CU-AV-01…10, ciclos C1–C6)

```mermaid
flowchart LR
  O(["ACT-AV-O Operador (panel)"])
  T(["ACT-AV-T Remitente Telegram"])
  GW["Gateway OpenCode<br/>(claude-haiku-5-5)"]
  AV["asistente-ggto"]
  GG["API canónica GGTO"]
  DB[("asistente_sesion<br/>+ Mongo (uso/cuota)")]

  AV01["CU-AV-01 Texto → ficha (vista previa editable)"]
  AV02["CU-AV-02 CONFIRMAR → ALTA_CASO"]
  AV03["CU-AV-03 CONFIRMAR → EVENTO"]
  AV04["CU-AV-04 Consultas (CASO/FAT/RESUMEN_DIA)"]
  AV05["CU-AV-05 Historial de turno"]
  AV06["CU-AV-06 Telegram: vista previa"]
  AV07["CU-AV-07 Telegram: CONFIRMAR"]
  AV08["CU-AV-08 Sesiones (SUPERVISOR/ADMIN)"]
  AV09["CU-AV-09 Remitentes (solo SUPER)"]

  O --> AV01
  T --> AV06
  AV01 --> GW
  AV01 -. "R-AV-1: nada se aplica sin confirmar" .-> AV02 & AV03
  AV02 & AV03 --> GG
  AV04 --> GG
  AV06 -. "R-AV-3 fail-closed / R-AV-4 cuota" .-> AV07
  AV07 --> GG
  AV05 & AV08 --> DB
  AV09 -. "habilita chats" .-> AV06
```

---

## 10 · Secuencia — Ingesta y despacho del día (flujo núcleo web)

```mermaid
sequenceDiagram
  autonumber
  actor SUP as ACT-01 Supervisor
  participant API as API GGTO
  participant BD as PostgreSQL
  participant TEL as Telegram/Correo

  SUP->>API: CU-W-08 POST /ingesta/preview (CSV diario)
  API->>BD: deduplicación por id_averia (RF-22, D-164)
  API-->>SUP: preview: 3 nuevos / 2 duplicados
  SUP->>API: confirmar lote
  API->>BD: insertar casos nuevos + lote (RF-29)
  SUP->>API: CU-W-23 POST /despachos/propuesta
  API->>BD: agrupar por sector + cuadrilla 0 (D-22)
  API-->>SUP: propuesta
  SUP->>API: CU-W-24 POST /procesar + ajustes (PUT asignación)
  SUP->>API: CU-W-26 POST /enviar
  API->>TEL: ficha de cuadrilla + sectores (RF-10)
  Note over API,TEL: disponible para descarga diferencial en APK (CU-A-05)
  SUP->>API: CU-W-29 GET /reportes/produccion (16:00)
  SYS->>API: CU-W-60 corte nocturno 23:00 (D-160)
  API->>BD: PENDIENTE → DEVUELTO (D-157)
```

---

## 11 · Secuencia — Ciclo de campo del TÉCNICO (APK)

```mermaid
sequenceDiagram
  autonumber
  actor TEC as ACT-02 Técnico
  participant APP as APK ggto_tecnico
  participant API as API GGTO
  participant OB as Outbox (SQLite)

  TEC->>APP: CU-A-01 login + disclaimer (RF-44) + PIN (D-100)
  APP->>API: CU-A-05 POST /sync/descarga (ids_conocidos, D-127)
  API-->>APP: solo nuevos/cambios (merge «pendiente manda», D-126)
  TEC->>APP: CU-A-10 CONTACTADO (≤3 toques / ≤20 s, D-37)
  APP->>OB: acción PENDIENTE
  TEC->>APP: CU-A-11 cita 10:00 mañana
  TEC->>APP: CU-A-12 NO CONTESTA (encola, D-88)
  TEC->>APP: CU-A-14 evidencias (solo cámara, máx 5, 3 MB)
  TEC->>APP: CU-A-15 cierre IVR + 2 evidencias (RN-EV-01)
  APP->>OB: cierre + evidencias PENDIENTE
  Note over APP,API: sin red: todo opera local (RNF-06, D-135)
  APP->>API: CU-A-07 carga del outbox (backoff 1,2,4…60 · 403/409/404/422 = definitivos)
  API->>API: validación canónica (D-88/D-120 · 409 si terminal)
  API-->>APP: OK → acciones ENVIADAS
```

---

## 12 · Secuencia — Falla masiva (detección → cierre en cascada)

```mermaid
sequenceDiagram
  autonumber
  actor SUP as ACT-01 Supervisor
  actor TEC as ACT-02 Técnico
  participant API as API GGTO

  SYS->>API: CU-W-37 detección tras ingesta (D-168: 5 campos, umbral 3)
  API-->>SUP: masiva candidata
  TEC->>API: CU-W-38 reporte desde campo (D-82: ODN/FAT + máx 2 fotos)
  SUP->>API: CU-W-36 confirmar masiva (D-118: OLT+slot+puerto+FAT+dirección+≥1 caso)
  SUP->>API: CU-W-39 planificación + evidencias (RF-17)
  SUP->>API: CU-W-41 material (RF-18)
  SUP->>API: CU-W-42 cierre (CRASS + evidencias, D-99)
  API->>API: cierre en cascada de los casos vinculados
  API-->>SUP: masiva CERRADA + reporte
```

---

## 13 · Secuencia — Caso especial (D-134 / D-133 / D-156)

```mermaid
sequenceDiagram
  autonumber
  actor COO as ACT-07 Coordinador
  actor SUP as ACT-01 Supervisor
  participant API as API GGTO
  participant OB as Outbox

  COO->>API: CU-W-33 alta caso especial (solicitante D-156)
  API-->>COO: caso especial creado (máquina de estados D-134)
  SUP->>API: atender / avanzar estado (D-134)
  SUP->>API: intentar cierre
  API-->>SUP: 422 si requiere_informe y informe < 20 chars (D-133)
  SUP->>API: cierre con informe ≥ 20 chars
  API->>OB: aviso al solicitante (D-156)
  Note over OB: si el canal es manual, queda pendiente de entrega por el Supervisor
  COO--xAPI: reversión → 403 (exclusiva de SUPER)
```

---

## 14 · Secuencia — Asistente virtual (texto libre → confirmación canónica)

```mermaid
sequenceDiagram
  autonumber
  actor ACT as ACT-AV-O / ACT-AV-T
  participant AV as asistente-ggto
  participant GW as Gateway (claude-haiku-5-5)
  participant API as API canónica GGTO
  participant DB as asistente_sesion / Mongo

  ACT->>AV: texto libre («alta cliente 70123456…»)
  AV->>DB: registrar intercambio (R-AV-5) + uso/cuota
  AV->>GW: petición de ficha
  GW-->>AV: ficha estructurada (intención + campos)
  AV-->>ACT: VISTA PREVIA editable (C6) — 0 escrituras (R-AV-1)
  ACT->>AV: corregir campos + CONFIRMAR (panel o chat)
  alt ALTA_CASO
    AV->>API: POST /api/v1/casos (RN-AL-01)
    API-->>AV: 201 + id_caso/estado
  else EVENTO
    AV->>API: PATCH / cita / estado (camino único, D-120 · 409 si terminal)
    API-->>AV: evento aplicado
  else CONSULTA
    AV->>API: lectura (CASO/FAT/RESUMEN_DIA, sin PII en listados)
    API-->>ACT: respuesta inmediata (sin confirmación)
  end
  Note over AV: Gateway ausente → 503 fail-closed (R-AV-2)<br/>422/404/409 canónicos si el dato corregido es inválido (R-AV-6)
```

---

## 15 · Secuencia — Acceso endurecido (web y APK)

```mermaid
sequenceDiagram
  autonumber
  actor U as Usuario (ACT-01/02/04/07)
  participant API as API auth

  U->>API: POST /login (P00 + clave)
  alt clave correcta
    API-->>U: JWT (RLS por central, D-95) + sesión
    Note over U: APK: disclaimer RF-44 en cada login + PIN D-100 + bloqueo 2 min D-117
  else clave errónea (1.º o 2.º intento)
    API-->>U: rechazo con intentos restantes
  else 3.er intento fallido
    API->>API: bloquear cuenta
    API-->>U: «acuda a desbloqueo»
    U->>API: POST /unlock (3 de 12 palabras)
    API-->>U: cuenta desbloqueada + cambio de clave obligatorio
  end
```

---

### Notas de coherencia

- Cada diagrama usa **exactamente los IDs del catálogo auditado**; si un CU cambia de nombre
  o de regla, el diagrama debe actualizarse en el mismo cambio.
- Las reglas citadas (D-88, D-99, D-118, D-120, D-126, D-132, D-157/D-160, D-168, RN-EV-01…)
  corresponden a las versiones corregidas de la auditoría del 2026-11-12.
- Si se pide **SVG**, rasterizar estos bloques con `mmdc` (mermaid-cli) o el visor de VS Code;
  el contenido es el fuente de verdad.
