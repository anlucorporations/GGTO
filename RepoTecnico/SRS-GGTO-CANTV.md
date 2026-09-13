# Documento de Especificacion de Requisitos de Software (SRS)
## Sistema Centralizado de Gestion de Casos GPON - CANTV
**Central:** Francisco Salias (Area 4)  
**Version:** 1.0  
**Fecha:** Septiembre 2026  
**Formato:** Microsoft Excel con Macros Habilitadas (.xlsm)  

---

## 1. Introduccion y Proposito
El presente documento define la especificacion tecnica y funcional completa del sistema **GGTO-v1** (Gestion GPON Tecnico-Operativa) desarrollado en Microsoft Excel habilitado para macros (.xlsm) para la **Central Francisco Salias (Area 4)** de la Compania Anonima Nacional Telefonos de Venezuela (**CANTV**).

El sistema centraliza el universo de reportes de averias y requerimientos de construccion de puntos opticos, automatiza la ingesta diaria de datos desde el sistema matriz, realiza el despacho inteligente y balanceado hacia las cuadrillas activas de campo, canaliza el triaje telefonico preventivo para casos sin perdida fisica de enlace, y provee visualizacion en tiempo real de indicadores operativos diarios y semanales.

---

## 2. Restriccion Arquitectonica Fundamental: Carpeta Unificada (Single-Folder Execution)
- El libro central (CONTROL_DESPACHO_GGTO-v1.xlsm) opera en una carpeta de trabajo unica (ThisWorkbook.Path).
- Todos los archivos de ingesta diaria (detalle_averias_gpon_*.csv, casos_abiertos_gpon_REFERIDOS.csv) se depositan directamente en esta misma carpeta.
- Todos los archivos exportados (planillas de despacho en PDF para cada cuadrilla) se generan en esta misma carpeta de trabajo.
- Queda estrictamente prohibido el uso de rutas absolutas locales (C:\Users\...). Todo el codigo VBA resuelve dinamicamente las rutas a traves de ThisWorkbook.Path & Application.PathSeparator.

---

## 3. Catalogo de Requisitos Funcionales (RF)

### RF-01: Ingesta Automatizada de Casos GPON
- **RF-01.1**: Deteccion automatica en la carpeta de trabajo de los archivos con patron de nombre detalle_averias_gpon_*.csv y casos_abiertos_gpon_REFERIDOS.csv.
- **RF-01.2**: Soporte para delimitadores comunes (coma , y punto y coma ;) y codificaciones UTF-8 / Windows ANSI.
- **RF-01.3**: Filtrado operativo estricto de la data matriz: solo se procesan e importan los registros cuya Central coincida con Francisco Salias y Area 4 (segun los parametros configurados en la pestana CONFIGURACION).
- **RF-01.4**: Verificacion de duplicidad por clave primaria ID AVERIA. Si el ID ya existe en la pestana CASOS, el registro se descarta para evitar duplicaciones.
- **RF-01.5**: Asignacion automatica de la fecha de ingesta en el campo Fecha Ingreso.
- **RF-01.6**: Incorporacion de casos del archivo complementario de REFERIDOS, tipificandolos automaticamente con prioridad y clase Referidos.
- **RF-01.7**: Al culminar la ingesta, refresco automatico de las formulas de MONITOREO y notificacion al usuario con el total de casos nuevos ingresados y descartados.

### RF-02: Panel de Control y Operaciones Rapidas
- **RF-02.1 - Busqueda de Casos**: Formulario/seccion en hoja PANEL que permite ingresar un ID Averia o numero de Telefono, localizando el registro en CASOS y mostrando en pantalla todos los datos del suscriptor, falla y cuadrilla asignada.
- **RF-02.2 - Actualizacion Rapida**: Posibilidad de modificar directamente el estatus del caso buscado (Resuelto, Diferido, Enrutado, etc.), indicando fecha de cierre, metodo de cierre (IVR, COS, SACAS) y comentarios finales.
- **RF-02.3 - Ingreso Manual de Caso**: Posibilidad de dar de alta averias o solicitudes que lleguen por canales alternos (correo, WhatsApp, llamadas) ingresando datos minimos: Fecha, Tipo, Actividad, Contacto, Nombre, Direccion, Informacion, Agente.

### RF-03: Triaje y Normalizacion Preventiva (Pestana GESTION)
- **RF-03.1**: Escaneo de todos los casos abiertos en las columnas descriptivas de falla (Falla Reportada, Ultimo Comentario, problema_reporte).
- **RF-03.2**: Deteccion de averias que NO presenten los descriptores de falla fisica ('LOSS ROJO', 'FALLA FIBRA', 'Fibra Danada').
- **RF-03.3**: Copiado de estos casos hacia la pestana GESTION para que el supervisor o la mesa de ayuda realice contacto telefonico de validacion antes de asignar recursos y cuadrillas a la calle.

