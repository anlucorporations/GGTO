import 'package:flutter/material.dart';

import '../../core/constants.dart';
import '../../core/theme.dart';
import '../../core/version_app.dart';
import 'actualizador_apk.dart';
import 'version_service.dart';

/// Franja de **actualización disponible** en la pantalla de casos (D-107).
///
/// La tarjeta del panel de usuario sigue existiendo, pero el técnico no entra
/// ahí todos los días: al abrir la pantalla de trabajo se comprueba en silencio
/// la última entrega y, si hay una más nueva, aparece esta franja con
/// **«Actualizar»**, que descarga la APK y abre el instalador del sistema (la app
/// se reemplaza en su sitio, sin desinstalar). Sin conexión no muestra nada.
class BannerActualizacion extends StatefulWidget {
  const BannerActualizacion({super.key, this.consultar, this.actualizar});

  /// Consulta inyectable (pruebas sin red).
  final Future<MetaApk> Function()? consultar;

  /// Actualización inyectable (pruebas sin canal nativo).
  final Future<ResultadoActualizacion> Function(
    MetaApk meta,
    void Function(double progreso, String fase)? onProgreso,
  )? actualizar;

  @override
  State<BannerActualizacion> createState() => _BannerActualizacionState();
}

class _BannerActualizacionState extends State<BannerActualizacion> {
  MetaApk? _meta;
  bool _actualizando = false;
  bool _descargada = false;
  double _progreso = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _comprobar());
  }

  Future<void> _comprobar() async {
    try {
      final meta = widget.consultar != null
          ? await widget.consultar!.call()
          : await VersionService().consultar();
      final comparacion = compararVersiones(
        instalada: AppConstants.version,
        disponible: meta.version,
      );
      if (!mounted || !comparacion.hayActualizacion) return;
      setState(() => _meta = meta);
    } catch (_) {
      // Sin conexión o servidor sin publicar: no se molesta al técnico.
    }
  }

  Future<void> _actualizar() async {
    final meta = _meta;
    if (meta == null || _actualizando) return;
    setState(() {
      _actualizando = true;
      _progreso = 0;
    });
    try {
      final resultado = widget.actualizar != null
          ? await widget.actualizar!(meta, (p, _) {
              if (mounted) setState(() => _progreso = p);
            })
          : await ActualizadorApk().actualizar(meta, onProgreso: (p, _) {
              if (mounted) setState(() => _progreso = p);
            });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(resultado.mensaje)),
      );
      setState(() {
        _actualizando = false;
        // D-108: si la descarga terminó en segundo plano, la franja cambia a
        // «Instalar» (la APK ya está en caché y se abre el instalador al tocar).
        _descargada = resultado.estado == EstadoActualizacion.descargadaEnSegundoPlano;
        // Tras abrir el instalador o si falta el permiso, la franja se queda
        // para poder reintentar; si ya no aplica, desaparece.
        if (!resultado.esExito &&
            resultado.estado == EstadoActualizacion.huellaIncorrecta) {
          _meta = null;
        }
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _actualizando = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No se pudo actualizar. Use el panel de usuario → Versión.'),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final meta = _meta;
    if (meta == null) return const SizedBox.shrink();
    return Container(
      width: double.infinity,
      color: Marca.alertaClaro,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.system_update, size: 17, color: Marca.alerta),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Actualización ${meta.version} disponible',
                  style: const TextStyle(fontSize: 12.5, color: Marca.alerta),
                ),
              ),
              TextButton(
                onPressed: _actualizando ? null : _actualizar,
                child: Text(
                  _actualizando
                      ? 'Actualizando…'
                      : (_descargada ? 'Instalar' : 'Actualizar'),
                ),
              ),
            ],
          ),
          if (_actualizando)
            LinearProgressIndicator(
              value: _progreso > 0 ? _progreso : null,
              minHeight: 3,
            ),
        ],
      ),
    );
  }
}
