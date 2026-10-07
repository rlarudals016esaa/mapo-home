// Local in-memory D1-compatible database and fake provider; never contacts users.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
import {readFileSync,readdirSync,mkdirSync} from 'node:fs';
import {createECDH,randomBytes,hkdfSync,createDecipheriv,createPublicKey,verify} from 'node:crypto';
import {pathToFileURL} from 'node:url';

const sqlite=new DatabaseSync(':memory:');
for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+file,'utf8'));
let beforeBatch;
function statement(sql,args=[]){return {
  bind(...values){return statement(sql,values)},
  async first(){return sqlite.prepare(sql).get(...args)??null},
  async all(){return {results:sqlite.prepare(sql).all(...args)}},
  async run(){const result=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(result.changes)}}},
};}
globalThis.__pushTestEnv={DB:{prepare:statement,async batch(items){
  if(beforeBatch){const fn=beforeBatch;beforeBatch=null;fn();}
  sqlite.exec('BEGIN');try{const result=[];for(const item of items)result.push(await item.run());sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}
}}};
globalThis.__pushTestUser={userId:'alice',email:'alice@example.test'};
mkdirSync('outputs',{recursive:true});
await build({stdin:{contents:`export * from './lib/push'; export * from './lib/push-policy'; export * from './lib/customer-state'; export {GET,POST} from './app/api/push/route';`,resolveDir:process.cwd()},outfile:'outputs/push-test.mjs',bundle:true,platform:'node',format:'esm',plugins:[{name:'test-boundaries',setup(b){
  b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'test'}));
  b.onResolve({filter:/chatgpt-auth$/},()=>({path:'auth',namespace:'test'}));
  b.onLoad({filter:/.*/,namespace:'test'},args=>({contents:args.path==='env'?'export const env=globalThis.__pushTestEnv;':'export async function getChatGPTUser(){return globalThis.__pushTestUser}'}));
}}]});
const api=await import(pathToFileURL(process.cwd()+'/outputs/push-test.mjs'));
const vapid=createECDH('prime256v1');vapid.generateKeys();
Object.assign(globalThis.__pushTestEnv,{MAPO_VAPID_PUBLIC_KEY:vapid.getPublicKey().toString('base64url'),MAPO_VAPID_PRIVATE_KEY:vapid.getPrivateKey().toString('base64url'),MAPO_VAPID_SUBJECT:'https://mapo.example.test'});
const client=createECDH('prime256v1');client.generateKeys();
const auth=randomBytes(16);
const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/local-test',expirationTime:null,keys:{p256dh:client.getPublicKey().toString('base64url'),auth:auth.toString('base64url')}};
const room=(price=1000,id='naver:123')=>({id,district:'마포구',dong:'망원동',name:'테스트 방',type:'원룸',deal:'월세',price,rent:70,area:20,floor:'2층',trackable:true,active:true,updated:new Date().toISOString(),history:[]});
const state=()=>({schemaVersion:2,mode:'real',datasetId:'catalog:test',catalogSequence:0,sourceFile:'test.xlsx',sourceDate:'2026-10-07',listings:[room()],rules:[{id:'rule',deal:'월세',maxPrice:2000,maxRent:100,minArea:null,dongs:[],enabled:true}],favorites:[{listingId:'naver:123',alertsEnabled:true,savedAt:new Date().toISOString()}],nickname:'',notices:[],runs:[]});
function saveUser(id,s){sqlite.prepare('INSERT OR REPLACE INTO workspaces(id,revision,payload) VALUES(?,1,?)').run(id,JSON.stringify(s));}
function catalog(sequence,price=900,extra=[]){const at=new Date(Date.now()+sequence).toISOString();sqlite.prepare('INSERT INTO shared_catalog(sequence,version,payload) VALUES(?,?,?)').run(sequence,'version'+sequence,JSON.stringify({sequence,datasetVersion:'version'+sequence,sourceFile:'test.xlsx',sourceDate:'2026-10-07',publishedAt:at,listings:[room(price),...extra]}));}
async function request(body,{user='alice',origin='https://mapo.example.test'}={}){
  globalThis.__pushTestUser=user?{userId:user}:null;
  return api.POST(new Request('https://mapo.example.test/api/push',{method:'POST',headers:origin?{origin}: {},body:JSON.stringify(body)}));
}
let sent=[],providerStatus=201;
globalThis.fetch=async(url,options)=>{
  assert.equal(url,subscription.endpoint);assert.equal(options.redirect,'manual');
  const headers=new Headers(options.headers);assert.equal(headers.get('content-encoding'),'aes128gcm');
  const authorization=headers.get('authorization');assert.match(authorization,/^vapid t=/);
  const token=authorization.match(/t=([^, ]+)/)[1],parts=token.split('.');
  const pub=vapid.getPublicKey();const pubKey=createPublicKey({key:{kty:'EC',crv:'P-256',x:pub.subarray(1,33).toString('base64url'),y:pub.subarray(33).toString('base64url')},format:'jwk'});
  assert(verify('sha256',Buffer.from(parts[0]+'.'+parts[1]),{key:pubKey,dsaEncoding:'ieee-p1363'},Buffer.from(parts[2],'base64url')));
  assert.equal(JSON.parse(Buffer.from(parts[1],'base64url')).aud,'https://fcm.googleapis.com');
  // Independent RFC 8291 decryption proves the device receives the right data.
  const wire=Buffer.from(options.body),salt=wire.subarray(0,16),keyLength=wire[20],serverKey=wire.subarray(21,21+keyLength);
  const shared=client.computeSecret(serverKey);
  const ikm=Buffer.from(hkdfSync('sha256',shared,auth,Buffer.concat([Buffer.from('WebPush: info\0'),client.getPublicKey(),serverKey]),32));
  const cek=Buffer.from(hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: aes128gcm\0'),16));
  const nonce=Buffer.from(hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: nonce\0'),12));
  const ciphertext=wire.subarray(21+keyLength),decipher=createDecipheriv('aes-128-gcm',cek,nonce);decipher.setAuthTag(ciphertext.subarray(-16));
  const plain=Buffer.concat([decipher.update(ciphertext.subarray(0,-16)),decipher.final()]);let end=plain.length-1;while(plain[end]===0)end--;assert.equal(plain[end],2);
  sent.push(JSON.parse(plain.subarray(0,end).toString()));
  return new Response(null,{status:providerStatus});
};
let checks=0;async function check(name,fn){await fn();checks++;console.log('PASS',name);}
await check('Authentication, strict same-origin checks and endpoint validation',async()=>{
  assert.equal((await request({action:'subscribe',subscription},{user:null})).status,401);
  assert.equal((await request({action:'subscribe',subscription},{origin:'https://evil.test'})).status,403);
  assert.equal((await request({action:'subscribe',subscription},{origin:null})).status,403);
  for(const endpoint of ['http://fcm.googleapis.com/fcm/send/a','https://127.0.0.1/push','https://fcm.googleapis.com.evil.test/fcm/send/a','https://user:pass@fcm.googleapis.com/fcm/send/a','https://fcm.googleapis.com:444/fcm/send/a'])assert.equal((await request({action:'subscribe',subscription:{...subscription,endpoint}})).status,400);
  assert(api.allowedPushEndpoint('https://web.push.apple.com/Q123'));
  assert(api.allowedPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/abc'));
});
await check('Subscription, ownership and no historical notification replay',async()=>{
  saveUser('alice',state());catalog(1);
  assert.equal((await request({action:'subscribe',subscription})).status,200);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM push_outbox').get().n,0);
  assert.equal((await request({action:'status',endpoint:subscription.endpoint},{user:'bob'})).status,200);
  assert.equal((await request({action:'subscribe',subscription},{user:'bob'})).status,409);
  assert.equal((await request({action:'test',endpoint:subscription.endpoint},{user:'bob'})).status,404);
  await request({action:'unsubscribe',endpoint:subscription.endpoint},{user:'bob'});
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM push_subscriptions').get().n,1);
});
await check('Test push uses encrypted payload, valid VAPID and rate limit',async()=>{
  const r=await request({action:'test',endpoint:subscription.endpoint});assert.equal(r.status,200);assert.equal((await r.json()).accepted,true);
  assert.equal(sent.at(-1).title,'마포홈 알림이 연결됐어요');
  assert.equal((await request({action:'test',endpoint:subscription.endpoint})).status,429);
});
await check('Offline user gets price change; concurrent workers do not duplicate',async()=>{
  sent=[];catalog(2,800);
  await Promise.all([api.processPushWork(),api.processPushWork()]);
  assert.equal(sent.length,1);assert.match(sent[0].title,/가격이 내려갔어요/);assert.equal(sent[0].url,'/?listing=naver%3A123');
  assert.equal(sqlite.prepare('SELECT status FROM push_outbox').get().status,'accepted');
  await api.processPushWork();assert.equal(sent.length,1);
});
await check('State/outbox transaction survives a conflicting user edit',async()=>{
  catalog(3,700);
  beforeBatch=()=>{const row=sqlite.prepare("SELECT payload FROM workspaces WHERE id='alice'").get(),s=JSON.parse(row.payload);s.favorites[0].alertsEnabled=false;sqlite.prepare("UPDATE workspaces SET revision=revision+1,payload=? WHERE id='alice'").run(JSON.stringify(s));};
  await api.synchronizedState('alice');await api.processPushWork();assert.equal(sent.length,1);
  const row=sqlite.prepare("SELECT payload FROM workspaces WHERE id='alice'").get();assert.equal(JSON.parse(row.payload).favorites[0].alertsEnabled,false);
});
await check('Queued notice cancelled when user pauses alerts',async()=>{
  const s=JSON.parse(sqlite.prepare("SELECT payload FROM workspaces WHERE id='alice'").get().payload);s.favorites[0].alertsEnabled=true;saveUser('alice',s);
  catalog(4,600);await api.synchronizedState('alice');
  const latest=JSON.parse(sqlite.prepare("SELECT payload FROM workspaces WHERE id='alice'").get().payload);latest.rules[0].enabled=false;saveUser('alice',latest);
  await api.processPushWork();assert.equal(sent.length,1);assert.equal(sqlite.prepare("SELECT count(*) AS n FROM push_outbox WHERE status='cancelled'").get().n,1);
});
await check('Transient failures retry only when due, provider acceptance is recorded',async()=>{
  const s=JSON.parse(sqlite.prepare("SELECT payload FROM workspaces WHERE id='alice'").get().payload);s.rules[0].enabled=true;saveUser('alice',s);catalog(5,500);
  providerStatus=503;await api.processPushWork();assert.equal(sent.length,2);
  const pending=sqlite.prepare("SELECT * FROM push_outbox WHERE status='queued'").get();assert.equal(pending.attempts,1);assert(pending.next_attempt>Date.now());
  await api.processPushWork();assert.equal(sent.length,2);
  sqlite.prepare("UPDATE push_outbox SET next_attempt=0 WHERE status='queued'").run();providerStatus=201;
  await api.processPushWork();assert.equal(sent.length,3);assert.equal(sqlite.prepare('SELECT status FROM push_outbox WHERE id=?').get(pending.id).status,'accepted');
});
await check('New listings are grouped and permanent expiry removes subscription',async()=>{
  catalog(6,500,[room(1000,'naver:456'),room(1000,'naver:789')]);providerStatus=410;
  await api.processPushWork();assert.match(sent.at(-1).body,/방 2개/);assert(sent.at(-1).url.startsWith('/?batch='));
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM push_subscriptions').get().n,0);
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM push_outbox WHERE status='expired'").get().n,1);
});
await check('Explicit unsubscribe cancels pending delivery and cannot be undone by sync',async()=>{
  providerStatus=201;assert.equal((await request({action:'subscribe',subscription})).status,200);
  catalog(7,400);await api.synchronizedState('alice');assert(sqlite.prepare("SELECT count(*) AS n FROM push_outbox WHERE status='queued'").get().n>0);
  await request({action:'unsubscribe',endpoint:subscription.endpoint});const count=sent.length;await api.processPushWork();assert.equal(sent.length,count);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM push_subscriptions').get().n,0);
});
sqlite.close();console.log(`${checks} push integration checks passed; no real notifications were sent.`);
