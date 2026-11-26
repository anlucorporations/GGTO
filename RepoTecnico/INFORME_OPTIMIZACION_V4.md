# Informe de optimización V4 — Asistente con IA en grupo de Telegram (nueva versión)

| Campo | Valor |
|---|---|
| Fecha | 2026-11-26 |
| Alcance | Documentos de concepto de la nueva versión: `requerimientos_v2_telegram_grupo.md`, `diccionario_datos_v2_telegram_grupo.md`, `entornos_globales_v2_telegram_grupo.md`, fila «Nueva versión» de `estado_proyecto.md`, y línea base `asistente-ggto/` |
| Método | `@audita`: 7 revisores en paralelo → 7 verificadores adversariales → síntesis con deduplicación cruzada |
| Hallazgos revisados | 81 (12+12+11+12+11+11+12) |
| Sobrevivientes tras verificación | 45 (9+8+1+6+4+9+8); 36 descartados/fusionados |
| Hallazgos únicos tras deduplicación | 31 (2 CRÍTICOS, 13 ALTOS, 16 MEDIOS) |

## 1. Resumen ejecutivo y veredicto

**Veredicto: NO apto para iniciar la Fase 3 (desarrollo) tal como está la especificación.**

El diseño acierta en la línea base (motor único `asistente-ggto`, MCP/API canónicos, secretos en Secret Manager, canal `notificacion.canal=TELEGRAM`, `/confirmar`, PII reducida), pero arrastra **dos contradicciones críticas con el brief** y un conjunto de brechas de seguridad/identidad que impedirían una entrega funcional y segura:

1. **La APK se difirió** (DEC-TG-06) aunque el brief pide explícitamente «web **y APK**», y los propios RF-TG-04/RT-TG-05 siguen exigiéndola.
2. **Las pendientes de confirmación viven en un `Map` en memoria**, sin TTL ni identidad de usuario, en un motor diseñado para chat privado; en un grupo cualquier miembro podría confirmar la ficha de otro y un reinicio la pierde.

Además, el bot autoriza por `chat.id` del grupo en vez de `from.id` del usuario, y el modelo de permisos contradice el deseo «cada usuario puede actualizar». Estos puntos deben resolverse **antes** de escribir casos de uso o código.

## 2. Estado de calidad

| Dimensión | Resultado |
|---|---|
| Revisores desplegados | 7/7 |
| Verificadores desplegados | 7/7 |
| Falsos positivos descartados | 36 (44 %) |
| Mayor tasa de descarte | R3 (9/10, cubierto por RNF generales) y R5 (7/11) |
| Riesgo residual aceptado | Funnel único (DEC-TG-04), proveedor LLM con fallback, recinto de una sola central |

## 3. Hallazgos por severidad (tras deduplicación)

| ID | Sev. | Título | Fuentes |
|---|---|---|---|
| H-01 | **CRÍTICA** | APK diferida contradice el brief «asistente en web y APK» y a RF-TG-04/RT-TG-05 | R5-C, R1-A, R2-A |
| H-02 | **CRÍTICA** | Pendientes de confirmación volátiles (Map), sin TTL ni identidad, compartidas por el grupo | R6-C, R1-A, R4-A, R7-A |
| H-03 | ALTA | Token de confirmación `/confirmar` vs `CONFIRMAR` sin gramática ni allowlist de confirmador | R1-A, R2-M, R4-A, R7-A |
| H-04 | ALTA | RF-TG-01 exige «cliente», clasificación y fecha pese a DEC-TG-05 «solo referencias» | R1-A, R7-A |
| H-05 | ALTA | «Solo rol de gestión» contradice «cada usuario actualiza» y el permiso vigente del TECNICO (D-68) | R5-A, R4-A, R7-A |
| H-06 | ALTA | Miembro sin cuenta mapeado al usuario de servicio `GGTOAST001` (SUPERVISOR) → escalada | R5-A, R4-A, R7-A |
| H-07 | ALTA | Idempotencia `update_id`/`message_id` requerida pero no persistida | R1-A, R6-A |
| H-08 | ALTA | Autorización por `chat.id` del grupo en vez de `from.id` del usuario | R6-A, R7-M |
| H-09 | ALTA | Outbox sin credenciales de Telegram en la app (secreto creado en otro proyecto GCP) | R6-A |
| H-10 | ALTA | Cuota global compartida con el panel y webhook sincrónico → 429/latencia en grupo | R6-A, R1-M, R2-M |
| H-11 | ALTA | Respuestas publicadas en el grupo: cualquier miembro (incluido no autorizado) las lee | R7-A |
| H-12 | ALTA | Cumplimiento legal incompleto: DPA con Telegram/LLM, retención y responsable designado | R7-A |
| H-13 | ALTA | Cabeceras de estado obsoletas («entrevista pendiente», «Última actualización 10/11») | R2-A |
| H-14 | ALTA | RT-TG-04 pide entidad «alerta» nueva; DEC-TG-07 y el diccionario prohíben crearla | R2-A |
| H-15 | ALTA | Precedencia indefinida entre `rol`, `puede_actualizar` y bypass SUPER | R4-A, R1-M |
| H-16 | MEDIA | `eventos_config` jsonb sin catálogo validado ni valor por defecto | R1-M |
| H-17 | MEDIA | RF-TG-03 pide «formato definido» sin plantilla y reabre la decisión de PII | R1-M |
| H-18 | MEDIA | Solapamiento `asistente_remitente` vs `asistente_grupo_miembro` como fuente de autorización | R2-M, R4-M |
| H-19 | MEDIA | Fila de rama git/HEAD y «árbol limpio» contradice el checkout real (`feature/tg-grupo-ia`) | R2-M |
| H-20 | MEDIA | Modelo de IA documentado de tres formas incompatibles | R2-M |
| H-21 | MEDIA | Sin SLO de latencia para el turno del grupo con LLM | R3-M |
| H-22 | MEDIA | Funnel único sin conmutación (riesgo aceptado, requiere runbook) | R6-M |
| H-23 | MEDIA | Rotación del `secret_token` no acoplada a `setWebhook` | R6-M |
| H-24 | MEDIA | `scripts/migrar_tg_grupo.py` no existe pero se documenta su ejecución | R6-M |
| H-25 | MEDIA | Monitoreo/alertas no recreados en `ggto-prod-txblvento2` | R6-M |
| H-26 | MEDIA | Actor «administrador» ambiguo y chat de administración sin permisos definidos | R4-M |
| H-27 | MEDIA | Auditoría del canal grupo sin responsable de revisión | R4-M |
| H-28 | MEDIA | Dueño funcional del bot no declarado | R4-M |
| H-29 | MEDIA | Recinto por central incoherente con `id_pago` global y bypass SUPER | R7-M |
| H-30 | MEDIA | Trazabilidad sin `from.id`, confirmador ni diff de la ficha aplicada | R7-M |
| H-31 | MEDIA | Modo privacidad del bot sin valor explícito (texto libre vs comandos/@mención) | R5-M |

