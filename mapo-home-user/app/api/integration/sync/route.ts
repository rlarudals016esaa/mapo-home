import {verifyIntegration} from '@/lib/integration-auth';
import {refreshCatalog} from '@/lib/catalog';
export async function POST(req:Request){try{const raw=await req.text();if(raw.length>100||!await verifyIntegration(req,raw))return Response.json({error:'연동 인증 실패'},{status:403});const result=await refreshCatalog(true);return Response.json(result,{status:result.ok?200:503,headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'동기화하지 못했습니다. 기존 자료는 유지됩니다.'},{status:503});}}
