# Incremento D-146 — Efectividad y ranking de cuadrillas

| Campo | Valor |
|---|---|
| Petición | «Genera un método para calcular la efectividad de cada cuadrilla; el objetivo es poder establecer un ranking entre las cuadrillas» |
| Fecha | 2026-10-21 |
| Alcance | Backend + web · despliegue **v78** · APK sin cambios |
| Autor | Dirección del proyecto |

---

## 1. El método

La efectividad de una cuadrilla es una **media ponderada de cuatro criterios**
medidos sobre el trabajo **despachado** a esa cuadrilla en un periodo:

```
efectividad = 100 · ( 0.45·cierre + 0.25·oportunidad + 0.20·calidad + 0.10·sin_reapertura )
```

| Criterio | Peso | Fórmula | Qué premia |
|---|---|---|---|
| **Cierre** | 45 % | `cerrados / asignados` | que el trabajo se termine |
| **Oportunidad** | 25 % | `cerrados en ≤ DIAS_OPORTUNIDAD (1) día / cerrados` | resolver el mismo día o al siguiente |
| **Calidad** | 20 % | `cerrados con evidencia fotográfica / cerrados` | cerrar con prueba del trabajo |
| **Sin reapertura** | 10 % | `1 − reabiertos / cerrados` | cerrar bien la primera vez |

El resultado va de **0 a 100** con una etiqueta: `EXCELENTE ≥ 85`, `BUENO ≥ 70`,
`REGULAR ≥ 50`, `BAJO < 50`.

### Reglas de cálculo

- **Qué cuenta**: las filas de `despacho_caso` de despachos **no borrador**
  (`PUBLICADO`/`CERRADO`) en el periodo. Un caso **reasignado** cuenta en las dos
  cuadrillas (la que no lo terminó queda penalizada en cierre).
- **Devuelto**: el caso quedó en `PENDIENTE` (el cierre de jornada se lo devolvió a
  la bolsa). Se informa como conteo y ya penaliza en «cierre».
- **En plazo**: la primera fecha de cierre (`caso_estado_hist`) comparada con la
  fecha del despacho + `DIAS_OPORTUNIDAD`.
- **Calidad**: evidencia ligada al caso (`evidencia.id_caso`, D-128) o a su
  actividad (filas antiguas).
- **Reapertura**: una transición `CERRADO → otro estado` en la bitácora.
- **Muestra mínima**: `MIN_MUESTRAS = 5` asignaciones. Por debajo, la cuadrilla se
  informa con su puntaje pero **sin posición** (no se compara una jornada con seis).
- **Desempate**: más cerrados → más asignados → código.

Los pesos y los umbrales están en **un solo sitio** (`app/services/efectividad.py`)
para poder ajustarlos sin tocar la consulta.

---

## 2. API

`GET /api/v1/despachos/efectividad?desde&hasta&min_muestras`

```json
{
  "desde": "2026-09-22", "hasta": "2026-10-21", "id_central": 1,
  "pesos": {"cierre": 0.45, "oportunidad": 0.25, "calidad": 0.2, "reapertura": 0.1},
  "criterios": {"cierre": "casos cerrados / asignados", "...": "..."},
  "minimo_muestras": 5, "dias_oportunidad": 1,
  "ranking": [
    {"posicion": 1, "codigo": "C-001", "puntaje": 64.9, "etiqueta": "REGULAR",
     "asignados": 34, "cerrados": 32, "en_plazo": 20, "con_evidencia": 0,
     "devueltos": 2, "reaperturas": 10, "componentes": {...}, "muestra_suficiente": true}
  ]
}
```

La respuesta incluye los **conteos crudos** y la definición de cada criterio: el
puntaje se puede recalcular a mano.

---

## 3. Web

Nuevo bloque **«Efectividad y ranking de cuadrillas»** en **DESPACHO**, debajo del
reporte de producción:

- selector de periodo (7 / 30 / 90 días, por defecto 30);
- tabla con **posición, cuadrilla, puntaje con barra y etiqueta**, cerrados /
  asignados, oportunidad %, calidad %, devueltos y reaperturas;
- nota con la fórmula y los pesos;
- las cuadrillas con muestra baja aparecen marcadas y sin posición.

---

## 4. Verificación

| Comprobación | Resultado |
|---|---|
| Backend (suite completa) | **536/536 en verde** (8 nuevas de D-146) |
| Pruebas nuevas | cuadrilla perfecta = 100; sin cierres = 10; fórmula explícita con pesos que suman 1; muestra mínima; etiquetas; ranking real (una cuadrilla que cierra 6/6 queda 1.ª y otra con 5 devueltos baja); cuadrilla sin trabajo sin posición; periodo invertido → 422 |
| Web | `tsc --noEmit` y `npm run build` limpios |
| Producción (v78) | ranking real de 30 días: **C-001 64,9** (32/34 cerrados), **C-003 53,8** (15/21), **C-002 46,0** (19/37, 16 devueltos) |

> Nota sobre «calidad»: en producción solo hay 38 evidencias (4 casos con foto), así
> que hoy ese 20 % deja a casi todas las cuadrillas en 0. Es un dato real, no un
> fallo del cálculo; si se quiere premiar otra cosa (p. ej. actividades
> registradas), se cambia el criterio en un punto.

---

## 5. Cambios por archivo

| Archivo | Cambio |
|---|---|
| `app/services/efectividad.py` | **Nuevo**: pesos, `Conteos`, `puntaje()` puro y `ranking()`. |
| `app/schemas/despacho.py` | `EfectividadCuadrillaOut`, `RankingEfectividadOut`. |
| `app/api/routes_despachos.py` | `GET /despachos/efectividad` (declarado antes de `/{id_despacho}`). |
| `app/tests/test_d146_efectividad.py` | **Nuevo**: 8 pruebas. |
| `app/web/src/api/types.ts`, `client.ts` | Tipos y `efectividadCuadrillas`. |
| `app/web/src/pages/Despacho.tsx` | Bloque «Efectividad y ranking de cuadrillas». |
| `app/web/src/styles.css` | Barra y etiquetas del ranking. |
