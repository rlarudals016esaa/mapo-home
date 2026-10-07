import {z} from "zod";
import {readHousing,writeHousing} from "@/lib/public-housing-store";
import {housingUpdateInput,mergeHousingFeed} from "@/lib/public-housing";
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{"Cache-Control":"no-store"}});
// This shared, non-user data writer is protected by the owner-private Sites
// dispatch boundary. Scheduled callers use OAI-Sites-Authorization; dispatch
// consumes it. Revisit authorization BEFORE widening the site's audience.
export async function POST(request:Request){
  if(request.headers.get("origin")||request.headers.get("x-mapo-housing-update")!=="1")return json({error:"지원되는 자동 갱신 요청만 허용됩니다."},403);
  if(!request.headers.get("content-type")?.includes("application/json"))return json({error:"JSON 요청이 필요합니다."},415);
  try{
    const raw=await request.text();if(raw.length>600000)return json({error:"요청 데이터가 너무 큽니다."},413);
    const input=housingUpdateInput.parse(JSON.parse(raw));
    const current=await readHousing();if(current.revision!==input.revision)return json({error:"공고 데이터가 변경되었습니다. 다시 읽고 갱신하세요."},409);
    const result=mergeHousingFeed(current.feed,input,new Date().toISOString());
    if(!await writeHousing(result.feed,current.revision))return json({error:"동시 갱신이 발생했습니다. 다시 읽고 갱신하세요."},409);
    return json({revision:current.revision+1,added:result.added,changed:result.changed,count:result.feed.notices.length,lastRunAt:result.feed.lastRunAt});
  }catch(e){return json({error:e instanceof z.ZodError?e.issues.map(i=>i.message).slice(0,4).join(" / "):"공고를 저장하지 못했습니다. 기존 데이터는 유지됩니다."},400);}
}
