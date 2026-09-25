\[OBJETIVO]
crear un sistema de administracion de reportes de averia y construccion de puntos opticos para la empresa CANTV CA. este sistema de administracion tendra como base de informacion ESCENCIAL un archivo de excel que se descarga diariamente del sistema interno de cantv, alli un resumen que contiene los datos Tecnicos, Logicos, Administrativo, Identificativo de servicio, etc de cada reporte de caso, Tambien se nutrira de casos manuales que se introduciran por los distintos canales (correo/wathsapp/app Movil) que son de clasificacion de Referidos o solicitudes de otras areas de la empresa (como la construccion de puntos opticos por parte de la Unidad de Masivos o la Unidad de Empresas) . este sistema debe gestionarce de forma multi plataforma (desde la pc, desde telegram/WhatsApp y desde una app en el movil (apk con actualizacion asincrona) de los trabajadores, con un sistema de almacenamiento de datos vasado en una hoja de excel. los trabajadores deben logiarce para ingresar.

\[CONTEXTO]

crear una plataforma web que usa posrgresql como base de datos para la gestion de los casos (repoortes de averia) de la central Francisco Salias (area 4), dode pueda:
1. administrar y gestionar al personal, las cuadrillas (conformado por personal + flota + herramientas) y el despacho diario (casos asignadas a cada cuadrillas).
2. crear rutas de atension asignando sectores segun las direcciones de los casos 
3. tener un seguimientos a los casos especiales, estos casos (REPARACION o CONSTRUCCION) se ingresan de forma manual, son clasificados como REFERIDOS, EMPRESAS, GOBIERNOS, y son reportado por un personal externo a la central (Unidad + Nombre + Contacto) a quien se le debe informar de lo realizado.  
4. generar el reporte de trabajo diario, semanal y mensual.


\[GENERALIDADES]

1. las funciones de cara al supervisor de la central (en la app Movil o pc):
1.1 cargar el documento de casos diarios mediante el archivo detalle\_averias\_gpon\_\*.csv (su fecha varia por cada dia).
1.2 crear los perfiles y accesos de los trabajadores.
1.3 Gestionar las Flotas.
1.4 Gestionar las cuadrillas (trabajadores + Flota + Herramientas).
1.5 Gestionan el manejo de los insumos, cantidad en inventario, ingreso de material segun las ordenes de material, entrega de material a los trabajadores. (para una 2da version).
1.6 gestionan la ingesta o asignacion de casos especiales solicitados por otras instacnias ( Referidos de Reparacion, Construccion Recidencial, Contruccion Empresa, ETC) mediante wathapp, Telegarm o via IA (crear un WEB-MCP).
1.7 genera reporte de Capacidad Operativa ( Cuadrilla+Sectores a trabajar), estado de las flotas y herramientas, reportes de funcion Diaria (Cuadrilla+Despacho del dia).
1.8 gestiona el Despacho Diario asignando un grupo de Casos a las diferentes cuadrillas activas para cada dia. (asignando las areas geograficas de trabajo segun los casos activos).
1.7. Gestionar la fallas masivas; estos casos son asignado a la cuadrilla con mayor cercania.

2. Las funciones de los trabajadores (en la app Movil o web en version movil):

2.1 gestionar los casos de su cuadrilla. el tecnico puede consultar la ficha del caso.
2.1.1. contactar y acordar horas de encuentro con los clientes. (gestionar agenda interna)
2.1.2. documentar la actividad realizada en cada caso, incluyendo la captura de registro fotografico segun sea el caso. (estas imagenes se marcan con la coordenadas de GPS + Fecha y Hora, NO SE PERMITE LA CARGA DE IMAGENES)
2.1.3. documentar la resolucion de los caso.

2.2. alertar los casos de Falla masiva.
2.2.1. las alertas se realizan a traves de mensajeria (wathapp o telegram) o WEB MCP.
2.2.2. se debe documentar la planificacion para la atension justificado con reporte simple y evidencias fotograficas.
2.2.3. se prepara la solicitud de material segun sea el caso.

2.3 alertar de incidentes con la flotas o herramientas (reporte simple con evidencias fotograficas).

3. las funciones del sistema:
3.1 procesar el archivo de casos diarios suministrado por el supervisor. se extraen los casos solo de la central.
3.2 ingresar solo los casos nuevos a la Base de datos del sistema.
3.3 actualizar los sectores de trabajo segun el documento central segun las direcciones de los casos activos.
3.4 proponer la distribucion de los casos (despacho diario) entre las cuadrillas declaradas.
3.5 asignar los casos del supervisor (cuadrilla 0 del sistema), estos casos so los que se debe realizar seguimiento, por lo general son los casos que se enviaron a otras colas o que en las columnas de informacion contiene NAVEGACION LENTA, PON INTERMITENTE u otro adjetivo que indique no ser de atension en casa del cliente.


\[DETALLE]

la plataforma funcionara como un elemento que concentra toda la informacion de manera practica distribuyendolo en secciones funcionales:
0. PANEL: tendra una seccion (o ficha) donde se pueda buscar la informacion de un caso partiendo del Id de averia o del Telefono, en esta seccion podra actualizar actualizar los casos, una seccion donde se pueda ingresar nuevos casos, partiendo de informacion sencilla (Fecha, Tipo, Actividad, Contacto, Nombre, Direccion, Informacion, ETC).
0.1 MONITOREO: aqui tendremos Zonas Donde se mostraran Graficos con tabla descriptiva de GESTION DIARIO (lado Izquierdo) donde se refleja la informacion de gestion diaria (ingreso nuevo, Resuelto Rescidencial, Resuelto Empresarial, Resuelto Referidos), GESTION SEMANAL (grafico de curva) donde se muestran los datos comparativos de la semana (lunes - sabado), los CASOS GLOBALES (grafico de barra) donde se muestra los datos de comparacion entre el pendiente y lo resuelto, REPARACION donde se muestra el total actual de los casos pendientes de reparacion (Recidenciales Comunes, Recidenciales Referidos, Empresariales), CONSTRUCCION donde se muestra el total de casos pendientes de Construccion (Recidenciales, Empresariales) y CUADRILLA donde se muestra la relacion por dia, durante la semana, de los casos asignados Vs Cerrados Vs Gestionados
0.2 GRAFICOS: aqui tendremos Zonas Donde se mostraran Graficos, con la informacion proveniente de la pestana MONITOREO, distribuido en zona GESTION DIARIO (grafico de barra), GESTION SEMANAL (grafico de curva), CASOS GLOBALES (grafico de barra), REPARACION (grafico de torta), CONSTRUCCION (grafico de barra) y CUADRILLA (grafico de barra).

1. CASOS: alberga la data principal donde se registraran los casos y la resolucion (casos de Contruccion/Reparacion en tipo Recidencial/Empresa/Referidos).
2. DESPACHO: servira como base para distribuir el universo de las averias entre las cuadrillas agrupando por sectores de forma que cada cuadrilla pueda focalizar el trabajo. aqui se podra visualizar el despacho del dia por cada cuadrilla en forma de tabla y con la disposicion para imprimir en hoja tamano carta, tambien tendra un historico de los despachos para corroborar como se distribulleron las cuadrillas y como quedo la produccion de ese dia.
3. SEGUIMIENTO: aqui se albergaran todos los casos que fueron pasado a otras instancias (en cola) para ser tratado por alguna causa.
4. EMPRESAS: aqui se albergara un resumen de las actividades de reparacion o Construccion de tipo Empresas, esta informacion Tambien registrara la cita para su atencion.
5. REFERIDOS: aqui se albergara un resumen de las actividades de reparacion o Construccion de tipo Referidos que no poseen id de incidencia, se clasifican por nivel de prioridad, esta informacion Tambien registrara la cita para su atencion.
6. CONFIGURACION: se cargaran la informacion necesaria para la configuracion de todo el entorno, las secciones que maneja son:
6.1 CENTRAL: alberga la direccion Operativa de la central de trabajo (region, estado geografico, capital estado geografico, municipio, parroquia, estado operativo, distrito, area, central, nombre central), esta es la base principal de filtro para la estraccion del archivo matris).
6.2 TECNICOS: alberga los datos de todas los trabajadores de la central (Nombre, Cedula, P00, Telefono, Correo, Especialidad, Status).
6.3 FLOTA: alberga los datos de los vehiculos que operan en la central (CAN00, Tipo, Marca, Modelo, Placa, Combistible, Status, Estado Cauchos, Estado Fluidos, Estado General).
6.4 CUADRILLA: gestiona los datos la cuadrilla.
8. GESTION: en esta pestana se gestionan todos los casos del supervisor (cuadrilla 0 del sistema) que deben gestionar sin la necesidad de despacharlo a una cuadrilla de calle.



