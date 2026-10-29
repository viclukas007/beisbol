import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowDown, ArrowDownToLine, ArrowRight, ArrowUp, BarChart3, ChevronLeft, ChevronRight, CircleHelp, Database, Diamond, Menu, Search, Shield, Trophy, Users, X, Wifi, RotateCw, CalendarDays, ClipboardEdit } from 'lucide-react';
import type { Player, Snapshot, Stats, Team } from './types';
import AdBanner from './AdBanner';
import Capture from './Capture';
import Schedule from './Schedule';
import Roster from './Roster';
import BulkImport from './BulkImport';
import OfficialRoster from './OfficialRoster';
import LeagueSettings from './LeagueSettings';
import Standings from './Standings';
import StatisticsRules from './StatisticsRules';
import Loader from './Loader';
import GameHits from './GameHits';
import {Login,PasswordSettings} from './Account';
import type {AuthSession} from './Account';
import {setCsrfToken,write} from './api';
import './admin.css';

type Page = 'Estadísticas' | 'Equipos' | 'Reglamento del torneo' | 'Rol de juegos' | 'Captura de estadísticas' | 'Plantillas' | 'Mi cuenta' | 'Tabla de posiciones' | 'Carga masiva' | 'Listas de jugadores' | 'Liga y reglamento' | 'Hits por partido';
type Key = keyof Stats;
const publicNavigation = [{name:'Tabla de posiciones',icon:Trophy}, { name: 'Estadísticas', icon: BarChart3 }, { name: 'Equipos', icon: Shield }, { name: 'Rol de juegos', icon: CalendarDays }, { name: 'Reglamento del torneo', icon: Database }] as const;
const adminNavigation = [{name:'Captura de estadísticas',icon:ClipboardEdit},{name:'Plantillas',icon:Users},{name:'Rol de juegos',icon:CalendarDays},{name:'Tabla de posiciones',icon:Trophy},{name:'Hits por partido',icon:Activity},{name:'Carga masiva',icon:ArrowDownToLine},{name:'Listas de jugadores',icon:Users},{name:'Liga y reglamento',icon:Shield},{name:'Reglamento del torneo',icon:Database},{name:'Mi cuenta',icon:Shield}] as const;
const descriptions: Record<string, string> = { jj: 'Juegos jugados', ab: 'Turnos al bat', hits: 'Hits', singles: 'Sencillos', doubles: 'Dobles', triples: 'Triples', hr: 'Home runs', rbi: 'Carreras impulsadas', avg: 'Promedio de bateo', ip: 'Entradas lanzadas', er: 'Carreras limpias', bb: 'Bases por bola concedidas', k: 'Ponches', era: 'Efectividad sobre 7 entradas', w: 'Victorias del pitcher', l: 'Derrotas del pitcher' };
const labels: Record<string, string> = { jj: 'JJ', ab: 'AB', hits: 'H', singles: '1B', doubles: '2B', triples: '3B', hr: 'HR', rbi: 'RBI', avg: 'AVG', ip: 'IP', er: 'ER', bb: 'BB', k: 'K', era: 'ERA', w: 'W', l: 'L' };
const batting: Key[] = ['jj', 'ab', 'hits', 'singles', 'doubles', 'triples', 'hr', 'rbi', 'avg'];
const pitching: Key[] = ['ip', 'er', 'bb', 'k', 'era', 'w', 'l'];
const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const titleName = (text: string) => text.toLocaleLowerCase('es-MX').replace(/(^|\s)(\p{L})/gu, (_, space, letter) => space + letter.toLocaleUpperCase('es-MX'));
const initials = (text: string) => text.split(/\s+/).slice(0, 2).map(s => s[0]).join('');
const format = (value: number, key?: string) => key === 'avg' ? value.toFixed(3).replace(/^0/, '') : key === 'era' ? value.toFixed(2) : new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(value);
function Badge({ team, small = false }: { team: Team; small?: boolean }) { return <span className={`team-badge ${small ? 'small' : ''}`} style={{ '--team': team.color } as React.CSSProperties}>{team.name === 'NorthSide' ? 'NS' : team.name.slice(0, 2).toUpperCase()}</span>; }

