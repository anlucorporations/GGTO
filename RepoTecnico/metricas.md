# Definición de Métricas — GGTO

| Campo | Valor |
|---|---|
| Proyecto | GGTO — CANTV Central Francisco Salias (Área 4) |
| Cierra | **S-08 y D-17** (definición de métricas diferida a la Fase 3) |
| Fase | Fase 3 — Ciclo 7 (MONITOREO y REPORTES) |
| Estado | **v1.0 — definida** (pendiente de validación con CANTV) |

> Cada métrica define **fórmula, entidad, ventana y redondeo**. Todas se calculan en
> **hora de Venezuela** (`America/Caracas`). «Día» = día natural `00:00–23:59:59`.
> Convención de semana: **lunes a sábado** (el domingo no es día operativo).

---

## 1. Definiciones base

| Concepto | Definición | Entidad |
|---|---|---|
| **Ingreso nuevo** | Caso que entra al sistema ese día | `caso.creado_en::date = día` |
| **Resuelto** | Caso cuyo estado pasa a `CERRADO` ese día | `caso_estado_hist` con `estado_nuevo='CERRADO'` y `fecha_hora::date = día` |
| **Gestionado** | Caso con al menos una gestión registrada ese día | `actividad.fecha_hora::date = día` (cuando exista la app, Ciclo 8); hasta entonces se aproxima con `despacho_caso.estado='GESTIONADO'` |
| **Asignado** | Caso incluido en un despacho de ese día | `despacho.fecha = día` + `despacho_caso` |
| **Pendiente** | Caso cuyo `estado_actual` **no** es `CERRADO` ni `CANCELADO` | `caso.estado_actual` |
| **Citado** | Caso con cita ese día | `cita.fecha_hora::date = día` |
| **Diferido** | Caso cuyo estado pasó a `DIFERIDO` ese día | `caso_estado_hist` |
| **Residencial común** | `categoria='RESIDENCIAL'` | `caso.categoria` |
| **Residencial referido** | `categoria='REFERIDO'` | `caso.categoria` |
| **Empresarial** | `categoria in ('EMPRESA','GOBIERNO')` | `caso.categoria` |

## 2. MONITOREO — GESTIÓN DIARIA

| Indicador | Fórmula | Ventana |
|---|---|---|
| `ingresos_nuevos` | `count(caso)` con `creado_en::date = día` | día |
| `resueltos_residencial` | `count(hist)` con `estado_nuevo='CERRADO'` y `categoria='RESIDENCIAL'` | día |
| `resueltos_empresarial` | idem con `categoria in ('EMPRESA','GOBIERNO')` | día |
| `resueltos_referidos` | idem con `categoria='REFERIDO'` | día |
| `citados` | `count(distinct id_caso)` en `cita` | día |
| `diferidos` | `count(hist)` con `estado_nuevo='DIFERIDO'` | día |
| `gestionados` | `count(distinct id_caso)` en `despacho_caso.estado='GESTIONADO'` de despachos del día | día |
| `pendientes_total` | `count(caso)` pendiente | a la fecha |

## 3. MONITOREO — GESTIÓN SEMANAL (curva lunes→sábado)

| Indicador | Fórmula | Ventana |
|---|---|---|
| `asignados` | `count(despacho_caso)` de despachos del día | cada día |
| `cerrados` | `count(hist)` con `estado_nuevo='CERRADO'` | cada día |
| `gestionados` | `count(despacho_caso)` con `estado='GESTIONADO'` | cada día |

Se devuelven **6 puntos** (lunes a sábado) con `fecha`, `asignados`, `cerrados`, `gestionados`.

## 4. MONITOREO — CASOS GLOBALES (barras)

| Indicador | Fórmula | Ventana |
|---|---|---|
| `pendientes` | casos **no** `CERRADO`/`CANCELADO` | rango `desde..hasta` |
| `resueltos` | `count(hist)` con `estado_nuevo='CERRADO'` | rango |
| `total` | `pendientes + resueltos` | rango |

Además: desglose `por_estado` y `por_categoria`.

## 5. MONITOREO — REPARACIÓN (torta)

> **REPARACIÓN y CONSTRUCCIÓN son excluyentes:** reparación cuenta pendientes con
> `tipo_caso != 'CONSTRUCCION'`; construcción cuenta `tipo_caso = 'CONSTRUCCION'`.

| Indicador | Fórmula |
|---|---|
| `residenciales_comunes` | pendientes con `categoria='RESIDENCIAL'` y `tipo_caso != 'CONSTRUCCION'` |
| `residenciales_referidos` | pendientes con `categoria='REFERIDO'` |
| `empresariales` | pendientes con `categoria in ('EMPRESA','GOBIERNO')` |
| `total` | suma de las tres |

## 6. MONITOREO — CONSTRUCCIÓN (barras)

| Indicador | Fórmula |
|---|---|
| `residenciales` | pendientes con `tipo_caso='CONSTRUCCION'` y `categoria='RESIDENCIAL'` |
| `empresariales` | pendientes con `tipo_caso='CONSTRUCCION'` y `categoria in ('EMPRESA','GOBIERNO')` |
| `total` | suma |

## 7. MONITOREO — CUADRILLA

Por cuadrilla y por día (lunes→sábado): `asignados` (en sus despachos), `cerrados`
(historial de sus casos) y `gestionados` (`despacho_caso.estado='GESTIONADO'`), más totales.

## 8. CAPACIDAD OPERATIVA

Cuadrillas activas (con sus integrantes, flota y sectores), técnicos activos, flota
disponible/en ruta/mantenimiento y herramientas disponibles. Una cuadrilla **sin flota** o
**sin integrantes** se marca como `incompleta`.

## 9. REPORTE DE TRABAJO

| Periodo | Rango |
|---|---|
| Diario | El día indicado |
| Semanal | Lunes a sábado de la semana del día indicado |
| Mensual | Del día 1 al último día del mes indicado |

Incluye el bloque de gestión diaria del periodo, la curva semanal, los globales, reparación,
construcción, cuadrilla y capacidad. Se ofrece en **JSON** y en **HTML imprimible**.

## 10. Redondeo y zonas horarias

- Todos los conteos son **enteros**; no hay promedios en v1.
- Las fechas se interpretan en `America/Caracas`; el frontend muestra `dd/mm/aaaa`.
- `despacho.fecha` es un `date` (sin hora); `caso.creado_en` y `caso_estado_hist.fecha_hora` son
  `timestamptz` y se truncan a día con `::date` en la zona del servidor.

## 11. Pendiente de validación con CANTV

1. ¿«Ingreso nuevo» debe contar por `creado_en` (entrada al sistema) o por `fecha_reporte` (fecha
   del reporte en el sistema origen)?
2. ¿La semana operativa es lunes–sábado o lunes–domingo?
3. Confirmar la aproximación de **Gestionado** mientras la app móvil no exista (Ciclo 8).
