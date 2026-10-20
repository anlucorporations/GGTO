import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/api_error.dart';
import '../casos/operaciones_service.dart';

/// Bandeja de casos especiales para coordinación y supervisión.
class EspecialesScreen extends StatefulWidget {
  const EspecialesScreen({
    super.key,
    required this.puedeCrear,
    required this.puedeGestionar,
  });
  final bool puedeCrear;
  final bool puedeGestionar;

  @override
  State<EspecialesScreen> createState() => _EspecialesScreenState();
}

class _EspecialesScreenState extends State<EspecialesScreen>
    with WidgetsBindingObserver {
  final _busqueda = TextEditingController();
  List<Map<String, dynamic>> _casos = [];
  List<Map<String, dynamic>> _solicitantes = [];
  bool _cargando = true;
  String? _error;
  Timer? _temporizador;

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
    _temporizador?.cancel();
    _busqueda.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _cargar();
      _programar();
    } else {
      _temporizador?.cancel();
    }
  }

  void _programar() {
    _temporizador?.cancel();
    _temporizador = Timer(const Duration(minutes: 5), () async {
      await _cargar(silencioso: true);
      if (mounted) _programar();
    });
  }

  Future<void> _cargar({bool silencioso = false}) async {
    if (!silencioso && mounted) setState(() => _cargando = true);
    try {
      final resultados = await Future.wait([
        ApiClient.get('/casos-especiales', query: {
          if (_busqueda.text.trim().isNotEmpty) 'q': _busqueda.text.trim(),
        }),
        ApiClient.get('/solicitantes'),
      ]);
      if (!mounted) return;
      setState(() {
        _casos = (resultados[0] as List).cast<Map<String, dynamic>>();
        _solicitantes = (resultados[1] as List).cast<Map<String, dynamic>>();
        _error = null;
        _cargando = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error is ApiError
            ? error.mensaje
            : 'No se pudieron cargar los casos especiales.';
        _cargando = false;
      });
    }
  }

  Future<void> _crear() async {
    final datos = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (_) => _CrearEspecialDialog(solicitantes: _solicitantes),
    );
    if (datos == null) return;
    try {
      final creado = await ApiClient.post('/casos-especiales', data: datos);
      await _cargar(silencioso: true);
      if (!mounted) return;
      // D-122: el servidor avisa cuando el especial no llegará hoy a la APK
      // (jornada ya publicada o sector sin cuadrilla asignada).
      final aviso = creado is Map ? '${creado['aviso'] ?? ''}'.trim() : '';
      if (aviso.isNotEmpty) {
        await showDialog<void>(
          context: context,
          builder: (contexto) => AlertDialog(
            title: const Text('Caso especial creado'),
            content: Text(aviso),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(contexto),
                child: const Text('Entendido'),
              ),
            ],
          ),
        );
        return;
      }
      _avisar('Caso especial creado.');
    } catch (error) {
      if (mounted) {
        _avisar(
            error is ApiError
                ? error.mensaje
                : 'No se pudo crear el caso especial.',
            error: true);
      }
    }
  }

  void _avisar(String texto, {bool error = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(texto),
      backgroundColor: error ? Theme.of(context).colorScheme.error : null,
    ));
  }

  /// D-120: **cierra el caso asociado** al especial desde la APK.
  ///
  /// El especial no tiene cierre propio: el trabajo se cierra en su caso (el
  /// servidor alinea `caso_especial.estado` con el del caso). Se pide el modo de
  /// cierre del catálogo y una descripción, igual que en la ficha del técnico.
  Future<void> _cerrarCaso(Map<String, dynamic> especial, int idCaso) async {
    final datos = await showDialog<Map<String, String>>(
      context: context,
      builder: (_) => _CerrarCasoEspecialDialog(
        titulo: 'Cerrar el caso del especial #${especial['id_caso_especial']}',
      ),
    );
    if (datos == null || !mounted) return;
    final resultado = await OperacionesService.cerrar(
      idCaso: idCaso,
      idAveria: '${especial['id_averia'] ?? ''}',
      modo: datos['modo'] ?? 'IVR',
      descripcion: datos['descripcion'] ?? '',
    );
    await _cargar(silencioso: true);
    if (mounted) _avisar(resultado.mensaje, error: !resultado.valida);
  }

  Future<void> _editar(Map<String, dynamic> caso) async {
    final cambios = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (_) => _EditarEspecialDialog(caso: caso),
    );
    if (cambios == null) return;
    try {
      await ApiClient.patch(
        '/casos-especiales/${caso['id_caso_especial']}',
        data: cambios,
      );
      await _cargar(silencioso: true);
      if (mounted) _avisar('Caso especial actualizado.');
    } catch (error) {
      if (mounted) {
        _avisar(
          error is ApiError ? error.mensaje : 'No se pudo actualizar el caso.',
          error: true,
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: const Text('Casos especiales'),
          actions: [
            IconButton(
                onPressed: _cargar,
                icon: const Icon(Icons.refresh),
                tooltip: 'Actualizar'),
            if (widget.puedeCrear)
              IconButton(
                  onPressed: _crear,
                  icon: const Icon(Icons.add),
                  tooltip: 'Crear caso especial'),
          ],
        ),
        body: Column(children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: TextField(
              controller: _busqueda,
              textInputAction: TextInputAction.search,
              onSubmitted: (_) => _cargar(),
              decoration: InputDecoration(
                labelText: 'Buscar casos especiales',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: IconButton(
                    icon: const Icon(Icons.send), onPressed: _cargar),
                border: const OutlineInputBorder(),
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
          Expanded(
            child: _cargando
                ? const Center(child: CircularProgressIndicator())
                : _casos.isEmpty
                    ? const Center(child: Text('No hay casos especiales.'))
                    : RefreshIndicator(
                        onRefresh: _cargar,
                        child: ListView.builder(
                          padding: const EdgeInsets.only(bottom: 16),
                          itemCount: _casos.length,
                          itemBuilder: (context, index) =>
                              _tarjeta(_casos[index]),
                        ),
                      ),
          ),
        ]),
        floatingActionButton: widget.puedeCrear
            ? FloatingActionButton.extended(
                onPressed: _crear,
                icon: const Icon(Icons.add),
                label: const Text('Crear'),
              )
            : null,
      );

  Widget _tarjeta(Map<String, dynamic> caso) {
    final id = caso['id_caso_especial'];
    final titulo = caso['nombre_cliente'] ??
        caso['solicitante_nombre'] ??
        'Caso especial #$id';
    final subtitulo = [
      caso['clasificacion'],
      caso['tipo_actividad'],
      caso['prioridad'],
      caso['estado'],
    ].where((v) => v != null).join(' · ');
    // D-120: el cierre real se hace sobre el **caso asociado**; aquí solo se
    // ofrece cuando el caso todavía admite gestión.
    final idCaso = caso['id_caso'] is int ? caso['id_caso'] as int : null;
    final estadoCaso = '${caso['estado_caso'] ?? ''}'.toUpperCase();
    final cerrado = estadoCaso == 'CERRADO' ||
        estadoCaso == 'CANCELADO' ||
        estadoCaso == 'ENRUTADO' ||
        '${caso['estado']}'.toUpperCase() == 'CERRADO';
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      child: ListTile(
        leading: CircleAvatar(child: Text('${caso['id_caso_especial']}')),
        title: Text('$titulo'),
        subtitle: Text([
          subtitulo,
          if (estadoCaso.isNotEmpty) 'Caso: $estadoCaso',
          if (caso['direccion'] != null) '${caso['direccion']}',
          if (caso['descripcion'] != null &&
              '${caso['descripcion']}'.isNotEmpty)
            '${caso['descripcion']}',
        ].join('\n')),
        isThreeLine: true,
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (widget.puedeGestionar && idCaso != null && !cerrado)
              IconButton(
                key: Key('especial-cerrar-$id'),
                tooltip: 'Cerrar el caso',
                icon: const Icon(Icons.task_alt, color: Colors.green),
                onPressed: () => _cerrarCaso(caso, idCaso),
              ),
            Icon(caso['requiere_informe'] == true
                ? Icons.description
                : Icons.description_outlined),
          ],
        ),
        onTap: () => widget.puedeGestionar
            ? _editar(caso)
            : showDialog<void>(
                context: context,
                builder: (_) => AlertDialog(
                  title: Text('Caso especial #$id'),
                  content: SingleChildScrollView(
                    child: Text([
                      'Estado: ${caso['estado']}',
                      'Clasificación: ${caso['clasificacion']}',
                      'Actividad: ${caso['tipo_actividad']}',
                      'Prioridad: ${caso['prioridad']}',
                      'Solicitante: ${caso['solicitante_nombre'] ?? '—'}',
                      'Unidad: ${caso['solicitante_unidad'] ?? '—'}',
                      'Cliente: ${caso['nombre_cliente'] ?? '—'}',
                      'Dirección: ${caso['direccion'] ?? '—'}',
                      'Descripción: ${caso['descripcion'] ?? '—'}',
                      'Requiere informe: ${caso['requiere_informe'] == true ? 'Sí' : 'No'}',
                    ].join('\n\n')),
                  ),
                  actions: [
                    TextButton(
                        onPressed: () => Navigator.pop(context),
                        child: const Text('Cerrar'))
                  ],
                ),
              ),
      ),
    );
  }
}

