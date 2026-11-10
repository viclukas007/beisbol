import { useEffect, useState } from 'react';
import type { Game, Snapshot } from '../types';
import AdBanner from '../AdBanner';
import { GameItem, HitsDialog } from './Games';
import { byDate, capital, currentRound, dayLong, dayShort, groupByDate, rangeLabel, todayISO, type TeamMap } from './shared';

const roundsPerPage = 4;

export default function Rol({ data, teams }: { data: Snapshot; teams: TeamMap }) {
  const active = data.games.filter(g => !g.deletedAt);
  const current = currentRound(active);
  const [turn, setTurn] = useState('all');
  const [team, setTeam] = useState('all');
  const [round, setRound] = useState(current === null ? 'all' : String(current));
  const [page, setPage] = useState(0);
  const [hitsGame, setHitsGame] = useState<Game | null>(null);
  const today = todayISO();

  const base = active.filter(g => (turn === 'all' || g.turn === Number(turn)) && (team === 'all' || [g.homeTeamId, g.awayTeamId].includes(Number(team))));
  const rounds = [...new Set(active.filter(g => turn === 'all' || g.turn === Number(turn)).map(g => g.round))].sort((a, b) => a - b);
  const games = base.filter(g => round === 'all' || g.round === Number(round)).sort(byDate);
  useEffect(() => { setPage(0); }, [turn, team, round]);
  useEffect(() => { if (round !== 'all' && !rounds.includes(Number(round))) setRound('all'); }, [round, rounds]);

  // Por jornada, en el orden del calendario.
  const byRound = new Map<number, Game[]>();
  for (const game of games) byRound.set(game.round, [...(byRound.get(game.round) ?? []), game]);
  const sections = [...byRound.entries()].map(([number, list]) => ({ number, games: list }));
  const pages = Math.max(1, Math.ceil(sections.length / roundsPerPage));
  const shown = sections.slice(page * roundsPerPage, (page + 1) * roundsPerPage);

  const recent = round !== 'all' && Number(round) === current ? base.filter(g => g.status === 'completed' && g.homeScore !== null && g.awayScore !== null).sort(byDate).slice(-6).reverse() : [];
  const postponed = round === 'all' ? [] : base.filter(g => g.status === 'postponed' && g.round !== Number(round)).sort(byDate);
  const notes = data.schedule.notes ?? [];

  return <>
    <form className="pub-filters" onSubmit={e => e.preventDefault()}>
      <label>Vuelta
        <select value={turn} onChange={e => setTurn(e.target.value)}>
          <option value="all">Toda la temporada</option>
          <option value="1">Primera vuelta</option>
          <option value="2">Segunda vuelta</option>
        </select>
      </label>
      <label>Equipo
        <select value={team} onChange={e => setTeam(e.target.value)}>
          <option value="all">Todos los equipos</option>
          {data.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
      <label>Jornada
        <select value={round} onChange={e => setRound(e.target.value)}>
          <option value="all">Todas las jornadas</option>
          {rounds.map(r => <option key={r} value={r}>Jornada {r}{r === current ? ' · actual' : ''}</option>)}
        </select>
      </label>
    </form>

    {!games.length && <div className="pub-card pub-empty"><h3>No hay juegos con estos filtros</h3></div>}

    {team === 'all' ? shown.map(section => <section key={section.number} className="pub-section" aria-label={`Jornada ${section.number}`}>
      <div className="pub-section-head"><h2>Jornada {section.number} · {rangeLabel(section.games.map(g => g.date))}</h2></div>
      <div className="pub-day-grid wide">
        {groupByDate(section.games).map(day => <article key={day.date} className="pub-card pub-day">
          <div className="pub-day-head"><h3>{dayLong(day.date)}</h3>{day.date === today && <span className="pub-tag">Hoy</span>}</div>
          {day.games.map(game => <GameItem key={game.id} game={game} teams={teams} wide onHits={setHitsGame} />)}
        </article>)}
      </div>
    </section>) : games.length > 0 && <section className="pub-card pub-day" aria-label="Juegos del equipo">
      {games.map(game => <GameItem key={game.id} game={game} teams={teams} wide caption={`Jornada ${game.round} · ${dayLong(game.date)}`} onHits={setHitsGame} />)}
    </section>}

    {team === 'all' && sections.length > roundsPerPage && <div className="pub-pagination pub-actions">
      <button type="button" className="pub-button" disabled={page === 0} onClick={() => { setPage(page - 1); window.scrollTo({ top: 0 }); }}>Jornadas anteriores</button>
      <span>{page + 1} / {pages}</span>
      <button type="button" className="pub-button" disabled={page >= pages - 1} onClick={() => { setPage(page + 1); window.scrollTo({ top: 0 }); }}>Jornadas siguientes</button>
    </div>}
    {games.length > 0 && <p className="pub-muted">El equipo de la izquierda es el local.</p>}

    <AdBanner />

    {recent.length > 0 && <section className="pub-section" aria-labelledby="pub-recent">
      <div className="pub-section-head"><h2 id="pub-recent">Resultados recientes</h2></div>
      <div className="pub-day-grid wide">
        {recent.map(game => <article key={game.id} className="pub-card pub-day"><GameItem game={game} teams={teams} wide showTime={false} caption={`Jornada ${game.round} · ${dayShort(game.date)} · ${game.time}`} onHits={setHitsGame} /></article>)}
      </div>
    </section>}

    {postponed.length > 0 && <section className="pub-section" aria-labelledby="pub-postponed">
      <div className="pub-section-head"><h2 id="pub-postponed">Pendientes de reprogramar</h2></div>
      <div className="pub-day-grid wide">
        {postponed.map(game => <article key={game.id} className="pub-card pub-day pending"><GameItem game={game} teams={teams} wide showTime={false} caption={`Jornada ${game.round} · ${dayShort(game.date)}`} /></article>)}
      </div>
    </section>}

    {notes.length > 0 && <section className="pub-card pub-method" aria-labelledby="pub-notes">
      <h2 id="pub-notes">Avisos de la liga</h2>
      {notes.map(note => <p key={note}>{capital(note.toLocaleLowerCase('es-MX'))}</p>)}
    </section>}

    <HitsDialog game={hitsGame} data={data} teams={teams} onClose={() => setHitsGame(null)} />
  </>;
}
