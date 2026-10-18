import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_error.dart';
import '../../widgets/estado_chip.dart';
import '../../widgets/ficha_caso.dart';
import '../auth/auth_provider.dart';
import '../casos/caso_detalle_screen.dart';
import 'lista_seriales.dart';
import 'masivas_provider.dart';
import 'masivas_service.dart';

/// Ficha de la **MASIVA** (D-99 · RF-59…RF-62).
///
/// Al abrirla se muestran las secciones **CASOS ASOCIADOS** y **DATOS TÉCNICOS**
/// —con la **RUTA** siempre visible— y la **gestión** de la masiva en sus propias
/// fichas: **PLANIFICAR**, **MATERIALES** y **CERRAR**.
///
/// El rol decide qué se puede hacer: TECNICO la ve en **solo lectura** (sin
/// PLANIFICAR ni CERRAR) y MATERIALES solo deja consultar las órdenes.
class FichaMasivaScreen extends StatefulWidget {
  const FichaMasivaScreen({
    super.key,
    required this.masiva,
    this.rol,
    this.pestanaInicial,
  });

  /// Ficha de la masiva tal como la entrega la DESCARGA (o `GET /fallas-masivas`).
  final Map<String, dynamic> masiva;

  /// Rol del usuario. Si es `null` se lee de `AuthProvider`.
  final String? rol;

  /// Pestaña con la que abre la ficha (D-111).
  ///
  /// Las acciones con icono del cuadro de masivas abren la ficha directamente en
  /// PLANIFICAR, MATERIALES o CERRAR. Si el rol no tiene esa pestaña —o el valor
  /// no es una pestaña conocida— se abre la primera, sin fallar.
  final String? pestanaInicial;

  /// Pestañas de la ficha según el rol.
  ///
  /// **TECNICO** la ve en solo lectura: sin PLANIFICAR ni CERRAR (Materiales solo
  /// deja consultar las órdenes).
  static List<String> pestanasDe(String rol) => [
        'CASOS ASOCIADOS',
        'DATOS TÉCNICOS',
        if (MasivasProvider.puedePlanificar(rol)) 'PLANIFICAR',
        'MATERIALES',
        if (MasivasProvider.puedeCerrar(rol)) 'CERRAR',
      ];

  /// Índice de la pestaña pedida; **0** si el rol no la tiene o no existe.
  static int indicePestana(List<String> etiquetas, String? pestana) {
    if (pestana == null) return 0;
    final indice = etiquetas.indexOf(pestana);
    return indice < 0 ? 0 : indice;
  }

  @override
  State<FichaMasivaScreen> createState() => _FichaMasivaScreenState();
}

class _FichaMasivaScreenState extends State<FichaMasivaScreen> {
  late Map<String, dynamic> _masiva = Map<String, dynamic>.from(widget.masiva);
  bool _refrescando = false;

  int get _idFalla => MasivasProvider.idDe(_masiva);

  /// Casos asociados embebidos en la ficha.
  List<Map<String, dynamic>> get _casos => _listaDe(_masiva['casos']);

  /// Rol efectivo del usuario (el más restrictivo si no se puede resolver).
  String _rol(BuildContext context) {
    if (widget.rol != null) return widget.rol!;
    try {
      return Provider.of<AuthProvider>(context, listen: false).rol;
    } catch (_) {
      return '';
    }
  }

  /// Relee la ficha, sus casos y sus órdenes contra el servidor.
  Future<void> _refrescar() async {
    if (_idFalla == 0) return;
    setState(() => _refrescando = true);
    final mensajeria = ScaffoldMessenger.of(context);
    try {
      final detalle = await MasivasService.detalle(_idFalla);
      final casos = await MasivasService.casos(_idFalla);
      final ordenes = await MasivasService.ordenes(_idFalla);
      if (!mounted) return;
      setState(() {
        _masiva = {
          ..._masiva,
          ...?detalle,
          'casos': casos,
          'ordenes': ordenes,
        };
      });
    } on ApiError catch (error) {
      if (mounted) {
        mensajeria.showSnackBar(SnackBar(content: Text(error.mensaje)));
      }
    } catch (error) {
      if (mounted) {
        mensajeria.showSnackBar(
          SnackBar(content: Text(ApiError.desconocido(error).mensaje)),
        );
      }
    } finally {
      if (mounted) setState(() => _refrescando = false);
    }
  }

