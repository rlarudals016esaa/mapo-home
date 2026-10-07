'use client';
import {useState,type ReactNode} from 'react';
import type {Listing} from '@/lib/model';
export default function Unverified({rows,dong,matched,render}:{rows:Listing[];dong:string;matched:number;render:(rows:Listing[])=>ReactNode}){
 const [visible,setVisible]=useState(false),[page,setPage]=useState(0);
 const last=Math.max(0,Math.ceil(rows.length/20)-1),current=Math.min(page,last);
 if(!rows.length)return null;
 return <div className="unverified"><div className="unverified-summary"><div><strong>{dong}으로 확인된 매물 {matched}건 · 동 확인이 필요한 매물 {rows.length}건</strong><p>다른 검색 조건은 충족하지만 수집 파일에 동 정보가 없어 제외된 매물입니다. 건물명이나 역 이름만으로 {dong}이라고 판단하지 않습니다.</p></div><button aria-expanded={visible} onClick={()=>setVisible(!visible)}>{visible?'동 미확인 매물 접기':`동 미확인 ${rows.length}건 별도로 보기`}</button></div>{visible&&<section aria-label="동 확인이 필요한 매물"><div className="unverified-heading"><h3>동 확인이 필요한 매물</h3><p>아래 목록은 {dong} 확정 매물이 아닙니다. 상세 화면의 네이버 원문에서 주소를 확인하세요. {dong} 조건의 알림 대상에는 포함되지 않습니다.</p></div>{render(rows.slice(current*20,current*20+20))}<div className="pagination"><span>{rows.length}건 중 {current*20+1}–{Math.min((current+1)*20,rows.length)}</span><div><button disabled={current===0} onClick={()=>setPage(current-1)}>이전</button><span>{current+1} / {last+1}</span><button disabled={current===last} onClick={()=>setPage(current+1)}>다음</button></div></div></section>}</div>
}
