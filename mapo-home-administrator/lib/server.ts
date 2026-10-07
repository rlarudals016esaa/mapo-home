import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
export function db(){if(!env.DB)throw new Error('저장소 연결을 확인해 주세요.');return env.DB}
export async function authorize(){
 const user=await getChatGPTUser();if(!user)return null;
 // Bootstrap is safe only behind this Site's owner-private dispatch policy.
 // After slot 1 exists, no other authenticated visitor can provision a role.
 if((env as unknown as Record<string,string>).OWNER_PRIVATE_BOOTSTRAP==='true')await db().prepare('INSERT OR IGNORE INTO administrators(slot,user_id) VALUES(1,?)').bind(user.userId).run();
 const role=await db().prepare('SELECT user_id FROM administrators WHERE slot=1').first<{user_id:string}>();
 return role?.user_id===user.userId?user:null;
}