  /// Aplica la ficha devuelta por una acción (planificar, solicitar…).
  void _aplicarDetalle(Map<String, dynamic>? detalle) {
    if (detalle == null) return;
    setState(() => _masiva = {..._masiva, ...detalle});
  }

  /// Tras el **cierre en cascada**: informa el resumen y saca la masiva del
  /// bloque fijo (ya no está activa).
  Future<void> _alCerrar(ResultadoCierreMasiva resultado) async {
    if (!mounted) return;
    setState(() {
      _masiva = {..._masiva, 'estado': resultado.estado};
    });
    MasivasProvider.opcional(context, escuchar: false)?.quitarLocal(_idFalla);
    await showDialog<void>(
      context: context,
      builder: (_) => ResumenCierreMasiva(resultado: resultado),
    );
  }

  @override
  Widget build(BuildContext context) {
    final rol = _rol(context);
    final puedePlanificar = MasivasProvider.puedePlanificar(rol);
    final puedeCerrar = MasivasProvider.puedeCerrar(rol);

    final etiquetas = FichaMasivaScreen.pestanasDe(rol);
    final vistas = <Widget>[
      TabCasosAsociados(casos: _casos),
      TabDatosTecnicos(masiva: _masiva, casos: _casos),
      if (puedePlanificar)
        TabPlanificar(
          idFalla: _idFalla,
          planificacionActual: '${_masiva['planificacion'] ?? ''}',
          reporteSimpleActual: '${_masiva['reporte_simple'] ?? ''}',
          onPlanificado: _aplicarDetalle,
        ),
      TabMateriales(
        idFalla: _idFalla,
        ordenes: _listaDe(_masiva['ordenes']),
        puedeSolicitar: MasivasProvider.puedeSolicitarMaterial(rol),
      ),
      if (puedeCerrar)
        TabCerrar(
          masiva: _masiva,
          onCerrado: _alCerrar,
        ),
    ];

    return DefaultTabController(
      length: etiquetas.length,
      // D-111: la acción con icono del cuadro abre la ficha en su pestaña.
      initialIndex: FichaMasivaScreen.indicePestana(
        etiquetas,
        widget.pestanaInicial,
      ),
      child: Scaffold(
        appBar: AppBar(
          title: Text('Masiva #$_idFalla'),
          actions: [
            IconButton(
              tooltip: 'Refrescar la ficha',
              icon: const Icon(Icons.refresh),
              onPressed: _refrescando ? null : _refrescar,
            ),
          ],
          bottom: TabBar(
            isScrollable: true,
            tabs: [for (final etiqueta in etiquetas) Tab(text: etiqueta)],
          ),
        ),
        body: TabBarView(children: vistas),
      ),
    );
  }
}

// --------------------------------------------------------------------------- #
// CASOS ASOCIADOS (RF-59)
// --------------------------------------------------------------------------- #

/// Lista de los casos vinculados a la masiva.
class TabCasosAsociados extends StatelessWidget {
  const TabCasosAsociados({super.key, required this.casos});

  final List<Map<String, dynamic>> casos;

  @override
  Widget build(BuildContext context) {
    if (casos.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text(
            'La masiva no tiene casos asociados.',
            textAlign: TextAlign.center,
          ),
        ),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.only(bottom: 16),
      itemCount: casos.length,
      itemBuilder: (context, indice) {
        final caso = casos[indice];
        return TarjetaCasoAsociado(
          caso: caso,
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => CasoDetalleScreen(caso: caso)),
          ),
        );
      },
    );
  }
}

/// Tarjeta de un caso asociado, con sus datos técnicos y la **RUTA**.
class TarjetaCasoAsociado extends StatelessWidget {
  const TarjetaCasoAsociado({super.key, required this.caso, required this.onTap});

  final Map<String, dynamic> caso;
  final VoidCallback onTap;

