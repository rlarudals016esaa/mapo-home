import raw from "@/data/2026-10-06.json";
import {initial,listingSchema,type State} from "./model";
export const BASELINE_ID="single-20261006-130231-v2";
export function baseline():State{const s=initial();const at="2026-10-06T04:02:31.000Z";return {...s,datasetId:BASELINE_ID,sourceFile:"SINGLE_20261006_130231.xlsx",sourceDate:"2026-10-06",listings:raw.map(x=>({...listingSchema.parse(x),sourceSheet:"Sheet1",sourceCollectedAt:at,active:true,updated:at,history:[{at,price:x.price,rent:x.rent,priceText:x.priceText}]})),runs:[{at,source:"10/6 13:02 수집 파일 · 교체 반영",added:raw.length,changed:0,closed:0,alerts:0}]}}
export function migrateState(previous:any):State{if(previous?.datasetId===BASELINE_ID)return previous;const next=baseline();next.rules=(previous?.rules??[]).filter((r:any)=>["전체","원룸","오피스텔"].includes(r.type)&&["전체","전세","월세"].includes(r.deal));return next}

