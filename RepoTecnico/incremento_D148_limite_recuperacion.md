# Incremento D-148 — Límite, bloqueo temporal y auditoría en la recuperación de cuenta

| Campo | Valor |
|---|---|
| Origen | **H-04** del `INFORME_OPTIMIZACION_V2.md` (CRÍTICA) |
| Fecha | 2026-10-21 |
| Alcance | Backend · sin cambios de esquema, web ni APK |
| Autor | Dirección del proyecto |

---

## 1. El defecto

`POST /auth/unlock` y `POST /auth/reset-password` permitían **intentos ilimitados**
de las 3 palabras de seguridad (3 de 12 = 220 combinaciones), no dejaban rastro y
no aplicaban el limitador `_rate_limit` que sí usa `/auth/login` desde RNF-22.

Con un P00 enumerable (H-08), un atacante podía probar combinaciones sin freno y
**tomar cualquier cuenta, incluida SUPER**: `reset-password` cambia la clave y
`unlock` levanta el bloqueo.

---

## 2. Corrección

### 2.1 Límite por P00 + IP (RNF-22)

Ambos endpoints pasan por el limitador existente con una clave propia
(`recuperacion:{p00}|{ip}`) y los valores de configuración
`rate_limit_intentos` / `rate_limit_ventana_seg` (10 intentos / 60 s por defecto).
Un desbloqueo correcto limpia la cubeta de esa IP.

### 2.2 Bloqueo temporal durable

El conteo de fallos **no vive en memoria**: se cuenta en `auditoria`
(`RECUPERACION_FALLIDA` por `id_entidad = p00`). Así sobrevive a reinicios y vale
para todas las instancias de Cloud Run, sin migración de esquema.

- **Umbral:** 10 fallos (`MAX_FALLOS_RECUPERACION`).
- **Ventana:** 15 minutos (`VENTANA_RECUPERACION_MIN`).
- **Reinicio:** un `RECUPERACION_OK` posterior reinicia el conteo; solo cuentan
  los fallos posteriores al último éxito.
- **Respuesta:** `429` con `Retry-After: 900`.

No se aplica un bloqueo permanente para no dejar a un usuario legítimo sin
recuperación; la salida es esperar la ventana o que el Super Usuario regenere las
palabras (`POST /auth/palabras/{p00}/regenerar`, ya existente y auditado).

### 2.3 Auditoría de cada intento

Cada intento deja una fila con `accion` (`RECUPERACION_OK` / `RECUPERACION_FALLIDA`),
`entidad = usuario`, `id_entidad = p00`, `resultado` (`OK` / `FALLO`), la central del
usuario y, en `datos_antes`, el `endpoint` y la `ip`. **Nunca** se guardan palabras
ni claves.

### 2.4 Aislamiento de las pruebas

Como el conteo es durable, la auditoría de prueba se limpia entre casos:
`usuario_creado` borra las filas de `P00` y `SQL_LIMPIEZA` borra las de los P00 de
prueba (`TESTADM`, `TESTTEC`, `TESTSUP`, `TESTSPV` y `TST%`). Sin esto, los fallos
de una prueba bloqueaban a la siguiente.

---

## 3. Verificación

| Comprobación | Resultado |
|---|---|
| `test_auth.py` completo contra PostgreSQL 18 | **25 passed (3m56s)**, esquema desechable `ggto_h04`, eliminado al terminar |
| Pruebas nuevas | **4**: fallo auditado; `unlock` bloqueado tras 10 fallos; `reset-password` bloqueado tras 10; éxito auditado y reinicio del conteo |
| Suite sin base | **111 passed, 435 skipped** |
| Ruff | `All checks passed!` |
| Esquema / APK | sin cambios |

> La corrida usó el proxy de Cloud SQL y un esquema aislado; no se tocaron
> `ggto_test`, `ggto_e2e` ni `public`.

---

## 4. Cambios por archivo

| Archivo | Cambio |
|---|---|
| `app/api/routes_auth.py` | Helpers `_fallos_recuperacion`, `_exigir_recuperacion_disponible`, `_auditar_recuperacion`; límite + auditoría en `unlock` y `reset-password`. |
| `app/tests/test_auth.py` | 4 pruebas nuevas y limpieza de auditoría en `usuario_creado`. |
| `app/tests/conftest.py` | `SQL_LIMPIEZA` borra la auditoría de los P00 de prueba. |

---

## 5. Decisiones y residuales

1. **DEC-148-1** — El bloqueo se apoya en la auditoría y no en memoria ni en una
   columna nueva: es durable, multi-instancia y no exige migración.
2. **DEC-148-2** — Umbral 10 fallos / 15 min: deja margen al usuario legítimo y
   reduce el espacio de 220 combinaciones a un ritmo inviable.
3. **Residual (DoS de recuperación):** quien conozca un P00 puede consumir sus 10
   intentos y retrasar 15 min la recuperación del titular. Se acepta frente al
   riesgo de toma de cuenta; el Super Usuario puede regenerar las palabras.
4. **Residual (H-08):** el endpoint sigue devolviendo 404 para un P00 inexistente,
   lo que permite enumerar cuentas. Se corrige en H-08, no en este incremento.
