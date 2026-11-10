import { useEffect, useRef, useState } from 'react';
import { Activity, ArrowDownToLine, ArrowRight, ChevronRight, CircleHelp, Database, Diamond, Menu, Shield, Trophy, Users, Wifi, RotateCw, CalendarDays, ClipboardEdit } from 'lucide-react';
import type { Snapshot } from './types';
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
import PublicApp from './public/PublicApp';
import {Login,PasswordSettings} from './Account';
import type {AuthSession} from './Account';
import {setCsrfToken,write} from './api';
import './admin.css';

// Páginas de administración. La vista pública vive en src/public/PublicApp.tsx.
type Page = 'Reglamento del torneo' | 'Rol de juegos' | 'Captura de estadísticas' | 'Plantillas' | 'Mi cuenta' | 'Tabla de posiciones' | 'Carga masiva' | 'Listas de jugadores' | 'Liga y reglamento' | 'Hits por partido';
const navigation = [{name:'Captura de estadísticas',icon:ClipboardEdit},{name:'Plantillas',icon:Users},{name:'Rol de juegos',icon:CalendarDays},{name:'Tabla de posiciones',icon:Trophy},{name:'Hits por partido',icon:Activity},{name:'Carga masiva',icon:ArrowDownToLine},{name:'Listas de jugadores',icon:Users},{name:'Liga y reglamento',icon:Shield},{name:'Reglamento del torneo',icon:Database},{name:'Mi cuenta',icon:Shield}] as const;
const headings: Record<Page, [string, string]> = {
  'Carga masiva': ['Actualiza datos desde Excel.', 'Carga jugadores y estadísticas con vista previa.'],
  'Liga y reglamento': ['La identidad y las reglas de tu liga.', 'Imagen, nombre y observaciones del reglamento.'],
  'Listas de jugadores': ['Plantillas listas para validar.', 'Listas por equipo para imprimir y descargar.'],
  'Tabla de posiciones': ['Así van los equipos.', 'Porcentaje de victorias y los criterios de desempate del reglamento.'],
  'Hits por partido': ['Cada hit, en su partido.', 'Consulta y captura hits individuales de cada juego.'],
  'Rol de juegos': ['El calendario del diamante.', 'Primera y segunda vuelta · Temporada 2026–2027.'],
  'Captura de estadísticas': ['Actualiza los números del juego.', 'Guarda bateo y pitcheo por jugador y jornada.'],
  'Plantillas': ['Administra a tus jugadores.', 'Altas, bajas y selección de socios por equipo.'],
  'Mi cuenta': ['Tu cuenta de administración.', 'Actualiza tu contraseña de acceso al backend.'],
  'Reglamento del torneo': ['Las reglas detrás del juego.', 'Origen de las estadísticas, mínimos de participación y fuente del torneo.'],
};
const format = (value: number) => new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(value);
const isAdminPath = () => window.location.pathname.startsWith('/admin');

