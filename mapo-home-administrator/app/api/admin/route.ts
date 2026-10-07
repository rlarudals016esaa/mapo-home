import {snapshot,notifyCustomerSite} from '@/lib/catalog-export';
import {authorize,db} from '@/lib/server';
import {adminInitial,type AdminState} from '@/lib/admin';
import {inspectCollectedRows} from '@/lib/standard-import';
import {reviewExclusions} from '@/lib/import-exclusions';
import {collectedAt,qualityWarnings} from '@/lib/quality';
import {normalizeAdmin,profileInput,evaluateProfiles,type ReviewEvent} from '@/lib/reviews';
import {initial,importSnapshot} from '@/lib/review-policy';
import {z} from 'zod';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
async function read(){return db().prepare('SELECT revision,payload FROM admin_workspace WHERE id=?').bind('main').first<{revision:number;payload:string}>()}
export async function GET(){try{if(!await authorize())return json({error:'운영자 계정으로 로그인해 주세요.'},403);const row=await read();return json({state:normalizeAdmin(row?JSON.parse(row.payload):adminInitial()),revision:row?.revision??0})}catch(e){console.error(e);return json({error:'운영 데이터를 불러오지 못했습니다. 다시 시도해 주세요.'},503)}}
export async function POST(req:Request){try{
 if(!await authorize())return json({error:'운영자 권한이 필요합니다.'},403);
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'요청 출처를 확인할 수 없습니다.'},403);
 const reader=req.body?.getReader();if(!reader)return json({error:'요청이 비어 있습니다.'},400);let size=0;const chunks:Uint8Array[]=[];while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>4000000){await reader.cancel();return json({error:'업로드 데이터는 4MB 이하로 제한됩니다.'},413)}chunks.push(part.value)}const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length}const b=JSON.parse(new TextDecoder().decode(bytes));
 const row=await read();if(!Number.isInteger(b.revision)||b.revision!==(row?.revision??0))return json({error:'다른 창에서 변경되었습니다. 새로고침 후 다시 시도하세요.'},409);
 let s:AdminState=normalizeAdmin(row?JSON.parse(row.payload):adminInitial());const at=new Date().toISOString();let detail='';let batchId='';let events:ReviewEvent[]=[];
 if(b.action==='validate'){
  const file=z.string().min(1).max(150).parse(b.fileName);const timestamp=collectedAt(file);
  if(timestamp<collectedAt(s.sourceFile))throw new Error('현재 자료보다 이전 시각의 파일은 반영할 수 없습니다.');
  if(timestamp>at)throw new Error('미래 시각의 파일은 반영할 수 없습니다.');
  const collected=inspectCollectedRows(z.array(z.array(z.union([z.string().max(3000),z.number(),z.null()]))).min(2).max(2001).parse(b.rows),file);
  const {unresolved,exclusions}=reviewExclusions(collected,z.array(z.number().int().min(2).max(2001)).max(2000).default([]).parse(b.excludedRows));
  if(unresolved.length)return json({error:`확인 필요 ${new Set(unresolved.map(x=>x.row)).size}건이 남았습니다. 수정하거나 제외할 행을 선택하세요.`,issues:unresolved.slice(0,100),total:collected.total},422);
  if(!collected.rows.length)throw new Error('빈 파일은 반영할 수 없습니다.');
  const preview=importSnapshot({...initial(),listings:s.listings},collected.rows,file,at,collected.sourceDate);const run=preview.runs[0];
  s.pending={rows:collected.rows,file,date:collected.sourceDate,at,sourceTotal:collected.total,exclusions,warnings:qualityWarnings(s.listings,collected.rows),summary:{total:collected.rows.length,tracked:collected.rows.filter(x=>x.trackable).length,added:run.added,changed:run.changed,missing:run.closed}};
  detail=file+' · '+collected.rows.length+'건 형식 검증 통과'+(exclusions.length?' · 확인 필요 '+exclusions.length+'건 제외':'');
 }else if(b.action==='commit'){
  if(!s.pending||b.confirm!==true)throw new Error('검증 후 전체 수집 파일임을 확인해 주세요.');
  const report=z.object({completed:z.literal(true),expectedCount:z.number().int().positive().max(2000),scopeMapo:z.literal(true),reviewNote:z.string().trim().max(500).default('')}).parse(b.collectionReport);
  const p=s.pending;if(report.expectedCount!==(p.sourceTotal??p.rows.length))throw new Error('수집 도구의 완료 건수는 제외 전 원본 전체 행 수와 일치해야 합니다.');
  if(p.exclusions?.length&&b.confirmExclusions!==true)throw new Error('제외한 행과 사유를 확인해 주세요.');
  const warnings=qualityWarnings(s.listings,p.rows);if(warnings.length&&report.reviewNote.length<10)throw new Error('수집 누락 경고를 확인하고 10자 이상의 검토 사유를 남겨 주세요.');
  if(collectedAt(p.file)<collectedAt(s.sourceFile))throw new Error('검증 자료가 현재 수집 자료보다 이전입니다. 다시 검증하세요.');
  const canonical=JSON.stringify(p.rows.map(({sourceFile,sourceCollectedAt,sourceSheet,...l})=>l));
  batchId=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical)))).map(x=>x.toString(16).padStart(2,'0')).join('');
  if(s.hashes.includes(batchId)||await db().prepare('SELECT id FROM admin_event_batches WHERE id=?').bind(batchId).first())throw new Error('이미 반영한 동일 데이터입니다.');
  events=evaluateProfiles(s,p.rows.map(l=>({...l,active:true,updated:at,history:[]})),p.file,at,p.date,batchId);
  const favorites=(s.profiles??[]).flatMap(x=>x.favorites);
  const next=importSnapshot({...initial(),listings:s.listings,favorites},p.rows,p.file,at,p.date);
  const oldMap=new Map(s.listings.map(l=>[l.id,l]));const ids=new Set(p.rows.map(l=>l.id));
  const runDetail={at,sourceTotal:p.sourceTotal??p.rows.length,exclusions:p.exclusions??[],addedIds:p.rows.filter(l=>!oldMap.has(l.id)).map(l=>l.id),changedIds:next.listings.filter(l=>ids.has(l.id)&&l.history.at(-1)?.at===at&&oldMap.has(l.id)&&l.history.length>1).map(l=>l.id),missingIds:s.listings.filter(l=>l.active&&!ids.has(l.id)).map(l=>l.id)};
  s={...s,sourceFile:p.file,sourceDate:p.date,listings:next.listings,hashes:[batchId,...s.hashes].slice(0,90),events:[...events,...s.events??[]].slice(0,1000),runs:[{...next.runs[0],alerts:events.length},...s.runs].slice(0,90),runDetails:[runDetail,...s.runDetails??[]].slice(0,30)};delete s.pending;
  detail=p.file+' · 수집 '+report.expectedCount+'건 확인 · '+p.rows.length+'건 반영'+(p.exclusions?.length?' · '+p.exclusions.length+'건 제외 (실행 대상에서 행·사유 확인)':'')+' · 사용자 전달 시도'+(report.reviewNote?' · 검토: '+report.reviewNote:'');
 }else if(b.action==='cancel'){delete s.pending;detail='업로드 검증 자료 취소';
 }else if(b.action==='profile-save'){
  const value=profileInput.parse(b.profile);const profiles=s.profiles!;const existing=b.id?profiles.find(p=>p.id===b.id):undefined;
  if(b.id&&!existing)throw new Error('검토용 고객을 찾을 수 없습니다.');
  if(!existing&&profiles.length>=30)throw new Error('검토용 고객은 30명까지 등록할 수 있습니다.');
  if(profiles.some(p=>p.id!==existing?.id&&p.alias.normalize('NFKC').toLowerCase()===value.alias.normalize('NFKC').toLowerCase()))throw new Error('이미 있는 고객 별칭입니다. 해당 고객의 조건을 수정하세요.');
  const profile={id:existing?.id??crypto.randomUUID(),alias:value.alias,nickname:value.nickname,rule:{...value.rule,maxRent:value.rule.deal==='전세'?null:value.rule.maxRent,id:existing?.rule.id??crypto.randomUUID()},favorites:existing?.favorites??[]};
  s.profiles=existing?profiles.map(p=>p.id===profile.id?profile:p):[...profiles,profile];detail=profile.alias+' · 조건 '+(existing?'수정':'저장')+' / 알림 생성 없음';
 }else if(b.action==='profile-toggle'||b.action==='favorite'||b.action==='favorite-alert'){
  const p=s.profiles!.find(p=>p.id===b.profileId);if(!p)throw new Error('검토용 고객을 찾을 수 없습니다.');
  if(b.action==='profile-toggle'){p.rule.enabled=z.boolean().parse(b.enabled);detail=p.alias+' · 전체 알림 '+(p.rule.enabled?'사용':'중지')}
  else {const l=s.listings.find(l=>l.id===b.listingId);if(!l)throw new Error('매물을 찾을 수 없습니다.');const f=p.favorites.find(f=>f.listingId===l.id);
   if(b.action==='favorite'){const saved=z.boolean().parse(b.saved);if(saved&&!f){if(p.favorites.length>=100)throw new Error('검토용 관심 매물은 고객별 100개까지 저장할 수 있습니다.');p.favorites.push({listingId:l.id,alertsEnabled:true,savedAt:at})}if(!saved)p.favorites=p.favorites.filter(f=>f.listingId!==l.id);detail=p.alias+' · 검토용 관심 매물 '+(saved?'저장':'해제')}
   else {if(!f)throw new Error('관심 매물로 먼저 저장해 주세요.');f.alertsEnabled=z.boolean().parse(b.enabled);detail=p.alias+' · 개별 알림 '+(f.alertsEnabled?'사용':'중지')}
  }
 }else if(['rule','toggle','generate'].includes(b.action))return json({error:'이전 조건과 알림은 보관용입니다. 최신 검토용 고객 조건을 사용하세요. 수동 알림 생성은 지원하지 않습니다.'},400);
 else return json({error:'지원하지 않는 작업입니다.'},400);
 s.audit=[{at,action:b.action,detail},...s.audit].slice(0,100);s.lastOperation=crypto.randomUUID();
 const payload=JSON.stringify(s);if(new TextEncoder().encode(payload).length>1900000)throw new Error('저장 용량 한도를 초과했습니다. 수집 범위와 이력을 점검해 주세요.');
 const write=row?db().prepare('UPDATE admin_workspace SET payload=?,revision=revision+1 WHERE id=? AND revision=?').bind(payload,'main',row.revision):db().prepare('INSERT OR IGNORE INTO admin_workspace(id,revision,payload) VALUES(?,1,?)').bind('main',payload);
 const statements=[write];
 if(batchId)statements.push(db().prepare("INSERT OR IGNORE INTO admin_event_batches(id,payload,created_at) SELECT ?,?,? FROM admin_workspace WHERE id='main' AND json_extract(payload,'$.lastOperation')=?").bind(batchId,JSON.stringify(events),at,s.lastOperation));
 if(batchId){const exported=await snapshot(s,(row?.revision??0)+1,at);statements.push(db().prepare("INSERT OR IGNORE INTO catalog_exports(sequence,version,payload) SELECT ?,?,? FROM admin_workspace WHERE id='main' AND json_extract(payload,'$.lastOperation')=?").bind(exported.sequence,exported.datasetVersion,JSON.stringify(exported),s.lastOperation));}
 const results=await db().batch(statements);if(results[0].meta.changes!==1)return json({error:'동시 변경이 감지되었습니다. 새로고침해 주세요.'},409);
 const delivery=batchId?await notifyCustomerSite().catch(()=>({ok:false,message:"자료는 저장됐지만 전달 결과를 확인하지 못했습니다. 연결 설정에서 다시 전달하세요."})):undefined;
 return json({state:s,revision:(row?.revision??0)+1,delivery});
 }catch(e){console.error(e);return json({error:e instanceof z.ZodError?'입력값을 확인하세요. '+e.issues.slice(0,3).map(i=>i.path.join('.')+': '+i.message).join(' / '):e instanceof Error?e.message:'저장에 실패했습니다.'},400)}}
