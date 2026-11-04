# Incremento D-168 — identidad técnica de 5 campos en las masivas (OLT/SLOT/PUERTO/FAT/EXTRA) y umbral 3

| | |
|---|---|
| **Fecha** | 2026-11-03 |
| **Petición** | «Optimiza la creación automática de averías masivas; los casos asociados a una masiva deben poseer los datos técnicos (OLT, SLOT, PUERTO, FAT, EXTRA) idénticos para corroborar que pertenecen al mismo FAT; al cerrar la masiva se debe cerrar solo los casos asociados a ella; si existen 3 o más casos con las mismas características técnicas se crea una masiva automáticamente». |
| **Base** | D-31 (RF-09 detección por concentración), D-75 (RUTA en la columna EXTRA), D-82 (reporte de campo), D-99 (asociación explícita `falla_masiva_caso`, cierre en cascada RF-58…RF-62), D-118 (tupla OLT + slot + puerto + FAT). |

## Concepto

La identidad técnica de una masiva pasa de **4** (OLT + slot + puerto + FAT,
D-118) a **5** campos: **OLT + SLOT + PUERTO + FAT + EXTRA** — el EXTRA del
archivo de ingesta es donde viaja la **ruta** del FAT, y es el quinto dato que
los casos deben compartir para corroborar que pertenecen a un mismo FAT. Con
la identidad completa, el umbral de creación automática baja de **5** a **3**
casos idénticos.

## Cambio

* **Modelo** (`FallaMasiva`): columna nueva `extra varchar(120)`. `schema.sql`
  la añade al `CREATE TABLE` y con `ALTER TABLE … ADD COLUMN IF NOT EXISTS`
  (idempotente).
* **Detección** (`services/fallas.py` · RF-09): agrupa por los 5 campos
  normalizados (`lower(trim())`), **exige** los 5 no vacíos y el umbral
  `fallas.umbral_casos` por defecto pasa a **3**; el caso representativo aporta
  también el `extra` de la masiva y la descripción menciona el EXTRA. Se
  elimina la constante muerta `CAMPOS_VALIDOS`. La detección sigue
  **idempotente** (clave `fat:{fat}` y verificación de masiva viva con la
  misma tupla) y corre tras cada ingesta (RF-09). El seed de `schema.sql`
  crea `'3'::jsonb`; la migración actualiza la fila ya existente.
* **Pertenencia** (`services/masivas.py`): `coincide()` y `_condicion_tupla()`
  comparan los **5** campos cuando la masiva trae la identidad completa;
  compatibilidad hacia atrás por decisión conservadora:
  - masiva **sin** `extra` (creadas antes de D-168) → se comparan los 4
    (OLT + slot + puerto + FAT) para no romper la asociación/cierre de datos
    históricos;
  - masiva sin tupla (antes de D-118) → se comparan los campos que tenga
    (FAT, luego OLT), como ya operaba.
* **Cierre** (`cerrar()` · RF-61/RF-62): ahora comprueba la identidad de
  **5** campos; sigue cerrando **solo los casos asociados** de
  `falla_masiva_caso` (nunca la cuadrilla completa) y **omite** (OMITIDO con
  motivo visible) todo vinculado cuyo EXTRA no coincide.
* **Asociación** (`asociar()`/endpoint `POST …/casos`): con identidad
  completa, un caso cuya ruta (EXTRA) difiere se **rechaza**
  («no coincide con OLT/slot/puerto/FAT/EXTRA», 409). En las dos vías de alta
  (manual y reporte de campo) la masiva nace con el `extra` recibido.
* **Buscador de casos** (`routes_alertas.py`): el buscador de casos
  candidatos (`GET /fallas-masivas/casos-candidatos`) admite el parámetro
  **opcional** `extra` (lo exige idéntico cuando viene) y reporta el EXTRA de
  cada candidato; los esquemas (`schemas/alertas.py`) lo incorporan en
  `FallaMasivaManual`/`FallaMasivaCampo` (opcional, máx. 120),
  `FallaMasivaOut` y `CasoCandidatoOut`.
* **Web**: tipos TS (`types.ts`), campo EXTRA **opcional** en el alta manual
  de MASIVAS (con búsqueda de candidatos por ruta) y columna EXTRA en la
  tabla de candidatos. La APK no cambia: el EXTRA es opcional en el reporte
  de campo.
* **Migración** `scripts/migrar_d168_masivas_fat_extra.py` (patrón D-166,
  simulación por defecto, `--aplicar`/`--si`, una transacción): añade la
  columna, **backfill conservador** del EXTRA (solo cuando la masiva viva no
  tiene y **todos** sus casos asociados comparten un único EXTRA no vacío) y
  actualiza `fallas.umbral_casos` 5 → 3 con descripción nueva. Bitácora en
  `RepoTecnico/BaseOperaciones/migracion_d168.log`.

## Reglas nuevas (resumen)

| Regla | |
|---|---|
| **Identidad técnica** | OLT + SLOT + PUERTO + FAT + EXTRA, normalizados (sin espacios ni mayúsculas), **todos exigidos y no vacíos**. |
| **Umbral** | **3** o más casos abiertos con la identidad idéntica (ventana `fallas.ventana_horas`, 24 h) → masiva automática. |
| **Pertenencia** | `coincide()`: los 5 campos idénticos; legacy 4 campos si la masiva no trae EXTRA. |
| **Cierre** | Solo los casos con vínculo en `falla_masiva_caso`; de esos, se omite el que no coincida con la identidad; nunca la cuadrilla ni otra masiva. |

## Verificación

* `test_d168_masivas_fat_extra.py`: **7 pruebas** — 3 casos → masiva con los 5
  campos; 2 casos → nada; EXTRA distinto no agrupa (y solo asociar a los del
  EXTRA propio); casos sin EXTRA no agrupan; asociar rechaza EXTRA distinto
  (409); CASOS ASOCIADOS reportan el EXTRA; el cierre omite el vinculado de
  otro EXTRA y **no toca** el caso idéntico no asociado; detección idempotente.
* `test_alertas_api.py` y `test_d99_masivas.py`: adaptados al 5.º campo
  (fixture con EXTRA); en verde junto con el archivo nuevo en el arnés de
  PostgreSQL temporal.
* **Suite completa: 657 passed** (una única falla en la primera pasada, una
  regresión temprana de D-167 en el texto libre del listado — D-72 —,
  corregida y re-verificada).
* `ruff` y `mypy` limpios; web `tsc` + `vite build` en verde (11,1 s).
