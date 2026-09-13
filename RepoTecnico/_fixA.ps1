$ErrorActionPreference = 'Stop'
$p = 'C:\GGTO\proyecto\RepoTecnico\casos_uso.md'
$enc = New-Object System.Text.UTF8Encoding($true)
$t = [System.IO.File]::ReadAllText($p)
$log = New-Object System.Collections.ArrayList
function E($old, $new, $tag) {
  $o = $old -replace "`r`n", "`n"
  $n = $new -replace "`r`n", "`n"
  $t2 = $script:t.Replace($o, $n)
  if ($t2 -eq $script:t) { [void]$script:log.Add("FALLO $tag") }
  else { [void]$script:log.Add("OK    $tag"); $script:t = $t2 }
}

# ===== BLOQUE A: indice =====
$o = "| CU-01 | Iniciar sesión e identificar al operador | Operador de la central (y supervisor) | C1 | MVP |
| CU-08 | Ingestar el CSV diario | Operador de la central (y supervisor) | C2 | MVP |
| CU-09 | Resolver la asignación de sector y las direcciones sin coincidencia | Operador de la central (y supervisor) | C2 | MVP |
| CU-02 | Configurar los datos operativos de la central | Supervisor (función administrativa) | C1 | MVP |"
$n = "| CU-01 | Iniciar sesión e identificar al operador | Operador de la central (y supervisor) | C1 | MVP |
| CU-02 | Configurar los datos operativos de la central | Supervisor (función administrativa) | C1 | MVP |"
E $o $n 'indice-dup'

$o = "| CU-08 | Ingestar el CSV diario | Operador de la central | C2 | MVP |
| CU-09 | Resolver la asignación de sector y las direcciones sin coincidencia | Operador de la central | C2 | MVP |
| CU-10 | Gestionar y filtrar los CASOS | Operador de la central | C1 / C3 | MVP |"
$n = "| CU-08 | Ingestar el CSV diario | Operador de la central (y supervisor) | C2 | MVP |
| CU-09 | Resolver la asignación de sector y las direcciones sin coincidencia | Operador de la central (y supervisor) | C2 | MVP |
| CU-10 | Gestionar y filtrar los CASOS | Operador de la central | C1 / C3 | MVP |"
E $o $n 'indice-actor'

# ===== BLOQUE B: CU-01 =====
E 'clave_hash`, `clave_sal` y `clave_fecha_cambio` (D-29, D-39);' 'clave_hash`, `clave_sal`, `clave_fecha_cambio` y `clave_cambio_obligatorio` (D-29, D-39, RF-12);' 'CU01-precond'

E '8. Si la credencial es válida y `clave_fecha_cambio` tiene **más de 90 días**, el sistema **no abre la sesión operativa**: exige el cambio de contraseña antes de continuar (paso 9) y solo después abre la sesión. [D-39]' '8. Si la credencial es válida y `clave_fecha_cambio` tiene **más de 90 días**, el sistema **no abre la sesión operativa**: exige el cambio de contraseña antes de continuar (paso 9) y solo después abre la sesión. [D-39]
8b. Si la credencial es válida y `clave_cambio_obligatorio = SI` en `tecnicos.json` —lo que ocurre tras un alta (CU-03 paso 5) o un restablecimiento por el supervisor (CU-03 paso 8)—, el sistema **tampoco abre la sesión operativa**: exige el cambio de contraseña por el mismo camino del paso 9, con independencia de la antigüedad de `clave_fecha_cambio`, y al guardarla deja `clave_cambio_obligatorio = NO`. [RF-12, D-39]' 'CU01-paso8b'

E '`clave_hash`, una **nueva sal** y `clave_fecha_cambio` = fecha del día, y no conserva la anterior en claro. [D-39]' '`clave_hash`, una **nueva sal**, `clave_fecha_cambio` = fecha del día y `clave_cambio_obligatorio = NO`, y no conserva la anterior en claro. [RF-12, D-39]' 'CU01-paso9'

E '- **8a. Contraseña caducada (más de 90 días desde `clave_fecha_cambio`).**' '- **8c. Cambio obligatorio pendiente (`clave_cambio_obligatorio = SI`).** El sistema muestra «Debe cambiar la contraseña antes de operar: el supervisor la asignó o restableció» y ejecuta el cambio obligatorio del paso 9; si el operador cancela, la sesión queda cerrada pero `clave_cambio_obligatorio` sigue en `SI`. [RF-12, D-39]
- **8a. Contraseña caducada (más de 90 días desde `clave_fecha_cambio`).**' 'CU01-flujo8c'

