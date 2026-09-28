# Manual técnico — Ingesta del archivo diario de averías (CSV)

> Documento técnico de implementación del módulo **INGESTA** de GGTO (CANTV C.A.,
> Central Francisco Salias, Área 4). Todas las afirmaciones se respaldan con
> referencias `ruta:línea` leídas del código y de los documentos fuente del
> repositorio. Lo no verificable se marca como **pendiente de confirmar**.

## Visión general (RF-01/RF-02, RT-05, D-04/D-27/D-41)

El módulo INGESTA recibe el archivo diario de averías GPON del sistema origen de
CANTV, lo depura, filtra los casos de la central configurada, evita duplicados y
crea los casos nuevos en la tabla `caso`. Es la puerta de entrada principal del
universo de casos de la plataforma.

| Elemento | Valor verificado | Referencia |
|---|---|---|
| Requisito de carga del archivo | RF-01 | `RepoTecnico/requerimientos.md:90` |
| Requisito de perfiles/accesos (contexto) | RF-02 | `RepoTecnico/requerimientos.md:91` |
| Procesar solo los casos de la central | RF-21 | `RepoTecnico/requerimientos.md:119` |
| Insertar solo casos nuevos | RF-22 | `RepoTecnico/requerimientos.md:120` |
| Sectorizar por dirección | RF-23 | `RepoTecnico/requerimientos.md:121` |
| Criterio de cuadrilla 0 | RF-25 | `RepoTecnico/requerimientos.md:123` |
| Requisito técnico del parser | RT-05 | `RepoTecnico/requerimientos.md:280` |
| Mapeo por posición de columna | D-04 | `RepoTecnico/estado_proyecto.md:68` |
| Depuración del CSV (21 columnas) | D-27 | `RepoTecnico/estado_proyecto.md:91` |
| Contrato de interfaz con el origen | D-41 | `RepoTecnico/estado_proyecto.md:105` |

El router del módulo vive en `app/api/routes_ingesta.py`, se declara con
`prefix="/api/v1/ingesta"` y la etiqueta `ingesta`
(`app/api/routes_ingesta.py:21`). Su docstring enumera los requisitos que cubre:
«RF-01, RF-21, RF-22, RF-23, RF-25, RF-29» (`app/api/routes_ingesta.py:1`).

La lógica de análisis y de escritura está separada de la capa HTTP:

- `app/services/ingesta.py` contiene el parser y el filtro por central
  (`app/services/ingesta.py:1-9`).
- `app/api/routes_ingesta.py` orquesta la lectura del archivo subido, el resumen,
  la creación del lote y la inserción de los casos.
- `app/services/sectorizacion.py` resuelve el sector por dirección
  (`app/services/sectorizacion.py:23`).
- `app/services/cuadrilla0.py` marca los casos que van al supervisor
  (`app/services/cuadrilla0.py:28`).
- `app/services/fallas.py` detecta fallas masivas tras la carga
  (`app/services/fallas.py:53`).

### Roles y permisos del módulo

La escritura (simular y cargar) está restringida a ADMIN y SUPERVISOR mediante
`_escritura = require_roles("ADMIN", "SUPERVISOR")`
(`app/api/routes_ingesta.py:23`). La consulta del historial de lotes usa
`get_current_user`, por lo que cualquier usuario autenticado puede leerla
(`app/api/routes_ingesta.py:178`, `app/api/routes_ingesta.py:190`). El rol TECNICO
queda en modo solo lectura para este módulo.

## Contrato del archivo origen

El contrato formal está en `RepoTecnico/interfaz_csv_origen.md` y su estado es
**borrador pendiente de firma por CANTV** (D-41): «Estado: **Borrador para
validación y firma de CANTV**» (`RepoTecnico/interfaz_csv_origen.md:9`).

### Nombre y periodicidad

| Atributo | Valor | Referencia |
|---|---|---|
| Nombre | `detalle_averias_gpon_<fecha>.csv` (la fecha varía por día) | `RepoTecnico/interfaz_csv_origen.md:27` |
| Periodicidad | Diaria (días hábiles) | `RepoTecnico/interfaz_csv_origen.md:28` |
| Hora de entrega | Antes de las 08:00 (hora de Venezuela) | `RepoTecnico/interfaz_csv_origen.md:29` |
| Fin de línea | `CRLF` | `RepoTecnico/interfaz_csv_origen.md:32` |
| Encabezado | Primera fila, obligatoria | `RepoTecnico/interfaz_csv_origen.md:33` |
| Volumen de referencia | Hasta 20 000 filas/día (SLO provisional D-33) | `RepoTecnico/interfaz_csv_origen.md:36` |

