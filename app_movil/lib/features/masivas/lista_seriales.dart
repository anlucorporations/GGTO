import 'package:flutter/material.dart';

/// Lista **editable de seriales** de evidencia (D-99).
///
/// Las evidencias de una acción sobre la masiva (planificar o cerrar) viajan al
/// servidor como seriales ya subidos. Este widget permite escribirlos a mano y
/// quitarlos, sin cámara ni base local, que es lo que encaja en la ficha de una
/// masiva (no tiene `id_caso` propio con el que capturar la foto).
class ListaSeriales extends StatefulWidget {
  const ListaSeriales({
    super.key,
    required this.seriales,
    required this.onAgregar,
    required this.onQuitar,
    this.etiqueta = 'Evidencias',
    this.maximo = 20,
  });

  /// Seriales ya añadidos (los gobierna el formulario padre).
  final List<String> seriales;

  final ValueChanged<String> onAgregar;
  final ValueChanged<String> onQuitar;
  final String etiqueta;

  /// Máximo de seriales admitido (el servidor acepta 20 en el cierre).
  final int maximo;

  @override
  State<ListaSeriales> createState() => _ListaSerialesState();
}

class _ListaSerialesState extends State<ListaSeriales> {
  final _controlador = TextEditingController();

  @override
  void dispose() {
    _controlador.dispose();
    super.dispose();
  }

  void _agregar() {
    final texto = _controlador.text.trim();
    if (texto.isEmpty) return;
    if (widget.seriales.length >= widget.maximo) return;
    widget.onAgregar(texto);
    _controlador.clear();
  }

  @override
  Widget build(BuildContext context) {
    final completa = widget.seriales.length >= widget.maximo;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '${widget.etiqueta} (${widget.seriales.length}/${widget.maximo})',
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _controlador,
                enabled: !completa,
                decoration: const InputDecoration(
                  labelText: 'Serial de la evidencia',
                  hintText: 'FM-1-FALLA_MASIVA-20261006-120000.jpg',
                  isDense: true,
                ),
                onSubmitted: (_) => _agregar(),
              ),
            ),
            const SizedBox(width: 6),
            IconButton(
              tooltip: 'Añadir el serial',
              icon: const Icon(Icons.add_circle_outline),
              onPressed: completa ? null : _agregar,
            ),
          ],
        ),
        if (widget.seriales.isEmpty)
          const Text(
            'Sin evidencias: añada el serial de las fotos ya subidas.',
            style: TextStyle(fontSize: 12, color: Colors.black54),
          )
        else
          for (final serial in widget.seriales)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Row(
                children: [
                  const Icon(Icons.photo_camera_back, size: 16),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      serial,
                      style: const TextStyle(fontSize: 12),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.delete_outline, size: 18),
                    tooltip: 'Quitar la evidencia',
                    onPressed: () => widget.onQuitar(serial),
                  ),
                ],
              ),
            ),
      ],
    );
  }
}
