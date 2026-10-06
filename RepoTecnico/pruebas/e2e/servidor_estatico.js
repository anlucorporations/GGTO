/**
 * Servidor estático mínimo para probar la SPA construida (`app/web/dist`).
 *
 * Uso (desde la raíz del repositorio):
 *   node RepoTecnico/pruebas/e2e/servidor_estatico.js [puerto]
 *
 * Sirve `app/web/dist` en `http://127.0.0.1:<puerto>/` (por defecto 8091) con
 * respaldo de SPA hacia `index.html`. Es **solo para pruebas de interfaz**: no
 * implementa la API (las llamadas a `/api/**` responderán 404).
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PUERTO = Number(process.argv[2] || process.env.GGTO_ESTATICO_PORT || 8091);
const RAIZ = path.resolve(__dirname, '..', '..', '..', 'app', 'web', 'dist');

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.pdf': 'application/pdf',
  '.apk': 'application/vnd.android.package-archive',
};

function enviar(res, ruta, codigo = 200) {
  const extension = path.extname(ruta).toLowerCase();
  res.writeHead(codigo, { 'Content-Type': TIPOS[extension] || 'application/octet-stream' });
  fs.createReadStream(ruta).pipe(res);
}

const servidor = http.createServer((peticion, respuesta) => {
  const url = decodeURIComponent((peticion.url || '/').split('?')[0]);
  const candidato = path.join(RAIZ, url);

  // Nunca salir del directorio servido.
  if (!candidato.startsWith(RAIZ)) {
    respuesta.writeHead(403).end('Prohibido');
    return;
  }

  fs.stat(candidato, (error, info) => {
    if (!error && info.isFile()) {
      enviar(respuesta, candidato);
      return;
    }
    if (!error && info.isDirectory()) {
      const indice = path.join(candidato, 'index.html');
      if (fs.existsSync(indice)) {
        enviar(respuesta, indice);
        return;
      }
    }
    // Respaldo de SPA: cualquier ruta desconocida devuelve el index.
    enviar(respuesta, path.join(RAIZ, 'index.html'));
  });
});

servidor.listen(PUERTO, '127.0.0.1', () => {
  console.log(`Estático GGTO en http://127.0.0.1:${PUERTO}/  (raíz: ${RAIZ})`);
});
