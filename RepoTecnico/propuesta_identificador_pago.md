# Propuesta de cambio de foco — El **Identificador de pago (70\*)** como eje del sistema

| Campo | Valor |
|---|---|
| Documento | Propuesta de reglas de negocio + diseño + plan de migración (incremento **D-89**) |
| Estado | **v1.1 · hallazgos de la auditoría de casos de uso incorporados (H-01…H-21)** |
| Decisiones | **DEC-IP-1…7 cerradas por el usuario** (§8) |
| Fecha | 2026-10-08 |
| Base de la verificación | Brief, `requerimientos.md`, `diccionario_datos.md`, `db/schema.sql`, `app/` (backend + web) y `app_movil/` (APK) en el estado **D-88** |
| Alcance | Cambiar el foco del sistema: de **«caso con un teléfono»** a **«identificador de pago con N reportes»** |

---

## 0. Resumen ejecutivo

Las tres reglas que planteas son **correctas como regla de negocio** y encajan con
el dato real; sin embargo, el sistema actual **no las cumple del todo**, y en un
punto **hace lo contrario** de lo que la regla pide.

| # | Regla solicitada | Veredicto | Motivo en una línea |
|---|---|---|---|
| 1 | El 70\* es **obligatoriamente** el dato TELEFONO (= *Identificador de pago*); cualquier otro número es **número de contacto** y, si existe, **se suma en `informacion`** | ⚠️ **Parcial** | El CSV sí trae el 70\* en `telefono` y el móvil en `contacto_cliente`, pero el campo **no se llama, ni se valida, ni se busca** como identificador de pago; el contacto **no se suma** a `informacion`; y el endpoint de campo (D-88) **edita el 70\* llamándolo «número de contacto»** (semántica invertida). |
| 2 | Un identificador de pago puede tener **varios reportes** (ID de AVERÍA/CASO); los **históricos se construyen alrededor** de él | ⚠️ **Parcial** | El histórico existe (`GET /casos/{id}/relacionados`) pero se arma por **igualdad de cadena** de `caso.telefono`, no por una entidad identificador; no hay normalización, ni unicidad, ni métricas de reincidencia. |
| 3 | Los casos de **REPARACIÓN** exigen **70\* + ID de AVERÍA/CASO**; si no, son **CASO REFERIDO (especial)** | ❌ **No cumplida** | Nada obliga: la REPARACIÓN se crea sin 70\* y con `id_averia` sintético `REF-…`, y `tiene_id_averia` se calcula de forma que **siempre** da `true` (`routes_especiales.py:191`). |

**Conclusión:** el cambio de foco es viable y **urgente antes de las siguientes
evoluciones** (reincidencias, facturación, conciliación, reportería por usuario).
Se propone introducir la entidad **`identificador_pago`** (1 → N casos) y
reformular las reglas en ingesta, alta manual, casos especiales, API, web, APK,
despacho/monitoreo y manuales (ciclos **D-89 … D-94**, §5).

**Decisiones cerradas por el usuario (2026-10-08, detalle en §8):**

| # | Decisión |
|---|---|
| **DEC-IP-1** | El identificador de pago es **cualquier `70\d{8}`**, con el patrón **parametrizable** (`configuracion.pago.serie_regex`). |
| **DEC-IP-2** | La columna **`contacto`** del origen se **mantiene asociada** al caso como **Número de contacto** (estructurado y normalizado) y su valor **se suma** a `informacion`. |
| **DEC-IP-3** | Los casos existentes **se marcan** y se **reclasifican en su próximo cambio** (no hay reclasificación masiva). |
| **DEC-IP-4** | Se **conserva `caso.telefono` como alias** de lectura y la clave nueva es **`id_pago`** (`identificador_pago`). |
| **DEC-IP-5** | *(propuesta)* **No se puede forzar** una REPARACIÓN sin 70\* ni sin avería real, **ni siquiera el Super Usuario**: el sistema responde `409` y ofrece registrarlo como REFERIDO. |
| **DEC-IP-6** | ✅ **El identificador es único GLOBAL:** una sola ficha por número (`UNIQUE (numero)`); `id_central` es la **central de origen** y la **RLS** permite leerla a cualquier central que tenga casos enlazados. La reincidencia es global, informando cuántos de esos casos son visibles según el alcance. |
| **DEC-IP-7** | ✅ **Un 70\* tecleado como número de contacto se registra como identificador del caso** (no se guarda como contacto) y el sistema lo informa. |

---

## 1. Verificación punto por punto

### 1.1 Punto 1 — El 70\* es el dato TELEFONO (Identificador de pago)

**Lo que sí se cumple.** El archivo matriz trae el 70\* en la **columna 13
(`telefono`)** y el móvil personal en la **columna 16 (`contacto`)**, y así se
mapea:

| Evidencia | Qué muestra |
|---|---|
| `app/services/ingesta.py:38` | `("telefono", (13,), "str")` — col. 13 → `caso.telefono`. |
| `app/services/ingesta.py:41` | `("contacto_cliente", (16,), "str")` — col. 16 → `caso.contacto_cliente`. |
| `app/services/ingesta.py:73-74` | `telefono_oficina` (78) y `telefono_movil` (79) → teléfonos **del técnico**, no del cliente. |
| `RepoTecnico/db/schema.sql:320` | `caso.telefono varchar(30)` — sin validación de serie. |
| Muestra real `detalle_averias_gpon 12_09_2026.csv` (56 filas) | **56/56** valores de la col. 13 empiezan por **70** (700 ×2 y 701 ×54, 10 dígitos, todos distintos). La col. 16 son móviles **04xx** (412 ×15, 414 ×22, 416 ×3, 422 ×2, 424 ×12, 426 ×2), **cero** coincidencias con el 70\*. |

