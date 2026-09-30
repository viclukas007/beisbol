import type {Snapshot,StandingsCriterion} from './types';
export const criterionLabels:Record<StandingsCriterion,string>={pct:'Porcentaje de victorias (G / [G + P])',wins:'Juegos ganados',difference:'Diferencia de carreras (CF − CC)',runsFor:'Carreras a favor',runsAgainst:'Menos carreras en contra'};
export default function Standings({data}:{data:Snapshot}) {
  const games=data.games.filter(g=>!g.deletedAt&&g.status==='completed'&&g.homeScore!==null&&g.awayScore!==null);
  const rows=data.teams.map(team=>{
    let played=0,wins=0,losses=0,ties=0,runsFor=0,runsAgainst=0,hits=0,hitGames=0;
    for(const game of games) {
      const home=game.homeTeamId===team.id;if(!home&&game.awayTeamId!==team.id)continue;
      const own=(home?game.homeScore:game.awayScore)!,other=(home?game.awayScore:game.homeScore)!;
      const h=home?game.homeHits:game.awayHits;
      played++;runsFor+=own;runsAgainst+=other;if(own>other)wins++;else if(own<other)losses++;else ties++;
      if(h!==null){hits+=h;hitGames++;}
    }
    return{team,played,wins,losses,ties,runsFor,runsAgainst,difference:runsFor-runsAgainst,pct:wins+losses?wins/(wins+losses):0,hits,hitGames};
  });
  const criteria=data.league.rulesConfirmed?data.league.criteria:[];
  const compare=(a:typeof rows[number],b:typeof rows[number])=>{
    for(const criterion of criteria){const delta=(b[criterion]-a[criterion])*(criterion==='runsAgainst'?-1:1);if(delta)return delta;}return 0;
  };
  rows.sort((a,b)=>compare(a,b)||a.team.name.localeCompare(b.team.name,'es'));
  return <section className="panel"><div className="panel-heading"><div><h2>Tabla de posiciones · Primera vuelta</h2><p>{games.length} partidos finalizados con marcador.</p></div></div><div className="panel-body"><div className="admin-notice">{criteria.length?<>Orden confirmado: {criteria.map(key=>criterionLabels[key]).join(' → ')}. Los empates que permanezcan comparten posición.</>:<>Clasificación pendiente de confirmar. Se muestran los equipos por nombre, sin posición oficial. Configura el orden en Administración → Liga y reglamento.</>}<br/>Los empates se muestran en E. Para PCT se excluyen: G / (G + P). W y L de los pitchers pertenecen a las estadísticas individuales.</div>{data.league.rulesNotes&&<p className="rules-text">{data.league.rulesNotes}</p>}</div><div className="table-scroll"><table><thead><tr><th>Pos.</th><th>Equipo</th><th title="Juegos jugados">JJ</th><th title="Ganados">G</th><th title="Perdidos">P</th><th title="Empatados">E</th><th title="Carreras a favor">CF</th><th title="Carreras en contra">CC</th><th title="Diferencia de carreras">DIF</th><th title="G / (G + P), sin empates">PCT</th><th title="Hits capturados en partidos finalizados">H</th></tr></thead><tbody>{rows.map(row=><tr key={row.team.id}><td>{criteria.length?rows.filter(other=>compare(other,row)<0).length+1:'—'}</td><td><strong className="schedule-team" style={{borderColor:row.team.color}}>{row.team.name}</strong></td><td>{row.played}</td><td>{row.wins}</td><td>{row.losses}</td><td>{row.ties}</td><td>{row.runsFor}</td><td>{row.runsAgainst}</td><td>{row.difference>0?'+':''}{row.difference}</td><td>{row.wins+row.losses?row.pct.toFixed(3):'—'}</td><td>{row.hitGames?row.hits:'—'}<small className="cell-detail">{row.hitGames}/{row.played} juegos con H</small></td></tr>)}</tbody></table></div><div className="panel-body"><p className="admin-help">Los hits salen de los partidos, sin sumar los acumulados individuales. “—” significa sin captura; cero es un dato registrado. Editar, retirar o restaurar un juego actualiza esta tabla.</p>{!games.length&&<p className="admin-help">Todavía no hay marcadores finalizados. Captúralos desde el rol de juegos en el administrador.</p>}</div></section>;
}
