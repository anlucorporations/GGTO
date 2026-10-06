# Propuesta de mejora — APK «GGTO Técnico» (`app_movil`)

| Campo | Valor |
|---|---|
| **Tipo de propuesta** | Mejora funcional y de marca (Ciclo 8 continuación) |
| **Fase** | Fase 3 — Desarrollo (propuesta pendiente de aprobación) |
| **Fecha** | 2026-10-01 |
| **Estado** | Propuesta técnica — pendiente de aprobación |
| **Requisitos cubiertos** | RNF-06 (offline), RF-11 (casos de la cuadrilla), RF-14 (evidencias), RF-20 (12 palabras), H-19 (enrolamiento) |

---

## 1. Sincronización selectiva por cuadrilla

### 1.1 Objetivo

Al sincronizar, **descargar únicamente los casos asignados a la cuadrilla** del técnico autenticado. El objetivo es que el técnico disponga de **toda la información de sus casos** para operar **sin conexión** (RNF-06), sin saturar el dispositivo con casos ajenos.

### 1.2 Estado actual

El endpoint `GET /casos?estado_actual=ASIGNADO` **no filtra por cuadrilla**: devuelve todos los casos asignados del sistema. El backend no expone `id_cuadrilla` ni `id_tecnico` en el listado de casos.

**Corrección necesaria en el backend:**

| Cambio | Endpoint | Detalle |
|---|---|---|
| **Nuevo** | `GET /casos/mis-casos` | Devuelve los casos del técnico autenticado, forzando `id_tecnico` desde el JWT. |
| **O modificar** | `GET /casos` | Añadir parámetro `mis_casos=true` que fuerce `id_tecnico=token`. |

**Corrección en la APK:**

| Cambio | Archivo | Detalle |
|---|---|---|
| **Sustituir** | `casos_provider.dart` | `GET /casos/mis-casos` (o `GET /casos?mis_casos=true`) en lugar de `GET /casos?estado_actual=ASIGNADO`. |
| **Añadir** | `casos_provider.dart` | Al recibir la lista, guardar **todos los casos** en la caché local (`caso_local`) y marcar el timestamp de descarga. |
| **Añadir** | `casos_screen.dart` | Indicador de «datos actualizados el [fecha]» y botón «Descargar casos de mi cuadrilla». |

### 1.3 Flujo de trabajo del técnico

```text
Inicio de jornada (con red)
  └─► Sincronización de descarga → caché local actualizado
  └─► Trabajo en campo (sin red)
        └─► Lectura de casos desde la caché local
        └─► Registro de acciones en la cola offline
  └─► Fin de jornada (con red)
        └─► Sincronización de carga → envío de acciones y evidencias
```

---

## 2. Pantalla de sincronización con opciones

### 2.1 DESCARGA

| Aspecto | Detalle |
|---|---|
| **Qué hace** | Busca los casos asignados a la cuadrilla del técnico y los agrega al registro local, **añadiendo solo los casos nuevos** (no sobrescribe los que ya existen localmente con cambios pendientes). |
| **Lógica** | `SELECT id_averia FROM caso_local` → compara con la lista del servidor → inserta solo los nuevos (`id_averia` no está en la caché). |
| **Salida** | `nuevos: X · actualizados: Y · sin cambios: Z` |
| **Estado del caso** | Solo se actualizan los casos que **no tienen acciones pendientes** en la cola (los que sí las tienen se consideran «en trabajo» y se conservan). |

### 2.2 CARGA

| Aspecto | Detalle |
|---|---|
| **Qué hace** | Envía **todo el trabajo del día** al servidor: acciones de la cola + evidencias. |
| **Subpasos** | 1. **Empaquetar evidencias**: todas las fotos tomadas hoy se agrupan en un ZIP (`evidencias-{central}-{cuadrilla}-{fecha}.zip`). |
| | 2. **Subir ZIP**: `POST /sync/jornada` con el archivo multipart. |
| | 3. **Confirmar**: el servidor responde con los IDs de actividad registrados. |
| | 4. **Limpiar**: marca las evidencias como `subida=1` y borra las acciones sincronizadas. |

**Corrección necesaria en el backend:**

| Endpoint | Método | Detalle |
|---|---|---|
| `POST /sync/jornada` | Multipart | Recibe el ZIP del día, descomprime, registra las evidencias en `evidencia_local` y devuelve `{ok, actividades: [...], errores: [...]}`. |
| `GET /sync/jornada/estado` | JSON | Confirma si una jornada ya fue recibida (idempotencia). |

