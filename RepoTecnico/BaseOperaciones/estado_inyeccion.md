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
| Técnicos | **9** (fichas del personal; 1 usuario con acceso) |
| Centrales | 1 (`2324X`) |
| Cuadrillas | **4** (incluye la `C-00` del supervisor) |
| Casos | **80** (70 previos + **10 de la carga temporal** de casos especiales del 2026-09-29) |
| Casos especiales | **11** (1 previo + **10 de la carga temporal**) |
| Solicitantes | **11** |
| Sectores / direcciones | 4 / 8 |
| Lotes de ingesta | 4 |
| Despachos | 6 |
| Asignación diaria de sectores | 0 (sin asignación guardada; el sistema propone) |

---

## 6. Carga temporal de casos especiales (2026-09-29)

**Origen:** archivo `gemini-code-1790695207585.json` (26 registros: 10 `REFERIDO` y 16 `AVERIA`).

**Alcance cargado:** **solo los 10 casos especiales** (`tipo = REFERIDO`). Los 16 `AVERIA`
**no** se cargaron (decisión del usuario).

**Vía:** API de producción `POST /api/v1/casos-especiales` con el Super Usuario
(crea el `caso`, el `caso_especial` y el `solicitante`, y registra el autor).
**Sin prefijo** en el `id_averia` (decisión del usuario), por lo que la retirada debe
hacerse con la lista explícita de abajo (política D-55: nunca `DELETE` sin filtro).

| `id_averia` | `id_caso` | `id_caso_especial` | Actividad | Prioridad | Sector asignado |
|---|---|---|---|---|---|
| `REF-EMP-02` | 197 | 3 | CONSTRUCCION | ALTA | — |
| `REF-CNS-13` | 198 | 4 | CONSTRUCCION | MEDIA | 9 (SUR-01) |
| `REF-CNS-14` | 199 | 5 | CONSTRUCCION | ALTA | — |
| `REF-CNS-08` | 200 | 6 | CONSTRUCCION | ALTA | 9 (SUR-01) |
| `REF-CNS-09` | 201 | 7 | CONSTRUCCION | MEDIA | — |
| `REF-CNS-12` | 202 | 8 | CONSTRUCCION | MEDIA | 10 (OESTE-01) |
| `REF-CNS-03` | 203 | 9 | CONSTRUCCION | MEDIA | — |
| `REF-CNS-05` | 204 | 10 | CONSTRUCCION | MEDIA | — |
| `REF-REP-03` | 205 | 11 | REPARACION | MEDIA | 9 (SUR-01) |
| `REF-REP-04` | 206 | 12 | REPARACION | MEDIA | — |

**Mapeo aplicado:** `clasificacion = REFERIDO`; `tipo_actividad` = `clase` del archivo;
`prioridad` = `ALTA` si `estado_auto` es *Crítico* o *En Proceso*, si no `MEDIA`;
`nombre_cliente` = `abonado`; `telefono` = `telefono` o `contacto`; `direccion` = `direccion`;
`descripcion` = descripción + problema, falla, diagnóstico, último comentario e historial;
`solicitante` = `Area 4` / `Supervisor PDE` / contacto, canal `MANUAL`.

**Observaciones:**
- **4 de los 10** quedaron sectorizados automáticamente por las direcciones existentes; los
  otros **6 quedaron sin sector** (sus direcciones no existen en los sectores actuales), por lo
  que en el despacho aparecerían como *sin asignar* salvo los citados. Para incluirlos hay que
  agregar esas direcciones a un sector (CONFIGURACIÓN → Sectores, o el aviso de direcciones de
  la ingesta, D-66).
- El archivo **no** trae campos de OLT/FAT/serial en estos registros (van vacíos), así que el
  `caso` se creó con los datos básicos.
- El archivo **no** se guardó en el repositorio (contiene PII); la copia vive en los adjuntos de
  la sesión.

**Retirada (cuando el usuario lo indique):** borrar por `id_averia` (el `caso_especial` y el
`solicitante` asociados se eliminan en cascada / quedan sin uso):

```sql
DELETE FROM caso WHERE id_averia IN (
  'REF-EMP-02','REF-CNS-13','REF-CNS-14','REF-CNS-08','REF-CNS-09',
  'REF-CNS-12','REF-CNS-03','REF-CNS-05','REF-REP-03','REF-REP-04'
);
```

---

## 7. Pendientes y advertencias

1. **La clave del Super Usuario se compartió en el chat** al hacer esta solicitud: cámbiala
   tras el primer acceso (`POST /api/v1/auth/reset-password` con las palabras, o re-ejecutando
   el script con una clave nueva).
2. ✅ **Las 12 palabras de seguridad ya están generadas** y documentadas; se verificó que
   `POST /api/v1/auth/unlock` acepta 3 correctas (`200`) y rechaza incorrectas (`401`).
   La copia en claro solo existe en el documento de credenciales (ignorado por git y con permisos `600`).
3. El Super Usuario **no debe usarse como cuenta operativa diaria**: para el trabajo normal se
   crean usuarios `SUPERVISOR`/`TECNICO` (RF-02).
4. ⚠️ **El servicio de Cloud Run es público y ya contiene PII real** (80 casos, de los cuales 10
   son la carga temporal de casos especiales). Restringir el acceso es prioritario, y conviene
   migrar a una instancia con respaldo (RNF-16).
5. **Política de limpieza (D-55):** las verificaciones se limpian **solo con filtros** (`TST%`, ids
   conocidos); nunca con `DELETE` sin filtro sobre tablas con datos reales. La carga temporal del
   §6 se retira con la lista explícita de `id_averia` documentada allí, cuando el usuario lo pida.
6. Los **6 casos especiales sin sector** de la carga temporal no entrarán al despacho por sector
   hasta que sus direcciones se agreguen a un sector (CONFIGURACIÓN → Sectores o el aviso de
   direcciones de la ingesta, D-66).
