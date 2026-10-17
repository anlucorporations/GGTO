import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/api_error.dart';
import '../../core/theme.dart';
import 'grafico.dart';
import 'monitoreo_api.dart';

/// Tablero **MONITOREO** de la APK con el mismo esquema que la web (D-109).
///
/// La web muestra las métricas en tarjetas y gráficos (diario, semanal, globales,
/// por tipo, por cuadrilla y capacidad). Antes la APK volcaba el JSON crudo en
/// tarjetas de texto, de modo que un supervisor no podía leer las cifras de un
/// vistazo. Ahora se replica la misma estructura con **gráficos** dibujados en la
/// propia app (sin librerías): barras, barras agrupadas, líneas y donut.
///
/// Se actualiza sola cada 5 minutos con la app abierta y al volver a ella; el
/// botón de la barra superior refresca al instante.
class MonitoreoScreen extends StatefulWidget {
  const MonitoreoScreen({super.key});

  @override
  State<MonitoreoScreen> createState() => _MonitoreoScreenState();
}

/// Vistas adicionales que la web tiene en sus pestañas secundarias.
enum VistaExtra {
  ninguna('Solo tablero', ''),
  mensual('Gestión mensual', '/monitoreo/mensual'),
  especiales('Casos especiales', '/monitoreo/casos-especiales'),
  construcciones('Construcciones', '/monitoreo/construcciones');

  const VistaExtra(this.etiqueta, this.ruta);
  final String etiqueta;
  final String ruta;
}

