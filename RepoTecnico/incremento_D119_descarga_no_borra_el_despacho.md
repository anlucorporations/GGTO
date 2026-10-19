# Incremento D-119 â€” La APK ya muestra el despacho despuÃ©s de sincronizar

| Campo | Valor |
|---|---|
| PeticiÃ³n | 1) Â«DespuÃ©s de sincronizar no muestra los casos del despachoÂ» Â· 2) simular 4 casos nuevos y generar un despacho a la cuadrilla 0 para poder cerrarlos desde la APK |
| Fecha | 2026-10-19 |
| Alcance | Backend (`/sync/descarga`) + APK (purga del dispositivo) Â· APK **`1.14.1+24`** publicada Â· despliegue **v51** Â· sembrado de 4 casos TEST en la cuadrilla 0 |
| Autor | DirecciÃ³n del proyecto |

---

## 1. El defecto reportado

La APK **descargaba** los casos del despacho del dÃ­a (el servidor los enviaba) y,
justo despuÃ©s, la **purga del dispositivo los borraba en la misma
sincronizaciÃ³n**. El tÃ©cnico veÃ­a Â«N nuevosÂ» en el resumen y el listado quedaba
vacÃ­o: Â«no muestra los casos del despachoÂ».

### 1.1 Evidencia (producciÃ³n, mismo dÃ­a del reporte)

`sync_log` de la cuenta **153806** (tÃ©cnico de la cuadrilla 0, `C-00`) el
2026-10-19, cada sesiÃ³n con el servidor entregando casos y el listado sin nada:

| `id_sync_log` | hora (UTC) | APK | recibidos | resultado en el telÃ©fono |
|---:|---|---|---:|---|
| 380 | 17:12:23 | 1.13.0+22 | 3 | listado vacÃ­o |
| 385 | 17:12:51 | 1.13.0+22 | 6 | listado vacÃ­o |
| 392 | 17:15:33 | 1.13.0+22 | 6 | listado vacÃ­o |
| 421 | 18:02:34 | 1.13.0+22 | 7 | listado vacÃ­o |
| 435 | 19:51:29 | **1.14.0+23** | 6 | listado vacÃ­o |
| 437 | 19:54:21 | **1.14.0+23** | 6 | listado vacÃ­o |

El patrÃ³n se repetÃ­a en **todas** las cuadrillas (`142918` y `143167` recibÃ­an
43 casos en cada pasada y el listado seguÃ­a vacÃ­o): no era un problema del
tÃ©cnico ni de su telÃ©fono.

Los tres despachos de ese dÃ­a estaban en **`BORRADOR`** (`#110` cuadrilla 1,
`#111` cuadrilla 8, `#112` cuadrilla 12): el supervisor los habÃ­a procesado a las
17:59 UTC y todavÃ­a no los habÃ­a publicado.

### 1.2 Causa raÃ­z (dos reglas que se contradecÃ­an)

1. **El servidor** (`app/services/sync.py`) calculaba `ids_del_dia` â€”los casos
   que la APK debe conservar siempreâ€” solo si la cuadrilla tenÃ­a un despacho en
   estado `PUBLICADO` o `CERRADO`. Un despacho reciÃ©n procesado (`BORRADOR`)
   dejaba `despacho_del_dia = null` e `ids_del_dia = []`.
2. **La APK** (`download_service.dart` + `purga_despachos.dart`) ejecuta la purga
   en cuanto el servidor resuelve una cuadrilla de campo (D-115), conservando
   solo lo que viene en `ids_del_dia`, lo ya gestionado y el trabajo sin enviar.
   Con `ids_del_dia` vacÃ­o, **todo lo reciÃ©n descargado era Â«no atendidoÂ»** y se
   borraba.

Eran dos decisiones correctas por separado â€”D-105 (Â«un borrador no es la
jornadaÂ») y D-115 (Â«la actualizaciÃ³n purga lo viejoÂ»)â€” que juntas producÃ­an el
bucle *descargar â†’ borrar* en cada sincronizaciÃ³n.

---

