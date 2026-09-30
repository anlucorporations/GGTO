/**
 * Página SISTEMAS (D-69) — inspección de la base de datos.
 *
 * Solo la ve el **Super Usuario** y se abre desde el menú de usuario. Muestra:
 *  - el análisis de la estructura del esquema (tablas, renglones, claves, índices),
 *  - una ficha por tabla, seleccionada en un desplegable, con su estructura y su
 *    contenido paginado de 50 renglones.
 *
 * El contenido llega del backend ya **ofuscado** en las columnas sensibles
 * (secretos y datos personales).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from '../api/client';
import type { EstructuraBD, FichaTabla, ContenidoTabla } from '../api/types';
import Mensaje from '../components/Mensaje';
import PieTabla from '../components/PieTabla';
import { useAuth } from '../auth/AuthContext';

const TAMANO_PAGINA = 50;

function kb(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`;
}

export default function Sistemas() {
  const { usuario } = useAuth();
  const [estructura, setEstructura] = useState<EstructuraBD | null>(null);
  const [tabla, setTabla] = useState('');
  const [detalle, setDetalle] = useState<FichaTabla | null>(null);
  const [contenido, setContenido] = useState<ContenidoTabla | null>(null);
  const [pagina, setPagina] = useState(1);
  const [filtroColumna, setFiltroColumna] = useState('');
  const [cargandoLista, setCargandoLista] = useState(true);
  const [cargandoFicha, setCargandoFicha] = useState(false);
  const [error, setError] = useState('');

  const esSuper = usuario?.rol === 'SUPER';

  const cargarEstructura = useCallback(async () => {
    setCargandoLista(true);
    try {
      const datos = await api.obtenerEstructura();
      setEstructura(datos);
      setError('');
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'No se pudo leer la estructura de la BD.');
    } finally {
      setCargandoLista(false);
    }
  }, []);

  useEffect(() => {
    if (esSuper) void cargarEstructura();
  }, [esSuper, cargarEstructura]);

  const cargarFicha = useCallback(async (nombre: string, destino: number) => {
    if (!nombre) return;
    setCargandoFicha(true);
    try {
      const [fichaTabla, filas] = await Promise.all([
        api.obtenerTabla(nombre),
        api.obtenerTablaDatos(nombre, destino, TAMANO_PAGINA),
      ]);
      setDetalle(fichaTabla);
      setContenido(filas);
      setPagina(filas.pagina);
      setError('');
    } catch (e) {
      setDetalle(null);
      setContenido(null);
      setError(e instanceof api.ApiError ? e.message : 'No se pudo leer la tabla seleccionada.');
    } finally {
      setCargandoFicha(false);
    }
  }, []);

  function seleccionarTabla(nombre: string) {
    setTabla(nombre);
    setPagina(1);
    void cargarFicha(nombre, 1);
  }

  function irA(destino: number) {
    setPagina(destino);
    void cargarFicha(tabla, destino);
  }

  const columnasVisibles = useMemo(() => {
    if (!contenido) return [];
    const filtro = filtroColumna.trim().toLowerCase();
    if (!filtro) return contenido.columnas;
    return contenido.columnas.filter((c) => c.toLowerCase().includes(filtro));
  }, [contenido, filtroColumna]);

  if (!esSuper) {
    return (
      <>
        <div className="pagina-cabecera">
          <div>
            <h1>Sistemas</h1>
          </div>
        </div>
        <Mensaje tipo="error" texto="Esta sección es exclusiva del Super Usuario." />
      </>
    );
  }

  return (
    <>
      <div className="pagina-cabecera">
        <div>
          <h1>Sistemas</h1>
          <p>Estructura y contenido de la base de datos. Acceso exclusivo del Super Usuario.</p>
        </div>
        <button className="btn btn-secundario" type="button" onClick={() => void cargarEstructura()}>
          {cargandoLista ? 'Analizando…' : 'Reanalizar'}
        </button>
      </div>

      <Mensaje tipo="error" texto={error} onCerrar={() => setError('')} />

      {/* ------------------------- 3.1 Análisis de la estructura ------------------------- */}
      <div className="panel-bloque">
        <h2>Análisis de la estructura de la base de datos</h2>
        {cargandoLista ? (
          <p className="texto-pequeno">Analizando el esquema…</p>
        ) : estructura ? (
          <>
            <div className="ficha-tarjetas">
              <div className="ficha-tarjeta">
                <div className="etiqueta">Base / esquema</div>
                <div className="valor">
                  {estructura.base} · {estructura.esquema}
                </div>
              </div>
              <div className="ficha-tarjeta">
                <div className="etiqueta">Motor</div>
                <div className="valor">{estructura.servidor}</div>
              </div>
              <div className="ficha-tarjeta">
                <div className="etiqueta">Tablas</div>
                <div className="valor">{estructura.total_tablas}</div>
              </div>
              <div className="ficha-tarjeta">
                <div className="etiqueta">Renglones totales</div>
                <div className="valor">{estructura.total_renglones}</div>
              </div>
              <div className="ficha-tarjeta">
                <div className="etiqueta">Espacio ocupado</div>
                <div className="valor">{kb(estructura.total_bytes)}</div>
              </div>
              <div className="ficha-tarjeta">
                <div className="etiqueta">Extensiones</div>
                <div className="valor">
                  {estructura.extensiones.map((e) => `${e.nombre} ${e.version}`).join(', ') || '—'}
                </div>
              </div>
            </div>

            <div className="tabla-envoltura">
              <table>
                <thead>
                  <tr>
                    <th>Tabla</th>
                    <th>Columnas</th>
                    <th>Renglones</th>
                    <th>Tamaño</th>
                    <th>PK</th>
                    <th>FK</th>
                    <th>Únicas</th>
                    <th>Índices</th>
                    <th>Disparadores</th>
                    <th>Descripción</th>
                  </tr>
                </thead>
                <tbody>
                  {estructura.tablas.map((t) => (
                    <tr key={t.tabla} className="fila-clicable" onClick={() => seleccionarTabla(t.tabla)}>
                      <td className="mono">{t.tabla}</td>
                      <td>{t.columnas}</td>
                      <td>{t.renglones}</td>
                      <td>{kb(t.bytes)}</td>
                      <td>{t.claves_primarias}</td>
                      <td>{t.claves_foraneas}</td>
                      <td>{t.unicas}</td>
                      <td>{t.indices}</td>
                      <td>{t.disparadores}</td>
                      <td className="texto-pequeno">{t.comentario ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <PieTabla
                  colSpan={10}
                  total={estructura.tablas.length}
                  singular="tabla"
                  plural="tablas"
                />
              </table>
            </div>
            <p className="texto-pequeno">Haga clic en una fila o use el selector para abrir su ficha.</p>
          </>
        ) : (
          <p className="vacio">Sin datos de estructura.</p>
        )}
      </div>

      {/* ------------------------- 3.2 Ficha de la tabla ------------------------- */}
      <div className="panel-bloque">
        <div className="filtros-tabla">
          <div className="campo">
            <label htmlFor="sistemas-tabla">Tabla</label>
            <select
              id="sistemas-tabla"
              value={tabla}
              onChange={(e) => seleccionarTabla(e.target.value)}
            >
              <option value="">— Seleccione una tabla —</option>
              {(estructura?.tablas ?? []).map((t) => (
                <option key={t.tabla} value={t.tabla}>
                  {t.tabla} ({t.renglones})
                </option>
              ))}
            </select>
          </div>
          {contenido && (
            <div className="campo">
              <label htmlFor="sistemas-columna">Filtrar columnas</label>
              <input
                id="sistemas-columna"
                value={filtroColumna}
                onChange={(e) => setFiltroColumna(e.target.value)}
                placeholder="Nombre de columna…"
              />
            </div>
          )}
        </div>

        {!tabla ? (
          <p className="vacio">Seleccione una tabla para ver su estructura y su contenido.</p>
        ) : cargandoFicha ? (
          <p className="texto-pequeno">Cargando la ficha de {tabla}…</p>
        ) : detalle && contenido ? (
          <>
            <h3 className="subtitulo-seccion">Estructura de {detalle.tabla}</h3>
            {detalle.comentario && <p className="texto-pequeno">{detalle.comentario}</p>}
            <p className="texto-pequeno">
              {detalle.renglones} renglón(es) · {detalle.total_columnas} columna(s) ·{' '}
              {detalle.claves_primarias.join(', ') || 'sin PK'} · {detalle.claves_foraneas.length} FK ·{' '}
              {detalle.indices.length} índices · {detalle.referencias_recibidas.length} referencias entrantes
            </p>
            {detalle.columnas_ofuscadas.length > 0 && (
              <div className="aviso aviso-info">
                <span>
                  Columnas ofuscadas por seguridad:{' '}
                  <strong>{detalle.columnas_ofuscadas.join(', ')}</strong>. Los secretos se guardan como
                  hash Argon2id y no son legibles.
                </span>
              </div>
            )}

            <div className="rejilla-mini">
              <div className="subpanel">
                <h4>Columnas</h4>
                <div className="tabla-envoltura">
                  <table>
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Tipo</th>
                        <th>Nulo</th>
                        <th>Por defecto</th>
                        <th>Clave</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalle.columnas.map((c) => (
                        <tr key={c.nombre}>
                          <td className="mono">
                            {c.nombre}
                            {c.sensible ? ' ⚿' : ''}
                          </td>
                          <td>{c.tipo}</td>
                          <td>{c.nulo ? 'Sí' : 'No'}</td>
                          <td className="texto-pequeno">{c.por_defecto ?? '—'}</td>
                          <td>{c.es_clave ? 'PK' : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                    <PieTabla
                      colSpan={5}
                      total={detalle.columnas.length}
                      singular="columna"
                      plural="columnas"
                    />
                  </table>
                </div>
              </div>

              <div className="subpanel">
                <h4>Claves foráneas</h4>
                {detalle.claves_foraneas.length === 0 ? (
                  <p className="vacio">Sin claves foráneas.</p>
                ) : (
                  <ul className="lista-simple">
                    {detalle.claves_foraneas.map((f) => (
                      <li key={f.nombre}>
                        <span className="mono">{f.columnas}</span> → {f.hacia}{' '}
                        <span className="texto-pequeno">({f.on_delete})</span>
                      </li>
                    ))}
                  </ul>
                )}
                <h4>Referencias entrantes</h4>
                {detalle.referencias_recibidas.length === 0 ? (
                  <p className="vacio">Ninguna tabla apunta a esta.</p>
                ) : (
                  <ul className="lista-simple">
                    {detalle.referencias_recibidas.map((r) => (
                      <li key={`${r.tabla}-${r.constraint}`}>
                        <span className="mono">{r.tabla}</span>{' '}
                        <span className="texto-pequeno">{r.constraint}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <h4>Índices y restricciones</h4>
                <ul className="lista-simple">
                  {detalle.unicas.map((u) => (
                    <li key={u.nombre}>
                      UNIQUE <span className="mono">{u.columnas}</span>
                    </li>
                  ))}
                  {detalle.indices.map((i) => (
                    <li key={i.nombre}>
                      INDEX <span className="mono">{i.nombre}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <h3 className="subtitulo-seccion">Contenido de {contenido.tabla}</h3>
            <div className="barra-paginacion">
              <span className="texto-pequeno">
                Total: {contenido.total} renglón(es) · página {contenido.pagina} de {contenido.paginas} ·
                {columnsLabel(contenido)}
              </span>
              <div className="paginacion-controles">
                <button
                  className="btn btn-mini btn-secundario"
                  type="button"
                  onClick={() => irA(pagina - 1)}
                  disabled={pagina <= 1 || cargandoFicha}
                >
                  Anterior
                </button>
                <button
                  className="btn btn-mini btn-secundario"
                  type="button"
                  onClick={() => irA(pagina + 1)}
                  disabled={pagina >= contenido.paginas || cargandoFicha}
                >
                  Siguiente
                </button>
              </div>
            </div>

            {contenido.filas.length === 0 ? (
              <p className="vacio">La tabla está vacía.</p>
            ) : (
              <div className="tabla-envoltura">
                <table>
                  <thead>
                    <tr>
                      {columnasVisibles.map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {contenido.filas.map((fila, indice) => (
                      <tr key={indice}>
                        {columnasVisibles.map((c) => (
                          <td key={c} className="celula-dato">
                            {mostrarValor(fila[c])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  <PieTabla
                    colSpan={Math.max(1, columnasVisibles.length)}
                    total={contenido.total}
                    singular="renglón"
                    plural="renglones"
                  />
                </table>
              </div>
            )}
          </>
        ) : (
          <p className="vacio">No se pudo leer la tabla.</p>
        )}
      </div>
    </>
  );
}

function columnsLabel(contenido: ContenidoTabla): string {
  return contenido.ofuscadas.length > 0
    ? ` ${contenido.ofuscadas.length} columna(s) ofuscada(s)`
    : '';
}

function mostrarValor(valor: unknown): string {
  if (valor === null || valor === undefined) return '—';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  const texto = String(valor);
  return texto.length > 220 ? `${texto.slice(0, 220)}…` : texto;
}
