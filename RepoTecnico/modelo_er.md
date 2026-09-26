# Modelo Entidad-Relación — Base de Datos GGTO

| Campo | Valor |
|---|---|
| Proyecto | **GGTO** — Gestión de averías y puntos ópticos (CANTV · Francisco Salias / Área 4) |
| Motor | **PostgreSQL** |
| Script DDL | [`db/schema.sql`](db/schema.sql) — se edita a medida del desarrollo |
| Diccionario | [`diccionario_datos.md`](diccionario_datos.md) |
| Fase | Fase 1 — Concepto |
| Estado | Borrador v0.1 |

> Los diagramas usan **Mermaid** (`erDiagram`) y son renderizables en GitLab/GitHub/VS Code.
> Para editar: modificar el bloque y regenerar. El DDL se mantiene sincronizado con estos diagramas.

**Convenciones de tipos (Mermaid no admite paréntesis):**

| Mermaid | PostgreSQL real |
|---|---|
| `serial` / `bigserial` | `serial` / `bigserial` |
| `varchar` | `varchar(n)` según el diccionario |
| `timestamp` | `timestamptz` |
| `numeric` | `numeric(12,2)` / `numeric(10,7)` para GPS |
| `json` | `jsonb` |
| `bool` | `boolean` |

Claves: `PK` primaria · `FK` foránea · `UK` única.

---

## 1. Vista general de relaciones

```mermaid
erDiagram
    ROL            ||--o{ USUARIO : asigna
    TECNICO        ||--o| USUARIO : "da identidad a"
    CENTRAL        ||--o{ SECTOR : contiene
    CENTRAL        ||--o{ TECNICO : emplea
    CENTRAL        ||--o{ FLOTA : posee
    CENTRAL        ||--o{ HERRAMIENTA : posee
    CENTRAL        ||--o{ CUADRILLA : organiza
    CENTRAL        ||--o{ CASO : administra
    CENTRAL        ||--o{ INGESTA_LOTE : recibe
    CENTRAL        ||--o{ INSUMO : cataloga
    SECTOR         ||--o{ SECTOR_DIRECCION : agrupa
    CUADRILLA      ||--o{ CUADRILLA_TECNICO : integra
    CUADRILLA      ||--o{ CUADRILLA_HERRAMIENTA : equipa
    CUADRILLA      ||--o{ DESPACHO : ejecuta
    CUADRILLA      ||--o{ CITA : atiende
    FLOTA          ||--o| CUADRILLA : "es vehiculo de"
    SECTOR         ||--o{ CASO : ubica
    INGESTA_LOTE   ||--o{ CASO : origina
    CAUSA          ||--o{ CASO : clasifica
    CASO           ||--o{ CASO_ESTADO_HIST : historial
    CASO           ||--o{ ACTIVIDAD : registra
    CASO           ||--o{ EVIDENCIA : respalda
    CASO           ||--o{ DESPACHO_CASO : despacha
    CASO           ||--o{ SEGUIMIENTO : deriva
    CASO           ||--o{ CITA : agenda
    CASO           ||--o| CASO_ESPECIAL : especializa
    SOLICITANTE    ||--o{ CASO_ESPECIAL : solicita
    DESPACHO       ||--o{ DESPACHO_CASO : detalla
    ACTIVIDAD      ||--o{ EVIDENCIA : adjunta
    USUARIO        ||--o{ ACTIVIDAD : ejecuta
    USUARIO        ||--o| DISPOSITIVO_SEGURIDAD : registra
    DISPOSITIVO_SEGURIDAD ||--o{ SINCRONIZACION : sincroniza
    TECNICO        ||--o{ SINCRONIZACION : realiza
    ACTIVIDAD      ||--o{ INCIDENTE : reporta
    FLOTA          ||--o{ INCIDENTE : sufre
    HERRAMIENTA    ||--o{ INCIDENTE : sufre
    FALLA_MASIVA   ||--o{ CASO : agrupa
    ORDEN_MATERIAL ||--o{ ORDEN_MATERIAL_DETALLE : contiene
    ORDEN_MATERIAL ||--o{ INVENTARIO_MOVIMIENTO : genera
    INSUMO         ||--o{ ORDEN_MATERIAL_DETALLE : incluye
    INSUMO         ||--o{ INVENTARIO_MOVIMIENTO : mueve
    CATALOGO_METODO ||--o{ ACTIVIDAD : define
    CASO           ||--o{ NOTIFICACION : notifica
```

---

