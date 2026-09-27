# Estado de inyección de datos — GGTO

> Memoria de trabajo de `@InyectaDatos`. Se actualiza de forma incremental.

| Campo | Valor |
|---|---|
| Proyecto | GGTO — CANTV Central Francisco Salias |
| Persistencia | PostgreSQL 15.18 · base `ggtov2` |
| Última actualización | 2026-09-27 |
| Estado | **Super Usuario inyectado y verificado** |

---

## 1. Avance por paso del skill

| Paso | Entregable | Estado |
|---|---|---|
| 1. Análisis de la plataforma | `estructura_datos.md` | ✅ |
| 2. Casos de uso de inyección | `casos_uso_inyeccion.md` | ✅ |
| 3. Consulta de "cuentas" | Adaptado: **no hay Anvil**; las cuentas son usuarios/roles en PostgreSQL | ✅ (N/A) |
| 4. Asignación de roles | `SUPER` / `ADMIN` / `SUPERVISOR` / `TECNICO` | ✅ |
| 5. Plan de acción | Ver §2 | ✅ aprobado por el usuario (orden directa) |
| 6. Script de inyección | `scripts/inyectar_super_usuario.py` | ✅ ejecutado |

---

## 2. Plan de acción ejecutado

| # | Operación | Objeto | Volumen | Orden |
|---|---|---|---|---|
| 1 | Crear rol `SUPER` (acceso total) | `rol` | 1 | 1 |
| 2 | Crear ficha del técnico | `tecnico` | 1 | 2 |
| 3 | Crear la cuenta con clave Argon2id | `usuario` | 1 | 3 |
| 4 | Documentar el acceso | `credenciales/` | — | 4 |

---

## 3. Super Usuario inyectado

| Dato | Valor |
|---|---|
| P00 | `123456` |
| Nombre | `ANLUcorporations Super Usuario` |
| Correo | `anlucorporations@gmail.com` |
| Rol | **`SUPER`** (acceso total a todas las secciones y funciones) |
| Clave | **No se almacena en claro**; se fijó con Argon2id. Ver `RepoTecnico/credenciales/CREDENCIALES-GGTO.md` (ignorado por git) |
| Estado | Activo · sin bloqueo · 0 intentos fallidos |
| Central | `2324X` FRANCISCO SALIAS |
| 12 palabras de seguridad | **Registradas** (hashes Argon2id en `dispositivo_seguridad`); el listado está en `RepoTecnico/credenciales/CREDENCIALES-GGTO.md` (ignorado por git) |
| Verificado | ✅ login correcto, acceso total y **desbloqueo con 3 de las 12 palabras** comprobados en producción |

> **Acceso total:** `app/api/deps.py` concede cualquier operación a quien tenga el rol
> `SUPER`, sin necesidad de enumerarlo en cada endpoint. Queda cubierto de forma permanente
> para los ciclos futuros (despacho, alertas, MCP, app móvil).

---

## 4. Cómo usar el script

```bash
cd /home/dsh/workspace/CANTV_PDE
export PATH="/home/dsh/google-cloud-sdk/bin:$PATH"
export DB_HOST=34.39.180.101 DB_PORT=5432 DB_NAME=ggtov2 DB_USER=ggtov2_app DB_SSLMODE=require
export DB_PASSWORD="$(gcloud secrets versions access latest --secret=ggtov2-db-password --project=truekeate-main)"
export GGTO_SUPER_CLAVE='<clave>'

# Simulación (no escribe nada)
python3 scripts/inyectar_super_usuario.py --p00 123456 --correo correo@dominio \
    --nombre "NOMBRE" --dry-run

# Inserción real (pide confirmación interactiva)
python3 scripts/inyectar_super_usuario.py --p00 123456 --correo correo@dominio \
    --nombre "NOMBRE" --apellido "Super Usuario" --id-central 1

# Opciones: --con-palabras (genera las 12 de seguridad), --rol, --dsn, --si
```

- El script **nunca se ejecuta solo**: exige confirmación (salvo `--si`).
- Registra cada ejecución en `RepoTecnico/BaseOperaciones/inyeccion_super_usuario.log`.
- Es **idempotente**: repetirlo actualiza la clave y reactiva la cuenta.

---

## 5. Estado de datos en producción

| Entidad | Registros |
|---|---|
| Usuarios | **1** (el Super Usuario) |
| Técnicos | **1** (la ficha del Super Usuario) |
| Centrales | 1 (`2324X`) |
| Cuadrillas | 1 (`C-00`, cuadrilla del supervisor) |
| Casos | **42 reales** (ingesta del 2026-09-27) + 0 de prueba |
| Lotes de ingesta | **1** (`detalle_averias_gpon 15_09_2026.csv`: 47 filas, 42 de la central, 5 descartadas) |

---

## 6. Pendientes y advertencias

1. **La clave del Super Usuario se compartió en el chat** al hacer esta solicitud: cámbiala
   tras el primer acceso (`POST /api/v1/auth/reset-password` con las palabras, o re-ejecutando
   el script con una clave nueva).
2. ✅ **Las 12 palabras de seguridad ya están generadas** y documentadas; se verificó que
   `POST /api/v1/auth/unlock` acepta 3 correctas (`200`) y rechaza incorrectas (`401`).
   La copia en claro solo existe en el documento de credenciales (ignorado por git y con permisos `600`).
3. El Super Usuario **no debe usarse como cuenta operativa diaria**: para el trabajo normal se
   crean usuarios `SUPERVISOR`/`TECNICO` (RF-02).
4. ⚠️ **El servicio de Cloud Run es público y ya contiene PII real** (42 casos de suscriptores).
   Restringir el acceso es ahora prioritario, y conviene migrar a una instancia con respaldo (RNF-16).
5. **Política de limpieza (D-55):** las verificaciones se limpian **solo con filtros** (`TST%`, ids
   conocidos); nunca con `DELETE` sin filtro sobre tablas con datos reales.
