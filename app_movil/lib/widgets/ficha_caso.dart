import 'package:flutter/material.dart';

import 'estado_chip.dart';

/// Bloques de una **ficha** (D-87 · M-07): CABECERA, CUERPO y PIE.
///
/// - [FichaCabecera] identifica el caso (nombre y teléfono) y ofrece **Editar**.
/// - [FichaCuerpo] es el área desplazable: grupos desplegables ([FichaSeccion])
///   y cualquier contenido extra (p. ej. el conteo de imágenes de D-88).
/// - [FichaPie] queda **fijo** al fondo con las acciones del estado y el aviso de
///   sincronización pendiente.
///
/// La cabecera y el pie no se desplazan: el técnico siempre ve de quién es la
/// ficha y qué puede hacer, sin importar lo larga que sea la información.

/// CABECERA: identifica la ficha y permite editarla.
class FichaCabecera extends StatelessWidget {
  const FichaCabecera({
    super.key,
    required this.nombre,
    required this.telefono,
    required this.estado,
    this.pendienteSync = false,
    this.onEditar,
  });

  final String nombre;
  final String telefono;
  final String estado;

  /// Hay cambios guardados en el dispositivo sin enviar (D-85).
  final bool pendienteSync;

  /// Icono **Editar** (dirección y número de contacto · D-88).
  final VoidCallback? onEditar;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    return Material(
      color: tema.colorScheme.surface,
      elevation: 1,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 10, 6, 10),
        child: Row(
          children: [
            const CircleAvatar(radius: 18, child: Icon(Icons.person, size: 20)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    nombre,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      if (telefono.trim().isNotEmpty) ...[
                        const Icon(Icons.call, size: 14, color: Colors.black54),
                        const SizedBox(width: 4),
                        Text(telefono, style: const TextStyle(fontSize: 13)),
                        const SizedBox(width: 10),
                      ],
                      EstadoChip(estado: estado),
                    ],
                  ),
                ],
              ),
            ),
            IconButton(
              tooltip: 'Editar dirección y contacto',
              icon: const Icon(Icons.edit),
              onPressed: onEditar,
            ),
          ],
        ),
      ),
    );
  }
}

/// CUERPO: área desplazable con los grupos de información del caso.
class FichaCuerpo extends StatelessWidget {
  const FichaCuerpo({super.key, required this.hijos});

  final List<Widget> hijos;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 16),
      children: hijos,
    );
  }
}

/// Grupo de la ficha: cada grupo es una ficha detalle que se despliega (M-07).
class FichaSeccion extends StatelessWidget {
  const FichaSeccion({
    super.key,
    required this.titulo,
    required this.filas,
    this.icono,
    this.abierta = false,
  });

  final String titulo;
  final List<(String, String)> filas;
  final IconData? icono;

  /// Si el grupo arranca desplegado (el primero suele estarlo).
  final bool abierta;

  @override
  Widget build(BuildContext context) {
    final visibles =
        filas.where((f) => f.$2.trim().isNotEmpty && f.$2 != '—').toList();
    if (visibles.isEmpty) return const SizedBox.shrink();

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      clipBehavior: Clip.antiAlias,
      child: ExpansionTile(
        initiallyExpanded: abierta,
        leading: icono == null ? null : Icon(icono, size: 20),
        title: Text(
          titulo,
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
        ),
        childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        children: [
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
    );
  }
}

/// PIE: acciones del estado y estado de la sincronización.
class FichaPie extends StatelessWidget {
  const FichaPie({
    super.key,
    this.acciones = const [],
    this.nota,
    this.pendienteSync = false,
    this.sinConexion = false,
  });

  final List<Widget> acciones;

  /// Texto que explica por qué no hay acciones (caso cerrado, diferido…).
  final String? nota;

  final bool pendienteSync;
  final bool sinConexion;

  @override
  Widget build(BuildContext context) {
    final hayNota = nota != null && nota!.trim().isNotEmpty;
    return Material(
      color: Theme.of(context).colorScheme.surface,
      elevation: 8,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (hayNota)
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Text(
                    nota!,
                    style: const TextStyle(fontSize: 12, color: Colors.black54),
                  ),
                ),
              ...acciones,
              if (pendienteSync)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        sinConexion ? Icons.cloud_off : Icons.cloud_upload_outlined,
                        size: 14,
                        color: Colors.black54,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        sinConexion
                            ? 'Sin conexión: los cambios se enviarán al sincronizar'
                            : 'Cambios pendientes de sincronizar',
                        style: const TextStyle(fontSize: 11, color: Colors.black54),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
