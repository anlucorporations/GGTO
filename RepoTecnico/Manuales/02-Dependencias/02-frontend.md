# Dependencias del frontend GGTO

> Manual técnico de las dependencias de la interfaz web de **GGTO** (CANTV C.A., Central
> Francisco Salias / Área 4). La web es una SPA **React + TypeScript + Vite** que vive en
> `app/web/` y se sirve desde el mismo contenedor FastAPI. Todas las referencias `ruta:línea`
> fueron leídas del repositorio. Las versiones declaradas provienen de `package.json` y las
> **resueltas** de `package-lock.json`; lo que no puede comprobarse se marca como **pendiente de
> confirmar**. Este manual **no** documenta aplicaciones móviles ni canales de mensajería: la
> app Flutter del proyecto **no está desarrollada**.

## Fuentes

El frontend declara su cadena de dependencias en dos archivos complementarios. A diferencia del
backend, **sí existe un archivo de bloqueo** versionado en el repositorio, lo que permite
determinar la versión exacta instalada de cada paquete.

### app/web/package.json

El manifiesto describe el paquete como privado y de tipo módulo ES:

| Línea | Contenido | Efecto |
|---|---|---|
| `app/web/package.json:2` | `"name": "ggto-web"` | Nombre del paquete |
| `app/web/package.json:3` | `"private": true` | Evita su publicación accidental en un registro |
| `app/web/package.json:4` | `"version": "0.1.0"` | Versión de la web, independiente de la API |
| `app/web/package.json:5` | `"type": "module"` | Trata los `.js` como módulos ES |
| `app/web/package.json:6` | `"description": "GGTO — Web de administración…"` | Descripción del producto |

Los scripts se declaran en `app/web/package.json:7-11`, las dependencias de ejecución en
`app/web/package.json:12-16` y las de desarrollo en `app/web/package.json:17-23`. Todas las
versiones se declaran con el operador de rango compatible `^`, es decir, aceptan cualquier
versión mayor dentro de la misma versión mayor (por ejemplo `^18.3.1` admite `18.4.x` pero no
`19.x`).

### app/web/package-lock.json

El archivo de bloqueo está versionado en Git (`git ls-files` lo reporta como rastreado) y usa
`lockfileVersion: 3`. Contiene **119 entradas de paquete** y reproduce las dependencias raíz
tanto de ejecución como de desarrollo. Su valor práctico es doble:

1. **Fija la resolución exacta.** Las versiones resueltas de este manual provienen de este
   archivo, no del rango de `package.json`.
2. **Habilita `npm ci`.** La imagen Docker instala con `RUN npm ci`
   (`app/Dockerfile:9`), comando que exige la existencia del bloqueo y falla si
   `package.json` y `package-lock.json` están desincronizados. Es la garantía de
   reproducibilidad del frontend, en contraste con la ausencia de bloqueo en el backend.

`node_modules/` y `dist/` están excluidos de Git (`.gitignore:21-22`); el bloqueo sí se versiona,
que es la práctica correcta.

## Dependencias de ejecución

La web solo declara **tres** dependencias de ejecución (`app/web/package.json:12-16`). No usa
biblioteca de enrutado de estado global, ni cliente HTTP, ni librería de componentes, ni
librería de gráficos.

### react

#### Versión declarada y resuelta

- Declarada: `"react": "^18.3.1"` (`app/web/package.json:13`).
- Resuelta en el bloqueo: **18.3.1**.

#### Uso en el proyecto

Es el núcleo de la interfaz y de sus *hooks*. En el punto de entrada se importan `StrictMode`
(`app/web/src/main.tsx:1`) y `createRoot` desde `react-dom/client` (`app/web/src/main.tsx:2`),
y el árbol se renderiza dentro de `<StrictMode>` (`app/web/src/main.tsx:9`). Las páginas usan
`useState`, `useEffect` y otros *hooks* importados de `react`; el contenedor de autenticación
`AuthProvider` envuelve a la aplicación (`app/web/src/main.tsx:11`).

#### Licencia

**MIT.** La licencia consta en el propio archivo de bloqueo: la entrada
`node_modules/react` declara `"license": "MIT"`.

### react-dom

