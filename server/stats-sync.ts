import type {PoolClient} from 'pg';
import type {Stats} from '../src/types.ts';
import {audit,counts,rates,same} from './writes.ts';

// Contenido de data/seed.json: el libro de estadísticas por equipo ya normalizado.
type SeedPlayer={id:number;teamId:number;name:string;originalName:string;placeholder:boolean;sourceCell:string;stats:Stats};
type SeedRound={playerId:number;round:number;stats:Stats;sourceCell:string};
export type SeedFile={source:string;sha256:string;metadata:Record<string,unknown>;teams:{id:number;name:string;color:string}[];players:SeedPlayer[];rounds:SeedRound[]};
export type StatsSyncSummary={playersCreated:number;playersRenamed:number;statsUpdated:number;roundsUpdated:number;roundsKept:number;unchanged:number;warnings:string[]};
const rosterColumns='id,name,team_id AS "teamId",member,active,version';
const hasActivity=(stats:Stats)=>counts.some(key=>Number(stats[key])>0);
// Acumulado del libro más las jornadas capturadas en la app que el libro todavía no trae.
function withKept(stats:Stats,kept:Stats[]=[]):Stats {
  const total={...stats};
  for(const round of kept)for(const key of counts)total[key]=Math.round((total[key]+round[key])*100)/100;
  return rates(total);
}

