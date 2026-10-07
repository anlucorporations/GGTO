import { useEffect, useState } from 'react';
import { IconoAndroid, IconoDescargar } from './Iconos';

/**
 * Descarga de la APK y sugerencia de instalación en móvil.
 *
 * El APK se publica en `app/web/public/apk/` con `scripts/publicar_apk.py`
 * (archivo `ggto-tecnico.apk` + metadatos `apk.json`).
 */

export const APK_URL = '/apk/ggto-tecnico.apk';
export const APK_META_URL = '/apk/apk.json';
/** Página que dispara la descarga y explica la instalación. */
export const APK_PAGINA = '/apk/';

export interface ApkMeta {
  archivo: string;
  ruta: string;
  nombre: string;
  version: string;
  bytes: number;
  kb: number;
  sha256: string;
  compilado_en: string;
  nota?: string;
}

/** Tamaño legible (MB con un decimal). */
export function tamanoLegible(kb: number): string {
  if (!kb) return '';
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

/**
 * Lee los metadatos del APK publicado y comprueba que el archivo exista.
 *
 * La comprobación del binario es necesaria porque el servidor de la SPA
 * responde `index.html` con 200 en cualquier ruta desconocida (fallback de
 * React Router): sin ella, un APK no publicado parecería descargable.
 */
export function useApkMeta() {
  const [meta, setMeta] = useState<ApkMeta | null>(null);
  const [disponible, setDisponible] = useState<boolean | null>(null);

  useEffect(() => {
    let activo = true;

    async function comprobar() {
      try {
        const respuesta = await fetch(APK_META_URL, { headers: { Accept: 'application/json' } });
        if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
        const datos = (await respuesta.json()) as ApkMeta;

        // Solo se piden los primeros bytes: confirma que el binario está publicado.
        // El respaldo de SPA del servidor devuelve `index.html` con 200 en rutas
        // desconocidas, así que también se valida el tipo de contenido.
        const binario = await fetch(APK_URL, { headers: { Range: 'bytes=0-0' } });
        const tipo = binario.headers.get('content-type') ?? '';
        const esBinario =
          binario.status === 206 ||
          (binario.ok && (tipo.includes('android') || tipo.includes('octet-stream')));
        binario.body?.cancel();
        if (!esBinario) throw new Error('APK no publicado');

        if (!activo) return;
        setMeta(datos);
        setDisponible(true);
      } catch {
        if (!activo) return;
        setDisponible(false);
      }
    }

    void comprobar();
    return () => {
      activo = false;
    };
  }, []);

  return { meta, disponible };
}

/** Plataforma detectada a partir del agente de usuario. */
export type Plataforma = 'android' | 'ios' | 'escritorio';

export function detectarPlataforma(): Plataforma {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  if (/android/i.test(ua)) return 'android';
  // iPadOS 13+ se identifica como Mac con pantalla táctil.
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  if (/macintosh/i.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1) {
    return 'ios';
  }
  return 'escritorio';
}

/** ¿Es un dispositivo móvil? */
export function esMovil(): boolean {
  return detectarPlataforma() !== 'escritorio';
}

const CLAVE_SUGERENCIA = 'ggto_apk_sugerencia_cerrada';

/** ¿El usuario cerró la sugerencia de instalación en este navegador? */
export function sugerenciaCerrada(): boolean {
  try {
    return localStorage.getItem(CLAVE_SUGERENCIA) === 'v1';
  } catch {
    return false;
  }
}

/** Recuerda que el usuario cerró la sugerencia. */
export function cerrarSugerencia(): void {
  try {
    localStorage.setItem(CLAVE_SUGERENCIA, 'v1');
  } catch {
    /* sin almacenamiento la sugerencia reaparecerá */
  }
}

/**
 * Botón de descarga del APK, con la versión y el tamaño publicados.
 * Visible para todos los dispositivos (el técnico también usa la web en PC).
 *
 * El enlace apunta **al archivo** (`/apk/ggto-tecnico.apk`, servido por el
 * servicio de Cloud Run en GCP), no a la página intermedia: un toque descarga.
 * El enlace a la página de instrucciones se ofrece aparte.
 */
export function DescargaApk({ compacto = false }: { compacto?: boolean }) {
  const { meta, disponible } = useApkMeta();

  if (disponible === false) {
    return (
      <p className="texto-pequeno apk-no-disponible">
        La <strong>APK de GGTO Técnico</strong> aún no está publicada en este servidor.
      </p>
    );
  }

  return (
    <div
      className={`apk-caja${compacto ? ' apk-caja-compacta' : ''}`}
      title={meta ? `SHA-256: ${meta.sha256}` : undefined}
    >
      <span className="apk-icono" aria-hidden="true">
        <IconoAndroid width={24} height={24} />
      </span>
      <div className="apk-texto">
        <strong>Aplicación móvil · GGTO Técnico</strong>
        <span className="texto-pequeno">
          {meta
            ? `Versión ${meta.version} · ${tamanoLegible(meta.kb)} · Android`
            : 'Android · APK de evaluación'}
        </span>
      </div>
      <div className="apk-acciones">
        <a
          className="btn btn-apk"
          href={APK_URL}
          download="ggto-tecnico.apk"
          title="Descargar el archivo APK firmado (Android)"
          data-testid="descargar-apk"
        >
          <IconoDescargar width={18} height={18} />
          Descargar APK
        </a>
        <a className="enlace apk-instrucciones" href={APK_PAGINA} data-testid="instrucciones-apk">
          Cómo instalar
        </a>
      </div>
    </div>
  );
}

/**
 * Aviso que se muestra al detectar un dispositivo móvil y que sugiere abrir o
 * instalar la APK. Es descartable; el descarte se recuerda en `localStorage`.
 */
export function SugerenciaApk({ onCerrar }: { onCerrar?: () => void }) {
  const plataforma = detectarPlataforma();
  const { meta } = useApkMeta();
  const [visible, setVisible] = useState(() => plataforma !== 'escritorio' && !sugerenciaCerrada());

  if (!visible) return null;

  const cerrar = () => {
    cerrarSugerencia();
    setVisible(false);
    onCerrar?.();
  };

  return (
    <div className="sugerencia-apk" role="status" aria-live="polite" data-testid="sugerencia-apk">
      <div className="sugerencia-apk-icono" aria-hidden="true">
        <IconoAndroid width={26} height={26} />
      </div>
      <div className="sugerencia-apk-texto">
        <strong>Está usando un dispositivo móvil</strong>
        <span className="texto-pequeno">
          {plataforma === 'android'
            ? 'Instale la APK de GGTO Técnico para trabajar en campo: funciona sin conexión, captura evidencias con GPS y sincroniza al recuperar la red.'
            : 'La APK de GGTO Técnico es para Android. En iPhone/iPad puede continuar en el navegador.'}
        </span>
        {meta && plataforma === 'android' && (
          <span className="texto-pequeno apk-meta">
            Versión {meta.version} · {tamanoLegible(meta.kb)}
          </span>
        )}
      </div>
      <div className="sugerencia-apk-acciones">
        {plataforma === 'android' && (
          <a className="btn btn-apk" href={APK_PAGINA} download data-testid="instalar-apk">
            Instalar APK
          </a>
        )}
        <a className="btn btn-secundario" href={APK_URL} target="_blank" rel="noreferrer">
          Ver archivo
        </a>
        <button type="button" className="enlace" onClick={cerrar} data-testid="cerrar-sugerencia">
          Omitir
        </button>
      </div>
    </div>
  );
}
