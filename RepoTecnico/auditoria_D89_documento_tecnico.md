# Auditoría técnica adversarial — Incremento **D-89…D-94** · Identificador de pago (70\*)

| Campo | Valor |
|---|---|
| Documento auditado | [`documento_tecnico_D89.md`](documento_tecnico_D89.md) — 353 líneas · SHA-256 `9226C3B81BCF2A8B7519CA63B52DEFBFE483BFA962CC22405F4D58461D26D8D0` |
| Documentos de contraste | [`incremento_D89_identificador_pago.md`](incremento_D89_identificador_pago.md) · [`casos_uso/casos_uso_D89.md`](casos_uso/casos_uso_D89.md) · [`propuesta_identificador_pago.md`](propuesta_identificador_pago.md) · [`casos_uso/diagramas_D89.md`](casos_uso/diagramas_D89.md) |
| Código/esquema de contraste | `RepoTecnico/db/schema.sql` · `app/…` · `app/tests/conftest.py` · `app/web/…` · `app_movil/…` · `RepoTecnico/requerimientos.md` (estado **D-88**) |
| Fecha de la auditoría | 2026-10-08 |
| Alcance | Coherencia interna y trazabilidad; validez del DDL en PostgreSQL 15/18; idempotencia y concurrencia; migración y rollback; contratos y retrocompatibilidad con la APK `1.1.0+8`; RBAC, RLS y PII; rendimiento (RNF-08/RNF-33); vacíos (RNF-19, RT-13, RT-14, manuales, multi-central, Cloud Run); errores formales |
| Método | Contraste línea por línea del diseño contra el esquema y el código reales; los hallazgos dudosos se descartaron (adversarial: solo lo demostrable) |

> **Nota de revisión:** el documento auditado fue reescrito a las **15:51** (mientras se leía) y esa revisión ya corrigió dos defectos de la versión previa: el `ALTER TABLE … ADD CONSTRAINT` no idempotente (ahora en bloque `DO`) y el `INSERT` de `configuracion` contra `valor jsonb` (ahora `to_jsonb(...)`). Los hallazgos de este informe corresponden **exclusivamente** al hash indicado; si el documento cambia, la auditoría pierde validez.

---

## 1. Veredicto global

**NO está listo para implementar tal cual.** El diseño es correcto en su dirección y muy superior a un diseño de partida —el DDL es en su mayoría válido, la trazabilidad CU↔RF↔componente está completa y el eje `identificador_pago` está bien modelado—, pero contiene **2 defectos críticos** (uno de ellos rompe escrituras de casos especiales en producción al aplicar el DDL de D-89; el otro corrompe `informacion`/`contacto_cliente` con identificadores de pago) y **9 hallazgos altos** que contradicen decisiones cerradas, RNF-21/RNF-29/RNF-30/RF-56 o el invariante de escritura única.

Con las correcciones de las secciones 4.1 a 4.11 y el cierre de la sección 5 el documento queda **APTO CON OBSERVACIONES** y puede pasar a desarrollo.

**Conteo:** 2 CRÍTICOS · 9 ALTOS · 12 MEDIOS · 4 BAJOS = **27 hallazgos**.

---

## 2. Tabla priorizada

