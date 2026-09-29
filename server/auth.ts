import crypto from 'node:crypto';
import {promisify} from 'node:util';
import type {Express,Response} from 'express';
import type {Pool,PoolClient} from 'pg';
import {InputError} from './writes.ts';
const derive=promisify(crypto.scrypt);
const cookieName='diamante_session';
const lifetime=12*60*60*1000;
const digest=(token:string)=>crypto.createHash('sha256').update(token).digest('hex');
async function passwordHash(password:string) {
  const salt=crypto.randomBytes(16).toString('hex');
  const key=await derive(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024}) as Buffer;
  return `scrypt:${salt}:${key.toString('hex')}`;
}
async function verify(password:string,hash:string) {
  const [kind,salt,hex]=hash.split(':');
  if(kind!=='scrypt'||!salt||!hex||hex.length!==128)return false;
  const key=await derive(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024}) as Buffer;
  return crypto.timingSafeEqual(key,Buffer.from(hex,'hex'));
}
function validPassword(value:unknown):value is string {return typeof value==='string'&&value.length>=8&&value.length<=128;}
function sessionCookie(res:Response,token:string) {
  res.cookie(cookieName,token,{httpOnly:true,sameSite:'strict',secure:process.env.SECURE_COOKIE==='true',path:'/',maxAge:lifetime});
}
function clearCookie(res:Response) {res.clearCookie(cookieName,{httpOnly:true,sameSite:'strict',secure:process.env.SECURE_COOKIE==='true',path:'/'});}
async function createSession(c:Pool|PoolClient,userId:number) {
  const token=crypto.randomBytes(32).toString('hex');
  const csrfToken=crypto.randomBytes(32).toString('hex');
  await c.query('INSERT INTO admin_sessions(token_hash,user_id,csrf_token,expires_at) VALUES($1,$2,$3,$4)',[digest(token),userId,csrfToken,new Date(Date.now()+lifetime)]);
  return {token,csrfToken};
}
export async function initializeAdmin(c:PoolClient) {
  if((await c.query('SELECT id FROM admin_users LIMIT 1')).rowCount)return;
  const email=process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const hash=process.env.ADMIN_PASSWORD_HASH;
  if(!email||!hash||!/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(hash))throw new Error('Configura ADMIN_EMAIL y ADMIN_PASSWORD_HASH para crear el administrador.');
  await c.query('INSERT INTO admin_users(email,password_hash) VALUES($1,$2)',[email,hash]);
}
export function registerAuth(app:Express,pool:Pool) {
  app.use('/api',async(req,res,next)=>{
    res.set('Cache-Control','no-store');
    const token=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);
    if(token&&/^[a-f0-9]{64}$/.test(token)) {
      const row=(await pool.query('SELECT s.token_hash,s.csrf_token,u.id,u.email FROM admin_sessions s JOIN admin_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()',[digest(token)])).rows[0];
      if(row)res.locals.auth=row;else clearCookie(res);
    }
    next();
  });
  app.get('/api/auth/me',(_req,res)=>{
    const auth=res.locals.auth;
    res.json({user:auth?{email:auth.email}:null,csrfToken:auth?.csrf_token??null});
  });
  app.post('/api/auth/login',async(req,res)=>{
    const email=typeof req.body?.email==='string'?req.body.email.trim().toLowerCase():'';
    const password=req.body?.password;
    if(!email||email.length>254||!validPassword(password))throw new InputError('Correo o contraseña incorrectos.',401);
    const key=digest(req.ip??req.socket.remoteAddress??'local');
    const limit=(await pool.query(`INSERT INTO login_limits(key,attempts,expires_at) VALUES($1,1,now()+interval '15 minutes') ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN login_limits.expires_at<=now() THEN 1 ELSE login_limits.attempts+1 END,expires_at=CASE WHEN login_limits.expires_at<=now() THEN now()+interval '15 minutes' ELSE login_limits.expires_at END RETURNING attempts`,[key])).rows[0];
    if(limit.attempts>10)throw new InputError('Demasiados intentos. Intenta de nuevo en 15 minutos.',429);
    const user=(await pool.query('SELECT id,email,password_hash FROM admin_users WHERE email=$1',[email])).rows[0];
    const fallback=`scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`;
    const matches=await verify(password,user?.password_hash??fallback);
    if(!user||!matches)throw new InputError('Correo o contraseña incorrectos.',401);
    const c=await pool.connect();
    try {
      await c.query('BEGIN');
      const current=(await c.query('SELECT password_hash FROM admin_users WHERE id=$1 FOR UPDATE',[user.id])).rows[0];
      if(current.password_hash!==user.password_hash)throw new InputError('La contraseña cambió. Inicia sesión de nuevo.',401);
      await c.query('DELETE FROM admin_sessions WHERE expires_at<=now()');
      if(res.locals.auth)await c.query('DELETE FROM admin_sessions WHERE token_hash=$1',[res.locals.auth.token_hash]);
      const session=await createSession(c,user.id);
      await c.query('DELETE FROM login_limits WHERE key=$1',[key]);
      await c.query('COMMIT');
      sessionCookie(res,session.token);res.json({user:{email:user.email},csrfToken:session.csrfToken});
    }catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}
  });
  // Se protege la API, además de la pantalla de administración.
  app.use('/api',(req,res,next)=>{
    const needsAuth=['POST','PUT','PATCH','DELETE'].includes(req.method)||req.path==='/changes'||req.path.startsWith('/admin');
    if(needsAuth&&!res.locals.auth){res.status(401).json({error:'Inicia sesión para administrar el torneo.'});return;}
    if(['POST','PUT','PATCH','DELETE'].includes(req.method)) {
      if(req.get('X-CSRF-Token')!==res.locals.auth.csrf_token){res.status(403).json({error:'La sesión de captura no es válida. Recarga la página.'});return;}
      if(req.body&&typeof req.body==='object')req.body.responsible=res.locals.auth.email;
    }
    next();
  });
  app.post('/api/auth/logout',async(_req,res)=>{
    await pool.query('DELETE FROM admin_sessions WHERE token_hash=$1',[res.locals.auth.token_hash]);clearCookie(res);res.json({ok:true});
  });
  app.put('/api/auth/password',async(req,res)=>{
    const currentPassword=req.body?.currentPassword;
    const newPassword=req.body?.newPassword;
    if(!validPassword(currentPassword))throw new InputError('Indica tu contraseña actual.');
    if(!validPassword(newPassword))throw new InputError('La nueva contraseña debe tener entre 8 y 128 caracteres.');
    if(newPassword===currentPassword)throw new InputError('Elige una contraseña diferente de la actual.');
    const newHash=await passwordHash(newPassword);
    const c=await pool.connect();
    try {
      await c.query('BEGIN');
      const user=(await c.query('SELECT id,email,password_hash FROM admin_users WHERE id=$1 FOR UPDATE',[res.locals.auth.id])).rows[0];
      if(!user||!await verify(currentPassword,user.password_hash))throw new InputError('La contraseña actual es incorrecta.');
      // Una sesión revocada mientras esperaba el bloqueo no puede cambiar la clave.
      if(!(await c.query('SELECT token_hash FROM admin_sessions WHERE token_hash=$1 AND expires_at>now()',[res.locals.auth.token_hash])).rowCount)throw new InputError('La sesión terminó. Inicia sesión de nuevo.',401);
      await c.query('UPDATE admin_users SET password_hash=$2,updated_at=now() WHERE id=$1',[user.id,newHash]);
      await c.query('DELETE FROM admin_sessions WHERE user_id=$1',[user.id]);
      const session=await createSession(c,user.id);
      await c.query(`INSERT INTO audit_log(entity,entity_id,operation,responsible) VALUES('account',$1,'password_change',$2)`,[String(user.id),user.email]);
      await c.query('COMMIT');sessionCookie(res,session.token);res.json({user:{email:user.email},csrfToken:session.csrfToken});
    }catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}
  });
}
