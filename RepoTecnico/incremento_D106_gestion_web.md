# Incremento D-106 — Gestión completa del caso en la web y direcciones sin sector permanentes

| Campo | Valor |
|---|---|
| Petición | «Verifica en la web: 1) al momento de la ingesta se pueda asignar el sector a direcciones que no se asignen automáticamente a un sector; 2) se pueda gestionar completamente los casos, asignar citas, reactivar caso, etc.» |
| Fecha | 2026-10-17 |
| Alcance | API (`reactivar`, `direcciones-sin-sector`) + web (`FichaCaso`, `Ingesta`) |
| Autor | Dirección del proyecto |

---

## 1. Verificación previa (lo que ya había y lo que faltaba)

### Punto 1 — sector en la ingesta

| Comprobación | Resultado |
|---|---|
| La ingesta detecta las direcciones sin sector | **Sí**: `ResumenIngesta.direcciones_sin_sector` (agrupadas por dirección, con total y un ejemplo), calculado en `_analizar` (`app/api/routes_ingesta.py`) |
| El resumen permite asignarlas | **Sí**: el cuadro `GestionDirecciones` agrega la dirección como patrón de un sector (`POST /sectores/{id}/direcciones`) y luego re-sectoriza (`POST /ingesta/sectorizar-pendientes`) |
| ¿Se puede volver a ellas después? | **No**: el cuadro solo se abría desde la ventana del resumen. Si el usuario la cerraba —o los casos venían de cargas anteriores— no había ningún camino en la web |

### Punto 2 — gestión completa del caso

| Capacidad | Estado |
|---|---|
| Cerrar el caso (IVR/COS/SACAS) con descripción y evidencias | **Sí** — pestaña RESOLUCIÓN (`POST /casos/{id}/cierre`) |
| **Asignar citas** | **Sí** — RESOLUCIÓN → CITA (`POST /casos/{id}/cita`), la fecha de cita en CLASIFICACIÓN (`PATCH /casos/{id}`) y la sección AGENDA |
| Enrutar y «No contesta» | **Sí** — `POST /casos/{id}/enrutado` y `/no-contesta` |
| Asignar a cuadrilla / quitar del despacho | **Sí** — pestaña DESPACHO (D-78) |
| **Cambiar el estado del caso desde la web** | **No**: D-76 eliminó la pestaña GESTIÓN y el formulario «Cambiar estado» (el endpoint `POST /casos/{id}/estado` se conservó, pero la web no lo usaba) |
| **Reactivar un caso cerrado/cancelado/enrutado** | **No**: no existía endpoint ni botón |

---

## 2. Decisiones

| ID | Decisión |
|---|---|
| **DEC-106-1** | La pestaña **GESTIÓN** vuelve a la ficha, sin edición de campos (eso sigue en el icono del título): solo **estado** y **reactivación**, con el motivo en la bitácora |
| **DEC-106-2** | La **reactivación** es un endpoint propio (`POST /casos/{id}/reactivar`), no un PATCH libre: exige **motivo** (≥ 5 caracteres), solo aplica a estados terminales y deja la fila `REACTIVACIÓN: …` en `caso_estado_hist`. Por defecto devuelve el caso a `ASIGNADO` (o a `EN_GESTION`/`NUEVO` si se indica) |
| **DEC-106-3** | Las direcciones sin sector se consultan **del sistema** (`GET /ingesta/direcciones-sin-sector`), no solo del último archivo, y la pantalla INGESTA muestra un panel permanente con el total, el listado y el botón «Asignar sector» |

---

## 3. Qué cambió

### 3.1 API

- **`POST /api/v1/casos/{id_caso}/reactivar`** (`ReactivarCaso`): `motivo` obligatorio y `estado` destino entre `NUEVO`, `ASIGNADO` (por defecto) y `EN_GESTION`. Responde **409** si el caso no está en `CERRADO`/`CANCELADO`/`ENRUTADO` (para eso está el cambio de estado) y **403** al rol TÉCNICO. Registra la bitácora con `REACTIVACIÓN: <motivo>` y aplica la regularización de clasificación de D-90.
- **`GET /api/v1/ingesta/direcciones-sin-sector`** (`DireccionesSinSectorOut`): agrupa por dirección los casos de la central que están sin sector (hasta 200 grupos, con el total real) y exige el mismo rol de escritura que la ingesta.

