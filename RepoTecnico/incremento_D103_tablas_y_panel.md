# Incremento D-103 — Listados de CASOS y Panel por fichas

| Campo | Valor |
|---|---|
| Petición | 1) Unir Tipo y Clase en la columna **REPORTE** (solo iconos) en los cuadros de CASOS General y Especiales · 2) añadir el **FAT** a la columna Sector · 3) convertir las sub-secciones del **Panel** en widgets agrupados por fichas en una sola página, con iconos |
| Fecha | 2026-10-16 |
| Alcance | Web (`app/web`) + un campo nuevo en la API de casos especiales (`app/api`, `app/schemas`) |
| Autor | Dirección del proyecto |

---

## 1. Qué se pidió y qué se entrega

| # | Petición | Entrega |
|---|---|---|
| 1 | Unir **Tipo** y **Clase** en una columna **REPORTE** con solo los iconos, para dar más espacio a Dirección | En CASOS: `Tipo` + `Clase` → **Reporte**. En ESPECIALES: `Tipo` + `Actividad` → **Reporte**. Los dos iconos van juntos, sin texto visible |
| 2 | Añadir el **FAT** a la columna Sector | El sector con el FAT debajo (`FAT 2324-04-04.1-20-FAT60 EG8245H5`) en **los dos** listados |
| 3 | Panel: sub-secciones como widgets agrupados por fichas en una sola página, con iconos | Las cuatro sub-secciones (Widget · Ingesta · Monitoreo · Alertas) se pintan **apiladas**, cada una en su ficha con icono, título y descripción |

---

## 2. Decisiones

| ID | Decisión |
|---|---|
| **DEC-103-1** | El icono **no** pierde su nombre: va en el `title` (ratón) y en `aria-label` + texto oculto (lector de pantalla), como exige **RNF-09/RNF-23**. El texto visible desaparece solo en la columna; las variantes con etiqueta (`CeldaTipoCaso`, `CeldaClase`, `CeldaActividad`) siguen disponibles para las vistas con espacio |
| **DEC-103-2** | En ESPECIALES se unen **Tipo (clasificación) + Actividad**, que son los dos iconos que describen el reporte — el equivalente a Tipo + Clase de CASOS. **Prioridad** se mantiene como columna propia: es un dato accionable, no descriptivo |
| **DEC-103-3** | El FAT de ESPECIALES sale del **caso asociado**; se añade `fat` a `CasoEspecialOut` y el endpoint ya cargaba el caso, así que no hay consulta nueva |
| **DEC-103-4** | El Panel pasa a **tablero de fichas** y **sustituye** las pestañas de D-72. La compatibilidad se mantiene: `?pestana=ingesta` **desplaza la vista** hasta esa ficha (ya no la aísla) y los identificadores `#ingesta`, `#monitoreo`, `#alertas` siguen existiendo |
| **DEC-103-5** | Si el caso no trae FAT, la celda queda como estaba (solo el sector): no se inventa ni se muestra un guion por un dato opcional |

---

## 3. Trazabilidad

| ID | Requisito / regla |
|---|---|
| RF-81 | Los listados de CASOS y ESPECIALES muestran el reporte con sus iconos en una sola columna |
| RF-82 | La columna Sector muestra el FAT del caso cuando la API lo entrega |
| RF-83 | El Panel presenta sus sub-secciones como widgets en fichas dentro de una sola página |
| RNF-40 | El icono conserva nombre accesible (title + aria-label + texto oculto) |
| RT-28 | La API de casos especiales expone el FAT del caso asociado |

---

## 4. Archivos

| Archivo | Cambio |
|---|---|
| `app/web/src/components/CeldasIcono.tsx` | Reescrito: **aspectos** reutilizables (`aspectoTipoCaso`, `aspectoClase`, `aspectoActividad`, `aspectoPrioridad`), celda **`CeldaReporte`** (iconos juntos, sin texto) y las variantes con etiqueta |
| `app/web/src/components/CeldaSector.tsx` | **Nuevo**: sector con el FAT debajo |
| `app/web/src/pages/Casos.tsx` | Cabecera: `Tipo` + `Clase` → **Reporte**; Sector con FAT |
| `app/web/src/pages/Especiales.tsx` | Cabecera: `Tipo` + `Actividad` → **Reporte**; Sector con FAT; se conserva Prioridad |
| `app/web/src/pages/Operacion.tsx` | **Reescrito**: de pestañas a fichas apiladas, con icono, título y descripción por sub-sección; `?pestana=` pasa a ser ancla de desplazamiento |
| `app/web/src/styles.css` | Fichas (`.ficha-operacion*`), texto solo para lectores (`.visualmente-oculto`), icono solo (`.celda-icono-solo`), reporte (`.celda-reporte`) y sector con FAT (`.celda-sector`, `.sector-fat`); se retiran las reglas de las pestañas |
| `app/web/src/api/types.ts` | `CasoEspecialOut.fat` |
| `app/schemas/especiales.py` | `CasoEspecialOut.fat` |
| `app/api/routes_especiales.py` | Rellena `fat` con el del caso asociado |
| `docs/propuesta-visual/scripts/verificar_aplicacion.js` | Ampliado: datos de muestra con FAT, casos especiales, formas completas de Monitoreo/Métricas para que el Panel pinte, y captura de página completa |

---

## 5. Verificación

| Prueba | Resultado |
|---|---|
| `npx tsc --noEmit` | sin hallazgos |
| `npm run build` | **construido** (97 módulos, CSS 65,5 KB / 16,9 KB gzip) |
| `ruff check` (archivos tocados) | **All checks passed** |
| `mypy` (archivos tocados) | **Success: no issues found in 2 source files** |
| `pytest` (pruebas sin base de datos) | **28/28 en verde** |
| Capturas reales con API simulada | `/casos`, `/especiales` y `/` **sin errores de página**, con la columna REPORTE, el FAT bajo el sector y las cuatro fichas |

Capturas: `docs/propuesta-visual/capturas/aplicado-casos-escritorio.png`,
`aplicado-casos-movil.png`, `aplicado-especiales-escritorio.png`,
`aplicado-operacion-escritorio.png` y `aplicado-operacion-completo.png`.

**Efecto buscado, comprobado:** al desaparecer dos columnas, **Dirección** pasa a disponer del
ancho que ocupaban Tipo y Clase (visible en las capturas: la dirección completa cabe en una línea).

---

## 6. Pendiente

- **Manuales**: `docs/Manuales/01-Tecnologia/03-stack-frontend.md` describe la barra superior y las
  pestañas de OPERACIÓN (D-72); hay que actualizarlo a las fichas de D-103 en la próxima pasada de
  manuales.
- **Rutas E2E**: ninguna especificación usa las pestañas ni los anclajes, así que no hay que
  reescribir ninguna; conviene una corrida de la suite completa contra la base de pruebas.
- **Despliegue**: los cambios de la web y el campo nuevo de la API requieren redesplegar la imagen.
