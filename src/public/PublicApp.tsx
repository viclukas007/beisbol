import { useMemo, useState } from 'react';
import { BarChart3, CalendarDays, ListOrdered, Shield } from 'lucide-react';
import type { Snapshot } from '../types';
import Home from './Home';
import Stats from './Stats';
import Teams from './Teams';
import Rol from './Rol';
import PlayerDialog from './PlayerDialog';
import { Filters, dayMonth, usePool, type PublicPage } from './shared';

const navigation: { page: PublicPage; label: string; long?: string; icon: typeof Shield }[] = [
  { page: 'posiciones', label: 'Posiciones', icon: ListOrdered },
  { page: 'estadisticas', label: 'Estadísticas', icon: BarChart3 },
  { page: 'equipos', label: 'Equipos', icon: Shield },
  { page: 'rol', label: 'Rol', long: ' de juegos', icon: CalendarDays },
];
const turnNames: Record<string, string> = { 1: 'primera vuelta', 2: 'segunda vuelta' };

// Vista pública del torneo. La administración conserva su propia pantalla en App.tsx.
export default function PublicApp({ data, connected, error, reload, openAdmin }: { data: Snapshot; connected: boolean; error: string; reload: () => void; openAdmin: () => void }) {
  const [page, setPage] = useState<PublicPage>('posiciones');
  const [teamId, setTeamId] = useState('all');
  const [round, setRound] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const teams = useMemo(() => new Map(data.teams.map(t => [t.id, t])), [data.teams]);
  const pool = usePool(data, round);
  const selected = selectedId === null ? undefined : data.players.find(p => p.id === selectedId);

  const navigate = (next: PublicPage) => { setPage(next); setSearch(''); window.scrollTo({ top: 0 }); };
  const selectTeam = (id: number) => { setTeamId(String(id)); navigate('estadisticas'); };
  const clear = () => { setSearch(''); setTeamId('all'); };
  const club = data.schedule.club?.replace(/\s+A\.?\s?C\.?$/i, '');
  const turns = Object.entries(data.schedule.turns ?? {});
  const filters = <Filters data={data} teamId={teamId} round={round} search={search} onTeam={setTeamId} onRound={setRound} onSearch={setSearch} />;

  return <div className="pub">
    <div className="pub-wrap">
      <header className="pub-header">
        <a href="/" className="pub-brand" onClick={e => { e.preventDefault(); navigate('posiciones'); }}>
          {data.league.logoUrl && <img src={data.league.logoUrl} alt="" />}
          <span><strong>{data.league.name}</strong><small>{[club, `Temporada ${data.schedule.season.replace('-', '–')}`].filter(Boolean).join(' · ')}</small></span>
        </a>
        <nav className="pub-nav" aria-label="Secciones del torneo">
          {navigation.map(item => <button key={item.page} type="button" aria-current={page === item.page ? 'page' : undefined} onClick={() => navigate(item.page)}><item.icon size={24} aria-hidden="true" /><span>{item.label}{item.long && <span className="pub-nav-long">{item.long}</span>}</span></button>)}
        </nav>
      </header>

      <main className="pub-main">
        {error && <div className="pub-error" role="alert">{error} Se muestran los últimos datos disponibles. <button type="button" className="pub-link" onClick={reload}>Reintentar</button></div>}

        {page === 'posiciones' && <Home data={data} teams={teams} onNavigate={navigate} />}

        {page === 'estadisticas' && <>
          <div className="pub-page-head"><div><h1>Líderes del torneo</h1><p>Los cinco mejores de cada categoría y quienes empaten con el quinto.</p></div>{filters}</div>
          <Stats pool={pool} teams={teams} teamId={teamId} round={round} search={search} onClear={clear} onSelect={setSelectedId} />
        </>}

        {page === 'equipos' && <>
          <div className="pub-page-head"><div><h1>Equipos</h1><p>{data.teams.length} equipos · toca uno para ver su plantilla y estadísticas.</p></div>{filters}</div>
          <Teams teams={data.teams} pool={pool} teamId={teamId} search={search} onClear={clear} onSelect={selectTeam} />
        </>}

        {page === 'rol' && <>
          <div className="pub-page-head"><div><h1>Rol de juegos</h1><p>{[`${data.games.filter(g => !g.deletedAt).length} juegos`, ...turns.map(([key, turn]) => `${turnNames[key] ?? `vuelta ${key}`} del ${dayMonth(turn.start)} al ${dayMonth(turn.end)}`)].join(' · ')}</p></div></div>
          <Rol data={data} teams={teams} />
        </>}
      </main>

      <footer className="pub-footer">
        <span className="pub-status"><span className={`pub-dot${connected ? '' : ' offline'}`} aria-hidden="true" />{connected ? 'Marcadores actualizados en tiempo real' : 'Reconectando…'}</span>
        <span className="pub-actions"><button type="button" className="pub-link quiet" onClick={reload}>Actualizar</button><button type="button" className="pub-link quiet" onClick={openAdmin}>Administración</button></span>
      </footer>
    </div>
    <PlayerDialog player={selected} data={data} teams={teams} onClose={() => setSelectedId(null)} />
  </div>;
}
