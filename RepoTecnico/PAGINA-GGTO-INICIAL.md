\[OBJETIVO]
crear un PAGINA HTML para la gestion de los casos (repoortes de averia) de la central Francisco Salias (area 4), dode pueda conformar el despacho diario a las cuadrillas declaradas, crear sectores de averias concentradas, tener un seguimientos a los casos especiales y generar el reporte de trabajo diario y de gestion semanal. esta pagina estraera los datos para su actualizacion de un archivo .csv que se emite diariamente.

\[DETALLE]

la pagina funcionara como un elemento que concentra toda la informacion de manera practica distribuyendolo en pestanas funcionales:

0. PANEL: tendra una seccion (o ficha) donde se pueda buscar, al hacer click en un boton, la informacion basica partiendo del Id de averia o del Telefono (busca los datos en el averias.json), una seccion para actualizar status (PEND/CERRADO/GESTION), resolucion (IVR/COS/COLA), fechaResolucion (DD/MM/AAAA), observaciones, sacas (SI/NO) partiendo de un id_averia o telefono al hacer click en un boton, una seccion donde se pueda ingresar nuevos casos partiendo de informacion sencilla (Fecha, Tipo, Actividad, Contacto, Nombre, Direccion, Informacion, Agente, ETC).
0.1 MONITOREO: aqui tendremos Zonas Donde se mostraran Graficos con tabla descriptiva de GESTION DIARIO (lado Izquierdo) donde se refleja la informacion de gestion diaria (ingreso nuevo, Resuelto Rescidencial, Resuelto Empresarial, Resuelto Referidos), GESTION SEMANAL (grafico de curva) donde se muestran los datos comparativos de la semana (lunes - sabado), los CASOS GLOBALES (grafico de barra) donde se muestra los datos de comparacion entre el pendiente y lo resuelto, REPARACION donde se muestra el total actual de los casos pendientes de reparacion (Recidenciales Comunes, Recidenciales Referidos, Empresariales), CONSTRUCCION donde se muestra el total de casos pendientes de Construccion (Recidenciales, Empresariales) y CUADRILLA donde se muestra la relacion por dia, durante la semana, de los casos asignados Vs Cerrados Vs Gestionados
0.2 GRAFICOS: aqui tendremos Zonas Donde se mostraran Graficos, con la informacion proveniente de la pestana MONITOREO, distribuido en zona GESTION DIARIO (grafico de barra), GESTION SEMANAL (grafico de curva), CASOS GLOBALES (grafico de barra), REPARACION (grafico de torta), CONSTRUCCION (grafico de barra) y CUADRILLA (grafico de barra).

1. CASOS: alberga la data principal donde se registraran los casos y la resolucion (casos de Contruccion/Reparacion en tipo Recidencial/Empresa/Referidos).
2. DESPACHO: servira como base para distribuir el universo de las averias entre las cuadrillas agrupando por direccion (sectores cercanos) de forma que cada cuadrilla 
3. CONFIGURACION: se cargaran la informacion necesaria para la configuracion de todo el entorno, las secciones que maneja son:
3.1 CENTRAL: alberga la direccion Operativa de la central de trabajo (region, estado geografico, capital estado geografico, municipio, parroquia, estado operativo, distrito, area, central, nombre central), esta es la base principal de filtro para la estraccion del archivo matris.
3.2 TECNICOS: alberga los datos de todas los trabajadores de la central (Nombre, Cedula, P00, Telefono, Correo, Especialidad, Status).
3.3 FLOTA: alberga los datos de los vehiculos que operan en la central (CAN00, Tipo, Marca, Modelo, Placa, Combistible, Status, Estado Cauchos, Estado Fluidos, Estado General).
3.4 CUADRILLA: alberga los datos de la cuadrilla.
4. GESTION: en esta pestana se albergan todos los casos que deben ser consultados via Telefonica para clasificar correctamente los casos y ser mas eficiente en las actividades de calle.





\[PROCEDIMIENTOS]



\[1. INGESTA]

