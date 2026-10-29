import type {Game,Team} from './types';

// Reglamento de la liga, punto 4: los lugares se definen por porcentaje de victorias
// (ganados entre jugados). En empates se aplican, en orden, los criterios a–d.
export const regulation=[
  'a) Resultados frente a frente entre los equipos empatados (ganados y perdidos).',
  'b) Si persiste el empate, diferencia entre carreras anotadas y recibidas en los partidos jugados entre los dos equipos.',
  'c) Si persiste el empate, el equipo con mayor cantidad de carreras anotadas en toda la temporada.',
  'd) Si persiste el empate, volado con moneda en presencia de los capitanes de los equipos y dos miembros del Comité.',
];
export const regulationNote='NOTA: en caso de empate en porcentaje entre tres o más equipos y no hubiera dominio de ninguno, se pasa al punto c.';
export const dominanceReading='Lectura aplicada de “dominio”: entre tres o más empatados, domina el equipo que enfrentó a todos los demás empatados y tiene el mejor porcentaje de victorias frente a ellos. Ese equipo toma el primer lugar del grupo y el resto se vuelve a desempatar desde el inciso a.';

export type Scope='all'|1|2;
export type StandingsRow={team:Team;played:number;wins:number;losses:number;ties:number;runsFor:number;runsAgainst:number;difference:number;pct:number;hits:number;hitGames:number;errors:number;errorGames:number};
export type RankedRow=StandingsRow&{position:number;shared:boolean;reason:string};

export function completedGames(games:Game[],scope:Scope='all') {
  return games.filter(g=>!g.deletedAt&&g.status==='completed'&&g.homeScore!==null&&g.awayScore!==null&&(scope==='all'||g.turn===scope));
}

export function standingsRows(teams:Team[],games:Game[]):StandingsRow[] {
  return teams.map(team=>{
    const row:StandingsRow={team,played:0,wins:0,losses:0,ties:0,runsFor:0,runsAgainst:0,difference:0,pct:0,hits:0,hitGames:0,errors:0,errorGames:0};
    for(const game of games) {
      const home=game.homeTeamId===team.id;if(!home&&game.awayTeamId!==team.id)continue;
      const own=(home?game.homeScore:game.awayScore)!,other=(home?game.awayScore:game.homeScore)!;
      row.played++;row.runsFor+=own;row.runsAgainst+=other;
      if(own>other)row.wins++;else if(own<other)row.losses++;else row.ties++;
      const hits=home?game.homeHits:game.awayHits;if(hits!==null){row.hits+=hits;row.hitGames++;}
      const errors=home?game.homeErrors:game.awayErrors;if(errors!==null){row.errors+=errors;row.errorGames++;}
    }
    row.difference=row.runsFor-row.runsAgainst;row.pct=row.played?row.wins/row.played:0;
    return row;
  });
}

type Head={wins:number;losses:number;ties:number;runsFor:number;runsAgainst:number;games:number;faced:Set<number>};
function headToHead(row:StandingsRow,others:StandingsRow[],games:Game[]):Head {
  const ids=new Set(others.map(o=>o.team.id));
  const head:Head={wins:0,losses:0,ties:0,runsFor:0,runsAgainst:0,games:0,faced:new Set()};
  for(const game of games) {
    const home=game.homeTeamId===row.team.id,away=game.awayTeamId===row.team.id;if(!home&&!away)continue;
    const rival=home?game.awayTeamId:game.homeTeamId;if(!ids.has(rival))continue;
    const own=(home?game.homeScore:game.awayScore)!,other=(home?game.awayScore:game.homeScore)!;
    head.games++;head.faced.add(rival);head.runsFor+=own;head.runsAgainst+=other;
    if(own>other)head.wins++;else if(own<other)head.losses++;else head.ties++;
  }
  return head;
}
const byName=(a:StandingsRow,b:StandingsRow)=>a.team.name.localeCompare(b.team.name,'es');
const signed=(n:number)=>(n>0?'+':'')+n;