#### Versión declarada y resuelta

- Declarada: `"react-dom": "^18.3.1"` (`app/web/package.json:14`).
- Resuelta en el bloqueo: **18.3.1**.

#### Uso en el proyecto

Es el renderizador de React para el DOM. Se usa una sola vez, en el arranque:
`import { createRoot } from 'react-dom/client'` (`app/web/src/main.tsx:2`) y la llamada
`createRoot(document.getElementById('root') as HTMLElement).render(...)`
(`app/web/src/main.tsx:8-15`). El elemento `#root` se declara en la plantilla HTML
(`app/web/index.html:10`) y el script de entrada se carga como módulo
(`app/web/index.html:11`).

#### Licencia

**MIT**, según la entrada `node_modules/react-dom` del bloqueo.

### react-router-dom

#### Versión declarada y resuelta

- Declarada: `"react-router-dom": "^6.26.2"` (`app/web/package.json:15`).
- Resuelta en el bloqueo: **6.30.6** (el paquete subyacente `react-router` también resuelve
  6.30.6). El salto de `6.26.2` a `6.30.6` ilustra que el rango `^` admite actualizaciones
  menores: la versión realmente instalada es la del bloqueo.

#### Uso en el proyecto

Es el enrutador de la SPA. El enrutador de navegador se monta en la raíz de la aplicación
(`import { BrowserRouter } from 'react-router-dom'`, `app/web/src/main.tsx:3`, usado en
`app/web/src/main.tsx:10`). Las APIs consumidas son:

| Símbolo | Archivo y línea | Función |
|---|---|---|
| `Routes`, `Route`, `Navigate` | `app/web/src/App.tsx:1` | Tabla de rutas y redirección del comodín `*` |
| `Navigate`, `Outlet` | `app/web/src/components/RutaProtegida.tsx:1` | Guardia de sesión y anidamiento |
| `Link`, `NavLink`, `Outlet` | `app/web/src/components/Layout.tsx:2` | Barra superior y contenido anidado |
| `useNavigate` | `app/web/src/pages/Login.tsx:2`, `app/web/src/pages/Panel.tsx:2`, `app/web/src/pages/Especiales.tsx:2`, `app/web/src/components/BuscadorGlobal.tsx:2` | Navegación programática |
| `useLocation`, `useSearchParams` | `app/web/src/pages/Casos.tsx:2` | Lectura de la ruta y de los parámetros de consulta |
| `Navigate`, `useNavigate` | `app/web/src/pages/Login.tsx:2` | Redirección tras autenticar |

El árbol de rutas declara la ruta pública `/login` y quince rutas protegidas anidadas bajo
`RutaProtegida` y `Layout` (`app/web/src/App.tsx:24-43`): `/` (Panel), `ingesta`, `casos`,
`despacho`, `especiales`, `agenda`, `monitoreo`, `alertas`, `central`, `sectores`, `tecnicos`,
`flota`, `cuadrillas`, `catalogos` y `parametros`. Cualquier ruta desconocida redirige a la raíz
con `<Navigate to="/" replace />` (`app/web/src/App.tsx:46`).

#### Licencia

**MIT**, según la entrada `node_modules/react-router-dom` del bloqueo (y también
`node_modules/react-router`).

## Dependencias de desarrollo

Las dependencias de desarrollo son cinco (`app/web/package.json:17-23`): el compilador de
TypeScript, la herramienta de construcción, su *plugin* de React y los dos paquetes de tipos.

### typescript

#### Versión declarada y resuelta

- Declarada: `"typescript": "^5.6.3"` (`app/web/package.json:21`).
- Resuelta en el bloqueo: **5.9.3**.

#### Uso en el proyecto

Es el compilador y el verificador de tipos. Se invoca en el script de construcción como primer
paso: `"build": "tsc && vite build"` (`app/web/package.json:9`). La configuración del proyecto
vive en `app/web/tsconfig.json` y se detalla en la sección *Configuración de TypeScript*. El
informe de Fase 4 registra `tsc` en modo estricto sin hallazgos
(`RepoTecnico/pruebas/informe_fase4.md:20` y `RepoTecnico/pruebas/informe_fase4.md:96`).

#### Licencia