## 2. Núcleo organizacional y seguridad

```mermaid
erDiagram
    ROL {
        serial   id_rol PK
        varchar  codigo UK "SUPERVISOR|TECNICO|ADMIN"
        varchar  nombre
        json     permisos
        bool     activo
    }
    CENTRAL {
        serial   id_central PK
        varchar  region
        varchar  estado_geografico
        varchar  capital_estado
        varchar  municipio
        varchar  parroquia
        varchar  estado_operativo
        varchar  distrito
        varchar  area
        varchar  codigo_central UK "ej. 2324X"
        varchar  nombre_central
        bool     activa
    }
    SECTOR {
        serial   id_sector PK
        int      id_central FK
        varchar  nombre "Norte 1, Sur 2"
        varchar  codigo UK
        varchar  descripcion
        int      prioridad
        bool     activo
    }
    SECTOR_DIRECCION {
        serial   id_sector_direccion PK
        int      id_sector FK
        varchar  patron "VALLE ARRIBA, CONCRESA"
        varchar  tipo_coincidencia "CONTIENE|EXACTO|REGEX"
        bool     normalizar
        bool     activo
    }
    TECNICO {
        serial   id_tecnico PK
        int      id_central FK
        varchar  nombre
        varchar  apellido
        varchar  cedula UK
        varchar  p00 UK
        varchar  telefono
        varchar  correo
        varchar  especialidad
        varchar  status
    }
    USUARIO {
        serial   id_usuario PK
        varchar  p00 UK
        varchar  correo UK
        varchar  clave_hash
        int      id_rol FK
        int      id_tecnico FK
        int      intentos_fallidos
        bool     bloqueado
        bool     bloqueo_cliente
        bool     requiere_cambio_clave
        bool     activo
        timestamp ultimo_acceso
    }
    FLOTA {
        serial   id_flota PK
        int      id_central FK
        varchar  can UK
        varchar  tipo
        varchar  marca
        varchar  modelo
        varchar  placa UK
        varchar  combustible
        varchar  status
        varchar  estado_cauchos
        varchar  estado_fluidos
        varchar  estado_general
    }
    HERRAMIENTA {
        serial   id_herramienta PK
        int      id_central FK
        varchar  nombre
        varchar  codigo UK
        varchar  estado
        varchar  observacion
    }
    CUADRILLA {
        serial   id_cuadrilla PK
        int      id_central FK
        varchar  codigo UK
        varchar  nombre
        int      id_flota FK
        bool     es_supervisor "cuadrilla 0"
        bool     activa
    }
    CUADRILLA_TECNICO {
        int      id_cuadrilla PK
        int      id_tecnico PK
        date     desde PK
        varchar  rol_cuadrilla
        date     hasta
    }
    CUADRILLA_HERRAMIENTA {
        int      id_cuadrilla PK
        int      id_herramienta PK
        timestamp asignada_en PK
        timestamp devuelta_en
    }
    DISPOSITIVO_SEGURIDAD {
        bigserial id_dispositivo PK
        varchar  p00 FK
        json     palabras_hash "12 palabras"
        varchar  clave_privada_ref
        text     documento_cifrado
        bool     bloqueado
        int      version
    }
    SINCRONIZACION {
        bigserial id_sync PK
        bigint   id_dispositivo FK
        int      id_tecnico FK
        timestamp inicio
        timestamp fin
        int      casos_descargados
        int      actividades_subidas
        int      evidencias_subidas
        varchar  archivo_zip "central+cuadrilla+fecha"
        varchar  estado
        json     detalle_json
    }

    CENTRAL  ||--o{ SECTOR : contiene
    SECTOR   ||--o{ SECTOR_DIRECCION : agrupa
    CENTRAL  ||--o{ TECNICO : emplea
    CENTRAL  ||--o{ FLOTA : posee
    CENTRAL  ||--o{ HERRAMIENTA : posee
    CENTRAL  ||--o{ CUADRILLA : organiza
    ROL      ||--o{ USUARIO : asigna
    TECNICO  ||--o| USUARIO : identifica
    FLOTA    ||--o| CUADRILLA : "es vehiculo de"
    CUADRILLA ||--o{ CUADRILLA_TECNICO : integra
    TECNICO  ||--o{ CUADRILLA_TECNICO : pertenece
    CUADRILLA ||--o{ CUADRILLA_HERRAMIENTA : equipa
    HERRAMIENTA ||--o{ CUADRILLA_HERRAMIENTA : asignada
    USUARIO  ||--o| DISPOSITIVO_SEGURIDAD : registra
    DISPOSITIVO_SEGURIDAD ||--o{ SINCRONIZACION : sincroniza
    TECNICO  ||--o{ SINCRONIZACION : realiza
```

