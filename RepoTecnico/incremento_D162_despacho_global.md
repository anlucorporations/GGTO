# Incremento D-162 — El proceso del despacho con el universo completo y el reporte del día en 3 columnas

| Campo | Valor |
|---|---|
| **Petición del usuario** | «modifiquemos el proceso del despacho para: 1. se deben considerar el total de los casos de reparación ingresados por ingesta diaria (COMUNES), los casos de MANTENIMIENTO y los casos especiales. 2. el total de las construcciones (REFERIDOS/EMPRESAS/GOBIERNOS) se debe asignar a una sola cuadrilla a la cual no se le asignarán casos de Reparación/Mantenimiento. 3. los casos de Mantenimiento se asignarán a las cuadrillas según el sector. 4. las averías masivas son prioritarias, por lo tanto deben estar primero en el despacho. 5. en el cuadro de resumen del despacho y en la versión imprimible se incluyen todos los casos asignados a la cuadrilla. 6. se debe enviar un mensaje a los usuarios cuando el despacho esté procesado. 7. en la sección métricas Globales del día (WEB/APK) el despacho se divide en 3 Columnas (Comunes, Referidos, Empresa): cada una muestra el total de Asignados (Reparaciones, Construcción), Cerrados (Reparaciones, Construcción), Enrutado, Citado (Reparaciones, Construcción) y Diferidos (Reparaciones, Construcción).» |
| **Base** | D-99/D-111 (masivas y proceso), D-113/D-114 (checklist de tipos y masivas), D-143 (construcción en una sola cuadrilla), D-161 (MANTENIMIENTO como tipo y bloque propio), D-77 (cuadrilla 0), D-157/D-160 (cierre de jornada). |
| **Estado** | Incremento implementado y verificado en el checkout. **Sin commit, sin push y sin despliegue** (pendiente de orden del usuario). |

## Problema

El proceso del despacho arrastraba cuatro desajustes frente a lo que el usuario necesita ver
y decidir cada día:

1. El checklist de tipos arrancaba con **Comunes + Especiales Reparación + Mantenimiento**:
   los especiales de construcción y de gobierno, y las masivas, quedaban fuera del reparto
   salvo que el supervisor los marcara a mano. El universo real del día es más amplio.
2. La regla de D-143 concentraba solo las `CONSTRUCCION` en una cuadrilla; los **REFERIDOS,
   EMPRESAS y GOBIERNOS** seguían repartiéndose por sector, así que la cuadrilla
   «de construcción» recibía además reparaciones y mantenimientos.
3. El mantenimiento de D-161 se repartía por sector, pero el desalojo de la cuadrilla de
   construcción no lo distinguía de una reparación.
4. El reporte de producción del día no desglosaba el despacho en las **3 columnas** que usa
   la operación (Comunes · Referidos · Empresa) ni separaba Reparaciones de Construcción en
   cada desenlace.

## Qué cambia

### Backend

1. **Universo completo del proceso (punto 1).** `TIPOS_DISTRIBUCION_POR_DEFECTO` pasa a ser
   **todos** los tipos del checklist (`COMUNES`, `ESPECIALES_REPARACION`,
   `ESPECIALES_CONSTRUCCION`, `MANTENIMIENTO`, `ESPECIALES_GOBIERNO`, `MASIVAS`). El
   formulario arranca con el universo del día entero marcado y el supervisor puede desmarcar
   lo que no quiera distribuir. Añadir el catálogo completo a la selección predeterminada no
   cambia el contrato: sigue siendo configurable por el checklist de D-113.
2. **Bloque de construcciones a una cuadrilla exclusiva (punto 2).**
   `BLOQUE_CONSTRUCCION = ("CONSTRUCCION", "REFERIDO", "EMPRESA")` es ahora una constante del
   servicio (antes local). Como `_tipo_asignacion` mapea `GOBIERNO` a `EMPRESA`, el bloque
   cubre **REFERIDOS, EMPRESAS, GOBIERNOS y las CONSTRUCCION de la ingesta**. Todo el bloque
   va a una sola cuadrilla y a esa cuadrilla se le **desalojan** las reparaciones y los
   mantenimientos: primero a la cuadrilla del sector del caso y, si esa es la misma de
   construcción, a la menos cargada de las demás. La exclusividad se informa en
   `reglas.construccion_cuadrilla_exclusiva` y se calcula como «no le queda ningún caso de
   reparación/mantenimiento» (antes la comparación estaba invertida y devolvía `False`).
   Con una sola cuadrilla de calle la regla es imposible: no se desaloja nada y el flag queda
   en `False` para que la UI lo advierta.
3. **Mantenimiento por sector (punto 3).** El mantenimiento no tiene bloque propio de
   cuadrilla: se agrupa por sector y va a la cuadrilla asignada a ese sector (regla D-113).
   El desalojo de la cuadrilla de construcción respeta esa prioridad. Se expone
   `reglas.mantenimientos_por_sector = true`.
