import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/constants.dart';
import '../../core/theme.dart';
import '../../core/version_app.dart';
import 'actualizador_apk.dart';
import 'version_service.dart';

/// Tarjeta del panel de usuario que **comprueba la última versión publicada** de
/// la APK (D-102) y **actualiza la app sin reinstalarla** (D-107).
///
/// Muestra la versión instalada, la publicada en el servidor y, si hay una más
/// reciente, ofrece **«Actualizar ahora»**: descarga la APK con progreso, verifica
/// el SHA-256 publicado y abre el instalador de Android, que reemplaza la app en
/// su sitio (conserva la sesión y los datos). Como alternativa queda la descarga
/// por el navegador y el enlace copiable.
///
/// La consulta y la actualización se pueden **inyectar** (`consultar`,
/// `actualizar`) para poder probar los estados sin red ni dispositivo.
class TarjetaVersion extends StatefulWidget {
  const TarjetaVersion({
    super.key,
    this.consultar,
    this.actualizar,
    this.versionInstalada,
  });

  /// Consulta inyectable; por defecto usa [VersionService].
  final Future<MetaApk> Function()? consultar;

  /// Actualización inyectable; por defecto usa [ActualizadorApk].
  final Future<ResultadoActualizacion> Function(
    MetaApk meta,
    void Function(double progreso, String fase)? onProgreso,
  )? actualizar;

  /// Versión instalada (por defecto, la del `pubspec.yaml`).
  final String? versionInstalada;

  @override
  State<TarjetaVersion> createState() => _TarjetaVersionState();
}

enum _Estado { sinComprobar, comprobando, alDia, hayActualizacion, error }

class _TarjetaVersionState extends State<TarjetaVersion> {
  _Estado _estado = _Estado.sinComprobar;
  MetaApk? _meta;
  ComparacionVersion? _comparacion;
  String _error = '';

  // D-107: descarga e instalación dentro de la app.
  bool _actualizando = false;
  double _progreso = 0;
  String _fase = '';
  ResultadoActualizacion? _resultado;

  final _actualizador = ActualizadorApk();

  String get _instalada => widget.versionInstalada ?? AppConstants.version;

  @override
  void initState() {
    super.initState();
    // Al abrir el panel se comprueba sola: es una consulta pequeña y pública.
    WidgetsBinding.instance.addPostFrameCallback((_) => _comprobar());
  }

  Future<void> _comprobar() async {
    setState(() {
      _estado = _Estado.comprobando;
      _error = '';
    });
    try {
      final servicio = VersionService();
      final meta = widget.consultar == null
          ? await servicio.consultar()
          : await widget.consultar!.call();
      final comparacion = compararVersiones(
        instalada: _instalada,
        disponible: meta.version,
      );
      if (!mounted) return;
      setState(() {
        _meta = meta;
        _comparacion = comparacion;
        _estado = comparacion.hayActualizacion ? _Estado.hayActualizacion : _Estado.alDia;
      });
    } on VersionError catch (e) {
      if (!mounted) return;
      setState(() {
        _estado = _Estado.error;
        _error = e.mensaje;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _estado = _Estado.error;
        _error = 'No se pudo comprobar la versión.';
      });
    }
  }

  Future<void> _abrirDescarga() async {
    final meta = _meta;
    if (meta == null) return;
    final url = VersionService.urlDescarga(meta);
    final abierto = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    if (!abierto && mounted) {
      _avisar('No se pudo abrir el navegador. Copie el enlace.');
    }
  }

