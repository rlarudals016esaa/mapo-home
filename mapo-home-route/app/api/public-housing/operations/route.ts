import {readHousing} from '@/lib/public-housing-store';
import {getChatGPTUser} from '@/app/chatgpt-auth';
// Existing updater uses the owner-private Sites service boundary. Keep its
// operational read separate from the browser response without changing its schedule.
export async function GET(req:Request){if(req.headers.has('origin')||req.headers.get('x-mapo-housing-update')!=='1'||await getChatGPTUser())return Response.json({error:'자동 갱신 전용 요청입니다.'},{status:403});try{return Response.json(await readHousing(),{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'공고 정보를 읽지 못했습니다.'},{status:503});}}
