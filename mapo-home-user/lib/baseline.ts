import raw from "@/data/2026-10-06.json";
import {initial,listingSchema,ruleSchema,type State} from "./model";
export const BASELINE_ID="single-20261006-130231-v2";
export function baseline():State{const s=initial();const at="2026-10-06T04:02:31.000Z";return {...s,datasetId:BASELINE_ID,sourceFile:"SINGLE_20261006_130231.xlsx",sourceDate:"2026-10-06",listings:raw.map(x=>({...listingSchema.parse(x),active:true,updated:at,history:[{at,price:x.price,rent:x.rent,priceText:x.priceText}]})),runs:[{at,source:"10/6 13:02 수집 파일 · 교체 반영",added:raw.length,changed:0,closed:0,alerts:0}]}}
export function migrateState(previous:any):State{
  const next=(previous?.datasetId===BASELINE_ID||previous?.schemaVersion===2&&Number.isInteger(previous?.catalogSequence))?{...previous}:baseline();
  if(previous?.schemaVersion===2)return {...next,favorites:previous.favorites??[],rules:previous.rules??[],nickname:previous.nickname??""};
  const legacy=previous?.rules??[];
  next.schemaVersion=2;next.favorites=[];next.nickname="";next.notices=[];
  next.legacyRules=legacy;next.legacyRuleCount=legacy.length;next.rules=[];
  // Preserve incompatible old conditions without choosing a deal type on the user's behalf.
  if(legacy.length===1){const old=legacy[0];const parsed=ruleSchema.safeParse({...old,dongs:old.dong==="전체"?[]:[old.dong],minArea:old.minArea||null,maxRent:old.deal==="전세"?null:old.maxRent});
    if(parsed.success&&old.type==="전체"&&old.maxPrice<10000000&&(old.deal==="전세"||old.maxRent<100000)){next.rules=[{...parsed.data,id:old.id}];next.legacyRuleCount=0;}}
  return next;
}