**Lo que NO se cumple (7 brechas concretas).**

| # | Brecha | Evidencia |
|---|---|---|
| B1-1 | El campo se llama y se muestra como **«Teléfono»**, nunca como «Identificador de pago»: no existe el concepto en el código ni en la documentación. | `app/web/src/components/FichaCaso.tsx:320` (`etiqueta="Teléfono"`), `app_movil/lib/features/casos/caso_detalle_screen.dart:121` (`'Teléfono'`), `app_movil/lib/widgets/caso_card.dart:25` (`Tel: …`). |
| B1-2 | **Semántica invertida en campo (D-88):** el «número de contacto» que edita el técnico se escribe en `caso.telefono` —es decir, en el **70\***— y se valida como serie 700/701/702. El número de contacto real (`contacto_cliente`) **no se puede editar**. | `app/schemas/casos.py:233-253` (`ContactoUpdate.telefono`, regex `(700\|701\|702)\d{7}`) + `app/api/routes_casos.py:651-694` (`setattr(caso, "telefono", valor)`) + `app_movil/lib/features/casos/acciones_caso.dart:69,86`. |
| B1-3 | El **alta manual y la edición web** aceptan cualquier texto en `telefono` (máx. 30) sin validar 70\*. | `app/schemas/casos.py:126` (`CasoManualCreate.telefono`) y `:143` (`CasoUpdate.telefono`). |
| B1-4 | La **búsqueda** solo mira `caso.telefono`; buscar por el número de contacto no encuentra nada. | `app/api/routes_casos.py:210`, `:291-301`. |
| B1-5 | Los números de contacto detectados **no se suman a `informacion`**: viven solo en `contacto_cliente`. | `RepoTecnico/db/schema.sql:323` (columna propia) y `app/services/ingesta.py:41`. |
| B1-6 | No hay **normalización**: un 70\* con guiones/espacios/`+58` produce otra clave. | `app/services/ingesta.py:139-141` (`_limpiar` solo hace `strip`). |
| B1-7 | `caso.telefono` **no es único**: nada impide que un caso guarde un no-70\* ni que el mismo 70\* se escriba de dos formas. | `RepoTecnico/db/schema.sql:716` (`ix_caso_telefono`, índice **no** único). |

> La duda ya estaba **abierta en el diccionario** desde la Fase 1: *«`telefono`:
> ¿puede haber múltiples casos por teléfono? ¿Se normaliza (sin guiones)?»*
> (`diccionario_datos.md:564`). Esta propuesta la cierra.

### 1.2 Punto 2 — Un identificador de pago, varios reportes (histórico alrededor del identificador)

**Lo que sí se cumple.** El sistema ya tolera **N casos por número** y ya existe un
histórico por teléfono:

| Evidencia | Qué muestra |
|---|---|
| `RepoTecnico/db/schema.sql:290` | `id_averia` es **único global** (D-05): un reporte = un caso. |
| `RepoTecnico/db/schema.sql:716` | El índice de `telefono` **no es único**: varios casos pueden compartirlo. |
| `app/api/routes_casos.py:741-767` | `GET /casos/{id}/relacionados` devuelve los antecedentes del **mismo teléfono** (id anterior, fecha de cierre, problema reportado y justificación) — es la base de la pestaña **HISTÓRICO** (D-70). |
| Muestra real (56 filas) | 56 identificadores distintos y 56 móviles distintos, **sin duplicados** en el día: la relación 1→N no se puede observar todavía, hay que prepararla. |

**Lo que NO se cumple.**

| # | Brecha | Evidencia |
|---|---|---|
| B2-1 | No hay **entidad identificador de pago**: la relación es implícita (coincidencia de texto) y no hay FK, ni catálogo, ni titular. | `RepoTecnico/db/schema.sql:285-364` (no existe `identificador_pago`); el ER de `diccionario_datos.md:545-557` no la contempla. |
| B2-2 | El histórico compara **cadena exacta** (`Caso.telefono == telefono`) y cae a `contacto_cliente` si el teléfono viene vacío, mezclando **identificador de pago con número de contacto**. | `app/api/routes_casos.py:756-767`. |
| B2-3 | Sin normalización, el mismo identificador escrito de dos formas **parte el histórico en dos**. | `app/services/ingesta.py:139-141`; índice no funcional en `schema.sql:716`. |
| B2-4 | No hay **métricas de reincidencia** (casos por identificador, tiempo entre reportes), ni alerta de reincidente, ni conciliación por identificador. | `app/services/monitoreo.py` (sin dimensión de identificador). |
| B2-5 | La ingesta **no reutiliza** un identificador ya conocido: cada fila crea un caso suelto y el vínculo depende de que el texto coincida. | `app/services/ingesta.py` + `routes_ingesta` (sin resolución de identificador). |

### 1.3 Punto 3 — REPARACIÓN exige 70\* + ID de AVERÍA; si no, es REFERIDO

**Lo que sí existe.** Hay soporte para clasificar y para identificadores sintéticos,
pero **nada** enlaza la regla:

