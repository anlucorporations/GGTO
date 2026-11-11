# Propuesta — Incorporación del parque GPON de aprovisionamiento (`servicio_gpon`)

| Campo | Valor |
|---|---|
| Origen | `ODN-PDE/GPON_TRAFICO_PDE.xlsx` (2 443 440 bytes, 02/11/2026, Excel abierto en el momento del análisis) |
| Contenido | Parque de conexiones FTTH aprovisionadas de la central **2324X** (ODN «Francisco Salias») — **16 770 filas × 30 columnas**, hoja única `Hoja1`, encabezado en la fila 1 |
| Fecha del análisis | 2026-11-10 |
| **Decisiones del usuario (2026-11-10)** | (1) **Solo documentación por ahora** — no se toca la base ni `schema.sql`; (2) **el parque entra como catálogo** — sin enriquecer la ficha de los casos existentes; (3) **incorporación puntual por script** — patrón D-166/D-168 (simulación → `--aplicar --si`) cuando se apruebe la carga |
| Estado | **PROPUESTA NO IMPLEMENTADA.** No hay DDL en `schema.sql`, ni tabla, ni modelo, ni script. Este documento es el contrato para el siguiente incremento. |
| Advertencia PII | El archivo trae **PII real** (`DOCUMENTO`, `NOMBRE_APELLIDO`, direcciones en `CQE`). La carpeta `ODN-PDE/` está **fuera de git**; ningún valor del archivo debe copiarse a la documentación ni al repo. |

---

## 1 · Qué es el archivo

Cada fila = **un servicio/ONT instalado** (un abonado aprovisionado en el parque GPON de la central).
**No** es el CSV diario de averías (`detalle_averias_gpon_*.csv`, 80/81 columnas, D-27/D-164): es el
**inventario de abonados**, complementario a la ingesta diaria.

Métricas clave (verificadas con openpyxl, solo lectura):

| Métrica | Valor |
|---|---|
| Filas de datos | 16 770 |
| `NUMERO_IDENTIFICADOR` únicos | 16 716 (70\* = identificador de pago, D-89/DEC-IP-1) |
| Números con >1 fila | **6** (4×2 filas, 1×6, 1×46 — multiservicio/reprovisiones) |
| `SERIAL_ONT` únicos | **16 770 — candidato natural de clave física** |
| FAT únicas | 1 999 · Tuplas OLT/SLOT/PUERTO únicas: 791 |
| OLTs | 4 (`pde-olt-00…03`) · `HOSTNAME` (BRAS) constante |
| `ESTATUS_CRM` | ACTIVO 16 617 · RETIRADO 153 |
| `ESTATUS_ORDEN` | ACTIVO 14 636 · **CORTADO 2 103** · APROVISIONADO OFFLINE 24 · ND 7 |
| Planes | 14 (PLAN 60/30 = 9 200 · PLAN 100/50 = 4 888 · PLAN 600/300 = 722 …) |
| `FECHA_ACTIVACION` | 2021-09 → 2026-07 (mezcla de `datetime` y 2 135 cadenas de texto) |

## 2 · Clasificación de las 30 columnas

### 2.1 Columnas que YA existen en las entidades (16) — empalme directo

| Columna XLSX | Campo actual | Nota |
|---|---|---|
| `NUMERO_IDENTIFICADOR` | `identificador_pago.numero` / `caso.telefono` (70\*, D-89) | Llave de empalme |
| `SERIAL_ONT` | `caso.serial` | Única en el parque |
| `NUMERO_IP` | `caso.telefono_ip` (D-164) | 10 671 `NO_POSEE`; 6 099 numéricos |
| `PLAN` | `caso.plan` | 14 valores |
| `ODN` | `caso.nombre_central` | Constante «FRANCISCO SALIAS» |
| `CODIGO_CENTRAL` | `caso.codigo_central` | Constante `2324X` |
| `REGION` / `ESTADO` / `MUNICIPIO` / `PARROQUIA` | `region` / `estado_geografico` / `municipio` / `parroquia` | 1/1/4/6 valores |
| `HOSTNAME_OLT` | `caso.olt` | 4 valores |
| `SLOT` / `PUERTO` | `caso.slot` / `caso.puerto` | 17/16 valores |
| `FAT` | `caso.fat` | 1 999 únicas |
| `CQE` | `caso.direccion` | Dirección del abonado (PII) |
| `NOMBRE_APELLIDO` | `caso.nombre_cliente` | PII |

### 2.2 Datos NUEVOS (14) — lo que la solicitud pide incorporar