  /// Líneas de la tarjeta; la RUTA sale de `ruta`/`extra` y se muestra siempre.
  static List<String> lineas(Map<String, dynamic> caso) {
    String v(String campo) => '${caso[campo] ?? ''}'.trim();
    final slot = v('slot');
    final puerto = v('puerto');
    final tecnica = [
      if (v('olt').isNotEmpty) 'OLT ${v('olt')}',
      if (slot.isNotEmpty || puerto.isNotEmpty) 'Slot/Puerto $slot/$puerto',
      if (v('fat').isNotEmpty) 'FAT ${v('fat')}',
    ].join(' · ');
    final ruta = MasivasProvider.rutaDeCaso(caso);
    final origen = v('origen_asociacion');
    return [
      if (v('nombre_cliente').isNotEmpty) 'Cliente: ${v('nombre_cliente')}',
      if (v('telefono').isNotEmpty) 'Identificador de pago (70*): ${v('telefono')}',
      if (v('direccion').isNotEmpty) 'Dirección: ${v('direccion')}',
      if (v('sector_nombre').isNotEmpty) 'Sector: ${v('sector_nombre')}',
      if (tecnica.isNotEmpty) tecnica,
      'RUTA: ${ruta.isEmpty ? '—' : ruta}',
      'Asociación: ${origen.isEmpty ? 'AUTO' : origen}',
    ];
  }

  @override
  Widget build(BuildContext context) {
    final estado = '${caso['estado_actual'] ?? ''}'.trim();
    final idAveria = '${caso['id_averia'] ?? ''}'.trim();
    final lineas = TarjetaCasoAsociado.lineas(caso);
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        leading: const Icon(Icons.link),
        title: Text(
          idAveria.isEmpty ? 'Caso sin identificador' : idAveria,
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        subtitle: Text(lineas.join('\n'), style: const TextStyle(fontSize: 13)),
        isThreeLine: lineas.length > 2,
        trailing: Column(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (estado.isNotEmpty) EstadoChip(estado: estado),
            const SizedBox(height: 2),
            const Icon(Icons.chevron_right, size: 18),
          ],
        ),
        onTap: onTap,
      ),
    );
  }
}

// --------------------------------------------------------------------------- #
// DATOS TÉCNICOS
// --------------------------------------------------------------------------- #

/// Datos técnicos de la masiva, con la **RUTA** y el detalle del cierre.
class TabDatosTecnicos extends StatelessWidget {
  const TabDatosTecnicos({super.key, required this.masiva, required this.casos});

  final Map<String, dynamic> masiva;
  final List<Map<String, dynamic>> casos;

  /// RUTA que se muestra: la de la ficha y, si no viniera, la del caso
  /// representativo (que la toma de `ruta`/`extra`, o la compone Slot · Puerto · FAT).
  static String rutaDe(Map<String, dynamic> masiva, List<Map<String, dynamic>> casos) =>
      MasivasProvider.rutaDeMasiva({...masiva, 'casos': casos});

  @override
  Widget build(BuildContext context) {
    final representativo =
        casos.isEmpty ? <String, dynamic>{} : casos.first;
    final ruta = rutaDe(masiva, casos);
    final cerrada = '${masiva['estado'] ?? ''}'.toUpperCase() == 'CERRADA' ||
        '${masiva['descripcion_cierre'] ?? ''}'.trim().isNotEmpty;

    return FichaCuerpo(
      hijos: [
        FichaSeccion(
          titulo: 'Técnica',
          icono: Icons.settings_input_antenna,
          abierta: true,
          filas: [
            ('ODN', _texto(masiva['odn'])),
            ('FAT', _texto(masiva['fat'])),
            // La RUTA se muestra SIEMPRE, venga del EXTRA de la ingesta o compuesta.
            ('RUTA', ruta.trim().isEmpty ? '—' : ruta),
            ('Dirección', _texto(masiva['direccion'])),
            ('Sector', _texto(masiva['sector_nombre'])),
            ('OLT', _texto(representativo['olt'])),
            ('Tarjeta (slot)', _texto(representativo['slot'])),
            ('Puerto', _texto(representativo['puerto'])),
            ('Concentración', _texto(masiva['clave_concentracion'])),
            ('Coordenadas', _coordenadas(masiva['latitud'], masiva['longitud'])),
          ],
        ),
        FichaSeccion(
          titulo: 'Estado',
          icono: Icons.flag_outlined,
          filas: [
            ('Estado', _texto(masiva['estado'])),
            ('Origen', _texto(masiva['origen'])),
            ('Detección', _fecha(masiva['fecha_deteccion'])),
            ('Planificación', _texto(masiva['planificacion'])),
            ('Planificada en', _fecha(masiva['planificada_en'])),
            ('Reporte simple', _texto(masiva['reporte_simple'])),
            (
              'Casos asociados',
              casos.isEmpty
                  ? '${masiva['casos_asociados'] ?? 0}'
                  : '${casos.length}',
            ),
            ('Evidencias', _lista(masiva['evidencias'])),
            ('Actualizado en', _fecha(masiva['actualizado_en'])),
          ],
        ),
        if (cerrada)
          FichaSeccion(
            titulo: 'Cierre',
            icono: Icons.task_alt,
            abierta: true,
            filas: [
              ('Descripción del cierre', _texto(masiva['descripcion_cierre'])),
              ('Validador del CRASS', _validador(masiva)),
              ('Cerrada por', _texto(masiva['cerrada_por'])),
              ('Cerrada en', _fecha(masiva['cerrada_en'])),
              ('Casos cerrados', '${masiva['casos_cerrados'] ?? 0}'),
              ('Evidencias del cierre', _lista(masiva['evidencias_cierre'])),
            ],
          ),
      ],
    );
  }

