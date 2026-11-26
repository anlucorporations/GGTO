# Diagramas v2 — Asistente con IA en grupo de Telegram

> Coherentes con `casos_uso_telegram_grupo_v2.md` (APTO en re-auditoría) y con
> DEC-TG-01…13. Mermaid renderizable en cualquier visor.

## 1. Diagrama de casos de uso

```mermaid
graph LR
  A1[ACT-TG-01 Miembro del grupo] --> CU1[CU-TG-01 Consultar caso por ID]
  A2[ACT-TG-02 Gestor SUPER/ADMIN/SUPERVISOR] --> CU2[CU-TG-02 Actualizar con /confirmar]
  A3[ACT-TG-03 Bot / outbox] --> CU3[CU-TG-03 Publicar alertas]
  A4[ACT-TG-04 Operador web] --> CU4[CU-TG-04 Asistente en la web]
  A5[ACT-TG-05 Admin del grupo] --> CU5[CU-TG-05 Gestionar miembros]
  A5 --> CU6[CU-TG-06 Configurar eventos y privacidad]

  CU1 -.->|include| MCP[consultar_caso MCP]
  CU2 -.->|include| API[PATCH/POST casos API]
  CU2 -.->|include| PEND[asistente_pending_confirm]
  CU3 -.->|include| OUT[notificacion.canal=TELEGRAM]
  CU1 -.->|extend| IA[LLM + fallback]
  CU4 -.->|include| MOTOR[Motor asistente-ggto]
```

## 2. Secuencia — consulta por identificador (CU-TG-01)

```mermaid
sequenceDiagram
  participant M as Miembro (from.id)
  participant T as Telegram webhook
  participant B as asistente-ggto
  participant X as MCP / API GGTO
  participant G as Grupo -5561202916

  M->>T: "¿estado de 28715618?"
  T->>B: update (secret_token, chat.id, from.id, message_id)
  B->>B: dedupe update_id + validar from.id
  B->>X: consultar_caso(id_averia)
  X-->>B: ID avería, pago, estado, sector
  B->>G: respuesta solo referencias
  B->>B: asistente_sesion(canal=TELEGRAM_GRUPO, id_grupo, message_id, p00)
```

## 3. Secuencia — actualización con `/confirmar <id>` (CU-TG-02)

```mermaid
sequenceDiagram
  participant G as Gestor (from.id)
  participant B as asistente-ggto
  participant P as pending_confirm
  participant A as API GGTO
  participant Gr as Grupo

  G->>B: "cambiar estado 7014048481 a DIFERIDO"
  B->>B: validar rol/puede_actualizar/central
  B->>P: INSERT (id_pending, expira_en, solicitado_por, vista previa)
  B->>Gr: vista previa con id_pending
  G->>B: /confirmar 123
  B->>P: SELECT y validar identidad + expira_en
  B->>A: POST /casos/{id}/estado
  A-->>B: 200 CERRADO/DIFERIDO + bitácora
  B->>P: UPDATE estado=CONSUMIDA, confirmado_por
  B->>Gr: resultado con solo referencias
```

## 4. Secuencia — alerta al grupo (CU-TG-03)

```mermaid
sequenceDiagram
  participant S as Sistema GGTO
  participant N as notificacion (outbox)
  participant W as Enviador TELEGRAM
  participant Gr as Grupo -5561202916

  S->>N: INSERT canal=TELEGRAM, destinatario=-5561202916, asunto=CIERRE
  N->>W: drenar PENDIENTE
  W->>Gr: plantilla solo referencias
  W->>N: estado=ENVIADA, id_mensaje_telegram, intentos
  alt sin credenciales
    W->>N: PENDIENTE + error "canal no configurado" + alerta supervisor
  end
```
