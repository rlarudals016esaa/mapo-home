'use client';
import {STANDARD_HEADERS,type ImportResult} from '@/lib/standard-import';

export default function StandardizationSummary({result}:{result:ImportResult}){
 const problemCount=new Set(result.issues.map(x=>x.row)).size;
 const index=(name:typeof STANDARD_HEADERS[number])=>STANDARD_HEADERS.indexOf(name);
 return <div className="standardization-summary">
  <div className="result-grid" aria-label="자동 정리 결과">
   <div><span>원본 전체</span><strong>{result.total.toLocaleString()}건</strong></div>
   <div><span>정상 변환</span><strong>{result.rows.length.toLocaleString()}건</strong></div>
   <div><span>확인 필요</span><strong>{problemCount.toLocaleString()}건</strong></div>
  </div>
  <p>{result.format==='Listly 원본'?'Listly의 매물명·가격·유형을 찾아 표준 27개 칼럼으로 정리했습니다.':'표준 파일의 칼럼과 입력값을 다시 확인했습니다.'} 보증금·월세는 만원, 전용면적은 ㎡로 맞추고 원문·이미지 링크와 수집 출처를 보존합니다.</p>
  <details className="conversion-preview"><summary>변환 미리보기 · 처음 {Math.min(5,result.total)}건</summary>
   <div className="table-wrap"><table><thead><tr><th>매물 / 원문 가격</th><th>표준 값</th></tr></thead><tbody>
    {result.standardRows.slice(1,6).map((r,i)=>{const value=(name:typeof STANDARD_HEADERS[number])=>r[index(name)];const number=(name:typeof STANDARD_HEADERS[number],unit:string)=>value(name)===''||value(name)===null?'확인 필요':Number(value(name)).toLocaleString()+unit;return <tr key={i}>
     <td><strong>{value('매물명')||'매물명 확인 필요'}</strong><small>{value('가격원문')||'가격 원문 없음'}</small></td>
     <td><strong>{value('거래종류')} · {value('유형')}</strong><span>보증금 {number('보증금(만원)','만원')} / 월세 {number('월세(만원)','만원')}</span>{value('보증금2(만원)')!==''&&<small>두 번째 조합: {number('보증금2(만원)','만원')} / {number('월세2(만원)','만원')}</small>}<small>전용 {number('전용면적(㎡)','㎡')} · {value('검토상태')}</small></td>
    </tr>})}
   </tbody></table></div>
  </details>
 </div>
}