E '7. **Dado** el cambio obligatorio de contraseña exigido en el criterio anterior, **Cuando** el operador informa la nueva contraseña `Nueva2026` dos veces, **Entonces** `tecnicos.json` guarda un `clave_hash` distinto del anterior, una nueva `clave_sal` y `clave_fecha_cambio = 14/09/2026`, y ninguna parte del archivo contiene la contraseña en claro. [D-39]' '7. **Dado** el cambio obligatorio de contraseña exigido en el criterio anterior, **Cuando** el operador informa la nueva contraseña `Nueva2026` dos veces, **Entonces** `tecnicos.json` guarda un `clave_hash` distinto del anterior, una nueva `clave_sal`, `clave_fecha_cambio = 14/09/2026` y `clave_cambio_obligatorio = NO`, y ninguna parte del archivo contiene la contraseña en claro. [RF-12, D-39]
7b. **Dado** un técnico activo con `clave_cambio_obligatorio = SI` y `clave_fecha_cambio = 14/09/2026` (contraseña restablecida hoy por el supervisor), **Cuando** el operador inicia sesión con la credencial temporal correcta, **Entonces** el sistema **no** abre la sesión operativa, muestra «Debe cambiar la contraseña antes de operar: el supervisor la asignó o restableció» y exige el cambio del paso 9; tras informar `ClaveNueva26` dos veces, `tecnicos.json` queda con `clave_cambio_obligatorio = NO` y la sesión se abre. [RF-12, D-39]' 'CU01-ca7b'

E '12. **Dado** un técnico activo con P00 `12345` cuyo `cuadrillas.id` es `C1`, **Cuando** inicia sesión, **Entonces** la página habilita CASOS, PANEL e INGESTA para los casos de `C1` y **no** habilita CONFIGURACION, DESPACHO, GESTION ni RESPALDO.' '12. **Dado** un técnico activo con P00 `12345` cuyo `cuadrillas.id` es `C1`, **Cuando** inicia sesión, **Entonces** el sistema presenta las **7 pestañas** de RF-01 —PANEL, MONITOREO, GRAFICOS, CASOS, DESPACHO, CONFIGURACION y GESTION—, habilita **CASOS** (solo los casos de `C1`) y **PANEL**, y **no** habilita MONITOREO, GRAFICOS, DESPACHO, CONFIGURACION ni GESTION; el bloque **INGESTA** de CU-08 y el bloque **RESPALDO** de CU-21 **no son pestañas** y quedan además bloqueados por la matriz de §2.1. [RF-01, D-35, RNF-12]' 'CU01-ca12'

E '**Trazabilidad:** RF-01; RNF-03, RNF-07, **RNF-08**, **RNF-12, RNF-13**; RT-06, RT-07, RT-09, RT-10; D-01, D-15, D-16, D-19, D-22, **D-29, D-35, D-37, D-39, D-40**; H-01, H-03, H-05.' '**Trazabilidad:** RF-01, **RF-12** (estado `clave_cambio_obligatorio` leído de `tecnicos.json`); RNF-03, RNF-07, **RNF-08**, **RNF-12, RNF-13**; RT-06, RT-07, RT-09, RT-10; D-01, D-15, D-16, D-19, **D-29, D-35, D-37, D-39, D-40, D-45, D-50**; H-01, H-03, H-05, H-31.' 'CU01-traz'

E '- **Si** han transcurrido más de **90 días** desde `clave_fecha_cambio`, entonces el sistema deberá exigir el cambio de contraseña antes de habilitar cualquier acción de la sesión. [D-39]' '- **Si** han transcurrido más de **90 días** desde `clave_fecha_cambio`, o **si** `clave_cambio_obligatorio` vale `SI` en `tecnicos.json`, entonces el sistema deberá exigir el cambio de contraseña antes de habilitar cualquier acción de la sesión. [RF-12, D-39]' 'CU01-ears'

# limpieza de referencias obsoletas a D-22 dentro de CU-01
E 'D-16, D-19, D-22, **D-29' 'D-16, D-19, **D-29' 'CU01-d22'

Write-Output 'FASE A'
$log | ForEach-Object { Write-Output $_ }
[System.IO.File]::WriteAllText($p, $t, $enc)
Write-Output ('BYTES=' + (Get-Item -LiteralPath $p).Length)
