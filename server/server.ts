import express from 'express';
import pg from 'pg';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerWrites, gameColumns, InputError } from './writes.ts';
import {registerAuth,initializeAdmin} from './auth.ts';
import {registerImports} from './imports.ts';
import {registerLeague} from './league.ts';
import {registerGameHits} from './game-hits.ts';
import {syncSchedule} from './schedule-sync.ts';
import {syncStats} from './stats-sync.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 8 });
pool.on('error', error => console.error('PostgreSQL pool:', error.message));
const clients = new Set<express.Response>();

async function initialize() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(827419)');
    await client.query(await fs.readFile(path.join(root, 'server/schema.sql'), 'utf8'));
    await initializeAdmin(client);
    const seed = JSON.parse(await fs.readFile(path.join(root, 'data/seed.json'), 'utf8'));
    const existing = await client.query('SELECT id FROM import_sources WHERE id = 1');
    if (!existing.rowCount) {
      await client.query('INSERT INTO import_sources(id,filename,sha256,metadata) VALUES(1,$1,$2,$3)', [seed.source, seed.sha256, seed.metadata]);
      await client.query(`INSERT INTO teams SELECT id,name,color FROM jsonb_to_recordset($1::jsonb) AS x(id int,name text,color text)`, [JSON.stringify(seed.teams)]);
      await client.query(`INSERT INTO players SELECT id,"teamId",name,"originalName",placeholder,"sourceCell" FROM jsonb_to_recordset($1::jsonb) AS x(id int,"teamId" int,name text,"originalName" text,placeholder boolean,"sourceCell" text)`, [JSON.stringify(seed.players)]);
      await client.query(`INSERT INTO player_stats(player_id,stats) SELECT id,stats FROM jsonb_to_recordset($1::jsonb) AS x(id int,stats jsonb)`, [JSON.stringify(seed.players)]);
      await client.query(`INSERT INTO round_stats(player_id,round,stats,source_cell) SELECT "playerId",round,stats,"sourceCell" FROM jsonb_to_recordset($1::jsonb) AS x("playerId" int,round int,stats jsonb,"sourceCell" text)`, [JSON.stringify(seed.rounds)]);
      console.log(`Imported ${seed.players.length} roster slots, ${seed.teams.length} teams, ${seed.rounds.length} round rows.`);
    }
    // Cada versión del libro de estadísticas se aplica una sola vez, identificada por su huella SHA-256.
    if (!(await client.query('SELECT 1 FROM import_sources WHERE sha256=$1',[seed.sha256])).rowCount) {
      const summary = await syncStats(client, seed);
      await client.query('INSERT INTO import_sources(id,filename,sha256,metadata) VALUES((SELECT COALESCE(max(id),0)+1 FROM import_sources),$1,$2,$3)',[seed.source,seed.sha256,{...seed.metadata,sync:summary}]);
      console.log(`Statistics ${seed.source}: ${summary.playersCreated} players created, ${summary.playersRenamed} renamed, ${summary.statsUpdated} totals updated, ${summary.roundsUpdated} round rows updated, ${summary.unchanged} unchanged.`);
      for (const warning of summary.warnings) console.warn('Statistics:', warning);
    }
    // Cada versión del Excel del rol se aplica una sola vez, identificada por su huella SHA-256.
    const schedule = JSON.parse(await fs.readFile(path.join(root,'data/schedule.json'),'utf8'));
    if (!(await client.query('SELECT 1 FROM schedule_imports WHERE sha256=$1',[schedule.sha256])).rowCount) {
      const summary = await syncSchedule(client, schedule);
      await client.query('INSERT INTO schedule_imports(id,filename,sha256,metadata) VALUES((SELECT COALESCE(max(id),0)+1 FROM schedule_imports),$1,$2,$3)',[schedule.source,schedule.sha256,{...schedule.metadata,sync:summary}]);
      console.log(`Schedule ${schedule.source}: ${summary.inserted} games inserted, ${summary.updated} updated, ${summary.restored} restored, ${summary.removed} removed, ${summary.unchanged} unchanged.`);
      for (const warning of summary.warnings) console.warn('Schedule:', warning);
    }
    await client.query("SELECT setval('roster_player_ids',GREATEST((SELECT COALESCE(max(id),1) FROM players),(SELECT last_value FROM roster_player_ids)),true)");
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

