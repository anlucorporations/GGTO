# Incremento D-167 — la búsqueda por texto simple recorre **todos** los campos de la tabla de ingesta

| | |
|---|---|
| **Fecha** | 2026-11-03 |
| **Petición** | «Modifica la búsqueda por texto simple, amplía la búsqueda a todos los criterios de la tabla de ingesta». |
| **Base** | D-27/D-164 (especificación de ingesta `services/ingesta.py`), D-144 (contacto normalizado + universo completo), D-92 (identificador de pago en la búsqueda), RF-30 (PANEL), RF-33 (CASOS). |

## Concepto

El archivo diario `detalle_averias_gpon` alimenta **44 campos de texto del
caso** (la especificación de `services/ingesta.py` —80 columnas u 81 con
`telefono_ip`, D-164—): geografía, central, contactos y teléfonos,
comentarios y resultados, datos técnicos FTTH (OLT·slot·puerto·FAT·serial·
ruta), quién reporta/atende, códigos VENAPP, despacho, etc. La búsqueda de
texto libre miraba solo un puñado de esos campos; ahora recorre **todos**.

## Cambio

* Módulo nuevo `app/services/busqueda.py` (defensa en un solo lugar):
  `CAMPOS_INGESTA` (los 44 textos de la ingesta), `condiciones(termino)` /
  `condicion(termino)` construyen el bloque `OR` con `ILIKE %termino%`.
* `GET /casos` (listado CASOS, RF-33): el parámetro `q` usa el bloque nuevo y
  **conserva** sus extras de siempre (nombre del sector, tipo, clase,
  estado). La variante de contacto D-144 (número sin ceros iniciales) sigue:
  ahora incluye también `telefono_ip` (D-164), `telefono_oficina` y
  `telefono_movil`.
* `GET /casos/buscar` (Buscador global de la barra superior, RF-30): mismo
  bloque — el buscador que antes miraba avería/pago/contacto/nombre/
  dirección ahora encuentra por cualquier dato de la ingesta (FAT, OLT,
  serial, VENAPP, ayudantes…).
* `ayudantes` es `JSONB`: se compara como texto (cast `TEXT`), así que un
  ayudante se encuentra igual que el resto.
* La **búsqueda de texto simple del despliegue no cambia ninguna regla de
  seguridad**: siguen vigentes el recinto por central (D-error D-130 ·
  H-13) y el límite de casos del TÉCNICO. Los campos `NULL` no emparejan
  (`ILIKE` sobre `NULL` → falso).
* Web sin cambios de lógica: solo actualizamos las ayudas del buscador
  global («Cualquier dato de la ingesta: incidente, teléfono, FAT, OLT,
  serial, nombre…») y del filtro de CASOS.
* La búsqueda `q` de `/seguimiento` (RF-34, sin cliente desde D-165) queda
  sin tocar: conserva su contrato histórico.

## Verificación

* `test_d167_busqueda_ingesta.py` **22 passed** (15 campos por unidad en el
  listado + búsqueda de PANEL con sobre-entrega controlada + `telefono_ip`
  + recinto acotado).
* Regresivas: `test_d144_busqueda_universo.py` (4), `test_d130_alcance_casos.py`,
  `test_casos_api.py` — **verde** en el mismo arnés.
* `ruff` y `mypy` limpios; web `tsc` + `vite build` en verde (9,0 s).