| Evidencia | Qué muestra |
|---|---|
| `RepoTecnico/db/schema.sql:294` | `tipo_caso IN ('AVERIA','REPARACION','CONSTRUCCION')`. |
| `RepoTecnico/db/schema.sql:296` | `categoria IN ('RESIDENCIAL','EMPRESA','REFERIDO','GOBIERNO')` (existe el destino «REFERIDO»). |
| `RepoTecnico/db/schema.sql:376-393` | `caso_especial` con `clasificacion IN ('REFERIDO','EMPRESA','GOBIERNO')` y `tiene_id_averia boolean`. |
| `RepoTecnico/db/schema.sql:290` + `diccionario_datos.md:27-30` | `id_averia` `NOT NULL UNIQUE`; los casos sin avería de origen reciben **`REF-<CENTRAL>-<NNNNNN>`** (D-23). |
| `RepoTecnico/requerimientos.md:142` (RF-36) | «Gestionar los casos de tipo REFERIDO **sin `id_averia`**». |

**Lo que NO se cumple.**

| # | Brecha | Evidencia |
|---|---|---|
| B3-1 | Una REPARACIÓN se puede crear **sin 70\*** (el 70\* no se exige en ningún punto de escritura). | `app/schemas/casos.py:124-136` (alta manual) y `app/schemas/especiales.py` (`CasoEspecialCreate.telefono` opcional). |
| B3-2 | Una REPARACIÓN **sin ID de avería** se crea como REPARACIÓN con id sintético `REF-…`, en lugar de clasificarse como REFERIDO. | `app/api/routes_especiales.py:75-86`: si no hay `id_averia` se genera `REF-…` y **igual** se pone `tipo_caso="REPARACION"`. |
| B3-3 | `caso_especial.tiene_id_averia` es **siempre `true`** cuando el especial se asocia a un caso existente (`id_averia` es `NOT NULL`): el campo no distingue ID real de sintético. | `app/api/routes_especiales.py:191-195`. |
| B3-4 | La ingesta **nunca** clasifica: todo caso del CSV entra como `AVERIA`/`RESIDENCIAL` por defecto. | `app/models/caso_entities.py:52-53` (defaults) + `app/services/ingesta.py` (no toca `tipo_caso`). |
| B3-5 | No hay **restricción en BD** que impida una REPARACIÓN sin identificador ni sin avería real. | `RepoTecnico/db/schema.sql:285-364` (sin `CHECK` condicional). |

### 1.4 Hallazgo transversal

El punto **B1-2 (semántica invertida)** es el más peligroso de todos: hoy el
técnico en campo, al «corregir el número de contacto», **sobrescribe el
identificador de pago** del caso (con un 700/701/702 nuevo), mientras el número
de contacto verdadero queda intocable. Si mañana el identificador de pago es la
clave de conciliación, **cada corrección de campo corrompe la clave**.

---

## 2. El cambio de foco: un concepto, tres datos distintos

### 2.1 Los tres conceptos

| Concepto | Qué es | Dónde vive (propuesto) | Cardinalidad |
|---|---|---|---|
| **Identificador de pago (IP)** | Número **70\*** (10 dígitos) que enlaza al **usuario/suscriptor** con CANTV. Es la **clave de negocio**. | Entidad **`identificador_pago`** (`id_pago`) + `caso.id_pago` (FK) | **1 IP → N casos** |
| **Número de contacto** | Cualquier **otro** número (móvil 04xx, fijo, oficina) aportado por el usuario o el reportante. **No identifica a nadie**: sirve para llamar. | `caso.contacto_cliente` (normalizado) **y** reflejado en `caso.informacion` | 0..N por caso |
| **Reporte / caso** | La avería o actividad con **ID de AVERÍA** propio (`id_averia`, único global). | `caso` | 1..N por IP |

### 2.2 Reglas de negocio propuestas (EARS para restricciones, Gherkin para comportamiento)

- **RN-IP-01 (EARS · capacidad permanente).** El sistema **deberá** tratar como
  **identificador de pago** todo número que, tras normalizarse, cumpla el patrón
  configurado —por defecto **`^70\d{8}$`**, parametrizable en
  `configuracion.pago.serie_regex` (**DEC-IP-1**)— en el campo de teléfono del
  origen, y almacenarlo en `identificador_pago.numero` (único) y en `caso.id_pago`.
- **RN-IP-02 (EARS · condición).** **Si** el número de las columnas **13** (cuando
  no cumple el patrón) o **16** del origen **no** cumple `pago.serie_regex`,
  **entonces** el sistema **no** lo guardará como identificador de pago: lo
  registrará como **número de contacto** (`caso.contacto_cliente`) y lo **sumará**
  al campo `informacion` del caso (una sola vez, sin duplicar en recargas).
  Los números de las columnas **78 y 79** (`telefono_oficina`, `telefono_movil`)
  son **datos del técnico** y nunca se tratan como contacto del usuario (H-06).
- **RN-IP-03 (EARS · estado sostenido).** Mientras existan casos vigentes (no
  `CANCELADO`) para un identificador de pago, el sistema **impedirá** la baja del
  identificador y mostrará su histórico completo.
- **RN-IP-04 (Gherkin).**
  ```gherkin
  Dado un identificador de pago 7014000848 con 2 casos cerrados
  Cuando llega un tercer reporte con ese mismo número
  Entonces el sistema crea un caso NUEVO con su propio id_averia
  Y lo enlaza al identificador de pago existente (sin duplicar el identificador)
  Y la ficha muestra los 3 casos como histórico del identificador
  ```
