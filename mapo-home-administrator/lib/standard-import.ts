import {z} from 'zod';
import {dongs,listingSchema} from './model';
import {collectedAt} from './quality';
export const STANDARD_VERSION='MAPO-1';
export const STANDARD_HEADERS=['형식버전','매물ID','매물명','자치구','동','유형','거래종류','보증금(만원)','월세(만원)','보증금2(만원)','월세2(만원)','전용면적(㎡)','층','방향','관리비','역거리','설명','확인등록일','원문URL','가격원문','검토상태','검토메모','원본파일','원본시트','원본행','수집시각'] as const;
type Field=typeof STANDARD_HEADERS[number];
type Cell=string|number|null;
type RecordRow=Record<Field,Cell>;
export type ImportIssue={row:number;name:string;field:string;message:string;value:string;sourceUrl?:string};
export type ImportedListing=z.infer<typeof listingSchema>;
export type ImportResult={rows:ImportedListing[];standardRows:Cell[][];issues:ImportIssue[];total:number;format:'표준 MAPO-1'|'Listly 원본';sourceDate:string};
const txt=(v:unknown)=>String(v??'').trim();
const articlePattern=/^https:\/\/fin\.land\.naver\.com\/articles\/(\d+)(?:[/?#]|$)/;
const sourceDay=(time:string)=>new Date(Date.parse(time)+9*3600000).toISOString().slice(0,10);
export function amount(text:string){const clean=text.replace(/,/g,'').replace(/\s/g,'');if(!/^(?:\d+(?:\.\d+)?억)?(?:\d+(?:\.\d+)?)?$/.test(clean)||!clean)throw new Error('금액 확인 필요: '+text);const parts=clean.split('억');return parts.length===2?Number(parts[0])*10000+Number(parts[1]||0):Number(clean)}
function prices(text:string,deal:string){
 const pieces=text.replace(/변동.*$/,'').trim().slice(2).trim().split(/\s*~\s*/);
 if(!['전세','월세'].includes(deal)||!text.startsWith(deal)||pieces.length>2)throw new Error('거래종류와 가격 조합을 확인하세요.');
 return pieces.map(v=>{const parts=v.split('/');if(parts.length!==(deal==='월세'?2:1))throw new Error('금액 확인 필요: 보증금/월세 형식을 확인하세요.');const price=amount(parts[0]),rent=deal==='월세'?amount(parts[1]):0;if(price>10000000||rent>100000)throw new Error('금액 확인 필요: 허용 범위를 초과한 원문 금액입니다.');return {price,rent}});
}
function emptyRecord():RecordRow{return Object.fromEntries(STANDARD_HEADERS.map(h=>[h,''])) as RecordRow}
function issue(row:number,r:RecordRow,field:string,message:string):ImportIssue{return {row,name:txt(r['매물명']),field,message,value:txt(r[field as Field]),sourceUrl:txt(r['원문URL'])||undefined}}
function inferLegacy(cells:string[],header:string[],file:string,rowNumber:number):{record:RecordRow;issues:ImportIssue[]}{
 const record=emptyRecord(),issues:ImportIssue[]=[];
 const lastLabel=Math.max(...header.filter(h=>/^LABEL-[1-9]\d*$/.test(h)).map(h=>Number(h.slice(6))));
 const labels=Array.from({length:lastLabel},(_,i)=>cells[header.indexOf('LABEL-'+(i+1))]??'');
 const candidates=labels.map((v,i)=>({v,i})).filter(({v,i})=>['원룸','오피스텔'].includes(v)&&i>=2&&/^(전세|월세)\s/.test(labels[i-1])&&labels[i-2]);
 Object.assign(record,{'형식버전':STANDARD_VERSION,'자치구':'마포구','원본파일':file,'원본시트':/\.csv$/i.test(file)?'CSV':'Sheet1','원본행':rowNumber,'수집시각':collectedAt(file),'검토상태':'정상'});
 if(candidates.length!==1){issues.push(issue(rowNumber,record,'매물명','매물명·가격·유형 조합을 하나로 확인할 수 없습니다.'));record['검토상태']='확인 필요';return {record,issues}}
 const typeIndex=candidates[0].i;
 record['매물명']=labels[typeIndex-2];record['유형']=labels[typeIndex];record['거래종류']=labels[typeIndex-1].slice(0,2);record['가격원문']=labels[typeIndex-1];
 const articleIds=[...new Set(cells.map(v=>v.match(articlePattern)?.[1]).filter((v):v is string=>!!v))];
 if(articleIds.length>1)issues.push(issue(rowNumber,record,'원문URL','한 행에 서로 다른 네이버 매물 링크가 있습니다.'));
 const testId=cells[header.indexOf('TEST-ID')]??'',testDong=cells[header.indexOf('TEST-DONG')]??'';
 record['매물ID']=testId||(articleIds[0]?'naver:'+articleIds[0]:`snapshot:${sourceDay(collectedAt(file))}:${rowNumber}`);
 record['원문URL']=articleIds[0]?'https://fin.land.naver.com/articles/'+articleIds[0]:'';
 record['동']=testId?testDong:(dongs.find(d=>txt(record['매물명']).startsWith(d+' '))??'동 정보 없음');
 const areas=labels.filter(v=>/^(?:공급|전용|\d)/.test(v)&&/전용\s*\d/.test(v));
 if(areas.length!==1)issues.push(issue(rowNumber,record,'전용면적(㎡)','전용면적을 하나로 확인할 수 없습니다.'));
 record['전용면적(㎡)']=areas[0]?.match(/전용\s*(\d+(?:\.\d+)?)/)?.[1]??'';
 record['층']=labels.find(v=>/^(?:지하\s*)?(?:\d+|고|중|저|반지하|B\d+)(?:\/(?:\d+|고|중|저))?층$/.test(v))??'층 정보 없음';
 record['방향']=labels.find(v=>/^(동|서|남|북|남동|남서|북동|북서)향$/.test(v))??'';
 record['관리비']=labels.find(v=>v.startsWith('관리비 '))??'';
 record['역거리']=labels.find(v=>v.startsWith('역까지 '))??'';
 record['확인등록일']=labels.find(v=>/^(확인매물|등록) \d{4}\.\d{2}\.\d{2}/.test(v))??'';
 const description=labels.find(v=>/^".*"$/.test(v))??(typeIndex===5?labels[9]:labels[16])??'';
 record['설명']=testId?'테스트용 가상 매물 · '+description:description.replace(/^"|"$/g,'');
 try{const opts=prices(txt(record['가격원문']),txt(record['거래종류']));record['보증금(만원)']=opts[0].price;record['월세(만원)']=opts[0].rent;if(opts[1]){record['보증금2(만원)']=opts[1].price;record['월세2(만원)']=opts[1].rent}}
 catch(e){record['검토상태']='금액 확인 필요';record['검토메모']=e instanceof Error?e.message:'금액 확인 필요';issues.push(issue(rowNumber,record,'가격원문',txt(record['검토메모'])))}
 return {record,issues};
}
function toListing(r:RecordRow,file:string):ImportedListing{
 const requiredNumber=(field:Field,max:number,positive=false)=>{const value=txt(r[field]);if(!/^\d+(?:\.\d+)?$/.test(value))throw new Error(field+': 숫자로 입력해 주세요.');const n=Number(value);if(!Number.isFinite(n)||n>max||(positive&&n<=0))throw new Error(field+': 허용 범위를 확인하세요.');return n};
 if(txt(r['형식버전'])!==STANDARD_VERSION)throw new Error('형식버전은 MAPO-1이어야 합니다.');
 const deal=txt(r['거래종류']),price=requiredNumber('보증금(만원)',10000000),rent=requiredNumber('월세(만원)',100000);
 const priceOptions=[{price,rent}];
 if(txt(r['보증금2(만원)'])||txt(r['월세2(만원)']))priceOptions.push({price:requiredNumber('보증금2(만원)',10000000),rent:requiredNumber('월세2(만원)',100000)});
 const sourceFile=txt(r['원본파일']),sourceRow=requiredNumber('원본행',2001,true);
 if(!Number.isInteger(sourceRow)||sourceRow<2)throw new Error('원본행은 2 이상의 정수여야 합니다.');
 const time=collectedAt(file),sourceTime=collectedAt(sourceFile);
 if(time!==sourceTime||txt(r['수집시각'])!==time)throw new Error('파일명·원본파일·수집시각이 일치해야 합니다. 수집시각을 바꾸어 재업로드하지 마세요.');
 const sourceDate=sourceDay(time),id=txt(r['매물ID']),url=txt(r['원문URL']),article=url.match(articlePattern)?.[1];
 if(url&&!article)throw new Error('원문URL은 네이버 매물 상세 링크여야 합니다.');
 if(article&&id!=='naver:'+article)throw new Error('매물ID와 원문URL의 매물번호가 다릅니다.');
 if(!article&&!/^test:[1-5]$/.test(id)&&id!==`snapshot:${sourceDate}:${sourceRow}`)throw new Error('원문 링크 없는 매물ID를 확인하세요.');
 if(id.startsWith('test:')&&!dongs.includes(txt(r['동'])))throw new Error('테스트 매물의 동을 확인하세요.');
 let priceText=deal+' '+priceOptions.map(p=>String(p.price)+(deal==='월세'?'/'+p.rent:'')).join(' ~ ');
 const sourcePriceText=txt(r['가격원문']);
 try{if(JSON.stringify(prices(sourcePriceText,deal))===JSON.stringify(priceOptions))priceText=sourcePriceText.replace(/변동.*$/,'').trim()}catch{/* Keep raw text as provenance; numeric standard columns are authoritative. */}
 return listingSchema.parse({id,district:txt(r['자치구']),dong:txt(r['동']),name:txt(r['매물명']),type:txt(r['유형']),deal,price,rent,priceOptions,priceText,sourcePriceText,area:requiredNumber('전용면적(㎡)',10000,true),floor:txt(r['층'])||'층 정보 없음',direction:txt(r['방향'])||undefined,management:txt(r['관리비'])||undefined,walk:txt(r['역거리'])||undefined,description:txt(r['설명'])||undefined,confirmedAt:txt(r['확인등록일'])||undefined,trackable:!!article||id.startsWith('test:'),sourceUrl:url||undefined,sourceFile,sourceSheet:txt(r['원본시트'])||'Sheet1',sourceRow,sourceCollectedAt:time,sourceDate});
}
export function inspectCollectedRows(input:unknown[][],file:string):ImportResult{
 const time=collectedAt(file),sourceDate=sourceDay(time),header=(input[0]??[]).map(txt);
 const standard=header.includes('형식버전');
 const legacy=header.filter(h=>/^(LABEL|HREF)-[1-9]\d*$/.test(h)||['TEST-ID','TEST-DONG'].includes(h));
 if(!standard&&(legacy.filter(h=>h.startsWith('LABEL-')).length<3||legacy.some(h=>Number(h.split('-')[1])>2000)))throw new Error('Listly의 LABEL 열 또는 표준 MAPO-1 열을 찾을 수 없습니다. Listly에서 받은 원본 파일을 선택해 주세요.');
 const required=standard?[...STANDARD_HEADERS]:[...new Set(legacy)];
 const missing=required.filter(h=>!header.includes(h)),duplicates=required.filter(h=>header.filter(v=>v===h).length>1);
 if(missing.length||duplicates.length)throw new Error('열 구성을 확인하세요. '+(missing.length?'누락: '+missing.join(', '):'')+(duplicates.length?' 중복: '+duplicates.join(', '):''));
 if(input.length<2||input.length>2001)throw new Error('매물은 1~2,000행이어야 합니다.');
 const rows:ImportedListing[]=[],standardRows:Cell[][]=[[...STANDARD_HEADERS]],issues:ImportIssue[]=[];
 const seen=new Map<string,number>();let total=0;
 for(let i=1;i<input.length;i++){
  const cells=input[i].map(txt);if(!cells.some(Boolean))continue;total++;
  const source=standard?{record:Object.fromEntries(STANDARD_HEADERS.map(h=>[h,cells[header.indexOf(h)]??''])) as RecordRow,issues:[] as ImportIssue[]}:inferLegacy(cells,header,file,i+1);
  const r=source.record;issues.push(...source.issues);
  if(source.issues.length){if(r['검토상태']==='정상')r['검토상태']='확인 필요';r['검토메모']=source.issues.map(x=>x.message).join(' / ')}
  if(!source.issues.length&&txt(r['검토상태'])!=='정상')issues.push(issue(i+1,r,'검토상태',txt(r['검토메모'])||txt(r['검토상태'])||'검토상태를 입력하세요.'));
  if(!source.issues.length&&txt(r['검토상태'])==='정상')try{
   const listing=toListing(r,file);
   if(seen.has(listing.id))throw new Error(`원문 매물 ID가 중복됩니다. ${seen.get(listing.id)}행과 같은 ID입니다.`);
   seen.set(listing.id,i+1);rows.push(listing);
   for(const h of ['보증금(만원)','월세(만원)','보증금2(만원)','월세2(만원)','전용면적(㎡)','원본행'] as Field[])if(txt(r[h]))r[h]=Number(r[h]);
  }catch(e){const message=e instanceof z.ZodError?e.issues.map(x=>x.path.join('.')+': '+x.message).join(' / '):e instanceof Error?e.message:'입력값을 확인하세요.';r['검토상태']='확인 필요';r['검토메모']=message;issues.push(issue(i+1,r,'입력값',message))}
  standardRows.push(STANDARD_HEADERS.map(h=>r[h]));
 }
 if(!total)throw new Error('빈 파일은 반영할 수 없습니다.');
 return {rows,standardRows,issues,total,format:standard?'표준 MAPO-1':'Listly 원본',sourceDate};
}
export function parseCollectedRows(rows:unknown[][],file:string){const result=inspectCollectedRows(rows,file);if(result.issues.length)throw new Error(result.issues.slice(0,5).map(x=>`${x.row}행 ${x.name}: ${x.message}`).join('\n'));return {rows:result.rows,sourceDate:result.sourceDate}}
