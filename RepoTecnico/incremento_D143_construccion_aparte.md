# Incremento D-143 — Construcción aparte en el proceso y su seguimiento global

| Campo | Valor |
|---|---|
| Petición | «1. al procesar el despacho los casos de construcción se traten aparte, se incluya un cuadro con los sectores y las cantidades por sector para asignárselo a la cuadrilla. 2. en la métrica del despacho del día separa la construcción para poder medir cuántas construcciones se realizaron en el día; agrega este dato para hacer seguimiento global a las construcciones.» |
| Fecha | 2026-10-21 |
| Alcance | Backend + web · despliegue **v75** · APK sin cambios |
| Autor | Dirección del proyecto |

---

## 1. Lo que se pidió y lo que había

La construcción ya se **despachaba** aparte en el backend (una sola cuadrilla, D-113),
pero el formulario no lo mostraba como bloque propio: el usuario veía «Esp. Construcción»
como una columna más y no podía **elegir** la cuadrilla que atiende toda la
construcción ni ver sus **sectores con cantidades**. Y la métrica del día contaba
«Construcciones» asignadas dentro del total, sin separar cuántas se **realizaron**
(cerradas) ni había serie histórica.

---

## 2. Proceso de despacho: la construcción, aparte

### 2.1 Backend

- `GET /despachos/proceso` incluye el bloque **`construccion`**:
  `total`, `por_sector` (`id_sector`, `nombre`, `cantidad`) y la cuadrilla sugerida
  (`id_cuadrilla`, `cuadrilla_codigo`, `cuadrilla_nombre`).
- `POST /despachos/procesar` acepta **`construccion_cuadrilla`**: si llega, **toda**
  la construcción se asigna a esa cuadrilla (aunque sus sectores estén en otras);
  si no llega, se mantiene la regla automática de D-113.
- `construir_propuesta(..., construccion_cuadrilla_id=…)` aplica la elección y deja
  en `reglas` el `construccion_id_cuadrilla` y el `construccion_total`.

### 2.2 Web (Procesar despacho)

Nuevo bloque **«Construcción (se procesa aparte)»** con:

- el total de construcciones del universo,
- la **tabla de sectores con su cantidad**,
- el selector **«Cuadrilla que atiende toda la construcción»** (arranca con la
  sugerencia del servidor; «Sin asignar» deja la regla automática),
- un aviso si el checklist de tipos deja la construcción fuera del reparto.

---

## 3. Métrica y seguimiento

### 3.1 Métrica del día (separada)

`GET /despachos/reporte/produccion` (y el de cada despacho) añade a `totales` y a
cada cuadrilla:

| Campo | Significado |
|---|---|
| `construcciones` | construcciones **asignadas** en la jornada |
| `construcciones_cerradas` | construcciones **realizadas** (caso `CERRADO`) |

En la web, el reporte del día muestra dos tarjetas aparte —«Construcciones
asignadas» y «Construcciones realizadas (cerradas)»— y la tabla de desglose gana las
columnas **Constr.** y **Constr. cerr.**

### 3.2 Seguimiento global

Nuevo `GET /despachos/construcciones/seguimiento?desde&hasta`:

```json
{
  "desde": "2026-09-22", "hasta": "2026-10-21", "id_central": 1,
  "totales": {"asignadas": 63, "cerradas": 17, "abiertas": 46, "sectores": 5},
  "por_dia": [{"fecha": "2026-10-21", "asignadas": 26, "cerradas": 2, "abiertas": 24}],
  "por_sector": [{"id_sector": 3, "nombre": "…", "asignadas": 18, "cerradas": 5}]
}
```

Ventana por defecto: **30 días**. Se apoya en `despacho_caso` (tipo `CONSTRUCCION`) y
en el estado del caso. La web lo muestra en el bloque **«Seguimiento de
construcciones»** (totales, serie por día y reparto por sector).

---

## 4. Verificación

| Comprobación | Resultado |
|---|---|
| Backend (suite completa) | **516/516 en verde** (5 nuevas de D-143) |
| Pruebas nuevas | el proceso trae el bloque con sus sectores y cantidades (2+1); **toda** la construcción va a la cuadrilla elegida aunque los sectores sean de dos cuadrillas; el reporte separa asignadas (3) y realizadas (1); el seguimiento devuelve la serie del día y su reparto por sector; un periodo invertido → **422** |
| Web | `tsc --noEmit` limpio y `npm run build` correcto |
| Producción (v75) | `proceso.construccion`: **48** construcciones en **5** sectores, cuadrilla sugerida **C-003**; `reporte.totales`: **26** asignadas / **2** cerradas hoy; seguimiento 30 días: **63** asignadas / **17** cerradas |

---

## 5. Cambios por archivo

| Archivo | Cambio |
|---|---|
| `app/services/despacho.py` | `construccion_cuadrilla_id` en `construir_propuesta`; bloque `construccion` en `proceso`. |
| `app/schemas/despacho.py` | `ConstruccionProcesoOut`, `SectorConstruccionOut`, `DiaConstruccionOut`, `SeguimientoConstruccionOut`; `ProcesarDespacho.construccion_cuadrilla`. |
| `app/api/routes_despachos.py` | Pasa la cuadrilla elegida; `construcciones`/`construcciones_cerradas` en el reporte; `GET /despachos/construcciones/seguimiento`. |
| `app/tests/test_d143_construccion_aparte.py` | **Nuevo**: 5 pruebas. |
| `app/web/src/api/types.ts`, `client.ts` | Tipos y `seguimientoConstruccion`; payload con `construccion_cuadrilla`. |
| `app/web/src/components/ProcesarDespacho.tsx` | Bloque «Construcción (se procesa aparte)» con tabla de sectores y selector. |
| `app/web/src/pages/Despacho.tsx` | Tarjetas y columnas de construcción + bloque «Seguimiento de construcciones». |

---

## 6. Decisiones de diseño

1. **Una sola cuadrilla** para toda la construcción (se conserva la regla D-113):
   la elección manual la reemplaza, la automática se mantiene si no se elige.
2. La construcción **no** se saca del checklist: un caso de construcción no especial
   pertenece a **Comunes**, así que el formulario avisa si ese tipo quedó
   desmarcado en lugar de distribuirlo a escondidas.
3. «Realizadas» = caso **CERRADO** (el desenlace que ya usa el aro de cumplimiento),
   para que la métrica sea comparable con el resto del despacho.
