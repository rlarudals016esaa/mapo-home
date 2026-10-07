// Server-only: secrets never enter a client component or API response.
import {env} from 'cloudflare:workers';
const settings=()=>env as unknown as Record<string,string>;
export const digest=async(text:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(x=>x.toString(16).padStart(2,'0')).join('');
async function mac(text:string){const secret=settings().MAPO_INTEGRATION_KEY;if(!secret)throw new Error('연동 인증이 설정되지 않았습니다.');const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(text)))).map(x=>x.toString(16).padStart(2,'0')).join('');}
const message=(method:string,url:URL,time:string,nonce:string,hash:string)=>[method,url.origin,url.pathname+url.search,time,nonce,hash].join('\n');
export async function signedFetch(path:string,method='GET',body=''){
 const cfg=settings();const base=new URL(cfg.MAPO_PEER_URL);if(base.protocol!=='https:'&&!(cfg.MAPO_LOCAL_TEST==='true'&&base.hostname==='127.0.0.1'))throw new Error('연동 주소를 확인해 주세요.');
 if(!cfg.MAPO_PEER_SERVICE_TOKEN)throw new Error('연동 접근 인증이 설정되지 않았습니다.');
 const url=new URL(path,base);if(url.origin!==base.origin)throw new Error('연동 주소가 일치하지 않습니다.');const time=String(Date.now()),nonce=crypto.randomUUID();
 const signature=await mac(message(method,url,time,nonce,await digest(body)));
 return fetch(url,{method,headers:{'OAI-Sites-Authorization':'Bearer '+cfg.MAPO_PEER_SERVICE_TOKEN,'X-Mapo-Time':time,'X-Mapo-Nonce':nonce,'X-Mapo-Signature':signature,'Content-Type':'application/json'},body:method==='GET'?undefined:body,redirect:'manual',signal:AbortSignal.timeout(15000)});
}
export async function verifyIntegration(req:Request,body=''){
 if(req.headers.has('origin'))return false;
 const time=req.headers.get('x-mapo-time')??'',nonce=req.headers.get('x-mapo-nonce')??'',signature=req.headers.get('x-mapo-signature')??'';
 if(!/^\d{13}$/.test(time)||Math.abs(Date.now()-Number(time))>300000||!/^[-a-zA-Z0-9]{20,80}$/.test(nonce)||! /^[a-f0-9]{64}$/.test(signature))return false;
 const expected=await mac(message(req.method,new URL(req.url),time,nonce,await digest(body)));let mismatch=0;for(let i=0;i<64;i++)mismatch|=expected.charCodeAt(i)^signature.charCodeAt(i);if(mismatch)return false;
 const db=env.DB!;await db.prepare('DELETE FROM integration_nonces WHERE expires_at < ?').bind(Date.now()).run();
 const result=await db.prepare('INSERT OR IGNORE INTO integration_nonces(id,expires_at) VALUES(?,?)').bind(nonce,Date.now()+600000).run();return result.meta.changes===1;
}
export const integrationConfigured=()=>!!(settings().MAPO_PEER_URL&&settings().MAPO_PEER_SERVICE_TOKEN&&settings().MAPO_INTEGRATION_KEY);
