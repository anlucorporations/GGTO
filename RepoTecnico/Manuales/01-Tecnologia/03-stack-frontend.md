# Stack del frontend GGTO (SPA React)

> Manual técnico de la aplicación web de **GGTO**. Describe el stack React + TypeScript + Vite, la
> estructura del proyecto `app/web/`, el enrutado con protección de sesión, el cliente HTTP, los
> gráficos SVG propios y el proceso de construcción que sirve FastAPI. Las referencias `ruta:línea`
> fueron verificadas sobre el código. Lo no comprobable se marca como **pendiente de confirmar**.

## Stack de la SPA

### React 18 y TypeScript

La interfaz es una **aplicación de página única (SPA)** escrita en **React 18** con **TypeScript**.
Las dependencias de ejecución declaradas en `app/web/package.json` son:

| Paquete | Versión declarada | Referencia |
|---|---|---|
| `react` | `^18.3.1` | `app/web/package.json:13` |
| `react-dom` | `^18.3.1` | `app/web/package.json:14` |
| `react-router-dom` | `^6.26.2` | `app/web/package.json:15` |

No hay ninguna otra dependencia de ejecución. En particular, **no se usa una biblioteca de gráficos
externa** (nada de Recharts ni Chart.js): los gráficos se dibujan con SVG propio, tal como declara el
encabezado de `app/web/src/components/graficos.tsx:1-7`. Este es un hecho real del código que
contradice la previsión D-38 del proyecto, que mencionaba React con Recharts
(`RepoTecnico/estado_proyecto.md:102`). El manual documenta el hecho verificado.

Las dependencias de desarrollo son:

| Paquete | Versión declarada | Referencia |
|---|---|---|
| `@types/react` | `^18.3.11` | `app/web/package.json:18` |
| `@types/react-dom` | `^18.3.1` | `app/web/package.json:19` |
| `@vitejs/plugin-react` | `^4.3.2` | `app/web/package.json:20` |
| `typescript` | `^5.6.3` | `app/web/package.json:21` |
| `vite` | `^5.4.9` | `app/web/package.json:22` |

El proyecto se declara como módulo ES (`"type": "module"`, `app/web/package.json:5`) y privado
(`"private": true`, `app/web/package.json:3`), con nombre `ggto-web` y versión `0.1.0`
(`app/web/package.json:2,4`).

TypeScript está configurado en modo **estricto**. El `tsconfig.json` habilita `"strict": true`
(`app/web/tsconfig.json:18`) y `"noFallthroughCasesInSwitch": true`
(`app/web/tsconfig.json:19`), con objetivo `ES2020` (`app/web/tsconfig.json:3`), resolución de
módulos en modo `bundler` (`app/web/tsconfig.json:10`), `jsx: react-jsx`
(`app/web/tsconfig.json:15`) y `noEmit: true` porque la emisión la realiza Vite
(`app/web/tsconfig.json:14`). El informe de la Fase 4 registra que `tsc` en modo estricto no arrojó
hallazgos (`RepoTecnico/estado_proyecto.md:126`).

El punto de entrada es `app/web/index.html`, que declara idioma español, codificación UTF-8, la
metaetiqueta de *viewport* y el contenedor `#root` sobre el que monta React
(`app/web/index.html:1-13`). El título de la pestaña es `GGTO — CANTV`
(`app/web/index.html:7`).

### Vite

**Vite 5** es el empaquetador y servidor de desarrollo, integrado con `@vitejs/plugin-react`
(`app/web/vite.config.ts:1-6`). La configuración define dos bloques:

1. **Servidor de desarrollo** (`app/web/vite.config.ts:7-15`): puerto `5173` y un proxy que reenvía
   `/api` a `http://localhost:8000` con `changeOrigin: true`. El comentario del archivo explica que
   la web se sirve desde el mismo origen que la API y que, en desarrollo, Vite reenvía `/api` al
   backend uvicorn (`app/web/vite.config.ts:4-5`).
2. **Construcción** (`app/web/vite.config.ts:16-18`): `build.outDir = 'dist'`, es decir, la salida
   queda en `app/web/dist`, que es exactamente el directorio que FastAPI monta
   (`app/main.py:103-105`).

El proxy es la pieza que permite que el cliente HTTP use una ruta relativa (`/api/v1`) sin
configuración adicional en desarrollo. En producción el mismo comportamiento se obtiene porque SPA y
API comparten origen dentro del contenedor.

