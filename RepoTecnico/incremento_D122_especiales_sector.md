# Incremento D-122 — El alta de un especial exige sector y avisa si no llega hoy (H-04)

| Campo | Valor |
|---|---|
| Petición | Resolver **H-04** de la [auditoría V3](INFORME_OPTIMIZACION_V3.md). Decisión del usuario: **exigir sector y avisar** cuando la jornada ya está publicada |
| Fecha | 2026-10-19 |
| Alcance | Backend + web + APK · APK **`1.15.2+27`** publicada · despliegue **v54** |
| Autor | Dirección del proyecto |

---

## 1. El defecto

El alta de un caso especial creaba su caso `REF-…` y **nada más**: sin fila en
`despacho_caso`. Como `GET /sync/descarga` arma la lista con el **último despacho
de cada caso**, un especial creado **después** de procesar la jornada no se
descargaba nunca: el técnico no lo veía y no podía cerrarlo. Y si la dirección no
coincidía con ningún patrón de sector, el caso caía en «sin asignar» y no llegaba
a **ninguna** cuadrilla, sin aviso.

Datos de producción en el momento del cambio: **46 especiales**, de los que **2 no
tenían sector** (los que nunca podían despacharse) y 34 seguían pendientes.

---

## 2. Corrección (opción elegida: exigir sector y avisar)

### 2.1 El sector es obligatorio en el alta

`POST /casos-especiales` (solo cuando **crea** el caso asociado):

- El sector se resuelve por la **dirección** (patrones del catálogo), como antes.
- Se admite **`id_sector` explícito** en el cuerpo (nuevo campo) para las
  direcciones que no coinciden con ningún patrón; se valida que pertenezca a la
  central de la sesión.
- Si no hay sector por ninguna de las dos vías → **422** con el motivo:
  «La dirección no coincide con ningún sector de la central: corrija la dirección
  o indique `id_sector`. Sin sector, el caso especial no se puede despachar a
  ninguna cuadrilla y no llega a la APK.»

### 2.2 Aviso cuando el especial no llegará hoy

La respuesta del alta (`CasoEspecialOut.aviso`) explica, sin bloquear:

| Situación | Aviso |
|---|---|
| La jornada de hoy ya está **PUBLICADA** o **CERRADA** | «…se incluirá en el despacho de la próxima jornada. Si debe atenderse hoy, asígnelo a una cuadrilla desde DESPACHO.» |
| El sector **no tiene cuadrilla** asignada hoy (`cuadrilla_sector_dia`) | «…se despachará cuando el supervisor asigne el sector a una cuadrilla.» |
| Sector y cuadrilla del día correctos | sin aviso (`null`) |

La **web** y la **APK** muestran ese aviso al crear el especial (la APK en un
diálogo, para que no se pierda en un snackbar).

---

## 3. Verificación

| Comprobación | Resultado |
|---|---|
| Backend (suite completa) | **454/454 en verde** (6 nuevas de D-122) |
| APK `flutter test` | **223/223 en verde** · `flutter analyze` sin hallazgos |
| Web | `tsc --noEmit` **sin errores** |
| Pruebas nuevas | alta sin sector → 422; con sector y cuadrilla del día → **sin aviso**; con sector sin cuadrilla → aviso; con jornada publicada → aviso «publicada»; con `id_sector` explícito en una dirección sin patrón → **201**; `id_sector` inexistente → 422 |
| Ajustes de pruebas existentes | las altas de `test_d81_panel_api`, `test_d90_clasificacion` y del entorno de D-120 crean ahora su sector (la regla nueva las afectaba) |

---

## 4. Cambios por archivo

| Archivo | Cambio |
|---|---|
| `app/api/routes_especiales.py` | Sector obligatorio (o `id_sector`), validación de central y `_aviso_de_despacho`. |
| `app/schemas/especiales.py` | `id_sector` en el alta y `aviso` en la salida. |
| `app/tests/test_d122_especiales_sector.py` | **Nuevo**: 6 pruebas. |
| `app/tests/test_d81_panel_api.py`, `test_d90_clasificacion.py`, `test_d120_especiales_estado.py` | Crean su sector antes del alta. |
| `app/web/src/api/types.ts`, `pages/Especiales.tsx` | Campo `aviso` y mensaje al crear. |
| `app_movil/lib/features/especiales/especiales_screen.dart` | Diálogo con el aviso del servidor. |
| `app_movil/pubspec.yaml`, `core/constants.dart` | Versión **1.15.2+27**. |

---

## 5. Siguiente hallazgo

**H-06** — un caso reasignado a mitad de jornada se rechaza desde `/sync/carga`
indefinidamente (y el cierre online entra por otra vía que no valida cuadrilla).
Se consulta al usuario antes de implementarlo.