**Apache-2.0**, según la entrada `node_modules/typescript` del bloqueo (es la única dependencia
directa del proyecto con licencia distinta de MIT).

### vite

#### Versión declarada y resuelta

- Declarada: `"vite": "^5.4.9"` (`app/web/package.json:22`).
- Resuelta en el bloqueo: **5.4.21** (con `esbuild` 0.21.5 y `rollup` 4.63.5 como motores
  transitivos, ambos MIT).

#### Uso en el proyecto

Es el servidor de desarrollo y el empaquetador. Se usa en dos de los tres scripts:
`"dev": "vite"` (`app/web/package.json:8`) y `"build": "tsc && vite build"`
(`app/web/package.json:9`). Su configuración se analiza en la sección *Configuración de
TypeScript y Vite*. En la imagen Docker es la herramienta que produce `dist/`, que luego se
copia al contenedor de ejecución (`COPY --from=web /web/dist /srv/app/web/dist`,
`app/Dockerfile:25`).

#### Licencia

**MIT**, según la entrada `node_modules/vite` del bloqueo.

### @vitejs/plugin-react

#### Versión declarada y resuelta

- Declarada: `"@vitejs/plugin-react": "^4.3.2"` (`app/web/package.json:20`).
- Resuelta en el bloqueo: **4.7.0**.

#### Uso en el proyecto

Aporta la transformación de JSX y el *fast refresh* del servidor de desarrollo. Se importa en
`import react from '@vitejs/plugin-react'` (`app/web/vite.config.ts:2`) y se registra en el
arreglo de *plugins*: `plugins: [react()]` (`app/web/vite.config.ts:7`). Sin este *plugin*, Vite
no compilaría los archivos `.tsx` del proyecto.

#### Licencia

**MIT**, según la entrada `node_modules/@vitejs/plugin-react` del bloqueo.

### @types/react y @types/react-dom

#### Versión declarada y resuelta

| Paquete | Declarada | Resuelta |
|---|---|---|
| `@types/react` | `^18.3.11` (`app/web/package.json:18`) | **18.3.31** |
| `@types/react-dom` | `^18.3.1` (`app/web/package.json:19`) | **18.3.7** |

#### Uso en el proyecto

Son las definiciones de tipos de React y de su renderizador, necesarias para que `tsc` valide
los componentes `.tsx` con `strict` activo. No se importan en el código de `src/`; el compilador
las resuelve automáticamente al tipar los módulos `react` y `react-dom`. Su versión mayor debe
acompañar a la de React: ambas familias están en 18.

#### Licencia

**MIT**, según las entradas `node_modules/@types/react` y `node_modules/@types/react-dom` del
bloqueo.

## Scripts npm y su efecto

`app/web/package.json:7-11` declara exactamente tres scripts:

| Script | Comando literal | Efecto |
|---|---|---|
| `dev` | `vite` (`app/web/package.json:8`) | Levanta el servidor de desarrollo con recarga en caliente y el proxy hacia la API |
| `build` | `tsc && vite build` (`app/web/package.json:9`) | Primero verifica tipos con `tsc` y, solo si pasa, empaqueta en `dist/` |
| `preview` | `vite preview` (`app/web/package.json:10`) | Sirve localmente el resultado ya construido de `dist/` |

### Detalle de cada script

#### dev

Arranca Vite en el puerto 5173 (`app/web/vite.config.ts:9`) y reenvía las peticiones que
comienzan por `/api` a `http://localhost:8000`, donde se espera el backend FastAPI
(`app/web/vite.config.ts:10-14`). Es el modo de trabajo normal del desarrollador: el frontend y
la API se sirven desde orígenes distintos y el proxy evita problemas de CORS.

#### build

El operador `&&` encadena la verificación de tipos y el empaquetado: si `tsc` encuentra un error,
Vite no llega a ejecutarse y la construcción falla. Como `tsconfig.json` tiene `noEmit: true`
(`app/web/tsconfig.json:14`), `tsc` **no genera JavaScript**: solo comprueba. El JavaScript de
producción lo produce `vite build`, que escribe en `dist/` (`app/web/vite.config.ts:18`). Este
es el comando que ejecuta la primera etapa de la imagen Docker (`RUN npm run build`,
`app/Dockerfile:11`).

