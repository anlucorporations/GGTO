# Runbook de operación — Plataforma DespliegueGCP txbarlovento

⚠ **DOCUMENTO DE USO INTERNO** (contiene topología, cuenta de facturación y rutas internas): no subir a repos públicos/bucket/Drive.

**Versión:** v1.3 · Se completa a medida que se ejecutan las fases.
Cada sección se marca `PENDIENTE` hasta que la fase correspondiente esté APROBADA y verificada.

---

## 0. Acceso inicial a las VMs (se redacta definitivo en Fase 1)

```bash
# Una vez Tailscale instalado en tu equipo autenticado:
ssh txbarlovento@vm-dsh-dev.ts.net
ssh txbarlovento@vm-databases.ts.net
ssh txbarlovento@vm-blockchain.ts.net
ssh txbarlovento@vm-preview.ts.net
# o con CLI de Tailscale:
tailscale ssh vm-databases
```

## FASE 0 — GCP (PENDIENTE, actualizado v1.3)

```bash
# 0. Facturación + plan B
gcloud billing projects describe <PROYECTO> --format="value(billingAccountName)"
gcloud billing projects link <PROYECTO> --billing-account=01E9E1-5892F8-EC5643

# 1. Proyecto plataforma
gcloud projects create plataforma-txbarlovento --name="Plataforma txbarlovento"

# 2. APIs (incluida IAP para break-glass)
for api in compute.googleapis.com oslogin.googleapis.com secretmanager.googleapis.com \
           logging.googleapis.com monitoring.googleapis.com iap.googleapis.com \
           cloudresourcemanager.googleapis.com; do
  gcloud services enable $api --project=plataforma-txbarlovento
done

# 3. Bucket de backups (retención 30) + snapshots (retención 30, alineado)
gcloud storage buckets create gs://plataforma-txbarlovento-backups --location=europe-west1
gcloud compute resource-policies create snapshot-schedule backup-diario \
  --region=europe-west1 --max-retention-days=30 --daily-schedule --start-time=03:00

# 4. Presupuesto con alertas 50/90/100 (GATE 0)
gcloud billing budgets create --billing-account=01E9E1-5892F8-EC5643 \
  --display-name="plataforma-txblv" --budget-amount=200USD \
  --threshold-rule=percent=0.5 --threshold-rule=percent=0.9 --threshold-rule=percent=1.0
```

## FASE 1 — Recursos originales (referencia de comandos usados; ejecutada 2026-11-09, ver sección más abajo)

```bash
# Comandos reales usados (familia corregida a ubuntu-2404-lts-amd64):
gcloud compute instances create <vm> --project=plataforma-txbarlovento --zone=europe-west1-b \
  --machine-type=<tipo> --boot-disk-size=<GB> --boot-disk-type=pd-balanced \
  --network=plataforma-vpc --subnet=subnet-euw1 --no-address \
  --image-family=ubuntu-2404-lts-amd64 --image-project=ubuntu-os-cloud \
  --metadata=enable-oslogin=TRUE --service-account=<sa-...>@plataforma-txbarlovento.iam.gserviceaccount.com \
  --scopes=https://www.googleapis.com/auth/cloud-platform
# Snapshot policy en disco: gcloud compute disks add-resource-policies <vm> --zone=europe-west1-b --resource-policies=backup-diario
# IAP: regla allow-iap-ssh (35.235.240.0/20 -> tcp:22)
# NAT solo salida: routers create nat-router + routers nats create nat-egress
# Tailscale: curl install + 'nohup tailscale up --ssh --hostname=<vm>' -> enlace autenticado por el dueño
```

## FASE 2 — Bases de datos (EJECUTADA 2026-11-09)

