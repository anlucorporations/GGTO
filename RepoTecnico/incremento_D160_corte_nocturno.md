# Incremento D-160 — Corte nocturno de la jornada a las 23:00

| Campo | Valor |
|---|---|
| **Petición del usuario** | «Modifica la acción de cambio de status de los casos: 1. debe ejecutarse todos los días a las 23:00. 2. cambia el status de los casos no atendidos (cerrados, Enrutados) a Pendiente. 3. quita la asignación de los casos abiertos. 4. quita la asignación de los masivas y Mantenimiento. 5. solo puede ser ejecutado por el Supervisor o el Super Usuario.» |
| **Cierre de entrevista** | (a) R2: los **no atendidos** son **todo caso que no esté `CERRADO`, `CANCELADO` o `ENRUTADO`** — se restaura el criterio resuelto de D-99 y los `CITADO` conservan la fecha de su cita. (b) R4: «Mantenimiento» no existe en el dominio; la desasignación es la de **fallas masivas activas** (`id_cuadrilla = NULL`). (c) R1+R5: job nocturno de Cloud Scheduler + endpoint manual solo SUPERVISOR/SUPER. |
| **Base** | D-99 (jornada de despacho, RF-65/RF-66), D-157 (`DEVUELTO`), D-153/D-156 (jobs de mantenimiento con `X-Mantenimiento-Token`), DEC-MA-5 (cierre perezoso como respaldo). |

## Qué cambia

1. **Ejecución diaria a las 23:00 (R1).** Nuevo 5.º job de Cloud Scheduler
   `ggto-cierre-jornada` —cron `0 23 * * *`, `America/Caracas`— que llama al nuevo
   endpoint `POST /api/v1/mantenimiento/cierre-jornada` con el header
   `X-Mantenimiento-Token` (mecanismo existente; el `programar_job` de
   `RepoTecnico/scripts/11_desplegar_ggto_web.sh` lo crea/actualiza igual que los
   otros cuatro). El endpoint corre con `solo_vencidos=False`, recorre **todas**
   las centrales y es **idempotente** (un segundo disparo no cambia nada porque el
   corte solo procesa despachos ≠ `CERRADO`).
   `app/api/routes_mantenimiento.py` (endpoint), `scripts/11_desplegar_ggto_web.sh` (job).
2. **Los no atendidos vuelven a `PENDIENTE` (R2, aclaración del usuario).** El
   criterio resuelto de D-99 se **confirma**: `ESTADOS_RESUELTOS =
   ("CERRADO", "CANCELADO", "ENRUTADO")` (`app/services/jornada.py:45-49`); es
   decir, los no atendidos son **cualquier caso que no esté en esos tres
   estados** (`NUEVO/ASIGNADO/CONTACTADO/CITADO/DIFERIDO/EN_GESTION/PENDIENTE`)
   y vuelven a `PENDIENTE` con su fila `despacho_caso` en `DEVUELTO` (D-157)
   (`jornada.py` en el bucle del corte). Los casos **CITADO** conservan su
   `caso.fecha_cita`: el corte no reagenda ni borra la cita, y el despacho del
   día siguiente la vuelve a detectar como cita con prioridad
   (`despacho.py:610,779`).
3. **Asignaciones anuladas (R3).** Ya era el comportamiento de D-157 y lo
   sostiene el nuevo corte: caso a `PENDIENTE` vía `resolucion.registrar_estado`
   (con su bitácora `CasoEstadoHist`) y `despacho_caso.estado = DEVUELTO`
   (`jornada.py:145-152`); el histórico del despacho conserva la fila.
4. **Masivas sin cuadrilla (R4).** Nueva función `desasignar_masivas`
   (`app/services/jornada.py:89-106`): las fallas masivas **activas**
   (`DETECTADA|PLANIFICADA`) dejan su cuadrilla (`id_cuadrilla = NULL`) cuando el
   corte **actúa** (job nocturno o cierre con jornadas vencidas); el disparo
   perezoso de media mañana, donde nada venció, no toca nada
   (`jornada.py:165-168`). Las `CERRADA` no se tocan. La respuesta del corte
   informa el total nuevo `masivas_desasignadas`
   (`app/schemas/despacho.py`, `CierreJornadaOut`).
