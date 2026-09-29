let csrfToken:string|null=null;
export function setCsrfToken(value:string|null){csrfToken=value;}
export async function write<T>(url:string,method:string,body:unknown):Promise<T> {
  const res = await fetch(url,{method,headers:{'Content-Type':'application/json',...(csrfToken?{'X-CSRF-Token':csrfToken}:{})},body:JSON.stringify(body)});
  const result = await res.json();
  if(res.status===401&&url!=='/api/auth/login'){csrfToken=null;window.dispatchEvent(new Event('diamante-session-expired'));}
  if (!res.ok) throw new Error(result.error || 'No fue posible guardar.');
  return result;
}