4. **Masivas prioritarias (punto 4).** El orden de visita de cada cuadrilla coloca primero
   las `FALLA_MASIVA`, después los citados y luego el resto por sector y caso (ya estaba en
   el cálculo de la propuesta; ahora también se ordena así la lista de `sin_asignar`). En la
   propuesta se informa `reglas.masivas_prioritarias = true`. Las masivas **no se desalojan**
   de la cuadrilla que las atiende: su override de D-113 manda sobre la exclusividad.
5. **Resumen e imprimible con todos los casos (punto 5).** La ficha imprimible lista **todas**
   las filas del despacho (no filtra por tipo) y la cabecera muestra ahora el desglose por
   tipo `Desglose por tipo: CONSTRUCCION: n · EMPRESA: n · FALLA_MASIVA: n · MANTENIMIENTO: n
   · REFERIDO: n · REPARACION: n`, además del total de casos. El cuadro de resumen de la web
   muestra el total y el desglose por tipo de la cuadrilla (ver más abajo).
6. **Aviso al procesar (punto 6).** Se mantiene el aviso interno de RF-69: al procesar (o
   reprocesar) el despacho se crea un mensaje `ALARMA_DESPACHO` por cada cuadrilla con casos,
   con fan-out a los técnicos de la cuadrilla (`mensajes.emitir_despacho_actualizado`). Se
   verificó con una prueba nueva que se emite un mensaje por cuadrilla y que el texto distingue
   `DESPACHO DEL DÍA` de `DESPACHO ACTUALIZADO`.
7. **Reporte del día en 3 columnas (punto 7).** `GET /api/v1/despachos/reporte/produccion`
   (y el reporte por despacho) devuelven en cada fila de cuadrilla y en los totales
   `columnas: {comunes, referidos, empresa}`. Cada columna trae
   `asignados`, `asignados_reparacion`, `asignados_construccion`, `cerrados`,
   `cerrados_reparacion`, `cerrados_construccion`, `enrutado`, `citado`, `citado_reparacion`,
   `citado_construccion`, `diferidos`, `diferidos_reparacion` y `diferidos_construccion`.
   La columna se resuelve por la **categoría** del caso (Comunes = residencial de la ingesta;
   Referidos = REFERIDO; Empresa = EMPRESA/GOBIERNO) y el subtipo Reparación/Construcción por
   su `tipo_caso`. Mantenimiento y masivas se informan **aparte** (`mantenimientos`,
   `mantenimientos_cerradas`, `casos_masiva`, `masivas`) para que el total cuadre:
   `Σ columnas.asignados + mantenimientos + casos_masiva == asignados`.
   Se corrigió además un `TypeError` del acumulado de `masivas` en los totales (arrancaba
   como lista y se le sumaba un entero).

### Web

Ver el detalle en el informe de verificación: el bloque «Reporte de producción del día» de
DESPACHO muestra las 3 columnas por cuadrilla y totales, con mantenimiento y masivas aparte y
la línea de reconciliación; el resumen del despacho lista el desglose por tipo de todos los
casos; y el formulario de proceso muestra el bloque de construcciones con
`bloque_total`/`desalojados`/`excluye_reparaciones` y la nota de masivas prioritarias.

### APK

Ver el detalle en el informe de verificación: la pantalla de MONITOREO gana la vista
«Despacho del día» con las 3 columnas, el desglose por cuadrilla, mantenimiento y masivas
aparte y la línea de reconciliación, alimentada por
`GET /despachos/reporte/produccion` con un modelo tolerante a JSON.

## Qué NO cambia

- No hay cambios de esquema ni de datos: todo lo anterior se calcula sobre `despacho`,
  `despacho_caso` y `caso`.
- El checklist de tipos sigue siendo la palanca del supervisor; solo cambia lo que viene
  marcado por defecto.
- Las reglas de mínimos de D-110 (≥2 referidos, ≥1 empresa) y el reparto por sector de D-113
  se mantienen, así como el override de cuadrilla de las masivas.
- La cuadrilla 0 (supervisor) sigue recibiendo los casos en gestión.
- Cerrar un caso de mantenimiento no cierra su falla masiva (D-161).

## Verificación

Entorno: PostgreSQL 18 efímero en `127.0.0.1:5544` (esquema desechable `ggto_d162`,
recreado desde `RepoTecnico/db/schema.sql`), Python 3.14 local y Flutter 3.24.5.

- **Pruebas nuevas** `app/tests/test_d162_despacho_global.py`: **9/9 en verde** (universo
  completo con los seis tipos marcados; bloque de construcciones a una cuadrilla exclusiva sin
  reparaciones ni mantenimiento; las cuatro construcciones/especiales en esa cuadrilla;
  exclusividad y desalojados en las reglas; mantenimiento a la cuadrilla de su sector; masivas
  primeras en el orden de visita; imprimible con todos los casos y el desglose por tipo; aviso
  a cada cuadrilla; reporte del día con las 3 columnas, sub-métricas y reconciliación).
