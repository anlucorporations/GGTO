import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../widgets/estado_icono.dart';
import '../auth/auth_provider.dart';
import 'ficha_masiva_screen.dart';
import 'indicador_masiva.dart';
import 'masivas_provider.dart';

/// Pantalla **MASIVAS** (D-99): las fallas masivas activas de la cuadrilla.
///
/// La lista sale del `MasivasProvider` (caché local del dispositivo) y se
/// refresca **cada 5 minutos** con la app en primer plano y al volver del
/// segundo plano, como el resto de pantallas del proyecto.
///
/// **D-111**: el cuadro de masivas usa el **estilo de CASOS** (`CasoCard`) —la
/// cabecera con la avería, las líneas de detalle y el estado como icono— y añade,
/// debajo, la **columna de indicadores** (Planificación · Materiales ·
/// Asignación) y las **acciones como iconos** que abren la ficha en su pestaña.
class MasivasScreen extends StatefulWidget {
  const MasivasScreen({super.key});

  /// Periodo del refresco automático en primer plano.
  static const Duration intervaloRefresco = Duration(minutes: 5);

  @override
  State<MasivasScreen> createState() => _MasivasScreenState();
}

class _MasivasScreenState extends State<MasivasScreen> with WidgetsBindingObserver {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final masivas = context.read<MasivasProvider>();
      // Primero lo guardado (instantáneo y válido sin conexión), después la red.
      await masivas.cargarDesdeCache();
      await masivas.refrescarDesdeServidor();
    });
    _programar();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState estado) {
    if (estado == AppLifecycleState.resumed) {
      context.read<MasivasProvider>().refrescarDesdeServidor();
      _programar();
    } else {
      _timer?.cancel();
    }
  }

  void _programar() {
    _timer?.cancel();
    _timer = Timer(MasivasScreen.intervaloRefresco, () async {
      if (!mounted) return;
      await context.read<MasivasProvider>().cargar(silencioso: true);
      if (mounted) _programar();
    });
  }

  /// Rol efectivo (el más restrictivo si no se puede resolver).
  String _rol() {
    try {
      return context.read<AuthProvider>().rol;
    } catch (_) {
      return '';
    }
  }

  /// Abre la ficha de la masiva; `pestana` la abre en PLANIFICAR/MATERIALES/CERRAR.
  void _abrir(Map<String, dynamic> masiva, {String? pestana}) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => FichaMasivaScreen(masiva: masiva, pestanaInicial: pestana),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final masivas = context.watch<MasivasProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Masivas'),
        actions: [
          IconButton(
            tooltip: 'Actualizar',
            icon: const Icon(Icons.refresh),
            onPressed: masivas.cargando ? null : () => masivas.cargar(),
          ),
        ],
      ),
      body: _cuerpo(masivas),
    );
  }

  Widget _cuerpo(MasivasProvider masivas) {
    if (masivas.cargando && masivas.masivas.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (masivas.masivas.isEmpty) {
      return RefreshIndicator(
        onRefresh: () => masivas.cargar(),
        child: ListView(
          children: [
            const SizedBox(height: 80),
            const Icon(Icons.check_circle_outline, size: 56, color: Colors.black26),
            const SizedBox(height: 12),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 28),
              child: Text(
                'No hay fallas masivas activas para su cuadrilla.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 15),
              ),
            ),
            if (masivas.error != null) ...[
              const SizedBox(height: 12),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 28),
                child: Text(
                  masivas.error!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 13, color: Colors.black54),
                ),
              ),
              Center(
                child: OutlinedButton(
                  onPressed: () => masivas.cargar(),
                  child: const Text('Reintentar'),
                ),
              ),
            ],
          ],
        ),
      );
    }

    final rol = _rol();
    return RefreshIndicator(
      onRefresh: () => masivas.cargar(),
      child: ListView.builder(
        padding: const EdgeInsets.only(bottom: 16),
        itemCount: masivas.masivas.length + 1,
        itemBuilder: (context, indice) {
          if (indice == masivas.masivas.length) {
            return Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                '${masivas.total} masiva(s) activa(s)'
                '${masivas.desdeCache ? ' · contenido local del dispositivo' : ''}',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 12, color: Colors.black54),
              ),
            );
          }
          final masiva = masivas.masivas[indice];
          return TarjetaMasiva(
            masiva: masiva,
            rol: rol,
            onTap: () => _abrir(masiva),
            alAbrirPestana: (pestana) => _abrir(masiva, pestana: pestana),
          );
        },
      ),
    );
  }
}

/// Tarjeta de una masiva activa con el **estilo de CASOS** (D-111).
///
/// Arriba, como `CasoCard`: identificador, líneas de detalle (sector, FAT, ODN,
/// **RUTA**, casos, detección) y el estado como **icono**. Abajo, separada por
/// una línea: la **columna de indicadores** —Planificación · Materiales ·
/// Asignación— y las **acciones como iconos**, que abren la ficha de la masiva
/// en su pestaña (PLANIFICAR · MATERIALES · CERRAR).
class TarjetaMasiva extends StatelessWidget {
  const TarjetaMasiva({
    super.key,
    required this.masiva,
    required this.onTap,
    this.rol = '',
    this.alAbrirPestana,
  });

  final Map<String, dynamic> masiva;
  final VoidCallback onTap;

  /// Rol del usuario: decide qué acciones de icono se ofrecen (D-111).
  final String rol;

  /// Abre la ficha en una pestaña: 'PLANIFICAR', 'MATERIALES' o 'CERRAR'.
  final void Function(String pestana)? alAbrirPestana;