## 2. CorrecciÃ³n

### 2.1 Backend â€” el despacho del dÃ­a cuenta en cualquier estado

`app/services/sync.py`:

```python
ESTADOS_JORNADA_DIA = ("BORRADOR", "PUBLICADO", "CERRADO")
```

`_despacho_del_dia` usa esa tupla: el despacho que el supervisor acaba de
procesar **es** la jornada del tÃ©cnico, aunque no estÃ© publicado. `ids_del_dia`
vuelve a viajar con sus casos y la purga los conserva.

### 2.2 Backend â€” nuevo `ids_vigentes` en la descarga

`GET /sync/descarga` aÃ±ade **`ids_vigentes`**: **todo** el trabajo que el servidor
reconoce a la cuadrilla (casos no terminales cuyo Ãºltimo despacho es suyo), estÃ©
o no en el despacho de hoy. Sirve para que el diferencial y la purga no se peleen:
un caso de una jornada anterior que el servidor sigue enviando ya no se borra en
cada pasada.

- `app/schemas/sync.py`: `SyncDescargaOut.ids_vigentes: list[int]`.
- Retrocompatible: una APK anterior ignora el campo.

### 2.3 APK â€” la purga no borra lo que el servidor entrega

`app_movil/lib/features/sync/purga_despachos.dart`:

- `planificar(..., idsVigentes, idsDescargados)`: se conservan ademÃ¡s los ids que
  el servidor declara vigentes y **los que acaban de llegar en esta descarga**.
- `ejecutar(idsDelDia, idsVigentes, idsDescargados)`.

`app_movil/lib/features/sync/download_service.dart` lee `ids_vigentes` y acumula
los `id_caso` de los casos recibidos; ambos conjuntos viajan a la purga.

Con esto, **ninguna descarga puede borrar lo que ella misma acaba de entregar**,
que es la garantÃ­a que faltaba (y que tambiÃ©n arregla el caso del despacho de
ayer que el servidor sigue enviando).

**DEC-119-1.** El borrador del dÃ­a es la jornada del tÃ©cnico para la APK.
**DEC-119-2.** La purga del dispositivo conserva: el despacho del dÃ­a, lo vigente
del servidor, lo reciÃ©n descargado, lo gestionado y el trabajo sin enviar. Solo
borra lo que ya no es del tÃ©cnico.
**DEC-119-3.** El sembrado de prueba (4 casos `TEST-APK-*`) queda **en
producciÃ³n** a la cuadrilla 0 para la prueba de cierre desde el telÃ©fono; se
reconoce por el prefijo y se puede depurar con los filtros de siempre.

---

## 3. Los 4 casos nuevos y el despacho a la cuadrilla 0

Script nuevo **`RepoTecnico/pruebas/sembrar_cuadrilla0_apk.py`** (idempotente,
simulaciÃ³n por defecto):

```bash
python RepoTecnico/pruebas/sembrar_cuadrilla0_apk.py --p00 â€¦ --clave â€¦            # simulaciÃ³n
python RepoTecnico/pruebas/sembrar_cuadrilla0_apk.py --p00 â€¦ --clave â€¦ --aplicar  # crea y despacha
```

Crea por **alta manual** los casos `TEST-APK-0001â€¦0004` (REPARACIÃ“N Â·
`SIN_SERVICIO`, identificador de pago `7000001901â€¦1904`, contacto y direcciÃ³n
`TEST CUADRILLA 0 â€¦`, con la marca **TEST** en nombre, direcciÃ³n e informaciÃ³n) y
los asigna al despacho **del dÃ­a de la cuadrilla 0** (`C-00`, la del supervisor)
con `POST /despachos/asignar-casos`.

Resultado en producciÃ³n (2026-10-19):

| Dato | Valor |
|---|---|
| Casos creados | `#465 TEST-APK-0001` Â· `#466 TEST-APK-0002` Â· `#467 TEST-APK-0003` Â· `#468 TEST-APK-0004` |
| Despacho | `#110` Â· `2026-10-19` Â· cuadrilla `C-00` Â· **`BORRADOR`** |
| Casos del despacho | **8** (los 4 nuevos + `#358`, `#377`, `#393`, `#425` que ya tenÃ­a) |
| Estado de los nuevos | `NUEVO` |

