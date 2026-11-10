import { useMemo, useState } from 'react';
import type { Game, Player, Snapshot, Stats, Team } from '../types';
import { teamLogo } from '../teams';

export type Key = keyof Stats;
export type PublicPage = 'posiciones' | 'estadisticas' | 'equipos' | 'rol';
export type TeamMap = Map<number, Team>;

export const descriptions: Record<Key, string> = { jj: 'Juegos jugados', ab: 'Turnos al bat', hits: 'Hits', singles: 'Sencillos', doubles: 'Dobles', triples: 'Triples', hr: 'Home runs', rbi: 'Carreras impulsadas', avg: 'Promedio de bateo', ip: 'Entradas lanzadas', er: 'Carreras limpias', bb: 'Bases por bola concedidas', k: 'Ponches', era: 'Efectividad', w: 'Victorias del pitcher', l: 'Derrotas del pitcher' };
export const labels: Record<Key, string> = { jj: 'JJ', ab: 'AB', hits: 'H', singles: '1B', doubles: '2B', triples: '3B', hr: 'HR', rbi: 'RBI', avg: 'AVG', ip: 'IP', er: 'ER', bb: 'BB', k: 'K', era: 'ERA', w: 'W', l: 'L' };
export const batting: Key[] = ['jj', 'ab', 'hits', 'singles', 'doubles', 'triples', 'hr', 'rbi', 'avg'];
export const pitching: Key[] = ['ip', 'er', 'bb', 'k', 'era', 'w', 'l'];

export const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const titleName = (text: string) => text.toLocaleLowerCase('es-MX').replace(/(^|\s)(\p{L})/gu, (_, space, letter) => space + letter.toLocaleUpperCase('es-MX'));
export const format = (value: number, key?: string) => key === 'avg' ? value.toFixed(3).replace(/^0/, '') : key === 'era' ? value.toFixed(2) : new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(value);
export const capital = (text: string) => text.charAt(0).toLocaleUpperCase('es-MX') + text.slice(1);

// Fechas del rol: llegan como AAAA-MM-DD; se fijan al mediodía para que la zona horaria no cambie el día.
const at = (iso: string) => new Date(iso + 'T12:00:00');
const part = (iso: string, options: Intl.DateTimeFormatOptions) => at(iso).toLocaleDateString('es-MX', options).replace(/\./g, '');
export const todayISO = () => new Date().toLocaleDateString('en-CA');
export const dayLong = (iso: string) => `${capital(part(iso, { weekday: 'long' }))} ${at(iso).getDate()} ${part(iso, { month: 'short' })}`;
export const dayShort = (iso: string) => `${part(iso, { weekday: 'short' })} ${at(iso).getDate()} ${part(iso, { month: 'short' })}`;
export const dayMonth = (iso: string) => `${at(iso).getDate()} de ${part(iso, { month: 'long' })}`;
export function rangeLabel(dates: string[]) {
  const sorted = [...new Set(dates)].sort();
  const first = sorted[0], last = sorted[sorted.length - 1];
  if (!first) return '';
  if (first === last) return dayMonth(first);
  return first.slice(0, 7) === last.slice(0, 7) ? `${at(first).getDate()} al ${dayMonth(last)}` : `${dayMonth(first)} al ${dayMonth(last)}`;
}
export const byDate = (a: Game, b: Game) => (a.date + a.time).localeCompare(b.date + b.time) || a.id - b.id;

// Jornada en curso: la del primer juego programado de hoy en adelante.
export function currentRound(games: Game[]): number | null {
  const today = todayISO();
  const next = games.filter(g => !g.deletedAt && g.status === 'scheduled' && g.date >= today).sort(byDate)[0];
  return next ? next.round : null;
}
export function groupByDate(games: Game[]) {
  const days = new Map<string, Game[]>();
  for (const game of [...games].sort(byDate)) days.set(game.date, [...(days.get(game.date) ?? []), game]);
  return [...days.entries()].map(([date, list]) => ({ date, games: list }));
}

// Jugadores activos con las cifras del periodo elegido: acumulado o una jornada.
export function usePool(data: Snapshot, round: string): Player[] {
  return useMemo(() => {
    const active = data.players.filter(p => p.active);
    if (round === 'all') return active;
    const roundMap = new Map(data.rounds.filter(r => r.round === Number(round)).map(r => [r.playerId, r.stats]));
    return active.map(p => ({ ...p, stats: roundMap.get(p.id) ?? p.stats }));
  }, [data, round]);
}

export function TeamLogo({ team, size = 32 }: { team: Team | undefined; size?: number }) {
  const [failed, setFailed] = useState<number | null>(null);
  if (!team) return <span className="pub-logo" style={{ width: size, height: size }} aria-hidden="true" />;
  if (failed === team.id) return <span className="pub-logo fallback" style={{ width: size, height: size, background: team.color, fontSize: Math.round(size * 0.38) }} aria-hidden="true">{team.name === 'NorthSide' ? 'NS' : team.name.slice(0, 2).toUpperCase()}</span>;
  return <img className="pub-logo" style={{ width: size, height: size }} src={teamLogo(team.id)} alt="" onError={() => setFailed(team.id)} />;
}

export function Filters({ data, teamId, round, search, onTeam, onRound, onSearch }: { data: Snapshot; teamId: string; round: string; search: string; onTeam: (value: string) => void; onRound: (value: string) => void; onSearch: (value: string) => void }) {
  return <form className="pub-filters" role="search" onSubmit={e => e.preventDefault()}>
    <label>Equipo
      <select value={teamId} onChange={e => onTeam(e.target.value)}>
        <option value="all">Todos los equipos</option>
        {data.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
    </label>
    <label>Periodo
      <select value={round} onChange={e => onRound(e.target.value)}>
        <option value="all">Acumulado del torneo</option>
        {data.metadata.roundsWithActivity.map(r => <option key={r} value={r}>Jornada {r}</option>)}
      </select>
    </label>
    <label>Buscar
      <input type="search" placeholder="Jugador o equipo" value={search} onChange={e => onSearch(e.target.value)} />
    </label>
  </form>;
}
