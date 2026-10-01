import os

base_dir = r"c:\GGTO\GGTOv2-DSH-GCCP\app_movil"

files = {
    "pubspec.yaml": """name: ggto_tecnico
description: App Móvil para Técnicos de Terreno GGTO
publish_to: 'none'
version: 1.0.0+1

environment:
  sdk: '>=3.0.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter
  sqflite: ^2.3.0
  path_provider: ^2.1.1
  dio: ^5.3.3
  flutter_secure_storage: ^9.0.0
  image_picker: ^1.0.4
  geolocator: ^1.0.1
  archive: ^3.3.2
  provider: ^6.0.5
  intl: ^0.18.1
  connectivity_plus: ^5.0.1

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^2.0.0

flutter:
  uses-material-design: true
""",
    
    "android/app/build.gradle": """plugins {
    id "com.android.application"
    id "kotlin-android"
    id "dev.flutter.flutter-gradle-plugin"
}

android {
    namespace "com.example.ggto_tecnico"
    compileSdk flutter.compileSdkVersion
    ndkVersion flutter.ndkVersion

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_1_8
        targetCompatibility JavaVersion.VERSION_1_8
    }

    kotlinOptions {
        jvmTarget = '1.8'
    }

    sourceSets {
        main.java.srcDirs += 'src/main/kotlin'
    }

    defaultConfig {
        applicationId "com.example.ggto_tecnico"
        minSdk 21
        targetSdk 34
        versionCode flutterVersionCode.toInteger()
        versionName flutterVersionName
    }

    buildTypes {
        release {
            signingConfig signingConfigs.debug
        }
    }
}

flutter {
    source '../..'
}
""",
    
    "android/app/src/main/AndroidManifest.xml": """<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />

    <application
        android:label="ggto_tecnico"
        android:name="${applicationName}"
        android:icon="@mipmap/ic_launcher">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTop"
            android:theme="@style/LaunchTheme"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|smallestScreenSize|locale|layoutDirection|fontScale|screenLayout|density|uiMode"
            android:hardwareAccelerated="true"
            android:windowSoftInputMode="adjustResize">
            <meta-data
              android:name="io.flutter.embedding.android.NormalTheme"
              android:resource="@style/NormalTheme"
              />
            <intent-filter>
                <action android:name="android.intent.action.MAIN"/>
                <category android:name="android.intent.category.LAUNCHER"/>
            </intent-filter>
        </activity>
        <meta-data
            android:name="flutterEmbedding"
            android:value="2" />
    </application>
</manifest>
""",

    "lib/main.dart": """import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/theme.dart';
import 'features/auth/auth_provider.dart';
import 'features/auth/login_screen.dart';
import 'features/auth/unlock_screen.dart';
import 'features/casos/casos_provider.dart';
import 'features/casos/casos_screen.dart';
import 'features/sync/sync_provider.dart';
import 'features/sync/sync_screen.dart';
import 'features/alertas/alertas_screen.dart';
import 'core/database.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await DatabaseHelper.instance.database;
  
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => CasosProvider()),
        ChangeNotifierProvider(create: (_) => SyncProvider()),
      ],
      child: const GGTOApp(),
    ),
  );
}

class GGTOApp extends StatelessWidget {
  const GGTOApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'GGTO Técnico',
      theme: appTheme,
      initialRoute: '/login',
      routes: {
        '/login': (context) => const LoginScreen(),
        '/unlock': (context) => const UnlockScreen(),
        '/casos': (context) => const CasosScreen(),
        '/sync': (context) => const SyncScreen(),
        '/alertas': (context) => const AlertasScreen(),
      },
    );
  }
}
""",

    "lib/core/theme.dart": """import 'package:flutter/material.dart';

final ThemeData appTheme = ThemeData(
  primaryColor: const Color(0xFF1565C0),
  scaffoldBackgroundColor: const Color(0xFFF5F5F5),
  colorScheme: ColorScheme.fromSwatch().copyWith(
    primary: const Color(0xFF1565C0),
    secondary: const Color(0xFF1565C0),
    error: const Color(0xFFD32F2F),
  ),
  appBarTheme: const AppBarTheme(
    color: Color(0xFF1565C0),
    iconTheme: IconThemeData(color: Colors.white),
    titleTextStyle: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
  ),
  buttonTheme: const ButtonThemeData(
    buttonColor: Color(0xFF1565C0),
    textTheme: ButtonTextTheme.primary,
  ),
  elevatedButtonTheme: ElevatedButtonThemeData(
    style: ElevatedButton.styleFrom(
      backgroundColor: const Color(0xFF1565C0),
      foregroundColor: Colors.white,
    ),
  ),
);
""",

    "lib/core/constants.dart": """class AppConstants {
  static const String baseUrl = 'https://ggto-web-593453426217.europe-west1.run.app/api/v1';
}
""",

    "lib/core/database.dart": """import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';

class DatabaseHelper {
  static final DatabaseHelper instance = DatabaseHelper._init();
  static Database? _database;

  DatabaseHelper._init();

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDB('ggto.db');
    return _database!;
  }

  Future<Database> _initDB(String filePath) async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, filePath);

    return await openDatabase(path, version: 1, onCreate: _createDB);
  }

  Future _createDB(Database db, int version) async {
    await db.execute('''
      CREATE TABLE caso_local (
        id TEXT PRIMARY KEY,
        datos_json TEXT
      )
    ''');
    await db.execute('''
      CREATE TABLE accion_pendiente (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo TEXT,
        endpoint TEXT,
        metodo TEXT,
        payload TEXT,
        fecha TEXT
      )
    ''');
    await db.execute('''
      CREATE TABLE evidencia_local (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_caso TEXT,
        ruta_archivo TEXT,
        latitud REAL,
        longitud REAL,
        timestamp TEXT
      )
    ''');
  }
}
""",

    "lib/core/api_client.dart": """import 'package:dio/dio.dart';
import 'constants.dart';
import 'auth_storage.dart';

class ApiClient {
  static final Dio _dio = Dio(BaseOptions(baseUrl: AppConstants.baseUrl));

  static void init() {
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await AuthStorage.getToken();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        return handler.next(options);
      },
    ));
  }

  static Dio get dio => _dio;
}
""",

    "lib/core/auth_storage.dart": """import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AuthStorage {
  static const _storage = FlutterSecureStorage();

  static Future<void> saveToken(String token) async {
    await _storage.write(key: 'jwt_token', value: token);
  }

  static Future<String?> getToken() async {
    return await _storage.read(key: 'jwt_token');
  }

  static Future<void> deleteToken() async {
    await _storage.delete(key: 'jwt_token');
  }
}
""",

    "lib/features/auth/auth_provider.dart": """import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/auth_storage.dart';

class AuthProvider extends ChangeNotifier {
  String? _p00;
  String? _nombre;
  int _intentosFallidos = 0;
  bool _bloqueado = false;

  String? get p00 => _p00;
  String? get nombre => _nombre;
  int get intentosFallidos => _intentosFallidos;
  bool get bloqueado => _bloqueado;

  Future<bool> login(String p00, String clave) async {
    if (_bloqueado) return false;
    try {
      final response = await ApiClient.dio.post('/auth/login', data: {
        'p00': p00,
        'clave': clave,
      });
      final token = response.data['access_token'];
      await AuthStorage.saveToken(token);
      _p00 = p00;
      _intentosFallidos = 0;
      await fetchMe();
      notifyListeners();
      return true;
    } catch (e) {
      _intentosFallidos++;
      if (_intentosFallidos >= 3) {
        _bloqueado = true;
      }
      notifyListeners();
      return false;
    }
  }

  Future<bool> unlock(String p00, List<Map<String, dynamic>> palabras) async {
    try {
      final response = await ApiClient.dio.post('/auth/unlock', data: {
        'p00': p00,
        'palabras': palabras,
      });
      final token = response.data['access_token'];
      await AuthStorage.saveToken(token);
      _p00 = p00;
      _intentosFallidos = 0;
      _bloqueado = false;
      await fetchMe();
      notifyListeners();
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<void> fetchMe() async {
    try {
      final response = await ApiClient.dio.get('/auth/me');
      _nombre = response.data['nombre'] + ' ' + response.data['apellido'];
      notifyListeners();
    } catch (e) {
      // Handle error
    }
  }

  void logout() async {
    await AuthStorage.deleteToken();
    _p00 = null;
    _nombre = null;
    notifyListeners();
  }
}
""",

    "lib/features/auth/login_screen.dart": """import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'auth_provider.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({Key? key}) : super(key: key);

  @override
  _LoginScreenState createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _p00Controller = TextEditingController();
  final _claveController = TextEditingController();

  void _login() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final success = await auth.login(_p00Controller.text, _claveController.text);
    if (success) {
      Navigator.pushReplacementNamed(context, '/casos');
    } else {
      if (auth.bloqueado) {
        Navigator.pushReplacementNamed(context, '/unlock');
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error en login. Intentos: \${auth.intentosFallidos}/3')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    return Scaffold(
      appBar: AppBar(title: const Text('GGTO Técnico - Login')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            TextField(
              controller: _p00Controller,
              decoration: const InputDecoration(labelText: 'P00 (Numérico)'),
              keyboardType: TextInputType.number,
            ),
            TextField(
              controller: _claveController,
              decoration: const InputDecoration(labelText: 'Clave'),
              obscureText: true,
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _login,
              child: const Text('Ingresar'),
            ),
            if (auth.intentosFallidos >= 3)
              TextButton(
                onPressed: () => Navigator.pushReplacementNamed(context, '/unlock'),
                child: const Text('Desbloquear con palabras'),
              )
          ],
        ),
      ),
    );
  }
}
""",

    "lib/features/auth/unlock_screen.dart": """import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'auth_provider.dart';

class UnlockScreen extends StatefulWidget {
  const UnlockScreen({Key? key}) : super(key: key);

  @override
  _UnlockScreenState createState() => _UnlockScreenState();
}

class _UnlockScreenState extends State<UnlockScreen> {
  final _p00Controller = TextEditingController();
  List<int> posiciones = [1, 2, 3];
  List<TextEditingController> controllers = [TextEditingController(), TextEditingController(), TextEditingController()];

  void _unlock() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final palabras = [
      {'pos': posiciones[0], 'valor': controllers[0].text},
      {'pos': posiciones[1], 'valor': controllers[1].text},
      {'pos': posiciones[2], 'valor': controllers[2].text},
    ];
    final success = await auth.unlock(_p00Controller.text, palabras);
    if (success) {
      Navigator.pushReplacementNamed(context, '/casos');
    } else {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Error al desbloquear')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Desbloquear Cuenta')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            TextField(
              controller: _p00Controller,
              decoration: const InputDecoration(labelText: 'P00 (Numérico)'),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 10),
            ...List.generate(3, (index) => Row(
              children: [
                DropdownButton<int>(
                  value: posiciones[index],
                  items: List.generate(12, (i) => DropdownMenuItem(value: i + 1, child: Text('Pos \${i + 1}'))),
                  onChanged: (val) {
                    setState(() => posiciones[index] = val!);
                  },
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    controller: controllers[index],
                    decoration: InputDecoration(labelText: 'Palabra \${index + 1}'),
                  ),
                ),
              ],
            )),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _unlock,
              child: const Text('Desbloquear'),
            ),
          ],
        ),
      ),
    );
  }
}
""",

    "lib/features/casos/casos_provider.dart": """import 'package:flutter/material.dart';
import '../../core/api_client.dart';

class CasosProvider extends ChangeNotifier {
  List<dynamic> _casos = [];
  bool _isLoading = false;

  List<dynamic> get casos => _casos;
  bool get isLoading => _isLoading;

  Future<void> fetchCasos() async {
    _isLoading = true;
    notifyListeners();
    try {
      final response = await ApiClient.dio.get('/casos?estado_actual=ASIGNADO&page=1&page_size=50');
      _casos = response.data['casos'] ?? [];
      // Aquí se debería guardar en SQLite para offline
    } catch (e) {
      // Manejar offline desde SQLite
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
""",

    "lib/features/casos/casos_screen.dart": """import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'casos_provider.dart';
import '../auth/auth_provider.dart';
import '../../widgets/offline_banner.dart';
import '../../widgets/caso_card.dart';
import 'caso_detalle_screen.dart';

class CasosScreen extends StatefulWidget {
  const CasosScreen({Key? key}) : super(key: key);

  @override
  _CasosScreenState createState() => _CasosScreenState();
}

class _CasosScreenState extends State<CasosScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<CasosProvider>(context, listen: false).fetchCasos();
    });
  }

  @override
  Widget build(BuildContext context) {
    final casosProv = Provider.of<CasosProvider>(context);
    final auth = Provider.of<AuthProvider>(context);
    return Scaffold(
      appBar: AppBar(
        title: Text('GGTO Técnico - \${auth.nombre ?? ''}'),
        actions: [
          IconButton(
            icon: const Icon(Icons.sync),
            onPressed: () => Navigator.pushNamed(context, '/sync'),
          ),
          IconButton(
            icon: const Icon(Icons.warning),
            onPressed: () => Navigator.pushNamed(context, '/alertas'),
          ),
          IconButton(
            icon: const Icon(Icons.lock),
            onPressed: () {
              auth.logout();
              Navigator.pushReplacementNamed(context, '/login');
            },
          ),
        ],
      ),
      body: Column(
        children: [
          const OfflineBanner(),
          Expanded(
            child: casosProv.isLoading
              ? const Center(child: CircularProgressIndicator())
              : ListView.builder(
                  itemCount: casosProv.casos.length,
                  itemBuilder: (context, index) {
                    final caso = casosProv.casos[index];
                    return CasoCard(
                      caso: caso,
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => CasoDetalleScreen(caso: caso),
                          ),
                        );
                      },
                    );
                  },
                ),
          ),
        ],
      ),
    );
  }
}
""",

    "lib/features/casos/caso_detalle_screen.dart": """import 'package:flutter/material.dart';
import 'contactar_screen.dart';
import 'atender_screen.dart';

class CasoDetalleScreen extends StatelessWidget {
  final Map<String, dynamic> caso;
  
  const CasoDetalleScreen({Key? key, required this.caso}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Caso \${caso['id_averia']}')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Cliente: \${caso['cliente'] ?? 'N/A'}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            Text('Teléfono: \${caso['telefono'] ?? 'N/A'}'),
            Text('Dirección: \${caso['direccion'] ?? 'N/A'}'),
            Text('Sector: \${caso['sector'] ?? 'N/A'}'),
            Text('Estado: \${caso['estado_actual'] ?? 'N/A'}'),
            Text('Tipo: \${caso['tipo_caso'] ?? 'N/A'}'),
            const SizedBox(height: 30),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                ElevatedButton(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => ContactarScreen(casoId: caso['id'].toString())),
                    );
                  },
                  child: const Text('Contactar / Cita'),
                ),
                ElevatedButton(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => AtenderScreen(casoId: caso['id'].toString())),
                    );
                  },
                  child: const Text('Atender'),
                ),
              ],
            )
          ],
        ),
      ),
    );
  }
}
""",

    "lib/features/casos/contactar_screen.dart": """import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/database.dart';
import 'dart:convert';

class ContactarScreen extends StatefulWidget {
  final String casoId;
  const ContactarScreen({Key? key, required this.casoId}) : super(key: key);

  @override
  _ContactarScreenState createState() => _ContactarScreenState();
}

class _ContactarScreenState extends State<ContactarScreen> {
  DateTime? _selectedDate;

  void _marcarContactado() async {
    try {
      await ApiClient.dio.patch('/casos/\${widget.casoId}', data: {'estado_actual': 'CONTACTADO'});
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Marcado como contactado')));
      Navigator.pop(context);
    } catch (e) {
      // Guardar offline
      final db = await DatabaseHelper.instance.database;
      await db.insert('accion_pendiente', {
        'tipo': 'UPDATE_CASO',
        'endpoint': '/casos/\${widget.casoId}',
        'metodo': 'PATCH',
        'payload': jsonEncode({'estado_actual': 'CONTACTADO'}),
        'fecha': DateTime.now().toIso8601String()
      });
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Guardado offline')));
      Navigator.pop(context);
    }
  }

  void _agendarCita() async {
    if (_selectedDate == null) return;
    try {
      await ApiClient.dio.post('/citas', data: {'id_caso': widget.casoId, 'fecha': _selectedDate!.toIso8601String()});
      await ApiClient.dio.patch('/casos/\${widget.casoId}', data: {'estado_actual': 'CITADO'});
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Cita agendada')));
      Navigator.pop(context);
    } catch (e) {
      // Guardar offline
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Error o guardado offline')));
      Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Contactar Cliente')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            ElevatedButton(
              onPressed: _marcarContactado,
              child: const Text('Marcar como CONTACTADO'),
            ),
            const Divider(),
            const Text('Agendar Cita:'),
            ElevatedButton(
              onPressed: () async {
                final date = await showDatePicker(
                  context: context,
                  initialDate: DateTime.now(),
                  firstDate: DateTime.now(),
                  lastDate: DateTime.now().add(const Duration(days: 30)),
                );
                if (date != null) {
                  setState(() => _selectedDate = date);
                }
              },
              child: Text(_selectedDate == null ? 'Seleccionar Fecha' : _selectedDate!.toIso8601String().split('T').first),
            ),
            ElevatedButton(
              onPressed: _agendarCita,
              child: const Text('Agendar y CITAR'),
            )
          ],
        ),
      ),
    );
  }
}
""",

    "lib/features/casos/atender_screen.dart": """import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/api_client.dart';
import '../evidencias/camara_screen.dart';

class AtenderScreen extends StatefulWidget {
  final String casoId;
  const AtenderScreen({Key? key, required this.casoId}) : super(key: key);

  @override
  _AtenderScreenState createState() => _AtenderScreenState();
}

class _AtenderScreenState extends State<AtenderScreen> {
  String _estado = 'CERRADO';
  final _motivoController = TextEditingController();

  void _guardar() async {
    try {
      await ApiClient.dio.patch('/casos/\${widget.casoId}', data: {
        'estado_actual': _estado,
        'motivo_cierre': _motivoController.text,
      });
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Caso actualizado')));
      Navigator.pop(context);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Error o guardado offline')));
      Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Atender Caso')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            DropdownButton<String>(
              value: _estado,
              items: const [
                DropdownMenuItem(value: 'CERRADO', child: Text('CERRAR')),
                DropdownMenuItem(value: 'ENRUTADO', child: Text('ENRUTAR')),
                DropdownMenuItem(value: 'DIFERIDO', child: Text('DIFERIR')),
              ],
              onChanged: (val) => setState(() => _estado = val!),
            ),
            TextField(
              controller: _motivoController,
              decoration: const InputDecoration(labelText: 'Motivo / Documentación'),
              maxLines: 3,
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => CamaraScreen(casoId: widget.casoId)),
                );
              },
              child: const Text('Agregar Evidencia (Cámara)'),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _guardar,
              child: const Text('Guardar'),
            ),
          ],
        ),
      ),
    );
  }
}
""",

    "lib/features/evidencias/camara_screen.dart": """import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:geolocator/geolocator.dart';
import '../../core/database.dart';
import 'dart:io';

class CamaraScreen extends StatefulWidget {
  final String casoId;
  const CamaraScreen({Key? key, required this.casoId}) : super(key: key);

  @override
  _CamaraScreenState createState() => _CamaraScreenState();
}

class _CamaraScreenState extends State<CamaraScreen> {
  File? _image;

  void _tomarFoto() async {
    final ImagePicker picker = ImagePicker();
    final XFile? photo = await picker.pickImage(source: ImageSource.camera); // RF-14 SOLO CAMARA
    
    if (photo != null) {
      setState(() {
        _image = File(photo.path);
      });
      
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      
      if (permission == LocationPermission.whileInUse || permission == LocationPermission.always) {
        Position position = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
        
        final db = await DatabaseHelper.instance.database;
        await db.insert('evidencia_local', {
          'id_caso': widget.casoId,
          'ruta_archivo': photo.path,
          'latitud': position.latitude,
          'longitud': position.longitude,
          'timestamp': DateTime.now().toIso8601String()
        });
        
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Evidencia guardada')));
        Navigator.pop(context);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Cámara Evidencia')),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (_image != null) Image.file(_image!),
            ElevatedButton(
              onPressed: _tomarFoto,
              child: const Text('Tomar Foto'),
            ),
          ],
        ),
      ),
    );
  }
}
""",

    "lib/features/alertas/alertas_screen.dart": """import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/database.dart';
import 'dart:convert';

class AlertasScreen extends StatefulWidget {
  const AlertasScreen({Key? key}) : super(key: key);

  @override
  _AlertasScreenState createState() => _AlertasScreenState();
}

class _AlertasScreenState extends State<AlertasScreen> {
  final _descController = TextEditingController();
  String _tipoFalla = 'OLT';
  String _tipoIncidente = 'VEHICULO';

  void _reportarFalla() async {
    try {
      await ApiClient.dio.post('/fallas-masivas', data: {
        'descripcion': _descController.text,
        'tipo': _tipoFalla,
      });
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Falla reportada')));
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Error reportando')));
    }
  }

  void _reportarIncidente() async {
    final db = await DatabaseHelper.instance.database;
    await db.insert('accion_pendiente', {
      'tipo': 'INCIDENTE_FLOTA',
      'endpoint': '/incidentes',
      'metodo': 'POST',
      'payload': jsonEncode({'descripcion': _descController.text, 'tipo_incidente': _tipoIncidente}),
      'fecha': DateTime.now().toIso8601String()
    });
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Incidente guardado')));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Alertas e Incidentes')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Falla Masiva', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            DropdownButton<String>(
              value: _tipoFalla,
              items: const [
                DropdownMenuItem(value: 'OLT', child: Text('OLT')),
                DropdownMenuItem(value: 'FAT', child: Text('FAT')),
                DropdownMenuItem(value: 'SECTOR', child: Text('SECTOR')),
              ],
              onChanged: (val) => setState(() => _tipoFalla = val!),
            ),
            TextField(controller: _descController, decoration: const InputDecoration(labelText: 'Descripción')),
            ElevatedButton(onPressed: _reportarFalla, child: const Text('Reportar Falla Masiva')),
            
            const Divider(height: 40),
            
            const Text('Incidente Flota/Herramienta', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            DropdownButton<String>(
              value: _tipoIncidente,
              items: const [
                DropdownMenuItem(value: 'VEHICULO', child: Text('VEHICULO')),
                DropdownMenuItem(value: 'HERRAMIENTA', child: Text('HERRAMIENTA')),
              ],
              onChanged: (val) => setState(() => _tipoIncidente = val!),
            ),
            ElevatedButton(onPressed: _reportarIncidente, child: const Text('Reportar Incidente')),
          ],
        ),
      ),
    );
  }
}
""",

    "lib/features/sync/sync_provider.dart": """import 'package:flutter/material.dart';
import '../../core/database.dart';
import '../../core/api_client.dart';
import 'dart:convert';

class SyncProvider extends ChangeNotifier {
  int _pendientes = 0;
  int get pendientes => _pendientes;

  Future<void> checkPendientes() async {
    final db = await DatabaseHelper.instance.database;
    final res = await db.rawQuery('SELECT COUNT(*) as count FROM accion_pendiente');
    _pendientes = Sqflite.firstIntValue(res) ?? 0;
    notifyListeners();
  }

  Future<void> sincronizar() async {
    final db = await DatabaseHelper.instance.database;
    final acciones = await db.query('accion_pendiente', orderBy: 'id ASC');
    
    for (var accion in acciones) {
      try {
        final endpoint = accion['endpoint'] as String;
        final metodo = accion['metodo'] as String;
        final payload = jsonDecode(accion['payload'] as String);
        
        if (metodo == 'POST') {
          await ApiClient.dio.post(endpoint, data: payload);
        } else if (metodo == 'PATCH') {
          await ApiClient.dio.patch(endpoint, data: payload);
        }
        
        await db.delete('accion_pendiente', where: 'id = ?', whereArgs: [accion['id']]);
      } catch (e) {
        // Falló esta acción, detener sync
        break;
      }
    }
    await checkPendientes();
  }
}
""",

    "lib/features/sync/sync_screen.dart": """import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'sync_provider.dart';

class SyncScreen extends StatefulWidget {
  const SyncScreen({Key? key}) : super(key: key);

  @override
  _SyncScreenState createState() => _SyncScreenState();
}

class _SyncScreenState extends State<SyncScreen> {
  @override
  void initState() {
    super.initState();
    Provider.of<SyncProvider>(context, listen: false).checkPendientes();
  }

  void _exportarZip() {
    // Lógica para exportar el ZIP con package:archive
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Exportando ZIP...')));
  }

  @override
  Widget build(BuildContext context) {
    final syncProv = Provider.of<SyncProvider>(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Sincronización')),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text('Acciones pendientes: \${syncProv.pendientes}', style: const TextStyle(fontSize: 24)),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: syncProv.sincronizar,
              child: const Text('SINCRONIZAR'),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _exportarZip,
              child: const Text('EXPORTAR JORNADA (ZIP)'),
            )
          ],
        ),
      ),
    );
  }
}
""",

    "lib/widgets/caso_card.dart": """import 'package:flutter/material.dart';
import 'estado_chip.dart';

class CasoCard extends StatelessWidget {
  final Map<String, dynamic> caso;
  final VoidCallback onTap;

  const CasoCard({Key? key, required this.caso, required this.onTap}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: ListTile(
        title: Text('Caso \${caso['id_averia'] ?? ''} - \${caso['cliente'] ?? ''}'),
        subtitle: Text('\${caso['sector'] ?? ''}\\nTipo: \${caso['tipo_caso'] ?? ''}'),
        trailing: EstadoChip(estado: caso['estado_actual'] ?? 'DESCONOCIDO'),
        isThreeLine: true,
        onTap: onTap,
      ),
    );
  }
}
""",

    "lib/widgets/estado_chip.dart": """import 'package:flutter/material.dart';

class EstadoChip extends StatelessWidget {
  final String estado;
  const EstadoChip({Key? key, required this.estado}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    Color color;
    switch (estado) {
      case 'ASIGNADO': color = Colors.blue; break;
      case 'CONTACTADO': color = Colors.orange; break;
      case 'CITADO': color = Colors.purple; break;
      case 'CERRADO': color = Colors.green; break;
      default: color = Colors.grey;
    }
    return Chip(
      label: Text(estado, style: const TextStyle(color: Colors.white, fontSize: 12)),
      backgroundColor: color,
    );
  }
}
""",

    "lib/widgets/offline_banner.dart": """import 'package:flutter/material.dart';
import 'package:connectivity_plus/connectivity_plus.dart';

class OfflineBanner extends StatelessWidget {
  const OfflineBanner({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<ConnectivityResult>(
      stream: Connectivity().onConnectivityChanged,
      builder: (context, snapshot) {
        if (snapshot.hasData && snapshot.data == ConnectivityResult.none) {
          return Container(
            color: Colors.red,
            width: double.infinity,
            padding: const EdgeInsets.all(8),
            child: const Text(
              'Sin conexión - Modo Offline',
              style: TextStyle(color: Colors.white),
              textAlign: TextAlign.center,
            ),
          );
        }
        return const SizedBox.shrink();
      },
    );
  }
}
"""
}

for rel_path, content in files.items():
    abs_path = os.path.join(base_dir, rel_path)
    os.makedirs(os.path.dirname(abs_path), exist_ok=True)
    with open(abs_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Created: {abs_path}")

print("All files created successfully.")