const app = express();
app.disable('x-powered-by');
app.use(['/api/admin/imports/preview','/api/admin/league/logo'],express.json({limit:'16mb'}));
app.use(express.json({limit:'128kb'}));
app.use('/api', (req,res,next) => {
  if (['POST','PUT','PATCH','DELETE'].includes(req.method) && req.headers.origin) {
    try {
      const origin = new URL(req.headers.origin);
      const allowed = [req.get('host'), 'localhost:5173', '127.0.0.1:5173'];
      if (!allowed.includes(origin.host)) {res.status(403).json({error:'Origen de captura no permitido.'}); return;}
    } catch {res.status(403).json({error:'Origen no válido.'}); return;}
  }
  next();
});
registerAuth(app,pool);
registerWrites(app,pool);
registerImports(app,pool);
registerLeague(app,pool);
registerGameHits(app,pool);
app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok', database: 'postgresql' }); }
  catch { res.status(503).json({ status: 'unavailable' }); }
});
app.get('/api/ads', async (_req, res) => {
  const available = async (filename: string) => {
    try { const entry = await fs.stat(path.join(root, 'public/ads', filename)); return entry.isFile() ? `/ads/${filename}` : null; }
    catch { return null; }
  };
  const [desktopUrl, mobileUrl] = await Promise.all([available('banner-desktop.mp4'), available('banner-mobile.mp4')]);
  res.set('Cache-Control', 'no-store').json({ desktopUrl, mobileUrl });
});
app.get(['/api/snapshot','/api/admin/snapshot'], async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const source = await client.query('SELECT filename, metadata FROM import_sources ORDER BY id DESC LIMIT 1');
    const teams = await client.query('SELECT id,name,color FROM teams ORDER BY id');
    const players = await client.query(`SELECT p.id,p.name,p.original_name AS "originalName",p.team_id AS "teamId",p.placeholder,p.source_cell AS "sourceCell",p.active,p.member,p.version AS "rosterVersion",s.stats,s.version FROM players p JOIN player_stats s ON s.player_id=p.id ORDER BY p.id`);
    const rounds = await client.query(`SELECT player_id AS "playerId",round,stats,source_cell AS "sourceCell",version FROM round_stats ORDER BY player_id,round`);
    const schedule = await client.query('SELECT filename,metadata FROM schedule_imports ORDER BY id DESC LIMIT 1');
    const games = await client.query(`SELECT ${gameColumns} FROM games ORDER BY date,time,id`);
    const gameHits = (await client.query(`SELECT h.game_id AS "gameId",h.player_id AS "playerId",p.name,h.team_id AS "teamId",h.hits,h.version,h.deleted_at AS "deletedAt" FROM game_player_hits h JOIN players p ON p.id=h.player_id ORDER BY h.game_id,h.player_id`)).rows;
    const league = (await client.query(`SELECT name,logo_version AS version,logo IS NOT NULL AS "hasLogo",rules_notes AS "rulesNotes" FROM league_settings WHERE id=1`)).rows[0];
    await client.query('COMMIT');
    res.set('Cache-Control', 'no-store');
    const activePlayers=players.rows.filter(p=>p.active);
    const metadata = {...source.rows[0].metadata,namedPlayers:activePlayers.filter(p=>!p.placeholder).length,placeholderSlots:activePlayers.filter(p=>p.placeholder).length,rosterSlots:activePlayers.length,roundRows:rounds.rowCount,roundsWithActivity:[...new Set(rounds.rows.filter(r=>Object.entries(r.stats).some(([k,v])=>k!=='avg'&&k!=='era'&&Number(v)>0)).map(r=>r.round))].sort((a,b)=>a-b)};
    const isAdmin=req.path==='/api/admin/snapshot';
    const roster=isAdmin?players.rows:activePlayers.map(p=>({...p,member:null}));
    const ids=new Set(roster.map(p=>p.id));
    metadata.minimumAb=activePlayers.reduce((sum,p)=>sum+p.stats.ab,0)/Math.max(activePlayers.length,1);
    const visibleGames=isAdmin?games.rows:games.rows.filter(g=>!g.deletedAt);
    const gameIds=new Set(visibleGames.map(g=>g.id));
    const hitTotals=new Map<string,number>();for(const h of gameHits.filter(h=>!h.deletedAt)){const key=`${h.gameId}:${h.teamId}`;hitTotals.set(key,(hitTotals.get(key)??0)+h.hits);}
    res.json({ source: source.rows[0].filename, metadata, league:{...league,logoUrl:league.hasLogo?`/api/league/logo?v=${league.version}`:null}, teams: teams.rows, players:roster, rounds:isAdmin?rounds.rows:rounds.rows.filter(r=>ids.has(r.playerId)), schedule:{source:schedule.rows[0].filename,...schedule.rows[0].metadata},games:visibleGames.map(g=>({...g,homePlayerHits:hitTotals.get(`${g.id}:${g.homeTeamId}`)??null,awayPlayerHits:hitTotals.get(`${g.id}:${g.awayTeamId}`)??null})),gameHits:isAdmin?gameHits:gameHits.filter(h=>!h.deletedAt&&gameIds.has(h.gameId)), updatedAt: new Date().toISOString() });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Snapshot:', error);
    res.status(500).json({ error: 'No fue posible consultar las estadísticas.' });
  } finally { client.release(); }
});
app.get('/api/events', (req, res) => {
  if (!listener) { res.status(503).json({ error: 'Reconectando estadísticas' }); return; }
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  res.write('retry: 3000\n\n');
  clients.add(res);
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 25000);
  req.on('close', () => { clearInterval(heartbeat); clients.delete(res); });
});
app.use('/api', (_req, res) => { res.status(404).json({ error: 'Ruta no encontrada' }); });
app.use('/ads', express.static(path.join(root, 'public/ads'), { maxAge: 0, etag: true }));
app.use(express.static(path.join(root, 'dist'), { etag: true }));
app.get('/{*path}', (_req, res) => { res.sendFile(path.join(root, 'dist/index.html')); });
app.use((error: Error & {type?:string}, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof InputError) {res.status(error.status).json({error:error.message}); return;}
  if (error.type === 'entity.parse.failed') {res.status(400).json({error:'El cuerpo JSON no es válido.'}); return;}
  if (error.type === 'entity.too.large') {res.status(413).json({error:'La captura es demasiado grande.'}); return;}
  console.error(error.message); res.status(500).json({ error: 'No fue posible guardar o consultar los datos.' });
});