  /// Líneas de la tarjeta (puras: se pueden probar sin dispositivo).
  static List<String> lineas(Map<String, dynamic> masiva) {
    String v(String campo) => '${masiva[campo] ?? ''}'.trim();
    String fecha(dynamic valor) {
      final texto = '${valor ?? ''}'.trim();
      if (texto.isEmpty) return '';
      final momento = DateTime.tryParse(texto)?.toLocal();
      if (momento == null) return texto;
      String dos(int valor) => valor.toString().padLeft(2, '0');
      return '${dos(momento.day)}/${dos(momento.month)}/${momento.year} '
          '${dos(momento.hour)}:${dos(momento.minute)}';
    }

    final ruta = MasivasProvider.rutaDeMasiva(masiva);
    final deteccion = fecha(masiva['fecha_deteccion']);
    return [
      if (v('descripcion').isNotEmpty) v('descripcion'),
      'Sector: ${v('sector_nombre').isEmpty ? '—' : v('sector_nombre')}',
      'FAT: ${v('fat').isEmpty ? '—' : v('fat')}',
      'ODN: ${v('odn').isEmpty ? '—' : v('odn')}',
      'RUTA: ${ruta.isEmpty ? '—' : ruta}',
      'Casos asociados: ${MasivasProvider.casosAsociados(masiva)}',
      if (deteccion.isNotEmpty) 'Detectada el $deteccion',
    ];
  }

  /// Acciones de icono de la tarjeta, en el orden en que se pintan.
  ///
  /// El rol manda, igual que en las pestañas de la ficha: TECNICO solo puede
  /// consultar MATERIALES y no ve PLANIFICAR ni CERRAR (D-99).
  static List<String> accionesDe(String rol) => [
        if (MasivasProvider.puedePlanificar(rol)) 'PLANIFICAR',
        'MATERIALES',
        if (MasivasProvider.puedeCerrar(rol)) 'CERRAR',
      ];

  /// Icono y nombre accesible de cada acción.
  static (IconData, String) iconoDeAccion(String pestana) => switch (pestana) {
        'PLANIFICAR' => (Icons.event_available, 'Planificar'),
        'CERRAR' => (Icons.task_alt, 'Cerrar'),
        _ => (Icons.inventory_2_outlined, 'Materiales'),
      };

  @override
  Widget build(BuildContext context) {
    final idFalla = MasivasProvider.idDe(masiva);
    final estado = '${masiva['estado'] ?? ''}'.trim();
    final lineas = TarjetaMasiva.lineas(masiva);
    final planificacion = '${masiva['planificacion'] ?? ''}'.trim();
    final ordenes = MasivasProvider.ordenesDe(masiva);
    final cuadrilla =
        '${masiva['cuadrilla_codigo'] ?? masiva['cuadrilla_nombre'] ?? ''}'.trim();
    final acciones = TarjetaMasiva.accionesDe(rol);

    void abrir(String pestana) {
      if (alAbrirPestana != null) {
        alAbrirPestana!(pestana);
      } else {
        onTap();
      }
    }

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ListTile(
            contentPadding: const EdgeInsets.fromLTRB(14, 10, 8, 10),
            title: Text(
              'Masiva #$idFalla',
              style: const TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 16,
                fontFeatures: [FontFeature.tabularFigures()],
              ),
            ),
            subtitle: Text(
              lineas.join('\n'),
              style: const TextStyle(
                fontSize: 14,
                height: 1.4,
                color: Marca.textoSuave,
              ),
            ),
            isThreeLine: lineas.length > 1,
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (estado.isNotEmpty) EstadoIcono(estado: estado),
                const SizedBox(width: 2),
                const Icon(Icons.chevron_right, size: 18, color: Marca.textoSuave),
              ],
            ),
            onTap: onTap,
          ),
          const Divider(height: 1, indent: 14, endIndent: 14),
          Padding(
            padding: const EdgeInsets.fromLTRB(10, 6, 4, 6),
            child: Row(
              children: [
                IndicadorMasiva(
                  icono: Icons.event_available,
                  activa: MasivasProvider.tienePlanificacion(masiva),
                  etiqueta: 'Planificación',
                  detalle: planificacion.isEmpty ? 'sin planificar' : planificacion,
                  onTap: () => abrir('PLANIFICAR'),
                ),
                const SizedBox(width: 6),
                IndicadorMasiva(
                  icono: Icons.inventory_2_outlined,
                  activa: MasivasProvider.tieneMateriales(masiva),
                  etiqueta: 'Materiales',
                  detalle:
                      ordenes > 0 ? '$ordenes orden(es) de material' : 'sin órdenes',
                  onTap: () => abrir('MATERIALES'),
                ),
                const SizedBox(width: 6),
                IndicadorMasiva(
                  icono: Icons.groups_outlined,
                  activa: MasivasProvider.tieneAsignacion(masiva),
                  etiqueta: 'Asignación',
                  detalle: cuadrilla.isEmpty ? 'sin cuadrilla' : cuadrilla,
                  onTap: onTap,
                ),
                const Spacer(),
                for (final accion in acciones)
                  IconButton(
                    tooltip: TarjetaMasiva.iconoDeAccion(accion).$2,
                    visualDensity: VisualDensity.compact,
                    onPressed: () => abrir(accion),
                    icon: Icon(
                      TarjetaMasiva.iconoDeAccion(accion).$1,
                      color: Marca.azul,
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
