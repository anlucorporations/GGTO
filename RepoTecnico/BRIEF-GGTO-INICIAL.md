\[OBJETIVO]
crear un sistema de administracion de reportes de averia y construccion de puntos opticos para la empresa CANTV CA. este sistema de administracion tendra como base de informacion inicial un archivo de excel que se descarga diariamente del sistema interno de cantv, alli un resumen que contiene los datos Tecnicos, Logicos, Administrativo, Identificativo de servicio, etc de cada reporte de caso, Tambien se nutrira de casos manuales que se introduciran por los distintos canales (correo/wathsapp/app Movil) que son de clasificacion de Referidos o solicitudes de otras areas de la empresa (como la construccion de puntos opticos por parte de la Unidad de Masivos o la Unidad de Empresas) . este sistema debe gestionarce de forma multi plataforma (desde la pc, desde telegram/WhatsApp y desde una app en el movil (apk con actualizacion asincrona) de los trabajadores, con un sistema de almacenamiento de datos vasado en una hoja de excel. los trabajadores deben logiarce para ingresar.

\[GENERALIDADES]

1. las funciones de cara al supervisor de la central (en la app Movil o pc):
1.1 cargar el documento de casos diarios mediante el archivo detalle\_averias\_gpon\_\*.csv (su fecha varia por cada dia).
1.2 crear los perfiles y accesos de los trabajadores.
1.3 Gestionar las Flotas.
1.4 Gestionar las cuadrillas (trabajadores + Flota).
1.5 Gestionan el manejo de los insumos, cantidad en inventario, ingreso de material segun las ordenes de material, entrega de material a los trabajadores. (para una 2da version).
1.6 gestionan la ingesta o asignacion de solicitudes manuales de casos de otras instacnias de la empresa ( Referidos de Reparacion, Construccion Recidencial, Contruccion Empresa).
1.7 genera reporte de Capacidad Operativa ( Cuadrilla+Sectores a trabajar), estado de las flotas y herramientas y reportes de funcion Diaria (Cuadrilla+Despacho del dia).
1.8 gestiona el Despacho Diario asignando un grupo de Casos a las diferentes cuadrillas activas para cada dia. (asignando las areas geograficas de trabajo segun los casos activos).
1.7. Gestionar la fallas masivas; estos casos son asignado a la cuadrilla con mayor cercania.
2. Las funciones de los trabajadores (en la app Movil):
2.1 gestionar los casos de su cuadrilla. el tecnico puede consultar la ficha de cada caso.
2.1.1. contactar y acordar horas de encuentro con los clientes.
2.1.2. documentar la actividad realizada en cada caso, incluyendo la toma de registro fotografico de las evidencias segun sea el caso.
2.1.3. documentar la resolucion de los caso.
2.2. alertar los casos de Falla masiva y su resolucion o planificacion para el siguiente dia (justificado con reporte simple y evidencias fotograficas); estos casos son ingresados por el supervisor o por descubrimiento en campo por la cuadrilla.
2.3 alertar de incidentes con la flotas o herramientas (reporte simple con evidencias fotograficas).
3. las funciones del sistema:
3.1 procesar el archivo de casos diarios suministrado por el supervisor. se extraen los casos solo de la central (configurable por el supervisor)
3.2 ingresar solo los casos nuevos al documento central que servira de Base de datos del sistema. (control\_averias\_gpon\_central\_\*.xlsm).
3.3 actualizar los sectores de trabajo segun el documento central (pestana AVERIAS).
3.4 proponer la distribucion de los casos (despacho diario) entre las cuadrillas declaradas tomando los casos del documento central (pestana AVERIAS).
3.5 generar reporte de gestion diaria de casos (pendientes, diario, resueltos, agendados).

\[CONTEXTO]

crear un documento central en formato excel con marcos habilitados (.xlsm) para la gestion de los casos (repoortes de averia) de la central Francisco Salias (area 4), dode pueda conformar el despacho diario a las cuadrillas declaradas, crear sectores de averias concentradas, tener un seguimientos a los casos especiales y generar el reporte de trabajo diario y de gestion semanal.

\[DETALLE]

El archivo funcionara como un elemento que concentra toda la informacion de manera practica distribuyendolo en pestanas funcionales:
0. PANEL: tendra una seccion (o ficha) donde se pueda buscar, al hacer click en un boton, la informacion basica partiendo del Id de averia o del Telefono (busca los datos en la pestana CASOS), una seccion para actualizar los casos, al hacer click en un boton, segun su resolucion partiendo del Id de averia o del Telefono (actualizar los datos en la pestana CASOS), una seccion donde se pueda ingresar nuevos casos, al hacer click en un boton, partiendo de informacion sencilla (Fecha, Tipo, Actividad, Contacto, Nombre, Direccion, Informacion, Agente, ETC).
0.1 MONITOREO: aqui tendremos Zonas Donde se mostraran Graficos con tabla descriptiva de GESTION DIARIO (lado Izquierdo) donde se refleja la informacion de gestion diaria (ingreso nuevo, Resuelto Rescidencial, Resuelto Empresarial, Resuelto Referidos), GESTION SEMANAL (grafico de curva) donde se muestran los datos comparativos de la semana (lunes - sabado), los CASOS GLOBALES (grafico de barra) donde se muestra los datos de comparacion entre el pendiente y lo resuelto, REPARACION donde se muestra el total actual de los casos pendientes de reparacion (Recidenciales Comunes, Recidenciales Referidos, Empresariales), CONSTRUCCION donde se muestra el total de casos pendientes de Construccion (Recidenciales, Empresariales) y CUADRILLA donde se muestra la relacion por dia, durante la semana, de los casos asignados Vs Cerrados Vs Gestionados
0.2 GRAFICOS: aqui tendremos Zonas Donde se mostraran Graficos, con la informacion proveniente de la pestana MONITOREO, distribuido en zona GESTION DIARIO (grafico de barra), GESTION SEMANAL (grafico de curva), CASOS GLOBALES (grafico de barra), REPARACION (grafico de torta), CONSTRUCCION (grafico de barra) y CUADRILLA (grafico de barra).

1. CASOS: alberga la data principal donde se registraran los casos y la resolucion (casos de Contruccion/Reparacion en tipo Recidencial/Empresa/Referidos).
2. DESPACHO: servira como base para distribuir el universo de las averias entre las cuadrillas agrupando por direccion (sectores cercanos) de forma que cada cuadrilla pueda focalizar el trabajo.
3. SEGUIMIENTO: aqui se albergaran todos los casos que fueron pasado a otras instancias (en cola) para ser tratado por alguna causa.
4. EMPRESAS: aqui se albergara un resumen de las actividades de reparacion o Construccion de tipo Empresas, esta informacion Tambien registrara la cita para su atencion.
5. REFERIDOS: aqui se albergara un resumen de las actividades de reparacion o Construccion de tipo Referidos clasificados por nivel de prioridad, esta informacion Tambien registrara la cita para su atencion.
6. CONFIGURACION: se cargaran la informacion necesaria para la configuracion de todo el entorno, las secciones que maneja son:
6.1 CENTRAL: alberga la direccion Operativa de la central de trabajo (region, estado geografico, capital estado geografico, municipio, parroquia, estado operativo, distrito, area, central, nombre central), esta es la base principal de filtro para la estraccion del archivo matris).
6.2 TECNICOS: alberga los datos de todas los trabajadores de la central (Nombre, Cedula, P00, Telefono, Correo, Especialidad, Status).
6.3 FLOTA: alberga los datos de los vehiculos que operan en la central (CAN00, Tipo, Marca, Modelo, Placa, Combistible, Status, Estado Cauchos, Estado Fluidos, Estado General).
6.4 CUADRILLA: alberga los datos de la cuadrilla.
7. PLANTILLA: alberga las estructura de la tabla detalle con su traduccion en la pestana CASOS, Tambien clasifica las columna en renglones de informacion.
8. GESTION: en esta pestana se albergan todos los casos que deben ser consultados via Telefonica para clasificar correctamente los casos y ser mas eficiente en las actividades de calle.