---

## 4. VerificaciÃ³n

### 4.1 Pruebas automÃ¡ticas

| ComprobaciÃ³n | Resultado |
|---|---|
| Backend `pytest` (suite completa, esquema aislado) | **426/426 en verde** (425 + el caso de `ids_vigentes`) |
| APK `flutter test` | **212/212 en verde** (209 + 3 de la purga D-119) |
| APK `flutter analyze` | **No issues found!** |
| Backend `ruff` / `mypy` | Sin hallazgos nuevos en los archivos tocados (los 6 avisos de `ruff` y 2 de `mypy` son previos, en archivos ajenos al incremento) |

Pruebas nuevas del backend (`app/tests/test_sync_api.py`):

- `test_un_despacho_en_borrador_es_la_jornada_del_dia`: `despacho_del_dia`,
  `ids_del_dia` e `ids_vigentes` incluyen el caso del borrador.
- `test_ids_vigentes_lleva_todo_el_trabajo_de_la_cuadrilla`: lo de una jornada
  anterior sigue vigente y no entra en `ids_del_dia`.
- Se ajustaron `test_sin_despacho_de_hoyâ€¦` y `test_descarga_informa_la_jornada_del_dia`.

Pruebas nuevas de la APK (`app_movil/test/d104_purga_despachos_test.dart`, grupo
D-119): conserva lo vigente, conserva lo reciÃ©n descargado con el despacho en
borrador, y sigue borrando lo ajeno cuando el servidor no lo respalda.

### 4.2 Payload real de producciÃ³n (cuadrilla 0)

LeÃ­do con la sesiÃ³n del Super Usuario y su ficha dada de alta **temporalmente** en
la cuadrilla 0 (dada de baja al terminar), es exactamente lo que recibe la APK:

| Campo | Antes del arreglo | DespuÃ©s del arreglo |
|---|---|---|
| `despacho_del_dia` | `null` | `{"id_despacho": 110, "fecha": "2026-10-19"}` |
| `ids_del_dia` | `[]` | `[358, 377, 393, 425, 465, 466, 467, 468]` |
| `ids_vigentes` | *(no existÃ­a)* | `[353, 358, 361, 377, 393, 425, 465, 466, 467, 468]` |
| `casos` enviados | 6 | **10** |

Con la regla anterior, la APK conservaba **0** casos de los 6 enviados. Con la
nueva, conserva los 8 del dÃ­a (y 10 con la APK 1.14.1+24).

### 4.3 La APK real en un emulador Android 15

Entorno aislado (PostgreSQL local + backend del repositorio + los mismos 4 casos y
el mismo despacho en `BORRADOR` para la cuadrilla 0), APK **1.14.1+24** instalada
en el emulador y sesiÃ³n de un tÃ©cnico de la cuadrilla 0:

1. **Sincronizar** â†’ `CONEXION Â· LOGIN Â· DESCARGA` en **OK**.
2. Listado: Â«**Cuadrilla C-00 Â· Contenido local Â· 4 casos**Â» con los cuatro
   `TEST-APK-0001â€¦0004` (`NUEVO`, con contacto y direcciÃ³n).
   ![Sincronizado: los 4 casos del despacho](../docs/imagenes/apk_d119/01-sincronizado-4-casos.png)
3. Ficha â†’ **Contactado** â†’ **Atender** â†’ **Cerrar** con IVR y descripciÃ³n:
   Â«Caso cerrado con IVR.Â», chip **CERRADO**.
   ![Caso cerrado desde la APK](../docs/imagenes/apk_d119/02-caso-cerrado.png)
4. **Segunda sincronizaciÃ³n** (la regresiÃ³n original): los 3 pendientes siguen en
   el listado y el cerrado pasa a Â«Resueltos (1)Â».
   ![Tras resincronizar: 3 pendientes y 1 resuelto](../docs/imagenes/apk_d119/03-tras-resincronizar-3-casos.png)