Los *scripts* npm declarados son `dev` (`vite`), `build` (`tsc && vite build`) y `preview`
(`vite preview`) (`app/web/package.json:7-11`). Es importante notar que `build` **ejecuta primero
`tsc`**: un error de tipos impide generar el *bundle*.

### react-router-dom

El enrutado del cliente usa **react-router-dom 6** en modo `BrowserRouter`. El componente raíz
envuelve la aplicación con `BrowserRouter` y con `AuthProvider`:

```
<StrictMode>
  <BrowserRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>
</StrictMode>
```

(`app/web/src/main.tsx:8-15`). El orden importa: `AuthProvider` debe estar dentro del enrutador
porque `RutaProtegida` usa el contexto de autenticación y el hook de navegación.

El uso de `BrowserRouter` (y no `HashRouter`) es la razón por la que el backend necesita el
*fallback* a `index.html`: las rutas son rutas de URL reales (`/casos`, `/monitoreo`) que el servidor
debe resolver entregando el documento de la SPA (`app/main.py:91-100`).

Los componentes de enrutado empleados en `App.tsx` son `Routes`, `Route` y `Navigate`
(`app/web/src/App.tsx:1`); en `Layout.tsx` se usan además `Link` y `NavLink`
(`app/web/src/components/Layout.tsx:2`); y en `RutaProtegida.tsx` se usan `Navigate` y `Outlet`
(`app/web/src/components/RutaProtegida.tsx:1`).

## Estructura del proyecto web

### main.tsx y App.tsx

`app/web/src/main.tsx` tiene 16 líneas y es el punto de arranque del cliente. Importa `StrictMode` de
React, `createRoot` de `react-dom/client`, `BrowserRouter`, el componente `App`, el proveedor de
autenticación y la hoja de estilos global `./styles.css` (`app/web/src/main.tsx:1-6`). Monta la
aplicación con `createRoot(document.getElementById('root') as HTMLElement).render(...)`
(`app/web/src/main.tsx:8`).

`app/web/src/App.tsx` tiene 49 líneas y concentra la declaración de rutas. No contiene lógica de
negocio: importa las diecisiete páginas y los dos componentes de infraestructura (`Layout` y
`RutaProtegida`), y devuelve el árbol de `<Routes>` (`app/web/src/App.tsx:1-49`).

La estructura de rutas es anidada y usa un patrón de *layout route* sin `path`:

```
<Routes>
  <Route path="/login" element={<Login />} />
  <Route element={<RutaProtegida />}>
    <Route element={<Layout />}>
      <Route index element={<Panel />} />
      ...
    </Route>
  </Route>
  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
```

(`app/web/src/App.tsx:22-48`). El `Route` externo sin `path` actúa como guardián: si `RutaProtegida`
no está autenticada, redirige; si lo está, renderiza el `Outlet` interno, que a su vez monta
`Layout` y la página hija (`app/web/src/components/RutaProtegida.tsx:17-18`).

### pages/

El directorio `app/web/src/pages/` contiene una página por sección. Extensión verificada de cada
archivo (medida en líneas):

| Página | Archivo | Líneas |
|---|---|---|
| Panel | `app/web/src/pages/Panel.tsx` | 106 |
| Login | `app/web/src/pages/Login.tsx` | 202 |
| Ingesta | `app/web/src/pages/Ingesta.tsx` | 406 |
| Casos | `app/web/src/pages/Casos.tsx` | 964 |
| Despacho | `app/web/src/pages/Despacho.tsx` | 1165 |
| Especiales | `app/web/src/pages/Especiales.tsx` | 508 |
| Agenda | `app/web/src/pages/Agenda.tsx` | 814 |
| Monitoreo | `app/web/src/pages/Monitoreo.tsx` | 764 |
| Alertas | `app/web/src/pages/Alertas.tsx` | 677 |
| Centrales | `app/web/src/pages/Centrales.tsx` | 336 |
| Sectores | `app/web/src/pages/Sectores.tsx` | 520 |
| Tecnicos | `app/web/src/pages/Tecnicos.tsx` | 366 |
| Flota | `app/web/src/pages/Flota.tsx` | 372 |
| Cuadrillas | `app/web/src/pages/Cuadrillas.tsx` | 555 |
| Catalogos | `app/web/src/pages/Catalogos.tsx` | 390 |
| Parametros | `app/web/src/pages/Parametros.tsx` | 177 |

