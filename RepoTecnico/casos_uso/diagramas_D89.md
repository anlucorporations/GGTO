# Diagramas — Incremento **D-89…D-94** · Identificador de pago (70\*)

| Campo | Valor |
|---|---|
| Documento | Diagramas Mermaid del incremento (casos de uso, secuencias y decisiones) |
| Estado | **v0.3 — coherente con los casos de uso v0.3 (auditoría y DEC-IP-5/6/7 incorporadas)** |
| Fecha | 2026-10-08 |
| Base | [`casos_uso_D89.md`](casos_uso_D89.md) · [`../incremento_D89_identificador_pago.md`](../incremento_D89_identificador_pago.md) · [`../documento_tecnico_D89.md`](../documento_tecnico_D89.md) |

> Los actores y los nombres de los casos de uso son **exactamente** los del
> documento de casos de uso (mismos códigos CU-D89-01…12).

---

## 1. Diagrama de casos de uso (UML)

```mermaid
flowchart TB
    subgraph Actores
        SUP["Supervisor"]
        ADM["Administrador / Super Usuario"]
        TEC["Técnico"]
        ING["Sistema de ingesta"]
        CLA["Sistema de clasificación"]
    end

    subgraph SistemaGGTO["GGTO — identificador de pago (70*)"]
        CU01["CU-D89-01<br/>Ingestar y clasificar los números"]
        CU02["CU-D89-02<br/>Resolver el identificador de pago"]
        CU03["CU-D89-03<br/>Consultar histórico del identificador"]
        CU04["CU-D89-04<br/>Buscar por identificador o contacto"]
        CU05["CU-D89-05<br/>Corregir contacto (web)"]
        CU06["CU-D89-06<br/>Corregir contacto (APK)"]
        CU07["CU-D89-07<br/>Alta de REPARACIÓN válida"]
        CU08["CU-D89-08<br/>Reclasificar a REFERIDO"]
        CU09["CU-D89-09<br/>Reclasificar caso marcado"]
        CU10["CU-D89-10<br/>Reincidencia y métricas"]
        CU11["CU-D89-11<br/>Revisar avisos de ingesta"]
        CU12["CU-D89-12<br/>Auditar el identificador"]
        CU13["CU-D89-13<br/>Ejecutar y verificar la migración"]
    end

    SUP --> CU01
    SUP --> CU03
    SUP --> CU04
    SUP --> CU05
    SUP --> CU07
    SUP --> CU10
    SUP --> CU11
    ADM --> CU03
    ADM --> CU05
    ADM --> CU07
    ADM --> CU10
    ADM --> CU12
    SUPER --> CU03
    SUPER --> CU07
    SUPER --> CU10
    SUPER --> CU12
    SUPER --> CU13
    TEC --> CU03
    TEC --> CU04
    TEC --> CU06
    ING --> CU01
    ING --> CU02
    CLA --> CU08
    CLA --> CU09

    CU01 -.->|include| CU02
    CU01 -.->|include| CU11
    CU07 -.->|extend<br/>si falta 70* o avería → 409| CU08
    CU09 -.->|extend<br/>si no se aportan los datos| CU08
    CU05 -.->|include| CU03
    CU06 -.->|include| CU03
    CU03 -.->|include| CU10
    CU13 -.->|verifica| CU02
```

## 2. Secuencia — Ingesta, clasificación y enlace del identificador (CU-01, CU-02)