| # | Sev. | Artefacto | Hallazgo (1 línea) | Recomendación |
|---|---|---|---|---|
| H-01 | **CRÍTICO** | `documento_tecnico_D89.md:91-99` · `routes_especiales.py:75-101` · `routes_casos.py:317-357` | El `CHECK ck_reparacion_con_ip` se aplica en **D-89** (RT-17) pero son **D-90** y su código los que dejan de crear REPARACIÓN sin IP: al migrar, `POST /casos-especiales` y `POST /casos` (tipo REPARACION) violan el CHECK y devuelven error | Mover el `CHECK` a la migración de D-90 **después** de reescribir los caminos de alta, o corregir esos caminos en el mismo despliegue |
| H-02 | **CRÍTICO** | `documento_tecnico_D89.md:322` (R3) · `:235` · `esquemas ContactoUpdate` `app/schemas/casos.py:243-253` | La heurística «si el valor cumple el patrón y el caso no tiene IP → es IP; si ya tiene → es contacto» **no es idempotente** (reenviar el mismo valor cambia de efecto) y reabre al TECNICO/APK antigua la escritura de un 70\* en `contacto_cliente`+`informacion` | Eliminar la heurística: `telefono` es **siempre** contacto; si normaliza al patrón → `422`; la IP solo por campo `id_pago` (ADMIN/SUPERVISOR/SUPER) |
| H-03 | ALTO | `documento_tecnico_D89.md:210-214` · `:254` · `casos_uso_D89.md:357` (CU-08/A3) | La regla dura de la BD hace **imposible** «forzar una REPARACIÓN sin identificador» que §6 y CU-08/A3 prometen; el propio documento lo deja «pendiente de decisión» | O quitar la promesa de `§6`/CU-08-A3, o añadir `caso.forzado_reparacion`/`motivo` y excluirlo del CHECK |
| H-04 | ALTO | `documento_tecnico_D89.md:257-258` vs `:66-115` | §6 dice que la política RLS de `identificador_pago` «se añade en D-89», pero el DDL (RT-17) **no la crea**: la tabla queda sin RLS y sin `FORCE`, contra RNF-21 | Añadir a §3.1 el `ENABLE/FORCE ROW LEVEL SECURITY` + `CREATE POLICY p_ip_central` con `id_central` |
| H-05 | ALTO | `documento_tecnico_D89.md:70` (`UNIQUE(numero)`) · `casos_uso_D89.md:92` (CU-02/A1) | `numero` es único **global** pero CU-02/A1 afirma que «se crea/usa el identificador **de la central del caso**»: con dos centrales, un caso queda enlazado a una IP de otra central que la RLS le oculta | Decidir multi-central: `UNIQUE(numero)` global con histórico cruzado explícito y RLS de lectura, o `UNIQUE(id_central, numero)` y ajustar CU-02/A1 |
| H-06 | ALTO | `db/schema.sql:267-281` · `documento_tecnico_D89.md:239,291-292` | `ingesta_lote` **no tiene** `filas_sin_identificador_pago` ni `filas_con_contacto`, el DDL no las añade y no hay tabla de detalle por fila: RF-56 y CU-11 (paso 3) no son implementables | Añadir las dos columnas a `ingesta_lote` + tabla `ingesta_lote_aviso` (fila, `id_averia`, número, motivo) en §3.1 |
| H-07 | ALTO | `documento_tecnico_D89.md:171-181` vs `:285-287` | `resolver_identificador` hace `SELECT`+`INSERT` sin `ON CONFLICT` (el §8 promete `ON CONFLICT DO NOTHING`): con dos ingestas simultáneas hay `IntegrityError` y se aborta el lote (transacción única, RT-18) | Unificar el algoritmo con `INSERT … ON CONFLICT (numero) DO NOTHING` + `SELECT` (o `DO UPDATE … RETURNING id_pago`) y documentar el bloqueo |
| H-08 | ALTO | `documento_tecnico_D89.md:266-270` | El backfill usa solo `regexp_replace(telefono,'\D','','g')` y **no** el normalizador de RF-47: `+58`/`0058`, espacios y >10 dígitos quedan sin enlazar; además «count = valores distintos válidos» es falso (dos formatos colapsan a un número) | Backfill con **una sola** función de normalización compartida (SQL `app_normalizar_numero` o la de Python) y verificación «0 casos con número válido y `id_pago IS NULL`» |
| H-09 | ALTO | `documento_tecnico_D89.md:189-190` · `casos_uso_D89.md:43` (A5) | La suma `[CONTACTO]` a `informacion` (idempotencia y concurrencia) queda como prosa: sin SQL atómico, dos reingresos/cambios simultáneos duplican el texto y multiplican PII (RNF-18/RNF-29) | Especificar el `UPDATE … WHERE informacion NOT LIKE '%[CONTACTO] '||:n||'%'` (o `SELECT … FOR UPDATE`) y su prueba de concurrencia |
| H-10 | ALTO | `documento_tecnico_D89.md:236` · `app/schemas/casos.py:118-149` · `app/api/routes_casos.py:397-398` | El contrato de entrada no cambia: `POST /api/v1/casos/manual` **no existe** (es `POST /api/v1/casos`), `CasoManualCreate` no tiene `id_pago` y `CasoUpdate.telefono/contacto_cliente/informacion` escriben por `setattr`, saltándose `services/pagos.py` (rompe R7/DEC-IP-2/DEC-IP-4) | Corregir la ruta y declarar en §5 los campos nuevos/retirados de `CasoManualCreate`/`CasoUpdate` + guardia de servicio para toda escritura de `telefono`/`contacto_cliente`/`informacion` |
| H-11 | ALTO | `documento_tecnico_D89.md:251-253` · `requerimientos.md:247` (matriz §5.2) · `casos_uso_D89.md:218` (CU-05/A1) | RBAC contradictorio: la celda «TECNICO ❌ (solo su cuadrilla)» es ambigua y choca con §5.2 (MONITOREO TECNICO = «—») aunque `routes_monitoreo.py:44-46` sí acota por cuadrilla; y §6 concede editar la IP a SUPERVISOR mientras CU-05/A1 lo reserva a ADM | Fijar una única matriz: marcar al TECNICO como «Lectura acotada a su cuadrilla, sin titular» y decidir ADM **o** ADM+SUPERVISOR para `id_pago` |
| H-12 | MEDIO | `documento_tecnico_D89.md:283-292` · `:294-303` | RNF-19 solo aparece como título: no hay logs con `request-id`, ni alertas, ni retención ≥30 días; tampoco hay prueba de RNF-33 en §9 (solo se cita en R5) | Añadir a §8 los eventos/alertas (p. ej. «ingesta sin ejecutar», «`filas_sin_identificador_pago` > umbral») y a §9 la prueba de carga con el dataset de 20 000 filas |
| H-13 | MEDIO | `documento_tecnico_D89.md:262-281` vs `requerimientos.md:295-296` (RT-13/RT-14) | El DDL se propone en `schema.sql` + script: no hay revisión **Alembic** ni `db/migrations/` (no existe en el repo) y el documento no menciona CI (no hay `.github/workflows`) | Versionar el DDL como revisión Alembic (baseline `schema.sql`) y declarar en §9/§10 el job de CI (pytest+Ruff+mypy+cobertura) |
| H-14 | MEDIO | `documento_tecnico_D89.md:68-80` · `:333-347` | RN-IP-03 («impedir la baja de un identificador con casos vigentes») no tiene componente, endpoint ni entrada en §12; `estado='BAJA'` se admite sin restricción ni FK `ON DELETE RESTRICT` | Añadir RN-IP-03 a un componente de `services/pagos.py` + `ON DELETE RESTRICT` en `caso.id_pago` y su fila en §12 |
| H-15 | MEDIO | `documento_tecnico_D89.md:229-239` · `:251` | §5 solo define `GET /pagos*` pero §6 concede «crear/editar el identificador (forzar valor)»: no hay `POST/PATCH /pagos` ni validación de servidor del patrón fuera del CHECK de formato | Definir `PATCH /api/v1/pagos/{numero}` (ADMIN/SUPERVISOR, patrón, auditoría) o retirar la fila de §6 |
| H-16 | MEDIO | `db/schema.sql:771-786` | `identificador_pago.actualizado_en` queda congelado: el bucle de triggers no incluye la tabla nueva | Añadir `'identificador_pago'` al arreglo `tablas` del bloque de triggers en el DDL |
| H-17 | MEDIO | `app/services/sistemas.py:38-50` | `COLUMNAS_PII` no incluye `numero`, `nombre_titular` ni `direccion_principal`: SISTEMAS→Base de datos mostraría la PII nueva sin máscara | Ampliar `COLUMNAS_PII` (o un `COLUMNAS_PII_TABLA`) con las columnas nuevas y su prueba negativa |
| H-18 | MEDIO | `documento_tecnico_D89.md:185-188` vs `casos_uso_D89.md:33` (CU-01 paso 5) | Ambigüedad no resuelta: si la columna 13 no cumple el patrón **y** la 16 trae número, hay dos candidatos a `contacto_cliente` (un solo campo) | Fijar la regla: `contacto_cliente = col16` si viene; si no, `col13`; el resto solo a `informacion` |
| H-19 | MEDIO | `documento_tecnico_D89.md:159-166` | `normalizar_numero` evalúa longitudes antes de descartar letras/separadores: `+58 0414-222-3344` (13 dígitos, empieza por `5`) no dispara ninguna regla → RF-47 incumplido | Normalizar primero a dígitos (`re.sub(r"\D","",v)`) y **después** aplicar las reglas de prefijo |
| H-20 | MEDIO | `documento_tecnico_D89.md:275-277` (rollback) | El rollback no deshace el paso 4 (reescritura de `caso.telefono`) ni el paso 5 (`[CONTACTO]`), no borra las claves de `configuracion` ni `ix_ip_numero_trgm`; no hay respaldo previo | Añadir `caso_d89_backup` en el paso 1 y el SQL de restauración + `DELETE FROM configuracion WHERE clave IN (...)` y `DROP INDEX ix_ip_numero_trgm` |
| H-21 | MEDIO | `app/tests/conftest.py:34-50` | `SQL_LIMPIEZA` no incluye `identificador_pago`: con la tabla nueva y filas, el teardown falla por FK (`caso.id_pago`) | Añadir `DELETE FROM identificador_pago;` después de los borrados de `caso` y su fila en §9 |
| H-22 | MEDIO | `documento_tecnico_D89.md:19-21,112-114` · `app/schemas/casos.py:59` | La vista `vw_caso_telefono` no tiene ningún consumidor (solo se cita en el propio documento) y una vista no «mantiene sincronizado» el alias: `CasoOut.telefono` sale del ORM | Retirar la vista o nombrar su consumidor único; corregir la afirmación de §1.2 |
| H-23 | BAJO | `documento_tecnico_D89.md:302` | Ruta E2E inexistente: `RepoTecnico/pruebas/e2e/24-…spec.js`; el patrón real del repo es `RepoTecnico/pruebas/e2e/tests/NN-…spec.js` (23 archivos) | Corregir a `RepoTecnico/pruebas/e2e/tests/24-identificador-pago.spec.js` |
| H-24 | BAJO | `documento_tecnico_D89.md:314` · `propuesta_identificador_pago.md:255` | «Manuales 04/05/06/11» mezcla dos árboles: en `Manuales/03-Implementacion/` son 04-panel-y-casos, 05-despacho, 06-seguimiento, 11-apk; el propuesta llama «05 (diccionario)» y «06 (ER)» a los de `05-Diccionario-de-Datos`/`06-Diagrama-Relacional` | Citar rutas completas de cada manual en §10/D-94 |
| H-25 | BAJO | `casos_uso_D89.md:294,343` vs `:536-537` | Las fichas de CU-07 y CU-08 omiten RT-19/RT-17 que sí figuran en su propia matriz de trazabilidad | Alinear ficha y matriz |
| H-26 | BAJO | `documento_tecnico_D89.md:86-87,216-225` | Índices: `gin_trgm_ops` sobre `numero` (10 dígitos, ya UNIQUE) es redundante y no sirve a RF-54; falta un índice para la reincidencia | Retirar el trgm y añadir `CREATE INDEX ix_caso_id_pago_fecha ON caso (id_pago, fecha_reporte)` |
| H-27 | BAJO | `documento_tecnico_D89.md:78-79` · `incremento_D89_identificador_pago.md:60` | `ck_ip_serie` ya no valida el patrón de negocio (`^[0-9]{7,15}$`) mientras RNF-29 dice «validado por el patrón configurado»: la única validación de negocio queda en el servicio | Añadir a §3.1/R1 la nota de que la validación de negocio es de servicio y que el CHECK es solo de formato, y su prueba |

---

## 3. Detalle por hallazgo