let listener: pg.Client | undefined;
let reconnecting = false;
let stopping = false;
async function listen() {
  if (reconnecting || stopping) return;
  reconnecting = true;
  const connection = new pg.Client({ connectionString: process.env.DATABASE_URL });
  let failed = false;
  const recover = () => {
    if (failed || stopping) return;
    failed = true;
    for (const response of clients) response.end();
    clients.clear();
    void connection.end().catch(() => {});
    listener = undefined;
    setTimeout(() => { void listen(); }, 3000);
  };
  connection.on('error', recover);
  connection.on('end', recover);
  try {
    await connection.connect();
    await connection.query('LISTEN stats_changed');
    listener = connection;
    connection.on('notification', () => {
      for (const response of clients) response.write(`event: stats\ndata: ${JSON.stringify({ updatedAt: new Date().toISOString() })}\n\n`);
    });
    console.log('Real-time statistics connected.');
  } catch (error) { console.error('Realtime reconnect:', (error as Error).message); recover(); }
  finally { reconnecting = false; }
}
await initialize();
await listen();
const server = app.listen(Number(process.env.PORT ?? 3080), '0.0.0.0', () => console.log('Diamante available on port 3080.'));
async function shutdown() {
  if (stopping) return;
  stopping = true;
  for (const response of clients) response.end();
  server.close();
  await listener?.end().catch(() => {});
  await pool.end();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