- **RN-IP-05 (Gherkin · reparación).**
  ```gherkin
  Dado un caso de tipo REPARACION
  Cuando se intenta guardar sin identificador de pago (70*) o sin id_averia real
  Entonces el sistema NO lo guarda como REPARACION
  Y el caso pasa a tipo_caso = "REFERIDO" (el CHECK de tipo_caso se amplía)
  Y se registra como caso especial con clasificacion=REFERIDO
    (o EMPRESA/GOBIERNO si el usuario los eligió: la naturaleza es REFERIDO,
     la clasificación de negocio se respeta)
  Y deja la marca informando el dato faltante (sin 70* / sin id de avería)
  ```
- **RN-IP-06 (EARS · condición).** Si un caso `REPARACION` pierde su
  identificador de pago o su id real de avería en una edición, **entonces** el
  sistema lo reclasificará a `REFERIDO` en la misma transacción.
- **RN-IP-07 (EARS · capacidad permanente).** El sistema **deberá** normalizar todo
  número antes de compararlo o guardarlo: sin espacios, guiones, paréntesis ni
  prefijo internacional (`+58`, `0058`, `58`).
- **RN-IP-08 (EARS · evento).** Cuando un identificador de pago acumule **≥ 2
  reportes en 90 días**, el sistema lo señalará como **reincidente** en la ficha y
  en MONITOREO.
- **RN-IP-09 (EARS · condición).** Si el origen trae un valor en `telefono` que
  **no** es 70\*, el lote **no** fallará: la fila se ingesta con **número de
  contacto** y **sin** identificador de pago, y el lote registrará el contador
  `filas_sin_identificador_pago` con su aviso.
- **RN-IP-10 (EARS · capacidad permanente).** El sistema **deberá** exponer el
  identificador de pago rotulado como tal —«Identificador de pago (70\*)»— en
  ficha, ficha rápida, listados, buscador, agenda, despacho impreso y APK, y
  rotular los demás números como «Número de contacto».
- **RN-IP-11 (EARS · condición — DEC-IP-7).** Si un usuario introduce en el campo de
  **número de contacto** un valor que cumple `pago.serie_regex`, **entonces** el
  sistema lo registrará como **identificador de pago del caso** (resolviendo o
  creando la ficha y enlazándola), **no** lo guardará como contacto, y lo informará
  en la respuesta. Si el contacto anterior era otro número válido, se conserva.
- **RN-IP-12 (EARS · estado sostenido — DEC-IP-5).** Mientras un identificador de
  pago tenga casos en estado distinto de `CANCELADO`, el sistema **impedirá** su
  paso a `SUSPENDIDO` o `BAJA` y mostrará los casos que lo impiden.
- **RN-IP-13 (EARS · capacidad permanente — DEC-IP-6).** El sistema **deberá**
  mantener **una sola ficha** por número de identificador (`UNIQUE (numero)`), con
  `id_central` como **central de origen**, y permitir su lectura (RLS) a cualquier
  central que tenga casos enlazados a esa ficha; el histórico y la reincidencia son
  **globales**, indicando cuántos casos son visibles según el alcance del usuario.
- **RN-IP-14 (EARS · capacidad permanente).** El sistema **deberá** aplicar la
  regla de REPARACIÓN también sobre las filas históricas: ante cualquier
  actualización de una fila marcada, la reclasificación ocurre **en la misma
  operación** (trigger + servicio), de modo que ninguna fila quede atrapada.

### 2.3 Modelo de datos propuesto (aditivo y reversible)

