import {z} from "zod";
export const dongs=["공덕동","아현동","도화동","용강동","대흥동","염리동","신수동","서교동","합정동","망원동","연남동","성산동","상암동","상수동","하중동","당인동","노고산동","신정동","구수동","현석동","토정동","마포동","동교동","중동"];
const optionSchema=z.object({price:z.number().finite().min(0).max(10000000),rent:z.number().finite().min(0).max(100000)});
export const listingSchema=z.object({id:z.string().trim().min(1).max(100),district:z.literal("마포구"),dong:z.string().refine(v=>v==="동 정보 없음"||dongs.includes(v),"마포구 법정동 또는 동 정보 없음을 입력하세요"),name:z.string().trim().min(1).max(150),type:z.enum(["원룸","오피스텔"]),deal:z.enum(["전세","월세"]),price:z.number().finite().min(0).max(10000000),rent:z.number().finite().min(0).max(100000).default(0),area:z.number().finite().positive().max(10000),floor:z.string().max(30).default("층 정보 없음"),trackable:z.boolean().default(true),priceOptions:z.array(optionSchema).min(1).max(2).optional(),priceText:z.string().max(200).optional(),sourcePriceText:z.string().max(250).optional(),sourceSheet:z.string().max(100).optional(),sourceCollectedAt:z.string().datetime().optional(),sourceRow:z.number().int().positive().optional(),sourceFile:z.string().max(150).optional(),sourceDate:z.string().max(10).optional(),sourceUrl:z.string().url().refine(v=>/^https:\/\/fin\.land\.naver\.com\/articles\/\d+(?:[/?#]|$)/.test(v)).optional(),confirmedAt:z.string().max(80).optional(),management:z.string().max(80).optional(),walk:z.string().max(80).optional(),direction:z.string().max(40).optional(),description:z.string().max(2000).optional()}).superRefine((v,c)=>{if(v.id.startsWith("test:")&&(!/^test:[1-5]$/.test(v.id)||v.name!=="TEST "+v.id.slice(5)||!v.trackable||v.sourceUrl||!v.description?.includes("테스트용 가상 매물")))c.addIssue({code:"custom",message:"테스트 ID와 이름·가상 매물 표시를 확인하세요."});if(v.deal==="전세"&&(v.rent!==0||v.priceOptions?.some(x=>x.rent!==0)))c.addIssue({code:"custom",message:"전세의 월세는 0이어야 합니다"})});
export type Listing=z.infer<typeof listingSchema>&{previous?:number;previousRent?:number;previousComparable?:boolean;active:boolean;updated:string;history:{at:string;price:number;rent:number;priceText?:string}[]};
export const ruleSchema=z.object({
  deal:z.enum(["전세","월세"]),
  minPrice:z.number().finite().min(0).max(10000000).nullable().optional(),
  maxPrice:z.number().finite().min(0).max(10000000),
  minRent:z.number().finite().min(0).max(100000).nullable().optional(),
  maxRent:z.number().finite().min(0).max(100000).nullable(),
  minArea:z.number().finite().min(0).max(10000).nullable(),
  dongs:z.array(z.string().refine(v=>dongs.includes(v))).max(5).refine(v=>new Set(v).size===v.length),
  enabled:z.boolean(),
}).superRefine((r,c)=>{
  if(r.deal==="월세"&&r.maxRent===null)c.addIssue({code:"custom",path:["maxRent"],message:"월세 상한을 입력해 주세요."});
  if((r.minPrice??0)>r.maxPrice)c.addIssue({code:"custom",path:["minPrice"],message:"보증금 하한은 상한 이하여야 해요."});
  if(r.deal==="월세"&&r.maxRent!==null&&(r.minRent??0)>r.maxRent)c.addIssue({code:"custom",path:["minRent"],message:"월세 하한은 상한 이하여야 해요."});
});
export type Rule=z.infer<typeof ruleSchema>&{id:string};
export type Favorite={listingId:string;alertsEnabled:boolean;savedAt:string};
export type Notice={id:string;ruleId:string;listingId:string;listingIds?:string[];title:string;body:string;at:string;read:boolean;kind:"가격 인하"|"가격 조건 변경"|"신규 매물"|"조건 재진입";priority?:number};
export type State={schemaVersion:2;mode:"real";datasetId:string;catalogSequence?:number;sourceFile:string;sourceDate:string;listings:Listing[];rules:Rule[];favorites:Favorite[];nickname:string;legacyRuleCount?:number;legacyRules?:unknown[];notices:Notice[];runs:{at:string;source:string;added:number;changed:number;closed:number;alerts:number}[]};
export const money=(v:number)=>v>=10000?Number((v/10000).toFixed(4))+"억":v.toLocaleString()+"만";
export function priceLabel(l:Pick<Listing,"priceText"|"price"|"rent"|"deal">){return l.priceText??(l.deal+" "+money(l.price)+(l.deal==="월세"?" / "+money(l.rent):""))}
export function matches(l:Listing,r:Rule){return l.active&&l.deal===r.deal&&(!r.dongs.length||r.dongs.includes(l.dong))&&(l.priceOptions??[{price:l.price,rent:l.rent}]).some(p=>p.price>=(r.minPrice??0)&&p.price<=r.maxPrice&&(l.deal!=="월세"||(r.maxRent!==null&&p.rent>=(r.minRent??0)&&p.rent<=r.maxRent)))&&(r.minArea===null||l.area>=r.minArea)}
export function initial():State{return {schemaVersion:2,mode:"real",datasetId:"",sourceFile:"",sourceDate:"",listings:[],rules:[],favorites:[],nickname:"",notices:[],runs:[]}}
export function favoriteStatus(l:Listing,f:Favorite,r?:Rule){
  if(!l.active)return "확인되지 않음";
  if(!f.alertsEnabled)return "알림 꺼짐";
  if(!r)return "내 조건 설정 필요";
  if(!matches(l,r))return "조건 벗어남 · 알림 대기";
  if(!r.enabled)return "전체 알림 일시 중지";
  if(!l.trackable||(l.priceOptions?.length??0)>1)return "개별 가격 추적 불가";
  return "가격 알림 켜짐";
}
export function priceChange(l:Listing,prev?:Listing){
  const oldPrice=prev?.price??l.previous,oldRent=prev?.rent??l.previousRent;
  // Grouped price options do not identify which underlying room changed.
  if(!l.trackable||(!prev&&l.previousComparable===false)||(l.priceOptions?.length??0)>1||(prev?.priceOptions?.length??0)>1||oldPrice===undefined||prev&&l.deal!==prev.deal)return null;
  const dp=l.price-oldPrice,dr=l.rent-(oldRent??l.rent);
  const priority=l.deal==="전세"?(dp<0?2:0):dp<0&&dr<0?1:(dp<0&&dr===0)||(dp===0&&dr<0)?2:(dp<0&&dr>0)||(dp>0&&dr<0)?3:0;
  if(!priority)return null;
  return {priority,kind:priority===3?"가격 조건 변경" as const:"가격 인하" as const,oldPrice,oldRent:oldRent??0,dp,dr};
}
export function noticePath(n:Notice){return n.kind==="신규 매물"?"/?batch="+encodeURIComponent(n.id):"/?listing="+encodeURIComponent(n.listingId)}

// Called only after an operator has validated a complete, successful snapshot.
// This pure transition creates inbox events; sending push is a separate delivery step.
export function importSnapshot(s:State,rawRows:z.infer<typeof listingSchema>[],source:string,at:string,sourceDate:string):State{
  const rows=rawRows.map(x=>listingSchema.parse(x));
  if(!rows.length)throw new Error("빈 수집 결과는 정상 갱신으로 반영할 수 없습니다.");
  const ids=new Set(rows.map(x=>x.id));if(ids.size!==rows.length)throw new Error("중복 매물 ID가 있습니다.");
  const oldMap=new Map(s.listings.map(x=>[x.id,x]));const favorites=new Map(s.favorites.map(f=>[f.listingId,f]));
  const rule=s.rules[0];const notes:Notice[]=[];const freshMatches:Listing[]=[];let added=0,changed=0;
  const current=rows.map(row=>{
    const prev=oldMap.get(row.id),comparable=!!prev&&row.trackable&&prev.trackable;
    const changedPrice=comparable&&(prev.deal!==row.deal||JSON.stringify(prev.priceOptions??[{price:prev.price,rent:prev.rent}])!==JSON.stringify(row.priceOptions??[{price:row.price,rent:row.rent}]));
    if(!prev)added++;if(changedPrice)changed++;
    const l:Listing={...row,active:true,updated:at,previous:changedPrice?prev!.price:prev?.previous,previousRent:changedPrice?prev!.rent:prev?.previousRent,previousComparable:changedPrice?prev!.deal===row.deal&&(prev!.priceOptions?.length??0)<=1&&(row.priceOptions?.length??0)<=1:prev?.previousComparable,
      history:!prev?[{at,price:row.price,rent:row.rent,priceText:row.priceText}]:changedPrice?[...prev.history,{at,price:row.price,rent:row.rent,priceText:row.priceText}].slice(-90):prev.history};
    if(!rule?.enabled||!row.trackable||!matches(l,rule))return l;
    if(!prev&&s.listings.length)freshMatches.push(l);
    const f=favorites.get(l.id);
    if(!f?.alertsEnabled||!comparable)return l;
    // Missing alone is not condition exit. A return is evaluated against last known terms.
    const before=matches({...prev!,active:true},rule);
    const delta=changedPrice?priceChange(l,prev):null;
    const kind=!before?"조건 재진입" as const:delta?.kind;
    if(kind){
      const title=kind==="조건 재진입"?"관심 있는 방이 다시 조건에 맞아요!":l.name+(kind==="가격 조건 변경"?" 가격 조건이 바뀌었어요":" 가격이 내려갔어요");
      notes.push({id:[sourceDate,at,kind,l.id].join(":"),ruleId:rule.id,listingId:l.id,title,body:l.type+" · "+priceLabel(prev!)+" → "+priceLabel(l),at,read:false,kind,priority:delta?.priority??0});
    }
    return l;
  });
  if(freshMatches.length&&rule){const first=freshMatches[0];notes.push({id:[sourceDate,at,"new"].join(":"),ruleId:rule.id,listingId:first.id,listingIds:freshMatches.map(x=>x.id),title:s.nickname?"새로운 방이 "+s.nickname+"님을 기다립니다!":"새로운 방이 기다립니다!",body:`조건에 맞는 방 ${freshMatches.length}개 · ${first.type} · ${priceLabel(first)}${freshMatches.length>1?" 외":""}`,at,read:false,kind:"신규 매물"});}
  const existingIds=new Set(s.notices.map(n=>n.id));const unique=notes.filter(n=>!existingIds.has(n.id)).sort((a,b)=>(a.priority??4)-(b.priority??4));
  const missing=s.listings.filter(x=>!ids.has(x.id)&&(x.trackable||favorites.has(x.id))).map(x=>({...x,active:false}));
  const closed=s.listings.filter(x=>x.active&&!ids.has(x.id)).length;
  return {...s,sourceFile:source,sourceDate,listings:[...current,...missing],notices:[...unique,...s.notices].slice(0,1000),runs:[{at,source,added,changed,closed,alerts:unique.length},...s.runs].slice(0,90)};
}

