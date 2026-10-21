# Incremento D-145 — Ingesta manual: id automático, referido, solicitante y mapa del FAT

| Campo | Valor |
|---|---|
| Petición | 5 puntos del usuario: id automático `REF-(CONS/REP)-…`, toda la ingesta manual es referido, solicitante por listas en cascada del personal externo, mover «Personal externo» a la configuración de técnicos y mapa del FAT por dirección o coordenadas en MASIVAS |
| Fecha | 2026-10-21 |
| Alcance | Backend + web · despliegue **v77** · APK sin cambios |
| Autor | Dirección del proyecto |

---

## 1. ID de avería automático — `REF-(CONS/REP)-[correlativo]`

- `POST /api/v1/casos` (alta manual) **genera el ID** con
  `REF-CONS-######` (construcción) o `REF-REP-######` (reparación), tomando el
  correlativo de la secuencia `seq_caso_ref` (la misma de antes, así que dos altas
  simultáneas no chocan).
- El formulario web **ya no pide el ID**: muestra un aviso con el formato y, al
  guardar, el resultado con el ID generado.
- La API sigue aceptando un `id_averia` explícito (importaciones y pruebas).

## 2. Toda la ingesta manual es **referido**

- La web envía `categoria=REFERIDO`; el backend, con un ID sintético `REF-…`, aplica
  la regla D-90 y deja el caso como **REFERIDO** (`tipo_caso`).
- En una **construcción** el `tipo_caso` sigue siendo `CONSTRUCCION` (la actividad
  manda en el despacho) pero la categoría es `REFERIDO`.
- Sea cual sea la actividad, el alta deja su **ficha de caso especial**
  (`clasificacion=REFERIDO`, `tipo_actividad=REPARACION|CONSTRUCCION`).
- Se respeta una categoría explícita de otro consumidor (EMPRESA/GOBIERNO siguen
  entrando por ESPECIALES).

## 3. Solicitante desde el personal externo (cascada)

- El modal tiene tres listas encadenadas: **Unidad que solicita → Nombre del
  solicitante → Número del solicitante**, alimentadas por el catálogo
  `solicitante` (personal externo, 22 registros en producción).
- El número elegido viaja como `id_solicitante`; el backend valida que exista
  (**404** si no) y lo guarda en la ficha del referido. `persona_reporta` se
  completa con «Unidad — Nombre» si venía vacío.
- Si el catálogo está vacío, el propio modal indica dónde cargarlo.

## 4. «Personal externo» pasa a la configuración de técnicos

- Se retira la pestaña **Personal externo** de MASIVAS (y el salto desde la ficha
  de la masiva, que ahora remite a **Técnicos → Personal externo**).
- La sección **TÉCNICOS** incluye el panel **Personal externo** con el mismo
  catálogo (altas, edición, activación y borrado).

## 5. Mapa del FAT por dirección o coordenadas (MASIVAS)

- `GET /api/v1/fallas-masivas/{id}/ubicacion` incorpora **`url_mapa`** y
  **`url_busqueda`** calculados por el servidor.
- Nuevo parámetro **`?geocodificar=true`**: si la masiva no tiene coordenadas ni
  evidencias con GPS, el servidor resuelve la **dirección** (más sector y FAT) con
  **Nominatim/OpenStreetMap** (sin clave, timeout de 6 s, best-effort) y devuelve
  `origen=GEOCODIFICADA` con el mapa listo.
- El componente `MapaFat` (Leaflet) ahora:
  - con coordenadas → mapa con marcador del FAT y puntos GPS de las evidencias,
    más un enlace «Abrir en OpenStreetMap»;
  - **sin coordenadas pero con dirección** → muestra la dirección y ofrece
    «Ubicar por la dirección» (geocodifica) y «Buscar en OpenStreetMap».

---

## 6. Verificación

| Comprobación | Resultado |
|---|---|
| Backend (suite completa) | **528/528 en verde** (7 nuevas de D-145 + pruebas afectadas ajustadas) |
| Pruebas nuevas | ID `REF-REP-`/`REF-CONS-`; alta manual referida; solicitante guardado en la ficha (y 404 si no existe); construcción con actividad propia; enlaces del mapa sin red; `url_busqueda` sin GPS |
| Web | `tsc --noEmit` y `npm run build` limpios |
| Producción (v77) | alta CONSTRUCCIÓN → `REF-CONS-000097` (REFERIDO, ficha con solicitante 12); alta REPARACIÓN → `REF-REP-000098` (REFERIDO); masiva 31 sin GPS → `url_busqueda` con su dirección; bundle con «Personal externo», «REF-REP-» y «Ubicar por la dirección» |

Los dos casos de prueba creados en producción (`CLIENTE TEST D145`) quedaron
**CANCELADOS** con motivo «Prueba D-145 (dato TEST)».

---

## 7. Cambios por archivo

| Archivo | Cambio |
|---|---|
| `app/api/routes_casos.py` | `_nuevo_id_averia_ref`; alta manual con ID automático, solicitante y ficha del referido. |
| `app/schemas/casos.py` | `id_solicitante`; `id_averia` deja de ser obligatorio. |
| `app/services/geocodificacion.py` | **Nuevo**: Nominatim, `url_mapa`, `url_busqueda`. |
| `app/services/masivas.py`, `app/schemas/alertas.py`, `app/api/routes_alertas.py` | Enlaces del mapa y `?geocodificar=true`. |
| `app/tests/test_d145_ingesta_manual.py` | **Nuevo**: 7 pruebas. |
| `app/web/src/components/ModalCaso.tsx` | Reescrito: ID automático, referido y solicitante en cascada. |
| `app/web/src/components/ModalCaso.tsx`/`Tecnicos.tsx` | El catálogo de personal externo vive en Técnicos. |
| `app/web/src/pages/Masivas.tsx`, `masivas/FichaMasiva.tsx` | Sin pestaña de personal externo; mapa con dirección. |
| `app/web/src/masivas/MapaFat.tsx` | Mapa por dirección + enlaces. |
| `app/web/src/api/types.ts`, `client.ts` | Tipos y `geocodificar`. |

---

## 8. Notas

- **Geocodificación**: depende de que Cloud Run tenga salida a Internet y de la
  disponibilidad de Nominatim; si falla, la pantalla sigue ofreciendo el enlace de
  búsqueda (no rompe nada). El uso es de una consulta por clic, dentro de la
  política de uso de OpenStreetMap.
- Las **coordenadas** del FAT se siguen tomando de la masiva o de las evidencias
  GPS de la APK cuando existen; la geocodificación es el respaldo por dirección.
