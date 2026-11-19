import {useState} from 'react';
import {DatabaseBackup,FileSpreadsheet,CheckCircle2} from 'lucide-react';
import type {Snapshot} from './types';
type Format='sql'|'xlsx';
export default function ExportData({data}:{data:Snapshot}) {
  const [busy,setBusy]=useState<Format|null>(null),[error,setError]=useState(''),[message,setMessage]=useState('');
  const download=async(format:Format)=>{
    setBusy(format);setError('');setMessage('');
    try{
      const response=await fetch(`/api/admin/export/database.${format}`,{cache:'no-store'});
      if(response.status===401){window.dispatchEvent(new Event('diamante-session-expired'));return;}
      if(!response.ok)throw new Error((await response.json().catch(()=>null))?.error??'No se pudo generar la exportación.');
      const name=/filename="([^"]+)"/.exec(response.headers.get('Content-Disposition')??'')?.[1]??`diamante.${format}`;
      const url=URL.createObjectURL(await response.blob());
      const link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),1000);
      setMessage(`Se descargó ${name}.`);
    }catch(e){setError(e instanceof Error?e.message:'No se pudo generar la exportación.');}finally{setBusy(null);}
  };
  const count=(value:number)=>new Intl.NumberFormat('es-MX').format(value);
  return <div className="admin-stack">
    <section className="panel"><div className="panel-heading"><div><h2><DatabaseBackup size={19}/> Respaldo completo</h2><p>Archivo .sql con todos los datos del torneo, listo para restaurarse en PostgreSQL.</p></div></div><div className="panel-body">
      <p className="admin-help">Incluye {count(data.teams.length)} equipos, {count(data.players.length)} jugadores con sus acumulados, {count(data.rounds.length)} registros de jornadas, {count(data.games.length)} juegos, {count(data.gameHits.length)} capturas de hits por partido, la configuración e imagen de la liga y el historial completo de cambios.</p>
      <div className="admin-notice">No incluye la cuenta de administración, las sesiones ni las vistas previas de cargas masivas. Restaurar el archivo reemplaza los datos del torneo de la base de destino; los pasos están en el README, en “Exportar y restaurar la base de datos”. Guarda el archivo en un lugar seguro.</div>
      <div className="download-actions"><button className="primary-button" disabled={busy!==null} onClick={()=>void download('sql')}><DatabaseBackup size={16}/>{busy==='sql'?'Generando…':'Descargar respaldo (.sql)'}</button></div>
    </div></section>
    <section className="panel"><div className="panel-heading"><div><h2><FileSpreadsheet size={19}/> Datos en Excel</h2><p>Libro .xlsx para consultar o compartir los datos; no sirve para restaurar la base.</p></div></div><div className="panel-body">
      <p className="admin-help">Una hoja por tipo de registro: Equipos, Jugadores, Acumulados, Jornadas, Rol de juegos, Hits por partido e Historial. Incluye a los jugadores dados de baja y los juegos retirados, marcados como tales.</p>
      <div className="download-actions"><button className="secondary-button" disabled={busy!==null} onClick={()=>void download('xlsx')}><FileSpreadsheet size={16}/>{busy==='xlsx'?'Generando…':'Descargar Excel (.xlsx)'}</button></div>
    </div></section>
    {error&&<div className="form-error" role="alert">{error}</div>}
    {message&&<div className="form-success" role="status"><CheckCircle2 size={17}/> {message}</div>}
  </div>;
}
