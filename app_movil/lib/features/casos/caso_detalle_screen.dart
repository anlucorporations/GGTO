import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/database.dart';
import '../../widgets/ficha_caso.dart';
import '../sync/sync_provider.dart';
import 'acciones_caso.dart';
import 'atender_screen.dart';
import 'casos_provider.dart';
import 'contactar_screen.dart';
import 'operaciones_service.dart';

/// Ficha del caso (RF-11 / §4.2) con los bloques **CABECERA · CUERPO · PIE**
/// (D-87 · M-07/3.1) y **acciones según el estado** (RF-APK-06).
///
/// La ficha sigue el **estado vivo** del caso: el mapa que recibe puede quedar
/// obsoleto en cuanto el técnico actúa, así que se lee del `CasosProvider` (el
/// contenido local del dispositivo, D-85). El defecto M-06 —la ficha ofrecía
/// «Contactar» con el caso ya contactado— queda cerrado por `accionesDeEstado()`.
class CasoDetalleScreen extends StatelessWidget {
  const CasoDetalleScreen({super.key, required this.caso});

  final Map<String, dynamic> caso;

  static String _v(Map<String, dynamic> caso, String campo,
      {String porDefecto = '—'}) {
    final valor = '${caso[campo] ?? ''}'.trim();
    return valor.isEmpty ? porDefecto : valor;
  }

  @override
  Widget build(BuildContext context) {
    final idAveria = _v(caso, 'id_averia');
    final vivo = context.watch<CasosProvider>().casos.firstWhere(
          (c) => '${c['id_averia']}' == idAveria,
          orElse: () => caso,
        );
    final pendienteSync = vivo['pendiente_sync'] == true;
    final sinConexion = !context.watch<SyncProvider>().enLinea;
    final estado = _v(vivo, 'estado_actual', porDefecto: 'NUEVO');
    final idCaso = caso['id_caso'] is int ? caso['id_caso'] as int : null;
    final acciones = accionesDeEstado(estado);

    String v(String campo, {String porDefecto = '—'}) =>
        _v(vivo, campo, porDefecto: porDefecto);

    // --- PIE: acciones del estado (RF-APK-06) ---
    final botones = <Widget>[
      if (acciones.contains(AccionCaso.marcarContactado))
        _BotonPie(
          icono: Icons.phone_callback,
          texto: 'Marcar como contactado',
          onPressed: () => _marcarContactado(context, idCaso, idAveria),
        ),
      if (acciones.contains(AccionCaso.noContesta))
        _BotonPie(
          icono: Icons.phone_missed,
          texto: 'No contesta',
          onPressed: () => _noContesta(context, idCaso, idAveria),
        ),
      if (acciones.contains(AccionCaso.agendarCita))
        _BotonPie(
          icono: Icons.event,
          texto: 'Agendar cita',
          onPressed: () => _agendarCita(
            context,
            idCaso,
            idAveria,
            v('telefono', porDefecto: ''),
            v('nombre_cliente', porDefecto: ''),
          ),
        ),
      if (acciones.contains(AccionCaso.atender))
        _BotonPie(
          icono: Icons.build,
          texto: 'Atender',
          onPressed: () => _atender(context, idCaso, idAveria, estado),
        ),
    ];

    final String? nota;
    if (idCaso == null) {
      nota = 'Este caso no tiene identificador interno: no se pueden registrar acciones.';
    } else if (botones.isEmpty) {
      nota = notaDeEstado(estado) ??
          'El caso no admite acciones desde la app en su estado actual.';
    } else {
      nota = null;
    }

    return Scaffold(
      appBar: AppBar(title: Text('Caso $idAveria')),
      body: Column(
        children: [
          // CABECERA (fija): de quién es la ficha y qué se puede editar.
          FichaCabecera(
            nombre: v('nombre_cliente', porDefecto: 'Cliente sin nombre'),
            telefono: v('telefono', porDefecto: ''),
            estado: estado,
            pendienteSync: pendienteSync,
            onEditar: puedeEditarContacto(estado)
                ? () => _editar(
                      context,
                      idCaso,
                      idAveria,
                      v('direccion', porDefecto: ''),
                      v('telefono', porDefecto: ''),
                    )
                : null,
          ),
          // CUERPO (adaptable): grupos de información del caso.
          Expanded(
            child: FichaCuerpo(
              hijos: [
                FichaSeccion(
                  titulo: 'Contacto',
                  icono: Icons.person_outline,
                  abierta: true,
                  filas: [
                    ('Nombre', v('nombre_cliente')),
                    ('Teléfono', v('telefono')),
                    ('Contacto', v('contacto_cliente')),
                    ('Persona que reporta', v('persona_reporta')),
                    ('Dirección', v('direccion')),
                    ('Sector', v('sector_nombre')),
                    ('Orden de visita', v('orden_visita')),
                  ],
                ),
                FichaSeccion(
                  titulo: 'Administrativa',
                  icono: Icons.description_outlined,
                  filas: [
                    ('Número', idAveria),
                    ('Plan', v('plan')),
                    ('Serial del equipo', v('serial')),
                    ('Tipo de servicio', v('tipo_servicio')),
                    ('Categoría', v('categoria')),
                    ('Tipo de caso', v('tipo_caso')),
                  ],
                ),
                FichaSeccion(
                  titulo: 'Técnica',
                  icono: Icons.settings_input_antenna,
                  filas: [
                    ('OLT', v('olt')),
                    ('Slot', v('slot')),
                    ('Puerto', v('puerto')),
                    ('FAT', v('fat')),
                    ('Área de trabajo', v('area_trabajo')),
                    ('Central', v('nombre_central')),
                  ],
                ),
                FichaSeccion(
                  titulo: 'Reporte',
                  icono: Icons.report_problem_outlined,
                  filas: [
                    ('Problema reportado', v('problema_reporte')),
                    ('Último comentario', v('ultimo_comentario')),
                    ('Información', v('informacion')),
                    ('Observación del despacho', v('observacion_despacho')),
                    ('Fecha de reporte', v('fecha_reporte')),
                    ('Fecha de cita', v('fecha_cita')),
                  ],
                ),
                // D-88 (requisito 3.2bis): conteo de imágenes cargadas del caso.
                _EvidenciasDelCaso(idAveria: idAveria, idCaso: idCaso),
              ],
            ),
          ),
          // PIE (fijo): lo que el estado permite hacer.
          FichaPie(
            acciones: botones,
            nota: nota,
            pendienteSync: pendienteSync,
            sinConexion: sinConexion,
          ),
        ],
      ),
    );
  }