5. **Solo Supervisor o Super Usuario (R5).**
   - Endpoint manual: `POST /despachos/cierre-jornada` pasa de
     `_escritura` (ADMIN+SUPERVISOR) a `require_roles("SUPERVISOR")` — el rol
     **SUPER** entra por el bypass de `require_roles` (`app/api/deps.py:63-83`);
     el **ADMIN recibe 403** (`app/api/routes_despachos.py`, `cierre_jornada`).
   - Cierre perezoso: `ROLES_QUE_CIERRAN = ("SUPER", "SUPERVISOR")`
     (`app/services/jornada.py:44`); la entrada de un ADMIN ya no dispara nada.
   - El job nocturno no usa roles: se autentica con el token de mantenimiento
     (fail-closed: sin `MANTENIMIENTO_TOKEN` responde **503**, igual que los
     demás jobs de `/mantenimiento/*`).
6. **Hora del corte 23:50 → 23:00.** Semilla `despacho.hora_cierre_jornada`
   actualizada en `RepoTecnico/db/schema.sql` y respaldo por defecto
   `HORA_CIERRE_POR_DEFECTO = "23:00"` (`app/services/jornada.py:42`).
   **Migración operativa en producción** (el seed es `ON CONFLICT DO NOTHING`):
   ```sql
   UPDATE configuracion SET valor = '"23:00"'::jsonb
   WHERE clave = 'despacho.hora_cierre_jornada';
   ```

## Decisiones

| Decisión | Motivo |
|---|---|
| **DEC-D160-1** | Tras la aclaración del usuario, el criterio de D-99 se **mantener**: los no atendidos son todo caso que no esté `CERRADO`, `CANCELADO` o `ENRUTADO`; el corte nocturno no reabre desenlaces. Los `CITADO` vuelven a `PENDIENTE` **con la fecha de su cita intacta**, que el despacho siguiente vuelve a priorizar (`es_cita`). |
| **DEC-D160-2** | «Mantenimiento» no existe como tipo de despacho ni de caso (los tipos del checklist son `COMUNES`, `ESPECIALES_*` y `MASIVAS`, y `tipo_caso` es `AVERIA|REPARACION|CONSTRUCCION|REFERIDO`); la desasignación se aplica a las **fallas masivas activas**, que es lo único del dominio que guarda cuadrilla fuera del despacho. No se creó ningún tipo nuevo. |
| **DEC-D160-3** | El corte perezoso (DEC-MA-5) **no se elimina**: queda como respaldo para SUPER/SUPERVISOR con las mismas reglas nuevas, pero el disparador principal es el job de las 23:00. |
| **DEC-D160-4** | La desasignación de masivas solo corre cuando el corte actúa (`not solo_vencidos` o al menos un despacho vencido), para no soltar masivas a media mañana por una visita casual al listado. |

## Verificación

- `app/tests/test_d160_cierre_nocturno.py` (nuevo, 5 pruebas): el job cierra la
  jornada respetando `CERRADO`/`ENRUTADO` (el `DIFERIDO` vuelve a `PENDIENTE`
  con `DEVUELTO`), reporta `masivas_desasignadas`; **los `CITADO` conservan
  `fecha_cita` tras el corte**; idempotencia del job; desasignación filtrada
  por central; el endpoint manual da **403** a ADMIN/TÉCNICO y **200** a
  SUPERVISOR/SUPER; `quizas_cerrar` ignora a un ADMIN.
- Pruebas ajustadas al nuevo contrato (el corte lo ejecuta SUPER en vez de
  ADMIN): `test_d157_desasignacion.py` y `test_d113_despacho_tipos.py`
  (`test_los_cerrados_y_enrutados_sobreviven_al_corte` en
  `test_d99_masivas.py` verifica CERRADO/ENRUTADO/CANCELADO intactos),
  `test_sync_api.py`.
- Suite de integración completa contra PostgreSQL temporal:
  **606 passed** (verificado por archivo y por suite); `ruff check app` y
  `mypy app` limpios.
- Aviso de la web actualizado (`app/web/src/pages/Despacho.tsx`): el corte es a
  las 23:00, lo no atendido (todo lo que no esté CERRADO/CANCELADO/ENRUTADO)
  vuelve a PENDIENTE sin cuadrilla y los citados conservan su cita.

## Pendientes (requieren orden del usuario)

1. Commit/push (ambos remotos) y despliegue (`TAG=vN RepoTecnico/scripts/11_desplegar_ggto_web.sh --confirmar`) para que el job `ggto-cierre-jornada` se cree; después verificar `gcloud scheduler jobs list` con los **5 jobs**.
2. `UPDATE` de `configuracion.despacho.hora_cierre_jornada` a `23:00` en `ggtov2` (el seed cubre bases nuevas).
3. Regenerar manuales: la ayuda de DESPACHO cambió de 23:50 a 23:00 (H-18 style).