El nombre del archivo es la referencia de trazabilidad de cada carga: se guarda
en `ingesta_lote.archivo` con recorte a 255 caracteres
(`app/api/routes_ingesta.py:134`). Si el navegador no envía nombre, se usa el
literal `sin-nombre` (`app/api/routes_ingesta.py:128`).

El canal de entrega definitivo (carpeta/bucket dedicado o SFTP corporativo) está
«Por definir con CANTV» (`RepoTecnico/interfaz_csv_origen.md:67`). El
versionado del archivo en Git está **prohibido** por contener PII y `.gitignore`
excluye `detalle_averias_gpon*.csv` (`RepoTecnico/interfaz_csv_origen.md:69-72`).

### Delimitador `;`

El delimitador es el punto y coma. En el código se declara como constante
`DELIMITADOR = ";"` (`app/services/ingesta.py:20`) y se aplica al lector CSV de
la biblioteca estándar en `parsear` y `parsear_encabezado`
(`app/services/ingesta.py:175`, `app/services/ingesta.py:164`). El contrato lo
fija en `RepoTecnico/interfaz_csv_origen.md:30`.

### Codificación ISO-8859-1 → UTF-8

| Aspecto | Regla | Referencia |
|---|---|---|
| Codificación del origen | ISO-8859-1 (latin-1/cp1252), **no** UTF-8 | `RepoTecnico/interfaz_csv_origen.md:31` |
| Constante del parser | `CODIFICACION = "iso-8859-1"` | `app/services/ingesta.py:21` |
| Texto con acentos | Puede contener `ñ` y tildes; exige decodificar ISO-8859-1 antes de comparar | `RepoTecnico/interfaz_csv_origen.md:60` |

La plataforma **no transforma** el archivo de origen: lo decodifica de
ISO-8859-1 a texto Unicode en memoria (`app/services/ingesta.py:155-160`) y lo
persiste en columnas `text`/`varchar` de PostgreSQL a través de SQLAlchemy. La
codificación exacta del servidor de base de datos (`server_encoding`) es
**pendiente de confirmar**; en todo caso, el texto llega ya decodificado a la
base y las comparaciones internas se hacen sobre texto normalizado, no sobre
bytes.

### 80 columnas por posición → 49 campos destino

La plataforma depende de la **posición** de las columnas, no de su nombre, porque
el encabezado trae rótulos duplicados (`informacion` ×2 y `descripcion` ×3)
(`RepoTecnico/interfaz_csv_origen.md:35`). El parser declara
`COLUMNAS_ESPERADAS = 80` (`app/services/ingesta.py:22`) y avisa si el encabezado
no tiene ese número de columnas (`app/services/ingesta.py:183-186`).

El mapeo completo vive en la tupla `ESPECIFICACION`, con 49 entradas de la forma
`(campo_destino, índices 0-based, tipo)` (`app/services/ingesta.py:26-76`). Los
campos destino se derivan de ella con
`CAMPOS_DESTINO = tuple(campo for campo, _, _ in ESPECIFICACION)`
(`app/services/ingesta.py:78`) y la carga los usa como lista blanca de columnas a
insertar (`app/api/routes_ingesta.py:24`,
`app/api/routes_ingesta.py:148`).

#### Tipos de conversión

| Tipo | Comportamiento | Referencia |
|---|---|---|
| `str` | Recorte de espacios; vacío → `None` | `app/services/ingesta.py:139-141` |
| `fecha` | Parseo `dd/mm/aaaa hh:mm:ss a.m./p.m.` y variantes | `app/services/ingesta.py:118-136` |
| `int` | `int(float(valor))`; si falla → `None` | `app/services/ingesta.py:148-151` |
| `unir` | Concatena varias columnas con `" | "` | `app/services/ingesta.py:198-200` |
| `lista` | Lista JSON con los valores no vacíos | `app/services/ingesta.py:201-204` |

Solo dos campos son multi-columna:

- `informacion`: unifica las columnas 31, 32 y 52 del archivo, declaradas en
  0-based como `COLUMNAS_INFORMACION = (30, 31, 51)`
  (`app/services/ingesta.py:23`, `app/services/ingesta.py:50`).
- `ayudantes`: toma las nueve columnas 66–74 del archivo, declaradas como
  `tuple(range(65, 74))` (`app/services/ingesta.py:69`), y se persiste en una
  columna JSONB (`app/models/caso_entities.py:110`).

#### Aritmética del mapeo

La suma de columnas es coherente con el contrato: 47 campos provienen de una sola
columna, `informacion` consume 3 columnas y `ayudantes` consume 9, es decir
47 + 3 + 9 = **59 columnas usadas**, y 80 − 59 = **21 columnas descartadas**. La
cobertura se verifica además con la prueba
`test_especificacion_cubre_49_campos` (`app/tests/test_ingesta_parser.py:51-53`).

### 21 columnas descartadas

