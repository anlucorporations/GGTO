import 'package:flutter/material.dart';

import '../alertas/alertas_screen.dart';
import '../casos/casos_screen.dart';
import '../mensajes/mensajes_screen.dart';
import '../usuario/usuario_screen.dart';
import 'hoja_mas.dart';

/// Inicio del rol TÉCNICO con barra inferior de cinco destinos.
///
/// Antes, la pantalla del técnico colgaba de **cinco iconos** en la barra de
/// título (sincronizar, alertas, masivas, mensajes y usuario), todos fuera del
/// alcance del pulgar. La propuesta visual los baja a la barra inferior:
/// `Casos · Alertas · Mensajes · Perfil · Más`, y el resto de secciones queda en
/// la hoja «Más».
class InicioTecnicoScreen extends StatefulWidget {
  const InicioTecnicoScreen({super.key});

  @override
  State<InicioTecnicoScreen> createState() => _InicioTecnicoScreenState();
}

class _InicioTecnicoScreenState extends State<InicioTecnicoScreen> {
  int _indice = 0;

  static const _paginas = <Widget>[
    CasosScreen(key: ValueKey('tecnico-casos')),
    AlertasScreen(key: ValueKey('tecnico-alertas')),
    MensajesScreen(key: ValueKey('tecnico-mensajes')),
    UsuarioScreen(key: ValueKey('tecnico-perfil')),
  ];

  static const _seccionesMas = <SeccionMas>[
    SeccionMas('Fallas masivas', 'Bloque prioritario de la cuadrilla', Icons.crisis_alert, '/masivas'),
    SeccionMas('Sincronización', 'Estado de la cola del dispositivo', Icons.sync, '/sync'),
  ];

  void _abrirMas() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (_) => const HojaMas(secciones: _seccionesMas),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _paginas[_indice],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _indice,
        onDestinationSelected: (i) {
          if (i >= _paginas.length) {
            _abrirMas();
            return;
          }
          setState(() => _indice = i);
        },
        destinations: const [
          NavigationDestination(icon: Icon(Icons.folder_open_outlined), selectedIcon: Icon(Icons.folder_open), label: 'Casos'),
          NavigationDestination(icon: Icon(Icons.warning_amber_outlined), selectedIcon: Icon(Icons.warning_amber), label: 'Alertas'),
          NavigationDestination(icon: Icon(Icons.forum_outlined), selectedIcon: Icon(Icons.forum), label: 'Mensajes'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Perfil'),
          NavigationDestination(icon: Icon(Icons.more_horiz), label: 'Más', tooltip: 'Más secciones'),
        ],
      ),
    );
  }
}
