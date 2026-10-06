import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/api_error.dart';
import '../../core/constants.dart';
import '../../core/database.dart';
import '../../core/sesion.dart';
import '../auth/auth_provider.dart';
import '../sync/sync_provider.dart';
import 'usuario_service.dart';

/// Sección **Usuario** de la APK (D-82 · requisitos 3 y 4).
///
/// Se abre desde el icono de usuario de la barra superior y permite:
///   · **Datos personales** (nombre, apellido, P00, correo editable).
///   · **Datos administrativos** (P00, rol, cuadrilla —P00, Cuadrilla, etc.—,
///     central, dispositivo y versión de la app).
///   · **Cambiar la contraseña** (exige la actual).
///   · **Ver las palabras de seguridad**: se muestran tras teclear la
///     contraseña actual; el servidor las regenera y las anteriores dejan de ser
///     válidas.
///
/// Todo se pinta primero desde el **contenido local** guardado en el
/// dispositivo, así que la sección funciona sin conexión.
class UsuarioScreen extends StatefulWidget {
  const UsuarioScreen({super.key});

  @override
  State<UsuarioScreen> createState() => _UsuarioScreenState();
}

class _UsuarioScreenState extends State<UsuarioScreen> {
  final _correoController = TextEditingController();
  final _claveActualController = TextEditingController();
  final _claveNuevaController = TextEditingController();
  final _confirmacionController = TextEditingController();
  final _clavePalabrasController = TextEditingController();

