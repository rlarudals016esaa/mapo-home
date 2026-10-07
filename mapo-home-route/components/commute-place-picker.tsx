"use client";
import {useEffect,useRef,useState} from 'react';
import {Search,MapPin,TrainFront,Check} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {CommuteMap} from './commute-map';
import {searchStations} from '@/lib/commute-browser';
import type {CommutePoint} from '@/lib/commute';

export function CommutePlacePicker({title,apiKey,value,onChange,hint,sourceUrl}:{title:string;apiKey:string;value?:CommutePoint;onChange:(p:CommutePoint)=>void;hint?:string;sourceUrl?:string}){
  const [open,setOpen]=useState(false),[mode,setMode]=useState<'address'|'station'|'map'>('address'),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[places,setPlaces]=useState<CommutePoint[]>([]),[error,setError]=useState(''),[searched,setSearched]=useState(false);
  const pending=useRef<AbortController|null>(null);
  useEffect(()=>()=>pending.current?.abort(),[]);
  function clearSearch(){pending.current?.abort();pending.current=null;setBusy(false);setPlaces([]);setError('');setSearched(false);}
  async function search(){
    if(query.trim().length<2){setError('두 글자 이상 입력해 주세요.');return;}
    clearSearch();const controller=new AbortController();pending.current=controller;setBusy(true);
    try {
      let result:CommutePoint[];
      if(mode==='station')result=await searchStations(apiKey,query.trim(),controller.signal);
      else {const response=await fetch('/api/commute/places',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:query.trim()}),signal:controller.signal,cache:'no-store'});const body=await response.json() as {places?:CommutePoint[];error?:string};if(!response.ok)throw new Error(body.error);result=body.places??[];}
      if(!controller.signal.aborted){setPlaces(result);setSearched(true);}
    } catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'위치를 검색하지 못했어요.');}
    finally{if(!controller.signal.aborted)setBusy(false);}
  }
  function pick(p:CommutePoint){onChange(p);setOpen(false);clearSearch();}
  return <div className="commute-location"><button type="button" className={'commute-location-button '+(value?'is-set':'')} onClick={()=>setOpen(true)}><MapPin size={18}/><span><strong>{value?value.label:'위치 선택'}</strong><small>{value?(value.kind==='station'?'역·정류장 기준':'선택한 위치 기준'):'주소를 검색하거나 지도에서 선택해 주세요'}</small></span>{value?<Check size={18}/>:<Search size={18}/>}</button>
    {value?.kind==='station'&&<label className="commute-extra-walk">집·회사와 역 사이 추가 도보<input type="number" min={0} max={120} value={value.extraWalk} onChange={e=>onChange({...value,extraWalk:Math.min(120,Math.max(0,Number(e.target.value)||0))})} aria-label={title+' 추가 도보 분'}/><span>분</span><small>0분이면 역 밖의 추가 이동은 포함하지 않아요.</small></label>}
    <Dialog open={open} onOpenChange={v=>{setOpen(v);if(!v)clearSearch();}}><DialogContent className="commute-picker-dialog"><DialogTitle>{title}</DialogTitle><DialogDescription>확인한 건물 위치를 선택해 주세요. 동네 이름만으로 매물 위치를 추정하지 않아요.</DialogDescription>
      {sourceUrl&&<a className="text-link" href={sourceUrl} target="_blank" rel="noreferrer">원본 매물에서 주소 확인</a>}
      {hint&&<p className="commute-hint">확인된 원문 주소: {hint}</p>}
      <div className="commute-segments" aria-label="위치 선택 방법">{(['address','station','map'] as const).map(v=><button key={v} type="button" aria-pressed={mode===v} onClick={()=>{setMode(v);clearSearch();}}>{v==='address'?<Search size={16}/>:v==='station'?<TrainFront size={16}/>:<MapPin size={16}/>} {v==='address'?'주소·장소':v==='station'?'역·정류장':'지도 선택'}</button>)}</div>
      {mode==='map'?<CommuteMap initial={value} onPick={pick}/>:<>
        <form className="commute-search" onSubmit={e=>{e.preventDefault();void search();}}><input aria-label={mode==='station'?'역·정류장 검색어':'주소·장소 검색어'} autoComplete="off" value={query} maxLength={150} onChange={e=>{setQuery(e.target.value);clearSearch();}} placeholder={mode==='station'?'예: 공덕역, 여의도역':'건물명 또는 주소를 입력하세요'}/><button className="primary" disabled={busy||query.trim().length<2||(mode==='station'&&!apiKey)}>{busy?'검색 중':'검색'}</button></form>
        {error&&<p className="commute-error" role="alert">{error}</p>}
        <div className="commute-place-results" aria-live="polite">{places.map((p,i)=><button key={i} type="button" onClick={()=>pick(p)}><MapPin size={17}/><span><strong>{p.label}</strong><small>{p.kind==='station'?'역·정류장 기준으로 선택':'이 주소로 선택'}</small></span></button>)}{searched&&!places.length&&<p>검색 결과가 없어요. 짧은 건물명으로 검색하거나 역·정류장 또는 지도를 이용해 주세요.</p>}</div>
        {mode==='address'&&<p className="commute-attribution">주소 검색: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a> · 상세 지번은 검색되지 않을 수 있어요.</p>}
      </>}
    </DialogContent></Dialog>
  </div>;
}
