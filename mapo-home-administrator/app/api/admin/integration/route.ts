import {authorize} from '@/lib/server';
import {signedFetch} from '@/lib/integration-auth';
import {connectionStatus,notifyCustomerSite} from '@/lib/catalog-export';
const json=(x:unknown,status=200)=>Response.json(x,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(req:Request){if(!await authorize())return json({error:'운영자 권한이 필요합니다.'},403);try{const connection=await connectionStatus();if(new URL(req.url).searchParams.get('view')!=='housing')return json(connection);const r=await signedFetch('/api/integration/housing');if(!r.ok)throw new Error();return json(await r.json());}catch{return json({error:'연결 정보를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.'},503);}}
export async function POST(req:Request){if(!await authorize()||req.headers.get('origin')!==new URL(req.url).origin)return json({error:'운영자 요청을 확인할 수 없습니다.'},403);try{return json(await notifyCustomerSite());}catch{return json({error:'전달 상태를 저장하지 못했습니다. 다시 확인해 주세요.'},503);}}
