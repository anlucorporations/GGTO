# Plan de Desarrollo Vertical — GGTO v2 (Fase 3)

> Generado el 2026-11-12 (`/plan_desarrollo`) tras cerrar la Fase 2 (catálogo de 101 CU +
> gráficos + documento técnico, todo auditado). Cada ciclo es una **entrega 100 % operativa**:
> termina con código + pruebas + registro en `estado_proyecto.md` y validación del usuario
> antes de pasar al siguiente. Los CU citados son los del catálogo auditado.

## Base de partida (estado al 2026-11-12)

- HEAD `1302277` en `origin` (GitHub) y `gitlab` — asistente C1–C6 en código, sin desplegar.
- Producción: `ggto-prod-txblvento` / Cloud Run `ggto-web` v100 (16 routers, sin `routes_asistente`)
  / Cloud SQL `ggto-db` PG15 HA (44 tablas; `asistente_sesion`/`asistente_remitente` sin migrar).
- CI real: backend+web+apk; faltan `node --test` del asistente y build/push → Cloud Run (R10).
- Migraciones: patrón idempotente `scripts/migrar_*.py` (D-164) — decisión R11.
- Ingesta manual y reporte 16:00 bajo demanda — decisión R9.

---

## Ciclo F3-1 — Máquina de estados y resoluciones (RN-EST-01, RN-EV-01, RN-NC-01)

**Objetivo:** implementar los 3 requisitos nuevos aprobados en la auditoría del catálogo
(los únicos CU con criterios aspiracionales sin código).

**Tareas:**
1. `RN-EST-01`: catálogo `estado_transicion` (origen × destino por rol) + validación en
   `POST /casos/{id}/estado` (409 con transiciones válidas al fallar); migración idempotente
   `scripts/migrar_rn_est01.py`. Server-authoritative; la APK adopta los mismos estados.
2. `RN-EV-01`: exigir evidencias por tipo en `services/resolucion.py` (cierre 2 POTENCIA,
   DIFERIDO 3 DEMO, ENRUTADO 1) con mensajes de faltante; bloqueo equivalente en la APK antes
   de encolar (`operaciones_service.dart`).
3. `RN-NC-01`: contador de NO CONTESTA en el caso + devolución a cola tras N=3 (configurable
   en `configuracion`) con cancelación de la cita de 1ª visita (coherente con D-88).
4. Actualizar catálogo: pasar los criterios de «aspiracional» a «vigente» y borrar las notas
   de pendiente (`casos_uso/requisitos_nuevos.md` → estado IMPLEMENTADO).

**Criterios de aceptación (del catálogo):** CU-W-16/18/20 y CU-A-12/15/16/17 con sus criterios
Gherkin ahora testeables end-to-end.

**Pruebas:** pytest nuevos (matriz de transiciones, evidencias faltantes → 422 con lista,
3.er NO CONTESTA → devolución); widget/integration tests Dart para el bloqueo local;
regresión de los 9 pytest existentes y 39 node tests.

---

## Ciclo F3-2 — Despliegue del asistente virtual + v101 (producción)

**Objetivo:** dejar el incremento del asistente **operando en producción** (hoy solo en código).

**Tareas:**
1. Desplegar v101 en Cloud Run `ggto-web`: incluye `routes_asistente` (17.º router) y las 2
   tablas — ejecutar migraciones `migrar_av_asistente_sesion.py` y
   `migrar_av_asistente_remitentes.py --aplicar --si` (R2/H-1/H-2 del documento técnico).
2. Ejecutar `asistente-ggto/DESPLIEGUE.md` en vm-preview: usuario de servicio `GGTOAST001`
   (SUPERVISOR, central 2324X), secretos RS-2 (`/etc/secure/asistente-ggto.env` + docker
   secret REF-SEC-26), alta del servicio (puerto del rango 3002–3019), `setWebhook` con
   `secret_token` ≥ 32 chars.
3. Checklist §9 del canon (9 verificaciones) + humo final: alta real, evento, consultas,
   Telegram con CONFIRMAR; remitente no autorizado → silencio.
4. Verificar política de backup de `ggto-db` (R4 del doc técnico: RPO ≤ 24 h, RNF-16).