Las páginas siguen un patrón común de ciclo de vida. Un ejemplo verificable es `Panel.tsx`: declara
estado con `useState` para el resumen, el error, la carga, el término de búsqueda y el error de
búsqueda (`app/web/src/pages/Panel.tsx:20-24`), carga el resumen con `useEffect` y una bandera
`activo` para evitar actualizar estado tras el desmontaje (`app/web/src/pages/Panel.tsx:26-42`), y
gestiona un formulario de búsqueda rápida que navega a `/casos` con el término en el estado de
navegación (`app/web/src/pages/Panel.tsx:47-56`).

El panel de inicio muestra seis tarjetas alimentadas por el resumen del backend: `tablas`,
`centrales`, `roles`, `cuadrillas`, `causas` y `parametros`
(`app/web/src/pages/Panel.tsx:8-15`), que corresponden exactamente a los conteos que devuelve
`GET /api/v1/resumen` (`app/api/routes_health.py:64-77`).

### components/

El directorio `app/web/src/components/` aloja los componentes reutilizables:

| Componente | Archivo | Líneas | Función |
|---|---|---|---|
| `Layout` | `app/web/src/components/Layout.tsx` | 228 | Armazón con barra superior, menús y `Outlet` |
| `RutaProtegida` | `app/web/src/components/RutaProtegida.tsx` | 19 | Guardián de sesión |
| `BuscadorGlobal` | `app/web/src/components/BuscadorGlobal.tsx` | 147 | Buscador de un solo campo |
| `ModalCaso` | `app/web/src/components/ModalCaso.tsx` | 466 | Modal «Agregar caso» |
| `graficos` | `app/web/src/components/graficos.tsx` | 349 | Gráficos SVG propios |
| `Iconos` | `app/web/src/components/Iconos.tsx` | 239 | Conjunto de iconos SVG |
| `EstadoChips` | `app/web/src/components/EstadoChips.tsx` | 47 | Indicadores de estado |
| `Mensaje` | `app/web/src/components/Mensaje.tsx` | 20 | Aviso de error o información |
| `useCerrarDesplegable` | `app/web/src/components/useCerrarDesplegable.ts` | 28 | Hook de cierre de menús |

El hook `useCerrarDesplegable` se usa en `MenuConfiguracion` y `MenuUsuario` para cerrar los
desplegables al hacer clic fuera (`app/web/src/components/Layout.tsx:60,102`). Los iconos se importan
de forma nominal desde `./Iconos` (`app/web/src/components/Layout.tsx:7-20`) y se tipan con
`ComponentType<SVGProps<SVGSVGElement>>` (`app/web/src/components/Layout.tsx:22`).

### api/

El directorio `app/web/src/api/` contiene dos archivos:

| Archivo | Líneas | Contenido |
|---|---|---|
| `app/web/src/api/client.ts` | 886 | Cliente HTTP, manejo de errores, token y funciones por recurso |
| `app/web/src/api/types.ts` | 988 | Interfaces TypeScript espejo de los esquemas Pydantic |

El encabezado de `types.ts` declara la correspondencia de forma explícita: *«Tipos del dominio GGTO —
espejo de los esquemas Pydantic del backend (`app/schemas/auth.py` y `app/schemas/config.py`)»*
(`app/web/src/api/types.ts:1-4`). No existe generación automática de tipos desde OpenAPI: la
sincronización es **manual** y es un punto de atención al cambiar un esquema del backend.

### auth/

El directorio `app/web/src/auth/` contiene `AuthContext.tsx` (87 líneas). Define el contexto
`AuthContextValue` con el usuario, la bandera de carga, la bandera de autenticación, la bandera de
solo lectura y las funciones de inicio y cierre de sesión
(`app/web/src/auth/AuthContext.tsx:13-21`).

El proveedor inicializa el usuario desde `api.getUsuarioGuardado()` y el estado de carga según la
existencia de token (`app/web/src/auth/AuthContext.tsx:26-27`). Al montar, si hay token, valida la
sesión contra `GET /auth/me` y refresca los datos guardados; si falla, limpia la sesión
(`app/web/src/auth/AuthContext.tsx:34-59`). El valor expuesto se memoiza con `useMemo`
(`app/web/src/auth/AuthContext.tsx:68-78`). El hook `useAuth()` lanza un error explícito si se usa
fuera del proveedor (`app/web/src/auth/AuthContext.tsx:83-87`).

