import {useEffect,useState} from 'react';
import type {Snapshot} from './types';
import {write} from './api';
import {fileBase64} from './upload';
import {dominanceReading,regulation,regulationNote} from './standings-rules';
export default function LeagueSettings({data,reload,onDirty}:{data:Snapshot;reload:()=>Promise<void>;onDirty:(dirty:boolean)=>void}) {
  const [draft,setDraft]=useState({...data.league}),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(false);
  const [file,setFile]=useState<File|null>(null),[error,setError]=useState(''),[message,setMessage]=useState('');
  useEffect(()=>{if(!dirty)setDraft({...data.league});},[data.league,dirty]);
  useEffect(()=>{onDirty(dirty);return()=>onDirty(false);},[dirty,onDirty]);
  const change=(values:Partial<typeof draft>)=>{setDraft({...draft,...values});setDirty(true);setMessage('');};
  const save=async(e:React.FormEvent)=>{
    e.preventDefault();setBusy(true);setError('');
    try{await write('/api/admin/league/settings','PUT',{name:draft.name,rulesNotes:draft.rulesNotes,version:draft.version});setDirty(false);await reload();setMessage('Configuración de la liga guardada.');}
    catch(e){setError(e instanceof Error?e.message:'No se pudo guardar.');}finally{setBusy(false);}
  };
  const upload=async()=>{
    if(!file)return;setBusy(true);setError('');setMessage('');
    try{
      if(file.size>2*1024*1024)throw new Error('La imagen admite hasta 2 MB.');
      const url=URL.createObjectURL(file);
      try{const img=new Image();img.src=url;await img.decode();if(img.width>6000||img.height>6000)throw new Error('La imagen admite hasta 6000 × 6000 píxeles.');}finally{URL.revokeObjectURL(url);}
      await write('/api/admin/league/logo','PUT',{version:data.league.version,dataBase64:await fileBase64(file)});setFile(null);await reload();setMessage('Imagen de la liga actualizada.');
    }catch(e){setError(e instanceof Error?e.message:'No se pudo cargar la imagen.');}finally{setBusy(false);}
  };
  return <div className="admin-stack"><section className="panel"><div className="panel-heading"><div><h2>Imagen de la liga</h2><p>Se utiliza en la navegación y en las listas para imprimir.</p></div></div><div className="panel-body"><div className="league-image-preview">{data.league.logoUrl?<img src={data.league.logoUrl} alt={`Imagen de ${data.league.name}`}/>:<span>Sin imagen de la liga</span>}</div><label className="upload-control">Imagen PNG, JPG o WebP<input disabled={busy||dirty} type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setFile(e.target.files?.[0]??null)}/></label><p className="admin-help">Recomendado: 512 × 512 px, hasta 2 MB. Se conserva la proporción. La imagen se guarda en la base de datos.{dirty&&' Guarda o descarta los cambios del reglamento antes de cargar una imagen.'}</p><div className="form-actions"><button className="primary-button" disabled={busy||!file||dirty} onClick={()=>void upload()}>{busy?'Guardando…':'Guardar imagen'}</button></div></div></section><section className="panel"><div className="panel-heading"><div><h2>Liga y reglamento</h2><p>Nombre de la liga y observaciones. El orden de la tabla de posiciones aplica el reglamento aprobado.</p></div></div><form className="panel-body" onSubmit={save}><fieldset disabled={busy}><div className="form-grid"><label>Nombre de la liga<input required maxLength={150} value={draft.name} onChange={e=>change({name:e.target.value})}/></label></div><div className="admin-notice"><strong>4. Criterios de desempate (reglamento vigente).</strong> Los lugares se definen por porcentaje de victorias: partidos ganados entre partidos jugados. Con el mismo porcentaje:<ol className="rules-list">{regulation.map(rule=><li key={rule}>{rule.slice(3)}</li>)}</ol>{regulationNote}<br/>{dominanceReading} Un cambio del reglamento requiere actualizar la app; el volado se captura cuando la liga lo realice.</div><label className="upload-control">Observaciones del reglamento (se muestran bajo la tabla de posiciones)<textarea rows={4} maxLength={4000} value={draft.rulesNotes} onChange={e=>change({rulesNotes:e.target.value})}/></label><div className="form-actions"><button type="button" className="secondary-button" disabled={busy} onClick={()=>{setDirty(false);setDraft({...data.league});setError('');}}>Descartar cambios</button><button className="primary-button" disabled={busy||!dirty}>{busy?'Guardando…':'Guardar'}</button></div></fieldset></form></section>{error&&<div className="form-error" role="alert">{error}</div>}{message&&<div className="form-success" role="status">{message}</div>}</div>;
}
