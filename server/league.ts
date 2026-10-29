import type {Express} from 'express';
import type {Pool} from 'pg';
import {InputError,transaction,audit,counts} from './writes.ts';

function csvCell(value:unknown) {
  let text=String(value??'');
  if(typeof value==='string'&&/^[\s]*[=+\-@]/.test(text))text="'"+text;
  return '"'+text.replace(/"/g,'""')+'"';
}
function csv(res:any,name:string,rows:unknown[][]) {
  res.set({'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="${name}"`,'Cache-Control':'no-store'});
  res.send('\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n'));
}
export function registerLeague(app:Express,pool:Pool) {
  app.get('/api/league/logo',async(_req,res)=>{
    const row=(await pool.query('SELECT logo,logo_type,logo_version FROM league_settings WHERE id=1')).rows[0];
    if(!row?.logo){res.status(404).end();return;}
    res.set({'Content-Type':row.logo_type,'X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=300','ETag':`"league-${row.logo_version}"`});
    res.send(row.logo);
  });
  app.put('/api/admin/league/settings',async(req,res)=>{
    // El orden de la tabla de posiciones es el del reglamento de la liga (ver src/standings-rules.ts); aquí solo se guardan nombre y observaciones.
    const {name,rulesNotes,version}=req.body??{};
    if(typeof name!=='string'||!name.trim()||name.length>150)throw new InputError('Indica el nombre de la liga (hasta 150 caracteres).');
    if(typeof rulesNotes!=='string'||rulesNotes.length>4000)throw new InputError('Las observaciones del reglamento admiten hasta 4000 caracteres.');
    await transaction(pool,async c=>{
      const before=(await c.query('SELECT name,rules_notes,logo_version FROM league_settings WHERE id=1 FOR UPDATE')).rows[0];
      if(before.logo_version!==version)throw new InputError('La configuración cambió. Actualiza y vuelve a guardar.',409);
      const after=(await c.query('UPDATE league_settings SET name=$1,rules_notes=$2,logo_version=logo_version+1,updated_at=now() WHERE id=1 RETURNING name,rules_notes,logo_version',[name.trim(),rulesNotes.trim()])).rows[0];
      await audit(c,'league','1','rules_update',before,after,res.locals.auth.email);
    });res.json({ok:true});
  });
  // Orden manual de la tabla de posiciones: respaldo cuando el criterio automático no aplique. null vuelve al orden automático.
  app.put('/api/admin/league/standings-order',async(req,res)=>{
    const {scope,order,version}=req.body??{};
    if(!['all','1','2'].includes(scope))throw new InputError('Indica el alcance: temporada, primera o segunda vuelta.');
    if(order!==null&&!(Array.isArray(order)&&order.every(id=>Number.isInteger(id))))throw new InputError('El orden debe ser una lista de equipos.');
    await transaction(pool,async c=>{
      const before=(await c.query('SELECT standings_order,logo_version FROM league_settings WHERE id=1 FOR UPDATE')).rows[0];
      if(before.logo_version!==version)throw new InputError('La configuración cambió. Actualiza y vuelve a intentar.',409);
      if(order!==null) {
        const teams=(await c.query('SELECT id FROM teams ORDER BY id')).rows.map(row=>row.id as number);
        if(order.length!==teams.length||new Set(order).size!==order.length||!order.every(id=>teams.includes(id)))throw new InputError('El orden debe incluir a los 16 equipos una sola vez.');
      }
      const next={...before.standings_order};
      if(order===null)delete next[scope];else next[scope]=order;
      await c.query('UPDATE league_settings SET standings_order=$1,logo_version=logo_version+1,updated_at=now() WHERE id=1',[JSON.stringify(next)]);
      await audit(c,'league','1','standings_order',{scope,order:before.standings_order[scope]??null},{scope,order},res.locals.auth.email);
    });res.json({ok:true});
  });
  app.put('/api/admin/league/logo',async(req,res)=>{
    const {dataBase64,version}=req.body??{};
    if(typeof dataBase64!=='string'||dataBase64.length>2800000||!/^[A-Za-z0-9+/]*={0,2}$/.test(dataBase64))throw new InputError('La imagen admite hasta 2 MB.');
    const image=Buffer.from(dataBase64,'base64');
    if(!image.length||image.length>2*1024*1024)throw new InputError('La imagen admite hasta 2 MB.');
    const mime=image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':image[0]===255&&image[1]===216&&image[2]===255?'image/jpeg':image.toString('ascii',0,4)==='RIFF'&&image.toString('ascii',8,12)==='WEBP'?'image/webp':null;
    if(!mime)throw new InputError('Usa una imagen PNG, JPG o WebP.');
    await transaction(pool,async c=>{
      const before=(await c.query('SELECT logo_version FROM league_settings WHERE id=1 FOR UPDATE')).rows[0];
      if(before.logo_version!==version)throw new InputError('La imagen o configuración cambió. Actualiza la pantalla.',409);
      await c.query('UPDATE league_settings SET logo=$1,logo_type=$2,logo_version=logo_version+1,updated_at=now() WHERE id=1',[image,mime]);
      await audit(c,'league','1','logo_update',{version:before.logo_version},{version:before.logo_version+1,type:mime,bytes:image.length},res.locals.auth.email);
    });res.json({ok:true});
  });
  app.get(['/api/admin/templates/players.csv','/api/admin/templates/stats.csv','/api/admin/roster.csv'],async(req,res)=>{
    const team=req.query.teamId===undefined?null:Number(req.query.teamId);
    if(team!==null&&(!Number.isInteger(team)||team<1||!(await pool.query('SELECT id FROM teams WHERE id=$1',[team])).rowCount))throw new InputError('Equipo no válido.');
    const players=(await pool.query(`SELECT p.id,p.name,t.name AS team,p.member,p.active,p.placeholder,s.stats FROM players p JOIN teams t ON t.id=p.team_id JOIN player_stats s ON s.player_id=p.id WHERE ($1::integer IS NULL OR p.team_id=$1) ORDER BY t.name,p.name,p.id`,[team])).rows;
    if(req.path.endsWith('roster.csv')) {
      csv(res,'lista-jugadores.csv',[['ID_JUGADOR','EQUIPO','NOMBRE','SOCIO'],...players.filter(p=>p.active&&!p.placeholder).map(p=>[p.id,p.team,p.name,p.member===null?'Sin registrar':p.member?'Sí':'No'])]);return;
    }
    const blank=req.query.blank==='1';
    if(req.path.endsWith('players.csv')) {
      csv(res,'plantilla-jugadores.csv',[['ID_JUGADOR','EQUIPO','NOMBRE','SOCIO','ACTIVO'],...(blank?[]:players.map(p=>[p.id,p.team,p.name,p.member===null?'':p.member?'Sí':'No',p.active?'Sí':'No']))]);return;
    }
    const round=req.query.round===undefined||req.query.round==='all'?null:Number(req.query.round);
    if(round!==null&&(!Number.isInteger(round)||round<1||round>30))throw new InputError('Jornada no válida.');
    const rows=(await pool.query('SELECT player_id,stats FROM round_stats WHERE round=$1',[round])).rows;
    const rounds=new Map(rows.map(row=>[row.player_id,row.stats]));
    const names={hits:'H',singles:'1B',doubles:'2B',triples:'3B'};
    csv(res,'plantilla-estadisticas.csv',[['ID_JUGADOR','EQUIPO','NOMBRE','JORNADA',...counts.map(k=>names[k as keyof typeof names]??k.toUpperCase())],...(blank?[]:players.filter(p=>p.active&&!p.placeholder).map(p=>{const stats=round===null?p.stats:rounds.get(p.id);return[p.id,p.team,p.name,round??'ACUMULADO',...counts.map(k=>stats[k])];}))]);
  });
}