Las columnas que la plataforma ignora están enumeradas en el contrato
(`RepoTecnico/interfaz_csv_origen.md:45-50`) y ratificadas por la decisión D-27
(`RepoTecnico/estado_proyecto.md:91`):

| # | Columna descartada | # | Columna descartada |
|---|---|---|---|
| 1 | `tipo_reporte` (12) | 12 | `dias transcurrido desde la apertura` (48) |
| 2 | `dac` (13) | 13 | `area_resolutoria` (49) |
| 3 | `ultimo_usuario` (20) | 14 | `usuario_acciona` (53) |
| 4 | `fecha_despacho` (25) | 15 | `fecha_acciona` (54) |
| 5 | `ciudad` (26) | 16 | `codigo_causa` (56) |
| 6 | `servicio_off_on` (29) | 17 | `descripcion` (57) |
| 7 | `cliente_notificado` (30) | 18 | `Subcodigo_causa` (58) |
| 8 | `fecha_instalacion` (35) | 19 | `descripcion` (59) |
| 9 | `ip` (37) | 20 | `con_serv_aba` (60) |
| 10 | `tarjeta` (38) | 21 | `descripcion` unificada (52) |
| 11 | `ont_id` (42) | | |

> Nota: la columna 52 (`descripcion`) no se «descarta» en sentido estricto, sino
> que se **unifica** dentro de `informacion` junto con las columnas 31 y 32
> (`RepoTecnico/interfaz_csv_origen.md:51`,
> `app/services/ingesta.py:23`). La decisión D-27 también dejó de poblar el
> catálogo `causa` desde el CSV: ahora es administrable
> (`RepoTecnico/estado_proyecto.md:91`).

## Parser

El parser es puro: no toca la base de datos (su docstring devuelve «filas mapeadas
y avisos», `app/services/ingesta.py:171-172`), lo que permite probarlo de forma
unitaria y usarlo igual en la simulación y en la carga real.

### Decodificación estricta (nunca `errors='ignore'`)

`decodificar` intenta `contenido.decode("iso-8859-1")` y, ante un
`UnicodeDecodeError`, lanza `ValueError` con un mensaje explícito en lugar de
silenciar el problema (`app/services/ingesta.py:155-160`). El contrato exige ese
comportamiento: «Codificación inesperada → Falla ruidosa, sin ingesta parcial»
(`RepoTecnico/interfaz_csv_origen.md:89`).

En la práctica ISO-8859-1 mapea los 256 valores de byte, por lo que la excepción
está marcada como no alcanzable (`# pragma: no cover - latin-1 no falla`,
`app/services/ingesta.py:159`). El punto relevante para el mantenimiento es que
**no** se usa `errors='ignore'`: un archivo mal codificado no pierde caracteres en
silencio. Antes de procesar, se elimina un posible BOM inicial con
`texto.lstrip("\ufeff")` (`app/services/ingesta.py:174`).

### Fechas `dd/mm/aaaa hh:mm:ss a.m./p.m.`

El formato de fecha del origen es `dd/mm/aaaa hh:mm:ss a.m./p.m.`, con zona
`America/Caracas` según el contrato (`RepoTecnico/interfaz_csv_origen.md:57`). El
parser normaliza primero las variantes de meridiano y luego prueba una lista de
formatos:

1. `_normalizar_fecha` sustituye `a. m.`, `p. m.`, `a.m.`, `p.m.` y sus variantes
   sin punto por `AM`/`PM`, colapsa espacios y pasa a mayúsculas
   (`app/services/ingesta.py:106-115`).
2. `parse_fecha` recorre siete formatos: con y sin segundos, con y sin meridiano,
   solo fecha y el formato ISO `aaaa-mm-dd` (`app/services/ingesta.py:123-131`).
3. Si ninguno coincide, devuelve `None` sin lanzar error
   (`app/services/ingesta.py:136`).

Las pruebas unitarias verifican `17/07/2026 11:38:20 a.m.`,
`10/09/2026 12:00:13 p.m.`, `22/08/2026 10:00:00 a. m.`, `01/01/2026` y
`2026-01-01 08:00:00` (`app/tests/test_ingesta_parser.py:30-35`), además de los
casos vacíos o inválidos (`app/tests/test_ingesta_parser.py:38-42`).

> Detalle de implementación: `parse_fecha` devuelve un `datetime` **naive** (sin
> `tzinfo`). Las columnas del modelo son `DateTime(timezone=True)`
> (`app/models/caso_entities.py:76`), de modo que la interpretación horaria final
> depende de la zona de la sesión de PostgreSQL. La conversión exacta a
> `America/Caracas` es **pendiente de confirmar**.

### Normalización de acentos y recorte defensivo

