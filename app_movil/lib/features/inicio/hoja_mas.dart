import 'package:flutter/material.dart';

import '../../core/theme.dart';

/// Sección que no cabe en la barra inferior y se ofrece en la hoja «Más».
class SeccionMas {
  const SeccionMas(this.titulo, this.detalle, this.icono, this.ruta);
  final String titulo;
  final String detalle;
  final IconData icono;
  final String ruta;
}

/// Hoja inferior con las secciones que no entran en la barra de navegación.
///
/// La propuesta visual limita la barra a cinco destinos; todo lo demás vive aquí,
/// con etiqueta y descripción, en lugar de apilar iconos en la barra de título.
class HojaMas extends StatelessWidget {
  const HojaMas({super.key, required this.secciones});

  final List<SeccionMas> secciones;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Más secciones', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            const Text(
              'Las pantallas que no caben en la barra inferior, sin apilar iconos en la barra de título.',
              style: TextStyle(fontSize: 13.5, color: Marca.textoSuave),
            ),
            const SizedBox(height: 14),
            Flexible(
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: secciones.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, i) {
                  final s = secciones[i];
                  return ListTile(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(Marca.radioControl),
                      side: const BorderSide(color: Marca.borde),
                    ),
                    tileColor: Colors.white,
                    leading: Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: Marca.contenedor,
                        borderRadius: BorderRadius.circular(Marca.radioControl),
                      ),
                      alignment: Alignment.center,
                      child: Icon(s.icono, color: Marca.azul, size: 22),
                    ),
                    title: Text(s.titulo, style: const TextStyle(fontWeight: FontWeight.w700)),
                    subtitle: Text(s.detalle, style: const TextStyle(fontSize: 12.5)),
                    trailing: const Icon(Icons.chevron_right, color: Marca.textoSuave),
                    onTap: () {
                      Navigator.pop(context);
                      Navigator.pushNamed(context, s.ruta);
                    },
                  );
                },
              ),
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cerrar'),
            ),
          ],
        ),
      ),
    );
  }
}
