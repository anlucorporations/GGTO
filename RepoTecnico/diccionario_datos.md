# Diccionario de Datos — GGTO (Central Francisco Salias, Área 4)

- **Proyecto:** GGTO-v1
- **Fase:** 1 (Concepto) — documento vivo
- **Versión:** v1
- **Fecha:** 2026-02-19
- **Fuente:** `RepoTecnico/PAGINA-GGTO-INICIAL.md`, sección `[ESTRUCTURAS]` (L54-58) y decisiones D-01 a D-11.

> Tipos: `T` texto, `F` fecha `DD/MM/AAAA`, `E` enumerado, `N` numérico, `B` booleano (`SI`/`NO`),
> `L` lista. `PK` = clave primaria, `FK` = clave foránea, `OBL` = obligatorio.

---

## 1. `averias.json` — maestro de casos

Archivo único con el universo de averías gestionadas. Persistencia directa en disco (D-01);
toda edición se refleja aquí (RF-24 / RN-07). Se conserva el orden de columnas del fuente (RT-04).

| # | Campo | Tipo | OBL | Dominio / formato | Origen | Notas |
|---|---|---|---|---|---|---|
| 1 | `ingreso` | F | Sí | DD/MM/AAAA | Ingesta | Fecha en que el caso entró (RN-02). |
| 2 | `nivel` | E | Sí | `REF` / `COM` | Ingesta / manual | `COM` por defecto; `REF` para referidos. |
| 3 | `clase` | E | Sí | `REP` / `CNS` | Ingesta / manual | `REP` por defecto; `CNS` se corrige a mano (D-06). |
| 4 | `sector` | T (FK) | Sí | id de `sectores.json` | Ingesta / manual | Se completa por coincidencia de dirección (RF-18, RN-04). |
| 5 | `Reparador Principal` | T (FK) | No | id o nombre de cuadrilla | Despacho | Agrupa el despacho (RF-20). |
| 6 | `id_averia` | T | Sí | PK, texto | CSV | Clave de deduplicación (RN-01). |
| 7 | `telefono` | T | Sí | dígitos | CSV | Clave alterna de búsqueda (RF-02). |
| 8 | `persona_reporta` | T | No | — | CSV | Quien reporta la avería. |
| 9 | `contacto` | T | No | — | CSV | Teléfono/contacto adicional. |
| 10 | `ultimo_comentario` | T | No | — | CSV | Campo de diagnóstico; se busca aquí las palabras clave (RN-03). |
| 11 | `problema_reporte` | T | No | — | CSV | Campo de diagnóstico; se busca aquí las palabras clave (RN-03). |
| 12 | `informacion_1` | T | No | — | CSV | Primera columna `informacion` del CSV (D-10). |
| 13 | `informacion_2` | T | No | — | CSV | Segunda columna `informacion` del CSV (D-10). |
| 14 | `nombre` | T | No | — | CSV | Nombre del abonado. |
| 15 | `direccion` | T | Sí | texto libre | CSV | Base del agrupamiento por sector y del despacho. |
| 16 | `olt` | T | No | — | CSV | Red / planta externa. |
| 17 | `plan` | T | No | — | CSV | Plan contratado. |
| 18 | `slot` | T | No | — | CSV | Red / planta externa. |
| 19 | `puerto` | T | No | — | CSV | Red / planta externa. |
| 20 | `fat` | T | No | — | CSV | Caja de acceso de fibra. |
| 21 | `serial` | T | No | — | CSV | Serial del equipo/ONT. |
| 22 | `extra` | T | No | — | CSV | Red / planta externa (D-04). |
| 23 | `ups` | T | No | — | CSV | Red / planta externa — significado por precisar (A-11). |
| 24 | `codigos_sin_gestion_en_VENAPP` | T | No | — | CSV | Códigos de casos sin gestión en VENAPP. |
| 25 | `status` | E | Sí | `PEND` / `CERRADO` / `GESTION` | Ingesta / manual | `PEND` con palabras clave de fibra; `GESTION` sin ellas (D-05). |
| 26 | `resolucion` | E | No | `IVR` / `COS` / `COLA` | Manual | Se completa al cerrar el caso (RF-03, RF-22). |
| 27 | `fechaResolucion` | F | No | DD/MM/AAAA | Manual | Fecha de cierre. |
| 28 | `observaciones` | T | No | texto libre | Manual | Notas de gestión. |
| 29 | `sacas` | B | No | `SI` / `NO` | Manual | Indicador de cierre. |

**Reglas de integridad**
- `id_averia` es único; la ingesta descarta cualquier caso ya presente (RN-01, RNF-04).
- `status = CERRADO` implica `resolucion` y `fechaResolucion` informadas (regla de cierre).
- `sector` debe existir en `sectores.json`; si no, el caso queda en la cola de asignación (RN-04).
- `Reparador Principal`, cuando está informado, debe corresponder a una cuadrilla declarada (A-14).

---

## 2. `despacho.json` — vista de trabajo de campo