`normalizar` pasa el texto a mayúsculas, aplica normalización Unicode NFKD, elimina
los diacríticos y colapsa espacios repetidos
(`app/services/ingesta.py:99-103`). Se usa para comparar el código de central y
los patrones de sector sin depender de tildes ni mayúsculas; la prueba
`test_normalizar_quita_acentos_y_mayusculas` fija el comportamiento esperado
(`app/tests/test_ingesta_parser.py:45-48`).

El recorte defensivo evita que un valor inesperadamente largo aborte la ingesta
completa:

- `LIMITES` define la longitud máxima de los campos de texto
  (`app/services/ingesta.py:82-94`).
- Al convertir un `str`, si excede el límite se recorta y se incrementa el
  contador de recortes (`app/services/ingesta.py:208-211`).
- Los campos `text` de PostgreSQL (por ejemplo `direccion` o
  `ultimo_comentario`) no están en `LIMITES` y no se recortan, lo que se verifica
  con `test_campos_de_texto_no_se_recortan`
  (`app/tests/test_ingesta_parser.py:131-135`).

El parser también descarta defensivamente:

- Filas completamente vacías (`app/services/ingesta.py:192-193`).
- Filas cuyo número de celdas difiere de 80, contadas como malformadas
  (`app/services/ingesta.py:194-195`).
- Filas sin `id_averia`, que no se pueden deduplicar
  (`app/services/ingesta.py:213-215`).

Los avisos resultantes se acumulan en una lista que acompaña al resumen
(`app/services/ingesta.py:218-223`).

## Flujo de carga

El análisis se centraliza en `_analizar`, que devuelve el resumen, las filas
candidatas, la central, los patrones y la configuración
(`app/api/routes_ingesta.py:40-99`). Ambos endpoints de escritura comparten ese
método, de modo que la simulación y la carga real aplican exactamente las mismas
reglas.

### Preview

`POST /api/v1/ingesta/preview` lee el archivo, ejecuta `_analizar` y devuelve el
resumen **sin escribir en la base de datos**
(`app/api/routes_ingesta.py:105-116`). El endpoint fija el nombre del archivo en
el resumen (`app/api/routes_ingesta.py:114`). La prueba
`test_preview_no_guarda` comprueba que no se crea ningún caso y que `id_lote` es
`None` (`app/tests/test_ingesta_api.py:43-54`).

### Carga y creación de `ingesta_lote`

`POST /api/v1/ingesta` responde `201 Created`
(`app/api/routes_ingesta.py:119-120`). La secuencia es:

1. Se analiza el archivo (`app/api/routes_ingesta.py:130`).
2. Se crea el lote con `estado="PROCESANDO"` y el P00 del usuario
   (`app/api/routes_ingesta.py:133-144`).
3. `db.flush()` obtiene el `id_lote` antes de insertar los casos
   (`app/api/routes_ingesta.py:145`).
4. Por cada fila candidata se construye un `Caso` con las 49 columnas de la
   especificación, la central, el lote, el sector, la marca de cuadrilla 0, el
   origen `INGESTA_CSV` y el P00 de quien carga
   (`app/api/routes_ingesta.py:147-156`).
5. El lote pasa a `OK` y sus avisos se guardan en `detalle_error`, unidos por
   `"; "` (`app/api/routes_ingesta.py:158-159`).
6. Se confirma la transacción (`app/api/routes_ingesta.py:160`).

### Filtro por central

`filtrar_por_central` conserva solo las filas cuyo `codigo_central` coincide con
la central objetivo tras normalizar ambos textos
(`app/services/ingesta.py:227-230`). La central se resuelve con
`resolver_central`: si el formulario no envía `id_central`, se usa la clave de
configuración `ingesta.central_codigo` y, si no existe, el literal `"2324X"`
(`app/services/consultas.py:20-29`). Si la central no existe, se responde `404`
con «Central no encontrada o no configurada»
(`app/services/consultas.py:27-28`).

La muestra de referencia trae 56 filas de tres centrales; el filtro deja 51 de la
central `2324X` y descarta 5, según
`test_filtrar_por_central` (`app/tests/test_ingesta_parser.py:85-92`) y las
constantes `FILAS_CENTRAL = 51` / `FILAS_DESCARTADAS = 5`
(`app/tests/test_ingesta_api.py:19-20`).

### Deduplicación por `id_averia`

La deduplicación ocurre en dos niveles:

1. **Dentro del propio archivo:** un conjunto `vistos` descarta las repeticiones
   de `id_averia` y las cuenta en `repetidos_archivo`
   (`app/api/routes_ingesta.py:50-59`).
2. **Contra la base de datos:** `_existentes` consulta los `id_averia` ya
   presentes en `caso`, en lotes de 1000 para no construir una cláusula `IN`
   gigantesca (`TAMANO_LOTE_CONSULTA = 1000`, `app/api/routes_ingesta.py:25`,
   `app/api/routes_ingesta.py:31-37`).

