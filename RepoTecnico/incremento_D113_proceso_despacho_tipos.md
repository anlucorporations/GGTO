# Incremento D-113 — Proceso de despacho: pendientes del cierre, masivas reasignables y checklist de tipos

| Campo | Valor |
|---|---|
| Petición | 1) al procesar el despacho, incluir también los **casos pendientes para asignación** · 2) poder **cambiar la asignación de las masivas** · 3) un **check list** para elegir el **tipo de casos** que se distribuyen, con **Comunes y Referidos** por defecto |
| Fecha | 2026-10-18 |
| Alcance | API (`/despachos/proceso`, `/despachos/procesar`, `/despachos/propuesta`) · web (`ProcesarDespacho.tsx`) · sin cambios de esquema de base de datos |
| Autor | Dirección del proyecto |

---

## 1. Punto 1 — Los casos PENDIENTES del cierre de jornada entran al proceso

**El defecto.** El corte de jornada de D-99 deja los casos no resueltos en estado
**`PENDIENTE`**, pero **no los desvincula** de su despacho (que queda `CERRADO`), porque
`despacho_caso` es la bitácora de lo que se despachó. El universo del formulario de proceso
(`universo_casos` → `_filtro_universo`) excluía los casos que estaban en un despacho
`PUBLICADO` o `CERRADO`, de modo que **todo lo pendiente de una jornada anterior desaparecía
del formulario**: el supervisor no lo veía en el universo, su sector no aparecía en la tabla
de asignación y, al procesar, esos casos quedaban en «sin asignar» (o se colocaban por el
camino de los citados).

**La corrección.** El filtro del **proceso** excluye solo los casos de un despacho
**PUBLICADO** (la jornada ya se envió y el proceso responde 409) y los **borradores de otra
fecha**; mantiene los borradores del día (se van a reemplazar) y los casos de despachos ya
cerrados:

```python
ocupados = (
    select(DespachoCasos.id_caso)
    .join(Despacho, Despacho.id_despacho == DespachoCasos.id_despacho)
    .where(
        or_(
            Despacho.estado == "PUBLICADO",
            and_(Despacho.estado == "BORRADOR", Despacho.fecha != fecha),
        )
    )
    .scalar_subquery()
)
```

Además, `POST /despachos/procesar` construye la propuesta con **el mismo universo del
formulario** (`universo_casos`) en lugar de `seleccionar_casos`: así lo que el supervisor ve
en pantalla es exactamente lo que se despacha.

**Decisión (DEC-113-1).** Un caso `PENDIENTE` que sigue en un despacho `CERRADO` **es
despachable**: el cierre no lo reasignó, solo lo devolvió a la bolsa. Un caso `CERRADO`,
`CANCELADO` o `ENRUTADO` sigue fuera por su estado, no por su vínculo.

---

## 2. Punto 2 — Cambiar la asignación de las masivas desde el proceso

El formulario muestra ahora la tabla **FALLAS MASIVAS Y SU CUADRÍLLA** (id, descripción, número
de casos y un selector de cuadrilla por masiva). Al procesar:

1. `POST /despachos/procesar` acepta `masivas: [{id_falla, id_cuadrilla}]` y
   `asignar_masivas` **persiste** la cuadrilla elegida en `falla_masiva.id_cuadrilla`.
2. El reparto consulta los vínculos explícitos `falla_masiva_caso` (DEC-MA-1): **cada caso de
   una masiva con cuadrilla se despacha a esa cuadrilla, aunque su sector esté asignado a
   otra** (`overrides_de_masivas`).
3. Los casos de masiva viajan al despacho con `tipo_asignacion = FALLA_MASIVA` (antes se
   guardaban como `REPARACION`), que es lo que ya esperaba el icono MASIVA de D-110/RF-71 y
   lo que permite al checklist distinguirlos.

**Validaciones.** La masiva debe existir en la central (404), no puede estar `CERRADA` (409) y
la cuadrilla destino no puede ser la **cuadrilla 0** del supervisor (400), que no atiende
fallas masivas. Dejar el selector en «Sin cuadrilla» desasigna la masiva (sus casos vuelven a
repartirse por sector).

**Decisión (DEC-113-2).** La cuadrilla de la masiva **manda sobre el sector**. Es el único
caso en que se rompe la regla «un sector va completo a su cuadrilla»: una masiva puede cruzar
varios sectores y el negocio decide quién la atiende. El cambio se aplica en el mismo
procesamiento (no requiere una llamada aparte) y queda en la ficha de MASIVAS (D-111).

---

## 3. Punto 3 — Checklist de tipos a distribuir

En el formulario, antes del universo de casos:

