import {useEffect,useMemo,useState} from 'react';
import {Save,RotateCw,Search,Users} from 'lucide-react';
import type {Snapshot,Stats} from './types';
import {write} from './api';
import History from './History';
import {statRounds} from './rounds';

const fields=[
  ['jj','JJ','Juegos jugados'],['ab','AB','Turnos al bat'],['hits','H','Hits'],
  ['singles','1B','Sencillos'],['doubles','2B','Dobles'],['triples','3B','Triples'],
  ['hr','HR','Home runs'],['rbi','RBI','Carreras impulsadas'],
  ['ip','IP','Entradas lanzadas'],['er','ER','Carreras limpias'],
  ['bb','BB','Bases por bola'],['k','K','Ponches'],
  ['w','W','Victorias del pitcher'],['l','L','Derrotas del pitcher'],
] as const;
type CountKey=typeof fields[number][0];
type Values=Record<CountKey,string>;
type Draft={values:Values;baseline:Stats;version:number};
type RecordValue={stats:Stats;version:number};
const normalize=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const valuesOf=(stats:Stats)=>Object.fromEntries(fields.map(([key])=>[key,String(stats[key])])) as Values;
const differs=(draft:Draft)=>fields.some(([key])=>draft.values[key]===''||Number(draft.values[key])!==draft.baseline[key]);
function validation(draft:Draft) {
  for(const [key,label] of fields) {
    const value=Number(draft.values[key]);
    if(draft.values[key]===''||!Number.isFinite(value)||value<0||value>1000000||
      (key!=='ip'&&!Number.isInteger(value))||
      (key==='ip'&&Math.abs(value*100-Math.round(value*100))>0.00001)) {
      return `${label}: usa un número entre 0 y 1,000,000${key==='ip'?' con hasta dos decimales':' entero'}.`;
    }
  }
  if((['ab','hits','singles','doubles','triples','hr'] as CountKey[]).some(key=>Number(draft.values[key])!==draft.baseline[key])) {
    const hits=Number(draft.values.hits);
    if(hits!==Number(draft.values.singles)+Number(draft.values.doubles)+Number(draft.values.triples)+Number(draft.values.hr))return 'H debe ser igual a 1B + 2B + 3B + HR.';
    if(hits>Number(draft.values.ab))return 'Los hits no pueden superar AB.';
  }
  return '';
}

