import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../widgets/barra_progreso_sync.dart';
import '../../widgets/boton_usuario.dart';
import '../../widgets/caso_card.dart';
import '../../widgets/chip_resueltos.dart';
import '../../widgets/offline_banner.dart';
import '../auth/auth_provider.dart';
import '../masivas/masivas_provider.dart';
import '../mensajes/mensajes_provider.dart';
import '../sync/sync_provider.dart';
import '../usuario/banner_actualizacion.dart';
import 'caso_detalle_screen.dart';
import 'acciones_caso.dart';
import 'casos_provider.dart';

/// Lista de trabajo del técnico (RF-11): sus casos, con búsqueda, refresco y
/// lectura desde la caché local cuando no hay conexión.
///
/// D-82: la lista se pinta siempre desde el **contenido local** del dispositivo
/// (requisito 1) y bajo la barra de título se muestra el **progreso de la
/// sincronización** (requisito 2).
class CasosScreen extends StatefulWidget {
  const CasosScreen({super.key});

  @override
  State<CasosScreen> createState() => _CasosScreenState();
}

class _CasosScreenState extends State<CasosScreen> {
  final _busquedaController = TextEditingController();
  Timer? _debounce;
  bool _actualizando = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final casos = Provider.of<CasosProvider>(context, listen: false);
      final sync = Provider.of<SyncProvider>(context, listen: false);
      // D-99→nuevo: el aviso de MASIVAS vive en la barra de navegación del
      // panel (InicioTecnicoScreen); aquí solo releejemos su caché para que el
      // badge esté al día sin sincronizar.
      final masivas = MasivasProvider.opcional(context, escuchar: false);
      // D-84/D-117: abrir la pantalla **no** sincroniza. Se pinta el contenido
      // local (instantáneo y válido sin conexión); la subida y la descarga viven
      // en la sección SINCRONIZAR.
      await casos.refrescarLocal();
      // El bloque MASIVA se pinta de inmediato desde la caché (sin tocar la red).
      await masivas?.refrescarLocal();
      await sync.refrescar();
    });
  }

  /// D-117: el panel principal **solo lee el contenido del dispositivo**.
  ///
  /// Subir evidencias, sincronizar los casos resueltos y descargar el despacho
  /// del día se hace en la sección **SINCRONIZAR**; aquí el botón solo vuelve a
  /// pintar la caché local (refresco de la aplicación).
  Future<void> _refrescarLocal() async {
    if (_actualizando) return;
    setState(() => _actualizando = true);
    try {
      final casos = context.read<CasosProvider>();
      final sync = context.read<SyncProvider>();
      final masivas = MasivasProvider.opcional(context, escuchar: false);
      await casos.refrescarLocal();
      await masivas?.refrescarLocal();
      await sync.refrescar();
    } finally {
      if (mounted) setState(() => _actualizando = false);
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _busquedaController.dispose();
    super.dispose();
  }

  void _buscar(String texto) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 450), () {
      if (!mounted) return;
      Provider.of<CasosProvider>(context, listen: false).buscar(texto);
    });
  }

  @override
  Widget build(BuildContext context) {
    final casosProv = Provider.of<CasosProvider>(context);
    final sync = Provider.of<SyncProvider>(context);
    final auth = Provider.of<AuthProvider>(context);
    final mensajes = Provider.of<MensajesProvider>(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(auth.nombre.isEmpty ? 'Mis casos' : auth.nombre),
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(30),
          child: BarraProgresoSync(),
        ),
        actions: [
          IconButton(
            tooltip: 'Sincronizar',
            icon: Badge(
              isLabelVisible: sync.pendientesSinError > 0,
              label: Text('${sync.pendientesSinError}'),
              child: const Icon(Icons.sync),
            ),
            onPressed: () => Navigator.pushNamed(context, '/sync'),
          ),
          IconButton(
            tooltip: 'Alertas',
            icon: const Icon(Icons.warning_amber),
            onPressed: () => Navigator.pushNamed(context, '/alertas'),
          ),
          IconButton(
            tooltip: 'Mensajes',
            icon: Badge(
              isLabelVisible: mensajes.noLeidos > 0,
              label: Text('${mensajes.noLeidos}'),
              child: const Icon(Icons.forum_outlined),
            ),
            onPressed: () => Navigator.pushNamed(context, '/mensajes'),
          ),
          // Menú de usuario (D-82 · requisito 3): perfil, cuenta y cierre de sesión.
          const BotonUsuario(),
        ],
      ),
      body: Column(
        children: [
          const OfflineBanner(),
          // D-107: si hay una entrega más nueva, la franja aparece aquí mismo y
          // actualiza la app sin desinstalarla.
          const BannerActualizacion(),
          _BannerContenidoLocal(
            casos: casosProv,
            // D-84/DEC-3: la actualización es explícita; la franja informa
            // cuántas acciones están guardadas sin enviar y ofrece el botón.
            pendientes: sync.pendientesSinError,
            onRefrescar: _refrescarLocal,
            refrescando: _actualizando,
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 4),
            child: TextField(
              controller: _busquedaController,
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(
                hintText: 'Buscar por avería, teléfono, cliente o dirección',
                prefixIcon: const Icon(Icons.search),
                border: const OutlineInputBorder(),
                isDense: true,
                suffixIcon: _busquedaController.text.isEmpty
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.clear),
                        tooltip: 'Limpiar',
                        onPressed: () {
                          _busquedaController.clear();
                          casosProv.limpiarBusqueda();
                        },
                      ),
              ),
              onChanged: _buscar,
              onSubmitted: (texto) => casosProv.buscar(texto),
            ),
          ),
          // D-101/D-105: los casos ya resueltos se ocultan del listado, pero el
          // botón para verlos es **permanente**: se pinta siempre, aunque el
          // conteo sea 0 o el listado esté vacío.
          // D-144: filtro de estado (incluye CERRADOS) + chip de resueltos.
          Row(
            children: [
              const SizedBox(width: 8),
              Expanded(
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      for (final opcion in opcionesFiltroEstado)
                        Padding(
                          padding: const EdgeInsets.only(right: 6),
                          child: FilterChip(
                            key: Key('filtro-estado-${opcion.clave}'),
                            selected: casosProv.filtroEstado == opcion.clave,
                            label: Text(opcion.etiqueta),
                            onSelected: (_) =>
                                casosProv.cambiarFiltroEstado(opcion.clave),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          ChipResueltos(
            resueltos: casosProv.gestionados,
            viendoResueltos: casosProv.verGestionados,
            onTap: casosProv.alternarGestionados,
          ),
          Expanded(child: _cuerpo(casosProv)),
        ],
      ),
    );
  }

  Widget _cuerpo(CasosProvider casosProv) {
    if (casosProv.cargando && casosProv.casos.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    final visibles = casosProv.casosVisibles;

    // D-101: el dispositivo tiene casos, pero todos están gestionados: el
    // listado queda vacío solo porque el conmutador está apagado.
    if (casosProv.todoGestionado) {
      return RefreshIndicator(
        onRefresh: _refrescarLocal,
        child: ListView(
          children: [
            const SizedBox(height: 80),
            const Icon(Icons.task_alt, size: 56, color: Colors.black26),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 28),
              child: Text(
                'No le quedan casos pendientes: los ${casosProv.gestionados} de este '
                'dispositivo ya están resueltos.',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 15),
              ),
            ),
            const SizedBox(height: 12),
            Center(
              child: OutlinedButton.icon(
                icon: const Icon(Icons.visibility),
                label: const Text('Ver resueltos'),
                onPressed: casosProv.alternarGestionados,
              ),
            ),
          ],
        ),
      );
    }

    if (visibles.isEmpty) {
      return RefreshIndicator(
        onRefresh: _refrescarLocal,
        child: ListView(
          children: [
            const SizedBox(height: 80),
            Icon(
              _iconoSinCasos(casosProv),
              size: 56,
              color: Colors.black26,
            ),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 28),
              child: Text(
                // D-83: el servidor explica el motivo real (sin cuadrilla,
                // cuadrilla de gestión, sin despacho…) en lugar del genérico.
                casosProv.explicacionSinCasos,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 15),
              ),
            ),
            if (casosProv.cuadrillaCodigo != null) ...[
              const SizedBox(height: 8),
              Text(
                'Cuadrilla ${casosProv.cuadrillaCodigo}'
                '${casosProv.casosCuadrilla > 0 ? ' · ${casosProv.casosCuadrilla} casos despachados' : ''}',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 12, color: Colors.black54),
              ),
            ],
            if (casosProv.error != null) ...[
              const SizedBox(height: 12),
              Center(
                child: OutlinedButton(
                  onPressed: () => Navigator.pushNamed(context, '/sync'),
                  child: const Text('Sincronizar'),
                ),
              ),
            ],
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _refrescarLocal,
      child: ListView.builder(
        itemCount: visibles.length + 1,
        itemBuilder: (context, index) {
          if (index == visibles.length) {
            return Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                '${visibles.length} de ${casosProv.total} casos'
                '${casosProv.gestionados > 0 && !casosProv.verGestionados ? ' · ${casosProv.gestionados} resuelto(s) oculto(s)' : ''}'
                ' · contenido local del dispositivo',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 12, color: Colors.black54),
              ),
            );
          }
          final caso = visibles[index];
          return CasoCard(
            caso: caso,
            onTap: () async {
              final casos = context.read<CasosProvider>();
              await Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => CasoDetalleScreen(caso: caso)),
              );
              if (!mounted) return;
              // D-84/D-85: al volver de la ficha se relee **lo local** (los
              // cambios del técnico ya quedaron guardados en el dispositivo);
              // no se descarga nada por abrir o cerrar una ficha.
              casos.refrescarLocal();
            },
          );
        },
      ),
    );
  }
}