Las filas que no existen en la base son las candidatas
(`app/api/routes_ingesta.py:61-63`). La unicidad de `id_averia` está reforzada en
la base con `UNIQUE` (`RepoTecnico/db/schema.sql:290`,
`app/models/caso_entities.py:50`). La prueba
`test_ingesta_inserta_y_deduplica` carga el mismo archivo dos veces: la segunda
carga inserta 0 casos nuevos y reporta 51 duplicados
(`app/tests/test_ingesta_api.py:57-73`).

### Sectorización

Cada candidata se sectoriza con `asignar_sector`, que compara la `direccion`
contra los patrones activos de los sectores de la central
(`app/api/routes_ingesta.py:80`, `app/services/sectorizacion.py:23`). El
algoritmo:

- Ordena los patrones por longitud descendente para que el más específico gane
  (`app/services/sectorizacion.py:33`).
- Acepta coincidencias `CONTIENE` (por defecto), `EXACTO` y `REGEX`
  (`app/services/sectorizacion.py:15`, `app/services/sectorizacion.py:40-57`).
- Puede aplicar normalización de acentos al patrón y al texto
  (`app/services/sectorizacion.py:19-20`).

Los patrones los aporta `cargar_patrones`, que solo devuelve datos de sectores
activos y patrones activos, ordenados por prioridad y nombre
(`app/services/consultas.py:32-42`). El resultado se guarda en `caso.id_sector`
y se contabiliza en el resumen como `sectorizados` o `sin_sector`
(`app/api/routes_ingesta.py:83-86`).

### Criterio de cuadrilla 0

`cuadrilla0.evaluar` decide si un caso va al supervisor sin salir a calle
(`app/services/cuadrilla0.py:28-46`). Combina tres fuentes configurables:

| Clave de configuración | Uso | Referencia |
|---|---|---|
| `despacho.columnas_evaluar` | Columnas de texto a evaluar | `app/services/cuadrilla0.py:31` |
| `despacho.frases_campo` | Frases que indican que sí amerita campo | `app/services/cuadrilla0.py:32` |
| `despacho.frases_supervisor` | Frases de no-atención en casa | `app/services/cuadrilla0.py:33-35` |
| `despacho.criterio_cuadrilla0` | Modo `CAMPO` / `SUPERVISOR` / `UNION` | `app/services/cuadrilla0.py:36` |

El valor por defecto del código es `UNION`
(`app/services/cuadrilla0.py:15`), pero la decisión D-59 dejó el parámetro
sembrado en **`SUPERVISOR`**: «solo van al supervisor los casos con frases de
no-atención en casa; el resto vuelve a estar disponible para el despacho de
calle» (`RepoTecnico/estado_proyecto.md:116`). El modo efectivo en producción es,
por tanto, el valor de la tabla `configuracion`, no el defecto del módulo.

La marca se persiste en `caso.en_gestion_supervisor`
(`app/api/routes_ingesta.py:152`), que además alimenta el icono «Gestión» del
listado de casos (`app/api/routes_casos.py:69`).

### Detección de fallas tras la ingesta

Tras confirmar los casos, la carga invoca `fallas.detectar(db, id_central)`
(`app/api/routes_ingesta.py:162-163`). Si se crean fallas masivas, se confirma
otra vez y se informa el conteo en `fallas_masivas`
(`app/api/routes_ingesta.py:164-166`). La detección agrupa casos no cerrados por
el campo configurado y aplica umbral y ventana:

- `fallas.activo` habilita o deshabilita la detección
  (`app/services/fallas.py:55-57`).
- `fallas.umbral_casos` (por defecto 5) y `fallas.ventana_horas` (por defecto 24)
  (`app/services/fallas.py:15-16`, `app/services/fallas.py:59-60`).
- `fallas.campo_concentracion` admite `olt`, `fat` o `id_sector`
  (`app/services/fallas.py:14`, `app/services/fallas.py:61-63`).

Es idempotente por la clave de concentración, según el apartado 3.1 de
`RepoTecnico/entornos_globales.md:204-206`.

## Endpoints

Los cuatro endpoints del módulo se declaran bajo el prefijo `/api/v1/ingesta`
(`app/api/routes_ingesta.py:21`).

### `POST /api/v1/ingesta/preview`

| Atributo | Valor |
|---|---|
| Referencia | `app/api/routes_ingesta.py:105` |
| Autenticación | Token JWT; rol ADMIN o SUPERVISOR (`app/api/routes_ingesta.py:110`) |
| Cuerpo | `multipart/form-data` con `archivo` (obligatorio) e `id_central` (opcional) (`app/api/routes_ingesta.py:107-108`) |
| Respuesta | `ResumenIngesta` (`app/api/routes_ingesta.py:115-116`) |
| Efecto en base | Ninguno (simulación) |

#### Contrato de la respuesta

