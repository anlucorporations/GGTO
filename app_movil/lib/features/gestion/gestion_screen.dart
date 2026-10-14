import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/api_error.dart';
import '../auth/auth_provider.dart';

/// Bandeja móvil GESTIÓN: representa la cuadrilla 0 mediante el indicador
/// `en_gestion_supervisor` que el despacho y la WEB ya utilizan (D-77/D-95).
class GestionScreen extends StatefulWidget {
  const GestionScreen({super.key, this.soloGestion = true});

  final bool soloGestion;

  @override
  State<GestionScreen> createState() => _GestionScreenState();
}

class _GestionScreenState extends State<GestionScreen>
    with WidgetsBindingObserver {
  final _filtro = TextEditingController();
  List<Map<String, dynamic>> _casos = [];
  bool _cargando = false;
  String? _error;
  int _pagina = 1;
  int _paginas = 1;
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
    _filtro.dispose();
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

  Future<void> _cargar({bool siguiente = false}) async {
    if (_cargando) return;
    final central = context.read<AuthProvider>().usuario?.idCentral;
    final paginaSolicitada = siguiente ? _pagina + 1 : 1;
    setState(() {
      _cargando = true;
      _error = null;
      if (!siguiente) {
        _pagina = 1;
        _paginas = 1;
      }
    });
    try {
      final respuesta = await ApiClient.get('/casos', query: {
        if (widget.soloGestion) 'en_gestion_supervisor': true,
        'page': paginaSolicitada,
        'page_size': 200,
        if (central != null) 'id_central': central,
      });
      if (respuesta is! Map || respuesta['items'] is! List) {
        throw StateError('Respuesta de la bandeja GESTIÓN inesperada.');
      }
      if (!mounted) return;
      final items = (respuesta['items'] as List)
          .whereType<Map<String, dynamic>>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList();
      setState(() {
        _pagina = paginaSolicitada;
        _paginas = (respuesta['pages'] as num?)?.toInt() ?? 1;
        _casos = siguiente ? [..._casos, ...items] : items;
      });
    } on ApiError catch (error) {
      if (mounted) setState(() => _error = error.mensaje);
    } catch (error) {
      if (mounted) setState(() => _error = '$error');
    } finally {
      if (mounted) setState(() => _cargando = false);
    }
  }

  List<Map<String, dynamic>> get _visibles {
    final q = _filtro.text.trim().toLowerCase();
    if (q.isEmpty) return _casos;
    return _casos
        .where((caso) =>
            caso.values.any((valor) => '$valor'.toLowerCase().contains(q)))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.soloGestion ? 'GESTIÓN · Cuadrilla 0' : 'Casos'),
        actions: [
          IconButton(
            tooltip: 'Actualizar casos',
            onPressed: _cargando ? null : _cargar,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
            child: TextField(
              controller: _filtro,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search),
                labelText: 'Buscar avería, cliente o dirección',
                border: OutlineInputBorder(),
              ),
            ),
          ),
          if (_error != null)
            MaterialBanner(
              content: Text(_error!),
              actions: [
                TextButton(onPressed: _cargar, child: const Text('Reintentar'))
              ],
            ),
          if (_cargando && _casos.isEmpty)
            const Expanded(child: Center(child: CircularProgressIndicator()))
          else if (_casos.isEmpty)
            const Expanded(
              child: Center(
                  child: Text('No hay casos que coincidan con esta bandeja.')),
            )
          else
            Expanded(
              child: _visibles.isEmpty
                  ? const Center(
                      child: Text('No hay resultados para el filtro.'))
                  : RefreshIndicator(
                      onRefresh: _cargar,
                      child: ListView.builder(
                        padding: const EdgeInsets.fromLTRB(12, 4, 12, 16),
                        itemCount: _visibles.length,
                        itemBuilder: (context, index) {
                          if (index == _visibles.length - 1 &&
                              _pagina < _paginas) {
                            return Column(
                              children: [
                                _tarjeta(_visibles[index]),
                                Padding(
                                  padding:
                                      const EdgeInsets.symmetric(vertical: 12),
                                  child: OutlinedButton(
                                    onPressed: _cargando
                                        ? null
                                        : () => _cargar(siguiente: true),
                                    child: const Text('Cargar más casos'),
                                  ),
                                ),
                              ],
                            );
                          }
                          return _tarjeta(_visibles[index]);
                        },
                      ),
                    ),
            ),
        ],
      ),
    );
  }

  Widget _tarjeta(Map<String, dynamic> caso) {
    final averia = '${caso['id_averia'] ?? '—'}';
    final nombre = '${caso['nombre_cliente'] ?? 'Cliente sin nombre'}';
    final direccion = '${caso['direccion'] ?? 'Dirección no disponible'}';
    final cuadrilla = caso['cuadrilla_codigo'] ?? caso['cuadrilla_nombre'];
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => _verDetalle(caso),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Expanded(
                  child: Text(averia,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                          )),
                ),
                Chip(label: Text('${caso['estado_actual'] ?? 'NUEVO'}')),
              ]),
              Text(nombre, style: const TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 4),
              Text(direccion, maxLines: 2, overflow: TextOverflow.ellipsis),
              const SizedBox(height: 8),
              Text('Cuadrilla actual: ${cuadrilla ?? 'Sin asignar'}'),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 4,
                children: [
                  OutlinedButton.icon(
                    onPressed: () => _verDetalle(caso),
                    icon: const Icon(Icons.visibility_outlined),
                    label: const Text('Ver datos'),
                  ),
                  FilledButton.icon(
                    onPressed: () => _asignar(caso),
                    icon: const Icon(Icons.assignment_ind_outlined),
                    label: const Text('Asignar'),
                  ),
                  if (caso['asignado'] == true)
                    TextButton.icon(
                      onPressed: () => _quitar(caso),
                      icon: const Icon(Icons.remove_circle_outline),
                      label: const Text('Quitar'),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _verDetalle(Map<String, dynamic> caso) {
    final filas = <String, String>{
      'Avería': '${caso['id_averia'] ?? '—'}',
      'Estado': '${caso['estado_actual'] ?? '—'}',
      'Tipo': '${caso['tipo_caso'] ?? '—'}',
      'Categoría': '${caso['categoria'] ?? '—'}',
      'Cliente': '${caso['nombre_cliente'] ?? '—'}',
      'Identificador de pago': '${caso['telefono'] ?? '—'}',
      'Contacto': '${caso['contacto_cliente'] ?? '—'}',
      'Dirección': '${caso['direccion'] ?? '—'}',
      'Sector': '${caso['sector_nombre'] ?? '—'}',
      'Fecha de reporte': '${caso['fecha_reporte'] ?? '—'}',
      'Fecha de cita': '${caso['fecha_cita'] ?? '—'}',
      'Problema reportado': '${caso['problema_reporte'] ?? '—'}',
      'Información': '${caso['informacion'] ?? '—'}',
      'OLT · Slot · Puerto':
          '${caso['olt'] ?? '—'} · ${caso['slot'] ?? '—'} · ${caso['puerto'] ?? '—'}',
      'FAT': '${caso['fat'] ?? '—'}',
    };
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (context) => SafeArea(
        child: FractionallySizedBox(
          heightFactor: .88,
          child: Column(
            children: [
              ListTile(
                title: Text('Caso ${caso['id_averia'] ?? ''}'),
                trailing: IconButton(
                  tooltip: 'Cerrar',
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close),
                ),
              ),
              const Divider(height: 1),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: filas.entries
                      .map((fila) => ListTile(
                            dense: true,
                            title: Text(fila.key),
                            subtitle: Text(fila.value),
                          ))
                      .toList(),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _asignar(Map<String, dynamic> caso) async {
    final central = (caso['id_central'] as num?)?.toInt() ??
        context.read<AuthProvider>().usuario?.idCentral;
    dynamic respuesta;
    try {
      respuesta = await ApiClient.get('/cuadrillas', query: {
        'solo_activas': true,
        if (central != null) 'id_central': central,
      });
    } on ApiError catch (error) {
      if (mounted) _mensaje(error.mensaje);
      return;
    }
    if (!mounted) return;
    final cuadrillas = respuesta is List
        ? respuesta
            .whereType<Map<String, dynamic>>()
            .map((m) => Map<String, dynamic>.from(m))
            .toList()
        : <Map<String, dynamic>>[];
    final destino =
        cuadrillas.where((q) => q['es_supervisor'] != true).toList();
    if (destino.isEmpty) {
      _mensaje('No hay cuadrillas activas para asignar este caso.');
      return;
    }
    final id = await showDialog<int>(
      context: context,
      builder: (context) => _SelectorCuadrilla(cuadrillas: destino),
    );
    if (id == null || !mounted) return;
    await _mutarAsignacion('/despachos/asignar-casos', {
      'id_cuadrilla': id,
      'ids_caso': [caso['id_caso']],
      'fecha': _hoyLocal(),
      if (central != null) 'id_central': central,
    });
  }

  Future<void> _quitar(Map<String, dynamic> caso) async {
    final central = (caso['id_central'] as num?)?.toInt() ??
        context.read<AuthProvider>().usuario?.idCentral;
    await _mutarAsignacion('/despachos/quitar-casos', {
      'ids_caso': [caso['id_caso']],
      'fecha': _hoyLocal(),
      if (central != null) 'id_central': central,
    });
  }

  String _hoyLocal() {
    final ahora = DateTime.now();
    return '${ahora.year.toString().padLeft(4, '0')}-'
        '${ahora.month.toString().padLeft(2, '0')}-'
        '${ahora.day.toString().padLeft(2, '0')}';
  }

  Future<void> _mutarAsignacion(String ruta, Map<String, dynamic> datos) async {
    try {
      final respuesta = await ApiClient.post(ruta, data: datos);
      final mensaje = respuesta is Map
          ? '${respuesta['mensaje'] ?? 'Operación completada.'}'
          : 'Operación completada.';
      if (!mounted) return;
      _mensaje(mensaje);
      await _cargar();
    } on ApiError catch (error) {
      if (mounted) _mensaje(error.mensaje);
    }
  }

  void _mensaje(String texto) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(texto)));
  }
}

class _SelectorCuadrilla extends StatefulWidget {
  const _SelectorCuadrilla({required this.cuadrillas});
  final List<Map<String, dynamic>> cuadrillas;

  @override
  State<_SelectorCuadrilla> createState() => _SelectorCuadrillaState();
}

class _SelectorCuadrillaState extends State<_SelectorCuadrilla> {
  int? _seleccion;

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: const Text('Asignar caso a cuadrilla'),
        content: DropdownButtonFormField<int>(
          value: _seleccion,
          decoration: const InputDecoration(labelText: 'Cuadrilla'),
          items: widget.cuadrillas
              .map((q) => DropdownMenuItem<int>(
                    value: q['id_cuadrilla'] as int,
                    child: Text('${q['codigo']} · ${q['nombre']}'),
                  ))
              .toList(),
          onChanged: (id) => setState(() => _seleccion = id),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancelar')),
          FilledButton(
            onPressed: _seleccion == null
                ? null
                : () => Navigator.pop(context, _seleccion),
            child: const Text('Asignar'),
          ),
        ],
      );
}