La bandera `soloLectura` se deriva del rol: `soloLectura: usuario?.rol === 'TECNICO'`
(`app/web/src/auth/AuthContext.tsx:73`). El comentario aclara que *«el rol TECNICO solo puede leer:
la API responde 403 en escrituras»* (`app/web/src/auth/AuthContext.tsx:17`). El `Layout` consume esa
bandera para deshabilitar el botón «Agregar caso» (`app/web/src/components/Layout.tsx:186`) y para
mostrar un aviso permanente (`app/web/src/components/Layout.tsx:215-221`).

## Enrutado y proteccion

### Rutas publicas y protegidas (app/web/src/App.tsx:22-48)

La aplicación tiene **una sola ruta pública**, `/login`, declarada fuera del guardián
(`app/web/src/App.tsx:24`). Todas las demás rutas están dentro del `Route` sin `path` cuyo elemento
es `RutaProtegida` (`app/web/src/App.tsx:26`). La ruta comodín `*` redirige a `/` con `replace`, de
modo que una URL desconocida no deja historial sucio (`app/web/src/App.tsx:46`).

| Tipo | Ruta | Elemento | Línea |
|---|---|---|---|
| Pública | `/login` | `Login` | `app/web/src/App.tsx:24` |
| Protegida | `/` (index) | `Panel` | `app/web/src/App.tsx:28` |
| Protegida | `/ingesta` | `Ingesta` | `app/web/src/App.tsx:29` |
| Protegida | `/casos` | `Casos` | `app/web/src/App.tsx:30` |
| Protegida | `/despacho` | `Despacho` | `app/web/src/App.tsx:31` |
| Protegida | `/especiales` | `Especiales` | `app/web/src/App.tsx:32` |
| Protegida | `/agenda` | `Agenda` | `app/web/src/App.tsx:33` |
| Protegida | `/monitoreo` | `Monitoreo` | `app/web/src/App.tsx:34` |
| Protegida | `/alertas` | `Alertas` | `app/web/src/App.tsx:35` |
| Protegida | `/central` | `Centrales` | `app/web/src/App.tsx:36` |
| Protegida | `/sectores` | `Sectores` | `app/web/src/App.tsx:37` |
| Protegida | `/tecnicos` | `Tecnicos` | `app/web/src/App.tsx:38` |
| Protegida | `/flota` | `Flota` | `app/web/src/App.tsx:39` |
| Protegida | `/cuadrillas` | `Cuadrillas` | `app/web/src/App.tsx:40` |
| Protegida | `/catalogos` | `Catalogos` | `app/web/src/App.tsx:41` |
| Protegida | `/parametros` | `Parametros` | `app/web/src/App.tsx:42` |
| Redirección | `*` | `Navigate to="/"` | `app/web/src/App.tsx:46` |

No existe una ruta separada para SEGUIMIENTO, EMPRESAS, REFERIDOS ni GESTIÓN: esas vistas
funcionales se cubren desde `Especiales` y desde `Casos` (listados y fichas), según el rediseño de
navegación D-57 (`RepoTecnico/estado_proyecto.md:117`). Es un hecho del código y no debe suponerse
una ruta distinta.

### RutaProtegida

`RutaProtegida` es un componente de 19 líneas cuyo comentario lo describe como *«Bloquea el acceso a
las rutas privadas mientras no haya sesión válida»* (`app/web/src/components/RutaProtegida.tsx:4`).
Consume `useAuth()` y extrae `autenticado` y `cargando` (`app/web/src/components/RutaProtegida.tsx:6`).

Su lógica tiene tres salidas (`app/web/src/components/RutaProtegida.tsx:8-18`):

1. Mientras `cargando` es verdadero, muestra una pantalla de espera con un `div.spinner` marcado con
   `aria-hidden="true"` y el texto «Validando sesión…» (`app/web/src/components/RutaProtegida.tsx:8-15`).
   Esta espera evita el parpadeo de redirección mientras se valida el token contra `/auth/me`.
2. Si no está autenticado, redirige a `/login` con `replace`
   (`app/web/src/components/RutaProtegida.tsx:17`).
3. Si está autenticado, renderiza el `Outlet` con la ruta hija
   (`app/web/src/components/RutaProtegida.tsx:18`).

La protección es **de interfaz**. La autorización efectiva ocurre en el backend: `get_current_user`
exige un JWT válido y un usuario activo y no bloqueado (`app/api/deps.py:29-49`), y `require_roles`
aplica el rol en cada operación de escritura (`app/api/deps.py:52-72`). Ocultar una ruta en el
cliente no sustituye el control del servidor.

