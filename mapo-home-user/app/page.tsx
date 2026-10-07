"use client";
import {useEffect,useState} from "react";
import {Building2,Bell,MapPin,SlidersHorizontal,Search,Check,Heart,TrendingDown,Info,ArrowDownUp} from "lucide-react";
import {Tabs,TabsList,TabsTrigger} from "@/components/ui/tabs";
import {Dialog,DialogContent,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import {Select,SelectTrigger,SelectContent,SelectItem,SelectValue} from "@/components/ui/select";
import {Switch} from "@/components/ui/switch";
import {Toaster} from "@/components/ui/sonner";
import {toast} from "sonner";
import {dongs,initial,matches,money,priceLabel,priceChange,favoriteStatus,ruleSchema,type Listing,type Rule,type State,type Notice} from "@/lib/model";
import {ListingPhoto} from "@/components/listing-photo";
import {ListingSourceLink} from "@/components/listing-source-link";
import {PwaPanel} from "@/components/pwa-panel";
import {PushPanel} from "@/components/push-panel";
import {newestWithSimilarTogether,originalDateLabel} from "@/lib/listing-order";

const defaults={dong:"전체",deal:"전체",type:"전체",minPrice:"",maxPrice:"",minRent:"",maxRent:"",minArea:""};
type Draft={deal:"전세"|"월세";minPrice:string;maxPrice:string;minRent:string;maxRent:string;minArea:string;dongs:string[]};
type StateResponse={state:State;revision:number;user?:{name:string}|null;error?:string};
const emptyDraft:Draft={deal:"월세",minPrice:"",maxPrice:"",minRent:"",maxRent:"",minArea:"",dongs:[]};
const fromRule=(r?:Rule):Draft=>r?{deal:r.deal,minPrice:r.minPrice==null?"":String(r.minPrice),minRent:r.minRent==null?"":String(r.minRent),maxPrice:String(r.maxPrice),maxRent:r.maxRent===null?"":String(r.maxRent),minArea:r.minArea===null?"":String(r.minArea),dongs:r.dongs}:emptyDraft;
const date=(x:string)=>new Date(x).toLocaleString("ko-KR",{timeZone:"Asia/Seoul",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"});
function Choice({value,onChange,items,label}:{value:string;onChange:(x:string)=>void;items:string[];label:string}){return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label} className="choice"><SelectValue/></SelectTrigger><SelectContent>{items.map(x=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select>}
function BudgetRange({id,label,min,max,limit,required=false,onMin,onMax}:{id:string;label:string;min:string;max:string;limit:number;required?:boolean;onMin:(v:string)=>void;onMax:(v:string)=>void}){
  return <fieldset className="budget-range"><legend>{label} <span>만원</span></legend><div className="budget-range-row"><input id={id+"-min"} aria-label={label+" 하한"} type="number" min="0" max={limit} step="1" value={min} placeholder="하한 없음" onChange={e=>onMin(e.target.value)}/><span aria-hidden="true">~</span><input id={id} aria-label={label+" 상한"} type="number" min="0" max={limit} step="1" required={required} value={max} placeholder={required?"상한 입력":"상한 없음"} onChange={e=>onMax(e.target.value)}/></div>{required&&<p className="input-hint">하한은 선택, 상한은 필수예요.</p>}</fieldset>;
}
function Empty({title,body,children}:{title:string;body:string;children?:React.ReactNode}){return <div className="empty-state"><Search aria-hidden/><h3>{title}</h3><p>{body}</p>{children}</div>}
function Delta({l}:{l:Listing}){const c=priceChange(l);if(!c)return <p className="change">{l.history.length===1?"첫 수집 · 아직 비교 이력이 없어요":"최근 가격 인하 없음"}</p>;return <div className={"delta "+(c.priority===3?"mixed":"")}><strong>{c.priority===3?<ArrowDownUp size={15}/>:<TrendingDown size={15}/>} {c.kind}</strong><span>보증금 {money(c.oldPrice)} → {money(l.price)}{l.deal==="월세"&&<> · 월세 {money(c.oldRent)} → {money(l.rent)}</>}</span></div>}

export default function Home(){
  const [s,setS]=useState<State>(initial),[revision,setRevision]=useState(0),[loaded,setLoaded]=useState(false),[error,setError]=useState(""),[signedIn,setSignedIn]=useState(false),[busy,setBusy]=useState(false);
  const [tab,setTab]=useState("browse"),[filter,setFilter]=useState(defaults),[query,setQuery]=useState(""),[sort,setSort]=useState("최신순"),[filterOpen,setFilterOpen]=useState(false);
  const [detailId,setDetailId]=useState<string|null>(null),[loginOpen,setLoginOpen]=useState(false),[visible,setVisible]=useState(24),[onlyMatches,setOnlyMatches]=useState(false),[batchId,setBatchId]=useState<string|null>(null);
  const [draft,setDraft]=useState<Draft>(emptyDraft),[nickname,setNickname]=useState(""),[draftError,setDraftError]=useState("");
  const rule=s.rules[0],detail=s.listings.find(l=>l.id===detailId),favoriteMap=new Map(s.favorites.map(f=>[f.listingId,f]));
  const active=s.listings.filter(l=>l.active),unread=s.notices.filter(n=>!n.read).length;
  const batch=s.notices.find(n=>n.id===batchId&&n.kind==="신규 매물");

  async function load(){setError("");try{
    const r=await fetch("/api/state",{cache:"no-store"}),d=await r.json() as StateResponse;
    if(!r.ok)throw new Error(d.error);
    setS(d.state);setRevision(d.revision);setSignedIn(!!d.user);setLoaded(true);setDraft(fromRule(d.state.rules[0]));setNickname(d.state.nickname??"");
  }catch(e){setError((e as Error).message)}}
  useEffect(()=>{void load();const readLocation=()=>{const params=new URLSearchParams(location.search);setDetailId(params.get("listing"));setBatchId(params.get("batch"));const view=params.get("view");if(view&&["browse","favorites","settings","inbox"].includes(view))setTab(view);if(params.has("batch"))setTab("browse")};readLocation();window.addEventListener("popstate",readLocation);return()=>window.removeEventListener("popstate",readLocation)},[]);
  useEffect(()=>{setVisible(24)},[filter,query,sort,tab,onlyMatches,batchId]);
  async function mutate(action:string,extra:object={}){if(busy)return false;if(!signedIn){setLoginOpen(true);return false}setBusy(true);try{
    const r=await fetch("/api/state",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,revision,...extra})}),d=await r.json() as StateResponse;
    if(!r.ok){if(r.status===401)setLoginOpen(true);throw new Error(d.error)}
    setS(d.state);setRevision(d.revision);setError("");return true;
  }catch(e){toast.error((e as Error).message);return false}finally{setBusy(false)}}
  function setView(v:string){if(v==="housing"){location.assign("/housing");return;}setTab(v);setBatchId(null);if(!detailId)history.replaceState(null,"",v==="browse"?"/":"/?view="+v)}
  function openDetail(id:string){setDetailId(id);history.pushState(null,"","/?listing="+encodeURIComponent(id))}
  function closeDetail(){setDetailId(null);history.replaceState(null,"",batchId?"/?batch="+encodeURIComponent(batchId):"/")}
  function configure(){if(!loaded)return;if(!signedIn){setLoginOpen(true);return}setDraft(fromRule(rule));setNickname(s.nickname);setDraftError("");setView("settings")}
  async function heart(l:Listing){const saved=favoriteMap.has(l.id);if(await mutate("favorite",{id:l.id,saved:!saved}))toast.success(saved?"관심 매물에서 해제했어요.":"관심 매물에 저장했어요.")}
  function viewNotice(n:Notice){if(n.kind==="신규 매물"){setFilter(defaults);setQuery("");setOnlyMatches(false);setBatchId(n.id);setTab("browse");history.pushState(null,"","/?batch="+encodeURIComponent(n.id))}else openDetail(n.listingId);void mutate("read",{id:n.id})}
  function filterField(k:keyof typeof defaults,v:string){setFilter(x=>({...x,[k]:v}));setBatchId(null);setOnlyMatches(false)}
  function useFilter(){if(!signedIn){setLoginOpen(true);return}setDraft({deal:filter.deal==="전세"?"전세":"월세",minPrice:filter.minPrice,maxPrice:filter.maxPrice,minRent:filter.minRent,maxRent:filter.maxRent,minArea:filter.minArea,dongs:dongs.includes(filter.dong)?[filter.dong]:[]});setNickname(s.nickname);setDraftError("");setView("settings")}

  const filterError=(filter.minPrice!==""&&Number(filter.minPrice)<0)||(filter.deal!=="전세"&&filter.minRent!==""&&Number(filter.minRent)<0)?"금액은 0 이상으로 입력해 주세요.":filter.minPrice!==""&&filter.maxPrice!==""&&Number(filter.minPrice)>Number(filter.maxPrice)?"보증금 하한은 상한 이하여야 해요.":filter.deal!=="전세"&&filter.minRent!==""&&filter.maxRent!==""&&Number(filter.minRent)>Number(filter.maxRent)?"월세 하한은 상한 이하여야 해요.":"";
  const matchingListings=active.filter(l=>{
    if(batchId)return !!batch?.listingIds?.includes(l.id);
    if(onlyMatches)return !!rule&&matches(l,rule);
    if(filterError)return false;
    return (filter.dong==="전체"||filter.dong===l.dong)&&(filter.deal==="전체"||filter.deal===l.deal)&&(filter.type==="전체"||filter.type===l.type)&&
      (l.priceOptions??[{price:l.price,rent:l.rent}]) .some(p=>(filter.minPrice===""||p.price>=Number(filter.minPrice))&&(filter.maxPrice===""||p.price<=Number(filter.maxPrice))&&(l.deal==="전세"||((filter.minRent===""||p.rent>=Number(filter.minRent))&&(filter.maxRent===""||p.rent<=Number(filter.maxRent)))))&&
      (filter.minArea===""||l.area>=Number(filter.minArea));
  }).filter(l=>(l.name+" "+l.dong).toLowerCase().includes(query.toLowerCase()));
  const filtered=sort==="최신순"?newestWithSimilarTogether(matchingListings):matchingListings.sort((a,b)=>sort==="보증금 낮은순"?a.price-b.price:a.rent-b.rent);
  const favorites=s.listings.filter(l=>favoriteMap.has(l.id)).sort((a,b)=>Number(b.active)-Number(a.active)||(priceChange(a)?.priority??4)-(priceChange(b)?.priority??4));
  const matched=rule?active.filter(l=>matches(l,rule)):[];
  const draftCandidate={...draft,minPrice:draft.minPrice===""?null:Number(draft.minPrice),minRent:draft.deal==="전세"||draft.minRent===""?null:Number(draft.minRent),maxPrice:draft.maxPrice===""?NaN:Number(draft.maxPrice),maxRent:draft.deal==="전세"?null:draft.maxRent===""?null:Number(draft.maxRent),minArea:draft.minArea===""?null:Number(draft.minArea),enabled:rule?.enabled??true};
  const parsed=ruleSchema.safeParse(draftCandidate);
  const draftMatches=parsed.success?active.filter(l=>matches(l,{...parsed.data,id:"preview"})):[];

  useEffect(()=>{const ctx=(document as any).modelContext;if(!ctx?.registerTool)return;const life=new AbortController();Promise.resolve(ctx.registerTool({name:"show_mapo_neighborhood",description:"마포구 동네 필터를 설정하고 매물 탐색 화면으로 이동합니다.",inputSchema:{type:"object",properties:{dong:{type:"string",enum:["전체",...dongs,"동 정보 없음"]}},required:["dong"],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:(v:any)=>{if(!v||Object.keys(v).length!==1||!["전체",...dongs,"동 정보 없음"].includes(v.dong))throw new Error("마포구 동네를 지정해 주세요.");setFilter(x=>({...x,dong:v.dong}));setOnlyMatches(false);setBatchId(null);setTab("browse");return {dong:v.dong,view:"browse"}}},{signal:life.signal})).catch(()=>{});return()=>life.abort()},[]);

  function card(l:Listing){
    const f=favoriteMap.get(l.id);
    return <article className={"listing-card "+(!l.active?"unconfirmed":"")} key={l.id}>
      <ListingPhoto url={l.imageUrl} name={l.name}/>
      <div className="card-top"><div className="inline"><span className="type-tag">{l.deal}</span><span className="muted">{l.type}</span></div><button className={"heart-button "+(f?"is-saved":"")} aria-label={l.name+(f?" 관심 해제":" 관심 저장")} aria-pressed={!!f} disabled={busy} onClick={()=>heart(l)}><Heart size={21} fill={f?"currentColor":"none"}/></button></div>
      <p className="location"><MapPin size={14}/>마포구 {l.dong==="동 정보 없음"?"동네 정보 없음":l.dong}</p>
      <h3><button className="card-name" onClick={()=>openDetail(l.id)}>{l.name}</button></h3>
      <div className={"price "+((l.priceOptions?.length??0)>1?"range-price":"")}>{priceLabel(l).replace(/^(전세|월세) /,"")}</div>
      <p className="muted">전용 {l.area}㎡ · {l.floor}</p><Delta l={l}/>
      {f&&<div className="favorite-controls"><span>{favoriteStatus(l,f,rule)}</span><Switch aria-label={l.name+" 가격 알림"} checked={f.alertsEnabled} disabled={busy} onCheckedChange={enabled=>mutate("favorite-alert",{id:l.id,enabled})}/></div>}
      {!l.active&&<div className="missing-overlay"><strong>확인되지 않음</strong><span>최신 수집에서 확인되지 않았어요</span></div>}
      <div className="card-bottom"><button onClick={()=>openDetail(l.id)}>상세 정보 보기</button><span>{originalDateLabel(l)}</span></div>
    </article>;
  }
  const loginBlock=<Empty title="나의 방 찾기를 이어가세요" body="로그인하면 관심 매물과 내 조건을 저장할 수 있어요."><a className="primary" href="/signin-with-chatgpt?return_to=/" target="_top">ChatGPT로 로그인</a></Empty>;
  return <><Toaster richColors position="top-center"/>
    <header className="topbar"><a className="brand" href="/"><Building2/>마포홈<span>MAPO HOME</span></a><span className="preview-badge">원룸 · 오피스텔</span>{loaded&&!signedIn&&<a className="text-link" href="/signin-with-chatgpt?return_to=/" target="_top">로그인</a>}<button className="icon-button notification-button" aria-label={"알림함, 읽지 않은 알림 "+unread+"개"} onClick={()=>setView("inbox")}><Bell size={20}/>{unread>0&&<b>{unread}</b>}</button></header>
    <main className="shell"><div className="page-heading"><div><p className="eyebrow"><MapPin size={14}/> 서울 마포구</p><h1>내 예산에 맞는, 나의 첫 방</h1><p className="muted">마음에 드는 방은 하트로, 찾는 조건은 하나로.</p></div><button className="primary" disabled={!loaded} onClick={configure}><SlidersHorizontal size={17}/>{rule?"내 조건 수정":"내 조건 설정"}</button></div>
      <Tabs value={tab} onValueChange={setView}><TabsList className="main-tabs" variant="line"><TabsTrigger value="browse">방 둘러보기</TabsTrigger><TabsTrigger value="favorites">관심 매물 {s.favorites.length>0&&<span className="tab-count">{s.favorites.length}</span>}</TabsTrigger><TabsTrigger value="settings">내 조건</TabsTrigger><TabsTrigger value="inbox">알림함 {unread>0&&<span className="count">{unread}</span>}</TabsTrigger><TabsTrigger value="housing">청년·공공임대</TabsTrigger></TabsList></Tabs>
      {error&&<div className="error-box" role="alert">{error} <button onClick={load} className="text-link">다시 불러오기</button></div>}
      <div className="notice"><Info size={16}/><p>{loaded?<><strong>{s.sourceDate} 수집 기준</strong> · {active.length.toLocaleString()}개 매물</>:"매물 정보를 불러오는 중이에요."}</p><button className="text-link" onClick={()=>setView("settings")}>기기 알림 설정</button></div>
      {!loaded?<Empty title={error?"잠시 연결이 어려워요":"매물을 불러오고 있어요"} body={error?"위의 다시 불러오기를 눌러 주세요.":"잠시만 기다려 주세요."}/>:
      tab==="browse"?<>
        <button className="secondary mobile-filter-button" aria-expanded={filterOpen} onClick={()=>setFilterOpen(v=>!v)}><SlidersHorizontal size={17}/>검색 필터 {filterOpen?"접기":"열기"}</button>
        <div className="workspace"><aside className={"filter-panel "+(filterOpen?"mobile-open":"")}><div className="filter-title"><h3><SlidersHorizontal size={18}/>매물 필터</h3><button className="text-link" onClick={()=>{setFilter(defaults);setQuery("");setOnlyMatches(false);setBatchId(null);history.replaceState(null,"","/")}}>초기화</button></div>
          <label>거래 유형</label><div className="chips">{["전체","전세","월세"].map(x=><button key={x} aria-pressed={filter.deal===x} className={filter.deal===x?"selected":""} onClick={()=>filterField("deal",x)}>{x}</button>)}</div>
          <label>동네</label><Choice value={filter.dong} onChange={v=>filterField("dong",v)} items={["전체",...dongs,"동 정보 없음"]} label="검색 동네"/>
          <label>방 유형</label><Choice value={filter.type} onChange={v=>filterField("type",v)} items={["전체","원룸","오피스텔"]} label="검색 방 유형"/>
          <BudgetRange id="filter-deposit" label="보증금" min={filter.minPrice} max={filter.maxPrice} limit={10000000} onMin={v=>filterField("minPrice",v)} onMax={v=>filterField("maxPrice",v)}/>
          {filter.deal!=="전세"&&<BudgetRange id="filter-rent" label="월세" min={filter.minRent} max={filter.maxRent} limit={100000} onMin={v=>filterField("minRent",v)} onMax={v=>filterField("maxRent",v)}/>}
          <label htmlFor="filter-area">최소 전용면적 <small>㎡ · 선택</small></label><input id="filter-area" type="number" min="0" max="10000" step="0.1" placeholder="제한 없음" value={filter.minArea} onChange={e=>filterField("minArea",e.target.value)}/>
          {filterError&&<p className="error-box" role="alert">{filterError}</p>}<button className="primary full" disabled={!!filterError} onClick={useFilter}>이 조건으로 알림 설정</button><p className="filter-foot">묶음 매물의 가격은 원문에 있는<br/>보증금·월세 조합으로 비교해요.</p>
        </aside><section className="results-section">
          <div className="district-banner"><img src="/images/mapo-home-banner.png" alt="햇살이 비치는 주거 건물과 가로수가 있는 거리"/><div><p className="banner-message">내가 찾던 방,<br/><strong className="banner-brand">마포홈</strong>에 있을 거예요.</p></div></div>
          {rule&&!batchId&&<button className={"match-filter "+(onlyMatches?"selected":"")} aria-pressed={onlyMatches} onClick={()=>setOnlyMatches(v=>!v)}><Check size={16}/>내 저장 조건에 맞는 방만 보기 <b>{matched.length}</b></button>}
          {batchId&&<div className="batch-banner"><div><strong>{batch?"알림에 담긴 새로운 방":"알림을 찾을 수 없어요"}</strong><p>{batch?date(batch.at)+" 갱신에서 발견한 매물이에요. 최신 확인 상태에 따라 목록이 달라질 수 있어요.":"오래된 알림이거나 다른 계정의 알림일 수 있어요."}</p></div><button className="text-link" onClick={()=>{setBatchId(null);history.replaceState(null,"","/")}}>전체 보기</button></div>}
          <div className="results-heading"><h2>{onlyMatches?"내 조건에 맞는 방":"둘러볼 수 있는 방"} <span>{filtered.length.toLocaleString()}</span></h2><Choice value={sort} onChange={setSort} items={["최신순","보증금 낮은순","월세 낮은순"]} label="매물 정렬"/></div>
          {sort==="최신순"&&<p className="sort-help">원문 확인·등록일 최신순 · 같은 날짜의 유사한 매물은 나란히 보여드려요.</p>}
          <div className="search-box"><Search size={18}/><input aria-label="매물 이름 또는 동네 검색" value={query} onChange={e=>setQuery(e.target.value)} placeholder="매물 이름 또는 동네 검색"/></div>
          {!filtered.length?<Empty title="조건에 맞는 방이 없어요" body={filterError||"보증금·월세 범위를 넓히거나 다른 동네를 선택해 보세요."}/>:<div className="listing-grid">{filtered.slice(0,visible).map(card)}</div>}
          {filtered.length>visible&&<button className="secondary full" onClick={()=>setVisible(v=>v+24)}>매물 더 보기 · {visible} / {filtered.length.toLocaleString()}</button>}
        </section></div>
      </>:tab==="favorites"?<section><div className="results-heading"><div><h2>내가 마음에 담은 방 <span>{favorites.length}</span></h2><p className="muted">가격 인하를 우선 표시해요. 조건을 벗어나도 저장한 방은 남아 있어요.</p></div></div>
        {!signedIn?loginBlock:!favorites.length?<Empty title="마음에 드는 방을 담아 보세요" body="하트를 누르면 이곳에서 가격 변화와 확인 상태를 볼 수 있어요."><button className="primary" onClick={()=>setView("browse")}>방 둘러보기</button></Empty>:<>
          {!rule&&<div className="batch-banner"><p>관심 매물 알림을 받으려면 내 조건을 먼저 설정해 주세요.</p><button className="text-link" onClick={configure}>내 조건 설정</button></div>}
          <div className="listing-grid favorite-grid">{favorites.slice(0,visible).map(card)}</div>{favorites.length>visible&&<button className="secondary full" onClick={()=>setVisible(v=>v+24)}>관심 매물 더 보기</button>}
        </>}
      </section>:tab==="settings"?(!signedIn?loginBlock:<div className="settings-grid"><section className="section-panel">
        <div className="results-heading"><div><p className="eyebrow">MY ROOM PREFERENCES</p><h2>{rule?"내 조건 수정":"어떤 방을 찾으세요?"}</h2></div><span className="status-pill">조건 1개</span></div>
        <p className="muted">내 조건은 하나만 저장하며 언제든 바꿀 수 있어요.</p>
        {!!s.legacyRuleCount&&<div className="notice">이전에 저장한 조건 {s.legacyRuleCount}개를 보관했어요. 새 방식에 맞게 전세 또는 월세 조건 하나를 다시 설정해 주세요.</div>}
        <form className="preference-form" onSubmit={async e=>{e.preventDefault();setDraftError("");if(!parsed.success){setDraftError(parsed.error.issues.find(i=>i.path[0]==="minPrice"||i.path[0]==="minRent")?.message??"거래 유형과 보증금 상한을 확인해 주세요. 월세는 월세 상한도 필요해요.");return}if(await mutate("rule",{rule:parsed.data,nickname})){toast.success("내 조건을 저장했어요. 현재 매물에는 새 알림을 보내지 않아요.")}}}>
          <fieldset><legend>거래 유형 <span>필수</span></legend><div className="deal-options">{(["월세","전세"] as const).map(v=><label key={v} className={draft.deal===v?"selected":""}><input type="radio" name="deal" checked={draft.deal===v} onChange={()=>setDraft(x=>({...x,deal:v}))}/>{v}</label>)}</div></fieldset>
          <BudgetRange id="rule-deposit" label="보증금" min={draft.minPrice} max={draft.maxPrice} limit={10000000} required onMin={v=>setDraft(x=>({...x,minPrice:v}))} onMax={v=>setDraft(x=>({...x,maxPrice:v}))}/>
          {draft.deal==="월세"&&<BudgetRange id="rule-rent" label="월세" min={draft.minRent} max={draft.maxRent} limit={100000} required onMin={v=>setDraft(x=>({...x,minRent:v}))} onMax={v=>setDraft(x=>({...x,maxRent:v}))}/>}
          <fieldset><legend>원하는 동네 <span>선택 · {draft.dongs.length}/5</span></legend><p className="muted">고르지 않으면 마포구 전체에서 찾아요.</p><div className="dong-options">{dongs.map(d=><button type="button" key={d} aria-pressed={draft.dongs.includes(d)} disabled={!draft.dongs.includes(d)&&draft.dongs.length>=5} className={draft.dongs.includes(d)?"selected":""} onClick={()=>setDraft(x=>({...x,dongs:x.dongs.includes(d)?x.dongs.filter(y=>y!==d):[...x.dongs,d]}))}>{d}</button>)}</div>{draft.dongs.length>0&&<button type="button" className="text-link" onClick={()=>setDraft(x=>({...x,dongs:[]}))}>동네 선택 해제</button>}</fieldset>
          <label htmlFor="rule-area">최소 전용면적 <span>선택 · ㎡</span></label><input id="rule-area" type="number" min="0" max="10000" step="0.1" value={draft.minArea} placeholder="예: 20 · 비워 두면 면적 제한 없음" onChange={e=>setDraft(x=>({...x,minArea:e.target.value}))}/>
          <label htmlFor="nickname">알림에서 부를 이름 <span>선택</span></label><input id="nickname" maxLength={24} value={nickname} placeholder="예: 민지" onChange={e=>setNickname(e.target.value)}/>
          {draftError&&<p className="error-box" role="alert">{draftError}</p>}
          <div className="save-summary"><strong>{parsed.success?draftMatches.length+"개의 방이 현재 조건에 맞아요":parsed.error.issues.find(i=>i.path[0]==="minPrice"||i.path[0]==="minRent")?.message??"가격 상한을 입력해 주세요"}</strong><p>저장·수정 직후에는 기존 매물의 푸시를 보내지 않아요.</p></div>
          <button className="primary full" type="submit" disabled={busy}>{busy?"저장 중…":rule?"내 조건 수정 저장":"내 조건 저장"}</button>
        </form>
      </section><aside className="settings-aside">
        {rule&&<section className="section-panel"><div className="results-heading"><h3>저장된 알림 설정</h3><Switch aria-label="전체 알림 활성화" checked={rule.enabled} disabled={busy} onCheckedChange={enabled=>mutate("toggle",{enabled})}/></div><p>{rule.deal} · 보증금 {rule.minPrice!=null&&<>{money(rule.minPrice)}원 이상 · </>}{money(rule.maxPrice)}원 이하{rule.deal==="월세"&&<> · 월세 {rule.minRent!=null&&<>{money(rule.minRent)}원 이상 · </>}{money(rule.maxRent??0)}원 이하</>}</p><p className="muted">{rule.dongs.join(", ")||"마포구 전체"}{rule.minArea!==null&&" · 전용 "+rule.minArea+"㎡ 이상"}</p><p className="muted">{rule.enabled?"조건 일치 시 알림 대상":"전체 알림이 일시 중지되어 있어요."}</p><button className="secondary full" onClick={()=>{setFilter(defaults);setQuery("");setView("browse");setOnlyMatches(true)}}>현재 일치하는 방 {matched.length}개 보기</button></section>}
        <section className="section-panel"><h3>이렇게 알려드려요</h3><div className="push-preview"><div className="inline"><Building2 size={18}/><b>마포홈</b><small>발송 문구 미리보기</small></div><strong>{nickname.trim()?"새로운 방이 "+nickname.trim()+"님을 기다립니다!":"새로운 방이 기다립니다!"}</strong><p>{draftMatches[0]?draftMatches[0].type+" · "+priceLabel(draftMatches[0])+" · 조건에 맞는 방 "+draftMatches.length+"개":"가격 조건을 입력하면 일치하는 매물로 예시를 보여드려요."}</p></div><ul className="plain-list"><li>새로운 방은 한 번에 모아서</li><li>관심 매물 가격 변화는 방마다 따로</li><li>조건을 벗어나면 잠시 중지, 다시 맞으면 한 번 안내</li></ul></section>
        <PushPanel signedIn={signedIn} hasRule={!!rule} ruleEnabled={!!rule?.enabled}/><PwaPanel/>
      </aside></div>):<section className="section-panel"><div className="results-heading"><div><h2>나의 알림함</h2><p className="muted">새로운 방은 모아서, 관심 매물의 변화는 개별로 확인해요.</p></div><button className="secondary" disabled={!unread||busy} onClick={()=>mutate("read")}><Check size={16}/>모두 읽음</button></div>
        {!signedIn?loginBlock:!s.notices.length?<Empty title="아직 도착한 알림이 없어요" body="다음 수집 데이터가 연결되면 내 조건에 맞는 새로운 방과 관심 매물의 변화를 확인할 수 있어요."/>:s.notices.map(n=><article className={"notification "+(!n.read?"unread":"")} key={n.id}><div className="notification-icon"><Bell/></div><div><span className="type-tag">{n.kind}</span><h3>{n.title}</h3><p>{n.body}</p><small>{date(n.at)}</small></div><button className="text-link" onClick={()=>viewNotice(n)}>{n.kind==="신규 매물"?"새로운 방 보기":"매물 보기"}</button></article>)}
      </section>}
      <footer>마포홈<span>마포구에서 시작하는 나의 생활</span><small>{s.sourceDate} 수집 · 원룸·오피스텔 전세·월세</small></footer>
    </main>
    <Dialog open={!!detailId&&loaded} onOpenChange={v=>!v&&closeDetail()}><DialogContent className="app-dialog detail-dialog"><DialogTitle>{detail?.name??"매물을 찾을 수 없어요"}</DialogTitle><DialogDescription>{detail?"마포구 "+detail.dong+" · "+detail.type:"오래된 링크이거나 더 이상 제공되지 않는 매물일 수 있어요."}</DialogDescription>{detail&&<>
      {!detail.active&&<div className="detail-unconfirmed">확인되지 않음 · 최신 수집에서 확인되지 않았어요.</div>}
      <ListingPhoto key={detail.id} url={detail.imageUrl} name={detail.name} detail/>
      <div className="detail-price-row"><div><span className="type-tag">{detail.deal}</span><div className="price range-price">{priceLabel(detail)}</div></div><button className={"heart-button "+(favoriteMap.has(detail.id)?"is-saved":"")} aria-label={favoriteMap.has(detail.id)?"관심 해제":"관심 저장"} aria-pressed={favoriteMap.has(detail.id)} disabled={busy} onClick={()=>heart(detail)}><Heart fill={favoriteMap.has(detail.id)?"currentColor":"none"}/></button></div>
      <Delta l={detail}/>{detail.id.startsWith("test:")?<p className="source-link-missing">테스트용 가상 매물 · 가격 알림 검증용입니다. 실제 거래할 수 없습니다.</p>:<ListingSourceLink url={detail.sourceUrl}/>}
      {favoriteMap.has(detail.id)&&<div className="favorite-controls"><span>{favoriteStatus(detail,favoriteMap.get(detail.id)!,rule)}</span><Switch aria-label="이 매물 가격 알림" checked={favoriteMap.get(detail.id)!.alertsEnabled} disabled={busy} onCheckedChange={enabled=>mutate("favorite-alert",{id:detail.id,enabled})}/></div>}
      <div className="detail-facts"><p>전용 {detail.area}㎡ · {detail.floor}</p>{detail.management&&<p>{detail.management}</p>}{detail.walk&&<p>{detail.walk}</p>}{detail.direction&&<p>방향: {detail.direction}</p>}{detail.description&&<p>{detail.description}</p>}<p className="muted">{detail.confirmedAt??"원문 확인일 정보 없음"} · {detail.sourceDate??s.sourceDate} 수집</p></div>
      <h3>가격 이력</h3>{detail.history.length===1&&<p className="muted">첫 수집 가격이에요. 다음 수집부터 변화를 비교해요.</p>}
      <ol className="price-history">{[...detail.history].reverse().map((h,i)=><li key={i}><time>{date(h.at)}</time><strong>{h.priceText??(money(h.price)+(detail.deal==="월세"?" / "+money(h.rent):""))}</strong></li>)}</ol>
      {!detail.trackable&&<p className="source-link-missing">동일한 방인지 확인할 원본 식별 정보가 없어 가격 알림을 제공하기 어려워요.</p>}
      {(detail.priceOptions?.length??0)>1&&<p className="source-link-missing">여러 방의 가격을 묶어 표시한 항목이에요. 개별 방의 가격 변화 알림은 제공하지 않아요.</p>}
      <p className="muted">실제 거래 가능 여부와 최신 가격은 네이버 원본에서 확인해 주세요.</p>
    </>}</DialogContent></Dialog>
    <Dialog open={loginOpen} onOpenChange={setLoginOpen}><DialogContent className="app-dialog"><DialogTitle>마음에 드는 방을 기억할게요</DialogTitle><DialogDescription>로그인하면 관심 매물과 나만의 알림 조건을 저장할 수 있어요.</DialogDescription><a className="primary" href={"/signin-with-chatgpt?return_to="+encodeURIComponent(detailId?"/?listing="+encodeURIComponent(detailId):"/")} target="_top">ChatGPT로 로그인</a></DialogContent></Dialog>
  </>;
}
