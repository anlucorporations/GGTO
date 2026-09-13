# Entornos Globales — GGTO-v1

- **Proyecto:** GGTO-v1 — Página HTML de gestión de averías (Central Francisco Salias, Área 4)
- **Fase:** 1 (Concepto) — documento vivo (los archivos servidos por HTTP viven en `app/`; ver §4)
- **Versión:** v1
- **Fecha:** 2026-09-12

---

## 1. Rutas del proyecto

| Elemento | Ruta |
|---|---|
| Raíz del proyecto (workspace) | `C:\GGTO\proyecto` — clon local desde GitHub (D-51); la copia en Google Drive quedó fuera de uso |
| Documentación técnica | `C:\GGTO\proyecto\RepoTecnico` |
| Página (a crear en C1) | `C:\GGTO\proyecto\app\index.html` |
| Hojas de estilo (a crear) | `...\app\css\estilos.css` |
| Módulos JavaScript (a crear) | `...\app\js\` |
| Datos de trabajo (fuera de Google Drive) | `C:\GGTO\datos\` — incluye `historial.jsonl` (historial inmutable *append-only*, D-56); respaldo **manual** a demanda del supervisor (D-36) |
| Librerías locales (a crear) | `...\app\lib\` |
| Lanzador del entorno (a crear) | `...\servir-ggto.ps1` |
| Metadata de git (fuera de Google Drive) | `C:\GGTO\git\GGTO-v1.git` (la raíz apunta con un archivo `.git` que contiene `gitdir:`) |

### 1.1 Estructura objetivo

```
GGTO-v1/
|- index.html
|- servir-ggto.ps1            # lanzador: servidor local + navegador
|- RepoTecnico/               # documentacion (Fase 1 en adelante)
|- css/
|  \- estilos.css
|- js/
|  |- app.js                  # arranque, pestanas, estado global
|  |- almacen.js              # lectura/escritura de JSON (File System Access API)
|  |- ingesta.js              # RF-16 a RF-19, RF-27
|  |- despacho.js             # RF-08, RF-09, RF-20
|  |- pdf.js                  # RF-10
|  |- metricas.js             # agregaciones del MONITOREO
|  |- graficos.js             # RF-06 (Chart.js)
|  |- casos.js                # tabla maestra + flotante
|  |- panel.js                # RF-02 a RF-04
|  |- gestion.js              # RF-15
|  |- configuracion.js        # RF-11 a RF-14, RF-27
|  \- reportes.js             # RF-25, RF-26
|- datos/
|  |- averias.json            # maestro (L56)
|  |- despacho.json           # vista de campo (L57)
|  |- estructura.json         # contrato del CSV (L58)
|  |- central.json            # RF-11
|  |- tecnicos.json           # RF-12
|  |- flota.json              # RF-13
|  |- cuadrillas.json         # RF-14
|  |- sectores.json           # D-03
|  |- claves_clasificacion.json  # D-11
|  \- historial.jsonl         # historial inmutable de cambios (append-only, D-56)
\- lib/
   |- papaparse.min.js
   |- chart.umd.min.js
   |- jspdf.umd.min.js
   \- jspdf.autotable.min.js
```

---

## 2. Stack y dependencias

| Componente | Elección | Motivo |
|---|---|---|
| Interfaz | HTML5 + CSS3 + JavaScript (ES2020), sin framework | RNF-03: página autónoma, sin build ni instalación. |
| Lectura de CSV | PapaParse (local en `lib/`) | Maneja comillas, comas y BOM; funciona offline (RT-07). |
| Gráficos | Chart.js (local) | Barras, línea y torta para MONITOREO y GRAFICOS (RF-05, RF-06). |
| PDF | jsPDF + jspdf-autotable (local) | Despacho por cuadrilla en carta horizontal (RF-10, RNF-05). |
| Persistencia | File System Access API (`showOpenFilePicker` / `showSaveFilePicker`, o `showDirectoryPicker`) | Permite leer y **escribir** los JSON del disco (D-01, RT-06). |
| Respaldo de persistencia | Descarga manual del JSON actualizado + `<input type="file">` | Para navegadores sin File System Access API. |
| Servidor local | `python -m http.server` o `npx serve` | Evita las restricciones de `file://`; `http://localhost` es contexto seguro y habilita la API de archivos. |