### Layout y barra superior (app/web/src/components/Layout.tsx)

`Layout` es el armazón de la aplicación (228 líneas). Su estructura es:

- Una `topbar` con la marca, el buscador global, el botón «Agregar caso», la navegación y el menú de
  usuario (`app/web/src/components/Layout.tsx:174-212`).
- Un `main.app-contenido` con el aviso de solo lectura y el `Outlet`
  (`app/web/src/components/Layout.tsx:214-223`).
- El modal de alta de caso, montado condicionalmente
  (`app/web/src/components/Layout.tsx:225`).

Las secciones principales se declaran en un arreglo tipado `SECCIONES` con ruta, etiqueta, bandera
`fin` e icono (`app/web/src/components/Layout.tsx:24-41`). El arreglo contiene ocho entradas: PANEL,
CASOS, ESPECIALES, AGENDA, DESPACHO, INGESTA, MONITOREO y ALERTAS
(`app/web/src/components/Layout.tsx:32-41`). La bandera `fin` es verdadera solo para PANEL, lo que
hace que `NavLink` no lo marque activo en rutas hijas (`app/web/src/components/Layout.tsx:33`, usada
en `app/web/src/components/Layout.tsx:199`).

El submenú CONFIGURACIÓN se declara aparte con siete entradas (`app/web/src/components/Layout.tsx:43-51`)
y se renderiza solo si el rol está en `ROLES_CONFIG = ['SUPER', 'ADMIN', 'SUPERVISOR']`
(`app/web/src/components/Layout.tsx:53,170,208`). El desplegable usa `aria-haspopup="menu"`,
`aria-expanded` y `role="menu"` (`app/web/src/components/Layout.tsx:64-78`).

El menú de usuario muestra el avatar con la inicial, el nombre o `p00` y el rol, además de la
insignia «solo lectura» cuando corresponde (`app/web/src/components/Layout.tsx:104-127`). Al abrirlo,
presenta una lista de definiciones con P00, correo, rol y central, y el botón de cierre de sesión
(`app/web/src/components/Layout.tsx:128-162`).

| Elemento de la barra | Componente | Referencia |
|---|---|---|
| Marca GGTO — CANTV | `Link` a `/` | `app/web/src/components/Layout.tsx:175-178` |
| Buscador global | `BuscadorGlobal` | `app/web/src/components/Layout.tsx:180` |
| Botón Agregar caso | botón con modal | `app/web/src/components/Layout.tsx:182-192` |
| Navegación de secciones | `NavLink` por `SECCIONES` | `app/web/src/components/Layout.tsx:194-209` |
| Submenú CONFIGURACIÓN | `MenuConfiguracion` | `app/web/src/components/Layout.tsx:56-94` |
| Menú de usuario | `MenuUsuario` | `app/web/src/components/Layout.tsx:97-165` |

## Cliente HTTP y tipos

### app/web/src/api/client.ts

El cliente HTTP (886 líneas) es la única puerta de salida hacia la API. Su encabezado documenta las
tres decisiones de diseño: mismo origen con `API_BASE = '/api/v1'`, token en `localStorage` adjunto
como `Bearer`, y conversión de cualquier respuesta no-2xx en `ApiError` con el `detail` de FastAPI
(`app/web/src/api/client.ts:1-8`).

La constante de base y las claves de almacenamiento son:

```
export const API_BASE = '/api/v1';
const TOKEN_KEY = 'ggto_token';
const USER_KEY = 'ggto_usuario';
```

(`app/web/src/api/client.ts:93-96`). La clase `ApiError` extiende `Error` y transporta el código HTTP
en la propiedad `status` (`app/web/src/api/client.ts:102-110`).

Las funciones de sesión gestionan el `localStorage`: `getToken()` (`app/web/src/api/client.ts:141-143`),
`getUsuarioGuardado()` con `try/catch` sobre el `JSON.parse`
(`app/web/src/api/client.ts:145-153`), `guardarSesion()` (`app/web/src/api/client.ts:155-158`) y
`limpiarSesion()` (`app/web/src/api/client.ts:160-163`).

El núcleo es la función `request<T>()` (`app/web/src/api/client.ts:178-203`), que:

1. Copia las cabeceras y fija `Accept: application/json`
   (`app/web/src/api/client.ts:179-180`).
