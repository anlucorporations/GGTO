/**
 * Aviso legal y de confidencialidad del proyecto (D-71).
 *
 * Fuente única de verdad para la interfaz: el texto completo vive en
 * `disclaimer.md` de la raíz del repositorio y se publica también como manual
 * (`/manual/00-General/disclaimer.html`). Aquí se replican los puntos que la
 * pantalla de acceso debe exigir aceptar antes de mostrar el formulario.
 */

export const DISCLAIMER_TITULO = 'Aviso legal y de confidencialidad';

export const DISCLAIMER_VERSION = 'GGTO v0.9.0 · 2026-09-30';

export const DISCLAIMER_AUTOR = 'Ing. Angel H. Lucci';

/** Enlaces disponibles dentro del aviso. */
export const DISCLAIMER_ENLACES = {
  /** Manual HTML completo servido desde `public/manual/`. */
  documento: '/manual/00-General/01-aviso-legal.html',
  /** Versión descargable en PDF. */
  pdf: '/manual/pdf/00-General/01-aviso-legal.pdf',
  /** Índice general de la ayuda. */
  ayuda: '/ayuda',
};

/** Cláusulas que el usuario acepta al ingresar. */
export const CLAUSULAS: { titulo: string; texto: string }[] = [
  {
    titulo: 'Proyecto experimental de carácter académico',
    texto:
      'Esta aplicación es un proyecto de experimento desarrollado por el Ing. Angel H. Lucci como ' +
      'parte de una actividad académica. Se entrega «tal cual», no es un sistema productivo ni está ' +
      'certificado para operaciones reales.',
  },
  {
    titulo: 'Prohibido divulgar, publicar o distribuir',
    texto:
      'No debes divulgar el producto, su documentación ni su código, ni publicarlo o distribuirlo ' +
      '(web, tiendas de aplicaciones, repositorios, redes) bajo ninguna modalidad.',
  },
  {
    titulo: 'Sin responsabilidad para CANTV C.A.',
    texto:
      'El uso de la aplicación no acarrea responsabilidades a CANTV C.A. Los resultados mostrados son ' +
      'ilustrativos y carecen de validez operativa, contractual, técnica o legal.',
  },
  {
    titulo: 'Información sensible y confidencial protegida',
    texto:
      'Los datos personales de abonados y usuarios, y la información del sistema (credenciales, hashes, ' +
      'palabras de seguridad, roles, estructura de la base de datos) no deben compartirse con terceros.',
  },
  {
    titulo: 'Uso correcto y evaluación del producto',
    texto:
      'Emplea la aplicación solo para estudiarla y evaluarla: no intentes evadir controles ni elevar ' +
      'privilegios, no cargues datos reales de abonados y reporta fallos, defectos y mejoras. La ' +
      'retroalimentación es el propósito de este ejercicio.',
  },
  {
    titulo: 'Compromiso con la ética profesional',
    texto:
      'Al aceptar te comprometes a actuar con honestidad, buena fe y confidencialidad, conforme a la ' +
      'ética profesional y a la normativa vigente de protección de datos personales.',
  },
];

/** Texto de la casilla de aceptación (compromiso explícito del usuario). */
export const ACEPTAR_TEXTO =
  'He leído y acepto cumplir los supuestos de comportamiento descritos, hago uso correcto de la ' +
  'aplicación y asumo el compromiso de confidencialidad conforme a la ética profesional.';

/** Clave del almacenamiento local donde se guarda la aceptación. */
export const CLAVE_ACEPTACION = 'ggto.disclaimer.aceptado';

const HASH_DOCUMENTO = 'd71-disclaimer-2026-09-30';

export function aceptacionPrevia(): boolean {
  try {
    return window.localStorage.getItem(CLAVE_ACEPTACION) === HASH_DOCUMENTO;
  } catch {
    // Navegadores con almacenamiento deshabilitado: se vuelve a pedir.
    return false;
  }
}

export function registrarAceptacion(): void {
  try {
    window.localStorage.setItem(CLAVE_ACEPTACION, HASH_DOCUMENTO);
  } catch {
    /* Sin persistencia disponible: la aceptación dura solo la sesión. */
  }
}
