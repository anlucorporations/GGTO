import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/api_error.dart';

/// Consulta y operación del despacho diario del centro.
class DespachoScreen extends StatefulWidget {
  const DespachoScreen({super.key});

  @override
  State<DespachoScreen> createState() => _DespachoScreenState();
}

class _DespachoScreenState extends State<DespachoScreen>
    with WidgetsBindingObserver {
  DateTime _fecha = DateTime.now();
  List<Map<String, dynamic>> _despachos = [];
  bool _cargando = true;
  bool _ocupado = false;
  String? _error;
  Timer? _timer;

  String get _fechaApi =>
      '${_fecha.year.toString().padLeft(4, '0')}-${_fecha.month.toString().padLeft(2, '0')}-${_fecha.day.toString().padLeft(2, '0')}';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _cargar();
    _programar();
  }

  @override
  void dispose() {
    _timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
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
      await _cargar();
      if (mounted) _programar();
    });
  }

  Future<void> _cargar() async {
    if (mounted) setState(() => _cargando = true);
    try {
      final respuesta =
          await ApiClient.get('/despachos', query: {'fecha': _fechaApi});
      if (!mounted) return;
      setState(() {
        _despachos = (respuesta as List).cast<Map<String, dynamic>>();
        _error = null;
        _cargando = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error is ApiError
            ? error.mensaje
            : 'No se pudo cargar el despacho.';
        _cargando = false;
      });
    }
  }

  Future<void> _generar() async {
    setState(() => _ocupado = true);
    try {
      await ApiClient.post('/despachos', data: null);
      await _cargar();
      if (mounted) _avisar('Despacho del día generado.');
    } catch (error) {
      if (mounted) {
        _avisar(
            error is ApiError
                ? error.mensaje
                : 'No se pudo generar el despacho.',
            error: true);
      }
    } finally {
      if (mounted) setState(() => _ocupado = false);
    }
  }

  Future<void> _asignarSectores({required bool procesar}) async {
    setState(() => _ocupado = true);
    try {
      final proceso = await ApiClient.get('/despachos/proceso',
          query: {'fecha': _fechaApi});
      if (!mounted) return;
      final guardado = await showDialog<bool>(
        context: context,
        builder: (_) => _AsignacionSectoresDialog(
          fecha: _fechaApi,
          proceso: proceso as Map<String, dynamic>,
          procesar: procesar,
        ),
      );
      if (guardado == true) {
        await _cargar();
        if (mounted) {
          _avisar(procesar ? 'Asignación procesada.' : 'Asignación guardada.');
        }
      }
    } catch (error) {
      if (mounted) {
        _avisar(error is ApiError ? error.mensaje : 'No se pudo preparar la asignación.', error: true);
      }
    } finally {
      if (mounted) setState(() => _ocupado = false);
    }
  }

  Future<void> _cambiarEstado(
      Map<String, dynamic> despacho, String estado) async {
    setState(() => _ocupado = true);
    try {
      await ApiClient.patch('/despachos/${despacho['id_despacho']}',
          data: {'estado': estado});
      await _cargar();
      if (mounted) _avisar('Despacho actualizado: $estado.');
    } catch (error) {
      if (mounted) {
        _avisar(
            error is ApiError
                ? error.mensaje
                : 'No se pudo actualizar el despacho.',
            error: true);
      }
    } finally {
      if (mounted) setState(() => _ocupado = false);
    }
  }

  void _avisar(String texto, {bool error = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(texto),
      backgroundColor: error ? Theme.of(context).colorScheme.error : null,
    ));
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: const Text('Gestión de despacho'),
          actions: [
            IconButton(
                onPressed: _cargar,
                icon: const Icon(Icons.refresh),
                tooltip: 'Actualizar'),
            IconButton(
              onPressed: () async {
                final fecha = await showDatePicker(
                  context: context,
                  initialDate: _fecha,
                  firstDate: DateTime(2020),
                  lastDate: DateTime(2100),
                );
                if (fecha != null && mounted) {
                  setState(() => _fecha = fecha);
                  await _cargar();
                }
              },
              icon: const Icon(Icons.calendar_month),
              tooltip: 'Seleccionar fecha',
            ),
          ],
        ),
        body: _cargando
            ? const Center(child: CircularProgressIndicator())
            : Column(children: [
                if (_error != null)
                  MaterialBanner(
                    content: Text(_error!),
                    actions: [
                      TextButton(
                          onPressed: _cargar, child: const Text('Reintentar'))
                    ],
                  ),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(children: [
                    Expanded(
                        child: Text('Despachos del $_fechaApi',
                            style: Theme.of(context).textTheme.titleMedium)),
                    OutlinedButton.icon(
                      onPressed: _ocupado
                          ? null
                          : () => _asignarSectores(procesar: false),
                      icon: const Icon(Icons.tune),
                      label: const Text('Sectores'),
                    ),
                    const SizedBox(width: 8),
                    if (_despachos.isEmpty)
                      OutlinedButton.icon(
                        onPressed: _ocupado
                            ? null
                            : () => _asignarSectores(procesar: true),
                        icon: const Icon(Icons.play_arrow),
                        label: const Text('Procesar'),
                      ),
                    const SizedBox(width: 8),
                    if (_fechaApi == _hoyApi && _despachos.isEmpty)
                      FilledButton.icon(
                        onPressed: _ocupado ? null : _generar,
                        icon: const Icon(Icons.playlist_add),
                        label: const Text('Generar'),
                      ),
                  ]),
                ),
                Expanded(
                  child: _despachos.isEmpty
                      ? Center(
                          child: Text(_fechaApi == _hoyApi
                              ? 'No hay despacho para hoy.'
                              : 'Sin despachos para esta fecha.'))
                      : RefreshIndicator(
                          onRefresh: _cargar,
                          child: ListView.builder(
                            itemCount: _despachos.length,
                            itemBuilder: (context, index) =>
                                _tarjeta(_despachos[index]),
                          ),
                        ),
                ),
              ]),
      );

  String get _hoyApi {
    final hoy = DateTime.now();
    return '${hoy.year.toString().padLeft(4, '0')}-${hoy.month.toString().padLeft(2, '0')}-${hoy.day.toString().padLeft(2, '0')}';
  }

  Widget _tarjeta(Map<String, dynamic> despacho) {
    final casos = (despacho['casos'] as List?)?.length ?? 0;
    final estado = '${despacho['estado']}';
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      child: ExpansionTile(
        leading: const Icon(Icons.local_shipping_outlined),
        title: Text(
            '${despacho['cuadrilla_codigo'] ?? 'Cuadrilla'} · ${despacho['cuadrilla_nombre'] ?? ''}'),
        subtitle: Text('$estado · $casos casos'),
        children: [
          if (despacho['casos'] is List)
            ...(despacho['casos'] as List)
                .cast<Map<String, dynamic>>()
                .map((caso) => ListTile(
                      dense: true,
                      title: Text('Caso #${caso['id_caso']}'),
                      subtitle: Text(
                          'Orden ${caso['orden_visita'] ?? '—'} · ${caso['estado']} · ${caso['tipo_asignacion'] ?? '—'}'),
                    )),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
            child: Wrap(spacing: 8, children: [
              if (estado == 'BORRADOR')
                OutlinedButton(
                  onPressed: _ocupado
                      ? null
                      : () => _cambiarEstado(despacho, 'PUBLICADO'),
                  child: const Text('Publicar'),
                ),
              if (estado == 'PUBLICADO')
                OutlinedButton(
                  onPressed: _ocupado
                      ? null
                      : () => _cambiarEstado(despacho, 'CERRADO'),
                  child: const Text('Cerrar despacho'),
                ),
            ]),
          ),
        ],
      ),
    );
  }
}

