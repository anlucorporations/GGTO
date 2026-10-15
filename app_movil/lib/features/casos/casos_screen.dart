import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../widgets/barra_progreso_sync.dart';
import '../../widgets/boton_usuario.dart';
import '../../widgets/caso_card.dart';
import '../../widgets/offline_banner.dart';
import '../auth/auth_provider.dart';
import '../masivas/banner_masiva.dart';
import '../masivas/masivas_provider.dart';
import '../mensajes/mensajes_provider.dart';
import '../sync/sync_provider.dart';
import 'caso_detalle_screen.dart';
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

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final casos = Provider.of<CasosProvider>(context, listen: false);
      final sync = Provider.of<SyncProvider>(context, listen: false);
      // D-99: el bloque MASIVA es fijo y prioritario.
      final masivas = MasivasProvider.opcional(context, escuchar: false);
      // D-84: abrir la pantalla **no** sincroniza. Se pinta el contenido local
      // (instantáneo y válido sin conexión) y el técnico decide cuándo DESCARGAR
      // o CARGAR desde la franja de estado.
      await casos.refrescarLocal();
      // El bloque MASIVA se pinta de inmediato desde la caché (sin tocar la red).
      await masivas?.refrescarLocal();
      await sync.refrescar();
    });
  }

  /// Descarga los casos y, con ellos, las masivas activas (D-99).
  ///
  /// La descarga es una sola (`GET /sync/descarga` viaja con `masivas`): aquí
  /// solo hay que volcar la caché recién actualizada en el bloque MASIVA.
  Future<void> _descargar() async {
    final casos = context.read<CasosProvider>();
    final masivas = MasivasProvider.opcional(context, escuchar: false);
    await casos.cargar();
    await masivas?.refrescarLocal();
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
    // D-99: el bloque MASIVA es tolerante: si el proveedor no está registrado
    // (pantallas aisladas), simplemente no se pinta.
    final masivas = MasivasProvider.opcional(context);

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
          // D-99: acceso directo a MASIVAS, con el contador de activas.
          IconButton(
            tooltip: 'Masivas',
            icon: Badge(
              isLabelVisible: (masivas?.total ?? 0) > 0,
              label: Text('${masivas?.total ?? 0}'),
              child: const Icon(Icons.crisis_alert),
            ),
            onPressed: () => Navigator.pushNamed(context, '/masivas'),
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
          _BannerContenidoLocal(
            casos: casosProv,
            // D-84/DEC-3: la sincronización es explícita; la franja informa
            // cuántas acciones están guardadas sin enviar y ofrece CARGA.
            pendientes: sync.pendientesSinError,
            onCargar: () => Navigator.pushNamed(context, '/sync'),
            // D-99: DESCARGAR también refresca el bloque MASIVA.
            onDescargar: _descargar,
          ),
          // D-99 · MASIVA fija y priorizada: vive **fuera** del ListView (la
          // lista va debajo, en el Expanded), así que no desaparece al desplazar.
          BannerMasivaActiva(
            masivas: masivas?.masivas ?? const [],
            onTap: () => Navigator.pushNamed(context, '/masivas'),
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
          // D-101: los casos ya gestionados se ocultan del listado; el técnico
          // puede volver a verlos con este conmutador.
          if (casosProv.gestionados > 0)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 2),
              child: Align(
                alignment: Alignment.centerLeft,
                child: FilterChip(
                  selected: casosProv.verGestionados,
                  avatar: Icon(
                    casosProv.verGestionados ? Icons.visibility : Icons.visibility_off,
                    size: 18,
                  ),
                  label: Text('Ver gestionados (${casosProv.gestionados})'),
                  onSelected: (_) => casosProv.alternarGestionados(),
                ),
              ),
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
        onRefresh: _descargar,
        child: ListView(
          children: [
            const SizedBox(height: 80),
            const Icon(Icons.task_alt, size: 56, color: Colors.black26),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 28),
              child: Text(
                'No le quedan casos pendientes: los ${casosProv.gestionados} de este '
                'dispositivo ya están gestionados.',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 15),
              ),
            ),
            const SizedBox(height: 12),
            Center(
              child: OutlinedButton.icon(
                icon: const Icon(Icons.visibility),
                label: const Text('Ver gestionados'),
                onPressed: casosProv.alternarGestionados,
              ),
            ),
          ],
        ),
      );
    }

    if (visibles.isEmpty) {
      return RefreshIndicator(
        onRefresh: _descargar,
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
                  onPressed: () => casosProv.cargar(),
                  child: const Text('Reintentar'),
                ),
              ),
            ],
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _descargar,
      child: ListView.builder(
        itemCount: visibles.length + 1,
        itemBuilder: (context, index) {
          if (index == visibles.length) {
            return Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                '${visibles.length} de ${casosProv.total} casos'
                '${casosProv.gestionados > 0 && !casosProv.verGestionados ? ' · ${casosProv.gestionados} gestionado(s) oculto(s)' : ''}'
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
/// (D-82 · requisito 1) y avisa cuando la descarga no pudo actualizarla.
class _BannerContenidoLocal extends StatelessWidget {
  const _BannerContenidoLocal({
    required this.casos,
    required this.pendientes,
    required this.onCargar,
    this.onDescargar,
  });

  final CasosProvider casos;

  /// Acciones guardadas en el dispositivo que aún no viajaron (D-85).
  final int pendientes;

  /// Abre la CARGA (pantalla Dispositivo) con las acciones pendientes.
  final VoidCallback onCargar;

  /// DESCARGAR: casos **y masivas** (D-99). Si no se informa, solo los casos.
  final Future<void> Function()? onDescargar;

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
          // D-84 (DEC-3): nada se sincroniza solo; el técnico decide.
          TextButton(
            onPressed: casos.cargando
                ? null
                : () => (onDescargar ?? casos.cargar)(),
            child: Text(sinRed ? 'Reintentar' : 'Descargar'),
          ),
          if (pendientes > 0)
            TextButton(
              onPressed: onCargar,
              child: Text('Cargar ($pendientes)'),
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
