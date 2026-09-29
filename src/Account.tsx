import {useState} from 'react';
import {Diamond,LockKeyhole,LogIn,Save} from 'lucide-react';
import {setCsrfToken,write} from './api';
export type AuthSession={user:{email:string}|null;csrfToken:string|null};
export function Login({onLogin}:{onLogin:(session:AuthSession)=>void}) {
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();setBusy(true);setError('');
    try{const session=await write<AuthSession>('/api/auth/login','POST',{email,password});setCsrfToken(session.csrfToken);setPassword('');onLogin(session);}
    catch(e){setError(e instanceof Error?e.message:'No se pudo iniciar sesión.');}finally{setBusy(false);}
  };
  return <main className="login-screen"><form className="login-card" onSubmit={submit}><a className="login-brand" href="/"><Diamond size={34}/><span>diamante</span></a><span className="eyebrow">ADMINISTRACIÓN DEL TORNEO</span><h1>Iniciar sesión</h1><p>Entra para administrar estadísticas, jugadores y juegos.</p><fieldset disabled={busy}><label htmlFor="login-email">Correo electrónico</label><input id="login-email" type="email" autoComplete="username" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/><label htmlFor="login-password">Contraseña</label><input id="login-password" type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></fieldset>{error&&<div className="form-error" role="alert">{error}</div>}<button className="primary-button" disabled={busy}><LogIn size={17}/>{busy?'Entrando…':'Entrar al backend'}</button><a className="login-back" href="/">← Volver al torneo</a></form></main>;
}
export function PasswordSettings({email}:{email:string}) {
  const [current,setCurrent]=useState('');
  const [password,setPassword]=useState('');
  const [confirm,setConfirm]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();setError('');setMessage('');
    if(password!==confirm){setError('La nueva contraseña y su confirmación no coinciden.');return;}
    setBusy(true);
    try{const session=await write<AuthSession>('/api/auth/password','PUT',{currentPassword:current,newPassword:password});setCsrfToken(session.csrfToken);setCurrent('');setPassword('');setConfirm('');setMessage('Contraseña actualizada. Las otras sesiones se cerraron.');}
    catch(e){setError(e instanceof Error?e.message:'No se pudo cambiar la contraseña.');}finally{setBusy(false);}
  };
  return <section className="panel account-settings"><div className="panel-heading"><div><h2><LockKeyhole size={20}/> Cambiar contraseña</h2><p>{email}</p></div></div><form onSubmit={submit}><fieldset disabled={busy}><label htmlFor="password-current">Contraseña actual</label><input id="password-current" type="password" autoComplete="current-password" required maxLength={128} value={current} onChange={e=>setCurrent(e.target.value)}/><label htmlFor="password-new">Nueva contraseña</label><input id="password-new" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/><label htmlFor="password-confirm">Confirmar nueva contraseña</label><input id="password-confirm" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={confirm} onChange={e=>setConfirm(e.target.value)}/><p className="admin-help">Usa al menos 8 caracteres. Al guardar se cerrarán las otras sesiones.</p></fieldset>{error&&<div className="form-error" role="alert">{error}</div>}{message&&<div className="form-success" role="status">{message}</div>}<div className="form-actions"><button className="primary-button" disabled={busy}><Save size={16}/>{busy?'Guardando…':'Cambiar contraseña'}</button></div></form></section>;
}