### H-01 · CRÍTICO — El `CHECK` en D-89 rompe las altas vigentes de REPARACIÓN

**Evidencia.**
- `documento_tecnico_D89.md:89-99` incluye el `CHECK ck_reparacion_con_ip` en el DDL de **D-89** (RT-17, `documento_tecnico_D89.md:64`), y `documento_tecnico_D89.md:309` cierra D-89 con «**Migración verificada en `ggto_test` y en producción**».
- `documento_tecnico_D89.md:310` asigna el mismo `CHECK NOT VALID` a **D-90** («CHECK NOT VALID» entre los entregables) y D-90 es también el ciclo de las reglas.
- Código vigente que crea filas `REPARACION` **sin** `id_pago` y con `id_averia` sintético: `app/api/routes_especiales.py:75-86` (genera `REF-…` y aun así pone `tipo_caso="REPARACION"`) y `app/api/routes_casos.py:317-357` (alta manual con `tipo_caso` del cuerpo, sin ningún campo de identificador).
- Un `CHECK … NOT VALID` **sí se aplica a las filas nuevas** (solo exime del escaneo histórico).

**Impacto.** Aplicar la migración en D-89 en producción hace fallar con error de integridad el alta de casos especiales de actividad REPARACIÓN y el alta manual de REPARACIÓN (500 al usuario), justo los caminos que D-90 debía reescribir. Es un fallo de secuencia de entrega, no un matiz.

**Corrección concreta.** Sacar el bloque `DO $$ … $$` de §3.1 (DDL de D-89) y llevarlo a la migración de D-90, ejecutado **después** de desplegar los servicios que reclasifican; o, si se mantiene en D-89, incluir en el mismo despliegue la reescritura de `routes_especiales.py:75-101` y `routes_casos.py:317-357` (RF-49) y cambiar el criterio de cierre de D-89 para no exigir «en producción» antes de D-90.

### H-02 · CRÍTICO — La heurística de R3 no es determinista y corrompe contacto/`informacion`

**Evidencia.**
- `documento_tecnico_D89.md:322` (R3): «si el valor **cumple** el patrón y el caso **no tiene** identificador, se interpreta como identificador; si ya tiene, se interpreta como contacto».
- `documento_tecnico_D89.md:235`: el `PATCH /casos/{id}/contacto` «`telefono` se interpreta como **número de contacto** → actualiza `contacto_cliente` + suma a `informacion`; **no** toca `id_pago`».
- Estado real: el validador vigente exige serie 700/701/702 (`app/schemas/casos.py:243-253`) y la APK `1.1.0+8` solo admite esa serie y la envía como `telefono` (`app_movil/lib/features/casos/acciones_caso.dart:69,75-89`); la ficha la rotula «Teléfono» (`app/web/src/components/FichaCaso.tsx:320`).
- Contradicciones internas: §6 (`documento_tecnico_D89.md:251`) niega al TECNICO editar el identificador y CU-05/A1 (`casos_uso_D89.md:218`) y su criterio de aceptación (`casos_uso_D89.md:234-238`) exigen `403`; la heurística se lo permite cuando el caso no tiene IP.

**Impacto.** Doble corrupción demostrable: (1) **no idempotencia**: un reintento del mismo `PATCH {telefono:"7014000848"}` sobre un caso que acaba de recibir IP deja de ser «identificador» y pasa a ser «contacto», escribiendo `[CONTACTO] 7014000848` en `informacion` —violando RF-46/DEC-IP-2, que reserva el `70*` al identificador); la APK escribe de forma optimista y reintenta (`casos_uso_D89.md:257-258`, CU-06 pasos 4-5), así que el caso no es hipotético. (2) **APK antigua**: cada «corrección de contacto» de la APK `1.1.0+8` inyecta el identificador en `contacto_cliente` e `informacion`, y como no toca `id_pago`, el contacto queda además desincronizado. RNF-30 («la APK `1.1.0+8` sigue operando sin cambios obligatorios») no se cumple: la APK **funciona**, pero corrompe.

**Corrección concreta (texto para §5 y §11-R3).**
```
PATCH /api/v1/casos/{id}/contacto
  telefono : SIEMPRE número de contacto. Se normaliza (RF-47).
             Si normalizar(telefono) coincide con configuracion['pago.serie_regex']
             -> 422 «El 70* es un identificador de pago: use el campo `id_pago`»
             (nunca se interpreta como identificador, ni con el caso sin IP).
  id_pago  : campo nuevo, solo ADMIN/SUPERVISOR/SUPER; valida el patrón;
             omitirlo NO borra el identificador.
```
Y en R3: sustituir la heurística por «la APK antigua debe actualizarse: al enviar un `70*` como contacto el servidor responde `422` con el mensaje anterior; se sube la versión mínima de la APK y se avisa por mensajería (propuesta §6)». Retirar de CU-05/A1 la lectura de que «un SUP recibe `403`» y alinearla con `ADMIN/SUPERVISOR`.

### H-03 · ALTO — «Forzar una REPARACIÓN sin identificador» es imposible con la regla dura

**Evidencia.** `documento_tecnico_D89.md:254` («Forzar una REPARACIÓN sin identificador: SUPER ✅ / ADMIN ✅ (motivo obligatorio)»), `documento_tecnico_D89.md:236` (`forzar_reclasificacion` solo ADMIN/SUPER) y `casos_uso_D89.md:357` (CU-08/A3: «el usuario insiste en guardarlo como REPARACIÓN… el caso queda marcado») frente a `documento_tecnico_D89.md:89-99`, que lo prohíbe a nivel de BD para toda fila nueva, y a `incremento_D89_identificador_pago.md:60` (RNF-29: «inserción directa en BD rechazada»).

**Impacto.** Dos requisitos incompatibles: si se implementa el forzado, la escritura falla; si no, §6 y CU-08/A3 mienten. Además está declarado «pendiente de decisión» (`documento_tecnico_D89.md:329-331`), de modo que el DDL no puede congelarse sin esa decisión.

**Corrección concreta.** Opción A (recomendada): eliminar el forzado de §6 y CU-08/A3 (la regla es absoluta). Opción B: soportarlo explícitamente con auditoría:
```sql
ALTER TABLE caso ADD COLUMN IF NOT EXISTS reparacion_forzada_motivo varchar(200);
ALTER TABLE caso ADD CONSTRAINT ck_reparacion_forzada
    CHECK (reparacion_forzada_motivo IS NULL OR length(btrim(reparacion_forzada_motivo)) >= 10) NOT VALID;
-- y el CHECK de la regla pasa a excluir el forzado registrado:
CHECK (tipo_caso <> 'REPARACION'
       OR reparacion_forzada_motivo IS NOT NULL
       OR (id_pago IS NOT NULL AND id_averia NOT LIKE 'REF-%'))
```

### H-04 · ALTO — La tabla nueva queda sin RLS pese a lo prometido

**Evidencia.** `documento_tecnico_D89.md:257-258` («`identificador_pago` se acota con `id_central` (RNF-21) y su política se **añade en D-89**») frente a §3.1 (`documento_tecnico_D89.md:66-114`), que no contiene `ENABLE/FORCE ROW LEVEL SECURITY` ni `CREATE POLICY`. El patrón vigente está en `RepoTecnico/requerimientos.md:200` (RNF-21) y `db/schema.sql:754-766`.

**Impacto.** Brecha de aislamiento multi-central en una tabla con PII (titular, dirección) y con la clave de negocio; incumple RNF-21 y su «prueba negativa (central A no accede a datos de central B)».

**Corrección concreta (añadir a §3.1, tras el `CREATE TABLE`).**
```sql
ALTER TABLE identificador_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE identificador_pago FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_ip_central ON identificador_pago;
CREATE POLICY p_ip_central ON identificador_pago
    USING      (app_central_actual() IS NULL OR id_central = app_central_actual())
    WITH CHECK (app_central_actual() IS NULL OR id_central = app_central_actual());
```
Nota: `CREATE POLICY` no admite `IF NOT EXISTS` en PG15; el `DROP POLICY IF EXISTS` previo mantiene la idempotencia (RT-18).

