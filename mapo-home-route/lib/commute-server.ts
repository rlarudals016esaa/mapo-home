import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';

export const commuteJSON=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export function commuteEnv(name:string){return String((env as unknown as Record<string,unknown>)[name]??'');}
export async function authorizeCommute(request:Request){
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)return commuteJSON({error:'요청 출처를 확인해 주세요.'},403);
  if(!await getChatGPTUser())return commuteJSON({error:'관심 매물 비교를 위해 로그인해 주세요.'},401);
  return null;
}
export async function commuteBody(request:Request,limit=30000){
  if(Number(request.headers.get('content-length')??0)>limit)throw new Error('body too large');
  const text=await request.text();if(text.length>limit)throw new Error('body too large');return JSON.parse(text);
}
