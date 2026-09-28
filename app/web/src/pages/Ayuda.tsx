/**
 * Página AYUDA — manual navegable del sistema GGTO.
 *
 * Presenta el índice de temas -> secciones -> sub-secciones de los manuales
 * publicados en `app/web/public/manual/` (copiados de `docs/Manuales/`). Cada
 * sección se puede abrir como HTML estilizado (pestaña nueva, con salto directo
 * a cada sub-sección por ancla) o descargar como PDF.
 *
 * Accesible para cualquier usuario autenticado: la ruta vive dentro del bloque
 * protegido de `App.tsx`.
 *
 * El índice (temas, títulos y sub-secciones) se generó a partir del árbol real
 * de `docs/Manuales/`; si se agregan o renombran manuales hay que regenerarlo.
 */
import { useMemo, useState } from 'react';
import { IconoAyuda } from '../components/Iconos';

interface Subseccion {
  /** Número de la sub-sección dentro del manual (1, 2, 3...). */
  num: string;
  titulo: string;
  /** Ancla del encabezado dentro del HTML. */
  ancla: string;
}

interface Seccion {
  titulo: string;
  /** Ruta del manual HTML servido desde `public/manual/`. */
  archivo: string;
  /** Ruta del PDF descargable. */
  pdf: string;
  subsecciones: Subseccion[];
}

interface Tema {
  nombre: string;
  descripcion: string;
  secciones: Seccion[];
}