Subconjunto de columnas de `averias.json` (RT-05). Se usa para generar los PDF del despacho diario.

| # | Campo | Tipo | OBL | Dominio / formato | Notas |
|---|---|---|---|---|---|
| 1 | `nivel` | E | Sí | `REF` / `COM` | Copiado del maestro. |
| 2 | `clase` | E | Sí | `REP` / `CNS` | Copiado del maestro. |
| 3 | `id_averia` | T | Sí | PK | Trazabilidad con el maestro. |
| 4 | `telefono` | T | No | — | — |
| 5 | `persona_reporta` | T | No | — | — |
| 6 | `contacto` | T | No | — | — |
| 7 | `ultimo_comentario` | T | No | — | Se imprime en la hoja de la cuadrilla. |
| 8 | `nombre` | T | No | — | — |
| 9 | `direccion` | T | Sí | texto libre | — |
| 10 | `plan` | T | No | — | — |
| 11 | `fat` | T | No | — | — |
| 12 | `serial` | T | No | — | — |

**Observación abierta (A-14):** el fuente (L57) no incluye `sector` ni la cuadrilla
(`Reparador Principal`) en `despacho.json`, aunque el agrupamiento del despacho se hace por
`Reparador Principal` (L44) y por sector (L42-43). Pendiente decidir si se amplía el archivo o
si el agrupamiento se calcula en memoria.

---

## 3. `estructura.json` — contrato de extracción del CSV

Especificación del mapeo columna-CSV → campo-JSON que usa la ingesta (RF-16, D-08). No contiene
datos, solo la lista de columnas esperadas y su correspondencia.

| # | Campo (JSON) | Tipo | Columna esperada en el CSV | Notas |
|---|---|---|---|---|
| 1 | `id_averia` | T | `id_averia` | PK. |
| 2 | `telefono` | T | `telefono` | — |
| 3 | `persona_reporta` | T | `persona_reporta` | — |
| 4 | `contacto` | T | `contacto` | — |
| 5 | `ultimo_comentario` | T | `ultimo_comentario` | Palabras clave RN-03. |
| 6 | `problema_reporte` | T | `problema_reporte` | Palabras clave RN-03. |
| 7 | `informacion_1` | T | primera columna `informacion` | D-10. |
| 8 | `informacion_2` | T | segunda columna `informacion` | D-10. |
| 9 | `nombre` | T | `nombre` | — |
| 10 | `direccion` | T | `direccion` | Base de asignación de sector. |
| 11 | `olt` | T | `olt` | — |
| 12 | `plan` | T | `plan` | — |
| 13 | `slot` | T | `slot` | — |
| 14 | `puerto` | T | `puerto` | — |
| 15 | `fat` | T | `fat` | — |
| 16 | `serial` | T | `serial` | — |
| 17 | `extra` | T | `extra` | Red / planta externa. |
| 18 | `ups` | T | `ups` | Red / planta externa. |
| 19 | `codigos_sin_gestion_en_VENAPP` | T | `codigos_sin_gestion_en_VENAPP` | — |

Las columnas de clasificación del CSV (región, estado geográfico, capital, municipio, parroquia,
estado operativo, distrito, área, central, nombre central) no se copian al maestro: se usan solo
como filtro contra `central.json` (RT-03).

---

## 4. Archivos de configuración

### 4.1 `central.json` — datos operativos de la central (RF-11, L15)

| Campo | Tipo | Dominio / ejemplo | Notas |
|---|---|---|---|
| `region` | T | — | Filtro de la matriz CSV. |
| `estado_geografico` | T | — | Filtro. |
| `capital_estado` | T | — | Filtro. |
| `municipio` | T | — | Filtro. |
| `parroquia` | T | — | Filtro. |
| `estado_operativo` | T | — | Filtro. |
| `distrito` | T | — | Filtro. |
| `area` | T | `4` | Área operativa. |
| `central` | T | — | Código de la central. |
| `nombre_central` | T | `Francisco Salias` | Nombre de la central (L1). |

### 4.2 `tecnicos.json` — padrón de trabajadores (RF-12, L16)

| Campo | Tipo | OBL | Notas |
|---|---|---|---|
| `nombre` | T | Sí | — |
| `cedula` | T | Sí | Identificación. |
| `P00` | T | No | Significado por precisar (A-11). |
| `telefono` | T | No | — |
| `correo` | T | No | — |
| `especialidad` | T | No | — |
| `status` | E | Sí | Activo / inactivo. |

### 4.3 `flota.json` — padrón de vehículos (RF-13, L17)

| Campo | Tipo | OBL | Notas |
|---|---|---|---|
| `CAN00` | T | Sí | Identificador / código de la unidad. |
| `tipo` | T | No | — |
| `marca` | T | No | — |
| `modelo` | T | No | — |
| `placa` | T | Sí | — |
| `combustible` | T | No | Corrige el typo «Combistible» del fuente. |
| `status` | E | Sí | Operativo / en mantenimiento / fuera de servicio. |
| `estado_cauchos` | T | No | — |
| `estado_fluidos` | T | No | — |
| `estado_general` | T | No | — |

