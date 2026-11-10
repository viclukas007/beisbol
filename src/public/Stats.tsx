import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Search } from 'lucide-react';
import type { Player } from '../types';
import AdBanner from '../AdBanner';
import { TeamLogo, batting, descriptions, format, labels, normalize, pitching, titleName, type Key, type TeamMap } from './shared';

const categories: Key[] = ['hits', 'hr', 'rbi', 'avg', 'k', 'era', 'w'];
const pageSize = 20;

// pool: jugadores activos con las cifras del periodo elegido; los mínimos se calculan con toda la liga, antes del filtro de equipo.
export default function Stats({ pool, teams, teamId, round, search, onClear, onSelect }: { pool: Player[]; teams: TeamMap; teamId: string; round: string; search: string; onClear: () => void; onSelect: (id: number) => void }) {
  const [mode, setMode] = useState<'batting' | 'pitching'>('batting');
  const [sort, setSort] = useState<{ key: Key; asc: boolean }>({ key: 'avg', asc: false });
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [search, teamId, round, mode, sort]);

  const minAB = pool.reduce((sum, p) => sum + p.stats.ab, 0) / Math.max(pool.length, 1);
  // Mínimo de ERA: promedio de entradas lanzadas entre quienes han lanzado (no todos son pitchers).
  const pitchers = pool.filter(p => p.stats.ip > 0);
  const minIP = pitchers.reduce((sum, p) => sum + p.stats.ip, 0) / Math.max(pitchers.length, 1);
  const teamName = (p: Player) => teams.get(p.teamId)?.name ?? '';

  const visible = useMemo(() => pool.filter(p => !p.placeholder && (teamId === 'all' || p.teamId === Number(teamId)) && (!search || normalize(p.name + ' ' + (teams.get(p.teamId)?.name ?? '')).includes(normalize(search)))), [pool, teamId, search, teams]);
  const leaders = useMemo(() => categories.map(key => {
    const eligible = visible.filter(p => key === 'avg' ? p.stats.ab >= minAB && p.stats.ab > 0 : key === 'era' ? p.stats.ip >= minIP && p.stats.ip > 0 : p.stats[key] > 0)
      .sort((a, b) => (a.stats[key] - b.stats[key]) * (key === 'era' ? 1 : -1) || a.name.localeCompare(b.name, 'es'));
    // Los cinco mejores y quienes empaten con el quinto; los valores iguales comparten posición.
    const rows = eligible.filter((p, i) => i < 5 || p.stats[key] === eligible[4]?.stats[key]);
    return { key, rows: rows.map(p => ({ player: p, rank: rows.findIndex(other => other.stats[key] === p.stats[key]) + 1 })) };
  }), [visible, minAB, minIP]);

  // Quien no alcanza el mínimo aparece en la tabla, pero al ordenar por AVG o ERA va después de los que sí lo alcanzan.
  const qualifies = (p: Player) => mode === 'batting' ? p.stats.ab >= minAB : p.stats.ip >= minIP;
  const filtered = useMemo(() => visible.filter(p => mode === 'batting' || p.stats.ip > 0)
    .sort((a, b) => (['avg', 'era'].includes(sort.key) ? Number(qualifies(b)) - Number(qualifies(a)) : 0) || (a.stats[sort.key] - b.stats[sort.key]) * (sort.asc ? 1 : -1) || a.name.localeCompare(b.name, 'es')), [visible, mode, minAB, minIP, sort]);
  const columns = mode === 'batting' ? batting : pitching;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const rows = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const period = round === 'all' ? 'acumulado del torneo' : `jornada ${round}`;

  const changeMode = (next: 'batting' | 'pitching') => { setMode(next); setSort({ key: next === 'batting' ? 'avg' : 'era', asc: next === 'pitching' }); };
  const exportCSV = () => {
    const quote = (s: string | number) => `"${(typeof s === 'string' && /^[\s]*[=+\-@]/.test(s) ? "'" + s : String(s)).replace(/"/g, '""')}"`;
    const csv = [['Jugador', 'Equipo', ...columns.map(k => labels[k])], ...filtered.map(p => [p.name, teamName(p), ...columns.map(k => p.stats[k])])].map(row => row.map(quote).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = `estadisticas-${mode}-${round}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return <>
    <section className="pub-leader-grid" aria-label="Líderes por categoría">
      {leaders.map(({ key, rows: list }) => <article key={key} className="pub-card pub-leader">
        <div className="pub-leader-head"><h2>{descriptions[key]}</h2><span>{labels[key]}</span></div>
        {list.map(({ player, rank }) => <button key={player.id} type="button" className={`pub-leader-row${rank === 1 ? ' first' : ''}`} onClick={() => onSelect(player.id)}>
          <span className="pub-leader-rank">{rank}</span>
          <TeamLogo team={teams.get(player.teamId)} size={30} />
          <span className="pub-leader-name"><strong>{titleName(player.name)}</strong><small>{teamName(player)}</small></span>
          <b>{format(player.stats[key], key)}</b>
        </button>)}
        {!list.length && <p className="pub-empty-line">Sin jugadores elegibles.</p>}
      </article>)}
      <aside className="pub-card pub-method">
        <h2>Cómo se calculan</h2>
        <p>Promedio de bateo: hits entre turnos al bat, con un mínimo de {Math.ceil(minAB)} turnos.</p>
        <p>Efectividad: carreras limpias por cada 7 entradas, con un mínimo de {minIP.toFixed(1)} entradas lanzadas.</p>
        <p>Los valores iguales comparten posición.</p>
      </aside>
    </section>

    <AdBanner />

    <section className="pub-card" aria-labelledby="pub-players">
      <div className="pub-card-head">
        <div>
          <h2 id="pub-players">Todos los jugadores</h2>
          <p>{filtered.length} jugadores · {period} · toca un nombre para ver su ficha</p>
        </div>
        <div className="pub-actions">
          <div className="pub-segmented" role="group" aria-label="Tipo de estadística">
            <button type="button" aria-pressed={mode === 'batting'} onClick={() => changeMode('batting')}>Bateo</button>
            <button type="button" aria-pressed={mode === 'pitching'} onClick={() => changeMode('pitching')}>Pitcheo</button>
          </div>
          <button type="button" className="pub-button" onClick={exportCSV}>Exportar CSV</button>
        </div>
      </div>
      <div className="pub-table-scroll">
        <table className="pub-table clickable">
          <thead><tr>
            <th scope="col">#</th>
            <th scope="col">Jugador</th>
            {columns.map(key => <th key={key} scope="col" className={`num${sort.key === key ? ' accent' : ''}`} aria-sort={sort.key === key ? (sort.asc ? 'ascending' : 'descending') : undefined}>
              <button type="button" title={descriptions[key]} onClick={() => setSort({ key, asc: sort.key === key ? !sort.asc : key === 'era' })}>{labels[key]}{sort.key === key ? (sort.asc ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : null}</button>
            </th>)}
          </tr></thead>
          <tbody>
            {rows.map((p, i) => <tr key={p.id} onClick={() => onSelect(p.id)}>
              <td className="pub-muted">{page * pageSize + i + 1}</td>
              <th scope="row"><button type="button" className="pub-player" onClick={e => { e.stopPropagation(); onSelect(p.id); }}><TeamLogo team={teams.get(p.teamId)} size={34} /><span><strong>{titleName(p.name)}</strong><small>{teamName(p)}</small></span></button></th>
              {columns.map(key => {
                const below = ['avg', 'era'].includes(key) && !qualifies(p);
                return <td key={key} className={`num${sort.key === key ? ' pub-big accent' : ''}${below ? ' below' : ''}`} title={below ? `Sin el mínimo de ${mode === 'batting' ? `${Math.ceil(minAB)} AB` : `${minIP.toFixed(1)} IP`}; no compite por el liderato` : undefined}>{format(p.stats[key], key)}</td>;
              })}
            </tr>)}
          </tbody>
        </table>
        {!rows.length && <div className="pub-empty"><Search size={26} /><h3>No encontramos jugadores</h3><p>Cambia la búsqueda o el equipo.{mode === 'pitching' && ' En pitcheo solo aparecen quienes han lanzado.'}</p><button type="button" className="pub-button" onClick={onClear}>Limpiar filtros</button></div>}
      </div>
      <div className="pub-card-foot pub-pagination">
        <span>Mostrando {filtered.length ? page * pageSize + 1 : 0}–{Math.min((page + 1) * pageSize, filtered.length)} de {filtered.length}</span>
        <div className="pub-actions">
          <button type="button" className="pub-button" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</button>
          <span>{page + 1} / {pages}</span>
          <button type="button" className="pub-button" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Siguiente</button>
        </div>
      </div>
    </section>
  </>;
}