  /// D-107: descarga la APK publicada y abre el instalador del sistema.
  Future<void> _actualizar() async {
    final meta = _meta;
    if (meta == null || _actualizando) return;
    setState(() {
      _actualizando = true;
      _progreso = 0;
      _fase = 'Preparando la descarga…';
      _resultado = null;
    });

    void progreso(double valor, String fase) {
      if (!mounted) return;
      setState(() {
        _progreso = valor;
        _fase = fase;
      });
    }

    try {
      // La limpieza de entregas anteriores la hace el propio actualizador.
      final resultado = widget.actualizar != null
          ? await widget.actualizar!(meta, progreso)
          : await _actualizador.actualizar(meta, onProgreso: progreso);
      if (!mounted) return;
      setState(() {
        _resultado = resultado;
        _actualizando = false;
        _progreso = resultado.ok ? 1 : 0;
      });
      _avisar(resultado.mensaje);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _actualizando = false;
        _resultado = const ResultadoActualizacion(
          EstadoActualizacion.errorDescarga,
          'No se pudo actualizar. Use «Descargar en el navegador».',
        );
      });
    }
  }

  Future<void> _copiarEnlace() async {
    final meta = _meta;
    if (meta == null) return;
    await Clipboard.setData(ClipboardData(text: VersionService.urlDescarga(meta)));
    if (mounted) _avisar('Enlace de descarga copiado.');
  }

  void _avisar(String mensaje) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(mensaje)));
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.system_update_alt, color: Marca.azul),
                const SizedBox(width: 8),
                const Expanded(
                  child: Text(
                    'Versión de la aplicación',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ),
                if (_estado == _Estado.comprobando)
                  const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
              ],
            ),
            const SizedBox(height: 10),
            _dato('Instalada', _instalada),
            if (_meta != null) ...[
              _dato('Publicada', _meta!.version),
              _dato('Tamaño', _meta!.tamanoLegible),
              _dato('Compilada el', _meta!.fechaLegible),
            ],
            const SizedBox(height: 8),
            _veredicto(),
            if (_meta != null && _meta!.sha256.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                'SHA-256: ${_meta!.sha256}',
                style: const TextStyle(fontSize: 10.5, color: Marca.textoSuave),
              ),
            ],
            const SizedBox(height: 12),
            _acciones(),
          ],
        ),
      ),
    );
  }

  Widget _dato(String etiqueta, String valor) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 118,
            child: Text(
              etiqueta,
              style: const TextStyle(fontSize: 13, color: Marca.textoSuave),
            ),
          ),
          Expanded(
            child: Text(valor, style: const TextStyle(fontSize: 13.5)),
          ),
        ],
      ),
    );
  }

  Widget _veredicto() {
    switch (_estado) {
      case _Estado.sinComprobar:
        return const Text(
          'Pulse «Buscar actualización» para consultar la última entrega.',
          style: TextStyle(fontSize: 13, color: Marca.textoSuave),
        );
      case _Estado.comprobando:
        return const Text(
          'Consultando la última versión publicada…',
          style: TextStyle(fontSize: 13, color: Marca.textoSuave),
        );
      case _Estado.alDia:
        return _aviso(
          icono: Icons.verified_outlined,
          color: Marca.exito,
          fondo: Marca.exitoClaro,
          titulo: 'Tiene la última versión',
          detalle: _comparacion?.motivo ?? '',
        );
      case _Estado.hayActualizacion:
        return _aviso(
          icono: Icons.download_for_offline_outlined,
          color: Marca.alerta,
          fondo: Marca.alertaClaro,
          titulo: 'Hay una actualización disponible',
          detalle: _comparacion?.motivo ?? '',
        );
      case _Estado.error:
        return _aviso(
          icono: Icons.cloud_off,
          color: Marca.textoSuave,
          fondo: Marca.contenedor,
          titulo: 'No se pudo comprobar',
          detalle: _error,
        );
    }
  }

  Widget _aviso({
    required IconData icono,
    required Color color,
    required Color fondo,
    required String titulo,
    required String detalle,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: fondo,
        borderRadius: BorderRadius.circular(Marca.radioControl),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icono, size: 18, color: color),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  titulo,
                  style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: color),
                ),
                if (detalle.isNotEmpty)
                  Text(detalle, style: TextStyle(fontSize: 12.5, color: color)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _acciones() {
    final comprobando = _estado == _Estado.comprobando;
    if (_estado == _Estado.hayActualizacion) {
      return Column(
        children: [
          if (_actualizando) ...[
            LinearProgressIndicator(value: _progreso > 0 ? _progreso : null),
            const SizedBox(height: 6),
            Text(
              _fase,
              style: const TextStyle(fontSize: 12.5, color: Marca.textoSuave),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
          ] else
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                icon: const Icon(Icons.system_update),
                label: Text(
                  _resultado?.estado == EstadoActualizacion.descargadaEnSegundoPlano
                      ? 'Instalar actualización'
                      : 'Actualizar ahora',
                ),
                onPressed: _actualizar,
              ),
            ),
          if (_resultado != null && !_actualizando) ...[
            const SizedBox(height: 8),
            _aviso(
              icono: _resultado!.esExito
                  ? (_resultado!.ok ? Icons.check_circle_outline : Icons.download_done)
                  : Icons.info_outline,
              color: _resultado!.esExito ? Marca.exito : Marca.alerta,
              fondo: _resultado!.esExito ? Marca.exitoClaro : Marca.alertaClaro,
              titulo: _resultado!.esExito
                  ? (_resultado!.ok ? 'Instalación en curso' : 'Actualización descargada')
                  : 'No se pudo actualizar',
              detalle: _resultado!.mensaje,
            ),
          ],
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  icon: const Icon(Icons.open_in_browser),
                  label: const Text('Descargar en el navegador'),
                  onPressed: _actualizando ? null : _abrirDescarga,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  icon: const Icon(Icons.link),
                  label: const Text('Copiar enlace'),
                  onPressed: _actualizando ? null : _copiarEnlace,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          TextButton.icon(
            icon: const Icon(Icons.refresh),
            label: const Text('Volver a comprobar'),
            onPressed: (comprobando || _actualizando) ? null : _comprobar,
          ),
          const Text(
            'La actualización se instala sobre esta misma app: no hace falta '
            'desinstalarla y se conservan la sesión y los datos.',
            style: TextStyle(fontSize: 11.5, color: Marca.textoSuave),
            textAlign: TextAlign.center,
          ),
        ],
      );
    }
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        icon: const Icon(Icons.refresh),
        label: Text(comprobando ? 'Comprobando…' : 'Buscar actualización'),
        onPressed: comprobando ? null : _comprobar,
      ),
    );
  }
}
