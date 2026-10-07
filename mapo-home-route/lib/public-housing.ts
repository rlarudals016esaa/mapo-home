import {z} from "zod";

export const housingSources = [
  {id:"youth",name:"서울시 청년안심주택",url:"https://soco.seoul.go.kr/youth/bbs/BMSR00015/list.do?menuNo=400008",guide:"지역구에서 마포구를 선택한 뒤 검색하세요. 공공·민간임대 공고를 함께 볼 수 있어요."},
  {id:"sh",name:"SH 주택임대 공고",url:"https://www.i-sh.co.kr/app/lay2/program/S48T561C563/www/brd/m_247/list.do?multi_itm_seq=2",guide:"검색 기준을 ‘내용’으로 바꾸고 ‘마포’를 검색하세요. 첨부 주택목록의 주소도 확인해 주세요."},
  {id:"lh",name:"LH 청약플러스",url:"https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancList.do?mi=1026",guide:"서울특별시를 선택하고 공고의 공급주택 목록에서 마포구를 확인하세요. 전국 단위 전세임대는 전국에서도 찾아보세요."},
] as const;
export type HousingProvider=typeof housingSources[number]["id"];
const provider=z.enum(["youth","sh","lh"]);
const iso=z.string().datetime({offset:true});
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s);
export function housingId(source:HousingProvider,url:string){
  try {
    const u=new URL(url);
    const allowed={youth:"soco.seoul.go.kr",sh:"www.i-sh.co.kr",lh:"apply.lh.or.kr"};
    if(u.protocol!=="https:"||u.hostname!==allowed[source]||u.username||u.password||u.port)return null;
    const key=source==="youth"?"boardId":source==="sh"?"seq":"panId";
    const id=u.searchParams.get(key);
    if(!id||!/^\d+$/.test(id))return null;
    if(source==="youth"&&!u.pathname.includes("/BMSR00015/view.do"))return null;
    if(source==="sh"&&!u.pathname.endsWith("/view.do"))return null;
    if(source==="lh"&&!u.pathname.endsWith("/selectWrtancInfo.do"))return null;
    return source+":"+id;
  }catch{return null;}
}
export const housingNoticeInput=z.object({
  source:provider,title:z.string().trim().min(4).max(250),url:z.string().url().max(2000),
  publishedAt:day,address:z.string().trim().min(2).max(300),
  mapoEvidence:z.string().trim().min(4).max(1000).refine(s=>s.includes("마포"),"마포구 공급 근거가 필요합니다."),
  category:z.string().trim().min(2).max(60),summary:z.string().trim().min(4).max(800),
  applicationStart:iso.nullable(),applicationEnd:iso.nullable(),
  applicationLabel:z.string().trim().min(2).max(250),
  eligibility:z.string().trim().min(2).max(500),
  withdrawn:z.boolean().default(false),
}).strict().superRefine((n,ctx)=>{
  if(!housingId(n.source,n.url))ctx.addIssue({code:"custom",message:"공식 공고 상세 링크가 필요합니다."});
  if(n.applicationStart&&n.applicationEnd&&Date.parse(n.applicationStart)>Date.parse(n.applicationEnd))ctx.addIssue({code:"custom",message:"접수 기간을 확인하세요."});
});
export type HousingNoticeInput=z.infer<typeof housingNoticeInput>;
export type HousingNotice=HousingNoticeInput&{id:string;firstSeenAt:string;verifiedAt:string;updatedAt:string};
export const sourceCheckInput=z.object({source:provider,status:z.enum(["ok","partial","error"]),message:z.string().trim().min(2).max(500)}).strict();
export type HousingSourceCheck=z.infer<typeof sourceCheckInput>&{checkedAt:string;lastSuccessAt:string|null};
export type HousingFeed={notices:HousingNotice[];checks:HousingSourceCheck[];lastRunAt:string|null;schedule:{enabled:boolean;time:"08:00";timezone:"Asia/Seoul";automationId:string|null}};
export const housingUpdateInput=z.object({
  revision:z.number().int().nonnegative(),notices:z.array(housingNoticeInput).max(200),checks:z.array(sourceCheckInput).length(3),
}).strict().superRefine((b,ctx)=>{
  if(new Set(b.checks.map(c=>c.source)).size!==3)ctx.addIssue({code:"custom",message:"세 출처의 확인 결과가 필요합니다."});
  const ids=b.notices.map(n=>housingId(n.source,n.url));
  if(new Set(ids).size!==ids.length)ctx.addIssue({code:"custom",message:"동일 공고가 중복되었습니다."});
  for(const n of b.notices)if(b.checks.find(c=>c.source===n.source)?.status==="error")ctx.addIssue({code:"custom",message:"실패한 출처의 공고를 갱신할 수 없습니다."});
});
export function noticeStatus(n:HousingNoticeInput,now=Date.now()):"접수 예정"|"접수 중"|"접수 마감"|"일정 확인 필요"|"모집 취소"{
  if(n.withdrawn)return "모집 취소";
  if(n.applicationEnd&&now>Date.parse(n.applicationEnd))return "접수 마감";
  if(n.applicationStart&&now<Date.parse(n.applicationStart))return "접수 예정";
  if(n.applicationStart&&n.applicationEnd)return "접수 중";
  return "일정 확인 필요";
}
export function mergeHousingFeed(feed:HousingFeed,input:z.infer<typeof housingUpdateInput>,now:string){
  const map=new Map(feed.notices.map(n=>[n.id,n]));let added=0,changed=0;
  for(const inputNotice of input.notices){
    const id=housingId(inputNotice.source,inputNotice.url)!;
    const old=map.get(id);
    const oldInput=old?housingNoticeInput.parse(Object.fromEntries(Object.keys(inputNotice).map(k=>[k,old[k as keyof HousingNotice]]))):null;
    const differs=!old||JSON.stringify(oldInput)!==JSON.stringify(inputNotice);
    if(!old)added++;else if(differs)changed++;
    map.set(id,{...inputNotice,id,firstSeenAt:old?.firstSeenAt??now,verifiedAt:now,updatedAt:differs?now:old!.updatedAt});
  }
  const notices=[...map.values()].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)||a.id.localeCompare(b.id));
  const checks=input.checks.map(c=>({...c,checkedAt:now,lastSuccessAt:c.status==="ok"?now:feed.checks.find(old=>old.source===c.source)?.lastSuccessAt??null}));
  return {feed:{...feed,notices,checks,lastRunAt:now},added,changed};
}