## 4. Hallazgos críticos detallados

### H-01 — APK diferida vs. brief
- **Evidencia:** `requerimientos_v2_telegram_grupo.md:29,52,74` exigen APK; `:74` y `entornos_globales_v2_telegram_grupo.md:51` la difieren; `estado_proyecto.md:9` contiene ambas afirmaciones.
- **Impacto:** el entregable incumple un punto central del pedido y hace no verificable `RF-TG-04`/`RT-TG-05`.
- **Recomendación:** decisión escrita del usuario: incluir la APK en esta versión o aprobar formalmente su diferimiento y retirar los RF/RT correspondientes.

### H-02 — Pendientes volátiles
- **Evidencia:** `asistente-ggto/server.js:337,411-434,441` usa `Map` por `chatId`; `diccionario_datos_v2_telegram_grupo.md:61-69` exige `asistente_pending_confirm` con `expira_en`; `requerimientos_v2_telegram_grupo.md:81` exige `/confirmar` con ID de solicitud.
- **Impacto:** suplantación entre miembros, pérdida tras reinicio, imposibilidad de auditar quién confirmó.
- **Recomendación:** persistir la pendiente, clave `(id_grupo, telegram_user_id, id_pending)`, TTL, estado y validación de rol en el momento de `/confirmar`.

## 5. RNF faltantes o débiles

- SLO de latencia del turno grupo→LLM→MCP (H-21).
- Observabilidad específica del canal (métricas por grupo/usuario, tasa de error, pendientes expirados) más allá del `/health` genérico.
- Política de deduplicación persistente y medible (H-07).
- Aplicación verificable de `politica_pii` en la salida del bot (H-04/H-11).
- DPA, retención y responsable de protección de datos para el nuevo canal (H-12).

## 6. Stakeholders faltantes

- Dueño funcional del bot y aprobador de `eventos_config`/`politica_pii` (H-28).
- Responsable de revisar la auditoría del canal grupo, por precedente SUPER solo lectura (H-27).
- Definición exacta de «administrador» y permisos del chat directo `8589760242` (H-26).
- Usuario de Telegram sin cuenta GGTO: actor sin privilegios, no subspacio del usuario de servicio (H-06).

## 7. Plan de acción

### Quick wins (S)
1. Corregir cabeceras de estado y la fila git de `estado_proyecto.md` (H-13, H-19).
2. Quitar «alerta» de `RT-TG-04` y el comando `migrar_tg_grupo.py` hasta crear el script (H-14, H-24).
3. Unificar el literal de confirmación en un solo documento (H-03) — **requiere decisión**.
4. Alinear `RF-TG-01` con `DEC-TG-05` (H-04).

### Mejoras (M)
5. Persistir `asistente_pending_confirm` y dedupe de updates (H-02, H-07).
6. Cambiar autorización a `from.id` y prohibir el `p00` de servicio para humanos (H-06, H-08, H-15).
7. Aprovisionar credenciales del outbox en el proyecto de la app y drenar con ritmo controlado (H-09).
8. Definir SLO, métricas y alertas del bot, y recrear el monitoreo en producción (H-21, H-25).

### Roadmap (L)
9. Resolver el alcance APK y el rol de actualización con el usuario (H-01, H-05).
10. Cerrar DPA/retención/responsable antes de datos reales (H-12).
11. Runbook de rotación atómica token+`setWebhook` y failover del ingress (H-22, H-23).

## 8. Preguntas para el usuario (bloque 1)

1. **APK (H-01):** ¿la pantalla de asistente entra en esta versión o apruebas explícitamente diferirla y retiramos RF-TG-04/RT-TG-05 de la APK?
2. **Actualización (H-05/H-06):** ¿«cada usuario puede actualizar» significa cualquier miembro del grupo (con validación y `/confirmar`) o solo roles de gestión? ¿Qué hacemos con el permiso vigente del TECNICO (D-68)?
3. **Confirmación (H-02/H-03):** ¿eligemos `/confirmar <id_pending>` como comando canónico y exigimos que lo envíe el mismo solicitante (o un gestor designado)?

> Las respuestas desbloquean la generación de casos de uso con Gherkin/EARS, gráficos y documento técnico de esta nueva versión.
