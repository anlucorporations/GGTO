# Guía de prueba manual — Ciclos C1 a C7 (GGTO-v1)

- **Proyecto:** GGTO-v1 — Página HTML de gestión de averías de la central Francisco Salias (Área 4).
- **Ubicación:** `C:\GGTO\proyecto`
- **Alcance de esta guía:** verificar a mano lo que las pruebas automatizadas no pueden cubrir (el selector
  de carpeta, la autorización de la carpeta de respaldo y el guardado real desde el navegador). Cubre los
  ciclos **C1 a C7**: armazón y configuración, ingesta, PANEL/GESTION, despacho y PDF, monitoreo y
  gráficos, reportes, y **respaldo y restauración**.

---

## 1. Antes de empezar

| Requisito | Comprobación |
|---|---|
| Navegador Edge o Chrome actualizado | La página usa la File System Access API; Firefox no la soporta (solo permitiría el modo descarga). |
| Python 3.7 o superior | `python --version`. Es lo que levanta el servidor local. |
| La carpeta de datos existe | `C:\GGTO\datos` con sus **10 archivos de trabajo** (los 9 JSON y `historial.jsonl`). Si falta, la propia página ofrece crearla. El directorio puede contener además respaldos `.bak` del maestro: no cuentan en esa lista y no entran en la copia de cierre. |

> **Importante:** no abras `index.html` con doble clic. En `file://` el navegador bloquea la lectura
> de los archivos de datos. Usa siempre `http://localhost:8787`.

---

## 2. Levantar la página

```powershell
cd C:\GGTO\proyecto
pwsh -File .\servir-ggto.ps1
```

Se abre el navegador en `http://localhost:8787/index.html`. El servidor escucha **solo en loopback**
y sirve **solo** el subdirectorio `app/`; si además quieres comprobarlo, abre
`http://localhost:8787/datos/averias.json` y debe responder **404** (los datos no se exponen por HTTP).

---

## 3. Lista de comprobación

### 3.1 Acceso (CU-01)

- [ ] Al abrir, se ve **solo el diálogo de acceso**: no aparecen casos, ni conteos, ni gráficos.
- [ ] Con `tecnicos.json` vacío aparece el paso **«Crear el primer supervisor»** (D-62).
- [ ] Se crea el supervisor con `P00`, nombre y contraseña de **8 caracteres o más**.
- [ ] Con contraseña de 7 caracteres o menos el sistema la rechaza.
- [ ] Con contraseña incorrecta el mensaje es **genérico** (no dice cuál dato falló) y el intento queda
      anotado en `C:\GGTO\datos\incidencias.log`.
- [ ] Tras entrar, el encabezado muestra quién es el operador y su rol; a las **8 horas** (D-45) la
      sesión pide reingresar.

### 3.2 Autorización de la carpeta de datos

- [ ] La página pide permiso para la carpeta **`C:\GGTO\datos`** (gesto obligatorio del usuario).
- [ ] Si se deniega, la página lo explica y no muestra datos.
- [ ] Si se autoriza, los padrones y la configuración se cargan sin errores en la consola (F12).

### 3.3 Configuración (CU-02 a CU-07)

- [ ] `CENTRAL` muestra los datos reales de la central (region CAPITAL, area AREA 4, central 2324X,
      nombre FRANCISCO SALIAS…).
- [ ] En `TECNICOS` se puede dar de alta un operador con `rol = Operador` y comprobar que **no** puede
      editar padrones al iniciar sesión con él (D-35, D-61).
- [ ] En `SECTORES` se puede crear un sector con `id`, `nombre` y varias vías.
- [ ] Al guardar cualquier cambio aparece un archivo `*_AAAA-MM-DD_HHMM.bak` en `C:\GGTO\datos`
      (respaldo previo, D-42); al décimo se descarta el más antiguo.
- [ ] Si se edita el mismo archivo desde otra ventana, el segundo guardado muestra el aviso de
      **conflicto** con quién y cuándo lo modificó, y obliga a elegir entre **Recargar** y
      **Sobrescribir** (D-41).

### 3.4 Casos, cierre y auditoría (CU-10 a CU-15)

> Estos pasos necesitan casos en el maestro: llegan con el **ciclo C2 (ingesta del CSV)**. Hasta
> entonces la tabla aparece vacía, que es el comportamiento esperado.

- [ ] La tabla muestra las **7 columnas** resumidas: nivel, clase, sector, id_averia, nombre, dirección
      y plan.
