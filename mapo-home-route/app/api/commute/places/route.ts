import {z} from 'zod';
import {authorizeCommute,commuteBody,commuteEnv,commuteJSON} from '@/lib/commute-server';

let nextRequestAt=0;
export async function POST(request:Request){
  const denied=await authorizeCommute(request);if(denied)return denied;
  try {
    const {query}=z.object({query:z.string().trim().min(2).max(150)}).parse(await commuteBody(request,1000));
    if(Date.now()<nextRequestAt)return commuteJSON({error:'검색 간격을 조금 두고 다시 시도해 주세요.'},429);
    nextRequestAt=Date.now()+1100;
    const url=new URL(commuteEnv('COMMUTE_GEOCODER_URL')||'https://nominatim.openstreetmap.org/search');
    url.search=new URLSearchParams({q:query,format:'jsonv2',countrycodes:'kr',limit:'5','accept-language':'ko'}).toString();
    const response=await fetch(url,{headers:{'User-Agent':'MapoHomeCommute/0.1 (local development; https://mapo-home-watch.sooyeon-jun-0389.chatgpt.site)'},signal:AbortSignal.timeout(12000)});
    if(!response.ok)return commuteJSON({error:'주소 검색에 연결하지 못했어요. 역·정류장 검색이나 지도 선택을 이용해 주세요.'},502);
    const data=z.array(z.object({display_name:z.string(),lat:z.string(),lon:z.string()})).parse(await response.json());
    const places=data.map(p=>({label:p.display_name,lat:Number(p.lat),lng:Number(p.lon),kind:'address',extraWalk:0})).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&p.lat>=33&&p.lat<=39.5&&p.lng>=124&&p.lng<=132);
    return commuteJSON({places});
  } catch {return commuteJSON({error:'주소를 찾지 못했어요. 역·정류장 검색이나 지도 선택을 이용해 주세요.'},400);}
}