\[PROCEDIMIENTOS]

\[1. INGESTA]

Este procedimiento ingresa NUEVOS casos partiendo de un archivo matrix detalle\_averias\_gpon\_\[fecha].csv, aqui se encuentra toda la informacion Operativa, Administrativa, Tecnica, Logica y complementativa de cada caso, este archivo es proporcionado diariamente y contiene el universo de las averias para el area operativa, donde se deben clasificar y extraer los datos escenciales para alimentar el documento centralizado para su gestion. el procedimiento que se ejecuta manualmente es:

1.se filtra en el archivo detalle los datos operativos para obtener solo los casos de la central (region, estado geografico, capital estado geografico, municipio, parroquia, estado operativo, distrito, area, central, nombre central), datos en la pestana CONFIGURACON del documento central.
2. se extraen los datos de los casos y agrega los nuevos casos al sistema. se descartan los casos que ya se encuentren en el sistema, el criterio de comparacion debe ser ID AVERIA para solo incertar los casos nuevos.
3. se documenta la carga del nuevo archivo y se diferencian los casos nuevos.


\[2. DESPACHO]

este procedimiento permite distribuir los casos entra las diferentes cuadrillas declaradas, agrupando por la aproximidad de los sectores de forma que las cuadrilla concentren el trabajo tomando las siguientes consideraciones: 
1. este despacio debe incluir los casos citados del dia, al menos 2 o mas reparaciones de referidos,  1 o mas reparaciones de Empresas.
2. solo a una cuadrilla se le asignara construccion de existir el caso y se le asignara a la cuadrilla que posea reparaciones en el sector de la construccion.
3. se envia por mensaje wathapp, correo o telegram la ficha de la cuadrilla y los sectores a atender en ese dia.
4. al finalizar (04:00 pm) se debe generar el reporte de produccion por  (por mensaje wathapp, correo o telegram) especificando cuales casos fueron atendidos satisfactoriamente, cuales fueron citados, cuantos referidos, etc.
5. se debe omitir los casos que estan en gestion o fueron asignados a la cuadrilla del supervisor.