**Criterios de aceptación:** `/health` del asistente 200 con gateway+telegram configurados;
checklist §9 completa en `DESPLIEGUE.md`; v101 con 17 routers verificada vía `/api/v1/info`.

**Pruebas:** humo de producción + `node --test` 39/39 + pytest del router (9) contra staging.

---

## Ciclo F3-3 — CI/CD completo (R10)

**Objetivo:** pipeline con el alcance de RT-14/D-38 aprobado en la decisión del usuario.

**Tareas:**
1. `ci.yml`: job `asistente` con `node --test asistente-ggto/test/*.test.js` (39 casos).
2. Build + push de imagen a Artifact Registry y despliegue a Cloud Run `ggto-web`
   (solo en push a `GGTOv2-DSH-GCP`), con cuenta `ggtov2-deploy`/SA de `ggto-prod-txblvento`.
3. Espejo GitLab (`.gitlab-ci.yml`) con los mismos jobs (RT-14).
4. Badge/estado en LEEME y bitácora.

**Criterios de aceptación:** un push de prueba ejecuta los 4 jobs en verde y genera revisión
nueva de `ggto-web` sin intervención manual.

**Pruebas:** ejecución real del pipeline (push de prueba a rama de trabajo — con orden del
usuario para el push).

---

## Ciclo F3-4 — Parque GPON `servicio_gpon` (R3, aprobación pendiente)

**Objetivo:** migrar el catálogo del parque FTTH (hoy solo propuesto).

**Tareas:**
1. **Aprobación del DDL** (`PROPUESTA_parque_gpon_pde.md`) — requiere orden del usuario.
2. Migración idempotente `scripts/migrar_servicio_gpon.py` (simula → aplica) sobre `ggtov2`.
3. Carga inicial desde `ODN-PDE/` (Excel fuera de git, RS-2 — la carga se hace en runtime,
   nunca en repo) con las reglas: ODN→OLT→tarjetas 4/8/16 puertos, segundo nivel 1:16/1:8/1:32
   con FAT correlativas.
4. Integración mínima: búsqueda por FAT/puerto en la ficha del caso (enriquece CU-W-14 y el
   registro de masivas CU-W-36, D-118: OLT+slot+puerto+FAT).

**Criterios de aceptación:** tabla con carga verificable (conteo ODN/OLT/FAT = fuente Excel);
lookup FAT→casos operativo en web.

**Pruebas:** pytest de migración + humo de búsqueda.

---

## Ciclo F3-5 — Cierre de Fase 3 (regresión y estabilización)

**Objetivo:** asegurar que la suma de ciclos no rompió nada y dejar la base lista para Fase 4.

**Tareas:**
1. Regresión completa: pytest + `node --test` + analyze/test de APK + humo de los 6 flujos
   de secuencia del catálogo (ingesta→corte, campo offline, masiva, especial, asistente, acceso).
2. Actualizar `documento_tecnico.md` (riesgos R1–R3 cerrados, v101, CI completo) y `estado_proyecto.md`.
3. Actualizar catálogo de CU si algún flujo cambió con los requisitos nuevos.
4. Preparar la Fase 4 (plan de pruebas exhaustivas) y la Fase 5 (`@manuales`).

**Criterios de aceptación:** 100 % de la suite en verde; bitácora al día; sin requisitos
huérfanos en la trazabilidad del documento técnico.

---

## Resumen de hitos

| Ciclo | Hito | Depende de | Estado |
|---|---|---|---|
| F3-1 | RN-EST-01 + RN-EV-01 + RN-NC-01 implementados | — | ⬭ Pendiente |
| F3-2 | Asistente operativo en producción (v101) | F3-1 recomendable (evita doble despliegue) | ⬭ Pendiente |
| F3-3 | CI/CD completo | — (push de prueba requiere orden) | ⬭ Pendiente |
| F3-4 | Parque GPON migrado | Orden de aprobación del DDL | ⬭ Pendiente |
| F3-5 | Regresión + cierre | Todos | ⬭ Pendiente |

**Reglas de ejecución:** se codifica ciclo a ciclo; al terminar cada uno se corren sus pruebas,
se registra el resultado en `estado_proyecto.md` y se espera la interacción del usuario.
`RepoTecnico/Asistente/` y `ODN-PDE/` nunca entran a git (RS-2). Push a remotos solo con
orden explícita (`/push`).