### 4.4 `cuadrillas.json` — padrón de cuadrillas (RF-14, D-07)

| Campo | Tipo | OBL | Notas |
|---|---|---|---|
| `id` | T | Sí | PK; es el valor que toma `Reparador Principal`. |
| `nombre` | T | Sí | Denominación de la cuadrilla. |
| `tecnicos` | L | Sí | FK a `tecnicos.json` (uno o más). |
| `vehiculo` | T | No | FK a `flota.json` (`CAN00`). |
| `turno` | T | No | Turno de trabajo. |
| `sectores` | L | No | FK a `sectores.json`; zonas preferentes. |
| `status` | E | Sí | Activa / inactiva. |

### 4.5 `sectores.json` — catálogo de sectores (D-03)

| Campo | Tipo | OBL | Notas |
|---|---|---|---|
| `id` | T | Sí | PK; se guarda en `averias.sector` (numeración por precisar, A-04). |
| `nombre` | T | Sí | Nombre operativo del sector. |
| `vias` | L | Sí | Calles, urbanizaciones o puntos de referencia que lo componen. |
| `cuadrilla_sugerida` | T | No | FK a `cuadrillas.json`; sugerencia para el despacho. |

### 4.6 `claves_clasificacion.json` — palabras clave de clasificación (D-11, RN-03)

| Campo | Tipo | OBL | Notas |
|---|---|---|---|
| `claves` | L | Sí | Por defecto: `LOSS ROJO`, `FALLA FIBRA`, `FIBRA DAÑADA`. |
| `normalizacion` | E | Sí | `estricta` (texto literal) / `normalizada` (mayúsculas, sin tildes, variantes LOSS/LOS y DAÑADA/DANADA). Por defecto `normalizada`. |
| `campos_evaluados` | L | Sí | `ultimo_comentario`, `problema_reporte`, `informacion_1`, `informacion_2`. |

---

## 5. Relaciones entre entidades

```mermaid
erDiagram
  CENTRAL ||--o{ AVERIA : filtra
  SECTOR ||--o{ AVERIA : agrupa
  CUADRILLA ||--o{ AVERIA : "Reparador Principal"
  CUADRILLA }o--|| FLOTA : usa
  CUADRILLA }o--o{ TECNICO : integra
  CUADRILLA }o--o{ SECTOR : cubre
  AVERIA ||--o{ DESPACHO : proyecta
  ESTRUCTURA ||--o{ AVERIA : "mapea el CSV"
  CLAVES ||--o{ AVERIA : clasifica
```

| Relación | Cardinalidad | Regla |
|---|---|---|
| `central.json` → averías | 1 a N | Filtro de ingesta (RT-03). |
| `sectores.json` → `averias.sector` | 1 a N | Obligatoria; sin coincidencia se encola para asignación (RN-04). |
| `cuadrillas.json` → `averias."Reparador Principal"` | 1 a N | Definida por el despacho (RF-20). |
| `cuadrillas.tecnicos` → `tecnicos.json` | N a N | Un técnico puede integrar una cuadrilla por jornada. |
| `cuadrillas.vehiculo` → `flota.json` | 1 a 1 | Un vehículo por cuadrilla. |
| `averias.json` → `despacho.json` | 1 a N | Proyección de columnas para el trabajo de campo (RT-05). |
| `estructura.json` → ingesta | 1 a 1 | Contrato de columnas del CSV diario (D-08). |
| `claves_clasificacion.json` → `status` | 1 a 1 | Determina PEND vs. GESTION (D-05, D-11). |

---

## 6. Reglas de formato y normalización

| Tema | Regla |
|---|---|
| Fechas | `DD/MM/AAAA` en todos los archivos y en la interfaz (RNF-06). |
| Semana operativa | Lunes a sábado (RN-08). |
| Texto | Se conserva tal como llega del CSV; los typos de interfaz se corrigen solo en las etiquetas (A-06). |
| Comparación de direcciones | Mayúsculas, sin tildes, tolerante a abreviaturas ("Av.", "Cll.", "Urb."), según D-03. |
| Deduplicación | Por `id_averia`, comparación exacta de texto (RN-01). |
| Codificación de archivos | UTF-8 sin BOM para todos los JSON y para el CSV de entrada. |
| Nomenclatura de campos | Se respeta la del fuente, incluidos `Reparador Principal` (con espacio), `fechaResolucion` (camelCase) y `codigos_sin_gestion_en_VENAPP`. |

---

## 7. Pendientes de este diccionario

- A-11: significado de `P00` (TECNICOS) y de `ups` (averias).
- A-04: numeración definitiva de `sectores.id`.
- A-14: composición final de `despacho.json` (incluir o no `sector` y cuadrilla).
- Confirmar si el CSV diario trae columnas extra no declaradas en `estructura.json` (se ignorarían).