Los campos son los de `ResumenIngesta`: contadores de filas leídas, de la central,
casos nuevos, duplicados y descartados, sectorizados, sin sector, cuadrilla 0,
avisos y hasta diez ejemplos
(`app/schemas/ingesta.py:17-30`, `app/api/routes_ingesta.py:90-98`).

### `POST /api/v1/ingesta`

| Atributo | Valor |
|---|---|
| Referencia | `app/api/routes_ingesta.py:119` |
| Autenticación | Token JWT; rol ADMIN o SUPERVISOR (`app/api/routes_ingesta.py:125`) |
| Cuerpo | `multipart/form-data` con `archivo` e `id_central` (`app/api/routes_ingesta.py:122-123`) |
| Respuesta | `ResumenIngesta` con `id_lote` y `fallas_masivas` (`app/api/routes_ingesta.py:168-172`) |
| Código de éxito | `201 Created` (`app/api/routes_ingesta.py:119`) |
| Efecto en base | Crea `ingesta_lote` y los casos nuevos |

#### Errores esperados

- `401` sin token (`app/tests/test_ingesta_api.py:32-35`).
- `403` para el rol TECNICO (`app/tests/test_ingesta_api.py:38-40`).
- `404` si la central indicada no existe
  (`app/services/consultas.py:27-28`).

### `GET /api/v1/ingesta/lotes`

Devuelve el historial de cargas, más recientes primero
(`order_by(IngestaLote.id_lote.desc())`), con un límite por consulta de 50 por
defecto y máximo 200 (`app/api/routes_ingesta.py:175-185`). Usa
`get_current_user`, por lo que cualquier usuario autenticado puede consultarlo
(`app/api/routes_ingesta.py:178`).

### `GET /api/v1/ingesta/lotes/{id_lote}`

Devuelve el detalle de un lote; si no existe responde `404` con «Lote no
encontrado» (`app/api/routes_ingesta.py:188-195`).

#### Esquema de salida

`IngestaLoteOut` expone `id_lote`, `archivo`, `fecha_archivo`, `id_central`, los
cinco contadores, `estado`, `detalle_error`, `usuario` y `creado_en`
(`app/schemas/ingesta.py:33-48`).

## Esquemas y modelo `ingesta_lote`

### Esquemas Pydantic (`app/schemas/ingesta.py`)

| Esquema | Uso | Referencia |
|---|---|---|
| `EjemploCaso` | Muestra de hasta diez casos candidatos | `app/schemas/ingesta.py:10-14` |
| `ResumenIngesta` | Respuesta de preview y de carga | `app/schemas/ingesta.py:17-30` |
| `IngestaLoteOut` | Historial y detalle de lotes | `app/schemas/ingesta.py:33-48` |

`IngestaLoteOut` usa `ConfigDict(from_attributes=True)` para validar directamente
desde el objeto ORM (`app/schemas/ingesta.py:34`). `ResumenIngesta` inicializa
`id_lote` en `None` y `fallas_masivas` en 0, de modo que el preview los devuelve
vacíos (`app/schemas/ingesta.py:29-30`).

### Modelo SQLAlchemy y DDL

El modelo `IngestaLote` se declara sobre la tabla `ingesta_lote`
(`app/models/caso_entities.py:23-38`). El DDL correspondiente está en
`RepoTecnico/db/schema.sql:267-282`:

| Columna | Tipo DDL | Nota |
|---|---|---|
| `id_lote` | `bigserial` | Clave primaria |
| `archivo` | `varchar(255)` | Nombre del archivo cargado |
| `fecha_archivo` | `date` | Precisión de día |
| `id_central` | `integer` | FK a `central(id_central)` |
| `filas_leidas` | `integer` | Total de filas del archivo |
| `filas_central` | `integer` | Filas de la central configurada |
| `casos_nuevos` | `integer` | Casos insertados |
| `casos_duplicados` | `integer` | Ya existentes o repetidos en el archivo |
| `casos_descartados` | `integer` | Otras centrales |
| `estado` | `varchar(20)` | `CHECK (estado IN ('PROCESANDO','OK','ERROR'))` (`RepoTecnico/db/schema.sql:277-278`) |
| `detalle_error` | `text` | Avisos del parser unidos por `"; "` |
| `usuario` | `varchar(20)` | P00 que ejecutó la carga |
| `creado_en` | `timestamptz` | `DEFAULT now()` |

### Correspondencia entre esquema y tabla

Hay dos matices verificables que conviene conocer al mantener el módulo:

1. **Tipo de `fecha_archivo`:** el DDL la declara `date`
   (`RepoTecnico/db/schema.sql:270`) mientras el modelo y el esquema Pydantic la
   exponen como `datetime`
   (`app/models/caso_entities.py:28`, `app/schemas/ingesta.py:38`). El valor que
   llega al cliente tiene, por tanto, resolución de día.
