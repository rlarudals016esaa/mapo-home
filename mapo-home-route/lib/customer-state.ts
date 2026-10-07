import {env} from 'cloudflare:workers';
import {migrateState} from './baseline';
import {reconcileCatalog} from './catalog';

// State and delivery records commit together. A losing optimistic update cannot
// enqueue messages, and a retry after a crash sees the already-saved notice IDs.
export async function synchronizedState(id:string){
  const db=env.DB!;
  for(let attempt=0;attempt<3;attempt++){
    const row=await db.prepare('SELECT revision,payload FROM workspaces WHERE id=?').bind(id).first<{revision:number;payload:string}>();
    const before=migrateState(row?JSON.parse(row.payload):null),state=await reconcileCatalog(before);
    if(state===before)return {state,revision:row?.revision??0};
    const payload=JSON.stringify(state);
    if(new TextEncoder().encode(payload).length>1900000)throw new Error('사용자 이력 저장 용량을 확인해 주세요.');
    const oldIds=new Set(before.notices.map(n=>n.id));
    const notices=state.notices.filter(n=>!oldIds.has(n.id));
    const token=crypto.randomUUID(),revision=(row?.revision??0)+1;
    const save=row
      ?db.prepare('UPDATE workspaces SET payload=?,revision=revision+1,push_commit=? WHERE id=? AND revision=?').bind(payload,token,id,row.revision)
      :db.prepare('INSERT OR IGNORE INTO workspaces(id,revision,payload,push_commit) VALUES(?,1,?,?)').bind(id,payload,token);
    const result=await db.batch([save,db.prepare(`INSERT OR IGNORE INTO push_outbox(id,user_id,subscription_id,payload,created_at)
      SELECT s.id || ':' || json_extract(n.value,'$.id'),s.user_id,s.id,n.value,?
      FROM push_subscriptions s,json_each(?) n
      WHERE s.user_id=? AND s.created_at<=json_extract(n.value,'$.at')
        AND EXISTS(SELECT 1 FROM workspaces WHERE id=? AND revision=? AND push_commit=?)`)
      .bind(Date.now(),JSON.stringify(notices),id,id,revision,token)]);
    if(result[0].meta.changes===1)return {state,revision};
  }
  throw new Error('동시 변경이 발생했습니다. 새로고침해 주세요.');
}
