import assert from 'node:assert/strict';
import {test} from 'node:test';
import {normalizeRoutes,sortedRoutes,compareRoutes,defaultPreferences,odsayError} from './commute.ts';

const route=(minutes,walk,rides)=>({info:{totalTime:minutes,totalWalk:300,payment:1550},subPath:[{trafficType:3,sectionTime:walk},...Array.from({length:rides},()=>({trafficType:1,sectionTime:10,lane:[{name:'5호선'}],startName:'공덕',endName:'여의도'}))]});
test('additional walking contributes to total and walking time, with transfer counts derived from rides',()=>{
  const [r]=normalizeRoutes({result:{path:[route(25,5,2)]}},7);
  assert.equal(r.minutes,32);assert.equal(r.walkMinutes,12);assert.equal(r.transfers,1);assert.equal(r.fare,1550);
});
test('zero-transfer filter and time limits exclude ineligible routes without mutating original data',()=>{
  const routes=normalizeRoutes({result:{path:[route(20,10,2),route(30,5,1),route(40,2,1)]}});
  assert.deepEqual(sortedRoutes(routes,{...defaultPreferences,maxTransfers:0,maxMinutes:35}).map(r=>r.minutes),[30]);
  assert.deepEqual(routes.map(r=>r.minutes),[20,30,40]);
  assert.equal(sortedRoutes(routes,{...defaultPreferences,maxMinutes:10}).length,0);
});
test('sorting considers alternate routes and handles ties consistently',()=>{
  const routes=normalizeRoutes({result:{path:[route(20,10,2),route(30,5,1),route(40,2,1)]}});
  assert.equal(sortedRoutes(routes,defaultPreferences)[0].minutes,20);
  assert.equal(sortedRoutes(routes,{...defaultPreferences,sort:'transfers'})[0].minutes,30);
  assert.equal(sortedRoutes(routes,{...defaultPreferences,sort:'walk'})[0].minutes,40);
  assert.equal(compareRoutes(routes[0],routes[0],defaultPreferences),0);
});
test('malformed and missing travel data must not become zero-minute recommendations',()=>{
  assert.deepEqual(normalizeRoutes({result:{path:[{info:{totalTime:null,totalWalk:0},subPath:route(20,5,1).subPath},{info:{totalTime:'',totalWalk:0},subPath:route(20,5,1).subPath},{info:{totalTime:-1,totalWalk:0},subPath:[]}]}}),[]);
  assert.deepEqual(normalizeRoutes({error:[{code:-99}]}),[]);
  assert.match(odsayError({error:[{code:-98}]})??'',/너무 가까워/);
});
