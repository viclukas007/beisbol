import type {PoolClient} from 'pg';
import {audit,gameColumns} from './writes.ts';

// Un juego de data/schedule.json. status null significa que la hoja de resultados no tiene nada para ese juego.
type ImportedGame={turn:number;round:number;date:string;time:string;homeTeamId:number;awayTeamId:number;notes:string;status:'completed'|'postponed'|null;homeScore:number|null;awayScore:number|null;homeHits:number|null;awayHits:number|null;homeErrors:number|null;awayErrors:number|null;code:string|null;sourceCell:string;resultCell:string|null};
export type ScheduleFile={source:string;sha256:string;metadata:{sheets:string[];[key:string]:unknown};games:ImportedGame[]};
export type SyncSummary={inserted:number;updated:number;restored:number;removed:number;unchanged:number;warnings:string[]};
const fields=['turn','round','date','time','homeTeamId','awayTeamId','notes','status','homeScore','awayScore','homeHits','awayHits','homeErrors','awayErrors'] as const;
const detail=['homeHits','awayHits','homeErrors','awayErrors'] as const;

// Aplica el rol y los resultados del Excel sobre la base: el Excel manda en calendario y en los
// resultados que sí tiene; los juegos sin resultado en la hoja conservan lo capturado en la app.
export async function syncSchedule(c:PoolClient,schedule:ScheduleFile):Promise<SyncSummary> {
  const responsible=`Importación ${schedule.source}`;
  const existing=new Map<string,any>((await c.query(`SELECT ${gameColumns} FROM games WHERE source_cell IS NOT NULL FOR UPDATE`)).rows.map(row=>[row.sourceCell,row]));
  const withHits=new Set<number>((await c.query('SELECT DISTINCT game_id FROM game_player_hits WHERE deleted_at IS NULL')).rows.map(row=>row.game_id));
  const summary:SyncSummary={inserted:0,updated:0,restored:0,removed:0,unchanged:0,warnings:[]};
  const seen=new Set<string>();
  for(const game of schedule.games) {
    seen.add(game.sourceCell);
    const old=existing.get(game.sourceCell);
    const next:Record<string,unknown>={turn:game.turn,round:game.round,date:game.date,time:game.time,homeTeamId:game.homeTeamId,awayTeamId:game.awayTeamId,notes:game.notes,status:game.status??old?.status??'scheduled',homeScore:null,awayScore:null,homeHits:null,awayHits:null,homeErrors:null,awayErrors:null};
    if(game.status==='completed') {
      next.homeScore=game.homeScore;next.awayScore=game.awayScore;
      for(const key of detail)next[key]=game[key]??old?.[key]??null;
    } else if(game.status===null&&old) {
      for(const key of ['homeScore','awayScore',...detail] as const)next[key]=old[key];
    }
    if(old&&withHits.has(old.id)&&(next.status!=='completed'||next.homeTeamId!==old.homeTeamId||next.awayTeamId!==old.awayTeamId)) {
      summary.warnings.push(`${game.sourceCell}: el juego ${old.id} tiene hits capturados; se conservan sus equipos, estado y marcador.`);
      for(const key of ['homeTeamId','awayTeamId','status','homeScore','awayScore'] as const)next[key]=old[key];
    }
    const values=fields.map(key=>next[key]);
    if(!old) {
      const saved=(await c.query(`INSERT INTO games(turn,round,date,time,home_team_id,away_team_id,notes,status,home_score,away_score,home_hits,away_hits,home_errors,away_errors,source_cell) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING ${gameColumns}`,[...values,game.sourceCell])).rows[0];
      await audit(c,'game',String(saved.id),'import',null,saved,responsible);
      summary.inserted++;continue;
    }
    if(!old.deletedAt&&fields.every(key=>old[key]===next[key])){summary.unchanged++;continue;}
    const saved=(await c.query(`UPDATE games SET turn=$1,round=$2,date=$3,time=$4,home_team_id=$5,away_team_id=$6,notes=$7,status=$8,home_score=$9,away_score=$10,home_hits=$11,away_hits=$12,home_errors=$13,away_errors=$14,deleted_at=NULL,version=version+1 WHERE id=$15 RETURNING ${gameColumns}`,[...values,old.id])).rows[0];
    await audit(c,'game',String(old.id),old.deletedAt?'restore':'import',old,saved,responsible);
    if(old.deletedAt)summary.restored++;else summary.updated++;
  }
  // Juegos de las mismas hojas que ya no aparecen en el Excel: se retiran, recuperables desde “Juegos retirados”.
  for(const [cell,old] of existing) {
    if(seen.has(cell)||old.deletedAt||!schedule.metadata.sheets.some(sheet=>cell.startsWith(`${sheet}!`)))continue;
    const saved=(await c.query(`UPDATE games SET deleted_at=now(),version=version+1 WHERE id=$1 RETURNING ${gameColumns}`,[old.id])).rows[0];
    await audit(c,'game',String(old.id),'remove',old,saved,responsible);
    summary.removed++;
  }
  return summary;
}
