"use client";
import {useEffect,useRef,useState} from 'react';
import type {Map as LeafletMap,CircleMarker} from 'leaflet';
import type {CommutePoint} from '@/lib/commute';
import 'leaflet/dist/leaflet.css';

export function CommuteMap({initial,onPick}:{initial?:CommutePoint;onPick:(point:CommutePoint)=>void}){
  const host=useRef<HTMLDivElement>(null),map=useRef<LeafletMap|null>(null),marker=useRef<CircleMarker|null>(null);
  const [point,setPoint]=useState<{lat:number;lng:number}|null>(initial??null),[label,setLabel]=useState(initial?.label??''),[ready,setReady]=useState(false),[failed,setFailed]=useState(false);
  useEffect(()=>{
    let disposed=false;
    void import('leaflet').then(L=>{
      if(disposed||!host.current)return;
      const m=L.map(host.current,{scrollWheelZoom:false}).setView(initial?[initial.lat,initial.lng]:[37.553,126.94],initial?16:13);map.current=m;
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'}).addTo(m);
      const place=(lat:number,lng:number)=>{if(lat<33||lat>39.5||lng<124||lng>132)return;marker.current?.remove();marker.current=L.circleMarker([lat,lng],{radius:9,color:'#fff',weight:3,fillColor:'#176e62',fillOpacity:1}).addTo(m);setPoint({lat,lng});};
      if(initial)place(initial.lat,initial.lng);
      m.on('click',event=>place(event.latlng.lat,event.latlng.lng));
      setReady(true);
    }).catch(()=>setFailed(true));
    return()=>{disposed=true;map.current?.remove();map.current=null;};
  },[]); // A location picker is mounted afresh whenever it opens.
  return <div className="commute-map-wrap"><p>지도를 확대해 건물 위치를 누르세요. 키보드로 이동한 뒤 중심 위치를 선택할 수도 있어요.</p>
    <div ref={host} className="commute-map" aria-label="출발 또는 도착 위치를 선택하는 지도"/>
    {failed&&<p role="alert">지도를 불러오지 못했어요. 주소 또는 역·정류장 검색을 이용해 주세요.</p>}
    <button className="secondary" type="button" disabled={!ready} onClick={async()=>{const m=map.current;if(!m)return;const p=m.getCenter();if(p.lat<33||p.lat>39.5||p.lng<124||p.lng>132)return;const L=await import('leaflet');marker.current?.remove();marker.current=L.circleMarker(p,{radius:9,color:'#fff',weight:3,fillColor:'#176e62',fillOpacity:1}).addTo(m);setPoint({lat:p.lat,lng:p.lng});}}>지도 중심 선택</button>
    <label className="commute-label">위치 이름<input value={label} onChange={e=>setLabel(e.target.value)} maxLength={120} placeholder="예: 회사 정문, 매물 건물 입구"/></label>
    <button type="button" className="primary full" disabled={!point} onClick={()=>point&&onPick({...point,label:label.trim()||'지도에서 선택한 위치',kind:'map',extraWalk:0})}>이 위치로 선택</button>
  </div>;
}