2. Fija `Content-Type: application/json` salvo cuando el cuerpo es `FormData`, porque en ese caso el
   navegador debe fijar su propio `Content-Type` con el *boundary*
   (`app/web/src/api/client.ts:181-187`).
3. Adjunta el token como `Authorization: Bearer` si existe
   (`app/web/src/api/client.ts:188-189`).
4. Envuelve el `fetch` en `try/catch` y convierte un fallo de red en `ApiError(0, ...)` con un
   mensaje en español (`app/web/src/api/client.ts:191-198`).
5. Ante una respuesta no-OK, intenta leer el JSON y lanza `ApiError` con el mensaje extraído
   (`app/web/src/api/client.ts:200-211`).
6. Devuelve `undefined` ante un `204` o un cuerpo vacío, y parsea el JSON en caso contrario
   (`app/web/src/api/client.ts:213-220`).

El *helper* `extraerDetail()` (`app/web/src/api/client.ts:112-136`) maneja las tres formas en que
FastAPI devuelve errores: una cadena, un objeto con `detail` de tipo cadena, o un arreglo de errores
de validación Pydantic. En este último caso compone el mensaje con el nombre del campo y el `msg`
(`app/web/src/api/client.ts:118-131`).

Sobre `request` se construyen dos ayudantes: `conCuerpo()` para enviar JSON serializado
(`app/web/src/api/client.ts:205-207`) y `requestTexto()` para respuestas que no son JSON, como el
HTML del despacho imprimible (RT-08) (`app/web/src/api/client.ts:210-255`).

Las funciones de recurso cubren todas las secciones. El listado siguiente es representativo y
verificado por nombre de exportación:

| Grupo | Funciones | Ejemplo de línea |
|---|---|---|
| Autenticación | `login`, `obtenerMe`, `desbloquear` | `app/web/src/api/client.ts:264,268,272` |
| Central | `listarCentral`, `crearCentral`, `obtenerCentral`, `actualizarCentral`, `desactivarCentral` | `app/web/src/api/client.ts:280-298` |
| Sectores | `listarSectores`, `crearSector`, `agregarDireccionSector`, `eliminarDireccionSector` | `app/web/src/api/client.ts:304-334` |
| Técnicos y flota | `listarTecnicos`, `crearTecnico`, `listarFlota`, `crearFlota`, `retirarFlota` | `app/web/src/api/client.ts:341-384` |
| Cuadrillas | `listarCuadrillas`, `crearCuadrilla`, `agregarIntegrante`, `retirarIntegrante` | `app/web/src/api/client.ts:391-417` |
| Catálogos y parámetros | `listarCausas`, `listarMetodos`, `listarConfiguracion`, `actualizarConfiguracion` | `app/web/src/api/client.ts:426-455` |
| Ingesta | `previewIngesta`, `cargarIngesta`, `listarLotes`, `obtenerLote` | `app/web/src/api/client.ts:477-492` |
| Casos | `listarCasos`, `buscarCasos`, `obtenerCaso`, `crearCaso`, `actualizarCaso`, `obtenerHistorialCaso` | `app/web/src/api/client.ts:500-534` |
| Despacho | `simularPropuesta`, `generarDespacho`, `listarDespachos`, `obtenerImprimible`, `enviarDespacho` | `app/web/src/api/client.ts:542-647` |
| Especiales y agenda | `listarSolicitantes`, `listarCasosEspeciales`, `listarCitas`, `listarSeguimiento` | `app/web/src/api/client.ts:679-746` |

La ingesta usa `FormData` para subir el archivo, lo que explica la excepción de `Content-Type` en
`request` (`app/web/src/api/client.ts:181-187`). Las funciones `previewIngesta` y `cargarIngesta`
reciben un `File` y un `idCentral` opcional (`app/web/src/api/client.ts:477-485`).

### app/web/src/api/types.ts

`types.ts` (988 líneas) reúne las interfaces TypeScript que reflejan los contratos de la API. Los
grupos verificados son:

| Grupo | Interfaces | Referencia |
|---|---|---|
| Autenticación | `Usuario`, `TokenResponse`, `PalabraPosicion`, `UnlockResponse` | `app/web/src/api/types.ts:10-36` |
| Central | `Central`, `CentralCreate`, `CentralUpdate` | `app/web/src/api/types.ts:42-58` |
| Sectores | `TipoCoincidencia`, `SectorDireccionCreate`, `SectorDireccion`, `Sector`, `SectorCreate` | `app/web/src/api/types.ts:64-90` |

Se observan dos convenciones útiles:

