import assert from 'node:assert/strict';import fs from 'node:fs';
const origin=process.argv[2];if(!origin?.startsWith('http://127.0.0.1:'))throw new Error('Local URL only');const auth={'oai-authenticated-user-id':'operations-owner','oai-authenticated-user-email':'operations@example.test'};
async function call(method='GET',body,headers=auth){const r=await fetch(origin+'/api/admin',{method,headers:{...headers,...(method==='POST'?{origin,'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()}}
assert.equal((await call('GET',undefined,{})).status,403);let result=await call();assert.equal(result.status,200);let revision=result.data.revision;assert.equal(revision,0,'Use a fresh local test DB');assert.equal(result.data.state.listings.length,1003);const initial=result.data.state;
async function post(action,extra={}){const r=await call('POST',{action,revision,...extra});if(r.status===200)revision=r.data.revision;return r}
assert.equal((await call('GET',undefined,{'oai-authenticated-user-id':'other','oai-authenticated-user-email':'other@example.test'})).status,403);
const profile={alias:'API 검토 고객',nickname:'',rule:{deal:'월세',maxPrice:100000,maxRent:10000,minArea:null,dongs:[],enabled:true}};
assert.equal((await post('profile-save',{profile:{...profile,rule:{...profile.rule,dongs:['망원동','합정동','연남동','서교동','성산동','상암동']}}})).status,400);
assert.equal((await post('profile-save',{profile:{...profile,rule:{...profile.rule,maxRent:null}}})).status,400);
const saved=await post('profile-save',{profile});assert.equal(saved.status,200);assert.equal(saved.data.state.events.length,0);const id=saved.data.state.profiles[0].id;
assert.equal((await post('profile-save',{profile})).status,400);const edit=await post('profile-save',{id,profile:{...profile,nickname:'검토'}});assert.equal(edit.data.state.profiles.length,1);assert.equal(edit.data.state.events.length,0);
const target=initial.listings.find(l=>l.trackable&&l.deal==='월세'&&l.price>1&&l.rent>1&&l.priceOptions.length===1);assert(target);
assert.equal((await post('favorite',{profileId:id,listingId:target.id,saved:true})).status,200);
assert.equal((await post('generate')).status,400);
const rows=JSON.parse(fs.readFileSync('.sites-runtime/source-rows.json','utf8'));const priceCol=rows[0].indexOf('LABEL-5');rows[target.sourceRow-1][priceCol]=`월세 ${target.price-1}/${target.rent-1}`;
assert.equal((await post('validate',{fileName:'SINGLE_20261006_114510.xlsx',rows})).status,400);
let verified=await post('validate',{fileName:'SINGLE_20261006_130232.xlsx',rows});assert.equal(verified.status,200);assert.equal(verified.data.state.pending.summary.changed,1);assert.equal(verified.data.state.events.length,0);
assert.equal((await post('commit',{confirm:true,collectionReport:{completed:false,expectedCount:1003,scopeMapo:true}})).status,400);
assert.equal((await post('commit',{confirm:true,collectionReport:{completed:true,expectedCount:1002,scopeMapo:true}})).status,400);
let committed=await post('commit',{confirm:true,collectionReport:{completed:true,expectedCount:1003,scopeMapo:true}});assert.equal(committed.status,200,JSON.stringify(committed.data));assert.equal(committed.data.state.events.length,1);assert.equal(committed.data.state.events[0].kind,'가격 인하');assert.equal(committed.data.state.events[0].delivery,'internal_only');assert.deepEqual(committed.data.state.runDetails[0].changedIds,[target.id]);
const stale=await call('POST',{action:'cancel',revision:revision-1});assert.equal(stale.status,409);
assert.equal((await post('validate',{fileName:'SINGLE_20261006_130233.xlsx',rows})).status,200);assert.equal((await post('commit',{confirm:true,collectionReport:{completed:true,expectedCount:1003,scopeMapo:true}})).status,400,'same data renamed must not reapply');
assert.equal((await post('cancel')).status,200);
const reload=await call();assert.equal(reload.data.state.events.length,1);assert.equal(reload.data.state.profiles[0].favorites.length,1);
const html=await fetch(origin,{headers:auth});assert.equal(html.status,200);assert((await html.text()).includes('마포홈'));
console.log(JSON.stringify({passed:true,checks:'auth, one condition per profile, five dongs, monthly required, no save events, favorites, old API blocked, same-day old file, completeness report, price event, durable renamed-file dedup, revision conflict, reload',events:1,revision}));
