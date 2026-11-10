import crypto from 'node:crypto';
import {Worker} from 'node:worker_threads';
import type {Express} from 'express';
import type {Pool} from 'pg';
import {InputError,counts,validateStats,rates,same,audit,transaction,ensureRoundRows} from './writes.ts';
const normalize=(v:unknown)=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
const emptyStats=()=>Object.fromEntries([...counts,'avg','era'].map(key=>[key,0]));
function number(value:any,label:string) {
  if(value&&typeof value==='object')throw new InputError(`${label}: hay una fórmula sin resultado o un error de Excel. Guarda el archivo recalculado.`);
  if(value===null||value===undefined||String(value).trim()==='')throw new InputError(`${label}: falta un valor.`);
  const n=typeof value==='number'?value:Number(String(value).trim().replace(',','.'));
  if(!Number.isFinite(n))throw new InputError(`${label}: número no válido.`);return n;
}
function optionalBoolean(value:any,label:string):boolean|null {
  if(value===null||value===undefined||String(value).trim()===''||['sin registrar','unknown'].includes(normalize(value)))return null;
  if(['si','yes','true','1','activo'].includes(normalize(value)))return true;
  if(['no','false','0','baja','inactivo'].includes(normalize(value)))return false;
  throw new InputError(`${label}: usa Sí, No o un campo vacío.`);
}
function readFile(data:Buffer,filename:string,teams:string[],kind:string,scope:string):Promise<any[]> {
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./parse-upload.ts',import.meta.url),{workerData:{data,filename,teams,kind,scope},resourceLimits:{maxOldGenerationSizeMb:256}});
    let finished=false;
    const finish=(error:any,records?:any[])=>{if(finished)return;finished=true;clearTimeout(timer);void worker.terminate();if(error)reject(new InputError(error));else resolve(records!);};
    const timer=setTimeout(()=>finish('El archivo excedió el tiempo de lectura. Divídelo en archivos más pequeños.'),30000);
    worker.on('message',message=>finish(message.error,message.records));
    worker.on('error',()=>finish('No se pudo procesar el archivo. Revisa el formato y el tamaño.'));
    worker.on('exit',()=>{if(!finished)finish('La lectura del archivo se interrumpió.');});
  });
}
export function registerImports(app:Express,pool:Pool) {
  app.post('/api/admin/imports/preview',async(req,res)=>{
    const {kind,filename,dataBase64,scope}=req.body??{};
    if(!['players','stats'].includes(kind)||typeof filename!=='string'||filename.length>200||!/^.+\.(csv|xlsx)$/i.test(filename))throw new InputError('Selecciona un archivo CSV o XLSX y el tipo de carga.');
    if(kind==='stats'&&!['rounds','accumulated'].includes(scope))throw new InputError('Elige jornadas o acumulados.');
    if(typeof dataBase64!=='string'||dataBase64.length>14000000||!/^[A-Za-z0-9+/]*={0,2}$/.test(dataBase64))throw new InputError('Archivo no válido. El máximo es 10 MB.');
    const data=Buffer.from(dataBase64,'base64');
    if(!data.length||data.length>10*1024*1024)throw new InputError('El archivo debe tener entre 1 byte y 10 MB.');
    const teams=(await pool.query('SELECT id,name FROM teams')).rows;
    const records=await readFile(data,filename,teams.map(t=>t.name),kind,scope??'');
    const preview=await transaction(pool,async c=>{
      await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
      const players=(await c.query(`SELECT p.id,p.name,p.team_id AS "teamId",p.member,p.active,p.placeholder,p.version AS "rosterVersion",s.stats,s.version AS "statsVersion" FROM players p JOIN player_stats s ON s.player_id=p.id`)).rows;
      const rounds=(await c.query('SELECT player_id,round,stats,version FROM round_stats')).rows;
      const roundMap=new Map(rounds.map(r=>[`${r.player_id}:${r.round}`,r]));
      const errors:{row:string;error:string}[]=[];const payload:any[]=[];const seen=new Set<string>();
      const totals=new Map(players.map(p=>[p.id,{...p.stats}]));const playerModes=new Map<number,string>();
      for(const record of records) {
        try {
          const team=teams.find(t=>String(t.id)===String(record.team)||normalize(t.name)===normalize(record.team));
          if(record.team!==undefined&&String(record.team).trim()!==''&&!team)throw new InputError('Equipo no reconocido.');
          let existing:any;
          if(record.playerId!==undefined&&String(record.playerId).trim()!=='') {
            const id=number(record.playerId,'ID_JUGADOR');existing=players.find(p=>p.id===id);
            if(!existing)throw new InputError('El ID_JUGADOR no existe.');
            if(kind==='stats'&&team&&existing.teamId!==team.id)throw new InputError('El ID_JUGADOR pertenece a otro equipo.');
            if(kind==='stats'&&record.name&&normalize(record.name)!==normalize(existing.name))throw new InputError('El nombre no coincide con el ID_JUGADOR.');
          }else {
            if(!team)throw new InputError('Equipo no reconocido. Usa el nombre de uno de los 16 equipos.');
            if(typeof record.name!=='string'||!record.name.trim())throw new InputError('Falta el nombre del jugador.');
            const matches=players.filter(p=>p.teamId===team.id&&normalize(p.name)===normalize(record.name));
            if(matches.length>1)throw new InputError('Hay varios jugadores con este nombre. Indica ID_JUGADOR.');
            existing=matches[0];
          }
          if(kind==='players') {
            if(!team)throw new InputError('Equipo no reconocido.');
            if(typeof record.name!=='string'||!record.name.trim()||record.name.length>150)throw new InputError('El nombre debe tener entre 1 y 150 caracteres.');
            const key=existing?`id:${existing.id}`:`new:${team.id}:${normalize(record.name)}`;
            if(seen.has(key))throw new InputError('Jugador repetido en el archivo.');seen.add(key);
            const member=Object.hasOwn(record,'member')?optionalBoolean(record.member,'Socio'):existing?.member??null;
            const active=Object.hasOwn(record,'active')&&String(record.active).trim()!==''?optionalBoolean(record.active,'Activo'):existing?.active??true;
            if(active===null)throw new InputError('Activo debe ser Sí o No.');
            payload.push({kind:'player',id:existing?.id??null,name:record.name.trim(),teamId:team.id,member,active,version:existing?.rosterVersion??null,placeholder:/^Jugador\s+\d+$/i.test(record.name.trim()),source:record.source,action:existing?'Actualizar':'Alta'});
          }else {
            if(!existing)throw new InputError('El jugador no existe. Da de alta su plantilla antes de cargar estadísticas.');
            if(!existing.active)throw new InputError('El jugador está de baja. Restáuralo antes de cargar estadísticas.');
            const accumulated=scope==='accumulated';
            const round=accumulated?null:number(record.round,'Jornada');
            if(round!==null&&(!Number.isInteger(round)||round<1||round>40))throw new InputError('La jornada debe estar entre 1 y 40.');
            if(accumulated&&record.round!==undefined&&String(record.round).trim()!==''&&!['acumulado','all','0'].includes(normalize(record.round)))throw new InputError('Esta carga es de acumulados. Selecciona Jornadas para registros con jornada.');
            const key=`${existing.id}:${round??'all'}`;if(seen.has(key))throw new InputError('Registro del jugador y jornada repetido.');seen.add(key);
            const mode=accumulated?'accumulated':'rounds';if(playerModes.has(existing.id)&&playerModes.get(existing.id)!==mode)throw new InputError('No mezcles acumulados y jornadas de un jugador en la misma carga.');playerModes.set(existing.id,mode);
            const previous=accumulated?{stats:existing.stats,version:existing.statsVersion}:roundMap.get(`${existing.id}:${round}`);
            if(!previous)throw new InputError('No existe el registro de jornada.');
            const stats=validateStats(Object.fromEntries(counts.map(key=>[key,number(record[key],key.toUpperCase())])),previous.stats);
            if(!accumulated)for(const key of counts){const total=totals.get(existing.id)!;total[key]=Math.round((total[key]+stats[key]-previous.stats[key])*100)/100;if(total[key]<0||total[key]>1000000)throw new InputError(`El cambio deja ${key.toUpperCase()} acumulado fuera de rango. Corrige primero el acumulado histórico.`);}
            payload.push({kind:'stats',id:existing.id,round,stats,version:previous.version,totalVersion:existing.statsVersion,rosterVersion:existing.rosterVersion,source:record.source,name:existing.name,teamId:existing.teamId,action:same(stats,previous.stats)?'Sin cambios':'Actualizar'});
          }
        }catch(e){if(errors.length<100)errors.push({row:record.source,error:e instanceof Error?e.message:'Fila no válida.'});}
      }
      let id:string|null=null;
      if(!errors.length) {
        id=crypto.randomUUID();
        await c.query("DELETE FROM import_batches WHERE status='pending' AND expires_at<now()-interval '7 days'");
        await c.query('INSERT INTO import_batches(id,user_id,kind,filename,sha256,payload,row_count) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,res.locals.auth.id,kind,filename,crypto.createHash('sha256').update(data).digest('hex'),JSON.stringify(payload),payload.length]);
      }
      return {id,filename,kind,total:records.length,valid:payload.length,errors,rows:payload.slice(0,100),previewLimit:100,expiresInMinutes:60};
    });res.json(preview);
  });
  app.post('/api/admin/imports/:id/apply',async(req,res)=>{
    if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(req.params.id))throw new InputError('Carga no válida.');
    const result=await transaction(pool,async c=>{
      const batch=(await c.query('SELECT * FROM import_batches WHERE id=$1 AND user_id=$2 FOR UPDATE',[req.params.id,res.locals.auth.id])).rows[0];
      if(!batch)throw new InputError('Carga no encontrada.',404);
      if(batch.status==='applied')return batch.result;
      if(new Date(batch.expires_at).getTime()<Date.now())throw new InputError('La vista previa venció. Vuelve a cargar el archivo.',409);
      const payload=batch.payload as any[];const responsible=res.locals.auth.email;
      const result={created:0,updated:0,unchanged:0,total:payload.length};
      if(batch.kind==='players') {
        await c.query('SELECT pg_advisory_xact_lock(827419)');
        const ids=payload.filter(r=>r.id).map(r=>r.id).sort((a,b)=>a-b);
        if(ids.length)await c.query('SELECT id FROM players WHERE id=ANY($1::integer[]) ORDER BY id FOR UPDATE',[ids]);
        for(const row of payload) {
          const current=row.id?(await c.query('SELECT * FROM players WHERE id=$1',[row.id])).rows[0]:null;
          if(row.id&&(!current||current.version!==row.version))throw new InputError(`${row.name}: la plantilla cambió. Genera una nueva vista previa.`,409);
          if(!row.id&&(await c.query('SELECT id FROM players WHERE team_id=$1 AND lower(trim(name))=lower($2)',[row.teamId,row.name])).rowCount)throw new InputError(`${row.name}: ya existe un jugador con ese nombre. Genera una nueva vista previa.`,409);
          if(current&&current.name===row.name&&current.team_id===row.teamId&&current.member===row.member&&current.active===row.active&&current.placeholder===row.placeholder){result.unchanged++;continue;}
          let saved:any;
          if(current){saved=(await c.query('UPDATE players SET name=$2,team_id=$3,member=$4,active=$5,placeholder=$6,version=version+1 WHERE id=$1 RETURNING *',[row.id,row.name,row.teamId,row.member,row.active,row.placeholder])).rows[0];result.updated++;}
          else {
            saved=(await c.query(`INSERT INTO players(name,original_name,team_id,member,active,placeholder,source_cell) VALUES($1,$1,$2,$3,$4,$5,$6) RETURNING *`,[row.name,row.teamId,row.member,row.active,row.placeholder,`${batch.filename}:${row.source}`])).rows[0];
            const stats=JSON.stringify(emptyStats());await c.query('INSERT INTO player_stats(player_id,stats) VALUES($1,$2)',[saved.id,stats]);
            await c.query(`INSERT INTO round_stats(player_id,round,stats,source_cell) SELECT $1,generate_series(1,30),$2::jsonb,$3`,[saved.id,stats,`${batch.filename}:${row.source}`]);result.created++;
          }
          await audit(c,'player',String(saved.id),current?'bulk_update':'bulk_create',current,saved,responsible);
        }
      }else {
        const ids=[...new Set(payload.map(r=>r.id))].sort((a,b)=>a-b);
        await c.query('SELECT player_id FROM player_stats WHERE player_id=ANY($1::integer[]) ORDER BY player_id FOR UPDATE',[ids]);
        await c.query('SELECT id FROM players WHERE id=ANY($1::integer[]) ORDER BY id FOR UPDATE',[ids]);
        for(const id of ids) {
          const expected=payload.find(r=>r.id===id)!;
          const current=(await c.query('SELECT s.version,p.version AS roster_version,p.active FROM player_stats s JOIN players p ON p.id=s.player_id WHERE s.player_id=$1',[id])).rows[0];
          if(!current||current.version!==expected.totalVersion||current.roster_version!==expected.rosterVersion||!current.active)throw new InputError(`${expected.name}: los datos cambiaron. Genera una nueva vista previa.`,409);
        }
        for(const row of payload) {
          const total=(await c.query('SELECT stats,version FROM player_stats WHERE player_id=$1',[row.id])).rows[0];
          const before=row.round===null?total:(await c.query('SELECT stats,version FROM round_stats WHERE player_id=$1 AND round=$2 FOR UPDATE',[row.id,row.round])).rows[0];
          if(!before||before.version!==row.version)throw new InputError(`${row.name}: el registro cambió. Genera una nueva vista previa.`,409);
          const stats=validateStats(row.stats,before.stats);if(same(stats,before.stats)){result.unchanged++;continue;}
          if(row.round===null) {
            const saved=(await c.query('UPDATE player_stats SET stats=$2,version=version+1 WHERE player_id=$1 RETURNING stats,version',[row.id,stats])).rows[0];
            await audit(c,'stats',String(row.id),'bulk_update',before,saved,responsible);
          }else {
            const next={...total.stats};for(const key of counts){next[key]=Math.round((next[key]+stats[key]-before.stats[key])*100)/100;if(next[key]<0||next[key]>1000000)throw new InputError('La carga deja un acumulado fuera de rango.');}
            const saved=(await c.query('UPDATE round_stats SET stats=$3,version=version+1 WHERE player_id=$1 AND round=$2 RETURNING stats,version',[row.id,row.round,stats])).rows[0];
            const savedTotal=(await c.query('UPDATE player_stats SET stats=$2,version=version+1 WHERE player_id=$1 RETURNING stats,version',[row.id,rates(next)])).rows[0];
            await audit(c,'round',`${row.id}:${row.round}`,'bulk_update',before,saved,responsible);await audit(c,'stats',String(row.id),'round_delta',total,savedTotal,responsible);
          }result.updated++;
        }
      }
      if(result.created)await ensureRoundRows(c);
      await c.query("UPDATE import_batches SET status='applied',result=$2,applied_at=now() WHERE id=$1",[batch.id,result]);
      await audit(c,'import',batch.id,'bulk_apply',null,{filename:batch.filename,kind:batch.kind,...result},responsible);
      return result;
    });res.json(result);
  });
  app.get('/api/admin/imports',async(_req,res)=>{
    res.json((await pool.query('SELECT id,filename,kind,row_count AS "rowCount",status,result,created_at AS "createdAt",applied_at AS "appliedAt" FROM import_batches ORDER BY created_at DESC LIMIT 30')).rows);
  });
}