class _EditarEspecialDialog extends StatefulWidget {
  const _EditarEspecialDialog({required this.caso});
  final Map<String, dynamic> caso;

  @override
  State<_EditarEspecialDialog> createState() => _EditarEspecialDialogState();
}

class _EditarEspecialDialogState extends State<_EditarEspecialDialog> {
  late String _prioridad = '${widget.caso['prioridad']}';
  late String _estado = '${widget.caso['estado']}';
  late bool _informe = widget.caso['requiere_informe'] == true;
  late final TextEditingController _descripcion = TextEditingController(
    text: '${widget.caso['descripcion'] ?? ''}',
  );

  @override
  void dispose() {
    _descripcion.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: Text('Editar caso especial #${widget.caso['id_caso_especial']}'),
        content: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            DropdownButtonFormField<String>(
              value: _estado,
              decoration: const InputDecoration(labelText: 'Estado'),
              items: const ['ABIERTO', 'EN_PROCESO', 'ATENDIDO', 'CERRADO']
                  .map((v) => DropdownMenuItem(value: v, child: Text(v)))
                  .toList(),
              onChanged: (v) => setState(() => _estado = v!),
            ),
            DropdownButtonFormField<String>(
              value: _prioridad,
              decoration: const InputDecoration(labelText: 'Prioridad'),
              items: const ['ALTA', 'MEDIA', 'BAJA']
                  .map((v) => DropdownMenuItem(value: v, child: Text(v)))
                  .toList(),
              onChanged: (v) => setState(() => _prioridad = v!),
            ),
            TextField(
              controller: _descripcion,
              maxLines: 3,
              decoration: const InputDecoration(labelText: 'Descripción'),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Requiere informe'),
              value: _informe,
              onChanged: (v) => setState(() => _informe = v),
            ),
          ]),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, {
              'estado': _estado,
              'prioridad': _prioridad,
              'descripcion': _descripcion.text.trim(),
              'requiere_informe': _informe,
            }),
            child: const Text('Guardar'),
          ),
        ],
      );
}

