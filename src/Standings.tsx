import {useState} from 'react';
import {ArrowDown,ArrowUp} from 'lucide-react';
import type {Snapshot} from './types';
import {applyManualOrder,completedGames,rankStandings,standingsRows,type Scope} from './standings-rules';
import RegulationRules from './Regulation';
import {write} from './api';
import {teamLogo} from './teams';
const scopes:{key:Scope;label:string}[]=[{key:'all',label:'Temporada'},{key:1,label:'Primera vuelta'},{key:2,label:'Segunda vuelta'}];
const pct=(value:number)=>value>=1?'1.000':value.toFixed(3).replace(/^0/,'');
// detailed: vista de administración (columnas reservadas y orden manual con flechas).
export default function Standings({data,detailed=false,reload}:{data:Snapshot;detailed?:boolean;reload?:()=>Promise<void>|void}) {
  const [scope,setScope]=useState<Scope>('all');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const games=completedGames(data.games,scope);
  const automatic=rankStandings(standingsRows(data.teams,games),games);
  const manual=data.league.standingsOrder?.[String(scope)];
  const rows=applyManualOrder(automatic,manual);
  const pending=rows.filter(row=>row.shared&&row.played>0);
  const anyHits=rows.some(row=>row.hitGames),anyErrors=rows.some(row=>row.errorGames);
  const label=scopes.find(s=>s.key===scope)!.label;
  const saveOrder=async(order:number[]|null)=>{
    setBusy(true);setMessage('');
    try{await write('/api/admin/league/standings-order','PUT',{scope:String(scope),order,version:data.league.version});await reload?.();setMessage(order?'Orden manual guardado.':'Orden automático restablecido.');}
    catch(error){setMessage(error instanceof Error?error.message:'No fue posible guardar el orden.');}
    finally{setBusy(false);}
  };
  // La primera flecha parte del orden que se ve en pantalla (automático o manual) y solo intercambia dos equipos.
  const move=(index:number,delta:number)=>{const order=rows.map(row=>row.team.id);const target=index+delta;if(target<0||target>=order.length)return;[order[index],order[target]]=[order[target],order[index]];void saveOrder(order);};
  return <section className="panel"><div className="panel-heading"><div><h2>Tabla de posiciones · {label}</h2><p>{games.length} partidos finalizados con marcador.</p></div><div className="segmented" role="tablist" aria-label="Alcance de la tabla">{scopes.map(s=><button key={String(s.key)} role="tab" aria-selected={scope===s.key} className={scope===s.key?'active':''} onClick={()=>{setScope(s.key);setMessage('');}}>{s.label}</button>)}</div></div><div className="panel-body"><div className="admin-notice">{manual?<>Orden definido por la liga para {label.toLowerCase()}.{detailed&&' No cambia con nuevos resultados hasta volver al orden automático.'}</>:<>Orden del reglamento: porcentaje de victorias (G / JJ, los empates cuentan como jugados). Los empates en porcentaje se resuelven con los criterios a–d{detailed?'; la columna Desempate indica cuál decidió cada lugar':''}.{pending.length>0&&<> <strong>{pending.length} equipos comparten posición en espera del volado (inciso d).</strong></>}</>}</div>{detailed&&<div className="standings-actions"><span className="admin-help">Usa las flechas para mover un equipo cuando el criterio automático no aplique; el primer movimiento fija el orden actual como manual.</span>{manual&&<button className="secondary-button" disabled={busy} onClick={()=>void saveOrder(null)}>Volver al orden automático</button>}{message&&<span className="admin-help" role="status">{message}</span>}</div>}</div><div className="table-scroll"><table className="standings-table"><thead><tr><th>Pos.</th><th>Equipo</th><th title="Juegos jugados">JJ</th><th title="Ganados">G</th><th title="Perdidos">P</th><th title="Empatados">E</th><th title="Ganados / jugados">PCT</th><th title="Carreras a favor">CF</th><th title="Carreras en contra">CC</th><th title="Diferencia de carreras">DIF</th>{detailed&&<th title="Hits por equipo según la hoja de resultados">H</th>}{detailed&&<th title="Errores por equipo según la hoja de resultados">ERR</th>}{detailed&&<th>Desempate</th>}</tr></thead><tbody>{rows.map((row,index)=><tr key={row.team.id}><td><strong>{row.position}</strong>{row.shared&&row.played>0&&<span className="position-shared">Compartida</span>}{detailed&&<span className="order-buttons"><button className="icon-button" aria-label={`Subir a ${row.team.name}`} disabled={busy||index===0} onClick={()=>move(index,-1)}><ArrowUp size={14}/></button><button className="icon-button" aria-label={`Bajar a ${row.team.name}`} disabled={busy||index===rows.length-1} onClick={()=>move(index,1)}><ArrowDown size={14}/></button></span>}</td><td><span className="team-cell"><img className="team-logo" src={teamLogo(row.team.id)} alt=""/><strong className="schedule-team">{row.team.name}</strong></span></td><td>{row.played}</td><td>{row.wins}</td><td>{row.losses}</td><td>{row.ties}</td><td className="stat-emphasis">{row.played?pct(row.pct):'—'}</td><td>{row.runsFor}</td><td>{row.runsAgainst}</td><td>{row.difference>0?'+':''}{row.difference}</td>{detailed&&<td>{row.hitGames?row.hits:'—'}{anyHits&&<small className="cell-detail">{row.hitGames}/{row.played} juegos</small>}</td>}{detailed&&<td>{row.errorGames?row.errors:'—'}{anyErrors&&<small className="cell-detail">{row.errorGames}/{row.played} juegos</small>}</td>}{detailed&&<td><span className="standings-reason">{row.reason||(row.played?'Porcentaje sin empate':'')}</span></td>}</tr>)}</tbody></table></div>{detailed&&<RegulationRules data={data} scope={scope} gamesCount={games.length}/>}</section>;
}
