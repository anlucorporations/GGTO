
$targetFile = "g:\Mi unidad\CANTV PDE\GGTO-v1\control_averias_gpon_central.xlsm"

Write-Output "--- INICIANDO TEST SUITE CANTV GPON ---"
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$excel.UserControl = $false

try {
    $wb = $excel.Workbooks.Open($targetFile)
    Write-Output "Libro abierto exitosamente."

    # 1. TEST INGESTA
    Write-Output "`n[TEST 1] Ejecutando Ingesta de CSVs..."
    $excel.Run("Mod_Ingesta.EjecutarIngestaCompleta")

    $wsCasos = $wb.Sheets.Item("CASOS")
    $ultFilaCasos = $wsCasos.Cells.Item($wsCasos.Rows.Count, 1).End(-4162).Row # xlUp = -4162
    Write-Output "Total filas en CASOS tras ingesta: $ultFilaCasos"

    # Verificar que existen casos insertados
    $ids = @()
    for ($r = 2; $r -le $ultFilaCasos; $r++) {
        $ids += [string]$wsCasos.Cells.Item($r, 1).Value2
    }
    Write-Output ("IDs ingresados: " + ($ids -join ", "))

    # Verificar que el caso de Los Teques AV-2026-9999 NO fue ingresado (filtro correcto)
    if ($ids -contains "AV-2026-9999") {
        Write-Output "FAIL: El caso AV-2026-9999 no debio ser ingresado (pertenece a Los Teques)!"
    } else {
        Write-Output "PASS: Filtro de Central y Area funcionando correctamente (AV-2026-9999 descartado)."
    }

    # Verificar casos referidos
    if ($ids -contains "REF-2026-2001" -and $ids -contains "REF-2026-2002") {
        Write-Output "PASS: Casos de REFERIDOS ingresados correctamente."
    } else {
        Write-Output "FAIL: No se encontraron los casos de referidos esperados."
    }

    # 2. TEST TRIAJE Y NORMALIZACION (GESTION)
    Write-Output "`n[TEST 2] Ejecutando Triaje y Envio a GESTION..."
    $excel.Run("Mod_Actualizacion.NormalizarYEnviarAGestion")

    $wsGestion = $wb.Sheets.Item("GESTION")
    $ultFilaGestion = $wsGestion.Cells.Item($wsGestion.Rows.Count, 1).End(-4162).Row
    Write-Output "Total casos derivados a GESTION: $($ultFilaGestion - 1)"

    $idsGestion = @()
    for ($r = 2; $r -le $ultFilaGestion; $r++) {
        $idsGestion += [string]$wsGestion.Cells.Item($r, 1).Value2
    }
    Write-Output ("IDs en GESTION: " + ($idsGestion -join ", "))

    if ($idsGestion -contains "AV-2026-1003") {
        Write-Output "PASS: Caso AV-2026-1003 (sin perdida fisica) correctamente enviado a GESTION."
    } else {
        Write-Output "FAIL: Caso AV-2026-1003 debio enviarse a GESTION."
    }

    # Verificar vistas especiales EMPRESAS y REFERIDOS
    $wsEmp = $wb.Sheets.Item("EMPRESAS")
    $ultFilaEmp = $wsEmp.Cells.Item($wsEmp.Rows.Count, 1).End(-4162).Row
    Write-Output "Total casos en EMPRESAS: $($ultFilaEmp - 1)"

    $wsRef = $wb.Sheets.Item("REFERIDOS")
    $ultFilaRef = $wsRef.Cells.Item($wsRef.Rows.Count, 1).End(-4162).Row
    Write-Output "Total casos en REFERIDOS: $($ultFilaRef - 1)"

    # 3. TEST DESPACHO A CUADRILLAS
    Write-Output "`n[TEST 3] Generando Despacho a Cuadrillas..."
    $excel.Run("Mod_Despacho.GenerarDespachoCuadrillas")

    $wsDesp = $wb.Sheets.Item("DESPACHO")
    $ultFilaDesp = $wsDesp.Cells.Item($wsDesp.Rows.Count, 1).End(-4162).Row
    Write-Output "Total filas en DESPACHO: $($ultFilaDesp - 3)"

    # 4. TEST EXPORTACION DE PDFS
    Write-Output "`n[TEST 4] Exportando Despachos a PDF..."
    $excel.Run("Mod_Despacho.ExportarDespachosAPDF")

    $pdfs = Get-ChildItem -Path "g:\Mi unidad\CANTV PDE\GGTO-v1" -Filter "Despacho_*.pdf"
    Write-Output "Archivos PDF generados en la carpeta del proyecto:"
    foreach ($pdf in $pdfs) {
        Write-Output " - $($pdf.Name) ($($pdf.Length) bytes)"
    }
    if ($pdfs.Count -gt 0) {
        Write-Output "PASS: Exportacion a PDF exitosa en la carpeta del proyecto."
    } else {
        Write-Output "FAIL: No se generaron archivos PDF."
    }

    # 5. TEST BUSQUEDA Y ACTUALIZACION EN PANEL
    Write-Output "`n[TEST 5] Probando Busqueda y Actualizacion desde PANEL..."
    $wsPanel = $wb.Sheets.Item("PANEL")
    $wsPanel.Range("C9").Value2 = "AV-2026-1001"
    $excel.Run("Mod_Panel.BuscarCaso")

    $idEncontrado = $wsPanel.Range("C11").Value2
    $suscriptorEncontrado = $wsPanel.Range("C13").Value2
    Write-Output "Busqueda AV-2026-1001 -> ID: $idEncontrado, Suscriptor: $suscriptorEncontrado"

    if ($idEncontrado -eq "AV-2026-1001") {
        Write-Output "PASS: Busqueda en PANEL exitosa."
    } else {
        Write-Output "FAIL: Busqueda en PANEL no retorno el caso esperado."
    }

    # Actualizar estado
    $wsPanel.Range("C21").Value2 = "Resuelto"
    $wsPanel.Range("C22").Value2 = "SACAS"
    $wsPanel.Range("C23").Value2 = "Cierre exitoso verificado en campo con OLT y potencia normalizada."
    $excel.Run("Mod_Panel.ActualizarCaso")

    # Guardar cambios
    $wb.Save()
    Write-Output "Cambios guardados exitosamente en el libro."

} catch {
    Write-Output ("ERROR EN TEST: " + $_.Exception.Message)
    Write-Output ("LINE: " + $_.InvocationInfo.ScriptLineNumber)
} finally {
    if ($wb) { $wb.Close($false) }
    $excel.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
    Write-Output "`n--- TEST SUITE CULMINADO ---"
}