  /// Marca el caso como CONTACTADO sin salir de la ficha (el PIE cambia solo).
  Future<void> _marcarContactado(
      BuildContext context, int? idCaso, String idAveria) async {
    if (idCaso == null) return;
    final casos = context.read<CasosProvider>();
    final mensajeria = ScaffoldMessenger.of(context);
    final resultado = await OperacionesService.marcarContactado(
      idCaso: idCaso,
      idAveria: idAveria,
    );
    await casos.refrescarLocal();
    mensajeria.showSnackBar(SnackBar(content: Text(resultado.mensaje)));
  }

  Future<void> _agendarCita(BuildContext context, int? idCaso, String idAveria,
      String telefono, String nombreCliente) async {
    if (idCaso == null) return;
    final casos = context.read<CasosProvider>();
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ContactarScreen(
          idCaso: idCaso,
          idAveria: idAveria,
          telefono: telefono,
          nombreCliente: nombreCliente,
        ),
      ),
    );
    await casos.refrescarLocal();
  }

  Future<void> _atender(BuildContext context, int? idCaso, String idAveria,
      String estado) async {
    if (idCaso == null) return;
    final casos = context.read<CasosProvider>();
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
    await casos.refrescarLocal();
  }

  /// «No Contesta» (D-88 · RF-APK-12): confirma la cita de 1ra visita y registra
  /// el aviso al COS. El caso queda `CITADO` (también sin conexión).
  Future<void> _noContesta(
      BuildContext context, int? idCaso, String idAveria) async {
    if (idCaso == null) return;
    final casos = context.read<CasosProvider>();
    final mensajeria = ScaffoldMessenger.of(context);
    final cita = citaDeNoContesta();
    String dos(int v) => v.toString().padLeft(2, '0');

    final confirmar = await showDialog<bool>(
      context: context,
      builder: (contexto) => AlertDialog(
        title: const Text('El cliente no contesta'),
        content: Text(
          'El caso pasará a CITADO con una cita de 1ra visita para el '
          '${dos(cita.day)}/${dos(cita.month)} a las ${dos(cita.hour)}:${dos(cita.minute)} '
          'y quedará constancia de que se informó al COS.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(contexto, false),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(contexto, true),
            child: const Text('Registrar'),
          ),
        ],
      ),
    );
    if (confirmar != true) return;

    final resultado = await OperacionesService.noContesta(
      idCaso: idCaso,
      idAveria: idAveria,
      fechaHora: cita,
    );
    await casos.refrescarLocal();
    mensajeria.showSnackBar(SnackBar(content: Text(resultado.mensaje)));
  }

  /// Edita la **dirección** y el **número de contacto** (D-88 · RF-APK-11).
  Future<void> _editar(BuildContext context, int? idCaso, String idAveria,
      String direccion, String telefono) async {
    if (idCaso == null) return;
    final casos = context.read<CasosProvider>();
    final mensajeria = ScaffoldMessenger.of(context);
    final cambios = await showDialog<Map<String, String>>(
      context: context,
      builder: (_) => _EditarContactoDialog(
        direccion: direccion,
        telefono: telefono,
      ),
    );
    if (cambios == null || cambios.isEmpty) return;

    final resultado = await OperacionesService.editarContacto(
      idCaso: idCaso,
      idAveria: idAveria,
      direccion: cambios['direccion'],
      telefono: cambios['telefono'],
    );
    await casos.refrescarLocal();
    mensajeria.showSnackBar(SnackBar(content: Text(resultado.mensaje)));
  }
}