- [ ] Los filtros y agrupaciones funcionan por abierto/cerrado, cuadrilla, tipo (clase + nivel), clase,
      nivel y estatus.
- [ ] Al seleccionar un caso se abre el flotante con la información agrupada por secciones.
- [ ] **CERRAR CASO** queda **bloqueado** si falta la resolución o la fecha de resolución (D-20).
- [ ] Al cerrar, `historial.jsonl` recibe una línea con fecha y hora, operador, caso, campo, valor
      anterior y valor nuevo (D-56), y la vista de auditoría del caso la muestra.
- [ ] Un operador **no** puede ver ni cerrar casos de otra cuadrilla (D-35).

### 3.5 Ingesta del CSV diario (CU-07 a CU-09, ciclo C2)

- [ ] El bloque **INGESTA** está **dentro de la pestaña PANEL** (no es una pestaña propia: siguen siendo 7) y
      lo pueden usar **operador y supervisor** (la matriz de §2.1 lo permite a los dos roles; D-70).
- [ ] Al elegir `detalle_averias_gpon 12_09_2026.csv` aparece la revisión **sin escribir nada**: filas
      leídas, descartadas por no ser de la central, duplicadas, rechazadas, casos nuevos y el reparto
      PEND/GESTION (con ese archivo: 56 leídas, **51 de la central**, 5 descartadas y
      **18 PEND + 33 GESTION**).
- [ ] Con un archivo manipulado (una columna menos, o una columna renombrada) la ingesta **aborta** y
      avisa qué columna falla: no se escribe ni se confirma nada.
- [ ] Con un archivo que solo tenga el encabezado también aborta.
- [ ] Al pulsar *Ingestar los casos nuevos* se escribe `averias.json` con el protocolo verificado
      (aparece el `.bak`), se añade una línea por caso a `historial.jsonl` y el resumen queda en
      `incidencias.log`.
- [ ] Volver a ingerir el mismo archivo inserta **0** casos (deduplicación por `id_averia`).
- [ ] Las direcciones que no coincidan con ninguna vía de `sectores.json` quedan **en cola** (CU-09).
- [ ] El botón *Registrar que el CSV no llegó* deja constancia en el log sin tocar el maestro.

### 3.6 PANEL: buscar, gestionar y dar de alta (CU-11, CU-12, CU-14, ciclo C3)

- [ ] En **PANEL**, buscar por `id_averia` exacto y por **teléfono**; si el teléfono está en varios
      casos, avisa y muestra el primero.
- [ ] Con un caso de otra cuadrilla, el operador ve el aviso de que no le corresponde.
- [ ] **Actualizar la gestión**: cambiar `status`, `resolucion`, `fechaResolucion`, `observaciones` y
      `sacas`. Al elegir **CERRADO** sin resolución ni fecha, el guardado se bloquea y explica por qué.
- [ ] Al cerrar correctamente se añaden las líneas correspondientes a `historial.jsonl` y se registra
      el operador y la fecha/hora.
- [ ] **Alta manual**: crear un caso; el id se genera como `MAN-0001` (y siguientes) y el caso queda en
      `PEND`, asignado a la cuadrilla de la sesión si la tiene.
- [ ] Intentar dar de alta con teléfono inválido, fecha imposible o sector inexistente: se rechaza con
      el motivo.

### 3.7 Bandeja GESTION (CU-13, ciclo C3)

- [ ] La bandeja es **solo del supervisor**; con un operador la pestaña avisa que no tiene permiso y el
      intento queda en `incidencias.log`.
- [ ] Muestra los casos en `status = GESTION` (con el archivo del 12/09 son **33**) y resume cuántos
      hay sin sector, empresariales y referidos.
- [ ] Se puede ordenar la cola por antigüedad, sector o dirección.
- [ ] Al clasificar (clase, nivel, tipo_abonado) y marcar «pasar a PEND», el caso sale de la bandeja,
      queda en `PEND` para el despacho y se registra en el historial.

### 3.8 DESPACHO y PDF por cuadrilla (CU-16, CU-17, ciclo C4)

> Requiere cuadrillas activas en CONFIGURACION y casos abiertos en el maestro (llegan con la ingesta).

- [ ] **Generar el despacho** reparte todos los casos abiertos entre las cuadrillas activas y avisa si
      alguna queda sin referido o sin empresa (RN-05).
