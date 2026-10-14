# Estado real y auditoría documental — GGTO V2

**Fecha de corte:** 2026-10-13 · **Ámbito:** checkout local, código fuente, documentos, remotos Git y metadatos de GCP consultables en esta sesión.

## Veredicto ejecutivo

**GGTO V2 todavía no está entregado y la APK de gestión pedida sigue incompleta.** El checkout local ahora contiene navegación y pantallas de gestión para Monitoreo, GESTIÓN/CASOS, despacho, casos especiales, alertas/materiales y envío de mensajes de Coordinación, además de cambios en las vistas web. `flutter analyze` y `npm run build` terminan correctamente. No se generó un APK: los intentos debug agotaron la memoria disponible durante Gradle/Dart. El binario publicado continúa sin acreditar estos cambios locales.

La V1 continúa desplegada. El estado del checkout, el código fuente y el servicio en producción se registran por separado en este informe para no confundir una implementación local con una entrega publicada. Faltan pruebas RBAC negativas y de persistencia, migración DDL, completar el flujo de despacho por sectores, verificar la WEB por rol, probar los flujos con datos y producir la APK firmada.

## Evidencia y límites de la auditoría

- Checkout en rama `GGTOv2-DSH-GCP`, HEAD `d140af5`; remotos configurados: `git@github.com:anlucorporations/GGTO.git` y `git@gitlab.com:anlucorporations/ggto.git`.
- El árbol de trabajo tiene más de cien archivos modificados o sin seguimiento. Los cambios locales no equivalen a un commit, una publicación ni un despliegue.
- No se leyeron archivos de credenciales ni valores secretos.
- La inspección fue estática, más consultas de solo lectura a GCP. En esta continuación se ejecutaron análisis/compilaciones de cliente y compilación sintáctica de rutas Python; no se ejecutó la suite automatizada ni se consultó o migró la base productiva. Los resultados de pruebas citados son artefactos históricos del repositorio.

## Despliegue observado en GCP

| Recurso | Evidencia observada | Lectura correcta |
|---|---|---|
| Proyecto configurado en gcloud | `truekeate-main` | Es el proyecto consultado en esta sesión; no se debe sustituir por el identificador lógico/base `ggtov2`. |
| Cloud Run | Servicio `ggto-web`, `europe-west1`, revisión lista `ggto-web-00039-g9n`, imagen `v24`, 100 % del tráfico | Servicio activo. La imagen desplegada no acredita el código local no comprometido. |
| Política IAM directa del servicio | `roles/run.invoker` incluye `allUsers` | El servicio admite invocación pública a nivel Cloud Run. La autenticación JWT de las rutas de negocio es una capa distinta; no se afirma que toda API entregue datos sin token. |
| Cloud SQL | `truekeate-db-dev`, `southamerica-east1`, PostgreSQL 15, estado `RUNNABLE` | La instancia existe y está activa. La consulta no verificó filas, tablas desplegadas ni configuración PITR. |
| Respaldo automático | `settings.backupConfiguration.enabled=false` | No hay backup automático habilitado en la configuración consultada. |

## Arquitectura real del checkout

```text
React SPA (app/web) ─┐
                     ├── FastAPI /api/v1 ── SQLAlchemy ── PostgreSQL
Flutter Android ─────┘          │
                                ├── carga/descarga offline del TÉCNICO
                                ├── mensajes y alertas
                                └── notificaciones / Telegram / MCP
```

La API FastAPI y la SPA React comparten la imagen de Cloud Run. Flutter tiene su propio binario Android y almacenamiento SQLite. El esquema físico es `RepoTecnico/db/schema.sql`; el ORM está bajo `app/models/`.

## Matriz de capacidad solicitada para V2

| Área | Evidencia actual | Estado real |
|---|---|---|
| Una sola APK para cinco roles | El código local mantiene `1.1.0+9`, dirige al TÉCNICO a su lista de campo, y a los roles de gestión a `InicioGestionScreen`; `/monitoreo` y `/gestion` tienen guardias de rol. | **Esqueleto de navegación local; no compilado/publicado, ni verificado para los cinco roles.** |
| TÉCNICO | Casos, contacto/atención, evidencias por cámara, carga/descarga manual, alertas y mensajería. | **Implementado en la línea actual**, sujeto al estado de cambios locales y a las pruebas históricas indicadas abajo. |
| SUPERVISOR / ADMIN en APK | Flutter local ofrece cinco vistas de monitoreo, la bandeja GESTIÓN (`en_gestion_supervisor=true`) y CASOS de la central. Ambas listas muestran ficha de datos y permiten asignar/quitar del despacho del día. | **Implementación parcial; faltan Especiales, Despacho completo, caché offline y verificación funcional.** |
| COORDINADOR en APK y web | Flutter local dirige al Coordinador a Monitoreo y oculta GESTIÓN. La web aún no declara el rol en `RolAsignable` ni lo muestra en `Layout`. | **Monitoreo local parcial; especiales, fallas/materiales, alertas, mensajería y web siguen pendientes.** |
| SUPER en APK | El backend concede bypass global al rol `SUPER`; la APK no tiene navegación ni pantalla de auditoría por rol. | **Pendiente en APK.** |
| Catálogo de rol COORDINADOR | `schema.sql` ahora siembra COORDINADOR y existe `scripts/migrar_d95_coordinador_mensajeria.py` en simulación por defecto. La migración todavía no se ha ejecutado ni contrastado con PostgreSQL. | **Preparado localmente; pendiente simulación/aplicación controlada.** No se consultó el estado del catálogo productivo. |
| Alta de especiales y orden de material por COORDINADOR | `POST /casos-especiales` usa `_especial_alta`; `POST /fallas-masivas/{id}/material` usa `_material`. Las demás escrituras de fallas conservan `_escritura` (ADMIN/SUPERVISOR). | **Guard local conectado; pruebas RBAC aún pendientes.** |
| Mensaje COORDINADOR → SUPERVISOR | ORM y `schema.sql` local admiten `id_usuario_destino`, destino SUPERVISOR y destinatarios polimórficos; hay migración D-95 local para actualizar una BD existente. No se ejecutó la migración. | **Contrato local alineado; migración y recorrido persistente pendientes de verificación.** |
| Monitoreo requerido por V2 | La API base expone diaria, semanal y construcción. En el checkout local se añadieron `GET /monitoreo/mensual`, `/monitoreo/casos-especiales` y `/monitoreo/construcciones`, con central derivada/validada contra el usuario autenticado. La APK local ofrece el selector de las cinco vistas y un temporizador en primer plano. | **Implementación parcial local; faltan pruebas, caché offline, navegación de módulos de gestión y verificación de datos/API. No está desplegado ni empaquetado.** |
| Identificador de pago | Modelo, servicio, integración con casos/ingesta, métricas y cambios en web/Flutter existen localmente. No se registró un router `/pagos`; esa API de ciclo de vida sigue diferida. | **Implementación parcial; `GET /auditoria` sí existe en el checkout local, pero no está en Cloud Run v24.** |
| Esquema / ORM | El DDL local tiene **41 tablas**; hay **36 tablas mapeadas** por SQLAlchemy y cinco sin modelo declarativo: `incidente`, `insumo`, `inventario_movimiento`, `orden_material_detalle`, `sincronizacion`. | **El diccionario inicial y varios manuales están desactualizados.** |

