import {matches,type Listing,type Rule} from './model';
export type CollectionFilter={type:string;deal:string;dong:string;status:string;query:string};
export function collectionResults(rows:Listing[],f:CollectionFilter){
 const words=f.query.trim().toLocaleLowerCase('ko-KR').split(/\s+/).filter(Boolean);
 const base=rows.filter(l=>(f.status==='전체'||(f.status==='현재 수집'?l.active:!l.active))&&(f.type==='전체'||l.type===f.type)&&(f.deal==='전체'||l.deal===f.deal)&&words.every(word=>[l.name,l.dong,l.type,l.deal,l.id].join(' ').toLocaleLowerCase('ko-KR').includes(word)));
 return {matched:base.filter(l=>f.dong==='전체'||l.dong===f.dong),unverified:specificDong(f.dong)?base.filter(l=>l.dong==='동 정보 없음'):[]};
}
export function specificDong(dong:string){return dong!=='전체'&&dong!=='동 정보 없음'}
export function unverifiedForRule(rows:Listing[],rule:Rule){return specificDong(rule.dong)?rows.filter(l=>l.dong==='동 정보 없음'&&matches(l,{...rule,dong:'전체'})):[]}