- Los tipos de creación se derivan de los de lectura con utilidades del lenguaje. Por ejemplo,
  `export type CentralCreate = Omit<Central, 'id_central'>` y
  `export type CentralUpdate = Partial<CentralCreate>` (`app/web/src/api/types.ts:57-58`).
- Los campos anulables se escriben con `| null` y los opcionales con `?`, respetando la nulabilidad
  real de la base (`app/web/src/api/types.ts:12-17`).

Los tipos de unión de cadenas literales se usan para enums del dominio. Un ejemplo es
`TipoCoincidencia = 'CONTIENE' | 'EXACTO' | 'REGEX'` (`app/web/src/api/types.ts:64`), que coincide
con los tipos de coincidencia de `sector_direccion` que consume el servicio de sectorización
(`app/api/routes_casos.py:53`).

## Graficos SVG propios

### app/web/src/components/graficos.tsx (barras, curva, torta)

El módulo de gráficos (349 líneas) implementa las visualizaciones de la página MONITOREO **en SVG
puro**, sin dependencias externas. El encabezado lo afirma de manera explícita: *«Sin dependencias
externas (nada de recharts/chart.js): barras, barras agrupadas, curva (línea) y torta se dibujan con
SVG y las clases CSS de `styles.css`. Todos son de solo lectura y reciben datos ya calculados»*
(`app/web/src/components/graficos.tsx:1-7`).

Las constantes de dibujo son `ANCHO = 640`, `MARGEN_SUP = 20` y `MARGEN_INF = 60`
(`app/web/src/components/graficos.tsx:10-12`). La paleta de series se exporta como
`PALETA = ['#0b4f9c', '#1f7a4d', '#8a6100', '#b3261e', '#5b21b6', '#0e7490']`
(`app/web/src/components/graficos.tsx:15`). El comentario del archivo aclara que el ancho es lógico
y que el SVG escala con `width: 100%` (`app/web/src/components/graficos.tsx:9`).

Los tipos de datos de entrada están declarados como interfaces: `DatoBarra`, `GrupoBarras`,
`SerieLinea` y `PorcionTorta` (`app/web/src/components/graficos.tsx:17-37`). La función auxiliar
`maximo()` garantiza un denominador mínimo de 1 para evitar división por cero
(`app/web/src/components/graficos.tsx:40-42`).

Los cuatro componentes exportados son:

| Componente | Tipo de gráfico | Referencia |
|---|---|---|
| `GraficoBarras` | Barras simples | `app/web/src/components/graficos.tsx:91` |
| `GraficoBarrasAgrupadas` | Barras agrupadas por serie | `app/web/src/components/graficos.tsx:147` |
| `GraficoLineas` | Curva con varias series | `app/web/src/components/graficos.tsx:228` |
| `GraficoTorta` | Torta con centro | `app/web/src/components/graficos.tsx:292` |

Los componentes de apoyo internos son `EtiquetaEje`, que parte el texto por palabras para evitar
solapamiento en el eje X (`app/web/src/components/graficos.tsx:45-66`), y `Leyenda`
(`app/web/src/components/graficos.tsx:68`). Todos los componentes aceptan un parámetro `alto` con
valor por defecto (250 para barras, 280 para líneas, según
`app/web/src/components/graficos.tsx:91,228`).

El uso de `aria` en los gráficos debe revisarse en la auditoría de accesibilidad de RNF-23; el
estado actual de esa revisión es **pendiente de confirmar**
(`RepoTecnico/requerimientos.md:202`).

## Constructor y salida (npm run build -> app/web/dist, servida por FastAPI)

El proceso de construcción está definido en el script `build` de `package.json`:
`"build": "tsc && vite build"` (`app/web/package.json:9`). La secuencia es:

1. **Verificación de tipos.** `tsc` se ejecuta primero con la configuración estricta de
   `app/web/tsconfig.json:18-19`. Si hay un error de tipos, el comando falla y no se genera el
   *bundle*.
2. **Empaquetado.** `vite build` compila y optimiza la aplicación, y escribe el resultado en
   `dist` por la configuración `build.outDir = 'dist'` (`app/web/vite.config.ts:16-18`).
3. **Salida.** El directorio resultante es `app/web/dist`. En el repositorio verificado contiene
   `index.html` y la carpeta de recursos; los nombres de los artefactos llevan un *hash* de
   contenido, por ejemplo `index-B48LMoIz.css` e `index-BGs0NhQL.js`.