class _CrearEspecialDialog extends StatefulWidget {
  const _CrearEspecialDialog({required this.solicitantes});
  final List<Map<String, dynamic>> solicitantes;

  @override
  State<_CrearEspecialDialog> createState() => _CrearEspecialDialogState();
}

class _CrearEspecialDialogState extends State<_CrearEspecialDialog> {
  final _form = GlobalKey<FormState>();
  final _nombre = TextEditingController();
  final _averia = TextEditingController();
  final _tipoProblema = TextEditingController();
  final _telefono = TextEditingController();
  final _contacto = TextEditingController();
  final _direccion = TextEditingController();
  final _descripcion = TextEditingController();
  final _unidadSolicitante = TextEditingController();
  final _nombreSolicitante = TextEditingController();
  final _contactoSolicitante = TextEditingController();
  String _clasificacion = 'REFERIDO';
  String _actividad = 'REPARACION';
  String _prioridad = 'MEDIA';
  int? _idSolicitante;
  bool _informe = true;
  bool _nuevoSolicitante = false;
  String? _error;

  @override
  void dispose() {
    _nombre.dispose();
    _averia.dispose();
    _tipoProblema.dispose();
    _telefono.dispose();
    _contacto.dispose();
    _direccion.dispose();
    _descripcion.dispose();
    _unidadSolicitante.dispose();
    _nombreSolicitante.dispose();
    _contactoSolicitante.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: const Text('Nuevo caso especial'),
        content: SizedBox(
          width: 480,
          child: Form(
            key: _form,
            child: SingleChildScrollView(
                child: Column(mainAxisSize: MainAxisSize.min, children: [
              DropdownButtonFormField<String>(
                value: _clasificacion,
                decoration: const InputDecoration(labelText: 'Clasificación'),
                items: const ['REFERIDO', 'EMPRESA', 'GOBIERNO']
                    .map((v) => DropdownMenuItem(value: v, child: Text(v)))
                    .toList(),
                onChanged: (v) => setState(() => _clasificacion = v!),
              ),
              DropdownButtonFormField<String>(
                value: _actividad,
                decoration:
                    const InputDecoration(labelText: 'Tipo de reporte *'),
                items: const ['REPARACION', 'CONSTRUCCION']
                    .map((v) => DropdownMenuItem(
                        value: v,
                        child: Text(v == 'REPARACION' ? 'Reparación' : 'Construcción')))
                    .toList(),
                onChanged: (v) => setState(() => _actividad = v!),
              ),
              DropdownButtonFormField<String>(
                value: _prioridad,
                decoration: const InputDecoration(labelText: 'Prioridad'),
                items: const ['ALTA', 'MEDIA', 'BAJA']
                    .map((v) => DropdownMenuItem(value: v, child: Text(v)))
                    .toList(),
                onChanged: (v) => setState(() => _prioridad = v!),
              ),
              DropdownButtonFormField<int?>(
                value: _idSolicitante,
                decoration: const InputDecoration(
                    labelText: 'Solicitante registrado *'),
                items: [
                  const DropdownMenuItem<int?>(
                      value: null, child: Text('Seleccione un solicitante…')),
                  ...widget.solicitantes.map((s) => DropdownMenuItem<int?>(
                      value: s['id_solicitante'] as int,
                      child: Text('${s['nombre']} · ${s['unidad']}')))
                ],
                onChanged: (v) => setState(() => _idSolicitante = v),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Registrar un solicitante nuevo'),
                value: _nuevoSolicitante,
                onChanged: (v) => setState(() {
                  _nuevoSolicitante = v;
                  if (v) _idSolicitante = null;
                }),
              ),
              if (_nuevoSolicitante) ...[
                _campo(_unidadSolicitante, 'Unidad solicitante *',
                    requerido: true),
                _campo(_nombreSolicitante, 'Nombre del solicitante *',
                    requerido: true),
                _campo(_contactoSolicitante, 'Contacto del solicitante *',
                    requerido: true),
              ],
              _campo(_nombre, 'Nombre de contacto *', requerido: true),
              _campo(_contacto, 'Teléfono de contacto *',
                  tipo: TextInputType.phone, requerido: true),
              _campo(_telefono, 'Teléfono — identificador de pago (70*) *',
                  tipo: TextInputType.phone, requerido: true),
              _campo(_averia,
                  _actividad == 'REPARACION' ? 'ID de avería *' : 'ID de avería',
                  requerido: _actividad == 'REPARACION'),
              _campo(
                  _tipoProblema,
                  _actividad == 'REPARACION'
                      ? 'Tipo de problema *'
                      : 'Tipo de problema',
                  requerido: _actividad == 'REPARACION'),
              _campo(_direccion, 'Dirección del inmueble *', requerido: true),
              _campo(_descripcion, 'Descripción', maxLines: 3),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Requiere informe'),
                value: _informe,
                onChanged: (v) => setState(() => _informe = v),
              ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(_error!,
                      style: TextStyle(
                          color: Theme.of(context).colorScheme.error,
                          fontSize: 13)),
                ),
            ])),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancelar')),
          FilledButton(onPressed: _guardar, child: const Text('Crear')),
        ],
      );