- [ ] La **construcción (CNS)** de cada sector queda en **una sola** cuadrilla: la que tenga
      reparaciones en ese sector (RN-06); si hay empate, decide la zona preferente, luego la menor
      carga y luego el `id` menor (D-32).
- [ ] Los **citados del día** (`fecha_cita` = hoy) aparecen en el reparto y marcados como tales.
- [ ] Se puede **mover** un caso a otra cuadrilla con el selector; el cambio queda registrado.
- [ ] Al **guardar el despacho** se escriben `Reparador Principal` y `fecha_asignacion` en
      `averias.json`, se graba `despacho.json` con sus 15 columnas, y hay una línea de historial por
      asignación.
- [ ] **PDF por cuadrilla**: se genera `Despacho_Cuadrilla_<id>_AAAAMMDD.pdf` en **carta horizontal**,
      con fecha, cuadrilla y número de copia, y el pie recuerda recoger y destruir las hojas al cierre
      (D-27). Con muchos casos debe salir en varias páginas.
- [ ] **Ruta controlada (D-67).** Antes de generar, la vista DESPACHO muestra el estado de
      `C:\GGTO\despachos`: si no está autorizada lo advierte y ofrece *Autorizar carpeta*. Una vez
      autorizada, pulsar *Autorizar carpeta C:\GGTO\despachos* en el selector del navegador.
- [ ] Al generar el PDF, el aviso indica la **ruta controlada** `C:\GGTO\despachos\Despacho_Cuadrilla_…pdf`
      y la vista lista los PDF generados con su tamaño. **La carpeta de Descargas del usuario NO debe
      contener** `Despacho_Cuadrilla_*.pdf`.
- [ ] **Reemisión**: generar dos veces el PDF de la misma cuadrilla y el mismo día produce
      `…_r2.pdf` **sin borrar** el primero (CU-17, flujo 6a).
- [ ] El registro de entrega (a quién se entregó) y la ruta del archivo quedan en `incidencias.log`.
- [ ] Si se deniega o se pierde la autorización de la carpeta, el PDF se descarga pero la página
      **avisa expresamente** de que quedó fuera de la ruta controlada, y así consta en el log.

### 3.9 MONITOREO y GRAFICOS (CU-18, ciclo C5)

- [ ] **MONITOREO** muestra las 6 zonas con su tabla: gestión diaria, casos globales, reparación
      pendiente (comunes/referidos/empresariales), construcción pendiente, cuadrillas del día
      (asignados/cerrados/gestionados) y la semana operativa.
- [ ] **GRAFICOS** dibuja las 6 zonas: barras (diario, globales, construcción, cuadrilla), barras +
      línea (semanal) y torta (reparación), cada una con su tabla equivalente al lado.
- [ ] El selector **Sem 1 a Sem 36** cambia la semana del gráfico semanal; con el año 2026, la Sem 36
      es la del 07/09 al 12/09.
- [ ] Los números de los gráficos coinciden con los de las tablas y con los del MONITOREO.
- [ ] Sin la librería Chart.js, la página avisa y deja las tablas (no se queda en blanco).

### 3.10 REPORTES y seguimiento (CU-19, CU-20, ciclo C6)

> **REPORTES no es una pestaña propia** (las pestañas siguen siendo 7, RF-01): es la **sub-pestaña
> «REPORTES y seguimiento»** de la pestaña **MONITOREO**, junto a TABLERO, con el mismo patrón que
> RESPALDO y ENTORNO en CONFIGURACION (D-76). Como MONITOREO, es **exclusiva del supervisor**.

- [ ] En **MONITOREO**, la sub-pestaña **REPORTES y seguimiento** muestra el **parte de trabajo del día**: ingresos, resueltos (por tipo),
      pendientes al cierre, total del maestro y casos especiales abiertos.
- [ ] **Casos especiales**: lista de los empresariales (EMP) y referidos (REF) que siguen abiertos, con
      su sector, tipo y cuadrilla (D-33).
- [ ] **Averías concentradas**: por sector, los casos abiertos ingresados en la **semana operativa**, y
      la marca de **concentrada** cuando alcanza el umbral (por defecto 3, editable en CONFIGURACION →
      palabras clave; D-25).
- [ ] Cambiar el umbral en CONFIGURACION cambia la marca de concentración al volver a la sub-pestaña.
- [ ] **Emitir el parte del día** deja constancia en `incidencias.log` e informa cuántos cambios hubo en
      el historial desde la emisión anterior.
