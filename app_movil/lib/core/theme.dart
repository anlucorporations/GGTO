import 'package:flutter/material.dart';

/// Tokens de marca GGTO · CANTV.
///
/// Provienen del sistema de diseño de la propuesta para la APK
/// (`docs/propuesta-visual-apk/propuesta-apk-UIUX.md`) y son los mismos que ya
/// usa la web. Los pares tinta/fondo de los estados cumplen el 4,5:1 que exige
/// **RNF-APK-05** (verificado con `scripts/contraste_apk.py`).
abstract final class Marca {
  // --- Marca (medida sobre la imagen de referencia «autogestión») ----- //
  static const electrico = Color(0xFF021FBE);
  static const azul = Color(0xFF0B1BB4);
  static const violeta = Color(0xFF3B1CAD);
  static const violeta2 = Color(0xFF7C12AF);
  static const purpura = Color(0xFF9D0BAC);
  static const magenta = Color(0xFFC905A5);
  static const fucsia = Color(0xFFE003A0);
  static const turquesa = Color(0xFF00B8C4);
  static const turquesaClaro = Color(0xFF5CE1E6);
  static const profundo = Color(0xFF050B3D);

  // --- Superficies y texto -------------------------------------------- //
  static const fondo = Color(0xFFF4F7FC);
  static const contenedor = Color(0xFFEEF3FD);
  static const borde = Color(0xFFDCE3F0);
  static const bordeFuerte = Color(0xFFC3CFE4);
  static const texto = Color(0xFF131A2A);
  static const textoSuave = Color(0xFF5A6684);

  // --- Semánticos: la tinta va sobre su fondo claro -------------------- //
  static const exito = Color(0xFF1F7A4D);
  static const exitoClaro = Color(0xFFE6F5EC);
  static const alerta = Color(0xFF8A6100);
  static const alertaClaro = Color(0xFFFFF4D6);
  static const error = Color(0xFFB3261E);
  static const errorClaro = Color(0xFFFDECEA);
  static const info = Color(0xFF0B1BB4);
  static const infoClaro = Color(0xFFE7ECFF);
  static const especial = Color(0xFF6A13A1);
  static const especialClaro = Color(0xFFF3E9FB);
  static const enrutado = Color(0xFF0F6F7A);
  static const enrutadoClaro = Color(0xFFE0F5F7);
  static const gestion = Color(0xFF7A4C0B);
  static const gestionClaro = Color(0xFFFBEEDC);

  /// Degradado de la imagen de referencia: arranque, acceso y cubiertas.
  static const degradado = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [electrico, violeta, magenta],
  );

  /// El mismo degradado con los siete tramos medidos, para superficies grandes.
  static const degradadoLargo = LinearGradient(
    begin: Alignment(0, -1),
    end: Alignment(0.4, 1),
    colors: [electrico, Color(0xFF0B20BC), violeta, violeta2, purpura, magenta, fucsia],
    stops: [0, .16, .34, .52, .70, .86, 1],
  );

  /// Degradado de la franja de marca (3-4 px) que separa cabecera y contenido.
  static const franja = LinearGradient(
    colors: [electrico, violeta2, magenta, fucsia],
  );

  /// Radios del sistema.
  static const radioTarjeta = 16.0;
  static const radioControl = 12.0;
  static const radioCampo = 8.0;
}