| Columna | Dato | Tipo propuesto | Observación |
|---|---|---|---|
| `DOCUMENTO` | RIF/cédula del abonado | `varchar(20)` | 16 094 únicos — **PII**; 1 documento puede tener varias ONT |
| `CIUDAD` | Ciudad | `varchar(60)` | 4 valores — no existía «ciudad» en el modelo |
| `FECHA_ACTIVACION` | Fecha de alta del servicio | `date` | 2 135 filas traen el valor como **texto** (formato largo de Excel); parser dedicado |
| `ESTATUS_CRM` | Estatus del abonado en CRM | `varchar(30)` | ACTIVO / RETIRADO |
| `ESTATUS_ORDEN` | Estatus del aprovisionamiento | `varchar(30)` | ACTIVO / **CORTADO** / APROVISIONADO OFFLINE / ND — relevante para el negocio: la avería de un servicio CORTADO no es avería técnica |
| `IP_OLT` | IP de gestión de la OLT | `varchar(45)` | 4 valores, 1:1 con `HOSTNAME_OLT` |
| `C_VLAN` | VLAN del cliente | `integer` | 1 191 valores, 34 nulos |
| `HOSTNAME` | Agregador/BRAS | `varchar(60)` | Constante (`lms-bras-…`) — **⚠ semánticamente es el BRAS, no la OLT**; en la tabla se nombra `hostname_bras` para no chocar con `caso.olt` |
| `S_VLAN` | VLAN del agregador | `integer` | 17 valores |
| `S_VLAN_AGREGADOR` | VLAN superior | `integer` | 58 valores |
| `SLOT_AGREGADOR` | Slot del BRAS | `integer` | Constante |
| `PUERTO_AGREGADOR` | Puerto del BRAS | `integer` | Constante |
| `VSUBIDA` | Velocidad contratada de subida (kbit) | `integer` | ~648 nulos; derivable del PLAN |
| `VBAJADA` | Velocidad contratada de bajada (kbit) | `integer` | ~648 nulos; derivable del PLAN |

## 3 · Modelo propuesto: entidad `servicio_gpon` (catálogo)

- **Alcance (decisión del usuario):** catálogo operativo del parque. **No** enriquece `caso`, **no** altera
  la ingesta diaria (D-27/D-164) ni el clasificador de pago (D-89).
- **Claves:** `SERIAL_ONT` **UNIQUE** (clave física natural, 16 770 únicos). `numero_identificador`
  **FK lógica** a `identificador_pago.numero` — **sin FK física**: el parque incluye servicios sin caso ni
  pago activo en el sistema, y 6 números traen varias filas (multiservicio), lo que rompería la unicidad.
- **PII:** el catálogo guarda `documento` y `nombre_cliente`; cuando se implemente debe entrar en la
  política de retención/anonimización D-153 (la purga de `servicio_gpon` se deja como residual).
- **El caso de avería** puede leer estos datos por la relación `numero_identificador` cuando se decida
  (vista o `JOIN` en la ficha), **sin duplicar** los 14 datos en `caso`.

### DDL propuesto (solo documento — NO está en `schema.sql`)

```sql
-- PROPUESTA (2026-11-10) — pendiente de aprobación; NO ejecutar todavía.
CREATE TABLE IF NOT EXISTS servicio_gpon (
    id_servicio           bigserial    PRIMARY KEY,
    numero_identificador  varchar(20)  NOT NULL,          -- 70* (D-89); FK lógica, sin FK física
    serial_ont            varchar(30)  NOT NULL UNIQUE,   -- clave física natural del parque
    -- PII (entra a la política D-153 cuando se implemente)
    documento             varchar(20),
    nombre_cliente        varchar(120),
    -- geografía
    region                varchar(40),
    estado_geografico     varchar(40),
    ciudad                varchar(60),                    -- NUEVO
    municipio             varchar(60),
    parroquia             varchar(80),
    -- servicio y aprovisionamiento
    plan                  varchar(60),
    fecha_activacion      date,                           -- NUEVO (parser de texto largo)
    estatus_crm           varchar(30),                    -- NUEVO
    estatus_orden         varchar(30),                    -- NUEVO
    -- red de acceso (OLT)
    olt                   varchar(60),                    -- HOSTNAME_OLT
    ip_olt                varchar(45),                    -- NUEVO
    slot                  integer,
    puerto                integer,
    fat                   varchar(120),
    c_vlan                integer,                        -- NUEVO
    -- red de agregación (BRAS)
    hostname_bras         varchar(60),                    -- NUEVO («HOSTNAME» del XLSX)
    s_vlan                integer,                        -- NUEVO
    s_vlan_agregador      integer,                        -- NUEVO
    slot_agregador        integer,                        -- NUEVO
    puerto_agregador      integer,                        -- NUEVO
    -- ip y velocidades
    numero_ip             varchar(45),                    -- NUMERO_IP (equivalente telefono_ip, D-164)
    velocidad_subida      integer,                        -- NUEVO (kbit)
    velocidad_bajada      integer,                        -- NUEVO (kbit)
    -- trazabilidad de la carga
    codigo_central        varchar(20)  NOT NULL,
    fuente                varchar(160) NOT NULL,          -- nombre del archivo de origen
    actualizado_en        timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_servicio_gpon_numero ON servicio_gpon (numero_identificador);
CREATE INDEX IF NOT EXISTS ix_servicio_gpon_fat    ON servicio_gpon (fat);
```