  PerfilUsuario? _perfil;
  CuadrillaInfo? _cuadrilla;
  EstadoSeguridad? _seguridad;
  String? _dispositivo;
  bool _cargando = true;
  bool _hayRed = true;
  bool _guardandoCorreo = false;
  bool _cambiandoClave = false;
  bool _mostrandoPalabras = false;
  List<String> _palabras = const [];
  bool _claveVisible = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _cargar());
  }

  @override
  void dispose() {
    _correoController.dispose();
    _claveActualController.dispose();
    _claveNuevaController.dispose();
    _confirmacionController.dispose();
    _clavePalabrasController.dispose();
    super.dispose();
  }

  /// 1.º contenido local del dispositivo; 2.º actualización contra el servidor.
  Future<void> _cargar() async {
    final auth = context.read<AuthProvider>();
    setState(() => _cargando = true);

    final local = await UsuarioService.perfilLocal();
    final localCuadrilla = await UsuarioService.cuadrillaLocal();
    final dispositivo = await DatabaseHelper.instance.dispositivoId();
    if (!mounted) return;
    setState(() {
      _perfil = local ?? _perfilDesdeSesion(auth.usuario);
      _cuadrilla = localCuadrilla ?? _cuadrilla;
      _dispositivo = dispositivo;
      _correoController.text = _perfil?.correo ?? '';
      _cargando = false;
    });

    var hayRed = context.read<SyncProvider>().enLinea;
    try {
      final perfil = await UsuarioService.cargarPerfil();
      final cuadrilla = await UsuarioService.cargarCuadrilla();
      if (!mounted) return;
      setState(() {
        if (perfil != null) {
          _perfil = perfil;
          _correoController.text = perfil.correo;
        }
        if (cuadrilla != null) _cuadrilla = cuadrilla;
      });
    } catch (_) {
      hayRed = false;
    }
    try {
      final seguridad = await UsuarioService.estadoSeguridad();
      if (!mounted) return;
      setState(() => _seguridad = seguridad);
    } on ApiError catch (error) {
      if (error.esDeRed) hayRed = false;
    } catch (_) {
      hayRed = false;
    }
    if (mounted) setState(() => _hayRed = hayRed);
  }

  PerfilUsuario? _perfilDesdeSesion(SesionUsuario? usuario) {
    if (usuario == null) return null;
    return PerfilUsuario(
      p00: usuario.p00,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      correo: usuario.correo,
      rol: usuario.rol,
      idCentral: usuario.idCentral,
    );
  }

  void _avisar(String mensaje, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(mensaje),
        backgroundColor: error ? Colors.red.shade700 : null,
      ),
    );
  }

  Future<void> _guardarCorreo() async {
    final correo = _correoController.text.trim();
    if (correo.length < 5 || !correo.contains('@')) {
      _avisar('Indique un correo válido.', error: true);
      return;
    }
    setState(() => _guardandoCorreo = true);
    try {
      final perfil = await UsuarioService.actualizarCorreo(correo);
      if (perfil != null && mounted) setState(() => _perfil = perfil);
      _avisar('Correo actualizado.');
    } on ApiError catch (error) {
      _avisar(error.mensaje, error: true);
    } catch (error) {
      _avisar('No se pudo actualizar el correo: $error', error: true);
    } finally {
      if (mounted) setState(() => _guardandoCorreo = false);
    }
  }

  Future<void> _cambiarClave() async {
    final actual = _claveActualController.text;
    final nueva = _claveNuevaController.text;
    final confirmacion = _confirmacionController.text;
    if (actual.isEmpty) {
      _avisar('Escriba su contraseña actual.', error: true);
      return;
    }
    if (nueva.length < 8) {
      _avisar('La nueva contraseña debe tener al menos 8 caracteres.', error: true);
      return;
    }
    if (nueva != confirmacion) {
      _avisar('La confirmación no coincide con la nueva contraseña.', error: true);
      return;
    }

    setState(() => _cambiandoClave = true);
    try {
      final mensaje = await UsuarioService.cambiarClave(
        claveActual: actual,
        claveNueva: nueva,
        confirmacion: confirmacion,
      );
      if (!mounted) return;
      _claveActualController.clear();
      _claveNuevaController.clear();
      _confirmacionController.clear();
      _avisar(mensaje);
    } on ApiError catch (error) {
      _avisar(error.mensaje, error: true);
    } catch (error) {
      _avisar('No se pudo cambiar la contraseña: $error', error: true);
    } finally {
      if (mounted) setState(() => _cambiandoClave = false);
    }
  }

  Future<void> _verPalabras() async {
    final clave = _clavePalabrasController.text;
    if (clave.isEmpty) {
      _avisar('Escriba su contraseña actual para ver las palabras.', error: true);
      return;
    }
    setState(() => _mostrandoPalabras = true);
    try {
      final palabras = await UsuarioService.mostrarPalabras(clave);
      if (!mounted) return;
      _clavePalabrasController.clear();
      setState(() => _palabras = palabras);
      if (palabras.isEmpty) {
        _avisar('El servidor no devolvió palabras de seguridad.', error: true);
      } else {
        _avisar('Palabras regeneradas: guarde las nuevas en un lugar seguro.');
      }
      // Se refresca el estado (la versión de las palabras cambia al regenerarlas).
      final seguridad = await UsuarioService.estadoSeguridad();
      if (mounted && seguridad != null) setState(() => _seguridad = seguridad);
    } on ApiError catch (error) {
      _avisar(error.mensaje, error: true);
    } catch (error) {
      _avisar('No se pudieron obtener las palabras: $error', error: true);
    } finally {
      if (mounted) setState(() => _mostrandoPalabras = false);
    }
  }

  Future<void> _copiarPalabras() async {
    if (_palabras.isEmpty) return;
    await Clipboard.setData(ClipboardData(text: _palabras.join(' ')));
    _avisar('Palabras copiadas al portapapeles.');
  }

  Future<void> _cerrarSesion() async {
    await context.read<AuthProvider>().cerrarSesion();
    if (!mounted) return;
    Navigator.pushNamedAndRemoveUntil(context, '/login', (ruta) => false);
  }

  @override
  Widget build(BuildContext context) {
    final perfil = _perfil;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Usuario'),
        actions: [
          IconButton(
            tooltip: 'Actualizar',
            icon: const Icon(Icons.refresh),
            onPressed: _cargando ? null : _cargar,
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          _cabecera(perfil),
          if (!_hayRed)
            Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              color: Colors.amber.shade100,
              child: const Row(
                children: [
                  Icon(Icons.cloud_off, size: 17),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Sin conexión: se muestra el contenido local del dispositivo.',
                      style: TextStyle(fontSize: 12),
                    ),
                  ),
                ],
              ),
            ),
          _seccion(
            titulo: 'Datos personales',
            icono: Icons.badge_outlined,
            clave: 'personales',
            hijos: [
              _dato('Nombre', perfil?.nombre ?? '—'),
              _dato('Apellido', perfil?.apellido ?? '—'),
              _dato('P00', perfil?.p00 ?? '—'),
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: TextField(
                  controller: _correoController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    labelText: 'Correo electrónico',
                    border: OutlineInputBorder(),
                    isDense: true,
                  ),
                ),
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  icon: const Icon(Icons.save_outlined),
                  label: Text(_guardandoCorreo ? 'Guardando…' : 'Guardar correo'),
                  onPressed: _guardandoCorreo ? null : _guardarCorreo,
                ),
              ),
            ],
          ),
          _seccion(
            titulo: 'Datos administrativos',
            icono: Icons.assignment_ind_outlined,
            clave: 'administrativos',
            hijos: [
              _dato('P00', perfil?.p00 ?? '—'),
              _dato('Rol', perfil?.rol ?? '—'),
              _dato('Cuadrilla', _cuadrilla?.etiqueta ?? 'Sin cuadrilla activa'),
              if (_cuadrilla?.desde != null) _dato('En la cuadrilla desde', '${_cuadrilla!.desde}'),
              _dato('Central', perfil?.idCentral == null ? '—' : '${perfil!.idCentral}'),
              _dato('Dispositivo', _dispositivo ?? '—'),
              _dato('Versión de la app', AppConstants.version),
            ],
          ),
          _seccion(
            titulo: 'Cambiar la contraseña',
            icono: Icons.lock_reset,
            clave: 'clave',
            hijos: [
              TextField(
                controller: _claveActualController,
                obscureText: !_claveVisible,
                decoration: InputDecoration(
                  labelText: 'Contraseña actual',
                  border: const OutlineInputBorder(),
                  isDense: true,
                  suffixIcon: IconButton(
                    tooltip: _claveVisible ? 'Ocultar' : 'Mostrar',
                    icon: Icon(_claveVisible ? Icons.visibility_off : Icons.visibility),
                    onPressed: () => setState(() => _claveVisible = !_claveVisible),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _claveNuevaController,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: 'Nueva contraseña (mínimo 8 caracteres)',
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _confirmacionController,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: 'Repita la nueva contraseña',
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  icon: const Icon(Icons.password),
                  label: Text(_cambiandoClave ? 'Cambiando…' : 'Cambiar contraseña'),
                  onPressed: _cambiandoClave ? null : _cambiarClave,
                ),
              ),
            ],
          ),
          _seccion(
            titulo: 'Palabras de seguridad',
            icono: Icons.key_outlined,
            clave: 'palabras',
            hijos: [
              Text(
                _seguridad == null
                    ? 'Estado no disponible sin conexión.'
                    : '${_seguridad!.cantidad} palabras registradas'
                        '${_seguridad!.version == null ? '' : ' · versión ${_seguridad!.version}'}',
                style: const TextStyle(fontSize: 13, color: Colors.black54),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _clavePalabrasController,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: 'Contraseña actual',
                  helperText: 'Se exige la contraseña para mostrar las palabras.',
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  icon: const Icon(Icons.visibility),
                  label: Text(_mostrandoPalabras ? 'Verificando…' : 'Ver palabras de seguridad'),
                  onPressed: _mostrandoPalabras ? null : _verPalabras,
                ),
              ),
              if (_palabras.isNotEmpty) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.orange.shade50,
                    border: Border.all(color: Colors.orange.shade200),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Text(
                    'Guarde estas 12 palabras en un lugar seguro: las anteriores ya no '
                    'sirven para desbloquear la cuenta.',
                    style: TextStyle(fontSize: 12),
                  ),
                ),
                const SizedBox(height: 8),
                for (var i = 0; i < _palabras.length; i++)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 1),
                    child: Row(
                      children: [
                        SizedBox(
                          width: 28,
                          child: Text(
                            '${i + 1}.',
                            style: const TextStyle(fontSize: 13, color: Colors.black54),
                          ),
                        ),
                        Expanded(
                          child: SelectableText(
                            _palabras[i],
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                  ),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  icon: const Icon(Icons.copy_all),
                  label: const Text('Copiar las 12 palabras'),
                  onPressed: _copiarPalabras,
                ),
              ],
            ],
          ),
          const SizedBox(height: 6),
          SizedBox(
            height: 46,
            child: OutlinedButton.icon(
              icon: const Icon(Icons.logout),
              label: const Text('Cerrar sesión'),
              onPressed: _cerrarSesion,
            ),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  Widget _cabecera(PerfilUsuario? perfil) {
    final inicial = (perfil?.nombreCompleto ?? '?').trim();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            CircleAvatar(
              radius: 26,
              child: Text(
                inicial.isEmpty ? '?' : inicial[0].toUpperCase(),
                style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    perfil?.nombreCompleto ?? 'Usuario',
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  Text(
                    '${perfil?.p00 ?? ''} · ${perfil?.rol ?? ''}',
                    style: const TextStyle(fontSize: 13, color: Colors.black54),
                  ),
                  Text(
                    _cuadrilla?.etiqueta ?? 'Sin cuadrilla activa',
                    style: const TextStyle(fontSize: 12, color: Colors.black54),
                  ),
                ],
              ),
            ),
            if (_cargando)
              const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
          ],
        ),
      ),
    );
  }

  Widget _seccion({
    required String titulo,
    required IconData icono,
    required String clave,
    required List<Widget> hijos,
  }) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ExpansionTile(
        key: PageStorageKey<String>(clave),
        initiallyExpanded: clave == 'personales',
        leading: Icon(icono),
        title: Text(titulo, style: const TextStyle(fontWeight: FontWeight.w600)),
        childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
        expandedCrossAxisAlignment: CrossAxisAlignment.start,
        children: hijos,
      ),
    );
  }

  Widget _dato(String etiqueta, String valor) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 140,
            child: Text(
              etiqueta,
              style: const TextStyle(fontSize: 13, color: Colors.black54),
            ),
          ),
          Expanded(child: Text(valor, style: const TextStyle(fontSize: 14))),
        ],
      ),
    );
  }
}