### H-05 · ALTO — `UNIQUE(numero)` global frente a multi-central

**Evidencia.** `documento_tecnico_D89.md:70` (`numero varchar(10) NOT NULL UNIQUE`) y `documento_tecnico_D89.md:175` (`id_central=caso.id_central` solo en el `INSERT`) frente a `casos_uso_D89.md:92` (CU-02/A1: «El sistema crea/usa el identificador **de la central del caso**»). El `UNIQUE` no incluye `id_central`.

**Impacto.** Con dos centrales y el mismo `70*` (usuario que se muda o dato compartido), el resolver encuentra la IP de la otra central y enlaza el caso a una fila que la política de RLS (H-04) oculta al usuario de su central: el caso mostraría «sin identificador» y la ficha quedaría incoherente con la BD. CU-02/A1 no es implementable como está redactado.

**Corrección concreta.** Decidir y documentar en §3.1/CU-02 (la duda CU-03 queda cerrada por esta decisión):
```sql
-- A) el 70* es global (identifica al suscriptor, no a la central):
UNIQUE (numero)                       -- y la lectura del histórico debe cruzar centrales a propósito
                                      -- (política de lectura p_ip_central_supervisor o servicio dedicado)
-- B) el 70* se repite por central:
CONSTRAINT uq_ip_central_numero UNIQUE (id_central, numero)
```
Y alinear CU-02/A1 con la opción elegida; en el caso A, `resolver_identificador` **no** debe reasignar `id_central`.

### H-06 · ALTO — RF-56/CU-11 sin persistencia

**Evidencia.** `documento_tecnico_D89.md:239` (`GET /api/v1/ingesta/lotes/{id}` ampliado con `filas_sin_identificador_pago`, `filas_con_contacto` **y su detalle**), `:291-292` (umbral por lote) y `casos_uso_D89.md:466-468` (CU-11 paso 3: «fila, `id_averia`, número detectado y motivo»), frente a `db/schema.sql:267-281`: `ingesta_lote` tiene `filas_leidas/filas_central/casos_nuevos/casos_duplicados/casos_descartados` y **ninguna** de las nuevas; el DDL de §3.1 tampoco las añade ni crea una tabla de detalle por fila.

**Impacto.** RF-56 (contadores + detalle) y CU-11 no se pueden implementar ni auditar; sin detalle no se puede «abrir cada caso desde el listado de avisos» (`casos_uso_D89.md:468`).

**Corrección concreta (añadir a §3.1 / RT-17).**
```sql
ALTER TABLE ingesta_lote
    ADD COLUMN IF NOT EXISTS filas_sin_identificador_pago integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS filas_con_contacto            integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS ingesta_lote_aviso (
    id_aviso   bigserial   PRIMARY KEY,
    id_lote    bigint      NOT NULL REFERENCES ingesta_lote(id_lote) ON DELETE CASCADE,
    id_central integer     REFERENCES central(id_central),
    fila       integer,
    id_averia  varchar(30),
    numero     varchar(30),
    motivo     varchar(30) NOT NULL
               CHECK (motivo IN ('SIN_IDENTIFICADOR_PAGO','CON_CONTACTO')),
    creado_en  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_ingesta_aviso_lote ON ingesta_lote_aviso (id_lote);
```

### H-07 · ALTO — Resolución no atómica: dos ingestas simultáneas abortan el lote

**Evidencia.** `documento_tecnico_D89.md:171-181` (algoritmo normativo: `SELECT` y, si no existe, `INSERT`) frente a `documento_tecnico_D89.md:285-287` («el alta masiva se apoya en `INSERT … ON CONFLICT DO NOTHING` seguido de `SELECT` en lote»). También `casos_uso/D89` no cubre la carrera. El script de migración y la ingesta usan transacción única (RT-18).

**Impacto.** Dos ingestas solapadas del mismo `70*` nuevo (reintento del Supervisor, dos centrales, job duplicado) provocan `unique_violation` en el segundo `INSERT`; al ser una transacción única, **se pierde el lote completo**. Contradice el principio 4 de §1 («idempotencia») y `documento_tecnico_D89.md:159` («idempotente»).

**Corrección concreta (reemplazar §4.2).**
```text
resolver_identificador(db, numero, caso) -> id_pago | None
  n = normalizar_numero(numero)
  patron = configuracion.get('pago.serie_regex') or '^70\d{8}$'
  si not re.fullmatch(patron, n): devolver None
  fila = db.execute(INSERT INTO identificador_pago (numero, id_central, nombre_titular, direccion_principal)
                    VALUES (:n, :id_central, :nombre, :direccion)
                    ON CONFLICT (numero) DO UPDATE SET numero = EXCLUDED.numero
                    RETURNING id_pago)         # DO UPDATE garantiza RETURNING en ambos caminos
  caso.id_pago = fila.id_pago
  caso.telefono = n                            # alias (DEC-IP-4)
  devolver fila.id_pago
```
(`DO UPDATE SET numero = EXCLUDED.numero` es un no-op seguro que permite `RETURNING` sin una segunda consulta; `DO NOTHING` obligaría a un `SELECT` adicional y a manejar el caso nulo.)

### H-08 · ALTO — Backfill con regla distinta a la del runtime

**Evidencia.** `documento_tecnico_D89.md:268` (paso 3: `DISTINCT regexp_replace(telefono,'\D','','g')` filtrando el patrón) y `:269` (paso 4: enlace y sincronización del alias) frente a `documento_tecnico_D89.md:159-166` (RF-47: quita prefijo `+58`/`0058`/`58` y el `0` inicial). `caso.telefono` es `varchar(30)` y admite guiones, espacios y prefijos (`db/schema.sql:320`).

**Impacto.** Datos demostrables de la muestra citada por la propia propuesta: los números con `+58`/`0058` (12-14 dígitos) **no** producen identificador en el backfill pero **sí** lo producirían en la ingesta; los casos correspondientes quedan sin `id_pago` (la verificación «0 casos válidos sin `id_pago`» sería falsa) y, en el alta manual, se crearían identificadores duplicados por formato. Además la verificación del paso 3 («`count(*)` = valores distintos válidos») es incorrecta por construcción: `701-400.0848` y `7014000848` son dos valores distintos que colapsan en uno.

**Corrección concreta.** Una sola función de normalización compartida —expuesta a SQL para que el backfill no reimplemente la regla— y verificaciones basadas en la misma expresión:
```sql
CREATE OR REPLACE FUNCTION app_normalizar_numero(p_valor text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE
        WHEN regexp_replace(coalesce(p_valor,''),'\D','','g') LIKE '0058%'
            THEN substr(regexp_replace(coalesce(p_valor,''),'\D','','g'), 5)
        WHEN length(regexp_replace(coalesce(p_valor,''),'\D','','g')) = 12
         AND regexp_replace(coalesce(p_valor,''),'\D','','g') LIKE '58%'
            THEN substr(regexp_replace(coalesce(p_valor,''),'\D','','g'), 3)
        WHEN length(regexp_replace(coalesce(p_valor,''),'\D','','g')) = 11
         AND regexp_replace(coalesce(p_valor,''),'\D','','g') LIKE '0%'
            THEN substr(regexp_replace(coalesce(p_valor,''),'\D','','g'), 2)
        ELSE regexp_replace(coalesce(p_valor,''),'\D','','g')
    END;
$$;

-- paso 3: un identificador por número normalizado, con los datos del reporte más reciente
INSERT INTO identificador_pago (numero, id_central, nombre_titular, direccion_principal)
SELECT DISTINCT ON (n.numero) n.numero, c.id_central, c.nombre_cliente, c.direccion
  FROM caso c, LATERAL (SELECT app_normalizar_numero(c.telefono) AS numero) n
 WHERE n.numero ~ :patron            -- mismo valor que configuracion.pago.serie_regex
 ORDER BY n.numero, c.fecha_reporte DESC NULLS LAST
ON CONFLICT (numero) DO NOTHING;

-- paso 4
UPDATE caso c SET id_pago = ip.id_pago, telefono = ip.numero
  FROM identificador_pago ip
 WHERE app_normalizar_numero(c.telefono) = ip.numero AND c.id_pago IS NULL;

-- verificación correcta (paso 4)
SELECT count(*) FROM caso
 WHERE app_normalizar_numero(telefono) ~ :patron AND id_pago IS NULL;   -- debe ser 0
```
Y actualizar `documento_tecnico_D89.md:159-166` para que la función `app_normalizar_numero` sea la fuente única (o generar la columna desde Python pasando los valores ya normalizados).