---

## 3. Casos (averías y solicitudes)

```mermaid
erDiagram
    INGESTA_LOTE {
        bigserial id_lote PK
        varchar  archivo
        date     fecha_archivo
        int      id_central FK
        int      filas_leidas
        int      filas_central
        int      casos_nuevos
        int      casos_duplicados
        int      casos_descartados
        varchar  estado
        varchar  usuario
    }
    CAUSA {
        serial   id_causa PK
        varchar  codigo_causa
        varchar  subcodigo_causa
        varchar  descripcion
        varchar  descripcion_subcodigo
        varchar  tipo
        bool     activo
    }
    CASO {
        bigserial id_caso PK
        int      id_central FK
        varchar  id_averia UK "unico global"
        varchar  origen
        varchar  tipo_caso "AVERIA|REPARACION|CONSTRUCCION"
        varchar  categoria "RESIDENCIAL|EMPRESA|REFERIDO|GOBIERNO"
        varchar  estado_actual
        varchar  telefono
        varchar  nombre_cliente
        varchar  direccion
        int      id_sector FK
        int      id_causa FK
        bigint   id_lote_ingesta FK
        bool     en_gestion_supervisor
        bool     es_falla_masiva
        varchar  olt
        varchar  tarjeta
        varchar  slot
        varchar  puerto
        varchar  ont_id
        varchar  fat
        varchar  serial
        varchar  plan
        varchar  tipo_servicio
        varchar  problema_reporte
        varchar  ultimo_comentario
        timestamp fecha_reporte
        timestamp fecha_cita
        timestamp fecha_compromiso
    }
    CASO_ESPECIAL {
        serial   id_caso_especial PK
        bigint   id_caso FK
        int      id_solicitante FK
        varchar  clasificacion "REFERIDO|EMPRESA|GOBIERNO"
        varchar  tipo_actividad "REPARACION|CONSTRUCCION"
        varchar  prioridad
        bool     tiene_id_averia
        text     descripcion
        bool     requiere_informe
        varchar  estado
    }
    SOLICITANTE {
        serial   id_solicitante PK
        varchar  unidad
        varchar  nombre
        varchar  contacto
        varchar  canal "TELEGRAM|MCP_IA|MANUAL"
    }
    CASO_ESTADO_HIST {
        bigserial id_hist PK
        bigint   id_caso FK
        varchar  estado_anterior
        varchar  estado_nuevo
        text     motivo
        varchar  usuario
        timestamp fecha_hora
    }
    SEGUIMIENTO {
        bigserial id_seguimiento PK
        bigint   id_caso FK
        varchar  instancia_destino
        text     motivo
        timestamp fecha_envio
        timestamp fecha_retorno
        varchar  estado
        varchar  usuario
    }
    CITA {
        bigserial id_cita PK
        bigint   id_caso FK
        int      id_caso_especial FK
        int      id_cuadrilla FK
        timestamp fecha_hora "sin solapamiento"
        varchar  tipo "CONTACTO|ATENCION"
        varchar  estado
        text     observacion
    }

    CENTRAL      ||--o{ INGESTA_LOTE : recibe
    INGESTA_LOTE ||--o{ CASO : origina
    CENTRAL      ||--o{ CASO : administra
    SECTOR       ||--o{ CASO : ubica
    CAUSA        ||--o{ CASO : clasifica
    CASO         ||--o| CASO_ESPECIAL : especializa
    SOLICITANTE  ||--o{ CASO_ESPECIAL : solicita
    CASO         ||--o{ CASO_ESTADO_HIST : historial
    CASO         ||--o{ SEGUIMIENTO : deriva
    CASO         ||--o{ CITA : agenda
    CASO_ESPECIAL ||--o{ CITA : agenda
    CUADRILLA    ||--o{ CITA : atiende
```

---

## 4. Despacho y fallas masivas

