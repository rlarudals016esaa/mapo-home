import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {subscriptionSchema} from '@/lib/push-policy';
import {pushConfiguration,removeSubscription,sendPush} from '@/lib/push';
import {synchronizedState} from '@/lib/customer-state';
import {digest} from '@/lib/integration-auth';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
const bodySchema=z.discriminatedUnion('action',[
  z.object({action:z.literal('subscribe'),subscription:subscriptionSchema}),
  z.object({action:z.literal('unsubscribe'),endpoint:z.string().max(2048)}),
  z.object({action:z.literal('status'),endpoint:z.string().max(2048)}),
  z.object({action:z.literal('test'),endpoint:z.string().max(2048)}),
]);
export async function GET(){
  const user=await getChatGPTUser();
  if(!user)return json({error:'로그인 후 기기 알림을 설정해 주세요.'},401);
  return json(pushConfiguration());
}
export async function POST(req:Request){
  try{
    const user=await getChatGPTUser();if(!user)return json({error:'로그인이 필요합니다.'},401);
    if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'요청 출처가 일치하지 않습니다.'},403);
    const raw=await req.text();if(raw.length>8000)return json({error:'요청이 너무 큽니다.'},413);
    const b=bodySchema.parse(JSON.parse(raw)),db=env.DB!;
    const endpoint=b.action==='subscribe'?b.subscription.endpoint:b.endpoint,id=await digest(endpoint);
    if(b.action==='unsubscribe'){await removeSubscription(user.userId,id);return json({enabled:false});}
    if(b.action==='status'){
      const device=await db.prepare('SELECT id FROM push_subscriptions WHERE id=? AND user_id=?').bind(id,user.userId).first();
      const delivery=await db.prepare('SELECT status,last_status,accepted_at FROM push_outbox WHERE subscription_id=? AND user_id=? ORDER BY created_at DESC LIMIT 1').bind(id,user.userId).first();
      return json({enabled:!!device,delivery});
    }
    if(!pushConfiguration().ready)return json({error:'기기 알림을 아직 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.'},503);
    if(b.action==='subscribe'){
      // Consume older catalog versions before enabling this device. No backlog.
      await synchronizedState(user.userId);
      const now=new Date().toISOString();
      const saved=await db.prepare(`INSERT INTO push_subscriptions(id,user_id,payload,created_at,last_seen)
        SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM push_subscriptions WHERE user_id=?)<10 OR EXISTS(SELECT 1 FROM push_subscriptions WHERE id=? AND user_id=?)
        ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,last_seen=excluded.last_seen WHERE push_subscriptions.user_id=excluded.user_id`)
        .bind(id,user.userId,JSON.stringify(b.subscription),now,now,user.userId,id,user.userId).run();
      if(!saved.meta.changes)return json({error:'기기 연결을 완료하지 못했어요. 다른 계정으로 등록한 브라우저이거나 등록 기기 수(10개)를 초과했어요.'},409);
      return json({enabled:true});
    }
    const row=await db.prepare('SELECT payload FROM push_subscriptions WHERE id=? AND user_id=?').bind(id,user.userId).first<{payload:string}>();
    if(!row)return json({error:'먼저 이 기기의 알림을 켜 주세요.'},404);
    const allowed=await db.prepare('UPDATE push_subscriptions SET last_test=? WHERE id=? AND user_id=? AND last_test<?').bind(Date.now(),id,user.userId,Date.now()-60000).run();
    if(!allowed.meta.changes)return json({error:'테스트 알림은 1분에 한 번 보낼 수 있어요.'},429);
    const status=await sendPush(JSON.parse(row.payload),{id:'test:'+crypto.randomUUID(),title:'마포홈 알림이 연결됐어요',body:'이 알림이 보이면 새 매물과 관심 매물의 가격 알림을 받을 준비가 됐어요.',url:'/?view=settings'});
    if(status===404||status===410){await removeSubscription(user.userId,id);return json({error:'기기 연결이 만료됐어요. 알림을 다시 켜 주세요.'},410);}
    if(status<200||status>=300)return json({error:'브라우저 알림 서비스가 요청을 받지 못했어요. 잠시 후 다시 시도해 주세요.'},502);
    return json({accepted:true,message:'브라우저 알림 서비스에 전달했어요. 기기에 알림이 나타나는지 확인해 주세요.'});
  }catch(e){if(e instanceof z.ZodError||e instanceof SyntaxError)return json({error:'기기 알림 요청을 확인해 주세요.'},400);return json({error:'기기 알림 연결에 실패했어요. 잠시 후 다시 시도해 주세요.'},503);}
}
