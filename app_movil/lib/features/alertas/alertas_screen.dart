import 'dart:io';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/constants.dart';
import '../../core/database.dart';
import '../../widgets/barra_progreso_sync.dart';
import '../../widgets/boton_usuario.dart';
import '../casos/operaciones_service.dart';
import '../evidencias/evidencia_service.dart';
import '../sync/sync_provider.dart';
import '../sync/upload_service.dart';

/// ALERTAS (RF-16): reporte de **falla masiva** desde el campo.
///
/// D-82: el reporte indica la **ODN**, la **dirección**, la **FAT** y la
/// **descripción**, con **hasta 2 fotos** de evidencia (requisito 5). Las fotos
/// se toman con la cámara, se guardan en el dispositivo y se suben antes de
/// registrar la falla; sin conexión, el reporte y sus seriales quedan en la cola
/// y se envían al sincronizar.
class AlertasScreen extends StatefulWidget {
  const AlertasScreen({super.key});

  @override
  State<AlertasScreen> createState() => _AlertasScreenState();
}

class _AlertasScreenState extends State<AlertasScreen> {
  final _odnController = TextEditingController();
  final _direccionController = TextEditingController();
  final _fatController = TextEditingController();
  final _descController = TextEditingController();
  final _sectorController = TextEditingController();

  /// Identificador del reporte en curso: agrupa sus fotos en la base local.
  final String _reporteId = 'FM-${DateTime.now().millisecondsSinceEpoch}';

  List<Map<String, dynamic>> _fotos = [];
  bool _enviando = false;

  @override
  void dispose() {
    _odnController.dispose();
    _direccionController.dispose();
    _fatController.dispose();
    _descController.dispose();
    _sectorController.dispose();
    super.dispose();
  }

  Future<void> _refrescarFotos() async {
    final fotos = await DatabaseHelper.instance.evidencias(idCaso: _reporteId);
    if (!mounted) return;
    setState(() => _fotos = fotos);
  }

  Future<void> _tomarFoto() async {
    if (_fotos.length >= AppConstants.maxEvidenciasFallaMasiva) {
      _avisar('Máximo ${AppConstants.maxEvidenciasFallaMasiva} fotos de evidencia.');
      return;
    }
    try {
      final posicion = await EvidenciaService.ubicacion();
      final serial = await EvidenciaService.capturar(
        idCaso: _reporteId,
        idAveria: (_odnController.text.trim().isEmpty ? 'ODN' : _odnController.text.trim()),
        tipo: TipoEvidencia.fallaMasiva,
        momento: DateTime.now(),
        latitud: posicion?.latitude,
        longitud: posicion?.longitude,
      );
      if (serial == null) return; // el usuario canceló la cámara
      await _refrescarFotos();
      if (mounted) {
        await context.read<SyncProvider>().refrescar();
      }
    } catch (error) {
      _avisar('No se pudo guardar la foto: $error', error: true);
    }
  }

  Future<void> _quitarFoto(Map<String, dynamic> foto) async {
    await DatabaseHelper.instance.borrarEvidencia(foto['id'] as int);
    final ruta = '${foto['ruta_archivo']}';
    try {
      final archivo = File(ruta);
      if (await archivo.exists()) await archivo.delete();
    } catch (_) {
      // Si el archivo ya no está, la fila se borra igualmente.
    }
    await _refrescarFotos();
    if (mounted) await context.read<SyncProvider>().refrescar();
  }

  Future<void> _reportarFalla() async {
    // Validación previa: no se sube ninguna foto si faltan datos del reporte.
    if (_odnController.text.trim().length < 3) {
      _avisar('Indique la ODN del reporte.', error: true);
      return;
    }
    if (_direccionController.text.trim().length < 5) {
      _avisar('Indique la dirección del reporte (mínimo 5 caracteres).', error: true);
      return;
    }
    if (_fatController.text.trim().isEmpty) {
      _avisar('Indique la FAT del reporte.', error: true);
      return;
    }
    if (_descController.text.trim().length < 5) {
      _avisar('Describa la falla con al menos 5 caracteres.', error: true);
      return;
    }

    final sync = context.read<SyncProvider>();
    setState(() => _enviando = true);
    final idSector = int.tryParse(_sectorController.text.trim());
    final seriales = _fotos.map((f) => '${f['serial_imagen'] ?? ''}').where((s) => s.isNotEmpty).toList();

    try {
      // 1) Se intentan subir las fotos del reporte (si hay red).
      if (seriales.isNotEmpty) {
        sync.iniciarProgreso('Subiendo las fotos del reporte…', valor: 0.2);
        final (_, _, confirmados) = await UploadService.subirPendientes(
          idCaso: _reporteId,
          onProgreso: (fase, valor) => sync.actualizarProgreso(valor, fase: fase),
        );
        if (confirmados.isNotEmpty) {
          seriales
            ..clear()
            ..addAll(confirmados);
        }
      }
      sync.iniciarProgreso('Enviando el reporte de falla masiva…', valor: 0.8);

      // 2) Se registra la falla con sus datos y sus seriales.
      final resultado = await OperacionesService.reportarFallaMasiva(
        odn: _odnController.text,
        direccion: _direccionController.text,
        fat: _fatController.text,
        descripcion: _descController.text,
        evidencias: seriales,
        idSector: idSector,
      );

      if (!mounted) return;
      if (!resultado.enviada) {
        await sync.refrescar();
      }
      if (!mounted) return;
      _avisar(
        resultado.mensaje,
        error: !resultado.valida,
        aviso: resultado.encolada,
      );

      if (resultado.enviada && resultado.valida) {
        _odnController.clear();
        _direccionController.clear();
        _fatController.clear();
        _descController.clear();
        _sectorController.clear();
        // Las fotos ya quedaron registradas en el reporte: se limpia la lista
        // local (el archivo permanece hasta que la CARGA lo suba).
        setState(() => _fotos = []);
        await sync.refrescar();
      }
    } catch (error) {
      _avisar('No se pudo reportar la falla: $error', error: true);
    } finally {
      sync.terminarProgreso();
      if (mounted) setState(() => _enviando = false);
    }
  }

