
$targetFile = "g:\Mi unidad\CANTV PDE\GGTO-v1\CONTROL_DESPACHO_GGTO-v1.xlsm"

Write-Output "--- VERIFICACION SISTEMA CANTV (PESTANA AVERIAS + ALTA MANUAL) ---"
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$excel.UserControl = $false

try {
    $wb = $excel.Workbooks.Open($targetFile)
    Write-Output "Libro abierto exitosamente."

    # 1. VERIFICAR EXISTENCIA DE PESTANA AVERIAS
    $wsAverias = $wb.Sheets.Item("AVERIAS")
    Write-Output "Pestana AVERIAS detectada correctamente."

    # 2. EJECUTAR INGESTA
    Write-Output "`n[1] Ejecutando Ingesta desde detalle_averias_gpon 11_09_2026.csv y alta_manual.csv..."
    $excel.Run("Mod_Ingesta.EjecutarIngestaCompleta")

    $ultFila = $wsAverias.Cells.Item($wsAverias.Rows.Count, 1).End(-4162).Row
    Write-Output "Total filas en AVERIAS tras ingesta: $ultFila"

    $ids = @()
    for ($r = 2; $r -le $ultFila; $r++) {
        $ids += [string]$wsAverias.Cells.Item($r, 1).Value2
    }
    Write-Output ("IDs ingresados en AVERIAS: " + ($ids -join ", "))

    # Verificar que el caso de Los Teques no ingreso
    if ($ids -contains "AV-2026-9999") {
        Write-Output "FAIL: El caso AV-2026-9999 no debio ser ingresado!"
    } else {
        Write-Output "PASS: Filtro de Central y Area funcionando (AV-2026-9999 de Los Teques descartado)."
    }

    # Verificar casos de alta_manual.csv
    if ($ids -contains "MAN-2026-5001" -and $ids -contains "MAN-2026-5002" -and $ids -contains "MAN-2026-5003") {
        Write-Output "PASS: Casos de alta_manual.csv ingresados correctamente en AVERIAS."
    } else {
        Write-Output "FAIL: No se encontraron los casos de alta_manual.csv."
    }

    # Verificar que alta_manual.csv fue archivado como alta_manual_CARGADO.csv para carga unica
    if (Test-Path "g:\Mi unidad\CANTV PDE\GGTO-v1\alta_manual_CARGADO.csv") {
        Write-Output "PASS: alta_manual.csv archivado como alta_manual_CARGADO.csv para garantizar carga unica."
    } else {
        Write-Output "FAIL: alta_manual.csv no fue renombrado a CARGADO."
    }

    # 3. VERIFICAR TRIAJE GESTION
    Write-Output "`n[2] Ejecutando Triaje y Normalizacion..."
    $excel.Run("Mod_Actualizacion.NormalizarYEnviarAGestion")

    $wsGestion = $wb.Sheets.Item("GESTION")
    $ultFilaGestion = $wsGestion.Cells.Item($wsGestion.Rows.Count, 1).End(-4162).Row
    Write-Output "Total casos en GESTION: $($ultFilaGestion - 1)"

    # 4. VERIFICAR DESPACHO Y EXPORTACION PDF
    Write-Output "`n[3] Generando Despacho Diario..."
    $excel.Run("Mod_Despacho.GenerarDespachoCuadrillas")

    $wsDesp = $wb.Sheets.Item("DESPACHO")
    $ultFilaDesp = $wsDesp.Cells.Item($wsDesp.Rows.Count, 1).End(-4162).Row
    Write-Output "Total filas en DESPACHO: $($ultFilaDesp - 3)"

    Write-Output "`n[4] Exportando PDFs de Despacho..."
    $excel.Run("Mod_Despacho.ExportarDespachosAPDF")

    $pdfs = Get-ChildItem -Path "g:\Mi unidad\CANTV PDE\GGTO-v1" -Filter "Despacho_*.pdf"
    Write-Output "Archivos PDF verificados:"
    foreach ($pdf in $pdfs) {
        Write-Output " - $($pdf.Name) ($($pdf.Length) bytes)"
    }

    # 5. VERIFICAR BUSQUEDA EN PANEL
    Write-Output "`n[5] Probando Busqueda en PANEL..."
    $wsPanel = $wb.Sheets.Item("PANEL")
    $wsPanel.Range("C9").Value2 = "AV-2026-1001"
    $excel.Run("Mod_Panel.BuscarCaso")

    $idEnc = $wsPanel.Range("C11").Value2
    $suscEnc = $wsPanel.Range("C13").Value2
    Write-Output "Resultado busqueda en PANEL -> ID: $idEnc, Suscriptor: $suscEnc"
    if ($idEnc -eq "AV-2026-1001") {
        Write-Output "PASS: Busqueda en PANEL sobre AVERIAS exitosa."
    }

    $wb.Save()
    Write-Output "`nCambios guardados exitosamente."

} catch {
    Write-Output ("ERROR EN PRUEBA: " + $_.Exception.Message)
    Write-Output ("LINEA: " + $_.InvocationInfo.ScriptLineNumber)
} finally {
    if ($wb) { $wb.Close($false) }
    $excel.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
    Write-Output "`n--- FIN DE VERIFICACION ---"
}