**Versiones:** a fijar al descargar las librerías en el ciclo C1 (se registrarán aquí al quedar
fijadas). No se usan CDN: la central puede no tener internet (RT-07).

---

## 3. Navegador y requisitos del puesto de trabajo

| Requisito | Detalle |
|---|---|
| Navegador | Microsoft Edge o Google Chrome actualizado (Chromium ≥ 86 para File System Access API). |
| Limitación conocida | Firefox y Safari no soportan File System Access API: en ellos la página funcionaría en modo descarga (Opción B de la propuesta). |
| Resolución mínima | 1366 × 768; la tabla de CASOS y las grillas de MONITOREO se diseñan para 1440 × 900. |
| Impresión | Impresora con papel carta; el PDF de despacho se genera en orientación horizontal. |
| Otros | Python 3.7+ o Node.js (solo para levantar el servidor local). |

---

## 4. Lanzador del entorno local (`servir-ggto.ps1`)

```powershell
# servir-ggto.ps1 — levanta el servidor local de la pagina GGTO y abre el navegador
$puerto = 8787
$raiz   = Split-Path -Parent $MyInvocation.MyCommand.Definition
$app    = Join-Path $raiz "app"   # solo la aplicacion; datos/ queda fuera del alcance HTTP

Write-Host "Sirviendo $app en http://localhost:$puerto (solo loopback) ..."
Start-Process "http://localhost:$puerto/index.html"

# Opcion A: Python — bind a loopback y sin exponer datos/
python -m http.server $puerto --bind 127.0.0.1 --directory $app

# Opcion B (si no hay Python): Node.js
# npx --yes serve -l $puerto $raiz
```

Alternativa en lote (`servir-ggto.bat`):

```bat
@echo off
cd /d "%~dp0"
start "" http://localhost:8787/index.html
python -m http.server 8787 --bind 127.0.0.1 --directory app
```

**Nota importante:** la página debe abrirse siempre desde `http://localhost:8787`, nunca con
doble clic sobre `index.html` (`file://`), porque en `file://` el navegador bloquea la lectura
de los JSON y la API de archivos (RT-06).

**Seguridad (H-01 de la auditoría):** servir la raíz del proyecto exponía `datos/averias.json` por
HTTP. Por eso el lanzador usa `--bind 127.0.0.1` (solo escucha en el propio equipo) y
`--directory app`, de modo que los archivos servidos son únicamente los de la aplicación. En
consecuencia, `index.html`, `css/`, `js/` y `lib/` deben vivir dentro de `app/`, y `datos/`
permanece en la raíz del proyecto: la página accede a los JSON con el selector de archivos (File
System Access API), no por HTTP.

### 4.1 Carpeta de datos y copia de respaldo

