import 'package:flutter/material.dart';

import 'evidencia_service.dart';

/// Captura de una evidencia suelta (RF-14).
///
/// Solo cámara, con compresión y serial `caso + id_avería + tipo + fecha/hora`.
/// La evidencia queda guardada en el dispositivo y se envía al cerrar o
/// sincronizar; desde aquí se devuelve el serial a la pantalla que la abrió.
class CamaraScreen extends StatefulWidget {
  const CamaraScreen({
    super.key,
    required this.idCaso,
    required this.idAveria,
    this.tipo = TipoEvidencia.demo,
  });

  final String idCaso;
  final String idAveria;
  final TipoEvidencia tipo;

  @override
  State<CamaraScreen> createState() => _CamaraScreenState();
}

class _CamaraScreenState extends State<CamaraScreen> {
  final List<String> _seriales = [];
  String _ubicacion = 'Consultando ubicación…';
  bool _capturando = false;

  @override
  void initState() {
    super.initState();
    _consultarUbicacion();
  }

  Future<void> _consultarUbicacion() async {
    final posicion = await EvidenciaService.ubicacion();
    if (!mounted) return;
    setState(() => _ubicacion = EvidenciaService.describir(posicion));
  }

  Future<void> _tomarFoto() async {
    if (_seriales.length >= 5) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Máximo 5 fotos por caso (límite CANTV).'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }
    setState(() => _capturando = true);
    final posicion = await EvidenciaService.ubicacion();
    final serial = await EvidenciaService.capturar(
      idCaso: widget.idCaso,
      idAveria: widget.idAveria,
      tipo: widget.tipo,
      momento: DateTime.now(),
      latitud: posicion?.latitude,
      longitud: posicion?.longitude,
    );
    if (!mounted) return;
    setState(() {
      _capturando = false;
      if (serial != null) _seriales.add(serial);
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          serial == null
              ? 'No se capturó ninguna foto.'
              : 'Evidencia guardada: $serial',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Evidencias')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              child: ListTile(
                leading: const Icon(Icons.my_location),
                title: const Text('Ubicación'),
                subtitle: Text(_ubicacion),
                trailing: IconButton(
                  icon: const Icon(Icons.refresh),
                  tooltip: 'Actualizar ubicación',
                  onPressed: _consultarUbicacion,
                ),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Tipo de evidencia: ${widget.tipo.etiqueta}',
              style: const TextStyle(fontSize: 13, color: Colors.black54),
            ),
            const SizedBox(height: 14),
            SizedBox(
              height: 48,
              child: ElevatedButton.icon(
                icon: const Icon(Icons.camera_alt),
                label: Text(_capturando ? 'Abriendo cámara…' : 'Tomar foto'),
                onPressed: _capturando ? null : _tomarFoto,
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              'Las fotos se guardan en la carpeta de la aplicación, en baja calidad, con las '
              'coordenadas y la fecha/hora en el nombre. No se permite seleccionarlas de la galería.',
              style: TextStyle(fontSize: 12, color: Colors.black54),
            ),
            const SizedBox(height: 18),
            Text(
              'Capturadas en esta sesión: ${_seriales.length} / 5',
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            if (_seriales.isNotEmpty) ...[
              for (final serial in _seriales)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Text(
                    serial,
                    style: const TextStyle(fontSize: 12, fontFamily: 'monospace'),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }
}
