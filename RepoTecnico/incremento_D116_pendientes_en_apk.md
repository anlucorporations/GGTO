# Incremento D-116 — Los casos PENDIENTE del despacho se gestionan desde la APK

| Campo | Valor |
|---|---|
| Petición | Verificar que el usuario de la APK pueda **gestionar también los casos PENDIENTE** asignados en su despacho |
| Fecha | 2026-10-19 |
| Alcance | APK (`app_movil`) · sin cambios de API ni de esquema · misma entrega **`1.13.0+22`** |
| Autor | Dirección del proyecto |

---

## 1. Qué se verificó

El caso `PENDIENTE` nace cuando el **cierre de jornada** devuelve a la bolsa los
casos que no se cerraron (D-99). En el siguiente despacho, el servidor los vuelve
a incluir y la APK los descarga:

- `GET /sync/descarga` filtra solo los estados **terminales**
  (`CERRADO`, `CANCELADO`, `ENRUTADO`), así que un `PENDIENTE` **sí viaja**.
- El listado principal oculta solo los **gestionados** (`CERRADO`, `CANCELADO`,
  `ENRUTADO`, `DIFERIDO`, `CITADO`); un `PENDIENTE` **sí se ve**.

El defecto estaba en la **ficha**: `accionesDeEstado()` no contemplaba
`PENDIENTE`, así que el PIE no ofrecía ninguna acción y mostraba el texto
«El caso no admite acciones desde la app en su estado actual». El técnico veía el
caso, pero no podía contactarlo, marcarlo «No contesta», agendarlo ni atenderlo.

---

## 2. Corrección

`app_movil/lib/features/casos/acciones_caso.dart`:

```dart
case 'NUEVO':
case 'PENDIENTE':
case 'ASIGNADO':
case 'EN_GESTION':
  return {
    AccionCaso.marcarContactado,
    AccionCaso.noContesta,
    AccionCaso.agendarCita,
  };
```

Con eso, un `PENDIENTE` ofrece las mismas acciones iniciales que un `NUEVO`:
**Contactado**, **No contesta** y **Agendar**. Al contactarlo pasa a `CONTACTADO`
y aparece **Atender** (cerrar, enrutar o diferir), igual que cualquier caso del
día. La edición de dirección y contacto ya estaba permitida (`puedeEditarContacto`
solo bloquea los terminales).

Además, `app_movil/lib/widgets/estado_icono.dart` gana el caso `PENDIENTE`
(`Icons.pending_actions` con el ámbar de marca), para que en el listado y en la
ficha se distinga de un estado desconocido en vez de caer en el icono genérico.

---

## 3. Servidor

No hizo falta cambiar el backend: `POST /casos/{id}/estado`, `/cita`,
`/no-contesta` y `/cierre` no bloquean `PENDIENTE`; solo rechazan los estados
terminales o el mismo estado. Se añadió una prueba de integración que lo fija:

- un caso `PENDIENTE` vinculado al **despacho de hoy** se descarga para el
  técnico;
- el técnico lo pasa a `CONTACTADO` y luego lo **cierra** con `COS` (**200**).

---

## 4. Verificación

| Comprobación | Resultado |
|---|---|
| `flutter analyze` | **No issues found!** |
| `flutter test` | **202/202 en verde** (nueva prueba del PIE en `PENDIENTE`) |
| `pytest` de integración | **1/1** (`test_el_pendiente_del_despacho_se_descarga_y_el_tecnico_lo_gestiona`) |
| Sin cambios de API ni de esquema | El backend no requiere redeploy |

**Pendiente:** la prueba en dispositivo y la publicación de la APK `1.13.0+22`,
que ya incluye D-115 y esta corrección.