```bash
# Instalado en vm-databases (100.89.28.1):
sudo curl -fsSL https://get.docker.com | sh          # docker 29.9.3 + compose v5.7
sudo apt-get install -y google-cloud-cli              # SDK 592 (SA de la VM usa metadata)

# Secretos (REF-SEC): pg-user / pg-password / mongo-user / mongo-password / pgadmin-email / pgadmin-password
# En VM: /etc/secure/{pg,mongo,pgadmin}.env (0400 root-only) -> env_file de compose (bootstrap de imágenes oficiales)

# Compose: /srv/compose/docker-compose.yml
#   postgres:16  -> 100.89.28.1:5432 (data /srv/data/postgres)
#   mongo:7 --auth --wiredTigerCacheSizeGB 1 -> 100.89.28.1:27017 (data /srv/data/mongo)
#   pgadmin4:8   -> 100.89.28.1:5050 (data /srv/data/pgadmin, chown 5050:5050)

# Alta de un proyecto:
#   1) PG: docker exec postgres psql -U txbarlovento -c "CREATE ROLE proj_<n>_usr LOGIN PASSWORD '<rnd>' CONNECTION LIMIT 10; CREATE DATABASE proj_<n> OWNER proj_<n>_usr;"
#   2) Mongo: docker exec mongo mongosh -u txbarlovento -p ... --eval "db.getSiblingDB('proj_<n>').createUser({...})"
#   3) secreto proj_<n>-pg / proj_<n>-mongo en Secret Manager + fila en tabla §3

# Backups en marcha: /srv/ops/backup.sh (cron 03:10) -> gs://plataforma-txbarlovento-backups/db/
# Drill restore OK (BD temporal). Repetir mensualmente (Fase 7).
```

### RS-2 en acciones de mantenimiento rápido (actualizado v1.3 — nunca heredoc/inline con secreto)

```bash
# Crear/actualizar un secreto desde archivo temporal 0600 creado y destruido en la misma operación:
HISTFILE=/dev/null  # evita que quede historial del flujo de alta
umask 077; TEMP_FILE=$(mktemp)   # archivo 0600
<pedir/editar el valor en $TEMP_FILE>  # ej: nano $TEMP_FILE (valor SIEMPRE ya en 03_credenciales.md)
gcloud secrets create dsh-user --data-file=$TEMP_FILE --replication-policy=user-managed \
  --locations=europe-west1
shred -u $TEMP_FILE   # destrución segura del temporal

# Pull a archivo root-only en la VM (SA de la VM por IAM):
sudo gcloud secrets versions access latest --secret=dsh-password \
  > /etc/secure/dsh_password && sudo chmod 0400 /etc/secure/dsh_password

# Auditoría anti-env (script versionado audit-sec.sh; exit 0 = PASS, GATE exige exit 0):
#   a) /proc/*/environ sin credenciales
#   b) grep -rn de .env en /srv /home /etc (excluye binarios)
#   c) docker inspect de contenedores activos sin vars con secretos
```

### 3. Registro de proyectos (viva, editable)

| Proyecto | Tipo | PG BD/usuario | Mongo DB/usuario | Puerto preview | URL preview |
|---|---|---|---|---|---|
| `asistente-ggto` (GGTO) | Node.js chat + tools MCP | `ggtov2`/`ggtov2_app` (historial `asistente_sesion`) | *(opcional, sin usar)* | **3004** | `http://100.113.94.52:3004` (panel web; Telegram webhook pendiente de URL pública) |

### 3bis. Registro de ejecución Fase 2

| Item | Estado |
|---|---|
| postgres:16 en 100.89.28.1:5432 | ✅ SELECT OK (usuario txbarlovento) |
| mongo:7 en 100.89.28.1:27017 (auth, cache 1GB) | ✅ ping OK |
| pgadmin4 en 100.89.28.1:5050 (login txbarlovento@gmail.com) | ✅ HTTP 302 |
| backups diarios → GCS + drill restore | ✅ probado (pgall+mongo subidos; restore en DB temporal) |
| cron backup | ✅ 03:10 diario |

## FASE 1 — Crear VMs + Tailscale (EJECUTADA 2026-11-09 — infra completa; resto del GATE en el dueño)

Realizado:
- 4 VMs: `vm-dsh-dev` (e2-standard-2, 80GB), `vm-databases`/`vm-blockchain` (e2-medium, 40GB), `vm-preview` (e2-medium, 50GB) — TODAS `--no-address`, VPC `plataforma-vpc/subnet-euw1`, SAs propias, snapshot-policy `backup-diario` en los 4 discos.
- Break-glass IAP: verificado (la primera conexión SSH fue por IAP). Regla `allow-iap-ssh` (35.235.240.0/20 → tcp:22) — excepción RS-1 documentada.
- Cloud NAT `nat-egress` (solo salida, sin ingress público) — necesario para instalar paquetes (RS-1: el NAT de salida NO es exposición).
- Tailscale 1.104.5 en las 4 VMs, autenticadas con **anlucorporations@gmail.com** (`--ssh` activado).
- `ufw` activo: deny-all por defecto, `allow in on tailscale0` (100.64.0.0/10) y SSH-IAP.
- IPs Tailscale: databases 100.89.28.1 · dsh-dev 100.125.94.21 · blockchain 100.85.239.67 · preview 100.113.94.52 (tabla completa en 03_credenciales.md).
- Conectividad verificada: `tailscale ping` ≥1ms directo entre las 4 VMs.

