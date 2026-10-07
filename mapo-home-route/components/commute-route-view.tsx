"use client";

import {useRef,useState} from 'react';
import {Bus,ChevronDown,ChevronRight,Flag,Footprints,MapPin,TrainFront} from 'lucide-react';
import type {CommutePoint,CommuteRoute} from '@/lib/commute';

const minutes=(value:number)=>Math.round(value*10)/10;
const shortName=(label:string)=>label.split(' · ')[0];
const rides=(route:CommuteRoute)=>route.segments.filter(step=>step.mode!=='walk');
function routeTitle(route:CommuteRoute){
  const transit=rides(route);
  if(transit.length===1){const step=transit[0];return `${step.mode==='bus'?'버스 '+step.name:step.name} · ${step.from} → ${step.to}`;}
  return transit.map(step=>step.mode==='bus'?`${step.name}번 버스`:step.name).join(' → ');
}

export function CommuteRouteView({routes,origin,destination}:{routes:CommuteRoute[];origin:CommutePoint;destination:CommutePoint}){
  const [selectedId,setSelectedId]=useState(routes[0]?.id),[expanded,setExpanded]=useState(false);
  const heading=useRef<HTMLDivElement>(null);
  const selected=routes.find(route=>route.id===selectedId)??routes[0];
  if(!selected)return null;
  const alternatives=routes.filter(route=>route.id!==selected.id);
  const transit=rides(selected);
  const extraWalk=origin.extraWalk+destination.extraWalk;
  function choose(id:string){setSelectedId(id);setExpanded(false);heading.current?.focus({preventScroll:true});heading.current?.scrollIntoView({behavior:'smooth',block:'nearest'});}

  return <section className="commute-journey" aria-label="선택한 경로 상세">
    <div ref={heading} tabIndex={-1} className="commute-compact-summary" aria-live="polite" aria-label="선택한 경로 요약">
      <strong>{minutes(selected.minutes)}<span>분</span></strong>
      <span>환승 <b>{selected.transfers}회</b> · 도보 <b>{minutes(selected.walkMinutes)}분</b></span>
    </div>
    <div className="commute-compact-route">
      <p>{shortName(origin.label)} → {shortName(destination.label)}</p>
      <div className="commute-compact-lines">{transit.map((step,index)=><div key={index}>
        <span className="commute-compact-line">{step.name.replace(/^수도권 /,'')}</span>
        <span>{step.mode==='bus'?'버스':'지하철'} {minutes(step.minutes)}분</span>
      </div>)}</div>
      <small>{extraWalk>0?`추가 도보 ${minutes(extraWalk)}분 포함`:origin.kind==='station'||destination.kind==='station'?'역·정류장 기준 · 역 밖 추가 도보 미포함':'선택한 위치 기준'}</small>
    </div>
    <details className="commute-detail-disclosure">
      <summary>상세 경로 보기<ChevronDown size={20} aria-hidden="true"/></summary>
    <ol className="commute-timeline" aria-label="이동 순서">
      {selected.segments.map((step,index)=>{
        const first=index===0,last=index===selected.segments.length-1;
        const previousRide=selected.segments.slice(0,index).filter(item=>item.mode!=='walk').at(-1);
        const nextRide=selected.segments.slice(index+1).find(item=>item.mode!=='walk');
        const walking=step.mode==='walk';
        const Icon=walking?(first?MapPin:Footprints):step.mode==='bus'?Bus:TrainFront;
        const title=walking?(first?`${shortName(origin.label)}에서 출발`:last?'하차 후 도보 이동':'환승을 위한 도보 이동'):(step.mode==='bus'?'버스 탑승':'지하철 탑승');
        const description=walking?(first?`출발지에서 ${nextRide?.mode==='bus'?'정류장':'역'}까지`:last?`${previousRide?.to||'하차 지점'}${previousRide?.mode==='bus'?' 정류장':' 역'}부터 도착지까지`:'다음 탑승 지점까지 이동'):`${step.from} → ${step.to}`;
        return <li key={index}>
          <span className={'commute-timeline-icon '+(walking?'':'transit')}><Icon size={18} aria-hidden="true"/></span>
          <div className="commute-timeline-copy"><strong>{title}</strong><p>{description}</p>
            {!walking&&<div className="commute-line-badges">{step.name.split(' / ').map((name,i)=><span key={i}>{name}</span>)}</div>}
          </div>
          <span className="commute-timeline-time">{first&&walking?'도보 ':''}{minutes(step.minutes)}분</span>
        </li>;
      })}
      {extraWalk>0&&<li><span className="commute-timeline-icon"><Flag size={18} aria-hidden="true"/></span><div className="commute-timeline-copy"><strong>추가 도보 포함</strong><p>직접 입력한 출발·도착 역 밖 이동시간</p></div><span className="commute-timeline-time">{minutes(extraWalk)}분</span></li>}
    </ol>
    {alternatives.length>0&&<div className="commute-other-routes"><h5>다른 경로</h5>
      {(expanded?alternatives:alternatives.slice(0,2)).map(route=><button key={route.id} type="button" className="commute-other-route" onClick={()=>choose(route.id)} aria-label={`${minutes(route.minutes)}분 경로 선택: ${routeTitle(route)}`}>
        <span className="commute-other-time"><strong>{minutes(route.minutes)}</strong>분</span>
        <span className="commute-other-copy"><strong>{routeTitle(route)}</strong><span>환승 {route.transfers}회 · 도보 {minutes(route.walkMinutes)}분</span></span>
        <ChevronRight size={18} aria-hidden="true"/>
      </button>)}
      {alternatives.length>2&&<button type="button" className="commute-more-routes" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>{expanded?'다른 경로 접기':`다른 경로 ${alternatives.length-2}개 더 보기`}</button>}
    </div>}
    <p className="commute-journey-note">편도 예상 시간 · ODsay{selected.fare!==null?` · 교통 API 기준 요금 ${selected.fare.toLocaleString()}원`:''}</p>
    </details>
  </section>;
}
