import 'package:flutter/material.dart';

/// Icono de **usuario** de la barra superior (D-82 · requisito 3).
///
/// Abre la sección «Usuario» (perfil, datos administrativos, cambio de
/// contraseña y palabras de seguridad). Se usa en todas las pantallas para que
/// el menú de usuario esté siempre a un toque.
class BotonUsuario extends StatelessWidget {
  const BotonUsuario({super.key});

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: 'Usuario',
      icon: const Icon(Icons.account_circle),
      onPressed: () => Navigator.pushNamed(context, '/usuario'),
    );
  }
}