- [ ] Un operador **no** puede abrir MONITOREO (la sub-pestaña REPORTES es del supervisor) y el intento queda registrado.

### 3.11 Respaldo y restauración (CU-21, ciclo C7)

> El bloque **RESPALDO** es una **subpestaña de CONFIGURACION**, no una pestaña propia (las pestañas
> siguen siendo 7), y es **exclusivo del supervisor** (D-35, RNF-12).

- [ ] Con sesión de **operador**, la subpestaña RESPALDO no permite respaldar ni restaurar: muestra
      «Acción no permitida para su rol» y el intento queda en `incidencias.log`.
- [ ] Al abrir RESPALDO por primera vez aparece **«Sin respaldos registrados»** y la advertencia de que
      el RPO no está cubierto (D-49).
- [ ] Pulsar *Autorizar carpeta C:\GGTO\respaldo* abre el selector del navegador; al concederlo, el
      estado deja de avisar que falta la autorización.
- [ ] *Respaldar ahora* muestra **«Respaldo verificado: 10 archivos»** con la fecha y hora, e indica el
      nombre de la copia del maestro (`averias_AAAA-MM-DD_HHMM.json`).
- [ ] En `C:\GGTO\respaldo\` quedan los **10 archivos**: los 9 JSON de trabajo **y** `historial.jsonl`
      **íntegro** (las mismas líneas que el original, sin truncar), y **sin cifrar** (D-56, D-49).
- [ ] Respaldar dos veces en el mismo día **no** sobrescribe la copia anterior: quedan dos archivos
      `averias_..._HHMM.json` con minutos distintos (H-N-08).
- [ ] Si se quita el permiso o la carpeta no está disponible, el respaldo **no** se marca como exitoso:
      muestra el error con el archivo que falló y lo deja en el log con fecha y hora.
- [ ] *Revisar la copia elegida* muestra el impacto: casos en la copia, casos en el maestro, cuántos
      volverían al estado de la copia, cuántos se recuperarían y cuántos se perderían.
- [ ] Con una copia que tiene **menos** casos que el maestro, el botón *Confirmar la restauración* queda
      **deshabilitado** hasta escribir `RESTAURAR` (confirmación escrita).
- [ ] Elegir un archivo que no es JSON válido responde **«Respaldo inválido»** y no reemplaza nada.
- [ ] Al confirmar una restauración: el maestro queda con los casos de la copia, aparece en
      `C:\GGTO\datos` un `.bak` con el **estado anterior** y el aviso informa **hora de inicio y de fin**
      —dentro del **RTO de 1 hora**— y la fecha del cierre respaldado (**RPO**, D-49).
- [ ] Si otra ventana modificó `averias.json` después de la carga, la restauración avisa del
      **conflicto** con quién y cuándo, y exige elegir entre *Recargar* y *Sobrescribir* (D-41).
- [ ] En **modo descarga** (navegador sin la API de archivos), la copia se **descarga** en lugar de
      escribirse, y el bloque lo advierte para que se guarde a mano en `C:\GGTO\respaldo\`.

### 3.12 Diagnóstico del entorno (CU-22)

> El bloque **ENTORNO** es la última subpestaña de CONFIGURACION. Es de solo lectura y lo pueden
> consultar operador y supervisor.

- [ ] **ENTORNO** muestra: navegador y versión, si soporta la File System Access API, el origen de la
      página (`http://localhost:8787`), el modo de trabajo, las rutas (`C:\GGTO\datos`,
      `C:\GGTO\despachos` y `C:\GGTO\respaldo`) y la versión de la aplicación.
- [ ] Abriendo la página con doble clic (`file://`), el origen avisa de que hay que usar
      `servir-ggto.ps1` en lugar de la apertura directa.
- [ ] El **informe de archivos** dice cuántos hay, cuántos faltan y cuántos son ilegibles; si se borra
      `flota.json` de `C:\GGTO\datos`, aparece como ausente sin romper la página.
- [ ] El **registro de la aplicación** informa de las líneas del día y de las incidencias (intentos
      fallidos y acciones denegadas); *Descargar el detalle del registro* baja `incidencias.log`.
- [ ] La **verificación de cierre** muestra la última escritura confirmada, el último respaldo y las
      incidencias registradas hoy; sin copias de cierre avisa de que el RPO no está cubierto.
- [ ] Con el CSV del día ausente, la página avisa «sin ingesta» y **no** bloquea la operación (D-46).

### 3.13 Control documental del despacho (CU-17, D-68)

