import type {Listing} from "./model";

// The export mixes confirmation dates with registration dates. Do not call both registration.
export function originalDate(l:Pick<Listing,"confirmedAt">):string {
  const m=l.confirmedAt?.match(/^(?:확인매물|등록)\s+(\d{4})\.(\d{2})\.(\d{2})(?:\D|$)/);
  if(!m)return "";
  const key=`${m[1]}-${m[2]}-${m[3]}`;
  const date=new Date(key+"T00:00:00Z");
  return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===key?key:"";
}

export function originalDateLabel(l:Pick<Listing,"confirmedAt">):string {
  const day=originalDate(l);
  return day?(l.confirmedAt!.startsWith("등록")?"등록 ":"확인 ")+day:"원문 날짜 없음";
}

// A grouping aid, not proof that separate advertisements describe the same physical room.
export function similarityKey(l:Listing):string {
  const normalize=(v:string)=>v.normalize("NFKC").replace(/\s+/g," ").trim();
  const prices=[...(l.priceOptions??[{price:l.price,rent:l.rent}])].sort((a,b)=>a.price-b.price||a.rent-b.rent);
  return JSON.stringify([normalize(l.name),normalize(l.dong),l.type,l.deal,prices.map(p=>[p.price,p.rent]),l.area,normalize(l.floor)]);
}

export function newestWithSimilarTogether(listings:Listing[]):Listing[] {
  const entries=listings.map((l,index)=>({l,index,day:originalDate(l),key:similarityKey(l)}));
  const ranks=new Map<string,number>();
  for(const e of entries){const group=JSON.stringify([e.day,e.key]);const rank=e.l.sourceRow??e.index; ranks.set(group,Math.min(ranks.get(group)??Infinity,rank));}
  return entries.sort((a,b)=>b.day.localeCompare(a.day)
    ||ranks.get(JSON.stringify([a.day,a.key]))!-ranks.get(JSON.stringify([b.day,b.key]))!
    ||a.key.localeCompare(b.key)
    ||(a.l.sourceRow??a.index)-(b.l.sourceRow??b.index)
    ||a.index-b.index).map(e=>e.l);
}
