import assert from "node:assert/strict";
import {baseline,migrateState} from "../lib/baseline";
import {initial,importSnapshot,matches,priceChange,ruleSchema,favoriteStatus,noticePath,type Listing,type Rule,type State} from "../lib/model";

const rule:Rule={id:"rule",deal:"월세",maxPrice:2000,maxRent:100,minArea:null,dongs:[],enabled:true};
const room=(id:string,price=1000,rent=70):Listing=>({id,district:"마포구",dong:"망원동",name:"검증용 방",type:"원룸",deal:"월세",price,rent,area:20,floor:"2층",trackable:true,active:true,updated:"2026-10-06T00:00:00Z",history:[{at:"2026-10-06T00:00:00Z",price,rent}]});
const state=(listings:Listing[]):State=>({...initial(),listings,rules:[rule],favorites:listings.map(l=>({listingId:l.id,alertsEnabled:true,savedAt:"2026-10-06"}))});
const refresh=(s:State,rows:Listing[],day=7)=>importSnapshot(s,rows,"test.xlsx",`2026-10-${String(day).padStart(2,"0")}T01:00:00Z`,`2026-10-${String(day).padStart(2,"0")}`);
let checks=0;
function check(name:string,fn:()=>void){fn();checks++;console.log("PASS",name)}
check("Current source and canonical links remain intact",()=>{const b=baseline();assert.equal(b.listings.length,1003);assert.equal(b.listings.filter(l=>l.sourceUrl).length,965);assert.equal(b.sourceFile,"SINGLE_20261006_130231.xlsx");assert(b.listings.every(l=>l.district==="마포구"&&["전세","월세"].includes(l.deal)&&["원룸","오피스텔"].includes(l.type)))});
check("One deal and five unique neighborhoods",()=>{assert(!ruleSchema.safeParse({...rule,deal:"전체"}).success);assert(!ruleSchema.safeParse({...rule,maxRent:null}).success);assert(!ruleSchema.safeParse({...rule,dongs:["망원동","망원동"]}).success);assert(!ruleSchema.safeParse({...rule,dongs:["망원동","합정동","연남동","서교동","성산동","상암동"]}).success);assert(ruleSchema.safeParse({...rule,deal:"전세",maxRent:null}).success)});
check("Matching uses real deposit and rent pairs",()=>{const l={...room("pair"),priceOptions:[{price:1000,rent:120},{price:3000,rent:60}]};assert(!matches(l,rule));assert(matches(room("a",2000,100),rule));assert(!matches({...room("a"),dong:"동 정보 없음"},{...rule,dongs:["망원동"]}))});
check("Price decrease priorities and mixed change",()=>{const old=room("a");assert.equal(priceChange(room("a",900,60),old)?.priority,1);assert.equal(priceChange(room("a",1000,60),old)?.priority,2);assert.equal(priceChange(room("a",1100,60),old)?.priority,3);assert.equal(priceChange(room("a",900,80),old)?.priority,3);assert.equal(priceChange(room("a",1100,80),old),null);assert.equal(priceChange({...room("a",900),deal:"전세",rent:0},{...old,deal:"전세",rent:0})?.priority,2)});
check("Only favorite changes notify and sorted priority",()=>{const s=state([room("a"),room("b"),room("c")]);s.listings.push(room("unhearted"));const n=refresh(s,[room("c",1100,60),room("b",1000,60),room("a",900,60),room("unhearted",900,60)]).notices;assert.deepEqual(n.map(x=>x.priority),[1,2,3]);assert.equal(n[2].kind,"가격 조건 변경")});
check("Outside condition pauses and return sends once",()=>{const s=state([room("a")]);const out=refresh(s,[room("a",3000,50)]);assert.equal(out.notices.length,0);assert.equal(out.favorites.length,1);const back=refresh(out,[room("a",1900,40)],8);assert.equal(back.notices.length,1);assert.equal(back.notices[0].kind,"조건 재진입");assert.equal(back.notices[0].title,"관심 있는 방이 다시 조건에 맞아요!");assert.equal(refresh(back,[room("a",1900,40)],8).notices.length,1);assert.equal(refresh(back,[room("a",1900,40)],9).notices.length,1)});
check("Manual off stays off through return",()=>{const s=state([room("a",3000)]);s.favorites[0].alertsEnabled=false;assert.equal(refresh(s,[room("a",1000)]).notices.length,0)});
check("Grouped new matches exclude old and missing returns",()=>{const s=state([room("a")]);s.listings[0].active=false;const n=refresh(s,[room("a"),room("new1"),room("new2"),room("expensive",5000)]).notices;assert.equal(n.length,1);assert.equal(n[0].kind,"신규 매물");assert.deepEqual(n[0].listingIds,["new1","new2"]);assert(noticePath(n[0]).startsWith("/?batch="))});
check("Initial snapshot does not notify",()=>{assert.equal(refresh({...initial(),rules:[rule]},[room("first")]).notices.length,0)});
check("Missing saved rooms stay and recover without false return",()=>{const s=state([room("a"),{...room("unknown"),trackable:false}]);const missing=refresh(s,[room("other",5000)]);assert.equal(missing.listings.find(l=>l.id==="a")?.active,false);assert.equal(missing.listings.find(l=>l.id==="unknown")?.active,false);assert.equal(favoriteStatus(missing.listings.find(l=>l.id==="a")!,s.favorites[0],rule),"확인되지 않음");assert.equal(refresh(missing,[room("a"),room("other",5000)],8).notices.length,0)});
check("Condition edits establish current baseline without a return push",()=>{const s=state([room("a",3000)]);s.rules=[{...rule,maxPrice:4000}];assert.equal(refresh(s,[room("a",3000)]).notices.length,0)});
check("Unknown identifiers and ambiguous grouped prices do not trigger price alerts",()=>{const a={...room("a"),trackable:false};assert.equal(refresh(state([a]),[{...a,rent:50}]).notices.length,0);const group={...room("g"),priceOptions:[{price:1000,rent:70},{price:2000,rent:50}]};assert.equal(priceChange({...group,rent:50},group),null)});
check("Empty or duplicate snapshots rejected",()=>{assert.throws(()=>refresh(state([room("a")]),[]));assert.throws(()=>refresh(state([room("a")]),[room("a"),room("a")]))});
check("Legacy rules preserved without ambiguous silent conversion",()=>{const b=baseline();const old={...b,schemaVersion:undefined,rules:[{id:"old",name:"old",type:"전체",deal:"전체",dong:"전체",maxPrice:3000,maxRent:80,minArea:0,enabled:true}]};const migrated=migrateState(old);assert.equal(migrated.rules.length,0);assert.equal(migrated.legacyRuleCount,1);assert.equal(migrated.legacyRules?.length,1)});
check("Round-trip migration preserves hearts and preferences",()=>{const b=baseline();b.favorites=[{listingId:b.listings[0].id,alertsEnabled:false,savedAt:"2026-10-06"}];b.rules=[rule];assert.deepEqual(migrateState(JSON.parse(JSON.stringify(b))),b)});
check("Optional lower bounds preserve existing rules and inclusive limits",()=>{
  assert(ruleSchema.safeParse(rule).success);
  assert(matches(room("legacy",0,0),rule));
  const range={...rule,minPrice:1000,minRent:60};
  assert(matches(room("low",1000,60),range));assert(matches(room("high",2000,100),range));
  assert(!matches(room("deposit-low",999,70),range));assert(!matches(room("rent-low",1500,59),range));
  assert(!matches(room("deposit-high",2001,70),range));assert(!matches(room("rent-high",1500,101),range));
  assert(!matches({...room("pairs"),priceOptions:[{price:900,rent:70},{price:1500,rent:50}]},range));
  assert(matches({...room("jeonse",1500,0),deal:"전세"},{...range,deal:"전세",maxRent:null}));
});
check("Lower bound input validation and saved preference round trip",()=>{
  for(const fields of [{minPrice:-1},{minRent:-1},{minPrice:2001},{minRent:101},{minPrice:Infinity}])assert(!ruleSchema.safeParse({...rule,...fields}).success);
  assert(ruleSchema.safeParse({...rule,minPrice:2000,minRent:100}).success);
  assert(ruleSchema.safeParse({...rule,minPrice:null,minRent:null}).success);
  const s=baseline();s.rules=[{...rule,minPrice:1000,minRent:60}];
  assert.deepEqual(migrateState(JSON.parse(JSON.stringify(s))).rules,s.rules);
});
check("Dropping below lower bound pauses favorite alerts and returning notifies once",()=>{
  const s=state([room("a",1500,70)]);s.rules=[{...rule,minPrice:1000,minRent:60}];
  const out=refresh(s,[room("a",1500,50)]);assert.equal(out.notices.length,0);assert.equal(out.favorites.length,1);
  const back=refresh(out,[room("a",1500,60)],8);assert.equal(back.notices.length,1);assert.equal(back.notices[0].kind,"조건 재진입");
  assert.equal(refresh(back,[room("a",1500,60)],9).notices.length,1);
  const fresh=refresh(s,[room("a",1500,70),room("new-low",900,70),room("new-match",1000,60)]);
  assert.deepEqual(fresh.notices[0].listingIds,["new-match"]);
});
console.log(`${checks} PRD scenario checks passed`);
