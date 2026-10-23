# Diagramas — GGTO V2 · Casos de uso de la WEB

| Campo | Valor |
|---|---|
| Documento | Código **Mermaid** renderizable (GitHub/VS Code) usando los 62 CU de [`casos_uso_web.md`](casos_uso_web.md) |
| Formato | Bloques `mermaid` listos para pegar en visor o exportar a SVG |
| Fuente | Código vigente al 2026-10-23 (commit `4449f36`, despliegue v84, incluido D-157) |
| Estado | **v0.1** — previo a la auditoría `/auditar`, que puede ajustar nombres y flujos |

---

## 1. Diagrama de casos de uso UML (visión general WEB)

```mermaid
---
title: GGTO WEB — actores y casos de uso (CU-W-01…62)
---
flowchart LR
    SUP(["SUPervisor<br/>· ADM · SUPER"])
    COO(["COOrdinador"])
    TEC(["Técnico de campo<br/>(lectura en web)"])

    subgraph SES["Sesión y cuenta (W-01…06)"]
        CU01["W01 Aviso legal"]
        CU02["W02 Login P00+clave"]
        CU03["W03 Desbloqueo 3 palabras"]
        CU04["W04 Primer acceso"]
        CU06["W06 Cerrar sesión"]
    end

    subgraph OPS["OPERACIÓN (W-11…18)"]
        CU11["W11 Ingesta CSV"]
        CU12["W12 Sectores/direcciones"]
        CU14["W14 Monitoreo"]
        CU16["W16 Detectar masivas"]
        CU17["W17 Masiva manual"]
        CU18["W18 Ficha Falla"]
    end

    subgraph CAS["CASOS/SEGUIMIENTO/ESPECIALES/AGENDA (W-19…30)"]
        CU19["W19 Listar/filtrar"]
        CU20["W20 Ficha/editar"]
        CU21["W21 Cambiar estado"]
        CU24["W24/W25 Seguimiento"]
        CU26["W26/W27/W28 Especiales"]
        CU29["W29/W30 Agenda/citas"]
    end

    subgraph DES["DESPACHO (W-31…38)"]
        CU31["W31 Propuesta"]
        CU33["W33 Procesar D-113"]
        CU34["W34 Publicar/enviar"]
        CU38["W38 Cierre jornada D-157"]
    end

    subgraph MAS["MASIVAS (W-39…47)"]
        CU39["W39 Detectar"]
        CU43["W43 Planificar"]
        CU44["W44 Materiales"]
        CU45["W45 Cierre CRASS D-99"]
    end

    subgraph CFG["CONFIGURACIÓN (W-48…56)"]
        CU50["W50 Técnicos/roles"]
        CU53["W53 Cuadrillas"]
        CU55["W55 Parámetros JSON"]
    end

    SUP --> CU01 & CU02 & CU11 & CU14 & CU19 & CU31 & CU39 & CU50
    COO --> CU02 & CU14 & CU26 & CU29 & CU44
    TEC --> CU02 & CU19 & CU20
    CU33 -.- CU43
    CU38 -.- CU31
    CU45 -.-> |"requiere validador<br/>activo misma central"| CU50
```

> Relaciones de dependencia (líneas punteadas): el despacho procesado (W-33) alimenta la
> planificación de masivas (W-43); el cierre de jornada (W-38) depende de un despacho
> publicado (W-34); el cierre de masiva (W-45) exige un validador CRASS del personal
> externo configurado (W-56) y de la misma central.

## 2. Secuencia — Ingesta diaria del CSV (CU-W-11/W-12)

```mermaid
sequenceDiagram
    actor SUP as Supervisor
    participant W as WEB
    participant API as /ingesta
    participant DB as PostgreSQL

    SUP->>W: Selecciona CSV del día
    W->>API: POST /ingesta/preview
    API-->>W: resumen (filas, centrales, duplicados)
    SUP->>W: "Cargar"
    W->>API: POST /ingesta/cargar
    API->>DB: filtro por datos operativos de la central (RF-21)
    API->>DB: descarte de duplicados por id_averia (RF-22)
    API->>DB: inserta casos nuevos + lote documentado (RF-29)
    API-->>W: resumen del lote (nuevos, descartados, total)
    SUP->>W: Gestionar direcciones sin sector (W-12)
    W->>API: patrón CONTIENE + re-sectorizar pendientes
    API->>DB: sector_id según patrón (RF-23)
    Note over API,DB: Detección automática de masivas post-ingesta (RF-09)
```

