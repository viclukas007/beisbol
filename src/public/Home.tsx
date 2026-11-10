import { useState } from 'react';
import type { Snapshot } from '../types';
import { applyManualOrder, completedGames, rankStandings, standingsRows, type Scope } from '../standings-rules';
import AdBanner from '../AdBanner';
import { GameItem } from './Games';
import { TeamLogo, byDate, currentRound, dayLong, dayShort, groupByDate, todayISO, type PublicPage, type TeamMap } from './shared';

const scopes: { key: Scope; label: string }[] = [{ key: 'all', label: 'Temporada' }, { key: 1, label: '1.ª vuelta' }, { key: 2, label: '2.ª vuelta' }];
const pct = (value: number) => value >= 1 ? '1.000' : value.toFixed(3).replace(/^0/, '');
const signed = (value: number) => value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '0';

export default function Home({ data, teams, onNavigate }: { data: Snapshot; teams: TeamMap; onNavigate: (page: PublicPage) => void }) {
  const [scope, setScope] = useState<Scope>('all');
  const active = data.games.filter(g => !g.deletedAt);
  const today = todayISO();

  // Juegos de la jornada en curso, agrupados por día.
  const round = currentRound(active);
  const week = round === null ? [] : groupByDate(active.filter(g => g.round === round && g.status !== 'cancelled'));
  const nextDate = active.filter(g => g.status === 'scheduled' && g.date >= today).sort(byDate)[0]?.date;
  const soon = nextDate ? (new Date(nextDate).getTime() - new Date(today).getTime()) / 86400000 <= 6 : false;

  const games = completedGames(data.games, scope);
  const manual = data.league.standingsOrder?.[String(scope)];
  const rows = applyManualOrder(rankStandings(standingsRows(data.teams, games), games), manual);
  const pending = rows.filter(row => row.shared && row.played > 0);
  const results = completedGames(data.games).sort(byDate).slice(-6).reverse();

  return <>
    {week.length > 0 && <section className="pub-section" aria-labelledby="pub-week">
      <div className="pub-section-head">
        <h2 id="pub-week">{soon ? 'Esta semana' : 'Próxima jornada'} · Jornada {round}</h2>
        <button type="button" className="pub-link" onClick={() => onNavigate('rol')}>Ver el rol completo</button>
      </div>
      <div className="pub-day-grid">
        {week.map(day => <article key={day.date} className="pub-card pub-day">
          <div className="pub-day-head"><h3>{dayLong(day.date)}</h3>{day.date === today && <span className="pub-tag">Hoy</span>}</div>
          {day.games.map(game => <GameItem key={game.id} game={game} teams={teams} />)}
        </article>)}
      </div>
    </section>}

    <AdBanner />

    <div className="pub-split">
      <section className="pub-card pub-standings" aria-labelledby="pub-standings">
        <div className="pub-card-head">
          <div>
            <h1 id="pub-standings">Tabla de posiciones</h1>
            <p>{games.length} partidos finalizados · {manual ? 'orden definido por la liga' : 'ordenada por porcentaje de victorias'}</p>
          </div>
          <div className="pub-segmented" role="group" aria-label="Alcance de la tabla">
            {scopes.map(s => <button key={String(s.key)} type="button" aria-pressed={scope === s.key} onClick={() => setScope(s.key)}>{s.label}</button>)}
          </div>
        </div>
        <div className="pub-table-scroll">
          <table className="pub-table">
            <thead><tr>
              <th scope="col">Pos.</th>
              <th scope="col">Equipo</th>
              <th scope="col" className="num wide-only" title="Juegos jugados">JJ</th>
              <th scope="col" className="num" title="Ganados">G</th>
              <th scope="col" className="num" title="Perdidos">P</th>
              <th scope="col" className="num wide-only" title="Empatados">E</th>
              <th scope="col" className="num accent" title="Ganados entre jugados">PCT</th>
              <th scope="col" className="num wide-only" title="Carreras a favor">CF</th>
              <th scope="col" className="num wide-only" title="Carreras en contra">CC</th>
              <th scope="col" className="num" title="Diferencia de carreras">DIF</th>
            </tr></thead>
            <tbody>
              {rows.map(row => <tr key={row.team.id}>
                <td className="pub-pos">{row.position}{row.shared && row.played > 0 && <span className="pub-shared">Compartida</span>}</td>
                <th scope="row"><span className="pub-team"><TeamLogo team={row.team} size={36} /><span>{row.team.name}</span></span></th>
                <td className="num wide-only">{row.played}</td>
                <td className="num strong">{row.wins}</td>
                <td className="num">{row.losses}</td>
                <td className="num wide-only">{row.ties}</td>
                <td className="num pub-big accent">{row.played ? pct(row.pct) : '—'}</td>
                <td className="num wide-only">{row.runsFor}</td>
                <td className="num wide-only">{row.runsAgainst}</td>
                <td className="num">{signed(row.difference)}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <p className="pub-card-foot">
          {pending.length > 0 && <strong>{pending.length} equipos comparten posición en espera del volado. </strong>}
          <span className="wide-only">JJ jugados · </span>G ganados · P perdidos<span className="wide-only"> · E empatados</span> · PCT ganados entre jugados<span className="wide-only"> · CF y CC carreras a favor y en contra</span> · DIF diferencia de carreras
        </p>
      </section>

      {results.length > 0 && <aside className="pub-card pub-results" aria-labelledby="pub-results">
        <h2 id="pub-results">Últimos resultados</h2>
        {results.map(game => <GameItem key={game.id} game={game} teams={teams} showTime={false} caption={`Jornada ${game.round} · ${dayShort(game.date)}`} />)}
      </aside>}
    </div>
  </>;
}
