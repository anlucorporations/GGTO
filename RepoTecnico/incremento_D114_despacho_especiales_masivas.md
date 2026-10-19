# Incremento D-114 — Proceso de despacho: sin «Universo de casos», especiales separados y masivas por sector

| Campo | Valor |
|---|---|
| Petición | 1) eliminar toda la sección **Universo de casos** del proceso de despacho · 2) separar los **casos especiales** en **Especiales Reparación**, **Especiales Construcción** y **Especiales Gobierno** (incluido el cuadro de sectores y el resumen principal) · 3) añadir en **Sectores y cuadrilla** una columna con una **lista desplegable de las masivas del sector** para elegir cuáles entran al despacho de masivas |
| Fecha | 2026-10-19 |
| Alcance | API (`/despachos/proceso`, `/despachos/procesar`) · web (`ProcesarDespacho.tsx`, `types.ts`, `styles.css`) · pruebas · manuales · **sin cambios de esquema de base de datos** |
| Autor | Dirección del proyecto |

---

## 1. Punto 1 — Se elimina la sección «Universo de casos»

La ventana de proceso ya **no** muestra:

- la tarjeta **Universo de casos** del resumen, ni
- la tabla de casos con los botones **Todos / Comunes / Especiales**.

El resumen principal y el cuadro de **Sectores y cuadrilla asignada** son la única vista. El
universo se sigue calculando en el backend (`universo_casos`) porque de él salen los totales, los
sectores y la propuesta; lo que desaparece es su **listado en pantalla**.

**Decisión (DEC-114-1).** El detalle caso a caso no aporta al supervisor en el momento de
asignar: la decisión se toma por **sector** y por **tipo**, no por renglón. El listado completo
sigue disponible en **CASOS** y en la ficha del despacho.

---

## 2. Punto 2 — Los especiales se separan en tres conceptos

El concepto único «Especiales» se parte en:

| Concepto | Regla |
|---|---|
| **Especiales Reparación** | Caso especial cuya actividad no es construcción. |
| **Especiales Construcción** | Caso especial con `tipo_caso = CONSTRUCCION`. |
| **Especiales Gobierno** | Caso con `categoria = GOBIERNO` (cualquiera sea su actividad). |

La clasificación elegida por el usuario es **por actividad, con Gobierno adicional**: un
gobierno **suma** a su actividad (reparación o construcción) **y** a Gobierno, de modo que las
tres cifras pueden solaparse. Un caso de gobierno de construcción cuenta en Construcción y en
Gobierno; un gobierno de reparación, en Reparación y en Gobierno.

```python
def tipos_distribucion(caso: Caso) -> tuple[str, ...]:
    if caso.categoria == "GOBIERNO":
        actividad = (
            "ESPECIALES_CONSTRUCCION"
            if caso.tipo_caso == "CONSTRUCCION"
            else "ESPECIALES_REPARACION"
        )
        return (actividad, "ESPECIALES_GOBIERNO")
    if caso.tipo_caso == "CONSTRUCCION":
        return ("ESPECIALES_CONSTRUCCION",) if es_especial(caso) else ("COMUNES",)
    if caso.categoria in ("REFERIDO", "EMPRESA"):
        return ("ESPECIALES_REPARACION",)
    if caso.es_falla_masiva:
        return ("MASIVAS",)
    return ("COMUNES",)
```

La separación aparece en:

- el **resumen principal** (`universo.especiales_reparacion/construccion/gobierno`);
- el **cuadro de Sectores y cuadrilla** (columnas `Esp. Reparación`, `Esp. Construcción` y
  `Esp. Gobierno`, calculadas sobre lo que se va a distribuir);
- las **tarjetas de cuadrillas** (desglose de especiales de sus sectores);
- el **checklist de tipos**, que pasa de `COMUNES · REFERIDOS · CONSTRUCCIONES · EMPRESAS ·
  MASIVAS` a **`COMUNES · ESPECIALES_REPARACION · ESPECIALES_CONSTRUCCION ·
  ESPECIALES_GOBIERNO · MASIVAS`**, con **Comunes y Especiales Reparación** por defecto.

**Decisión (DEC-114-2).** `POST /despachos/procesar` solo acepta los tipos nuevos; los antiguos
(`REFERIDOS`, `EMPRESAS`, `CONSTRUCCIONES`) responden **400**. El APK no envía `tipos` (manda
`null` = todos), así que sigue funcionando sin cambios.

Un caso se incluye si **alguno** de sus tipos está marcado: marcar solo **Especiales Gobierno**
distribuye los gobiernos, y marcar **Especiales Reparación** distribuye además los gobiernos de
reparación (solapamiento intencional de DEC-114-2).

---

## 3. Punto 3 — Las masivas por sector eligen qué entra al despacho

La tabla **Sectores y cuadrilla asignada** gana la columna **Masivas del sector**: un
`select multiple` con las fallas masivas activas cuyo `id_sector` es el del sector (si la masiva
no declara sector, se usa el de sus casos). El formulario arranca con **todas incluidas**.

- `GET /despachos/proceso` añade a cada masiva `id_sector`, `sector_nombre` e `incluida`.
- `POST /despachos/procesar` acepta `masivas: [{id_falla, id_cuadrilla, incluida}]`.
- En `construir_propuesta(..., masivas_incluidas=…)`:
  - los **overrides** de cuadrilla solo se aplican a las masivas incluidas;
  - `excluir_casos_de_masivas` quita del proceso los casos cuyas masivas **no** se marcaron (un
    caso de varias masivas se conserva si al menos una entra);
  - `reglas.casos_excluidos_por_masiva` y `resumen.excluidos_por_masiva` informan cuántos
    quedaron fuera.

**Decisión (DEC-114-3).** Se conserva la cuadrilla elegida en la tabla **Fallas masivas y su
cuadrilla**: la lista desplegable del sector decide **inclusión**, no reasigna la cuadrilla. Si
no se envía `masivas` (clientes antiguos) o todas vienen con `incluida=true`, el comportamiento
es el de D-113 (todas incluidas).

---

## 4. Verificación

| Comprobación | Resultado |
|---|---|
| `pytest` de despacho (`test_despacho_api`, `test_d113`, `test_d114`, `test_d99_masivas`) | **65/65 en verde** |
| `test_d114_despacho_especiales.py` | **10 nuevas** (resumen, sectores, gobierno suma a su actividad, checklist, masivas incluidas/excluidas) |
| `ruff` en los archivos tocados | sin hallazgos |
| `npx tsc --noEmit` | limpio |
| `npx vite build` | en verde (`index-jD2XZstg.js`) |
| Manuales `05-despacho` (md y html) | actualizados |

**Pendiente:** regenerar el PDF de los manuales y la prueba de aceptación en la web con datos
reales.