Operativo SSH: `gcloud compute ssh <vm> --project=plataforma-txbarlovento --zone=europe-west1-b --tunnel-through-iap` (usa plink en Windows con fingerprint por VM).

Pendiente del GATE 1 (acciones del dueño en consola Tailscale / equipo local):
- [ ] Activar **MagicDNS** en https://login.tailscale.com/admin/dns (tailnet anlucorporations) → nombres tipo `vm-databases` resolvibles solo dentro de la red.
- [ ] Aceptar la **ACL D2** en https://login.tailscale.com/admin/acls: JSON con tags `tag:owner`/`tag:dev` (ver plantilla abajo) y validar con el panel "ACL Test".
- [ ] **Probar desde `gloria` (Windows online):** `ping 100.125.94.21` y `ssh txbarlovento@100.89.28.1` (o instalar cliente Tailscale si no lo está).
- [ ] Registrar en `05_estado_proyecto.md` la aprobación: "APROBADO fase 1".

Plantilla ACL (RS-1.6, página admin/acls):

```json
{
  "tagOwners": { "tag:owner": ["autogroup:member"], "tag:dev": ["tag:owner"] },
  "acls": [
    { "action": "accept", "src": ["tag:owner"], "dst": ["*:*"] },
    { "action": "accept", "src": ["tag:dev"],  "dst": [
        "vm-dsh-dev:22,4080", "vm-databases:22,5432,27017,5050",
        "vm-blockchain:22,8545-8554,8899", "vm-preview:22,80,443,8000,6001-6002,8100-8999" ] }
  ]
}
```

(Nota: los dst con nombre de host requieren MagicDNS activo o IPs fijas por nodo; alternativa segura: sustituir por las IPs 100.x.x.x de 03_credenciales.md.)

## FASE 3 — DSH + agentes IA (EJECUTADA 2026-11-09 — parcial: TLS pendiente de MagicDNS; API keys del dueño)

```bash
# DSH (CLI real verificada: @deepseek-ai/dsh@0.2.2-rc.1; sin auth integrada)
sudo npm i -g @deepseek-ai/dsh@0.2.2-rc.1
# systemd: /etc/systemd/system/dsh.service
#   ExecStart=/usr/bin/dsh --profile web --no-open --port 4080 --host 127.0.0.1 --trusted-host 100.125.94.21:9080
# Proxy: /etc/caddy/Caddyfile-dsh (site https://100.125.94.21:9080 con basic_auth, hash root-only)
#   hash: /etc/secure/caddy_auth_hash (root-only bcrypt de PImf.04*)
# Ubicación systemd del proxy: caddy-dsh.service (caddy.service default deshabilitado por conflicto admin:2019)

# Token vigente de DSH (a pegar tras el login del proxy, regenera con cada restart de dsh):
sudo journalctl -u dsh.service --no-pager | grep -o "http://127.0.0.1:4080/?token=[^ ]*" | tail -1
# URL para el browser: https://100.125.94.21:9080/?token=<token>

# Agentes IA instalados: claude(2.1.319), codex(0.167.0), opencode(1.19.5), kimi(1.52.0)
# Logins pendientes (API keys del dueño; RS-2: SIEMPRE archivo root-only, jamás env):
#   claude:  `claude login` (OAuth interactivo, sesión local)
#   codex:   key en Secret Manager 'codex-openai-key' -> ~/.codex/auth.json (0400)
#   opencode:`opencode auth login` / config providers -> /etc/opencode/opencode.json (0600)
#   kimi:    kimi login / key -> ~/.kimi/config (0400)

# TLS definitivo (tras activar MagicDNS en consola admin de Tailscale, dueño):
sudo tailscale cert --cert-file /etc/secure/dsh.crt --key-file /etc/secure/dsh.key vm-dsh-dev.ts.net
# -> añadir 'tls /etc/secure/dsh.crt /etc/secure/dsh.key' al site del Caddyfile-dsh
```

## FASE 4 — Blockchain (PENDIENTE)

