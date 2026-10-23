# Casos de uso — GGTO V2 · WEB (inventario funcional completo)

| Campo | Valor |
|---|---|
| Documento | Casos de uso del canal **WEB** bajo criterio de **analista funcional** (un CU por objetivo de actor) |
| Estado | **v1.0** — redactado a partir del inventario real de pantallas del código |
| Fecha | 2026-10-23 |
| Fuente de verdad | Inventario auditado del código vigente (v84 · D-157 desplegados): `app/web/src/**` (34 páginas/componentes) |
| Documento complementario | [`casos_uso_apk.md`](casos_uso_apk.md) — los mismos RF en la APK (`CU-A-xx`); varios CU existen en ambos canales y comparten backend |
| Requisitos | [`../requerimientos.md`](../requerimientos.md) — RF-01…RF-38 · RNF-01…RNF-25 · reglas RN-AL-01/02/03 |
| Roles vigentes | **SUPER** (acceso total, D-50) · **ADMIN** · **SUPERVISOR** · **TECNICO** · **COORDINADOR** — matriz `requerimientos.md` §5.2 |
| Notación | Criterios funcionales en **Gherkin** (`Dado/Cuando/Entonces`); restricciones del sistema en **EARS**; 100 % testeables |
| Convención de IDs | `CU-W-xx` = canal **WEB** (PC y web móvil) · `CU-A-xx` = canal **APK** (documentado por separado) |
| Verificación sugerida | API: `app/tests/*_api.py` · UI web: Playwright sobre `npm run build` |

**Actores:** `SUPER` Super Usuario · `ADM` Administrador · `SUP` Supervisor de la central ·
`TEC` Técnico de campo · `COO` Coordinador · `SIS` Sistema (automático, ACT-05).

**Fuera del alcance de este documento (exclusión explícita y verificable):** los canales
**Telegram**, **WEB-MCP (IA)** y el **solicitante externo ACT-03** (su alta es manual por el
supervisor y su aviso sale por el *outbox*, D-156). Se cubre solo la interfaz **WEB**. Los
CU heredan decisiones vigentes: D-156 (aviso al solicitante), **D-157 (cierre de jornada
anula asignaciones → estado `DEVUELTO`)**, D-71 (aviso de uso), D-113 (procesar despacho
por tipos), D-99 (cierre de masivas con validador CRASS) y RN-AL-01/02/03.

> **Cómo leer la trazabilidad.** Cada CU lista los RF que cubre. Los criterios citan la
> verificación (endpoint, tabla, pantalla o test existente). Nada aquí describe
> comportamiento inexistente: todo lo listado está en el código vigente al 2026-10-23.

---

## Índice

