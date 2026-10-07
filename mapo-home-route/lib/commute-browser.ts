import {normalizeRoutes,odsayError,type CommutePoint} from './commute';

async function query(apiKey:string,method:'searchStation'|'searchPubTransPathT',params:Record<string,string>,signal?:AbortSignal){
  const url=new URL('https://api.odsay.com/v1/api/'+method);
  url.search=new URLSearchParams({...params,apiKey}).toString();
  // URI keys must be called by the registered browser origin, never by a server proxy.
  let response:Response;
  try {response=await fetch(url,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000),cache:'no-store',referrerPolicy:'strict-origin-when-cross-origin'});}
  catch {throw new Error('교통 서비스에 연결하지 못했어요. 네트워크와 등록한 사이트 주소를 확인해 주세요.');}
  if(!response.ok)throw new Error('교통 서비스가 응답하지 않아요. 잠시 후 다시 시도해 주세요.');
  const data:unknown=await response.json();const error=odsayError(data);if(error)throw new Error(error);return data;
}

export async function searchStations(apiKey:string,name:string,signal?:AbortSignal):Promise<CommutePoint[]>{
  const data=await query(apiKey,'searchStation',{stationName:name,stationClass:'1:2',displayCnt:'15',startNO:'1',CID:'1000'},signal) as {result?:{station?:{stationName:string;x:number|string;y:number|string;laneName?:string}[]}};
  const seen=new Set<string>();
  return (data.result?.station??[]).flatMap(s=>{
    const lng=Number(s.x),lat=Number(s.y);if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<33||lat>39.5||lng<124||lng>132)return [];
    const key=s.stationName+':'+lat.toFixed(4)+':'+lng.toFixed(4);if(seen.has(key))return [];seen.add(key);
    return [{label:s.stationName+(s.laneName?' · '+s.laneName:''),lat,lng,kind:'station' as const,extraWalk:0}];
  });
}

export async function findRoutes(apiKey:string,from:CommutePoint,to:CommutePoint,signal?:AbortSignal){
  const data=await query(apiKey,'searchPubTransPathT',{SX:String(from.lng),SY:String(from.lat),EX:String(to.lng),EY:String(to.lat),SearchType:'0'},signal);
  const routes=normalizeRoutes(data,from.extraWalk+to.extraWalk);
  if(!routes.length)throw new Error('비교할 수 있는 대중교통 경로를 찾지 못했어요. 출발·도착 위치를 확인해 주세요.');
  return routes;
}