Este procedimiento ingresa NUEVOS casos partiendo de un archivo .csv que se carga, aqui se encuentra toda la informacion Operativa, Administrativa, Tecnica, Logica y complementativa de cada caso, este archivo es proporcionado diariamente y contiene el universo de las averias para el area operativa, donde se deben clasificar y extraer los datos escenciales para su gestion. el procedimiento que se ejecuta manualmente es:

1. se filtra en el archivo detalle los datos operativos para obtener solo los casos de la central (region, estado geografico, capital estado geografico, municipio, parroquia, estado operativo, distrito, area, central, nombre central), datos en la pestana CONFIGURACON del documento central.
2. se extraen los datos de los casos segun la estructura del archivo estructura.json.
3. se descartan los casos que ya se encuentren en el archivo averia.json, se busca por su id_averia para solo incertar los casos nuevos.
4. se localizan todos los casos que NO TENGAN tenga la frase LOSS ROJO, FALLA FIBRA o Fibra Danada en las columnas de informacio (ultimo_comentario, problema_reporte,informacion, informacion) y se modifica la columna status = GESTION.
5. se completa la columna sector, tomando en cuenta los sectores declarados en la pestana CONFIGURACION, agrupandolos por la columna direccion. Si la direccion no se encuentra asociada a un sector se solicita que se incorpore.
6. se insertan los casos nuevos a averias.json incorporando en la columna ingreso = fecha de ingesta, la columna clase = REP, la columna nivel = COMUN.

\[2. DESPACHO]

este procedimiento permite distribuir los casos entra las diferentes cuadrillas declaradas, agrupando por la aproximidad de los sectores de forma que las cuadrilla concentren el trabajo. este despacio debe incluir los casos citados del dia, al menos 1 o mas reparaciones de referidos,  1 o mas reparaciones de Empresas; solo a una cuadrilla se le asignara construccion (Empresarial o Recidencial) de existir el caso y se le asignara a la cuadrilla que posea reparaciones en ese sector.

1. se busca en averias.json los datos de las columnas id_averia, telefono, persona_reporta, contacto, nombre, direccion, fat, plan, serial; agrupando por la columna Reparador Principal.
2. se generan los archivos PDF del despacho diario; estos archivos se crean por cada cuadrilla y tomando en cuenta el area de impression maxima en una hoja tamano carta de orientacion horizontal.

\[GENERALIDADES]

1. La pagina debe presentas todos lo casos en una tabla con solo los datos resumen (nivel, clase, sector, id_averia, nombre, direccion, plan).
2. al seleccionar un registro se muestra un flotante toda la informacion restante del caso, debe tener la opcion de resolver el caso desde este flotante ingresando los datos y seleccionas CERRA CASO. disena la estructura agripado en secciones.
3. la pagina debe agrupor los datos por abiertos/cerrados, cuadrilla, tipo, clase y estatus.
4. cada vez que se modifique un caso se debe actualizar los cambios en averias.json.

\[ESTRUCTURAS]

1. averias.json, las columnas son: ingreso (dd/mm/aaaa), nivel (REF/COM), clase (REP/CNS), sector (1/2/3), Reparador Principal, id_averia, telefono, persona_reporta, contacto, ultimo_comentario, problema_reporte, informacion, informacion, nombre, direccion, olt, plan, slot, puerto, fat, serial, extra, ups, codigos_sin_gestion_en_VENAPP, status (PEND/CERRADO/GESTION), resolucion (IVR/COS/COLA), fechaResolucion (DD/MM/AAAA), observaciones, sacas (SI/NO).
2. despacho.json, las columnas son: nivel (REF/COM), clase (REP/CNS), id_averia, telefono, persona_reporta, contacto, ultimo_comentario, nombre, direccion, plan, fat, serial.
3. estructura.json, las columnas son: id_averia, telefono, persona_reporta, contacto, ultimo_comentario, problema_reporte, informacion, informacion, nombre, direccion, olt, plan, slot, puerto, fat, serial, extra, ups, codigos_sin_gestion_en_VENAPP.






