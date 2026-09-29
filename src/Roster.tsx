import {useEffect,useRef,useState} from 'react';
import {Plus,Pencil,UserMinus,RotateCw,X} from 'lucide-react';
import type {Player,Snapshot} from './types';
import {write} from './api';
import History from './History';
const memberText=(member:boolean|null)=>member===null?'Sin registrar':member?'Sí':'No';
export default function Roster({data,reload}:{data:Snapshot;reload:()=>Promise<void>}) {
  const [team,setTeam]=useState(data.teams[0].id);
  const [inactive,setInactive]=useState(false);
  const [search,setSearch]=useState('');
  const [editing,setEditing]=useState<Player|null|undefined>();
  const [name,setName]=useState('');
  const [editTeam,setEditTeam]=useState(team);
  const [member,setMember]=useState('unknown');
  const [responsible,setResponsible]=useState(()=>localStorage.getItem('diamante-responsible')||'Captura local');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [removing,setRemoving]=useState<Player|null>(null);
  const dialog=useRef<HTMLDialogElement>(null);
  const removeDialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{if(editing!==undefined)dialog.current?.showModal();else dialog.current?.close();},[editing]);
  useEffect(()=>{if(removing)removeDialog.current?.showModal();else removeDialog.current?.close();},[removing]);
  const open=(p:Player|null)=>{setError('');setName(p?.name??'');setEditTeam(p?.teamId??team);setMember(p?.member===null||!p?'unknown':p.member?'yes':'no');setEditing(p);};
  const save=async(e:React.FormEvent)=>{
    e.preventDefault();setError('');setBusy(true);
    try{await write(editing?`/api/players/${editing.id}`:'/api/players',editing?'PUT':'POST',{name,teamId:editTeam,member:member==='unknown'?null:member==='yes',version:editing?.rosterVersion,responsible});localStorage.setItem('diamante-responsible',responsible);setMessage(editing?'Jugador actualizado.':'Jugador dado de alta, listo para capturar estadísticas.');setEditing(undefined);await reload();}
    catch(e){setError(e instanceof Error?e.message:'No se pudo guardar.');}finally{setBusy(false);}
  };
  const deactivate=async(p:Player,restore:boolean)=>{
    setError('');setBusy(true);
    try{await write(`/api/players/${p.id}${restore?'/restore':''}`,restore?'POST':'DELETE',{version:p.rosterVersion,responsible});setRemoving(null);setMessage(restore?'Jugador restaurado.':'Jugador dado de baja. Sus estadísticas se conservan.');await reload();}
    catch(e){setError(e instanceof Error?e.message:'No se pudo guardar.');}finally{setBusy(false);}
  };
  const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const players=data.players.filter(p=>p.teamId===team&&(inactive?!p.active:p.active)&&normalize(p.name).includes(normalize(search)));
  return <div className="admin-stack"><section className="panel roster-panel"><div className="panel-heading"><div><h2>Plantillas de equipos</h2><p>Altas, bajas y condición de socio de cada jugador.</p></div><button className="primary-button" onClick={()=>open(null)}><Plus size={16}/> Alta de jugador</button></div><div className="form-grid schedule-filters"><label>Equipo<select value={team} onChange={e=>setTeam(Number(e.target.value))}>{data.teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>Buscar jugador<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nombre del jugador"/></label><label className="check-control"><input type="checkbox" checked={inactive} onChange={e=>setInactive(e.target.checked)}/> Jugadores dados de baja</label></div>{error&&!dialog.current?.open&&!removeDialog.current?.open&&<div className="form-error" role="alert">{error}</div>}{message&&<div className="form-success" role="status">{message}</div>}<div className="table-scroll"><table><thead><tr><th>Jugador</th><th>Socio</th><th>Registro</th><th>Administrar</th></tr></thead><tbody>{players.map(p=><tr key={p.id}><td><strong>{p.name}</strong></td><td><span className={`membership ${p.member===true?'yes':''}`}>{memberText(p.member)}</span></td><td>{p.placeholder?'Espacio de plantilla':p.active?'Activo':'Baja'}</td><td><div className="schedule-actions"><button className="icon-button" aria-label={`Editar jugador ${p.name}`} onClick={()=>open(p)}><Pencil size={16}/></button>{p.active?<button className="icon-button danger" aria-label={`Dar de baja a ${p.name}`} onClick={()=>{setError('');setRemoving(p);}}><UserMinus size={16}/></button>:<button className="secondary-button" disabled={busy} onClick={()=>void deactivate(p,true)}><RotateCw size={14}/> Restaurar</button>}</div></td></tr>)}</tbody></table>{!players.length&&<p className="admin-empty">No hay jugadores con esta selección.</p>}</div><div className="table-footer">{players.length} registros · Las bajas conservan acumulados y jornadas.</div></section><History data={data} entity="player"/><dialog ref={dialog} className="admin-dialog" onCancel={e=>{if(busy)e.preventDefault();else setEditing(undefined);}} onClose={()=>{if(!busy)setEditing(undefined);}}><form onSubmit={save}><div className="dialog-header"><span>{editing?'EDITAR JUGADOR':'ALTA DE JUGADOR'}</span><button type="button" className="icon-button" disabled={busy} aria-label="Cerrar jugador" onClick={()=>setEditing(undefined)}><X size={20}/></button></div><fieldset disabled={busy}><label>Nombre del jugador<input required maxLength={150} value={name} onChange={e=>setName(e.target.value)}/></label><label>Equipo<select value={editTeam} onChange={e=>setEditTeam(Number(e.target.value))}>{data.teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>¿Es socio?<select value={member} onChange={e=>setMember(e.target.value)}><option value="unknown">Sin registrar</option><option value="yes">Sí, es socio</option><option value="no">No es socio</option></select></label><label>Responsable<input required maxLength={100} value={responsible} onChange={e=>setResponsible(e.target.value)}/></label></fieldset>{editing?.placeholder&&<p className="admin-help">Al guardar, este espacio se convierte en un jugador con nombre.</p>}{error&&<div className="form-error" role="alert">{error}</div>}<div className="form-actions"><button type="button" className="secondary-button" disabled={busy} onClick={()=>setEditing(undefined)}>Cancelar</button><button className="primary-button" disabled={busy}>{busy?'Guardando…':'Guardar jugador'}</button></div></form></dialog><dialog ref={removeDialog} className="admin-dialog" onCancel={e=>{if(busy)e.preventDefault();else setRemoving(null);}} onClose={()=>{if(!busy)setRemoving(null);}}>{removing&&<><h2>Dar de baja a jugador</h2><p><strong>{removing.name}</strong></p><p>Se retirará de la plantilla activa y las consultas públicas. Sus estadísticas seguirán guardadas y podrás restaurarlo.</p><label>Responsable<input required maxLength={100} value={responsible} onChange={e=>setResponsible(e.target.value)}/></label>{error&&<div className="form-error" role="alert">{error}</div>}<div className="form-actions"><button className="secondary-button" disabled={busy} onClick={()=>setRemoving(null)}>Cancelar</button><button className="primary-button danger-button" disabled={busy||!responsible.trim()} onClick={()=>void deactivate(removing,false)}>{busy?'Guardando…':'Dar de baja'}</button></div></>}</dialog></div>;
}