```mermaid
sequenceDiagram
    autonumber
    actor SUP as Supervisor
    participant UI as INGESTA (SPA)
    participant API as routes_ingesta
    participant ING as services/ingesta
    participant CLS as services/clasificacion
    participant PAG as services/pagos
    participant DB as PostgreSQL

    SUP->>UI: Carga el CSV del día
    UI->>API: POST /ingesta/cargar (archivo)
    API->>ING: parsear(contenido)
    ING-->>API: filas por posición + avisos (80 columnas)
    API->>ING: filtrar_por_central(filas)
    API->>API: deduplicar por id_averia (RF-22)
    loop por cada fila nueva
        API->>CLS: clasificar_numero(col13, col16)
        CLS->>CLS: normalizar_numero()
        alt col13 cumple pago.serie_regex
            CLS->>PAG: resolver_identificador(numero, caso)
            PAG->>DB: SELECT identificador_pago WHERE numero = n
            alt no existe
                PAG->>DB: INSERT identificador_pago … ON CONFLICT (numero) DO NOTHING
            end
            PAG->>DB: UPDATE caso SET id_pago, telefono = numero
        else col13 no cumple el patrón
            CLS->>DB: UPDATE caso SET contacto_cliente, informacion += [CONTACTO] n
            CLS->>CLS: contador filas_sin_identificador_pago += 1
        end
        CLS->>DB: UPDATE caso SET contacto_cliente (col16) y informacion += [CONTACTO]
    end
    API->>DB: UPDATE ingesta_lote (contadores y avisos)
    API-->>UI: Resumen del lote (con y sin identificador, con contacto)
    UI-->>SUP: Muestra el resumen y los avisos
```

## 3. Secuencia — Histórico y reincidencia del identificador (CU-03, CU-10)

```mermaid
sequenceDiagram
    autonumber
    actor SUP as Supervisor
    participant UI as Ficha del caso (pestaña Histórico)
    participant API as routes_pagos / routes_casos
    participant PAG as services/pagos
    participant DB as PostgreSQL

    SUP->>UI: Abre la ficha de un caso y pulsa Histórico
    UI->>API: GET /casos/{id}/relacionados
    API->>DB: SELECT id_pago FROM caso WHERE id_caso = :id
    alt el caso tiene identificador
        API->>PAG: historico_por_identificador(id_pago)
        PAG->>DB: SELECT casos WHERE id_pago = :ip ORDER BY fecha_reporte DESC
        PAG->>DB: SELECT cierres (actividad tipo CIERRE)
        PAG->>DB: SELECT count(*) en la ventana (reincidencia global: informa los visibles)
        PAG-->>API: casos + justificaciones + reincidente
        API-->>UI: Listado con rótulo «Identificador de pago (70*)»
        UI-->>SUP: Casos del identificador + chip «Reincidente»
    else el caso no tiene identificador
        API-->>UI: «Sin identificador de pago — el número disponible es de contacto»
    end
```

## 4. Secuencia — Edición del número de contacto desde la APK (CU-06)

```mermaid
sequenceDiagram
    autonumber
    actor TEC as Técnico
    participant FICHA as Ficha (Flutter)
    participant SQL as SQLite (caso_local)
    participant COLA as Cola de sincronización
    participant API as PATCH /casos/{id}/contacto

    TEC->>FICHA: Pulsa Editar
    FICHA-->>TEC: Diálogo con Dirección y Número de contacto<br/>(el identificador se muestra en solo lectura)
    TEC->>FICHA: Escribe 0414-222-3344 y confirma
    FICHA->>FICHA: validarContacto() → normaliza (ya no exige serie 700/701/702)
    FICHA->>SQL: aplicarCambioLocal(contacto_cliente)
    SQL-->>FICHA: caso con contacto nuevo + pendiente_sync
    FICHA-->>TEC: Muestra 4142223344 con «Por sincronizar»
    alt hay red
        FICHA->>COLA: enviar cambio
        COLA->>API: PATCH {telefono: "4142223344"}
        alt 200
            API-->>COLA: caso actualizado (contacto + informacion)
            COLA->>SQL: limpiarPendienteSync()
        else 403 (rol)
            COLA->>COLA: mantiene el cambio encolado e informa
        else 422 (valor inválido)
            API-->>FICHA: motivo del servidor (se conserva el valor anterior)
        end
    else sin red
        COLA->>COLA: el cambio viaja en la próxima CARGA
    end
```

## 5. Decisión — REPARACIÓN vs REFERIDO (CU-07, CU-08, CU-09)

