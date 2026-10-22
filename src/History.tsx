import {useEffect,useState} from 'react';
import type {Change,Snapshot} from './types';
const operations:Record<string,string>={create:'Alta',update:'Edición',remove:'Baja',restore:'Restauración',round_delta:'Actualización por jornada',import:'Importación del Excel'};
export default function History({data,entity,entityId}:{data:Snapshot;entity?:string;entityId?:string}) {
  const [rows,setRows]=useState<Change[]>([]);
  const [error,setError]=useState('');
  useEffect(()=>{
    const abort=new AbortController();
    const query=new URLSearchParams();
    if(entity)query.set('entity',entity);
    if(entityId)query.set('entityId',entityId);
    void fetch('/api/changes?'+query,{signal:abort.signal}).then(async r=>{if(!r.ok)throw new Error('No se pudo consultar la bitácora.');return r.json();}).then(rows=>{setRows(rows);setError('');}).catch(e=>{if(e.name!=='AbortError')setError(e.message);});
    return ()=>abort.abort();
  },[data.updatedAt,entity,entityId]);
  const label=(r:Change)=>r.entity==='game'?`Juego #${r.entityId}`:`${data.players.find(p=>p.id===Number(r.entityId.split(':')[0]))?.name??'Jugador'}${r.entity==='round'?` · Jornada ${r.entityId.split(':')[1]}`:r.entity==='stats'?' · Acumulado':''}`;
  return <section className="panel admin-history"><div className="panel-heading"><div><h2>Historial de cambios</h2><p>Últimos 100 movimientos guardados.</p></div></div>{error&&<p role="alert" className="form-error">{error}</p>}{!rows.length&&!error&&<p className="admin-empty">Todavía no hay cambios guardados para esta selección.</p>}<div className="history-list">{rows.map(r=><details key={r.id}><summary><span><strong>{operations[r.operation]??r.operation}</strong> · {label(r)}</span><small>{r.responsible} · {new Date(r.createdAt).toLocaleString('es-MX')}</small></summary><div className="history-detail"><div><h4>Antes</h4><pre>{JSON.stringify(r.before,null,2)}</pre></div><div><h4>Después</h4><pre>{JSON.stringify(r.after,null,2)}</pre></div></div></details>)}</div></section>;
}