| Tipo | Clave | Qué incluye | ¿Por defecto? |
|---|---|---|---|
| **Comunes** | `COMUNES` | reparaciones residenciales (`REPARACION`) | **Sí** |
| **Referidos** | `REFERIDOS` | categoría `REFERIDO` | **Sí** |
| Construcciones | `CONSTRUCCIONES` | `tipo_caso = CONSTRUCCION` | No |
| Empresas | `EMPRESAS` | categoría `EMPRESA` o `GOBIERNO` | No |
| Masivas | `MASIVAS` | casos asociados a una falla masiva (`es_falla_masiva`) | No |

El orden de prelación de un caso con más de una marca es el de la tabla (la construcción y el
referido mandan sobre «masiva»), y es **el mismo** que usa `tipo_asignacion` para el despacho,
de modo que el checklist y la columna **Casos** de D-110 cuentan lo mismo.

**Comportamiento:**

- `GET /despachos/proceso` devuelve `tipos` con la etiqueta, el total del universo y
  `por_defecto` (solo Comunes y Referidos), más `universo.por_tipo` y
  `tipo_distribucion` en cada caso.
- `POST /despachos/procesar` acepta `tipos`; **sin `tipos` distribuye todos** (compatibilidad
  con las llamadas anteriores). Una lista vacía o un tipo desconocido es **400**: el
  procesamiento nunca deja la jornada sin casos por un error de tecleo.
- Los casos de tipos no marcados **no se despachan** y la interfaz los marca «no se
  distribuye».
- Los totales por sector, por cuadrilla y el aviso de «sin cuadrilla» se recalculan en pantalla
  con los tipos marcados, y el botón **Procesar despacho** se deshabilita si no hay ninguno
  marcado o si no hay casos en el universo para esa selección.
- `POST /despachos/propuesta` admite `tipos` (texto separado por comas) para simular con la
  misma selección.

**Decisión (DEC-113-3).** El predeterminado **Comunes + Referidos** vive en el servidor
(`TIPOS_DISTRIBUCION_POR_DEFECTO` y el campo `por_defecto`) y la interfaz lo obedece; no se
almacena por jornada: cada apertura del formulario vuelve al predeterminado, que es lo que
pidió la operación.

**Decisión (DEC-113-4).** Un caso de masiva cuya cuadrilla no depende del sector no exige
asignar el sector para poder procesar (el formulario cuenta solo los casos «asignables»), de
modo que una masiva reasignada no bloquea el primer procesamiento con sectores vacíos.

---

## 4. Trazabilidad

| ID | Requisito / regla |
|---|---|
| RF-67 | Primer procesamiento de la jornada: sectores y tipos antes de procesar |
| RF-68 | Reproceso: reasignación por sector con aviso a los técnicos |
| RF-71 | Icono y seguimiento de la falla masiva por cuadrilla |
| RF-95 | Cada caso queda en su cuadrilla al procesar |
| RF-96 | La columna Casos desglosa comunes, referidas y construcciones |
| RNF-47 | La mensajería de la cuadrilla sigue emitiéndose al procesar |
| RT-36 | Pruebas de integración de pendientes, checklist y masivas |
| DEC-113-1…4 | Decisiones del incremento |

---

## 5. Archivos

| Archivo | Cambio |
|---|---|
| `app/services/despacho.py` | Tipos de distribución, `_filtro_universo` del proceso, `overrides_de_masivas`, `asignar_masivas`, `tipos_disponibles`, `proceso`, `construir_propuesta` |
| `app/schemas/despacho.py` | `TipoDespachoOut`, `AsignacionMasiva`, campos nuevos en `CasoAsignadoOut`, `UniversoOut`, `MasivaProcesoOut`, `ProcesoDespachoOut` y `ProcesarDespacho` |
| `app/api/routes_despachos.py` | `tipos` en `/propuesta` y `/procesar`, persistencia de masivas y universo del formulario |
| `app/web/src/components/ProcesarDespacho.tsx` | Checklist, tabla de masivas, totales recalculados y payload |
| `app/web/src/pages/Despacho.tsx` | Nota: la simulación incluye todos los tipos; el proceso aplica el checklist |
| `app/web/src/api/types.ts` · `client.ts` | Tipos y parámetros nuevos |
| `app/web/src/styles.css` | `.lista-casillas` (checklist) |
| `app/tests/test_d113_despacho_tipos.py` | **8 pruebas** nuevas |

---

## 6. Verificación