```mermaid
erDiagram
    DESPACHO {
        bigserial id_despacho PK
        int      id_central FK
        date     fecha
        int      id_cuadrilla FK
        varchar  estado "BORRADOR|PUBLICADO|CERRADO"
        bool     generado_auto
        varchar  enviado_canal "TELEGRAM|CORREO"
        timestamp enviado_en
        timestamp reporte_produccion_en "04:00 pm"
        varchar  usuario_crea
    }
    DESPACHO_CASO {
        bigserial id_despacho_caso PK
        bigint   id_despacho FK
        bigint   id_caso FK
        int      id_sector FK
        int      orden_visita
        varchar  tipo_asignacion
        varchar  estado
        text     observacion
    }
    FALLA_MASIVA {
        bigserial id_falla PK
        int      id_central FK
        text     descripcion
        timestamp fecha_deteccion
        varchar  origen "AUTOMATICA|REPORTE_TECNICO|MCP"
        int      id_sector FK
        int      id_cuadrilla FK
        varchar  estado
        text     planificacion
        text     reporte_simple
    }
    CASO {
        bigserial id_caso PK
        varchar  id_averia UK
        bool     es_falla_masiva
        int      id_sector FK
    }
    CUADRILLA {
        serial   id_cuadrilla PK
        varchar  codigo UK
        bool     es_supervisor
    }
    SECTOR {
        serial   id_sector PK
        varchar  nombre
    }
    CENTRAL {
        serial   id_central PK
        varchar  nombre_central
    }

    CENTRAL    ||--o{ DESPACHO : genera
    CUADRILLA  ||--o{ DESPACHO : ejecuta
    DESPACHO   ||--o{ DESPACHO_CASO : detalla
    CASO       ||--o{ DESPACHO_CASO : asignado
    SECTOR     ||--o{ DESPACHO_CASO : agrupa
    CENTRAL    ||--o{ FALLA_MASIVA : registra
    SECTOR     ||--o{ FALLA_MASIVA : ubica
    CUADRILLA  ||--o{ FALLA_MASIVA : atiende
    FALLA_MASIVA ||--o{ CASO : agrupa
```

---

## 5. Gestión técnica (app móvil)

```mermaid
erDiagram
    ACTIVIDAD {
        bigserial id_actividad PK
        bigint   id_caso FK
        int      id_usuario FK
        int      id_cuadrilla FK
        varchar  tipo "CONTACTO|CIERRE|ENRUTE|DIFERIDO|INCIDENTE|FALLA_MASIVA"
        varchar  resultado
        text     reporte_corto
        int      id_metodo FK
        int      id_causa FK
        timestamp fecha_hora
        numeric  latitud
        numeric  longitud
        bool     sincronizado
    }
    EVIDENCIA {
        bigserial id_evidencia PK
        bigint   id_actividad FK
        varchar  tipo "POTENCIA|NAVEGACION|DEMO"
        varchar  serial_imagen UK "caso+averia+tipo+fecha"
        varchar  ruta_local
        varchar  ruta_remota
        numeric  latitud
        numeric  longitud
        timestamp fecha_hora
        bool     origen_camara "false = galeria (invalido)"
    }
    INCIDENTE {
        bigserial id_incidente PK
        varchar  tipo "FLOTA|HERRAMIENTA"
        int      id_flota FK
        int      id_herramienta FK
        text     descripcion
        bigint   id_actividad FK
        varchar  estado
    }
    CATALOGO_METODO {
        serial   id_metodo PK
        varchar  dominio "CIERRE|ENRUTE|DIFERIDO|CONTACTO"
        varchar  codigo
        varchar  nombre
        bool     activo
    }
    CAUSA {
        serial   id_causa PK
        varchar  codigo_causa
        varchar  subcodigo_causa
    }
    CASO {
        bigserial id_caso PK
        varchar  id_averia UK
    }
    USUARIO {
        serial   id_usuario PK
        varchar  p00 UK
    }
    CUADRILLA {
        serial   id_cuadrilla PK
        varchar  codigo UK
    }
    FLOTA {
        serial   id_flota PK
        varchar  can UK
    }
    HERRAMIENTA {
        serial   id_herramienta PK
        varchar  codigo UK
    }

    CASO       ||--o{ ACTIVIDAD : registra
    USUARIO    ||--o{ ACTIVIDAD : ejecuta
    CUADRILLA  ||--o{ ACTIVIDAD : pertenece
    CATALOGO_METODO ||--o{ ACTIVIDAD : define
    CAUSA      ||--o{ ACTIVIDAD : justifica
    ACTIVIDAD  ||--o{ EVIDENCIA : adjunta
    ACTIVIDAD  ||--o{ INCIDENTE : reporta
    FLOTA      ||--o{ INCIDENTE : sufre
    HERRAMIENTA ||--o{ INCIDENTE : sufre
```

---

## 6. Insumos (v2)

