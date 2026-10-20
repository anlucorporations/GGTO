/// Dueño único de la cola offline (D-124 · H-07).
///
/// La cola local (`accion_pendiente`) la procesaban **dos** caminos:
///
///   1. La **CARGA** (`UploadService`), que agrupa cierres, enrutados y evidencias
///      de un diferido en `POST /sync/carga` y los marca **acción por acción**
///      (D-121).
///   2. El **outbox clásico** (`SyncProvider.sincronizar`), que envía cada acción
///      suelta a su endpoint original (y también lo lanza el auto-envío de 5 min).
///
/// Si ambos veían el mismo tipo, la acción salía dos veces (dos cierres y doble
/// juego de evidencias). La regla es **un solo dueño por tipo**: estos tipos solo
/// los envía la CARGA; el outbox los ignora.
library;

/// Tipos cuya única vía de envío es `POST /sync/carga`.
const Set<String> tiposQueSoloVaPorCarga = {
  'CIERRE',
  'ENRUTADO',
  'DIFERIDO_EVIDENCIAS',
};

/// ¿Ese tipo lo envía la CARGA (y por tanto el outbox debe ignorarlo)?
bool esTipoDeCarga(String tipo) => tiposQueSoloVaPorCarga.contains(tipo.trim().toUpperCase());

/// Acciones de la cola que puede enviar el **outbox clásico**.
///
/// Función pura para poder probarla sin SQLite ni red.
List<Map<String, dynamic>> accionesParaOutbox(
  List<Map<String, dynamic>> acciones,
) =>
    acciones.where((accion) => !esTipoDeCarga('${accion['tipo']}')).toList();

/// Cuerpo de la **actividad** de `/sync/carga` para una acción de la cola (D-125).
///
/// `null` cuando la acción no viaja en el lote: su dueño es el outbox clásico
/// (citas, fallas masivas, evidencias sueltas). Es la traducción que fija H-08:
/// las evidencias de un diferido viajan como actividad `CONTACTO` —con sus
/// seriales— y **nunca** como un estado contra `/casos/{id}/estado` (que exigía
/// `estado_actual` y devolvía 422).
Map<String, dynamic>? actividadDeCarga({
  required int idLocal,
  required int idCaso,
  required String tipo,
  required Map<String, dynamic> payload,
  required String fechaHora,
}) {
  switch (tipo.trim().toUpperCase()) {
    case 'CIERRE':
      return {
        'id_actividad_local': idLocal,
        'id_caso': idCaso,
        'tipo': 'CIERRE',
        'resultado': 'EXITOSO',
        'reporte_corto': payload['descripcion'],
        // El cierre de campo guarda el modo (IVR/COS/SACAS) sin conexión; el
        // servidor lo traduce al catálogo para no perderlo.
        'modo': payload['modo'],
        'id_metodo': payload['id_metodo'],
        'id_causa': payload['id_causa'],
        'fecha_hora': fechaHora,
        'evidencias': payload['evidencias'] ?? [],
      };
    case 'ENRUTADO':
      return {
        'id_actividad_local': idLocal,
        'id_caso': idCaso,
        'tipo': 'ENRUTADO',
        'reporte_corto': payload['motivo'],
        'id_metodo': payload['id_metodo'],
        'fecha_hora': fechaHora,
        'evidencias': payload['evidencias'] ?? [],
      };
    case 'DIFERIDO_EVIDENCIAS':
      // H-08: la evidencia del diferido viaja como actividad de CONTACTO. Así
      // queda vinculada a una actividad real y no hay petición al endpoint de
      // estados (la que devolvía 422 y dejaba la acción en ERROR para siempre).
      return {
        'id_actividad_local': idLocal,
        'id_caso': idCaso,
        'tipo': 'CONTACTO',
        'reporte_corto': 'Evidencias del diferido',
        'fecha_hora': fechaHora,
        'evidencias': payload['evidencias'] ?? [],
      };
    default:
      return null;
  }
}

/// Estado objetivo que produce una acción de la cola (D-129).
///
/// `null` si la acción no se traduce en un cambio de estado. Lleva el id local de
/// la acción para que el servidor pueda aplicar el lote en **orden cronológico**
/// (D-129 · H-12): sin él, un CONTACTADO encolado antes de un CIERRE se aplicaba
/// al final y revertía el cierre.
Map<String, dynamic>? estadoDeCarga({
  required int idLocal,
  required int idCaso,
  required String tipo,
  required Map<String, dynamic> payload,
}) {
  switch (tipo.trim().toUpperCase()) {
    case 'CONTACTADO':
    case 'CITADO':
    case 'DIFERIDO':
    case 'ESTADO':
      // El payload de `_enviarEstado` trae `estado_actual`; si viene vacío (cola
      // antigua), se usa el tipo local como estado objetivo.
      final objetivo = (payload['estado_actual'] ?? tipo).toString();
      return {
        'id_actividad_local': idLocal,
        'id_caso': idCaso,
        'estado_nuevo': objetivo,
        'motivo': payload['motivo_estado'],
      };
    default:
      return null;
  }
}
