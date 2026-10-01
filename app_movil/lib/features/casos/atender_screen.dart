import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../evidencias/evidencia_service.dart';
import '../evidencias/lista_evidencias.dart';
import '../sync/sync_provider.dart';
import 'operaciones_service.dart';

/// Acción a ejecutar sobre el caso (§4.2).
enum AccionCampo { cerrar, enrutar, diferir }

/// ATENDER (§4.2): CERRAR, ENRUTAR o DIFERIR contra el contrato real de la API.
///
/// - **CERRAR** → `POST /casos/{id}/cierre` con modo (IVR/COS/SACAS), descripción
///   y seriales de evidencia.
/// - **ENRUTAR** → `POST /casos/{id}/enrutado` con destino y motivo.
/// - **DIFERIR** → `POST /casos/{id}/estado` con estado DIFERIDO y justificación.
class AtenderScreen extends StatefulWidget {
  const AtenderScreen({
    super.key,
    required this.idCaso,
    required this.idAveria,
    this.estadoActual = '',
  });

  final int idCaso;
  final String idAveria;
  final String estadoActual;

  @override
  State<AtenderScreen> createState() => _AtenderScreenState();
}

class _AtenderScreenState extends State<AtenderScreen> {
  AccionCampo _accion = AccionCampo.cerrar;
  String _modo = 'IVR';
  String _destino = 'Planta externa';

  final _descripcionController = TextEditingController();
  final _justificacionController = TextEditingController();

  final _evidenciasCierre = GlobalKey<ListaEvidenciasState>();
  final _evidenciasEnrutado = GlobalKey<ListaEvidenciasState>();
  final _evidenciasDiferido = GlobalKey<ListaEvidenciasState>();

  bool _enviando = false;

  static const _modos = ['IVR', 'COS', 'SACAS'];
  static const _destinos = [
    'Planta externa',
    'Cola de seguimiento',
    'Unidad de masivos',
    'Unidad de empresas',
    'Otra instancia',
  ];

  @override
  void dispose() {
    _descripcionController.dispose();
    _justificacionController.dispose();
    super.dispose();
  }

  Future<void> _ejecutar() async {
    switch (_accion) {
      case AccionCampo.cerrar:
        await _cerrar();
        break;
      case AccionCampo.enrutar:
        await _enrutar();
        break;
      case AccionCampo.diferir:
        await _diferir();
        break;
    }
  }

  Future<void> _cerrar() async {
    final descripcion = _descripcionController.text.trim();
    if (descripcion.length < 10) {
      _avisar('Describa lo realizado con al menos 10 caracteres.');
      return;
    }
    final seriales = _evidenciasCierre.currentState?.seriales ?? const <String>[];

    setState(() => _enviando = true);
    final resultado = await OperacionesService.cerrar(
      idCaso: widget.idCaso,
      idAveria: widget.idAveria,
      modo: _modo,
      descripcion: descripcion,
      evidencias: seriales,
    );
    if (!mounted) return;
    await _finalizar(resultado);
  }

  Future<void> _enrutar() async {
    final motivo = _justificacionController.text.trim();
    if (motivo.length < 5) {
      _avisar('Indique el motivo del enrutado (mínimo 5 caracteres).');
      return;
    }
    final seriales = _evidenciasEnrutado.currentState?.seriales ?? const <String>[];

    setState(() => _enviando = true);
    final resultado = await OperacionesService.enrutar(
      idCaso: widget.idCaso,
      idAveria: widget.idAveria,
      destino: _destino,
      motivo: motivo,
      evidencias: seriales,
    );
    if (!mounted) return;
    await _finalizar(resultado);
  }

  Future<void> _diferir() async {
    final justificacion = _justificacionController.text.trim();
    if (justificacion.length < 5) {
      _avisar('Indique la justificación del diferido (mínimo 5 caracteres).');
      return;
    }
    final seriales = _evidenciasDiferido.currentState?.seriales ?? const <String>[];

    setState(() => _enviando = true);
    final resultado = await OperacionesService.diferir(
      idCaso: widget.idCaso,
      idAveria: widget.idAveria,
      justificacion: justificacion,
      evidencias: seriales,
    );
    if (!mounted) return;
    await _finalizar(resultado);
  }

  Future<void> _finalizar(ResultadoOperacion resultado) async {
    if (!mounted) return;
    setState(() => _enviando = false);

    // Se capturan antes de los `await` para no usar el contexto tras un hueco asíncrono.
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    final sync = context.read<SyncProvider>();

    if (resultado.enviada) {
      await sync.refrescar();
    }

    messenger.showSnackBar(
      SnackBar(
        content: Text(resultado.mensaje),
        backgroundColor: resultado.encolada ? Colors.orange.shade800 : null,
      ),
    );
    navigator.pop(true);
  }

