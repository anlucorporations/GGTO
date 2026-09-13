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

# ================= CU-11 =================
E '- **5a. Pérdida de la sesión (cierre o expiración de las 8 horas, D-45).**' '- **5b. Pérdida de la sesión (cierre o expiración de las 8 horas, D-45).**' 'CU11-renum'

E '2. **Dado** un caso con `telefono = 02121234567`, **Cuando** el operador busca ese número, **Entonces** el sistema muestra la ficha del caso.' '2. **Dado** un caso con `telefono = 02121234567`, `id_averia = 2026-00456`, nombre `María Díaz`, dirección `Calle Sucre 12`, plan `GPON 100M` y `status = PEND` de la cuadrilla del operador, **Cuando** el operador busca ese número, **Entonces** el sistema muestra **una sola** ficha con el encabezado «2026-00456 — María Díaz» y los cuatro campos `direccion`, `plan`, `status` y `sector` informados en pantalla. [H-N-24]' 'CU11-ca2'

E '5. **Dado** el mismo caso `C2` y una sesión de supervisor, **Cuando** el supervisor busca ese `id_averia`, **Entonces** la ficha se abre con normalidad. [D-35]' '5. **Dado** el mismo caso `2026-00789` con `Reparador Principal = C2` y una sesión de supervisor, **Cuando** el supervisor busca ese `id_averia`, **Entonces** el sistema **no** muestra el mensaje «El caso no está asignado a su cuadrilla» y abre el flotante con el encabezado «2026-00789», las 5 secciones y el botón *Cerrar caso* habilitado (el caso está abierto). [D-35, H-N-24]' 'CU11-ca5'

E '6. **Dado** un caso seleccionado, **Cuando** el operador pulsa *Ver detalle*, **Entonces** el flotante muestra las 5 secciones con los campos de `averias.json` y ningún campo queda fuera.' '6. **Dado** un caso seleccionado con los 29 campos de `averias.json` informados, **Cuando** el operador pulsa *Ver detalle*, **Entonces** el flotante muestra exactamente **5 secciones** en este orden —«Abonado y contacto», «Red y planta externa», «Diagnóstico», «Clasificación» y «Gestión»— y un total de **29 campos** visibles, sin ninguno fuera. [H-N-24]' 'CU11-ca6'

# ================= CU-12 =================
E '- **El sistema deberá** conservar el caso cerrado en el maestro sin purga automática, con finalidad documentada. [D-28]' '- **El sistema deberá** conservar el caso cerrado en el maestro sin purga automática y sin plazo de caducidad, con la finalidad del tratamiento documentada en la **ficha de tratamiento de datos personales (D-28)** —responsable, base de licitud y canal del titular—; la retención indefinida es un **riesgo aceptado** por D-28. [D-28, H-N-10]' 'CU12-ears'

# ================= CU-13 =================
E '**Trazabilidad:** RF-15, RF-07 (clasificación), RF-23, RF-24, RF-28; RN-07; RNF-01, **RNF-08**, RNF-09, RNF-10, **RNF-12, RNF-14, RNF-15**; D-06, D-17, D-23, **D-29, D-35, D-38, D-39, D-41, D-42**; H-01, H-27.' '**Trazabilidad:** RF-15, RF-07 (clasificación), RF-23, RF-24, RF-28; RN-07; RNF-01, **RNF-08**, RNF-09, RNF-10, **RNF-12, RNF-14, RNF-15**; D-06, D-17, D-23, **D-29, D-30, D-35, D-38, D-39, D-41, D-42**; H-01, H-27.' 'CU13-traz'

# ================= CU-14 =================
E '- **Actor secundario:** Supervisor (padrones usados en la validación).' '- **Actor secundario:** Supervisor (padrones usados en la validación y alta permitida también a su rol).' 'CU14-actor'

E '- **Precondiciones:** sesión identificada (CU-01); `sectores.json` con al menos un sector; `averias.json` legible.' '- **Precondiciones:** sesión identificada (CU-01) **con credencial válida y vigente (D-39)**; **rol autorizado por la matriz de §2.1: el alta manual está permitida al operador y al supervisor** (D-35, RNF-12); `sectores.json` con al menos un sector; `averias.json` legible.' 'CU14-precond'

E '- **Postcondiciones:** el caso existe en `averias.json` con un `id_averia` único con prefijo `MAN-` y el resto de campos obligatorios informados.' '- **Postcondiciones:** el caso existe en `averias.json` con un `id_averia` único con prefijo `MAN-`, el resto de campos obligatorios informados, **`Reparador Principal` = `id` de la cuadrilla de la sesión y `fecha_asignacion` = fecha del alta** (D-37, D-48) —o ambos vacíos si la sesión no tiene cuadrilla—, de modo que el operador **ve el caso que acaba de crear** (H-N-05); la escritura queda verificada por relectura y respaldo previo (D-42, RNF-15) y el alta auditada.' 'CU14-post'

E '**Trazabilidad:** RF-04, RF-28; RN-01, RN-02; RNF-04, RNF-09, RNF-10, **RNF-14**; RT-01; D-06, D-14, D-17, D-18, D-20, **D-41**; H-02, H-09.' '**Trazabilidad:** RF-04, RF-28; RN-01, RN-02; RNF-04, RNF-08, RNF-09, RNF-10, **RNF-12, RNF-14, RNF-15**; RT-01; D-06, D-14, D-17, D-18, D-20, **D-35, D-37, D-41, D-42, D-48**; H-02, H-09, H-N-03, H-N-05.' 'CU14-traz'

