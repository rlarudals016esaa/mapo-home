"use client";
import {useEffect,useState} from 'react';
import {Bell} from 'lucide-react';
type PushResponse={error?:string;enabled?:boolean;message?:string};

async function api(action:string,extra:object){
  const r=await fetch('/api/push',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...extra})});
  const data=await r.json() as PushResponse;if(!r.ok)throw new Error(data.error??'기기 알림 연결에 실패했어요.');return data;
}
async function registration(){
  await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});
  return Promise.race([navigator.serviceWorker.ready,new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error('기기 알림 준비에 시간이 걸리고 있어요. 새로고침 후 다시 시도해 주세요.')),12000))]);
}
export function PushPanel({signedIn,hasRule,ruleEnabled}:{signedIn:boolean;hasRule:boolean;ruleEnabled:boolean}){
  const [supported,setSupported]=useState(false),[iosInstall,setIosInstall]=useState(false),[embedded,setEmbedded]=useState(false);
  const [config,setConfig]=useState<{ready:boolean;publicKey:string}|null>(null),[enabled,setEnabled]=useState(false);
  const [permission,setPermission]=useState<NotificationPermission>('default'),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[message,setMessage]=useState('');
  useEffect(()=>{
    let active=true;
    const standalone=matchMedia('(display-mode: standalone)').matches||!!(navigator as Navigator&{standalone?:boolean}).standalone;
    const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
    const canPush=window.isSecureContext&&'Notification' in window&&'serviceWorker' in navigator&&'PushManager' in window;
    setSupported(canPush);setIosInstall(ios&&!standalone);setEmbedded(window.top!==window.self);
    if(canPush)setPermission(Notification.permission);
    setEnabled(false);setConfig(null);setLoading(true);
    if(!signedIn||!canPush){setLoading(false);return;}
    (async()=>{
      const r=await fetch('/api/push',{cache:'no-store'}),c=await r.json() as {ready:boolean;publicKey:string;error?:string};if(!r.ok)throw new Error(c.error);
      if(active)setConfig(c);
      const reg=await registration(),sub=await reg.pushManager.getSubscription();
      if(sub){const status=await api('status',{endpoint:sub.endpoint});if(active)setEnabled(!!status.enabled);}
    })().catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[signedIn]);
  async function enable(){
    if(!config?.ready||busy)return;
    setBusy(true);setError('');setMessage('');
    try{
      // Must happen directly in a user gesture, especially on iOS.
      const result=await Notification.requestPermission();setPermission(result);
      if(result!=='granted')throw new Error(result==='denied'?'브라우저에서 알림이 차단됐어요. 사이트 권한에서 알림을 허용한 뒤 다시 시도해 주세요.':'알림 허용을 선택해야 기기 알림을 받을 수 있어요.');
      const reg=await registration();let sub=await reg.pushManager.getSubscription();
      if(sub){
        const status=await api('status',{endpoint:sub.endpoint});
        const key=sub.options.applicationServerKey;
        const encoded=key?btoa(String.fromCharCode(...new Uint8Array(key))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''):'';
        // An unowned/expired subscription may belong to a previous account.
        // Regenerating it avoids delivering the previous account's messages.
        if(!status.enabled||encoded!==config.publicKey){await sub.unsubscribe();sub=null;}
      }
      sub??=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:config.publicKey});
      try{await api('subscribe',{subscription:sub.toJSON()});}catch(e){await sub.unsubscribe();throw e;}
      setEnabled(true);setMessage('이 기기의 알림을 켰어요. 테스트 알림으로 수신을 확인해 보세요.');
    }catch(e){setError((e as Error).message||'알림을 켜지 못했어요. 브라우저에서 사이트를 직접 열어 다시 시도해 주세요.');}finally{setBusy(false);}
  }
  async function action(kind:'unsubscribe'|'test'){
    setBusy(true);setError('');setMessage('');
    try{
      const reg=await registration(),sub=await reg.pushManager.getSubscription();
      if(!sub){setEnabled(false);throw new Error('기기 연결이 만료됐어요. 알림을 다시 켜 주세요.');}
      const result=await api(kind,{endpoint:sub.endpoint});
      if(kind==='unsubscribe'){setEnabled(false);await sub.unsubscribe();setMessage('이 기기의 알림을 껐어요. 알림함 기록은 유지돼요.');}
      else setMessage(result.message??'브라우저 알림 서비스에 전달했어요.');
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <section className="section-panel push-panel"><h3><Bell size={20}/>이 기기로 알림 받기</h3>
    <p className="muted">내 조건에 맞는 새 방과 관심 매물의 가격 변화를 사이트를 닫아도 알려드려요. 알림 내용이 잠금 화면에 표시될 수 있어요.</p>
    {!signedIn?<a className="secondary full" href="/signin-with-chatgpt?return_to=/%3Fview%3Dsettings" target="_top">로그인하고 알림 설정</a>:iosInstall?<p className="install-help">iPhone·iPad는 Safari에서 마포홈을 홈 화면에 추가하고, 추가한 앱을 열어 알림을 켜 주세요.</p>:embedded?<p className="install-help">알림을 허용하려면 <a href="/?view=settings" target="_blank" rel="noopener noreferrer">브라우저에서 마포홈 열기</a>를 눌러 주세요.</p>:!supported?<p className="install-help">이 브라우저에서는 기기 알림을 지원하지 않아요. 최신 Chrome, Edge, Firefox 또는 Safari에서 열어 주세요.</p>:loading?<p role="status">기기 알림 연결을 확인하고 있어요…</p>:!config?.ready?<p role="status">기기 알림 연결을 확인하지 못했어요. 잠시 후 새로고침해 주세요.</p>:<>
      <p className="status-pill">{enabled&&permission==='granted'?'이 기기 알림 켜짐':permission==='denied'?'브라우저 알림 차단됨':'이 기기 알림 꺼짐'}</p>
      {enabled&&permission==='granted'?<div className="push-buttons"><button type="button" className="primary" disabled={busy} onClick={()=>void action('test')}>테스트 알림 보내기</button><button type="button" className="secondary" disabled={busy} onClick={()=>void action('unsubscribe')}>이 기기 알림 끄기</button></div>:<><button type="button" className="primary full" disabled={busy} onClick={()=>void enable()}>{busy?'연결 중…':'이 기기 알림 켜기'}</button>{enabled&&<button type="button" className="text-link" disabled={busy} onClick={()=>void action('unsubscribe')}>기기 연결 해제</button>}</>}
      {permission==='denied'&&<p className="install-help">주소창의 사이트 설정에서 알림을 ‘허용’으로 바꾸고 다시 눌러 주세요.</p>}
    </>}
    {!hasRule?<p className="install-help">위에서 내 조건을 저장하면 조건에 맞는 매물 알림을 받을 수 있어요.</p>:!ruleEnabled&&<p className="install-help">현재 전체 알림이 일시 중지됐어요. 위에서 내 조건 알림을 켜 주세요.</p>}
    <p className="muted">운영자가 새 수집 자료를 반영할 때 알려드려요. 조건 저장이나 알림을 켜는 것만으로 이전 매물을 보내지는 않아요.</p>
    {error&&<p role="alert" className="error-box">{error}</p>}{message&&<p role="status" className="install-help">{message}</p>}
  </section>;
}