### H-09 · ALTO — Idempotencia de `[CONTACTO]` solo declarada

**Evidencia.** `documento_tecnico_D89.md:189-190` («si el texto `[CONTACTO] <numero>` ya está presente, no se añade otra vez (A5 de CU-D89-01)») y `casos_uso_D89.md:43` (A5); no hay SQL ni bloqueo. `documento_tecnico_D89.md:270` se limita a «0 duplicados en el texto».

**Impacto.** Con dos ejecuciones simultáneas (o con el paso 5 de la migración y la ingesta a la vez) el «comprobar y añadir» en memoria duplica el número en `informacion`, ensucia el texto que alimenta DESPACHO (`db/schema.sql:846`: `despacho.columnas_evaluar` incluye `informacion`) y multiplica PII (RNF-18/RNF-29).

**Corrección concreta (añadir a §4.3).**
```sql
UPDATE caso
   SET contacto_cliente = :n,
       informacion = CASE
           WHEN coalesce(informacion,'') LIKE '%[CONTACTO] ' || :n || '%' THEN informacion
           WHEN coalesce(informacion,'') = '' THEN '[CONTACTO] ' || :n
           ELSE informacion || E'\n[CONTACTO] ' || :n
       END
 WHERE id_caso = :id_caso;
```
y una prueba de concurrencia (dos sesiones sobre el mismo `id_caso`) en `test_d89_identificador_pago.py`.

### H-10 · ALTO — Contratos de entrada sin cerrar (ruta inexistente y escrituras que evitan el servicio)

**Evidencia.**
- `documento_tecnico_D89.md:236` cita `POST /api/v1/casos/manual`: **no existe**; el alta es `POST /api/v1/casos` (`app/api/routes_casos.py:317-319`, `@router.post("")`) y no hay ninguna ruta con `/manual` (`grep` sin coincidencias).
- `CasoManualCreate` (`app/schemas/casos.py:118-136`) no tiene `id_pago`, solo `telefono` (máx. 30) — y CU-07 (`casos_uso_D89.md:299`) exige «el **Identificador de pago**».
- `CasoUpdate` (`app/schemas/casos.py:139-161`) mantiene `telefono`, `contacto_cliente` e `informacion`, y `PATCH /casos/{id}` los escribe con `setattr` directo (`app/api/routes_casos.py:397-398`).
- `documento_tecnico_D89.md:326` (R7) promete que «toda escritura pasa por `services/pagos.py`».

**Impacto.** (a) El contrato del CU-07 no es implementable: no hay campo por el que recibir el identificador en el alta manual. (b) Por `PATCH /casos/{id}` (ADMIN/SUPERVISOR) se puede escribir `telefono` sin tocar `id_pago`, dejando el alias divergente y el histórico roto —el riesgo R7 se declara mitigado cuando **no lo está**—, y `contacto_cliente` sin pasar por la suma a `informacion`, contra DEC-IP-2.

**Corrección concreta (texto para §5).**
```
POST /api/v1/casos  (no /casos/manual)
  CasoManualCreate añade:  id_pago: str | None  (valida el patrón; obligatorio si tipo_caso=REPARACION)
  CasoManualCreate mantiene telefono=alias de lectura (solo se acepta si coincide con el id_pago resultante).

PATCH /api/v1/casos/{id}
  telefono, contacto_cliente e informacion SALEN del cuerpo de CasoUpdate (o quedan como
  solo lectura) y toda modificación pasa por services/pagos.py:
     contacto_cliente -> actualizar_contacto(caso, n)   (normaliza + suma [CONTACTO] + auditoría)
     id_pago          -> resolver/actualizar identificador (ADMIN/SUPERVISOR)
  Guardia de servicio: ninguna escritura de caso.telefono/contacto_cliente/informacion
  fuera de services/pagos.py (test de arquitectura).
```

### H-11 · ALTO — RBAC contradictorio (MONITOREO del TÉCNICO y edición del identificador)

**Evidencia.** `documento_tecnico_D89.md:253` («Consultar reincidencia y métricas por identificador … TECNICO ❌ (solo su cuadrilla, sin titular)»): la marca de prohibición y el paréntesis se contradicen. `requerimientos.md:247` da al TECNICO «—» en MONITOREO/GRÁFICOS, pero `app/api/routes_monitoreo.py:40-46` sí acota por cuadrilla (comportamiento real). Además `documento_tecnico_D89.md:251` concede «Crear/editar el identificador» a SUPERVISOR, mientras `casos_uso_D89.md:218` (CU-05/A1) dice que un SUP «recibe el campo deshabilitado y `403` si fuerza el endpoint» y RF-52 (`incremento_D89_identificador_pago.md:50`) admite ADMIN/SUPERVISOR.

**Impacto.** La matriz es la base de las pruebas negativas (RNF-21): con tres fuentes distintas, ni el desarrollador ni el auditor saben qué debe devolver el sistema; y el caso de uso contradice al requisito funcional.

**Corrección concreta.** Una sola fila por acción en §6, coherente con `requerimientos.md:239-257`:
```
| Consultar reincidencia y métricas por identificador | ✅ | ✅ | ✅ | ✅ Lectura acotada a su cuadrilla (routes_monitoreo._alcance), sin titular |
| Editar el identificador de pago (id_pago) | ✅ | ✅ | ✅ (con auditoría) | ❌ |
```
y corregir CU-05/A1 para que el `403` de ejemplo sea el del TECNICO (no el del SUPERVISOR).

### H-12 a H-27 (MEDIOS y BAJOS)