### Brechas concretas que impiden declarar D-95 terminado

1. La migración D-95 y el DDL actualizado existen localmente, pero no se han simulado contra la base objetivo ni ejecutado; faltan respaldo/rollback verificados y pruebas RBAC.
2. La mensajería fue alineada en ORM, DDL local y migración; falta verificar el recorrido con base de datos, incluyendo bandejas y lectura por Supervisor.
3. Los guards de alta de especiales, solicitud de material, reporte de campo y lectura de casos se ajustaron localmente; las pruebas RBAC por rol siguen pendientes.
4. La web no incluye COORDINADOR en su unión de roles ni en su menú.
5. La APK enruta al Técnico al flujo de campo y los roles de gestión al home de Monitoreo; ADMIN/SUPERVISOR tienen pantallas GESTIÓN y CASOS con consulta/asignación. Faltan el resto de módulos operativos, caché offline particionada/purgada, FLAG_SECURE y pruebas de la app de gestión.

## Base de pruebas disponible

- `RepoTecnico/pruebas/logs/pytest-resultados.txt` registra **195 passed** el **2026-09-29**; esa ejecución duró 1:01:03 y no cubre los cambios locales posteriores.
- `RepoTecnico/pruebas/logs/e2e-resultados.json` registra ejecución del **2026-10-10**: 112 resultados `expected`, 11 `unexpected`, cero `skipped` y cero `flaky`.
- No se volvió a ejecutar ninguna prueba en esta auditoría. Por tanto, la documentación no debe presentar los logs como verificación de la versión candidata V2.

## Riesgos operativos y de seguridad comprobados

- La política de Cloud Run concede invocación a `allUsers`; debe restringirse antes de tratar la plataforma con datos reales como un entorno privado.
- Los backups automáticos de Cloud SQL están deshabilitados en la configuración consultada.
- La política RLS en `schema.sql` permite filas cuando no existe `app.id_central`; el backend fija ese contexto durante la autenticación solo cuando el usuario tiene central asignada. Debe verificarse el comportamiento de todos los accesos y jobs antes de afirmar aislamiento por central.
- `app/core/config.py` conserva valores por defecto de desarrollo para `SECRET_KEY` y CORS. No se inspeccionaron secretos de Cloud Run; no se afirma que producción esté usando esos valores por defecto.
- El proyecto activo de gcloud (`truekeate-main`) y la base lógica documentada (`ggtov2`) son nombres distintos; las guías deben explicar la diferencia y evitar llamar `ggtov2` al proyecto GCP sin evidencia.

## Documentación que debe gobernar el estado

1. Este informe fija la matriz de verdad de la auditoría V2.
2. [`estado_proyecto.md`](estado_proyecto.md) resume el estado vigente y conserva la bitácora antigua como histórica.
3. [`requerimientos.md`](requerimientos.md) define la línea V1, las ampliaciones D-89…D-94 y el objetivo V2, separando requisitos de implementación.
4. [`incremento_D95_apk_gestion.md`](incremento_D95_apk_gestion.md), [`documento_tecnico_D95.md`](documento_tecnico_D95.md) y [`plan_desarrollo_D95_D98.md`](plan_desarrollo_D95_D98.md) son especificación/plan; no certifican entrega.
5. El DDL local es la fuente física de 41 tablas; el ORM documenta solo 36. La instancia desplegada y sus datos requieren verificación independiente antes de declarar paridad.

## Criterio para cerrar V2

No declarar V2 terminada hasta que exista una APK única con navegación y permisos comprobados para los cinco roles; catálogo/migración compatibles; endpoints y guards coherentes con la matriz RBAC; vistas requeridas en API, web y APK; aislamiento de datos y caché probado; pruebas actuales en verde; manuales y PDF regenerados; y un artefacto firmado y despliegue identificables por versión/revisión.