\[PROCEDIMIENTOS]

\[1. INGESTA]

Este procedimiento ingresa NUEVOS casos partiendo de un archivo matrix llamado detalle\_averias\_gpon\_\[fecha].csv y casos\_abiertos\_gpon\_REFERIDOS.csv, aqui se encuentra toda la informacion Operativa, Administrativa, Tecnica, Logica y complementativa de cada caso, este archivo es proporcionado diariamente y contiene el universo de las averias para el area operativa, donde se deben clasificar y extraer los datos escenciales para alimentar el documento centralizado para su gestion. el procedimiento que se ejecuta manualmente es:

1.se filtra en el archivo detalle los datos operativos para obtener solo los casos de la central (region, estado geografico, capital estado geografico, municipio, parroquia, estado operativo, distrito, area, central, nombre central), datos en la pestana CONFIGURACON del documento central.
2. se extraen los datos de los casos segun la estructura de la pestana CASOS del documento central.
3. se descartan los casos que ya se encuentren en el documento central, se busca por su ID AVERIA para solo incertar los casos nuevos.

4\. se insertan los casos nuevos al documento central en la pestana CASOS incorporando la fecha actual en la columna Ingreso.
5. se toma el documento complementario (casos\_abiertos\_gpon\_REFERIDOS.csv) y se extrae los datos de los casos segun la estructura de la pestana CASOS del documento central.
6. se comparan la informacion de los casos de los documento complementario con los casos en el documento central para solo insertar los casos nuevos.
7. se insertan los casos nuevos al documento central en la pestana CASOS incorporando la fecha actual en la columna Ingreso.
8. se actualiza la informacion de la seccion de monitoreo de la pestana PANEL segun la estructura solicitada.



\[2. DESPACHO]

este procedimiento permite distribuir los casos entra las diferentes cuadrillas declaradas, agrupando por la aproximidad de los sectores de forma que las cuadrilla concentren el trabajo. este despacio debe incluir los casos citados del dia, al menos 1 o mas reparaciones de referidos,  1 o mas reparaciones de Empresas; solo a una cuadrilla se le asignara construccion (Empresarial o Recidencial) de existir el caso y se le asignara a la cuadrilla que posea reparaciones en ese sector.