  void _avisar(String mensaje, {bool error = false, bool aviso = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(mensaje),
        backgroundColor: error
            ? Colors.red.shade700
            : (aviso ? Colors.orange.shade800 : null),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Alertas'),
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(30),
          child: BarraProgresoSync(),
        ),
        actions: const [BotonUsuario()],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const Text(
              'Falla masiva',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 4),
            const Text(
              'Reporte una concentración de averías indicando la ODN, la dirección, la FAT '
              'y la descripción, con hasta 2 fotos de evidencia.',
              style: TextStyle(fontSize: 13, color: Colors.black54),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _odnController,
              textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(
                labelText: 'ODN *',
                hintText: 'Ej. ODN-2324X-0451',
                border: OutlineInputBorder(),
                isDense: true,
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _direccionController,
              decoration: const InputDecoration(
                labelText: 'Dirección *',
                hintText: 'Ej. Calle 4 con Av. Principal, casa 12',
                border: OutlineInputBorder(),
                isDense: true,
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _fatController,
              textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(
                labelText: 'FAT *',
                hintText: 'Ej. FAT-04',
                border: OutlineInputBorder(),
                isDense: true,
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _descController,
              maxLines: 3,
              maxLength: 400,
              decoration: const InputDecoration(
                labelText: 'Descripción *',
                hintText: 'Ej. 6 clientes sin servicio en la FAT 4 del sector Norte 2',
                border: OutlineInputBorder(),
              ),
            ),
            TextField(
              controller: _sectorController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Sector (opcional)',
                hintText: 'Número de sector',
                border: OutlineInputBorder(),
                isDense: true,
              ),
            ),
            const SizedBox(height: 14),
            _bloqueFotos(),
            const SizedBox(height: 16),
            SizedBox(
              height: 48,
              child: ElevatedButton.icon(
                icon: const Icon(Icons.warning_amber),
                label: Text(_enviando ? 'Enviando…' : 'Reportar falla masiva'),
                onPressed: _enviando ? null : _reportarFalla,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Si no hay conexión, el reporte y sus fotos quedan guardados en el dispositivo '
              'y se envían al sincronizar.',
              style: TextStyle(fontSize: 12, color: Colors.black54),
            ),
            const Divider(height: 40),
            const Text(
              'Incidentes de flota o herramienta',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.blueGrey.shade50,
                border: Border.all(color: Colors.blueGrey.shade200),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Text(
                'El reporte de incidentes de flota/herramienta aún no tiene endpoint en el '
                'servidor, así que la app ya no encola esas acciones (antes se perdían en la '
                'cola). Reporte el incidente por Telegram o al supervisor hasta que se habilite.',
                style: TextStyle(fontSize: 13),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Fotografías de evidencia: máximo 2, con vista previa y opción de quitarlas.
  Widget _bloqueFotos() {
    final lleno = _fotos.length >= AppConstants.maxEvidenciasFallaMasiva;
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.photo_camera_outlined, size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Fotos de evidencia (${_fotos.length} de '
                    '${AppConstants.maxEvidenciasFallaMasiva})',
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (_fotos.isNotEmpty)
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  for (final foto in _fotos) _miniatura(foto),
                ],
              ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                icon: const Icon(Icons.add_a_photo_outlined),
                label: Text(lleno ? 'Máximo 2 fotos' : 'Añadir foto de evidencia'),
                onPressed: lleno || _enviando ? null : _tomarFoto,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _miniatura(Map<String, dynamic> foto) {
    final ruta = '${foto['ruta_archivo']}';
    return Stack(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: Image.file(
            File(ruta),
            width: 96,
            height: 96,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => Container(
              width: 96,
              height: 96,
              color: Colors.black12,
              child: const Icon(Icons.broken_image_outlined),
            ),
          ),
        ),
        Positioned(
          top: 2,
          right: 2,
          child: InkWell(
            onTap: _enviando ? null : () => _quitarFoto(foto),
            child: Container(
              decoration: const BoxDecoration(
                color: Colors.black54,
                shape: BoxShape.circle,
              ),
              padding: const EdgeInsets.all(3),
              child: const Icon(Icons.close, size: 15, color: Colors.white),
            ),
          ),
        ),
      ],
    );
  }
}