- **H-12 (MEDIO).** `documento_tecnico_D89.md:283-292` promete RNF-19 y solo enumera métricas. Añadir a §8: logs estructurados con `request-id`+usuario para clasificación/enlace/reclasificación, alerta «ingesta diaria no ejecutada» y alerta `filas_sin_identificador_pago > umbral` (`ingesta.umbral_sin_identificador`, clave que **tampoco** está en el `INSERT` de §3.1 líneas 102-109) y retención ≥30 días (`requerimientos.md:198`). Añadir a §9 la prueba de carga de 20 000 filas (RNF-33) con el dataset y la medición p95.
- **H-13 (MEDIO).** RT-13 (`requerimientos.md:295`) exige Alembic sobre `db/migrations/`; no existe `alembic.ini` ni `db/migrations/` en el repo (glob `**/alembic*` y listado de `RepoTecnico/db/`: solo `schema.sql`). RT-14 (`requerimientos.md:296`) exige CI; no hay `.github/workflows/`. Versionar §3.1 como revisión Alembic y nombrar el job de CI en §10.
- **H-14 (MEDIO).** RN-IP-03 (`propuesta_identificador_pago.md:151-153`, trazada en `incremento_D89_identificador_pago.md:77` a RF-45/RF-48) no aparece en §12 ni tiene componente; `estado` admite `'BAJA'` (`:74-75`) sin guardia. Añadir `baja_identificador()` en `services/pagos.py`, `ON DELETE RESTRICT` en la FK de `caso.id_pago` y su entrada en §12.
- **H-15 (MEDIO).** §5 no define endpoint de creación/edición del identificador pese a §6 (`:251`) y a la necesidad del alta manual (H-10). Definir `PATCH /api/v1/pagos/{numero}` (ADMIN/SUPERVISOR/SUPER), validación del patrón en servidor y auditoría.
- **H-16 (MEDIO).** `db/schema.sql:771-786` actualiza `actualizado_en` solo en las tablas listadas; `identificador_pago` no está. Añadirla al arreglo `tablas` en el mismo bloque del DDL.
- **H-17 (MEDIO).** `app/services/sistemas.py:38-50` enmascara `telefono`, `contacto`, `contacto_cliente`, `nombre_cliente`… pero no `numero`, `nombre_titular` ni `direccion_principal`. Ampliar `COLUMNAS_PII` para que SISTEMAS→contenido no exponga titular/dirección (RNF-31/RNF-18).
- **H-18 (MEDIO).** `documento_tecnico_D89.md:185-188` («columna 13 … se trata como número de contacto») frente a `casos_uso_D89.md:33` (paso 5: la 16 «o cualquier otro número») y A4 (`:42`): hay un solo `contacto_cliente`. Fijar: `contacto_cliente = col16` si trae valor; si no, `col13` normalizado; el resto **solo** a `informacion` separado por `|`.
- **H-19 (MEDIO).** `documento_tecnico_D89.md:159-166`: la regla «si empieza por `58` y **quedan** 10 dígitos» no está definida para 13 dígitos (`+58 0414…`), que no dispara ninguna regla y no cumple RF-47. Reordenar: dígitos primero, prefijos después, y añadir casos de prueba (`+58 0414…`, `0058 7014000848`, `58 7014000848`, `"7014000848 "`).
- **H-20 (MEDIO).** `documento_tecnico_D89.md:275-277`: el rollback no revierte la normalización de `caso.telefono`/`contacto_cliente` (§7 pasos 4-5) ni borra `configuracion`/`ix_ip_numero_trgm`; el principio 1 («aditivo y reversible», `:16-18`) no se sostiene. Añadir en el paso 1 `CREATE TABLE caso_d89_backup AS SELECT id_caso, telefono, contacto_cliente, informacion FROM caso;` y en el rollback su restauración + `DELETE FROM configuracion WHERE clave IN ('pago.serie_regex','pago.reincidencia_dias','referido.reclasificar_en_proximo_cambio','ingesta.umbral_sin_identificador');` + `DROP INDEX IF EXISTS ix_ip_numero_trgm;`.
- **H-21 (MEDIO).** `app/tests/conftest.py:34-50`: `SQL_LIMPIEZA` borra `caso` pero no `identificador_pago`; con la tabla nueva y filas, el teardown fallará por FK. Añadir `DELETE FROM identificador_pago;` **después** de `DELETE FROM caso …` y declararlo en §9 (los tests de integración se crean desde `schema.sql`, `conftest.py:21-25`).
- **H-22 (MEDIO).** `vw_caso_telefono` (`:112-114`) solo se menciona en el propio documento (sin consumidor en `app/`) y `CasoOut.telefono` (`app/schemas/casos.py:59`) procede del ORM. Una vista no «mantiene sincronizado» un alias (`:19-21`). O retirar la vista (y el paso de rollback) o documentar su consumidor único (p. ej. SISTEMAS→contenido); corregir la frase de §1.2 a «la serialización (`CasoOut.telefono`) mantiene el alias, porque `services/pagos.py` sincroniza la columna».
- **H-23 (BAJO).** `documento_tecnico_D89.md:302` apunta a `RepoTecnico/pruebas/e2e/24-…spec.js`; los 23 E2E existentes están en `RepoTecnico/pruebas/e2e/tests/` (p. ej. `23-panel-gestion.spec.js`). Corregir la ruta.
- **H-24 (BAJO).** `documento_tecnico_D89.md:314` dice «manuales 04/05/06/11»; en `Manuales/03-Implementacion/` esos números son `04-panel-y-casos`, `05-despacho`, `06-seguimiento-especiales-agenda` y `11-apk-tecnico-campo`, mientras `propuesta_identificador_pago.md:255` llama «05 (diccionario)» y «06 (ER)» a `05-Diccionario-de-Datos` y `06-Diagrama-Relacional`. Citar rutas completas.
- **H-25 (BAJO).** `casos_uso_D89.md:294` (CU-07: RF-45, RF-49, RNF-29) y `:343` (CU-08: RF-49, RF-50, RNF-29, RNF-32) no incluyen RT-19/RT-17 que sí figuran en la matriz (`:535-537`). Alinear.
- **H-26 (BAJO).** `documento_tecnico_D89.md:86-87`: `gin_trgm_ops` sobre `numero` (10 dígitos y ya `UNIQUE`) no aporta a ninguna consulta del diseño; RF-54 (`:216-225`) filtra por `fecha_reporte` y agrupa por `id_pago`. Retirar el trgm y añadir `CREATE INDEX IF NOT EXISTS ix_caso_id_pago_fecha ON caso (id_pago, fecha_reporte);`.
- **H-27 (BAJO).** `documento_tecnico_D89.md:78-79` (`CHECK (numero ~ '^[0-9]{7,15}$')`) frente a `incremento_D89_identificador_pago.md:60` (RNF-29: «validado por el patrón configurado»). Documentar explícitamente que el patrón de negocio se valida **solo** en el servicio (y probarlo), para que R1 y RNF-29 no se lean como contradictorios.

---

## 4. Correcciones mínimas para levantar el veredicto

### 4.1 Bloque DDL corregido para §3.1 (sustituye las líneas 66-115)

```sql
-- 1) Entidad del identificador de pago (DEC-IP-1/4)
CREATE TABLE IF NOT EXISTS identificador_pago (
    id_pago             bigserial    PRIMARY KEY,
    numero              varchar(10)  NOT NULL,
    id_central          integer      NOT NULL REFERENCES central(id_central),
    nombre_titular      varchar(160),
    direccion_principal text,
    estado              varchar(12)  NOT NULL DEFAULT 'ACTIVO'
                        CHECK (estado IN ('ACTIVO','SUSPENDIDO','BAJA')),
    creado_en           timestamptz  NOT NULL DEFAULT now(),
    actualizado_en      timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT ck_ip_serie CHECK (numero ~ '^[0-9]{7,10}$'),
    CONSTRAINT uq_ip_numero UNIQUE (numero)   -- ver H-05: decisión multi-central
);

-- 2) Enlace caso → identificador (1 → N), alias del teléfono y RLS (H-04)
ALTER TABLE caso ADD COLUMN IF NOT EXISTS id_pago bigint
    REFERENCES identificador_pago(id_pago) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS ix_caso_id_pago        ON caso (id_pago);
CREATE INDEX IF NOT EXISTS ix_caso_id_pago_fecha  ON caso (id_pago, fecha_reporte);

ALTER TABLE identificador_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE identificador_pago FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_ip_central ON identificador_pago;
CREATE POLICY p_ip_central ON identificador_pago
    USING      (app_central_actual() IS NULL OR id_central = app_central_actual())
    WITH CHECK (app_central_actual() IS NULL OR id_central = app_central_actual());

-- 3) Contadores y detalle de la ingesta (H-06)  → ver §4.2 de este informe
-- 4) Parámetros nuevos (configuracion.valor es jsonb)
INSERT INTO configuracion (clave, valor, descripcion) VALUES
  ('pago.serie_regex', to_jsonb('^70[0-9]{8}$'::text), 'Patrón del identificador de pago'),
  ('pago.reincidencia_dias', to_jsonb(90), 'Ventana en días para marcar reincidencia'),
  ('referido.reclasificar_en_proximo_cambio', to_jsonb(true),
   'Marcar REPARACIONES sin IP/avería y reclasificarlas al siguiente cambio'),
  ('ingesta.umbral_sin_identificador', to_jsonb(10), 'Umbral (%) de aviso por lote')
ON CONFLICT (clave) DO NOTHING;

-- 5) Trigger de actualizado_en (H-16): añadir 'identificador_pago' al arreglo del bloque de triggers
-- 6) El CHECK ck_reparacion_con_ip NO va aquí: se aplica en D-90 (H-01)
```

### 4.2 Otras correcciones de texto