\[3. GESTION AUTOMATIZADA]

En este procedimiento se conforma el despacho para el Supervisor donde debe contactar los casos que no ameritan maniobra del personal de campo.

1. se localizan todos los casos que NO TENGAN tenga la frase LOSS ROJO, FALLA FIBRA o Fibra Danada en las columnas de informacio (Falla Reportada, Último Comentario, problema\_reporte).
2. agrega a la cuadrilla del supervisor estos casos antes de preparar el despacho.

\[4. GESTION TECNICA]

ESTE PRCEDIMIENTO ES EL EJECUTADO POR LOS TECNICOS EN CAMPO, se trata de usar una app movil (o web en version movil) que se sincronice al logearce para actualizar la base de datos interna para operar off line. 
esta aplicacion debe mostrar una lista en pantalla de los casos asignados, a la cuadrilla que pertenece el usuario, en fichas comodas y visible donde se muestre el nombre y el sector, al momento de su gestion se cumplen los siguientes pasos:
esta aplicacion debe hacer uso de los datos del GPS del movil y almacenamiento provisional donde se carguen las evidencias fotograficas.

\[4.0. LOGGEAR]
en la pantalla de LOGING se ingresan los datos de P00 y clave, de ser incorrecta tiene hasta 3 intentos y despues se bloquea. para desbloquear se debe ingresar 3 de las 12 palabes de seguridad. tambien podra ser bloqueada para evitar mostrar la informacion confidencial del cliente.


\[4.1. CONTACTAR]
en la pantalla principal (Casos asignados del dia) al seleccionar un caso se debe mostar una ficha con los datos basiscos del cliente para poder establecer contacto telefonico y acordar la atension, tembien se corrije la direccion del inmueble y la informacion prelimiral del caso; para culminar se selecciona el boton CONTACTADO (se marca el caso con el simbolo de contactado ) o el boton DIFERIDO (se muestra la opcion de seleccionar la fecha y hora de la prosoma cita, no se deben solapar las citas ya acordadas) y se cierra la ficha volviendo al resumen.

\[4.2. ATENDER]
en la pantalla principal se debe seleccionar solo los casos ya contactados, al seleccionar un caso se muestra una pantalla con la informacion del caso dividido en dos secciones: Administrativa (Numero, Plan, Serial del equipo, Tipo de Servicio) y la informacion Tecnica (Olt, Slot, Puerto, Ruta, Fat); aqui se puede seleccionar los siguientes procedimientos:

1. CERRAR: se muestra una pantalla para ingresar el reporte corto de actividad, capturar las evidencias (potencia del equipo, Prueba de navegacion) y seleccionar el metodo de cierre (con IVR / con COS / con SACAS).
2. ENRUTAR: se muestra una pantalla para ingresar el reporte corto de justificacion, capturar las evidencias (potencia en el equipo) y seleccionar el metodo de Enrute (colas de Enrutado) y se selecciona la causa.
3. DIFERIR: se muestra una pantalla para ingresar el reporte corto de justificacion, capturar las evidencias (hasta 3 Fotos demostrativas) y se selecciona la causa (listado de causas).

\[4.3 CONSIDERACIONES]

1. las evidencias tomadas se ejecutan abriendo la camara del movil, no se pueden seleccionar de la galleria, todas las fotos son almacenadas en baja calidad en una carpeda de la app seriando con Numero de caso + id de averia+ tipo (potencia/navegacion/demo) + fecha y hora; solo se guarda en el documento de reporte el seriado de la imagen segun sea el tipo.
2. al finalizar la jornada, en la pantalla DISPOSITIVO, se genera un zip con el documento de despacho modificados y todas las evidencias; el nombre del zip se conforma con la central+cuadrilla+fecha.
5. en la pantalla principal, se puede seleccionar para SINCRONIZAR el DISPOSITIVO. (genera una propuesta de procedimiento).
6. al iniciar por primera vez la app se debe ingresar el P00, Correo, la clave y la confirmacion de la clave, luedo se generan 12 palabras aleatorias que se muestran en pantalla que se guardan como documento de seguridad encriptado con estos datos para poder hacer recuperacion de la contrasena o del bloqueo por multiple intentos.
7. la app debe poseer una clave privada para descifrar el documento de seguridad.
8. el documento de seguridad se actualiza durante la sincronizacion del dispositivo.

