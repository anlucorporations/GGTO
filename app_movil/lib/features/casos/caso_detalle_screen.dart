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

    // --- PIE: acciones del estado (RF-APK-06 · D-101) ---
    //
    // D-101: son **iconos con etiqueta**, no botones de ancho completo.
    final accionesPie = <Widget>[
      if (acciones.contains(AccionCaso.marcarContactado))
        FichaAccion(
          icono: Icons.phone_callback,
          etiqueta: 'Contactado',
          onPressed: () => _marcarContactado(context, idCaso, idAveria),
        ),
      if (acciones.contains(AccionCaso.noContesta))
        FichaAccion(
          icono: Icons.phone_missed,
          etiqueta: 'No contesta',
          onPressed: () => _noContesta(context, idCaso, idAveria),
        ),
      if (acciones.contains(AccionCaso.agendarCita))
        FichaAccion(
          icono: Icons.event,
          etiqueta: 'Agendar',
          onPressed: () => _agendarCita(
            context,
            idCaso,
            idAveria,
            // D-93: se llama al **número de contacto** (el 70* es el
            // identificador de pago, no un teléfono para contactar).
            v('contacto_cliente', porDefecto: ''),
            v('nombre_cliente', porDefecto: ''),
          ),
        ),
      if (acciones.contains(AccionCaso.atender))
        FichaAccion(
          icono: Icons.build,
          etiqueta: 'Atender',
          onPressed: () => _atender(context, idCaso, idAveria, estado),
        ),
    ];

    final String? nota;
    if (idCaso == null) {
      nota = 'Este caso no tiene identificador interno: no se pueden registrar acciones.';
    } else if (accionesPie.isEmpty) {
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
            identificadorPago: v('telefono', porDefecto: ''),
            // D-101: si el caso no trae contacto propio, se usa el teléfono que
            // aparezca dentro del texto de «Información» del reporte.
            contacto: contactoParaMostrar(
              contacto: v('contacto_cliente', porDefecto: ''),
              informacion: v('informacion', porDefecto: ''),
            ),
            estado: estado,
            pendienteSync: pendienteSync,
            onEditar: puedeEditarContacto(estado)
                ? () => _editar(
                      context,
                      idCaso,
                      idAveria,
                      v('direccion', porDefecto: ''),
                      v('contacto_cliente', porDefecto: ''),
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
                    ('Identificador de pago (70*)', v('telefono')),
                    ('Número de contacto', v('contacto_cliente')),
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
            acciones: accionesPie,
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
      String contacto, String nombreCliente) async {
    if (idCaso == null) return;
    final casos = context.read<CasosProvider>();
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ContactarScreen(
          idCaso: idCaso,
          idAveria: idAveria,
          contacto: contacto,
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

  /// Edita la **dirección** y el **número de contacto** (D-88/D-93 · RF-APK-11).
  ///
  /// El **identificador de pago (70\\*)** no se edita desde el campo: vive en la
  /// cabecera en solo lectura (D-93).
  Future<void> _editar(BuildContext context, int? idCaso, String idAveria,
      String direccion, String contacto) async {
    if (idCaso == null) return;
    final casos = context.read<CasosProvider>();
    final mensajeria = ScaffoldMessenger.of(context);
    final cambios = await showDialog<Map<String, String>>(
      context: context,
      builder: (_) => _EditarContactoDialog(
        direccion: direccion,
        contacto: contacto,
      ),
    );
    if (cambios == null || cambios.isEmpty) return;

    final resultado = await OperacionesService.editarContacto(
      idCaso: idCaso,
      idAveria: idAveria,
      direccion: cambios['direccion'],
      contacto: cambios['contacto'],
    );
    await casos.refrescarLocal();
    mensajeria.showSnackBar(SnackBar(content: Text(resultado.mensaje)));
  }
}

/// Formulario de edición del contacto, con la validación de la ficha.
class _EditarContactoDialog extends StatefulWidget {
  const _EditarContactoDialog({required this.direccion, required this.contacto});

  final String direccion;
  final String contacto;

  @override
  State<_EditarContactoDialog> createState() => _EditarContactoDialogState();
}

class _EditarContactoDialogState extends State<_EditarContactoDialog> {
  late final TextEditingController _direccion =
      TextEditingController(text: widget.direccion);
  late final TextEditingController _contacto =
      TextEditingController(text: widget.contacto);
  final _formulario = GlobalKey<FormState>();

  @override
  void dispose() {
    _direccion.dispose();
    _contacto.dispose();
    super.dispose();
  }

  void _guardar() {
    if (_formulario.currentState?.validate() != true) return;
    final cambios = <String, String>{};
    if (_direccion.text.trim() != widget.direccion.trim()) {
      cambios['direccion'] = _direccion.text.trim();
    }
    if (_contacto.text.trim() != widget.contacto.trim()) {
      cambios['contacto'] = _contacto.text.trim();
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
              controller: _contacto,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(
                labelText: 'Número de contacto',
                hintText: '04142223344',
                helperText: 'Cualquier número. Si escribe un 70* se registra como '
                    'identificador de pago del caso.',
                helperMaxLines: 2,
              ),
              validator: (valor) => errorNumeroContacto(valor ?? ''),
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
///
/// D-101: lo sustituye [FichaAccion] (icono + etiqueta en fila), que vive en
/// `ficha_caso.dart`.

