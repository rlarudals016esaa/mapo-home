import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {listingSchema,importSnapshot,type State} from './model';
import {digest,signedFetch,integrationConfigured} from './integration-auth';
const envelope=z.object({schemaVersion:z.literal(1),district:z.literal('마포구'),completeSnapshot:z.literal(true),sourceFile:z.string().max(150),sourceDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),collectedAt:z.string().datetime(),publishedAt:z.string().datetime(),sequence:z.number().int().nonnegative(),datasetVersion:z.string().regex(/^[a-f0-9]{64}$/),checksum:z.string().regex(/^[a-f0-9]{64}$/),listings:z.array(listingSchema).min(1).max(2000)});
export type Catalog=z.infer<typeof envelope>;
export async function validateCatalog(raw:unknown){
 const s=envelope.parse(raw);const r=raw as Catalog;const content={schemaVersion:r.schemaVersion,district:r.district,completeSnapshot:r.completeSnapshot,sourceFile:r.sourceFile,sourceDate:r.sourceDate,collectedAt:r.collectedAt,listings:r.listings};
 if(await digest(JSON.stringify(content))!==s.checksum||s.datasetVersion!==s.checksum)throw new Error('자료 검증값이 일치하지 않습니다.');
 if(new Set(s.listings.map(l=>l.id)).size!==s.listings.length||Date.parse(s.collectedAt)>Date.now()+300000)throw new Error('자료의 ID 또는 시각이 올바르지 않습니다.');
 if(s.listings.some(l=>l.trackable&&!/^naver:\d+$/.test(l.id)&&!/^test:[1-5]$/.test(l.id)))throw new Error('확인된 원문 ID가 필요합니다.');return s;
}
const db=()=>env.DB!;
export async function latestCatalog(){const row=await db().prepare('SELECT payload FROM shared_catalog ORDER BY sequence DESC LIMIT 1').first<{payload:string}>();return row?JSON.parse(row.payload) as Catalog:null;}
export async function refreshCatalog(force=false){
 if(!integrationConfigured())return {ok:false,message:'연동 설정이 필요합니다.'};
 const status=await db().prepare("SELECT payload FROM integration_status WHERE id='catalog'").first<{payload:string}>();const previous=status?JSON.parse(status.payload):null;
 if(!force&&previous?.ok&&Date.now()-Date.parse(previous.checkedAt)<60000)return previous;
 let current=await latestCatalog();let count=0;
 try{for(;count<50;count++){
   const response=await signedFetch('/api/integration/catalog?after='+(current?.sequence??-1));if(!response.ok)throw new Error('운영센터 응답 '+response.status);
   const body=await boundedJSON(response,3000000) as {snapshot:unknown};if(!body.snapshot)break;
   const next=await validateCatalog(body.snapshot);if(next.sequence<=(current?.sequence??-1)||current&&next.collectedAt<current.collectedAt)throw new Error('이전 버전은 반영할 수 없습니다.');
   await db().prepare('INSERT OR IGNORE INTO shared_catalog(sequence,version,payload) VALUES(?,?,?)').bind(next.sequence,next.datasetVersion,JSON.stringify(next)).run();
   current=await latestCatalog();
 }
 if(count===50)throw new Error('남은 자료가 있습니다. 다시 동기화해 주세요.');
 const result={ok:true,sequence:current?.sequence??-1,sourceFile:current?.sourceFile??'',count:current?.listings.length??0,checkedAt:new Date().toISOString()};await save(result);return result;
 }catch(e){console.error("Catalog synchronization failed",e instanceof Error?e.message:"Unknown error");const result={ok:false,message:'최신 자료를 확인하지 못했습니다. 마지막으로 받은 자료를 유지합니다.',checkedAt:new Date().toISOString()};await save(result);return result;}
}
async function save(value:unknown){await db().prepare("INSERT INTO integration_status(id,payload) VALUES('catalog',?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload").bind(JSON.stringify(value)).run();}
export async function boundedJSON(response:Response,max:number){const reader=response.body?.getReader();if(!reader)throw new Error('응답 없음');const chunks:Uint8Array[]=[];let size=0;while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>max){await reader.cancel();throw new Error('자료 크기 초과');}chunks.push(part.value);}const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return JSON.parse(new TextDecoder().decode(bytes));}
export function applyCatalog(s:State,snapshot:Catalog):State{
 if((s.catalogSequence??-1)>=snapshot.sequence)return s;
 const rows=snapshot.listings.map(l=>l.trackable?l:{...l,id:s.catalogSequence===undefined&&s.sourceFile===snapshot.sourceFile?l.id:'snapshot:'+snapshot.datasetVersion.slice(0,16)+':'+(l.sourceRow??l.id)});
 const next=importSnapshot(s,rows,snapshot.sourceFile,snapshot.publishedAt,snapshot.sourceDate);
 return {...next,datasetId:'catalog:'+snapshot.datasetVersion,catalogSequence:snapshot.sequence};
}
export async function reconcileCatalog(s:State){let next=s;for(let n=0;n<50;n++){const row=await db().prepare('SELECT payload FROM shared_catalog WHERE sequence>? ORDER BY sequence LIMIT 1').bind(next.catalogSequence??-1).first<{payload:string}>();if(!row)break;next=applyCatalog(next,JSON.parse(row.payload));}return next;}
