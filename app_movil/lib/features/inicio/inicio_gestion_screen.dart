import 'package:flutter/material.dart';

import '../gestion/gestion_screen.dart';
import '../especiales/especiales_screen.dart';
import '../coordinacion/coordinacion_screen.dart';
import '../monitoreo/monitoreo_screen.dart';
import '../mensajes/mensajes_coordinador_screen.dart';
import '../despacho/despacho_screen.dart';
import 'hoja_mas.dart';

/// Navegación inicial de roles de gestión.
///
/// Propuesta visual (docs/propuesta-visual-apk): la barra inferior **nunca pasa
/// de cinco destinos**. Antes de este cambio la lista de páginas y la de destinos
/// se escribían por separado y podían desincronizarse (el Coordinador veía la
/// pestaña «Alertas» abriendo «Coordinación»). Ahora hay **una sola lista** de
/// `(_Destino)` y lo que no cabe se ofrece en la hoja «Más».
class InicioGestionScreen extends StatefulWidget {
  const InicioGestionScreen({super.key, required this.rol});
  final String rol;

  @override
  State<InicioGestionScreen> createState() => _InicioGestionScreenState();
}

/// Destino de la barra: etiqueta, icono y pantalla.
class _Destino {
  const _Destino(this.etiqueta, this.icono, this.pagina);
  final String etiqueta;
  final IconData icono;
  final Widget pagina;
}

class _InicioGestionScreenState extends State<InicioGestionScreen> {
  int _indice = 0;

  bool get _puedeGestion =>
      widget.rol == 'SUPER' || widget.rol == 'ADMIN' || widget.rol == 'SUPERVISOR';

  bool get _puedeCrearEspecial =>
      _puedeGestion || widget.rol == 'COORDINADOR';

  bool get _esCoordinador => widget.rol == 'COORDINADOR';

  /// Máximo 5 destinos visibles; el resto vive en «Más».
  List<_Destino> get _destinos => [
        const _Destino('Monitoreo', Icons.analytics_outlined, MonitoreoScreen(key: ValueKey('monitor'))),
        if (_puedeCrearEspecial)
          _Destino(
            'Especiales',
            Icons.star_outline,
            EspecialesScreen(
              key: const ValueKey('especiales'),
              puedeCrear: _puedeCrearEspecial,
              puedeGestionar: widget.rol == 'ADMIN' || widget.rol == 'SUPERVISOR',
            ),
          ),
        if (_puedeGestion)
          const _Destino(
            'Casos',
            Icons.folder_open_outlined,
            GestionScreen(key: ValueKey('casos'), soloGestion: false),
          ),
        if (_esCoordinador)
          const _Destino(
            'Coordinación',
            Icons.alt_route,
            CoordinacionScreen(key: ValueKey('coordinacion')),
          ),
        if (_puedeGestion)
          const _Destino('Despacho', Icons.local_shipping_outlined, DespachoScreen(key: ValueKey('despacho'))),
        if (_esCoordinador)
          const _Destino(
            'Mensajes',
            Icons.mail_outline,
            MensajesCoordinadorScreen(key: ValueKey('mensajes-coordinador')),
          ),
      ];

  /// Secciones que no caben en la barra y se ofrecen en la hoja «Más».
  List<SeccionMas> get _seccionesMas => [
        if (_puedeGestion)
          const SeccionMas('Gestión de casos', 'Altas, reclasificaciones y cierres', Icons.assignment_outlined, '/gestion'),
        const SeccionMas('Fallas masivas', 'Bloque prioritario de la cuadrilla', Icons.crisis_alert, '/masivas'),
        const SeccionMas('Alertas', 'Avisos diarios y notificaciones', Icons.warning_amber, '/alertas'),
        const SeccionMas('Sincronización', 'Estado de la cola del dispositivo', Icons.sync, '/sync'),
        const SeccionMas('Perfil y seguridad', 'Clave, PIN y aviso legal', Icons.person_outline, '/usuario'),
      ];

  void _abrirMas() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (_) => HojaMas(secciones: _seccionesMas),
    );
  }

  @override
  Widget build(BuildContext context) {
    final destinos = _destinos;
    // El índice puede quedar fuera de rango si el rol cambia de destinos.
    final indice = _indice.clamp(0, destinos.length - 1);

    return Scaffold(
      // Solo se construye la pantalla activa (igual que antes): cada una
      // dispara sus propias consultas al montarse.
      body: destinos[indice].pagina,
      bottomNavigationBar: NavigationBar(
        selectedIndex: indice,
        onDestinationSelected: (i) {
          if (i >= destinos.length) {
            _abrirMas();
            return;
          }
          setState(() => _indice = i);
        },
        destinations: [
          for (final d in destinos)
            NavigationDestination(
              icon: Icon(d.icono),
              selectedIcon: Icon(d.icono),
              label: d.etiqueta,
            ),
          // «Más» nunca cuenta como índice de página.
          const NavigationDestination(
            icon: Icon(Icons.more_horiz),
            label: 'Más',
            tooltip: 'Más secciones',
          ),
        ],
      ),
    );
  }
}
