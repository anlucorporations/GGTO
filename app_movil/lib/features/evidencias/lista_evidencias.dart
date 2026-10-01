import 'package:flutter/material.dart';

import 'evidencia_service.dart';

/// Lista de evidencias capturadas para una acción de campo.
///
/// Solo permite **cámara** (RF-14 / RNF-04) y muestra el serial generado, que es
/// el que viaja al servidor (`N.º de caso + id_avería + tipo + fecha y hora`).
class ListaEvidencias extends StatefulWidget {
  const ListaEvidencias({
    super.key,
    required this.idCaso,
    required this.idAveria,
    required this.tipo,
    this.maximo = 3,
    this.etiquetaBoton,
  });

  final String idCaso;
  final String idAveria;
  final TipoEvidencia tipo;
  final int maximo;
  final String? etiquetaBoton;

  @override
  State<ListaEvidencias> createState() => ListaEvidenciasState();
}

/// Estado público: las pantallas que envían la acción leen `seriales`.
class ListaEvidenciasState extends State<ListaEvidencias> {
  final List<String> _seriales = [];
  bool _capturando = false;

  /// Seriales de las evidencias capturadas (es lo que se envía a la API).
  List<String> get seriales => List.unmodifiable(_seriales);

  bool get completa => _seriales.length >= widget.maximo;

  Future<void> _capturar() async {
    if (completa) return;
    setState(() => _capturando = true);

    final posicion = await EvidenciaService.ubicacion();
    if (!mounted) return;
    if (posicion == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Sin ubicación GPS: la evidencia se guardará sin coordenadas. '
            'Active la ubicación para cumplir el requisito del brief.',
          ),
        ),
      );
    }

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

    if (serial != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Evidencia guardada: $serial')),
      );
    }
  }

  void _quitar(int indice) {
    setState(() => _seriales.removeAt(indice));
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Evidencias · ${widget.tipo.etiqueta} (${_seriales.length}/${widget.maximo})',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
            TextButton.icon(
              icon: const Icon(Icons.camera_alt, size: 18),
              label: Text(
                _capturando
                    ? 'Abriendo…'
                    : (widget.etiquetaBoton ?? 'Tomar foto'),
              ),
              onPressed: (_capturando || completa) ? null : _capturar,
            ),
          ],
        ),
        if (_seriales.isEmpty)
          const Text(
            'No se permite elegir de la galería: la foto se toma con la cámara y queda '
            'marcada con GPS, fecha y hora.',
            style: TextStyle(fontSize: 12, color: Colors.black54),
          )
        else
          for (var i = 0; i < _seriales.length; i++)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Row(
                children: [
                  const Icon(Icons.photo_camera_back, size: 16),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      _seriales[i],
                      style: const TextStyle(fontSize: 12, fontFamily: 'monospace'),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.delete_outline, size: 18),
                    tooltip: 'Quitar la referencia',
                    onPressed: () => _quitar(i),
                  ),
                ],
              ),
            ),
      ],
    );
  }
}
