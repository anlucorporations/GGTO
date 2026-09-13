\[OBJETIVO]
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
4. se insertan los casos nuevos al documento central en la pestana CASOS incorporando la fecha actual en la columna Ingreso.
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