```bash
# Foundry
curl -L https://foundry.paradigm.xyz | bash && foundryup
# Anvil = Foundry node (systemd, mnemonic en Secret Manager, RPC solo tailscale0)
# Instancia efímera por proyecto:  anvil --port 8546  (8546-8554, registrar en runbook)
# Solana: sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
# NOTA: no se instala Hardhat — todo el flujo EVM (Solidity, tests, deploy, nodos dev) con Foundry.
```

## FASE 7 — Operación diaria (PENDIENTE)

**Responsable: txbarlovento (cuenta unipersonal — declarado residual en auditoría V1 H-autoría).**

| Tarea | Comando/frecuencia |
|---|---|
| Ver backups BD | `gcloud storage ls gs://plataforma-txbarlovento-backups/` diario (alerta si dump >26h ausente) |
| Restaurar PG | `gunzip < dump.sql.gz \| psql -h vm-databases -U txbarlovento` |
| Drill de restore | 1 restore mensual en contenedor efímero (RPO≤24h, RTO≤4h) |
| Snapshot manual pre-cambio | `gcloud compute disks snapshot DISK --zone=... --snapshot-names=pre-cambio` |
| Ver coste | consola Billing > Reports; al alerta 50/90/100%: identificar recurso más caro y suspender builds |
| Observabilidad | alertas CPU>85%, disco>80% por VM; uptime checks puertos 4080/5432/27017/8545/8000 |

### Tareas trimestrales (calendario)

| Tarea trimestral | Detalle |
|---|---|
| Revisar tabla de excepciones públicas | `05_estado_proyecto.md`: ¿siga siendo necesaria? ¿revocar? |
| Rotar contraseña principal | flujo del doc `03_credenciales.md` (servicio + Secret Manager + doc) y verificar columnas last-rotación |
| Verificar Secret Manager ↔ 03_credenciales | que contenga TODOS los secretos equivalentes (fuente de recuperación) |
| Drill restore BD | restaurar 1 dump de cada BD y registrar resultados |

### Mini-DRP (R3/H-15) — recreación de VM desde cero

| VM | Procedimiento de recuperación (RTO ≤4h) |
|---|---|
| vm-databases | crear VM desde snapshot → levantar docker compose desde `/srv/compose/` (versionado) → restaurar dumps GCS más recientes → validar ping con `psql/mongosh` |
| vm-dsh-dev | crear VM desde snapshot → `systemctl is-active dsh` + verificar proxy/TLS |
| vm-blockchain | crear VM desde snapshot → levantar systemd anvil/validator — nodos son efímeros, sin restore de datos |
| vm-preview | crear VM desde snapshot → Coolify re-instalado o app compose por proyecto re-desplegadas por Git push |

## Alta/Baja de usuario (R4/H-14, se aplica tras GATE 1)

**Alta (checklist):** 1) invitar nodo/dispositivo a Tailscale con tag `tag:dev` (dueño aprueba en consola); 2) crear cuentas de servicio individuales (proxy DSH, no compartidas) — credencial personal generada y entregada por canal seguro (se registra hash en 03); 3) usuario BD del proyecto si aplica; 4) ACL Tailscale aplicada + `tailscale acl test`; 5) registro en runbook §3.

**Baja (SLA 24h):** revocar nodo Tailscale + claves proxy/DSH + usuario BD + acceso a Secret Manager de la SA; marcar fecha en runbook §3.

## Registro V2 (2026-11-10) — comandos de gateway, modelo e integración con asistentes

```bash
# 1) OpenCode Gateway (systemd) — LLM HTTP API en 4090
#    /usr/local/bin/oc_start.sh:
#      * OPENCODE_SERVER_PASSWORD  = secret opcode-gateway-api-key (REF-SEC-26)  [auth del gateway]
#      * OPENCODE_API_KEY          = secret opencode-go-key (REF-SEC-27, OpenCode Go $10/mes) [credencial LLM]
#    auth estilo Basic (en HTTP): Authorization: Basic base64("opencode:" + opcode-gateway-api-key)
#    Ruta de generación simple (stateless):
curl -X POST http://100.125.94.21:4090/api/experimental/generate/text \
  -u "opencode:<REF-SEC-26>" -H "Content-Type: application/json" \
  -d '{"prompt":"…","model":{"id":"claude-haiku-5-5","providerID":"opencode-go"}}'
#  Respuesta: {"data":{"text":"…"}}

# 2) Uso de Asistente Virtual (V2-A1): template Next.js/HTML en /srv/openwebr! no e deploy con docker-compose
#    y luego habla con "1019" URL pública https://<asistente>.100.113.94.52.sslip.io o tailnet.

# 3) Versiones para mantener actualizado el modelo al cambiar la suscripción (o nuevos modelos):
opencode models | grep claude
# 4) Documentación de endpoint completo en el gateway: http://100.125.94.21:4090/openapi.json
```