```mermaid
flowchart TD
    A["Alta o edición de un caso"] --> B{"¿tipo_caso = REPARACION?"}
    B -- No --> C["Se guarda tal cual<br/>(AVERIA, CONSTRUCCION o REFERIDO)"]
    B -- Sí --> D{"¿tiene identificador de pago (70*)?"}
    D -- No --> F["tipo_caso := REFERIDO<br/>categoria := REFERIDO<br/>motivo: SIN_IDENTIFICADOR_PAGO"]
    D -- Sí --> E{"¿id_averia real<br/>(no REF-…)?}
    E -- No --> G["tipo_caso := REFERIDO<br/>motivo: SIN_ID_AVERIA"]
    E -- Sí --> H["Se guarda como REPARACION<br/>enlazada al identificador"]
    F --> I["caso_especial idempotente:<br/>clasificacion REFERIDO (o EMPRESA/GOBIERNO)<br/>tiene_id_averia=false<br/>+ bitácora y auditoría"]
    G --> I
    I --> J["Chip «Reclasificado» visible en web y APK"]

    K["Caso histórico marcado<br/>REPARACION sin IP o sin avería"] --> L{"Siguiente cambio del caso"}
    L -- Aporta lo que falta --> H
    L -- No aporta --> I
    L -- Solo cambia de estado en un caso ya terminal --> M["No reclasifica:<br/>pendiente histórico en MONITOREO"]

    T["Trigger BEFORE INSERT/UPDATE en caso<br/>(garantiza el tipo aunque no pase por el servicio)"]
    T -.->|convierte a REFERIDO antes de validar| F
    N["CHECK ck_reparacion_con_ip<br/>red de seguridad: rige toda escritura"] -.-> H
```

## 6. Estados del caso en el incremento

```mermaid
stateDiagram-v2
    [*] --> NUEVO : ingesta o alta manual
    NUEVO --> ASIGNADO : despacho
    ASIGNADO --> CONTACTADO : contacto con el usuario del identificador
    CONTACTADO --> CITADO : cita acordada
    CITADO --> CERRADO : cierre con evidencia
    NUEVO --> REFERIDO_ESPECIAL : REPARACIÓN sin 70* o sin avería
    ASIGNADO --> REFERIDO_ESPECIAL : se retira el identificador en una edición
    REFERIDO_ESPECIAL --> NUEVO : se aportan 70* y avería real
    NUEVO --> CANCELADO : descartado
    CERRADO --> [*]
    CANCELADO --> [*]
    note right of REFERIDO_ESPECIAL
        No es un estado de caso.estado_actual:
        es la combinación categoria=REFERIDO +
        caso_especial.clasificacion=REFERIDO
    end note
```

## 7. Trazabilidad de los diagramas

| Diagrama | Casos de uso | Requisitos |
|---|---|---|
| §1 Casos de uso | CU-01…CU-12 | RF-45…RF-56 |
| §2 Secuencia de ingesta | CU-01, CU-02, CU-11 | RF-45, RF-46, RF-47, RF-56, RNF-29, RNF-33 |
| §3 Secuencia de histórico | CU-03, CU-10 | RF-48, RF-54, RF-55, RNF-31 |
| §4 Secuencia de edición en APK | CU-06 | RF-52, RNF-30, RNF-32 |
| §5 Decisión REPARACIÓN/REFERIDO | CU-07, CU-08, CU-09 | RF-49, RF-50, RNF-29, RNF-32 |
| §6 Estados del caso | CU-07, CU-08, CU-09 | RF-49, RF-50 |

## 8. Historial de versiones

| Versión | Fecha | Cambio |
|---|---|---|
| v0.1 | 2026-10-08 | Emisión inicial: casos de uso, 3 secuencias, decisión de clasificación y estados. |
| **v0.2** | 2026-10-08 | Auditoría incorporada: **CU-13** (migración) en el diagrama de casos de uso, actor `SUPER`, y árbol de decisión reescrito con `tipo_caso='REFERIDO'`, el **trigger**, la excepción de estados terminales y una aclaración de que el `CHECK` es red de seguridad. |
| **v0.3** | 2026-10-08 | **DEC-IP-5/6/7**: la secuencia de ingesta usa `ON CONFLICT (numero) DO NOTHING` (ficha única global) y la de histórico indica que la reincidencia es **global** informando los casos visibles por alcance. |