final ThemeData appTheme = ThemeData(
  useMaterial3: true,
  colorScheme: ColorScheme.fromSeed(
    seedColor: Marca.azul,
    brightness: Brightness.light,
  ).copyWith(
    primary: Marca.azul,
    onPrimary: Colors.white,
    secondary: Marca.turquesa,
    error: Marca.error,
    onError: Colors.white,
    surface: Colors.white,
    onSurface: Marca.texto,
    surfaceContainerLowest: Marca.fondo,
    surfaceContainer: Marca.contenedor,
    outlineVariant: Marca.borde,
  ),
  scaffoldBackgroundColor: Marca.fondo,

  // Cuerpo mínimo de 16 sp (RNF-APK-05); los tamaños menores quedan solo en
  // etiquetas de chip y pestañas.
  textTheme: const TextTheme(
    displaySmall: TextStyle(fontSize: 36, height: 44 / 36, fontWeight: FontWeight.w800),
    headlineSmall: TextStyle(fontSize: 24, height: 32 / 24, fontWeight: FontWeight.w700),
    titleLarge: TextStyle(fontSize: 22, height: 28 / 22, fontWeight: FontWeight.w700),
    titleMedium: TextStyle(fontSize: 16, height: 24 / 16, fontWeight: FontWeight.w600),
    bodyLarge: TextStyle(fontSize: 16, height: 24 / 16),
    bodyMedium: TextStyle(fontSize: 14, height: 20 / 14),
    bodySmall: TextStyle(fontSize: 13, height: 18 / 13),
    labelLarge: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
    labelSmall: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700),
  ),

  appBarTheme: const AppBarTheme(
    backgroundColor: Marca.profundo,
    foregroundColor: Colors.white,
    iconTheme: IconThemeData(color: Colors.white),
    titleTextStyle: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w700),
    elevation: 0,
  ),

  cardTheme: CardTheme(
    color: Colors.white,
    elevation: 0,
    margin: EdgeInsets.zero,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(Marca.radioTarjeta),
      side: const BorderSide(color: Marca.borde),
    ),
  ),

  // Objetivo táctil de 48 dp en los botones (RNF-APK-05).
  elevatedButtonTheme: ElevatedButtonThemeData(
    style: ElevatedButton.styleFrom(
      backgroundColor: Marca.azul,
      foregroundColor: Colors.white,
      minimumSize: const Size(48, 48),
      shape: const StadiumBorder(),
      textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
    ),
  ),
  filledButtonTheme: FilledButtonThemeData(
    style: FilledButton.styleFrom(
      backgroundColor: Marca.azul,
      foregroundColor: Colors.white,
      minimumSize: const Size(48, 48),
      shape: const StadiumBorder(),
      textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
    ),
  ),
  outlinedButtonTheme: OutlinedButtonThemeData(
    style: OutlinedButton.styleFrom(
      foregroundColor: Marca.azul,
      minimumSize: const Size(48, 48),
      side: const BorderSide(color: Marca.bordeFuerte),
      shape: const StadiumBorder(),
      textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
    ),
  ),
  textButtonTheme: TextButtonThemeData(
    style: TextButton.styleFrom(
      foregroundColor: Marca.azul,
      minimumSize: const Size(48, 44),
      textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
    ),
  ),

  inputDecorationTheme: InputDecorationTheme(
    filled: true,
    fillColor: Colors.white,
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(Marca.radioCampo),
      borderSide: const BorderSide(color: Marca.bordeFuerte, width: 1.5),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(Marca.radioCampo),
      borderSide: const BorderSide(color: Marca.bordeFuerte, width: 1.5),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(Marca.radioCampo),
      borderSide: const BorderSide(color: Marca.azul, width: 2),
    ),
    labelStyle: const TextStyle(color: Marca.textoSuave, fontSize: 14),
    floatingLabelStyle: const TextStyle(color: Marca.azul, fontWeight: FontWeight.w700),
    hintStyle: const TextStyle(color: Color(0xFF97A1B8)),
  ),

  navigationBarTheme: NavigationBarThemeData(
    height: 76,
    backgroundColor: Colors.white,
    surfaceTintColor: Colors.transparent,
    indicatorColor: Marca.infoClaro,
    elevation: 0,
    labelTextStyle: WidgetStateProperty.all(
      const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700),
    ),
  ),

  chipTheme: const ChipThemeData(
    backgroundColor: Colors.white,
    side: BorderSide(color: Marca.borde),
    shape: StadiumBorder(),
    labelStyle: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Marca.textoSuave),
    padding: EdgeInsets.symmetric(horizontal: 12, vertical: 6),
  ),

  dividerTheme: const DividerThemeData(color: Marca.borde, thickness: 1, space: 1),
  listTileTheme: const ListTileThemeData(iconColor: Marca.azul, textColor: Marca.texto),
  dialogTheme: DialogTheme(
    backgroundColor: Colors.white,
    surfaceTintColor: Colors.transparent,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Marca.radioTarjeta)),
  ),
  bottomSheetTheme: const BottomSheetThemeData(
    backgroundColor: Colors.white,
    surfaceTintColor: Colors.transparent,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
    ),
  ),
  snackBarTheme: const SnackBarThemeData(
    backgroundColor: Color(0xFF1D2436),
    behavior: SnackBarBehavior.floating,
    contentTextStyle: TextStyle(color: Colors.white, fontSize: 14),
  ),
  progressIndicatorTheme: const ProgressIndicatorThemeData(
    color: Marca.azul,
    linearTrackColor: Color(0x1F0B1BB4),
  ),
);