class _MonitoreoScreenState extends State<MonitoreoScreen>
    with WidgetsBindingObserver {
  PanoramaMonitoreo? _panorama;
  VistaExtra _vistaExtra = VistaExtra.ninguna;
  Map<String, dynamic>? _datosExtra;
  DateTime? _actualizado;
  String? _error;
  bool _cargando = false;
  bool _enPrimerPlano = true;
  Timer? _temporizador;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _programarRefresco();
    WidgetsBinding.instance.addPostFrameCallback((_) => _cargar());
  }

  @override
  void dispose() {
    _temporizador?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _enPrimerPlano = state == AppLifecycleState.resumed;
    _temporizador?.cancel();
    if (_enPrimerPlano) {
      _cargar();
      _programarRefresco();
    }
  }

  void _programarRefresco() {
    _temporizador?.cancel();
    _temporizador = Timer(const Duration(minutes: 5), () async {
      if (!mounted || !_enPrimerPlano) return;
      await _cargar();
      if (mounted && _enPrimerPlano) _programarRefresco();
    });
  }

  Future<void> _cargar() async {
    if (_cargando || !_enPrimerPlano) return;
    setState(() {
      _cargando = true;
      _error = null;
    });
    try {
      final panorama = await MonitoreoApi.panorama();
      Map<String, dynamic>? extra;
      if (_vistaExtra != VistaExtra.ninguna) {
        final respuesta = await ApiClient.get(_vistaExtra.ruta);
        if (respuesta is Map) extra = Map<String, dynamic>.from(respuesta);
      }
      if (!mounted) return;
      setState(() {
        _panorama = panorama;
        _datosExtra = extra;
        _actualizado = DateTime.now();
      });
    } on ApiError catch (error) {
      if (mounted) setState(() => _error = error.mensaje);
    } catch (error) {
      if (mounted) setState(() => _error = '$error');
    } finally {
      if (mounted) setState(() => _cargando = false);
    }
  }

  Future<void> _cambiarExtra(VistaExtra vista) async {
    setState(() {
      _vistaExtra = vista;
      _datosExtra = null;
    });
    await _cargar();
  }

  @override
  Widget build(BuildContext context) {
    final panorama = _panorama;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Monitoreo'),
        actions: [
          IconButton(
            tooltip: 'Actualizar ahora',
            onPressed: _cargando ? null : _cargar,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _cargar,
        child: ListView(
          padding: const EdgeInsets.all(12),
          children: [
            _barraEstado(),
            if (_error != null) ...[
              const SizedBox(height: 8),
              _avisoError(),
            ],
            if (panorama == null && _cargando)
              const Padding(
                padding: EdgeInsets.all(40),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (panorama != null) ...[
              _seccion(
                titulo: 'Resumen del día',
                subtitulo: panorama.diario.fecha,
                child: Column(
                  children: [
                    _rejillaKpis(_kpisDiario(panorama.diario)),
                    const SizedBox(height: 10),
                    GraficoBarras(datos: barrasDiario(panorama.diario)),
                  ],
                ),
              ),
              _seccion(
                titulo: 'Globales del mes',
                subtitulo: '${panorama.globales.desde} → ${panorama.globales.hasta}',
                child: Column(
                  children: [
                    _rejillaKpis([
                      ('Pendientes', panorama.globales.pendientes, Marca.alerta),
                      ('Resueltos', panorama.globales.resueltos, Marca.exito),
                      ('Total', panorama.globales.total, Marca.azul),
                    ]),
                    const SizedBox(height: 10),
                    if (panorama.globales.porEstado.isNotEmpty)
                      GraficoBarras(datos: barrasPorEstado(panorama.globales)),
                  ],
                ),
              ),
              _seccion(
                titulo: 'Curva semanal',
                subtitulo: '${panorama.semanal.desde} → ${panorama.semanal.hasta}',
                child: Column(
                  children: [
                    GraficoLineas(
                      etiquetas: [for (final dia in panorama.semanal.dias) dia.etiqueta],
                      series: [
                        SerieGrafico('Asignados',
                            [for (final d in panorama.semanal.dias) d.asignados], Marca.azul),
                        SerieGrafico('Cerrados',
                            [for (final d in panorama.semanal.dias) d.cerrados], Marca.exito),
                        SerieGrafico('Gestionados',
                            [for (final d in panorama.semanal.dias) d.gestionados], Marca.alerta),
                      ],
                    ),
                    const SizedBox(height: 8),
                    _tablaDias(panorama.semanal.dias),
                  ],
                ),
              ),
              _seccion(
                titulo: 'Pendientes por tipo',
                subtitulo: 'Reparación y construcción',
                child: Column(
                  children: [
                    _subtitulo('Reparación (${panorama.reparacion.total})'),
                    GraficoDonut(
                      porciones: [
                        PorcionGrafico('Residenciales comunes',
                            panorama.reparacion.residencialesComunes, Marca.azul),
                        PorcionGrafico('Residenciales referidos',
                            panorama.reparacion.residencialesReferidos, Marca.alerta),
                        PorcionGrafico('Empresariales',
                            panorama.reparacion.empresariales, Marca.exito),
                      ],
                      centro: '${panorama.reparacion.total}',
                      centroEtiqueta: 'casos',
                    ),
                    const SizedBox(height: 14),
                    _subtitulo('Construcción (${panorama.construccion.total})'),
                    GraficoDonut(
                      porciones: [
                        PorcionGrafico('Residenciales', panorama.construccion.residenciales,
                            Marca.azul),
                        PorcionGrafico('Empresariales', panorama.construccion.empresariales,
                            Marca.exito),
                      ],
                      centro: '${panorama.construccion.total}',
                      centroEtiqueta: 'casos',
                    ),
                  ],
                ),
              ),
              _seccion(
                titulo: 'Por cuadrilla',
                subtitulo: '${panorama.cuadrillas.dias} días',
                child: Column(
                  children: [
                    if (panorama.cuadrillas.cuadrillas.isNotEmpty)
                      GraficoBarrasAgrupadas(
                        etiquetas: [
                          for (final c in panorama.cuadrillas.cuadrillas) c.codigo,
                        ],
                        series: [
                          SerieGrafico('Asignados', [
                            for (final c in panorama.cuadrillas.cuadrillas) c.asignados,
                          ], Marca.azul),
                          SerieGrafico('Cerrados', [
                            for (final c in panorama.cuadrillas.cuadrillas) c.cerrados,
                          ], Marca.exito),
                          SerieGrafico('Gestionados', [
                            for (final c in panorama.cuadrillas.cuadrillas) c.gestionados,
                          ], Marca.alerta),
                        ],
                      ),
                    const SizedBox(height: 8),
                    for (final c in panorama.cuadrillas.cuadrillas)
                      _filaCuadrilla(c),
                  ],
                ),
              ),
              _seccion(
                titulo: 'Capacidad operativa',
                subtitulo: 'Recursos de la central',
                child: Column(
                  children: [
                    _rejillaKpis([
                      ('Cuadrillas', panorama.capacidad.cuadrillasActivas, Marca.azul),
                      ('Técnicos', panorama.capacidad.tecnicosActivos, Marca.exito),
                      ('Flota', panorama.capacidad.flotaDisponible, Marca.alerta),
                      ('Herramientas', panorama.capacidad.herramientasDisponibles,
                          Marca.especial),
                      ('Sectores', panorama.capacidad.sectoresActivos, Marca.enrutado),
                    ]),
                    const SizedBox(height: 8),
                    for (final c in panorama.capacidad.cuadrillas)
                      _filaCapacidad(c),
                  ],
                ),
              ),
              _seccion(
                titulo: 'Otras vistas',
                subtitulo: 'Las pestañas secundarias de la web',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    DropdownButtonFormField<VistaExtra>(
                      value: _vistaExtra,
                      decoration: const InputDecoration(
                        labelText: 'Vista',
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                      items: VistaExtra.values
                          .map((vista) => DropdownMenuItem(
                                value: vista,
                                child: Text(vista.etiqueta),
                              ))
                          .toList(),
                      onChanged: (vista) {
                        if (vista != null) _cambiarExtra(vista);
                      },
                    ),
                    if (_vistaExtra != VistaExtra.ninguna && _datosExtra != null) ...[
                      const SizedBox(height: 10),
                      ..._tarjetasCrudas(_datosExtra!),
                    ],
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _barraEstado() {
    return Row(
      children: [
        Icon(
          _error == null ? Icons.cloud_done_outlined : Icons.cloud_off,
          size: 18,
          color: _error == null ? Marca.exito : Marca.alerta,
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            _actualizado == null
                ? 'Aún no actualizado · se refresca cada 5 min'
                : 'Actualizado ${TimeOfDay.fromDateTime(_actualizado!).format(context)} '
                    '· se refresca cada 5 min',
            style: const TextStyle(fontSize: 12, color: Marca.textoSuave),
          ),
        ),
        if (_cargando)
          const SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
      ],
    );
  }

  Widget _avisoError() => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Marca.alertaClaro,
          borderRadius: BorderRadius.circular(Marca.radioControl),
        ),
        child: Text('No se pudo actualizar. $_error'),
      );

  Widget _seccion({required String titulo, String? subtitulo, required Widget child}) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(titulo,
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
                ),
                if (subtitulo != null && subtitulo.isNotEmpty)
                  Text(subtitulo,
                      style: const TextStyle(fontSize: 11.5, color: Marca.textoSuave)),
              ],
            ),
            const SizedBox(height: 10),
            child,
          ],
        ),
      ),
    );
  }

  Widget _subtitulo(String texto) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text(texto,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
      );

  Widget _rejillaKpis(List<(String, int, Color)> kpis) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final (etiqueta, valor, color) in kpis)
          SizedBox(
            width: 104,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: color.withOpacity(0.08),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: color.withOpacity(0.25)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('$valor',
                      style: TextStyle(
                          fontSize: 20, fontWeight: FontWeight.w800, color: color)),
                  Text(etiqueta,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 10.5, color: Marca.textoSuave)),
                ],
              ),
            ),
          ),
      ],
    );
  }

  Widget _tablaDias(List<DiaSemanal> dias) {
    return Table(
      border: const TableBorder(
          horizontalInside: BorderSide(color: Marca.borde, width: 0.5)),
      columnWidths: const {
        0: FlexColumnWidth(1.2),
        1: FlexColumnWidth(1),
        2: FlexColumnWidth(1),
        3: FlexColumnWidth(1),
      },
      children: [
        TableRow(
          children: [
            _celda('Día', negrita: true),
            _celda('Asignados', negrita: true),
            _celda('Cerrados', negrita: true),
            _celda('Gestionados', negrita: true),
          ],
        ),
        for (final dia in dias)
          TableRow(
            children: [
              _celda(dia.etiqueta),
              _celda('${dia.asignados}'),
              _celda('${dia.cerrados}'),
              _celda('${dia.gestionados}'),
            ],
          ),
      ],
    );
  }

  Widget _celda(String texto, {bool negrita = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 5, horizontal: 4),
        child: Text(texto,
            style: TextStyle(
                fontSize: 12,
                fontWeight: negrita ? FontWeight.w700 : FontWeight.w400)),
      );

  Widget _filaCuadrilla(CuadrillaMonitoreo cuadrilla) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            Expanded(
              child: Text('${cuadrilla.codigo} — ${cuadrilla.nombre}',
                  style: const TextStyle(fontSize: 12.5)),
            ),
            Text(
              '${cuadrilla.asignados} / ${cuadrilla.cerrados} / ${cuadrilla.gestionados}',
              style: const TextStyle(
                  fontSize: 12, fontWeight: FontWeight.w700, color: Marca.textoSuave),
            ),
          ],
        ),
      );

  Widget _filaCapacidad(CapacidadCuadrilla cuadrilla) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            Icon(
              cuadrilla.completa ? Icons.check_circle_outline : Icons.error_outline,
              size: 16,
              color: cuadrilla.completa ? Marca.exito : Marca.alerta,
            ),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                '${cuadrilla.codigo} — ${cuadrilla.nombre}'
                '${cuadrilla.esSupervisor ? ' (supervisor)' : ''}',
                style: const TextStyle(fontSize: 12.5),
              ),
            ),
            Text('${cuadrilla.integrantes} téc.',
                style: const TextStyle(fontSize: 12, color: Marca.textoSuave)),
            if (cuadrilla.flota != null) ...[
              const SizedBox(width: 8),
              Text(cuadrilla.flota!,
                  style: const TextStyle(fontSize: 11.5, color: Marca.textoSuave)),
            ],
          ],
        ),
      );

  /// Volcado de las vistas secundarias (mismo comportamiento que D-96).
  List<Widget> _tarjetasCrudas(Map<String, dynamic> datos) {
    final lista = <Widget>[];
    for (final entrada in datos.entries) {
      final valor = entrada.value;
      if (valor is List) {
        for (var i = 0; i < valor.length; i++) {
          final fila = valor[i];
          if (fila is Map) {
            lista.add(_tarjetaCruda(
                '${entrada.key} · ${i + 1}', Map<String, dynamic>.from(fila)));
          } else {
            lista.add(_datoCrudo(entrada.key, '$fila'));
          }
        }
      } else if (valor is Map) {
        lista.add(_tarjetaCruda(entrada.key, Map<String, dynamic>.from(valor)));
      } else {
        lista.add(_datoCrudo(entrada.key, '$valor'));
      }
    }
    return lista;
  }

  Widget _tarjetaCruda(String titulo, Map<String, dynamic> datos) => Card(
        margin: const EdgeInsets.only(bottom: 8),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(titulo, style: const TextStyle(fontWeight: FontWeight.bold)),
              const Divider(),
              ...datos.entries.map((e) => _fila(e.key, '${e.value}')),
            ],
          ),
        ),
      );

  Widget _datoCrudo(String titulo, String valor) => Card(
        margin: const EdgeInsets.only(bottom: 6),
        child: ListTile(
          dense: true,
          title: Text(_etiqueta(titulo)),
          trailing: Text(valor, style: const TextStyle(fontWeight: FontWeight.w700)),
        ),
      );

  Widget _fila(String titulo, String valor) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(
          children: [
            Expanded(child: Text(_etiqueta(titulo))),
            const SizedBox(width: 12),
            Flexible(child: Text(valor, textAlign: TextAlign.end)),
          ],
        ),
      );

  String _etiqueta(String texto) => texto
      .replaceAll('_', ' ')
      .split(' ')
      .map((parte) => parte.isEmpty
          ? parte
          : '${parte[0].toUpperCase()}${parte.substring(1)}')
      .join(' ');

  List<(String, int, Color)> _kpisDiario(DiarioMonitoreo diario) => [
        ('Ingresos', diario.ingresosNuevos, Marca.azul),
        ('Resueltos', diario.resueltosTotal, Marca.exito),
        ('Citados', diario.citados, Marca.alerta),
        ('Diferidos', diario.diferidos, Marca.especial),
        ('Gestionados', diario.gestionados, Marca.enrutado),
        ('Pendientes', diario.pendientesTotal, Marca.error),
      ];
}

