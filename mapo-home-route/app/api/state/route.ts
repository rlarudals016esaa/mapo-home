import {withListingImage} from '@/lib/listing-images';
import {refreshCatalog,reconcileCatalog} from "@/lib/catalog";
import {getChatGPTUser} from "@/app/chatgpt-auth";
import {env} from "cloudflare:workers";
import {ruleSchema,type State} from "@/lib/model";
import {z} from "zod";
import {baseline,migrateState} from "@/lib/baseline";
import {synchronizedState} from "@/lib/customer-state";
import {pushConfiguration} from "@/lib/push";

const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{"Cache-Control":"no-store"}});
function db(){if(!env.DB)throw new Error("데이터 저장소가 연결되지 않았습니다.");return env.DB}
async function read(id:string){return db().prepare("SELECT revision,payload FROM workspaces WHERE id=?").bind(id).first<{revision:number;payload:string}>()}
const customerState=(s:State)=>{const {legacyRules,...visible}=s;return {...visible,listings:visible.listings.map(withListingImage),runs:[]}};
export async function GET(){try{
  const delivery={ready:pushConfiguration().ready,message:"내 조건에서 기기 알림을 켜면 운영자가 새 자료를 반영할 때 알려드려요."};
  const catalog=await refreshCatalog();const u=await getChatGPTUser();
  if(!u)return json({state:customerState(await reconcileCatalog(baseline())),revision:0,user:null,delivery,catalog});
  const result=await synchronizedState(u.userId);
  return json({state:customerState(result.state),revision:result.revision,user:{name:u.fullName??""},delivery,catalog});
}catch(e){console.error(e);return json({error:"데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."},503)}}
export async function POST(request:Request){try{
  const u=await getChatGPTUser();if(!u)return json({error:"로그인이 필요합니다."},401);
  const origin=request.headers.get("origin");if(origin&&origin!==new URL(request.url).origin)return json({error:"요청 출처가 일치하지 않습니다."},403);
  const raw=await request.text();if(raw.length>32000)return json({error:"요청 데이터가 너무 큽니다."},413);
  const b=JSON.parse(raw);
  if(!["rule","toggle","favorite","favorite-alert","profile","read"].includes(b?.action))return json({error:"사용자 사이트에서는 매물 데이터나 운영 설정을 변경할 수 없습니다."},403);
  await synchronizedState(u.userId);
  const row=await read(u.userId);
  if(!Number.isInteger(b.revision)||b.revision!==(row?.revision??0))return json({error:"다른 창에서 변경된 내용이 있습니다. 새로고침 후 다시 저장해 주세요."},409);
  const s:State=migrateState(row?JSON.parse(row.payload):null);
  if(b.action==="rule"){
    const rule=ruleSchema.parse(b.rule);
    if(b.nickname!==undefined)s.nickname=z.string().trim().max(24).parse(b.nickname);
    s.rules=[{...rule,minPrice:rule.minPrice??null,minRent:rule.deal==="전세"?null:rule.minRent??null,maxRent:rule.deal==="전세"?null:rule.maxRent,id:s.rules[0]?.id??crypto.randomUUID()}];s.legacyRuleCount=0;
  }else if(b.action==="toggle"){
    const r=s.rules[0];if(!r)return json({error:"먼저 내 조건을 저장해 주세요."},400);r.enabled=z.boolean().parse(b.enabled);
  }else if(b.action==="favorite"){
    const id=z.string().max(100).parse(b.id),saved=z.boolean().parse(b.saved);
    if(!s.listings.some(l=>l.id===id))return json({error:"매물을 찾을 수 없습니다."},404);
    if(saved&&!s.favorites.some(f=>f.listingId===id))s.favorites.push({listingId:id,alertsEnabled:true,savedAt:new Date().toISOString()});
    if(!saved)s.favorites=s.favorites.filter(f=>f.listingId!==id);
  }else if(b.action==="favorite-alert"){
    const f=s.favorites.find(f=>f.listingId===b.id);if(!f)return json({error:"관심 매물을 찾을 수 없습니다."},404);f.alertsEnabled=z.boolean().parse(b.enabled);
  }else if(b.action==="profile"){
    s.nickname=z.string().trim().max(24).parse(b.nickname);
  }else if(b.action==="read"){
    s.notices=s.notices.map(n=>!b.id||n.id===b.id?{...n,read:true}:n);
  }
  const result=row
    ?await db().prepare("UPDATE workspaces SET payload=?,revision=revision+1 WHERE id=? AND revision=?").bind(JSON.stringify(s),u.userId,row.revision).run()
    :await db().prepare("INSERT OR IGNORE INTO workspaces(id,revision,payload) VALUES(?,1,?)").bind(u.userId,JSON.stringify(s)).run();
  if(result.meta.changes!==1)return json({error:"동시에 변경된 내용이 있습니다. 새로고침 후 다시 시도해 주세요."},409);
  return json({state:customerState(s),revision:(row?.revision??0)+1});
}catch(e){console.error(e);if(e instanceof z.ZodError)return json({error:e.issues.slice(0,3).map(i=>i.message).join(" / ")},400);return json({error:"저장하지 못했습니다. 입력 내용이나 연결 상태를 확인해 주세요."},400)}}