const TEMAS: Tema[] = [
  {
    nombre: 'Tecnología',
    descripcion: 'Visión general de la plataforma y del stack tecnológico (backend Python/FastAPI y web React).',
    secciones: [
      {
        titulo: 'Plataforma GGTO — Visión general y arquitectura',
        archivo: '/manual/01-Tecnologia/01-plataforma.html',
        pdf: '/manual/pdf/01-Tecnologia/01-plataforma.pdf',
        subsecciones: [
          { num: '1', titulo: 'Empezar en 5 minutos', ancla: 'empezar-en-5-minutos' },
          { num: '2', titulo: 'Visión general del sistema', ancla: 'vision-general-del-sistema' },
          { num: '3', titulo: 'Arquitectura de componentes', ancla: 'arquitectura-de-componentes' },
          { num: '4', titulo: 'Flujo de una operacion tipica (peticion -> middleware -> router -> servicio -> BD)', ancla: 'flujo-de-una-operacion-tipica-peticion-middleware-router-ser' },
          { num: '5', titulo: 'Despliegue en GCP', ancla: 'despliegue-en-gcp' },
        ],
      },
      {
        titulo: 'Stack del backend GGTO',
        archivo: '/manual/01-Tecnologia/02-stack-backend.html',
        pdf: '/manual/pdf/01-Tecnologia/02-stack-backend.pdf',
        subsecciones: [
          { num: '1', titulo: 'Empezar en 5 minutos', ancla: 'empezar-en-5-minutos' },
          { num: '2', titulo: 'Stack del backend', ancla: 'stack-del-backend' },
          { num: '3', titulo: 'Organizacion en capas', ancla: 'organizacion-en-capas' },
          { num: '4', titulo: 'Middleware y observabilidad', ancla: 'middleware-y-observabilidad' },
          { num: '5', titulo: 'Configuracion por entorno (app/core/config.py:8-47)', ancla: 'configuracion-por-entorno-app-core-config-py-8-47' },
          { num: '6', titulo: 'Montaje de la SPA y deep links (app/main.py:91-105)', ancla: 'montaje-de-la-spa-y-deep-links-app-main-py-91-105' },
        ],
      },
      {
        titulo: 'Stack del frontend GGTO (SPA React)',
        archivo: '/manual/01-Tecnologia/03-stack-frontend.html',
        pdf: '/manual/pdf/01-Tecnologia/03-stack-frontend.pdf',
        subsecciones: [
          { num: '1', titulo: 'Empezar en 5 minutos', ancla: 'empezar-en-5-minutos' },
          { num: '2', titulo: 'Stack de la SPA', ancla: 'stack-de-la-spa' },
          { num: '3', titulo: 'Estructura del proyecto web', ancla: 'estructura-del-proyecto-web' },
          { num: '4', titulo: 'Enrutado y proteccion', ancla: 'enrutado-y-proteccion' },
          { num: '5', titulo: 'Cliente HTTP y tipos', ancla: 'cliente-http-y-tipos' },
          { num: '6', titulo: 'Graficos SVG propios', ancla: 'graficos-svg-propios' },
          { num: '7', titulo: 'Constructor y salida (npm run build -> app/web/dist, servida por FastAPI)', ancla: 'constructor-y-salida-npm-run-build-app-web-dist-servida-por-' },
          { num: '8', titulo: 'Estado actual y pendientes (accesibilidad RNF-23, pruebas de UI: pendiente de confirmar)', ancla: 'estado-actual-y-pendientes-accesibilidad-rnf-23-pruebas-de-u' },
        ],
      },
    ],
  },
  {
    nombre: 'Dependencias',
    descripcion: 'Inventario de las librerías de las que depende el sistema, con versión, uso en el proyecto y licencia.',
    secciones: [
      {
        titulo: 'Dependencias del backend GGTO',
        archivo: '/manual/02-Dependencias/01-backend.html',
        pdf: '/manual/pdf/02-Dependencias/01-backend.pdf',
        subsecciones: [
          { num: '1', titulo: 'Empezar en 5 minutos', ancla: 'empezar-en-5-minutos' },
          { num: '2', titulo: 'Fuentes de dependencias', ancla: 'fuentes-de-dependencias' },
          { num: '3', titulo: 'Dependencias de ejecución', ancla: 'dependencias-de-ejecucion' },
          { num: '4', titulo: 'Dependencias de desarrollo', ancla: 'dependencias-de-desarrollo' },
          { num: '5', titulo: 'Riesgo de versiones no fijadas', ancla: 'riesgo-de-versiones-no-fijadas' },
          { num: '6', titulo: 'Herramientas de calidad y su invocación', ancla: 'herramientas-de-calidad-y-su-invocacion' },
        ],
      },
      {
        titulo: 'Dependencias del frontend GGTO',
        archivo: '/manual/02-Dependencias/02-frontend.html',
        pdf: '/manual/pdf/02-Dependencias/02-frontend.pdf',
        subsecciones: [
          { num: '1', titulo: 'Empezar en 5 minutos', ancla: 'empezar-en-5-minutos' },
          { num: '2', titulo: 'Fuentes', ancla: 'fuentes' },
          { num: '3', titulo: 'Dependencias de ejecución', ancla: 'dependencias-de-ejecucion' },
          { num: '4', titulo: 'Dependencias de desarrollo', ancla: 'dependencias-de-desarrollo' },
          { num: '5', titulo: 'Scripts npm y su efecto', ancla: 'scripts-npm-y-su-efecto' },
          { num: '6', titulo: 'Configuración de TypeScript y Vite', ancla: 'configuracion-de-typescript-y-vite' },
          { num: '7', titulo: 'Ausencia de librería de gráficos externa', ancla: 'ausencia-de-libreria-de-graficos-externa' },
        ],
      },
    ],
  },
  {
    nombre: 'Implementación',
    descripcion: 'Cómo está construida cada funcionalidad: autenticación y RBAC, configuración, ingesta, panel y casos, despacho, especiales y agenda, monitoreo, alertas y el inventario de la API.',
    secciones: [
      {
        titulo: 'Manual de implementación: autenticación y RBAC',
        archivo: '/manual/03-Implementacion/01-autenticacion-y-rbac.html',
        pdf: '/manual/pdf/03-Implementacion/01-autenticacion-y-rbac.pdf',
        subsecciones: [
          { num: '1', titulo: 'Empezar en 5 minutos', ancla: 'empezar-en-5-minutos' },
          { num: '2', titulo: 'Visión general', ancla: 'vision-general' },
          { num: '3', titulo: 'Primitivas de seguridad', ancla: 'primitivas-de-seguridad' },
          { num: '4', titulo: 'Endpoints de autenticación', ancla: 'endpoints-de-autenticacion' },
          { num: '5', titulo: 'Bloqueo y rate limiting', ancla: 'bloqueo-y-rate-limiting' },
          { num: '6', titulo: 'Sesión y token', ancla: 'sesion-y-token' },
          { num: '7', titulo: 'RBAC', ancla: 'rbac' },
          { num: '8', titulo: 'Super Usuario', ancla: 'super-usuario' },
          { num: '9', titulo: 'Pruebas', ancla: 'pruebas' },
        ],
      },
      {
        titulo: 'Manual de implementación: módulo CONFIGURACIÓN',
        archivo: '/manual/03-Implementacion/02-configuracion.html',
        pdf: '/manual/pdf/03-Implementacion/02-configuracion.pdf',
        subsecciones: [
          { num: '1', titulo: 'Empezar en 5 minutos', ancla: 'empezar-en-5-minutos' },
          { num: '2', titulo: 'Visión general', ancla: 'vision-general' },
          { num: '3', titulo: 'Endpoints por recurso', ancla: 'endpoints-por-recurso' },
          { num: '4', titulo: 'Esquemas de entrada/salida (app/schemas/config.py)', ancla: 'esquemas-de-entrada-salida-app-schemas-config-py' },
          { num: '5', titulo: 'Modelos y tablas', ancla: 'modelos-y-tablas' },
          { num: '6', titulo: 'RBAC de escritura de configuración', ancla: 'rbac-de-escritura-de-configuracion' },
          { num: '7', titulo: 'Validez y errores (409/404/422)', ancla: 'validez-y-errores-409-404-422' },
          { num: '8', titulo: 'Página web de configuración', ancla: 'pagina-web-de-configuracion' },
          { num: '9', titulo: 'Pruebas', ancla: 'pruebas' },
        ],
      },
      {
        titulo: 'Manual técnico — Ingesta del archivo diario de averías (CSV)',
        archivo: '/manual/03-Implementacion/03-ingesta-csv.html',
        pdf: '/manual/pdf/03-Implementacion/03-ingesta-csv.pdf',
        subsecciones: [
          { num: '1', titulo: 'Empezar en 5 minutos', ancla: 'empezar-en-5-minutos' },
          { num: '2', titulo: 'Visión general (RF-01/RF-02, RT-05, D-04/D-27/D-41)', ancla: 'vision-general-rf-01-rf-02-rt-05-d-04-d-27-d-41' },
          { num: '3', titulo: 'Contrato del archivo origen', ancla: 'contrato-del-archivo-origen' },
          { num: '4', titulo: 'Parser', ancla: 'parser' },
          { num: '5', titulo: 'Flujo de carga', ancla: 'flujo-de-carga' },
          { num: '6', titulo: 'Endpoints', ancla: 'endpoints' },
          { num: '7', titulo: 'Esquemas y modelo ingesta_lote', ancla: 'esquemas-y-modelo-ingesta-lote' },
          { num: '8', titulo: 'Página web INGESTA', ancla: 'pagina-web-ingesta' },
          { num: '9', titulo: 'Datos reales cargados en producción (42 casos, D-54)', ancla: 'datos-reales-cargados-en-produccion-42-casos-d-54' },
          { num: '10', titulo: 'Pruebas', ancla: 'pruebas' },
        ],
      },
      {
        titulo: 'Manual técnico — Panel y gestión de casos',
        archivo: '/manual/03-Implementacion/04-panel-y-casos.html',
        pdf: '/manual/pdf/03-Implementacion/04-panel-y-casos.pdf',
        subsecciones: [
          { num: '1', titulo: 'Empezar en 5 minutos', ancla: 'empezar-en-5-minutos' },
          { num: '2', titulo: 'Visión general (PANEL y CASOS, RF-30..RF-33)', ancla: 'vision-general-panel-y-casos-rf-30-rf-33' },
          { num: '3', titulo: 'Estados del caso (D-29) y ciclo de vida', ancla: 'estados-del-caso-d-29-y-ciclo-de-vida' },
          { num: '4', titulo: 'Endpoints', ancla: 'endpoints' },
          { num: '5', titulo: 'Reglas de negocio', ancla: 'reglas-de-negocio' },
          { num: '6', titulo: 'Esquemas y modelo', ancla: 'esquemas-y-modelo' },
          { num: '7', titulo: 'Página web CASOS y Panel', ancla: 'pagina-web-casos-y-panel' },
          { num: '8', titulo: 'Buscador global de la barra superior (D-57)', ancla: 'buscador-global-de-la-barra-superior-d-57' },
          { num: '9', titulo: 'Pruebas (app/tests/test_casos_api.py, 17 pruebas)', ancla: 'pruebas-app-tests-test-casos-api-py-17-pruebas' },
        ],
      },
      {
        titulo: '05 — Despacho diario (módulo DESPACHO)',
        archivo: '/manual/03-Implementacion/05-despacho.html',
        pdf: '/manual/pdf/03-Implementacion/05-despacho.pdf',
        subsecciones: [
          { num: '1', titulo: 'Empezar en 5 minutos', ancla: 'empezar-en-5-minutos' },
          { num: '2', titulo: 'Visión general (RF-08/RF-24/RF-25/RF-27, D-52)', ancla: 'vision-general-rf-08-rf-24-rf-25-rf-27-d-52' },
          { num: '3', titulo: 'Modelo de despacho', ancla: 'modelo-de-despacho' },
          { num: '4', titulo: 'Propuesta automática', ancla: 'propuesta-automatica' },
          { num: '5', titulo: 'Endpoints (app/api/routes_despachos.py:63,76,117,135,166,174,181,204,249,271,299,407,420,432,486)', ancla: 'endpoints-app-api-routes-despachos-py-63-76-117-135-166-174-' },
          { num: '6', titulo: 'Edición de casos del despacho y conflictos', ancla: 'edicion-de-casos-del-despacho-y-conflictos' },
          { num: '7', titulo: 'Impresión tamaño carta', ancla: 'impresion-tamano-carta' },
          { num: '8', titulo: 'Publicación y notificación', ancla: 'publicacion-y-notificacion' },
          { num: '9', titulo: 'Fallas masivas en despacho', ancla: 'fallas-masivas-en-despacho' },
          { num: '10', titulo: 'Esquemas (app/schemas/despacho.py) y modelos (app/models/despacho_entities.py)', ancla: 'esquemas-app-schemas-despacho-py-y-modelos-app-models-despac' },
          { num: '11', titulo: 'Página web DESPACHO (app/web/src/pages/Despacho.tsx)', ancla: 'pagina-web-despacho-app-web-src-pages-despacho-tsx' },
          { num: '12', titulo: 'Pruebas (app/tests/test_despacho_api.py 17)', ancla: 'pruebas-app-tests-test-despacho-api-py-17' },
        ],
      },
      {
        titulo: '06 — Seguimiento, casos especiales y agenda',
        archivo: '/manual/03-Implementacion/06-seguimiento-especiales-agenda.html',
        pdf: '/manual/pdf/03-Implementacion/06-seguimiento-especiales-agenda.pdf',
        subsecciones: [
          { num: '1', titulo: 'Empezar en 5 minutos', ancla: 'empezar-en-5-minutos' },
          { num: '2', titulo: 'Visión general (RF-12, RF-34..RF-36, D-30/D-53)', ancla: 'vision-general-rf-12-rf-34-rf-36-d-30-d-53' },
          { num: '3', titulo: 'Casos especiales', ancla: 'casos-especiales' },
          { num: '4', titulo: 'Endpoints de solicitantes y casos especiales (app/api/routes_especiales.py:50,57,103,124,173,183)', ancla: 'endpoints-de-solicitantes-y-casos-especiales-app-api-routes-' },
          { num: '5', titulo: 'Agenda de citas', ancla: 'agenda-de-citas' },
          { num: '6', titulo: 'Seguimiento', ancla: 'seguimiento' },
          { num: '7', titulo: 'Esquemas (app/schemas/especiales.py) y modelos (app/models/especiales_entities.py)', ancla: 'esquemas-app-schemas-especiales-py-y-modelos-app-models-espe' },
          { num: '8', titulo: 'Páginas web ESPECIALES y AGENDA (app/web/src/pages/Especiales.tsx, Agenda.tsx)', ancla: 'paginas-web-especiales-y-agenda-app-web-src-pages-especiales' },
          { num: '9', titulo: 'Pruebas (app/tests/test_especiales_api.py 15)', ancla: 'pruebas-app-tests-test-especiales-api-py-15' },
        ],
      },
      {
        titulo: 'Manual técnico — Monitoreo y reportes (GGTO, Ciclo 7)',
        archivo: '/manual/03-Implementacion/07-monitoreo-y-reportes.html',
        pdf: '/manual/pdf/03-Implementacion/07-monitoreo-y-reportes.pdf',
        subsecciones: [
          { num: '1', titulo: 'Empezar en 5 minutos', ancla: 'empezar-en-5-minutos' },
          { num: '2', titulo: 'Visión general', ancla: 'vision-general' },
          { num: '3', titulo: 'Métricas', ancla: 'metricas' },
          { num: '4', titulo: 'Endpoints', ancla: 'endpoints' },
          { num: '5', titulo: 'Reporte de trabajo', ancla: 'reporte-de-trabajo' },
          { num: '6', titulo: 'Reglas de cálculo', ancla: 'reglas-de-calculo' },
          { num: '7', titulo: 'Página web MONITOREO y gráficos SVG propios', ancla: 'pagina-web-monitoreo-y-graficos-svg-propios' },
          { num: '8', titulo: 'Pruebas', ancla: 'pruebas' },
          { num: '9', titulo: 'Pendiente de validación con CANTV', ancla: 'pendiente-de-validacion-con-cantv' },
        ],
      },
      {
        titulo: 'Manual técnico — Alertas, Telegram y MCP (GGTO, Ciclo 9)',
        archivo: '/manual/03-Implementacion/08-alertas-telegram-mcp.html',
        pdf: '/manual/pdf/03-Implementacion/08-alertas-telegram-mcp.pdf',
        subsecciones: [
          { num: '1', titulo: 'Empezar en 5 minutos', ancla: 'empezar-en-5-minutos' },
          { num: '2', titulo: 'Visión general', ancla: 'vision-general' },
          { num: '3', titulo: 'Fallas masivas', ancla: 'fallas-masivas' },
          { num: '4', titulo: 'Planificación (RF-17) y material (RF-18) sobre la falla', ancla: 'planificacion-rf-17-y-material-rf-18-sobre-la-falla' },
          { num: '5', titulo: 'Outbox', ancla: 'outbox' },
          { num: '6', titulo: 'Telegram', ancla: 'telegram' },
          { num: '7', titulo: 'MCP', ancla: 'mcp' },
          { num: '8', titulo: 'Métricas', ancla: 'metricas' },
          { num: '9', titulo: 'ESTADO REAL de los canales', ancla: 'estado-real-de-los-canales' },
          { num: '10', titulo: 'Endpoints de bandeja y página web ALERTAS', ancla: 'endpoints-de-bandeja-y-pagina-web-alertas' },
          { num: '11', titulo: 'Pruebas', ancla: 'pruebas' },
          { num: '12', titulo: 'Pendiente de confirmar', ancla: 'pendiente-de-confirmar' },
        ],
      },
      {
        titulo: 'API de GGTO — Inventario de Endpoints',
        archivo: '/manual/03-Implementacion/09-api-endpoints.html',
        pdf: '/manual/pdf/03-Implementacion/09-api-endpoints.pdf',
        subsecciones: [
          { num: '1', titulo: 'Empezar en 5 minutos', ancla: 'empezar-en-5-minutos' },
          { num: '2', titulo: 'Visión general', ancla: 'vision-general' },
          { num: '3', titulo: 'Inventario por módulo', ancla: 'inventario-por-modulo' },
          { num: '4', titulo: 'Códigos de respuesta', ancla: 'codigos-de-respuesta' },
          { num: '5', titulo: 'Convenciones', ancla: 'convenciones' },
          { num: '6', titulo: 'Endpoints públicos (/health, /ready, /api/v1/info) y el resto autenticado', ancla: 'endpoints-publicos-health-ready-api-v1-info-y-el-resto-auten' },
        ],
      },
    ],
  },
  {
    nombre: 'Despliegue',
    descripcion: 'Entornos y variables, Cloud Run y Cloud SQL, scripts de aprovisionamiento GCP y pruebas/CI.',
    secciones: [
      {
        titulo: 'Manual de Entornos y Variables — GGTO (CANTV, Central Francisco Salias / Área 4)',
        archivo: '/manual/04-Despliegue/01-entornos-y-variables.html',
        pdf: '/manual/pdf/04-Despliegue/01-entornos-y-variables.pdf',
        subsecciones: [
          { num: '1', titulo: 'Empezar en 5 minutos', ancla: 'empezar-en-5-minutos' },
          { num: '2', titulo: 'Entornos', ancla: 'entornos' },
          { num: '3', titulo: 'Variables de la aplicacion (app/core/config.py:8-47)', ancla: 'variables-de-la-aplicacion-app-core-config-py-8-47' },
          { num: '4', titulo: 'Variables de despliegue previstas (RepoTecnico/entornos_globales.md:129-206)', ancla: 'variables-de-despliegue-previstas-repotecnico-entornos-globa' },
          { num: '5', titulo: 'Parametros gobernados por la tabla configuracion (JSONB) (entornos_globales.md:187-206)', ancla: 'parametros-gobernados-por-la-tabla-configuracion-jsonb-entor' },
          { num: '6', titulo: 'Secretos', ancla: 'secretos' },
          { num: '7', titulo: 'Modo de pruebas DB_SCHEMA (app/core/db.py:16-36)', ancla: 'modo-de-pruebas-db-schema-app-core-db-py-16-36' },
          { num: '8', titulo: 'Pendientes de entorno (entornos_globales.md:272-282)', ancla: 'pendientes-de-entorno-entornos-globales-md-272-282' },
        ],
      },
      {
        titulo: 'Manual de Cloud Run y Cloud SQL — GGTO (CANTV, Central Francisco Salias / Área 4)',
        archivo: '/manual/04-Despliegue/02-cloud-run-y-cloud-sql.html',
        pdf: '/manual/pdf/04-Despliegue/02-cloud-run-y-cloud-sql.pdf',
        subsecciones: [
          { num: '1', titulo: 'Empezar en 5 minutos', ancla: 'empezar-en-5-minutos' },
          { num: '2', titulo: 'Estado real del despliegue', ancla: 'estado-real-del-despliegue' },
          { num: '3', titulo: 'Cloud SQL', ancla: 'cloud-sql' },
          { num: '4', titulo: 'Imagen de contenedor', ancla: 'imagen-de-contenedor' },
          { num: '5', titulo: 'Conexion de la aplicacion', ancla: 'conexion-de-la-aplicacion' },
          { num: '6', titulo: 'Despliegue a ggto-web', ancla: 'despliegue-a-ggto-web' },
          { num: '7', titulo: 'Bloqueo de ggtov2 y plan de migracion (entornos_globales.md:360-369)', ancla: 'bloqueo-de-ggtov2-y-plan-de-migracion-entornos-globales-md-3' },
          { num: '8', titulo: 'Riesgos', ancla: 'riesgos' },
          { num: '9', titulo: 'Verificacion', ancla: 'verificacion' },
        ],
      },
      {
        titulo: 'Manual de scripts de aprovisionamiento GCP — GGTO (CANTV, Central Francisco Salias / Área 4)',
        archivo: '/manual/04-Despliegue/03-scripts-gcp.html',
        pdf: '/manual/pdf/04-Despliegue/03-scripts-gcp.pdf',
        subsecciones: [
          { num: '1', titulo: 'Empezar en 5 minutos', ancla: 'empezar-en-5-minutos' },
          { num: '2', titulo: 'Visión general', ancla: 'vision-general' },
          { num: '3', titulo: 'Biblioteca común (scripts/lib_gcp.sh)', ancla: 'biblioteca-comun-scripts-lib-gcp-sh' },
          { num: '4', titulo: 'Orquestador (scripts/provision_all.sh) y variable CREAR_RECURSOS', ancla: 'orquestador-scripts-provision-all-sh-y-variable-crear-recurs' },
          { num: '5', titulo: 'Script por script', ancla: 'script-por-script' },
          { num: '6', titulo: 'Scripts auxiliares del proyecto', ancla: 'scripts-auxiliares-del-proyecto' },
          { num: '7', titulo: 'Teardown y confirmación (CONFIRM_DESTROY=ELIMINAR)', ancla: 'teardown-y-confirmacion-confirm-destroy-eliminar' },
          { num: '8', titulo: 'Diferencia entre lo previsto (ggtov2) y lo realmente desplegado (truekeate-main)', ancla: 'diferencia-entre-lo-previsto-ggtov2-y-lo-realmente-desplegad' },
        ],
      },
      {
        titulo: 'Manual de pruebas y CI — GGTO (CANTV, Central Francisco Salias / Área 4)',
        archivo: '/manual/04-Despliegue/04-pruebas-y-ci.html',
        pdf: '/manual/pdf/04-Despliegue/04-pruebas-y-ci.pdf',
        subsecciones: [
          { num: '1', titulo: 'Empezar en 5 minutos', ancla: 'empezar-en-5-minutos' },
          { num: '2', titulo: 'Estrategia de pruebas', ancla: 'estrategia-de-pruebas' },
          { num: '3', titulo: 'Entornos de prueba', ancla: 'entornos-de-prueba' },
          { num: '4', titulo: 'Pruebas backend', ancla: 'pruebas-backend' },
          { num: '5', titulo: 'Pruebas E2E', ancla: 'pruebas-e2e' },
          { num: '6', titulo: 'Calidad estática', ancla: 'calidad-estatica' },
          { num: '7', titulo: 'Resultado Fase 4', ancla: 'resultado-fase-4' },
          { num: '8', titulo: 'CI', ancla: 'ci' },
        ],
      },
    ],
  },
  {
    nombre: 'Diccionario de Datos',
    descripcion: 'Definición de las 35 tablas de la base ggtov2, sus columnas, claves y reglas.',
    secciones: [
      {
        titulo: 'Diccionario de Datos — Entidades de la base GGTO',
        archivo: '/manual/05-Diccionario-de-Datos/01-entidades.html',
        pdf: '/manual/pdf/05-Diccionario-de-Datos/01-entidades.pdf',
        subsecciones: [
          { num: '1', titulo: 'Empezar en 5 minutos', ancla: 'empezar-en-5-minutos' },
          { num: '2', titulo: 'Visión general', ancla: 'vision-general' },
          { num: '3', titulo: 'Entidades por dominio', ancla: 'entidades-por-dominio' },
          { num: '4', titulo: 'Campos PII', ancla: 'campos-pii' },
          { num: '5', titulo: 'Fuentes', ancla: 'fuentes' },
        ],
      },
    ],
  },
  {
    nombre: 'Diagrama Relacional',
    descripcion: 'Modelo entidad-relación, claves, restricciones, RLS e índices.',
    secciones: [
      {
        titulo: 'Diagrama Entidad-Relación — Modelo de datos GGTO',
        archivo: '/manual/06-Diagrama-Relacional/01-diagrama-er.html',
        pdf: '/manual/pdf/06-Diagrama-Relacional/01-diagrama-er.pdf',
        subsecciones: [
          { num: '1', titulo: 'Empezar en 5 minutos', ancla: 'empezar-en-5-minutos' },
          { num: '2', titulo: 'Visión general del modelo', ancla: 'vision-general-del-modelo' },
          { num: '3', titulo: 'Diagramas Mermaid por dominio', ancla: 'diagramas-mermaid-por-dominio' },
          { num: '4', titulo: 'Relaciones principales', ancla: 'relaciones-principales' },
          { num: '5', titulo: 'Claves y restricciones', ancla: 'claves-y-restricciones' },
          { num: '6', titulo: 'RLS', ancla: 'rls' },
          { num: '7', titulo: 'Índices', ancla: 'indices' },
        ],
      },
    ],
  },
  {
    nombre: 'Operación',
    descripcion: 'Operación diaria, rutinas, respaldo y recuperación, mantenimiento, incidentes, seguridad y privacidad.',
    secciones: [
      {
        titulo: 'Manual de Operación y Mantenimiento — GGTO',
        archivo: '/manual/07-Operacion/01-operacion-y-mantenimiento.html',
        pdf: '/manual/pdf/07-Operacion/01-operacion-y-mantenimiento.pdf',
        subsecciones: [
          { num: '1', titulo: 'Empezar en 5 minutos', ancla: 'empezar-en-5-minutos' },
          { num: '2', titulo: 'Operación diaria', ancla: 'operacion-diaria' },
          { num: '3', titulo: 'Rutinas programadas', ancla: 'rutinas-programadas' },
          { num: '4', titulo: 'Respaldo y recuperación', ancla: 'respaldo-y-recuperacion' },
          { num: '5', titulo: 'Mantenimiento', ancla: 'mantenimiento' },
          { num: '6', titulo: 'Incidentes', ancla: 'incidentes' },
          { num: '7', titulo: 'Continuidad', ancla: 'continuidad' },
          { num: '8', titulo: 'Pendientes operativos', ancla: 'pendientes-operativos' },
        ],
      },
      {
        titulo: 'Manual de Seguridad y Privacidad — GGTO',
        archivo: '/manual/07-Operacion/02-seguridad-y-privacidad.html',
        pdf: '/manual/pdf/07-Operacion/02-seguridad-y-privacidad.pdf',
        subsecciones: [
          { num: '1', titulo: 'Empezar en 5 minutos', ancla: 'empezar-en-5-minutos' },
          { num: '2', titulo: 'Modelo de seguridad', ancla: 'modelo-de-seguridad' },
          { num: '3', titulo: 'RBAC', ancla: 'rbac' },
          { num: '4', titulo: 'RLS en PostgreSQL', ancla: 'rls-en-postgresql' },
          { num: '5', titulo: 'Gestión de secretos', ancla: 'gestion-de-secretos' },
          { num: '6', titulo: 'PII y privacidad (RNF-18/D-34)', ancla: 'pii-y-privacidad-rnf-18-d-34' },
          { num: '7', titulo: 'Superficie de exposición actual', ancla: 'superficie-de-exposicion-actual' },
          { num: '8', titulo: 'Endurecimiento recomendado', ancla: 'endurecimiento-recomendado' },
          { num: '9', titulo: 'Cumplimiento y pendientes', ancla: 'cumplimiento-y-pendientes' },
        ],
      },
    ],
  },
];

