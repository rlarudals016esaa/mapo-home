import assert from 'node:assert/strict';
import {createHash,createHmac,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const admin='http://127.0.0.1:5191',home='http://127.0.0.1:5192';
const owner={'oai-authenticated-user-id':'operations-owner','oai-authenticated-user-email':'operations@example.test'};
const user=id=>({'oai-authenticated-user-id':id,'oai-authenticated-user-email':id+'@example.test'});
async function call(base,path,headers={},body){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{...headers,...(body?{origin:base,'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
function signed(base,path,method='GET',body=''){const time=String(Date.now()),nonce=randomUUID(),hash=createHash('sha256').update(body).digest('hex');const signature=createHmac('sha256','local-integration-test-key').update([method,base,path,time,nonce,hash].join('\n')).digest('hex');return {'x-mapo-time':time,'x-mapo-nonce':nonce,'x-mapo-signature':signature};}
assert.equal((await call(admin,'/api/integration/catalog')).status,403);
const path='/api/integration/catalog?after=-1',headers=signed(admin,path);let exportResult=await call(admin,path,headers);assert.equal(exportResult.status,200);assert.equal(exportResult.data.snapshot.listings.length,1003);assert.equal((await call(admin,path,headers)).status,403,'replay rejected');
assert.equal((await call(admin,'/api/integration/catalog?after=0',headers)).status,403,'path change rejected');
let a=await call(home,'/api/state',user('customer-a'));assert.equal(a.status,200);assert.equal(a.data.state.listings.filter(l=>l.active).length,1003);assert.equal(a.data.state.notices.length,0);
const target=a.data.state.listings.find(l=>l.trackable&&l.deal==='월세'&&l.price>1&&l.rent>1&&l.priceOptions.length===1);assert(target);
const rule={deal:'월세',maxPrice:100000,maxRent:10000,minArea:null,dongs:[],enabled:true};
async function edit(id,action,extra){const current=await call(home,'/api/state',user(id));const result=await call(home,'/api/state',user(id),{action,revision:current.data.revision,...extra});assert.equal(result.status,200,JSON.stringify(result.data));return result;}
for(const id of ['customer-a','customer-b']){await edit(id,'rule',{rule,nickname:id});await edit(id,'favorite',{id:target.id,saved:true});}
await edit('customer-b','favorite-alert',{id:target.id,enabled:false});
// Existing admin scenario validates and commits a real 1003-row snapshot with one price drop.
execFileSync(process.execPath,['scripts/verify-operations-api.mjs',admin],{stdio:'pipe'});
a=await call(home,'/api/state',user('customer-a'));const b=await call(home,'/api/state',user('customer-b'));
assert.equal(a.data.state.listings.find(l=>l.id===target.id).price,target.price-1);assert.equal(a.data.state.notices.length,1);assert.equal(a.data.state.notices[0].kind,'가격 인하');assert.equal(a.data.state.favorites.length,1);assert.equal(a.data.state.nickname,'customer-a');assert.equal(b.data.state.notices.length,0);assert.equal(b.data.state.favorites[0].alertsEnabled,false);
await edit('customer-a','read',{id:a.data.state.notices[0].id});
const retry=await call(admin,'/api/admin/integration',owner,{});assert.equal(retry.data.ok,true);a=await call(home,'/api/state',user('customer-a'));assert.equal(a.data.state.notices.length,1);assert.equal(a.data.state.notices[0].read,true);assert.equal(a.data.state.rules.length,1);
const publicHousing=await call(home,'/api/public-housing');assert.deepEqual(Object.keys(publicHousing.data.feed),['notices']);assert.equal((await call(home,'/api/integration/housing')).status,403);
const housing=await call(admin,'/api/admin/integration?view=housing',owner);assert.equal(housing.status,200);assert(Array.isArray(housing.data.feed.checks));assert('schedule' in housing.data.feed);
assert.equal((await call(home,'/api/public-housing/operations')).status,403);assert.equal((await call(home,'/api/public-housing/operations',{'x-mapo-housing-update':'1',...user('customer-a')})).status,403);assert.equal((await call(home,'/api/public-housing/operations',{'x-mapo-housing-update':'1'})).status,200);
console.log(JSON.stringify({passed:true,checks:'signed requests, replay, path tampering, 1003-row transfer, automatic commit delivery, customer conditions/favorites/manual-off preservation, one price alert, read-state preservation, duplicate retry, housing response separation, updater compatibility'}));
