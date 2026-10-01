import 'package:flutter/material.dart';

import '../../widgets/estado_chip.dart';
import 'atender_screen.dart';
import 'contactar_screen.dart';

/// Ficha del caso (RF-11 / §4.2) con las secciones **Administrativa** y
/// **Técnica** del brief.
class CasoDetalleScreen extends StatelessWidget {
  const CasoDetalleScreen({super.key, required this.caso});

  final Map<String, dynamic> caso;

  String _v(String campo, {String porDefecto = '—'}) {
    final valor = '${caso[campo] ?? ''}'.trim();
    return valor.isEmpty ? porDefecto : valor;
  }

  @override
  Widget build(BuildContext context) {
    final idAveria = _v('id_averia');
    final estado = _v('estado_actual', porDefecto: 'NUEVO');
    final idCaso = caso['id_caso'] is int ? caso['id_caso'] as int : null;
    final puedeAtender = estado == 'CONTACTADO' || estado == 'CITADO' || estado == 'ASIGNADO';
    final yaCerrado = estado == 'CERRADO' || estado == 'CANCELADO';

    return Scaffold(
      appBar: AppBar(
        title: Text('Caso $idAveria'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(30),
          child: Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: EstadoChip(estado: estado),
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(14),
        children: [
          _Seccion(
            titulo: 'Cliente',
            filas: [
              ('Nombre', _v('nombre_cliente')),
              ('Teléfono', _v('telefono')),
              ('Contacto', _v('contacto_cliente')),
              ('Persona que reporta', _v('persona_reporta')),
              ('Dirección', _v('direccion')),
              ('Sector', _v('sector_nombre')),
            ],
          ),
          _Seccion(
            titulo: 'Administrativa',
            filas: [
              ('Número', idAveria),
              ('Plan', _v('plan')),
              ('Serial del equipo', _v('serial')),
              ('Tipo de servicio', _v('tipo_servicio')),
              ('Categoría', _v('categoria')),
              ('Tipo de caso', _v('tipo_caso')),
            ],
          ),
          _Seccion(
            titulo: 'Técnica',
            filas: [
              ('OLT', _v('olt')),
              ('Slot', _v('slot')),
              ('Puerto', _v('puerto')),
              ('FAT', _v('fat')),
              ('Área de trabajo', _v('area_trabajo')),
              ('Central', _v('nombre_central')),
            ],
          ),
          _Seccion(
            titulo: 'Reporte',
            filas: [
              ('Problema reportado', _v('problema_reporte')),
              ('Último comentario', _v('ultimo_comentario')),
              ('Información', _v('informacion')),
              ('Fecha de reporte', _v('fecha_reporte')),
              ('Fecha de cita', _v('fecha_cita')),
            ],
          ),
          const SizedBox(height: 8),

          if (idCaso == null)
            const Text(
              'Este caso no tiene identificador interno: no se pueden registrar acciones.',
              style: TextStyle(color: Colors.red),
            )
          else if (yaCerrado)
            const Text(
              'El caso está cerrado o cancelado: no admite nuevas gestiones desde la app.',
              style: TextStyle(color: Colors.black54),
            )
          else ...[
            SizedBox(
              height: 48,
              child: ElevatedButton.icon(
                icon: const Icon(Icons.phone),
                label: const Text('Contactar / Agendar cita'),
                onPressed: () async {
                  await Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => ContactarScreen(
                        idCaso: idCaso,
                        idAveria: idAveria,
                        telefono: _v('telefono', porDefecto: ''),
                        nombreCliente: _v('nombre_cliente', porDefecto: ''),
                      ),
                    ),
                  );
                  if (context.mounted) Navigator.pop(context);
                },
              ),
            ),
            const SizedBox(height: 10),
            SizedBox(
              height: 48,
              child: ElevatedButton.icon(
                icon: const Icon(Icons.build),
                label: const Text('Atender (cerrar / enrutar / diferir)'),
                onPressed: puedeAtender
                    ? () async {
                        await Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => AtenderScreen(
                              idCaso: idCaso,
                              idAveria: idAveria,
                              estadoActual: estado,
                            ),
                          ),
                        );
                        if (context.mounted) Navigator.pop(context);
                      }
                    : null,
              ),
            ),
            if (!puedeAtender)
              const Padding(
                padding: EdgeInsets.only(top: 8),
                child: Text(
                  'Debe marcar el caso como CONTACTADO antes de atenderlo (§4.2).',
                  style: TextStyle(fontSize: 12, color: Colors.black54),
                ),
              ),
          ],
        ],
      ),
    );
  }
}

/// Bloque de la ficha con sus pares campo/valor.
class _Seccion extends StatelessWidget {
  const _Seccion({required this.titulo, required this.filas});

  final String titulo;
  final List<(String, String)> filas;

  @override
  Widget build(BuildContext context) {
    final visibles = filas.where((f) => f.$2.trim().isNotEmpty && f.$2 != '—').toList();
    if (visibles.isEmpty) return const SizedBox.shrink();

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              titulo,
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
            ),
            const SizedBox(height: 8),
            for (final fila in visibles)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                      width: 130,
                      child: Text(
                        fila.$1,
                        style: const TextStyle(fontSize: 13, color: Colors.black54),
                      ),
                    ),
                    Expanded(
                      child: Text(fila.$2, style: const TextStyle(fontSize: 14)),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
