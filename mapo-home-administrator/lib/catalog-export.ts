import {db} from './server';
import {adminInitial,type AdminState} from './admin';
import {listingSchema} from './model';
import {collectedAt} from './quality';
import {digest,signedFetch,integrationConfigured} from './integration-auth';
export async function snapshot(s:AdminState,sequence:number,at:string){
 const listings=s.listings.filter(l=>l.active).map(l=>listingSchema.parse(l));
 const content={schemaVersion:1,district:'마포구',completeSnapshot:true,sourceFile:s.sourceFile,sourceDate:s.sourceDate,collectedAt:collectedAt(s.sourceFile),listings};
 const checksum=await digest(JSON.stringify(content));return {...content,sequence,datasetVersion:checksum,checksum,publishedAt:at};
}
export async function nextSnapshot(after:number){
 const exists=await db().prepare('SELECT sequence FROM catalog_exports LIMIT 1').first();
 if(!exists){const row=await db().prepare("SELECT revision,payload FROM admin_workspace WHERE id='main'").first<{revision:number;payload:string}>();const s:AdminState=row?JSON.parse(row.payload):adminInitial();const value=await snapshot(s,row?.revision??0,collectedAt(s.sourceFile));await db().prepare('INSERT OR IGNORE INTO catalog_exports(sequence,version,payload) VALUES(?,?,?)').bind(value.sequence,value.datasetVersion,JSON.stringify(value)).run();}
 const row=await db().prepare('SELECT payload FROM catalog_exports WHERE sequence>? ORDER BY sequence LIMIT 1').bind(after).first<{payload:string}>();return row?JSON.parse(row.payload):null;
}
export async function notifyCustomerSite(){
 if(!integrationConfigured())return {ok:false,message:'연동 설정이 필요합니다.'};
 try{const response=await signedFetch('/api/integration/sync','POST','{}');const value=await response.json() as {sequence?:number;sourceFile?:string;count?:number;error?:string};if(!response.ok)throw new Error('사용자 사이트 응답 '+response.status);const result={ok:true,...value,checkedAt:new Date().toISOString()};await saveStatus(result);return result;}
 catch(e){console.error("Customer delivery failed",e instanceof Error?e.message:"Unknown error");const result={ok:false,message:'사용자 사이트 전달을 완료하지 못했습니다. 기존 자료는 유지되며 다시 전달할 수 있습니다.',checkedAt:new Date().toISOString()};await saveStatus(result);return result;}
}
async function saveStatus(value:unknown){await db().prepare("INSERT INTO integration_status(id,payload) VALUES('customer',?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload").bind(JSON.stringify(value)).run();}
export async function connectionStatus(){const row=await db().prepare("SELECT payload FROM integration_status WHERE id='customer'").first<{payload:string}>();return {configured:integrationConfigured(),lastDelivery:row?JSON.parse(row.payload):null};}
