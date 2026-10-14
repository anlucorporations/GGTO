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
| **Identificador de pago (70\*)** | Número que cumple `configuracion.pago.serie_regex` (por defecto `^70[0-9]{8}$`); es la clave que enlaza al usuario con la institución y **puede tener varios reportes** | `identificador_pago.numero` |
| **Reportes por identificador** | `count(caso)` con `caso.id_pago = <identificador>` (los históricos se arman a su alrededor) | `caso.id_pago` |
| **Reincidente** | Identificador con **2 o más reportes** dentro de `pago.reincidencia_dias` (por defecto 90) · **RF-54** | `caso.id_pago` + `caso.creado_en` |
| **Reparación válida** | `tipo_caso='REPARACION'` **con** identificador de pago y **con** ID de avería real (no `REF-…`) · D-89/D-90 | `caso` |
| **Caso REFERIDO** | Caso que no acreditó sus claves (`tipo_caso='REFERIDO'`); una REPARACIÓN sin 70\* o sin avería real se reclasifica así | `caso.tipo_caso` |
| **Número de contacto** | Cualquier número que **no** es 70\*; vive en `caso.contacto_cliente` y se refleja en `caso.informacion` como `[CONTACTO] <numero>` | `caso` |

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
construcción, cuadrilla, capacidad **y —desde D-94— el bloque del identificador de pago** (métricas
por 70\* y estado de la regla REPARACIÓN/REFERIDO). Se ofrece en **JSON** y en **HTML imprimible**.

## 10. MONITOREO — IDENTIFICADOR DE PAGO (D-90/D-94)

`GET /api/v1/monitoreo/identificadores` (ADMIN/SUPERVISOR) y
`GET /api/v1/monitoreo/reclasificaciones` (ADMIN/SUPERVISOR). En la web viven en la zona
«Identificador de pago (70\*)» de la pestaña MONITOREO.

| Indicador | Fórmula | Ventana |
|---|---|---|
| `con_casos` | `count(distinct caso.id_pago)` de la central | acumulado |
| `casos_con_identificador` | `count(caso)` con `id_pago` no nulo | acumulado |
| `casos_sin_identificador` | `count(caso)` con `id_pago` nulo | acumulado |
| `media_casos` / `max_casos` | Reportes por identificador: media (1 decimal) y máximo | acumulado |
| `reincidentes` | Identificadores con **≥2** reportes en la ventana (`pago.reincidencia_dias`) · **RF-54** | ventana configurable |
| `top` | Los identificadores con más reportes de la ventana (número, casos totales, reportes en ventana y si es reincidente) | ventana |
| `reparaciones_validas` | `tipo_caso='REPARACION'` + `id_pago` + avería real | acumulado |
| `referidos` | `tipo_caso='REFERIDO'` | acumulado |
| `reclasificadas` | Referidos con ficha de especial de actividad REPARACIÓN | acumulado |
| `pendientes_historicos` | REPARACIONES **marcadas** que aún no han tenido su próximo cambio (DEC-IP-3) | acumulado |
| `referidos_sin_ficha` | Referidos sin fila en `caso_especial` | acumulado |

## 11. ALERTAS Y OUTBOX (Ciclo 9 — RNF-19/RNF-20)

Se exponen en `GET /api/v1/metricas`, junto a los totales de casos y el estado de los canales.

| Métrica | Fórmula | Entidad |
|---|---|---|
| **Falla masiva activa** | Falla en estado `DETECTADA` o `PLANIFICADA` | `falla_masiva.estado` |
| **Notificación pendiente** | Notificación en estado `PENDIENTE` (incluye las diferidas por falta de credenciales) | `notificacion.estado` |
| **Notificación enviada** | Notificación en estado `ENVIADO` | `notificacion.estado` |
| **Notificación fallida** | Notificación en estado `FALLIDO` (agotó `outbox.max_intentos`) | `notificacion.estado` |
| **Falla detectada por concentración** | Grupo de `fallas.umbral_casos` o más casos no cerrados en las últimas `fallas.ventana_horas`, agrupados por `fallas.campo_concentracion` | `caso` agrupado; `clave_concentracion` única por falla activa |
| **Intentos de envío** | Contador por notificación; backoff exponencial `min(2^(n-1), 60)` minutos | `notificacion.intentos` / `notificacion.proximo_intento` |

- Un canal **sin credenciales** no genera fallo: la notificación se **difiere** y no consume
  intento, de modo que pueda reenviarse cuando se configure `TELEGRAM_BOT_TOKEN` / `SMTP_HOST`.
- «Diferida» = `intentadas - enviadas - fallidas` en la respuesta de `POST /notificaciones/procesar`.

## 12. Redondeo y zonas horarias

- Todos los conteos son **enteros**; el único promedio es `media_casos` (1 decimal).
- Las fechas se interpretan en `America/Caracas`; el frontend muestra `dd/mm/aaaa`.
- **Día operativo (D-94).** «Día» es el de `America/Caracas`, no el del servidor: las columnas
  `timestamptz` (`caso.creado_en`, `caso_estado_hist.fecha_hora`, `cita.fecha_hora`) se convierten
  con `timezone('America/Caracas', columna)::date` (`app/services/monitoreo.py::_dia`) y las rutas
  usan `hoy_operativo()` (`app/services/tiempo.py`) como valor por defecto de `fecha`. Antes se
  truncaban con `::date` **en la zona de la sesión** (UTC en Cloud SQL), así que todo lo registrado
  después de las 20:00 de Caracas caía en el día siguiente. Las **alarmas de despacho**
  (`app/services/mensajes.py`) usan el mismo día operativo.
- `despacho.fecha` es un `date` (sin hora) y se compara tal cual.
- ⚠️ **Pendiente de confirmar:** los filtros por rango que reciben una **fecha con hora** sin zona
  (`GET /api/v1/casos?desde=&hasta=`, `GET /api/v1/citas?desde=&hasta=`) se siguen interpretando en
  la zona de la sesión, de modo que un rango construido con la hora local del navegador se desplaza
  respecto al día operativo. Se corregirá fijando la interpretación en `America/Caracas` cuando se
  acuerde el contrato con los clientes (web y APK).

## 13. Pendiente de validación con CANTV

1. ¿«Ingreso nuevo» debe contar por `creado_en` (entrada al sistema) o por `fecha_reporte` (fecha
   del reporte en el sistema origen)?
2. ¿La semana operativa es lunes–sábado o lunes–domingo?
3. Confirmar la aproximación de **Gestionado** mientras la app móvil no exista (Ciclo 8).