  /// Validador del CRASS: el objeto enriquecido o su identificador.
  static String _validador(Map<String, dynamic> masiva) {
    final validador = masiva['validador_crass'];
    if (validador is Map) {
      final nombre = '${validador['nombre'] ?? ''}'.trim();
      final unidad = '${validador['unidad'] ?? ''}'.trim();
      final texto = [nombre, unidad].where((p) => p.isNotEmpty).join(' · ');
      if (texto.isNotEmpty) return texto;
    }
    return _texto(masiva['id_validador_crass']);
  }
}

// --------------------------------------------------------------------------- #
// PLANIFICAR (RF-17)
// --------------------------------------------------------------------------- #

/// Ficha para documentar la planificación de la atención.
class TabPlanificar extends StatefulWidget {
  const TabPlanificar({
    super.key,
    required this.idFalla,
    required this.planificacionActual,
    required this.reporteSimpleActual,
    required this.onPlanificado,
  });

  final int idFalla;
  final String planificacionActual;
  final String reporteSimpleActual;
  final ValueChanged<Map<String, dynamic>?> onPlanificado;

  @override
  State<TabPlanificar> createState() => _TabPlanificarState();
}

class _TabPlanificarState extends State<TabPlanificar> {
  late final TextEditingController _planificacion =
      TextEditingController(text: widget.planificacionActual);
  late final TextEditingController _reporte =
      TextEditingController(text: widget.reporteSimpleActual);
  final List<String> _seriales = [];
  bool _enviando = false;
  String? _error;

  @override
  void dispose() {
    _planificacion.dispose();
    _reporte.dispose();
    super.dispose();
  }

