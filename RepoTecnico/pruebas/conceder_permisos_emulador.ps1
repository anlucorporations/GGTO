# Concede los permisos de la APK en el emulador en cuanto se instala.
#
# `flutter test integration_test/…` instala de nuevo la app en cada corrida y los
# permisos en tiempo de ejecución vuelven a "preguntar"; el diálogo del sistema
# no forma parte del árbol de Flutter y la prueba se quedaría esperando. Este
# bucle concede ubicación, cámara y notificaciones en cuanto el paquete aparece.
param(
    [int] $Minutos = 25,
    [string] $Paquete = 'com.example.ggto_tecnico'
)

$sdk = "$env:LOCALAPPDATA\Android\Sdk"
$adb = "$sdk\platform-tools\adb.exe"
$permisos = @(
    'android.permission.ACCESS_FINE_LOCATION',
    'android.permission.ACCESS_COARSE_LOCATION',
    'android.permission.CAMERA',
    'android.permission.POST_NOTIFICATIONS'
)

$fin = (Get-Date).AddMinutes($Minutos)
$ultimoAviso = $null
while ((Get-Date) -lt $fin) {
    $instalado = (& $adb shell pm list packages 2>$null) -match [regex]::Escape($Paquete)
    if ($instalado) {
        # Se concede en CADA vuelta a propósito: `flutter test` reinstala la app en
        # cada corrida y eso devuelve los permisos a «preguntar».
        foreach ($permiso in $permisos) {
            & $adb shell pm grant $Paquete $permiso 2>$null | Out-Null
        }
        $estado = (& $adb shell dumpsys package $Paquete 2>$null | Select-String -Pattern 'ACCESS_FINE_LOCATION: granted=true')
        if ($estado -and $ultimoAviso -ne 'ok') {
            Write-Output ("{0} permisos concedidos a {1}" -f (Get-Date -Format 'HH:mm:ss'), $Paquete)
            $ultimoAviso = 'ok'
        } elseif (-not $estado) {
            $ultimoAviso = $null
        }
        $ubicacion = & $adb shell dumpsys location 2>$null | Select-String -Pattern 'gps provider: enabled' -SimpleMatch
        if (-not $ubicacion) {
            & $adb emu geo fix -66.9036 10.4806 2>$null | Out-Null
        }
    }
    Start-Sleep -Seconds 2
}
Write-Output 'bucle de permisos terminado'
