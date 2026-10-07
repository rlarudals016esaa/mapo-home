"use client";
import {useEffect,useState} from "react";
import {Building2,ExternalLink,MapPin,Info,Search} from "lucide-react";
import {housingSources,noticeStatus,type HousingNotice} from "@/lib/public-housing";
const when=(s:string)=>new Date(s).toLocaleString("ko-KR",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"});
const filters=["전체","접수 중","접수 예정","접수 마감","일정 확인 필요"] as const;
export function PublicHousingPanel(){
  const [feed,setFeed]=useState<{notices:HousingNotice[]}|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true);
  const [filter,setFilter]=useState<string>("전체"),[query,setQuery]=useState(""),[source,setSource]=useState("전체"),[now,setNow]=useState(Date.now());
  async function load(){setLoading(true);setError("");try{const r=await fetch("/api/public-housing",{cache:"no-store"});const d=await r.json() as {feed:{notices:HousingNotice[]};error?:string};if(!r.ok)throw new Error(d.error);setFeed(d.feed);setNow(Date.now());}catch{setError("공고 정보를 불러오지 못했어요. 아래 공식 사이트에서 확인해 주세요.");}finally{setLoading(false);}}
  useEffect(()=>{void load();const id=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(id);},[]);
  const list=(feed?.notices??[]).filter(n=>(filter==="전체"||noticeStatus(n,now)===filter)&&(source==="전체"||n.source===source)&&(n.title+" "+n.address).includes(query)).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)||a.id.localeCompare(b.id));
  return <>
    <header className="topbar"><a className="brand" href="/"><Building2/>마포홈<span>MAPO HOME</span></a><span className="preview-badge">청년·공공임대</span></header>
    <main className="shell housing-shell">
      <nav className="housing-navigation" aria-label="주요 메뉴"><a href="/">방 둘러보기</a><a href="/?view=favorites">관심 매물</a><a href="/?view=settings">내 조건</a><a href="/?view=inbox">알림함</a><a href="/housing" aria-current="page">청년·공공임대</a></nav>
      <div className="housing-heading"><div><p className="eyebrow"><MapPin size={15}/>서울 마포구</p><h1>청년·공공임대 소식</h1><p>마포구 공급이 확인된 모집 공고와 공식 신청 경로를 모았어요.</p></div><span className="housing-separate">공식 모집 공고</span></div>
      <section className="housing-sources" aria-label="공식 공고 사이트">
        {housingSources.map((s,i)=><a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer" className="housing-source"><span className="source-number">0{i+1}</span><div><h2>{s.name}<ExternalLink size={17}/></h2><p>{s.guide}</p><span className="source-cta">공식 공고 보기 · 새 창</span></div></a>)}
      </section>
      <div className="housing-explanation"><Info size={18}/><p>확인한 공고를 게시하며 모든 공고를 포함하지 않을 수 있어요. 신청 자격·임대료·마감 시간은 공식 공고문을 확인해 주세요. 공고는 일반 매물의 가격 알림 대상에 포함되지 않아요.</p></div>
      {error&&<div className="error-box" role="alert">{error}</div>}
      <section className="housing-notices" aria-labelledby="housing-list-heading"><div className="results-heading"><div><h2 id="housing-list-heading">확인한 모집 공고 <span>{list.length}</span></h2><p className="muted">공고일 최신순 · 마감된 공고도 보관해요.</p></div><label className="housing-source-select">출처<select aria-label="공고 출처" value={source} onChange={e=>setSource(e.target.value)}><option value="전체">전체 출처</option>{housingSources.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label></div>
        <div className="housing-filters" aria-label="접수 상태 필터">{filters.map(f=><button key={f} className={filter===f?"selected":""} aria-pressed={filter===f} onClick={()=>setFilter(f)}>{f}</button>)}</div>
        <div className="search-box"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} aria-label="공고 이름 또는 주소 검색" placeholder="공고 이름 또는 주소 검색"/></div>
        {loading&&!feed?<div className="empty-state" role="status"><h3>공고를 불러오고 있어요</h3></div>:!list.length?<div className="empty-state"><h3>{error?"공식 사이트에서 공고를 확인해 주세요":"선택한 조건으로 확인된 공고가 없어요"}</h3><p>다른 접수 상태를 선택하거나 위의 공식 사이트에서 확인해 주세요.</p></div>:<div className="housing-grid">{list.map(n=>{const status=noticeStatus(n,now);const newly=feed&&n.firstSeenAt!=="2026-10-06T06:45:00.000Z"&&now-Date.parse(n.firstSeenAt)<7*86400000;return <article className="housing-card" key={n.id}>
          <div className="housing-card-top"><span className={"housing-status "+(status==="접수 중"?"open":status==="접수 예정"?"upcoming":status==="접수 마감"?"closed":"unknown")}>{status}</span>{newly&&<span className="housing-new">새로 확인</span>}<span className="housing-provider">{housingSources.find(s=>s.id===n.source)?.name}</span></div>
          <p className="housing-category">{n.category}</p><h3>{n.title}</h3><p className="housing-address"><MapPin size={15}/>{n.address}</p><p className="housing-summary">{n.summary}</p>
          <dl><div><dt>공고일</dt><dd>{n.publishedAt.replaceAll("-",".")}</dd></div><div><dt>접수 기간</dt><dd>{n.applicationLabel}</dd></div><div><dt>신청 대상</dt><dd>{n.eligibility}</dd></div></dl>
          <div className="housing-card-bottom"><a className="secondary" href={n.url} target="_blank" rel="noopener noreferrer">공식 공고 보기<ExternalLink size={15}/><span className="sr-only">새 창</span></a><small>상세 확인 {when(n.verifiedAt)}</small></div>
        </article>})}</div>}
      </section>
      <footer>마포홈<span>청년·공공임대 소식</span><small>신청과 계약은 각 공식 기관에서 진행해 주세요.</small></footer>
    </main>
  </>;
}
