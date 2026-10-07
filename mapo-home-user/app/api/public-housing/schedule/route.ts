import {z} from "zod";
import {readHousing,writeHousing} from "@/lib/public-housing-store";
export async function POST(request:Request){
  if(request.headers.get("origin")||request.headers.get("x-mapo-housing-update")!=="1")return Response.json({error:"지원되는 자동 갱신 요청만 허용됩니다."},{status:403});
  try{
    const raw=await request.text();if(raw.length>2000)return Response.json({error:"요청 크기 초과"},{status:413});
    const input=z.object({revision:z.number().int().nonnegative(),enabled:z.boolean(),automationId:z.string().min(1).max(200)}).strict().parse(JSON.parse(raw));
    const current=await readHousing();if(current.revision!==input.revision)return Response.json({error:"revision conflict"},{status:409});
    current.feed.schedule={enabled:input.enabled,time:"08:00",timezone:"Asia/Seoul",automationId:input.automationId};
    if(!await writeHousing(current.feed,current.revision))return Response.json({error:"revision conflict"},{status:409});
    return Response.json({revision:current.revision+1,schedule:current.feed.schedule});
  }catch{return Response.json({error:"자동 확인 설정을 저장하지 못했습니다."},{status:400});}
}