// ------------------------------------------------------------------------- //
// Datos de los gráficos (funciones puras, verificables)
// ------------------------------------------------------------------------- //

/// Barras del resumen diario (las mismas cifras que las tarjetas de la web).
List<DatoBarra> barrasDiario(DiarioMonitoreo diario) => [
      DatoBarra('Ingresos', diario.ingresosNuevos, color: Marca.azul),
      DatoBarra('Res. resid.', diario.resueltosResidencial, color: Marca.exito),
      DatoBarra('Res. empres.', diario.resueltosEmpresarial, color: Marca.exito),
      DatoBarra('Referidos', diario.resueltosReferidos, color: Marca.alerta),
      DatoBarra('Citados', diario.citados, color: Marca.alerta),
      DatoBarra('Diferidos', diario.diferidos, color: Marca.especial),
      DatoBarra('Gestionados', diario.gestionados, color: Marca.enrutado),
      DatoBarra('Pendientes', diario.pendientesTotal, color: Marca.error),
    ];

/// Barras por estado del periodo (globales).
List<DatoBarra> barrasPorEstado(GlobalesMonitoreo globales) {
  final entradas = globales.porEstado.entries.toList()
    ..sort((a, b) => b.value.compareTo(a.value));
  return [
    for (var i = 0; i < entradas.length; i++)
      DatoBarra(entradas[i].key, entradas[i].value, color: paletaGraficos[i % paletaGraficos.length]),
  ];
}