## 3. Secuencia — Ciclo del despacho diario (CU-W-31…38)

```mermaid
sequenceDiagram
    actor SUP as Supervisor
    participant W as WEB
    participant API as /despachos
    participant DB as PostgreSQL
    actor TEC as Cuadrilla (APK)

    SUP->>W: Generar propuesta (W-31)
    W->>API: POST /despachos
    API->>DB: aplica RF-25 → cuadrilla 0 (modo SUPERVISOR D-59)
    API->>DB: citados del día + ≥2 referidos + ≥1 empresa + 1 cuadrilla para construcción
    API-->>W: despacho BORRADOR

    SUP->>W: Ajustar asignaciones (W-32) y Procesar (W-33, D-113)
    SUP->>W: Publicar (W-34)
    W->>API: PATCH BORRADOR→PUBLICADO
    API-->>TEC: despacho disponible para descarga (sync)

    Note over TEC,API: Jornada de campo (APK: CU-A-08…A-19)

    SUP->>W: Cierre de jornada (W-38)
    W->>API: POST cierre-jornada
    API->>DB: renglones no atendidos → estado DEVUELTO (D-157)
    API-->>W: {asignaciones_devueltas: N}
    Note over DB: histórico conservado; APK y CASOS dejan de atribuir el caso (D-123 intacta)
```

## 4. Secuencia — Cierre de falla masiva con validador CRASS (CU-W-45 · D-99)

```mermaid
sequenceDiagram
    actor ADM as ADMIN/SUPERVISOR
    participant W as WEB FichaFalla
    participant API as /fallas-masivas/cierre
    participant DB as PostgreSQL

    ADM->>W: Pestaña Cerrar (descripción ≥10, modo IVR/COS/SACAS)
    W->>API: GET validadores CRASS (personal-externo)
    API-->>W: lista filtrada por tipo CRASS + central + activo (D-99)
    ADM->>W: Elige validador + texto por caso («Reparado en FDT»)
    ADM->>W: Confirmar cierre (irreversible)
    W->>API: POST cierre {validador, modo, texto}
    API->>DB: masiva → CERRADA
    API->>DB: casos asociados → cerrado en cascada con el texto
    API-->>ADM: resumen (cerrados / omitidos)
```

## 5. Estados — Despacho y asignaciones (`despacho.estado` / `despacho_caso.estado`)

```mermaid
stateDiagram-v2
    direction LR
    state "Despacho" as d {
        [*] --> BORRADOR: propuesta generada (W-31)
        BORRADOR --> PUBLICADO: W-34 Publicar
        PUBLICADO --> CERRADO: cierre de despacho
        PUBLICADO --> PUBLICADO: ajustes de casos (W-32)
    }
    state "Asignación (despacho_caso)" as a {
        [*] --> ASIGNADO
        ASIGNADO --> GESTIONADO: el técnico atiende
        ASIGNADO --> CERRADO: cierre/administrativo
        ASIGNADO --> CITADO: cita registrada
        ASIGNADO --> DIFERIDO: diferir
        ASIGNADO --> DEVUELTO: cierre de jornada (D-157)
        GESTIONADO --> CERRADO
    }
```

## 6. Estados — Falla masiva (w-39…45 / A-26…28)

```mermaid
stateDiagram-v2
    direction LR
    [*] --> ACTIVA: detección automática (W-39) o alta manual (W-17/W-40)
    ACTIVA --> PLANIFICADA: plan + cuadrilla (W-43)
    PLANIFICADA --> CERRADA: cierre con validador CRASS (W-45 / D-99)
    ACTIVA --> CERRADA: cierre directo (requiere planificación según flujo)
    CERRADA --> [*]: histórico + reporte + ubicación (W-46/W-47)
```
