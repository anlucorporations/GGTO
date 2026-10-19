# Incremento D-118 — Masivas por FAT: creación, asociación y cierre

| Campo | Valor |
|---|---|
| Petición | 0) OLT, SLOT, PUERTO, FAT y Dirección obligatorios al crear · 1) la detección asocia solo los casos de ese FAT (OLT+SLOT+PUERTO) · 2) el alta manual exige ≥ 1 caso y busca otros por OLT+SLOT+PUERTO · 3) el cierre solo cierra los casos asociados que coincidan en OLT+SLOT+PUERTO+FAT; **no** los de la cuadrilla |
| Fecha | 2026-10-19 |
| Alcance | Backend + web + APK · columnas nuevas en `falla_masiva` (migración `scripts/migrar_d118_masivas_fat.py`) · versión APK **`1.14.0+23`** (incluye D-117 y D-118; pendiente de publicar) |

---

## 1. La identidad de una masiva es la tupla del FAT

`falla_masiva` gana `olt`, `slot` y `puerto` (además de `fat`). La identidad
técnica es:

```
OLT + SLOT + PUERTO + FAT
```

**DEC-118-1.** Dos grupos con el mismo OLT pero distinto slot, puerto o FAT **no**
son la misma masiva. La comparación normaliza espacios y mayúsculas
(`services/masivas._norm`).

---

## 2. Creación: cinco datos obligatorios y al menos un caso

### 2.1 Alta manual (web)

`POST /fallas-masivas` (`FallaMasivaManual`) exige:

- `olt`, `slot`, `puerto`, `fat` y `direccion` (mín. 5) **obligatorios**;
- `ids_caso` con **al menos un caso** (si viene vacío → **422**);
- cada caso debe existir en la central y **coincidir con la tupla**; si no,
  **422** y no se crea la masiva.

La web (`Masivas → Agregar manual`) tiene los cinco campos y un botón
**«Buscar casos de ese FAT»**: consulta
`GET /fallas-masivas/casos-candidatos?olt=&slot=&puerto=&fat=`, lista solo los
casos de esa tupla y permite marcar **uno o varios**. El botón de registrar queda
deshabilitado hasta que haya al menos uno seleccionado.

### 2.2 Reporte de campo (APK y web ALERTAS)

El formulario de la APK (`AlertasScreen`) y el de la web (`Alertas → Reportar
falla masiva`) piden **OLT, SLOT, PUERTO, FAT, Dirección, ODN y Descripción**.
El endpoint `POST /fallas-masivas/reporte-campo` asocia automáticamente **todos
los casos de esa tupla**; si no hay ninguno responde **422**.

**DEC-118-2.** El alta manual no puede quedar vacía: una masiva sin casos no se
puede cerrar ni sirve para el despacho. En el APK la asociación es automática por
tupla (no hay buscador de casos); en la web el operador elige entre los
candidatos.

---

## 3. Detección automática solo del mismo FAT

`services/fallas.detectar` agrupa por `(olt, slot, puerto, fat)` y exige los
cuatro valores no nulos. Crea una sola masiva por grupo, con
`clave_concentracion = "fat:{fat}"`, la tupla guardada y la asociación
materializada (`origen = AUTO`). Un grupo del mismo OLT y otro FAT **no** se
mezcla.

`GET /fallas-masivas/casos-candidatos` filtra por la tupla completa y excluye
CERRADO/CANCELADO/ENRUTADO; es la búsqueda del alta manual y de la asociación.

---

## 4. Asociación: solo casos del mismo FAT

`POST /fallas-masivas/{id}/casos` valida cada caso contra la tupla de la masiva.
Un caso de otro FAT responde **409** con el motivo y **no** se asocia. La
asociación es explícita en `falla_masiva_caso`; el sector **ya no** se usa para
arrastrar casos.

---

## 5. Cierre: solo los asociados y coincidentes, nunca la cuadrilla

`services/masivas.cerrar`:

1. **No** vuelve a sincronizar la concentración (se eliminó el
   `sincronizar_asociacion` que, en masivas manuales, podía añadir todo el
   sector).
2. Si no hay vínculos en `falla_masiva_caso`, responde **409**: «La masiva no
   tiene casos asociados».
3. Recorre **solo** esos vínculos y, para cada uno, verifica
   `OLT+SLOT+PUERTO+FAT`; si no coincide, lo **omite** con el motivo y no lo
   cierra.
