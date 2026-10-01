import 'package:flutter/material.dart';

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