1. §1.2 (`:19-21`): retirar la vista como mecanismo de sincronía (H-22).
2. §4.2 (`:171-181`): `INSERT … ON CONFLICT … RETURNING` (H-07).
3. §4.3 (`:189-190`): SQL atómico de `[CONTACTO]` (H-09) y regla col13/col16 (H-18).
4. §4.1 (`:159-166`): dígitos primero (H-19).
5. §5 (`:229-243`): ruta `POST /api/v1/casos`, campos nuevos/retirados de `CasoManualCreate`/`CasoUpdate`, `id_pago` obligatorio y `403` del TECNICO (H-02, H-10, H-15).
6. §6 (`:247-255`): una sola matriz (H-03, H-11).
7. §7 (`:264-281`): backfill con normalizador único, respaldo y rollback completo (H-08, H-20).
8. §8 (`:283-292`): RNF-19 concreto (H-12) y §9: prueba de carga y `conftest` (H-12, H-21).
9. §10 (`:305-314`): mover el `CHECK` a D-90 (H-01); versionar con Alembic y CI (H-13); rutas de manuales (H-24).
10. §11 (`:318-327`): reescribir R3 (H-02) y R7 (H-10).
11. §12 (`:333-347`): añadir RN-IP-03 (H-14).

---

## 5. Vacíos técnicos

1. **Observabilidad (RNF-19).** Sin logs estructurados, sin alertas, sin retención, sin traza de `request-id` para las operaciones nuevas; el umbral de aviso se cita en §8 pero no existe la clave en el DDL.
2. **Migraciones con Alembic (RT-13).** No hay revisión Alembic ni `db/migrations/`; el DDL se propone en `schema.sql` + script, contra `requerimientos.md:295`.
3. **CI (RT-14).** No se menciona el pipeline (`pytest`+Ruff+mypy+cobertura 70 %); no existe `.github/workflows/` en el repositorio.
4. **Pruebas de la APK antigua (RNF-30).** §9 solo prevé `flutter test` de la versión nueva (`:294`); falta la «prueba de contrato con la APK vigente» que exige `incremento_D89_identificador_pago.md:61` y la tarea de subida/publicación de versión (`scripts/publicar_apk.py` no se menciona).
5. **Multi-central.** No se decide el alcance del histórico (duda CU-03) ni el comportamiento del resolver entre centrales (H-05); RNF-21 exige la prueba negativa «central A no accede a datos de central B» y §9 no la incluye.
6. **Despliegue en Cloud Run / Cloud SQL.** El plan no describe el orden de despliegue (migración vs código), ni la ventana, ni la verificación post-despliegue, pese a que §10 exige la migración «en producción» en D-89 (agravado por H-01).
7. **Manuales.** D-94 nombra «04/05/06/11» pero no las rutas ni el manual de diccionario/ER que sí cambian (tabla nueva, columna nueva); el propuesta (§3) mezcla numeraciones (H-24).
8. **Reincidencia.** No se define el tratamiento de `fecha_reporte` nulo ni el índice de soporte; tampoco el resultado esperado para identificadores sin titular (`casos_uso_D89.md:440` sí lo describe, el diseño no).
9. **Contrato OpenAPI.** §9 dice «contratos» pero no hay esquema de `PagoOut`/`PagoDetalleOut` (solo se nombra `schemas/pagos.py`); RT-19 exige el contrato OpenAPI.
10. **Prueba de la restricción de BD (RNF-29).** Se anuncia «inserción directa rechazada» pero no se define el test que lo verifica tras `VALIDATE CONSTRAINT` (RNF-29 exige la prueba explícita de la restricción).

---

## 6. Verificado sin hallazgos

Se contrastó y **no** presenta defecto:

1. **Trazabilidad CU ↔ RF/RNF/RT.** Los 12 CU (`casos_uso_D89.md:25-540`) cubren los 12 RF, los 5 RNF y los 3 RT; no hay requisito huérfano ni CU sin requisito; §12 del documento técnico (`:333-347`) cubre los 11 componentes y los 12 CU.
2. **`ON CONFLICT (clave)` sobre `configuracion`.** Es válido: `clave` es `PRIMARY KEY` (`db/schema.sql:100`), así que existe la restricción única requerida.
3. **`INSERT` de parámetros con `valor jsonb NOT NULL`.** La corrección `to_jsonb('^70[0-9]{8}$'::text)` (`:102-109`) es correcta y evita el problema de las barras invertidas dentro de una cadena SQL con `standard_conforming_strings = on` (se usó `[0-9]` en lugar de `\d`).
4. **Idempotencia del `ALTER TABLE … ADD CONSTRAINT`.** El bloque `DO` con `pg_constraint` (`:91-99`) es válido y repetible.
5. **Semántica del `CHECK … NOT VALID`.** Un `CHECK` `NOT VALID` **sí** se aplica a las filas nuevas y no bloquea las históricas: cumple DEC-IP-3 (el defecto es de ciclo, H-01, no de semántica).
6. **`caso.id_averia` es `NOT NULL`** (`db/schema.sql:290`): no hay trampa de `NULL` con `NOT LIKE 'REF-%'` en el CHECK.
7. **`pg_trgm` disponible** (`db/schema.sql:23-24`): el índice `gin_trgm_ops` no falla por extensión (su utilidad es otra cosa, H-26).
8. **Hooks de la marca derivada.** `POST /casos/{id}/estado|cierre|cita|enrutado|no-contesta` y `POST /despachos/asignar-casos|quitar-casos` existen realmente (`app/api/routes_casos.py:416,470,533,564,697`; `app/api/routes_despachos.py:388,419`).
9. **Cita de RBAC del `PATCH /contacto`.** `app/api/routes_casos.py:51` es exactamente `_gestion = require_roles("ADMIN","SUPERVISOR","TECNICO")`, como afirma `documento_tecnico_D89.md:252`; y `ROL_SUPER` con bypass total está en `app/api/deps.py:20,65`.
10. **Diagnóstico del punto 3 de la propuesta.** `routes_especiales.py:191-195` calcula `tiene_id_averia` siempre `True` en el camino con caso existente y en el asociado (`:195`): la brecha B3-3 es real y el diseño la corrige con `id_averia NOT LIKE 'REF-%'`.
11. **Enlaces entre documentos.** Los tres enlaces del encabezado del documento (`:8`) resuelven a archivos existentes; `RepoTecnico/BaseOperaciones/` existe (`:280`).
12. **Estructura de los diagramas Mermaid.** Los 7 bloques (`diagramas_D89.md`) son sintácticamente válidos (flowchart, sequenceDiagram con `alt/else/end` anidados, erDiagram con atributos comentados, stateDiagram-v2); los actores y códigos CU coinciden con `casos_uso_D89.md`.
13. **Ausencia de `DELETE` sin filtro.** Ni el DDL, ni el plan de migración, ni el rollback propuestos contienen `DELETE` sin `WHERE` (D-55 se respeta en el diseño; el único `DELETE` del rollback propuesto aquí lleva filtro por `clave`).
14. **Numeración de requisitos.** `RF-45…56`, `RNF-29…33` y `RT-17…19` continúan correctamente el máximo en uso (RF-44/RNF-28/RT-16, `incremento_D89_identificador_pago.md:10`).
15. **Compatibilidad de `despacho`.** `app/services/despacho.py:309` usa `caso.telefono`: mientras el alias se sincronice (DEC-IP-4) el despacho impreso sigue funcionando sin cambios.

---

## 7. Veredicto final

**NO listo para implementar** en su revisión `9226C3B8…`. Pasa a desarrollo **si y solo si** se cumplen estas condiciones, en este orden:

1. **(H-01)** Retirar `ck_reparacion_con_ip` del DDL de D-89 y aplicarlo en D-90 junto con las reglas, o corregir en el mismo despliegue los caminos de alta (`routes_especiales.py:75-101`, `routes_casos.py:317-357`); ajustar el criterio de cierre de D-89.
2. **(H-02)** Eliminar la heurística R3: `telefono` siempre contacto, `422` si es un `70*`, e `id_pago` como campo explícito con rol ADMIN/SUPERVISOR/SUPER; alinear CU-05/A1 y §6.
3. **(H-03)** Resolver la decisión pendiente del forzado de REPARACIÓN y reflejarla en §6/CU-08 o en el CHECK.
4. **(H-04, H-05)** Añadir RLS de `identificador_pago` y cerrar la decisión multi-central en el DDL y en CU-02/A1/CU-03.
5. **(H-06, H-07, H-08, H-09)** Completar §3.1 con los contadores/detalle de ingesta y §4 con el alta atómica y el backfill normalizado.
6. **(H-10, H-11)** Corregir el contrato de entrada (ruta, campos, guardia de servicio) y unificar la matriz RBAC.