> El bloque aparece en la vista DESPACHO **después** de pulsar *Generar el despacho*. Su estado es de
> **sesión**: no se guarda en ningún archivo, y al recargar la página vuelve a empezar (D-68). Lo que
> queda como constancia son los **asientos de `incidencias.log`**; el soporte oficial del día es la
> hoja impresa y el `.xlsm`.

- [ ] Al generar el despacho, el control aparece mostrando **«Pendiente de entrega: C1, C2…»** y el
      botón *Dar el control documental del día por cerrado* **deshabilitado**.
- [ ] Con la hoja de una cuadrilla en la mano, escribir el receptor (opcional) y pulsar
      *Registrar entrega*: la fila pasa a «Entregado DD/MM/AAAA hh:mm» y el resumen a «Faltan hojas: …».
- [ ] Pulsar *Recoger hojas*: la fila pasa a «Recogida …» y el resumen a «Pendiente de destruir: N hoja(s)».
- [ ] Indicar el número de hojas destruidas y pulsar *Registrar destrucción*: con todas las cuadrillas
      destruidas el resumen dice **«Hojas destruidas: N de N cuadrillas»** y el cierre se **habilita**.
- [ ] Si una cuadrilla no entrega su hoja, *Justificar la falta* la saca del bloqueo y permite cerrar
      el día (flujo 7a).
- [ ] Pulsar *Dar el control documental del día por cerrado* deja el asiento en `incidencias.log`
      (`CONTROL DOCUMENTAL CERRADO`), igual que cada entrega, recogida y destrucción.
- [ ] **Recargar la página**: el control vuelve a «Pendiente de entrega» y los asientos siguen en el log
      (es el comportamiento acordado en D-68, no un fallo).

---

## 4. Dónde mirar si algo falla

| Síntoma | Qué revisar |
|---|---|
| «Identifíquese para editar» y nada visible | Es lo correcto sin sesión (D-50). Inicia sesión. |
| No aparecen datos tras entrar | Que hayas autorizado `C:\GGTO\datos` y que los archivos existan. |
| Aviso de conflicto al guardar | Otra ventana modificó el archivo: elige Recargar o Sobrescribir. |
| La página no carga | Que `servir-ggto.ps1` siga corriendo y que la URL sea `http://localhost:8787/index.html`. |
| Errores en pantalla | Consola del navegador (F12) y `C:\GGTO\datos\incidencias.log`. |

---

## 5. Qué queda fuera de esta prueba

- La **prueba con los datos reales de una semana completa** en el puesto de la central (C7).
- La **impresión** física del despacho y del PDF en la impresora de la central (C7).
- El **manual de usuario** del sistema (C7).

---

## 6. Pruebas automatizadas (complemento)

```powershell
cd C:\GGTO\proyecto
node --test pruebas/pruebas_c1.mjs pruebas/pruebas_almacen_c1.mjs pruebas/pruebas_c1b.mjs pruebas/pruebas_c2.mjs pruebas/pruebas_c3.mjs pruebas/pruebas_c4.mjs pruebas/pruebas_c4b.mjs pruebas/pruebas_c5.mjs pruebas/pruebas_c6.mjs pruebas/pruebas_c7.mjs pruebas/pruebas_cu22.mjs pruebas/pruebas_contratos.mjs
```

Deben pasar **142 de 142**. Cubren la lógica pura, el protocolo de escritura verificada con la API
simulada (lo que el navegador no permite automatizar sin un gesto humano) y los **contratos de datos
contra el CSV real**: la ruta controlada de los PDF (D-67), el control documental del despacho (D-68),
el diagnóstico de CU-22, la copia de cierre y la restauración de CU-21.

Además hay una **comprobación de interfaz** que sí abre la página real en un navegador headless y
renderiza las 8 vistas —las 7 pestañas y la sub-pestaña REPORTES de MONITOREO— (necesita Chrome o Edge
instalado):

```powershell
cd C:\GGTO\proyecto
node pruebas/interfaz.mjs
```

Deben pasar **52 de 52**. Es la que detecta los defectos de contrato entre `app.js` y los módulos
(por ejemplo, que una pestaña no tenga su sección real, que falte cargar una librería local o que un
bloque no tenga punto de entrada), y recorre de verdad la **sesión con credencial**, la **ingesta del CSV real**,
el alta del despacho, la entrega, la recogida y la destrucción de las hojas, el respaldo y el reporte.