class _AsignacionSectoresDialog extends StatefulWidget {
  const _AsignacionSectoresDialog({
    required this.fecha,
    required this.proceso,
    required this.procesar,
  });
  final String fecha;
  final Map<String, dynamic> proceso;
  final bool procesar;

  @override
  State<_AsignacionSectoresDialog> createState() =>
      _AsignacionSectoresDialogState();
}

class _AsignacionSectoresDialogState extends State<_AsignacionSectoresDialog> {
  late final List<Map<String, dynamic>> _sectores =
      (widget.proceso['sectores'] as List?)?.cast<Map<String, dynamic>>() ?? [];
  late final List<Map<String, dynamic>> _cuadrillas =
      (widget.proceso['cuadrillas'] as List?)?.cast<Map<String, dynamic>>() ?? [];
  late final Map<int, int?> _seleccion = {
    for (final sector in _sectores)
      sector['id_sector'] as int: sector['id_cuadrilla'] as int?,
  };
  bool _guardando = false;
  String? _error;

  List<Map<String, dynamic>> get _asignaciones {
    final porCuadrilla = <int, List<int>>{};
    for (final entrada in _seleccion.entries) {
      final idCuadrilla = entrada.value;
      if (idCuadrilla != null) {
        (porCuadrilla[idCuadrilla] ??= []).add(entrada.key);
      }
    }
    return porCuadrilla.entries
        .map((e) => {'id_cuadrilla': e.key, 'ids_sector': e.value})
        .toList();
  }

  Future<void> _guardar() async {
    setState(() {
      _guardando = true;
      _error = null;
    });
    final asignaciones = _asignaciones;
    try {
      await ApiClient.put('/despachos/asignacion', data: {
        'fecha': widget.fecha,
        'id_central': widget.proceso['id_central'],
        'asignaciones': asignaciones,
      });
      if (widget.procesar) {
        await ApiClient.post('/despachos/procesar', data: {
          'fecha': widget.fecha,
          'id_central': widget.proceso['id_central'],
          'asignaciones': asignaciones,
          'reemplazar': true,
        });
      }
      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error is ApiError ? error.mensaje : 'No se pudo guardar la asignación.';
          _guardando = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: Text('Asignación de sectores · ${widget.fecha}'),
        content: SizedBox(
          width: 500,
          child: _sectores.isEmpty
              ? const Text('No hay sectores con casos para asignar.')
              : ListView(
                  shrinkWrap: true,
                  children: [
                    if (_error != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                      ),
                    ..._sectores.map((sector) {
                      final id = sector['id_sector'] as int;
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: DropdownButtonFormField<int?>(
                          value: _seleccion[id],
                          decoration: InputDecoration(
                            labelText: '${sector['nombre'] ?? 'Sector $id'} · ${sector['total'] ?? 0} casos',
                          ),
                          items: [
                            const DropdownMenuItem<int?>(value: null, child: Text('Sin asignar')),
                            ..._cuadrillas.map((c) => DropdownMenuItem<int?>(
                                  value: c['id_cuadrilla'] as int,
                                  child: Text('${c['codigo']} · ${c['nombre']}'),
                                )),
                          ],
                          onChanged: _guardando
                              ? null
                              : (value) => setState(() => _seleccion[id] = value),
                        ),
                      );
                    }),
                  ],
                ),
        ),
        actions: [
          TextButton(
            onPressed: _guardando ? null : () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: _guardando || _sectores.isEmpty ? null : _guardar,
            child: Text(_guardando
                ? 'Guardando…'
                : widget.procesar
                    ? 'Guardar y procesar'
                    : 'Guardar asignación'),
          ),
        ],
      );
}