### RF-04: Gestion Especializada (EMPRESAS, REFERIDOS, SEGUIMIENTO)
- **RF-04.1 - EMPRESAS**: Vista dedicada de los casos corporativos/empresariales, facilitando la programacion de citas, contacto tecnico y seguimiento de SLA.
- **RF-04.2 - REFERIDOS**: Vista de casos prioritarios canalizados por instancias especiales, con clasificacion de nivel de prioridad y fecha agendada.
- **RF-04.3 - SEGUIMIENTO**: Concentrador de casos que no pueden cerrarse en campo y pasan a colas de escalamiento (corte de cable troncal, OLT saturada, requerimiento de infraestructura civil, etc.).

### RF-05: Despacho Diario Inteligente a Cuadrillas
- **RF-05.1**: Identificacion de cuadrillas operativas activas desde la pestana CONFIGURACION.
- **RF-05.2**: Agrupacion geografica por sectores de averias pendientes para concentrar los recorridos y reducir tiempos de traslado.
- **RF-05.3 - Reglas de Asignacion Obligatorias**:
  - Prioridad 1: Casos agendados o citados para la fecha del despacho.
  - Cuota Referidos: Asignar al menos 1 caso de Referidos por cada cuadrilla activa.
  - Cuota Empresas: Asignar al menos 1 caso de Empresas por cada cuadrilla activa.
  - Regla de Construccion: Si existen casos de actividad Construccion (Residencial o Empresarial), se le asignara como maximo a una sola cuadrilla, seleccionando aquella cuadrilla que tenga asignadas reparaciones en ese mismo sector geografico.
- **RF-05.4**: Actualizacion de la cuadrilla asignada y estatus en la pestana CASOS y vaciado de la orden de trabajo en la pestana DESPACHO.

### RF-06: Exportacion de Ordenes de Trabajo en PDF
- **RF-06.1**: Ajuste de la hoja DESPACHO a un diseno optimizado para impresion en formato Carta Horizontal (Landscape).
- **RF-06.2**: Generacion automatizada de un archivo PDF por cada cuadrilla con sus casos asignados, guardandolo en la carpeta raiz del proyecto bajo el formato Despacho_[Cuadrilla]_[YYYYMMDD].pdf.

### RF-07: Indicadores Operativos y Cuadro de Mando (MONITOREO y GRAFICOS)
- **RF-07.1**: Tabla de Gestion Diaria (Nuevos ingresos, Resueltos Residencial, Resueltos Empresarial, Resueltos Referidos).
- **RF-07.2**: Tabla de Gestion Semanal (comparativa acumulada lunes a sabado).
- **RF-07.3**: Casos Globales (balance pendientes vs. resueltos).
- **RF-07.4**: Desglose de Reparacion (Residencial comun, Residencial referidos, Empresas).
- **RF-07.5**: Desglose de Construccion (Residenciales vs. Empresariales).
- **RF-07.6**: Rendimiento de Cuadrillas (Casos asignados vs. cerrados vs. gestionados).
- **RF-07.7**: Panel de 6 graficos interactivos vinculados a los KPIs de MONITOREO.

---

## 4. Requisitos No Funcionales (RNF)
- **RNF-01 - Usabilidad y Diseno**: Interfaz con identidad corporativa de CANTV. Colores primarios Azul Marino (#002D62) y Azul Corporativo (#004B87), acento Celeste (#0084D6), fondo de datos limpio con lineas alternadas y tipografia Segoe UI.
- **RNF-02 - Rendimiento y Optimizacion**: Las macros deben ejecutar el volcado masivo en arreglos en memoria (VBA Arrays), suspendiendo el refresco de pantalla y calculo automatico para tiempos de respuesta inferiores a 5 segundos.
- **RNF-03 - Integridad y Resiliencia**: Manejo integral de excepciones con bloques On Error GoTo, garantizando restauracion del entorno de Excel ante fallos.
- **RNF-04 - Cero Dependencias Externas**: Operacion nativa en Excel sin instaladores de terceros.

---

## 5. Requisitos Tecnicos (RT) y Entorno
- **RT-01 - Formato**: .xlsm (Excel Macro-Enabled Workbook, Office Open XML).
- **RT-02 - Lenguaje**: Visual Basic for Applications (VBA 7) compatible con 32-bit y 64-bit.
- **RT-03 - Compatibilidad**: Microsoft Excel 2016, 2019, 2021 y Microsoft 365 (Windows 10 / 11).
- **RT-04 - Codificacion**: Admision transparente de archivos CSV en UTF-8 y ANSI con deteccion automatica de separador (, o ;).
