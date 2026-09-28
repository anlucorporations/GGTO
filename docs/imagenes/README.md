# Imágenes de los manuales GGTO

Gráficos vectoriales (SVG) y su versión rasterizada (PNG) para insertar en los
manuales. Escritos a mano, sin dependencias externas ni recursos remotos.

- **Paleta** (tomada de `app/web/src/styles.css`): azul `#0b4f9c`, azul oscuro `#08396f`,
  azul claro `#e8f0fa`, verde `#1f7a4d`, verde claro `#e6f5ec`, ámbar `#8a6100`,
  rojo `#b3261e`, gris fondo `#f4f6f9`, gris borde `#d7dde6`, gris texto `#4a5568`,
  texto `#1f2933`. Series de gráficos: `#0b4f9c`, `#1f7a4d`, `#8a6100`, `#b3261e`,
  `#5b21b6`, `#0e7490` (`app/web/src/components/graficos.tsx`).
- **Tipografía**: `'Segoe UI', 'Helvetica Neue', Arial, sans-serif` (igual que la web).
- **Marca**: cabecera azul con la marca «GGTO · CANTV» y pie con el nombre del sistema.
- **Rasterizado**: cada `.svg` se convierte a `.png` con Playwright Chromium
  (`RepoTecnico/pruebas/e2e/raster_imagenes.js`).
- **Verificación**: `python3 RepoTecnico/pruebas/verificar_imagenes.py` comprueba que
  cada marcador `<!-- GENERAR_IMAGEN: … -->` tenga su SVG y su PNG, que los SVG sean
  XML válidos y que no queden imágenes huérfanas.

## Mapa completo: 35 imágenes ↔ 35 marcadores en `docs/Manuales/**`

| Imagen | Marcador en el manual |
|---|---|
| `onboarding-tecnico.svg` | `01-Tecnologia/01-plataforma.md` |
| `mapa-secciones-plataforma.svg` | `01-Tecnologia/01-plataforma.md` |
| `arquitectura-general.svg` | `01-Tecnologia/01-plataforma.md` |
| `despliegue-gcp.svg` | `01-Tecnologia/01-plataforma.md` |
| `capas-backend.svg` | `01-Tecnologia/02-stack-backend.md` |
| `flujo-peticion-backend.svg` | `01-Tecnologia/02-stack-backend.md` |
| `mapa-pantallas-spa.svg` | `01-Tecnologia/03-stack-frontend.md` |
| `ruta-protegida.svg` | `01-Tecnologia/03-stack-frontend.md` |
| `dependencias-backend.svg` | `02-Dependencias/01-backend.md` |
| `dependencias-frontend.svg` | `02-Dependencias/02-frontend.md` |
| `flujo-login-p00.svg` | `03-Implementacion/01-autenticacion-y-rbac.md` |
| `bloqueo-intentos.svg` | `03-Implementacion/01-autenticacion-y-rbac.md` |
| `rbac-roles.svg` | `03-Implementacion/01-autenticacion-y-rbac.md` |
| `mapa-configuracion.svg` | `03-Implementacion/02-configuracion.md` |
| `transformacion-columnas.svg` | `03-Implementacion/03-ingesta-csv.md` |
| `flujo-ingesta-csv.svg` | `03-Implementacion/03-ingesta-csv.md` |
| `flujo-caso-estados.svg` | `03-Implementacion/04-panel-y-casos.md` |
| `buscador-global.svg` | `03-Implementacion/04-panel-y-casos.md` |
| `flujo-despacho.svg` | `03-Implementacion/05-despacho.md` |
| `propuesta-automatica.svg` | `03-Implementacion/05-despacho.md` |
| `flujo-caso-especial.svg` | `03-Implementacion/06-seguimiento-especiales-agenda.md` |
| `agenda-citas.svg` | `03-Implementacion/06-seguimiento-especiales-agenda.md` |
| `infografia-monitoreo.svg` | `03-Implementacion/07-monitoreo-y-reportes.md` |
| `flujo-alertas.svg` | `03-Implementacion/08-alertas-telegram-mcp.md` |
| `outbox-notificaciones.svg` | `03-Implementacion/08-alertas-telegram-mcp.md` |
| `mapa-api-endpoints.svg` | `03-Implementacion/09-api-endpoints.md` |
| `entornos-ggto.svg` | `04-Despliegue/01-entornos-y-variables.md` |
| `arquitectura-cloud.svg` | `04-Despliegue/02-cloud-run-y-cloud-sql.md` |
| `orden-scripts-aprovisionamiento.svg` | `04-Despliegue/03-scripts-gcp.md` |
| `piramide-pruebas.svg` | `04-Despliegue/04-pruebas-y-ci.md` |
| `dominios-datos.svg` | `05-Diccionario-de-Datos/01-entidades.md` |
| `glosario-visual.svg` | `05-Diccionario-de-Datos/01-entidades.md` |
| `modelo-relacional-general.svg` | `06-Diagrama-Relacional/01-diagrama-er.md` |
| `rutina-diaria.svg` | `07-Operacion/01-operacion-y-mantenimiento.md` |
| `defensa-en-capas.svg` | `07-Operacion/02-seguridad-y-privacidad.md` |

Cada imagen existe en dos formatos con el mismo nombre base: `.svg` (fuente vectorial
editable) y `.png` (rasterizado para los PDF y para la sección de Ayuda).

## Fidelidad de los gráficos

Los diagramas respetan el estado real del sistema a la fecha de los manuales:

- **No existe aplicación móvil Flutter** (Ciclo 8 pospuesto) **ni canal de WhatsApp**
  en la v1. El acceso es por navegador web.
- **Telegram y el correo están sin credenciales**: los envíos quedan en estado
  **PENDIENTE** en la bandeja de salida (patrón *outbox*) y se reintentan; el mensaje
  no se pierde. El canal MCP sí está disponible con la clave `mcp.api_key`.
- El servicio Cloud Run es **público** y la base contiene **PII real** (42 casos con
  datos personales): debe restringirse el acceso.
- El riesgo aceptado **D-26** indica que **no hay respaldos, ni PITR, ni protección de
  borrado, ni SSL obligatorio** hasta migrar a la instancia `ggtov2-pg`.

> Nota: las cifras de la infografía de monitoreo son **de ejemplo** y están rotuladas
> como tales; los manuales no reproducen datos reales de producción.