export default function App() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [admin,setAdmin]=useState(()=>window.location.pathname.startsWith('/admin'));
  const [page, setPage] = useState<Page>(()=>window.location.pathname.startsWith('/admin')?'Captura de estadísticas':'Tabla de posiciones');
  const [dirty,setDirty]=useState(false);
  const [splash,setSplash]=useState(true);
  useEffect(()=>{const timer=window.setTimeout(()=>setSplash(false),5000);return ()=>window.clearTimeout(timer);},[]);
  const [session,setSession]=useState<AuthSession|null>(null);
  const [authError,setAuthError]=useState('');
  const [authChecking,setAuthChecking]=useState(true);
  const navigation=admin?adminNavigation:publicNavigation;
  const [teamId, setTeamId] = useState('all');
  const [round, setRound] = useState('all');
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'batting' | 'pitching'>('batting');
  const [sort, setSort] = useState<{ key: Key; asc: boolean }>({ key: 'avg', asc: false });
  const [tablePage, setTablePage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const requestId = useRef(0);
  const load = async () => {
    const id = ++requestId.current;
    try {
      const response = await fetch(window.location.pathname.startsWith('/admin')?'/api/admin/snapshot':'/api/snapshot', { cache: 'no-store' });
      if(response.status===401){if(id===requestId.current){setSession({user:null,csrfToken:null});setCsrfToken(null);}return;}
      if (!response.ok) throw new Error('No fue posible consultar las estadísticas.');
      const snapshot = await response.json();
      if (id === requestId.current) { setData(snapshot); setError(''); }
    } catch (err) { if (id === requestId.current) setError(err instanceof Error ? err.message : 'Error de conexión'); }
  };
  const loadSession=async()=>{
    setAuthChecking(true);setAuthError('');
    try{const response=await fetch('/api/auth/me',{cache:'no-store'});if(!response.ok)throw new Error('No se pudo consultar la sesión.');const value:AuthSession=await response.json();setSession(value);setCsrfToken(value.csrfToken);if(value.user)await load();}
    catch(e){setAuthError(e instanceof Error?e.message:'No se pudo conectar.');}
    finally{setAuthChecking(false);}
  };
  useEffect(()=>{
    void loadSession();
    const expired=()=>{setSession({user:null,csrfToken:null});setCsrfToken(null);};
    window.addEventListener('diamante-session-expired',expired);
    return ()=>window.removeEventListener('diamante-session-expired',expired);
  },[]);
  useEffect(() => {
    void load();
    const events = new EventSource('/api/events');
    events.onopen = () => { setConnected(true); void load(); };
    events.addEventListener('stats', () => { void load(); });
    events.onerror = () => setConnected(false);
    const fallback = window.setInterval(() => { void load(); }, 60000);
    return () => { events.close(); window.clearInterval(fallback); };
  }, []);
  useEffect(() => { setTablePage(0); }, [search, teamId, round, mode, sort]);
  useEffect(()=>{const handler=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',handler);return ()=>window.removeEventListener('beforeunload',handler);},[dirty]);
  useEffect(()=>{const pop=()=>{const area=window.location.pathname.startsWith('/admin');setAdmin(area);setPage(area?'Captura de estadísticas':'Tabla de posiciones');setDirty(false);void load();};window.addEventListener('popstate',pop);return ()=>window.removeEventListener('popstate',pop);},[]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (selectedId !== null && dialog && !dialog.open) dialog.showModal();
    if (selectedId === null && dialog?.open) dialog.close();
  }, [selectedId]);
  const teams = data?.teams ?? [];
  const teamMap = useMemo(() => new Map(teams.map(t => [t.id, t])), [teams]);
  const pool = useMemo(() => {
    if (!data) return [];
    if (round === 'all') return data.players.filter(p=>p.active);
    const roundMap = new Map(data.rounds.filter(r => r.round === Number(round)).map(r => [r.playerId, r.stats]));
    return data.players.filter(p=>p.active).map(p => ({ ...p, stats: roundMap.get(p.id) ?? p.stats }));
  }, [data, round]);
  const visible = useMemo(() => pool.filter(p => !p.placeholder && (teamId === 'all' || p.teamId === Number(teamId))), [pool, teamId]);
  const minAB = pool.reduce((sum, p) => sum + p.stats.ab, 0) / Math.max(pool.length, 1);
  const filtered = useMemo(() => visible.filter(p => (!search || normalize(p.name + ' ' + teamMap.get(p.teamId)?.name).includes(normalize(search))) && (mode === 'batting' ? p.stats.ab >= minAB : p.stats.ip >= (data?.metadata.minimumIp ?? 4))).sort((a,b) => (a.stats[sort.key] - b.stats[sort.key]) * (sort.asc ? 1 : -1) || a.name.localeCompare(b.name, 'es')), [visible, search, teamMap, mode, minAB, data, sort]);
  const total = (key: Key, players = visible) => players.reduce((sum, p) => sum + p.stats[key], 0);
  const leaders = (key: Key) => {
    const eligible=visible.filter(p => !p.placeholder && (!search || normalize(p.name + ' ' + teamMap.get(p.teamId)?.name).includes(normalize(search))) && (key === 'avg' ? p.stats.ab >= minAB && p.stats.ab > 0 : key === 'era' ? p.stats.ip >= (data?.metadata.minimumIp ?? 4) : p.stats[key] > 0)).sort((a,b) => (a.stats[key] - b.stats[key]) * (key === 'era' ? 1 : -1) || a.name.localeCompare(b.name, 'es'));
    return eligible.filter((p,i)=>i<5||p.stats[key]===eligible[4]?.stats[key]);
  };
  const selected = data?.players.find(p => p.id === selectedId);
  const columns = mode === 'batting' ? batting : pitching;
  const navigate = (next: Page) => { if(dirty&&next!==page&&!window.confirm('Hay cambios sin guardar. ¿Quieres descartarlos?'))return;setDirty(false);setPage(next); setSearch(''); setMobileMenu(false); window.scrollTo({top:0}); };
  const switchArea=()=>{if(dirty&&!window.confirm('Hay cambios sin guardar. ¿Quieres descartarlos?'))return;const next=!admin;window.history.pushState({},'',next?'/admin':'/');setAdmin(next);setPage(next?'Captura de estadísticas':'Tabla de posiciones');setDirty(false);setMobileMenu(false);void load();};
  const logout=async()=>{if(dirty&&!window.confirm('Hay cambios sin guardar. ¿Quieres cerrar sesión y descartarlos?'))return;try{await write('/api/auth/logout','POST',{});setCsrfToken(null);setSession({user:null,csrfToken:null});setDirty(false);setData(null);}catch(e){setError(e instanceof Error?e.message:'No se pudo cerrar sesión.');}};
  const selectTeam = (id: number) => { setTeamId(String(id)); navigate('Estadísticas'); };
  const changeMode = (next: 'batting' | 'pitching') => { setMode(next); setSort({ key: next === 'batting' ? 'avg' : 'era', asc: next === 'pitching' }); };
  const exportCSV = () => {
    const quote = (s: string | number) => `"${(typeof s==='string'&&/^[\s]*[=+\-@]/.test(s)?"'"+s:String(s)).replace(/"/g, '""')}"`;
    const csv = [['Jugador', 'Equipo', ...columns.map(k=>labels[k])], ...filtered.map(p=>[p.name, teamMap.get(p.teamId)?.name ?? '', ...columns.map(k=>p.stats[k])])].map(row=>row.map(quote).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = `estadisticas-${mode}-${round}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  function Table({ compact = false }: { compact?: boolean }) {
    const limit = compact ? 6 : 20;
    const rows = filtered.slice(compact ? 0 : tablePage * limit, compact ? limit : (tablePage + 1) * limit);
    const pages = Math.max(1, Math.ceil(filtered.length / limit));
    return <section className="panel table-panel">
      <div className="panel-heading"><div><h2>{mode === 'batting' ? 'Estadísticas de bateo' : 'Estadísticas de pitcheo'}</h2><p>{compact ? 'Conoce el rendimiento de los jugadores del torneo.' : `${filtered.length} registros · ${round === 'all' ? 'Acumulado del torneo' : `Jornada ${round}`}`}</p></div>{compact && <button className="text-button" onClick={()=>navigate('Estadísticas')}>Ver todos <ArrowRight size={15}/></button>}{!compact && <button className="secondary-button" onClick={exportCSV}><ArrowDownToLine size={15}/> Exportar CSV</button>}</div>
      <div className="table-tools"><div className="segmented"><button className={mode==='batting'?'active':''} onClick={()=>changeMode('batting')}>Bateo</button><button className={mode==='pitching'?'active':''} onClick={()=>changeMode('pitching')}>Pitcheo</button></div></div>
      <div className="table-scroll"><table><thead><tr><th className="rank-column">#</th><th>Jugador / equipo</th>{columns.map(key=><th key={key} className={sort.key===key?'sorted':''}><button title={descriptions[key]} onClick={()=>setSort({key,asc:sort.key===key?!sort.asc:key==='era'})}>{labels[key]}{sort.key===key?(sort.asc?<ArrowUp size={12}/>:<ArrowDown size={12}/>):null}</button></th>)}<th aria-label="Ficha"/></tr></thead><tbody>{rows.map((p,i)=><tr key={p.id} onClick={()=>setSelectedId(p.id)}><td className="muted">{(compact?0:tablePage*limit)+i+1}</td><td><button className="player-cell" onClick={()=>setSelectedId(p.id)}><span className="avatar" style={{background:teamMap.get(p.teamId)?.color+'16',color:teamMap.get(p.teamId)?.color}}>{initials(p.name)}</span><span><strong>{titleName(p.name)}</strong><small>{teamMap.get(p.teamId)?.name}{p.placeholder?' · Espacio de plantilla':''}</small></span></button></td>{columns.map(key=><td key={key} className={sort.key===key?'stat-emphasis':''}>{format(p.stats[key],key)}</td>)}<td><button className="icon-button" aria-label={`Ver ficha de ${p.name}`}><ChevronRight size={16}/></button></td></tr>)}</tbody></table>{!rows.length && <div className="empty"><Search size={25}/><h3>No encontramos jugadores</h3><p>Cambia la búsqueda o el equipo. Solo aparecen jugadores con el mínimo de participación ({mode==='batting' ? `${Math.ceil(minAB)} AB` : '4 IP'}).</p><button className="secondary-button" onClick={()=>{setSearch('');setTeamId('all');}}>Limpiar filtros</button></div>}</div>
      <div className="table-footer"><span>{compact ? 'AVG = hits / turnos al bat' : `Mostrando ${filtered.length ? tablePage*limit+1 : 0}–${Math.min((tablePage+1)*limit,filtered.length)} de ${filtered.length}`}<span className="footer-note"> · Toca un jugador para ver su ficha</span></span>{!compact && <div className="pagination"><button className="icon-button" aria-label="Página anterior" disabled={tablePage===0} onClick={()=>setTablePage(p=>p-1)}><ChevronLeft size={17}/></button><span>{tablePage+1} / {pages}</span><button className="icon-button" aria-label="Página siguiente" disabled={tablePage>=pages-1} onClick={()=>setTablePage(p=>p+1)}><ChevronRight size={17}/></button></div>}</div>
    </section>;
  }
  // Pantalla de carga solo al abrir la página: se mantiene 5 segundos para que se vea la animación.
  if(splash)return <Loader message="Cargando las estadísticas del torneo…"/>;
  if(admin&&authChecking)return <div className="loading-screen"><Diamond size={48}/><p>Consultando sesión…</p></div>;
  if(admin&&authError)return <div className="loading-screen"><p role="alert">{authError}</p><button className="primary-button" onClick={()=>void loadSession()}>Reintentar</button></div>;
  if(admin&&!session?.user)return <Login onLogin={value=>{setSession(value);void load();}}/>;
  if (!data && !error) return <Loader message="Cargando las estadísticas del torneo…"/>;
  if (!data) return <div className="loading-screen"><Diamond size={48}/><h1>Diamante</h1><p>{error}</p><button className="primary-button" onClick={()=>void load()}>Volver a intentar</button></div>;
  const playerRounds = selected ? data.rounds.filter(r=>r.playerId===selected.id && (r.stats.ab>0||r.stats.ip>0||r.stats.jj>0)) : [];
  // Rival de la jornada según el rol: la jornada de estadísticas se empareja con la jornada del calendario del equipo actual del jugador.
  const rivalOf = (round:number) => {
    if (!selected) return '—';
    const games = data.games.filter(g=>!g.deletedAt && g.round===round && (g.homeTeamId===selected.teamId || g.awayTeamId===selected.teamId));
    if (games.length !== 1) return games.length ? 'Varios' : '—';
    const game = games[0], home = game.homeTeamId===selected.teamId;
    const rival = teamMap.get(home ? game.awayTeamId : game.homeTeamId)?.name ?? '—';
    const score = game.status==='completed' && game.homeScore!==null && game.awayScore!==null ? ` ${home ? game.homeScore : game.awayScore}–${home ? game.awayScore : game.homeScore}` : '';
    return <>{rival}{score && <small className="cell-detail">{score.trim()}</small>}</>;
  };
  return <div className="app-shell">
    {mobileMenu && <button className="sidebar-backdrop" aria-label="Cerrar navegación" onClick={()=>setMobileMenu(false)}/>}
    <aside className={`sidebar ${mobileMenu?'open':''}`}><a href="#" className="brand" onClick={e=>{e.preventDefault();navigate(admin?'Captura de estadísticas':'Tabla de posiciones');}}>{data.league.logoUrl?<img className="brand-logo" src={data.league.logoUrl} alt={data.league.name}/>:<><span className="brand-mark"><Diamond size={27} strokeWidth={1.5}/></span><span>diamante<span className="brand-sub">EL JUEGO EN NÚMEROS</span></span></>}</a><div className="sidebar-section">TORNEO DE SÓFTBOL</div><nav aria-label="Navegación principal">{navigation.map(item=><button key={item.name} className={page===item.name?'nav-item active':'nav-item'} onClick={()=>navigate(item.name)}><item.icon size={19}/><span>{item.name}</span>{page===item.name&&<span className="nav-dot"/>}</button>)}</nav><div className="sidebar-season"><div><small>FUENTE DEL TORNEO</small><strong>{data.league.name}</strong><p>{teams.length} equipos · {data.schedule.season}</p></div></div><div className="sidebar-bottom"><span className={`status-dot ${connected?'':'offline'}`}/><span>{connected?'Conexión en tiempo real':'Reconectando…'}</span><button className="icon-button light" aria-label="Datos y metodología" onClick={()=>navigate('Reglamento del torneo')}><CircleHelp size={17}/></button></div></aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-toggle" aria-label="Abrir navegación" onClick={()=>setMobileMenu(true)}><Menu size={22}/></button><span>Torneo</span><ChevronRight size={13}/><strong>{page}</strong></div><div className="topbar-right"><span className="live-pill"><span className={`status-dot ${connected?'':'offline'}`}/>{connected?'Sincronización activa':'Reconectando'}</span><span className="topbar-divider"/><span className="torneo-avatar">D</span></div></header>
    <main><div className="page-heading"><div><div className="eyebrow">{admin?'ADMINISTRACIÓN DEL TORNEO':'ESTADÍSTICAS DEL TORNEO'}</div><h1>{page==='Carga masiva'?'Actualiza datos desde Excel.':page==='Liga y reglamento'?'La identidad y las reglas de tu liga.':page==='Listas de jugadores'?'Plantillas listas para validar.':page==='Tabla de posiciones'?'Así van los equipos.':page==='Hits por partido'?'Cada hit, en su partido.':page==='Estadísticas'?'Quienes marcan la diferencia.':page==='Equipos'?'Los equipos del diamante.':page==='Rol de juegos'?'El calendario del diamante.':page==='Captura de estadísticas'?'Actualiza los números del juego.':page==='Plantillas'?'Administra a tus jugadores.':page==='Mi cuenta'?'Tu cuenta de administración.':'Las reglas detrás del juego.'}</h1><p>{page==='Carga masiva'?'Carga jugadores y estadísticas con vista previa.':page==='Liga y reglamento'?'Imagen, nombre y observaciones del reglamento.':page==='Listas de jugadores'?'Listas por equipo para imprimir y descargar.':page==='Tabla de posiciones'?'Porcentaje de victorias y los criterios de desempate del reglamento.':page==='Hits por partido'?'Consulta y captura hits individuales de cada juego.':page==='Estadísticas'?'Los líderes del torneo y el rendimiento individual en bateo y pitcheo.':page==='Equipos'?'Conoce las plantillas y el rendimiento de los 16 equipos.':page==='Rol de juegos'?'Primera y segunda vuelta · Temporada 2026–2027.':page==='Captura de estadísticas'?'Guarda bateo y pitcheo por jugador y jornada.':page==='Plantillas'?'Altas, bajas y selección de socios por equipo.':page==='Mi cuenta'?'Actualiza tu contraseña de acceso al backend.':'Origen de las estadísticas, mínimos de participación y fuente del torneo.'}</p></div><button className="refresh-button" aria-label="Actualizar estadísticas" onClick={()=>void load()}><RotateCw size={16}/><span>Actualizar</span></button></div>
    {!admin&&['Estadísticas','Equipos','Rol de juegos','Tabla de posiciones'].includes(page)&&<AdBanner/>}
    <button className="text-button area-switch" onClick={switchArea}>{admin?'← Volver al torneo':'Abrir administración'} <ArrowRight size={14}/></button>
    {admin&&<div className="account-strip"><span>{session?.user?.email}</span><button className="secondary-button" onClick={()=>void logout()}>Cerrar sesión</button></div>}
    {error && <div className="error-banner" role="alert">{error} Se muestran los últimos datos disponibles. <button onClick={()=>void load()}>Reintentar</button></div>}
    {['Estadísticas','Equipos'].includes(page) && <div className="filter-bar"><label><Shield size={16}/><select aria-label="Filtrar por equipo" value={teamId} onChange={e=>setTeamId(e.target.value)}><option value="all">Todos los equipos</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label><Activity size={16}/><select aria-label="Filtrar por jornada" value={round} onChange={e=>setRound(e.target.value)}><option value="all">Acumulado del torneo</option>{Array.from({length:30},(_,i)=><option key={i+1} value={i+1}>Jornada {i+1}{data.metadata.roundsWithActivity.includes(i+1)?'':' · sin actividad'}</option>)}</select></label><div className="filter-spacer"/><label className="search-input"><Search size={17}/><input aria-label="Buscar jugador o equipo" placeholder="Buscar jugador o equipo…" value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button className="icon-button" aria-label="Limpiar búsqueda" onClick={()=>setSearch('')}><X size={14}/></button>}</label></div>}
    {page==='Estadísticas' && <><div className="section-heading"><div><h2>Líderes del torneo <span className="tiny-badge">TOP 5</span></h2><p>Los cinco mejores y quienes empaten en cada categoría.</p></div></div><div className="method-note"><Trophy size={17}/><span>AVG: mínimo {Math.ceil(minAB)} AB. ERA: mínimo 4 IP y cálculo sobre 7 entradas. Los empates comparten posición e incluyen a quienes empaten con el quinto. Sin desempate individual oficial confirmado.</span></div><div className="honor-grid">{(['hits','hr','rbi','avg','k','era','w'] as Key[]).map(key=><section key={key} className="panel honor-card"><div className="honor-heading"><h2>{descriptions[key]}</h2><span>{labels[key]}</span></div>{leaders(key).map(p=><button key={p.id} className={`honor-row ${p.stats[key]===leaders(key)[0]?.stats[key]?'first':''}`} onClick={()=>setSelectedId(p.id)}><span className="honor-rank">{String(leaders(key).findIndex(other=>other.stats[key]===p.stats[key])+1).padStart(2,'0')}</span><div><strong>{titleName(p.name)}</strong><small>{teamMap.get(p.teamId)?.name}</small></div><b>{format(p.stats[key],key)}</b></button>)}{!leaders(key).length&&<div className="empty"><p>Sin jugadores elegibles para esta selección.</p></div>}</section>)}</div><div className="section-heading"><div><h2>Todos los jugadores</h2><p>Bateo y pitcheo con el mínimo de participación.</p></div></div><Table/></>}
    {page==='Rol de juegos'&&<Schedule key={admin?'admin':'public'} data={data} reload={load} editable={admin}/>}
    {admin&&page==='Captura de estadísticas'&&<Capture data={data} reload={load} onDirty={setDirty}/>}
    {admin&&page==='Plantillas'&&<Roster data={data} reload={load}/>}
    {page==='Tabla de posiciones'&&<Standings data={data} detailed={admin}/>}
    {admin&&page==='Hits por partido'&&<GameHits data={data} reload={load} editable={admin} onDirty={setDirty}/>}
    {admin&&page==='Carga masiva'&&<BulkImport data={data} reload={load}/>}
    {admin&&page==='Listas de jugadores'&&<OfficialRoster data={data}/>}
    {admin&&page==='Liga y reglamento'&&<LeagueSettings data={data} reload={load} onDirty={setDirty}/>}
    {admin&&page==='Mi cuenta'&&session?.user&&<PasswordSettings email={session.user.email}/>}
    {page==='Equipos' && <div className="teams-grid">{teams.filter(t=>(teamId==='all'||t.id===Number(teamId))&&(!search||normalize(t.name).includes(normalize(search)))).map(t=>{const roster=pool.filter(p=>p.teamId===t.id&&!p.placeholder);const ab=total('ab',roster);return <button key={t.id} className="team-card panel" onClick={()=>selectTeam(t.id)}><div className="team-card-top"><Badge team={t}/><ArrowRight size={18}/></div><h2>{t.name}</h2><p>{roster.length} jugadores en la plantilla</p><div className="team-card-stats"><div><strong>{total('hits',roster)}</strong><small>HITS</small></div><div><strong>{total('hr',roster)}</strong><small>HR</small></div><div><strong>{format(ab?total('hits',roster)/ab:0,'avg')}</strong><small>AVG</small></div></div><span className="team-card-footer">Ver plantilla y estadísticas <ChevronRight size={15}/></span></button>;})}</div>}
    {page==='Reglamento del torneo' && data.league.rulesNotes && <section className="panel"><div className="panel-heading"><div><h2>Observaciones de la liga</h2></div></div><div className="panel-body"><p className="rules-text">{data.league.rulesNotes}</p></div></section>}
    {page==='Reglamento del torneo' && <div className="data-grid"><section className="panel data-card"><div className="data-icon"><Database size={25}/></div><h2>La fuente del torneo</h2><p className="source-filename">{data.source}</p><dl><div><dt>Equipos</dt><dd>16</dd></div><div><dt>Jugadores con nombre</dt><dd>{data.metadata.namedPlayers}</dd></div><div><dt>Espacios de plantilla</dt><dd>{data.metadata.placeholderSlots}</dd></div><div><dt>Filas de jornadas</dt><dd>{format(data.metadata.roundRows)}</dd></div><div><dt>Jornadas con actividad</dt><dd>{data.metadata.roundsWithActivity.join(', ')}</dd></div></dl><p className="source-note">Se conservan los valores acumulados de cada hoja de equipo. El archivo original permanece como referencia.</p></section><section className="panel data-card"><div className="data-icon"><CircleHelp size={25}/></div><h2>Cómo leer las estadísticas</h2><p>El archivo corresponde a un torneo de sóftbol.</p><dl><div><dt>AVG</dt><dd>HITS / AB</dd></div><div><dt>Mínimo para líder de AVG</dt><dd>{format(data.metadata.minimumAb)} AB → {Math.ceil(data.metadata.minimumAb)} AB</dd></div><div><dt>ERA</dt><dd>(ER × 7) / IP</dd></div><div><dt>Mínimo para líder de ERA</dt><dd>4 IP</dd></div></dl><p className="source-note">W y L son resultados individuales del pitcher. No representan la clasificación de los equipos. Las IP usan el valor numérico guardado en el Excel.</p></section><section className="panel data-card wide"><div className="connection-heading"><Wifi size={23}/><h2>Actualización de datos</h2><span className="live-pill"><span className={`status-dot ${connected?'':'offline'}`}/>{connected?'Conectado':'Reconectando'}</span></div><p>Los cambios guardados en PostgreSQL actualizan automáticamente esta pantalla. Los datos iniciales son históricos; no representan partidos en curso.</p><p>Última consulta: {new Date(data.updatedAt).toLocaleString('es-MX')}.</p>{data.metadata.masterDifferences.length>0&&<div className="source-observation">Observación de importación: el acumulado de Alejandro Millet difiere entre la hoja maestra y Bucaneros. Esta versión usa el resumen de Bucaneros, conservando ambos valores en los archivos de origen.</div>}</section></div>}
    {page==='Equipos'&&!teams.some(t=>(teamId==='all'||t.id===Number(teamId))&&(!search||normalize(t.name).includes(normalize(search))))&&<div className="empty panel"><h3>No hay equipos para esta búsqueda</h3><button className="secondary-button" onClick={()=>setSearch('')}>Limpiar búsqueda</button></div>}
    {page==='Reglamento del torneo'&&<StatisticsRules data={data}/>}
    {!admin&&page==='Reglamento del torneo' && <AdBanner/>}
    <footer className="main-footer"><span><Diamond size={14}/> Diamante <span className="footer-separator">/</span> El juego en números</span><span>Datos del Excel · Sóftbol · ERA de 7 entradas</span></footer>
    </main></div>
    <dialog ref={dialogRef} className="player-dialog" onClose={()=>setSelectedId(null)} onClick={e=>{if(e.target===e.currentTarget)setSelectedId(null);}}>{selected&&<><div className="dialog-header"><span>FICHA DEL JUGADOR</span><button className="icon-button" aria-label="Cerrar ficha" onClick={()=>setSelectedId(null)}><X size={21}/></button></div><div className="profile-heading"><Badge team={teamMap.get(selected.teamId)!}/><div><h2>{titleName(selected.name)}</h2><p>{teamMap.get(selected.teamId)?.name} · Acumulado del torneo</p></div></div><div className="profile-featured">{(['avg','hits','hr','rbi'] as Key[]).map(key=><div key={key}><strong>{format(selected.stats[key],key)}</strong><span>{descriptions[key]}</span></div>)}</div><h3>Estadísticas acumuladas</h3><div className="profile-stats">{[...batting.filter(k=>!['avg','hits','hr','rbi'].includes(k)),...pitching].map(key=><div key={key}><span title={descriptions[key]}>{labels[key]}</span><strong>{format(selected.stats[key],key)}</strong></div>)}</div>{admin&&<><h3>Hits por partido</h3><div className="table-scroll"><table className="round-table"><thead><tr><th>Partido</th><th>Equipo</th><th>H</th></tr></thead><tbody>{data.gameHits.filter(h=>h.playerId===selected.id&&!h.deletedAt&&data.games.some(g=>g.id===h.gameId&&!g.deletedAt)).map(h=>{const game=data.games.find(g=>g.id===h.gameId)!;return <tr key={h.gameId}><td>{game.date} · {teamMap.get(game.homeTeamId)?.name} vs. {teamMap.get(game.awayTeamId)?.name}</td><td>{teamMap.get(h.teamId)?.name}</td><td>{h.hits}</td></tr>;})}</tbody></table>{!data.gameHits.some(h=>h.playerId===selected.id&&!h.deletedAt&&data.games.some(g=>g.id===h.gameId&&!g.deletedAt))&&<p className="admin-empty">Sin hits capturados por partido.</p>}</div></>}<h3>Jornadas con actividad</h3>{playerRounds.length?<div className="table-scroll"><table className="round-table"><thead><tr><th>Jornada</th><th title="Según el rol de juegos de esa jornada">Rival</th>{(['ab','hits','hr','rbi','avg','ip','k'] as Key[]).map(key=><th key={key}>{labels[key]}</th>)}</tr></thead><tbody>{playerRounds.map(r=><tr key={r.round}><td>{r.round}</td><td>{rivalOf(r.round)}</td>{(['ab','hits','hr','rbi','avg','ip','k'] as Key[]).map(key=><td key={key}>{format(r.stats[key],key)}</td>)}</tr>)}</tbody></table></div>:<p className="source-note">Sin actividad registrada por jornada.</p>}<div className="profile-source"><Database size={14}/><span>Origen: {selected.sourceCell}. El acumulado y las jornadas se importaron por separado.</span></div></>}</dialog>
  </div>;
}