// Aplica una versión nueva del libro de estadísticas sobre la base. Los jugadores se identifican por
// el ID estable (equipo × 100 + fila de la plantilla). El nombre solo se toma del Excel si en la base
// sigue siendo el importado (name = original_name) o es un espacio.
// El Excel manda en las jornadas que sí trae capturadas. Una jornada capturada en la app (captura o carga
// masiva) que el libro aún no tiene para ese equipo se conserva y se suma al acumulado del libro, igual
// que el rol conserva los marcadores capturados en la app. Las correcciones directas al acumulado no se
// pueden distinguir de las cifras del libro: ahí manda el Excel.
export async function syncStats(c:PoolClient,seed:SeedFile):Promise<StatsSyncSummary> {
  const responsible=`Importación ${seed.source}`;
  const summary:StatsSyncSummary={playersCreated:0,playersRenamed:0,statsUpdated:0,roundsUpdated:0,roundsKept:0,unchanged:0,warnings:[]};
  const teams=new Set<number>((await c.query('SELECT id FROM teams')).rows.map(row=>row.id));
  for(const team of seed.teams)if(!teams.has(team.id))throw new Error(`El equipo ${team.name} (${team.id}) del Excel no existe en la base.`);
  const players=new Map<number,any>((await c.query('SELECT id,team_id,name,original_name,placeholder,active,member,version FROM players FOR UPDATE')).rows.map(row=>[row.id,row]));
  const stats=new Map<number,any>((await c.query('SELECT player_id,stats,version FROM player_stats FOR UPDATE')).rows.map(row=>[row.player_id,row]));
  const rounds=new Map<string,any>((await c.query('SELECT player_id,round,stats,version FROM round_stats FOR UPDATE')).rows.map(row=>[`${row.player_id}:${row.round}`,row]));

  // Jornadas que el libro trae capturadas, por equipo: basta un jugador con actividad.
  const teamOf=new Map(seed.players.map(player=>[player.id,player.teamId]));
  const inWorkbook=new Set<string>();
  for(const round of seed.rounds)if(hasActivity(round.stats))inWorkbook.add(`${teamOf.get(round.playerId)}:${round.round}`);
  // Jornadas cuyo último cambio vino de la app y no de una importación del Excel.
  const fromApp=new Set<string>((await c.query(`SELECT entity_id FROM (SELECT DISTINCT ON (entity_id) entity_id,operation FROM audit_log WHERE entity='round' ORDER BY entity_id,id DESC) last WHERE operation<>'import'`)).rows.map(row=>row.entity_id));
  const keeps=(playerId:number,round:number)=>{
    const key=`${playerId}:${round}`,old=rounds.get(key),team=teamOf.get(playerId);
    return team!==undefined&&players.get(playerId)?.team_id===team&&fromApp.has(key)&&Boolean(old)&&hasActivity(old.stats)&&!inWorkbook.has(`${team}:${round}`);
  };
  const kept=new Map<number,Stats[]>();
  for(const row of rounds.values())if(keeps(row.player_id,row.round))kept.set(row.player_id,[...(kept.get(row.player_id)??[]),row.stats]);

  const skipped=new Set<number>();
  for(const player of seed.players) {
    const old=players.get(player.id);
    const value=withKept(player.stats,kept.get(player.id));
    if(!old) {
      const saved=(await c.query(`INSERT INTO players(id,team_id,name,original_name,placeholder,source_cell) VALUES($1,$2,$3,$4,$5,$6) RETURNING ${rosterColumns}`,[player.id,player.teamId,player.name,player.originalName,player.placeholder,player.sourceCell])).rows[0];
      await c.query('INSERT INTO player_stats(player_id,stats) VALUES($1,$2)',[player.id,value]);
      await audit(c,'player',String(player.id),'import',null,saved,responsible);
      await audit(c,'stats',String(player.id),'import',null,{stats:value,version:1},responsible);
      summary.playersCreated++;continue;
    }
    if(old.team_id!==player.teamId) {
      summary.warnings.push(`${player.sourceCell}: el jugador ${player.id} (${old.name}) está en otro equipo en la base; no se actualizó.`);
      skipped.add(player.id);continue;
    }
    if(old.name!==player.name||old.placeholder!==player.placeholder) {
      if(old.placeholder||old.name===old.original_name) {
        const saved=(await c.query(`UPDATE players SET name=$2,original_name=$3,placeholder=$4,version=version+1 WHERE id=$1 RETURNING ${rosterColumns}`,[player.id,player.name,player.originalName,player.placeholder])).rows[0];
        await audit(c,'player',String(player.id),'import',old,saved,responsible);
        summary.playersRenamed++;
      } else summary.warnings.push(`${player.sourceCell}: el jugador ${player.id} se llama “${old.name}” en la base y “${player.name}” en el Excel; se conserva el nombre de la base.`);
    }
    const current=stats.get(player.id);
    if(!current) {
      await c.query('INSERT INTO player_stats(player_id,stats) VALUES($1,$2)',[player.id,value]);
      await audit(c,'stats',String(player.id),'import',null,{stats:value,version:1},responsible);
      summary.statsUpdated++;
    } else if(!same(current.stats,value)) {
      const saved=(await c.query('UPDATE player_stats SET stats=$2,version=version+1 WHERE player_id=$1 RETURNING stats,version',[player.id,value])).rows[0];
      await audit(c,'stats',String(player.id),'import',current,saved,responsible);
      summary.statsUpdated++;
    } else summary.unchanged++;
  }
  for(const round of seed.rounds) {
    if(skipped.has(round.playerId))continue;
    if(keeps(round.playerId,round.round)){summary.roundsKept++;continue;}
    const old=rounds.get(`${round.playerId}:${round.round}`);
    const value=rates(round.stats);
    if(!old) {
      await c.query('INSERT INTO round_stats(player_id,round,stats,source_cell) VALUES($1,$2,$3,$4)',[round.playerId,round.round,value,round.sourceCell]);
      summary.roundsUpdated++;
    } else if(!same(old.stats,value)) {
      const saved=(await c.query('UPDATE round_stats SET stats=$3,version=version+1 WHERE player_id=$1 AND round=$2 RETURNING stats,version',[round.playerId,round.round,value])).rows[0];
      await audit(c,'round',`${round.playerId}:${round.round}`,'import',old,saved,responsible);
      summary.roundsUpdated++;
    }
  }
  if(summary.roundsKept)summary.warnings.push(`Se conservaron ${summary.roundsKept} filas de jornada capturadas en la app que el libro todavía no trae; sus cifras se sumaron al acumulado.`);
  return summary;
}
