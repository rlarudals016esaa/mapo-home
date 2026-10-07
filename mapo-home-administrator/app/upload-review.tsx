'use client';
import type {ImportResult} from '@/lib/standard-import';
import {useState} from 'react';
import StandardizationSummary from './standardization-summary';

export default function UploadReview({result,fileName,selectedRows,onSelectionChange,onExclude,busy}:{result:ImportResult;fileName:string;selectedRows:number[];onSelectionChange:(rows:number[])=>void;onExclude:()=>void;busy:boolean}){
 const issueRows=[...new Set(result.issues.map(x=>x.row))];
 const [downloading,setDownloading]=useState(false),[downloadError,setDownloadError]=useState('');
 async function download(){
  setDownloading(true);setDownloadError('');try{
  const ExcelJS=await import('exceljs');const book=new ExcelJS.Workbook();const sheet=book.addWorksheet('Sheet1');
  sheet.addRows(result.standardRows);sheet.views=[{state:'frozen',ySplit:1}];
  sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF102E3E'}};
  sheet.columns.forEach((c,i)=>{c.width=[2,16,18,19,21,22,26].includes(i)?38:20});
  result.standardRows.slice(1).forEach((r,i)=>{if(r[20]!=='정상')sheet.getRow(i+2).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFE6C9'}}});
  const data=await book.xlsx.writeBuffer();const url=URL.createObjectURL(new Blob([data],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  const a=document.createElement('a');a.href=url;a.download=fileName.replace(/^(SINGLE|MAPO)_/i,'MAPO_').replace(/\.csv$/i,'.xlsx');a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch{setDownloadError('표준 엑셀을 만들지 못했습니다. 다시 내려받아 주세요.')}finally{setDownloading(false)}
 }
 return <div className="upload-review"><h3>자동 정리 결과</h3><StandardizationSummary result={result}/><button disabled={downloading} onClick={()=>void download()}>{downloading?'표준 엑셀 만드는 중…':'표준 엑셀 내려받기'}</button>{downloadError&&<p role="alert">{downloadError}</p>}{result.issues.length>0&&<><p className="upload-blocked">확인 필요 항목을 수정하거나 이번 반영에서 제외할 수 있습니다. 제외한 행과 사유는 반영 이력에 남습니다. 내려받는 표준 엑셀에는 모든 행을 보존합니다.</p><label className="checkbox"><input type="checkbox" disabled={busy} checked={selectedRows.length===issueRows.length} onChange={e=>onSelectionChange(e.target.checked?issueRows:[])}/>확인 필요 {issueRows.length}건 모두 제외 선택</label><div className="table-wrap"><table><thead><tr><th>제외 / 매물</th><th>확인할 내용</th></tr></thead><tbody>{issueRows.slice(0,100).map(row=>{const issues=result.issues.filter(x=>x.row===row),x=issues[0];return <tr key={row}><td><label className="checkbox"><input type="checkbox" disabled={busy} aria-label={`${row}행 제외`} checked={selectedRows.includes(row)} onChange={e=>onSelectionChange(e.target.checked?[...selectedRows,row]:selectedRows.filter(n=>n!==row))}/><strong>{row}행 · {x.name||'매물명 확인 필요'}</strong></label>{x.sourceUrl&&<a href={x.sourceUrl} target="_blank" rel="noopener noreferrer">원문 확인</a>}</td><td>{issues.map((v,i)=><div key={i}>{v.message}{v.value&&<small>{v.value}</small>}</div>)}</td></tr>})}</tbody></table></div>{issueRows.length>100&&<p>처음 100개 행만 표시합니다. 전체 내용은 표준 엑셀의 검토상태·검토메모에서 확인하세요.</p>}<button className="primary" disabled={busy||!selectedRows.length} onClick={onExclude}>선택한 {selectedRows.length}건 제외하고 다시 검증</button></>}</div>
}