## Registro V2-A2 (2026-11-10) - comandos alta de asistente automatica

    sudo /usr/local/bin/alta_asistente.sh <proyecto>                # puerto correlativo 3002-3019 (asistente-hotel demo, puerto 3002)
    sudo /usr/local/bin/alta_asistente.sh <proyecto> <puerto>       # fuerza puerto
    curl http://100.113.94.52:<puerto>/health
    curl -X POST http://100.113.94.52:<puerto>/api/chat -H 'Content-Type: application/json' -d 
{ "message": "hola" }
    # usuario mongo por proyecto (en vm-databases):
    sudo docker exec mongo mongosh admin -u txbarlovento -p PImf.04* --quiet --eval 
db.createUser({user:'proj_proyecto',pwd:'PRJproyecto_2026A',roles:[{role:'readWrite',db:'proj_proyecto'}]})
## FASE 5 — Preview/Deploy (EJECUTADA 2026-11-10 — piloto VERIFICADO; límites y pruebas de navegador pendientes del dueño)

```bash
# Instalación Coolify (Docker 29.9.3 primero)
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
# Panel: http://100.113.94.52:8000  (login txbarlovento@gmail.com / PImf.04*)
# Cuenta root crea el dueño (ventana 10 min; sino `docker restart coolify`)

# Fix de conectividad Coolify->host (claves internas):
#   1) /data/coolify/ssh/keys/ssh_key@<uuid> -> pubkey a /root/.ssh/authorized_keys
#   2) ufw allow from 10.0.1.0/24 + 10.0.0.0/24 to any port 22 (subredes docker reales de este host)

# Habilitar API (necesaria para ops automatizadas): instancia_settings.is_api_enabled=true (via bd)
#   POST /api/v1/applications/dockerfile {project_uuid, server_uuid, environment_name, dockerfile(b64)}
#   PATCH /applications/{uuid} {ports_exposes, domains, dockerfile(b64)}
#   POST  /applications/{uuid}/start | restart
#   GET   /applications/{uuid}, /deployments?app_uuid=

# TRICK validado: Dockerfile inline SIN build-context via:
#   RUN echo '<b64-del-js>' | base64 -d > server.js
# (COPY requiere build-context que Coolify no provee)

# El piloto: proyecto "piloto-gate5" con 3 apps (web2 nginx, api node /health, web3 check RPC Anvil)
# Dominios: piloto-web2|api|web3.100.113.94.52.sslip.io (sslip 100.x = alcanzable SOLO por tailnet)

#_provider proces de límites: la API de la versión actual no acepta limits_cpu/memory en PATCH
# para dockerfile-app (validación rechaza campo) — set en UI del recurso: Advanced>Resource Limits
# (1 CPU / 1GB api y web2; 0.5 CPU / 512MB web3 recomendado)
```

## FASE 6 — Builds (PENDIENTE)

```bash
# Android: sdkmanager --install "platforms;android-35" "build-tools;35.0.0" platform-tools
# Windows cross: apt install mingw-w64 ; dotnet publish -r win-x64 -c Release
# Linux cross aarch64: apt install gcc-aarch64-linux-gnu
```

## Incidencias conocidas y soluciones (ir agregando)

| Fecha | Incidencia | Solución |
|---|---|---|
| — | — | — |

## Registro V2-A5 (2026-11-10) - seguridad y presupuesto por asistente

    # server.js v2-A5 (canonico, en las 3 apps): rate-limit 30/min por IP (429), DAILY_CHAT_LIMIT=500/dia (429),
    # usage en Mongo assistant_usage (chats, tokens_est=chars/4) + GET /api/usage
    # isolacion: usuario mongo dedicado proj_<n> (readWrite solo su db) - verificado cross-proyecto denegado
    # OpenCode Go: 429 con retryAfterMs si se agota el plan - asistente muestra error claro
    # Ajustes de presupuesto: editar /etc/secure/asistente-<n>.env y docker compose up -d --build

