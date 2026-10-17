# Incremento D-110 — Verificación del despacho y columna «Casos» por tipo

| Campo | Valor |
|---|---|
| Petición | 1) verificar que al procesar el despacho se asignen los casos a su cuadrilla **y** se avise a las APK del despacho disponible · 2) en la ficha del despacho del día, la columna **Casos** debe mostrar el total de **Reparaciones Comunes + Reparaciones Referidas + Construcciones**, con **iconos** |
| Fecha | 2026-10-17 |
| Alcance | Verificación (API + producción) · web (`Despacho.tsx`) · base de datos de producción (migración pendiente) |
| Autor | Dirección del proyecto |

---

## 1. Verificación del punto 1: asignación y aviso

### 1.1 Lo que ya estaba implementado

- `POST /despachos/procesar` reparte el universo con `construir_propuesta` (reparto por sector
  asignado del día, cuadrilla 0 para gestión, construcción en una sola cuadrilla) y persiste con
  `guardar_propuesta`.
- Después emite **un mensaje por cuadrilla** con `emitir_despacho_actualizado`
  (`ALARMA_DESPACHO`, destino `CUADRILLA`): «DESPACHO DEL DÍA — jornada … / Cuadrilla X: N caso(s)
  asignado(s)». La APK los recibe por el sondeo de `/mensajes` (cada 60 s).

### 1.2 Prueba de extremo a extremo añadida

`test_procesar_asigna_a_su_cuadrilla_y_avisa_a_la_apk` (en `app/tests/test_despacho_api.py`):
procesa la jornada con el técnico de prueba ya inscrito en la cuadrilla, comprueba que el despacho
contiene **exactamente** los casos de su cuadrilla (`despacho_caso` == detalle) y que el técnico ve
el aviso en `/api/v1/mensajes` (la bandeja que consulta la APK) con el código de su cuadrilla y el
número de casos.

### 1.3 ⚠️ Defecto de producción encontrado y corregido

La verificación en producción descubrió que **ningún mensaje llegaba a las APK**: el `sync_log` y
los despachos se creaban, pero la tabla `mensaje` no recibía filas desde el **2026-10-14**. La causa
estaba en los logs de Cloud Run:

```
sqlalchemy.exc.ProgrammingError: (psycopg2.errors.UndefinedColumn)
column mensaje_destino.p00 does not exist
```

La **migración D-95 nunca se había aplicado a `public`** (`mensaje_destino.p00`, la PK nueva y los
CHECK de destinatario faltaban), así que el *fan-out* de destinatarios fallaba con 500. Efecto:
ni los avisos de despacho, ni los recordatorios de cita, ni los mensajes manuales llegaban a la
APK; el procesamiento de despachos del 17-10 a las 17:03 creó los despachos pero **no** sus avisos.

**Corrección aplicada** (vía Cloud SQL Auth Proxy con credenciales de gcloud y el script
idempotente del repositorio):

1. `scripts/migrar_d95_coordinador_mensajeria.py --dsn … --aplicar --si` → **«Migración D-95
   aplicada y verificada: (1, 1, 3, 2, 2)»**; la tabla queda con `id_destino` (PK), `p00`,
   `ix_mensaje_destino_usuario` y el CHECK de un solo destinatario, conservando las 24 filas.
2. **Prueba de humo**: mensaje manual a la cuadrilla C-001 → **201** y **3 destinatarios** creados
   en `mensaje_destino` (antes fallaba con 500). El mensaje de prueba se eliminó (cascada).
3. **Reemisión de los avisos perdidos** del 17-10 sin tocar los despachos: se volvió a llamar
   `emitir_despacho_actualizado` para los tres despachos del día →
   `#285 C-00 (1 destinatario)`, `#286 C-001 (3)`, `#287 C-003 (2)`.

Desde ahora, cada `/despachos/procesar` crea los avisos, y las APK los reciben en su sondeo.

---

## 2. Punto 2: columna «Casos» con el desglose por tipo e iconos

En **DESPACHO → Despachos del día**, la columna Casos mostraba solo `casos.length`. Ahora:

- `conteoPorTipo(casos)` (función pura exportada) cuenta **REPARACION** (comunes), **REFERIDO**
  (referidas) y **CONSTRUCCION**, y aparte **EMPRESA** y **FALLA_MASIVA**.
- `CeldaCasosPorTipo` pinta cada tipo con su **icono** (`IconoReparacion`, `IconoReferido`,
  `IconoConstruccion`) y su número, el **total de los tres** en negrita y, si los hay, los «otros»
  con su icono, de modo que el total nunca oculte trabajo.
- La leyenda `title`/`aria-label` de cada icono lo identifica («Reparaciones comunes: N», etc.), y
  la cabecera «Casos» explica qué suma.
- La **ficha del despacho** (ventana flotante) añade el mismo desglose en su cuadro de indicadores
  (`box-info-tipos`).
- CSS nuevo: `.celda-casos-tipo`, `.caso-tipo-*` (colores por tipo) y `.caso-total`.

---

## 3. Trazabilidad

| ID | Requisito / regla |
|---|---|
| RF-95 | Al procesar el despacho, cada caso queda en su cuadrilla y se emite el aviso a esa cuadrilla |
| RF-96 | La columna Casos del despacho del día muestra comunes, referidas y construcciones con iconos |
| RNF-47 | La mensajería interna funciona en producción (migración aplicada y verificada) |
| RT-35 | Prueba de extremo a extremo de la asignación y del aviso a la APK |

---

## 4. Archivos

| Archivo | Cambio |
|---|---|
| `app/web/src/pages/Despacho.tsx` | `conteoPorTipo`, `CeldaCasosPorTipo`, columna y ficha |
| `app/web/src/styles.css` | Estilos del desglose por tipo |
| `app/tests/test_despacho_api.py` | Prueba de extremo a extremo (asignación + aviso) |

---

## 5. Verificación

| Prueba | Resultado |
|---|---|
| `pytest` (PostgreSQL 18, esquema `ggto_test`) | **397/397 en verde** (396 + **1 nueva**) |
| `tsc` + `vite build` | **en verde** (bundle `index-w6der1n_.js`) |
| Producción · migración D-95 | **aplicada y verificada** `(1, 1, 3, 2, 2)` |
| Producción · mensajería | mensaje de prueba → **201** y **3 destinatarios**; avisos del día reemitidos (`#285–#287`) |
| Producción · web | revisión **`ggto-web-00054-tsx`** (imagen `v41`), bundle con `celda-casos-tipo` y los iconos |

---

## 6. Pendiente

- **Prueba en dispositivo**: el técnico debe ver el aviso «DESPACHO ACTUALIZADO» en el acto (o en
  ≤ 60 s) y, al abrir la lista, sus casos.
- Las notificaciones **push** del sistema operativo siguen sin existir: el aviso llega por la
  bandeja interna (sondeo de 60 s), no por una notificación nativa. Si se quiere notificación del
  sistema con la app cerrada, hace falta FCM o una notificación local programada con el servicio en
  primer plano.