```mermaid
erDiagram
    INSUMO {
        serial   id_insumo PK
        int      id_central FK
        varchar  codigo UK
        varchar  nombre
        varchar  unidad_medida
        numeric  stock_minimo
        bool     activo
    }
    ORDEN_MATERIAL {
        bigserial id_orden PK
        bigint   id_caso FK
        int      id_cuadrilla FK
        varchar  solicitante_usuario
        varchar  estado
        timestamp fecha
        text     observacion
    }
    ORDEN_MATERIAL_DETALLE {
        bigserial id_orden_detalle PK
        bigint   id_orden FK
        int      id_insumo FK
        numeric  cantidad_solicitada
        numeric  cantidad_entregada
    }
    INVENTARIO_MOVIMIENTO {
        bigserial id_mov PK
        int      id_insumo FK
        varchar  tipo "INGRESO|EGRESO|AJUSTE"
        numeric  cantidad
        bigint   id_orden FK
        int      id_tecnico FK
        timestamp fecha
        varchar  usuario
    }
    CENTRAL {
        serial   id_central PK
    }
    CASO {
        bigserial id_caso PK
    }
    CUADRILLA {
        serial   id_cuadrilla PK
    }
    TECNICO {
        serial   id_tecnico PK
    }

    CENTRAL        ||--o{ INSUMO : cataloga
    ORDEN_MATERIAL ||--o{ ORDEN_MATERIAL_DETALLE : contiene
    INSUMO         ||--o{ ORDEN_MATERIAL_DETALLE : incluye
    ORDEN_MATERIAL ||--o{ INVENTARIO_MOVIMIENTO : genera
    INSUMO         ||--o{ INVENTARIO_MOVIMIENTO : mueve
    CASO           ||--o{ ORDEN_MATERIAL : origina
    CUADRILLA      ||--o{ ORDEN_MATERIAL : solicita
    TECNICO        ||--o{ INVENTARIO_MOVIMIENTO : recibe
```

---

## 7. Soporte y auditoría

```mermaid
erDiagram
    CONFIGURACION {
        varchar  clave PK
        json     valor
        varchar  descripcion
        timestamp actualizado_en
    }
    AUDITORIA {
        bigserial id_auditoria PK
        varchar  usuario
        varchar  accion
        varchar  entidad
        varchar  id_entidad
        json     datos_antes
        json     datos_despues
        varchar  ip
        timestamp fecha_hora
    }
    NOTIFICACION {
        bigserial id_notificacion PK
        varchar  canal "TELEGRAM|CORREO|MCP_IA"
        varchar  destinatario
        varchar  asunto
        text     cuerpo
        bigint   id_caso FK
        varchar  estado
        timestamp enviado_en
    }
    CASO {
        bigserial id_caso PK
        varchar  id_averia UK
    }

    CASO ||--o{ NOTIFICACION : notifica
```

---

## 8. Reglas de integridad destacadas

| Regla | Implementación |
|---|---|
| `id_averia` único **global** (P1.3) | `UNIQUE (id_averia)` en `caso`. |
| Sector por coincidencia de dirección (P1.2) | `sector_direccion.patron` + `caso.id_sector`; asignación en la capa de servicio. |
| Una cita no se solapa | Validación en servicio + índice `(id_cuadrilla, fecha_hora)`; `EXCLUDE` con `btree_gist` opcional. |
| Cuadrilla del supervisor = cuadrilla 0 | `cuadrilla.es_supervisor = true` (una por central). |
| Evidencia solo por cámara | `evidencia.origen_camara` debe ser `true`. |
| Despacho único por cuadrilla y día | `UNIQUE (fecha, id_cuadrilla)` en `despacho`. |
| Un caso una vez por despacho | `UNIQUE (id_despacho, id_caso)` en `despacho_caso`. |
| Cita requiere caso o caso especial | `CHECK (id_caso IS NOT NULL OR id_caso_especial IS NOT NULL)`. |
| Incidente requiere flota o herramienta | `CHECK (id_flota IS NOT NULL OR id_herramienta IS NOT NULL)`. |
| `actualizado_en` automático | Trigger `set_actualizado_en()` en las tablas editables. |

---

## 9. Cómo mantener este documento

1. Editar la tabla correspondiente en `db/schema.sql`.
2. Actualizar el bloque Mermaid afectado en este archivo.
3. Verificar que ambos representen las mismas entidades, campos y relaciones.
4. Registrar el cambio en `estado_proyecto.md`.
