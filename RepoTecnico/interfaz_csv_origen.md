# Contrato de Interfaz — Archivo de Averías GPON (sistema origen CANTV)

| Campo | Valor |
|---|---|
| Documento | Contrato de interfaz de datos (entrega del archivo diario de averías) |
| Emisor | **Sistema origen CANTV** (sistema interno de gestión de averías) — *responsable por designar* |
| Receptor | **Plataforma GGTO** — Central Francisco Salias (Área 4) |
| Proyecto | GGTO · GCP `ggtov2` · PostgreSQL |
| Estado | **Borrador para validación y firma de CANTV** (D-41) |
| Fecha | 2026-09-25 |

> Este contrato fija el formato y las condiciones de entrega del archivo `detalle_averias_gpon_<fecha>.csv`.
> La plataforma **no transforma** el archivo de origen: lo consume tal cual y aplica depuración según
> `diccionario_datos.md` §3.2.

---

## 1. Objeto

Definir el formato, la periodicidad, el canal de entrega y las responsabilidades de la entrega diaria del
archivo matriz de averías GPON que alimenta la ingesta de la plataforma GGTO.

## 2. Archivo y periodicidad

| Atributo | Valor |
|---|---|
| Nombre | `detalle_averias_gpon_<fecha>.csv` (la fecha varía por día) |
| Periodicidad | **Diaria** (días hábiles) |
| Hora de entrega | **Antes de las 08:00** (hora de Venezuela) |
| Delimitador | `;` (punto y coma) |
| Codificación | **ISO-8859-1 (latin-1/cp1252)** — *no UTF-8* |
| Fin de línea | `CRLF` |
| Encabezado | Primera fila, obligatoria |
| Columnas | **80**, mapeadas **por posición** |
| Encabezados duplicados | Sí: `informacion` ×2 (cols. 31–32) y `descripcion` ×3 (cols. 52, 57, 59) |
| Volumen de referencia | Hasta 20 000 filas/día (SLO provisional D-33) |

> ⚠️ **La plataforma depende de la POSICIÓN de las columnas, no de su nombre.** Cualquier cambio de
> orden, inserción o eliminación de columnas **rompe la ingesta** y requiere una nueva versión de este
> contrato.

## 3. Columnas utilizadas y descartadas

- **Se conservan 59 columnas** y se mapean a **49 campos destino** (ver `diccionario_datos.md` §3.2).
- **Se descartan 21 columnas** (D-27): `tipo_reporte` (12), `dac` (13), `ultimo_usuario` (20),
  `fecha_despacho` (25), `ciudad` (26), `servicio_off_on` (29), `cliente_notificado` (30),
  `fecha_instalacion` (35), `ip` (37), `tarjeta` (38), `ont_id` (42), `cvlan` (45),
  `dias transcurrido desde la apertura` (48), `area_resolutoria` (49), `usuario_acciona` (53),
  `fecha_acciona` (54), `codigo_causa` (56), `descripcion` (57), `Subcodigo_causa` (58),
  `descripcion` (59), `con_serv_aba` (60).
- **Se unifican** `informacion` (31) + `informacion` (32) + `descripcion` (52) en el campo `informacion`.

## 4. Fechas y valores especiales

| Aspecto | Regla |
|---|---|
| Formato de fecha | `dd/mm/aaaa hh:mm:ss a.m./p.m.` (a parsear como `%d/%m/%Y %I:%M:%S %p`, zona `America/Caracas`) |
| Celdas vacías | Permitidas (p. ej. `fecha_cita`); la plataforma las tolera |
| Separador decimal | No aplica en las columnas usadas |
| Texto | Puede contener acentos (`ñ`, tildes) → exige decodificar ISO-8859-1 y normalizar antes de comparar |
| Identificador | `id_averia` es la clave de deduplicación; debe ser **único global** |

## 5. Canal de entrega

| Opción | Estado |
|---|---|
| **Carpeta/bucket de entrega dedicado** con acceso auditado (recomendado) | Por definir con CANTV |
| SFTP corporativo | Alternativa |
| Repositorio Git | **Prohibido** (contiene PII de suscriptores) |

El archivo **nunca** se versiona en el repositorio del proyecto: `.gitignore` excluye
`detalle_averias_gpon*.csv` (H-01).

## 6. Validaciones de recepción

La plataforma valida y registra en `ingesta_lote`:

1. Existencia del archivo del día y legibilidad con la codificación declarada.
2. Presencia de las **80 columnas** (si el conteo difiere → lote en `ERROR`, no se ingesta).
3. Filtrado por los datos operativos de la central configurada (`central`).
4. Deduplicación por `id_averia` (solo se insertan casos nuevos).
5. Registro de filas leídas, de la central, nuevas, duplicadas y descartadas.

## 7. Errores y reproceso

| Situación | Acción |
|---|---|
| Archivo ausente | Alerta al supervisor (RNF-19); reintento manual al recibirlo |
| Codificación inesperada | Falla ruidosa, sin ingesta parcial |
| Cambio de columnas | Lote rechazado + solicitud de nueva versión del contrato |
| Corrección posterior | Se reenvía el archivo; la deduplicación por `id_averia` evita duplicados |

**RPO de la ingesta:** si un día no llega el archivo, los casos de ese día se incorporan al reenviarse;
no se pierde información porque el sistema origen mantiene el histórico.

## 8. Confidencialidad

El archivo contiene **datos personales de suscriptores** (nombre, teléfono, dirección, serial, PII de
trabajadores). Su tratamiento se rige por RNF-18 y la política de retención de `requerimientos.md` §5.1.
Prohibida su difusión fuera de los canales autorizados.

## 9. Responsabilidades

| Parte | Responsabilidad |
|---|---|
| **CANTV — dueño del sistema origen** | Entregar el archivo diario en el formato pactado y avisar cambios con antelación · *responsable por designar* |
| **CANTV — protección de datos** | Aprobar la base legal y la retención (RNF-18) · *responsable por designar* |
| **GGTO — Dirección de proyecto** | Custodiar el canal, validar la ingesta y reportar incidencias |
| **GGTO — Backend** | Implementar el parser, las validaciones y la deduplicación |

## 10. Aceptación

| Rol | Nombre | Fecha | Firma |
|---|---|---|---|
| CANTV — sistema origen | | | |
| CANTV — protección de datos | | | |
| GGTO — Dirección | | | |

## 11. Historial de versiones

| Versión | Fecha | Cambio |
|---|---|---|
| v0.1 | 2026-09-25 | Emisión inicial a partir del análisis del brief y de la muestra pseudonimizada. |
