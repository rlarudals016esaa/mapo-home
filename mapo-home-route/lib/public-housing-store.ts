import {env} from "cloudflare:workers";
import {publicHousingSeed} from "./public-housing-seed";
import type {HousingFeed} from "./public-housing";
function database(){if(!env.DB)throw new Error("Housing storage unavailable");return env.DB;}
export async function readHousing(){
  const row=await database().prepare("SELECT revision,payload FROM public_housing WHERE id=?").bind("mapo").first<{revision:number;payload:string}>();
  return {revision:row?.revision??0,feed:row?JSON.parse(row.payload) as HousingFeed:structuredClone(publicHousingSeed)};
}
export async function writeHousing(feed:HousingFeed,revision:number){
  const payload=JSON.stringify(feed);
  if(payload.length>3000000)throw new Error("Housing storage size exceeded");
  const result=revision===0
    ?await database().prepare("INSERT OR IGNORE INTO public_housing(id,revision,payload) VALUES(?,1,?)").bind("mapo",payload).run()
    :await database().prepare("UPDATE public_housing SET payload=?,revision=revision+1 WHERE id=? AND revision=?").bind(payload,"mapo",revision).run();
  return result.meta.changes===1;
}
