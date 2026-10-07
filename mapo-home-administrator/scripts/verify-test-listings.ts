import fs from 'node:fs';import assert from 'node:assert/strict';import ExcelJS from 'exceljs';
import {parseCollectedRows} from '../lib/collected';
import {initial,importSnapshot} from '../lib/review-policy';
import {listingSchema as customerSchema} from '../../mapo-home-user/lib/model';
async function main(){
 const dir='../outputs/01a10f73-2c22-7e92-addc-c62736006e96/';const {filename}=JSON.parse(fs.readFileSync(dir+'five-info.json','utf8'));const w=new ExcelJS.Workbook();await w.xlsx.readFile(dir+filename);const sh=w.getWorksheet('Sheet1')!;const rows:unknown[][]=[];sh.eachRow({includeEmpty:true},r=>rows.push(Array.from({length:sh.columnCount},(_,i)=>r.getCell(i+1).text)));
 const parsed=parseCollectedRows(rows,filename).rows;assert.equal(parsed.length,1009);
 const current=JSON.parse(fs.readFileSync('.sites-runtime/current-catalog.json','utf8')).listings;
 const strip=({sourceFile,sourceCollectedAt,sourceSheet,...l}:any)=>JSON.parse(JSON.stringify(l));
 assert.deepEqual(parsed.slice(0,1004).map(strip),current.map(strip));
 const tests=parsed.slice(-5);assert.deepEqual(tests.map(l=>l.name),['TEST 1','TEST 2','TEST 3','TEST 4','TEST 5']);for(const l of tests){assert(l.trackable);assert(!l.sourceUrl);customerSchema.parse(l);}
 const s=importSnapshot(initial(),parsed,filename,'2026-10-06T09:00:00.000Z','2026-10-06');s.rules=[{id:'r',deal:'월세',dongs:['합정동'],maxPrice:5000,maxRent:100,minArea:null,enabled:true}];s.favorites=tests.map(l=>({listingId:l.id,alertsEnabled:true,savedAt:'2026-10-06T09:00:00.000Z'}));
 const changes=[[900,40],[1400,60],[2100,60],[2600,90],[3000,90]];
 const changed=parsed.map(l=>{const i=tests.findIndex(t=>t.id===l.id);if(i<0)return l;const [price,rent]=changes[i];return {...l,price,rent,priceOptions:[{price,rent}],priceText:`월세 ${price}/${rent}`};});
 const next=importSnapshot(s,changed,'next.xlsx','2026-10-06T09:01:00.000Z','2026-10-06');assert.deepEqual(next.notices.map(n=>[n.listingId,n.kind]),[['test:1','가격 인하'],['test:2','가격 인하'],['test:3','가격 조건 변경']]);assert.equal(importSnapshot(next,changed,'same.xlsx','2026-10-06T09:02:00.000Z','2026-10-06').notices.length,3);
 const invalid=structuredClone(rows);invalid.at(-1)![48]='test:1';assert.throws(()=>parseCollectedRows(invalid,filename));
 console.log(JSON.stringify({file:filename,total:1009,added:5,existingPreserved:1004,priceAlertCases:'both drop, deposit drop, mixed, rise silent, unchanged silent, repeated snapshot silent'}));
}
main().catch(e=>{console.error(e);process.exitCode=1});