```sql
-- 1) Nueva entidad: el identificador de pago (70*), eje del histórico.
--    Una sola ficha por número (DEC-IP-6) y CHECK solo de FORMATO (el patrón de
--    negocio es parametrizable en configuracion.pago.serie_regex, DEC-IP-1).
CREATE TABLE IF NOT EXISTS identificador_pago (
    id_pago             bigserial    PRIMARY KEY,
    numero              varchar(15)  NOT NULL,                 -- normalizado, sin guiones
    id_central          integer      NOT NULL REFERENCES central(id_central),  -- central de ORIGEN
    nombre_titular      varchar(160),                          -- último nombre conocido (PII)
    direccion_principal text,                                  -- última dirección conocida (PII)
    estado              varchar(12)  NOT NULL DEFAULT 'ACTIVO'
                        CHECK (estado IN ('ACTIVO','SUSPENDIDO','BAJA')),
    creado_en           timestamptz  NOT NULL DEFAULT now(),
    actualizado_en      timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT uq_ip_numero UNIQUE (numero),                   -- ÚNICO GLOBAL
    CONSTRAINT ck_ip_serie CHECK (numero ~ '^[0-9]{7,15}$')    -- formato, no patrón de negocio
);

-- 2) Enlace caso → identificador de pago (N casos por identificador)
ALTER TABLE caso ADD COLUMN IF NOT EXISTS id_pago bigint
    REFERENCES identificador_pago(id_pago);
CREATE INDEX IF NOT EXISTS ix_caso_id_pago ON caso (id_pago);

-- 3) La naturaleza REFERIDO es un tipo de caso (H-01): se amplía el CHECK vigente
ALTER TABLE caso DROP CONSTRAINT IF EXISTS caso_tipo_caso_check;
ALTER TABLE caso ADD  CONSTRAINT caso_tipo_caso_check
    CHECK (tipo_caso IN ('AVERIA','REPARACION','CONSTRUCCION','REFERIDO'));

-- 4) Regla de REPARACIÓN: el trigger la aplica ANTES de validar, de modo que
--    ninguna fila histórica queda atrapada (H-01 + RN-IP-14). El CHECK queda
--    como red de seguridad y rige para toda escritura (NOT VALID solo evita el
--    escaneo inicial).
CREATE OR REPLACE FUNCTION fn_caso_reparacion_a_referido() RETURNS trigger AS $$
BEGIN
    IF NEW.tipo_caso = 'REPARACION'
       AND (NEW.id_pago IS NULL OR NEW.id_averia LIKE 'REF-%') THEN
        NEW.tipo_caso := 'REFERIDO';
        IF NEW.categoria IN ('RESIDENCIAL', 'REFERIDO') THEN
            NEW.categoria := 'REFERIDO';
        END IF;  -- EMPRESA/GOBIERNO se conservan como clasificación de negocio (H-09)
    END IF;
    RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_caso_reparacion_a_referido ON caso;
CREATE TRIGGER trg_caso_reparacion_a_referido
    BEFORE INSERT OR UPDATE ON caso
    FOR EACH ROW EXECUTE FUNCTION fn_caso_reparacion_a_referido();

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_reparacion_con_ip') THEN
        ALTER TABLE caso ADD CONSTRAINT ck_reparacion_con_ip
            CHECK (tipo_caso <> 'REPARACION'
                   OR (id_pago IS NOT NULL AND id_averia NOT LIKE 'REF-%'))
            NOT VALID;
    END IF;
END $$;

-- 5) RLS de la tabla nueva (RNF-21 / DEC-IP-6): la ficha es única y global, pero
--    solo se ve si su central de origen es la del usuario O si esa central tiene
--    algún caso enlazado a la ficha.
ALTER TABLE identificador_pago ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_ip_central ON identificador_pago;
CREATE POLICY p_ip_central ON identificador_pago
    USING (app_central_actual() IS NULL
           OR id_central = app_central_actual()
           OR EXISTS (SELECT 1 FROM caso c
                       WHERE c.id_pago = identificador_pago.id_pago
                         AND c.id_central = app_central_actual()))
    WITH CHECK (app_central_actual() IS NULL OR id_central = app_central_actual());

-- 6) Contadores y detalle de avisos de la ingesta (H-11 / RF-56)
ALTER TABLE ingesta_lote ADD COLUMN IF NOT EXISTS filas_sin_identificador_pago integer NOT NULL DEFAULT 0;
ALTER TABLE ingesta_lote ADD COLUMN IF NOT EXISTS filas_con_contacto            integer NOT NULL DEFAULT 0;
ALTER TABLE ingesta_lote ADD COLUMN IF NOT EXISTS avisos jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 7) Parámetros nuevos (configuracion.valor es jsonb: se usa to_jsonb)
INSERT INTO configuracion (clave, valor, descripcion) VALUES
  ('pago.serie_regex', to_jsonb('^70[0-9]{8}$'::text), 'Patrón del identificador de pago'),
  ('pago.reincidencia_dias', to_jsonb(90), 'Ventana en días para marcar reincidencia'),
  ('referido.reclasificar_en_proximo_cambio', to_jsonb(true),
   'Marcar REPARACIONES sin IP/avería y reclasificarlas al siguiente cambio')
ON CONFLICT (clave) DO NOTHING;
```

Notas de diseño:

- **`caso.telefono` se conserva** (compatibilidad con la APK ya instalada, contratos
  y reportes impresos) y pasa a ser **alias de lectura** del identificador de pago;
  la clave nueva es **`id_pago`** y su escritura se restringe al identificador
  normalizado (**DEC-IP-4**). **Si el número de la columna 13 no cumple el patrón,
  `caso.telefono` queda en `NULL`** y ese número pasa a número de contacto (H-03).
- **`caso.contacto_cliente` guarda el número de contacto vigente** (el primero de
  la columna 16 que llegue, normalizado y buscable) **y** su valor se refleja en
  `informacion` (**DEC-IP-2**). Si la fila trae varios contactos, los adicionales
  viven en `informacion` (`[CONTACTO] a | b`); su estructuración en tabla propia se
  difiere (no es necesaria para la operación vigente).
- **La naturaleza REFERIDO es un `tipo_caso`** (`AVERIA · REPARACION ·
  CONSTRUCCION · REFERIDO`), no un valor de `categoria`: así el `CHECK` de
  REPARACIÓN no atrapa a los referidos y la clasificación de negocio
  (`categoria`/`caso_especial.clasificacion`) se conserva (H-01/H-09).
- **Marca de reclasificación pendiente (DEC-IP-3).** Es **derivada**, no una columna
  nueva: un caso está pendiente de reclasificar cuando
  `tipo_caso = 'REPARACION' AND (id_pago IS NULL OR id_averia LIKE 'REF-%')`.
  Se expone como chip «Reclasificar a REFERIDO» en web y APK y se **corrige en el
  próximo cambio** del caso (edición, cierre, cita, despacho o paso a estado
  terminal). Un cambio de estado **en** un caso ya terminal no lo reclasifica: queda
  informado en MONITOREO como pendiente histórico (H-19).
- **`caso_especial.tiene_id_averia`** pasa a calcularse de verdad:
  `id_averia IS NOT NULL AND id_averia NOT LIKE 'REF-%'`.
- **Concurrencia (H-07/vacío 4).** El alta del identificador usa
  `INSERT … ON CONFLICT (numero) DO NOTHING` seguido de `SELECT`, de modo que dos
  ingestas simultáneas (incluso de centrales distintas) no rompen la unicidad ni
  crean fichas duplicadas.