export default function App() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [admin,setAdmin]=useState(isAdminPath);
  const [page, setPage] = useState<Page>('Captura de estadísticas');
  const [dirty,setDirty]=useState(false);
  const [splash,setSplash]=useState(true);
  useEffect(()=>{const timer=window.setTimeout(()=>setSplash(false),5000);return ()=>window.clearTimeout(timer);},[]);
  const [session,setSession]=useState<AuthSession|null>(null);
  const [authError,setAuthError]=useState('');
  const [authChecking,setAuthChecking]=useState(true);
  const [mobileMenu, setMobileMenu] = useState(false);
  const requestId = useRef(0);
  const load = async () => {
    const id = ++requestId.current;
    try {
      const response = await fetch(isAdminPath()?'/api/admin/snapshot':'/api/snapshot', { cache: 'no-store' });
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
  useEffect(()=>{const handler=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',handler);return ()=>window.removeEventListener('beforeunload',handler);},[dirty]);
  useEffect(()=>{const pop=()=>{setAdmin(isAdminPath());setPage('Captura de estadísticas');setDirty(false);void load();};window.addEventListener('popstate',pop);return ()=>window.removeEventListener('popstate',pop);},[]);

  const navigate = (next: Page) => { if(dirty&&next!==page&&!window.confirm('Hay cambios sin guardar. ¿Quieres descartarlos?'))return;setDirty(false);setPage(next); setMobileMenu(false); window.scrollTo({top:0}); };
  const switchArea=()=>{if(dirty&&!window.confirm('Hay cambios sin guardar. ¿Quieres descartarlos?'))return;const next=!admin;window.history.pushState({},'',next?'/admin':'/');setAdmin(next);setPage('Captura de estadísticas');setDirty(false);setMobileMenu(false);window.scrollTo({top:0});void load();};
  const logout=async()=>{if(dirty&&!window.confirm('Hay cambios sin guardar. ¿Quieres cerrar sesión y descartarlos?'))return;try{await write('/api/auth/logout','POST',{});setCsrfToken(null);setSession({user:null,csrfToken:null});setDirty(false);setData(null);}catch(e){setError(e instanceof Error?e.message:'No se pudo cerrar sesión.');}};

  // Pantalla de carga solo al abrir la página: se mantiene 5 segundos para que se vea la animación.
  if(splash)return <Loader message="Cargando las estadísticas del torneo…"/>;
  if(admin&&authChecking)return <div className="loading-screen"><Diamond size={48}/><p>Consultando sesión…</p></div>;
  if(admin&&authError)return <div className="loading-screen"><p role="alert">{authError}</p><button className="primary-button" onClick={()=>void loadSession()}>Reintentar</button></div>;
  if(admin&&!session?.user)return <Login onLogin={value=>{setSession(value);void load();}}/>;
  if (!data && !error) return <Loader message="Cargando las estadísticas del torneo…"/>;
  if (!data) return <div className="loading-screen"><Diamond size={48}/><h1>Diamante</h1><p>{error}</p><button className="primary-button" onClick={()=>void load()}>Volver a intentar</button></div>;
  if (!admin) return <PublicApp data={data} connected={connected} error={error} reload={()=>void load()} openAdmin={switchArea}/>;

  const teams = data.teams;
  // Mínimo de ERA: promedio de entradas lanzadas entre quienes han lanzado (no todos son pitchers).
  const pitchers = data.players.filter(p => p.active && p.stats.ip > 0);
  const minIP = pitchers.reduce((sum, p) => sum + p.stats.ip, 0) / Math.max(pitchers.length, 1);
  return <div className="app-shell">
    {mobileMenu && <button className="sidebar-backdrop" aria-label="Cerrar navegación" onClick={()=>setMobileMenu(false)}/>}
    <aside className={`sidebar ${mobileMenu?'open':''}`}><a href="#" className="brand" onClick={e=>{e.preventDefault();navigate('Captura de estadísticas');}}>{data.league.logoUrl?<img className="brand-logo" src={data.league.logoUrl} alt={data.league.name}/>:<><span className="brand-mark"><Diamond size={27} strokeWidth={1.5}/></span><span>diamante<span className="brand-sub">EL JUEGO EN NÚMEROS</span></span></>}</a><div className="sidebar-section">TORNEO DE SÓFTBOL</div><nav aria-label="Navegación principal">{navigation.map(item=><button key={item.name} className={page===item.name?'nav-item active':'nav-item'} onClick={()=>navigate(item.name)}><item.icon size={19}/><span>{item.name}</span>{page===item.name&&<span className="nav-dot"/>}</button>)}</nav><div className="sidebar-season"><div><small>FUENTE DEL TORNEO</small><strong>{data.league.name}</strong><p>{teams.length} equipos · {data.schedule.season}</p></div></div><div className="sidebar-bottom"><span className={`status-dot ${connected?'':'offline'}`}/><span>{connected?'Conexión en tiempo real':'Reconectando…'}</span><button className="icon-button light" aria-label="Datos y metodología" onClick={()=>navigate('Reglamento del torneo')}><CircleHelp size={17}/></button></div></aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-toggle" aria-label="Abrir navegación" onClick={()=>setMobileMenu(true)}><Menu size={22}/></button><span>Torneo</span><ChevronRight size={13}/><strong>{page}</strong></div><div className="topbar-right"><span className="live-pill"><span className={`status-dot ${connected?'':'offline'}`}/>{connected?'Sincronización activa':'Reconectando'}</span><span className="topbar-divider"/><span className="torneo-avatar">D</span></div></header>
    <main><div className="page-heading"><div><div className="eyebrow">ADMINISTRACIÓN DEL TORNEO</div><h1>{headings[page][0]}</h1><p>{headings[page][1]}</p></div><button className="refresh-button" aria-label="Actualizar estadísticas" onClick={()=>void load()}><RotateCw size={16}/><span>Actualizar</span></button></div>
    <button className="text-button area-switch" onClick={switchArea}>← Volver al torneo <ArrowRight size={14}/></button>
    <div className="account-strip"><span>{session?.user?.email}</span><button className="secondary-button" onClick={()=>void logout()}>Cerrar sesión</button></div>
    {error && <div className="error-banner" role="alert">{error} Se muestran los últimos datos disponibles. <button onClick={()=>void load()}>Reintentar</button></div>}
    {page==='Rol de juegos'&&<Schedule data={data} reload={load} editable/>}
    {page==='Captura de estadísticas'&&<Capture data={data} reload={load} onDirty={setDirty}/>}
    {page==='Plantillas'&&<Roster data={data} reload={load}/>}
    {page==='Tabla de posiciones'&&<Standings data={data} detailed reload={load}/>}
    {page==='Hits por partido'&&<GameHits data={data} reload={load} editable onDirty={setDirty}/>}
    {page==='Carga masiva'&&<BulkImport data={data} reload={load}/>}
    {page==='Listas de jugadores'&&<OfficialRoster data={data}/>}
    {page==='Liga y reglamento'&&<LeagueSettings data={data} reload={load} onDirty={setDirty}/>}
    {page==='Mi cuenta'&&session?.user&&<PasswordSettings email={session.user.email}/>}
    {page==='Reglamento del torneo' && data.league.rulesNotes && <section className="panel"><div className="panel-heading"><div><h2>Observaciones de la liga</h2></div></div><div className="panel-body"><p className="rules-text">{data.league.rulesNotes}</p></div></section>}
    {page==='Reglamento del torneo' && <div className="data-grid"><section className="panel data-card"><div className="data-icon"><Database size={25}/></div><h2>La fuente del torneo</h2><p className="source-filename">{data.source}</p><dl><div><dt>Equipos</dt><dd>16</dd></div><div><dt>Jugadores con nombre</dt><dd>{data.metadata.namedPlayers}</dd></div><div><dt>Espacios de plantilla</dt><dd>{data.metadata.placeholderSlots}</dd></div><div><dt>Filas de jornadas</dt><dd>{format(data.metadata.roundRows)}</dd></div><div><dt>Jornadas con actividad</dt><dd>{data.metadata.roundsWithActivity.join(', ')}</dd></div></dl><p className="source-note">Se conservan los valores acumulados de cada hoja de equipo. El archivo original permanece como referencia.</p></section><section className="panel data-card"><div className="data-icon"><CircleHelp size={25}/></div><h2>Cómo leer las estadísticas</h2><p>El archivo corresponde a un torneo de sóftbol.</p><dl><div><dt>AVG</dt><dd>HITS / AB</dd></div><div><dt>Mínimo para líder de AVG</dt><dd>{format(data.metadata.minimumAb)} AB → {Math.ceil(data.metadata.minimumAb)} AB</dd></div><div><dt>ERA</dt><dd>(ER × 7) / IP</dd></div><div><dt>Mínimo para líder de ERA</dt><dd>{minIP.toFixed(2)} IP (promedio de IP de {pitchers.length} que han lanzado)</dd></div></dl><p className="source-note">W y L son resultados individuales del pitcher. No representan la clasificación de los equipos. Las IP usan el valor numérico guardado en el Excel.</p></section><section className="panel data-card wide"><div className="connection-heading"><Wifi size={23}/><h2>Actualización de datos</h2><span className="live-pill"><span className={`status-dot ${connected?'':'offline'}`}/>{connected?'Conectado':'Reconectando'}</span></div><p>Los cambios guardados en PostgreSQL actualizan automáticamente esta pantalla. Los datos iniciales son históricos; no representan partidos en curso.</p><p>Última consulta: {new Date(data.updatedAt).toLocaleString('es-MX')}.</p>{data.metadata.masterDifferences.length>0&&<div className="source-observation">Observación de importación: el acumulado de Alejandro Millet difiere entre la hoja maestra y Bucaneros. Esta versión usa el resumen de Bucaneros, conservando ambos valores en los archivos de origen.</div>}</section></div>}
    {page==='Reglamento del torneo'&&<StatisticsRules data={data}/>}
    <footer className="main-footer"><span><Diamond size={14}/> Diamante <span className="footer-separator">/</span> El juego en números</span><span>Datos del Excel · Sóftbol · ERA de 7 entradas</span></footer>
    </main></div>
  </div>;
}