E '6. El sistema completa los campos no capturados: `ingreso` = fecha del día, `status = GESTION`, `resolucion`, `fechaResolucion`, `sacas` vacíos; `usuario_modificacion` y `fecha_modificacion` con el operador y la hora.
7. El sistema escribe `averias.json`, relee el archivo, verifica que el `id_averia` generado es único y muestra «Caso MAN-0001 creado».' '6. El sistema completa los campos no capturados: `ingreso` = fecha del día, `status = GESTION`, `resolucion`, `fechaResolucion`, `sacas` vacíos; `usuario_modificacion` y `fecha_modificacion` con el operador y la hora.
6b. **Asignación del caso a la cuadrilla de la sesión (D-37, D-48).** El sistema escribe `Reparador Principal` con el `id` de la cuadrilla del técnico identificado y `fecha_asignacion` con la fecha del alta, **antes** de que el caso se muestre, para que el operador lo vea en CASOS; si la sesión **no tiene cuadrilla asignada**, deja ambos campos vacíos, muestra «Caso creado sin cuadrilla: visible en solo lectura hasta el despacho» y el caso queda en el grupo «Sin asignar» (CU-18). [D-37, D-48, RNF-12, H-N-05]
7. El sistema escribe `averias.json` con la **escritura verificada de D-42/RNF-15** (respaldo previo `.bak`, archivo temporal, relectura y comparación), relee el archivo, verifica que el `id_averia` generado es único y muestra «Caso MAN-0001 creado».' 'CU14-flujo'

E '- **2a. Campos del fuente que no existen en el maestro (D-47, cerrado).**' '- **1a. Acción no permitida para su rol.** Si la sesión no está identificada o su rol no figura como autorizado en la matriz de §2.1, el sistema no muestra el bloque *Nuevo caso* ni ejecuta la escritura, responde «Acción no permitida para su rol» y registra el intento con operador y fecha/hora. [D-35, RNF-12]
- **2a. Campos del fuente que no existen en el maestro (D-47, cerrado).**' 'CU14-alt1a'

E '7. **Dado** un caso manual `MAN-0001`, **Cuando** se ejecuta la ingesta del CSV del día, **Entonces** el caso manual no se modifica ni se duplica.' '7. **Dado** un caso manual `MAN-0001`, **Cuando** se ejecuta la ingesta del CSV del día, **Entonces** el caso manual no se modifica ni se duplica.
8. **Dado** una sesión de operador de la cuadrilla `C1` y el formulario completo del criterio 1, **Cuando** el operador pulsa *Guardar caso*, **Entonces** el registro `MAN-0001` de `averias.json` queda con `Reparador Principal = C1` y `fecha_asignacion = 13/09/2026`, y al abrir CASOS el operador **ve el caso** dentro del filtro de su cuadrilla. [D-37, D-48, RNF-12]
9. **Dado** una sesión de operador **sin cuadrilla asignada**, **Cuando** da de alta un caso, **Entonces** el caso queda con `Reparador Principal` y `fecha_asignacion` **vacíos**, el sistema muestra «Caso creado sin cuadrilla: visible en solo lectura hasta el despacho» y el caso aparece en el grupo «Sin asignar» de CU-18 sin distorsionar los totales por cuadrilla. [D-48]
10. **Dado** una sesión **sin identificación válida**, **Cuando** se intenta abrir el bloque *Nuevo caso*, **Entonces** el sistema no muestra el formulario, no lee `sectores.json` y responde «Identifíquese para editar». [D-50, RNF-08]' 'CU14-ca'

E '- **El sistema deberá** limitar el formulario a la lista cerrada de campos definida en D-18, **sin incorporar Tipo, Actividad ni Agente** del fuente. [D-18, D-47]' '- **El sistema deberá** limitar el formulario a la lista cerrada de campos definida en D-18, **sin incorporar Tipo, Actividad ni Agente** del fuente. [D-18, D-47]
- **Cuando** el alta se confirme, el sistema deberá escribir `Reparador Principal` = `id` de la cuadrilla de la sesión y `fecha_asignacion` = fecha del alta —o ambos vacíos si la sesión no tiene cuadrilla— **antes** de confirmar en pantalla, para que el caso quede dentro del ámbito de visibilidad del rol que lo creó. [D-37, D-48, RNF-12]
- **Si** la sesión no tiene un rol autorizado por la matriz de §2.1 para el alta manual, entonces el sistema deberá rechazarla sin escribir el maestro y registrar el intento con operador y fecha/hora. [D-35, RNF-12]
- **Mientras** no exista una identificación válida, el sistema deberá mantener oculto el bloque *Nuevo caso* y bloqueada toda lectura de padrones y toda escritura del maestro. [D-50, RNF-08]' 'CU14-ears'

Write-Output 'FASE B2'
$log | ForEach-Object { Write-Output $_ }
[System.IO.File]::WriteAllText($p, $t, $enc)
Write-Output ('BYTES=' + (Get-Item -LiteralPath $p).Length)