export default function Capture({data,reload,onDirty}:{data:Snapshot;reload:()=>Promise<void>;onDirty:(dirty:boolean)=>void}) {
  const [team,setTeam]=useState('all');
  const [scope,setScope]=useState('1');
  const [search,setSearch]=useState('');
  const [mode,setMode]=useState<'batting'|'pitching'>('batting');
  const [showSlots,setShowSlots]=useState(false);
  const [pageSize,setPageSize]=useState('all');
  const [page,setPage]=useState(0);
  const [drafts,setDrafts]=useState<Record<number,Draft>>({});
  const [saved,setSaved]=useState<Record<string,RecordValue>>({});
  const [busy,setBusy]=useState<number|null>(null);
  const [errors,setErrors]=useState<Record<number,string>>({});
  const [message,setMessage]=useState('');
  const dirtyCount=Object.keys(drafts).length;

  useEffect(()=>{onDirty(dirtyCount>0);return()=>onDirty(false);},[dirtyCount,onDirty]);
  useEffect(()=>setPage(0),[team,search,showSlots,pageSize,scope]);
  const teamMap=useMemo(()=>new Map(data.teams.map(t=>[t.id,t])),[data.teams]);
  const records=useMemo(()=>{
    const current=new Map<number,RecordValue>(scope==='all'
      ?data.players.map(p=>[p.id,{stats:p.stats,version:p.version}])
      :data.rounds.filter(r=>r.round===Number(scope)).map(r=>[r.playerId,{stats:r.stats,version:r.version}])
    );
    for(const [id,record] of current){const update=saved[`${scope}:${id}`];if(update&&update.version>record.version)current.set(id,update);}
    return current;
  },[data.players,data.rounds,scope,saved]);
  const players=useMemo(()=>data.players.filter(p=>p.active&&(showSlots||!p.placeholder)&&
    (team==='all'||p.teamId===Number(team))&&
    normalize(`${p.name} ${teamMap.get(p.teamId)?.name??''}`).includes(normalize(search))
  ).sort((a,b)=>(teamMap.get(a.teamId)?.name??'').localeCompare(teamMap.get(b.teamId)?.name??'','es')||a.name.localeCompare(b.name,'es')),
  [data.players,team,showSlots,search,teamMap]);
  const limit=pageSize==='all'?Math.max(players.length,1):Number(pageSize);
  const pages=Math.max(1,Math.ceil(players.length/limit));
  const currentPage=Math.min(page,pages-1);
  const rows=players.slice(currentPage*limit,(currentPage+1)*limit);
  const columns=mode==='batting'?fields.slice(0,8):fields.slice(8);
  const visibleIds=new Set(rows.map(p=>p.id));
  const hiddenDrafts=Object.keys(drafts).filter(id=>!visibleIds.has(Number(id))).length;

  const edit=(id:number,key:CountKey,value:string)=>{
    const record=records.get(id);if(!record)return;
    setDrafts(previous=>{
      const initial=previous[id]??{values:valuesOf(record.stats),baseline:record.stats,version:record.version};
      const next={...initial,values:{...initial.values,[key]:value}};
      const result={...previous};if(differs(next))result[id]=next;else delete result[id];return result;
    });
    setErrors(previous=>{const next={...previous};delete next[id];return next;});setMessage('');
  };
  const discard=(id:number)=>{
    if(drafts[id]&&!window.confirm('¿Descartar los cambios de este jugador y cargar sus cifras actuales?'))return;
    setDrafts(previous=>{const next={...previous};delete next[id];return next;});
    setErrors(previous=>{const next={...previous};delete next[id];return next;});setMessage('');
  };
  const changeScope=(value:string)=>{
    if(dirtyCount&&!window.confirm(`Hay ${dirtyCount} jugadores con cambios sin guardar. ¿Quieres descartarlos y cambiar de registro?`))return;
    setDrafts({});setErrors({});setMessage('');setScope(value);
  };
  const save=async(id:number)=>{
    const draft=drafts[id];if(!draft||busy!==null)return;
    const error=validation(draft);if(error){setErrors(previous=>({...previous,[id]:error}));return;}
    if(records.get(id)?.version!==draft.version){setErrors(previous=>({...previous,[id]:'Las cifras cambiaron en otra sesión. Tu borrador se conserva; descarta esta fila para cargar los datos actuales.'}));return;}
    setBusy(id);setMessage('');
    try {
      const stats=Object.fromEntries(fields.map(([key])=>[key,Number(draft.values[key])])) as Stats;
      const result=await write<RecordValue>(`/api/players/${id}/${scope==='all'?'stats':`rounds/${scope}`}`,'PUT',{stats,version:draft.version});
      setSaved(previous=>({...previous,[`${scope}:${id}`]:result}));
      await reload();
      setDrafts(previous=>{const next={...previous};delete next[id];return next;});
      setErrors(previous=>{const next={...previous};delete next[id];return next;});
      setMessage(`Estadísticas de ${data.players.find(p=>p.id===id)?.name} guardadas.`);
    }catch(e){setErrors(previous=>({...previous,[id]:e instanceof Error?e.message:'No se pudo guardar.'}));}
    finally{setBusy(null);}
  };

  return <div className="admin-stack">
    <section className="panel capture-grid-panel">
      <div className="panel-heading"><div><h2><Users size={19}/> Captura de todos los jugadores</h2><p>Edita las cifras directamente en la tabla y guarda cada fila.</p></div><span className="tiny-badge">{players.length} JUGADORES</span></div>
      <div className="panel-body capture-grid-tools">
        <div className="form-grid">
          <label>Equipo<select value={team} onChange={e=>setTeam(e.target.value)}><option value="all">Todos los equipos</option>{data.teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label>Registro<select disabled={busy!==null} value={scope} onChange={e=>changeScope(e.target.value)}><option value="all">Corregir acumulado</option>{statRounds(data).map(r=><option key={r} value={r}>Jornada {r}</option>)}</select></label>
          <label>Buscar jugador o equipo<div className="capture-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nombre o equipo"/></div></label>
          <label>Mostrar<select value={pageSize} onChange={e=>setPageSize(e.target.value)}><option value="all">Todos los jugadores</option><option value="25">25 por página</option><option value="50">50 por página</option><option value="100">100 por página</option></select></label>
        </div>
        <div className="capture-grid-options"><div className="segmented"><button className={mode==='batting'?'active':''} onClick={()=>setMode('batting')}>Bateo</button><button className={mode==='pitching'?'active':''} onClick={()=>setMode('pitching')}>Pitcheo</button></div><label className="check-control"><input type="checkbox" checked={showSlots} onChange={e=>setShowSlots(e.target.checked)}/> Espacios de plantilla</label><span className="capture-pending">{dirtyCount?`${dirtyCount} filas sin guardar`:'Sin cambios pendientes'}</span></div>
        <div className="admin-notice">{scope==='all'?'Estás corrigiendo el acumulado; las jornadas se conservan.':'Al guardar una fila, la diferencia de la jornada se aplica al acumulado.'} AVG y ERA se calculan automáticamente. Puedes cambiar de equipo, buscar o pasar de página conservando los borradores.</div>
        {hiddenDrafts>0&&<div className="form-error" role="status">Hay {hiddenDrafts} filas con cambios fuera de esta vista. Amplía los filtros o cambia de página para guardarlas.</div>}
        {message&&<div className="form-success" role="status">{message}</div>}
        <p className="admin-help capture-scroll-hint">Desplaza la tabla horizontalmente para ver todas las columnas y verticalmente para recorrer los jugadores.</p>
      </div>
      <div className="table-scroll capture-grid-scroll"><table className="capture-grid-table">
        <thead><tr><th className="capture-player-column">Jugador / equipo</th>{columns.map(([key,label,description])=><th key={key} title={description}>{label}</th>)}<th title={mode==='batting'?'Hits / turnos al bat':'Carreras limpias × 7 / entradas lanzadas'}>{mode==='batting'?'AVG':'ERA'}</th><th className="capture-actions-column">Guardar fila</th></tr></thead>
        <tbody>{rows.map(p=>{
          const record=records.get(p.id),draft=drafts[p.id];
          const values=draft?.values??(record?valuesOf(record.stats):null);
          const stale=Boolean(draft&&record?.version!==draft.version);
          const invalid=draft?validation(draft):'';
          const ab=Number(values?.ab),hits=Number(values?.hits),ip=Number(values?.ip),er=Number(values?.er);
          const rate=mode==='batting'?(ab?hits/ab:0):(ip?er*7/ip:0);
          return <tr key={p.id} className={draft?'capture-row-pending':''}>
            <td className="capture-player-column"><strong>{p.name}</strong><span className="capture-player-team" style={{color:teamMap.get(p.teamId)?.color}}>{teamMap.get(p.teamId)?.name}{p.placeholder?' · Espacio de plantilla':''}</span>{stale&&<span className="capture-row-warning">Hay datos nuevos; tu borrador se conserva.</span>}{(errors[p.id]||invalid)&&<span className="capture-row-warning" role={errors[p.id]?'alert':undefined}>{errors[p.id]||invalid}</span>}{!record&&<span className="capture-row-warning">Registro no disponible.</span>}</td>
            {columns.map(([key,label])=><td key={key}><input aria-label={`${label} de ${p.name}, ${teamMap.get(p.teamId)?.name}`} type="number" min="0" max="1000000" step={key==='ip'?'0.01':'1'} required disabled={busy!==null||!values} value={values?.[key]??''} className={draft&&Number(values?.[key])!==draft.baseline[key]?'capture-cell-changed':''} onChange={e=>edit(p.id,key,e.target.value)}/></td>)}
            <td className="capture-calculated">{values&&Number.isFinite(rate)?rate.toFixed(mode==='batting'?3:2):'—'}</td>
            <td className="capture-actions-column"><button className="primary-button" aria-label={`Guardar estadísticas de ${p.name}`} disabled={!draft||busy!==null||stale||Boolean(invalid)} onClick={()=>void save(p.id)}><Save size={14}/>{busy===p.id?'Guardando…':'Guardar'}</button>{draft&&<button className="text-button" disabled={busy!==null} onClick={()=>discard(p.id)}><RotateCw size={12}/>{stale?'Cargar actuales':'Descartar'}</button>}</td>
          </tr>;
        })}</tbody>
      </table>{!rows.length&&<div className="admin-empty">No hay jugadores con estos filtros. Cambia el equipo o la búsqueda.</div>}</div>
      <div className="table-footer"><span>{players.length?currentPage*limit+1:0}–{Math.min((currentPage+1)*limit,players.length)} de {players.length} jugadores · {scope==='all'?'Acumulado':`Jornada ${scope}`}</span>{pageSize!=='all'&&<div className="pagination"><button className="secondary-button" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>Anterior</button><span>{currentPage+1} / {pages}</span><button className="secondary-button" disabled={currentPage>=pages-1} onClick={()=>setPage(currentPage+1)}>Siguiente</button></div>}</div>
      <div className="panel-body"><p className="admin-help">H = 1B + 2B + 3B + HR. IP usa decimales, como en el Excel; ERA se calcula sobre 7 entradas.</p><p className="admin-help">Cada cambio queda en el historial con la cuenta que inició sesión.</p></div>
    </section>
    <History data={data} entity={scope==='all'?'stats':'round'}/>
  </div>;
}