// Inciso c (carreras anotadas) y, si persiste, inciso d (volado): los que siguen empatados comparten posición.
function byRunsFor(group:StandingsRow[],reasons:Map<number,string>,prefix:string):StandingsRow[][] {
  const tiers:StandingsRow[][]=[];
  for(const row of [...group].sort((a,b)=>b.runsFor-a.runsFor||byName(a,b))) {
    const last=tiers[tiers.length-1];
    if(last&&last[0].runsFor===row.runsFor)last.push(row);else tiers.push([row]);
  }
  for(const tier of tiers)for(const row of tier)reasons.set(row.team.id,tier.length>1?`${prefix}d) Volado pendiente (${row.runsFor} carreras anotadas)`:`${prefix}c) Carreras anotadas (${row.runsFor})`);
  return tiers;
}

// Devuelve niveles ordenados: cada nivel agrupa a los equipos que comparten posición.
function resolve(group:StandingsRow[],games:Game[],reasons:Map<number,string>):StandingsRow[][] {
  if(group.length===1)return [group];
  if(group.every(row=>row.played===0)){for(const row of group)reasons.set(row.team.id,'Sin partidos finalizados');return [[...group].sort(byName)];}
  if(group.length===2) {
    const [a,b]=group;const head=headToHead(a,[b],games);
    if(head.wins!==head.losses) {
      const [first,second]=head.wins>head.losses?[a,b]:[b,a];const w=Math.max(head.wins,head.losses),l=Math.min(head.wins,head.losses);
      reasons.set(first.team.id,`a) Frente a frente ${w}–${l} vs ${second.team.name}`);reasons.set(second.team.id,`a) Frente a frente ${l}–${w} vs ${first.team.name}`);
      return [[first],[second]];
    }
    if(head.games&&head.runsFor!==head.runsAgainst) {
      const diff=head.runsFor-head.runsAgainst;const [first,second]=diff>0?[a,b]:[b,a];
      reasons.set(first.team.id,`b) Carreras frente a frente ${signed(Math.abs(diff))} vs ${second.team.name}`);reasons.set(second.team.id,`b) Carreras frente a frente ${signed(-Math.abs(diff))} vs ${first.team.name}`);
      return [[first],[second]];
    }
    return byRunsFor(group,reasons,head.games?`a–b) Parejos frente a frente (${head.wins}–${head.losses}) · `:'a–b) Sin partidos entre sí · ');
  }
  const records=group.map(row=>{const head=headToHead(row,group.filter(o=>o!==row),games);return {row,head,pct:head.games?head.wins/head.games:null};});
  const dominant=records.find(r=>r.pct!==null&&r.head.faced.size===group.length-1&&records.every(o=>o===r||o.pct===null||o.pct<r.pct!));
  if(dominant) {
    reasons.set(dominant.row.team.id,`a) Dominio frente a frente ${dominant.head.wins}–${dominant.head.losses} ante los ${group.length-1} empatados`);
    return [[dominant.row],...resolve(group.filter(row=>row!==dominant.row),games,reasons)];
  }
  return byRunsFor(group,reasons,`a) Sin dominio entre ${group.length} empatados · `);
}

export function rankStandings(rows:StandingsRow[],games:Game[]):RankedRow[] {
  const reasons=new Map<number,string>();
  const groups:StandingsRow[][]=[];
  for(const row of [...rows].sort((a,b)=>b.pct-a.pct||byName(a,b))) {
    const last=groups[groups.length-1];
    if(last&&Math.abs(last[0].pct-row.pct)<1e-9)last.push(row);else groups.push([row]);
  }
  const ranked:RankedRow[]=[];let position=1;
  for(const group of groups)for(const tier of resolve(group,games,reasons)) {
    for(const row of tier.length>1?[...tier].sort(byName):tier)ranked.push({...row,position,shared:tier.length>1,reason:group.length>1?reasons.get(row.team.id)??'':''});
    position+=tier.length;
  }
  return ranked;
}
// Orden manual fijado por la liga: los equipos listados van primero en ese orden; los que falten conservan su orden automático al final.
export function applyManualOrder(ranked:RankedRow[],order:number[]|undefined):RankedRow[] {
  if(!order||!order.length)return ranked;
  const index=new Map(order.map((id,i)=>[id,i]));
  const rows=[...ranked].sort((a,b)=>(index.get(a.team.id)??order.length+a.position)-(index.get(b.team.id)??order.length+b.position));
  return rows.map((row,i)=>({...row,position:i+1,shared:false,reason:'Orden manual de la liga'}));
}
