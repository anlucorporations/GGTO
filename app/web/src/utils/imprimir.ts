/**
 * H-06: impresión segura de los documentos HTML que genera el servidor.
 *
 * El HTML contiene datos que escribe el usuario (nombre del cliente, dirección,
 * problema reportado, identificadores de pago...). Si se inyectara con
 * `document.write` en una pestaña del mismo origen, un `<script>` guardado en un
 * caso podría leer el token de `localStorage` y robar la sesión.
 *
 * Aquí el documento se renderiza en un `iframe` con `sandbox` y **sin
 * `allow-scripts`**: el navegador no ejecuta ningún script del contenido, pero
 * el padre (que sí es de confianza) puede lanzar el diálogo de impresión.
 */
export function imprimirHtml(html: string): void {
  const marco = document.createElement('iframe');
  marco.setAttribute('sandbox', 'allow-same-origin allow-modals');
  marco.setAttribute('title', 'Documento imprimible');
  marco.setAttribute('aria-hidden', 'true');
  marco.style.position = 'fixed';
  marco.style.left = '-10000px';
  marco.style.top = '0';
  // Tamaño de una hoja carta a 96 ppp: el iframe se maqueta como la página
  // impresa aunque esté fuera de la vista.
  marco.style.width = '816px';
  marco.style.height = '1056px';
  marco.style.border = '0';
  marco.style.pointerEvents = 'none';

  const retirar = () => marco.remove();

  marco.addEventListener('load', () => {
    const ventana = marco.contentWindow;
    if (!ventana) {
      retirar();
      return;
    }
    ventana.addEventListener('afterprint', retirar, { once: true });
    ventana.focus();
    ventana.print();
    // Respaldo: algunos navegadores no emiten `afterprint` al cerrar el diálogo.
    window.setTimeout(retirar, 300_000);
  });

  marco.srcdoc = html;
  document.body.appendChild(marco);
}