### 2.3 Diseño de la pantalla

```
┌─────────────────────────────────────────┐
│  ┌─────────┐                            │
│  │ LOGO    │  PLANTA EXTERNA GPON      │
│  │ CANTV   │                            │
│  └─────────┘                            │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  OPCIÓN DE SINCRONIZACIÓN        │    │
│  │                                 │    │
│  │  ○ DESCARGA                     │    │
│  │    Busca los casos de mi        │    │
│  │    cuadrilla y los agrega       │    │
│  │    al dispositivo               │    │
│  │                                 │    │
│  │  ○ CARGA                        │    │
│  │    Envía el trabajo del día     │    │
│  │    (acciones + evidencias)      │    │
│  │                                 │    │
│  │  [ Sincronizar ]                │    │
│  │                                 │    │
│  │  Última descarga: 01/10 07:30   │    │
│  │  Casos locales: 12 · Pendientes:│    │
│  │  3 acciones · 5 evidencias      │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ─────────────────────────────────────  │
│  APK en Desarrollo · Desarrollado por   │
│  Ing. Angel Lucci · Uso confidencial    │
│  CANTV-GGTO · 2026                      │
└─────────────────────────────────────────┘
```

---

## 3. Branding y disclaimer

### 3.1 Logo y título

| Elemento | Ubicación | Detalle |
|---|---|---|
| **Logo** | `app_movil/assets/logo_cantv.png` | Centrado, 120×120 px. **Nota:** el archivo `docs/imagenes/logo_CANTV.png` **no existe en el proyecto**; se debe proporcionar o se usará un placeholder generado. |
| **Título** | Debajo del logo | «PLANTA EXTERNA GPON» en negrita, color `--azul` (#1565C0). |
| **Aparece en** | Pantalla de acceso (login) y pantalla de sincronización | Consistencia de marca en los dos puntos de entrada de la app. |

### 3.2 Footer

| Texto | `APK en Desarrollo · Desarrollado por ING. Angel Lucci · Uso confidencial de CANTV-GGTO · 2026` |
|---|---|
| **Ubicación** | Pie de la pantalla de login y de la pantalla de sincronización |
| **Estilo** | Texto pequeño, gris oscuro, centrado |

### 3.3 Disclaimer en la APK

El disclaimer (`disclaimer.txt`, ya empaquetado como asset) se incorpora como **mensaje de texto seleccionable** dentro de la pantalla de sincronización, accesible con el botón «Ver aviso de uso restringido». Esto asegura que el usuario puede consultar el texto completo sin necesidad de reiniciar la app.

---

## 4. Casos de uso

### CU-SYNC-01 — Descargar casos de mi cuadrilla

**Actor:** Técnico de campo  
**Precondición:** El técnico está autenticado y tiene conexión a internet.  
**Flujo principal:**
1. El técnico abre la pantalla de sincronización y selecciona «DESCARGA».
2. La app llama a `GET /casos/mis-casos` (o `GET /casos?mis_casos=true`).
3. El servidor devuelve la lista de casos asignados a la cuadrilla del técnico.
4. La app compara con la caché local:
   - Si `id_averia` no existe localmente → inserta el caso completo.
   - Si `id_averia` existe y el caso no tiene acciones pendientes → actualiza los datos.
   - Si `id_averia` existe y tiene acciones pendientes → lo deja intacto (evita sobrescribir trabajo local).
5. La app muestra el resumen: `nuevos: X · actualizados: Y · sin cambios: Z`.

**Criterios de aceptación (Gherkin):**
```gherkin
Dado que el técnico tiene 3 casos locales sin acciones pendientes
Cuando sincroniza con «DESCARGA» y el servidor tiene 5 casos asignados
Entonces la caché local pasa a 5 casos
Y los 3 casos locales sin pendientes se actualizan con los datos del servidor
Y los 2 casos nuevos se agregan a la lista
Y la fecha de descarga se registra en la interfaz
```

### CU-SYNC-02 — Cargar el trabajo del día

**Actor:** Técnico de campo  
**Precondición:** El técnico ha trabajado en campo y tiene acciones pendientes y/o evidencias sin enviar.  
**Flujo principal:**
1. El técnico selecciona «CARGA».
2. La app agrupa las evidencias del día en un ZIP con el manifiesto.
3. La app envía el ZIP a `POST /sync/jornada`.
4. Si el servidor confirma (`200` + `{ok: true}`):
   - Las evidencias se marcan como `subida=1`.
   - Las acciones sincronizadas se eliminan de la cola.
   - La app muestra `Trabajo del día enviado: X acciones · Y evidencias`.
5. Si el servidor falla (`500` o timeout):
   - El ZIP se conserva y se reintenta automáticamente (backoff).
   - La cola muestra `Jornada pendiente de confirmación`.

**Criterios de aceptación (Gherkin):**
```gherkin
Dado que el técnico tiene 4 acciones pendientes y 7 evidencias sin subir
Cuando selecciona «CARGA» con conexión disponible
Entonces el ZIP contiene 7 evidencias y el manifiesto con las 4 acciones
Y el servidor registra las acciones en `actividad`
Y la cola local queda vacía
Y la app muestra «Trabajo del día enviado»
```

### CU-SYNC-03 — Ver disclaimer desde la app

**Actor:** Cualquier usuario de la APK  
**Precondición:** El usuario está en la pantalla de acceso o en la de sincronización.  
**Flujo principal:**
1. El usuario pulsa «Ver aviso de uso restringido».
2. La app muestra el texto completo del disclaimer (desde `assets/disclaimer.txt`) en un diálogo modal con scroll y opción de copiar.

**Criterios de aceptación (Gherkin):**
```gherkin
Dado que el usuario está en la pantalla de sincronización
Cuando pulsa «Ver aviso de uso restringido»
Entonces se muestra el texto completo del disclaimer
Y el texto es seleccionable y copiable
Y el diálogo se cierra con el botón «Entendido»
```

---

## 5. Trazabilidad

| RF/RNF | Caso de uso | Estado |
|---|---|---|
| RNF-06 | CU-SYNC-01, CU-SYNC-02 | Propuesto |
| RF-11 | CU-SYNC-01 | Propuesto |
| RF-14 | CU-SYNC-02 | Propuesto |
| RF-20 | CU-SYNC-03 | Propuesto |
| H-19 | CU-SYNC-01 | Propuesto |
| RF-12 | CU-SYNC-02 (cierre con cita) | Propuesto |

---

## 6. Estimación de esfuerzo

| Tarea | Esfuerzo | Dependencias |
|---|---|---|
| Endpoint `GET /casos/mis-casos` | 2 h | Backend |
| Descarga selectiva en la APK | 4 h | Backend (0.2) |
| Endpoint `POST /sync/jornada` | 4 h | Backend |
| Carga de evidencias en la APK | 4 h | Backend (0.3) |
| Pantalla de sincronización con opciones | 4 h | — |
| Logo y footer en login/sync | 2 h | Logo CANTV |
| Disclaimer en la APK | 1 h | — |
| Pruebas (descarga/carga/offline) | 8 h | — |
| **Total** | **~29 h** | |

---

## 7. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| El backend no expone el filtro por cuadrilla | **Alto** — la descarga no funciona | Priorizar el endpoint `GET /casos/mis-casos` (0.2) |
| El logo de CANTV no está en el proyecto | **Medio** — la pantalla queda sin marca | Solicitar el archivo o generar un placeholder con las siglas «CANTV» |
| La carga de evidencias es lenta en 3G | **Medio** — el ZIP puede tardar | Comprimir a JPEG 70% (ya implementado) y mostrar progreso |
| El técnico sincroniza y borra trabajo local | **Alto** — pérdida de datos | La descarga **nunca sobrescribe** casos con acciones pendientes; la carga solo borra tras confirmación del servidor |

---

## 8. Próximos pasos

1. **Aprobación del usuario** de esta propuesta.
2. **Proporcionar el logo de CANTV** (`docs/imagenes/logo_CANTV.png` o similar).
3. **Priorizar el backend**: `GET /casos/mis-casos` y `POST /sync/jornada`.
4. **Implementar** la APK con las correcciones indicadas.
5. **Verificar** en dispositivo: descarga, trabajo offline, carga al final del día.

---

*Documento generado para la Fase 3 — Ciclo 8 de la APK. La implementación se documentará en `estado_proyecto.md` como D-74 una vez aprobada y ejecutada.*