  Widget _campo(TextEditingController controller, String etiqueta,
          {TextInputType? tipo, int maxLines = 1, bool requerido = false}) =>
      Padding(
        padding: const EdgeInsets.only(top: 8),
        child: TextFormField(
          controller: controller,
          keyboardType: tipo,
          maxLines: maxLines,
          validator: requerido
              ? (valor) => valor == null || valor.trim().isEmpty
                  ? 'Este campo es obligatorio.'
                  : null
              : null,
          decoration: InputDecoration(
              labelText: etiqueta, border: const OutlineInputBorder()),
        ),
      );

  void _guardar() {
    // RN-AL-01: datos del alta y del solicitante obligatorios.
    final faltaSolicitante = _nuevoSolicitante
        ? _unidadSolicitante.text.trim().isEmpty ||
            _nombreSolicitante.text.trim().isEmpty ||
            _contactoSolicitante.text.trim().isEmpty
        : _idSolicitante == null;
    if (faltaSolicitante) {
      setState(() => _error =
          'Datos del solicitante obligatorios: elija uno registrado o complete '
          'unidad, nombre y contacto.');
      return;
    }
    if (!_form.currentState!.validate()) return;
    setState(() => _error = null);
    Navigator.pop(context, <String, dynamic>{
      'clasificacion': _clasificacion,
      'tipo_actividad': _actividad,
      'prioridad': _prioridad,
      'descripcion':
          _descripcion.text.trim().isEmpty ? null : _descripcion.text.trim(),
      'requiere_informe': _informe,
      if (_idSolicitante != null) 'id_solicitante': _idSolicitante,
      if (_nuevoSolicitante)
        'crear_solicitante': {
          'unidad': _unidadSolicitante.text.trim(),
          'nombre': _nombreSolicitante.text.trim(),
          'contacto': _contactoSolicitante.text.trim(),
          'canal': 'MANUAL',
        },
      'nombre_cliente': _nombre.text.trim(),
      'contacto_cliente': _contacto.text.trim(),
      'id_averia': _averia.text.trim().isEmpty ? null : _averia.text.trim(),
      'tipo_problema': _tipoProblema.text.trim().isEmpty
          ? null
          : _tipoProblema.text.trim(),
      'telefono': _telefono.text.trim(),
      'direccion': _direccion.text.trim(),
    });
  }
}

