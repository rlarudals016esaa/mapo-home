export function ListingSourceLink({url}:{url?:string}){
if(!url||!/^https:\/\/fin\.land\.naver\.com\/articles\/\d+$/.test(url))return <p className="source-link-missing">원본 링크 없음 · 수집 파일에 네이버 매물 링크가 없습니다.</p>;
return <a className="primary naver-source-link" href={url} target="_blank" rel="noopener noreferrer" aria-label="네이버 부동산에서 보기 (새 탭)">네이버 부동산에서 보기 <span className="new-tab-label">새 탭</span></a>;
}