4. **Servido.** FastAPI monta ese directorio en `/` con `SPAStaticFiles` únicamente si existe
   (`app/main.py:103-105`). El *fallback* a `index.html` resuelve los *deep links*
   (`app/main.py:94-99`).
5. **Contenedor.** La imagen Docker es multi-etapa: una etapa Node ejecuta la construcción y la etapa
   Python sirve el resultado (`RepoTecnico/entornos_globales.md:321`). El contenido exacto del
   `Dockerfile` (versión de Node, etapa de construcción, usuario de ejecución) es **pendiente de
   confirmar** porque ese archivo no forma parte de los documentos verificados de este manual.

Para desarrollo local, el flujo es `npm run dev` en `app/web` (puerto 5173) con el backend escuchando
en el puerto 8000; el proxy de Vite evita problemas de CORS y de rutas relativas
(`app/web/vite.config.ts:7-15`).

| Comando | Efecto | Referencia |
|---|---|---|
| `npm run dev` | Servidor Vite con proxy `/api` a `localhost:8000` | `app/web/package.json:8` |
| `npm run build` | `tsc` + `vite build` → `app/web/dist` | `app/web/package.json:9` |
| `npm run preview` | Servidor de previsualización del *build* | `app/web/package.json:10` |

## Estado actual y pendientes (accesibilidad RNF-23, pruebas de UI: pendiente de confirmar)

El estado verificado del frontend y sus pendientes son los siguientes:

- **Cobertura de UI.** El plan de pruebas de la Fase 4 incluye un nivel **E2E de navegador** con
  Playwright contra el esquema aislado `ggto_e2e`
  (`RepoTecnico/pruebas/plan_pruebas.md`; el cierre se registra en
  `RepoTecnico/estado_proyecto.md:126`). El resultado documentado es **46/46 pruebas E2E en verde**
  junto con 169/169 de pytest, para un total de 215
  (`RepoTecnico/estado_proyecto.md:126`). El detalle de escenarios y su alcance exacto por página es
  **pendiente de confirmar** contra el informe de Fase 4.
- **Accesibilidad.** RNF-23 exige que la web sea conforme a **WCAG 2.1 AA** y que la verificación se
  haga con auditoría automatizada (axe/Lighthouse) más revisión manual
  (`RepoTecnico/requerimientos.md:202`). El código incluye algunas bases: `aria-hidden` en el
  *spinner* de carga (`app/web/src/components/RutaProtegida.tsx:11`), `aria-label` y `title` en los
  enlaces de sección (`app/web/src/components/Layout.tsx:200-201`), `role="menu"` y
  `aria-haspopup` en los desplegables (`app/web/src/components/Layout.tsx:67-78`) y `aria-label` en
  el enlace de marca (`app/web/src/components/Layout.tsx:175`). La auditoría formal con axe o
  Lighthouse y el registro de conformidad AA están **pendientes de confirmar**.
- **Contraste y foco.** La paleta base de los gráficos se exporta como `PALETA`
  (`app/web/src/components/graficos.tsx:15`) y las clases visuales viven en
  `app/web/src/styles.css`. El contraste efectivo de cada combinación frente al umbral 4.5:1 es
  **pendiente de confirmar** con una medición real.
- **Sincronización de tipos.** Los tipos de `app/web/src/api/types.ts` se mantienen a mano respecto a
  los esquemas Pydantic (`app/web/src/api/types.ts:1-4`). No hay generación automática ni verificación
  en CI de esa correspondencia; es un riesgo de desincronización **pendiente de confirmar** en cuanto
  a su mitigación.
- **Integración continua del frontend.** El *workflow* de CI verificado tiene un único trabajo
  `backend` que ejecuta Ruff, mypy y pytest (`.github/workflows/ci.yml:11-54`). La ejecución de
  `tsc`, de la construcción de Vite y de las pruebas E2E de Playwright dentro de ese *workflow* es
  **pendiente de confirmar**; en el momento de redactar este manual no aparecen como pasos del
  archivo de CI.
- **Aplicación móvil.** La APK Android en Flutter **no está desarrollada** (ciclo 8 diferido); este
  manual no la documenta como existente. Cualquier referencia a una app móvil en la interfaz web se
  refiere a la adaptación responsive de la propia SPA, no a una aplicación nativa.
- **WhatsApp.** No existe integración con WhatsApp; fue diferida a la v3
  (`RepoTecnico/estado_proyecto.md:92`).