| Prueba | Resultado |
|---|---|
| `pytest` (PostgreSQL 18 temporal, esquema `ggto_test`) | **411/411 en verde** (402 previas + **9 nuevas**) en 514,66 s |
| `ruff check` en los archivos tocados | limpio (quedan 6 avisos **preexistentes** en `routes_auditoria.py`, `mensaje_entities.py` y `test_d81_mensajes_api.py`, ajenos a este incremento) |
| `mypy` en los módulos tocados | **«no issues found»** |
| `tsc` + `vite build` | en verde · `index-CO2XSR-V.js` + `index-Dmh5MpZP.css` |

**Render real del bundle** (Playwright/Chromium con la API interceptada, sin tocar base de
datos), con un universo de 10 casos (4 comunes, 2 referidos, 1 construcción, 1 empresa y 2 de
masiva) y una masiva asignada a C-001:

| Comprobación | Resultado |
|---|---|
| Checklist | 5 casillas; **Comunes y Referidos marcadas**; el resto no |
| «A distribuir» / tarjetas | **6** casos · C-001 **3** · C-002 **3** |
| Marcar **Masivas** | **8** casos · C-001 **5** (los 2 de la masiva) · C-002 **3** |
| Cambiar la masiva a **C-002** | C-001 **3** · C-002 **5** y el chip MASIVA en la tarjeta de C-002 |
| Cuerpo del `POST /despachos/procesar` | `tipos: [COMUNES, REFERIDOS, MASIVAS]` y `masivas: [{id_falla: 7, id_cuadrilla: 12}]` |
| Errores de consola | **0** |

Captura: `C:\GGTO\pgtmp\d113-proceso-despacho.png`.

**Corrección colateral de una prueba obsoleta.** La suite completa destapó que
`test_casos_api.py::test_cierre_registra_actividad_evidencias_y_estado` seguía exigiendo
**403** al TÉCNICO en `POST /casos/{id}/cierre`, contrato que **D-112 (DEC-112-1)** cambió al
habilitar el cierre desde la APK. La prueba se actualiza a lo que rige hoy: el TÉCNICO cierra
un caso abierto (**200 · CERRADO**) y un caso ya cerrado no se vuelve a cerrar (**409**).

Pruebas nuevas:

- `test_el_proceso_incluye_los_pendientes_del_cierre` — procesa ayer, ejecuta el corte de
  jornada (9 casos a `PENDIENTE`) y comprueba que el formulario y el procesamiento de hoy los
  recuperan.
- `test_el_proceso_expone_el_checklist_con_comunes_y_referidos_por_defecto` — los cinco tipos,
  sus totales, `por_defecto` y `tipo_distribucion` por caso.
- `test_procesar_solo_distribuye_los_tipos_marcados` — con Comunes y Referidos solo se
  despachan esos 6 casos.
- `test_procesar_sin_tipos_mantiene_el_comportamiento_anterior` — compatibilidad (9 casos).
- `test_los_tipos_invalidos_o_vacios_son_400`.
- `test_la_masiva_reasignada_arrastra_sus_casos_a_la_nueva_cuadrilla` — el cambio se persiste
  y manda sobre el sector.
- `test_el_proceso_expone_los_casos_de_cada_masiva` — casos e ids para el selector.
- `test_la_masiva_no_se_asigna_a_la_cuadrilla_0` — 400.
- `test_el_proceso_no_reofrece_los_casos_de_un_despacho_publicado` — una jornada
  publicada no se reprocesa; el borrador del día sí se reofrece.

---

## 7. Pendiente

- Prueba de aceptación en la web desplegada y regeneración de los manuales (HTML/PDF) que
  describen el formulario de proceso.
- La APK no cambia: sigue recibiendo el despacho ya procesado por la API.

---

## 8. Entrega

| Paso | Resultado |
|---|---|
| Commit | `1913318` · `feat(despacho): D-113 pendientes del cierre, masivas reasignables y checklist de tipos` (12 archivos) |
| Push | GitHub `anlucorporations/GGTO` y GitLab `anlucorporations/ggto` en `1913318` |
| Imagen | `ggto-web:v47` · Cloud Build **SUCCESS** en 1M42S (digest `sha256:fbf69ee…`) |
| Revisión | **`ggto-web-00060-lrm`** con el 100 % del tráfico (sustituye a `00059-qw8`/v46) |
| Humo | `/health` `/ready` `/` `/manual/` → **200** · PostgreSQL 15.18 · 43 tablas |
| Bundle | `index-CO2XSR-V.js` + `index-Dmh5MpZP.css` (idéntico al build local) |
| Contrato | `/openapi.json`: `tipos`, `masivas`, `tipo_distribucion`, `en_gestion` |
| Datos vivos | `GET /despachos/proceso`: 61 casos · 54 `PENDIENTE` · Comunes 20 / Referidos 4 / Construcciones 30 / Empresas 0 / Masivas 7 · masiva #31 en C-001 con 23 casos |
