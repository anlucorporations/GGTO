# Incremento D-142 — Accesibilidad de la pantalla Sincronizar (H-25)

| Campo | Valor |
|---|---|
| Petición | Resolver **H-25** (último hallazgo) de la [auditoría V3](INFORME_OPTIMIZACION_V3.md). Opción aplicada (la recomendada): **contraste + semántica + confirmación** |
| Fecha | 2026-10-21 |
| Alcance | APK · **`1.15.15+40`** publicada · despliegue **v74** · sin cambios de API |
| Autor | Dirección del proyecto |

---

## 1. El defecto

La pantalla **Sincronizar** tenía tres problemas de accesibilidad y de confianza:

1. **Contraste**: usaba `Colors.orange.shade800`, `Colors.red`, `Colors.orange` y
   `Colors.blueGrey` (Material) en los avisos y en las tarjetas de la cola; varios
   no alcanzaban el **4,5:1** exigido sobre el fondo/texto.
2. **Semántica**: la barra de progreso no se anunciaba a los lectores de pantalla.
3. **Purga silenciosa**: la actualización completa **quita del teléfono** los casos
   no atendidos de jornadas anteriores y no lo advertía antes de hacerlo.

---

## 2. Corrección

1. **Colores de marca** (`core/theme.dart` → `Marca`): los avisos y las tarjetas de
   la cola usan `Marca.alerta`, `Marca.error` y `Marca.textoSuave` (contraste ≥
   4,5:1 con su texto).
2. **Progreso accesible**: la barra se envuelve en `Semantics(label: 'Progreso de la
   sincronización', value: '<porcentaje> por ciento: <fase>', liveRegion: true)`, de
   modo que el avance se lee sin volver a enfocar (y en reposo anuncia el resumen
   de la cola).
3. **Confirmación antes de purgar**: nuevo diálogo `ConfirmarSincronizacionDialog`
   que explica que los casos **no atendidos** de jornadas anteriores se quitarán del
   teléfono (no del servidor), con Cancelar/Actualizar; el resumen final ya anuncia
   cuántos se descartaron (`… descartados de jornadas anteriores`).

---

## 3. Verificación

| Comprobación | Resultado |
|---|---|
| APK `flutter test` | **267/267 en verde** (2 nuevas de D-142) · `flutter analyze` sin hallazgos |
| Pruebas nuevas | el diálogo explica la purga y **cancelar** devuelve `false` sin actualizar; **confirmar** devuelve `true` |
| Contraste | colores tomados de `Marca` (los mismos tokens que usa `BarraProgresoSync`, ya validados a ≥ 4,5:1) |
| Backend / esquema | sin cambios |

---

## 4. Cambios por archivo

| Archivo | Cambio |
|---|---|
| `app_movil/lib/features/sync/sync_screen.dart` | Colores de marca, confirmación previa y diálogo público. |
| `app_movil/lib/widgets/barra_progreso_sync.dart` | `Semantics` con `liveRegion` sobre la barra. |
| `app_movil/test/d142_sincronizar_accesibilidad_test.dart` | **Nuevo**: 2 pruebas de widget. |
| `app_movil/pubspec.yaml`, `core/constants.dart` | Versión **1.15.15+40**. |

---

## 5. Estado de la auditoría V3

Con D-142 quedan resueltos **H-01, H-04 y H-06 a H-25**. Los hallazgos que quedaron
abiertos de la primera versión del informe (H-02, H-03, H-05) ya se habían cerrado
en D-120/D-121.
