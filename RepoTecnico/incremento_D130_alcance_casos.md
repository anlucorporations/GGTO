# Incremento D-130 — El listado y la búsqueda respetan la cuadrilla (H-13)

| Campo | Valor |
|---|---|
| Petición | Resolver **H-13** de la [auditoría V3](INFORME_OPTIMIZACION_V3.md). Opción aplicada (la recomendada): **filtrar por cuadrilla al TÉCNICO** |
| Fecha | 2026-10-20 |
| Alcance | Backend · despliegue **v62** · APK y web sin cambios |
| Autor | Dirección del proyecto |

---

## 1. El defecto

Ningún endpoint de `/casos` aplicaba el filtro de cuadrilla que sí aplica
`/sync`:

- `GET /casos` filtraba por central, pero **no por cuadrilla**: un TÉCNICO veía
  todos los casos de la central, incluidas las de otras cuadrillas.
- `GET /casos/buscar` **no acotaba ni por central**: con un teléfono o una avería
  se podía llegar a casos de cualquier central del sistema.

---

## 2. Corrección

`app/api/routes_casos.py` gana `_acotar_a_lo_permitido(condiciones, db, usuario)`:

- **Roles de gestión** (ADMIN, SUPERVISOR, SUPER) → `casos_permitidos` devuelve
  `None` y no se añade condición: ven todo su alcance, como antes.
- **TÉCNICO** → se añade `Caso.id_caso IN (…)` con el mismo criterio de D-123 (su
  cuadrilla vigente **más** la ventana de reasignación de 24 h). Sin cuadrilla
  vigente → **conjunto vacío** (fail-closed).

Se aplica en:

1. `GET /casos` (listado con filtros y paginación).
2. `GET /casos/buscar`, que además acota a la **central** del usuario con
   `resolver_central` (igual que el listado).

---

## 3. Verificación

| Comprobación | Resultado |
|---|---|
| Backend (suite completa) | **478/478 en verde** (5 nuevas de D-130) |
| Pruebas nuevas | el TÉCNICO lista solo los casos de su cuadrilla; el ADMIN sigue viendo todo; la búsqueda por avería y por teléfono no cruza cuadrillas (ni en negativo ni en positivo); un TÉCNICO sin cuadrilla ve **cero** casos |
| Web / APK | sin cambios: la web no usa el rol TÉCNICO en `CASOS` y la APK arma su lista con `/sync/descarga` |
| Contrato | sin cambios (mismos parámetros y respuesta) |

---

## 4. Cambios por archivo

| Archivo | Cambio |
|---|---|
| `app/api/routes_casos.py` | `_acotar_a_lo_permitido` y su uso en `listar` y `buscar`; `buscar` acota por central. |
| `app/tests/test_d130_alcance_casos.py` | **Nuevo**: 5 pruebas. |

---

## 5. Siguiente hallazgo

**H-14** — `date.today()` (UTC/UTC-4 del servidor) frente a `hoy_operativo()`
(la jornada de Venezuela): el despacho «de hoy» y la jornada pueden no coincidir
alrededor de la medianoche. Se consulta al usuario.
