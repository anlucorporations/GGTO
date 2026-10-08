import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../widgets/barra_progreso_sync.dart';
import '../../widgets/boton_usuario.dart';
import 'mensajes_provider.dart';

/// Bandeja de mensajes internos (D-81 · RF-41).
///
/// D-86: se muestra **del más reciente al más antiguo** y agrupada **por día**,
/// con **filtros** por tipo y por leído/no leído y **marcado masivo como leído**.
/// No hay borrado: la decisión del usuario (DEC-2) es filtrar y marcar.
class MensajesScreen extends StatefulWidget {
  const MensajesScreen({super.key});

  @override
  State<MensajesScreen> createState() => _MensajesScreenState();
}

class _MensajesScreenState extends State<MensajesScreen> {
  /// Tipo seleccionado (`null` = todos).
  String? _tipo;
  bool _soloNoLeidos = false;

  @override
  Widget build(BuildContext context) {
    final prov = Provider.of<MensajesProvider>(context);
    final visibles = MensajesProvider.filtrar(
      prov.mensajes,
      tipos: _tipo == null ? null : {_tipo!},
      soloNoLeidos: _soloNoLeidos,
    );
    final filas = _conEncabezados(visibles);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Mensajes'),
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(30),
          child: BarraProgresoSync(),
        ),
        actions: [
          if (prov.noLeidos > 0)
            IconButton(
              tooltip: 'Marcar todos como leídos',
              icon: const Icon(Icons.done_all),
              onPressed: () async {
                // El mensajero se captura antes del `await`: así no se usa el
                // `context` después de un hueco asíncrono.
                final mensajeria = ScaffoldMessenger.of(context);
                final cuantos = await prov.marcarTodosLeidos();
                mensajeria.showSnackBar(
                  SnackBar(
                    content: Text('$cuantos mensaje(s) marcados como leídos.'),
                  ),
                );
              },
            ),
          IconButton(
            tooltip: 'Actualizar',
            icon: const Icon(Icons.refresh),
            onPressed: () => prov.sondear(),
          ),
          const BotonUsuario(),
        ],
      ),
      body: Column(
        children: [
          _Filtros(
            tipo: _tipo,
            soloNoLeidos: _soloNoLeidos,
            noLeidos: prov.noLeidos,
            onTipo: (tipo) => setState(() => _tipo = tipo),
            onNoLeidos: (valor) => setState(() => _soloNoLeidos = valor),
          ),
          Expanded(
            child: filas.isEmpty
                ? Center(
                    child: Text(
                      _soloNoLeidos
                          ? 'No tiene mensajes sin leer.'
                          : 'Sin mensajes.',
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                    itemCount: filas.length,
                    itemBuilder: (context, i) {
                      final fila = filas[i];
                      if (fila is String) return _EncabezadoDia(texto: fila);
                      final mensaje = fila as Map<String, dynamic>;
                      return _TarjetaMensaje(
                        mensaje: mensaje,
                        onTap: () {
                          final id = mensaje['id_mensaje'];
                          if (id is int && mensaje['leido'] != true) {
                            prov.marcarLeido(id);
                          }
                        },
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  /// Intercala el encabezado de cada día respetando el orden recibido.
  static List<Object> _conEncabezados(List<Map<String, dynamic>> items) {
    final filas = <Object>[];
    String? diaActual;
    for (final mensaje in items) {
      final fecha = MensajesProvider.fechaDe(mensaje);
      final etiqueta =
          fecha == null ? 'Sin fecha' : MensajesProvider.etiquetaDia(fecha);
      if (etiqueta != diaActual) {
        filas.add(etiqueta);
        diaActual = etiqueta;
      }
      filas.add(mensaje);
    }
    return filas;
  }
}

/// Fila de filtros: no leídos, todos y un chip por tipo de mensaje.
class _Filtros extends StatelessWidget {
  const _Filtros({
    required this.tipo,
    required this.soloNoLeidos,
    required this.noLeidos,
    required this.onTipo,
    required this.onNoLeidos,
  });

  final String? tipo;
  final bool soloNoLeidos;
  final int noLeidos;
  final ValueChanged<String?> onTipo;
  final ValueChanged<bool> onNoLeidos;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 46,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        children: [
          ChoiceChip(
            label: Text(noLeidos > 0 ? 'No leídos ($noLeidos)' : 'No leídos'),
            selected: soloNoLeidos,
            onSelected: onNoLeidos,
          ),
          const SizedBox(width: 6),
          ChoiceChip(
            label: const Text('Todos'),
            selected: !soloNoLeidos && tipo == null,
            onSelected: (_) {
              onNoLeidos(false);
              onTipo(null);
            },
          ),
          for (final entrada in MensajesProvider.etiquetas.entries) ...[
            const SizedBox(width: 6),
            ChoiceChip(
              label: Text(entrada.value),
              selected: tipo == entrada.key,
              onSelected: (elegido) => onTipo(elegido ? entrada.key : null),
            ),
          ],
        ],
      ),
    );
  }
}

/// Tarjeta de un mensaje: tipo, hora y cuerpo; sin leer va resaltado.
class _TarjetaMensaje extends StatelessWidget {
  const _TarjetaMensaje({required this.mensaje, required this.onTap});

  final Map<String, dynamic> mensaje;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final leido = mensaje['leido'] == true;
    final tipo = '${mensaje['tipo']}';
    final fecha = MensajesProvider.fechaDe(mensaje);
    final hora = fecha == null
        ? ''
        : '${fecha.hour.toString().padLeft(2, '0')}:'
            '${fecha.minute.toString().padLeft(2, '0')}';
    return Card(
      color: leido ? null : Colors.blue.shade50,
      child: ListTile(
        leading: Icon(
          leido ? Icons.mark_email_read : Icons.mark_email_unread,
          color: leido ? Colors.grey : Colors.blue,
        ),
        title: Row(
          children: [
            Expanded(
              child: Text(
                MensajesProvider.etiquetas[tipo] ?? tipo,
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
              ),
            ),
            if (hora.isNotEmpty)
              Text(
                hora,
                style: const TextStyle(fontSize: 11, color: Colors.black54),
              ),
          ],
        ),
        subtitle: Text('${mensaje['cuerpo']}'),
        onTap: onTap,
      ),
    );
  }
}

/// Separador de día de la bandeja.
class _EncabezadoDia extends StatelessWidget {
  const _EncabezadoDia({required this.texto});

  final String texto;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 10, bottom: 4, left: 4),
      child: Text(
        texto,
        style: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: Colors.black54,
        ),
      ),
    );
  }
}