### 3.2 Web

- `FichaCaso.tsx`: pestaña **GESTIÓN** (entre TEXTOS y RESOLUCIÓN) con el estado actual, el formulario **Cambiar el estado** (select de los 9 estados + motivo) y el bloque **Reactivar el caso**, que aparece solo en estados terminales y exige el motivo. Todo con la puerta de rol de la resolución (ADMIN, SUPERVISOR y Super Usuario).
- `Ingesta.tsx`: panel permanente **Direcciones sin sector** (total de direcciones y de casos, las 10 primeras y el botón «Asignar sector»), que se refresca al cargar la pantalla, tras cada ingesta y al terminar de asignar. El cuadro de asignación ahora se abre con las direcciones **del sistema**.
- `api/client.ts` + `api/types.ts`: `reactivarCaso`, `direccionesSinSector`, `ReactivarCaso` y `DireccionesSinSectorOut`.

---

## 4. Trazabilidad

| ID | Requisito / regla |
|---|---|
| RF-88 | Un caso terminal puede **reactivarse** con su motivo registrado en la bitácora |
| RF-89 | Las direcciones sin sector se consultan y se gestionan en cualquier momento, no solo al ingerir |
| RNF-43 | El gobierno del caso desde la web queda auditado (usuario, motivo y fecha en `caso_estado_hist`) |
| RT-31 | Pruebas de la reactivación (estado terminal, 409 en abierto, 422 sin motivo, 403 del técnico) y del listado permanente de direcciones sin sector |

---

## 5. Archivos

| Archivo | Cambio |
|---|---|
| `app/schemas/casos.py` | `ReactivarCaso` y `ESTADOS_REACTIVABLES` |
| `app/api/routes_casos.py` | Endpoint `POST /casos/{id}/reactivar` |
| `app/schemas/ingesta.py` | `DireccionesSinSectorOut` |
| `app/api/routes_ingesta.py` | `GET /ingesta/direcciones-sin-sector` |
| `app/tests/test_casos_api.py` | 4 pruebas de reactivación |
| `app/tests/test_ingesta_api.py` | 2 pruebas del listado permanente |
| `app/web/src/components/FichaCaso.tsx` | Pestaña GESTIÓN (estado + reactivación) |
| `app/web/src/pages/Ingesta.tsx` | Panel permanente de direcciones sin sector |
| `app/web/src/api/client.ts`, `app/web/src/api/types.ts` | Funciones y tipos nuevos |
| `scripts/tmp_pg_pytest.ps1` | Varios archivos a la vez con `-Rutas a.py,b.py` |

---

## 6. Verificación

| Prueba | Resultado |
|---|---|
| `pytest` (PostgreSQL 18, esquema `ggto_test`) | **396/396 en verde** (390 previos + **6 nuevos** de D-106) |
| `tsc` + `vite build` | **en verde** (bundle `index-B38eAe_X.js`, 98 módulos) |
| `ruff check` en los archivos tocados | **limpio** |

**Pruebas nuevas:** el caso cerrado vuelve a `ASIGNADO` y la bitácora guarda `REACTIVACIÓN: …` · también se reactiva desde `ENRUTADO` y `CANCELADO` · un caso abierto da **409** · sin motivo da **422** · el TÉCNICO recibe **403** y el SUPERVISOR puede reactivar a `EN_GESTION` · las direcciones sin sector se listan del sistema (totales coherentes) y el TÉCNICO no puede consultarlas · al asignar el sector a la primera dirección, los casos sin sector bajan.

---

## 7. Pendiente

- **Desplegar** la web (imagen nueva de Cloud Run) para que los dos cambios lleguen al navegador.
- Prueba de aceptación en la web: cargar el archivo diario, asignar el sector de una dirección desde el panel permanente, cerrar un caso y **reactivarlo** desde GESTIÓN.