4. No toca ningún caso de la cuadrilla que no esté asociado a la masiva.

**DEC-118-3.** El cierre no usa el sector ni la cuadrilla como fuente de casos.
Los textos de la web y de la APK ahora dicen «solo los casos asociados que
coincidan con OLT + SLOT + PUERTO + FAT» y advierten que los de la cuadrilla no
asociados no se tocan.

---

## 6. Migración de base de datos

Las columnas se añadieron a `RepoTecnico/db/schema.sql` (CREATE + ALTER
idempotentes) y hay un script específico:

```bash
python scripts/migrar_d118_masivas_fat.py            # simulación
python scripts/migrar_d118_masivas_fat.py --aplicar  # aplica con confirmación
```

Sin esas columnas el backend nuevo falla al consultar `falla_masiva.olt/slot/
puerto`; **aplique la migración antes de desplegar**.

---

## 7. Cambios por archivo

| Archivo | Cambio |
|---|---|
| `app/models/despacho_entities.py` | `olt`, `slot`, `puerto` en `FallaMasiva`. |
| `RepoTecnico/db/schema.sql` | Columnas en el CREATE y ALTERs idempotentes. |
| `app/schemas/alertas.py` | `FallaMasivaOut`/`FallaMasivaManual` con la tupla; `ids_caso`; `CasoCandidatoOut`. |
| `app/services/fallas.py` | Detección agrupada por OLT+slot+puerto+FAT. |
| `app/services/masivas.py` | `coincide`, tupla en `concentracion`, validación en `asociar`, cierre sin sector y con verificación. |
| `app/api/routes_alertas.py` | Alta manual con ≥1 caso, reporte de campo con tupla y asociación automática, buscador de candidatos, representativo por vínculos. |
| `app/services/sync.py` | La descarga de la APK incluye `olt`, `slot`, `puerto`. |
| `scripts/migrar_d118_masivas_fat.py` | **Nuevo**: migración idempotente. |
| `app/web/src/pages/Masivas.tsx` | Campos obligatorios, búsqueda de candidatos y selección de ≥1 caso. |
| `app/web/src/pages/Alertas.tsx` | Reporte de campo con OLT/SLOT/PUERTO/FAT/Dirección/ODN. |
| `app/web/src/masivas/FichaMasiva.tsx` | Tupla en el resumen y aviso de cierre. |
| `app/web/src/api/types.ts`, `client.ts` | Tipos y llamadas del buscador y del reporte de campo. |
| `app_movil/lib/features/alertas/alertas_screen.dart` | Campos OLT/SLOT/PUERTO obligatorios. |
| `app_movil/lib/features/casos/operaciones_service.dart` | Validación y payload con la tupla. |
| `app_movil/lib/features/masivas/ficha_masiva_screen.dart` | Tupla en la ficha y aviso de cierre. |
| `app_movil/lib/features/masivas/masivas_screen.dart` | Tarjeta con OLT/Slot/Puerto. |
| `app/tests/test_d99_masivas.py` | Alta por tupla, detección, candidatos, cierre con caso ajeno, ≥1 caso. |
| `app/tests/test_d82_falla_campo.py` | Reporte de campo con tupla y caso asociado. |
| `app/tests/test_alertas_api.py`, `test_d113`, `test_d114`, `test_despacho_api.py`, `test_contratos.py` | Fixtures/altas adaptadas a la tupla. |
| `app_movil/test/d82_apk_test.dart` | Validación de OLT/SLOT/PUERTO. |
| `app_movil/test/d99_masivas_test.dart` | Texto del aviso de cierre. |

---

## 8. Verificación

| Comprobación | Resultado |
|---|---|
| Backend `pytest` | **425/425 en verde** |
| Web `tsc --noEmit` | **sin errores** |
| Web `vite build` | **OK** |
| APK `flutter analyze` | **No issues found!** |
| APK `flutter test` | **209/209 en verde** |
| Migración | Simulación/verificación; **pendiente aplicar a la base de producción** |

**Pendiente:** aplicar `scripts/migrar_d118_masivas_fat.py --aplicar` en la base
real, compilar/publicar la APK `1.14.0+23` y desplegar la web/backend. Sin la
migración, el backend nuevo no debe desplegarse.
