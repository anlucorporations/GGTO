import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../widgets/barra_progreso_sync.dart';
import '../../widgets/boton_usuario.dart';
import 'mensajes_provider.dart';

/// Bandeja de mensajes internos (D-81 · RF-41). Unidireccional: el técnico solo
/// recibe y marca como leído.
class MensajesScreen extends StatelessWidget {
  const MensajesScreen({super.key});

  static const _etiqueta = {
    'TEXTO': 'Mensaje',
    'RECORDATORIO_CITA': 'Recordatorio de cita',
    'ESTADO_SYNC': 'Estado de sincronización',
    'ALARMA_DESPACHO': 'Alarma de despacho',
  };

  @override
  Widget build(BuildContext context) {
    final prov = Provider.of<MensajesProvider>(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Mensajes'),
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(30),
          child: BarraProgresoSync(),
        ),
        actions: [
          IconButton(
            tooltip: 'Actualizar',
            icon: const Icon(Icons.refresh),
            onPressed: () => prov.sondear(),
          ),
          const BotonUsuario(),
        ],
      ),
      body: prov.mensajes.isEmpty
          ? const Center(child: Text('Sin mensajes.'))
          : ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: prov.mensajes.length,
              itemBuilder: (context, i) {
                final m = prov.mensajes[i];
                final leido = m['leido'] == true;
                final tipo = '${m['tipo']}';
                return Card(
                  color: leido ? null : Colors.blue.shade50,
                  child: ListTile(
                    leading: Icon(
                      leido ? Icons.mark_email_read : Icons.mark_email_unread,
                      color: leido ? Colors.grey : Colors.blue,
                    ),
                    title: Text(
                      _etiqueta[tipo] ?? tipo,
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                    ),
                    subtitle: Text('${m['cuerpo']}'),
                    onTap: () {
                      final id = (m['id_mensaje'] as int?) ?? 0;
                      if (id > 0 && !leido) prov.marcarLeido(id);
                    },
                  ),
                );
              },
            ),
    );
  }
}