- **`configuracion`**: nuevas claves `pago.serie_regex` (`^70[0-9]{8}$` por defecto,
  **DEC-IP-1** — cambia la regla de negocio sin tocar el DDL),
  `pago.reincidencia_dias` (90) y `referido.reclasificar_en_proximo_cambio`
  (`true`, **DEC-IP-3**).

---

## 3. Impacto por capa

| Capa | Cambio | Archivos/artefactos principales |
|---|---|---|
| **BD** | `identificador_pago`, `caso.id_pago`, índices, CHECK de reparación, parámetros nuevos | `RepoTecnico/db/schema.sql`, `scripts/migrar_d89_identificador_pago.py`, `RepoTecnico/modelo_er.md`, `diccionario_datos.md` |
| **Ingesta** | Clasificar 70\* vs contacto, normalizar, resolver/reutilizar identificador, contadores nuevos del lote, aviso RN-IP-09 | `app/services/ingesta.py`, `routes_ingesta`, `ingesta_lote` (+`filas_sin_identificador_pago`, `filas_con_contacto`) |
| **Reglas/servicios** | Servicio `identificadores_pago` (resolver, normalizar, histórico, reincidencia) y `clasificar_caso` (RN-IP-05/06) | `app/services/pagos.py` (nuevo), `app/services/clasificacion.py` (nuevo), `app/services/despacho.py` |
| **API** | `GET /pagos`, `GET /pagos/{numero}` (con casos), `PATCH /casos/{id}` con `id_pago`; **D-88 corregido**: `PATCH /casos/{id}/contacto` edita **`contacto_cliente`** (cualquier número normalizado) y la **IP** solo ADMIN/SUPERVISOR con validación 70\*; búsqueda ampliada a contacto | `app/api/routes_casos.py`, `app/api/routes_pagos.py` (nuevo), `app/schemas/casos.py`, `app/schemas/pagos.py` |
| **Web** | Rótulo «Identificador de pago (70\*)» en ficha, ficha rápida, CASOS, ESPECIALES, AGENDA, buscador global y DESPACHO impreso; pestaña **Histórico** por IP (no por cadena); indicador de reincidencia | `FichaCaso.tsx`, `FichaRapida.tsx`, `Casos.tsx`, `Especiales.tsx`, `Agenda.tsx`, `BuscadorGlobal.tsx`, `Despacho.tsx`, `PanelGestionDiaria.tsx`, `types.ts` |
| **APK** | CABECERA con «Identificador de pago» (70\*) y «Contacto» separados; el diálogo de edición deja de validar 700/701/702 y pasa a editar el **contacto**; la IP no se edita desde campo | `app_movil/lib/features/casos/acciones_caso.dart:69,86`, `caso_detalle_screen.dart`, `widgets/ficha_caso.dart`, `widgets/caso_card.dart`, `operaciones_service.dart` |
| **Despacho / Monitoreo / Reportes** | Despacho y reporte de producción rotulan la IP; nuevas métricas **casos por identificador**, **reincidentes**, **reparaciones reclasificadas a REFERIDO** | `app/services/monitoreo.py`, `routes_despachos.py:460,603`, `RepoTecnico/metricas.md` |
| **Manuales** | Manuales 04 (panel y casos), 05 (diccionario), 06 (ER), 11 (APK) en técnico y literal + HTML/PDF y AYUDA | `RepoTecnico/Manuales/**`, `docs/Manuales/**`, `app/web/public/manual/**` |
| **Pruebas** | Nuevas unitarias/integración de reglas (pytest), E2E de rótulos y edición (Playwright) y `flutter test` de la ficha | `app/tests/test_d89_identificador_pago.py`, `app_movil/test/d89_*_test.dart`, `RepoTecnico/pruebas/e2e/24-identificador-pago.spec.js` |

---

## 4. Migración y plan de datos (sin pérdida, reversible)

1. **Inventario previo (solo lectura).** Contar en producción: casos con
   `telefono ~ '^70\d{8}$'`, con teléfono **no** 70\*, sin `contacto_cliente`,
   REPARACIONES sin id real, y **posibles identificadores compartidos** por varios
   casos.
2. **DDL aditivo.** Crear `identificador_pago`, añadir `caso.id_pago` + índice y los
   parámetros de `configuracion`. Ninguna columna se elimina ni se renombra.
3. **Backfill de identificadores.** Insertar desde
   `SELECT DISTINCT regexp_replace(telefono,'\D','','g') FROM caso` filtrando
   `^70\d{8}$`, y enlazar `caso.id_pago`. Los valores no-70\* **no** crean
   identificador.
4. **Contactos.** Normalizar `contacto_cliente` y **sumar** el número de contacto al
   `informacion` de cada caso (append idempotente, marcado `[CONTACTO]`), sin
   duplicar en recargas.
5. **Marca de reclasificación (DEC-IP-3).** **No** hay conversión masiva: se
   **marcan** las REPARACIONES sin IP o sin id real (marca derivada, §2.3) y el
   **trigger `trg_caso_reparacion_a_referido`** las convierte a `tipo_caso='REFERIDO'`
   en su próximo `UPDATE`, sin que ninguna fila quede atrapada (H-01). El servicio
   además crea/actualiza el `caso_especial` y la traza.
6. **Informe de conciliación (pre-migración).** Identificadores repetidos por
   formato y casos huérfanos **antes** de crear el `UNIQUE`; después del DDL esos
   estados quedan precluidos (H-20).
