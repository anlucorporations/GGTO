import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/constants.dart';
import '../../core/credencial_local.dart';
import 'auth_provider.dart';
import 'credencial_service.dart';

/// Acceso **sin conexión** con el PIN local (D-100 · RF-73…RF-75).
///
/// Solo el rol TÉCNICO tiene credencial en el dispositivo. La pantalla cubre los
/// tres momentos del flujo:
///
/// 1. **Pedir el PIN** de la credencial emitida en el último acceso con red.
/// 2. **Cambiar el PIN** cuando todavía es el de fábrica
///    ([AppConstants.pinPorDefecto]): el cambio es obligatorio antes de entrar.
/// 3. **Olvidar el PIN**, que descarta la credencial y devuelve al acceso con
///    conexión.
///
/// Nada de esto habla con el servidor: se apoya en el documento de credencial y
/// en la sesión guardada.
class PinScreen extends StatefulWidget {
  const PinScreen({super.key, this.p00, this.cambiar = false});

  /// P00 precargado (viene del acceso o del cambio de PIN de la sección Usuario).
  final String? p00;

  /// `true` cuando se llega desde «Cambiar PIN» de la sección Usuario: tras
  /// validar el PIN actual se pasa al formulario de cambio y, al guardar, se
  /// vuelve a la pantalla anterior **sin** abrir sesión.
  final bool cambiar;

  @override
  State<PinScreen> createState() => _PinScreenState();
}

/// Fase del flujo del PIN.
enum _Fase { pedir, cambiar }

class _PinScreenState extends State<PinScreen> {
  final _p00Controller = TextEditingController();
  final _pinController = TextEditingController();
  final _nuevoController = TextEditingController();
  final _confirmarController = TextEditingController();

  _Fase _fase = _Fase.pedir;
  CredencialLocal? _ficha;
  String? _error;
  String? _aviso;
  bool _enviando = false;

  @override
  void initState() {
    super.initState();
    _p00Controller.text = widget.p00 ?? '';
    WidgetsBinding.instance.addPostFrameCallback((_) => _cargarFicha());
  }

  @override
  void dispose() {
    _p00Controller.dispose();
    _pinController.dispose();
    _nuevoController.dispose();
    _confirmarController.dispose();
    super.dispose();
  }

  Future<void> _cargarFicha() async {
    final p00 = _p00Controller.text.trim();
    if (p00.isEmpty) return;
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final ficha = await auth.credencialDe(p00);
    if (!mounted) return;
    setState(() => _ficha = ficha);
  }

  Future<void> _validarPin() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final p00 = _p00Controller.text.trim();
    setState(() {
      _error = null;
      _aviso = null;
    });

    if (p00.isEmpty) {
      setState(() => _error = 'Indique su P00.');
      return;
    }
    final formato = validarFormatoPin(_pinController.text);
    if (formato != null) {
      setState(() => _error = formato);
      return;
    }

