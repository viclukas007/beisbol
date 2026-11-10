import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { Player, Snapshot } from '../types';
import { TeamLogo, batting, descriptions, format, labels, pitching, titleName, type Key, type TeamMap } from './shared';

const featured: Key[] = ['avg', 'hits', 'hr', 'rbi'];
const roundColumns: Key[] = ['ab', 'hits', 'hr', 'rbi', 'avg', 'ip', 'k'];

export default function PlayerDialog({ player, data, teams, onClose }: { player: Player | undefined; data: Snapshot; teams: TeamMap; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (player && dialog && !dialog.open) dialog.showModal();
    if (!player && dialog?.open) dialog.close();
  }, [player]);
  const rounds = player ? data.rounds.filter(r => r.playerId === player.id && (r.stats.ab > 0 || r.stats.ip > 0 || r.stats.jj > 0)) : [];
  // Rival de la jornada según el rol: la jornada de estadísticas se empareja con la del calendario del equipo actual del jugador.
  const rivalOf = (round: number) => {
    if (!player) return '—';
    const games = data.games.filter(g => !g.deletedAt && g.round === round && (g.homeTeamId === player.teamId || g.awayTeamId === player.teamId));
    if (games.length !== 1) return games.length ? 'Varios' : '—';
    const game = games[0], home = game.homeTeamId === player.teamId;
    const rival = teams.get(home ? game.awayTeamId : game.homeTeamId)?.name ?? '—';
    const score = game.status === 'completed' && game.homeScore !== null && game.awayScore !== null ? `${home ? game.homeScore : game.awayScore}–${home ? game.awayScore : game.homeScore}` : '';
    return <>{rival}{score && <small>{score}</small>}</>;
  };
  return <dialog ref={ref} className="pub-dialog" onClose={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    {player && <>
      <div className="pub-dialog-header"><span>Ficha del jugador</span><button type="button" className="pub-icon-button" aria-label="Cerrar ficha" onClick={onClose}><X size={22} /></button></div>
      <div className="pub-dialog-body">
        <div className="pub-profile"><TeamLogo team={teams.get(player.teamId)} size={64} /><div><h2>{titleName(player.name)}</h2><p className="pub-muted">{teams.get(player.teamId)?.name} · acumulado del torneo</p></div></div>
        <div className="pub-featured">{featured.map(key => <div key={key}><strong>{format(player.stats[key], key)}</strong><span>{descriptions[key]}</span></div>)}</div>
        <h3>Estadísticas acumuladas</h3>
        <div className="pub-stat-grid">{[...batting.filter(k => !featured.includes(k)), ...pitching].map(key => <div key={key}><span title={descriptions[key]}>{labels[key]}</span><strong>{format(player.stats[key], key)}</strong></div>)}</div>
        <h3>Jornadas con actividad</h3>
        {rounds.length ? <div className="pub-table-scroll"><table className="pub-table compact">
          <thead><tr><th scope="col">Jornada</th><th scope="col" title="Según el rol de juegos de esa jornada">Rival</th>{roundColumns.map(key => <th key={key} scope="col" className="num" title={descriptions[key]}>{labels[key]}</th>)}</tr></thead>
          <tbody>{rounds.map(r => <tr key={r.round}><td>{r.round}</td><td className="pub-rival">{rivalOf(r.round)}</td>{roundColumns.map(key => <td key={key} className="num">{format(r.stats[key], key)}</td>)}</tr>)}</tbody>
        </table></div> : <p className="pub-muted">Sin actividad registrada por jornada.</p>}
      </div>
    </>}
  </dialog>;
}