[CU-W-01](#cu-w-01--aceptar-el-aviso-legal-de-uso-restringido)…[CU-W-06](#cu-w-06--cerrar-sesión) Sesión y cuenta ·
[CU-W-07](#cu-w-07--buscar-en-el-buscador-global-y-abrir-la-ficha-rápida)…[CU-W-10](#cu-w-10--consultar-la-ayuda-de-la-plataforma) Global/lanzadera ·
[CU-W-11](#cu-w-11--ingestar-el-archivo-csv-diario-con-vista-previa)…[CU-W-18](#cu-w-18--operar-la-ficha-de-la-falla-masiva-en-la-web) OPERACIÓN ·
[CU-W-19](#cu-w-19--listar-y-filtrar-el-universo-de-casos)…[CU-W-23](#cu-w-23--imprimir-el-reporte-de-un-caso) CASOS ·
[CU-W-24](#cu-w-24--registrar-el-seguimiento-de-un-caso)…[CU-W-25](#cu-w-25--gestionar-un-seguimiento-existente) SEGUIMIENTO ·
[CU-W-26](#cu-w-26--registrar-un-caso-especial)…[CU-W-28](#cu-w-28--cerrar-un-caso-especial-con-informe) ESPECIALES ·
[CU-W-29](#cu-w-29--crear-una-cita-de-atención)…[CU-W-30](#cu-w-30--consultar-y-gestionar-la-agenda-imprimible) AGENDA ·
[CU-W-31](#cu-w-31--generar-la-propuesta-de-despacho-diaria)…[CU-W-38](#cu-w-38--ejecutar-el-cierre-de-jornada-del-despacho) DESPACHO ·
[CU-W-39](#cu-w-39--detectar-fallas-masivas-de-forma-automática)…[CU-W-47](#cu-w-47--consultar-el-histórico-de-fallas-masivas) MASIVAS ·
[CU-W-48](#cu-w-48--configurar-las-centrales)…[CU-W-56](#cu-w-56--gestionar-el-catálogo-de-personal-externo) CONFIGURACIÓN ·
[CU-W-57](#cu-w-57--enviar-un-mensaje-interno-a-través-de-la-web)…[CU-W-62](#cu-w-62--inspeccionar-la-base-de-datos-super) MENSAJES·PERFIL·SISTEMAS.

---
# PARTE 1 — Casos de uso de la WEB

## 1.1 Sesión y cuenta

### CU-W-01 — Aceptar el aviso legal de uso restringido
**Actor(es):** Todos · **RF/RNF:** RNF-18 (aviso y base legal) · D-71
**Precondición:** Sesión no iniciada (o localStorage sin la clave de aceptación).
**Flujo principal:**
1. La web muestra el muro `AvisoLegal` con las cláusulas de privacidad y uso.
2. El usuario puede abrir el aviso completo (HTML), descargarlo (PDF) o ir a la Ayuda.
3. Marca la casilla de aceptación y pulsa **«Aceptar e ingresar»** → pasa al formulario de acceso.
**Alternativos:** sin aceptar, el botón permanece deshabilitado; la aceptación se recuerda en `localStorage` (`k_acepto_legal`) y el muro no vuelve a aparecer.
**Criterios de aceptación:**
```gherkin
Dado un usuario sin aceptación registrada
Cuando accede a la URL raíz de la web
Entonces ve el muro del aviso legal y no puede operar ninguna sección
Y "Aceptar e ingresar" está deshabilitado hasta marcar la casilla
```
```gherkin
Dado un usuario que ya aceptó el aviso en el mismo navegador
Cuando recarga la página
Entonces el muro no reaparece y va directo al acceso
```

### CU-W-02 — Iniciar sesión web con P00 y clave
**Actor(es):** Todos · **RF/RNF:** RF-20 · RNF-01, RNF-22 · **Precondición:** Aviso aceptado (CU-W-01).
**Flujo principal:**
1. En la pestaña **Acceso** el usuario ingresa `P00` + clave y envía el formulario → `POST /auth/login`.
2. Con sesión válida se redirige a `/` y el Layout carga su menú según rol.
**Alternativos:** A1 credencial inválida → mensaje de error y el formulario se resetea; A2 cuenta bloqueada → se muestra el desbloqueo con 3 palabras (CU-W-03); A3 cuenta nueva sin clave → invita al primer acceso (CU-W-04).
**Criterios de aceptación:**
```gherkin
Dado una cuenta activa con credenciales válidas
Cuando inicia sesión con su P00 y clave
Entonces obtiene sesión, ve su P00/nombre/rol en la barra y su menú según rol (§5.2)
```
```gherkin
Dado una cuenta que no existe o clave incorrecta
Cuando intenta iniciar sesión
Entonces el acceso falla con mensaje claro y sin revelar cuál campo es incorrecto
```

### CU-W-03 — Desbloquear una cuenta bloqueada con 3 palabras de seguridad
**Actor(es):** Todos · **RF/RNF:** RF-20 · RNF-01 · **Precondición:** Cuenta bloqueada por 3 intentos (o bloqueo manual).
**Flujo principal:**
1. Con el conmutador **Desbloquear**, el usuario ingresa P00, clave y selecciona **3 de sus 12 palabras con posición (1–12)**.
2. `POST /auth/unlock` desbloquea la cuenta y con la clave se encadena el login.
**Alternativos:** A1 palabras/posiciones incorrectas → permanece bloqueado con mensaje; A2 desconoce las palabras → requiere apoyo de ADMIN/SUPER (regeneración, CU-W-51/W60).
**Criterios de aceptación:**
```gherkin
Dado una cuenta bloqueada
Cuando el titular ingresa su clave y correctamente sus 3 palabras de seguridad elegidas con posición
Entonces la cuenta se desbloquea y la sesión se inicia
```
```gherkin
Dado una cuenta bloqueada
Cuando alguien ingresa palabras que no corresponden o posiciones erróneas
Entonces el desbloqueo es rechazado y el estado de la cuenta sigue bloqueado
```

### CU-W-04 — Primer acceso: activar cuenta y guardar las 12 palabras
**Actor(es):** `TEC`/`SUP`/`ADM`/`COO` cuentas pre-registradas · **RF/RNF:** RF-20 · RNF-01/02
**Precondición:** El perfil existe sin cuenta de acceso activada (p. ej. cargado por CONFIGURACIÓN → CU-W-50).
**Flujo principal:**
1. En **Primer acceso** el usuario valida su `P00` (elegibilidad).
2. Registra correo, clave (≥ 8) y confirmación.
3. El sistema muestra **una sola vez las 12 palabras de seguridad**, con opción **Copiar**, y remite al acceso.
**Alternativos:** cuenta ya activa → aviso y no se genera otra lista sin flujo expreso.
**Criterios de aceptación:**
```gherkin
Dado un pre-registro sin activar
Cuando completa P00 + las 3 palabras de verificación correspondientes + clave nueva (≥ 8) y confirmación
Entonces el sistema activa el acceso y muestra las 12 palabras de seguridad una sola vez
```
```gherkin
Dado las palabras mostradas en primer acceso
Cuando el usuario pulsa "Copiar"
Entonces obtiene la lista completa en el portapapeles y no se vuelven a mostrar
```

### CU-W-05 — Descargar la APK desde la web móvil
**Actor(es):** `TEC` (y cualquier rol) · **RF:** RF-20 · D-102/D-107/D-108
**Precondición:** Acceso a la web desde un navegador móvil.
**Flujo principal:**
1. La pantalla de acceso móvil ofrece el bloque de descarga: **Descargar APK** (`/apk/ggto-tecnico.apk`) y **Cómo instalar** (`/apk/apk.json` guía).
2. Con instalación completa, el técnico queda en el flujo APK (PARTE 2).
**Alternativos:** la sugerencia puede **omitirse** en esa sesión (localStorage) y volver a aparecer en otra.
**Criterios de aceptación:**
```gherkin
Dado un dispositivo móvil en la pantalla de acceso
Cuando pulsa "Descargar APK"
Entonces el dispositivo descarga el binario vigente publicado con su SHA-256
```
```gherkin
Dado el binario APK bajado desde la web
Cuando se verifica su SHA-256
Entonces coincide con el publicado en /apk/apk.json (integridad de distribución)
```

### CU-W-06 — Cerrar sesión
**Actor(es):** Todos · **RF:** RF-20 · RNF-22 · **Precondición:** Sesión activa.
**Flujo principal:** desde el menú de usuario se pulsa **Cerrar sesión** → se revoca la sesión/token local y la web vuelve a `/`.
**Criterios de aceptación:**
```gherkin
Dado una sesión activa
Cuando cierra sesión
Entonces la aplicación pierde el estado autenticado y regresa a la pantalla de acceso
```
```gherkin
Dado una sesión cerrada
Cuando intenta reingresar a una ruta interna (p. ej. /casos)
Entonces la web lo redirige al acceso sin exponer datos
```

## 1.2 Navegación global y lanzadera

### CU-W-07 — Buscar en el buscador global por 70* / contacto y abrir la ficha rápida
**Actor(es):** Todos · **RF:** RF-30 · RN-AL-03 · D-89 · **Precondición:** Sesión activa.
**Flujo principal:**
1. En la barra superior se escribe un término (identificador de pago 70*, número de contacto u otro dato) y se pulsa **Buscar** → `GET /casos/buscar`.
2. El desplegable muestra hasta **8 resultados agrupados**; al elegir uno se abre `FichaRapida` (modal).
**Alternativos:** A1 sin resultados → vacío con indicador; A2 **Limpiar** vacía el término.
**Criterios de aceptación:**
```gherkin
Dado un caso con identificador de pago 70* y contacto de cliente
Cuando se localiza por ambos números
Entonces el resultado correcto aparece agrupado y abre la ficha del caso
```
```gherkin
Dado un término de búsqueda que no coincide con ningún caso visible para el rol
Cuando se consulta el buscador
Entonces el sistema no devuelve ninguno y no revela datos de otras centrales
```

### CU-W-08 — Consultar la ficha rápida con historial de estados
**Actor(es):** Todos · **RF:** RF-30 · RNF-12 · **Precondición:** Caso localizado (CU-W-07).
**Flujo principal:**
1. Se abre `FichaRapida` modal con pestañas de **solo lectura**: *Actual / Estado / Contacto / Técnico*.
2. La pestaña **Estado** lista el historial de cambios automático (`GET /casos/{id}/historial`).
**Alternativos:** para editar el caso se usa la ficha completa de CASOS (CU-W-20).
**Criterios de aceptación:**
```gherkin
Dado un caso con estados históricos
Cuando abre la ficha rápida
Entonces se muestran pestañas y el historial con fecha de cada transición
```
```gherkin
Dado un caso ajeno al alcance de central del usuario
Cuando se solicita la ficha
Entonces el API responde 404 y la web muestra que no existe el caso (alcance por central)
```

### CU-W-09 — Dar de alta un caso manual desde la barra superior
**Actor(es):** `SUP`, `ADM`, `SUPER` · **RF:** RF-32 · RN-AL-01
**Precondición:** Rol con permiso de escritura en PANEL (el TECNICO solo ve los suyos; función no en su botón).
**Flujo principal:**
1. Botón **«Agregar caso»** abre `ModalCaso` con contadores de caracteres.
2. Se completa cliente, avería, 70*, contacto, dirección, sector, causa/subcausa, comentarios… → `POST /casos`.
3. El caso queda disponible en CASOS y en el buscador.
**Alternativos:** falta dato obligatorio (nombre/contacto, dirección, 70*, tipo de reporte, y en REPARACIÓN id de avería+problema) → **422** y foco en el campo (RN-AL-01).
**Criterios de aceptación:**
```gherkin
Dado un rol de gestión
Cuando completa el alta manual con todos los datos obligatorios
Entonces se crea el caso y aparece en el listado de CASOS
```
```gherkin
Dado un alta manual incompleta sin nombre de cliente ni contacto
Cuando se intenta guardar
Entonces la solicitud falla con 422 y el formulario indica los campos faltantes
```

### CU-W-10 — Consultar la Ayuda de la plataforma
**Actor(es):** Todos · **Precondición:** Sesión activa.
**Flujo principal:**
1. La sección **AYUDA** lista los 8 temas del manual (General, Tecnología, Dependencias, Implementación, Despliegue, Diccionario de Datos, Diagrama Relacional, Operación) con índice de sub-secciones ancladas.
2. Cada sección permite **Abrir manual HTML** (pestaña nueva) y **Descargar PDF**.
3. El buscador filtra por texto normalizado y muestra el contador de coincidencias.
**Criterios de aceptación:**
```gherkin
Dado un término buscado en los manuales
Cuando se aplica el buscador de la Ayuda
Entonces se listan las secciones con coincidencias y el contador indica cuántas hay
```
```gherkin
Dado un usuario en la Ayuda
Cuando pulsa "Descargar PDF" en cualquier sección
Entonces obtiene el PDF generado del proyecto
```
## 1.3 Sección OPERACIÓN (pestañas Gestión del día · Ingesta · Monitoreo · Alertas)

### CU-W-11 — Ingestar el archivo CSV diario con vista previa
**Actor(es):** `SUP`, `ADM`, `SUPER` (escritura); lectura para el resto con datos · **RF:** RF-01, RF-21, RF-22, RF-29
**Precondición:** Archivo `detalle_averias_gpon_<fecha>.csv` disponible; central configurada (RF-38).
**Flujo principal:**
1. Se selecciona el CSV → **Vista previa** (`/ingesta/preview`) muestra qué se procesaría.
2. **Cargar** (`/ingesta/cargar`) ejecuta la ingesta: filtro por los datos operativos de la central → descarte de duplicados por `id_averia` → inserción de casos nuevos → **resumen del lote** (nuevos, descartados, total).
3. Los lotes previos quedan consultables (lotes + detalle).
**Alternativos:** archivos con filas de otras centrales → descartadas por filtro (RF-21); CSV mal formado → error de ingesta sin mutación parcial.
**Criterios de aceptación:**
```gherkin
Dado un CSV del día con casos de la central y 200 duplicados ya existentes
Cuando se ejecuta la carga
Entonces la ingesta registra solo ids nuevos + descarta duplicados + deja el lote de referencia con resumen
```
```gherkin
Dado un CSV con filas de otra central
Cuando se ejecuta la ingesta
Entonces ninguna de esas filas genera caso (solo se procesan los datos operativos de la central configurada)
```

### CU-W-12 — Conciliar direcciones sin sector y re-sectorizar pendientes
**Actor(es):** `SUP`, `ADM`, `SUPER` · **RF:** RF-23, RF-38 · RNF-10
**Precondición:** Casos con dirección no encajada después de la ingesta.
**Flujo principal:**
1. El panel **Gestionar direcciones** lista los casos sin sector.
2. Se asigna una dirección a un sector definiendo el **patrón** (`CONTIENE`/`EXACTO`/`REGEX`).
3. **Re-sectorizar pendientes** re-evalúa las direcciones activas con los patrones vigentes.
**Criterios de aceptación:**
```gherkin
Dado direcciones casadas con un patrón CONTIENE
Cuando se re-sectorizan los casos pendientes
Entonces los casos afectados cambian a su sector y quedan disponibles para el despacho
```
```gherkin
Dado un patrón REGEX inválido
Cuando se guarda
Entonces el sistema lo rechaza sin dejar patrones rotos en el catálogo
```

### CU-W-13 — Consultar el tablero de Gestión diaria y crear un especial desde el Widget
**Actor(es):** `SUP`, `ADM`, `SUPER` (tablero); `COO` lo ve sin el Widget de gestión · **RF:** RF-25, RF-37 · D-105
**Flujo principal:**
1. La pestaña **Gestión del día** muestra el tablero de bandeja común/referidos con auto-refresco 30 s (`/gestion-diaria`).
2. Desde el Widget se puede **registrar un alta de caso especial** (tipo, título, nota).
**Alternativos:** recarga manual del tablero; casos gestionados invisibles por defecto (D-105) según el filtro vigente.
**Criterios de aceptación:**
```gherkin
Dado un tablero de gestión del día activo
Cuando pasa 30 s con la pestaña abierta
Entonces los datos se refrescan solos sin recarga manual
```
```gherkin
Dado un tablero de gestión del día abierto
Cuando se registra un caso especial con tipo y título
Entonces aparece en el tablero y también en la sección ESPECIALES
```

### CU-W-14 — Consultar el monitoreo de la gestión en sus bloques
**Actor(es):** Todos (TEC solo su cuadrilla, D-72) · **RF:** RF-26, RF-28 · D-94
**Flujo principal:**
1. La pestaña **Monitoreo** expone los parámetros (central, fechas, cuadrilla…) y los bloques: gestión semanal, reparación, construcción, por cuadrilla, capacidad operativa, métricas por identificador de pago (reincidencia, reclasificaciones).
2. Cada bloque consulta su API de monitoreo y se pinta en tablas/gráficas.
**Alternativos:** sin datos en el rango → bloques vacíos con mensaje (no error).
**Criterios de aceptación:**
```gherkin
Dado un rango con casos cerrados de varias cuadrillas
Cuando se consulta el monitoreo
Entonces los bloques se muestran y las métricas cuadran con el detalle de CASOS del mismo rango
```
```gherkin
Dado un técnico (TEC) autenticado
Cuando consulta el monitoreo
Entonces solo ve bloques de su cuadrilla, sin métricas de identificador de pago
```

### CU-W-15 — Generar e imprimir el reporte de trabajo
**Actor(es):** Todos (según alcance) · **RF:** RF-28 · RNF-13
**Flujo principal:**
1. Desde Monitoreo se genera el reporte de trabajo (diario/semanal/mensual según parámetros).
2. La acción **imprimible** entrega versión en formato carta lista para imprimir.
**Criterios de aceptación:**
```gherkin
Dado un reporte de trabajo generado
Cuando se solicita la versión imprimible
Entonces el HTML se abre en formato carta sin paginar el contenido
```
```gherkin
Dado un periodo mensual seleccionado
Cuando se genera el reporte
Entonces consolida solo los días del mes elegido
```

### CU-W-16 — Consultar alertas y detectar fallas masivas
**Actor(es):** Todos (acceso de lectura); detección/gestión según RBAC de ALERTAS · **RF:** RF-09, RF-16 · RNF-19
**Flujo principal:**
1. La pestaña **Alertas** muestra métricas (fallas activas, notificaciones pendientes/enviadas/fallidas, bandeja) y el cuadro de fallas masivas.
2. El botón **Detectar fallas** lanza el análisis de concentración tras la ingesta (RF-09); las filas abren `FichaFalla` (CU-W-18).
**Alternativos:** notificaciones con error se auditan en la bandeja filtrada por estado.
**Criterios de aceptación:**
```gherkin
Dado una ingesta concentrada en un mismo ODN/FAT
Cuando se pide la detección de fallas
Entonces la falla masiva se crea o actualiza con los casos afectados
```
```gherkin
Dado notificaciones con envío fallido
Cuando se consulta la bandeja filtrando por estado
Entonces se listan con su motivo y canal para revisar el flujo de envío (RNF-20)
```

### CU-W-17 — Reportar manualmente una falla masiva desde la web
**Actor(es):** `SUP`, `ADM`, `SUPER` · **RF:** RF-09, RF-16
**Flujo principal:**
1. En Alertas se abre el modal **reportar falla manual** y se completan ODN/FAT/sector/dirección/descripción.
2. Se registra la falla con origen manual; casos candidatos pueden asociarse luego (CU-W-40/CU-A-28).
**Criterios de aceptación:**
```gherkin
Dado una falla reportada por un técnico desde la APK
Cuando el supervisor la registra manualmente con sus datos técnicos
Entonces la falla aparece activa con origen MANUAL y queda disponible para planificación y cierre
```
```gherkin
Dado una falla activa para el mismo FAT
Cuando se intenta registrar de nuevo de forma manual
Entonces no se duplica: se reutiliza la masiva ya activa para ese FAT
```

### CU-W-18 — Operar la ficha de la falla masiva en la web
**Actor(es):** `SUP`, `ADM`, `SUPER` · **RF:** RF-09, RF-17, RF-18 · D-99
**Precondición:** Falla activa localizada (CU-W-16/17/39).
**Flujo principal:**
1. `FichaFalla` abre con pestañas **Masiva / Planificar / Materiales / Cerrar** (el COO solo accede a Materiales).
2. **Planificar** registra plan + reporte + evidencias + cuadrilla (RF-17).
3. **Materiales** consulta órdenes y registra solicitud (RF-18).
4. **Cerrar** exige descripción del trabajo, **validador CRASS activo de la misma central** (D-99), modo IVR/COS/SACAS y cierra la masiva y sus casos en cascada.
**Criterios de aceptación:**
```gherkin
Dado una falla activa planificada
Cuando un ADMIN de la misma central la cierra con un validador CRASS activo
Entonces la falla queda CERRADA y los casos asociados pasan a cerrado con la descripción del cierre
```
```gherkin
Dado una masiva de la central X con validador CRASS de la central Y
Cuando se intenta el cierre
Entonces se rechaza el cierre y los casos no cambian de estado
```

## 1.4 Sección CASOS

### CU-W-19 — Listar y filtrar el universo de casos
**Actor(es):** `SUPER`, `ADM`, `SUP`, `TEC` (acotado a su cuadrilla) · **RF:** RF-33 · RN-AL-02
**Flujo principal:**
1. En **CASOS** se aplican filtros (texto, id avería, teléfono 70*, cliente, estado, sector, fechas, origen…) y se listan paginados los casos.
2. Por defecto `solo_abiertos=true`: se excluyen `CERRADO` y `CANCELADO` (RN-AL-02).
**Alternativos:** **Limpiar** restaura la vista base.
**Criterios de aceptación:**
```gherkin
Dado una central con casos cerrados y abiertos
Cuando se lista la bandeja sin filtros
Entonces la lista muestra abiertos por omisión y ninguno CERRADO ni CANCELADO
```
```gherkin
Dado un usuario técnico
Cuando consulta CASOS
Entonces solo ve los casos de su cuadrilla; los casos de otras cuadrillas no aparecen
```

### CU-W-20 — Editar la ficha completa de un caso
**Actor(es):** `SUPER`, `ADM`, `SUP` (el TEC solo consulta) · **RF:** RF-30, RF-31
**Flujo principal:**
1. Desde el listado, abrir la fila → `FichaCaso` con pestañas Resumen/Contacto/Técnico/Clasificación/Despacho/Textos/Gestión/Resolución/Histórico.
2. Editar campos permitidos (sector, cita, datos del cliente, textos) y **Guardar** → `PATCH /casos/{id}`.
3. Cada cambio queda en `auditoria` (RNF-12) y en el historial del caso.
**Criterios de aceptación:**
```gherkin
Dado un caso abierto de la central del usuario
Cuando el supervisor edita cliente y sector y guarda
Entonces los cambios se reflejan en el listado y el historial registra antes/después por usuario
```
```gherkin
Dado un técnico
Cuando intenta escritura en la ficha de otro caso
Entonces el API lo rechaza y la web lo muestra en solo lectura (matriz §5.2)
```

### CU-W-21 — Cambiar el estado de un caso y reactivar cerrados
**Actor(es):** `SUPER`, `ADM`, `SUP` · **RF:** RF-31, RF-33
**Flujo principal:**
1. En la ficha se ejecuta el cambio de estado con motivo (acciones: cierre, cita, enrutado…).
2. Un caso cerrado puede **reactivarse** cuando proceda, quedando abierto de nuevo.
**Criterios de aceptación:**
```gherkin
Dado un caso activo abierto
Cuando el admin cambia su estado con motivo válido
Entonces el historial muestra la transición con fecha, usuario y motivo
```
```gherkin
Dado un caso CERRADO
Cuando se reactiva con justificación
Entonces vuelve a la bandeja abierta y aparece en CASOS con su historial previo intacto
```

### CU-W-22 — Asignar o quitar un caso de una cuadrilla fuera del despacho
**Actor(es):** `SUPER`, `ADM`, `SUP` · **RF:** RF-08, RF-24
**Flujo principal:**
1. En la ficha (o desde despacho, CU-W-32) se **asigna** el caso a una cuadrilla activa, o se **quita** la asignación vigente.
2. La asignación crea/actualiza el renglón de `despacho_caso` y queda en el histórico del despacho del día.
**Criterios de aceptación:**
```gherkin
Dado un caso sin asignar y una cuadrilla activa de su central
Cuando se asigna hoy
Entonces la cuadrilla lo recibe en el despacho del día sin regenerar el resto
```
```gherkin
Dado un caso asignado por error
Cuando se quita de la cuadrilla
Entonces la asignación deja de ser vigente y el caso vuelve a la masa por asignar, conservando el histórico
```

### CU-W-23 — Imprimir el reporte de un caso
**Actor(es):** Todos (según alcance) · **RF:** RF-26 → reportes; RNF-13
**Flujo principal:** la columna **REPORTE** del listado genera un documento del caso (ficha técnica y de gestión) listo para imprimir/compartir con la cuadrilla.
**Criterios de aceptación:**
```gherkin
Dado un caso visible para el rol
Cuando se pide su reporte
Entonces el documento impreso contiene ficha del caso con datos y no incluye casos ajenos al alcance
```

## 1.5 Sección SEGUIMIENTO

### CU-W-24 — Registrar el seguimiento de un caso
**Actor(es):** `SUP`, `ADM`, `SUPER` (TEC consulta) · **RF:** RF-34 · D-156
**Flujo principal:**
1. En SEGUIMIENTO se pulsa **crear**, se localiza el caso (búsqueda) y se registran instancia destino, motivo y fechas.
2. La bandeja lista el seguimiento **enriquecido** con avería, cliente, dirección, sector, estado y cuadrilla del caso (D-156); lectura con alcance por central/cuadrilla.
**Criterios de aceptación:**
```gherkin
Dado un caso activo
Cuando se crea el seguimiento a otra cola con la instancia y el motivo
Entonces la bandeja lo muestra completo con los datos del caso
```
```gherkin
Dado un técnico
Cuando consulta la sección
Entonces ve los seguimientos de sus casos en modo lectura y no tiene botones de crear/editar
```

### CU-W-25 — Gestionar un seguimiento existente
**Actor(es):** `SUP`, `ADM`, `SUPER` · **RF:** RF-34
**Flujo principal:** editar estado/fechas de un seguimiento o **eliminarlo** cuando la cola cambia; cada acción respeta permiso de escritura.
**Criterios de aceptación:**
```gherkin
Dado un seguimiento dirigido a «Masivos»
Cuando se actualiza a «Planta externa» con nueva fecha
Entonces el registro queda actualizado sin crear filas nuevas
```
```gherkin
Dado un seguimiento superado
Cuando se elimina
Entonces desaparece de la bandeja sin alterar el caso subyacente
```

## 1.6 Sección ESPECIALES

### CU-W-26 — Registrar un caso especial
**Actor(es):** `SUP`, `ADM`, `SUPER`, `COO` (crear) · **RF:** RF-06 · RN-AL-01 · D-95…D-98
**Flujo principal:**
1. Botón **crear especial**: clasificación (**REFERIDO/EMPRESA/GOBIERNO**), tipo (REPARACIÓN/CONSTRUCCIÓN), prioridad, **solicitante registrado o nuevo** (unidad + nombre + contacto), nombre/teléfono/70*, dirección, descripción, requiere informe.
2. En REPARACIÓN son obligatorios el `id_averia` y el tipo de problema (RN-AL-01); el alta genera el **caso especial referenciado** (REF-… si aplica).
**Alternativos:** faltantes obligatorios → 422 con foco; el aviso de cierre al solicitante sale del *outbox* al cerrar (D-156), no en el alta.
**Criterios de aceptación:**
```gherkin
Dado un referido de reparación sin id de avería
Cuando se intenta crear
Entonces el alta falla con 422 indicando los obligatorios de REPARACIÓN
```
```gherkin
Dado un especial completo con solicitante nuevo
Cuando se guarda
Entonces se crea el especial, su solicitante y el caso asociado visible por central
```

### CU-W-27 — Editar y gestionar el estado de un especial
**Actor(es):** `ADM`, `SUP`, `SUPER` · **RF:** RF-06
**Flujo principal:** en la ficha se actualizan **estado (ABIERTO/EN_PROCESO/ATENDIDO/CERRADO)**, prioridad, descripción y la marca «requiere informe».
**Criterios de aceptación:**
```gherkin
Dado un especial ABIERTO
Cuando el supervisor lo pasa a EN_PROCESO y fija prioridad ALTA
Entonces la ficha queda actualizada y el especial es filtrable por ambos valores
```

### CU-W-28 — Cerrar un caso especial con informe
**Actor(es):** `ADM`, `SUP`, `SUPER` · **RF:** RF-06 · D-156
**Flujo principal:**
1. Al cerrar el especial se elige **modo de cierre (IVR/COS/SACAS)** y se registra la descripción del cierre (el texto queda en cada caso asociado).
2. Si el especial marca **"requiere informe"**, el **informe de atención es obligatorio (≥ 20 caracteres)**.
3. Con el cierre se encola el **aviso al solicitante** por el *outbox*; si el canal es `MANUAL`/`MCP_IA` queda **PENDIENTE** para entrega manual (D-156) sin marcarse como fallido.
**Criterios de aceptación:**
```gherkin
Dado un especial con requiere_informe=true
Cuando se cierra sin informe
Entonces el cierre se rechaza hasta completar un informe de al menos 20 caracteres
```
```gherkin
Dado un especial cerrado correctamente
Cuando el sistema procesa el outbox
Entonces la notificación del aviso queda registrada (MANUAL → PENDIENTE para entrega del supervisor)
```

## 1.7 Sección AGENDA

### CU-W-29 — Crear una cita de atención
**Actor(es):** `ADM`, `SUP`, `TEC`, `COO` · **RF:** RF-12, RF-35, RF-36 · RN-AL-03
**Precondición:** Caso localizado con la búsqueda; los especiales se excluyen del selector según criterio vigente.
**Flujo principal:**
1. Se abre **nueva cita**, se busca el caso, se elige fecha/hora y observación.
2. La cita queda asociada al caso y el caso puede pasar a **CITADO** según el flujo del modelo.
**Alternativos:** fechas pasadas → rechazo con validación de cita futura.
**Criterios de aceptación:**
```gherkin
Dado un caso abierto sin cita
Cuando se agenda para hoy a las 10:00
Entonces la cita figura en la Agenda del día y el panel muestra el caso citado
```
```gherkin
Dado un intento de cita en el pasado
Cuando se guarda
Entonces el sistema lo rechaza con mensaje de fecha inválida
```

### CU-W-30 — Consultar y gestionar la agenda imprimible
**Actor(es):** Todos (SUPER en solo lectura) · **RF:** RF-12
**Flujo principal:**
1. La AGENDA ofrece calendario con 3 vistas y navegación (anterior/siguiente/hoy).
2. Se abre el detalle de una cita, se ajusta o cambia estado, y se puede **imprimir PDF** de la agenda del día.
**Criterios de aceptación:**
```gherkin
Dado una agenda con varias citas de fechas distintas
Cuando se navega entre días
Entonces cada vista muestra solo las citas de su fecha
```
```gherkin
Dado el SUPER en la Agenda
Cuando intenta editar una cita
Entonces la edición está bloqueada para su rol y puede seguir consultando e imprimiendo
```
## 1.8 Sección DESPACHO

### CU-W-31 — Generar la propuesta de despacho diaria
**Actor(es):** `SUP`, `ADM`, `SUPER` · **RF:** RF-08, RF-24, RF-25
**Precondición:** Casos abiertos sectorizados (CU-W-11); cuadrillas activas declaradas.
**Flujo principal:**
1. Se solicita la **propuesta** y el sistema la calcula: casos citados del día, ≥ 2 reparaciones de referidos, ≥ 1 de empresas; construcción a **una sola** cuadrilla —preferentemente la del sector— (RF-DESPACHO §4.5).
2. Antes de preparar el despacho se aplica el **criterio combinado RF-25** (PROCEDIMIENTO 3 / GENERALIDADES 3.5) que envía a la **cuadrilla 0**; modo vigente `SUPERVISOR` (D-59).
3. El despacho queda en **BORRADOR** reversible y re-generable.
**Criterios de aceptación:**
```gherkin
Dado casos con frases de campo y frases de supervisor mezclados
Cuando se genera la propuesta en modo SUPERVISOR
Entonces los de frases_supervisor y sin frases_campo van a la cuadrilla 0 y el resto queda repartible
```
```gherkin
Dado un despacho borrador ya generado
Cuando se regenera
Entonces la propuesta nueva sustituye al borrador anterior sin tocar los despachos ya publicados
```

### CU-W-32 — Revisar y ajustar la propuesta del despacho
**Actor(es):** `SUP`, `ADM`, `SUPER` · **RF:** RF-08, RF-24
**Flujo principal:**
1. En la etapa de preparación se pasan casos entre cuadrillas; por lote o caso se **asignan/quitan** casos (`agregar-casos`/`quitar-casos`).
2. Cada cambio queda reflejado en el listado y en el historial del despacho (RNF-12).
**Criterios de aceptación:**
```gherkin
Dado un despacho borrador con dos cuadrillas
Cuando el supervisor mueve un caso de una cuadrilla a la otra
Entonces el caso pertenece a la cuadrilla destino y deja de listarse en la de origen, con la alteración registrada
```
```gherkin
Dado un caso de un despacho ya publicado
Cuando se intenta quitar
Entonces el API rechaza la operación y sugiere el ajuste correcto (liberar por cierre de jornada o cambio de estado)
```

### CU-W-33 — Procesar el despacho por tipos y sectores (checklist)
**Actor(es):** `SUP`, `ADM`, `SUPER` · **RF:** RF-08 · D-113
**Flujo principal:**
1. Con **Procesar despacho** se abre `ProcesarDespacho` con **checklist por tipos** (reparación/construcción/referidos/empresas), zonas y selección de **cuadrilla por lote**, con las masivas en vista secundaria (D-113).
2. Al completar el checklist, el despacho queda preparado para publicar.
**Criterios de aceptación:**
```gherkin
Dado una propuesta con los tipos previstos
Cuando se procesa cubriendo el checklist completo
Entonces cada tipo queda con cuadrilla asignada y no quedan casos sin destino
```

### CU-W-34 — Publicar y enviar el despacho por canal
**Actor(es):** `SUP`, `ADM`, `SUPER` · **RF:** RF-10
**Flujo principal:**
1. El despacho pasa **BORRADOR → PUBLICADO** y queda visible para las cuadrillas (APK, CU-A-19).
2. **Envío por canal**: ficha de cuadrilla + sectores por Telegram/correo según el canal configurado; el envío queda registrado en notificaciones.
**Criterios de aceptación:**
```gherkin
Dado un despacho procesado
Cuando se publica
Entonces pasa a PUBLICADO y las cuadrillas ya lo reciben al sincronizar
```
```gherkin
Dado la publicación con el canal externo caído
Cuando se confirma el envío
Entonces la notificación queda en reintento por outbox y el despacho ya está publicado y operativo (RNF-20)
```

### CU-W-35 — Imprimir el despacho (carta)
**Actor(es):** `SUP`, `ADM`, `SUPER`, `COO` (lectura) · **RF:** RF-10
**Flujo principal:** se genera el **imprimible** del despacho en formato carta (cuadrillas, sectores, casos) para pizarra/archivo.
**Criterios de aceptación:**
```gherkin
Dado un despacho del día
Cuando se solicita el imprimible
Entonces el documento en formato carta lista cuadrillas y casos sin cortar la ficha de ninguno
```

### CU-W-36 — Consultar el reporte y la efectividad del despacho
**Actor(es):** `SUP`, `ADM`, `SUPER`, `COO` · **RF:** RF-27, RF-28 · D-146
**Flujo principal:**
1. El **reporte** del despacho consolida el día (atendidos, citados, referidos…).
2. La vista de **efectividad** muestra el ranking por periodos (D-146) con el rendimiento de la jornada.
**Criterios de aceptación:**
```gherkin
Dado días con despachos cerrados
Cuando se elige el periodo semanal
Entonces el ranking de efectividad cuadra con los cierres del periodo
```

### CU-W-37 — Seguir las construcciones del despacho
**Actor(es):** `SUP`, `ADM`, `SUPER`, `COO` · **RF:** RF-06, RF-08
**Flujo principal:** en DESPACHO se abre la vista de **construcciones** para el seguimiento de esos casos (cuadrilla asignada y etapa vigente).
**Criterios de aceptación:**
```gherkin
Dado construcciones asignadas a cuadrilla única
Cuando se consulta el seguimiento de construcciones
Entonces cada una muestra su cuadrilla y su estado vigente
```

### CU-W-38 — Ejecutar el cierre de jornada del despacho
**Actor(es):** `SUP`, `ADM`, `SUPER` · **RF:** RF-08 · **D-157 (vigente)**
**Flujo principal:**
1. Al finalizar el día se ejecuta **Cierre de jornada**: los casos **no atendidos** del despacho vuelven a pendiente y se liberan de las cuadrillas.
2. Los renglones liberados de `despacho_caso` pasan a **estado `DEVUELTO`** (no se borran: se conserva el histórico), la respuesta del corte trae `asignaciones_devueltas` y los casos dejan de pertenecer a su cuadrilla en APK/CASOS, conservando la ventana D-123 de trabajo reciente.
**Alternativos:** los casos `GESTIONADO`/terminales no se tocan; los citados conservan su cita.
**Criterios de aceptación:**
```gherkin
Dado un despacho publicado con casos CERRADO, GESTIONADO y sin atender
Cuando el supervisor ejecuta el cierre de jornada
Entonces la respuesta reporta el conteo de asignaciones_devueltas
Y los renglones de los no atendidos quedan DEVUELTO sin borrarse del histórico
```
```gherkin
Dado un caso devuelto por el cierre de la jornada anterior
Cuando el técnico sincroniza su APK o consulta CASOS en la web
Entonces el caso ya no aparece como asignado a esa cuadrilla
Y el histórico del despacho conserva la trazabilidad sin alterar las métricas históricas
```

## 1.9 Sección MASIVAS en la web

### CU-W-39 — Detectar fallas masivas de forma automática
**Actor(es):** `SUP`, `ADM`, `SUPER` (acción); `SIS` tras ingesta · **RF:** RF-09
**Flujo principal:**
1. Botón **Detectar masivas** en la cabecera (o detección automática post-ingesta) agrupa casos por **concentración de ODN/FAT** y crea o actualiza masivas activas.
2. El cuadro de masivas muestra cada una con los indicadores: ¿planificada? ¿materiales? ¿asignada a cuadrilla?
**Criterios de aceptación:**
```gherkin
Dado varios casos nuevos de un mismo ODN/FAT hoy
Cuando se ejecuta la detección
Entonces la masiva queda con los casos afectados asociados y el indicador sin planificar
```

### CU-W-40 — Agregar una masiva manual con casos candidatos
**Actor(es):** `SUP`, `ADM`, `SUPER` · **RF:** RF-09
**Flujo principal:**
1. En la pestaña **Agregar manual** se completan descripción, ODN, OLT/slot/puerto, FAT, dirección, sector, cuadrilla, origen y hasta 2 evidencias.
2. La acción **Buscar casos de ese FAT** lista los candidatos con casillas de **Asociar** y los vincula al crearse.
**Criterios de aceptación:**
```gherkin
Dado un FAT con 40 casos activos
Cuando se registra la masiva manual seleccionando 8 casos
Entonces la masiva se crea con los 8 casos asociados y origen MANUAL
```

### CU-W-41 — Editar la masiva (estado, sector, cuadrilla)
**Actor(es):** `SUP`, `ADM`, `SUPER` · **RF:** RF-09
**Flujo principal:** en la ficha → **Editar masiva**: cambia estado, sector, cuadrilla asignada, descripción y guarda.
**Criterios de aceptación:**
```gherkin
Dado una masiva activa sin cuadrilla
Cuando se asigna una cuadrilla y se guarda
Entonces el indicador de asignación pasa a marcado en el cuadro de masivas
```

### CU-W-42 — Asociar y desasociar casos de una masiva
**Actor(es):** `SUP`, `ADM`, `SUPER` · **RF:** RF-09
**Flujo principal:** en la ficha → **Casos asociados**: asociar por ids/averías, recargar y quitar por caso cuando la vinculación fue errónea.
**Criterios de aceptación:**
```gherkin
Dado un caso vinculado por error a una masiva
Cuando se quita de los asociados
Entonces deja de pertenecer a la masiva sin alterar su estado propio
```

### CU-W-43 — Planificar la masiva
**Actor(es):** `SUP`, `ADM`, `SUPER` · **RF:** RF-17
**Flujo principal:** pestaña **Planificar**: plan de atención (obligatorio), reporte simple, evidencias (máx. 10) y cuadrilla → estado **PLANIFICADA**.
**Criterios de aceptación:**
```gherkin
Dado una masiva detectada sin plan
Cuando se planifica con plan y cuadrilla y se guarda
Entonces queda PLANIFICADA y el indicador de planificación se marca en el cuadro
```

### CU-W-44 — Solicitar material para la masiva
**Actor(es):** `SUP`, `ADM`, `SUPER`, `COO` · **RF:** RF-18
**Flujo principal:** pestaña **Materiales**: se describe el material requerido y se registra la **orden** sobre la masiva y la cuadrilla; las órdenes vigentes se consultan por masiva.
**Criterios de aceptación:**
```gherkin
Dado una masiva planificada
Cuando se solicita material con descripción y cuadrilla
Entonces se crea una orden asociada visible en el listado de la masiva
```

### CU-W-45 — Cerrar la masiva y sus casos con el validador del CRASS
**Actor(es):** `SUP`, `ADM`, `SUPER` · **RF:** RF-17 · D-99
**Flujo principal:**
1. Pestaña **Cerrar**: descripción del trabajo (mínimo 10 caracteres), **validador CRASS activo de la misma central** (D-99), modo IVR/COS/SACAS, texto que queda en cada caso (por defecto «Reparado en FDT») y hasta 20 evidencias.
2. Confirmación irreversible → **cierre en cascada** de la masiva y sus casos con resumen (cerrados/omitidos).
**Criterios de aceptación:**
```gherkin
Dado una masiva PLANIFICADA con 24 casos asociados
Cuando el ADMIN cierra con un validador CRASS activo de la misma central
Entonces la masiva queda cerrada y los 24 casos reciben el texto del cierre
```
```gherkin
Dado una masiva de la central A con un validador de otra central o con estado no activo
Cuando se intenta cerrar
Entonces la operación se rechaza y ningún caso cambia de estado
```

### CU-W-46 — Generar el reporte de la masiva
**Actor(es):** Todos (según rol) · **RF:** RF-17 · RNF-13
**Flujo principal:** el icono **Reporte** genera el documento HTML imprimible de la masiva (datos técnicos, plan, materiales, cierre).
**Criterios de aceptación:**
```gherkin
Dado una masiva cerrada
Cuando se genera su reporte
Entonces el documento incluye el ciclo completo con el cierre y el validador registrado
```

### CU-W-47 — Ubicar masivas y consultar el histórico
**Actor(es):** Todos (según rol) · **RF:** RF-17
**Flujo principal:**
1. La pestaña **Ubicación** abre el mapa con el FAT y las coordenadas de las evidencias; sin coordenadas permite **Ubicar por la dirección** (geocodificar) y abrir en **OpenStreetMap**.
2. El **Histórico** lista masivas cerradas con filtros (texto, estado, origen, fechas) y accesos a reporte/ubicación por fila.
**Criterios de aceptación:**
```gherkin
Dado una masiva con evidencias con GPS
Cuando se abre la ubicación
Entonces el mapa marca el FAT y los puntos de las evidencias
```
```gherkin
Dado masivas históricas de distintos orígenes
Cuando se filtra el histórico por origen MANUAL y estado CERRADO
Entonces la lista paginada devuelve solo ese criterio
```
## 1.10 Sección CONFIGURACIÓN (`RutaGestion`: TECNICO fuera)

### CU-W-48 — Configurar las centrales
**Actor(es):** `SUPER`, `ADM`, `SUP` · **RF:** RF-38 · RNF-14
**Flujo principal:**
1. En CENTRAL: **Nueva central** (región, estado geográfico, capital, municipio, parroquia, estado operativo, distrito, área, código y nombre) o editar/crear.
2. Cada central puede **desactivarse**; el filtro «Solo activas» limita la vista.
**Criterios de aceptación:**
```gherkin
Dado una central nueva con los datos obligatorios
Cuando se crea
Entonces queda disponible como alcance para usuarios, ingesta y despacho (multi-central, RNF-14)
```
```gherkin
Dado una central desactivada
Cuando se listan solo activas
Entonces no aparece en los selectores de las demás secciones
```

### CU-W-49 — Configurar los sectores y sus direcciones
**Actor(es):** `SUPER`, `ADM`, `SUP` · **RF:** RF-23, RF-38 · RNF-10
**Flujo principal:**
1. **Nuevo sector** (central, nombre, código, prioridad 1–999, descripción, activo).
2. Al crear/editar se administran **direcciones/patrones frecuentes** (patrón + tipo `CONTIENE`/`EXACTO`/`REGEX`, normalizar, activar, quitar).
3. Los patrones alimentan la sectorización de la ingesta (RF-23).
**Criterios de aceptación:**
```gherkin
Dado un patrón CONTIENE nuevo para la Av. Bolívar
Cuando se re-sectorizan los pendientes
Entonces los casos cuya dirección contiene el patrón quedan en ese sector
```
```gherkin
Dado una dirección de un sector activo
Cuando se quita el patrón
Entonces los casos ya sectorizados conservan su sector y los nuevos se re-evalúan con lo vigente
```

### CU-W-50 — Administrar técnicos, accesos y roles
**Actor(es):** `SUPER`, `ADM`, `SUP` (con restricciones) · **RF:** RF-02, RF-05 · RNF-21/22 · D-50
**Flujo principal:**
1. **Nuevo técnico** o **Editar**: central, nombre, apellido, cédula, P00 (fijo al editar), teléfono, correo, especialidad y estado (ACTIVO/INACTIVO/VACACIONES/SUSPENDIDO).
2. Asignar el **rol de acceso** (Técnico/Supervisor/Administrador) queda **solo para SUPER o SUPERVISOR**; SUPER no es modificable (D-50); la cuenta queda pre-registrada para el primer acceso (CU-W-04).
3. Filtro por central y por estado; chips de estado de cuenta (Activo/Sin alta/Bloqueado/Cambio de clave/Inactivo). Bloque inferior: **Personal externo** (CU-W-56).
**Criterios de aceptación:**
```gherkin
Dado un técnico nuevo con sus datos y rol TECNICO
Cuando se registra
Entonces aparece con chip "Sin alta" y puede activar su cuenta por primer acceso
```
```gherkin
Dado un ADMIN de otra central
Cuando intenta editar el rol de un técnico
Entonces la acción está bloqueada por rol/central (matriz §5.2)
```

### CU-W-51 — Regenerar las 12 palabras de un técnico
**Actor(es):** `SUPER` · **RF:** RF-20 · RNF-01
**Flujo principal:** en CONFIGURACIÓN → TÉCNICOS, acción **Palabras** (solo SUPER) regenera las 12 palabras de seguridad de la cuenta, con confirmación; las anteriores quedan inservibles.
**Criterios de aceptación:**
```gherkin
Dado un técnico que perdió sus palabras
Cuando el SUPER regenera
Entonces se entrega la lista nueva de una sola vez y las anteriores no desbloquean la cuenta
```

### CU-W-52 — Gestionar la flota
**Actor(es):** `SUPER`, `ADM`, `SUP` · **RF:** RF-03
**Flujo principal:**
1. **Nuevo vehículo** (central, CAN, tipo, marca, modelo, placa, combustible, estado de cauchos/fluidos/general).
2. Ciclo de estado de vehículos: `DISPONIBLE → EN_RUTA → MANTENIMIENTO → FUERA_SERVICIO` y acción **Fuera de servicio** con confirmación.
**Criterios de aceptación:**
```gherkin
Dado un vehículo en revisión
Cuando el supervisor lo marca FUERA_SERVICIO
Entonces deja de ser seleccionable como flota en nuevas cuadrillas
```

### CU-W-53 — Gestionar cuadrillas e integrantes
**Actor(es):** `SUPER`, `ADM`, `SUP` · **RF:** RF-04
**Flujo principal:**
1. **Nueva cuadrilla** (central, código, nombre, vehículo, marca de **es supervisora**, activa).
2. Gestión de **integrantes** (técnico + rol `REPARADOR_PRINCIPAL`/`AYUDANTE`/`SUPERVISOR` con alta y retiro confirmado) y herramientas (ids al alta).
3. La composición alimenta el despacho y el alcance del técnico (qué casos ve).
**Criterios de aceptación:**
```gherkin
Dado una cuadrilla activa con 3 integrantes y flota
Cuando se incorpora un técnico nuevo con rol AYUDANTE
Entonces el listado lo muestra y el técnico empezará a ver los casos de esa cuadrilla
```
```gherkin
Dado un integrante retirado
Cuando se confirma el retiro
Entonces deja de operar en esa cuadrilla y el histórico de despachos lo conserva
```

### CU-W-54 — Administrar catálogos (causas y métodos)
**Actor(es):** `SUPER`, `ADM`, `SUP` · **RF:** RF-31 · RNF-10
**Flujo principal:**
1. **Causas**: alta con código, subcódigo, tipo, descripción(es) y desactivación.
2. **Métodos**: alta por dominio (`CIERRE`/`ENRUTE`/`DIFERIDO`/`CONTACTO`) con código/nombre/activo; quedan disponibles en la app sin despliegue.
**Criterios de aceptación:**
```gherkin
Dado una causa nueva habilitada
Cuando se edita un caso en CASOS
Entonces la lista de causas ofrece la nueva como opción seleccionable
```

### CU-W-55 — Editar los parámetros del sistema
**Actor(es):** `SUPER`, `ADM`, `SUP` · **RF:** RNF-10 · D-22/D-59 (listas del criterio combinado)
**Flujo principal:** en PARÁMETROS se edita el campo **valor JSON** de cada clave con validación de sintaxis; ahí viven las listas de frases de `despacho.frases_campo`/`frases_supervisor` y los modos `CAMPO`/`SUPERVISOR`/`UNION`.
**Criterios de aceptación:**
```gherkin
Dado la lista de frases_supervisor vigente
Cuando el supervisor agrega una frase y guarda un JSON válido
Entonces la próxima preparación de despacho usa los criterios actualizados sin cambiar código
```
```gherkin
Dado un valor que no es JSON válido
Cuando se intenta guardar
Entonces la edición se rechaza con error y el valor previo no cambia
```

### CU-W-56 — Gestionar el catálogo de personal externo
**Actor(es):** `SUPER`, `ADM`, `SUP` · **RF:** RF-06 · D-156
**Flujo principal:** en la base de TÉCNICOS se consulta el **Personal externo** (solicitantes: unidad + nombre + contacto), usado para dar de alta especiales (CU-W-26) y como fuente de **validadores CRASS** para el cierre de masivas (D-99).
**Criterios de aceptación:**
```gherkin
Dado un solicitante externo registrado con tipo CRASS y estado activo
Cuando se abre el cierre de una masiva de su central
Entonces aparece en el desplegable de validadores del CRASS
```

## 1.11 Mensajes · Perfil · Sistemas

### CU-W-57 — Enviar un mensaje interno a través de la web
**Actor(es):** `SUPER`, `ADM`, `SUP` (envío); `COO` solo a un Supervisor · **RF:** RF-10 · D-81
**Flujo principal:**
1. En MENSAJES → **Enviar**: destino `TODOS` (con selectores condicionales) o cuerpo del mensaje con límite de 500 caracteres.
2. `COO` ve su bloque especial: desplegable de supervisor (o *Escalar al Administrador* si no hay activo).
3. El envío queda en **Enviados** y el badge de no leídos en destino con sondeo cada 20 s.
**Criterios de aceptación:**
```gherkin
Dado un supervisor con su cuadrilla activa
Cuando envía un mensaje a TODOS
Entonces el mensaje llega de inmediato en el badge y el historial de la bandeja
```
```gherkin
Dado un coordinador sin supervisores activos en su central
Cuando abre su bloque de mensajería
Entonces puede activar "Escalar al Administrador" y enviar con ese destino
```

### CU-W-58 — Consultar la bandeja de mensajes
**Actor(es):** Todos · D-81
**Flujo principal:** pestañas **Recibidos/Enviados** (enviados solo si puedeEnviar), agrupación/no leídos, clic en el mensaje lo marca como leído; sondeo de nuevos cada 20 s.
**Criterios de aceptación:**
```gherkin
Dado 3 mensajes no leídos
Cuando la bandeja se refresca y se toca una burbuja
Entonces el mensaje queda marcado como leído y sale del grupo de no leídos
```
```gherkin
Dado un técnico con mensajes nuevos
Cuando abre la web
Entonces el badge muestra el número actualizado de no leídos
```

### CU-W-59 — Mantener el perfil y la cuenta propios
**Actor(es):** Todos · **RF:** RF-20 · RNF-22
**Flujo principal:**
1. En **Perfil y Cuenta**: ficha de identidad (P00, nombre, rol, central) y edición del **correo** propio (`PATCH /auth/me`).
2. **Cambiar clave** actual + nueva (mínimo 8) + confirmación.
3. Ficha de **palabras de seguridad** (estado/cantidad/versión); solo `SUPER` puede regenerar sus propias 12 palabras con modal de copiado único.
**Criterios de aceptación:**
```gherkin
Dado un usuario con correo obsoleto
Cuando lo actualiza y guarda
Entonces la recuperación al correo vigente llega a la nueva dirección
```
```gherkin
Dado un usuario con su clave vigente
Cuando la cambia por una nueva (≥ 8) y guarda
Entonces la siguiente sesión exige la nueva y la anterior ya no accede
```

### CU-W-60 — Regenerar las propias palabras de seguridad (SUPER)
**Actor(es):** `SUPER` · RF-20
**Flujo principal:** en Perfil, el SUPER confirma y regenera **sus 12 palabras**; se muestran una sola vez con botón «Las he copiado».
**Criterios de aceptación:**
```gherkin
Dado las palabras del SUPER obsoletas o expuestas
Cuando se regeneran
Entonces las anteriores dejan de funcionar en cualquier intento de desbloqueo
```

### CU-W-61 — Consultar el log de sincronizaciones con checklist
**Actor(es):** `SUPER`, `ADM`, `SUP` · D-81 · RNF-12, RNF-19
**Flujo principal:**
1. En **Sistemas → Sincronización** se ven los indicadores del día (Total/OK/Parcial/Error/En proceso) y filtros por **Estado, Tipo (Descarga|Carga) y búsqueda por P00**.
2. Cada sesión abre la ficha con el **checklist** (conexión · login · descarga · carga: paso/estado/hora/detalle).
**Criterios de aceptación:**
```gherkin
Dado un lote de sesiones con una falla de descarga
Cuando se filtra por estado ERROR y tipo DESCARGA
Entonces la lista muestra solo esa sesión
```
```gherkin
Dado una sesión con descarga fallida
Cuando se abre la ficha
Entonces el checklist marca la fase y muestra el detalle del error para seguimiento
```

### CU-W-62 — Inspeccionar la base de datos (SUPER)
**Actor(es):** `SUPER` · D-69/D-81 · RNF-12
**Flujo principal:**
1. Pestaña **Base de datos**: análisis de estructura (motor, tablas, renglones, espacio, extensiones) con botón **Reanalizar**.
2. Tabla de tablas con filas clicables → ficha de la entidad con selector de tabla, filtro de columnas y paginación de contenido (50 renglones/página), con aviso de columnas ofuscadas.
**Criterios de aceptación:**
```gherkin
Dado el SUPER en la inspección
Cuando re-analiza la estructura
Entonces los renglones de tablas coinciden con el conteo SQL y el contenido respeta la ofuscación marcada
```
```gherkin
Dado un usuario no SUPER en la pestaña de Base de datos
Cuando accede por ruta directa

## 3.1 Matriz RF → casos de uso (WEB + APK)

| RF | Requerimiento (síntesis) | CUs web | CUs APK |
|---|---|---|---|
| RF-01 | Cargar CSV diario | W-11 | — |
| RF-02 | Perfiles/accesos de trabajadores | W-50, W-51 | A-05 |
| RF-03 | Flota | W-52 | — |
| RF-04 | Cuadrillas | W-53 | A-29 |
| RF-05 | Insumos/medios (v2) | W-50 (órdenes) | A-27 |
| RF-06 | Casos especiales | W-13, W-26, W-27, W-28, W-37 | A-32, A-33 |
| RF-07 | Reportes capacidad/fn diaria | W-15, W-36 | A-30 |
| RF-08 | Despacho diario | W-31…W-35, W-22, W-38 | A-31 |
| RF-09 | Fallas masivas | W-16, W-17, W-39, W-40, W-41, W-42, W-47 | A-23, A-24, A-25 |
| RF-10 | Envío ficha de cuadrilla/sectores; reporte 16:00 | W-34, W-35, W-57 | A-31 |
| RF-11 | Ficha de casos asignados | W-19, W-20 | A-08, A-24, A-25 |
| RF-12 | Contactar/agendar | W-29, W-30 | A-10, A-11, A-12 |
| RF-13 | Documentar actividad | W-20, W-21 | A-14, A-15, A-16 |
| RF-14 | Fotos GPS+fecha (sin galería) | — | A-17, A-23 |
| RF-15 | Documentar resolución | W-21 | A-14…A-16 |
| RF-16 | Alertar falla masiva | W-17, W-39 | A-23 |
| RF-17 | Planificar masivas | W-18, W-43, W-45, W-46, W-47 | A-26, A-28 |
| RF-18 | Solicitud de material | W-18, W-44 | A-27, A-34 |
| RF-19 | Incidentes flota/herramientas | W-17 (manual) | — |
| RF-20 | Login/bloqueo/12 palabras/PIN | W-01…W-06, W-59, W-60 | A-01…A-07, A-36 |
| RF-21 | Ingesta SAS/filtro | W-11 | — |
| RF-22 | Deduplicación | W-11 | — |
| RF-23 | Sectores | W-12, W-49 | — |
| RF-24 | Propuesta despacho | W-31, W-32 | A-31 |
| RF-25 | Cuadrilla 0 criterio combinado | W-13, W-31, W-55 | A-29 |
| RF-26 | Tableros monitoreo/gráficos | W-14, W-23 | A-30 |
| RF-27 | Reporte producción 16:00 | W-36 | A-31 |
| RF-28 | Reporte trabajo d/s/m | W-14, W-15 | A-30 |
| RF-29 | Documentar cada carga | W-11 | — |
| RF-30 | Buscar caso | W-07, W-08 | A-08 |
| RF-31 | Actualizar/editar caso | W-20, W-21 | A-13 |
| RF-32 | Alta manual | W-09 | — |
| RF-33 | Universo de casos | W-19, W-21 | A-09 |
| RF-34 | Seguimiento | W-24, W-25 | — |
| RF-35 | Empresas | W-26 (clasificación), W-29 | — |
| RF-36 | Referidos prioritarios | W-26, W-29 | — |
| RF-37 | Gestión cuadrilla 0 | W-13 | A-29 |
| RF-38 | Central/sectores config | W-48, W-49 | — |

## 3.2 RNF y decisiones cubiertas

| RNF | Criterio | CUs de cobertura |
|---|---|---|
| RNF-01 | Bloqueo 3 intentos + 12 palabras | W-02/03/04, A-02/04/05 |
| RNF-04 | Solo cámara (sin galería) | A-17, A-23 |
| RNF-05 | Bloqueo app por privacidad | A-06 |
| RNF-06 | Operación offline + sinc. async. | A-03, A-08, A-18, A-19 |
| RNF-09 | Usabilidad de campo (3 toques / 20 s) | A-10, A-14 |
| RNF-10 | Configuración sin código | W-49, W-54, W-55 |
| RNF-12 | Bitácora por caso y despacho | W-20, W-21, W-32, W-61 |
| RNF-13 | Español + formato dd/mm/aaaa | W-15, W-23, W-35, W-46 |
| RNF-18 | Aviso legal/PII | W-01, A-01 |
| RNF-19/20 | Observabilidad + outbox | W-16, W-34, W-61 |
| RNF-21 | RBAC y alcance por central | W-14/19/20/47/62, A-14 |
| RNF-22 | Endurecimiento de acceso | W-02/03/04/59/60, A-02/03/04/05/06 |
| — | D-71 aviso de uso | W-01, A-01 |
| — | D-81 mensajería + sistemas | W-57/58/61, A-34/35 |
| — | D-99 validador CRASS | W-45, A-28 |
| — | D-100 PIN sin conexión | A-03 |
| — | D-105 resueltos invisibles | W-13, A-09 |
| — | D-113 checklist por tipos | W-33, A-31 |
| — | D-115 actualización única | A-22 |
| — | D-116 pendientes en APK | A-18, A-21 |
| — | D-123 trabajo reciente | W-38, A-19 |
| — | D-144 filtros de casos | A-08 |
| — | D-146 ranking de efectividad | W-36 |
| — | **D-157 devolución de asignados** | W-38, A-19 |

## 3.3 Notas de testeabilidad y verificación

1. **Cada criterio de aceptación es comprobable** con el harness vigente:
   - API → `app/tests/*_api.py` (pytest con PostgreSQL temporal, `scripts/tmp_pg_pytest.ps1`).
   - Web → pruebas de contrato por pantalla (`npm run build` verde + Playwright sobre el bundle).
   - APK → `flutter test / app_movil/test` (d93, d156, d157 ya existentes) + pruebas manuales en dispositivo de campo.
2. **Severidad de lo no cubierto en este documento:** los canales Telegram/WEB-MCP (RF-06/16/25 vía IA y bot) y el flujo del solicitante externo ACT-03 requieren su propio documento de casos de uso; no se inventó funcionalidad.
3. **Marca de rendimiento:** los SLO p95 de RNF-08 (despacho ≤ 2 s, panel ≤ 2 s) se verifican en la fase de pruebas, no como criterio de cada CU.
4. **Convergencia de doble canal:** varios CUs existen en web y APK (ej. cierre de masiva W-45/A-28, especial W-26/A-32). Ambos comparten el mismo backend; las pruebas de contrato se corren una vez por endpoint y por pantalla una vez por canal.

---