    setState(() => _enviando = true);
    final resultado = await auth.verificarPinLocal(p00, _pinController.text);
    if (!mounted) return;
    setState(() {
      _enviando = false;
      if (resultado.exigeCambio) {
        _fase = _Fase.cambiar;
        _aviso = resultado.mensaje;
      } else if (resultado.concedido && widget.cambiar) {
        // Cambio voluntario desde la sección Usuario: no se abre sesión.
        _fase = _Fase.cambiar;
        _aviso = 'PIN verificado. Defina el nuevo.';
      } else if (!resultado.concedido) {
        _error = resultado.mensaje;
      }
    });
    if (resultado.concedido && !widget.cambiar) await _entrar(p00);
  }

  Future<void> _guardarPin() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final p00 = _p00Controller.text.trim();
    setState(() {
      _error = null;
      _aviso = null;
    });

    final problema = validarPinNuevo(
      nuevo: _nuevoController.text,
      confirmacion: _confirmarController.text,
      actual: _pinController.text,
    );
    if (problema != null) {
      setState(() => _error = problema);
      return;
    }

    setState(() => _enviando = true);
    final fallo = await auth.cambiarPinLocal(p00, _nuevoController.text);
    if (!mounted) return;
    setState(() => _enviando = false);
    if (fallo != null) {
      setState(() => _error = fallo);
      return;
    }
    if (widget.cambiar) {
      Navigator.pop(context, true);
      return;
    }
    await _entrar(p00);
  }

  Future<void> _entrar(String p00) async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final resultado = await auth.entrarSinConexion(p00);
    if (!mounted) return;
    if (!resultado.concedido) {
      setState(() {
        _fase = _Fase.pedir;
        _error = resultado.mensaje;
      });
      return;
    }
    Navigator.pushNamedAndRemoveUntil(context, '/inicio', (ruta) => false);
  }

  Future<void> _olvidar() async {
    final confirmado = await showDialog<bool>(
      context: context,
      builder: (contexto) => AlertDialog(
        title: const Text('Olvidé mi PIN'),
        content: const Text(
          'Se descartará el acceso sin conexión de este dispositivo. Para '
          'volver a habilitarlo tendrá que conectarse a internet e iniciar '
          'sesión con su clave.\n\n¿Continuar?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(contexto, false),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(contexto, true),
            child: const Text('Descartar'),
          ),
        ],
      ),
    );
    if (confirmado != true || !mounted) return;
    final auth = Provider.of<AuthProvider>(context, listen: false);
    await auth.olvidarCredencial(_p00Controller.text.trim());
    if (!mounted) return;
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.cambiar ? 'Cambiar PIN sin conexión' : 'Acceso sin conexión'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Este acceso funciona sin internet, con el PIN que configuró en '
                'este dispositivo. La sesión se abre con los datos de su último '
                'acceso con red.',
                style: TextStyle(fontSize: 14),
              ),
              const SizedBox(height: 14),
              if (_ficha != null) _EstadoCredencial(ficha: _ficha!),
              if (_ficha == null && _p00Controller.text.trim().isNotEmpty)
                const Padding(
                  padding: EdgeInsets.only(bottom: 12),
                  child: Text(
                    'No hay acceso sin conexión para ese P00 en este dispositivo.',
                    style: TextStyle(color: Color(0xFFB71C1C), fontSize: 13),
                  ),
                ),
              const SizedBox(height: 8),
              if (_error != null) ...[
                _Aviso(mensaje: _error!, color: const Color(0xFFB71C1C)),
                const SizedBox(height: 12),
              ],
              if (_aviso != null) ...[
                _Aviso(mensaje: _aviso!, color: const Color(0xFF8A5200)),
                const SizedBox(height: 12),
              ],
              TextField(
                controller: _p00Controller,
                autocorrect: false,
                enabled: _fase == _Fase.pedir,
                onChanged: (_) => _cargarFicha(),
                decoration: const InputDecoration(
                  labelText: 'P00',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: _pinController,
                obscureText: true,
                enabled: _fase == _Fase.pedir,
                keyboardType: TextInputType.number,
                maxLength: AppConstants.pinLongitud,
                decoration: const InputDecoration(
                  labelText: 'PIN',
                  border: OutlineInputBorder(),
                  counterText: '',
                ),
                onSubmitted: (_) => _fase == _Fase.pedir ? _validarPin() : null,
              ),
              if (_fase == _Fase.cambiar) ...[
                const SizedBox(height: 6),
                const Text(
                  'Defina su PIN nuevo: no puede ser el de fábrica ni un dígito '
                  'repetido.',
                  style: TextStyle(fontSize: 13, color: Color(0xFF8A5200)),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _nuevoController,
                  obscureText: true,
                  keyboardType: TextInputType.number,
                  maxLength: AppConstants.pinLongitud,
                  decoration: const InputDecoration(
                    labelText: 'PIN nuevo',
                    border: OutlineInputBorder(),
                    counterText: '',
                  ),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: _confirmarController,
                  obscureText: true,
                  keyboardType: TextInputType.number,
                  maxLength: AppConstants.pinLongitud,
                  decoration: const InputDecoration(
                    labelText: 'Repita el PIN nuevo',
                    border: OutlineInputBorder(),
                    counterText: '',
                  ),
                  onSubmitted: (_) => _guardarPin(),
                ),
              ],
              const SizedBox(height: 20),
              SizedBox(
                height: 48,
                child: ElevatedButton(
                  onPressed: _enviando
                      ? null
                      : (_fase == _Fase.pedir ? _validarPin : _guardarPin),
                  child: Text(
                    _enviando
                        ? 'Comprobando…'
                        : (_fase == _Fase.pedir ? 'Entrar sin conexión' : 'Guardar PIN y entrar'),
                  ),
                ),
              ),
              const SizedBox(height: 10),
              TextButton(
                onPressed: _enviando ? null : _olvidar,
                child: const Text('Olvidé mi PIN'),
              ),
              const SizedBox(height: 4),
              const Text(
                'Si el PIN caducó (24 h sin conexión) o se agotaron los intentos, '
                'conéctese a internet e inicie sesión para volver a habilitarlo.',
                style: TextStyle(fontSize: 12, color: Colors.black54),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Ficha visible del documento de credencial.
class _EstadoCredencial extends StatelessWidget {
  const _EstadoCredencial({required this.ficha});

  final CredencialLocal ficha;

  @override
  Widget build(BuildContext context) {
    final ahora = DateTime.now().toUtc();
    final restante = CredencialService.vigencia - ahora.difference(ficha.ultimoAccesoConRed);
    final vigente = restante > Duration.zero;
    final horas = restante.inHours;
    final minutos = restante.inMinutes.remainder(60);
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF4F8FD),
        border: Border.all(color: const Color(0xFFBBD3EE)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${ficha.nombre} ${ficha.apellido}'.trim().isEmpty
                ? ficha.p00
                : '${ficha.nombre} ${ficha.apellido}'.trim(),
            style: const TextStyle(fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 2),
          Text('P00 ${ficha.p00} · ${ficha.rol}', style: const TextStyle(fontSize: 12)),
          const SizedBox(height: 2),
          Text(
            vigente
                ? 'Credencial vigente: ${horas}h ${minutos}m antes de exigir conexión'
                : 'Credencial caducada: conéctese a internet para renovarla',
            style: TextStyle(
              fontSize: 12,
              color: vigente ? const Color(0xFF1F7A4D) : const Color(0xFFB71C1C),
              fontWeight: FontWeight.w600,
            ),
          ),
          if (ficha.pinPorDefecto) ...[
            const SizedBox(height: 2),
            const Text(
              'PIN de fábrica: deberá cambiarlo para entrar.',
              style: TextStyle(fontSize: 12, color: Color(0xFF8A5200)),
            ),
          ],
        ],
      ),
    );
  }
}

/// Aviso reutilizable de la pantalla del PIN.
class _Aviso extends StatelessWidget {
  const _Aviso({required this.mensaje, required this.color});

  final String mensaje;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        // `withOpacity` (no `withValues`): el SDK de compilación es Flutter 3.24.5.
        color: color.withOpacity(0.08),
        border: Border.all(color: color.withOpacity(0.45)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(mensaje, style: TextStyle(color: color, fontSize: 14)),
    );
  }
}
