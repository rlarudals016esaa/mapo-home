"use client";
import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,Building2,Route,Clock,Footprints,TrainFront,MapPin,Check,RotateCcw,Info} from 'lucide-react';
import {isListingImageUrl} from '@/lib/image-url';
import {CommutePlacePicker} from '@/components/commute-place-picker';
import {priceLabel,type Listing,type State} from '@/lib/model';
import {defaultPreferences,sortedRoutes,compareRoutes,type CommutePoint,type CommutePreferences,type CommuteResult} from '@/lib/commute';
import {CommuteRouteView} from '@/components/commute-route-view';
import {findRoutes} from '@/lib/commute-browser';

const knownAddresses:Record<string,string>={'naver:2652912578':'서울시 마포구 도화동 196-29'};
function CommutePhoto({url,name}:{url?:string;name:string}){const [failed,setFailed]=useState(false);return url&&isListingImageUrl(url)&&!failed?<img src={url} alt={name+' 매물 사진'} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>:<Building2 aria-label="매물 사진 없음"/>;}


export function CommutePanel(){
  const [favorites,setFavorites]=useState<Listing[]>([]),[selected,setSelected]=useState<string[]>([]),[origins,setOrigins]=useState<Record<string,CommutePoint>>({}),[destination,setDestination]=useState<CommutePoint>();
  const [loaded,setLoaded]=useState(false),[signedIn,setSignedIn]=useState(false),[error,setError]=useState(''),[apiKey,setApiKey]=useState(''),[configError,setConfigError]=useState('');
  const [preferences,setPreferences]=useState<CommutePreferences>(defaultPreferences),[results,setResults]=useState<CommuteResult[]>([]),[searched,setSearched]=useState(false),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[checkedAt,setCheckedAt]=useState(''),[selectionNotice,setSelectionNotice]=useState('');
  const requestRef=useRef<AbortController|null>(null),resultRef=useRef<HTMLElement>(null);
  async function load(){
    setError('');setLoaded(false);
    try {
      const response=await fetch('/api/state',{cache:'no-store'});const data=await response.json() as {state:State;user:unknown;error?:string};if(!response.ok)throw new Error(data.error);
      setSignedIn(!!data.user);const ids=new Set(data.state.favorites.map(f=>f.listingId));setFavorites(data.state.listings.filter(l=>ids.has(l.id)));
      if(data.user){const config=await fetch('/api/commute/config',{cache:'no-store'});const body=await config.json() as {configured?:boolean;webKey?:string};if(config.ok&&body.configured&&body.webKey){setApiKey(body.webKey);setConfigError('');}else setConfigError('교통 서비스 연결 설정이 필요해요. 설정 후 새로고침해 주세요.');}
    }catch(e){setError(e instanceof Error?e.message:'관심 매물을 불러오지 못했어요.');}finally{setLoaded(true);}
  }
  useEffect(()=>{void load();return()=>requestRef.current?.abort();},[]);
  function invalidate(){requestRef.current?.abort();requestRef.current=null;setBusy(false);setResults([]);setSearched(false);setProgress(0);setCheckedAt('');}
  function toggle(id:string){setSelectionNotice('');if(selected.includes(id)){invalidate();setSelected(selected.filter(x=>x!==id));return;}if(selected.length===3){setSelectionNotice('한 번에 최대 3개까지 비교할 수 있어요. 선택한 방을 해제해 주세요.');return;}invalidate();setSelected([...selected,id]);}
  const chosen=favorites.filter(l=>selected.includes(l.id));
  const valid=chosen.length>0&&chosen.length===selected.length&&!!destination&&chosen.every(l=>!!origins[l.id]&&l.active)&&!!apiKey;
  async function compare(){
    if(!valid||!destination||busy)return;invalidate();const controller=new AbortController();requestRef.current=controller;setBusy(true);const done:CommuteResult[]=[];
    for(const listing of chosen){
      if(controller.signal.aborted)return;
      const origin=origins[listing.id];
      try {done.push({listingId:listing.id,origin,destination,routes:await findRoutes(apiKey,origin,destination,controller.signal)});}
      catch(e){if(controller.signal.aborted)return;done.push({listingId:listing.id,origin,destination,routes:[],error:e instanceof Error?e.message:'경로를 조회하지 못했어요.'});}
      if(controller.signal.aborted)return;setProgress(done.length);
    }
    if(controller.signal.aborted)return;
    setResults(done);setSearched(true);setBusy(false);setCheckedAt(new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Seoul'}));requestRef.current=null;
    requestAnimationFrame(()=>resultRef.current?.scrollIntoView({behavior:'smooth',block:'start'}));
  }
  const ranked=useMemo(()=>results.map(r=>({...r,best:sortedRoutes(r.routes,preferences)[0],eligible:sortedRoutes(r.routes,preferences)})).sort((a,b)=>{
    if(!a.best)return b.best?1:0;if(!b.best)return -1;
    return compareRoutes(a.best,b.best,preferences);
  }),[results,preferences]);
  const eligibleCount=ranked.filter(r=>r.best).length;

  return <><header className="topbar"><a className="brand" href="/"><Building2/>마포홈<span>MAPO HOME</span></a><a className="text-link" href="/?view=favorites"><ArrowLeft size={16}/> 관심 매물</a></header>
    <main className="shell commute-shell"><div className="commute-heading"><div><p className="eyebrow"><Route size={15}/> 나의 출퇴근</p><h1>어느 방에서 더 편하게 다닐까요?</h1><p>관심 매물 최대 3개의 대중교통 시간·환승·도보를 비교해 보세요.</p></div><span className="commute-privacy">목적지와 위치 선택은 저장하지 않아요</span></div>
      {!loaded?<div className="commute-empty" role="status">관심 매물을 불러오고 있어요.</div>:error?<div className="commute-empty" role="alert"><h2>잠시 연결이 어려워요</h2><p>{error}</p><button className="primary" onClick={()=>void load()}>다시 불러오기</button></div>:!signedIn?<div className="commute-empty"><h2>마음에 담은 방에서 비교를 시작하세요</h2><p>로그인하면 저장한 관심 매물을 불러올 수 있어요.</p><a className="primary" href="/signin-with-chatgpt?return_to=/commute" target="_top">ChatGPT로 로그인</a></div>:!favorites.length?<div className="commute-empty"><MapPin size={30}/><h2>먼저 마음에 드는 방을 담아 주세요</h2><p>매물의 하트를 누르면 출퇴근 비교에 사용할 수 있어요.</p><a className="primary" href="/">방 둘러보기</a></div>:<>
        {configError&&<div className="commute-error" role="alert">{configError}</div>}
        <div className="commute-workspace"><section className="commute-main"><div className="commute-section-title"><div><span>01</span><h2>비교할 방 선택</h2></div><strong>{selected.length} / 3</strong></div>
          <p className="commute-muted">방을 고른 뒤 실제 출발 위치를 확인해 주세요.</p>
          {selectionNotice&&<p role="status" className="commute-hint">{selectionNotice}</p>}
          <div className="commute-listings">{favorites.map(l=><article key={l.id} className={'commute-listing '+(selected.includes(l.id)?'selected':'')+(!l.active?' inactive':'')}>
            <label className="commute-listing-choice"><input type="checkbox" checked={selected.includes(l.id)} disabled={!l.active} onChange={()=>toggle(l.id)} aria-label={l.name+' '+l.id+' 통근 비교 선택'}/><div className="commute-photo"><CommutePhoto url={l.imageUrl} name={l.name}/></div><div className="commute-listing-info"><small>{l.type} · {l.dong}</small><strong>{l.name}</strong><b>{priceLabel(l)}</b><small>전용 {l.area}㎡ · {l.floor}</small>{!l.active&&<em>최신 수집에서 확인되지 않은 매물이에요</em>}</div><span className="commute-choice-mark" aria-hidden>{selected.includes(l.id)&&<Check size={16}/>}</span></label>
            {selected.includes(l.id)&&<div className="commute-origin"><div className="commute-origin-title"><span>출발 위치</span><a href={'/?listing='+encodeURIComponent(l.id)} target="_blank" rel="noreferrer">매물 상세</a></div><CommutePlacePicker title={l.name+' 출발 위치'} value={origins[l.id]} apiKey={apiKey} sourceUrl={l.sourceUrl} hint={knownAddresses[l.id]} onChange={p=>{invalidate();setOrigins(prev=>({...prev,[l.id]:p}));}}/>{!origins[l.id]&&<p className="commute-muted">원문 주소를 확인하거나, 알고 있는 위치를 지도에서 선택해 주세요.</p>}</div>}
          </article>)}</div>
        </section><div className="commute-sidebar"><section className="commute-setup"><div className="commute-section-title"><div><span>02</span><h2>어디로 다니세요?</h2></div></div><p className="commute-muted">직장·학교의 주소나 가까운 역을 선택하세요.</p><CommutePlacePicker title="직장·학교 도착 위치" apiKey={apiKey} value={destination} onChange={p=>{invalidate();setDestination(p);}}/>
          <div className="commute-checklist"><div><Check size={15}/><span>버스·지하철과 도보 구간 비교</span></div><div><Info size={15}/><span>실시간 지연·혼잡은 반영하지 않은 예상 시간이에요.</span></div><div><MapPin size={15}/><span>역 기준이면 집·회사까지의 추가 도보를 직접 입력할 수 있어요.</span></div></div>
          <button className="primary full commute-compare" disabled={!valid||busy} onClick={()=>void compare()}><Route size={18}/>{busy?`경로 조회 중 ${progress} / ${chosen.length}`:'출퇴근 비교하기'}</button>
          {!valid&&<p className="commute-muted">{!selected.length?'비교할 방을 먼저 선택해 주세요.':!destination?'도착 위치를 선택해 주세요.':!chosen.every(l=>origins[l.id])?'선택한 방의 출발 위치를 모두 확인해 주세요.':configError||'선택한 매물을 확인해 주세요.'}</p>}
          {busy&&<button className="text-link" onClick={invalidate}>조회 취소</button>}
        </section>
        {searched&&<section className="commute-results" ref={resultRef} aria-live="polite"><div className="commute-section-title"><div><h2>선택한 방의 예상 경로</h2></div>{searched&&<small>{checkedAt} 조회 · ODsay</small>}</div>
          <details className="commute-filter-disclosure"><summary>비교 조건 · {preferences.sort==='time'?'빠른 순':preferences.sort==='transfers'?'환승 적은 순':'도보 적은 순'}{preferences.maxMinutes!==null?` · ${preferences.maxMinutes}분 이내`:''}{preferences.maxTransfers!==null?` · 환승 ${preferences.maxTransfers}회 이하`:''}</summary><div className="commute-filters"><div className="commute-segments" aria-label="통근 경로 정렬">{([{id:'time',label:'가장 빠른 순',icon:Clock},{id:'transfers',label:'환승 적은 순',icon:TrainFront},{id:'walk',label:'도보 적은 순',icon:Footprints}] as const).map(({id,label,icon:Icon})=><button type="button" key={id} aria-pressed={preferences.sort===id} onClick={()=>setPreferences(p=>({...p,sort:id}))}><Icon size={16}/>{label}</button>)}</div><div className="commute-limits"><label>편도 시간<select value={preferences.maxMinutes??''} onChange={e=>setPreferences(p=>({...p,maxMinutes:e.target.value?Number(e.target.value):null}))}><option value="">제한 없음</option>{[20,30,40,50,60,90].map(n=><option key={n} value={n}>{n}분 이내</option>)}</select></label><label>환승<select value={preferences.maxTransfers??''} onChange={e=>setPreferences(p=>({...p,maxTransfers:e.target.value===''?null:Number(e.target.value)}))}><option value="">제한 없음</option><option value="0">환승 없이</option><option value="1">1회 이하</option><option value="2">2회 이하</option></select></label><button className="text-link" onClick={()=>setPreferences(defaultPreferences)}><RotateCcw size={14}/>조건 초기화</button></div></div></details>
          <>
            <div className="commute-result-summary" hidden={results.length===1&&!results.some(r=>r.error)}><strong>조건에 맞는 방 {eligibleCount}개</strong><span>선택한 {results.length}개 중 · {results.filter(r=>r.error).length}개 조회 실패</span></div>
            {!eligibleCount&&results.some(r=>r.routes.length>0)&&<p className="commute-hint">조회된 경로 중 이 조건에 맞는 경로가 없어요. 시간·환승 제한을 바꿔 보세요.</p>}
            <div className="commute-result-grid">{ranked.map((r,index)=>{const l=favorites.find(l=>l.id===r.listingId)!;return <article key={r.listingId} className={'commute-result-card '+(r.best&&index===0?'recommended':'')}>{results.length>1&&<div className="commute-result-top"><span>{r.best&&index===0?'현재 조건의 첫 번째 후보':r.error?'조회 실패':r.best?'비교 후보':'조건 불일치'}</span></div>}<div className="commute-result-property"><h3>{l.name}</h3></div>
              {r.error?<div className="commute-error">{r.error}</div>:r.best?<CommuteRouteView key={[preferences.sort,preferences.maxMinutes,preferences.maxTransfers].join(':')} routes={r.eligible} origin={r.origin} destination={r.destination}/>:<div className="commute-no-route">조회된 {r.routes.length}개 경로가 현재 시간·환승 조건을 충족하지 않아요.</div>}
            </article>;})}</div><p className="commute-result-note">실제 대기·혼잡 상황에 따라 예상 시간과 다를 수 있어요.</p>
          </>
        </section>}</div></div>
      </>}
    </main></>;
}
