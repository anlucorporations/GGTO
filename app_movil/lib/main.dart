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
import 'features/auth/primer_acceso_screen.dart';
import 'features/auth/unlock_screen.dart';
import 'features/casos/casos_provider.dart';
import 'features/casos/casos_screen.dart';
import 'features/sync/sync_provider.dart';
import 'features/sync/sync_screen.dart';

/// Clave global de navegación: permite volver al acceso cuando la sesión expira.
final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Registra el interceptor `Authorization: Bearer`, los tiempos de espera y el
  // cierre de sesión ante un 401 (H-01/H-18/H-39).
  ApiClient.init(
    onSesionExpirada: () async {
      await AuthStorage.limpiarSesion();
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
        ChangeNotifierProvider(create: (_) => AuthProvider()..restaurarSesion()),
        ChangeNotifierProvider(create: (_) => CasosProvider()),
        ChangeNotifierProvider(create: (_) => SyncProvider()..iniciar()),
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
      routes: {
        '/login': (context) => const LoginScreen(),
        '/unlock': (context) => const UnlockScreen(),
        '/primer-acceso': (context) => const PrimerAccesoScreen(),
        '/casos': (context) => const _RutaProtegida(child: CasosScreen()),
        '/sync': (context) => const _RutaProtegida(child: SyncScreen()),
        '/alertas': (context) => const _RutaProtegida(child: AlertasScreen()),
      },
    );
  }
}

/// Bloquea el acceso a las pantallas de campo sin sesión activa.
class _RutaProtegida extends StatelessWidget {
  const _RutaProtegida({required this.child});

  final Widget child;

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
    return child;
  }
}