  Future<void> _guardar() async {
    final error = MasivasService.errorPlanificacion(_planificacion.text);
    setState(() => _error = error);
    if (error != null) return;

    setState(() => _enviando = true);
    final mensajeria = ScaffoldMessenger.of(context);
    try {
      final detalle = await MasivasService.planificar(
        idFalla: widget.idFalla,
        planificacion: _planificacion.text,
        reporteSimple: _reporte.text,
        evidencias: _seriales,
      );
      widget.onPlanificado(detalle);
      mensajeria.showSnackBar(
        const SnackBar(content: Text('Planificación guardada.')),
      );
    } on ApiError catch (error) {
      mensajeria.showSnackBar(SnackBar(content: Text(error.mensaje)));
    } catch (error) {
      mensajeria.showSnackBar(
        SnackBar(content: Text(ApiError.desconocido(error).mensaje)),
      );
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(14),
      children: [
        const Text(
          'Documente cómo se atenderá la masiva (RF-17). Al guardar, la masiva '
          'queda en estado PLANIFICADA.',
          style: TextStyle(fontSize: 13, color: Colors.black54),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _planificacion,
          minLines: 3,
          maxLines: 6,
          decoration: InputDecoration(
            labelText: 'Planificación (obligatoria)',
            hintText: 'Cuadrilla, materiales y ventana de trabajo',
            border: const OutlineInputBorder(),
            errorText: _error,
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _reporte,
          minLines: 2,
          maxLines: 4,
          decoration: const InputDecoration(
            labelText: 'Reporte simple (opcional)',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        ListaSeriales(
          etiqueta: 'Evidencias de la planificación',
          seriales: _seriales,
          onAgregar: (serial) => setState(() => _seriales.add(serial)),
          onQuitar: (serial) => setState(() => _seriales.remove(serial)),
        ),
        const SizedBox(height: 16),
        SizedBox(
          height: 48,
          child: FilledButton.icon(
            icon: const Icon(Icons.event_available),
            label: Text(_enviando ? 'Guardando…' : 'Guardar la planificación'),
            onPressed: _enviando ? null : _guardar,
          ),
        ),
      ],
    );
  }
}

// --------------------------------------------------------------------------- #
// MATERIALES (RF-18)
// --------------------------------------------------------------------------- #

/// Órdenes de material de la masiva y solicitud de material.
class TabMateriales extends StatefulWidget {
  const TabMateriales({
    super.key,
    required this.idFalla,
    required this.ordenes,
    required this.puedeSolicitar,
  });

  final int idFalla;
  final List<Map<String, dynamic>> ordenes;

  /// El rol puede solicitar material (ADMIN, SUPERVISOR o COORDINADOR).
  final bool puedeSolicitar;

  @override
  State<TabMateriales> createState() => _TabMaterialesState();
}

class _TabMaterialesState extends State<TabMateriales> {
  late List<Map<String, dynamic>> _ordenes = widget.ordenes;
  bool _cargando = false;

  Future<void> _recargar() async {
    setState(() => _cargando = true);
    final mensajeria = ScaffoldMessenger.of(context);
    try {
      final ordenes = await MasivasService.ordenes(widget.idFalla);
      if (!mounted) return;
      setState(() => _ordenes = ordenes);
    } on ApiError catch (error) {
      if (mounted) mensajeria.showSnackBar(SnackBar(content: Text(error.mensaje)));
    } catch (error) {
      if (mounted) {
        mensajeria.showSnackBar(
          SnackBar(content: Text(ApiError.desconocido(error).mensaje)),
        );
      }
    } finally {
      if (mounted) setState(() => _cargando = false);
    }
  }

  Future<void> _solicitar() async {
    final descripcion = await showDialog<String>(
      context: context,
      builder: (contexto) {
        var texto = '';
        return StatefulBuilder(
          builder: (contexto, setEstado) => AlertDialog(
            title: Text('Materiales · Masiva #${widget.idFalla}'),
            content: TextField(
              minLines: 2,
              maxLines: 5,
              autofocus: true,
              decoration: const InputDecoration(
                labelText: 'Material requerido',
                hintText: 'Describa cantidades y materiales',
                border: OutlineInputBorder(),
              ),
              onChanged: (valor) => setEstado(() => texto = valor),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(contexto),
                child: const Text('Cancelar'),
              ),
              FilledButton(
                onPressed: MasivasService.errorMaterial(texto) == null
                    ? () => Navigator.pop(contexto, texto.trim())
                    : null,
                child: const Text('Solicitar'),
              ),
            ],
          ),
        );
      },
    );
    if (descripcion == null) return;
    if (!mounted) return;

    final mensajeria = ScaffoldMessenger.of(context);
    try {
      await MasivasService.solicitarMaterial(
        idFalla: widget.idFalla,
        descripcion: descripcion,
      );
      await _recargar();
      mensajeria.showSnackBar(
        const SnackBar(content: Text('Solicitud de materiales enviada.')),
      );
    } on ApiError catch (error) {
      mensajeria.showSnackBar(SnackBar(content: Text(error.mensaje)));
    } catch (error) {
      mensajeria.showSnackBar(
        SnackBar(content: Text(ApiError.desconocido(error).mensaje)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(14),
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Órdenes de material (${_ordenes.length})',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
              ),
            ),
            IconButton(
              tooltip: 'Recargar las órdenes',
              icon: const Icon(Icons.refresh),
              onPressed: _cargando ? null : _recargar,
            ),
          ],
        ),
        if (_ordenes.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 8),
            child: Text('Sin solicitudes de material registradas.'),
          )
        else
          for (final orden in _ordenes)
            Card(
              margin: const EdgeInsets.symmetric(vertical: 4),
              child: ListTile(
                leading: const Icon(Icons.inventory_2_outlined),
                title: Text(
                  '#${orden['id_orden']} · ${orden['estado'] ?? '—'}',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                subtitle: Text([
                  if ('${orden['observacion'] ?? ''}'.trim().isNotEmpty)
                    '${orden['observacion']}',
                  if ('${orden['fecha'] ?? ''}'.trim().isNotEmpty)
                    'Fecha: ${_fecha(orden['fecha'])}',
                ].join('\n')),
              ),
            ),
        const SizedBox(height: 12),
        if (widget.puedeSolicitar)
          SizedBox(
            height: 48,
            child: FilledButton.icon(
              icon: const Icon(Icons.add_shopping_cart),
              label: const Text('Solicitar material'),
              onPressed: _solicitar,
            ),
          )
        else
          const Text(
            'Su rol solo puede consultar las órdenes de material de la masiva.',
            style: TextStyle(fontSize: 12, color: Colors.black54),
          ),
      ],
    );
  }
}

