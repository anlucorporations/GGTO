import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'core/api_client.dart';
import 'core/auth_storage.dart';
import 'core/theme.dart';
import 'features/alertas/alertas_screen.dart';
import 'features/auth/auth_provider.dart';
import 'features/auth/disclaimer_screen.dart';
import 'features/auth/disclaimer_storage.dart';
import 'features/auth/login_screen.dart';
import 'features/auth/lock_controller.dart';
import 'features/auth/pin_screen.dart';
import 'features/auth/primer_acceso_screen.dart';
import 'features/auth/unlock_screen.dart';
import 'features/casos/casos_provider.dart';
import 'features/casos/casos_screen.dart';
import 'features/inicio/inicio_gestion_screen.dart';
import 'features/gestion/gestion_screen.dart';
import 'features/masivas/masivas_provider.dart';
import 'features/masivas/masivas_screen.dart';
import 'features/mensajes/mensajes_provider.dart';
import 'features/mensajes/mensajes_screen.dart';
import 'features/monitoreo/monitoreo_screen.dart';
import 'features/sync/sync_provider.dart';
import 'features/sync/sync_screen.dart';
import 'features/usuario/usuario_screen.dart';
import 'widgets/bloqueo_inactividad.dart';

/// Clave global de navegación: permite volver al acceso cuando la sesión expira.
final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Registra el interceptor `Authorization: Bearer`, los tiempos de espera y el
  // cierre de sesión ante un 401 (H-01/H-18/H-39).
  ApiClient.init(
    onSesionExpirada: () async {
      // D-100: se descarta el token caducado pero se conserva la identidad de la
      // sesión, para que el técnico pueda seguir entrando sin conexión con su
      // PIN local mientras la credencial esté vigente.
      await AuthStorage.olvidarToken();
      navigatorKey.currentState?.pushNamedAndRemoveUntil(
        '/login',
        (ruta) => false,
        arguments: {'sesion_expirada': true},
      );
    },
  );

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(
            create: (_) => AuthProvider()..restaurarSesion()),
        ChangeNotifierProvider(create: (_) => CasosProvider()),
        // D-99: masivas activas (bloque MASIVA fijo y su caché local).
        ChangeNotifierProvider(create: (_) => MasivasProvider()),
        ChangeNotifierProvider(create: (_) => SyncProvider()..iniciar()),
        ChangeNotifierProvider(create: (_) => MensajesProvider()..iniciar()),
        // D-117: bloqueo de pantalla por inactividad (no cierra la sesión).
        ChangeNotifierProvider(create: (_) => LockController()),
      ],
      child: const GGTOApp(),
    ),
  );
}

class GGTOApp extends StatefulWidget {
  const GGTOApp({super.key});

  @override
  State<GGTOApp> createState() => _GGTOAppState();
}

class _GGTOAppState extends State<GGTOApp> {
  /// `null` mientras se comprueba si el aviso ya fue aceptado.
  bool? _avisoAceptado;

  @override
  void initState() {
    super.initState();
    _comprobarAviso();
  }

  Future<void> _comprobarAviso() async {
    bool aceptado;
    try {
      aceptado = await DisclaimerStorage.aceptado();
    } catch (_) {
      // Si el almacenamiento seguro falla, se exige la aceptación igualmente.
      aceptado = false;
    }
    if (mounted) setState(() => _avisoAceptado = aceptado);
  }

  @override
  Widget build(BuildContext context) {
    // El aviso de uso restringido se exige en **cada inicio de sesión** (D-73)
    // y bloquea el acceso hasta aceptar.
    if (_avisoAceptado == null) {
      return MaterialApp(
        title: 'GGTO Técnico',
        theme: appTheme,
        home: const Scaffold(body: Center(child: CircularProgressIndicator())),
      );
    }

    if (!_avisoAceptado!) {
      return MaterialApp(
        title: 'GGTO Técnico',
        theme: appTheme,
        home: DisclaimerScreen(
          onAceptar: () async {
            if (mounted) setState(() => _avisoAceptado = true);
          },
        ),
      );
    }

    return MaterialApp(
      title: 'GGTO Técnico',
      theme: appTheme,
      navigatorKey: navigatorKey,
      initialRoute: '/login',
      // D-117: la capa de bloqueo cubre todas las rutas sin cerrar la sesión.
      builder: (context, child) =>
          BloqueoInactividad(child: child ?? const SizedBox.shrink()),
      routes: {
        '/login': (context) => const LoginScreen(),
        // D-100: acceso sin conexión con PIN local (solo rol TÉCNICO).
        '/pin': (context) {
          final argumentos = ModalRoute.of(context)?.settings.arguments;
          final p00 = argumentos is Map && argumentos['p00'] is String
              ? argumentos['p00'] as String
              : null;
          final cambiar = argumentos is Map && argumentos['cambiar'] == true;
          return PinScreen(p00: p00, cambiar: cambiar);
        },
        '/inicio': (context) => const _RutaInicio(),
        '/unlock': (context) => const UnlockScreen(),
        '/primer-acceso': (context) => const PrimerAccesoScreen(),
        '/casos': (context) => const _RutaProtegida(child: CasosScreen()),
        '/gestion': (context) => const _RutaProtegida(
              roles: {'SUPER', 'ADMIN', 'SUPERVISOR'},
              child: GestionScreen(),
            ),
        '/casos-gestion': (context) => const _RutaProtegida(
              roles: {'SUPER', 'ADMIN', 'SUPERVISOR'},
              child: GestionScreen(soloGestion: false),
            ),
        '/monitoreo': (context) => const _RutaProtegida(
              roles: {'SUPER', 'ADMIN', 'SUPERVISOR', 'COORDINADOR'},
              child: MonitoreoScreen(),
            ),
        '/sync': (context) => const _RutaProtegida(child: SyncScreen()),
        // D-99: bloque MASIVA (todos los roles la consultan; el rol decide qué
        // fichas de gestión —Planificar, Materiales, Cerrar— se muestran).
        '/masivas': (context) => const _RutaProtegida(child: MasivasScreen()),
        '/alertas': (context) => const _RutaProtegida(child: AlertasScreen()),
        '/mensajes': (context) => const _RutaProtegida(child: MensajesScreen()),
        '/usuario': (context) => const _RutaProtegida(child: UsuarioScreen()),
      },
    );
  }
}

/// Conserva la entrada del Técnico y lleva los roles de gestión a MONITOREO.
class _RutaInicio extends StatelessWidget {
  const _RutaInicio();

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    if (!auth.autenticado) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.mounted) {
          Navigator.pushNamedAndRemoveUntil(context, '/login', (ruta) => false);
        }
      });
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    return auth.rol == 'TECNICO'
        ? const CasosScreen()
        : InicioGestionScreen(rol: auth.rol);
  }
}

/// Bloquea el acceso a las pantallas de campo sin sesión activa.
class _RutaProtegida extends StatelessWidget {
  const _RutaProtegida({required this.child, this.roles});

  final Widget child;
  final Set<String>? roles;

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    if (!auth.autenticado) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.mounted) {
          Navigator.pushNamedAndRemoveUntil(context, '/login', (ruta) => false);
        }
      });
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (roles != null && !roles!.contains(auth.rol)) {
      return const Scaffold(
        body: Center(child: Text('Su rol no tiene acceso a esta pantalla.')),
      );
    }
    return child;
  }
}
