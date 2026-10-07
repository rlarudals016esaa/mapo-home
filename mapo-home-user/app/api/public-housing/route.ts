import {readHousing} from "@/lib/public-housing-store";
export async function GET(){
  try{const {revision,feed}=await readHousing();return Response.json({revision,feed:{notices:feed.notices}},{headers:{"Cache-Control":"no-store"}});}
  catch{return Response.json({error:"공고 정보를 불러오지 못했어요. 공식 사이트에서 확인해 주세요."},{status:503,headers:{"Cache-Control":"no-store"}});}
}