// --------------------------------------------------------------------------- #
// CERRAR (RF-61 · RF-62)
// --------------------------------------------------------------------------- #

/// Ficha de **cierre en cascada**: descripción, validador del CRASS, modo,
/// evidencias y el texto que quedará en cada caso.
class TabCerrar extends StatefulWidget {
  const TabCerrar({super.key, required this.masiva, required this.onCerrado});

  final Map<String, dynamic> masiva;
  final ValueChanged<ResultadoCierreMasiva> onCerrado;

  @override
  State<TabCerrar> createState() => _TabCerrarState();
}

class _TabCerrarState extends State<TabCerrar> {
  final TextEditingController _descripcion = TextEditingController();
  final TextEditingController _descripcionCaso =
      TextEditingController(text: MasivasService.descripcionCasoPorDefecto);
  final List<String> _seriales = [];
  final List<(int, String)> _personal = [];

  int? _idValidador;
  String _modo = 'IVR';
  bool _cargandoPersonal = true;
  String? _errorPersonal;
  bool _enviando = false;
  String? _errorDescripcion;
  String? _errorCaso;
  String? _errorValidador;

  int get _idFalla => MasivasProvider.idDe(widget.masiva);

  int get _cantidadCasos => MasivasProvider.casosAsociados(widget.masiva);

  @override
  void initState() {
    super.initState();
    _cargarPersonal();
  }

  @override
  void dispose() {
    _descripcion.dispose();
    _descripcionCaso.dispose();
    super.dispose();
  }

  /// Personal del CRASS activo (el desplegable del validador).
  Future<void> _cargarPersonal() async {
    try {
      final personal = await MasivasService.personalCrass();
      if (!mounted) return;
      setState(() {
        _personal
          ..clear()
          ..addAll(personal
              .where((p) => p['id_solicitante'] is int)
              .map((p) => (
                    p['id_solicitante'] as int,
                    [
                      '${p['nombre'] ?? ''}'.trim(),
                      '${p['unidad'] ?? ''}'.trim(),
                    ].where((t) => t.isNotEmpty).join(' · '),
                  )));
        _cargandoPersonal = false;
        _errorPersonal = null;
      });
    } on ApiError catch (error) {
      if (!mounted) return;
      setState(() {
        _errorPersonal = error.mensaje;
        _cargandoPersonal = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _errorPersonal = ApiError.desconocido(error).mensaje;
        _cargandoPersonal = false;
      });
    }
  }

  /// Vuelve a pedir el personal del CRASS (tras un fallo de red).
  Future<void> _reintentarPersonal() async {
    setState(() {
      _cargandoPersonal = true;
      _errorPersonal = null;
    });
    await _cargarPersonal();
  }

