# Incremento D-152 — Acceso mínimo a la PII de abonados y personal (H-01 · H-13)

| Campo | Valor |
|---|---|
| Origen | **H-01** del `INFORME_OPTIMIZACION_V2.md` (privacidad / PII), con el aislamiento de **H-13** |
| Fecha | 2026-10-22 |
| Alcance | Lectura de casos, personal y ficha imprimible · sin cambios de esquema |
| Autor | Dirección del proyecto |

---

## 1. El defecto

D-130 acotó el **listado** y la **búsqueda** de casos a la central y a la cuadrilla, pero
quedaron tres caminos de lectura sin ese control:

1. **Ficha, historial y relacionados por identificador.** `GET /casos/{id}`,
   `GET /casos/{id}/historial` y `GET /casos/{id}/relacionados` solo comprobaban que el caso
   existiera. Cualquier TÉCNICO podía recorrer los identificadores y leer **nombre, teléfono y
   dirección** de abonados de otras cuadrillas e incluso de otras centrales. Los relacionados,
   además, cruzaban centrales al buscar por teléfono.
2. **Personal.** `GET /configuracion/tecnicos` y `GET /configuracion/tecnicos/{id}` exigían
   solo estar autenticado y devolvían **cédula, teléfono y correo** de todo el personal, sin
   limitar la central.
3. **Ficha imprimible del despacho.** `GET /despachos/{id}/imprimible` no comprobaba central
   ni rol y devolvía el HTML con nombre, teléfono y dirección de los abonados de cualquier
   despacho.

## 2. Corrección

### 2.1 Casos (`app/api/routes_casos.py`)

Nuevo `_caso_visible(db, usuario, id_caso)`:

- exige que el caso sea de la central del usuario (salvo SUPER, que conserva el acceso total);
- para el TÉCNICO exige que el caso esté en `sync.casos_permitidos` (su cuadrilla vigente y la
  ventana de reasignación de D-123);
- responde **404** en ambos casos, para no confirmar la existencia de un caso ajeno.

Se aplica a la ficha, al historial y a los relacionados. Los relacionados se filtran además
por `id_central`, de modo que el historial de un teléfono no cruza centrales.

### 2.2 Personal (`app/api/routes_config.py`)

- Listar y obtener técnicos pasa de «autenticado» a **ADMIN/SUPERVISOR** (SUPER conserva el
  acceso total).
- Un usuario que no es SUPER solo ve su propia central: la lista se filtra por
  `resolver_central(...)` y el detalle de un técnico de otra central responde **404**.

Coincide con la interfaz: CONFIGURACIÓN → Técnicos solo se muestra a SUPER/ADMIN/SUPERVISOR
(`app/web/src/components/Layout.tsx`).

### 2.3 Ficha imprimible (`app/api/routes_despachos.py`)

El *endpoint* pasa a **ADMIN/SUPERVISOR** y usa `_de_usuario`, que valida la central del
despacho. El TÉCNICO no usa esta ficha (la sección DESPACHO no se le muestra) y conserva su
cuadrícula en la APK mediante `/sync`.

## 3. Verificación

| Comprobación | Resultado |
|---|---|
| `app/tests/test_d152_pii.py` (nuevo) | **9 passed** |
| `test_d130_alcance_casos.py` | 5 passed (sin regresión del listado/búsqueda) |
| `test_config.py` + `test_auth.py` | 52 passed |
| `test_despacho_api.py` + `test_d143_construccion_aparte.py` | 40 passed |
| Suite completa (PostgreSQL 18 local, esquema desechable) | **565 passed** en 11m09s · **cobertura 90,49 %** |
| `ruff check app` / `mypy app` | sin hallazgos |

Las pruebas negativas comprueban que el TÉCNICO recibe **404** en la ficha, el historial y los
relacionados de un caso de otra cuadrilla, **403** en `/tecnicos` y en la ficha imprimible, y
que el ADMIN sigue leyendo su central y listando a su personal.

## 4. Residuales de H-01 (no cerrables solo con código)

1. **Base legal, finalidad, DPA, aviso de privacidad y responsable designado**: dependen de
   CANTV y asesoría legal.
2. **Servicio invocable por `allUsers`** y `/docs`, `/openapi.json` y `/ready` públicos:
   contención de infraestructura (IAM y superficie), pendiente por decisión del usuario.
3. **APK público** (`app/web/public/apk/`): retirarlo exige una vía de distribución
   alternativa para la APK.
4. **Retención y purga efectivas**: H-25; el servicio existe pero no está programado.
5. **Secretos de canal legibles por cualquier autenticado** (`GET /configuracion`): H-03(b).
6. **Enmascaramiento literal** de teléfono/dirección/serial en respuestas autorizadas: se
   sustituyó por acceso mínimo; el TÉCNICO necesita el contacto completo para la visita.

## 5. Despliegue

Requiere una revisión nueva (v80) junto con D-148, D-149 y D-150; no hay cambios de esquema ni
de configuración.