En el servidor, el cierre quedÃ³ registrado con su bitÃ¡cora
(`NUEVO â†’ CONTACTADO â†’ CERRADO`, motivo Â«Cierre con IVRÂ», usuario del tÃ©cnico).

### 4.4 Despliegue y entrega

| Elemento | Valor |
|---|---|
| Imagen | `â€¦/truekeate-repo/ggto-web:v51` |
| RevisiÃ³n | **`ggto-web-00064-54m`**, 100 % del trÃ¡fico |
| Humo en vivo | `/health` 200 Â· `/ready` 200 (43 tablas) Â· `/apk/apk.json` 200 |
| Contrato desplegado | `/openapi.json` incluye `SyncDescargaOut.ids_vigentes` |
| APK publicada | **`1.14.1+24`** Â· 25 068 555 bytes Â· SHA-256 `dfe6952a4d48e0535d262da333cb95534014bd3a3418d5d850ede7f4d4077c1a` |
| Descarga | `/apk/ggto-tecnico.apk` (la sirve el mismo servicio; el aviso de actualizaciÃ³n de la app la ofrece sola) |

---

## 5. Cambios por archivo

| Archivo | Cambio |
|---|---|
| `app/services/sync.py` | `ESTADOS_JORNADA_DIA` con `BORRADOR`; `ids_vigentes` en la respuesta. |
| `app/schemas/sync.py` | `SyncDescargaOut.ids_vigentes`. |
| `app/tests/test_sync_api.py` | Prueba del borrador como jornada, prueba de `ids_vigentes`, ajustes de las existentes. |
| `app_movil/lib/features/sync/purga_despachos.dart` | `planificar`/`ejecutar` conservan `idsVigentes` e `idsDescargados`. |
| `app_movil/lib/features/sync/download_service.dart` | Lee `ids_vigentes` y acumula los `id_caso` recibidos. |
| `app_movil/test/d104_purga_despachos_test.dart` | Grupo D-119 (3 pruebas). |
| `app_movil/pubspec.yaml`, `app_movil/lib/core/constants.dart` | VersiÃ³n **1.14.1+24**. |
| `RepoTecnico/pruebas/sembrar_cuadrilla0_apk.py` | **Nuevo**: los 4 casos y su despacho a la cuadrilla 0. |
| `docs/imagenes/apk_d119/*.png` | Capturas de la verificaciÃ³n en el emulador. |

---

## 6. Para probarlo en el telÃ©fono

1. Instalar la APK **1.14.1+24** (la app la ofrece en la franja de actualizaciÃ³n
   o se descarga de `/apk/ggto-tecnico.apk`).
2. Entrar con la cuenta de la **cuadrilla 0** y abrir **Sincronizar â†’ SINCRONIZAR**.
3. El listado debe mostrar los cuatro `TEST-APK-0001â€¦0004` (ademÃ¡s de los casos
   propios de la cuadrilla), y cada uno se cierra con **Contactado â†’ Atender â†’
   Cerrar** (IVR, COS o SACAS).
4. Al volver a sincronizar, los pendientes **siguen ahÃ­**.

### Notas de estado

- El **Super Usuario** (`123456`) quedÃ³ con una pertenencia a la cuadrilla 0
  cerrada con fecha **hoy** (la que se usÃ³ para leer el payload real): el sistema
  la considera vigente hasta el final del dÃ­a y maÃ±ana deja de aplicar. No se
  tocÃ³ la cuenta del tÃ©cnico 153806 ni la de ningÃºn tÃ©cnico de campo.
- Los casos `TEST-APK-*` llevan la marca **TEST** en `id_averia`, nombre,
  direcciÃ³n e informaciÃ³n; se localizan con el buscador (`TEST-APK`) y se pueden
  depurar con el patrÃ³n de siempre.
- Queda pendiente regenerar los manuales HTML/PDF (los `.md` de este incremento
  son los Ãºnicos nuevos).