  Future<void> _confirmar() async {
    final errorDescripcion =
        MasivasService.errorDescripcionCierre(_descripcion.text);
    final errorCaso = MasivasService.errorDescripcionCaso(_descripcionCaso.text);
    final errorValidador = MasivasService.errorValidador(_idValidador);
    setState(() {
      _errorDescripcion = errorDescripcion;
      _errorCaso = errorCaso;
      _errorValidador = errorValidador;
    });
    if (errorDescripcion != null ||
        errorCaso != null ||
        errorValidador != null ||
        _idValidador == null) {
      return;
    }

    // Antes de enviar: aviso explícito de que se cierran TODOS los casos.
    final confirmado = await showDialog<bool>(
      context: context,
      builder: (_) => DialogoConfirmacionCierreMasiva(
        idFalla: _idFalla,
        cantidadCasos: _cantidadCasos,
        modo: _modo,
        descripcionCaso: _descripcionCaso.text.trim(),
      ),
    );
    if (confirmado != true) return;
    if (!mounted) return;

    setState(() => _enviando = true);
    final mensajeria = ScaffoldMessenger.of(context);
    try {
      final resultado = await MasivasService.cerrar(
        idFalla: _idFalla,
        descripcion: _descripcion.text,
        idValidadorCrass: _idValidador!,
        modo: _modo,
        descripcionCaso: _descripcionCaso.text,
        evidencias: _seriales,
      );
      widget.onCerrado(resultado);
    } on ApiError catch (error) {
      mensajeria.showSnackBar(SnackBar(content: Text(error.mensaje)));
    } catch (error) {
      mensajeria.showSnackBar(
        SnackBar(content: Text(ApiError.desconocido(error).mensaje)),
      );
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final sinPersonal = !_cargandoPersonal && _personal.isEmpty;
    return ListView(
      padding: const EdgeInsets.all(14),
      children: [
        const Text(
          'El cierre de la masiva cierra TODOS sus casos asociados con el mismo '
          'modo y el mismo texto.',
          style: TextStyle(fontSize: 13, color: Colors.black54),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _descripcion,
          minLines: 3,
          maxLines: 6,
          decoration: InputDecoration(
            labelText: 'Descripción del trabajo (obligatoria)',
            hintText: 'Qué se reparó y cómo',
            border: const OutlineInputBorder(),
            errorText: _errorDescripcion,
          ),
        ),
        const SizedBox(height: 12),
        if (_cargandoPersonal)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 8),
            child: LinearProgressIndicator(),
          )
        else if (sinPersonal)
          Card(
            color: Theme.of(context).colorScheme.error.withOpacity(0.08),
            child: const Padding(
              padding: EdgeInsets.all(12),
              child: Text(
                'No hay personal del CRASS activo. Para cerrar la masiva hay que '
                'dar de alta al personal del CRASS en la web (sección de personal '
                'externo) y volver a intentarlo.',
                style: TextStyle(fontSize: 13),
              ),
            ),
          )
        else
          DropdownButtonFormField<int>(
            value: _idValidador,
            isExpanded: true,
            decoration: InputDecoration(
              labelText: 'Validador del CRASS (obligatorio)',
              border: const OutlineInputBorder(),
              errorText: _errorValidador,
            ),
            items: [
              for (final (id, etiqueta) in _personal)
                DropdownMenuItem<int>(value: id, child: Text(etiqueta)),
            ],
            onChanged: (valor) => setState(() {
              _idValidador = valor;
              _errorValidador = null;
            }),
          ),
        if (_errorPersonal != null)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    'No se pudo cargar el personal del CRASS: $_errorPersonal',
                    style: TextStyle(
                      fontSize: 12,
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ),
                TextButton(
                  onPressed: _reintentarPersonal,
                  child: const Text('Reintentar'),
                ),
              ],
            ),
          ),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          value: _modo,
          decoration: const InputDecoration(
            labelText: 'Modo de cierre',
            border: OutlineInputBorder(),
          ),
          items: [
            for (final modo in MasivasService.modosCierre)
              DropdownMenuItem<String>(value: modo, child: Text(modo)),
          ],
          onChanged: (valor) => setState(() => _modo = valor ?? 'IVR'),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _descripcionCaso,
          decoration: InputDecoration(
            labelText: 'Texto que quedará en cada caso',
            helperText: 'Por defecto «${MasivasService.descripcionCasoPorDefecto}»',
            border: const OutlineInputBorder(),
            errorText: _errorCaso,
          ),
        ),
        const SizedBox(height: 12),
        ListaSeriales(
          etiqueta: 'Evidencias del cierre',
          seriales: _seriales,
          onAgregar: (serial) => setState(() => _seriales.add(serial)),
          onQuitar: (serial) => setState(() => _seriales.remove(serial)),
        ),
        const SizedBox(height: 16),
        SizedBox(
          height: 48,
          child: FilledButton.icon(
            icon: const Icon(Icons.task_alt),
            label: Text(
              _enviando
                  ? 'Cerrando la masiva…'
                  : 'Cerrar la masiva y sus $_cantidadCasos caso(s)',
            ),
            onPressed: (_enviando || sinPersonal) ? null : _confirmar,
          ),
        ),
      ],
    );
  }
}

