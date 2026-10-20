# Incremento D-128 — La evidencia nace ligada a su caso y con dueño (H-11)

| Campo | Valor |
|---|---|
| Petición | Resolver **H-11** de la [auditoría V3](INFORME_OPTIMIZACION_V3.md). Opción aplicada (la recomendada): **vínculo y dueño en la subida** |
| Fecha | 2026-10-20 |
| Alcance | Backend + esquema · migración **aplicada en producción** · despliegue **v60** · APK sin cambios (`1.15.6+31`) |
| Autor | Dirección del proyecto |

---

## 1. El defecto

`POST /evidencias/upload` guardaba la foto **sin decir a qué caso pertenecía** y
**sin validar quién la subía**:

- la evidencia quedaba **huérfana** (`id_actividad` nulo) hasta que llegaba la
  actividad de la CARGA; si esa actividad nunca llegaba, nadie la vinculaba;
- un usuario podía subir una foto contra **cualquier** `id_caso` de la central;
- la purga local del dispositivo podía borrar la referencia y dejar la foto sin
  dueño en el servidor.

---

## 2. Corrección

### 2.1 Esquema

`evidencia` gana `id_caso bigint REFERENCES caso(id_caso) ON DELETE CASCADE` y el
índice `ix_evidencia_caso` (migración `scripts/migrar_d128_evidencia_caso.py`,
**aplicada y verificada en producción**: `{id_caso: 0, indice: 0}` → `{1, 1}`).

### 2.2 La subida valida y vincula

- Con `id_caso > 0` se busca el caso y se comprueba que el usuario **pueda
  gestionarlo** con el mismo criterio que D-123 (`casos_permitidos`): un TÉCNICO
  solo sube evidencias de los casos de su cuadrilla (vigente o de la ventana de
  24 h); los roles de gestión, de cualquiera de su central. Si no → **403**.
- La evidencia guarda `id_caso` desde ese momento (`id_actividad` sigue llegando
  con la CARGA, que la vincula).
- `id_caso <= 0` es la firma de las evidencias de un **reporte de falla masiva**
  (`FM-…`): se aceptan sin vínculo, como antes (no hay caso todavía).
- La subida sigue siendo **idempotente por serial**.

---

## 3. Verificación

| Comprobación | Resultado |
|---|---|
| Backend (suite completa) | **469/469 en verde** (5 nuevas de D-128) |
| Pruebas nuevas | la evidencia guarda su `id_caso` y nace sin actividad; subir contra un caso ajeno → **403** y no deja fila; un ADMIN sube contra cualquier caso; la evidencia de una masiva (`id_caso = 0`) se acepta sin vínculo; el reenvío del mismo serial es idempotente |
| Migración | aplicada y verificada en producción |
| APK | sin cambios: ya enviaba `id_caso` al subir |

---

## 4. Cambios por archivo

| Archivo | Cambio |
|---|---|
| `RepoTecnico/db/schema.sql` | `evidencia.id_caso` + índice (CREATE y ALTER idempotentes). |
| `scripts/migrar_d128_evidencia_caso.py` | **Nuevo**: migración idempotente. |
| `app/models/entities.py` | `Evidencia.id_caso`. |
| `app/api/routes_sync.py` | Validación del caso (dueño y central) y `id_caso` en la evidencia. |
| `app/tests/test_d128_evidencia_caso.py` | **Nuevo**: 5 pruebas. |

---

## 5. Siguiente hallazgo

**H-12** — el lote de la CARGA no respeta la cronología: los `estados` se aplican
**siempre después** de las `actividades`, así que un CONTACTADO anterior puede
revertir un CIERRE posterior. Se consulta al usuario.
