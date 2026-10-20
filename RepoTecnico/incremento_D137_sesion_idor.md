# Incremento D-137 — Solo el dueño cierra su sesión de sincronización (H-20)

| Campo | Valor |
|---|---|
| Petición | Resolver **H-20** de la [auditoría V3](INFORME_OPTIMIZACION_V3.md). Opción aplicada (la recomendada): **dueño o gestor** |
| Fecha | 2026-10-20 |
| Alcance | Backend · despliegue **v69** · APK y web sin cambios |
| Autor | Dirección del proyecto |

---

## 1. El defecto (IDOR)

`PATCH /api/v1/sync/sesion/{id_sync_log}` solo comprobaba que la sesión existiera y
estuviera abierta. **No validaba a quién pertenecía**: cualquier usuario
autenticado —de cualquier central— podía **cerrar** la sesión de otro técnico y
escribir sus contadores (`recibidos`, `procesados`, `errores`), además de marcar su
estado como `ERROR`, falseando la traza de la sincronización ajena.

---

## 2. Corrección

`app/services/sync.py::cerrar_sesion` valida la pertenencia antes de tocar nada:

| Situación | Respuesta |
|---|---|
| `sync_log.p00` == usuario | **200** (cierra su sesión) |
| rol ADMIN / SUPERVISOR / SUPER | **200** (soporte) |
| cualquier otro usuario | **403** («La sesión de sincronización no le pertenece») |

El rechazo ocurre **antes** de escribir: la sesión queda intacta (hay prueba de que
los contadores no cambian tras un intento ajeno).

---

## 3. Verificación

| Comprobación | Resultado |
|---|---|
| Backend (suite completa) | **500/500 en verde** (4 nuevas de D-137) |
| Pruebas nuevas | otro técnico → **403**; el dueño → 200; un ADMIN → 200 (soporte); tras el rechazo la sesión sigue `EN_PROCESO` y con `recibidos = 0` |
| APK / web | sin cambios (la APK solo cierra su propia sesión) |

---

## 4. Cambios por archivo

| Archivo | Cambio |
|---|---|
| `app/services/sync.py` | Validación de pertenencia en `cerrar_sesion`. |
| `app/tests/test_d137_sesion_idor.py` | **Nuevo**: 4 pruebas. |

---

## 5. Siguiente hallazgo

**H-21** — la caché y la cola offline son del **dispositivo**, no del técnico:
sobreviven al cierre de sesión y se comparten entre P00. Se consulta al usuario.
