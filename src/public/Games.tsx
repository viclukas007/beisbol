import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { Game, Snapshot } from '../types';
import { TeamLogo, dayLong, titleName, type TeamMap } from './shared';

const offLabels: Partial<Record<Game['status'], string>> = { postponed: 'Pospuesto', cancelled: 'Cancelado' };

// Un juego del rol. Apilado por defecto; con `wide`, local y visitante quedan en una sola fila en pantallas anchas.
export function GameItem({ game, teams, caption, showTime = true, wide = false, onHits }: { game: Game; teams: TeamMap; caption?: string; showTime?: boolean; wide?: boolean; onHits?: (game: Game) => void }) {
  const scored = game.homeScore !== null && game.awayScore !== null;
  const difference = scored ? game.homeScore! - game.awayScore! : 0;
  const state = (own: number) => !scored || difference === 0 ? '' : own > 0 ? ' win' : ' lose';
  const detail = [game.homeHits, game.awayHits, game.homeErrors, game.awayErrors].some(value => value !== null);
  const hits = onHits && game.status === 'completed' && (game.homePlayerHits !== null || game.awayPlayerHits !== null);
  const off = offLabels[game.status];
  return <div className={`pub-game${wide ? ' wide' : ''}`}>
    {caption && <span className="pub-game-caption">{caption}</span>}
    <div className="pub-game-body">
      {showTime && <span className="pub-game-time">{game.time}</span>}
      <div className="pub-game-teams">
        <span className={`pub-game-team home${state(difference)}`}><TeamLogo team={teams.get(game.homeTeamId)} size={wide ? 34 : 26} /><span className="pub-game-name">{teams.get(game.homeTeamId)?.name ?? '—'}</span>{scored && <span className="pub-game-score">{game.homeScore}</span>}</span>
        <span className="pub-game-vs" aria-hidden="true">{scored ? '–' : 'vs'}</span>
        <span className={`pub-game-team away${state(-difference)}`}><TeamLogo team={teams.get(game.awayTeamId)} size={wide ? 34 : 26} /><span className="pub-game-name">{teams.get(game.awayTeamId)?.name ?? '—'}</span>{scored && <span className="pub-game-score">{game.awayScore}</span>}</span>
      </div>
    </div>
    {(off || game.notes || detail || hits) && <div className="pub-game-extra">
      {off && <span className="pub-tag warn">{off}</span>}
      {game.notes && <span>{game.notes}</span>}
      {detail && <span>H {game.homeHits ?? '—'}–{game.awayHits ?? '—'} · E {game.homeErrors ?? '—'}–{game.awayErrors ?? '—'}</span>}
      {hits && <button type="button" className="pub-link" onClick={() => onHits(game)}>Ver hits por jugador</button>}
    </div>}
  </div>;
}

// Hits individuales capturados en un partido finalizado (solo lectura).
export function HitsDialog({ game, data, teams, onClose }: { game: Game | null; data: Snapshot; teams: TeamMap; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (game && dialog && !dialog.open) dialog.showModal();
    if (!game && dialog?.open) dialog.close();
  }, [game]);
  const captures = game ? data.gameHits.filter(h => h.gameId === game.id && !h.deletedAt) : [];
  return <dialog ref={ref} className="pub-dialog" onClose={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    {game && <>
      <div className="pub-dialog-header"><span>Hits del partido</span><button type="button" className="pub-icon-button" aria-label="Cerrar hits" onClick={onClose}><X size={22} /></button></div>
      <div className="pub-dialog-body">
        <p className="pub-muted">Jornada {game.round} · {dayLong(game.date)} · {game.time}</p>
        <GameItem game={game} teams={teams} showTime={false} wide />
        <div className="pub-hits-grid">
          {[game.homeTeamId, game.awayTeamId].map(teamId => {
            const rows = captures.filter(h => h.teamId === teamId).sort((a, b) => b.hits - a.hits || a.name.localeCompare(b.name, 'es'));
            return <section key={teamId}>
              <h3>{teams.get(teamId)?.name}</h3>
              {rows.length ? <ul className="pub-hits-list">{rows.map(h => <li key={h.playerId}><span>{titleName(h.name)}</span><strong>{h.hits}</strong></li>)}</ul> : <p className="pub-muted">Sin hits capturados.</p>}
            </section>;
          })}
        </div>
      </div>
    </>}
  </dialog>;
}
