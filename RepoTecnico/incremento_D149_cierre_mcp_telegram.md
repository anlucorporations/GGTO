# Incremento D-149 — Cierre de MCP y del webhook de Telegram (*fail-closed*)

| Campo | Valor |
|---|---|
| Origen | **H-02** del `INFORME_OPTIMIZACION_V2.md` (CRÍTICA) |
| Fecha | 2026-10-21 |
| Alcance | Backend · sin cambios de esquema, web ni APK |
| Autor | Dirección del proyecto |

---

## 1. El defecto

`POST /api/v1/mcp` y `POST /api/v1/telegram/webhook` solo exigían su credencial
**si estaba configurada**:

```python
esperada = str(config.get("mcp.api_key") or "").strip('"')
if esperada and x_mcp_key != esperada:      # ← sin clave, la puerta quedaba abierta
```

En producción las dos claves de `configuracion` valen `""` (verificado con SQL:
`telegram.webhook_secret` y `mcp.api_key`, valor `""`, longitud 2), así que ambos
endpoints respondían **200 sin credencial**. Comprobado en vivo:

| Prueba | Antes |
|---|---|
| `POST /api/v1/mcp` (`initialize`) sin cabecera | `200` con `serverInfo: ggto-mcp` |
| `POST /api/v1/telegram/webhook` sin cabecera | `200` `{"ok":true,"ignorado":true}` |

Con eso, cualquiera que conociera la URL podía ejecutar `consultar_caso`
(**PII de suscriptores**), `estado_central`, `reportar_falla` (escritura) o los
comandos del bot (`/caso`, `/falla`).

---

## 2. Corrección

1. **Sin credencial configurada no se atiende** (`503`), tanto en MCP como en el
   webhook. Ya no hay *fail-open*.
2. **Credencial ausente o incorrecta:** `403` en Telegram y `401` en MCP. El
   error JSON-RPC `-32001` sobre HTTP 200 se sustituye por un HTTP 401 real.
3. La comparación usa `hmac.compare_digest` (tiempo constante).

---

## 3. Por qué no rompe nada

Los dos canales **no están en uso**:

| Comprobación | Resultado |
|---|---|
| `configuracion.telegram.webhook_secret` / `mcp.api_key` | `""` (vacíos) |
| Secret Manager | no hay ningún secreto de Telegram (`gcloud secrets list`) |
| Variables de entorno de Cloud Run | solo `DB_*`, `SECRET_KEY`, `DB_PASSWORD` |

No hay token de bot en ninguna parte, por lo que el webhook no recibe tráfico
legítimo: era una puerta abierta sin dueño. Para reactivar un canal hay que
configurarlo primero:

- **MCP:** escriba `mcp.api_key` en `configuracion` y envíe la cabecera `X-MCP-Key`.
- **Telegram:** escriba `telegram.webhook_secret` en `configuracion` **y** regístrelo
  en Telegram con `setWebhook(secret_token=…)` usando el token del bot.

---

## 4. Verificación

| Comprobación | Resultado |
|---|---|
| `test_alertas_api.py` + `test_contratos.py` contra PostgreSQL 18 | **44 passed (15m07s)**, esquema desechable `ggto_h02` (eliminado al terminar) |
| Pruebas nuevas | MCP sin clave → `503`; MCP con clave ausente/errónea → `401`; Telegram sin secreto → `503`; Telegram con secreto erróneo → `403` y **sin ejecutar** el comando |
| Contrato actualizado | `test_los_webhooks_no_exigen_token_pero_si_su_credencial` espera `503` sin credencial |
| Suite sin base | **111 passed, 438 skipped** |
| Ruff | `All checks passed!` |

---

## 5. Cambios por archivo

| Archivo | Cambio |
|---|---|
| `app/api/routes_alertas.py` | *Fail-closed* en `telegram_webhook` y `mcp`; `hmac.compare_digest`; `import hmac`. |
| `app/tests/test_alertas_api.py` | Fixture `canales_con_credencial`, cabeceras de los canales y 4 pruebas de cierre. |
| `app/tests/test_contratos.py` | El contrato de los webhooks refleja el cierre. |

---

## 6. Residuales

1. **Manuales desalineados (H-18):** `Manuales/03-Implementacion/09-api-endpoints.md`
   describe estos endpoints como públicos; queda pendiente de actualizar.
2. Los endpoints siguen sin pasar por el *rate limit* de RNF-22; con la credencial
   obligatoria el riesgo baja, pero conviene añadirlo si se reactivan.
3. `estado_central` de MCP usa `resolver_central(db, None, …)` y queda acotado por
   la central activa; al reactivar el canal conviene revisar su alcance (H-07).
