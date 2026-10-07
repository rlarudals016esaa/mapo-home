import {verifyIntegration} from '@/lib/integration-auth';
import {nextSnapshot} from '@/lib/catalog-export';
export async function GET(req:Request){try{if(!await verifyIntegration(req))return Response.json({error:'연동 인증 실패'},{status:403});const after=Number(new URL(req.url).searchParams.get('after')??'-1');if(!Number.isSafeInteger(after)||after< -1)return Response.json({error:'잘못된 버전'},{status:400});return Response.json({snapshot:await nextSnapshot(after)},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'확정 자료를 불러오지 못했습니다.'},{status:503});}}