| Elemento | Ruta | Requisito |
|---|---|---|
| Carpeta de datos de trabajo | `C:\GGTO\datos\` — los 9 JSON de trabajo **más** `historial.jsonl` | D-19, RT-01, RT-10 |
| Historial inmutable de cambios | `C:\GGTO\datos\historial.jsonl` (JSON Lines, *append-only*: no se edita ni se borra) | **D-56**, RNF-09 |
| Carpeta de respaldo | `C:\GGTO\respaldo\` — copia fechada del maestro **y del historial** al cierre de la jornada, sin cifrado | D-49, RNF-16 |

**Procedimiento de respaldo (D-36, D-49, D-56).**

1. El supervisor abre el bloque RESPALDO y consulta la fecha del último respaldo.
2. Pulsa *Respaldar ahora* (manual, a demanda).
3. La página copia a `C:\GGTO\respaldo\` los archivos de `C:\GGTO\datos\`: los 9 JSON de trabajo
   (`averias.json`, `despacho.json`, `estructura.json` y los 6 de configuración) **y el historial
   `historial.jsonl`**, que **se copia junto con el maestro y nunca se recorta** (no se trunca, no
   se filtra por fecha y no se reescribe: se copia íntegro, D-56).
4. La página relee cada copia y la compara con el original; muestra «Respaldo verificado: 10 archivos».
5. Al cierre de la jornada se ofrece la copia fechada `averias_AAAA-MM-DD_HHMM.json`; el supervisor
   la lleva a la red o a un pen drive.

---

## 5. Constantes y variables globales del front-end

| Constante | Valor | Uso |
|---|---|---|
| `RUTA_DATOS` | `C:\GGTO\datos\` | Carpeta de los 9 JSON de trabajo y de `historial.jsonl` (D-19, D-56). |
| `ARCHIVO_MAESTRO` | `averias.json` | Maestro de casos (D-09). |
| `ARCHIVO_DESPACHO` | `despacho.json` | Vista de campo. |
| `ARCHIVO_ESTRUCTURA` | `estructura.json` | Contrato del CSV. |
| `ARCHIVO_HISTORIAL` | `historial.jsonl` | Historial inmutable de cambios, *append-only* (D-56): se lee para la auditoría de CU-15 y se escribe solo añadiendo. |
| `ACCIONES_HISTORIAL` | `edicion` \| `cierre` \| `reapertura` \| `asignacion` \| `ingesta` | Valor de `accion` de cada línea del historial (D-56). |
| `FORMATO_FECHA` | `DD/MM/AAAA` | Todas las fechas (RNF-06). |
| `DIAS_SEMANA_OPERATIVA` | lunes … sábado | Cortes del MONITOREO (RN-08). |
| `STATUS` | `PEND` \| `CERRADO` \| `GESTION` | Enumerado de estatus. |
| `RESOLUCION` | `IVR` \| `COS` \| `COLA` | Enumerado de resolución. |
| `CLASE` | `REP` \| `CNS` | Reparación / construcción. |
| `NIVEL` | `COM` \| `REF` | Común / referido. |
| `SACAS` | `SI` \| `NO` | Indicador de cierre. |
| `COLUMNAS_TABLA` | `nivel, clase, sector, id_averia, nombre, direccion, plan` | Tabla resumen (RF-21). |
| `COLUMNAS_DESPACHO` | `id_averia, telefono, persona_reporta, contacto, nombre, direccion, fat, plan, serial` | Extracción del despacho (RF-20). |
| `PUERTO_LOCAL` | `8787` | Puerto del servidor local. |

---

## 6. Comandos útiles

| Acción | Comando |
|---|---|
| Levantar el entorno | `pwsh -File .\servir-ggto.ps1` |
| Verificar el puerto | `Get-NetTCPConnection -LocalPort 8787 -ErrorAction SilentlyContinue` |
| Copiar un archivo al proyecto (evita el fallo de escritura de G:) | `Copy-Item <origen> "<destino>" -Force` |
| Listar el estado de la documentación | `Get-ChildItem RepoTecnico` |

---

## 7. Repositorios remotos

| Repositorio | URL | Ramas |
|---|---|---|
| GitHub (`origin`) | https://github.com/anlucorporations/GGTO.git | `main` (estable) y `GGTOv1-DSH` (desarrollo) |
| GitLab (`gitlab`) | https://gitlab.com/anlucorporations/ggto.git | `main` (estable) y `GGTOv1-DSH` (desarrollo) |

Regla del proyecto: **no se hace push ni pull sin orden explícita del usuario.**

### 7.1 Ubicación del directorio git

El repositorio de trabajo es el clon local **`C:\GGTO\proyecto`** (con su `.git` en `C:\GGTO\proyecto\.git`). El directorio anterior, `C:\GGTO\git\GGTO-v1.git`, queda como respaldo del historial previo; la raíz antigua en Google Drive ya no se usa y
proyecto apunta a él con un archivo `.git` que contiene `gitdir: C:/GGTO/git/GGTO-v1.git`.

**Motivo (D-22):** Google Drive inyectó 75 archivos `desktop.ini` dentro de `.git` —incluido
`.git\refs\desktop.ini`— y rompió la resolución de referencias con
`fatal: bad object refs/desktop.ini`, lo que hizo fallar `git fetch`. Con el metadata fuera de la
unidad sincronizada el problema no puede repetirse; además se reforzaron las exclusiones en
`.git\info\exclude`. No se perdió ningún commit.

---

## 8. GCP / entorno de preview

| Aspecto | Estado |
|---|---|
| Uso de GCP | **No aplica:** ejecución local en la central. |
| `project_id` | *pendiente* |
| Credenciales | *pendiente* |
| Tipo de servicio | *pendiente* (una opción natural sería un bucket de Cloud Storage con sitio estático, o servirla en la red interna de la central). |

---

## 9. Notas del entorno real (host)

- El workspace vive en una unidad sincronizada de Google Drive (`G:`), por lo que:
  - la escritura "atómica" de algunos editores (que crea un enlace duro temporal y luego
    renombra) falla con `EISDIR` / `SetFileSecurityW EIO`; el camino confiable es escribir en una
    ruta local (`%TEMP%`) y **copiar** el archivo al destino;
  - la sincronización puede retrasar la aparición de cambios hechos por otros equipos.
- Existe `RepoTecnico\desktop.ini` (metadatos de la carpeta; no debe procesarse como documentación).
- En `RepoTecnico\` ya existen documentos y scripts previos (`BRIEF-GGTO-INICIAL.md`,
  `ARCHIVO-GGTO-INICIAL.md`, `SRS-GGTO-CANTV.md`, `crear_libro_cantv.ps1`, `run_tests.ps1`,
  `run_tests_averias.ps1`). En esta fase se analizó **únicamente** `PAGINA-GGTO-INICIAL.md` por
  indicación del usuario; los demás se revisarán cuando el usuario lo autorice.
- Codificación de trabajo: UTF-8 sin BOM para todos los archivos de datos y de código.

---

- **Incidente de cuota de Drive (13/09/2026):** la cuenta de Google Drive se llenó y el cliente del volumen `G:` rechazó toda escritura de 1 KB o más: dos archivos de documentación quedaron en 0 bytes al intentar copiarlos. Regla operativa: **no trabajar ni copiar archivos sobre `G:`**; el proyecto vive en `C:\GGTO\proyecto` y su copia compartida son los repositorios GitHub/GitLab (D-51).

## 10. Características del CSV diario de entrada (verificadas)

| Característica | Valor |
|---|---|
| Nombre típico | `detalle_averias_gpon DD_MM_AAAA.csv` (en la raíz del proyecto). |
| Separador | `;` (punto y coma) → configurar PapaParse con `delimiter: ';'`. |
| Codificación | UTF-8 (con acentos). |
| Encabezado | Una fila, 80 columnas; hay nombres repetidos (`informacion` ×2, `nombre` ×2, `descripcion` ×3), por lo que la lectura debe ser **posicional**. |
| Fechas | `DD/MM/AAAA hh:mm:ss a.m./p.m.` (incluyen hora). |
| Contenido | Mezcla varias centrales; el filtro por `region`, `estado geografico`, `capital estado geografico`, `municipio`, `parroquia`, `estado operativo`, `distrito`, `area`, `central` y `nombre central` (columnas 1-10) selecciona las de Francisco Salias. |
| Tamaño de muestra | 56 registros (51 de Francisco Salias) en el archivo del 12/09/2026. |

Archivo complementario `alta_manual.csv` (raíz, 42 columnas): registro manual de casos con ids
propios (`REF-REP-05`), `Sector` por nombre, campos de reincidencia («1ª Vez / Última Vez visto»)
e historial. Se usa como referencia de campos (A-17), no como entrada de la ingesta.

---
## 11. Pendientes de este documento

- Fijar versiones exactas de las librerías al descargarlas en C1.
- Registrar la URL de los repositorios remotos y la rama de trabajo.
- Definir el uso de GCP y, si aplica, credenciales y tipo de servicio.
- Confirmar en el puesto real de la central que Edge/Chrome están disponibles y que se autoriza
  un servidor local en el puerto 8787.

**Cerrado en este documento:** la carpeta `C:\GGTO\datos\` incluye `historial.jsonl` (historial
inmutable *append-only*, **D-56**) en el árbol de estructura (§1.1), en la tabla de rutas (§1) y en
la copia de respaldo (§4.1): el historial se copia junto con el maestro y **nunca se recorta**.

---

## 12. Ficha de tratamiento de datos personales (D-28, D-58)

Materializa la «finalidad documentada» que exige D-28 y la política acordada en D-58.

| Aspecto | Contenido |
|---|---|
| **Finalidad** | Gestión operativa de los reportes de avería de la central Francisco Salias (área 4): clasificar, despachar, reparar y cerrar casos, y medir la gestión diaria y semanal. Ningún otro uso. |
| **Responsable** | Supervisor de la central (rol único elevado, D-55), que administra accesos, respaldos y consultas de auditoría. |
| **Datos tratados** | De abonados: `nombre`, `telefono`, `persona_reporta`, `contacto`, `direccion` y `ultimo_comentario` (texto libre). De trabajadores: `nombre`, `cedula`, `P00`, `telefono`, `correo`. |
| **Origen** | El `.csv` diario que emite el área corporativa (`RT-02`). |
| **Controles de acceso** | Servidor local solo en loopback sirviendo únicamente `app/`; `datos/` fuera del alcance HTTP; sesión obligatoria con `P00` + contraseña (hash con sal, caducidad 90 días); sin sesión válida no se muestra ningún dato (D-50); permisos por rol (D-35, RNF-12). |
| **Trazabilidad** | `historial.jsonl` inmutable con cada cambio (D-56) y registro de intentos fallidos (D-57). |
| **Registro de accesos** | Los intentos fallidos de sesión y las acciones denegadas por permisos se anotan en el log de la aplicación (5 MB × 5 archivos), sin datos personales (D-57, D-58). |
| **Datos impresos** | El PDF de despacho lleva fecha, cuadrilla y número de copia; se registra la entrega y las hojas se recogen y destruyen al cierre del día (D-27, RNF-11). |
| **Respaldo** | Copia fechada del maestro y del historial en `C:\GGTO\respaldo\` al cerrar la jornada, sin cifrado, bajo custodia del supervisor (D-49); RTO 1 hora, RPO del día anterior. |
| **Paquete versionado** | Los CSV de entrada, los PDF de despacho y el `.xlsm` **siguen versionados** en los repositorios privados de GitHub y GitLab (D-36, D-58). Riesgo aceptado y declarado: son repositorios privados de la corporación; revisar con el área legal antes de dar acceso a terceros. |
| **Retención** | Casos: histórica, sin purga automática (D-28). CSV procesado: se conserva junto al caso. Log de aplicación: rotación por tamaño, 5 MB y 5 archivos (D-58), sin datos personales. |
| **Derechos del titular** | Canal único: el supervisor de la central, que localiza el caso por `id_averia` o teléfono y aplica la corrección dejando rastro en `historial.jsonl`. |
| **Revisión pendiente** | Confirmar con el área legal de CANTV la normativa aplicable y esta ficha antes de ampliar el uso de la página. |