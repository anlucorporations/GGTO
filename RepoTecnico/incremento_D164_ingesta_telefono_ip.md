# D-164 · Ingesta de la nueva estructura del archivo diario (`telefono_ip`)

**Fecha:** 2026-11-02 · **Tipo:** adaptación del contrato de ingesta (RF-01 / RT-05 / RT-20 · D-27)
**Motivo:** el archivo `detalle_averias_gpon 02_11_2026.csv` cambió de estructura.

## Qué cambió en el archivo

| | Antes (contrato 80 columnas, D-27) | Nuevo (02/11/2026) |
|---|---|---|
| Columnas | 80 | **81** |
| Cambio | — | Se inserta **`telefono_ip`** (teléfono IP/fijo del cliente) en la posición **15**, justo después de `telefono` |
| Resto | mapeo por posición | **Sin cambios de contenido**: todo lo que estaba a partir de `fecha_reporte` se desplaza +1 |
| Datos | sintéticos/definición | id_averias reales (p. ej. `28541549`), teléfonos reales, `fat`/`serial` reales |

En el archivo del día la columna venía poblada en **20 de 51 filas** (valores fijos
® 2129…); el resto vacía.

## Cambios de código

1. **`app/services/ingesta.py`** — el parser resuelve la estructura desde el
   **encabezado real**:
   - 80 columnas → estructura original (compatible atrás).
   - 81 columnas **solo si** la columna 15 se llama `telefono_ip` → estructura
     `ESPECIFICACION_81` (derivada de la original en un solo lugar: inserta el
     campo `telefono_ip` y desplaza +1 todo índice ≥ 14, incluida la unificación
     de `informacion` que pasa a 31/32/52). Se selecciona nuevo `LIMITES_81`
     (límite `telefono_ip: 30`).
   - Un encabezado de 81 columnas con otro nombre en la 15.ª posición es
     **inválido** (evita mapear filas desalineadas); el aviso del contrato pasa a
     «se esperaban 80 o 81 (D-164)».
2. **`app/api/routes_ingesta.py`** — `CAMPOS_ESPECIFICACION` es la unión de los
   campos de las dos estructuras, así `Caso(**datos)` recibe `telefono_ip`
   también; el detalle de encabezado inválido gana el nuevo texto.
3. **`app/models/caso_entities.py`** — `Caso.telefono_ip: str | None` (String 30).
4. **`app/schemas/casos.py`** — `CasoOut.telefono_ip` expuesto por API.
5. **`RepoTecnico/db/schema.sql`** — `caso.telefono_ip varchar(30)` (sección 4.3).
6. **Muestra para pruebas** —
   `RepoTecnico/muestras/detalle_averias_gpon_EJEMPLO_81.csv`: edición sintética
   de la muestra EJEMPLO original (sin PII) con la columna nueva.
7. **Migración** — `scripts/migrar_d164_telefono_ip.py` (`ALTER TABLE caso ADD
   COLUMN IF NOT EXISTS telefono_ip varchar(30)`, simulación por defecto,
   idempotente; log `RepoTecnico/BaseOperaciones/migracion_d164.log`).

## Notas de diseño

- El clasificador de pago **D-89 no cambia**: el identificador sigue saliendo de
  `telefono` (70*) o `contacto_cliente` (columna 16 → 17 en el archivo nuevo);
  `telefono_ip` se persiste como dato del caso. Si el usuario decide que el
  teléfono IP se sume a los contactos de `informacion`, es un cambio aparte.
- La validación por posición es deliberada: el encabezado del archivo trae
  columnas duplicadas (`informacion` ×2, `descripcion` ×2), así que el mapeo por
  nombre no es seguro; por eso se sigue mapeando por posición y solo se usa el
  encabezado para elegir entre las dos estructuras exactas.

## Verificación

- Parser con el archivo real del 02/11/2026: **51 filas, 0 avisos**, 20 filas con
  `telefono_ip` capturado y alineación correcta (`fat`/`serial`, fecha_reporte,
  `dias_area_resolutoria`).
- Parser con la muestra original de 80: 56 filas, 0 avisos (sin regresión).
- Nuevas pruebas en `test_ingesta_parser.py` (spec 81, muestra 81 válida,
  muestra 80 intacta, encabezado 81 inválido, fila desalineada descartada y
  recorte de `telefono_ip`).
- Suite completa: **625 passed** (734 s); `ruff` y `mypy` limpios.
- Migración aplicada en producción `ggtov2` y rerun de idempotencia en verde
  («La base YA está migrada»).

## Estado de la entrega

- **Aplicado en producción:** solo la migración de base (columna creada; el
  código en producción v95 aún no la usa).
- **Sin commit / sin push / sin despliegue** (pendientes de orden del usuario);
  para desplegar, el build debe llevar el D-164 en el árbol.

## Pendientes / decisiones abiertas

1. ¿Se suma `telefono_ip` a los contactos que componen `informacion` (D-89)?
2. ¿La ficha del caso (web/APK) muestra el teléfono IP? (campo ya expuesto en la API).
3. Regenerar manuales HTML/PDF (las menciones de «80 columnas» quedaron históricas).
