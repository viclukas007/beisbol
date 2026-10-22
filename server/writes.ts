import type { Express } from 'express';
import type { Pool, PoolClient } from 'pg';
import type { Stats } from '../src/types.ts';

export const counts = ['jj','ab','hits','singles','doubles','triples','hr','rbi','ip','er','bb','k','w','l'] as const;
const batting = ['ab','hits','singles','doubles','triples','hr'] as const;
export class InputError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
function integer(value: unknown, label: string, max = 1000000) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > max) throw new InputError(`${label} no válido.`);
  return value;
}
function version(value: unknown, current: number) {
  integer(value, 'Versión');
  if (value !== current) throw new InputError('Este registro cambió en otra ventana. Carga la versión actual antes de guardar.', 409);
}
export function rates(stats: Stats): Stats {
  return { ...stats, avg: stats.ab ? stats.hits / stats.ab : 0, era: stats.ip ? stats.er * 7 / stats.ip : 0 };
}
export function validateStats(value: unknown, previous: Stats): Stats {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InputError('Faltan las estadísticas.');
  const stats = { ...previous };
  for (const key of counts) {
    const n = (value as Record<string, unknown>)[key];
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1000000 || (key !== 'ip' && !Number.isInteger(n)) || (key === 'ip' && Math.abs(n * 100 - Math.round(n * 100)) > 0.00001)) throw new InputError(`El campo ${key.toUpperCase()} requiere un número positivo o cero${key === 'ip' ? ' con hasta dos decimales' : ' entero'}.`);
    stats[key] = n;
  }
  // Las inconsistencias heredadas pueden conservarse al editar otras categorías.
  if (batting.some(key => stats[key] !== previous[key])) {
    if (stats.hits !== stats.singles + stats.doubles + stats.triples + stats.hr) throw new InputError('H debe ser igual a 1B + 2B + 3B + HR.');
    if (stats.hits > stats.ab) throw new InputError('Los hits no pueden superar los turnos al bat.');
  }
  return rates(stats);
}
export function same(a: Stats, b: Stats) { return counts.every(key => a[key] === b[key]); }
export async function audit(c: PoolClient, entity: string, id: string, operation: string, before: unknown, after: unknown, responsible: string) {
  await c.query('INSERT INTO audit_log(entity,entity_id,operation,before_data,after_data,responsible) VALUES($1,$2,$3,$4,$5,$6)', [entity,id,operation,before,after,responsible]);
}
function actor(body: any) {
  const value = body?.responsible ?? 'Captura local';
  if (typeof value !== 'string' || !value.trim() || value.length > 100) throw new InputError('Indica un responsable de hasta 100 caracteres.');
  return value.trim();
}
export async function transaction<T>(pool: Pool, action: (c: PoolClient) => Promise<T>) {
  const c = await pool.connect();
  try { await c.query('BEGIN'); const result = await action(c); await c.query('COMMIT'); return result; }
  catch (error) { await c.query('ROLLBACK'); throw error; }
  finally { c.release(); }
}
export const gameColumns = `id,turn,round,to_char(date,'YYYY-MM-DD') AS date,to_char(time,'HH24:MI') AS time,home_team_id AS "homeTeamId",away_team_id AS "awayTeamId",home_score AS "homeScore",away_score AS "awayScore",home_hits AS "homeHits",away_hits AS "awayHits",home_errors AS "homeErrors",away_errors AS "awayErrors",notes,status,source_cell AS "sourceCell",deleted_at AS "deletedAt",updated_at AS "updatedAt",version`;
const rosterColumns = `id,name,team_id AS "teamId",member,active,version`;
async function rosterValue(c:PoolClient,body:any) {
  if (typeof body?.name !== 'string' || !body.name.trim() || body.name.length>150) throw new InputError('Indica un nombre de hasta 150 caracteres.');
  const team = integer(body?.teamId,'Equipo');
  if (!(await c.query('SELECT id FROM teams WHERE id=$1',[team])).rowCount) throw new InputError('Equipo no encontrado.');
  if (body?.member !== null && typeof body?.member !== 'boolean') throw new InputError('Selecciona socio: sí, no o sin registrar.');
  return [body.name.trim(),team,body.member];
}
async function gameValue(c: PoolClient, body: any) {
  const turn = body?.turn ?? 1;
  if (![1,2].includes(turn)) throw new InputError('Selecciona la vuelta: primera o segunda.');
  const round = integer(body?.round, 'Jornada', 40);
  const home = integer(body?.homeTeamId, 'Equipo local');
  const away = integer(body?.awayTeamId, 'Equipo visitante');
  if (home === away) throw new InputError('Selecciona dos equipos distintos.');
  const teams = await c.query('SELECT id FROM teams WHERE id = ANY($1::integer[])', [[home,away]]);
  if (teams.rowCount !== 2) throw new InputError('Uno de los equipos no existe.');
  const date = body?.date;
  if (typeof date !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date) throw new InputError('La fecha no es válida.');
  const time = body?.time;
  if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new InputError('El horario debe usar HH:MM.');
  if (!['scheduled','postponed','completed','cancelled'].includes(body?.status)) throw new InputError('Estado de juego no válido.');
  if (typeof body?.notes !== 'string' || body.notes.length > 2000) throw new InputError('Las observaciones admiten hasta 2000 caracteres.');
  const homeScore=body.homeScore??null;
  const awayScore=body.awayScore??null;
  for(const score of [homeScore,awayScore])if(score!==null&&(typeof score!=='number'||!Number.isInteger(score)||score<0||score>9999))throw new InputError('Las carreras deben ser enteros entre 0 y 9999.');
  if((homeScore===null)!==(awayScore===null))throw new InputError('Captura los dos marcadores o deja ambos vacíos.');
  if(body.status==='completed'&&homeScore===null)throw new InputError('Para finalizar el juego, captura las carreras del local y del visitante.');
  if(body.status!=='completed'&&homeScore!==null)throw new InputError('Selecciona Finalizado para guardar el marcador final.');
  const detail=['homeHits','awayHits','homeErrors','awayErrors'].map(key=>body?.[key]??null);
  for(const value of detail)if(value!==null&&(typeof value!=='number'||!Number.isInteger(value)||value<0||value>9999))throw new InputError('Los hits y errores por equipo deben ser enteros entre 0 y 9999.');
  if(body.status!=='completed'&&detail.some(value=>value!==null))throw new InputError('Los hits y errores por equipo se capturan en juegos finalizados.');
  return [turn,round,date,time,home,away,body.notes.trim(),body.status,homeScore,awayScore,...detail];
}
export function registerWrites(app: Express, pool: Pool) {
  app.post('/api/players',async (req,res)=>{
    const responsible=actor(req.body);
    const result=await transaction(pool,async c=>{
      await c.query('SELECT pg_advisory_xact_lock(827419)');
      const values=await rosterValue(c,req.body);
      const saved=(await c.query(`INSERT INTO players(name,team_id,member,original_name,placeholder,source_cell) VALUES($1,$2,$3,$1,false,'Captura manual') RETURNING ${rosterColumns}`,values)).rows[0];
      const stats=Object.fromEntries([...counts,'avg','era'].map(k=>[k,0]));
      await c.query('INSERT INTO player_stats(player_id,stats) VALUES($1,$2)',[saved.id,stats]);
      await c.query(`INSERT INTO round_stats(player_id,round,stats,source_cell) SELECT $1,generate_series(1,30),$2::jsonb,'Captura manual'`,[saved.id,JSON.stringify(stats)]);
      await audit(c,'player',String(saved.id),'create',null,saved,responsible);
      return saved;
    });
    res.status(201).json(result);
  });
  app.put('/api/players/:id',async (req,res)=>{
    const id=integer(Number(req.params.id),'Jugador');
    const responsible=actor(req.body);
    const result=await transaction(pool,async c=>{
      const old=(await c.query(`SELECT ${rosterColumns} FROM players WHERE id=$1 FOR UPDATE`,[id])).rows[0];
      if(!old)throw new InputError('Jugador no encontrado.',404);
      version(req.body?.version,old.version);
      const values=await rosterValue(c,req.body);
      const saved=(await c.query(`UPDATE players SET name=$1,team_id=$2,member=$3,placeholder=false,version=version+1 WHERE id=$4 RETURNING ${rosterColumns}`,[...values,id])).rows[0];
      await audit(c,'player',String(id),'update',old,saved,responsible);
      return saved;
    });res.json(result);
  });
  for (const restore of [false,true]) {
    const handler=async(req:any,res:any)=>{
      const id=integer(Number(req.params.id),'Jugador');const responsible=actor(req.body);
      const result=await transaction(pool,async c=>{
        const old=(await c.query(`SELECT ${rosterColumns} FROM players WHERE id=$1 FOR UPDATE`,[id])).rows[0];
        if(!old)throw new InputError('Jugador no encontrado.',404);
        version(req.body?.version,old.version);
        if(old.active===restore)return old;
        const saved=(await c.query(`UPDATE players SET active=$2,version=version+1 WHERE id=$1 RETURNING ${rosterColumns}`,[id,restore])).rows[0];
        await audit(c,'player',String(id),restore?'restore':'remove',old,saved,responsible);return saved;
      });res.json(result);
    };
    if(restore)app.post('/api/players/:id/restore',handler);else app.delete('/api/players/:id',handler);
  }
  app.put('/api/players/:id/stats', async (req, res) => {
    const id = integer(Number(req.params.id), 'Jugador');
    const responsible = actor(req.body);
    const result = await transaction(pool, async c => {
      const row = (await c.query('SELECT stats,version FROM player_stats WHERE player_id=$1 FOR UPDATE', [id])).rows[0];
      if (!row) throw new InputError('Jugador no encontrado.',404);
      version(req.body?.version,row.version);
      const stats = validateStats(req.body?.stats,row.stats);
      if (same(stats,row.stats)) return { stats:row.stats, version:row.version, changed:false };
      const saved = (await c.query('UPDATE player_stats SET stats=$2,version=version+1 WHERE player_id=$1 RETURNING stats,version', [id,stats])).rows[0];
      await audit(c,'stats',String(id),'update',row,saved,responsible);
      return { ...saved, changed:true };
    });
    res.json(result);
  });
  app.put('/api/players/:id/rounds/:round', async (req, res) => {
    const id = integer(Number(req.params.id), 'Jugador');
    const round = integer(Number(req.params.round), 'Jornada',30);
    const responsible = actor(req.body);
    const result = await transaction(pool, async c => {
      // Todas las capturas de un jugador se serializan antes de aplicar diferencias.
      const accumulated = (await c.query('SELECT stats,version FROM player_stats WHERE player_id=$1 FOR UPDATE', [id])).rows[0];
      if (!accumulated) throw new InputError('Jugador no encontrado.',404);
      const row = (await c.query('SELECT stats,version FROM round_stats WHERE player_id=$1 AND round=$2 FOR UPDATE', [id,round])).rows[0];
      if (!row) throw new InputError('Jornada no encontrada.',404);
      version(req.body?.version,row.version);
      const stats = validateStats(req.body?.stats,row.stats);
      if (same(stats,row.stats)) return {stats:row.stats,version:row.version,changed:false};
      const total: Stats = {...accumulated.stats};
      for (const key of counts) {
        total[key] = Math.round((total[key] + stats[key] - row.stats[key]) * 100) / 100;
        if (total[key] < 0 || total[key] > 1000000) throw new InputError(`El cambio dejaría ${key.toUpperCase()} acumulado fuera de rango. Corrige primero el acumulado histórico.`);
      }
      const nextTotal = rates(total);
      const saved = (await c.query('UPDATE round_stats SET stats=$3,version=version+1 WHERE player_id=$1 AND round=$2 RETURNING stats,version', [id,round,stats])).rows[0];
      const savedTotal = (await c.query('UPDATE player_stats SET stats=$2,version=version+1 WHERE player_id=$1 RETURNING stats,version', [id,nextTotal])).rows[0];
      await audit(c,'round',`${id}:${round}`,'update',row,saved,responsible);
      await audit(c,'stats',String(id),'round_delta',accumulated,savedTotal,responsible);
      return {...saved,accumulated:savedTotal,changed:true};
    });
    res.json(result);
  });
  app.post('/api/games', async (req,res) => {
    const responsible = actor(req.body);
    const game = await transaction(pool, async c => {
      const values = await gameValue(c,req.body);
      const saved = (await c.query(`INSERT INTO games(turn,round,date,time,home_team_id,away_team_id,notes,status,home_score,away_score,home_hits,away_hits,home_errors,away_errors) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING ${gameColumns}`,values)).rows[0];
      await audit(c,'game',String(saved.id),'create',null,saved,responsible);
      return saved;
    });
    res.status(201).json(game);
  });
  app.put('/api/games/:id', async (req,res) => {
    const id = integer(Number(req.params.id),'Juego');
    const responsible = actor(req.body);
    const saved = await transaction(pool, async c => {
      const old = (await c.query(`SELECT ${gameColumns} FROM games WHERE id=$1 FOR UPDATE`,[id])).rows[0];
      if (!old) throw new InputError('Juego no encontrado.',404);
      if (old.deletedAt) throw new InputError('Restaura el juego antes de editarlo.',409);
      version(req.body?.version,old.version);
      const values = await gameValue(c,req.body);
      if((old.homeTeamId!==req.body.homeTeamId||old.awayTeamId!==req.body.awayTeamId||req.body.status!=='completed')&&(await c.query('SELECT 1 FROM game_player_hits WHERE game_id=$1 AND deleted_at IS NULL LIMIT 1',[id])).rowCount)throw new InputError('Retira las capturas de hits antes de cambiar los equipos o reabrir el juego.',409);
      const next = (await c.query(`UPDATE games SET turn=$1,round=$2,date=$3,time=$4,home_team_id=$5,away_team_id=$6,notes=$7,status=$8,home_score=$9,away_score=$10,home_hits=$11,away_hits=$12,home_errors=$13,away_errors=$14,version=version+1 WHERE id=$15 RETURNING ${gameColumns}`,[...values,id])).rows[0];
      await audit(c,'game',String(id),'update',old,next,responsible);
      return next;
    });
    res.json(saved);
  });
  for (const restore of [false,true]) {
    const route = restore ? '/api/games/:id/restore' : '/api/games/:id';
    const handler = async (req: any,res: any) => {
      const id = integer(Number(req.params.id),'Juego');
      const responsible = actor(req.body);
      const saved = await transaction(pool, async c => {
        const old = (await c.query(`SELECT ${gameColumns} FROM games WHERE id=$1 FOR UPDATE`,[id])).rows[0];
        if (!old) throw new InputError('Juego no encontrado.',404);
        version(req.body?.version,old.version);
        if (Boolean(old.deletedAt) === !restore) return old;
        const next = (await c.query(`UPDATE games SET deleted_at=${restore ? 'NULL' : 'now()'},version=version+1 WHERE id=$1 RETURNING ${gameColumns}`,[id])).rows[0];
        await audit(c,'game',String(id),restore?'restore':'remove',old,next,responsible);
        return next;
      });
      res.json(saved);
    };
    if (restore) app.post(route,handler); else app.delete(route,handler);
  }
  app.get('/api/changes', async (req,res) => {
    const entity = typeof req.query.entity === 'string' ? req.query.entity : null;
    const entityId = typeof req.query.entityId === 'string' ? req.query.entityId : null;
    const rows = await pool.query(`SELECT id::text,entity,entity_id AS "entityId",operation,before_data AS before,after_data AS after,responsible,created_at AS "createdAt" FROM audit_log WHERE ($1::text IS NULL OR entity=$1) AND ($2::text IS NULL OR entity_id=$2) ORDER BY id DESC LIMIT 100`,[entity,entityId]);
    res.set('Cache-Control','no-store').json(rows.rows);
  });
}