  void _avisar(String mensaje) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(mensaje)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Atender ${widget.idAveria}')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (widget.estadoActual.isNotEmpty && widget.estadoActual != 'CONTACTADO')
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.amber.shade50,
                  border: Border.all(color: Colors.amber.shade300),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  'El caso está en estado ${widget.estadoActual}. El brief pide contactarlo antes '
                  'de atenderlo.',
                  style: const TextStyle(fontSize: 13),
                ),
              ),

            DropdownButtonFormField<AccionCampo>(
              value: _accion,
              decoration: const InputDecoration(
                labelText: 'Procedimiento',
                border: OutlineInputBorder(),
              ),
              items: const [
                DropdownMenuItem(value: AccionCampo.cerrar, child: Text('CERRAR')),
                DropdownMenuItem(value: AccionCampo.enrutar, child: Text('ENRUTAR')),
                DropdownMenuItem(value: AccionCampo.diferir, child: Text('DIFERIR')),
              ],
              onChanged: (valor) {
                if (valor != null) setState(() => _accion = valor);
              },
            ),
            const SizedBox(height: 16),

            if (_accion == AccionCampo.cerrar) ...[
              DropdownButtonFormField<String>(
                value: _modo,
                decoration: const InputDecoration(
                  labelText: 'Método de cierre',
                  border: OutlineInputBorder(),
                ),
                items: [
                  for (final modo in _modos)
                    DropdownMenuItem(value: modo, child: Text('Cierre con $modo')),
                ],
                onChanged: (valor) {
                  if (valor != null) setState(() => _modo = valor);
                },
              ),
              const SizedBox(height: 14),
              TextField(
                controller: _descripcionController,
                maxLines: 3,
                maxLength: 2000,
                decoration: const InputDecoration(
                  labelText: 'Descripción de lo realizado (mínimo 10 caracteres)',
                  border: OutlineInputBorder(),
                ),
              ),
              ListaEvidencias(
                key: _evidenciasCierre,
                idCaso: '${widget.idCaso}',
                idAveria: widget.idAveria,
                tipo: TipoEvidencia.potencia,
                maximo: 2,
                etiquetaBoton: 'Potencia / navegación',
              ),
            ] else if (_accion == AccionCampo.enrutar) ...[
              DropdownButtonFormField<String>(
                value: _destino,
                decoration: const InputDecoration(
                  labelText: 'Instancia destino',
                  border: OutlineInputBorder(),
                ),
                items: [
                  for (final destino in _destinos)
                    DropdownMenuItem(value: destino, child: Text(destino)),
                ],
                onChanged: (valor) {
                  if (valor != null) setState(() => _destino = valor);
                },
              ),
              const SizedBox(height: 14),
              TextField(
                controller: _justificacionController,
                maxLines: 3,
                maxLength: 500,
                decoration: const InputDecoration(
                  labelText: 'Motivo del enrutado',
                  border: OutlineInputBorder(),
                ),
              ),
              ListaEvidencias(
                key: _evidenciasEnrutado,
                idCaso: '${widget.idCaso}',
                idAveria: widget.idAveria,
                tipo: TipoEvidencia.potencia,
                maximo: 1,
                etiquetaBoton: 'Potencia en el equipo',
              ),
            ] else ...[
              TextField(
                controller: _justificacionController,
                maxLines: 3,
                maxLength: 200,
                decoration: const InputDecoration(
                  labelText: 'Justificación del diferido',
                  border: OutlineInputBorder(),
                ),
              ),
              ListaEvidencias(
                key: _evidenciasDiferido,
                idCaso: '${widget.idCaso}',
                idAveria: widget.idAveria,
                tipo: TipoEvidencia.demo,
                maximo: 3,
                etiquetaBoton: 'Foto demostrativa',
              ),
            ],

            const SizedBox(height: 20),
            SizedBox(
              height: 50,
              child: ElevatedButton.icon(
                icon: Icon(_enviando ? Icons.hourglass_top : Icons.save),
                label: Text(_enviando ? 'Registrando…' : 'Registrar ${_accion.name.toUpperCase()}'),
                onPressed: _enviando ? null : _ejecutar,
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              'Si no hay conexión, la acción se guarda en el dispositivo y se envía al '
              'sincronizar. Los errores de permisos o de datos se muestran de inmediato.',
              style: TextStyle(fontSize: 12, color: Colors.black54),
            ),
          ],
        ),
      ),
    );
  }
}
