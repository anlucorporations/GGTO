// Controlador de `flutter drive` para las pruebas de integración de la APK.
//
//   flutter drive --driver=test_driver/integration_test.dart \
//                 --target=integration_test/flujo_campo_test.dart -d emulator-5554
//
// Con `flutter test integration_test/… -d <dispositivo>` no hace falta, pero se
// deja aquí porque es el camino que permite capturar las pantallas de la prueba.
import 'package:integration_test/integration_test_driver.dart';

Future<void> main() => integrationDriver();