7. **CHECKS y validación.** `ck_reparacion_con_ip` rige desde su creación (el
   trigger garantiza que sea satisfacible) y se ejecuta `VALIDATE CONSTRAINT`
   cuando el informe del paso 6 no deje violaciones.
8. **Rollback.** Todo es aditivo: `DROP TRIGGER`, `DROP CONSTRAINT
   ck_reparacion_con_ip`, `DROP POLICY`, `DROP INDEX`, y dejar
   `caso.id_pago`/`identificador_pago` sin uso (el código anterior sigue operando
   con `caso.telefono` como alias, DEC-IP-4).

**Ejecución:** script idempotente `scripts/migrar_d89_identificador_pago.py`
(simulación por defecto, `--aplicar --si`, transacción única, verificación
post-migración y log en `RepoTecnico/BaseOperaciones/`), tal como los scripts
D-73/D-81/D-82/D-88. **Nunca** `DELETE` sin filtro (D-55).

---

## 5. Ciclos verticales propuestos (D-89 … D-94)

| Ciclo | Alcance | Entregable verificable | Riesgo |
|---|---|---|---|
| **D-89 · Identificador de pago en datos e ingesta** | Entidad, backfill, normalización, clasificación 70\*/contacto, contadores del lote | Migración aplicada + `pytest` de reglas RN-IP-01/02/07/09 en verde | Medio (datos reales en producción) |
| **D-90 · Reglas de REPARACIÓN y REFERIDO** | RN-IP-05/06 + `CHECK … NOT VALID` + corrección de `tiene_id_averia` + marca y reclasificación en el próximo cambio (DEC-IP-3) | Casos de prueba: reparación sin IP → REFERIDO; con IP+avería → REPARACIÓN; marcado → reclasificado al editar | Medio-alto (negocio) |
| **D-91 · API e históricos por identificador** | `routes_pagos`, `relacionados` por `id_pago`, corrección de D-88 (contacto vs IP), búsqueda por contacto | Contrato nuevo + `pytest` de histórico y edición | Medio |
| **D-92 · Web** | Rótulos, pestaña Histórico por IP, reincidencia, búsqueda global | E2E Playwright nuevo en verde | Bajo |
| **D-93 · APK** | CABECERA con IP y contacto, edición de contacto sin series, tarjeta con rótulo | `flutter analyze` + `flutter test` + APK firmada | Bajo-medio |
| **D-94 · Monitoreo, informes y manuales** | Métricas por identificador/reincidencia, despacho impreso, manuales 04/05/06/11 + HTML/PDF + AYUDA | Informe de métricas + manuales sincronizados | Bajo |

**Criterios de aceptación del incremento (globales):**

```gherkin
Dado un caso cualquiera del sistema
Cuando se abre su ficha en web o en la APK
Entonces el número 70* se muestra como «Identificador de pago (70*)»
Y los demás números se muestran como «Número de contacto»
Y el histórico lista los casos del mismo identificador, no los de igual texto
```

```gherkin
Dado un técnico en campo
Cuando corrige datos del contacto
Entonces el sistema modifica el número de contacto (y lo suma a informacion)
Y NO modifica el identificador de pago
```

---

## 6. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Series no contempladas (703+, números con prefijo `+58`) | Rechazos y falsos REFERIDOS | Parametrizar `pago.serie_regex` en `configuracion` y normalizar antes de validar |
| Reclasificación de casos reales en producción | Trazabilidad operativa | **DEC-IP-3**: sin conversión masiva; marca derivada, reclasificación en el próximo cambio, `CHECK NOT VALID`, log y rollback aditivo |
| Ruptura del contrato con la APK instalada (`1.1.0+8`) | Fallos en campo | `caso.telefono` se mantiene como alias; se sube versión de APK y se avisa por mensajería |
| Duplicar la suma del contacto en `informacion` en cada recarga | Texto sucio | Append idempotente con marca `[CONTACTO]` y comprobación previa |
| PII (identificador + titular) | Cumplimiento | Se mantiene el enmascaramiento por rol (RNF-18) y no se exponen titulares a TECNICO |
| Confusión IP vs contacto en la operación | Error humano | Rótulos explícitos + validación de entrada + capacitación en el manual 11 |

---

## 7. Trazabilidad con los requisitos existentes

| Requisito | Relación con esta propuesta |
|---|---|
| RF-30 (búsqueda por teléfono) | Se amplía: IP (70\*) y número de contacto, ambos normalizados |
| RF-32 (alta manual) | Exige IP para REPARACIÓN y valida serie; si no, alta como REFERIDO |
| RF-36 (REFERIDOS sin `id_averia`) | Pasa a ser el **destino automático** de toda REPARACIÓN sin 70\* o sin avería |
| RF-22 (deduplicación por `id_averia`) | Se conserva; se añade la resolución del identificador |
| RNF-12 (bitácora) | Toda reclasificación y enlace queda en `caso_estado_hist`/`auditoria` |
| RNF-18 (privacidad) | El titular del identificador se enmascara por rol |
| D-23 (`REF-…`) | Se conserva y se usa como **marca de que no hay avería real** |
| D-70 (histórico del caso) | Se reescribe para que el eje sea el identificador de pago |

---

## 8. Decisiones cerradas — DEC-IP-1…4 (usuario, 2026-10-08)

