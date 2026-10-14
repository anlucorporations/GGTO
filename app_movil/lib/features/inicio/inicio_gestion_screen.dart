import 'package:flutter/material.dart';

import '../gestion/gestion_screen.dart';
import '../especiales/especiales_screen.dart';
import '../coordinacion/coordinacion_screen.dart';
import '../monitoreo/monitoreo_screen.dart';
import '../mensajes/mensajes_coordinador_screen.dart';
import '../despacho/despacho_screen.dart';

/// Navegación inicial de roles de gestión.
class InicioGestionScreen extends StatefulWidget {
  const InicioGestionScreen({super.key, required this.rol});
  final String rol;

  @override
  State<InicioGestionScreen> createState() => _InicioGestionScreenState();
}

class _InicioGestionScreenState extends State<InicioGestionScreen> {
  int _indice = 0;

  bool get _puedeGestion =>
      widget.rol == 'SUPER' ||
      widget.rol == 'ADMIN' ||
      widget.rol == 'SUPERVISOR';

  bool get _puedeCrearEspecial =>
      widget.rol == 'SUPER' ||
      widget.rol == 'ADMIN' ||
      widget.rol == 'SUPERVISOR' ||
      widget.rol == 'COORDINADOR';

  @override
  Widget build(BuildContext context) {
    final paginas = <Widget>[
      const MonitoreoScreen(key: ValueKey('monitor')),
      if (_puedeCrearEspecial)
        EspecialesScreen(
          key: const ValueKey('especiales'),
          puedeCrear: _puedeCrearEspecial,
          puedeGestionar: widget.rol == 'ADMIN' || widget.rol == 'SUPERVISOR',
        ),
      if (widget.rol == 'COORDINADOR')
        const CoordinacionScreen(key: ValueKey('coordinacion')),
      if (widget.rol == 'COORDINADOR')
        const MensajesCoordinadorScreen(key: ValueKey('mensajes-coordinador')),
      if (_puedeGestion) ...[
        const GestionScreen(key: ValueKey('gestion'), soloGestion: true),
        const GestionScreen(key: ValueKey('casos'), soloGestion: false),
        const DespachoScreen(key: ValueKey('despacho')),
      ],
    ];
    return Scaffold(
      body: paginas[_indice],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _indice,
        onDestinationSelected: (indice) => setState(() => _indice = indice),
        destinations: [
          const NavigationDestination(
            icon: Icon(Icons.analytics_outlined),
            selectedIcon: Icon(Icons.analytics),
            label: 'Monitoreo',
          ),
          if (_puedeCrearEspecial)
            const NavigationDestination(
              icon: Icon(Icons.star_outline),
              selectedIcon: Icon(Icons.star),
              label: 'Especiales',
            ),
          if (widget.rol == 'COORDINADOR')
            const NavigationDestination(
              icon: Icon(Icons.notifications_outlined),
              selectedIcon: Icon(Icons.notifications),
              label: 'Alertas',
            ),
          if (widget.rol == 'COORDINADOR')
            const NavigationDestination(
              icon: Icon(Icons.mail_outline),
              selectedIcon: Icon(Icons.mail),
              label: 'Mensajes',
            ),
          if (_puedeGestion)
            const NavigationDestination(
              icon: Icon(Icons.assignment_outlined),
              selectedIcon: Icon(Icons.assignment),
              label: 'GESTIÓN',
            ),
          if (_puedeGestion)
            const NavigationDestination(
              icon: Icon(Icons.folder_open_outlined),
              selectedIcon: Icon(Icons.folder_open),
              label: 'Casos',
            ),
          if (_puedeGestion)
            const NavigationDestination(
              icon: Icon(Icons.local_shipping_outlined),
              selectedIcon: Icon(Icons.local_shipping),
              label: 'Despacho',
            ),
        ],
      ),
    );
  }
}
