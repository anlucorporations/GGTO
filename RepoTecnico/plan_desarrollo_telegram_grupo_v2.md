# Plan de desarrollo v2 — Asistente con IA en grupo de Telegram

> Fase 3 · 2026-11-26 · Rama `feature/tg-grupo-ia` · Alcance: **grupo + web**
> (APK en ciclo posterior, DEC-TG-11). Base: casos de uso APTO, documento
> técnico APTO, `INFORME_OPTIMIZACION_V4.md` y DEC-TG-01…17.

## Reglas de los ciclos

- Cada ciclo es una entrega **100 % operativa** con pruebas y verificación.
- No se pasa al siguiente ciclo sin validar el anterior con el usuario.
- Sin push a remotos sin orden explícita (`/push`).
- Toda migración es idempotente, se simula primero y se prueba en esquema aislado antes de production.

---

## F3-TG-1 — Migración idempotente y modelo de datos

**Entregable:** esquema v2 aplicable y verificable.

| Tarea | Detalle |
|---|---|
| Crear `scripts/migrar_tg_grupo.py` | Patrón D-121/D-164: simulación → `--aplicar --si`; log en `RepoTecnico/BaseOperaciones/`. |
| Tablas/columnas | `asistente_grupo` (chat_id -5561202916, titulo GGTOv3-PDE, id_central, politica_pii=REFERENCIAS, eventos_config jsonb), `asistente_grupo_miembro` (telegram_user_id, p00 nominado, rol, puede_actualizar), `asistente_pending_confirm` (estado, expira_en, solicitado_por, confirmado_por, id_mensaje_preview, índice único parcial `WHERE estado='PENDIENTE'`), extensiones de `asistente_sesion` (canal TELEGRAM_GRUPO, id_grupo, mensaje_id, from.id, resultado). |
| Catálogo | Tabla/enum de tipos de evento: `CIERRE`, `CITA`, `ENRUTADO`, `DIFERIDO`, `FALLA`. |

**Criterios de aceptación:** simulación sin errores; rerun idempotente («ya aplicada»); en esquema aislado se insertan grupo, miembro y pendiente y se rechaza `p00=GGTOAST001`; `pytest` del modelo en verde. **Esfuerzo M**.

## F3-TG-2 — Webhook seguro, identidad y deduplicación

**Entregable:** el bot recibe updates del grupo sin duplicados y con identidad real.

| Tarea | Detalle |
|---|---|
| `setWebhook` con `secret_token` desde `ggto-telegram-webhook-secret` | Verificar 403 sin cabecera, 200 con cabecera. |
| Identidad | Sustituir `message.chat.id` por `message.from.id` para autorizar y trazar. |
| Dedupe | Persistir `update_id`/`(chat_id, message_id)` con UNIQUE antes de responder; Windows de retención. |
| Fail-closed | 403 cabecera inválida; 503 credenciales internas ausentes (DEC-TG-15). |

**Criterios:** `node --test` con reenvío secuencial y concurrente sin duplicar; prueba de 403/503; `/health` con `telegram=configurado`. **Esfuerzo M**.

## F3-TG-3 — Consulta por identificador con MCP/API y PII controlada

**Entregable:** CU-TG-01 funcionando en el grupo.

| Tarea | Detalle |
|---|---|
| Resolución | `id_averia` + `id_pago` 70* vía `consultar_caso` (MCP) con fail-soft a API. |
| Serialización | Plantilla de solo referencias (ID avería, ID pago, estado, sector); rechazo explícito de nombre/teléfono/dirección. |
| Trazabilidad | `asistente_sesion` con canal, id_grupo, message_id, from.id, p00 y resultado. |
| Cuota/latencia | 30/min y 500/día por grupo y por usuario (429 con `retryAfterMs`); SLO p95 ≤5 s con LLM (H-21). |

**Criterios:** Gherkin CU-TG-01 en verde; test negativo de PII; métrica de latencia expuesta. **Esfuerzo M**.

## F3-TG-4 — Actualización con pendiente persistida y `/confirmar <id>`

**Entregable:** CU-TG-02 funcionando con control de identidad.

| Tarea | Detalle |
|---|---|
| Pendiente | Persistir en `asistente_pending_confirm` con TTL, estados y `confirmado_por`. |
| Comando | `/confirmar <id_pending>`; validar autoría o gestor designado; rechazar terceros con 403. |
| Escrituras | `PATCH /casos/{id}`, `POST /casos/{id}/estado` (DIFERIDO), `POST /casos/{id}/cita`, `POST /casos/{id}/enrutado`; TECNICO solo D-68. |
| Recinto | Validar central del miembro; bypass SUPER auditado. |

**Criterios:** escenarios de confirmar/descartar/expirar/suplantar en verde; bitácora con `from.id` real; 409 canónicos propagados. **Esfuerzo L**.

## F3-TG-5 — Alertas al grupo vía outbox

**Entregable:** CU-TG-03 y CU-TG-06 funcionando.

| Tarea | Detalle |
|---|---|
| Encolado | `notificacion.canal=TELEGRAM`, `destinatario=-5561202916`, `asunto=tipo_evento` habilitado en `eventos_config`. |
| Enviador | Leer token desde Secret Manager por referencia en el proyecto de la app (cierra H-09); plantilla de referencias; persistir `id_mensaje_telegram` en bitácora consultable. |
| Configuración | Validar claves contra catálogo; `politica_pii` sin `COMPLETO` para este grupo. |
| Reintentos | Backoff, max_intentos y alerta al supervisor al agotar. |

**Criterios:** test de evento habilitado/deshabilitado; dedupe de reenvío; drenaje controlado sin avalancha. **Esfuerzo M**.

## F3-TG-6 — Integración del asistente en la web

**Entregable:** CU-TG-04 funcionando con el mismo motor.

| Tarea | Detalle |
|---|---|
| SPA | Conectar panel existente al mismo endpoint del motor; ficha editable y `/confirmar` equivalente en web. |
| Contrato | Misma validación RNF-AV-06 y errores canónicos 422/404/409. |
| Accesibilidad | WCAG 2.1 AA heredado (RNF-23). |

**Criterios:** `npm run build` OK; prueba E2E de consulta y confirmación en web; sin duplicidad de lógica respecto al grupo. **Esfuerzo M**.

## F3-TG-7 — Cierre operativo y pruebas

**Entregable:** versión lista para Fase 4.

| Tarea | Detalle |
|---|---|
| Observabilidad | Métricas por grupo/usuario, 429/503, pendientes expirados, profundidad del outbox; recrear alertas en `ggto-prod-txblvento2` (H-25). |
| Runbooks | Rotación atómica token + `setWebhook` (H-23); failover del ingress (H-22); privacy mode (H-31). |
| Gobierno | Asignar dueño funcional del bot (H-28) y responsable de auditoría (H-27); permisos del chat admin (H-26). |
| Pruebas | `node --test`, `pytest`, `npm run build`, E2E con navegador; sin secretos en repo (`rg`). |

**Criterios:** 100 % de pruebas en verde y criterios de aceptación §7 del documento técnico verificados. **Esfuerzo L**.

## Ciclo posterior (fuera de esta versión)

**F3-TG-8 — APK:** pantalla de asistente consumiendo el mismo motor; RF/RT propios; versión de APK y publicación. **Esfuerzo M**.

## Dependencias

```
F3-TG-1 → F3-TG-2 → F3-TG-3 → F3-TG-4 → F3-TG-5 → F3-TG-6 → F3-TG-7 → (F3-TG-8)
```

F3-TG-6 depende de F3-TG-2/3/4; F3-TG-7 depende de todos los anteriores.
