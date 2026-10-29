import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../casos/casos_screen.dart';
import '../masivas/masivas_provider.dart';
import '../masivas/masivas_screen.dart';

/// Navegación del **TÉCNICO** (panel aparte de MASIVAS, ciclo posterior a D-160).
///
/// Antes el técnico entraba directo a «Mis casos» y las masivas de su cuadrilla
/// vivían en una **tarjeta fija** sobre la lista (banner): ocupaba espacio del
/// panel principal y tapaba casos. Ahora hay una **barra de navegación inferior**
/// con dos destinos:
///
///  * **Mis casos**: la misma lista de trabajo de siempre (RF-11);
///  * **Masivas**: el panel aparte para gestionar las fallas masivas asignadas a
///    su cuadrilla (pantalla `/masivas`, con las fichas PLANIFICAR ·
///    MATERIALES · asignación según el rol).
///
/// El aviso de que hay masivas activas vive **solo en la barra de navegación**:
/// un `Badge` con el contador de masivas del dispositivo (`MasivasProvider`,
/// contenido local; se actualiza al sincronizar y al tocar el botón refrescar de
/// la propia pantalla). Sin masivas activas el badge no se pinta.
class InicioTecnicoScreen extends StatefulWidget {
  const InicioTecnicoScreen({super.key});

  @override
  State<InicioTecnicoScreen> createState() => _InicioTecnicoScreenState();
}

/// Destino de la barra: etiqueta, icono y pantalla.
class _Destino {
  const _Destino(this.etiqueta, this.icono, this.pagina);
  final String etiqueta;
  final IconData icono;
  final Widget pagina;
}

class _InicioTecnicoScreenState extends State<InicioTecnicoScreen>
    with WidgetsBindingObserver {
  int _indice = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // El badge del panel MASIVAS refleja el contenido del dispositivo sin
    // sincronizar: igual que «Mis casos», abrir el panel no descarga (D-84).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<MasivasProvider>().refrescarLocal();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState estado) {
    if (estado == AppLifecycleState.resumed && mounted) {
      context.read<MasivasProvider>().refrescarLocal();
    }
  }

  /// Máximo 2 pestañas: el resto de secciones vive en la AppBar de «Mis casos».
  List<_Destino> get _destinos => const [
        _Destino('Mis casos', Icons.folder_open_outlined, CasosScreen()),
        _Destino('Masivas', Icons.crisis_alert, MasivasScreen()),
      ];

  @override
  Widget build(BuildContext context) {
    final destinos = _destinos;
    // El índice puede quedar fuera de rango si el árbol de destinos cambia.
    final indice = _indice.clamp(0, destinos.length - 1);
    // El aviso de masivas activas: contador del dispositivo, solo en la barra.
    final masivas = Provider.of<MasivasProvider>(context);
    final total = masivas.total;

    return Scaffold(
      // Solo se construye la pantalla activa (igual que en la gestión): cada
      // una dispara sus propias consultas al montarse.
      body: destinos[indice].pagina,
      bottomNavigationBar: NavigationBar(
        selectedIndex: indice,
        onDestinationSelected: (i) => setState(() => _indice = i),
        destinations: [
          for (final d in destinos)
            if (d.etiqueta == 'Masivas')
              NavigationDestination(
                icon: Badge(
                  isLabelVisible: total > 0,
                  label: Text('$total'),
                  child: Icon(d.icono),
                ),
                selectedIcon: Icon(d.icono),
                label: d.etiqueta,
              )
            else
              NavigationDestination(
                icon: Icon(d.icono),
                selectedIcon: Icon(d.icono),
                label: d.etiqueta,
              ),
        ],
      ),
    );
  }
}