const TOTAL_SECCIONES = TEMAS.reduce((n, t) => n + t.secciones.length, 0);
const TOTAL_SUBSECCIONES = TEMAS.reduce(
  (n, t) => n + t.secciones.reduce((m, s) => m + s.subsecciones.length, 0),
  0,
);

/** Minúsculas y sin acentos, para comparar la búsqueda. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export default function Ayuda() {
  const [filtro, setFiltro] = useState('');
  const busqueda = normalizar(filtro.trim());

  const temas = useMemo(() => {
    if (!busqueda) return TEMAS;
    return TEMAS.map((tema) => ({
      ...tema,
      secciones: tema.secciones
        .map((seccion) => {
          const coincideSeccion = normalizar(seccion.titulo).includes(busqueda);
          const subsecciones = coincideSeccion
            ? seccion.subsecciones
            : seccion.subsecciones.filter(
                (s) =>
                  normalizar(s.titulo).includes(busqueda) ||
                  normalizar(s.num).includes(busqueda),
              );
          return { ...seccion, subsecciones };
        })
        .filter((seccion) => seccion.subsecciones.length > 0),
    })).filter((tema) => tema.secciones.length > 0);
  }, [busqueda]);

  const seccionesVisibles = useMemo(
    () => temas.reduce((n, t) => n + t.secciones.length, 0),
    [temas],
  );

  return (
    <>
      <div className="pagina-cabecera">
        <div>
          <h1>Ayuda</h1>
          <p>
            Manuales de GGTO — CANTV, Central Francisco Salias (Área 4). Navegue por tema, sección y
            sub-sección; abra el manual en HTML o descargue su PDF.
          </p>
        </div>
      </div>

      <div className="panel-bloque ayuda-buscador">
        <div className="campo">
          <label htmlFor="ayuda-filtro">Buscar en los manuales</label>
          <input
            id="ayuda-filtro"
            type="search"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Ej.: despacho, Argon2id, respaldo, RBAC, ingesta"
            autoComplete="off"
          />
        </div>
        <p className="texto-pequeno ayuda-contador">
          {busqueda
            ? `${seccionesVisibles} de ${TOTAL_SECCIONES} secciones coinciden con «${filtro.trim()}».`
            : `${TEMAS.length} temas · ${TOTAL_SECCIONES} secciones · ${TOTAL_SUBSECCIONES} sub-secciones disponibles.`}
        </p>
      </div>

      {temas.length === 0 && (
        <div className="panel-bloque">
          <p className="vacio">No se encontraron secciones para «{filtro.trim()}».</p>
        </div>
      )}

      {temas.map((tema) => (
        <section className="panel-bloque ayuda-tema" key={tema.nombre}>
          <div className="ayuda-tema-cabecera">
            <h2>
              <IconoAyuda width={18} height={18} />
              {tema.nombre}
            </h2>
            <p className="texto-pequeno">{tema.descripcion}</p>
          </div>

          <div className="ayuda-secciones">
            {tema.secciones.map((seccion) => (
              <article className="ayuda-seccion" key={seccion.archivo}>
                <h3>{seccion.titulo}</h3>
                <div className="ayuda-acciones">
                  <a
                    className="btn"
                    href={seccion.archivo}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Abrir manual HTML
                  </a>
                  <a className="btn btn-secundario" href={seccion.pdf} download>
                    Descargar PDF
                  </a>
                </div>
                {seccion.subsecciones.length > 0 && (
                  <ul className="ayuda-subsecciones">
                    {seccion.subsecciones.map((sub) => (
                      <li key={sub.ancla}>
                        <a
                          href={`${seccion.archivo}#${sub.ancla}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`${sub.num} ${sub.titulo}`}
                        >
                          <span className="ayuda-num">{sub.num}</span>
                          {sub.titulo}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
