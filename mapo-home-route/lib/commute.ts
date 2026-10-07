import {z} from 'zod';

export const pointSchema=z.object({
  label:z.string().trim().min(1).max(200),
  lat:z.number().finite().min(33).max(39.5),
  lng:z.number().finite().min(124).max(132),
  kind:z.enum(['address','map','station']),
  extraWalk:z.number().finite().min(0).max(120).default(0),
});
export type CommutePoint=z.infer<typeof pointSchema>;
export type CommuteRoute={id:string;minutes:number;walkMinutes:number;walkMeters:number;transfers:number;fare:number|null;segments:{mode:'walk'|'bus'|'subway';minutes:number;name:string;from:string;to:string}[]};
export type CommuteResult={listingId:string;routes:CommuteRoute[];error?:string;origin:CommutePoint;destination:CommutePoint};
export const preferencesSchema=z.object({sort:z.enum(['time','transfers','walk']),maxMinutes:z.number().int().min(1).max(240).nullable(),maxTransfers:z.number().int().min(0).max(8).nullable()});
export type CommutePreferences=z.infer<typeof preferencesSchema>;
export const defaultPreferences:CommutePreferences={sort:'time',maxMinutes:null,maxTransfers:null};

const finite=z.union([z.number(),z.string().trim().min(1)]).pipe(z.coerce.number().finite().nonnegative());
const rawRoute=z.object({info:z.object({totalTime:finite,totalWalk:finite,payment:finite.optional()}),subPath:z.array(z.object({trafficType:z.union([z.literal(1),z.literal(2),z.literal(3)]),sectionTime:finite,startName:z.string().optional(),endName:z.string().optional(),lane:z.array(z.object({name:z.string().optional(),busNo:z.union([z.string(),z.number()]).optional()})).optional()})).min(1)});

export function normalizeRoutes(data:unknown,extraWalk=0):CommuteRoute[]{
  const envelope=z.object({result:z.object({path:z.array(z.unknown()).max(100)})}).safeParse(data);
  if(!envelope.success)return [];
  return envelope.data.result.path.flatMap((item,index)=>{
    const parsed=rawRoute.safeParse(item);if(!parsed.success)return [];
    const {info,subPath}=parsed.data;
    const rides=subPath.filter(s=>s.trafficType!==3);
    if(!rides.length)return [];
    return [{id:'route-'+index,minutes:info.totalTime+extraWalk,walkMinutes:subPath.filter(s=>s.trafficType===3).reduce((sum,s)=>sum+s.sectionTime,0)+extraWalk,walkMeters:info.totalWalk,transfers:Math.max(0,rides.length-1),fare:info.payment??null,segments:subPath.map(s=>({mode:s.trafficType===3?'walk' as const:s.trafficType===2?'bus' as const:'subway' as const,minutes:s.sectionTime,name:s.trafficType===3?'도보':(s.lane??[]).map(l=>l.name??String(l.busNo??'')).filter(Boolean).join(' / ')||(s.trafficType===2?'버스':'지하철'),from:s.startName??'',to:s.endName??''}))}];
  });
}

export function sortedRoutes(routes:CommuteRoute[],p:CommutePreferences){
  return routes.filter(r=>(p.maxMinutes===null||r.minutes<=p.maxMinutes)&&(p.maxTransfers===null||r.transfers<=p.maxTransfers)).sort((a,b)=>compareRoutes(a,b,p));
}
export function compareRoutes(a:CommuteRoute,b:CommuteRoute,p:CommutePreferences){
    const first=p.sort==='transfers'?a.transfers-b.transfers:p.sort==='walk'?a.walkMinutes-b.walkMinutes:a.minutes-b.minutes;
    return first||a.minutes-b.minutes||a.transfers-b.transfers||a.walkMinutes-b.walkMinutes;
}

export function odsayError(data:unknown):string|null{
  const errors=(data as {error?:{code?:unknown}[]})?.error;
  if(!Array.isArray(errors)||!errors.length)return null;
  const code=String(errors[0].code);
  if(code==='-98')return '출발지와 도착지가 너무 가까워 대중교통 경로를 찾지 못했어요.';
  if(code==='-99')return '선택한 위치 사이의 대중교통 경로가 없어요. 위치를 다시 확인해 주세요.';
  if(['500','-11','-12'].includes(code))return '교통 API 인증 또는 이용 한도를 확인해야 해요. 잠시 후 다시 시도해 주세요.';
  return '교통 정보를 가져오지 못했어요. 위치를 확인한 후 다시 시도해 주세요. (코드 '+code.replace(/[^\w-]/g,'').slice(0,15)+')';
}
