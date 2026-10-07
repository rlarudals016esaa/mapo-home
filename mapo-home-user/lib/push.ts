import {env} from 'cloudflare:workers';
import {buildPushPayload} from '@block65/webcrypto-web-push';
import {type Notice,type State,noticePath} from './model';
import {synchronizedState} from './customer-state';
import {allowedPushEndpoint,noticeStillEnabled,retryDelay,type Subscription} from './push-policy';

const db=()=>env.DB!;
const config=()=>env as unknown as Record<string,string>;
export function pushConfiguration(){
  const c=config();
  return {ready:!!(c.MAPO_VAPID_PUBLIC_KEY&&c.MAPO_VAPID_PRIVATE_KEY&&c.MAPO_VAPID_SUBJECT),publicKey:c.MAPO_VAPID_PUBLIC_KEY??''};
}
export async function sendPush(subscription:Subscription,message:{id:string;title:string;body:string;url:string}){
  if(!pushConfiguration().ready)throw new Error('기기 알림을 아직 사용할 수 없습니다.');
  if(!allowedPushEndpoint(subscription.endpoint))throw new Error('지원되지 않는 발송 주소');
  const c=config();
  const payload=await buildPushPayload({data:JSON.stringify(message),options:{ttl:3600}},{...subscription,expirationTime:subscription.expirationTime??null},{
    subject:c.MAPO_VAPID_SUBJECT,publicKey:c.MAPO_VAPID_PUBLIC_KEY,privateKey:c.MAPO_VAPID_PRIVATE_KEY,
  });
  // Never follow provider redirects with VAPID credentials or subscription data.
  const response=await fetch(subscription.endpoint,{...payload,redirect:'manual',signal:AbortSignal.timeout(5000)});
  await response.body?.cancel();
  return response.status;
}
export async function removeSubscription(userId:string,id:string){
  await db().batch([
    db().prepare("UPDATE push_outbox SET status='cancelled',lease=NULL WHERE user_id=? AND subscription_id=? AND status IN ('queued','sending')").bind(userId,id),
    db().prepare('DELETE FROM push_subscriptions WHERE id=? AND user_id=?').bind(id,userId),
  ]);
}
type Outbox={id:string;user_id:string;subscription_id:string;payload:string;attempts:number;created_at:number};
async function deliver(item:Outbox){
  const lease=crypto.randomUUID(),now=Date.now();
  const claimed=await db().prepare(`UPDATE push_outbox SET status='sending',lease=?,attempts=attempts+1,next_attempt=?
    WHERE id=? AND status IN ('queued','sending') AND next_attempt<=? AND attempts<5`).bind(lease,now+60000,item.id,now).run();
  if(!claimed.meta.changes)return;
  const finish=async(status:string,code:number|null,next=0)=>db().prepare('UPDATE push_outbox SET status=?,last_status=?,next_attempt=?,accepted_at=?,lease=NULL WHERE id=? AND lease=?')
    .bind(status,code,next,status==='accepted'?Date.now():null,item.id,lease).run();
  const subscription=await db().prepare('SELECT payload FROM push_subscriptions WHERE id=? AND user_id=?').bind(item.subscription_id,item.user_id).first<{payload:string}>();
  const row=await db().prepare('SELECT payload FROM workspaces WHERE id=?').bind(item.user_id).first<{payload:string}>();
  const notice=JSON.parse(item.payload) as Notice;
  if(!subscription||!row||!noticeStillEnabled(JSON.parse(row.payload) as State,notice)||now-item.created_at>86400000){await finish('cancelled',null);return;}
  let status:number|null=null;
  try{status=await sendPush(JSON.parse(subscription.payload),{id:notice.id,title:notice.title,body:notice.body,url:noticePath(notice)});}catch{ /* Retries never expose endpoints or keys in logs. */ }
  if(status!==null&&status>=200&&status<300){await finish('accepted',status);return;}
  if(status===404||status===410){await finish('expired',status);await removeSubscription(item.user_id,item.subscription_id);return;}
  const retry=status===null||status===429||status===408||status>=500;
  const attempt=item.attempts+1;
  await finish(retry&&attempt<5?'queued':'failed',status,Date.now()+retryDelay(attempt));
}

// Triggered through waitUntil after a catalog sync or a user API request, so a
// subscribed user does not need to have the Site open. Work left after the time
// budget is durable and resumes at the next trigger (including operator retry).
export async function processPushWork(){
  if(!pushConfiguration().ready)return;
  const deadline=Date.now()+22000;
  const latest=await db().prepare('SELECT MAX(sequence) AS seq FROM shared_catalog').first<{seq:number|null}>();
  let after='';
  while(latest?.seq!==null&&latest?.seq!==undefined&&Date.now()<deadline){
    const users=await db().prepare(`SELECT w.id FROM workspaces w WHERE w.id>? AND COALESCE(json_extract(w.payload,'$.catalogSequence'),-1)<?
      AND EXISTS(SELECT 1 FROM push_subscriptions s WHERE s.user_id=w.id) ORDER BY w.id LIMIT 5`).bind(after,latest.seq).all<{id:string}>();
    if(!users.results.length)break;
    for(const user of users.results){
      after=user.id;
      try{await synchronizedState(user.id);}catch{console.error('Push matching deferred');}
      if(Date.now()>=deadline)break;
    }
  }
  // Recover a final-attempt crash instead of leaving the record in 'sending'.
  await db().prepare("UPDATE push_outbox SET status='failed',lease=NULL WHERE status='sending' AND next_attempt<=? AND attempts>=5").bind(Date.now()).run();
  while(Date.now()<deadline){
    const due=await db().prepare("SELECT id,user_id,subscription_id,payload,attempts,created_at FROM push_outbox WHERE status IN ('queued','sending') AND next_attempt<=? AND attempts<5 ORDER BY created_at LIMIT 5").bind(Date.now()).all<Outbox>();
    if(!due.results.length)break;
    await Promise.allSettled(due.results.map(deliver));
  }
  // Keep recent delivery history; inbox events live independently in workspaces.
  await db().prepare("DELETE FROM push_outbox WHERE created_at<? AND status NOT IN ('queued','sending')").bind(Date.now()-30*86400000).run();
}
