import type { Player, Team } from '../types';
import AdBanner from '../AdBanner';
import { TeamLogo, format, normalize } from './shared';

export default function Teams({ teams, pool, teamId, search, onClear, onSelect }: { teams: Team[]; pool: Player[]; teamId: string; search: string; onClear: () => void; onSelect: (id: number) => void }) {
  const list = teams.filter(t => (teamId === 'all' || t.id === Number(teamId)) && (!search || normalize(t.name).includes(normalize(search))));
  const total = (players: Player[], key: 'ab' | 'hits' | 'hr') => players.reduce((sum, p) => sum + p.stats[key], 0);
  return <>
    <AdBanner />
    {list.length ? <div className="pub-team-grid">
      {list.map(team => {
        const roster = pool.filter(p => p.teamId === team.id && !p.placeholder);
        const ab = total(roster, 'ab'), hits = total(roster, 'hits');
        return <button key={team.id} type="button" className="pub-card pub-team-card" onClick={() => onSelect(team.id)}>
          <span className="pub-team-card-head"><TeamLogo team={team} size={56} /><span><strong>{team.name}</strong><small>{roster.length} jugadores</small></span></span>
          <span className="pub-team-stats">
            <span><b>{format(hits)}</b><small title="Hits">H</small></span>
            <span><b>{format(total(roster, 'hr'))}</b><small title="Home runs">HR</small></span>
            <span><b>{format(ab ? hits / ab : 0, 'avg')}</b><small title="Promedio de bateo">AVG</small></span>
          </span>
          <span className="pub-team-card-foot">Ver plantilla y estadísticas</span>
        </button>;
      })}
    </div> : <div className="pub-card pub-empty"><h3>No hay equipos para esta búsqueda</h3><button type="button" className="pub-button" onClick={onClear}>Limpiar filtros</button></div>}
  </>;
}