| # | Decisión | Respuesta del usuario | Efecto en el diseño |
|---|---|---|---|
| **DEC-IP-1** | **Series válidas** del identificador de pago | «Cualquier `70\d{8}` **parametrizable**» | Patrón en `configuracion.pago.serie_regex` (por defecto `^70\d{8}$`); `ck_ip_serie` sobre `identificador_pago.numero`; sin lista cerrada 700/701/702 |
| **DEC-IP-2** | **Número de contacto** | «Asocia la **columna Contacto**» | La columna `contacto` del origen (col. 16) queda **asociada al caso** como **Número de contacto** en `caso.contacto_cliente` (normalizado, buscable) **y** su valor se **suma a `informacion`**; se descarta el volcado a texto libre |
| **DEC-IP-3** | **Alcance de la reclasificación** REPARACIÓN → REFERIDO | «Marcar los existentes y reclasificar en su próximo cambio» | Sin conversión masiva: **marca derivada**, chip en web/APK, `CHECK ck_reparacion_con_ip NOT VALID` (ríge para escrituras nuevas) y reclasificación al editar/cerrar/citar/despachar |
| **DEC-IP-4** | **Nombre de la clave** | «Conservar `caso.telefono` como alias + `id_pago`» | `caso.telefono` sigue siendo el alias de lectura del 70\* (compatible con la APK `1.1.0+8`); la clave nueva es `id_pago` → `identificador_pago`; el renombrado en API/APK se difiere a la v3 |

> **Nota de interpretación (DEC-IP-2):** se entendió «asocia la columna Contacto»
> como *la columna `contacto` del archivo de origen se mantiene como el número de
> contacto del caso (estructurado y asociado)*, sumándose además a `informacion`
> según tu regla 1. Si la intención fuera otra (p. ej. eliminar la columna y dejar
> el número solo dentro de `informacion`), es reversible: basta con la variante (b)
> y se ajusta en D-89.

### 8.1 Decisiones propuestas por la auditoría (pendientes de confirmar)

| # | Pregunta | Por qué | Recomendación |
|---|---|---|---|
| **DEC-IP-5** | ¿Puede el Super Usuario **forzar** una REPARACIÓN sin 70\* o sin avería real? | Con el `CHECK` y el trigger, el forzado es imposible sin un mecanismo aparte (columna `forzado_motivo`, excepción en el `CHECK` y su propio criterio) | ✅ **CERRADA (2026-10-08): NO se puede forzar.** La regla es absoluta; el sistema responde `409` y ofrece registrarlo como REFERIDO (H-02) |
| **DEC-IP-6** | ¿El identificador es **único global** o **único por central**? | `UNIQUE (numero)` impide crear dos fichas del mismo número, pero obliga a que la RLS permita leer la ficha a toda central con casos enlazados | ✅ **CERRADA (2026-10-08): único GLOBAL.** `UNIQUE (numero)`, `id_central` = central de origen, política RLS que permite leer la ficha a cualquier central con casos enlazados y reincidencia **global** informando los casos visibles (H-07) |
| **DEC-IP-7** | ¿Qué pasa si el usuario teclea un **70\* en el campo de contacto**? | Sin regla, los criterios «el histórico no mezcla» y «la búsqueda separa» no son verificables (H-08) | ✅ **CERRADA (2026-10-08): se convierte en identificador del caso.** El número se enlaza como identificador y **no** se guarda como contacto; el contacto anterior válido se conserva |

**Con estas siete decisiones el documento queda en v1.2** y el siguiente paso es la
Fase 2 del incremento: **casos de uso** (Gherkin/EARS + trazabilidad) y
**documento técnico** de D-89…D-94, ya auditados y corregidos
([`auditoria_D89_casos_uso.md`](auditoria_D89_casos_uso.md) · H-01…H-21).

---

## 9. Historial de versiones

| Versión | Fecha | Cambio |
|---|---|---|
| v0.1 | 2026-10-08 | Verificación de los 3 puntos y propuesta del cambio de foco (D-89…D-94). |
| **v1.0** | 2026-10-08 | **DEC-IP-1…4 cerradas por el usuario** (§8) e incorporadas: serie `70\d{8}` parametrizable, columna `contacto` asociada + sumada a `informacion`, marca y reclasificación en el próximo cambio (`CHECK … NOT VALID`), `caso.telefono` como alias + `id_pago`. |
| **v1.1** | 2026-10-08 | **Hallazgos H-01…H-21 de la auditoría de casos de uso incorporados:** `tipo_caso='REFERIDO'` + trigger `trg_caso_reparacion_a_referido` y `CHECK` que ya no atrapa filas (H-01/H-02), `telefono` nulo para números no-70\* (H-03), contacto solo de las columnas 13/16 (H-06), `UNIQUE (numero, id_central)` + RLS y DEC-IP-6 (H-07), RN-IP-11/12/13/14 y DEC-IP-5/6/7 propuestas (H-08/H-12), contadores y `avisos jsonb` en `ingesta_lote` (H-11), conciliación pre-migración (H-20) y `CHECK` solo de formato. |
| **v1.2** | 2026-10-08 | **DEC-IP-5/6/7 cerradas por el usuario** (entrevista una a una): no se puede forzar una REPARACIÓN sin 70\*/avería; el identificador es **único global** (`UNIQUE (numero)`, `id_central` = central de origen, RLS que permite leer la ficha a la central con casos enlazados, reincidencia global informando los visibles); un 70\* tecleado como contacto **se registra como identificador del caso**. Actualizados RN-IP-11/13, el DDL y la política RLS. |
| v0.1 | 2026-10-08 | Verificación de los 3 puntos y propuesta del cambio de foco (D-89…D-94). |
