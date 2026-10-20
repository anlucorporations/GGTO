# Incremento D-138 — El dispositivo queda vinculado al primer técnico (H-21)

| Campo | Valor |
|---|---|
| Petición | Resolver **H-21** de la [auditoría V3](INFORME_OPTIMIZACION_V3.md). Decisión del usuario: **«solo el usuario que inicia por primera vez puede acceder»** |
| Fecha | 2026-10-20 |
| Alcance | APK · **`1.15.12+37`** publicada · despliegue **v70** · sin cambios de API |
| Autor | Dirección del proyecto |

---

## 1. El defecto

La caché de casos y la cola offline son del **dispositivo** (una sola base local),
no del técnico:

- sobreviven al **cierre de sesión**, así que el siguiente técnico que entra en el
  mismo teléfono ve los casos del anterior —con su **PII** (nombre, teléfono,
  dirección)— y puede **enviar su trabajo** (contadores y bitácora a nombre del
  otro P00);
- el bloqueo con PIN no lo impedía: al desbloquear con la clave de sesión o tras un
  reset de credenciales, la base seguía siendo la del anterior.

---

## 2. Corrección: vínculo del dispositivo

`app_movil/lib/core/vinculo_dispositivo.dart` (nuevo, función **pura**):

- `claveP00Dispositivo` (`dispositivo_p00`) marca al **primer** P00 que inicia
  sesión en el teléfono.
- `vinculoPermite(vinculado, p00)` → sí si no hay vínculo o si es el mismo P00
  (sin distinguir mayúsculas); **no** para cualquier otro.

`AuthProvider.login`:

1. tras un login correcto, lee el vínculo;
2. si el P00 **no** es el dueño → borra el token recién emitido, no guarda sesión y
   devuelve `mensajeDispositivoVinculado` («Este dispositivo está vinculado a otro
   usuario… haga el restablecimiento completo en DISPOSITIVO → Restablecer»);
3. si es el primero → guarda el vínculo.

El **cierre de sesión no borra nada**: el mismo técnico puede volver a entrar y
conservar su trabajo pendiente. Para **entregar el teléfono** está el
restablecimiento completo (D-120), que borra `app_meta` —y con ello el vínculo— de
modo que el siguiente acceso vuelve a ser «el primero».

---

## 3. Verificación

| Comprobación | Resultado |
|---|---|
| APK `flutter test` | **265/265 en verde** (4 nuevas de D-138) · `flutter analyze` sin hallazgos |
| Pruebas nuevas | sin vínculo entra el primero; el mismo P00 (y con otras mayúsculas/espacios) vuelve a entrar; **otro P00 queda bloqueado**; el mensaje explica el restablecimiento |
| Restablecimiento | `reiniciarTodo` ya borra `app_meta`, que incluye el vínculo (D-120) |
| Backend / esquema | sin cambios |

---

## 4. Cambios por archivo

| Archivo | Cambio |
|---|---|
| `app_movil/lib/core/vinculo_dispositivo.dart` | **Nuevo**: vínculo y mensaje. |
| `app_movil/lib/features/auth/auth_provider.dart` | Valida/registra el vínculo en `login`. |
| `app_movil/test/d138_vinculo_dispositivo_test.dart` | **Nuevo**: 4 pruebas. |
| `app_movil/pubspec.yaml`, `core/constants.dart` | Versión **1.15.12+37**. |

---

## 5. Siguiente hallazgo

**H-22** — `id_metodo`/`id_causa` del cliente no se validan: una FK rota tumba el
**lote entero** con 500. Se consulta al usuario.
