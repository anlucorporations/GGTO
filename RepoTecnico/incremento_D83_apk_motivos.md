# Incremento D-83 — La APK explica por qué no hay casos (y no pierde la cuadrilla de campo)

- **Fecha:** 2026-10-07
- **Origen:** reporte del usuario — «la APK no muestra los archivos locales; al
  sincronizar dice NO HAY CASOS NUEVOS y en la pantalla principal no muestra los
  casos».
- **Estado:** implementado, probado y con la APK `1.0.0+4` publicada.

## 1. Diagnóstico (con datos de producción)

La APK del teléfono **no tenía el defecto**: el `sync_log` de producción muestra
catorce sesiones del P00 **153806** con la versión **`1.0.0+3`** (el arreglo de
«contenido local» de D-82 sí estaba instalado) y **`recibidos: 0` en todas**,
desde la primera sincronización en un dispositivo sin caché.

El servidor resolvía **cuadrilla 1 = `C-00` «Gestión (Supervisor)»**
(`es_supervisor = true`), que **no recibe despacho de campo**: 0 casos, frente a
los 23/23/18 de las cuadrillas de campo `C-001`/`C-002`/`C-003`.

| Cuadrilla | Nombre | `es_supervisor` | Casos (último despacho) |
|---|---|---|---|
| 1 | C-00 · Gestión (Supervisor) | **sí** | **0** |
| 11 | C-001 · Hilux | no | 23 (8 `NUEVO`) |
| 8 | C-002 · Nissan | no | 23 (21 `NUEVO`) |
| 12 | C-003 · Trimoto | no | 18 (12 `NUEVO`) |

`id_tecnico 8` (Angel Lucci) era integrante **solo de C-00**, y con **dos filas
activas** (`SUPERVISOR` desde 28-09 y `REPARADOR_PRINCIPAL` desde 02-10: el alta
del 02-10 se hizo sobre C-00 en lugar de una cuadrilla de campo).

**Consecuencia:** `GET /sync/descarga` devolvía `{"casos": []}` y la APK lo
anunciaba como «No hay casos nuevos ni cambios», indistinguible de «ya tiene
todo». La pantalla principal mostraba «No tiene casos asignados» porque el
dispositivo tenía **0 casos guardados**.

## 2. Defectos corregidos

1. **DESCARGA muda** (`app/services/sync.py`): los cuatro casos vacíos —sin
   técnico, sin cuadrilla, cuadrilla de gestión y cuadrilla sin despacho— y el
   diferencial sin cambios devolvían todos el mismo `casos: []`. Ahora la
   respuesta incluye `motivo`, `mensaje`, `cuadrilla` y `casos_cuadrilla`:

   | `motivo` | Cuándo | Mensaje al técnico |
   |---|---|---|
   | `SIN_TECNICO` | la cuenta no está vinculada a un técnico | «pida a su supervisor que la registre» |
   | `SIN_CUADRILLA` | el técnico no tiene cuadrilla vigente | «pida a su supervisor que lo asigne» |
   | `CUADRILLA_GESTION` | su cuadrilla es de gestión (C-00) | «no recibe trabajo de campo» |
   | `SIN_DESPACHO` | cuadrilla de campo sin casos despachados | «no tiene casos despachados todavía» |
   | `SIN_PENDIENTES` | hay despachados pero todos cerrados | «no tiene casos pendientes» |
   | `SIN_CAMBIOS` | el diferencial no trae nada nuevo | «el dispositivo ya los tiene todos» |
   | `OK` | hay casos que entregar | «N caso(s) de su cuadrilla C-xxx» |

2. **Resolución de cuadrilla** (`_cuadrilla_activa`): con varias pertenencias
   vigentes se prefiere, en este orden, la **abierta** (`hasta` nula, la que la
   web muestra como activa), la de **campo** sobre la de gestión y la asignación
   más reciente. Mover a un técnico de C-00 a una cuadrilla de campo surte efecto
   **el mismo día**.

3. **Doble pertenencia activa** (`app/api/routes_config.py`): `POST
   /cuadrillas/{id}/integrantes` responde **409** si el técnico ya es integrante
   activo, y `DELETE …/integrantes/{id_tecnico}` cierra **todas** las
   pertenencias activas (antes solo la primera, así que un duplicado seguía
   dejando al técnico en la cuadrilla).

4. **Marca de agua del diferencial** (APK): el `desde` que se envía ya no es el
   reloj del teléfono (`MAX(actualizado_en)` local) sino el **`server_ts`** de la
   última descarga, persistido en `app_meta`. Un reloj adelantado hacía que todo
   pareciera «ya modificado» y la DESCARGA no trajera nunca nada.

## 3. Cambios en la APK

- `download_service.dart`: `ResultadoDescarga` con `motivo`, `mensaje`,
  `cuadrillaCodigo` y `casosCuadrilla`; `resumen` usa el mensaje del servidor
  cuando no hay novedades; nueva marca de agua con respaldo en el
  comportamiento anterior (dispositivos que venían de `1.0.0+3`).
- `casos_provider.dart`: conserva el motivo/mensaje/cuadrilla de la última
  descarga y expone `explicacionSinCasos`.
- `casos_screen.dart`: el estado vacío usa el mensaje del servidor y su icono
  (persona, grupo, supervisor…), muestra la cuadrilla y su total de casos
  despachados, y la franja rotula «Cuadrilla C-xxx · Contenido local · N casos…».
- Versión **`1.0.0+4`** (`pubspec.yaml` y `AppConstants.version`).

## 4. Verificación

| Prueba | Resultado |
|---|---|
| `pytest` suite completa contra `ggto_test` (PostgreSQL 18) | **298/298 en verde** |
| `pytest app/tests/test_sync_api.py` (6 pruebas nuevas D-83) | **29/29** |
| `ruff` y `mypy` | sin hallazgos |
| `flutter analyze` | sin hallazgos (69,4 s) |
| `flutter test` | **20/20** + **5/5** nuevas (`d83_descarga_test.dart`) |
| APK firmada | `1.0.0+4` · 22,7 MB · SHA-256 `51eb8decc582b1e92ac358f9f06534b8baeb726cac6fe75be309597725f365af` · `CN=GGTO Tecnico` |
| Publicación | `app_movil/GGTOv2.apk` **y** `app/web/public/apk/` (`ggto-tecnico.apk` + `apk.json` con `versión 1.0.0+4`) |
| Marcadores en el APK | `CUADRILLA_GESTION`, `SIN_CUADRILLA`, `ultima_descarga_ts`, `Contenido local`, `1.0.0+4` presentes |

## 5. Pendientes operativos (datos, no código)

1. **El técnico `153806` sigue en C-00 (Gestión)**: con D-83 la APK ya explica el
   motivo, pero para que **reciba casos** hay que (a) añadirlo a una cuadrilla de
   campo (`C-001`/`C-002`/`C-003`) o (b) asignar casos a `C-00`.
2. **Limpiar la doble pertenencia** de `id_tecnico 8` en C-00 (el guardado nuevo
   impide crear más, pero la fila duplicada heredada permanece hasta retirarlo).
3. **No hay despachos del 06-10 ni del 07-10** (el último es del 05-10): la
   DESCARGA entrega igualmente el último despacho de cada caso, pero el trabajo
   nuevo del día exige procesar el despacho.
