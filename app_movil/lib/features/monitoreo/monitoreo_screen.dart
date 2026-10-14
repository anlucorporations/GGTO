import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/api_error.dart';

enum VistaMonitoreo {
  diaria('Diaria', '/monitoreo/diario'),
  semanal('Semanal', '/monitoreo/semanal'),
  mensual('Mensual', '/monitoreo/mensual'),
  especiales('Casos especiales', '/monitoreo/casos-especiales'),
  construcciones('Construcciones', '/monitoreo/construcciones');

  const VistaMonitoreo(this.etiqueta, this.ruta);
  final String etiqueta;
  final String ruta;
}

/// Selector de las cinco vistas de MONITOREO de gestión (RF-APK-13/18).
class MonitoreoScreen extends StatefulWidget {
  const MonitoreoScreen({super.key});

  @override
  State<MonitoreoScreen> createState() => _MonitoreoScreenState();
}

class _MonitoreoScreenState extends State<MonitoreoScreen>
    with WidgetsBindingObserver {
  VistaMonitoreo _vista = VistaMonitoreo.diaria;
  Map<String, dynamic>? _datos;
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
      final respuesta = await ApiClient.get(_vista.ruta);
      if (respuesta is! Map) {
        throw StateError('Respuesta de monitoreo inesperada.');
      }
      if (!mounted) return;
      setState(() {
        _datos = Map<String, dynamic>.from(respuesta);
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

  Future<void> _cambiarVista(VistaMonitoreo vista) async {
    if (_vista == vista) return;
    setState(() {
      _vista = vista;
      _datos = null;
    });
    await _cargar();
    _programarRefresco();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Monitoreo de gestión'),
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
          padding: const EdgeInsets.all(16),
          children: [
            DropdownButtonFormField<VistaMonitoreo>(
              value: _vista,
              decoration: const InputDecoration(
                labelText: 'Vista',
                border: OutlineInputBorder(),
              ),
              items: VistaMonitoreo.values
                  .map((vista) => DropdownMenuItem(
                        value: vista,
                        child: Text(vista.etiqueta),
                      ))
                  .toList(),
              onChanged: (vista) {
                if (vista != null) _cambiarVista(vista);
              },
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Icon(
                  _error == null ? Icons.cloud_done_outlined : Icons.cloud_off,
                  size: 18,
                  color: _error == null ? Colors.green : Colors.orange.shade800,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    _actualizado == null
                        ? 'Aún no actualizado'
                        : 'Actualizado ${TimeOfDay.fromDateTime(_actualizado!).format(context)}',
                  ),
                ),
                if (_cargando)
                  const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
              ],
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Card(
                color: Theme.of(context).colorScheme.errorContainer,
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Text('No se pudo actualizar. $_error'),
                ),
              ),
            ],
            const SizedBox(height: 12),
            if (_datos == null && _cargando)
              const Padding(
                padding: EdgeInsets.all(32),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_datos != null)
              ..._tarjetas(_datos!),
          ],
        ),
      ),
    );
  }

  List<Widget> _tarjetas(Map<String, dynamic> datos) {
    final lista = <Widget>[];
    for (final entrada in datos.entries) {
      final valor = entrada.value;
      if (valor is List) {
        for (var i = 0; i < valor.length; i++) {
          final fila = valor[i];
          if (fila is Map) {
            lista.add(_tarjeta(
                '${entrada.key} · ${i + 1}', Map<String, dynamic>.from(fila)));
          } else {
            lista.add(_dato(entrada.key, '$fila'));
          }
        }
      } else if (valor is Map) {
        lista.add(_tarjeta(entrada.key, Map<String, dynamic>.from(valor)));
      } else {
        lista.add(_dato(entrada.key, '$valor'));
      }
    }
    return lista;
  }

  Widget _tarjeta(String titulo, Map<String, dynamic> datos) => Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
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

  Widget _dato(String titulo, String valor) => Card(
        child: ListTile(
          title: Text(_etiqueta(titulo)),
          trailing:
              Text(valor, style: const TextStyle(fontWeight: FontWeight.w700)),
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
}
