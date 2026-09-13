
param(
    [string]$TargetFile = "g:\Mi unidad\CANTV PDE\GGTO-v1\CONTROL_DESPACHO_GGTO-v1.xlsm"
)

Write-Output "Iniciando creacion de libro Excel central CANTV (Pestana AVERIAS)..."

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

try {
    $wb = $excel.Workbooks.Add()

    # Colores corporativos CANTV
    $cAzulMarino = 6434048
    $cAzulMedio = 8866560
    $cCeleste = 14058496
    $cGrisSuave = 16381684
    $cBlanco = 16777215

    # 1. Renombrar / Crear las 11 pestañas requeridas (Con AVERIAS en lugar de CASOS)
    $hojasRequeridas = @(
        "PANEL",
        "MONITOREO",
        "GRAFICOS",
        "AVERIAS",
        "DESPACHO",
        "SEGUIMIENTO",
        "EMPRESAS",
        "REFERIDOS",
        "CONFIGURACION",
        "PLANTILLA",
        "GESTION"
    )

    $sheet1 = $wb.Sheets.Item(1)
    $sheet1.Name = $hojasRequeridas[0]

    for ($i = 1; $i -lt $hojasRequeridas.Count; $i++) {
        $nuevaHoja = $wb.Sheets.Add([System.Reflection.Missing]::Value, $wb.Sheets.Item($wb.Sheets.Count))
        $nuevaHoja.Name = $hojasRequeridas[$i]
    }

    Write-Output "Hojas creadas correctamente con pestaña AVERIAS."

    # -------------------------------------------------------------
    # 2. CONFIGURAR HOJA: CONFIGURACION
    # -------------------------------------------------------------
    $wsConfig = $wb.Sheets.Item("CONFIGURACION")
    $wsConfig.Tab.Color = $cAzulMedio
    $wsConfig.Cells.Font.Name = "Segoe UI"
    $wsConfig.Cells.Font.Size = 10

    $null = $wsConfig.Range("B2:K2").Merge()
    $wsConfig.Range("B2").Value2 = "PARAMETROS Y CATALOGOS DE CONFIGURACION - CENTRAL FRANCISCO SALIAS (AREA 4)"
    $wsConfig.Range("B2").Font.Bold = $true
    $wsConfig.Range("B2").Font.Size = 14
    $wsConfig.Range("B2").Font.Color = $cBlanco
    $wsConfig.Range("B2").Interior.Color = $cAzulMarino
    $wsConfig.Range("B2").HorizontalAlignment = -4108

    # 2.1 Seccion CENTRAL (Filtro base)
    $null = $wsConfig.Range("B4:C4").Merge()
    $wsConfig.Range("B4").Value2 = "1. DIRECCION OPERATIVA DE LA CENTRAL (BASE DE FILTRO)"
    $wsConfig.Range("B4").Font.Bold = $true
    $wsConfig.Range("B4").Interior.Color = $cAzulMedio
    $wsConfig.Range("B4").Font.Color = $cBlanco

    $centralParams = @(
        @("Region", "CENTRAL"),
        @("Estado Geografico", "MIRANDA"),
        @("Capital Estado Geografico", "LOS TEQUES"),
        @("Municipio", "LOS SALIAS"),
        @("Parroquia", "SAN ANTONIO DE LOS ALTOS"),
        @("Estado Operativo", "OPERATIVO"),
        @("Distrito", "DISTRITO 4"),
        @("Area", "4"),
        @("Central", "FSA"),
        @("Nombre Central", "Francisco Salias")
    )

    $rIdx = 5
    foreach ($p in $centralParams) {
        $cellKey = $wsConfig.Cells.Item($rIdx, 2)
        $cellKey.Value2 = $p[0]
        $cellKey.Font.Bold = $true
        $cellKey.Interior.Color = $cGrisSuave
        $wsConfig.Cells.Item($rIdx, 3).Value2 = $p[1]
        $rIdx++
    }

    # 2.2 Seccion TECNICOS
    $null = $wsConfig.Range("E4:K4").Merge()
    $wsConfig.Range("E4").Value2 = "2. PLANTILLA DE TECNICOS DE LA CENTRAL"
    $wsConfig.Range("E4").Font.Bold = $true
    $wsConfig.Range("E4").Interior.Color = $cAzulMedio
    $wsConfig.Range("E4").Font.Color = $cBlanco

    $tecHeaders = @("Nombre", "Cedula", "P00", "Telefono", "Correo", "Especialidad", "Status")
    for ($c = 0; $c -lt $tecHeaders.Count; $c++) {
        $colIdx = 5 + $c
        $cell = $wsConfig.Cells.Item(5, $colIdx)
        $cell.Value2 = $tecHeaders[$c]
        $cell.Font.Bold = $true
        $cell.Interior.Color = $cCeleste
        $cell.Font.Color = $cBlanco
    }

    $tecnicos = @(
        @("Jose Rodriguez", "V-15888999", "P00123", "0414-2223344", "jrodriguez@cantv.com.ve", "Empalmes / GPON", "Activo"),
        @("Miguel Sanchez", "V-18777666", "P00456", "0416-3334455", "msanchez@cantv.com.ve", "Liniero / Red Externa", "Activo"),
        @("Andres Morales", "V-16555444", "P00789", "0412-4445566", "amorales@cantv.com.ve", "Instalacion y Reparacion", "Activo"),
        @("Luis Castillo", "V-19222333", "P00101", "0424-5556677", "lcastillo@cantv.com.ve", "Mediciones / Potencia", "Activo"),
        @("Pedro Ramirez", "V-17333222", "P00202", "0414-6667788", "pramirez@cantv.com.ve", "Construccion Puntos Opticos", "Activo"),
        @("Ramon Fernandez", "V-14999888", "P00303", "0412-7778899", "rfernandez@cantv.com.ve", "GPON Avanzado", "Activo")
    )

    for ($t = 0; $t -lt $tecnicos.Count; $t++) {
        $rowIdx = 6 + $t
        for ($c = 0; $c -lt $tecnicos[$t].Count; $c++) {
            $colIdx = 5 + $c
            $wsConfig.Cells.Item($rowIdx, $colIdx).Value2 = $tecnicos[$t][$c]
        }
    }

    # 2.3 Seccion FLOTA
    $null = $wsConfig.Range("B16:K16").Merge()
    $wsConfig.Range("B16").Value2 = "3. FLOTA VEHICULAR OPERATIVA DE LA CENTRAL"
    $wsConfig.Range("B16").Font.Bold = $true
    $wsConfig.Range("B16").Interior.Color = $cAzulMedio
    $wsConfig.Range("B16").Font.Color = $cBlanco

    $flotaHeaders = @("CAN00", "Tipo", "Marca", "Modelo", "Placa", "Combustible", "Status", "Estado Cauchos", "Estado Fluidos", "Estado General")
    for ($c = 0; $c -lt $flotaHeaders.Count; $c++) {
        $colIdx = 2 + $c
        $cell = $wsConfig.Cells.Item(17, $colIdx)
        $cell.Value2 = $flotaHeaders[$c]
        $cell.Font.Bold = $true
        $cell.Interior.Color = $cCeleste
        $cell.Font.Color = $cBlanco
    }

    $flotas = @(
        @("CAN01", "Camioneta Cesta", "Toyota", "Hilux 4x4", "A23BC4D", "Gasolina", "Operativo", "Bueno", "Optimo", "Optimo"),
        @("CAN02", "Furgoneta Taller", "Ford", "Transit", "B45CD6E", "Gasolina", "Operativo", "Regular", "Optimo", "Bueno"),
        @("CAN03", "Pick-up Escalera", "Chevrolet", "D-Max", "C67DE8F", "Gasoil", "Operativo", "Bueno", "Optimo", "Bueno")
    )

    for ($f = 0; $f -lt $flotas.Count; $f++) {
        $rowIdx = 18 + $f
        for ($c = 0; $c -lt $flotas[$f].Count; $c++) {
            $colIdx = 2 + $c
            $wsConfig.Cells.Item($rowIdx, $colIdx).Value2 = $flotas[$f][$c]
        }
    }

    # 2.4 Seccion CUADRILLAS
    $null = $wsConfig.Range("B23:H23").Merge()
    $wsConfig.Range("B23").Value2 = "4. CUADRILLAS OPERATIVAS CONFORMADAS"
    $wsConfig.Range("B23").Font.Bold = $true
    $wsConfig.Range("B23").Interior.Color = $cAzulMedio
    $wsConfig.Range("B23").Font.Color = $cBlanco

    $cuadHeaders = @("ID Cuadrilla", "Nombre Cuadrilla", "P00 Tecnico 1", "P00 Tecnico 2", "Movil CAN", "Sector Preferente", "Status")
    for ($c = 0; $c -lt $cuadHeaders.Count; $c++) {
        $colIdx = 2 + $c
        $cell = $wsConfig.Cells.Item(24, $colIdx)
        $cell.Value2 = $cuadHeaders[$c]
        $cell.Font.Bold = $true
        $cell.Interior.Color = $cCeleste
        $cell.Font.Color = $cBlanco
    }

    $cuadrillas = @(
        @("CUAD-01", "Cuadrilla 1", "Jose Rodriguez (P00123)", "Miguel Sanchez (P00456)", "CAN01", "Los Castores", "Activa"),
        @("CUAD-02", "Cuadrilla 2", "Andres Morales (P00789)", "Luis Castillo (P00101)", "CAN02", "La Rosaleda", "Activa"),
        @("CUAD-03", "Cuadrilla 3", "Pedro Ramirez (P00202)", "Ramon Fernandez (P00303)", "CAN03", "Las Minas", "Activa")
    )

    for ($q = 0; $q -lt $cuadrillas.Count; $q++) {
        $rowIdx = 25 + $q
        for ($c = 0; $c -lt $cuadrillas[$q].Count; $c++) {
            $colIdx = 2 + $c
            $wsConfig.Cells.Item($rowIdx, $colIdx).Value2 = $cuadrillas[$q][$c]
        }
    }

    $null = $wsConfig.Columns.AutoFit()

    # -------------------------------------------------------------
    # 3. CONFIGURAR HOJA: PLANTILLA
    # -------------------------------------------------------------
    $wsPlantilla = $wb.Sheets.Item("PLANTILLA")
    $wsPlantilla.Tab.Color = $cAzulMedio
    $wsPlantilla.Cells.Font.Name = "Segoe UI"
    $wsPlantilla.Cells.Font.Size = 10

    $null = $wsPlantilla.Range("B2:F2").Merge()
    $wsPlantilla.Range("B2").Value2 = "DICCIONARIO DE DATOS Y MAPEO DE COLUMNAS (SISTEMA MATRIZ -> PESTANA AVERIAS)"
    $wsPlantilla.Range("B2").Font.Bold = $true
    $wsPlantilla.Range("B2").Font.Size = 12
    $wsPlantilla.Range("B2").Font.Color = $cBlanco
    $wsPlantilla.Range("B2").Interior.Color = $cAzulMarino
    $wsPlantilla.Range("B2").HorizontalAlignment = -4108

    $plantillaHeaders = @("Renglon de Informacion", "Columna Matriz CSV", "Columna Destino en AVERIAS", "Tipo de Dato", "Descripcion y Regla de Negocio")
    for ($c = 0; $c -lt $plantillaHeaders.Count; $c++) {
        $colIdx = 2 + $c
        $cell = $wsPlantilla.Cells.Item(4, $colIdx)
        $cell.Value2 = $plantillaHeaders[$c]
        $cell.Font.Bold = $true
        $cell.Interior.Color = $cAzulMedio
        $cell.Font.Color = $cBlanco
    }

    $mapeos = @(
        @("Operativa / Filtro", "area", "N/A (Filtro)", "Texto / Entero", "Filtro obligatorio: Debe ser igual a 4"),
        @("Operativa / Filtro", "central / nombre_central", "N/A (Filtro)", "Texto", "Filtro obligatorio: Debe ser FSA o Francisco Salias"),
        @("Identificativo", "id_averia", "ID_AVERIA (Col A)", "Alfanumerico", "Clave primaria unica. Si ya existe en AVERIAS, se descarta"),
        @("Identificativo", "telefono", "TELEFONO (Col B)", "Texto", "Numero telefonico del servicio Cantv del cliente"),
        @("Contacto", "nombre_suscriptor", "SUSCRIPTOR (Col C)", "Texto", "Nombre o razon social del suscriptor"),
        @("Contacto", "contacto_telefono", "CONTACTO (Col D)", "Texto", "Numero de contacto movil para acordar cita"),
        @("Geografica", "direccion", "DIRECCION (Col E)", "Texto", "Direccion exacta del inmueble"),
        @("Geografica", "sector", "SECTOR (Col F)", "Texto", "Sector para agrupamiento geografico en despacho"),
        @("Clasificacion", "tipo_cliente", "TIPO_CLIENTE (Col G)", "Texto", "Residencial / Empresa / Referidos"),
        @("Clasificacion", "actividad", "ACTIVIDAD (Col H)", "Texto", "Reparacion / Construccion"),
        @("Tecnica GPON", "olt", "OLT (Col S)", "Texto", "Equipo OLT de la central"),
        @("Tecnica GPON", "slot", "SLOT (Col T)", "Texto", "Slot de la tarjeta GPON"),
        @("Tecnica GPON", "puerto", "PUERTO (Col U)", "Texto", "Puerto PON"),
        @("Tecnica GPON", "fat", "FAT (Col V)", "Texto", "Caja terminal optica (FAT)"),
        @("Diagnostico", "falla_reportada", "FALLA_REPORTADA (Col P)", "Texto", "Sintoma inicial reportado"),
        @("Diagnostico", "ultimo_comentario", "ULTIMO_COMENTARIO (Col Q)", "Texto", "Comentario de soporte o diagnostico de red"),
        @("Diagnostico", "problema_reporte", "PROBLEMA_REPORTE (Col R)", "Texto", "Codificacion del problema (LOSS ROJO, FALLA FIBRA, etc.)"),
        @("Gestion Operativa", "Fecha del sistema", "FECHA_INGRESO (Col K)", "Fecha", "Fecha en que se ejecuta la ingesta en el libro"),
        @("Gestion Operativa", "Calculado", "ESTATUS (Col I)", "Texto", "Pendiente, En Gestion, Asignado, Resuelto, Diferido, Enrutado")
    )

    for ($m = 0; $m -lt $mapeos.Count; $m++) {
        $rowIdx = 5 + $m
        for ($c = 0; $c -lt $mapeos[$m].Count; $c++) {
            $colIdx = 2 + $c
            $wsPlantilla.Cells.Item($rowIdx, $colIdx).Value2 = $mapeos[$m][$c]
        }
    }
    $null = $wsPlantilla.Columns.AutoFit()

    # -------------------------------------------------------------
    # 4. CONFIGURAR HOJA: AVERIAS (Data Principal)
    # -------------------------------------------------------------
    $wsAverias = $wb.Sheets.Item("AVERIAS")
    $wsAverias.Tab.Color = $cCeleste
    $wsAverias.Cells.Font.Name = "Segoe UI"
    $wsAverias.Cells.Font.Size = 9

    $averiasHeaders = @(
        "ID_AVERIA", "TELEFONO", "SUSCRIPTOR", "CONTACTO", "DIRECCION", "SECTOR",
        "TIPO_CLIENTE", "ACTIVIDAD", "ESTATUS", "CUADRILLA", "FECHA_INGRESO", "FECHA_DESPACHO",
        "FECHA_CITA", "HORA_CITA", "PRIORIDAD", "FALLA_REPORTADA", "ULTIMO_COMENTARIO", "PROBLEMA_REPORTE",
        "OLT", "SLOT", "PUERTO", "FAT", "SERIAL_ONT", "PLAN", "FECHA_CIERRE", "METODO_CIERRE",
        "COMENTARIO_CIERRE", "AGENTE"
    )

    for ($c = 0; $c -lt $averiasHeaders.Count; $c++) {
        $colIdx = 1 + $c
        $cell = $wsAverias.Cells.Item(1, $colIdx)
        $cell.Value2 = $averiasHeaders[$c]
        $cell.Font.Bold = $true
        $cell.Interior.Color = $cAzulMarino
        $cell.Font.Color = $cBlanco
        $cell.HorizontalAlignment = -4108
    }
    $wsAverias.Rows.Item(1).RowHeight = 25
    $null = $wsAverias.Columns.AutoFit()

    # -------------------------------------------------------------
    # 5. CONFIGURAR HOJA: DESPACHO
    # -------------------------------------------------------------
    $wsDespacho = $wb.Sheets.Item("DESPACHO")
    $wsDespacho.Tab.Color = $cAzulMedio
    $wsDespacho.Cells.Font.Name = "Segoe UI"
    $wsDespacho.Cells.Font.Size = 9

    $null = $wsDespacho.Range("A1:L1").Merge()
    $wsDespacho.Range("A1").Value2 = "CANTV - CONCENTRADO DIARIO DE DESPACHO A CUADRILLAS - CENTRAL FRANCISCO SALIAS"
    $wsDespacho.Range("A1").Font.Bold = $true
    $wsDespacho.Range("A1").Font.Size = 13
    $wsDespacho.Range("A1").Font.Color = $cBlanco
    $wsDespacho.Range("A1").Interior.Color = $cAzulMarino
    $wsDespacho.Range("A1").HorizontalAlignment = -4108

    $despachoHeaders = @("Cuadrilla", "ID Averia", "Telefono", "Suscriptor", "Contacto", "Sector", "Direccion", "Tipo", "Actividad", "Falla Reportada", "FAT / Puerto", "Estatus")
    for ($c = 0; $c -lt $despachoHeaders.Count; $c++) {
        $colIdx = 1 + $c
        $cell = $wsDespacho.Cells.Item(3, $colIdx)
        $cell.Value2 = $despachoHeaders[$c]
        $cell.Font.Bold = $true
        $cell.Interior.Color = $cAzulMedio
        $cell.Font.Color = $cBlanco
        $cell.HorizontalAlignment = -4108
    }

    $wsDespacho.PageSetup.Orientation = 2
    $wsDespacho.PageSetup.PaperSize = 1
    $wsDespacho.PageSetup.Zoom = $false
    $wsDespacho.PageSetup.FitToPagesWide = 1
    $wsDespacho.PageSetup.FitToPagesTall = $false
    $null = $wsDespacho.Columns.AutoFit()

    # -------------------------------------------------------------
    # 6. CONFIGURAR HOJAS: GESTION, EMPRESAS, REFERIDOS, SEGUIMIENTO
    # -------------------------------------------------------------
    $subHojas = @("GESTION", "EMPRESAS", "REFERIDOS", "SEGUIMIENTO")
    foreach ($shName in $subHojas) {
        $sh = $wb.Sheets.Item($shName)
        $sh.Tab.Color = $cAzulMedio
        $sh.Cells.Font.Name = "Segoe UI"
        $sh.Cells.Font.Size = 9

        for ($c = 0; $c -lt $averiasHeaders.Count; $c++) {
            $colIdx = 1 + $c
            $cell = $sh.Cells.Item(1, $colIdx)
            $cell.Value2 = $averiasHeaders[$c]
            $cell.Font.Bold = $true
            $cell.Interior.Color = $cAzulMedio
            $cell.Font.Color = $cBlanco
            $cell.HorizontalAlignment = -4108
        }
        $sh.Rows.Item(1).RowHeight = 22
        $null = $sh.Columns.AutoFit()
    }

    # -------------------------------------------------------------
    # 7. CONFIGURAR HOJA: MONITOREO (Fórmulas apuntando a AVERIAS)
    # -------------------------------------------------------------
    $wsMon = $wb.Sheets.Item("MONITOREO")
    $wsMon.Tab.Color = $cCeleste
    $wsMon.Cells.Font.Name = "Segoe UI"
    $wsMon.Cells.Font.Size = 10

    $null = $wsMon.Range("B2:J2").Merge()
    $wsMon.Range("B2").Value2 = "CENTRO DE MONITOREO Y METRICAS OPERATIVAS GPON"
    $wsMon.Range("B2").Font.Bold = $true
    $wsMon.Range("B2").Font.Size = 14
    $wsMon.Range("B2").Font.Color = $cBlanco
    $wsMon.Range("B2").Interior.Color = $cAzulMarino
    $wsMon.Range("B2").HorizontalAlignment = -4108

    # Tabla 1: GESTION DIARIO (B4:C9)
    $null = $wsMon.Range("B4:C4").Merge()
    $wsMon.Range("B4").Value2 = "GESTION DIARIO (HOY)"
    $wsMon.Range("B4").Font.Bold = $true
    $wsMon.Range("B4").Interior.Color = $cAzulMedio
    $wsMon.Range("B4").Font.Color = $cBlanco

    $wsMon.Range("B5").Value2 = "Ingreso Nuevo"
    $wsMon.Range("B6").Value2 = "Resuelto Residencial"
    $wsMon.Range("B7").Value2 = "Resuelto Empresarial"
    $wsMon.Range("B8").Value2 = "Resuelto Referidos"
    $wsMon.Range("B9").Value2 = "Total Resueltos Hoy"
    $wsMon.Range("B9").Font.Bold = $true

    $wsMon.Range("C5").Formula = "=COUNTIFS(AVERIAS!K:K, TODAY())"
    $wsMon.Range("C6").Formula = "=COUNTIFS(AVERIAS!G:G, ""Residencial"", AVERIAS!I:I, ""Resuelto"", AVERIAS!Y:Y, TODAY())"
    $wsMon.Range("C7").Formula = "=COUNTIFS(AVERIAS!G:G, ""Empresa"", AVERIAS!I:I, ""Resuelto"", AVERIAS!Y:Y, TODAY())"
    $wsMon.Range("C8").Formula = "=COUNTIFS(AVERIAS!G:G, ""Referidos"", AVERIAS!I:I, ""Resuelto"", AVERIAS!Y:Y, TODAY())"
    $wsMon.Range("C9").Formula = "=SUM(C6:C8)"

    # Tabla 2: GESTION SEMANAL (Lunes - Sabado) (F4:I11)
    $null = $wsMon.Range("F4:I4").Merge()
    $wsMon.Range("F4").Value2 = "GESTION SEMANAL (LUNES - SABADO)"
    $wsMon.Range("F4").Font.Bold = $true
    $wsMon.Range("F4").Interior.Color = $cAzulMedio
    $wsMon.Range("F4").Font.Color = $cBlanco

    $wsMon.Range("F5").Value2 = "Dia"
    $wsMon.Range("G5").Value2 = "Ingresados"
    $wsMon.Range("H5").Value2 = "Resueltos"
    $wsMon.Range("I5").Value2 = "Pendientes"
    $wsMon.Range("F5:I5").Font.Bold = $true
    $wsMon.Range("F5:I5").Interior.Color = $cCeleste
    $wsMon.Range("F5:I5").Font.Color = $cBlanco

    $dias = @("Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado")
    for ($d = 0; $d -lt $dias.Count; $d++) {
        $rowIdx = 6 + $d
        $valIng = [string](8 + $d * 2)
        $valRes = [string](6 + $d * 2)
        $wsMon.Cells.Item($rowIdx, 6).Value2 = $dias[$d]
        $wsMon.Cells.Item($rowIdx, 7).Value2 = $valIng
        $wsMon.Cells.Item($rowIdx, 8).Value2 = $valRes
        $wsMon.Cells.Item($rowIdx, 9).Value2 = "2"
    }

    # Tabla 3: CASOS GLOBALES (B12:C15)
    $null = $wsMon.Range("B12:C12").Merge()
    $wsMon.Range("B12").Value2 = "CASOS GLOBALES"
    $wsMon.Range("B12").Font.Bold = $true
    $wsMon.Range("B12").Interior.Color = $cAzulMedio
    $wsMon.Range("B12").Font.Color = $cBlanco

    $wsMon.Range("B13").Value2 = "Pendientes Totales"
    $wsMon.Range("B14").Value2 = "Resueltos Totales"
    $wsMon.Range("B15").Value2 = "Universo Casos"
    $wsMon.Range("B15").Font.Bold = $true

    $wsMon.Range("C13").Formula = "=COUNTIF(AVERIAS!I:I, ""Pendiente"") + COUNTIF(AVERIAS!I:I, ""Asignado"") + COUNTIF(AVERIAS!I:I, ""En Gestion"")"
    $wsMon.Range("C14").Formula = "=COUNTIF(AVERIAS!I:I, ""Resuelto"")"
    $wsMon.Range("C15").Formula = "=COUNTA(AVERIAS!A:A)-1"

    # Tabla 4: REPARACION PENDIENTES (E13:F17)
    $null = $wsMon.Range("E13:F13").Merge()
    $wsMon.Range("E13").Value2 = "REPARACION (PENDIENTES)"
    $wsMon.Range("E13").Font.Bold = $true
    $wsMon.Range("E13").Interior.Color = $cAzulMedio
    $wsMon.Range("E13").Font.Color = $cBlanco

    $wsMon.Range("E14").Value2 = "Residenciales Comunes"
    $wsMon.Range("E15").Value2 = "Residenciales Referidos"
    $wsMon.Range("E16").Value2 = "Empresariales"
    $wsMon.Range("E17").Value2 = "Total Reparacion"
    $wsMon.Range("E17").Font.Bold = $true

    $wsMon.Range("F14").Formula = "=COUNTIFS(AVERIAS!H:H, ""Reparacion"", AVERIAS!G:G, ""Residencial"", AVERIAS!I:I, ""<>Resuelto"")"
    $wsMon.Range("F15").Formula = "=COUNTIFS(AVERIAS!H:H, ""Reparacion"", AVERIAS!G:G, ""Referidos"", AVERIAS!I:I, ""<>Resuelto"")"
    $wsMon.Range("F16").Formula = "=COUNTIFS(AVERIAS!H:H, ""Reparacion"", AVERIAS!G:G, ""Empresa"", AVERIAS!I:I, ""<>Resuelto"")"
    $wsMon.Range("F17").Formula = "=SUM(F14:F16)"

    # Tabla 5: CONSTRUCCION PENDIENTES (H13:I16)
    $null = $wsMon.Range("H13:I13").Merge()
    $wsMon.Range("H13").Value2 = "CONSTRUCCION (PENDIENTES)"
    $wsMon.Range("H13").Font.Bold = $true
    $wsMon.Range("H13").Interior.Color = $cAzulMedio
    $wsMon.Range("H13").Font.Color = $cBlanco

    $wsMon.Range("H14").Value2 = "Residenciales"
    $wsMon.Range("H15").Value2 = "Empresariales"
    $wsMon.Range("H16").Value2 = "Total Construccion"
    $wsMon.Range("H16").Font.Bold = $true

    $wsMon.Range("I14").Formula = "=COUNTIFS(AVERIAS!H:H, ""Construccion"", AVERIAS!G:G, ""Residencial"", AVERIAS!I:I, ""<>Resuelto"")"
    $wsMon.Range("I15").Formula = "=COUNTIFS(AVERIAS!H:H, ""Construccion"", AVERIAS!G:G, ""Empresa"", AVERIAS!I:I, ""<>Resuelto"")"
    $wsMon.Range("I16").Formula = "=SUM(I14:I15)"

    # Tabla 6: CUADRILLAS (B19:E23)
    $null = $wsMon.Range("B19:E19").Merge()
    $wsMon.Range("B19").Value2 = "DESEMPENO POR CUADRILLA (SEMANAL)"
    $wsMon.Range("B19").Font.Bold = $true
    $wsMon.Range("B19").Interior.Color = $cAzulMedio
    $wsMon.Range("B19").Font.Color = $cBlanco

    $wsMon.Range("B20").Value2 = "Cuadrilla"
    $wsMon.Range("C20").Value2 = "Asignados"
    $wsMon.Range("D20").Value2 = "Cerrados"
    $wsMon.Range("E20").Value2 = "Gestionados"
    $wsMon.Range("B20:E20").Font.Bold = $true
    $wsMon.Range("B20:E20").Interior.Color = $cCeleste
    $wsMon.Range("B20:E20").Font.Color = $cBlanco

    $cuadsList = @("Cuadrilla 1", "Cuadrilla 2", "Cuadrilla 3")
    for ($q = 0; $q -lt $cuadsList.Count; $q++) {
        $cName = $cuadsList[$q]
        $rowIdx = 21 + $q
        $wsMon.Cells.Item($rowIdx, 2).Value2 = $cName
        $wsMon.Cells.Item($rowIdx, 3).Formula = "=COUNTIF(AVERIAS!J:J, """ + $cName + """)"
        $wsMon.Cells.Item($rowIdx, 4).Formula = "=COUNTIFS(AVERIAS!J:J, """ + $cName + """, AVERIAS!I:I, ""Resuelto"")"
        $wsMon.Cells.Item($rowIdx, 5).Formula = "=COUNTIFS(AVERIAS!J:J, """ + $cName + """, AVERIAS!I:I, ""<>Pendiente"")"
    }

    $null = $wsMon.Columns.AutoFit()

    # -------------------------------------------------------------
    # 8. CONFIGURAR HOJA: GRAFICOS (Dashboard Visual)
    # -------------------------------------------------------------
    $wsGraf = $wb.Sheets.Item("GRAFICOS")
    $wsGraf.Tab.Color = $cCeleste
    $wsGraf.Cells.Font.Name = "Segoe UI"
    $wsGraf.Cells.Font.Size = 10

    $null = $wsGraf.Range("B2:M2").Merge()
    $wsGraf.Range("B2").Value2 = "DASHBOARD GERENCIAL GPON - INDICADORES Y METRICAS VISUALES"
    $wsGraf.Range("B2").Font.Bold = $true
    $wsGraf.Range("B2").Font.Size = 14
    $wsGraf.Range("B2").Font.Color = $cBlanco
    $wsGraf.Range("B2").Interior.Color = $cAzulMarino
    $wsGraf.Range("B2").HorizontalAlignment = -4108

    # Grafico 1: GESTION DIARIO (Columnas)
    $chObj1 = $wsGraf.ChartObjects().Add(40, 60, 360, 220)
    $ch1 = $chObj1.Chart
    $ch1.ChartType = 51
    $ch1.SetSourceData($wsMon.Range("B5:C8"))
    $ch1.HasTitle = $true
    $ch1.ChartTitle.Text = "Gestion Diario - Casos por Categoria"

    # Grafico 2: GESTION SEMANAL (Curva / Lineas)
    $chObj2 = $wsGraf.ChartObjects().Add(420, 60, 380, 220)
    $ch2 = $chObj2.Chart
    $ch2.ChartType = 4
    $ch2.SetSourceData($wsMon.Range("F5:I11"))
    $ch2.HasTitle = $true
    $ch2.ChartTitle.Text = "Gestion Semanal (Lunes - Sabado)"

    # Grafico 3: CASOS GLOBALES (Barras Pendiente vs Resuelto)
    $chObj3 = $wsGraf.ChartObjects().Add(40, 295, 360, 220)
    $ch3 = $chObj3.Chart
    $ch3.ChartType = 57
    $ch3.SetSourceData($wsMon.Range("B13:C14"))
    $ch3.HasTitle = $true
    $ch3.ChartTitle.Text = "Casos Globales: Pendiente vs Resuelto"

    # Grafico 4: REPARACION (Torta / Circular)
    $chObj4 = $wsGraf.ChartObjects().Add(420, 295, 380, 220)
    $ch4 = $chObj4.Chart
    $ch4.ChartType = 5
    $ch4.SetSourceData($wsMon.Range("E14:F16"))
    $ch4.HasTitle = $true
    $ch4.ChartTitle.Text = "Distribucion de Casos de Reparacion"

    # Grafico 5: CONSTRUCCION (Barras / Columnas)
    $chObj5 = $wsGraf.ChartObjects().Add(40, 530, 360, 220)
    $ch5 = $chObj5.Chart
    $ch5.ChartType = 51
    $ch5.SetSourceData($wsMon.Range("H14:I15"))
    $ch5.HasTitle = $true
    $ch5.ChartTitle.Text = "Casos Pendientes de Construccion"

    # Grafico 6: CUADRILLA (Columnas Agrupadas Asignados vs Cerrados vs Gestionados)
    $chObj6 = $wsGraf.ChartObjects().Add(420, 530, 380, 220)
    $ch6 = $chObj6.Chart
    $ch6.ChartType = 51
    $ch6.SetSourceData($wsMon.Range("B20:E23"))
    $ch6.HasTitle = $true
    $ch6.ChartTitle.Text = "Rendimiento Semanal por Cuadrilla"

    # -------------------------------------------------------------
    # 9. CONFIGURAR HOJA: PANEL (Consola Principal y Fichas)
    # -------------------------------------------------------------
    $wsPanel = $wb.Sheets.Item("PANEL")
    $wsPanel.Tab.Color = $cAzulMarino
    $wsPanel.Cells.Font.Name = "Segoe UI"

    $null = $wsPanel.Range("B2:M3").Merge()
    $wsPanel.Range("B2").Value2 = "CANTV - GESTION TECNICA GPON - CENTRAL FRANCISCO SALIAS (AREA 4)"
    $wsPanel.Range("B2").Font.Bold = $true
    $wsPanel.Range("B2").Font.Size = 16
    $wsPanel.Range("B2").Font.Color = $cBlanco
    $wsPanel.Range("B2").Interior.Color = $cAzulMarino
    $wsPanel.Range("B2").HorizontalAlignment = -4108
    $wsPanel.Range("B2").VerticalAlignment = -4108

    # Botones superiores
    $btn1 = $wsPanel.Shapes.AddShape(1, 40, 80, 140, 36)
    $btn1.TextFrame.Characters().Text = "1. INGESTA DIARIA"
    $btn1.TextFrame.Characters().Font.Bold = $true
    $btn1.TextFrame.Characters().Font.ColorIndex = 2
    $btn1.Fill.ForeColor.RGB = $cAzulMedio
    $btn1.OnAction = "Mod_Ingesta.EjecutarIngestaCompleta"

    $btn2 = $wsPanel.Shapes.AddShape(1, 190, 80, 150, 36)
    $btn2.TextFrame.Characters().Text = "2. TRIAJE GESTION"
    $btn2.TextFrame.Characters().Font.Bold = $true
    $btn2.TextFrame.Characters().Font.ColorIndex = 2
    $btn2.Fill.ForeColor.RGB = $cAzulMedio
    $btn2.OnAction = "Mod_Actualizacion.NormalizarYEnviarAGestion"

    $btn3 = $wsPanel.Shapes.AddShape(1, 350, 80, 150, 36)
    $btn3.TextFrame.Characters().Text = "3. GENERAR DESPACHO"
    $btn3.TextFrame.Characters().Font.Bold = $true
    $btn3.TextFrame.Characters().Font.ColorIndex = 2
    $btn3.Fill.ForeColor.RGB = $cAzulMedio
    $btn3.OnAction = "Mod_Despacho.GenerarDespachoCuadrillas"

    $btn4 = $wsPanel.Shapes.AddShape(1, 510, 80, 150, 36)
    $btn4.TextFrame.Characters().Text = "4. EXPORTAR PDFS"
    $btn4.TextFrame.Characters().Font.Bold = $true
    $btn4.TextFrame.Characters().Font.ColorIndex = 2
    $btn4.Fill.ForeColor.RGB = $cAzulMedio
    $btn4.OnAction = "Mod_Despacho.ExportarDespachosAPDF"

    $btn5 = $wsPanel.Shapes.AddShape(1, 670, 80, 140, 36)
    $btn5.TextFrame.Characters().Text = "5. VER GRAFICOS"
    $btn5.TextFrame.Characters().Font.Bold = $true
    $btn5.TextFrame.Characters().Font.ColorIndex = 2
    $btn5.Fill.ForeColor.RGB = $cCeleste
    $btn5.OnAction = "Mod_Panel.IrAGraficos"

    # FICHA 1: CONSULTA Y BUSQUEDA DE CASO
    $null = $wsPanel.Range("B8:G8").Merge()
    $wsPanel.Range("B8").Value2 = "CONSULTA Y BUSQUEDA DE CASO EN AVERIAS (POR ID O TELEFONO)"
    $wsPanel.Range("B8").Font.Bold = $true
    $wsPanel.Range("B8").Font.Color = $cBlanco
    $wsPanel.Range("B8").Interior.Color = $cAzulMedio

    $wsPanel.Range("B9").Value2 = "Criterio de Busqueda:"
    $wsPanel.Range("B9").Font.Bold = $true
    $null = $wsPanel.Range("C9:D9").Merge()
    $wsPanel.Range("C9").Interior.Color = 13434879
    $wsPanel.Range("C9").Value2 = "AV-2026-1001"

    $btnBuscar = $wsPanel.Shapes.AddShape(1, 350, 160, 110, 24)
    $btnBuscar.TextFrame.Characters().Text = "Buscar Caso"
    $btnBuscar.TextFrame.Characters().Font.Bold = $true
    $btnBuscar.TextFrame.Characters().Font.ColorIndex = 2
    $btnBuscar.Fill.ForeColor.RGB = $cAzulMarino
    $btnBuscar.OnAction = "Mod_Panel.BuscarCaso"

    $wsPanel.Range("B11").Value2 = "ID Averia:"
    $wsPanel.Range("B12").Value2 = "Telefono:"
    $wsPanel.Range("B13").Value2 = "Suscriptor:"
    $wsPanel.Range("B14").Value2 = "Contacto:"
    $wsPanel.Range("B15").Value2 = "Sector:"
    $wsPanel.Range("B16").Value2 = "Direccion:"
    $wsPanel.Range("B17").Value2 = "Tipo / Actividad:"
    $wsPanel.Range("B18").Value2 = "Falla Reportada:"
    $wsPanel.Range("B11:B18").Font.Bold = $true

    $wsPanel.Range("E11").Value2 = "Estatus Actual:"
    $wsPanel.Range("E12").Value2 = "Cuadrilla:"
    $wsPanel.Range("E13").Value2 = "OLT / FAT:"
    $wsPanel.Range("E14").Value2 = "Puerto:"
    $wsPanel.Range("E15").Value2 = "Fecha Ingreso:"
    $wsPanel.Range("E16").Value2 = "Ultimo Comentario:"
    $wsPanel.Range("E11:E16").Font.Bold = $true

    $wsPanel.Range("C11:D18").Interior.Color = $cGrisSuave
    $wsPanel.Range("F11:G16").Interior.Color = $cGrisSuave

    # FICHA 2: ACTUALIZACION DE CASO Y CIERRE
    $null = $wsPanel.Range("B20:G20").Merge()
    $wsPanel.Range("B20").Value2 = "ACTUALIZAR RESOLUCION / ESTATUS DEL CASO"
    $wsPanel.Range("B20").Font.Bold = $true
    $wsPanel.Range("B20").Font.Color = $cBlanco
    $wsPanel.Range("B20").Interior.Color = $cAzulMedio

    $wsPanel.Range("B21").Value2 = "Nuevo Estatus:"
    $wsPanel.Range("B22").Value2 = "Metodo de Cierre:"
    $wsPanel.Range("B23").Value2 = "Comentario Cierre:"
    $wsPanel.Range("B21:B23").Font.Bold = $true

    $wsPanel.Range("C21").Value2 = "Resuelto"
    $wsPanel.Range("C21").Interior.Color = 13434879
    $wsPanel.Range("C22").Value2 = "SACAS"
    $wsPanel.Range("C22").Interior.Color = 13434879
    $null = $wsPanel.Range("C23:F23").Merge()
    $wsPanel.Range("C23").Interior.Color = 13434879

    $btnActualizar = $wsPanel.Shapes.AddShape(1, 510, 380, 130, 26)
    $btnActualizar.TextFrame.Characters().Text = "Guardar Cambios"
    $btnActualizar.TextFrame.Characters().Font.Bold = $true
    $btnActualizar.TextFrame.Characters().Font.ColorIndex = 2
    $btnActualizar.Fill.ForeColor.RGB = $cAzulMarino
    $btnActualizar.OnAction = "Mod_Panel.ActualizarCaso"

    # FICHA 3: INGRESO MANUAL DE NUEVO CASO
    $null = $wsPanel.Range("I8:M8").Merge()
    $wsPanel.Range("I8").Value2 = "REGISTRO MANUAL DE NUEVA AVERIA O CASO"
    $wsPanel.Range("I8").Font.Bold = $true
    $wsPanel.Range("I8").Font.Color = $cBlanco
    $wsPanel.Range("I8").Interior.Color = $cAzulMedio

    $manualFields = @(
        @("Telefono:", "I9", "J9:L9"),
        @("Suscriptor:", "I10", "J10:L10"),
        @("Contacto:", "I11", "J11:L11"),
        @("Sector:", "I12", "J12:L12"),
        @("Direccion:", "I13", "J13:L13"),
        @("Tipo Cliente:", "I14", "J14:L14"),
        @("Actividad:", "I15", "J15:L15"),
        @("Falla:", "I16", "J16:L16"),
        @("Agente:", "I17", "J17:L17")
    )

    foreach ($mf in $manualFields) {
        $wsPanel.Range($mf[1]).Value2 = $mf[0]
        $wsPanel.Range($mf[1]).Font.Bold = $true
        $null = $wsPanel.Range($mf[2]).Merge()
        $wsPanel.Range($mf[2]).Interior.Color = 13434879
    }

    $wsPanel.Range("J14").Value2 = "Residencial"
    $wsPanel.Range("J15").Value2 = "Reparacion"
    $wsPanel.Range("J17").Value2 = "Supervisor_FSA"

    $btnGuardarManual = $wsPanel.Shapes.AddShape(1, 680, 360, 140, 28)
    $btnGuardarManual.TextFrame.Characters().Text = "Registrar Averia"
    $btnGuardarManual.TextFrame.Characters().Font.Bold = $true
    $btnGuardarManual.TextFrame.Characters().Font.ColorIndex = 2
    $btnGuardarManual.Fill.ForeColor.RGB = $cAzulMarino
    $btnGuardarManual.OnAction = "Mod_Panel.RegistrarCasoManual"

    $null = $wsPanel.Columns.AutoFit()
    $wsPanel.Activate()

    Write-Output "Hojas y disenio configurados satisfactoriamente."

    # -------------------------------------------------------------
    # 10. INYECCION DE MODULOS DE CODIGO VBA
    # -------------------------------------------------------------
    $vbproj = $wb.VBProject

    # 10.1 Mod_Utilidades
    $modUtil = $vbproj.VBComponents.Add(1)
    $modUtil.Name = "Mod_Utilidades"
    $codeUtil = @'
Option Explicit

Public Const COLOR_AZUL_MARINO As Long = 6434048
Public Const COLOR_AZUL_MEDIO As Long = 8866560
Public Const COLOR_CELESTE As Long = 14058496

Public Sub MostrarMensaje(ByVal mensaje As String, Optional ByVal estilo As VbMsgBoxStyle = vbInformation, Optional ByVal titulo As String = "CANTV GPON")
    On Error Resume Next
    If Application.UserControl Then
        MsgBox mensaje, estilo, titulo
    Else
        Debug.Print titulo & ": " & mensaje
    End If
End Sub

Public Function GetCarpetaUnificada() As String
    GetCarpetaUnificada = ThisWorkbook.Path & Application.PathSeparator
End Function

Public Sub OptimizarEntorno(ByVal desactivar As Boolean)
    On Error Resume Next
    If desactivar Then
        Application.ScreenUpdating = False
        Application.DisplayAlerts = False
        Application.EnableEvents = False
        Application.Calculation = xlCalculationManual
    Else
        Application.ScreenUpdating = True
        Application.DisplayAlerts = True
        Application.EnableEvents = True
        Application.Calculation = xlCalculationAutomatic
    End If
End Sub
'@
    $modUtil.CodeModule.AddFromString($codeUtil)
    Write-Output "Modulo Mod_Utilidades inyectado."

    # 10.2 Mod_Ingesta (Soporta detalle_averias_gpon*.csv y alta_manual.csv)
    $modIng = $vbproj.VBComponents.Add(1)
    $modIng.Name = "Mod_Ingesta"
    $codeIng = @'
Option Explicit

Public Sub EjecutarIngestaCompleta()
    On Error GoTo ErrorHandler
    Mod_Utilidades.OptimizarEntorno True

    Dim wsAverias As Worksheet, wsConfig As Worksheet
    Dim rutaRaiz As String, archMatriz As String, archManual As String
    Dim numArch As Integer, linea As String, campos() As String
    Dim delim As String, i As Long, ultFila As Long
    Dim dictExistentes As Object
    Dim filtroCentral As String, filtroArea As String
    Dim colCentral As Long, colArea As Long, colId As Long
    Dim nuevosMatriz As Long, duplicadosMatriz As Long, fueraCentral As Long
    Dim nuevosManual As Long, manualProcesado As Boolean

    Set wsAverias = ThisWorkbook.Sheets("AVERIAS")
    Set wsConfig = ThisWorkbook.Sheets("CONFIGURACION")
    rutaRaiz = Mod_Utilidades.GetCarpetaUnificada()

    ' 1. Obtener filtros de configuracion
    filtroCentral = UCase(Trim(CStr(wsConfig.Range("C14").Value)))
    filtroArea = Trim(CStr(wsConfig.Range("C12").Value))
    If filtroCentral = "" Then filtroCentral = "FRANCISCO SALIAS"
    If filtroArea = "" Then filtroArea = "4"

    ' 2. Cargar IDs existentes para garantizar O(1) en descarte de duplicados
    Set dictExistentes = CreateObject("Scripting.Dictionary")
    ultFila = wsAverias.Cells(wsAverias.Rows.Count, "A").End(xlUp).Row
    If ultFila >= 2 Then
        For i = 2 To ultFila
            Dim idVal As String
            idVal = Trim(CStr(wsAverias.Cells(i, 1).Value))
            If idVal <> "" Then
                If Not dictExistentes.Exists(idVal) Then
                    dictExistentes.Add idVal, i
                End If
            End If
        Next i
    End If

    ' 3. Procesar archivo matriz diario detalle_averias_gpon*.csv (ej. detalle_averias_gpon 11_09_2026.csv)
    archMatriz = Dir(rutaRaiz & "detalle_averias_gpon*.csv")
    If archMatriz <> "" Then
        numArch = FreeFile
        Open rutaRaiz & archMatriz For Input As #numArch

        If Not EOF(numArch) Then
            Line Input #numArch, linea
            If InStr(linea, ";") > 0 Then delim = ";" Else delim = ","
            campos = Split(linea, delim)

            colArea = 7: colCentral = 9: colId = 10
            For i = 0 To UBound(campos)
                Dim nomCol As String
                nomCol = LCase(Trim(Replace(campos(i), Chr(34), "")))
                If nomCol = "area" Then colArea = i
                If nomCol = "central" Or nomCol = "nombre_central" Then colCentral = i
                If nomCol = "id_averia" Then colId = i
            Next i
        End If

        Do While Not EOF(numArch)
            Line Input #numArch, linea
            If Trim(linea) <> "" Then
                campos = Split(linea, delim)
                If UBound(campos) >= 10 Then
                    Dim valArea As String, valCentral As String, valId As String
                    valArea = Trim(Replace(campos(colArea), Chr(34), ""))
                    valCentral = UCase(Trim(Replace(campos(colCentral), Chr(34), "")))
                    valId = Trim(Replace(campos(colId), Chr(34), ""))

                    If (valArea = filtroArea Or valArea = "4") And _
                       (InStr(valCentral, "SALIAS") > 0 Or InStr(valCentral, "FSA") > 0) Then
                        If Not dictExistentes.Exists(valId) And valId <> "" Then
                            ultFila = wsAverias.Cells(wsAverias.Rows.Count, "A").End(xlUp).Row + 1
                            wsAverias.Cells(ultFila, 1).Value = valId
                            wsAverias.Cells(ultFila, 2).Value = "'" & Replace(campos(11), Chr(34), "")
                            wsAverias.Cells(ultFila, 3).Value = Replace(campos(12), Chr(34), "")
                            wsAverias.Cells(ultFila, 4).Value = "'" & Replace(campos(13), Chr(34), "")
                            wsAverias.Cells(ultFila, 5).Value = Replace(campos(14), Chr(34), "")
                            wsAverias.Cells(ultFila, 6).Value = Replace(campos(15), Chr(34), "")
                            wsAverias.Cells(ultFila, 7).Value = Replace(campos(17), Chr(34), "")
                            wsAverias.Cells(ultFila, 8).Value = Replace(campos(18), Chr(34), "")
                            wsAverias.Cells(ultFila, 9).Value = "Pendiente"
                            wsAverias.Cells(ultFila, 11).Value = Date
                            wsAverias.Cells(ultFila, 15).Value = "Normal"
                            wsAverias.Cells(ultFila, 16).Value = Replace(campos(26), Chr(34), "")
                            wsAverias.Cells(ultFila, 17).Value = Replace(campos(27), Chr(34), "")
                            wsAverias.Cells(ultFila, 18).Value = Replace(campos(28), Chr(34), "")
                            wsAverias.Cells(ultFila, 19).Value = Replace(campos(19), Chr(34), "")
                            wsAverias.Cells(ultFila, 20).Value = Replace(campos(20), Chr(34), "")
                            wsAverias.Cells(ultFila, 21).Value = Replace(campos(21), Chr(34), "")
                            wsAverias.Cells(ultFila, 22).Value = Replace(campos(23), Chr(34), "")
                            wsAverias.Cells(ultFila, 23).Value = Replace(campos(24), Chr(34), "")
                            wsAverias.Cells(ultFila, 24).Value = Replace(campos(25), Chr(34), "")
                            If UBound(campos) >= 30 Then
                                wsAverias.Cells(ultFila, 28).Value = Replace(campos(30), Chr(34), "")
                            End If

                            dictExistentes.Add valId, ultFila
                            nuevosMatriz = nuevosMatriz + 1
                        Else
                            duplicadosMatriz = duplicadosMatriz + 1
                        End If
                    Else
                        fueraCentral = fueraCentral + 1
                    End If
                End If
            End If
        Loop
        Close #numArch
    End If

    ' 4. Procesar archivo complementario alta_manual.csv (carga unica)
    archManual = Dir(rutaRaiz & "alta_manual.csv")
    If archManual <> "" Then
        numArch = FreeFile
        Open rutaRaiz & archManual For Input As #numArch

        If Not EOF(numArch) Then
            Line Input #numArch, linea
            If InStr(linea, ";") > 0 Then delim = ";" Else delim = ","
        End If

        Do While Not EOF(numArch)
            Line Input #numArch, linea
            If Trim(linea) <> "" Then
                campos = Split(linea, delim)
                If UBound(campos) >= 8 Then
                    Dim manId As String
                    manId = Trim(Replace(campos(0), Chr(34), ""))
                    If Not dictExistentes.Exists(manId) And manId <> "" Then
                        ultFila = wsAverias.Cells(wsAverias.Rows.Count, "A").End(xlUp).Row + 1
                        wsAverias.Cells(ultFila, 1).Value = manId
                        wsAverias.Cells(ultFila, 2).Value = "'" & Replace(campos(1), Chr(34), "")
                        wsAverias.Cells(ultFila, 3).Value = Replace(campos(2), Chr(34), "")
                        wsAverias.Cells(ultFila, 4).Value = "'" & Replace(campos(3), Chr(34), "")
                        wsAverias.Cells(ultFila, 5).Value = Replace(campos(4), Chr(34), "")
                        wsAverias.Cells(ultFila, 6).Value = Replace(campos(5), Chr(34), "")
                        wsAverias.Cells(ultFila, 7).Value = Replace(campos(6), Chr(34), "") ' Tipo Cliente
                        wsAverias.Cells(ultFila, 8).Value = Replace(campos(7), Chr(34), "") ' Actividad
                        wsAverias.Cells(ultFila, 9).Value = "Pendiente"
                        wsAverias.Cells(ultFila, 11).Value = Date
                        wsAverias.Cells(ultFila, 13).Value = Replace(campos(12), Chr(34), "")
                        wsAverias.Cells(ultFila, 14).Value = Replace(campos(13), Chr(34), "")
                        wsAverias.Cells(ultFila, 15).Value = Replace(campos(8), Chr(34), "")
                        wsAverias.Cells(ultFila, 16).Value = Replace(campos(9), Chr(34), "")
                        wsAverias.Cells(ultFila, 17).Value = Replace(campos(10), Chr(34), "")
                        wsAverias.Cells(ultFila, 18).Value = Replace(campos(11), Chr(34), "")
                        If UBound(campos) >= 17 Then
                            wsAverias.Cells(ultFila, 19).Value = Replace(campos(14), Chr(34), "")
                            wsAverias.Cells(ultFila, 20).Value = Replace(campos(15), Chr(34), "")
                            wsAverias.Cells(ultFila, 21).Value = Replace(campos(16), Chr(34), "")
                            wsAverias.Cells(ultFila, 22).Value = Replace(campos(17), Chr(34), "")
                        End If
                        If UBound(campos) >= 18 Then
                            wsAverias.Cells(ultFila, 28).Value = Replace(campos(18), Chr(34), "")
                        End If

                        dictExistentes.Add manId, ultFila
                        nuevosManual = nuevosManual + 1
                    End If
                End If
            End If
        Loop
        Close #numArch

        ' Requisito: Se carga solo una vez alimentando la pestaña AVERIAS.
        ' Se renombra a alta_manual_CARGADO.csv para evitar recarga en días siguientes.
        On Error Resume Next
        Kill rutaRaiz & "alta_manual_CARGADO.csv"
        Name rutaRaiz & "alta_manual.csv" As rutaRaiz & "alta_manual_CARGADO.csv"
        manualProcesado = True
        On Error GoTo ErrorHandler
    End If

    Mod_Actualizacion.SincronizarVistasEspeciales
    Mod_Utilidades.OptimizarEntorno False

    Dim msg As String
    msg = "Ingesta culminada con exito en pestana AVERIAS." & vbCrLf & vbCrLf & _
          "- Archivo matriz procesado: " & archMatriz & vbCrLf & _
          "- Casos nuevos ingresados: " & nuevosMatriz & vbCrLf & _
          "- Casos descartados por ya existir: " & duplicadosMatriz & vbCrLf & _
          "- Casos filtrados (otras centrales): " & fueraCentral
    If manualProcesado Then
        msg = msg & vbCrLf & vbCrLf & "- Archivo complementario alta_manual.csv: " & nuevosManual & " casos cargados (archivado como alta_manual_CARGADO.csv para carga unica)."
    End If

    Mod_Utilidades.MostrarMensaje msg, vbInformation, "CANTV - Ingesta GPON"
    Exit Sub

ErrorHandler:
    On Error Resume Next
    Close #numArch
    Mod_Utilidades.OptimizarEntorno False
    Mod_Utilidades.MostrarMensaje "Error durante la ejecucion de la ingesta: " & Err.Description, vbCritical, "Error de Ingesta"
End Sub
'@
    $modIng.CodeModule.AddFromString($codeIng)
    Write-Output "Modulo Mod_Ingesta inyectado."

    # 10.3 Mod_Actualizacion (Sincroniza desde AVERIAS)
    $modAct = $vbproj.VBComponents.Add(1)
    $modAct.Name = "Mod_Actualizacion"
    $codeAct = @'
Option Explicit

Public Sub NormalizarYEnviarAGestion()
    On Error GoTo ErrorHandler
    Mod_Utilidades.OptimizarEntorno True

    Dim wsAverias As Worksheet, wsGestion As Worksheet
    Dim ultFilaAverias As Long, ultFilaGestion As Long
    Dim i As Long, c As Long, casosTriados As Long
    Dim textoDiagnostico As String
    Dim esFallaFisica As Boolean

    Set wsAverias = ThisWorkbook.Sheets("AVERIAS")
    Set wsGestion = ThisWorkbook.Sheets("GESTION")

    ultFilaGestion = wsGestion.Cells(wsGestion.Rows.Count, "A").End(xlUp).Row
    If ultFilaGestion >= 2 Then
        wsGestion.Range("A2:AB" & ultFilaGestion).ClearContents
    End If

    ultFilaAverias = wsAverias.Cells(wsAverias.Rows.Count, "A").End(xlUp).Row
    If ultFilaAverias < 2 Then
        Mod_Utilidades.OptimizarEntorno False
        Mod_Utilidades.MostrarMensaje "No existen casos cargados en la pestana AVERIAS.", vbExclamation, "Atencion"
        Exit Sub
    End If

    For i = 2 To ultFilaAverias
        Dim est As String
        est = Trim(CStr(wsAverias.Cells(i, 9).Value))
        If est = "Pendiente" Or est = "En Gestion" Then
            textoDiagnostico = UCase(Trim(CStr(wsAverias.Cells(i, 16).Value)) & " " & _
                                     Trim(CStr(wsAverias.Cells(i, 17).Value)) & " " & _
                                     Trim(CStr(wsAverias.Cells(i, 18).Value)))

            esFallaFisica = (InStr(textoDiagnostico, "LOSS ROJO") > 0) Or _
                            (InStr(textoDiagnostico, "FALLA FIBRA") > 0) Or _
                            (InStr(textoDiagnostico, "FIBRA DANADA") > 0) Or _
                            (InStr(textoDiagnostico, "FIBRA DAÑADA") > 0)

            If Not esFallaFisica Then
                ultFilaGestion = wsGestion.Cells(wsGestion.Rows.Count, "A").End(xlUp).Row + 1
                For c = 1 To 28
                    wsGestion.Cells(ultFilaGestion, c).Value = wsAverias.Cells(i, c).Value
                Next c
                wsAverias.Cells(i, 9).Value = "En Gestion"
                casosTriados = casosTriados + 1
            End If
        End If
    Next i

    SincronizarVistasEspeciales
    Mod_Utilidades.OptimizarEntorno False

    Mod_Utilidades.MostrarMensaje "Triaje y normalizacion completados." & vbCrLf & vbCrLf & _
           "- Casos derivados a la pestana GESTION: " & casosTriados & vbCrLf & _
           "- Pestanas EMPRESAS, REFERIDOS y SEGUIMIENTO sincronizadas.", _
           vbInformation, "CANTV - Triaje y Normalizacion"
    Exit Sub

ErrorHandler:
    Mod_Utilidades.OptimizarEntorno False
    Mod_Utilidades.MostrarMensaje "Error en normalizacion: " & Err.Description, vbCritical, "Error"
End Sub

Public Sub SincronizarVistasEspeciales()
    Dim wsAverias As Worksheet, wsEmp As Worksheet, wsRef As Worksheet, wsSeg As Worksheet
    Dim ultFila As Long, i As Long, c As Long
    Dim rEmp As Long, rRef As Long, rSeg As Long

    Set wsAverias = ThisWorkbook.Sheets("AVERIAS")
    Set wsEmp = ThisWorkbook.Sheets("EMPRESAS")
    Set wsRef = ThisWorkbook.Sheets("REFERIDOS")
    Set wsSeg = ThisWorkbook.Sheets("SEGUIMIENTO")

    If wsEmp.Cells(wsEmp.Rows.Count, "A").End(xlUp).Row >= 2 Then wsEmp.Range("A2:AB" & wsEmp.Cells(wsEmp.Rows.Count, "A").End(xlUp).Row).ClearContents
    If wsRef.Cells(wsRef.Rows.Count, "A").End(xlUp).Row >= 2 Then wsRef.Range("A2:AB" & wsRef.Cells(wsRef.Rows.Count, "A").End(xlUp).Row).ClearContents
    If wsSeg.Cells(wsSeg.Rows.Count, "A").End(xlUp).Row >= 2 Then wsSeg.Range("A2:AB" & wsSeg.Cells(wsSeg.Rows.Count, "A").End(xlUp).Row).ClearContents

    rEmp = 1: rRef = 1: rSeg = 1
    ultFila = wsAverias.Cells(wsAverias.Rows.Count, "A").End(xlUp).Row

    For i = 2 To ultFila
        Dim tipoCli As String, estatus As String
        tipoCli = UCase(Trim(CStr(wsAverias.Cells(i, 7).Value)))
        estatus = UCase(Trim(CStr(wsAverias.Cells(i, 9).Value)))

        If InStr(tipoCli, "EMPRESA") > 0 Then
            rEmp = rEmp + 1
            For c = 1 To 28: wsEmp.Cells(rEmp, c).Value = wsAverias.Cells(i, c).Value: Next c
        End If

        If InStr(tipoCli, "REFERIDO") > 0 Then
            rRef = rRef + 1
            For c = 1 To 28: wsRef.Cells(rRef, c).Value = wsAverias.Cells(i, c).Value: Next c
        End If

        If estatus = "ENRUTADO" Or estatus = "DIFERIDO" Or estatus = "SEGUIMIENTO" Then
            rSeg = rSeg + 1
            For c = 1 To 28: wsSeg.Cells(rSeg, c).Value = wsAverias.Cells(i, c).Value: Next c
        End If
    Next i
End Sub
'@
    $modAct.CodeModule.AddFromString($codeAct)
    Write-Output "Modulo Mod_Actualizacion inyectado."

    # 10.4 Mod_Despacho (Distribuye desde AVERIAS)
    $modDesp = $vbproj.VBComponents.Add(1)
    $modDesp.Name = "Mod_Despacho"
    $codeDesp = @'
Option Explicit

Public Sub GenerarDespachoCuadrillas()
    On Error GoTo ErrorHandler
    Mod_Utilidades.OptimizarEntorno True

    Dim wsAverias As Worksheet, wsConfig As Worksheet, wsDesp As Worksheet
    Dim ultAverias As Long, ultConfig As Long, ultDesp As Long
    Dim i As Long, c As Long
    Dim listaCuadrillas() As String, numCuadrillas As Long
    Dim casosAsignadosTotal As Long

    Set wsAverias = ThisWorkbook.Sheets("AVERIAS")
    Set wsConfig = ThisWorkbook.Sheets("CONFIGURACION")
    Set wsDesp = ThisWorkbook.Sheets("DESPACHO")

    ultConfig = wsConfig.Cells(wsConfig.Rows.Count, "B").End(xlUp).Row
    numCuadrillas = 0
    For i = 25 To ultConfig
        If UCase(Trim(CStr(wsConfig.Cells(i, 8).Value))) = "ACTIVA" Then
            ReDim Preserve listaCuadrillas(0 To numCuadrillas)
            listaCuadrillas(numCuadrillas) = Trim(CStr(wsConfig.Cells(i, 3).Value))
            numCuadrillas = numCuadrillas + 1
        End If
    Next i

    If numCuadrillas = 0 Then
        Mod_Utilidades.OptimizarEntorno False
        Mod_Utilidades.MostrarMensaje "No se encontraron cuadrillas activas en CONFIGURACION.", vbExclamation, "Aviso"
        Exit Sub
    End If

    ultDesp = wsDesp.Cells(wsDesp.Rows.Count, "A").End(xlUp).Row
    If ultDesp >= 4 Then
        wsDesp.Range("A4:L" & ultDesp).ClearContents
        wsDesp.Range("A4:L" & ultDesp).Borders.LineStyle = xlNone
    End If

    ultAverias = wsAverias.Cells(wsAverias.Rows.Count, "A").End(xlUp).Row
    If ultAverias < 2 Then
        Mod_Utilidades.OptimizarEntorno False
        Mod_Utilidades.MostrarMensaje "No hay casos para despachar en la pestana AVERIAS.", vbInformation, "Aviso"
        Exit Sub
    End If

    Dim idxCuad As Long
    idxCuad = 0

    For i = 2 To ultAverias
        Dim estatus As String
        estatus = Trim(CStr(wsAverias.Cells(i, 9).Value))

        If estatus = "Pendiente" Then
            Dim nombreCuad As String
            nombreCuad = listaCuadrillas(idxCuad)

            wsAverias.Cells(i, 10).Value = nombreCuad
            wsAverias.Cells(i, 12).Value = Date
            wsAverias.Cells(i, 9).Value = "Asignado"

            ultDesp = wsDesp.Cells(wsDesp.Rows.Count, "A").End(xlUp).Row + 1
            wsDesp.Cells(ultDesp, 1).Value = nombreCuad
            wsDesp.Cells(ultDesp, 2).Value = wsAverias.Cells(i, 1).Value
            wsDesp.Cells(ultDesp, 3).Value = wsAverias.Cells(i, 2).Value
            wsDesp.Cells(ultDesp, 4).Value = wsAverias.Cells(i, 3).Value
            wsDesp.Cells(ultDesp, 5).Value = wsAverias.Cells(i, 4).Value
            wsDesp.Cells(ultDesp, 6).Value = wsAverias.Cells(i, 6).Value
            wsDesp.Cells(ultDesp, 7).Value = wsAverias.Cells(i, 5).Value
            wsDesp.Cells(ultDesp, 8).Value = wsAverias.Cells(i, 7).Value
            wsDesp.Cells(ultDesp, 9).Value = wsAverias.Cells(i, 8).Value
            wsDesp.Cells(ultDesp, 10).Value = wsAverias.Cells(i, 16).Value
            wsDesp.Cells(ultDesp, 11).Value = wsAverias.Cells(i, 22).Value & " / P:" & wsAverias.Cells(i, 21).Value
            wsDesp.Cells(ultDesp, 12).Value = "Asignado"

            casosAsignadosTotal = casosAsignadosTotal + 1
            idxCuad = (idxCuad + 1) Mod numCuadrillas
        End If
    Next i

    ultDesp = wsDesp.Cells(wsDesp.Rows.Count, "A").End(xlUp).Row
    If ultDesp >= 4 Then
        With wsDesp.Range("A4:L" & ultDesp).Borders
            .LineStyle = xlContinuous
            .Weight = xlThin
            .ColorIndex = 15
        End With
    End If

    Mod_Actualizacion.SincronizarVistasEspeciales
    Mod_Utilidades.OptimizarEntorno False

    Mod_Utilidades.MostrarMensaje "Despacho diario generado exitosamente." & vbCrLf & vbCrLf & _
           "- Total de casos asignados hoy: " & casosAsignadosTotal & vbCrLf & _
           "- Cuadrillas atendidas: " & numCuadrillas & vbCrLf & _
           "- Consulta la pestana DESPACHO para revisar la distribucion.", _
           vbInformation, "CANTV - Despacho Diario"
    Exit Sub

ErrorHandler:
    Mod_Utilidades.OptimizarEntorno False
    Mod_Utilidades.MostrarMensaje "Error generando despacho: " & Err.Description, vbCritical, "Error"
End Sub

Public Sub ExportarDespachosAPDF()
    On Error GoTo ErrorHandler
    Mod_Utilidades.OptimizarEntorno True

    Dim wsDesp As Worksheet, wsTemp As Worksheet
    Dim ultDesp As Long, i As Long, c As Long, filaTemp As Long
    Dim dictCuad As Object, key As Variant
    Dim rutaRaiz As String, nomArchPDF As String, cantExportados As Long

    Set wsDesp = ThisWorkbook.Sheets("DESPACHO")
    rutaRaiz = Mod_Utilidades.GetCarpetaUnificada()

    ultDesp = wsDesp.Cells(wsDesp.Rows.Count, "A").End(xlUp).Row
    If ultDesp < 4 Then
        Mod_Utilidades.OptimizarEntorno False
        Mod_Utilidades.MostrarMensaje "No hay datos de despacho para exportar. Ejecute primero la macro de despacho.", vbExclamation, "Aviso"
        Exit Sub
    End If

    Set dictCuad = CreateObject("Scripting.Dictionary")
    For i = 4 To ultDesp
        Dim cuad As String
        cuad = Trim(CStr(wsDesp.Cells(i, 1).Value))
        If cuad <> "" And Not dictCuad.Exists(cuad) Then
            dictCuad.Add cuad, 1
        End If
    Next i

    For Each key In dictCuad.Keys
        Set wsTemp = ThisWorkbook.Sheets.Add(After:=ThisWorkbook.Sheets(ThisWorkbook.Sheets.Count))
        wsTemp.Name = "TEMP_PDF"
        wsTemp.Cells.Font.Name = "Segoe UI"
        wsTemp.Cells.Font.Size = 8

        wsTemp.Range("A1:K1").Merge
        wsTemp.Range("A1").Value = "CANTV - ORDEN DE TRABAJO DIARIA GPON"
        wsTemp.Range("A1").Font.Bold = True
        wsTemp.Range("A1").Font.Size = 12
        wsTemp.Range("A1").Font.Color = RGB(255, 255, 255)
        wsTemp.Range("A1").Interior.Color = Mod_Utilidades.COLOR_AZUL_MARINO
        wsTemp.Range("A1").HorizontalAlignment = xlCenter

        wsTemp.Range("A2:K2").Merge
        wsTemp.Range("A2").Value = "Central: Francisco Salias (Area 4) | Cuadrilla: " & CStr(key) & " | Fecha: " & Format(Date, "DD/MM/YYYY")
        wsTemp.Range("A2").Font.Bold = True
        wsTemp.Range("A2").Font.Size = 9
        wsTemp.Range("A2").Interior.Color = Mod_Utilidades.COLOR_AZUL_MEDIO
        wsTemp.Range("A2").Font.Color = RGB(255, 255, 255)
        wsTemp.Range("A2").HorizontalAlignment = xlCenter

        Dim titulos As Variant
        titulos = Array("ID Averia", "Telefono", "Suscriptor", "Contacto", "Sector", "Direccion", "Tipo", "Actividad", "Falla Reportada", "FAT / Puerto", "Firma Cliente / Observacion")
        For c = 0 To UBound(titulos)
            wsTemp.Cells(3, c + 1).Value = titulos(c)
            wsTemp.Cells(3, c + 1).Font.Bold = True
            wsTemp.Cells(3, c + 1).Interior.Color = Mod_Utilidades.COLOR_CELESTE
            wsTemp.Cells(3, c + 1).Font.Color = RGB(255, 255, 255)
            wsTemp.Cells(3, c + 1).HorizontalAlignment = xlCenter
        Next c

        filaTemp = 4
        For i = 4 To ultDesp
            If Trim(CStr(wsDesp.Cells(i, 1).Value)) = CStr(key) Then
                wsTemp.Cells(filaTemp, 1).Value = wsDesp.Cells(i, 2).Value
                wsTemp.Cells(filaTemp, 2).Value = wsDesp.Cells(i, 3).Value
                wsTemp.Cells(filaTemp, 3).Value = wsDesp.Cells(i, 4).Value
                wsTemp.Cells(filaTemp, 4).Value = wsDesp.Cells(i, 5).Value
                wsTemp.Cells(filaTemp, 5).Value = wsDesp.Cells(i, 6).Value
                wsTemp.Cells(filaTemp, 6).Value = wsDesp.Cells(i, 7).Value
                wsTemp.Cells(filaTemp, 7).Value = wsDesp.Cells(i, 8).Value
                wsTemp.Cells(filaTemp, 8).Value = wsDesp.Cells(i, 9).Value
                wsTemp.Cells(filaTemp, 9).Value = wsDesp.Cells(i, 10).Value
                wsTemp.Cells(filaTemp, 10).Value = wsDesp.Cells(i, 11).Value
                wsTemp.Cells(filaTemp, 11).Value = ""
                filaTemp = filaTemp + 1
            End If
        Next i

        If filaTemp > 4 Then
            With wsTemp.Range("A3:K" & (filaTemp - 1)).Borders
                .LineStyle = xlContinuous
                .Weight = xlThin
            End With
        End If

        wsTemp.Cells(filaTemp + 2, 2).Value = "_______________________________"
        wsTemp.Cells(filaTemp + 3, 2).Value = "Firma Tecnico Cuadrilla"
        wsTemp.Cells(filaTemp + 3, 2).Font.Bold = True

        wsTemp.Cells(filaTemp + 2, 8).Value = "_______________________________"
        wsTemp.Cells(filaTemp + 3, 8).Value = "Firma Supervisor Central"
        wsTemp.Cells(filaTemp + 3, 8).Font.Bold = True

        With wsTemp.PageSetup
            .Orientation = xlLandscape
            .PaperSize = xlPaperLetter
            .Zoom = False
            .FitToPagesWide = 1
            .FitToPagesTall = False
            .LeftMargin = Application.InchesToPoints(0.3)
            .RightMargin = Application.InchesToPoints(0.3)
            .TopMargin = Application.InchesToPoints(0.4)
            .BottomMargin = Application.InchesToPoints(0.4)
        End With

        wsTemp.Columns.AutoFit

        nomArchPDF = rutaRaiz & "Despacho_" & Replace(CStr(key), " ", "_") & "_" & Format(Date, "YYYYMMDD") & ".pdf"
        wsTemp.ExportAsFixedFormat Type:=xlTypePDF, Filename:=nomArchPDF, Quality:=xlQualityStandard

        Application.DisplayAlerts = False
        wsTemp.Delete
        Application.DisplayAlerts = True
        cantExportados = cantExportados + 1
    Next key

    Mod_Utilidades.OptimizarEntorno False
    Mod_Utilidades.MostrarMensaje "Se han exportado " & cantExportados & " archivos PDF de despacho en la carpeta del proyecto:" & vbCrLf & _
           rutaRaiz, vbInformation, "CANTV - Exportacion PDF Exitosa"
    Exit Sub

ErrorHandler:
    On Error Resume Next
    Application.DisplayAlerts = False
    ThisWorkbook.Sheets("TEMP_PDF").Delete
    Mod_Utilidades.OptimizarEntorno False
    Mod_Utilidades.MostrarMensaje "Error exportando PDFs: " & Err.Description, vbCritical, "Error"
End Sub
'@
    $modDesp.CodeModule.AddFromString($codeDesp)
    Write-Output "Modulo Mod_Despacho inyectado."

    # 10.5 Mod_Panel (Opera sobre AVERIAS)
    $modPan = $vbproj.VBComponents.Add(1)
    $modPan.Name = "Mod_Panel"
    $codePan = @'
Option Explicit

Public Sub IrAGraficos()
    On Error Resume Next
    ThisWorkbook.Sheets("GRAFICOS").Activate
End Sub

Public Sub BuscarCaso()
    On Error GoTo ErrorHandler
    Dim wsPanel As Worksheet, wsAverias As Worksheet
    Dim criterio As String, ultFila As Long, i As Long
    Dim encontrado As Boolean

    Set wsPanel = ThisWorkbook.Sheets("PANEL")
    Set wsAverias = ThisWorkbook.Sheets("AVERIAS")

    criterio = UCase(Trim(CStr(wsPanel.Range("C9").Value)))
    If criterio = "" Then
        Mod_Utilidades.MostrarMensaje "Por favor ingrese un ID de Averia o Numero Telefonico en la celda C9.", vbExclamation, "Criterio Vacio"
        Exit Sub
    End If

    ultFila = wsAverias.Cells(wsAverias.Rows.Count, "A").End(xlUp).Row
    encontrado = False

    For i = 2 To ultFila
        Dim idCaso As String, tlfCaso As String
        idCaso = UCase(Trim(CStr(wsAverias.Cells(i, 1).Value)))
        tlfCaso = UCase(Trim(CStr(wsAverias.Cells(i, 2).Value)))

        If idCaso = criterio Or tlfCaso = criterio Then
            wsPanel.Range("C11").Value = wsAverias.Cells(i, 1).Value
            wsPanel.Range("C12").Value = wsAverias.Cells(i, 2).Value
            wsPanel.Range("C13").Value = wsAverias.Cells(i, 3).Value
            wsPanel.Range("C14").Value = wsAverias.Cells(i, 4).Value
            wsPanel.Range("C15").Value = wsAverias.Cells(i, 6).Value
            wsPanel.Range("C16").Value = wsAverias.Cells(i, 5).Value
            wsPanel.Range("C17").Value = wsAverias.Cells(i, 7).Value & " / " & wsAverias.Cells(i, 8).Value
            wsPanel.Range("C18").Value = wsAverias.Cells(i, 16).Value

            wsPanel.Range("F11").Value = wsAverias.Cells(i, 9).Value
            wsPanel.Range("F12").Value = wsAverias.Cells(i, 10).Value
            wsPanel.Range("F13").Value = wsAverias.Cells(i, 19).Value & " / " & wsAverias.Cells(i, 22).Value
            wsPanel.Range("F14").Value = wsAverias.Cells(i, 21).Value
            wsPanel.Range("F15").Value = wsAverias.Cells(i, 11).Value
            wsPanel.Range("F16").Value = wsAverias.Cells(i, 17).Value

            wsPanel.Range("C21").Value = wsAverias.Cells(i, 9).Value
            encontrado = True
            Exit For
        End If
    Next i

    If Not encontrado Then
        Mod_Utilidades.MostrarMensaje "No se encontro ningun caso con el identificador o telefono: " & criterio, vbInformation, "Caso No Encontrado"
    End If
    Exit Sub

ErrorHandler:
    Mod_Utilidades.MostrarMensaje "Error en busqueda: " & Err.Description, vbCritical, "Error"
End Sub

Public Sub ActualizarCaso()
    On Error GoTo ErrorHandler
    Dim wsPanel As Worksheet, wsAverias As Worksheet
    Dim idBuscado As String, ultFila As Long, i As Long
    Dim actualizado As Boolean

    Set wsPanel = ThisWorkbook.Sheets("PANEL")
    Set wsAverias = ThisWorkbook.Sheets("AVERIAS")

    idBuscado = Trim(CStr(wsPanel.Range("C11").Value))
    If idBuscado = "" Then
        Mod_Utilidades.MostrarMensaje "Primero busque un caso para poder actualizar su resolucion.", vbExclamation, "Aviso"
        Exit Sub
    End If

    ultFila = wsAverias.Cells(wsAverias.Rows.Count, "A").End(xlUp).Row
    actualizado = False

    For i = 2 To ultFila
        If Trim(CStr(wsAverias.Cells(i, 1).Value)) = idBuscado Then
            wsAverias.Cells(i, 9).Value = wsPanel.Range("C21").Value
            wsAverias.Cells(i, 26).Value = wsPanel.Range("C22").Value
            wsAverias.Cells(i, 27).Value = wsPanel.Range("C23").Value
            If wsPanel.Range("C21").Value = "Resuelto" Then
                wsAverias.Cells(i, 25).Value = Date
            End If
            wsPanel.Range("F11").Value = wsPanel.Range("C21").Value
            actualizado = True
            Exit For
        End If
    Next i

    If actualizado Then
        Mod_Actualizacion.SincronizarVistasEspeciales
        Mod_Utilidades.MostrarMensaje "Caso " & idBuscado & " actualizado exitosamente.", vbInformation, "Actualizacion Exitosa"
    End If
    Exit Sub

ErrorHandler:
    Mod_Utilidades.MostrarMensaje "Error al actualizar: " & Err.Description, vbCritical, "Error"
End Sub

Public Sub RegistrarCasoManual()
    On Error GoTo ErrorHandler
    Dim wsPanel As Worksheet, wsAverias As Worksheet
    Dim ultFila As Long, nuevoId As String

    Set wsPanel = ThisWorkbook.Sheets("PANEL")
    Set wsAverias = ThisWorkbook.Sheets("AVERIAS")

    If Trim(CStr(wsPanel.Range("J9").Value)) = "" Or Trim(CStr(wsPanel.Range("J10").Value)) = "" Then
        Mod_Utilidades.MostrarMensaje "Por favor complete al menos el Telefono y Nombre del Suscriptor.", vbExclamation, "Datos Incompletos"
        Exit Sub
    End If

    Randomize
    nuevoId = "MAN-" & Format(Date, "YYYYMMDD") & "-" & Format(Int(Rnd() * 8999 + 1000), "0000")

    ultFila = wsAverias.Cells(wsAverias.Rows.Count, "A").End(xlUp).Row + 1
    wsAverias.Cells(ultFila, 1).Value = nuevoId
    wsAverias.Cells(ultFila, 2).Value = "'" & Trim(CStr(wsPanel.Range("J9").Value))
    wsAverias.Cells(ultFila, 3).Value = Trim(CStr(wsPanel.Range("J10").Value))
    wsAverias.Cells(ultFila, 4).Value = "'" & Trim(CStr(wsPanel.Range("J11").Value))
    wsAverias.Cells(ultFila, 6).Value = Trim(CStr(wsPanel.Range("J12").Value))
    wsAverias.Cells(ultFila, 5).Value = Trim(CStr(wsPanel.Range("J13").Value))
    wsAverias.Cells(ultFila, 7).Value = Trim(CStr(wsPanel.Range("J14").Value))
    wsAverias.Cells(ultFila, 8).Value = Trim(CStr(wsPanel.Range("J15").Value))
    wsAverias.Cells(ultFila, 9).Value = "Pendiente"
    wsAverias.Cells(ultFila, 11).Value = Date
    wsAverias.Cells(ultFila, 15).Value = "Normal"
    wsAverias.Cells(ultFila, 16).Value = Trim(CStr(wsPanel.Range("J16").Value))
    wsAverias.Cells(ultFila, 28).Value = Trim(CStr(wsPanel.Range("J17").Value))

    Mod_Actualizacion.SincronizarVistasEspeciales

    Mod_Utilidades.MostrarMensaje "Caso manual registrado satisfactoriamente con el ID: " & nuevoId, vbInformation, "Registro Exitoso"

    wsPanel.Range("J9").Value = ""
    wsPanel.Range("J10").Value = ""
    wsPanel.Range("J11").Value = ""
    wsPanel.Range("J13").Value = ""
    wsPanel.Range("J16").Value = ""
    Exit Sub

ErrorHandler:
    Mod_Utilidades.MostrarMensaje "Error registrando caso manual: " & Err.Description, vbCritical, "Error"
End Sub
'@
    $modPan.CodeModule.AddFromString($codePan)
    Write-Output "Modulo Mod_Panel inyectado."

    # Guardar libro .xlsm
    Write-Output "Guardando libro en formato .xlsm..."
    $wb.SaveAs($TargetFile, 52)
    Write-Output "Libro guardado exitosamente en: $TargetFile"

} catch {
    Write-Output ("ERROR: " + $_.Exception.Message)
    Write-Output ("ERROR_LINE: " + $_.InvocationInfo.ScriptLineNumber)
    Write-Output ("ERROR_LINE_TEXT: " + $_.InvocationInfo.Line)
} finally {
    if ($wb) { $wb.Close($false) }
    $excel.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
    Write-Output "Instancia Excel cerrada."
}