/// Aviso **previo** al cierre: recuerda que se cierran todos los casos asociados.
class DialogoConfirmacionCierreMasiva extends StatelessWidget {
  const DialogoConfirmacionCierreMasiva({
    super.key,
    required this.idFalla,
    required this.cantidadCasos,
    required this.modo,
    required this.descripcionCaso,
  });

  final int idFalla;
  final int cantidadCasos;
  final String modo;
  final String descripcionCaso;

  @override
  Widget build(BuildContext context) {
    final alerta = Theme.of(context).colorScheme.error;
    return AlertDialog(
      title: Text('Cerrar la masiva #$idFalla'),
      content: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Se cerrarán TODOS los $cantidadCasos casos asociados a esta masiva.',
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              'Modo de cierre: $modo\n'
              'Texto que quedará en cada caso: «$descripcionCaso»\n'
              'Los casos que ya estén cerrados se omitirán y se informarán al final.',
            ),
            const SizedBox(height: 10),
            Text(
              'Esta acción no se puede deshacer.',
              style: TextStyle(color: alerta, fontWeight: FontWeight.w600),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, true),
          child: const Text('Cerrar la masiva'),
        ),
      ],
    );
  }
}

/// Resumen del cierre en cascada: cuántos casos se cerraron y cuáles se omitieron.
class ResumenCierreMasiva extends StatelessWidget {
  const ResumenCierreMasiva({super.key, required this.resultado});

  final ResultadoCierreMasiva resultado;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text('Masiva #${resultado.idFalla} · ${resultado.estado}'),
      content: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Casos cerrados: ${resultado.casosCerrados}'),
            Text('Casos omitidos: ${resultado.casosOmitidos}'),
            if (resultado.detalle.isNotEmpty) ...[
              const SizedBox(height: 10),
              const Text('Detalle:', style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              for (final item in resultado.detalle)
                Text(
                  ResultadoCierreMasiva.lineaDetalle(item),
                  style: const TextStyle(fontSize: 12),
                ),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Entendido'),
        ),
      ],
    );
  }
}

// --------------------------------------------------------------------------- #
// Ayudas de formato
// --------------------------------------------------------------------------- #

/// Valor del mapa o `—` cuando viene vacío (la ficha oculta las filas vacías).
String _texto(dynamic valor, {String porDefecto = '—'}) {
  final texto = '${valor ?? ''}'.trim();
  return texto.isEmpty ? porDefecto : texto;
}

/// Fecha ISO del servidor en formato `dd/mm/aaaa hh:mm` (hora local).
String _fecha(dynamic valor) {
  final texto = '${valor ?? ''}'.trim();
  if (texto.isEmpty) return '—';
  final fecha = DateTime.tryParse(texto)?.toLocal();
  if (fecha == null) return texto;
  String dos(int v) => v.toString().padLeft(2, '0');
  return '${dos(fecha.day)}/${dos(fecha.month)}/${fecha.year} '
      '${dos(fecha.hour)}:${dos(fecha.minute)}';
}

/// Lista de evidencias legible o `—`.
String _lista(dynamic valor) {
  if (valor is List && valor.isNotEmpty) {
    return valor.map((elemento) => '$elemento').join(', ');
  }
  return _texto(valor);
}

/// Coordenadas `latitud, longitud` o `—`.
String _coordenadas(dynamic latitud, dynamic longitud) {
  if (latitud == null || longitud == null) return '—';
  return '$latitud, $longitud';
}

/// Normaliza una lista dinámica de mapas.
List<Map<String, dynamic>> _listaDe(dynamic valor) {
  if (valor is! List) return [];
  return valor
      .whereType<Map<String, dynamic>>()
      .map((elemento) => Map<String, dynamic>.from(elemento))
      .toList();
}
