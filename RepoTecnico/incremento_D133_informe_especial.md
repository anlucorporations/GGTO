# Incremento D-133 — El informe del especial se exige y se guarda (H-16)

| Campo | Valor |
|---|---|
| Petición | Resolver **H-16** de la [auditoría V3](INFORME_OPTIMIZACION_V3.md). Opción aplicada (la recomendada): **exigir y guardar el informe** |
| Fecha | 2026-10-20 |
| Alcance | Backend + web + APK · **`1.15.9+34`** publicada · despliegue **v65** · migración **aplicada en producción** |
| Autor | Dirección del proyecto |

---

## 1. El defecto

`requiere_informe` se mostraba y se editaba, pero **ningún camino** exigía el
informe: ni la APK, ni la web, ni el backend. Un especial podía pasar a
`ATENDIDO`/`CERRADO` sin la menor constancia de la atención prestada.

---

## 2. Corrección

### 2.1 El backend lo exige (regla única)

`caso_especial` gana el campo **`informe`** (`text`, migración
`scripts/migrar_d133_informe_especial.py`, **aplicada y verificada en producción**).

`PATCH /casos-especiales/{id}` (`actualizar_especial`):

- si `requiere_informe` es verdadero y el **estado destino** es `ATENDIDO` o
  `CERRADO` (`ESTADOS_ESPECIAL_FINALES`), el `informe` debe tener **≥ 20
  caracteres** (en el mismo PATCH o ya guardado antes) → si no, **422** con el
  motivo;
- sin `requiere_informe`, o con un estado no final, no se exige nada.

### 2.2 La APK lo pide al cerrar

El diálogo «Cerrar el caso» del especial muestra el campo **Informe de atención**
solo cuando el especial lo requiere y no deja confirmar con menos de 20
caracteres. Tras cerrar el caso, el informe se guarda con `PATCH` al especial (si
fallara el guardado, el cierre no se pierde y se avisa al técnico).

### 2.3 La web lo edita

La ficha del especial muestra el **texto del informe** y su edición incluye un
área de texto «Informe de atención» cuando el caso lo requiere; el PATCH envía el
campo solo si cambió.

---

## 3. Verificación

| Comprobación | Resultado |
|---|---|
| Backend (suite completa) | **488/488 en verde** (6 nuevas de D-133; `test_especiales_api` adaptado: cierre sin informe → 422, con informe → 200) |
| APK | **253/253 en verde** (4 nuevas de widget del diálogo) · `flutter analyze` sin hallazgos |
| Web | `tsc --noEmit` limpio (tipos `informe` en `CasoEspecialOut`/`CasoEspecialUpdate`) |
| Migración | aplicada y verificada en producción `{informe: 0} → {1}` |
| Contrato | `/openapi.json` expone `informe` en los esquemas del especial |

---

## 4. Cambios por archivo

| Archivo | Cambio |
|---|---|
| `app/models/especiales_entities.py` | `CasoEspecial.informe`. |
| `RepoTecnico/db/schema.sql` | columna en el CREATE y `ALTER … IF NOT EXISTS` (13.9). |
| `scripts/migrar_d133_informe_especial.py` | **Nuevo**: migración idempotente. |
| `app/schemas/especiales.py` | `informe` en `CasoEspecialOut` y `CasoEspecialUpdate`. |
| `app/api/routes_especiales.py` | Regla del informe al cerrar. |
| `app/tests/test_d133_informe_especial.py` | **Nuevo**: 6 pruebas. |
| `app_movil/lib/features/especiales/especiales_screen.dart` | Campo del informe en el diálogo de cierre + guardado. |
| `app_movil/test/d133_informe_especial_test.dart` | **Nuevo**: 4 pruebas de widget. |
| `app/web/src/pages/Especiales.tsx`, `api/types.ts` | Campo y envío del informe. |

---

## 5. Siguiente hallazgo

**H-17** — el `PATCH` del especial se salta las reglas de transición (cambia
`estado` a cualquier valor sin validar el flujo) y es la vía que usa el cierre
administrativo. Se consulta al usuario.
