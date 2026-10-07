import {z} from 'zod';
import {type Notice,type State,matches} from './model';

// A client-supplied endpoint must never turn this service into an HTTP proxy.
export function allowedPushEndpoint(value:string){
  try{
    const u=new URL(value);
    return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&(
      u.hostname==='fcm.googleapis.com'&&/^\/(fcm\/send|wp)\//.test(u.pathname)||
      u.hostname==='updates.push.services.mozilla.com'&&u.pathname.startsWith('/wpush/')||
      (u.hostname==='web.push.apple.com'||u.hostname.endsWith('.push.apple.com'))&&u.pathname.startsWith('/')||
      (u.hostname==='notify.windows.com'||u.hostname.endsWith('.notify.windows.com'))&&u.pathname.startsWith('/w/'));
  }catch{return false;}
}
export const subscriptionSchema=z.object({
  endpoint:z.string().max(2048).refine(allowedPushEndpoint,'지원되는 브라우저 푸시 주소가 아닙니다.'),
  expirationTime:z.number().nullable().optional(),
  keys:z.object({p256dh:z.string().regex(/^B[A-Za-z0-9_-]{86}$/),auth:z.string().regex(/^[A-Za-z0-9_-]{22}$/)}),
});
export type Subscription=z.infer<typeof subscriptionSchema>;
export function noticeStillEnabled(state:State,n:Notice){
  const rule=state.rules[0];
  if(!rule?.enabled||rule.id!==n.ruleId)return false;
  if(n.kind==='신규 매물')return (n.listingIds??[]).some(id=>state.listings.some(l=>l.id===id&&matches(l,rule)));
  return state.favorites.some(f=>f.listingId===n.listingId&&f.alertsEnabled)&&state.listings.some(l=>l.id===n.listingId&&matches(l,rule));
}
export function retryDelay(attempt:number){return Math.min(3600000,30000*2**Math.max(0,attempt-1));}
