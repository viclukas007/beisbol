import fs from 'node:fs/promises';
import ExcelJS from 'exceljs';
import type {Express} from 'express';
import type {Pool,PoolClient} from 'pg';

// Tablas del torneo en orden de dependencias (llaves foráneas). Quedan fuera admin_users, admin_sessions,
// login_limits e import_batches: el respaldo no lleva contraseñas, sesiones ni vistas previas de cargas.
const tables=['import_sources','schedule_imports','teams','players','player_stats','round_stats','games','game_player_hits','league_settings','audit_log'];
const ident=(name:string)=>'"'+name.replace(/"/g,'""')+'"';
// Fecha y hora de Mérida para el nombre del archivo: 2026-11-19-1530.
const stamp=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Merida',dateStyle:'short',timeStyle:'short'}).format(new Date()).replace(' ','-').replace(':','');

// Lectura consistente: todas las tablas se leen del mismo instante aunque alguien capture mientras tanto.
async function consistent<T>(pool:Pool,action:(c:PoolClient)=>Promise<T>) {
  const c=await pool.connect();
  try {
    await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await c.query("SET LOCAL datestyle='ISO, YMD'");
    await c.query("SET LOCAL timezone='UTC'");
    await c.query("SET LOCAL bytea_output='hex'");
    const result=await action(c);
    await c.query('COMMIT');
    return result;
  }catch(error){await c.query('ROLLBACK').catch(()=>{});throw error;}
  finally{c.release();}
}

// Respaldo en SQL: el esquema (idempotente) y los datos del torneo. PostgreSQL escribe cada valor como texto
// entre comillas (quote_nullable) y al restaurar lo convierte al tipo de la columna, así que sirve para jsonb, fechas e imágenes.
async function sqlDump(c:PoolClient,schema:string) {
  const inserts:string[]=[],sequences:string[]=[],totals:Record<string,number>={};
  for(const table of tables) {
    const columns=(await c.query(`SELECT column_name AS name,is_identity='YES' AS identity FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1 AND is_generated='NEVER' ORDER BY ordinal_position`,[table])).rows as {name:string;identity:boolean}[];
    if(!columns.length)throw new Error(`La tabla ${table} no existe.`);
    const names=columns.map(column=>ident(column.name));
    const rows=(await c.query(`SELECT '('||concat_ws(',',${names.map(name=>`quote_nullable(${name}::text)`).join(',')})||')' AS line FROM ${ident(table)} ORDER BY ${names.slice(0,2).join(',')}`)).rows as {line:string}[];
    totals[table]=rows.length;
    const head=`INSERT INTO ${ident(table)} (${names.join(',')})${columns.some(column=>column.identity)?' OVERRIDING SYSTEM VALUE':''} VALUES`;
    for(let i=0;i<rows.length;i+=500)inserts.push(`${head}\n${rows.slice(i,i+500).map(row=>row.line).join(',\n')};`);
    for(const column of columns.filter(column=>column.identity))sequences.push(`SELECT setval(pg_get_serial_sequence('${table}','${column.name}'),COALESCE((SELECT max(${ident(column.name)}) FROM ${ident(table)}),1),EXISTS(SELECT 1 FROM ${ident(table)}));`);
  }
  const text=[
    '-- Diamante · respaldo de la base de datos del torneo',
    `-- Generado: ${new Date().toISOString()}`,
    `-- Filas: ${tables.map(table=>`${table} ${totals[table]}`).join(', ')}`,
    '-- No incluye cuentas de administración, sesiones ni vistas previas de cargas masivas.',
    '-- Restaurar reemplaza los datos del torneo de la base de destino (ver README, "Exportar y restaurar la base de datos"):',
    '--   psql -v ON_ERROR_STOP=1 -d BASE -f ESTE_ARCHIVO.sql',
    "SET client_encoding='UTF8';",
    'SET standard_conforming_strings=on;',
    'BEGIN;',
    '-- Esquema',
    schema.trim(),
    '-- Datos',
    `TRUNCATE ${[...tables].reverse().map(ident).join(',')};`,
    ...inserts,
    '-- Contadores de ID',
    ...sequences,
    "SELECT setval('roster_player_ids',GREATEST((SELECT COALESCE(max(id),1) FROM players),1),true);",
    'COMMIT;',
    '',
  ].join('\n');
  return {text,totals};
}

const statLabels={jj:'JJ',ab:'AB',hits:'H',singles:'1B',doubles:'2B',triples:'3B',hr:'HR',rbi:'RBI',avg:'AVG',ip:'IP',er:'ER',bb:'BB',k:'K',era:'ERA',w:'W',l:'L'};
const statKeys=Object.keys(statLabels) as (keyof typeof statLabels)[];
const statuses:Record<string,string>={scheduled:'Programado',postponed:'Pospuesto',completed:'Finalizado',cancelled:'Cancelado'};
const yesNo=(value:boolean)=>value?'Sí':'No';
// Excel admite 32,767 caracteres por celda.
const clip=(value:string|null)=>value&&value.length>32000?value.slice(0,32000)+'…':value;
const day=(value:string)=>{const [y,m,d]=value.split('-').map(Number);return new Date(Date.UTC(y,m-1,d));};

function addSheet(book:ExcelJS.Workbook,name:string,headers:string[],rows:unknown[][]) {
  const sheet=book.addWorksheet(name,{views:[{state:'frozen',ySplit:1}]});
  sheet.addRow(headers).font={bold:true};
  sheet.addRows(rows);
  headers.forEach((header,i)=>{
    let width=header.length;
    for(const row of rows.slice(0,2000)){const size=row[i] instanceof Date?10:String(row[i]??'').length;if(size>width)width=size;}
    sheet.getColumn(i+1).width=Math.min(width+2,60);
  });
  sheet.autoFilter={from:{row:1,column:1},to:{row:1,column:headers.length}};
  return sheet;
}

// Libro de Excel para consultar los datos: una hoja por tipo de registro, con nombres en lugar de IDs internos.
async function workbook(c:PoolClient) {
  const local=(column:string)=>`to_char(${column} AT TIME ZONE 'America/Merida','YYYY-MM-DD HH24:MI')`;
  const teams=(await c.query('SELECT id,name,color FROM teams ORDER BY id')).rows;
  const players=(await c.query(`SELECT p.id,t.name AS team,p.name,p.original_name,p.active,p.member,p.placeholder,s.stats FROM players p JOIN teams t ON t.id=p.team_id JOIN player_stats s ON s.player_id=p.id ORDER BY p.team_id,p.id`)).rows;
  const rounds=(await c.query(`SELECT p.id,t.name AS team,p.name,r.round,r.stats FROM round_stats r JOIN players p ON p.id=r.player_id JOIN teams t ON t.id=p.team_id ORDER BY p.team_id,p.id,r.round`)).rows;
  const games=(await c.query(`SELECT g.id,g.turn,g.round,to_char(g.date,'YYYY-MM-DD') AS date,to_char(g.time,'HH24:MI') AS time,h.name AS home,a.name AS away,g.status,g.home_score,g.away_score,g.home_hits,g.away_hits,g.home_errors,g.away_errors,g.notes,${local('g.deleted_at')} AS removed FROM games g JOIN teams h ON h.id=g.home_team_id JOIN teams a ON a.id=g.away_team_id ORDER BY g.date,g.time,g.id`)).rows;
  const hits=(await c.query(`SELECT h.game_id,to_char(g.date,'YYYY-MM-DD') AS date,g.round,t.name AS team,p.name,h.hits,${local('h.deleted_at')} AS removed FROM game_player_hits h JOIN games g ON g.id=h.game_id JOIN players p ON p.id=h.player_id JOIN teams t ON t.id=h.team_id ORDER BY g.date,h.game_id,t.name,p.name`)).rows;
  const changes=(await c.query(`SELECT ${local('created_at')} AS at,entity,entity_id,operation,responsible,before_data::text AS before,after_data::text AS after FROM audit_log ORDER BY id DESC`)).rows;
  const book=new ExcelJS.Workbook();
  book.creator='Diamante';book.created=new Date();
  const stats=statKeys.map(key=>statLabels[key]);
  // AVG con tres decimales y ERA con dos; el valor completo se conserva en la celda.
  const rates=(sheet:ExcelJS.Worksheet,first:number)=>{sheet.getColumn(first+statKeys.indexOf('avg')).numFmt='0.000';sheet.getColumn(first+statKeys.indexOf('era')).numFmt='0.00';};
  addSheet(book,'Equipos',['ID','Equipo','Color'],teams.map(t=>[t.id,t.name,t.color]));
  addSheet(book,'Jugadores',['ID','Equipo','Jugador','Nombre en el Excel','Activo','Socio','Espacio de plantilla'],players.map(p=>[p.id,p.team,p.name,p.original_name,yesNo(p.active),p.member===null?'Sin registrar':yesNo(p.member),yesNo(p.placeholder)]));
  rates(addSheet(book,'Acumulados',['ID','Equipo','Jugador',...stats],players.map(p=>[p.id,p.team,p.name,...statKeys.map(key=>p.stats[key])])),4);
  rates(addSheet(book,'Jornadas',['ID','Equipo','Jugador','Jornada',...stats],rounds.map(r=>[r.id,r.team,r.name,r.round,...statKeys.map(key=>r.stats[key])])),5);
  addSheet(book,'Rol de juegos',['ID','Vuelta','Jornada','Fecha','Hora','Local','Visitante','Estado','Carreras local','Carreras visitante','Hits local','Hits visitante','Errores local','Errores visitante','Observaciones','Retirado'],games.map(g=>[g.id,g.turn,g.round,day(g.date),g.time,g.home,g.away,statuses[g.status]??g.status,g.home_score,g.away_score,g.home_hits,g.away_hits,g.home_errors,g.away_errors,g.notes,g.removed])).getColumn(4).numFmt='dd/mm/yyyy';
  addSheet(book,'Hits por partido',['Juego','Fecha','Jornada','Equipo','Jugador','Hits','Retirado'],hits.map(h=>[h.game_id,day(h.date),h.round,h.team,h.name,h.hits,h.removed])).getColumn(2).numFmt='dd/mm/yyyy';
  addSheet(book,'Historial',['Fecha','Registro','ID','Movimiento','Responsable','Antes','Después'],changes.map(r=>[r.at,r.entity,r.entity_id,r.operation,r.responsible,clip(r.before),clip(r.after)]));
  const totals={teams:teams.length,players:players.length,rounds:rounds.length,games:games.length,hits:hits.length,changes:changes.length};
  return {buffer:Buffer.from(await book.xlsx.writeBuffer()),totals};
}

export function registerExport(app:Express,pool:Pool,schemaPath:string) {
  // Cada descarga queda en el historial con el correo de la sesión.
  const record=(format:string,detail:unknown,email:string)=>pool.query(`INSERT INTO audit_log(entity,entity_id,operation,after_data,responsible) VALUES('database',$1,'export',$2,$3)`,[format,JSON.stringify(detail),email]);
  const headers=(name:string,type:string)=>({'Content-Type':type,'Content-Disposition':`attachment; filename="${name}"`,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});
  app.get('/api/admin/export/database.sql',async(_req,res)=>{
    const schema=await fs.readFile(schemaPath,'utf8');
    const {text,totals}=await consistent(pool,c=>sqlDump(c,schema));
    await record('sql',totals,res.locals.auth.email);
    res.set(headers(`diamante-respaldo-${stamp()}.sql`,'application/sql; charset=utf-8')).send(Buffer.from(text,'utf8'));
  });
  app.get('/api/admin/export/database.xlsx',async(_req,res)=>{
    const {buffer,totals}=await consistent(pool,workbook);
    await record('xlsx',totals,res.locals.auth.email);
    res.set(headers(`diamante-datos-${stamp()}.xlsx`,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).send(buffer);
  });
}
