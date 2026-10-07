import {verifyIntegration} from '@/lib/integration-auth';
import {readHousing} from '@/lib/public-housing-store';
export async function GET(req:Request){try{if(!await verifyIntegration(req))return Response.json({error:'연동 인증 실패'},{status:403});return Response.json(await readHousing(),{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'공고 운영 정보를 읽지 못했습니다.'},{status:503});}}
