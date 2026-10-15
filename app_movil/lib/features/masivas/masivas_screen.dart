import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'ficha_masiva_screen.dart';
import 'masivas_provider.dart';

/// Pantalla **MASIVAS** (D-99): las fallas masivas activas de la cuadrilla.
///
/// La lista sale del `MasivasProvider` (caché local del dispositivo) y se
/// refresca **cada 5 minutos** con la app en primer plano y al volver del
/// segundo plano, como el resto de pantallas del proyecto.
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
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => FichaMasivaScreen(masiva: masiva),
              ),
            ),
          );
        },
      ),
    );
  }
}

/// Tarjeta de una masiva activa: identificación, ubicación técnica y **RUTA**.
class TarjetaMasiva extends StatelessWidget {
  const TarjetaMasiva({super.key, required this.masiva, required this.onTap});

  final Map<String, dynamic> masiva;
  final VoidCallback onTap;

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

  @override
  Widget build(BuildContext context) {
    final idFalla = MasivasProvider.idDe(masiva);
    final estado = '${masiva['estado'] ?? ''}'.trim();
    final lineas = TarjetaMasiva.lineas(masiva);
    final alerta = Theme.of(context).colorScheme.error;

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      shape: RoundedRectangleBorder(
        side: BorderSide(color: alerta.withOpacity(0.6), width: 2),
        borderRadius: BorderRadius.circular(10),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        leading: Icon(Icons.crisis_alert, color: alerta),
        title: Text(
          'Masiva #$idFalla · $estado',
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        subtitle: Text(lineas.join('\n'), style: const TextStyle(fontSize: 13)),
        isThreeLine: true,
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }
}
