import Admin from './admin';
import {authorize} from '@/lib/server';
export const dynamic='force-dynamic';
export default async function Page(){try{const user=await authorize();if(!user)return <main className="access"><h1>마포홈 운영센터</h1><p>운영자 계정으로 로그인해야 열 수 있습니다.</p><a className="primary" href="/signin-with-chatgpt?return_to=%2F" target="_top">ChatGPT로 로그인</a></main>;return <Admin name={user.displayName}/>;}catch{return <main className="access"><h1>잠시 후 다시 시도해 주세요</h1><p>운영 권한 또는 저장소를 확인하지 못했습니다.</p><a href="/">다시 시도</a></main>}}
