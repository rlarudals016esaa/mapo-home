import {authorizeCommute,commuteEnv,commuteJSON} from '@/lib/commute-server';
export async function GET(request:Request){
  const denied=await authorizeCommute(request);if(denied)return denied;
  // This is the intentionally browser-visible, origin-restricted ODsay Web key.
  // No server/model credentials are returned here.
  const webKey=commuteEnv('ODSAY_WEB_API_KEY');
  return commuteJSON({webKey,configured:!!webKey});
}