/// Formulario de edición del contacto, con la validación de la ficha.
class _EditarContactoDialog extends StatefulWidget {
  const _EditarContactoDialog({required this.direccion, required this.telefono});

  final String direccion;
  final String telefono;

  @override
  State<_EditarContactoDialog> createState() => _EditarContactoDialogState();
}

class _EditarContactoDialogState extends State<_EditarContactoDialog> {
  late final TextEditingController _direccion =
      TextEditingController(text: widget.direccion);
  late final TextEditingController _telefono =
      TextEditingController(text: widget.telefono);
  final _formulario = GlobalKey<FormState>();

  @override
  void dispose() {
    _direccion.dispose();
    _telefono.dispose();
    super.dispose();
  }

  void _guardar() {
    if (_formulario.currentState?.validate() != true) return;
    final cambios = <String, String>{};
    if (_direccion.text.trim() != widget.direccion.trim()) {
      cambios['direccion'] = _direccion.text.trim();
    }
    if (_telefono.text.trim() != widget.telefono.trim()) {
      cambios['telefono'] = _telefono.text.trim();
    }
    Navigator.pop(context, cambios);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Editar el contacto'),
      content: Form(
        key: _formulario,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextFormField(
              controller: _direccion,
              textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(labelText: 'Dirección'),
              validator: (valor) => errorDireccion(valor ?? ''),
            ),
            const SizedBox(height: 8),
            TextFormField(
              controller: _telefono,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(
                labelText: 'Número de contacto',
                hintText: '7001234567',
              ),
              validator: (valor) => errorTelefono(valor ?? ''),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancelar'),
        ),
        ElevatedButton(onPressed: _guardar, child: const Text('Guardar')),
      ],
    );
  }
}

/// Tarjeta con el **conteo de imágenes** cargadas del caso (D-88 · 3.2bis).
class _EvidenciasDelCaso extends StatefulWidget {
  const _EvidenciasDelCaso({required this.idAveria, this.idCaso});

  final String idAveria;
  final int? idCaso;

  @override
  State<_EvidenciasDelCaso> createState() => _EvidenciasDelCasoState();
}

class _EvidenciasDelCasoState extends State<_EvidenciasDelCaso> {
  late final Future<int> _total = _contar();

  /// Si la base local no está disponible, se muestra 0 en lugar de romper la ficha.
  Future<int> _contar() async {
    try {
      return await DatabaseHelper.instance.contarEvidenciasDeCaso(
        widget.idAveria,
        idCaso: widget.idCaso,
      );
    } catch (_) {
      return 0;
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<int>(
      future: _total,
      builder: (context, snapshot) {
        final total = snapshot.data;
        return Card(
          margin: const EdgeInsets.only(bottom: 10),
          child: ListTile(
            leading: const Icon(Icons.photo_camera_outlined, size: 20),
            title: const Text(
              'Imágenes cargadas',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
            ),
            trailing: Text(
              total == null ? '…' : '$total',
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
            ),
          ),
        );
      },
    );
  }
}

/// Botón del PIE con el alto táctil de la guía (RNF-23).
class _BotonPie extends StatelessWidget {
  const _BotonPie({
    required this.icono,
    required this.texto,
    required this.onPressed,
  });

  final IconData icono;
  final String texto;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: SizedBox(
        height: 48,
        child: ElevatedButton.icon(
          icon: Icon(icono),
          label: Text(texto),
          onPressed: onPressed,
        ),
      ),
    );
  }
}