- **Regresivas del despacho**: `test_despacho_api.py` **35/35**, `test_d113_despacho_tipos.py`
  **9/9**, `test_d114_despacho_especiales.py` **10/10**, `test_d143_construccion_aparte.py`
  **5/5**, `test_d161_mantenimiento.py` **4/4** y la corrida conjunta de
  `test_d99_masivas.py`, `test_d157_desasignacion.py`, `test_d160_cierre_nocturno.py`,
  `test_monitoreo_api.py`, `test_contratos.py` y `test_d81_panel_api.py` **94/94** tras
  adaptar la prueba del reparto por sector a la nueva regla de exclusividad.
- `ruff check app`: **0 hallazgos** · `mypy app`: **0 errores en 136 archivos**.
- **Web**: `npm run build` (`tsc` + Vite) en verde — 104 módulos, `index-wcFwAjFP.css`
  (71,03 kB) e `index-CdfSzw6o.js` (775,86 kB); único aviso, el preexistente de
  *chunk > 500 kB*.
- **APK**: `flutter analyze` **No issues found** y `flutter test` **290/290 en verde**
  (7 pruebas nuevas de D-162), sin cambiar `pubspec.yaml` ni publicar binario.

La corrida **completa** de `pytest app/tests` se lanzó en este entorno y se interrumpió por una
demora anómala del runner local (más de 25 min sin terminar, con las pruebas de los módulos
tocados ya verificadas por separado). Queda pendiente repetirla completa en CI o en un
entorno con la base gestionada antes de publicar.

## Interpretación de los puntos 5, 6 y 7

- **Punto 5**: el backend lista *todas* las filas del despacho en el imprimible (sin filtrar por
  tipo) y la cabecera resume el desglose por tipo; la web muestra el total real y los seis tipos
  en el cuadro de resumen y en la columna Casos.
- **Punto 6**: se entiende como el aviso interno ya previsto en RF-69 —un mensaje
  `ALARMA_DESPACHO` por cuadrilla con casos, con fan-out a sus técnicos—; se verificó su
  emisión al procesar y al reprocesar. No se envía a Telegram/correo porque esos canales siguen
  sin credenciales configuradas.
- **Punto 7**: en la web las 3 columnas viven en **DESPACHO → Reporte de producción del día**
  (la vista donde ya se mostraba el despacho por cuadrilla); en la APK, en **MONITOREO →
  «Despacho del día»**. Ambas leen el mismo endpoint, de modo que las cifras coinciden.


## Pendientes (requieren orden del usuario)

1. **Migración D-161 en producción**: `scripts/migrar_d161_mantenimiento.py --aplicar` contra
   `ggtov2` (el log muestra el fallo anterior por la FK de `caso_estado_hist.usuario`; el
   script ya resuelve el P00 del SUPER activo). Los 24 casos «JUSTIFICATIVO» siguen como
   `CONSTRUCCION` en la base hasta aplicarla.
2. Commit + push a los dos remotos (con barrido de secretos: los repos son públicos).
3. Despliegue `TAG=vNN RepoTecnico/scripts/11_desplegar_ggto_web.sh --confirmar` y humo en
   vivo (`/health`, `/ready`, `/despachos/reporte/produccion` con `columnas`).
4. Regenerar manuales HTML/PDF de DESPACHO y MONITOREO si se actualizan los `.md`.
5. APK: subir la versión (`versionCode`) y publicar con `scripts/publicar_apk.py` cuando el
   usuario lo ordene.

## Archivos

| Archivo | Cambio |
|---|---|
| `app/services/despacho.py` | `TIPOS_DISTRIBUCION_POR_DEFECTO` = todos; `BLOQUE_CONSTRUCCION` como constante; exclusividad corregida; reglas `mantenimientos_por_sector` y orden de `sin_asignar` con masivas primero. |
| `app/api/routes_despachos.py` | Reporte del día con `columnas` (3 columnas y sub-métricas), `casos_masiva`, corrección del acumulado de `masivas`; imprimible con el desglose por tipo. |
| `app/tests/test_d162_despacho_global.py` | 9 pruebas nuevas (universo, bloque exclusivo, mantenimiento por sector, masivas primero, imprimible, aviso, reporte en 3 columnas). |
| `app/tests/test_d113_despacho_tipos.py` | La selección predeterminada pasa a todos los tipos; prueba de despacho publicado adaptada a la nueva distribución. |
| `app/tests/test_d114_despacho_especiales.py` | Selección predeterminada de los seis tipos. |
| `app/web/src/api/types.ts`, `app/web/src/pages/Despacho.tsx`, `app/web/src/components/ProcesarDespacho.tsx`, `app/web/src/styles.css` | 3 columnas, resumen completo y bloque de construcciones (D-162). |
| `app_movil/lib/features/monitoreo/*`, `app_movil/test/*` | Vista «Despacho del día» en 3 columnas y modelos/consultas (D-162). |