> `NUMERO_IDENTIFICADOR` se almacena **como texto** (los 70\* del parque llegan como float de Excel;
> 46 filas traen valores no numéricos de 13 caracteres con prefijo `N…` — placeholders sin pago, se
> conservan tal cual y quedan excluidos del empalme con `identificador_pago`).

## 4 · Reglas de calidad y normalización (para el parser)

| Problema detectado | Regla |
|---|---|
| `SERIAL_ONT` como float (36 filas) | Normalizar a texto sin `.0` (mismo criterio de RN-IP-07 para el IP) |
| `NUMERO_IP` como float (6 099) | Ídem; `NO_POSEE` (10 671) se guarda **vacío/NULL**, no el literal |
| `FECHA_ACTIVACION` como texto (2 135, len 26, tipo `Wed Sep 28 … VET 2022`) | Parser dedicado; si no parsea → NULL + aviso en el reporte de simulación |
| `NUMERO_IDENTIFICADOR` no numérico (46, prefijo `N`) | Se conservan como texto; el empalme con pagos solo aplica a valores 70\* |
| Nulos: `CQE` 70 · `C_VLAN` 34 · `VSUBIDA/VBAJADA` ~648 | NULL, con conteo en el reporte |
| `ESTATUS_ORDEN` = `ND` (7) | Se conserva el literal |
| Filas duplicadas por número (6 números) | Se cargan **todas** las filas: la unicidad es por `serial_ont`, no por número |

## 5 · Modo de incorporación (cuando se apruebe): script puntual idempotente

Patrón **D-166/D-168** (el mismo de las migraciones de producción):

- Script único `scripts/cargar_parque_gpon_pde.py` (o el nombre definitivo del incremento).
- **Simulación por defecto**: lee el XLSX, aplica normalizaciones y reporta — sin escribir —
  filas leídas / a insertar / a actualizar / avisos de calidad / empalme con `identificador_pago`.
- `--aplicar --si` para ejecutar la escritura (una transacción; `ON CONFLICT (serial_ont) DO UPDATE`
  para que la re-carga del mismo archivo sea idempotente —nunca borra: sin `DELETE` sin filtro, RN de datos reales).
- DDL de creación idempotente incluido en el propio script (o migración previa con el mismo patrón).
- Log de la corrida en `RepoTecnico/BaseOperaciones/` (sin PII: solo contadores y formas de dato).
- **Sin interfaz/endpoints** (no se eligió ingesta de plataforma): el parque se refresca ejecutando
  el script con el archivo nuevo.

## 6 · Empalme con producción — pendiente de medir

La muestra local de averías (51 filas, 11 números únicos) dio **empalme 0** por número y por FAT
(normalizado en mayúsculas). El empalme real se mide contra los **167 casos de producción**
(`ggtov2` en `ggto-prod-txblvento`) por `cloud-sql-proxy` antes de cualquier carga:

```sql
SELECT count(*) FROM caso WHERE telefono IN (…70* del parque…);
SELECT count(*) FROM caso WHERE UPPER(serial) IN (…seriales del parque…);
```

Con el alcance decidido (catálogo) el empalme no bloquea la carga, pero la cifra interesa para el
informe (cuántos abonados del parque tienen caso abierto hoy).

## 7 · Residuales y pasos siguientes

1. **Aprobación del DDL** de §3 → entonces: `schema.sql` + migración idempotente (patrón D-166/D-168) + modelo SQLAlchemy si se necesita desde la app.
2. **Script de carga** (§5) con simulación sobre `ODN-PDE/GPON_TRAFICO_PDE.xlsx`.
3. **Medición del empalme** contra producción (§6) e informe al usuario.
4. **PII:** incorporar `servicio_gpon` a la purga/anonimización (D-153) cuando la tabla exista; `ODN-PDE/` sigue fuera de git.
5. **Sin analizar todavía:** las 16 tablas de conexiones por ODN de `ODN-PDE/` (Alto Prado, Concresa, Cumbres de Curumo, El Guire, Las Minitas, Los Campitos, Parque Humboldt, Prados del Este, Santa Cruz 144/48H, etc.) — mismas 30 columnas probablemente, por confirmar.
6. La decisión de **enriquecer casos** quedó **descartada por ahora** (alcance catálogo); puede reabrirse después sin cambiar el modelo.
