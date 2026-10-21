# Incremento D-139 — Una FK inválida rechaza su ítem, no el lote (H-22)

| Campo | Valor |
|---|---|
| Petición | Resolver **H-22** de la [auditoría V3](INFORME_OPTIMIZACION_V3.md). Opción aplicada (la recomendada): **rechazo por ítem** |
| Fecha | 2026-10-20 |
| Alcance | Backend · despliegue **v71** · APK sin cambios |
| Autor | Dirección del proyecto |

---

## 1. El defecto

`id_metodo` y `id_causa` que manda la APK en las actividades **no se validaban**
contra sus catálogos. Si el id no existía (catálogo recargado, dato corrupto, APK
con caché vieja), el `INSERT` de la actividad violaba la FK y la petición terminaba
en **500**: se perdía **todo el lote**, incluidas las acciones correctas del técnico.

---

## 2. Corrección

`app/services/sync.py` gana `_fk_invalida(db, act)` y la usa **antes** de crear la
actividad (después de validar el acceso al caso):

| Caso | Resultado |
|---|---|
| `id_metodo`/`id_causa` ausentes o vacíos | se acepta (son opcionales) |
| id que **no existe** en el catálogo | ese ítem se **rechaza** con «El método N no existe en el catálogo» y el resto del lote se aplica |
| valor no numérico | lo corta el **esquema** (422, nunca llega a la base) |

El rechazo es **por ítem**: viaja en `items` (con `aceptada: false` y su `mensaje`),
la acción queda en la cola de la APK como `ERROR` visible (D-121) y **no** se
registra la actividad.

---

## 3. Verificación

| Comprobación | Resultado |
|---|---|
| Backend (suite completa) | **504/504 en verde** (4 nuevas de D-139) |
| Pruebas nuevas | método inexistente → ese ítem rechazado y el válido **aceptado** (solo 1 actividad creada); causa inexistente → rechazo por ítem; `id_metodo` no numérico → 422 del esquema (no 500); sin método ni causa → aceptada |
| APK | sin cambios: ya muestra el rechazo por ítem (D-121) |

---

## 4. Cambios por archivo

| Archivo | Cambio |
|---|---|
| `app/services/sync.py` | `_fk_invalida` y su uso en el bucle de actividades. |
| `app/tests/test_d139_fk_lote.py` | **Nuevo**: 4 pruebas. |

---

## 5. Siguiente hallazgo

**H-23** — la salvaguarda de la cuadrilla de gestión (C-00) es **inerte** mientras
C-00 tenga casos: la purga protege todo lo que está en su despacho. Se consulta al
usuario.