/// D-120 · Diálogo para **cerrar el caso** de un especial desde la APK.
///
/// Pide el modo de cierre del catálogo (IVR · COS · SACAS) y una descripción de
/// lo realizado (mínimo 10 caracteres, la misma regla que la ficha del técnico).
class _CerrarCasoEspecialDialog extends StatefulWidget {
  const _CerrarCasoEspecialDialog({required this.titulo});

  final String titulo;

  @override
  State<_CerrarCasoEspecialDialog> createState() =>
      _CerrarCasoEspecialDialogState();
}

class _CerrarCasoEspecialDialogState extends State<_CerrarCasoEspecialDialog> {
  String _modo = 'IVR';
  final _descripcion = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _descripcion.dispose();
    super.dispose();
  }

  void _confirmar() {
    final texto = _descripcion.text.trim();
    if (texto.length < 10) {
      setState(() => _error = 'Describa lo realizado (mínimo 10 caracteres).');
      return;
    }
    Navigator.pop(context, {'modo': _modo, 'descripcion': texto});
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: Text(widget.titulo),
        content: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            DropdownButtonFormField<String>(
              value: _modo,
              decoration: const InputDecoration(labelText: 'Método de cierre'),
              items: const [
                DropdownMenuItem(value: 'IVR', child: Text('Cierre con IVR')),
                DropdownMenuItem(value: 'COS', child: Text('Cierre con COS')),
                DropdownMenuItem(value: 'SACAS', child: Text('Cierre con SACAS')),
              ],
              onChanged: (v) => setState(() => _modo = v ?? 'IVR'),
            ),
            const SizedBox(height: 10),
            TextField(
              key: const Key('especial-descripcion-cierre'),
              controller: _descripcion,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Descripción de lo realizado',
                helperText: 'Mínimo 10 caracteres.',
                border: OutlineInputBorder(),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(
                _error!,
                style: TextStyle(
                  color: Theme.of(context).colorScheme.error,
                  fontSize: 12,
                ),
              ),
            ],
          ]),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            key: const Key('especial-confirmar-cierre'),
            onPressed: _confirmar,
            child: const Text('Cerrar el caso'),
          ),
        ],
      );
}
