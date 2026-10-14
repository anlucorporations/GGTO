import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/api_error.dart';

/// Consulta de alertas y fallas masivas para Coordinación.
/// Solo permite solicitar materiales; la falla permanece en solo lectura.
class CoordinacionScreen extends StatefulWidget {
  const CoordinacionScreen({super.key});

  @override
  State<CoordinacionScreen> createState() => _CoordinacionScreenState();
}

class _CoordinacionScreenState extends State<CoordinacionScreen>
    with WidgetsBindingObserver {
  List<Map<String, dynamic>> _fallas = [];
  List<Map<String, dynamic>> _alertas = [];
  bool _cargando = true;
  String? _error;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _cargar();
    _programar();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _cargar();
      _programar();
    } else {
      _timer?.cancel();
    }
  }

  void _programar() {
    _timer?.cancel();
    _timer = Timer(const Duration(minutes: 5), () async {
      await _cargar(silencioso: true);
      if (mounted) _programar();
    });
  }

  Future<void> _cargar({bool silencioso = false}) async {
    if (!silencioso && mounted) setState(() => _cargando = true);
    try {
      final respuestas = await Future.wait([
        ApiClient.get('/fallas-masivas', query: {'solo_activas': true}),
        ApiClient.get('/notificaciones', query: {'limite': 100}),
      ]);
      if (!mounted) return;
      setState(() {
        _fallas = (respuestas[0] as List).cast<Map<String, dynamic>>();
        _alertas = (respuestas[1] as List).cast<Map<String, dynamic>>();
        _error = null;
        _cargando = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error is ApiError
            ? error.mensaje
            : 'No se pudieron cargar las alertas.';
        _cargando = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: const Text('Alertas y fallas masivas'),
          actions: [
            IconButton(
              tooltip: 'Actualizar',
              onPressed: _cargar,
              icon: const Icon(Icons.refresh),
            ),
          ],
        ),
        body: _cargando
            ? const Center(child: CircularProgressIndicator())
            : RefreshIndicator(
                onRefresh: _cargar,
                child: ListView(
                  padding: const EdgeInsets.only(bottom: 24),
                  children: [
                    if (_error != null)
                      MaterialBanner(
                        content: Text(_error!),
                        actions: [
                          TextButton(
                              onPressed: _cargar,
                              child: const Text('Reintentar')),
                        ],
                      ),
                    _encabezado('Fallas masivas activas', _fallas.length),
                    if (_fallas.isEmpty)
                      const ListTile(
                          title: Text('No hay fallas masivas activas.')),
                    ..._fallas.map(_tarjetaFalla),
                    _encabezado('Alertas del sistema', _alertas.length),
                    if (_alertas.isEmpty)
                      const ListTile(
                          title: Text('No hay alertas registradas.')),
                    ..._alertas.map(_tarjetaAlerta),
                  ],
                ),
              ),
      );

  Widget _encabezado(String titulo, int cantidad) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 18, 16, 4),
        child: Text('$titulo ($cantidad)',
            style: Theme.of(context).textTheme.titleLarge),
      );

  Widget _tarjetaFalla(Map<String, dynamic> falla) => Card(
        margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        child: ListTile(
          leading: const Icon(Icons.warning_amber_rounded),
          title: Text('Falla #${falla['id_falla']} · ${falla['estado']}'),
          subtitle: Text([
            falla['descripcion'],
            if (falla['sector_nombre'] != null)
              'Sector: ${falla['sector_nombre']}',
            if (falla['casos_afectos'] != null)
              'Casos afectados: ${falla['casos_afectos']}',
            'Órdenes de material: ${falla['ordenes_count'] ?? 0}',
          ].join('\n')),
          isThreeLine: true,
          trailing: IconButton(
            tooltip: 'Solicitar materiales',
            icon: const Icon(Icons.inventory_2_outlined),
            onPressed: () => _solicitarMaterial(falla),
          ),
          onTap: () => _verFalla(falla),
        ),
      );

  Widget _tarjetaAlerta(Map<String, dynamic> alerta) => Card(
        margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        child: ListTile(
          leading: const Icon(Icons.notifications_active_outlined),
          title: Text('${alerta['asunto'] ?? alerta['canal'] ?? 'Alerta'}'),
          subtitle: Text([
            if (alerta['cuerpo'] != null) '${alerta['cuerpo']}',
            'Estado: ${alerta['estado'] ?? '—'}',
            if (alerta['error'] != null) 'Detalle: ${alerta['error']}',
          ].join('\n')),
          isThreeLine: true,
        ),
      );

  Future<void> _verFalla(Map<String, dynamic> falla) async {
    List<Map<String, dynamic>> ordenes = [];
    try {
      final respuesta =
          await ApiClient.get('/fallas-masivas/${falla['id_falla']}/ordenes');
      ordenes = (respuesta as List).cast<Map<String, dynamic>>();
    } catch (_) {
      // La ficha sigue disponible aunque falle la consulta secundaria.
    }
    if (!mounted) return;
    await showDialog<void>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text('Falla masiva #${falla['id_falla']}'),
        content: SingleChildScrollView(
          child: Text([
            'Estado: ${falla['estado']}',
            'Descripción: ${falla['descripcion']}',
            'ODN: ${falla['odn'] ?? '—'}',
            'Dirección: ${falla['direccion'] ?? '—'}',
            'FAT: ${falla['fat'] ?? '—'}',
            'Sector: ${falla['sector_nombre'] ?? '—'}',
            'Cuadrilla: ${falla['cuadrilla_nombre'] ?? '—'}',
            'Planificación: ${falla['planificacion'] ?? '—'}',
            '',
            'Solicitudes de material:',
            if (ordenes.isEmpty)
              'Sin solicitudes registradas.'
            else
              ...ordenes.map((o) =>
                  '#${o['id_orden']} · ${o['estado']} · ${o['observacion'] ?? ''}'),
          ].join('\n')),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cerrar'))
        ],
      ),
    );
  }

  Future<void> _solicitarMaterial(Map<String, dynamic> falla) async {
    final controlador = TextEditingController();
    final descripcion = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Materiales · Falla #${falla['id_falla']}'),
        content: TextField(
          controller: controlador,
          minLines: 2,
          maxLines: 5,
          decoration: const InputDecoration(
            labelText: 'Material requerido',
            hintText: 'Describa cantidades y materiales',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancelar')),
          FilledButton(
            onPressed: () {
              final texto = controlador.text.trim();
              if (texto.length >= 3) Navigator.pop(context, texto);
            },
            child: const Text('Solicitar'),
          ),
        ],
      ),
    );
    controlador.dispose();
    if (descripcion == null) return;
    try {
      await ApiClient.post('/fallas-masivas/${falla['id_falla']}/material',
          data: {'descripcion': descripcion});
      await _cargar(silencioso: true);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Solicitud de materiales enviada.')),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(error is ApiError
              ? error.mensaje
              : 'No se pudo solicitar el material.'),
        ));
      }
    }
  }
}
