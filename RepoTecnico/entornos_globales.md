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
| Página | `C:\GGTO\proyecto\app\index.html` |
| Hojas de estilo | `...\app\css\estilos.css` |
| Módulos JavaScript (16 archivos `.js`) | `...\app\js\` |
| Datos de trabajo (fuera de Google Drive) | `C:\GGTO\datos\` — incluye `historial.jsonl` (historial inmutable *append-only*, D-56) y `incidencias.log` (log de accesos con rotación 5 MB × 5 archivos, D-58, **D-64**); respaldo **manual** a demanda del supervisor (D-36) |
| CSV de ingesta (el del día) | `C:\GGTO\datos\detalle_averias_gpon DD_MM_YYYY.csv` — **única** carpeta donde se buscan los `.csv` de ingesta (**D-78**); el operador lo elige desde ahí con el selector de INGESTA. El almacén ignora lo que no sea uno de los 10 archivos de trabajo, así que el `.csv` no entra en la copia de cierre |
| Ruta controlada de los PDF de despacho | `C:\GGTO\despachos\` — carpeta autorizada aparte, **nunca** la carpeta de Descargas (**D-67**, D-27); ver §4.3 |
| Librerías locales | `...\app\lib\` (Chart.js 4.4.7 y jsPDF 2.5.2, RT-07) |
| Lanzador de la jornada | `...\GGTO.bat` (doble clic) + `...\GGTO.ps1` (**D-77**); ver §4.5 |
| Lanzador del entorno | `...\servir-ggto.ps1` (servidor local) y `...\servir-ggto.bat` (alternativa mínima con Python) |
| Metadata de git (fuera de Google Drive) | `C:\GGTO\proyecto\.git` (directorio de git del proyecto; el antiguo `C:\GGTO\git\GGTO-v1.git` se conserva como copia histórica) |

### 1.1 Estructura del proyecto (entregada)

```
GGTO-v1/
|- GGTO.bat                   # LANZADOR DE LA JORNADA (doble clic; D-77)
|- GGTO.ps1                   # despliegue + rutina diaria + servidor (D-77)
|- servir-ggto.ps1            # servidor local + navegador (uso directo)
|- servir-ggto.bat            # alternativa minima con Python
|- README.md
|- RepoTecnico/               # documentacion (Fase 1 en adelante)
|- pruebas/                   # 12 baterias de modulos y contratos + interfaz.mjs (E2E)
|  |- fixtures/               # muestra anonimizada del CSV (D-71)
|  \- herramientas/           # anonimizador del CSV
\- app/                       # lo unico que se publica por HTTP
   |- index.html
   |- css/
   |  \- estilos.css
   |- lib/
   |  |- chart.umd.min.js     # Chart.js 4.4.7 (RT-07)
   |  \- jspdf.umd.min.js     # jsPDF 2.5.2 (RT-07); el parser del CSV es propio (sin PapaParse)
   \- js/                     # 14 modulos + 2 nucleos puros = 16 archivos
      |- app.js               # arranque, pestanas, estado global
      |- nucleo.js            # reglas y utilidades de dominio (nucleo puro)
      |- almacen.js           # lectura/escritura de JSON (File System Access API)
      |- ingesta_nucleo.js    # parser posicional del CSV y clasificacion (nucleo puro)
      |- ingesta.js           # RF-16 a RF-19, RF-27
      |- despacho.js          # RF-08, RF-09, RF-20
      |- pdf.js               # RF-10
      |- metricas.js          # MONITOREO (TABLERO + sub-pestana REPORTES)
      |- graficos.js          # RF-06 (Chart.js)
      |- casos.js             # tabla maestra + flotante
      |- panel.js             # RF-02 a RF-04 (+ bloque INGESTA, D-70)
      |- gestion.js           # RF-15
      |- configuracion.js     # RF-11 a RF-14, RF-27 (+ RESPALDO y ENTORNO)
      |- reportes.js          # CU-19, CU-20 (sub-pestana de MONITOREO, D-76)
      |- respaldo.js          # CU-21: bloque RESPALDO (copia de cierre y restauracion)
      \- entorno.js           # CU-22: bloque ENTORNO (diagnostico y contingencia)