/// Franja que informa que la lista es el **contenido local** del dispositivo
/// (D-82 · requisito 1) y ofrece el **refresco local** (D-117).
class _BannerContenidoLocal extends StatelessWidget {
  const _BannerContenidoLocal({
    required this.casos,
    required this.pendientes,
    required this.onRefrescar,
    this.refrescando = false,
  });

  final CasosProvider casos;

  /// Acciones guardadas en el dispositivo que aún no viajaron (D-85).
  final int pendientes;

  /// D-117: vuelve a leer el contenido local (no toca la red).
  final Future<void> Function() onRefrescar;

  /// `true` mientras se relee la caché local.
  final bool refrescando;

  @override
  Widget build(BuildContext context) {
    final sinRed = casos.desdeCache;
    final color = sinRed ? Colors.amber.shade100 : Colors.blueGrey.shade50;
    final icono = sinRed ? Icons.cloud_off : Icons.smartphone;
    final fecha = casos.actualizadoEn;
    // D-83: la cuadrilla que resolvió el servidor, visible en la franja.
    final prefijo = casos.cuadrillaCodigo == null ? '' : 'Cuadrilla ${casos.cuadrillaCodigo} · ';
    final cola = pendientes > 0 ? ' · $pendientes por enviar' : '';
    final texto = sinRed
        ? (fecha == null
            ? 'Sin conexión: mostrando el contenido local del dispositivo.$cola'
            : 'Sin conexión: contenido local del ${_fecha(fecha)}.$cola')
        : (fecha == null
            ? '${prefijo}Contenido local · ${casos.locales} casos.$cola'
            : '${prefijo}Contenido local · ${casos.locales} casos · actualizado el ${_fecha(fecha)}.$cola');

    return Container(
      width: double.infinity,
      color: color,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      child: Row(
        children: [
          Icon(icono, size: 17),
          const SizedBox(width: 8),
          Expanded(
            child: Text(texto, style: const TextStyle(fontSize: 12)),
          ),
          // D-117: el panel principal solo relee el contenido del dispositivo.
          TextButton(
            onPressed: refrescando ? null : () => onRefrescar(),
            child: Text(refrescando ? 'Refrescando…' : 'Refrescar'),
          ),
        ],
      ),
    );
  }

  static String _fecha(DateTime fecha) {
    String dos(int v) => v.toString().padLeft(2, '0');
    return '${dos(fecha.day)}/${dos(fecha.month)} ${dos(fecha.hour)}:${dos(fecha.minute)}';
  }
}

/// Icono del estado vacío según el motivo que devolvió el servidor (D-83).
IconData _iconoSinCasos(CasosProvider casos) {
  if (casos.error != null) return Icons.cloud_off;
  return switch (casos.motivoServidor) {
    'SIN_TECNICO' => Icons.person_off,
    'SIN_CUADRILLA' => Icons.group_off,
    'CUADRILLA_GESTION' => Icons.supervisor_account,
    _ => Icons.inbox,
  };
}