2. **Origen del valor:** la carga nunca asigna `fecha_archivo` al construir el
   `IngestaLote` (`app/api/routes_ingesta.py:133-143`), por lo que queda nula
   salvo que se complete por otra vía. En la interfaz se muestra como «—»
   (`app/web/src/pages/Ingesta.tsx:275`).

El estado `ERROR` existe en el `CHECK` del DDL
(`RepoTecnico/db/schema.sql:278`) pero la ruta de carga no lo utiliza: el lote
pasa de `PROCESANDO` a `OK` (`app/api/routes_ingesta.py:141`,
`app/api/routes_ingesta.py:158`). El uso de `ERROR` está **pendiente de
confirmar**.

## Página web INGESTA

La vista está en `app/web/src/pages/Ingesta.tsx` y consume el cliente API de
`app/web/src/api/client.ts`.

### Estructura y permisos

El componente consulta `useAuth()` para conocer `soloLectura`
(`app/web/src/pages/Ingesta.tsx:20`). Si el rol es de solo lectura, oculta el
formulario de carga y muestra el aviso «Modo solo lectura: su rol TECNICO no
permite simular ni cargar archivos»
(`app/web/src/pages/Ingesta.tsx:148-154`).

### Simulación y carga

- El campo de archivo acepta `.csv,text/csv`
  (`app/web/src/pages/Ingesta.tsx:164`).
- El campo «ID de central» acepta vacío (central configurada) o un entero
  positivo, validado por `parsearCentral`
  (`app/web/src/pages/Ingesta.tsx:9-17`,
  `app/web/src/pages/Ingesta.tsx:169-177`).
- «Simular (preview)» llama a `api.previewIngesta`
  (`app/web/src/pages/Ingesta.tsx:69`), que hace `POST /ingesta/preview`
  (`app/web/src/api/client.ts:477-479`).
- «Cargar archivo» pide confirmación explícita con `window.confirm` y luego llama
  a `api.cargarIngesta` (`app/web/src/pages/Ingesta.tsx:84-93`), que hace
  `POST /ingesta` (`app/web/src/api/client.ts:482-484`).

### Resumen, avisos y ejemplos

Tras la operación se muestran ocho tarjetas: filas leídas, filas de la central,
casos nuevos, duplicados, descartados, sectorizados, sin sector y cuadrilla 0
(`app/web/src/pages/Ingesta.tsx:123-134`). Los avisos del parser se muestran como
mensajes de error (`app/web/src/pages/Ingesta.tsx:221-227`) y los ejemplos en una
tabla con ID de avería, dirección, sector y marca de cuadrilla 0
(`app/web/src/pages/Ingesta.tsx:231-257`).

### Historial y detalle de lotes

La tabla de historial pide los últimos 50 lotes al montar el componente
(`app/web/src/pages/Ingesta.tsx:35`) y muestra trece columnas, entre ellas el
archivo, la central, los contadores, el estado y el usuario
(`app/web/src/pages/Ingesta.tsx:340-356`). El botón «Ver detalle» consulta
`GET /ingesta/lotes/{id_lote}` (`app/web/src/pages/Ingesta.tsx:110-121`,
`app/web/src/api/client.ts:491-493`) y presenta una ficha con el estado, los
contadores y el detalle de error (`app/web/src/pages/Ingesta.tsx:259-324`).

## Datos reales cargados en producción (42 casos, D-54)

### Hecho verificado

La decisión D-54 registra que «el Super Usuario cargó
`detalle_averias_gpon 15_09_2026.csv` (47 filas → **42 casos**, 5 descartadas) el
2026-09-27», que la ingesta funcionó y que esos casos no se tocaron en las
limpiezas (`RepoTecnico/estado_proyecto.md:121`).

### Implicaciones de seguridad y privacidad

Los 42 casos contienen **PII de suscriptores** y el servicio de Cloud Run estaba
accesible de forma pública; la propia decisión advierte que «urge restringir el
acceso y habilitar respaldo» (`RepoTecnico/estado_proyecto.md:121`). El informe
de Fase 4 lista entre los pendientes que no bloquean la fase el «acceso público
del servicio con PII real, que debe restringirse antes de operar en producción»
(`RepoTecnico/pruebas/informe_fase4.md:109-113`). La ingesta, por su parte, deja
los avisos del parser en `detalle_error`, sin incluir valores de datos personales
(`app/api/routes_ingesta.py:159`).

### Recalculo posterior

La decisión D-59 recalculó la marca de cuadrilla 0 de los casos reales: 36
pasaron a «Pendiente» y 6 permanecieron en «Gestión», y la propuesta de despacho
pasó de 0 a 36 casos (`RepoTecnico/estado_proyecto.md:116`). Esto confirma que la
marca `en_gestion_supervisor` es un dato operativo revisable y no un valor
inmutable fijado por la ingesta.