Con 1 a 6 aplicados, el documento pasa a **APTO CON OBSERVACIONES**; los MEDIOS y BAJOS restantes (H-12…H-27) pueden absorberse como tareas de los ciclos D-90 a D-94, pero H-12 (RNF-19), H-13 (Alembic/CI) y H-20 (rollback) deben tener dueño y ciclo asignados antes de la primera migración en producción.

---

### Anexo — Artefactos y líneas citadas

`documento_tecnico_D89.md` (auditado) · `incremento_D89_identificador_pago.md:10,44,50,60-61,66,69` · `casos_uso/casos_uso_D89.md:33,42-43,92,218,234-238,294,343,357,466-468,535-537` · `casos_uso/diagramas_D89.md` (completo) · `propuesta_identificador_pago.md:150-153,255,333` · `RepoTecnico/db/schema.sql:23-24,99-104,267-281,285-364,376-393,714-732,748-766,771-786,846` · `app/services/ingesta.py:26-76,139-152,171-224` · `app/services/sistemas.py:30-50,81-89` · `app/services/despacho.py:309` · `app/api/routes_casos.py:48-51,180-301,317-357,383-409,416,470,533,564,651-694,697,745-800` · `app/api/routes_especiales.py:72-101,165-213` · `app/api/routes_despachos.py:388,419` · `app/api/routes_monitoreo.py:40-46` · `app/api/deps.py:20,52-72` · `app/schemas/casos.py:59,118-161,233-253` · `app/models/caso_entities.py:50-115` · `app/tests/conftest.py:21-50` · `app/web/src/components/FichaCaso.tsx:320` · `app_movil/lib/features/casos/acciones_caso.dart:58-89` · `RepoTecnico/requerimientos.md:197-203,229-257,295-296`.

---

## Incorporación de los hallazgos (estado al 2026-10-08)

Corregidos en el **`documento_tecnico_D89.md` v0.2** (y, cuando el defecto nacía en
otro artefacto, en la `propuesta_identificador_pago.md` **v1.1**, el
`incremento_D89_identificador_pago.md` **v0.2** y los `casos_uso_D89.md` **v0.2**).

| # | Sev. | Resolución |
|---|---|---|
| H-01 | CRÍTICO | El `CHECK` se mantiene en D-89 **con un trigger `BEFORE INSERT OR UPDATE`** que convierte la fila a `tipo_caso='REFERIDO'` **antes** de validar: `POST /casos-especiales` y `POST /casos` (tipo REPARACION) siguen funcionando durante la transición y ninguna fila histórica queda atrapada (§3.1 pasos 6-7) |
| H-02 | CRÍTICO | Se **elimina la heurística**: el campo legado `telefono` se interpreta como contacto y, **si el valor cumple el patrón, se registra como identificador del caso** (DEC-IP-7, decisión del usuario: conversión en vez de `422`); la IP explícita solo por `id_pago` con ADMIN/SUPERVISOR/SUPER (§5 y R3) |
| H-03 | ALTO | §6 y CU-08/A3 ya no prometen el forzado: **DEC-IP-5** lo prohíbe; `409` con oferta de REFERIDO; la única matriz RBAC lo marca «no existe» |
| H-04 | ALTO | `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY p_ip_central` en el DDL (§3.1 paso 4) y fila propia en §12 |
| H-05 | ALTO | **DEC-IP-6 = único GLOBAL:** `UNIQUE (numero)` con `id_central` = central de origen y política RLS que permite leer la ficha a la central de origen o a la que tenga casos enlazados; CU-02/A1 reescrito (se reutiliza la misma ficha) |
| H-06 | ALTO | `ingesta_lote` gana los contadores y `avisos jsonb`; contrato `GET /ingesta/lotes/{id}` en RT-19 |
| H-07 | ALTO | `INSERT … ON CONFLICT (numero) DO NOTHING` + `SELECT` posterior + mapa en memoria (§4.2 y §4.6) |
| H-08 | ALTO | Backfill con **el normalizador de RF-47** y verificación «0 casos con número válido sin `id_pago`» (§7 pasos 3-4) |
| H-09 | ALTO | Suma y **reemplazo** de `[CONTACTO]` con SQL atómico (§4.3) + prueba de concurrencia (§9) |
| H-10 | ALTO | Ruta corregida a `POST /api/v1/casos`; `id_pago` declarado en alta y edición; **toda** escritura de `telefono`/`contacto_cliente`/`informacion` pasa por el servicio (R10) |
| H-11 | ALTO | Matriz RBAC única (§6): TÉCNICO «lectura de sus casos, titular enmascarado» e `id_pago` editable por **ADMIN/SUPERVISOR/SUPER**; matriz §5.2 de `requerimientos.md` actualizada |
| H-12 | MEDIO | §8 con eventos, alertas (umbral de filas sin identificador, lote no ejecutado) y retención; §9 con la prueba de carga de 20 000 filas |
| H-13 | MEDIO | §8 declara la convención real (script idempotente + `schema.sql`), la deuda de Alembic/CI y su cierre en D-94 |
| H-14 | MEDIO | `caso.id_pago … ON DELETE RESTRICT` y `services/pagos.py` como componente de RN-IP-03 en §12 (RF-57) |
| H-15 | MEDIO | `PATCH /api/v1/pagos/{numero}` definido en §5 (patrón, estado, auditoría, baja con casos vigentes) |
| H-16 | MEDIO | Nota del bucle de triggers: `identificador_pago` se incorpora al `actualizado_en` existente |
| H-17 | MEDIO | `COLUMNAS_PII` de `services/sistemas.py` incluye `numero`, `nombre_titular`, `direccion_principal` + prueba negativa (§9 y §12) |
| H-18 | MEDIO | Precedencia explícita: `contacto_cliente` = columna 16; si no viene, la 13 cuando no cumple el patrón |
| H-19 | MEDIO | `normalizar_numero` descarta primero todo lo que no sea dígito y luego aplica los prefijos (§4.1, con ejemplos) |
| H-20 | MEDIO | Rollback completo: respaldo `caso_d89_backup`, restauración de `telefono`/`contacto_cliente`/`informacion`, `DELETE` de las claves de `configuracion` y `DROP` de los índices (§7) |
| H-21 | MEDIO | `SQL_LIMPIEZA` de `conftest.py` con `identificador_pago` después de `caso` (§9) |
| H-22 | BAJO | Se **retira la vista** `vw_caso_telefono`; el alias lo escribe el servicio y `CasoOut.telefono` sale del ORM (§1.2 y §3.1) |
| H-23 | BAJO | Ruta E2E corregida a `RepoTecnico/pruebas/e2e/tests/24-identificador-pago.spec.js` |
| H-24 | BAJO | Rutas completas de los manuales en §10 (D-94), incluidos `05-Diccionario-de-Datos` y `06-Diagrama-Relacional` |
| H-25 | BAJO | Fichas de CU-07 y CU-08 alineadas con su matriz (`RT-19` y `RT-17`) en la v0.2 |
| H-26 | BAJO | Se retira el índice trigram sobre `numero` y se añade `ix_caso_id_pago_fecha (id_pago, fecha_reporte)` |
| H-27 | BAJO | Nota explícita en §3.1 y R1: el `CHECK` valida **formato**; el patrón de negocio lo valida el servicio |

**Veredicto tras la incorporación:** las condiciones H-01…H-11 quedan **cumplidas**
en la v0.2; el documento queda **APTO CON OBSERVACIONES** a falta de confirmar
**DEC-IP-5/6/7** y de ejecutar los ciclos D-89…D-94 con sus pruebas.
