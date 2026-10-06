# Diagramas — Incremento D-81 (Mermaid)

> Coherentes con [`casos_uso_D81.md`](casos_uso_D81.md) y [`documento_tecnico_D81.md`](../documento_tecnico_D81.md):
> mismos actores y mismos nombres de caso de uso.

---

## 1. Diagrama de casos de uso (actores ↔ casos)

```mermaid
graph LR
    subgraph Actores
        SUP["👤 Supervisor†<br/>(SUPER/ADMIN/SUPERVISOR)"]
        TEC["👤 Técnico (APK)"]
        SIS["⚙️ Sistema (jobs)"]
    end

    subgraph "Incremento D-81"
        CU01(("CU-D81-01<br/>Registrar sincronización"))
        CU02(("CU-D81-02<br/>Consultar log de sync"))
        CU03(("CU-D81-03<br/>Checklist de sync"))
        CU04(("CU-D81-04<br/>Enviar mensaje interno"))
        CU05(("CU-D81-05<br/>Recibir mensajes (20 s)"))
        CU06(("CU-D81-06<br/>Generar mensajes automáticos"))
        CU07(("CU-D81-07<br/>Purgar mensajes/log"))
        CU08(("CU-D81-08<br/>Auto-refresco panel (30 s)"))
        CU09(("CU-D81-09<br/>Gestión diaria<br/>Asignadas vs Cerradas"))
        CU10(("CU-D81-10<br/>Alta manual Caso Especial"))
        CU11(("CU-D81-11<br/>Bandeja de enviados"))
    end

    TEC --> CU01
    TEC --> CU03
    TEC --> CU05
    SIS --> CU01
    SIS --> CU06
    SIS --> CU07

    SUP --> CU02
    SUP --> CU04
    SUP --> CU08
    SUP --> CU09
    SUP --> CU10
    SUP --> CU11

    CU02 -.->|include ver checklist| CU03
    CU09 -.->|include| CU08
    CU05 -.->|include leer| CU04
    CU06 -.->|notifica| CU05
    CU11 -.->|consulta| CU04
```

---

## 2. Secuencia — Sincronización + checklist + log (CU-D81-01, CU-D81-03)

```mermaid
sequenceDiagram
    autonumber
    participant APK as APK Flutter
    participant API as Backend FastAPI
    participant DB as PostgreSQL

    APK->>API: GET /ready (paso a: conexión GCP)
    API-->>APK: 200 ready
    APK->>API: GET /auth/me (paso b: login)
    API-->>APK: 200 usuario + cuadrilla
    APK->>API: POST /sync/sesion {tipo: CARGA, dispositivo, version}
    API->>DB: INSERT sync_log (EN_PROCESO)
    API-->>APK: {id_sync_log}
    APK->>API: GET /sync/descarga (paso c)
    API-->>APK: casos + catalogos
    APK->>API: POST /sync/carga (paso d)
    API-->>APK: {aceptadas, rechazadas}
    APK->>API: PATCH /sync/sesion/{id} {contadores, estado, checklist}
    API->>DB: UPDATE sync_log (OK/PARCIAL) + INSERT sync_check
    API->>DB: INSERT mensaje ESTADO_SYNC (destino TECNICO)
    API-->>APK: 200 cierre
```

---

## 3. Secuencia — Mensajería: enviar + sondeo 20 s (CU-D81-04, CU-D81-05, CU-D81-06)

```mermaid
sequenceDiagram
    autonumber
    participant SUP as Supervisor (web)
    participant SIS as Scheduler
    participant API as Backend FastAPI
    participant DB as PostgreSQL
    participant TEC as APK/Web Técnico

    Note over SIS,API: Job recordatorios-citas (cada 15 min)
    SIS->>API: POST /mantenimiento/recordatorios-citas
    API->>DB: INSERT mensaje RECORDATORIO_CITA (idempotente)
    SIS->>API: POST /mantenimiento/alarmas-despacho
    API->>DB: INSERT mensaje ALARMA_DESPACHO

    SUP->>API: POST /mensajes {destino_tipo, cuerpo}
    API->>DB: INSERT mensaje (TEXTO, expira +5d)
    API->>DB: INSERT mensaje_destino (fan-out a técnicos)
    API-->>SUP: 201

    loop Cada 20 s (único componente con este periodo)
        TEC->>API: GET /mensajes?desde=<ultimo id>
        API->>DB: SELECT mensaje_destino del técnico (id_mensaje > desde, no vencidos)
        API-->>TEC: mensajes nuevos (o vacío)
    end

    TEC->>API: POST /mensajes/{id}/leido
    API->>DB: UPDATE mensaje_destino SET leido_en = now()
    API-->>TEC: 204
```

---

## 4. Secuencia — Panel con auto-refresco 30 s (CU-D81-08, CU-D81-09)

```mermaid
sequenceDiagram
    autonumber
    participant SUP as Supervisor (web)
    participant UI as Panel (React)
    participant API as Backend FastAPI
    participant DB as PostgreSQL

    SUP->>UI: Abre pantalla principal del panel
    UI->>API: GET /panel/gestion-diaria?fecha=hoy&modo=COMUN
    API->>DB: SELECT asignadas/cerradas por cuadrilla
    API-->>UI: filas por cuadrilla (asignadas, cerradas)

    loop Cada 30 s mientras la pestaña está visible
        UI->>API: GET /panel/gestion-diaria?...
        API-->>UI: datos actualizados (sin recargar página)
    end

    Note over UI: Si la pestaña pasa a segundo plano, el refresco se pausa

    SUP->>UI: Pulso "Agregar caso especial"
    UI->>API: POST /casos-especiales {...}
    API->>DB: INSERT caso_especial + caso (REF-...)
    API-->>UI: 201
```

---

## 5. Modelo Entidad-Relación del incremento

```mermaid
erDiagram
    sync_log ||--o{ sync_check : "4 pasos por sesión"
    mensaje ||--o{ mensaje_destino : "fan-out / leído por"
    usuario ||--o{ mensaje : "origen"
    cuadrilla ||--o{ mensaje : "destino (opcional)"
    tecnico ||--o{ mensaje_destino : "destinatario"
    caso ||--o{ mensaje : "referencia (opcional)"

    sync_log {
        bigint id_sync_log PK
        varchar p00
        integer id_cuadrilla FK
        integer id_central FK
        varchar tipo
        varchar estado
        varchar dispositivo_id
        varchar plataforma
        integer recibidos
        integer procesados
        integer errores
        integer duracion_ms
        timestamptz iniciado_en
        timestamptz finalizado_en
        jsonb detalle
    }
    sync_check {
        bigint id_sync_check PK
        bigint id_sync_log FK
        varchar paso
        varchar estado
        timestamptz fecha_hora
        jsonb detalle
    }
    mensaje {
        bigint id_mensaje PK
        integer id_central FK
        varchar origen_p00 FK
        varchar destino_tipo
        integer id_cuadrilla FK
        integer id_tecnico FK
        varchar tipo
        varchar cuerpo
        bigint id_caso FK
        timestamptz creado_en
        timestamptz expira_en
    }
    mensaje_destino {
        bigint id_mensaje PK
        integer id_tecnico PK
        timestamptz leido_en
    }
```
