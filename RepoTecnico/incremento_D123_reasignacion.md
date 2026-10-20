# Incremento D-123 — El caso reasignado no pierde el trabajo hecho (H-06)

| Campo | Valor |
|---|---|
| Petición | Resolver **H-06** de la [auditoría V3](INFORME_OPTIMIZACION_V3.md). Decisión del usuario: **aceptar el trabajo de las últimas 24 h** |
| Fecha | 2026-10-19 |
| Alcance | Backend (sin cambios de APK ni de esquema) · despliegue **v55** |
| Autor | Dirección del proyecto |

---

## 1. El defecto

`aplicar_carga` autorizaba el trabajo con el **último despacho** del caso. Si el
supervisor lo reasignaba a otra cuadrilla a mitad de jornada, todo lo que el
técnico ya tenía encolado se rechazaba («El caso no está asignado a tu
cuadrilla») y la APK lo devolvía a reintento **indefinidamente**.

A la vez, el cierre **online** (`POST /casos/{id}/cierre`) solo exigía el rol
`_gestion` y **no validaba la cuadrilla**: el mismo trabajo entraba por una vía
que ignoraba la regla. Dos caminos con criterios distintos y un bucle sin salida.

---

## 2. Corrección: un solo criterio (`casos_permitidos`)

`services/sync.py` gana la función pública **`casos_permitidos(db, usuario)`**:

| Rol / situación | Casos permitidos |
|---|---|
| ADMIN, SUPERVISOR, SUPER | `None` → sin restricción |
| TÉCNICO con cuadrilla | los de su cuadrilla vigente **más** los que estuvieron en ella en `DIAS_TRABAJO_RECIENTE` (1 día: «hoy y ayer», porque `despacho.fecha` es una fecha) |
| TÉCNICO sin cuadrilla | conjunto **vacío** (fail-closed, H-02) |

La ventana usa el **histórico** de `despacho_caso` (`_casos_recientes_de_cuadrilla`),
no solo el último despacho: el trabajo ya recibido no se rechaza porque el caso
cambie de manos.

Se aplica en **las dos vías**:

1. **Carga de la APK** (`aplicar_carga`) — sustituye al cálculo anterior.
2. **Resolución de campo** (`routes_casos`): `estado`, `cierre`, `cita`,
   `no-contesta`, `contacto` y `enrutado` pasan por `_caso_de_campo`, que si el
   caso no está permitido responde **403** («El caso no está asignado a su
   cuadrilla»). Los roles de gestión siguen sin restricción.

Con eso desaparecen el rechazo perpetuo y el bypass: el técnico que recibió el
caso puede terminarlo (hoy o al día siguiente) y nadie puede cerrar un caso que
nunca fue suyo.

---

## 3. Verificación

| Comprobación | Resultado |
|---|---|
| Backend (suite completa) | **459/459 en verde** (5 nuevas de D-123) |
| Pruebas nuevas | cierre encolado del caso reasignado → **aceptado**; cierre online del mismo caso → **200**; caso que nunca fue suyo → **403** en el cierre; SUPERVISOR cierra cualquier caso; `casos_permitidos` incluye la ventana y es **vacío** sin cuadrilla |
| Pruebas adaptadas | 14 pruebas de `test_casos_api`, `test_d88_campo`, `test_d112_campo_rbac` y `test_d120_especiales_estado` usaban al TÉCNICO sobre un caso sin despachar; ahora el helper `asignar_caso_al_tecnico` (en `conftest.py`) pone el caso en el despacho del día de su cuadrilla, que es el escenario real |
| APK | sin cambios: la APK ya marca por acción (D-121) y ahora **no recibe** rechazos por reasignación |
| Esquema | sin cambios (usa el histórico de `despacho_caso`) |

---

## 4. Cambios por archivo

| Archivo | Cambio |
|---|---|
| `app/services/sync.py` | `casos_permitidos`, `_casos_recientes_de_cuadrilla`, ventana `DIAS_TRABAJO_RECIENTE`; `aplicar_carga` lo usa. |
| `app/api/routes_casos.py` | `_caso_de_campo` y su uso en los seis endpoints de resolución de campo. |
| `app/tests/test_d123_reasignacion.py` | **Nuevo**: 5 pruebas. |

---

## 5. Siguiente hallazgo

**H-07** — dos emisores de la cola (el envío automático de cada 5 minutos y la
CARGA) pueden enviar la misma acción a la vez. Se consulta al usuario.