#### preview

Sirve `dist/` con un servidor estático de Vite. Requiere que la construcción se haya ejecutado
antes. **No** aplica el proxy `/api` ni reemplaza al backend: sus condiciones de uso en
producción son **pendiente de confirmar**; el despliegue real usa FastAPI sirviendo `dist/`
desde `app/web/dist` (`app/main.py:103-105`).

## Configuración de TypeScript y Vite

### tsconfig.json

El compilador se configura con un único archivo más una referencia. Los ajustes relevantes
(`app/web/tsconfig.json:1-23`) son:

| Clave | Valor | Línea | Efecto |
|---|---|---|---|
| `target` | `ES2020` | `:3` | Nivel de JavaScript emitido/validado |
| `lib` | `["ES2020", "DOM", "DOM.Iterable"]` | `:5` | Tipos de navegador disponibles |
| `module` | `ESNext` | `:6` | Módulos ES modernos |
| `skipLibCheck` | `true` | `:7` | Omite la comprobación de los `.d.ts` de terceros |
| `moduleResolution` | `bundler` | `:10` | Resolución de módulos al estilo empaquetador |
| `allowImportingTsExtensions` | `true` | `:11` | Permite importar con extensión `.ts`/`.tsx` |
| `resolveJsonModule` | `true` | `:12` | Permite importar JSON |
| `isolatedModules` | `true` | `:13` | Exige módulos compilables de forma aislada |
| `noEmit` | `true` | `:14` | `tsc` no emite archivos: solo valida |
| `jsx` | `react-jsx` | `:15` | Transformación JSX automática (no requiere `import React`) |
| `strict` | `true` | `:18` | Activa el conjunto estricto de comprobaciones |
| `noFallthroughCasesInSwitch` | `true` | `:19` | Prohíbe casos de `switch` sin `break` |

El alcance se limita a `src` (`include: ["src"]`, `app/web/tsconfig.json:21`) y se declara una
referencia al proyecto de configuración de Node (`references: [{ "path": "./tsconfig.node.json" }]`,
`app/web/tsconfig.json:22`).

#### Modo estricto

`"strict": true` (`app/web/tsconfig.json:18`) habilita la familia completa de comprobaciones:
`noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, entre otras. Se refuerza con
`noFallthroughCasesInSwitch` (`app/web/tsconfig.json:19`). El resultado verificado de esta
configuración es `tsc` estricto sin hallazgos en Fase 4
(`RepoTecnico/pruebas/informe_fase4.md:96`).

#### tsconfig.node.json

Configura por separado el archivo de Vite, que se ejecuta en Node y no en el navegador:
`"composite": true`, `"module": "ESNext"`, `"moduleResolution": "bundler"`,
`"allowSyntheticDefaultImports": true` y `"strict": true`, con
`"include": ["vite.config.ts"]` (`app/web/tsconfig.node.json:1-11`).

### vite.config.ts

El archivo tiene 20 líneas y tres bloques (`app/web/vite.config.ts:1-20`):

1. **Importaciones.** `defineConfig` desde `vite` y el *plugin* de React
   (`app/web/vite.config.ts:1-2`).
2. **Servidor de desarrollo.** `server.port = 5173` (`app/web/vite.config.ts:9`) y el proxy de
   `/api` hacia `http://localhost:8000` con `changeOrigin: true`
   (`app/web/vite.config.ts:10-14`). El comentario del propio archivo explica la decisión: «La
   web se sirve desde el mismo origen que la API. En desarrollo, Vite reenvía `/api` al backend
   FastAPI (uvicorn en el puerto 8000)» (`app/web/vite.config.ts:4-5`). Ese puerto 8000 es la
   convención local; el puerto real de producción es 8080 (`app/Dockerfile:17` y
   `app/Dockerfile:29`).
3. **Construcción.** `build.outDir = 'dist'` (`app/web/vite.config.ts:18`), coherente con la ruta
   que copia el Dockerfile (`app/Dockerfile:25`) y con el directorio que monta FastAPI
   (`app/main.py:103-105`).

#### Paridad de versiones de Node