1. se busca en la pestana CASOS, agrupado los direccion, los sectores mas cercanos.
2. se actualiza la pestana DESPACHO los casos asignados a cada cuadrilla con la informacion de la pestana CASOS.
3. se definen la zonas de imprecion de forma que todos los casos asignados a una cuadrillas abarque el maximo area impromible de una hoja carta horizontal.
4. se generan los archivos PDF del despacho diario; estos archivos se crean por cada cuadrilla y tomando en cuenta el area de impression maxima.



\[3. ACTUALIZACION]

En este procedimiento se normalizan la informacion partiendo de los casos de modo que se distribuyan y actualicen las petanas con la informacion relacional. Tambien se conforma el despacho para el Supervisor donde debe contactar los casos que no ameritan maniobra del personal de campo.

1. se localizan todos los casos que NO TENGAN tenga la frase LOSS ROJO, FALLA FIBRA o Fibra Danada en las columnas de informacio (Falla Reportada, Último Comentario, problema\_reporte).
2. agrega la informacion a la pestana GESTION para ser actualizada antes de preparar el despacho.





\[4. GESTION TECNICA]

ESTE PRCEDIMIENTO ES EL EJECUTADO POR LOS TECNICOS EN CAMPO, se trata de usar una app movil que se sincronice antes de empesar ls jornada para obtener los datos de los casos que atenderan y tenerlos organizados por sectores para planificacion de su ruta de trabajo; esta aplicacion debe mostrar una lista en pantalla de los casos asignados para ese dia en fichas comodas y visible donde se muestre el nombre y el sector, al momento de su gestion se cumplen los siguientes pasos:

\[4.0. LOGGEAR]
en la pantalla de LOGING se ngresan los datos de P00, correo y clave, de ser correcta ingresa a la pantalla PRINCIPAL, de ser incorrecta tiene hasta 3 intentos y despues se bloquea. para desbloquear se debe ingresar 3 de las 12 palabes de seguridad.



\[4.1. CONTACTAR]
en la pantalla principal (Casos asignados del dia) al seleccionar un caso se debe mostar una ficha con los datos basiscos del cliente para poder establecer contacto telefonico y acordar la atension, tembien se corrije la direccion del inmueble y la informacion prelimiral del caso; para culminar se selecciona el boton CONTACTADO (se marca el caso con el simbolo de contactado ) o el boton DIFERIDO (se muestra la opcion de seleccionar la fecha y hora de la prosoma cita, no se deben solapar las citas ya acordadas) y se cierra la ficha volviendo al resumen.
\[4.2. ATENDER]
en la pantalla principal se debe seleccionar solo los casos ya contactados, al seleccionar un caso se muestra una pantalla con la informacion del caso dividido en dos secciones: Administrativa (Numero, Plan, Serial del equipo, Tipo de Servicio) y la informacion Tecnica (Olt, Slot, Puerto, Ruta, Fat); aui se puede seleccionar los siguientes procedimientos:

1. CERRAR: se muestra una pantalla para ingresar el reporte corto de actividad, tomar las evidencias (potencia del equipo, Prueba de navegacion) y seleccionar el metodo de cierre (con IVR / con COS / con SACAS).
2. ENRUTAR: se muestra una pantalla para ingresar el reporte corto de justificacion, tomar las evidencias (potencia del equipo) y seleccionar el metodo de Enrute (colas de Enrutado) y se selecciona la causa.
3. DIFERIR: se muestra una pantalla para ingresar el reporte corto de justificacion, tomar las evidencias (Fotos demostrativas) y se selecciona la causa (listado de causas).

\[4.3 CONSIDERACIONES]

1. las evidencias tomadas se ejecutan abriendo la camara del movil, no se pueden seleccionar de la galleria, todas las fotos son almacenadas en baja calidad en una carpeda de la app seriando con Numero de caso + id de averia+ tipo (potencia/navegacion/demo) + fecha y hora; solo se guarda en el documento de reporte el seriado de la imagen segun sea el tipo.
2. al atender un casos este desaparece del panel principal y pasa al panel historico del dia.
3. para obtener el listado del despacho diario se debe cargar el documento del despacho.
4. al finalizar la jornada, en la pantalla DISPOSITIVO, se genera un zip con el documento de despacho modificados y todas las evidencias; el nombre del zip se conforma con la central+cuadrilla+fecha.
5. al iniciar la jornada, en la pantalla DISPOSITIVO, se selecciona para cargar el documento de despacho, validando la estructura del nombre del documento, al confirmar la carga correcta se remplaza el archivo anterior y se borran las evidencias del dia anterior.
6. al iniciar por primera vez la app se debe cargar el documento de seguridad (cifrado con una clave publica), con los datos de la central, dentro de la estructura de la app y luego ingresar el P00, Correo, la clave y la confirmacion de la clave, luedo se generan 12 palabras aleatorias que se muestran en pantalla, despues se actualiza el documento de seguridad con estos datos.
7. la app debe poseer una clave privada para descifrar el documento de seguridad.