## Pruebas

### `test_ingesta_parser.py` (12 pruebas)

Nivel unitario, sin base de datos (`app/tests/test_ingesta_parser.py:1`). El
informe de Fase 4 lo registra con 12 pruebas y ámbito «Parser ISO-8859-1 de 80
columnas y fechas `a.m./p.m.`» (`RepoTecnico/pruebas/informe_fase4.md:80`). Cubre:

| Prueba | Qué verifica | Referencia |
|---|---|---|
| `test_parse_fecha_formatos` | Formatos de fecha válidos | `app/tests/test_ingesta_parser.py:30-35` |
| `test_parse_fecha_vacia_o_invalida` | Vacíos e inválidos → `None` | `app/tests/test_ingesta_parser.py:38-42` |
| `test_normalizar_quita_acentos_y_mayusculas` | Normalización de texto | `app/tests/test_ingesta_parser.py:45-48` |
| `test_especificacion_cubre_49_campos` | 49 campos únicos | `app/tests/test_ingesta_parser.py:51-53` |
| `test_encabezado_tiene_80_columnas` | Encabezado de la muestra | `app/tests/test_ingesta_parser.py:56-58` |
| `test_parsear_muestra_completa` | 56 filas y campos clave | `app/tests/test_ingesta_parser.py:61-75` |
| `test_parsear_decodifica_iso8859` | Acentos ISO-8859-1 | `app/tests/test_ingesta_parser.py:78-82` |
| `test_filtrar_por_central` | 51 de 56 filas | `app/tests/test_ingesta_parser.py:85-92` |
| `test_archivo_vacio` | Archivo vacío con aviso | `app/tests/test_ingesta_parser.py:95-98` |
| `test_archivo_con_encabezado_incorrecto` | Encabezado de 3 columnas | `app/tests/test_ingesta_parser.py:101-104` |
| `test_valores_largos_se_recortan_sin_abortar` | Recorte a 120 y 80 | `app/tests/test_ingesta_parser.py:122-128` |
| `test_campos_de_texto_no_se_recortan` | Campos `text` sin límite | `app/tests/test_ingesta_parser.py:131-135` |

La muestra usada está en `RepoTecnico/muestras/detalle_averias_gpon_EJEMPLO.csv`
(`app/tests/test_ingesta_parser.py:18-23`), y el `.gitignore` la mantiene
versionada por ser pseudonimizada
(`RepoTecnico/interfaz_csv_origen.md:69-72`).

### `test_ingesta_api.py` (6 pruebas)

Nivel de integración; el informe de Fase 4 lo registra con 6 pruebas y ámbito
«Preview, carga, filtro por central y deduplicación»
(`RepoTecnico/pruebas/informe_fase4.md:83`). Cubre:

| Prueba | Qué verifica | Referencia |
|---|---|---|
| `test_ingesta_sin_token` | `401` sin credenciales | `app/tests/test_ingesta_api.py:32-35` |
| `test_ingesta_tecnico_no_puede` | `403` para TECNICO | `app/tests/test_ingesta_api.py:38-40` |
| `test_preview_no_guarda` | Preview sin escritura | `app/tests/test_ingesta_api.py:43-54` |
| `test_ingesta_inserta_y_deduplica` | Carga y segunda carga duplicada | `app/tests/test_ingesta_api.py:57-73` |
| `test_ingesta_registra_el_lote` | Historial y detalle del lote | `app/tests/test_ingesta_api.py:76-89` |
| `test_sectorizacion_y_cuadrilla0` | Sectorización y marca persistida | `app/tests/test_ingesta_api.py:92-131` |

### Trazabilidad

| Requisito | Nivel de prueba | Referencia |
|---|---|---|
| RF-01/RF-02 (ingesta CSV) | Integración + E2E-07 | `RepoTecnico/pruebas/plan_pruebas.md:84`, `RepoTecnico/pruebas/plan_pruebas.md:72` |
| RF-21 (filtro por central) | `test_ingesta_parser.py`, `test_ingesta_api.py` | `RepoTecnico/requerimientos.md:119` |
| RF-22 (deduplicación) | `test_ingesta_inserta_y_deduplica` | `app/tests/test_ingesta_api.py:57` |
| RT-05 (parser) | `test_ingesta_parser.py` | `RepoTecnico/requerimientos.md:280` |

El E2E de ingesta (`07-ingesta.spec.js`, 2 pruebas) cubre «Previsualización del
CSV diario e historial de lotes» (`RepoTecnico/pruebas/informe_fase4.md:61`). El
resultado global de Fase 4 fue 169/169 en `pytest` y 46/46 en Playwright
(`RepoTecnico/pruebas/informe_fase4.md:18-19`).