La imagen Docker compila con `FROM node:20-slim` (`app/Dockerfile:6`), mientras que la estación
de verificación dispone de **Node v22.23.2** y **npm 10.9.8**. `npm ci` (usado en
`app/Dockerfile:9`) garantiza el mismo árbol de paquetes en ambos entornos, pero no la misma
versión del *runtime* de Node. Esto es una observación relevante para **RNF-25** (paridad de
entornos, `RepoTecnico/requerimientos.md:204`) y queda como **pendiente de confirmar** si la
política del proyecto exige igualar las versiones mayores de Node.

## Ausencia de librería de gráficos externa

### Gráficos SVG propios

El proyecto **no usa Recharts ni ninguna otra librería de gráficos**. Los gráficos de la página
MONITOREO se dibujan con SVG en línea en un único componente propio. El propio archivo lo
declara en su encabezado: «Gráficos SVG en línea para la página MONITOREO. Sin dependencias
externas (nada de recharts/chart.js): barras, barras agrupadas, curva (línea) y torta se dibujan
con SVG y las clases CSS de `styles.css`» (`app/web/src/components/graficos.tsx:1-7`).

#### Componentes exportados

| Componente | Línea | Tipo de gráfico |
|---|---|---|
| `GraficoBarras` | `app/web/src/components/graficos.tsx:91` | Barras simples |
| `GraficoBarrasAgrupadas` | `app/web/src/components/graficos.tsx:147` | Barras agrupadas por serie |
| `GraficoLineas` | `app/web/src/components/graficos.tsx:228` | Curva de líneas |
| `GraficoTorta` | `app/web/src/components/graficos.tsx:292` | Torta / circular |

El módulo define además una paleta de series propia (`PALETA`, seis colores,
`app/web/src/components/graficos.tsx:15`) y los tipos de datos de entrada
(`DatoBarra`, `GrupoBarras`, `SerieLinea`), y fija un ancho lógico de 640 unidades con el SVG
escalando al 100 % del contenedor (`app/web/src/components/graficos.tsx:9-12`).

### Contraste con la previsión documental

Los documentos de decisión preveían Recharts y **contradicen el código real**:

- La decisión **D-38** define el stack como «**React** (Vite/Recharts)»
  (`RepoTecnico/estado_proyecto.md:102`).
- La tabla de entornos repite «Frontend web | **React** (Vite) + librería de gráficos
  (Recharts)» (`RepoTecnico/entornos_globales.md:241`).

La verificación del repositorio muestra que **Recharts no está en `package.json`
(`app/web/package.json:12-23`) ni en el árbol resuelto de `package-lock.json`**. La afirmación
correcta para la documentación operativa es que los gráficos son **SVG propios sin dependencia
externa**; la diferencia debe registrarse como una desviación entre la previsión D-38 y la
implementación, no como una funcionalidad faltante.

### Otras ausencias verificadas

- **Cliente HTTP.** No hay `axios` ni otra librería: el cliente usa la API nativa `fetch`
  (`app/web/src/api/client.ts:197` y `app/web/src/api/client.ts:241`). El token se guarda en
  `localStorage` y se adjunta como `Bearer` (`app/web/src/api/client.ts:1-8`).
- **Estado global.** No hay Redux, Zustand ni MobX; el estado compartido de sesión se resuelve
  con el contexto propio `AuthProvider` (`app/web/src/main.tsx:5` y
  `app/web/src/main.tsx:11`).
- **Biblioteca de componentes.** No se declara ninguna: la interfaz se apoya en las clases de
  `app/web/src/styles.css`, importado en `app/web/src/main.tsx:6`.

### Implicación para la cadena de suministro

Al no existir dependencias de ejecución más allá de React, React DOM y React Router, la
superficie de riesgo del frontend en producción es mínima y **todas las licencias de las
dependencias directas son verificables** en `package-lock.json`: MIT para React, React DOM,
React Router DOM y Vite; Apache-2.0 para TypeScript. Cualquier incorporación futura de una
librería de gráficos (por ejemplo, la Recharts prevista en D-38) requeriría actualizar
`package.json`, regenerar `package-lock.json` y cerrar aquí su licencia; mientras eso no ocurra,
el estado real es el descrito.
