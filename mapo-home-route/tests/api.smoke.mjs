// Run only against the retained loopback development server with its mock account.
import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173';
const cookie='__sites_local_auth=1';
async function get(auth=true){const r=await fetch(base+'/api/state',{headers:auth?{cookie}:{}});assert.equal(r.status,200);return r.json()}
let current=await get();const before=structuredClone(current);let checks=0;
async function post(body,expected=200,auth=true,origin=base){const r=await fetch(base+'/api/state',{method:'POST',headers:{'content-type':'application/json',origin,...(auth?{cookie}:{})},body:JSON.stringify({revision:current.revision,...body})});const raw=await r.text();let d;try{d=JSON.parse(raw)}catch{d={error:raw}}assert.equal(r.status,expected,JSON.stringify(d));if(r.ok)current=d;checks++;return d}
const publicState=await get(false);assert.equal(publicState.user,null);assert.equal(publicState.state.listings.length,1003);assert.equal(publicState.state.favorites.length,0);assert.equal(publicState.state.rules.length,0);
await post({action:'favorite',id:current.state.listings[0].id,saved:true},401,false);
await post({action:'import'},403);
await post({action:'read',revision:-1},409);
await post({action:'read'},403,true,'https://unrelated.example');
const rule={deal:'월세',maxPrice:2000,maxRent:80,minArea:null,dongs:[],enabled:true};
await post({action:'rule',rule:{...rule,maxRent:null}},400);
await post({action:'rule',rule:{...rule,minPrice:2001}},400);
await post({action:'rule',rule:{...rule,minRent:81}},400);
await post({action:'rule',rule:{...rule,minPrice:-1}},400);
await post({action:'rule',rule:{...rule,dongs:['공덕동','망원동','합정동','성산동','서교동','연남동']}},400);
await post({action:'favorite',id:'missing-id',saved:true},404);
try {
  await post({action:'rule',rule});const ruleId=current.state.rules[0].id;
  await post({action:'rule',rule:{...rule,minPrice:1000,minRent:50}});
  const rangeReload=await get();assert.equal(rangeReload.state.rules[0].minPrice,1000);assert.equal(rangeReload.state.rules[0].minRent,50);
  assert.equal(rangeReload.state.notices.length,before.state.notices.length);
  await post({action:'rule',rule:{...rule,deal:'전세',minPrice:500,minRent:50,maxRent:null}});assert.equal(current.state.rules[0].minRent,null);
  await post({action:'rule',rule:{...rule,maxRent:90}});assert.equal(current.state.rules.length,1);assert.equal(current.state.rules[0].id,ruleId);assert.equal(current.state.notices.length,before.state.notices.length);
  const id=current.state.listings[1].id;
  await post({action:'favorite',id,saved:true});
  await post({action:'favorite',id,saved:true});assert.equal(current.state.favorites.filter(f=>f.listingId===id).length,1);
  await post({action:'favorite-alert',id,enabled:false});
  const reloaded=await get();assert.equal(reloaded.state.favorites.find(f=>f.listingId===id).alertsEnabled,false);assert.equal(reloaded.state.rules.length,1);assert.equal(reloaded.state.runs.length,0);
  const old=before.state.favorites.find(f=>f.listingId===id);
  if(old)await post({action:'favorite-alert',id,enabled:old.alertsEnabled});else await post({action:'favorite',id,saved:false});
} finally {
  if(before.state.rules[0])await post({action:'rule',rule:before.state.rules[0]});
}
console.log(checks+' API checks passed; guest browsing, authorization, validation, single-rule update, persistent favorites, no save-time notices.');