```

Las rutas de datos **no** viven dentro del proyecto: los 10 archivos de trabajo están en
`C:\GGTO\datos`, la copia de cierre en `C:\GGTO\respaldo` y los PDF emitidos en `C:\GGTO\despachos`
(§4.1 y §4.3).

---

## 2. Stack y dependencias

| Componente | Elección | Motivo |
|---|---|---|
| Interfaz | HTML5 + CSS3 + JavaScript (ES2020), sin framework | RNF-03: página autónoma, sin build ni instalación. |
| Lectura de CSV | **Parser posicional propio** (`ingesta_nucleo.js`), sin librería | Respeta comillas dobles y el escape `""`, quita el BOM y usa `;` como separador; funciona offline (RT-07, RT-08). **PapaParse no se usa** (RN-10). |
| Gráficos | Chart.js **4.4.7** (local en `lib/`) | Barras, línea y torta para MONITOREO y GRAFICOS (RF-05, RF-06). |
| PDF | jsPDF **2.5.2** (local), sin autoTable | Despacho por cuadrilla en carta horizontal; la tabla se dibuja con `rect`/`text` (RF-10, RNF-05). |
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

### 4.2 Log de accesos y su rotación (`incidencias.log`, D-57, D-58, D-64)

`C:\GGTO\datos\incidencias.log` es el **log de la aplicación**: registra los **intentos fallidos de
sesión** y las **acciones denegadas por el rol**, con **fecha y hora, `P00` intentado y motivo**, y
**sin datos personales** (ni contraseña, ni hash, ni datos del abonado). La cuenta **no se bloquea**
por acumular intentos fallidos (D-57): el log es la única constancia. No confundirlo con
`historial.jsonl`, que es *append-only* y **solo** registra cambios de campos de un caso (D-56).

**Regla de rotación (D-64): 5 MB × 5 archivos.** Se conservan el archivo vigente **más cinco copias
rotadas**:

| Archivo | Contenido |
|---|---|
| `incidencias.log` | Log vigente; aquí se escribe siempre |
| `incidencias.1.log` | Rotación más reciente (el log que se desbordó) |
| `incidencias.2.log` … `incidencias.5.log` | Rotaciones anteriores, de más nueva a más antigua |
| *(descartado)* | El `incidencias.5.log` previo se elimina al rotar |

**Procedimiento (lo ejecuta la página antes de cada escritura del log).**

1. Se compone la línea del evento: `DD/MM/AAAA hh:mm | tipo | detalle | p00=<P00 intentado> | motivo`,
   sin datos personales (D-58).
2. Se mide el tamaño de `C:\GGTO\datos\incidencias.log`.
3. Si **no supera 5 MB** (5 × 1024 × 1024 = **5.242.880 bytes**), se añade la línea al final del log
   vigente y termina.
4. Si **supera 5 MB**, se aplica la cascada **de mayor a menor** para no pisar archivos:
   `incidencias.4.log` → `incidencias.5.log`, `incidencias.3.log` → `incidencias.4.log`,
   `incidencias.2.log` → `incidencias.3.log`, `incidencias.1.log` → `incidencias.2.log`; y se
   **descarta** (`removeEntry`) el `incidencias.5.log` anterior.
5. `incidencias.log` → `incidencias.1.log` y se escribe la línea nueva en un `incidencias.log`
   recién iniciado.
6. Si la rotación falla, **no se interrumpe la operación**: el log nunca bloquea la sesión ni el
   guardado (mismo criterio que D-46).

**Comprobación en el puesto.** `Get-ChildItem C:\GGTO\datos\incidencias*.log | Select-Object Name, Length`
debe mostrar como máximo seis archivos (`incidencias.log` y `incidencias.1.log` a `incidencias.5.log`)

> Si incidencias.log no existe todavía, la aplicación lo crea con el primer evento (intento fallido o acción denegada) y **no rota nada**, porque el tamaño medido es 0.
y ninguno de ellos superar los 5 MB. La lógica del plan de rotación es pura
(`nucleo.js`: `planRotacionLog`, `nombreIncidencias`, `indiceIncidencias`) y su aplicación al disco
vive en `almacen.js` (`rotarLogIncidencias`); la prueba con el límite parametrizado está en
`pruebas/pruebas_c1b.mjs`.

---

### 4.3 Ruta controlada de los PDF del despacho (`C:\GGTO\despachos`, D-67)

Los PDF del despacho llevan datos personales del abonado, así que **no pueden quedar en la carpeta de
Descargas del puesto** (D-27). La página los escribe en una **ruta controlada**, que es una carpeta
autorizada **aparte** de `datos/` y de `respaldo/` (el navegador concede cada carpeta por separado).

| Elemento | Ruta | Requisito |
|---|---|---|
| Ruta controlada de salidas | `C:\GGTO\despachos\` | **D-67**, D-27, RNF-11 |

**Procedimiento (lo ejecuta la página).**

1. El supervisor autoriza la carpeta una vez con *Autorizar carpeta `C:\GGTO\despachos`* (vista
   DESPACHO). Sin esa autorización la página **avisa** y el PDF se **descarga**, dejando constancia en
   el log de que salió de la ruta controlada.
2. Nombre del archivo: `Despacho_Cuadrilla_<id>_AAAAMMDD.pdf`. Las **reemisiones del mismo día**
   añaden el sufijo `_r2`, `_r3`… para **conservar la versión anterior** (CU-17, flujo 6a).
3. Tras escribir, la página **relee el archivo y compara tamaño y suma de control**: si no coincide,
   no lo da por bueno.
4. El registro de entrega (a quién se entregó) y la ruta del archivo van al log de la aplicación
   (`datos/incidencias.log`, D-27, D-58).
5. Las hojas impresas se **recogen y destruyen al cierre del día** bajo custodia del supervisor.

**Comprobación en el puesto.** `Get-ChildItem C:\GGTO\despachos\*.pdf | Select-Object Name, Length`
debe listar los PDF del día, y la carpeta de Descargas del usuario **no** debe contener
`Despacho_Cuadrilla_*.pdf`.

### 4.4 Control documental del despacho (D-68)

El control de **entrega, recogida y destrucción** de las hojas del despacho (D-27) **no se persiste**:
vive en la **sesión** de la página y **no ocupa ningún archivo** de `C:\GGTO\datos\` —la copia de cierre
de §4.1 sigue siendo de **10 archivos**—. Cada acción deja su **asiento en `datos/incidencias.log`**
(fecha, hora, cuadrilla, copias, hojas y `P00`), y el **soporte oficial del día es la hoja impresa y el
`.xlsm`**, que el supervisor custodia y destruye.

| Acción | Asiento en el log |
|---|---|
| Entrega de una hoja | `despacho \| ENTREGA HOJA \| <fecha> \| cuadrilla=… \| copias=… \| receptor=… \| p00=…` |
| Recogida de las hojas | `despacho \| RECOGIDA HOJA \| <fecha> \| cuadrilla=… \| hojas=… \| p00=…` |
| Destrucción | `despacho \| DESTRUCCION HOJA \| <fecha> \| cuadrilla=… \| hojas=N de M \| p00=…` |
| Falta justificada | `despacho \| FALTA HOJA JUSTIFICADA \| <fecha> \| cuadrilla=… \| p00=…` |
| Cierre del día | `despacho \| CONTROL DOCUMENTAL CERRADO \| <fecha> \| cuadrillas=N \| p00=…` |

**Consecuencia asumida:** si la página se recarga a mitad de jornada, el control vuelve a
«Pendiente de entrega»; la constancia son los asientos del log y el papel. Los asientos **no** llevan
datos personales del abonado (D-58).

### 4.5 Lanzador de la jornada (`GGTO.bat` + `GGTO.ps1`, D-77)

Es el **punto de entrada del operador**: doble clic en `GGTO.bat` (raíz del proyecto). `GGTO.bat` es
solo el envoltorio: busca PowerShell 7 y, si no está, usa Windows PowerShell 5.1 —el que trae Windows—
y llama a `GGTO.ps1`. No necesita instalación, no usa CDN y no deja nada fuera del equipo.

```bat
GGTO.bat                 :: jornada: despliegue + CSV del dia + rutina + servidor y navegador
GGTO.bat desplegar       :: solo el despliegue (carpetas y los 10 archivos de trabajo)
GGTO.bat abrir           :: solo el servidor local
GGTO.bat pruebas         :: 150 pruebas de modulos y contratos + 58 comprobaciones E2E
GGTO.bat cierre          :: rutina de cierre del dia y apertura de las carpetas de salida
GGTO.bat estado          :: diagnostico del puesto, de los datos y de la copia de cierre
GGTO.bat ayuda
:: opciones:  -Puerto 8787   -SinNavegador
```

**Qué hace el despliegue** (idempotente: solo crea lo que falta y nunca sobrescribe):

| Paso | Comprobación |
|---|---|
| Aplicación | `app\index.html`, `app\css`, **16** archivos `.js` en `app\js` y **2** librerías en `app\lib` (RT-07). Si el recuento no cuadra, avisa |
| Runtime | Python 3.7+ y/o Node.js: sin uno de los dos no hay servidor local y la página no puede leer ni escribir los JSON (RT-06) |
| Carpetas | Crea `C:\GGTO\datos`, `C:\GGTO\respaldo` y `C:\GGTO\despachos` si faltan (el selector de carpetas del navegador no puede elegir una carpeta inexistente) |
| Archivos de trabajo | Siembra desde `app\js\nucleo.js` (`estructurasIniciales()`) los que falten y **valida** los que ya existen (JSON legible e `historial.jsonl` línea a línea) |
| Contrato del CSV | Comprueba que `estructura.json` sea la **v2**: 80 columnas, 25 campos con `cabecera` y `no_se_persisten = [18, 30, 53, 80]`. Si no, avisa de que la ingesta abortará (D-44, D-69) |
| CSV del día | Lista los `.csv` de **`C:\GGTO\datos` y solo de ahí** (señalando el del día, `detalle_averias_gpon DD_MM_YYYY.csv`) y avisa si no hay ninguno o si el que hay no es el de hoy. **No** busca en el proyecto, en Descargas ni en el Escritorio: son datos de abonados (**D-78**). El archivo se elige en la página, desde esa misma carpeta, con el selector de INGESTA |

**Qué NO hace:** no hace copias de seguridad propias ni escribe en los archivos de trabajo. La copia de
cierre es la **verificada por relectura** de CONFIGURACION → RESPALDO (D-49, RNF-16), y el respaldo
sale del equipo por un acto manual del supervisor. El lanzador se limita a recordarlo y a abrir las
carpetas. Tampoco arranca el servidor antes de comprobar el despliegue: si falta el runtime, falla con
un mensaje claro en lugar de abrir una pestaña en error (RN-12 de la reauditoría).

**Códigos de salida:** `0` si el despliegue es correcto (y las pruebas pasan, en modo `pruebas`); `1` si
hay un error —una carpeta que no se pudo crear, un archivo ilegible o el contrato del CSV incompleto—.

---

## 5. Constantes y variables globales del front-end

| Constante | Valor | Uso |
|---|---|---|
| `RUTA_DATOS` | `C:\GGTO\datos\` | Carpeta de los 9 JSON de trabajo y de `historial.jsonl` (D-19, D-56). |
| `RUTA_DESPACHOS` | `C:\GGTO\despachos\` | **Ruta controlada** de los PDF del despacho; nunca la carpeta de Descargas (**D-67**, D-27). |
| `ARCHIVO_MAESTRO` | `averias.json` | Maestro de casos (D-09). |
| `ARCHIVO_DESPACHO` | `despacho.json` | Vista de campo. |
| `ARCHIVO_ESTRUCTURA` | `estructura.json` | Contrato del CSV. |
| `ARCHIVO_HISTORIAL` | `historial.jsonl` | Historial inmutable de cambios, *append-only* (D-56): se lee para la auditoría de CU-15 y se escribe solo añadiendo. |
| `ARCHIVO_INCIDENCIAS` | `incidencias.log` | Log de accesos: intentos fallidos de sesión y acciones denegadas por rol, sin datos personales (D-57, D-58, **D-64**). |
| `LOG_MAX_BYTES` | `5242880` (5 MB) | Tamaño a partir del cual `incidencias.log` rota a `incidencias.1.log` (**D-64**). |
| `LOG_MAX_ARCHIVOS` | `5` | Copias rotadas conservadas (`incidencias.1.log` … `incidencias.5.log`); la más antigua se descarta (**D-64**). |
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
| **Abrir la jornada (lo habitual)** | doble clic en `GGTO.bat` (o `GGTO.bat jornada` desde la consola) |
| Verificar el despliegue sin arrancar nada | `GGTO.bat desplegar` |
| Diagnóstico del puesto y de los datos | `GGTO.bat estado` |
| Ejecutar la batería completa | `GGTO.bat pruebas` |
| Levantar el entorno (uso directo) | `pwsh -File .\servir-ggto.ps1` |
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

El repositorio de trabajo es el clon local **`C:\GGTO\proyecto`**, con su metadata en
**`C:\GGTO\proyecto\.git`**, que es un **directorio** normal de git (verificado con
`git rev-parse --git-dir` → `.git`, y con `HEAD`, `objects/`, `refs/` dentro). El directorio anterior,
`C:\GGTO\git\GGTO-v1.git`, se conserva **solo como copia histórica** del repositorio previo; la raíz
antigua en Google Drive ya no se usa. *(La redacción anterior —«la raíz apunta a él con un archivo
`.git` que contiene `gitdir:`»— describía la disposición previa a la mudanza de D-51 y se corrigió el
14/09/2026 tras el hallazgo **R2-11** de la reauditoría.)*

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
| Nombre típico | `detalle_averias_gpon DD_MM_AAAA.csv`, en **`C:\GGTO\datos`** (única carpeta donde se busca, **D-78**). |
| Separador | `;` (punto y coma) → así lo espera el parser posicional propio de `ingesta_nucleo.js`. |
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

- ~~Fijar versiones exactas de las librerías al descargarlas en C1.~~ **Cerrado:** Chart.js 4.4.7 y
  jsPDF 2.5.2 en `app/lib/`; el parser del CSV es propio (sin PapaParse).
- ~~Registrar la URL de los repositorios remotos y la rama de trabajo.~~ **Cerrado:** GitHub
  `anlucorporations/GGTO` y GitLab `anlucorporations/ggto`, ramas `main` y `GGTOv1-DSH` (§7).
- ~~Definir el uso de GCP y, si aplica, credenciales y tipo de servicio.~~ **Cerrado:** no aplica
  (ejecución local en la central).
- **Confirmar en el puesto real de la central** que Edge/Chrome están disponibles y que se autoriza
  un servidor local en el puerto 8787. **Dueño: el Soporte TI del puesto** (RN-N-01 de la
  reauditoría), con evidencia anotada aquí: navegador y versión, Python 3.7+ o Node.js disponibles,
  puerto 8787 libre (o el alterno 8788–8807), impresora y política de ejecución de `.ps1`.

**Cerrado en este documento:** la carpeta `C:\GGTO\datos\` incluye `historial.jsonl` (historial
inmutable *append-only*, **D-56**) en el árbol de estructura (§1.1), en la tabla de rutas (§1) y en
la copia de respaldo (§4.1): el historial se copia junto con el maestro y **nunca se recorta**.
También queda cerrado el **log de accesos `incidencias.log`** (**D-64**): su ruta (§1 y §1.1), sus
constantes (§5), su contenido sin datos personales y su **procedimiento de rotación de 5 MB × 5
archivos** (§4.2), además de su papel en la ficha de tratamiento de datos personales (§12).
El log de accesos **no** entra en la copia de respaldo de §4.1: su retención es su propia rotación.

---

## 12. Ficha de tratamiento de datos personales (D-28, D-58)

Materializa la «finalidad documentada» que exige D-28 y la política acordada en D-58.

| Aspecto | Contenido |
|---|---|
| **Finalidad** | Gestión operativa de los reportes de avería de la central Francisco Salias (área 4): clasificar, despachar, reparar y cerrar casos, y medir la gestión diaria y semanal. Ningún otro uso. |
| **Responsable** | Supervisor de la central (rol único elevado, D-55), que administra accesos, respaldos y consultas de auditoría. |
| **Datos tratados** | De abonados: `nombre`, `telefono`, `persona_reporta`, `contacto`, `direccion` y `ultimo_comentario` (texto libre). De trabajadores: `nombre`, `cedula`, `P00`, `telefono`, `correo`. |
| **Origen** | El `.csv` diario que emite el área corporativa (`RT-02`). |
| **Ubicación del CSV** | **`C:\GGTO\datos` es la única carpeta donde vive y donde el lanzador lo busca** (**D-78**): no se busca en Descargas, ni en el Escritorio, ni en el proyecto. El `.csv` no entra en la copia de cierre (esa copia son los 10 archivos de trabajo) y no se versiona (**D-71**). |
| **Controles de acceso** | Servidor local solo en loopback sirviendo únicamente `app/`; `datos/` fuera del alcance HTTP; sesión obligatoria con `P00` + contraseña (hash con sal, caducidad 90 días); sin sesión válida no se muestra ningún dato (D-50); permisos por rol (D-35, RNF-12). |
| **Trazabilidad** | `historial.jsonl` inmutable con cada cambio (D-56) y registro de intentos fallidos (D-57). |
| **Registro de accesos** | Los intentos fallidos de sesión y las acciones denegadas por permisos se anotan en el log de la aplicación `C:\GGTO\datos\incidencias.log` (fecha y hora, `P00` intentado y motivo, **sin datos personales**), con rotación por tamaño de **5 MB × 5 archivos** (D-57, D-58, **D-64**; procedimiento en §4.2). |
| **Datos impresos** | El PDF de despacho lleva fecha, cuadrilla y número de copia; se registra la entrega y las hojas se recogen y destruyen al cierre del día (D-27, RNF-11). |
| **Respaldo** | Copia fechada del maestro y del historial en `C:\GGTO\respaldo\` al cerrar la jornada, sin cifrado, bajo custodia del supervisor (D-49); RTO 1 hora, RPO del día anterior. |
| **Paquete versionado** | **Los datos operativos reales NO se versionan (D-71).** El CSV diario, el registro manual (`alta_manual.csv`), los PDF de despacho y el `.xlsm` llevan datos personales de abonados y quedaron **fuera del control de versiones y purgados del historial** el 14/09/2026: los repositorios de GitHub y GitLab son **PÚBLICOS** (verificado contra sus APIs), de modo que el supuesto de «repositorios privados» de D-36/D-58 **no se cumple**. Lo que se versiona es una **muestra anonimizada** para las pruebas (`pruebas/fixtures/detalle_averias_gpon_muestra.csv`, regenerable con `pruebas/herramientas/anonimizar_csv.mjs`). |
| **Base de licitud** | **Pendiente de validación por el área legal de CANTV (RN-06, H-13).** Candidata declarada: **ejecución del contrato de servicio** con el abonado para la gestión de su avería. No está fijada por escrito, de modo que la ficha **no puede considerarse completa** hasta que el área legal la confirme o imponga otra. |
| **Plazo de conservación por categoría** | Casos del maestro (`averias.json`): **indefinido, sin purga automática** (D-28, riesgo aceptado por escrito). Historial (`historial.jsonl`): indefinido *append-only* (D-56). Log de la aplicación: **5 MB × 5 archivos** por rotación, sin datos personales (D-58, D-64). Respaldos: 10 versiones `.bak` del maestro (D-42) más la copia de cierre (D-49), sin purga automática. **Hojas impresas: se recogen y destruyen al cierre del día** (D-27). Datos de trabajadores: mientras dure el vínculo con la central. |
| **Dato que NO se registra** | El **nombre del receptor** de la hoja de despacho **no entra en el log** (D-73): vive solo en la hoja impresa y en el control documental de la sesión. |
| **Retención** | Casos: histórica, sin purga automática (D-28). CSV procesado: se conserva junto al caso. Log de aplicación: rotación por tamaño, 5 MB y 5 archivos (D-58), sin datos personales. |
| **Derechos del titular** | Canal único: el **supervisor de la central**, que localiza el caso por `id_averia` o teléfono y aplica la corrección dejando rastro en `historial.jsonl`. **Declarado con sus límites (RN-N-02):** cubre **acceso** y **rectificación**; la **supresión** no es posible sin borrar el rastro de auditoría, así que se atiende como **bloqueo del uso** y se documenta la negativa motivada; se exige **verificación de identidad** del solicitante (titular o su representante) y se fija un **plazo de respuesta de 10 días hábiles**, con constancia en el log de la aplicación. **Limitación reconocida:** en un puesto único, quien atiende la solicitud es también quien ejecuta el cambio; no hay separación de funciones. |
| **Notificación al abonado** | El CSV trae la columna 30 (`cliente_notificado`), que **no se persiste ni se usa** (D-53, **D-75**): el sistema **no notifica** al abonado, ni al abrir ni al cerrar el caso. La comunicación con el abonado es telefónica y la lleva la cuadrilla o el supervisor fuera del sistema. |
| **Revisión pendiente** | Confirmar con el área legal de CANTV la normativa aplicable, la **base de licitud** y esta ficha antes de ampliar el uso de la página. **Además:** la purga del 14/09/2026 (D-71) quitó los datos de los repositorios, pero GitHub y GitLab **fueron públicos** desde el 13/09/2026, así que la exposición anterior debe valorarse como incidente con el área legal. |