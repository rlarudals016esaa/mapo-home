import assert from 'node:assert/strict';
import {inspectCollectedRows,parseCollectedRows,STANDARD_HEADERS} from '../lib/standard-import';
const file='SINGLE_20261007_093929.xlsx',standardFile='MAPO_20261007_093929.xlsx';
const header=Array.from({length:24},(_,i)=>['LABEL-'+(i+1),'HREF-'+(i+1)]).flat();
function legacy(modern=false){const cells=Array(48).fill('');const put=(n:number,value:string)=>cells[header.indexOf('LABEL-'+n)]=value;const type=modern?7:6;put(type-2,'합정동 일반원룸');put(type-1,'월세 1,000/50');put(type,'원룸');put(type+1,'전용30㎡');put(modern?16:9,'남향');put(modern?17:10,'"전용25P 설명 문구"');cells[header.indexOf('HREF-2')]='https://fin.land.naver.com/articles/123456';return cells}
const a=inspectCollectedRows([header,legacy()],file),b=inspectCollectedRows([header,legacy(true)],file);
assert.equal(a.issues.length,0);assert.deepEqual(a.rows,b.rows);assert.equal(a.rows[0].area,30);assert.equal(a.rows[0].description,'전용25P 설명 문구');
assert.deepEqual(parseCollectedRows(a.standardRows,standardFile).rows,a.rows,'standard roundtrip preserves values, identity and provenance');
const reordered=a.standardRows.map(r=>[...r].reverse());assert.deepEqual(parseCollectedRows(reordered,standardFile).rows,a.rows,'column order independent');
function edit(field:string,value:string|number|null){const r=structuredClone(a.standardRows);r[1][STANDARD_HEADERS.indexOf(field as typeof STANDARD_HEADERS[number])]=value;return r}
assert(inspectCollectedRows(edit('보증금(만원)',''),standardFile).issues.length);
assert.equal(parseCollectedRows(edit('보증금(만원)',0),standardFile).rows[0].price,0);
assert(inspectCollectedRows(edit('매물ID','naver:999'),standardFile).issues.length);
assert(inspectCollectedRows(edit('수집시각','2026-10-08T00:39:29.000Z'),standardFile).issues.length);
assert(inspectCollectedRows(edit('형식버전','MAPO-2'),standardFile).issues.length);
assert.throws(()=>parseCollectedRows([header,legacy(),legacy()],file),/중복/);
assert.throws(()=>inspectCollectedRows([[...header,'LABEL-1'],legacy()],file),/중복/);
const compactColumns=header.map((h,i)=>({h,i})).filter(x=>x.h.startsWith('LABEL-')&&Number(x.h.slice(6))<=12||x.h==='HREF-2');
assert.deepEqual(inspectCollectedRows([compactColumns.map(x=>x.h),compactColumns.map(x=>legacy()[x.i])],file).rows,a.rows,'Listly column count can change');
const extendedHeaders=Array.from({length:30},(_,i)=>['LABEL-'+(i+1),'HREF-'+(i+1)]).flat();
const extendedRow=Array(60).fill('');for(let i=0;i<24;i++)extendedRow[(i+5)*2]=legacy()[i*2];extendedRow[1]='https://fin.land.naver.com/articles/123456';
assert.deepEqual(inspectCollectedRows([extendedHeaders,extendedRow],file).rows,a.rows,'semantic fields can move and added labels are accepted');
assert.throws(()=>inspectCollectedRows([['name','price','area'],['example','100','30']],file),/Listly/);
assert.throws(()=>inspectCollectedRows([['LABEL-1','LABEL-2','LABEL-999999999'],legacy()],file),/Listly/);
const unknown=legacy(true);unknown[header.indexOf('LABEL-6')]='월세 1,000/57억 5,000';const reviewed=inspectCollectedRows([header,unknown],file);assert.equal(reviewed.total,1);assert.equal(reviewed.rows.length,0);assert.equal(reviewed.issues.length,1);assert.equal(reviewed.standardRows[1][20],'금액 확인 필요');assert.equal(reviewed.standardRows[1][7],'');assert.equal(reviewed.standardRows[1][19],'월세 1,000/57억 5,000');assert.equal(inspectCollectedRows(reviewed.standardRows,standardFile).issues.length,1);
const range=legacy();range[header.indexOf('LABEL-5')]='월세 500/100 ~ 2,000/30';const ranged=inspectCollectedRows([header,range],file);assert.deepEqual(ranged.rows[0].priceOptions,[{price:500,rent:100},{price:2000,rent:30}]);assert.deepEqual(parseCollectedRows(ranged.standardRows,standardFile).rows,ranged.rows);
assert(inspectCollectedRows(edit('검토상태','금액 확인 필요'),standardFile).issues.length,'review marker cannot be silently ignored');
const noLink=legacy();noLink[header.indexOf('HREF-2')]='';const untracked=inspectCollectedRows([header,noLink],file);assert.equal(untracked.rows[0].id,'snapshot:2026-10-07:2');assert.deepEqual(parseCollectedRows(untracked.standardRows,standardFile).rows,untracked.rows);
console.log('Standard import: legacy/current layouts, roundtrip, reordered headers, missing vs zero, identity, timestamps, version, duplicates, unknown amount, paired ranges, review state, untracked ID passed.');
