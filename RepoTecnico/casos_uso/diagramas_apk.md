# Diagramas — GGTO V2 · Casos de uso de la APK

| Campo | Valor |
|---|---|
| Documento | Código **Mermaid** renderizable (GitHub/VS Code) usando los 36 CU de [`casos_uso_apk.md`](casos_uso_apk.md) |
| Formato | Bloques `mermaid` listos para pegar en visor o exportar a SVG |
| Fuente | Código vigente al 2026-10-23 (commit `4449f36`, despliegue v84, incluido D-157) |
| Estado | **v0.1** — previo a la auditoría `/auditar` |

---

## 1. Diagrama de casos de uso UML (APK por rol)

```mermaid
---
title: GGTO APK — actores y casos de uso (CU-A-01…36)
---
flowchart LR
    TEC(["TÉCNICO<br/>offline-first"])
    SUP(["SUPERVISOR/ADMIN<br/>(y SUPER)"])
    COO(["COORDINADOR"])

    subgraph SES["Sesión y seguridad (A-01…07)"]
        A01["A01 Aviso de uso"]
        A02["A02 Login (3 intentos)"]
        A03["A03 PIN sin conexión D-100"]
        A04["A04 Desbloqueo palabras"]
        A06["A06 Bloqueo inactividad"]
        A07["A07 Restablecer app"]
    end

    subgraph CAM["Campo técnico (A-08…17)"]
        A08["A08 Mis casos local"]
        A10["A10 Contactado"]
        A11["A11 No contesta→CITADO"]
        A12["A12 Agendar cita"]
        A14["A14 CERRAR"]
        A15["A15 ENRUTAR"]
        A16["A16 DIFERIR"]
        A17["A17 Fotos cámara+GPS"]
    end

    subgraph SYN["Sincronización y jornada (A-18…22)"]
        A18["A18 Cola + auto-envío 5 min"]
        A19["A19 SINCRONIZAR CARGA/DESCARGA D-157"]
        A20["A20 ZIP jornada D-156"]
        A21["A21 Reintentar/descartar"]
    end

    subgraph MAS2["Alertas y masivas (A-23…28)"]
        A23["A23 Reportar masiva RF-16"]
        A26["A26 Planificar masiva"]
        A27["A27 Solicitar material"]
        A28["A28 Cierre CRASS D-99"]
    end

    subgraph GES["Gestión (roles de gestión) (A-29…35)"]
        A29["A29 Cuadrilla 0"]
        A31["A31 Despacho"]
        A32["A32 Especiales crear"]
        A34["A34 Coordinador→material/mensaje"]
        A35["A35 Bandeja mensajes"]
    end

    TEC --> A01 & A02 & A03 & A08 & A10 & A12 & A14 & A17 & A19 & A20 & A23 & A35
    SUP --> A08 & A19 & A26 & A27 & A28 & A29 & A31 & A32
    COO --> A24 & A27 & A34
    A19 -. "purga no atendidos" .-> A08
    A23 -. "concentración" .-> A26
```

> Líneas punteadas: la purga del sincronizar (A-19, D-157) afecta el listado local de
> casos (A-08); el reporte de campo de una masiva (A-23) es el origen usual de la masiva
> que luego se planifica (A-26) y cierra (A-28).

## 2. Estados — Ciclo de vida del caso en la APK

```mermaid
stateDiagram-v2
    direction LR
    [*] --> ASIGNADO: descarga del despacho (sync)
    state "campo" as field {
        ASIGNADO --> CONTACTADO: A10 Contactado
        ASIGNADO --> CITADO: A11 No contesta (1.a visita) · A12 Agendar
        CONTACTADO --> CERRADO: A14 Cerrar (IVR/COS/SACAS)
        CONTACTADO --> ENRUTADO: A15 Enrutar
        CONTACTADO --> DIFERIDO: A16 Diferir
        CONTACTADO --> CITADO: A12 Agendar
    }
    CERRADO --> [*]
    ENRUTADO --> [*]
    DIFERIDO --> [*]
    CITADO --> CONTACTADO: nueva visita
    note right of CITADO
        Los casos gestionados quedan ocultos por defecto (D-105);
        el chip «resueltos» los vuelve a mostrar (A-09).
    end note
```

## 3. Secuencia — Acción de campo fuera de línea + sincronización (CU-A-10/14 → A-19)

```mermaid
sequenceDiagram
    actor TEC as Técnico
    participant APP as APK (SQLite)
    participant API as Backend /sync

    TEC->>APP: Caso CONTACTADO + cierre con fotos (sin cobertura)
    APP->>APP: valida campos y guarda estado local
    APP->>APP: encola acción + evidencias (payload exacto)
    Note over APP: banner «Sin conexión — trabaje normal» (A-18)

    APP-->>APP: auto-envío cada 5 min con red
    APP->>API: POST /sync/carga (CIERRE/ENRUTADO/DIFERIDO + evidencias)
    API-->>APP: OK /mente reintento

    TEC->>APP: SINCRONIZAR (A-19) — confirmar que los no atendidos salen del teléfono
    APP->>API: ① CARGA pendientes · ② outbox · ③ DESCARGA despacho del día
    APP->>APP: purga casos no atendidos anteriores (D-157: excluye DEVUELTO de descarga)
    APP-->>TEC: resumen + checklist (GCP · login · descarga · carga)
```

## 4. Secuencia — ZIP de la jornada (CU-A-20 · D-156)

```mermaid
sequenceDiagram
    actor TEC as Técnico
    participant APP as APK SyncScreen
    actor SUP as Supervisor

    TEC->>APP: «GENERAR Y COMPARTIR ZIP»
    APP->>APP: empaqueta despacho.csv + despacho.json + evidencias/ + LEEME.txt
    APP->>APP: nombre central+cuadrilla+fecha (despacho local con cambios del técnico)
    APP-->>SUP: share nativo (correo/mensajería)
    APP-->>TEC: resumen y ruta del ZIP
```

## 5. Secuencia — Falla masiva: del campo al cierre (A-23 → W-39/W-45 · D-99)

```mermaid
sequenceDiagram
    actor TEC as Técnico (campo)
    participant APP as APK Alertas
    participant API as Backend
    actor ADM as ADMIN/SUPERVISOR

    TEC->>APP: Reportar falla masiva (OLT/SLOT/PUERTO/ODN/FAT + 2 fotos GPS)
    APP->>API: registra falla (o cola si sin red)
    ADM->>API: Activar detección de concentración (W-39)
    API-->>ADM: masiva ACTIVA con casos candidatos
    ADM->>API: planificar (RF-17) + materiales (RF-18)
    ADM->>API: cierre con validador CRASS activo de la misma central (D-99)
    API-->>ADM: cierre en cascada de la masiva y sus casos (resumen)
    Note over APP,API: el técnico ve la masiva en su APK con datos de la última descarga (A-24/25)
```

## 6. Estados — Masiva desde la APK

```mermaid
stateDiagram-v2
    direction LR
    [*] --> ACTIVA: reporte de campo (A-23) o detección (web)
    ACTIVA --> PLANIFICADA: A-26 plan + cuadrilla (solo ADMIN/SUP)
    ACTIVA --> ACTIVA: solicitud de material (A-27, no cambia estado)
    PLANIFICADA --> CERRADA: A-28 cierre CRASS (cascada)
    CERRADA --> [*]
    note right of ACTIVA
        El COORDINADOR solo puede solicitar material;
        no planifica ni cierra (A-34).
    end note
```
