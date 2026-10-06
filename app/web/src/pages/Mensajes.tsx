/**
 * MENSAJES (D-81 · RF-41) — mensajería interna unidireccional supervisor → técnicos.
 *
 * El sondeo es cada **20 s** (única pieza del sistema con ese periodo). Los técnicos
 * reciben y marcan como leído; SUPER/ADMIN/SUPERVISOR envían y ven su bandeja.
 */
import { useCallback, useEffect, useState } from 'react';
import * as api from '../api/client';
import type { Cuadrilla, Mensaje, Tecnico } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import Mensaje_ from '../components/Mensaje';
import { useMensajes } from '../components/useMensajes';

const ROLES_ENVIO = ['SUPER', 'ADMIN', 'SUPERVISOR'];

function hora(iso: string): string {
  const d = new Date(iso);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

const ETIQUETA_TIPO: Record<string, string> = {
  TEXTO: 'Mensaje',
  RECORDATORIO_CITA: 'Recordatorio de cita',
  ESTADO_SYNC: 'Estado de sincronización',
  ALARMA_DESPACHO: 'Alarma de despacho',
};

export default function Mensajes() {
  const { usuario } = useAuth();
  const puedeEnviar = ROLES_ENVIO.includes(usuario?.rol ?? '');
  const { mensajes, noLeidos, marcarLeido } = useMensajes();

  const [pestana, setPestana] = useState<'recibidos' | 'enviados'>('recibidos');
  const [destino, setDestino] = useState<'TODOS' | 'CUADRILLA' | 'TECNICO'>('TODOS');
  const [idCuadrilla, setIdCuadrilla] = useState<number | ''>('');
  const [idTecnico, setIdTecnico] = useState<number | ''>('');
  const [cuerpo, setCuerpo] = useState('');
  const [cuadrillas, setCuadrillas] = useState<Cuadrilla[]>([]);
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [enviados, setEnviados] = useState<Mensaje[]>([]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    if (!puedeEnviar) return;
    void api.listarCuadrillas({ solo_activas: true }).then(setCuadrillas).catch(() => {});
    void api.listarTecnicos().then(setTecnicos).catch(() => {});
  }, [puedeEnviar]);

  const cargarEnviados = useCallback(async () => {
    try {
      const r = await api.bandejaMensajes();
      setEnviados(r.items);
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'No se pudo leer la bandeja.');
    }
  }, []);

  useEffect(() => {
    if (pestana === 'enviados' && puedeEnviar) void cargarEnviados();
  }, [pestana, puedeEnviar, cargarEnviados]);

  async function enviar() {
    setError('');
    setOk('');
    try {
      await api.enviarMensaje({
        destino_tipo: destino,
        id_cuadrilla: destino === 'CUADRILLA' ? Number(idCuadrilla) : null,
        id_tecnico: destino === 'TECNICO' ? Number(idTecnico) : null,
        cuerpo,
      });
      setCuerpo('');
      setOk('Mensaje enviado.');
      if (pestana === 'enviados') void cargarEnviados();
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'No se pudo enviar el mensaje.');
    }
  }

  return (
    <>
      <div className="pagina-cabecera">
        <div>
          <h1>Mensajes</h1>
          <p>Mensajería interna (se actualiza cada 20 s). No leídos: {noLeidos}.</p>
        </div>
      </div>

      <Mensaje_ tipo="error" texto={error} onCerrar={() => setError('')} />
      <Mensaje_ tipo="ok" texto={ok} onCerrar={() => setOk('')} />

      {puedeEnviar && (
        <div className="panel-bloque">
          <h2>Enviar mensaje</h2>
          <div className="filtros-tabla">
            <div className="campo">
              <label htmlFor="msg-destino">Destino</label>
              <select
                id="msg-destino"
                value={destino}
                onChange={(e) => setDestino(e.target.value as typeof destino)}
              >
                <option value="TODOS">Todos los técnicos</option>
                <option value="CUADRILLA">Una cuadrilla</option>
                <option value="TECNICO">Un técnico</option>
              </select>
            </div>
            {destino === 'CUADRILLA' && (
              <div className="campo">
                <label htmlFor="msg-cuadrilla">Cuadrilla</label>
                <select
                  id="msg-cuadrilla"
                  value={idCuadrilla}
                  onChange={(e) => setIdCuadrilla(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">— Seleccione —</option>
                  {cuadrillas.map((c) => (
                    <option key={c.id_cuadrilla} value={c.id_cuadrilla}>
                      {c.codigo} · {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {destino === 'TECNICO' && (
              <div className="campo">
                <label htmlFor="msg-tecnico">Técnico</label>
                <select
                  id="msg-tecnico"
                  value={idTecnico}
                  onChange={(e) => setIdTecnico(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">— Seleccione —</option>
                  {tecnicos.map((t) => (
                    <option key={t.id_tecnico} value={t.id_tecnico}>
                      {t.p00 ?? ''} {t.nombre} {t.apellido ?? ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="campo">
            <label htmlFor="msg-cuerpo">Mensaje (máx. 500)</label>
            <textarea
              id="msg-cuerpo"
              maxLength={500}
              rows={2}
              value={cuerpo}
              onChange={(e) => setCuerpo(e.target.value)}
              placeholder="Mensaje corto para el equipo…"
            />
          </div>
          <button className="btn" type="button" onClick={() => void enviar()} disabled={!cuerpo.trim()}>
            Enviar
          </button>
        </div>
      )}

      <div className="operacion-pestanas" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={pestana === 'recibidos'}
          className={`operacion-pestana${pestana === 'recibidos' ? ' activa' : ''}`}
          onClick={() => setPestana('recibidos')}
        >
          Recibidos
        </button>
        {puedeEnviar && (
          <button
            type="button"
            role="tab"
            aria-selected={pestana === 'enviados'}
            className={`operacion-pestana${pestana === 'enviados' ? ' activa' : ''}`}
            onClick={() => setPestana('enviados')}
          >
            Enviados
          </button>
        )}
      </div>

      {pestana === 'recibidos' ? (
        <div className="panel-bloque">
          {mensajes.length === 0 ? (
            <p className="vacio">Sin mensajes.</p>
          ) : (
            mensajes.map((m) => (
              <div
                key={m.id_mensaje}
                className={`burbuja-mensaje${m.leido ? '' : ' no-leido'}`}
                onClick={() => {
                  if (!m.leido) void marcarLeido(m.id_mensaje);
                }}
              >
                <div className="burbuja-meta texto-pequeno">
                  <strong>{ETIQUETA_TIPO[m.tipo] ?? m.tipo}</strong> · {hora(m.creado_en)}
                  {!m.leido && <span className="punto-noleido" aria-label="No leído"> ●</span>}
                </div>
                <div className="burbuja-cuerpo">{m.cuerpo}</div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="panel-bloque">
          {enviados.length === 0 ? (
            <p className="vacio">Aún no ha enviado mensajes.</p>
          ) : (
            enviados.map((m) => (
              <div key={m.id_mensaje} className="burbuja-mensaje">
                <div className="burbuja-meta texto-pequeno">
                  <strong>{ETIQUETA_TIPO[m.tipo] ?? m.tipo}</strong> · {hora(m.creado_en)} · destino{' '}
                  {m.destino_tipo}
                </div>
                <div className="burbuja-cuerpo">{m.cuerpo}</div>
              </div>
            ))
          )}
        </div>
      )}
    </>
  );
}
