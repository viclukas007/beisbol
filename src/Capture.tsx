import {useEffect,useState} from 'react';
import {Save,RotateCw} from 'lucide-react';
import type {Snapshot,Stats} from './types';
import {write} from './api';
import History from './History';
const fields=[['jj','JJ','Juegos jugados'],['ab','AB','Turnos al bat'],['hits','H','Hits'],['singles','1B','Sencillos'],['doubles','2B','Dobles'],['triples','3B','Triples'],['hr','HR','Home runs'],['rbi','RBI','Carreras impulsadas'],['ip','IP','Entradas lanzadas'],['er','ER','Carreras limpias'],['bb','BB','Bases por bola'],['k','K','Ponches'],['w','W','Victorias del pitcher'],['l','L','Derrotas del pitcher']] as const;
export default function Capture({data,reload,onDirty}:{data:Snapshot;reload:()=>Promise<void>;onDirty:(dirty:boolean)=>void}) {
  const [team,setTeam]=useState(data.teams[0].id);
  const [player,setPlayer]=useState(data.players.find(p=>p.teamId===team)!.id);
  const [scope,setScope]=useState('1');
  const [dirty,setDirty]=useState(false);
  const roster=data.players.filter(p=>p.teamId===team);
  const change=(action:()=>void)=>{if(!dirty||window.confirm('Hay cambios sin guardar. ¿Quieres descartarlos?')){setDirty(false);onDirty(false);action();}};
  return <div className="admin-stack"><section className="panel capture-select"><div className="panel-heading"><div><h2>Captura de estadísticas</h2><p>Elige un jugador y registra sus cifras por jornada.</p></div></div><div className="form-grid selectors"><label>Equipo<select value={team} onChange={e=>change(()=>{const id=Number(e.target.value);setTeam(id);setPlayer(data.players.find(p=>p.teamId===id)!.id);})}>{data.teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>Jugador<select value={player} onChange={e=>{const value=Number(e.target.value);change(()=>setPlayer(value));}}>{roster.map(p=><option key={p.id} value={p.id}>{p.name}{p.placeholder?' · Espacio de plantilla':''}</option>)}</select></label><label>Registro<select value={scope} onChange={e=>{const value=e.target.value;change(()=>setScope(value));}}><option value="all">Corregir acumulado</option>{Array.from({length:30},(_,i)=><option key={i+1} value={i+1}>Jornada {i+1}</option>)}</select></label></div></section><StatsEditor key={`${player}:${scope}`} data={data} player={player} scope={scope} reload={reload} onDirty={value=>{setDirty(value);onDirty(value);}}/><History data={data} entity={scope==='all'?'stats':'round'} entityId={scope==='all'?String(player):`${player}:${scope}`}/></div>;
}
function StatsEditor({data,player,scope,reload,onDirty}:{data:Snapshot;player:number;scope:string;reload:()=>Promise<void>;onDirty:(dirty:boolean)=>void}) {
  const record=scope==='all'?data.players.find(p=>p.id===player)!:data.rounds.find(r=>r.playerId===player&&r.round===Number(scope))!;
  const [baseline,setBaseline]=useState(record.stats);
  const [draft,setDraft]=useState<Record<string,string>>(()=>Object.fromEntries(fields.map(([key])=>[key,String(record.stats[key])])));
  const [version,setVersion]=useState(record.version);
  const [responsible,setResponsible]=useState(()=>localStorage.getItem('diamante-responsible')||'Captura local');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const dirty=fields.some(([key])=>Number(draft[key])!==baseline[key]||draft[key]==='');
  const stale=record.version!==version;
  const stats=Object.fromEntries(fields.map(([key])=>[key,Number(draft[key])])) as Stats;
  const hitsMatch=stats.hits===stats.singles+stats.doubles+stats.triples+stats.hr;
  useEffect(()=>{onDirty(dirty);},[dirty]);
  const reset=()=>{if(dirty&&!window.confirm('¿Descartar los cambios y cargar los datos actuales?'))return;setBaseline(record.stats);setVersion(record.version);setDraft(Object.fromEntries(fields.map(([k])=>[k,String(record.stats[k])])));setError('');setMessage('');};
  const save=async (event:React.FormEvent)=>{
    event.preventDefault();setBusy(true);setError('');setMessage('');
    try{
      const url=`/api/players/${player}/${scope==='all'?'stats':`rounds/${scope}`}`;
      const result=await write<{stats:Stats;version:number;changed:boolean}>(url,'PUT',{stats,version,responsible});
      setBaseline(result.stats);setVersion(result.version);setDraft(Object.fromEntries(fields.map(([k])=>[k,String(result.stats[k])])));onDirty(false);
      localStorage.setItem('diamante-responsible',responsible);
      setMessage(result.changed?'Estadísticas guardadas. Las demás pantallas se actualizan automáticamente.':'No había cambios para guardar.');await reload();
    }catch(e){setError(e instanceof Error?e.message:'No se pudo guardar.');}
    finally{setBusy(false);}
  };
  return <form className="panel capture-form" onSubmit={save}><div className="panel-heading"><div><h2>{scope==='all'?'Corrección del acumulado':`Jornada ${scope}`}</h2><p>{data.players.find(p=>p.id===player)?.name}</p></div><span className="tiny-badge">{dirty?'SIN GUARDAR':'GUARDADO'}</span></div><div className="admin-notice">{scope==='all'?'Corrige el total histórico del jugador. Las cifras de cada jornada se conservan.':'Al guardar, la diferencia de esta jornada se aplica al acumulado. Editar una captura anterior no duplica sus cifras.'}</div>{stale&&<div className="form-error" role="alert">Hay una versión más reciente. Tu borrador se conserva. <button type="button" className="text-button" onClick={reset}>Cargar datos actuales</button></div>}<fieldset disabled={busy}><legend>Bateo</legend><div className="stat-input-grid">{fields.slice(0,8).map(([key,label,description])=><label key={key}><span>{label} <small>{description}</small></span><input type="number" min="0" max="1000000" step="1" required value={draft[key]} onChange={e=>{setDraft(d=>({...d,[key]:e.target.value}));setMessage('');}}/></label>)}</div><legend>Pitcheo</legend><div className="stat-input-grid">{fields.slice(8).map(([key,label,description])=><label key={key}><span>{label} <small>{description}</small></span><input type="number" min="0" max="1000000" step={key==='ip'?'0.01':'1'} required value={draft[key]} onChange={e=>{setDraft(d=>({...d,[key]:e.target.value}));setMessage('');}}/></label>)}</div><p className="admin-help">IP usa decimales, igual que el Excel: 0.1 se calcula como una décima de entrada. ERA se calcula sobre 7 entradas.</p><div className="capture-preview"><div><span>AVG calculado</span><strong>{(stats.ab?stats.hits/stats.ab:0).toFixed(3)}</strong></div><div><span>ERA calculado</span><strong>{(stats.ip?stats.er*7/stats.ip:0).toFixed(2)}</strong></div><p>{!hitsMatch?'El registro tiene H diferente de 1B + 2B + 3B + HR. Corrige estos campos si editas el bateo.':'H coincide con la suma de sencillos, dobles, triples y home runs.'}</p></div><label className="responsible-field">Responsable de la captura<input value={responsible} onChange={e=>setResponsible(e.target.value)} required maxLength={100}/></label></fieldset>{error&&<div className="form-error" role="alert">{error}</div>}{message&&<div className="form-success" role="status">{message}</div>}<div className="form-actions"><button type="button" className="secondary-button" disabled={busy} onClick={reset}><RotateCw size={16}/> Cargar datos actuales</button><button className="primary-button" disabled={busy||stale}><Save size={16}/>{busy?'Guardando…':'Guardar estadísticas'}</button></div></form>;
}
