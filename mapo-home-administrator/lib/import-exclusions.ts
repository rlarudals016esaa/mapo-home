import type {ImportResult} from './standard-import';
export type ImportExclusion={row:number;name:string;reason:string;sourceUrl?:string};
// Exclusions are explicit, bounded and limited to rows rejected by the shared validator.
export function reviewExclusions(result:ImportResult,excludedRows:number[]){
 if(new Set(excludedRows).size!==excludedRows.length)throw new Error('제외 행이 중복되었습니다.');
 const rejected=new Set(result.issues.map(x=>x.row));
 if(excludedRows.some(row=>!Number.isInteger(row)||!rejected.has(row)))throw new Error('확인 필요로 표시된 행만 제외할 수 있습니다.');
 const selected=new Set(excludedRows);
 const unresolved=result.issues.filter(x=>!selected.has(x.row));
 const exclusions:ImportExclusion[]=[...excludedRows].sort((a,b)=>a-b).map(row=>{const issues=result.issues.filter(x=>x.row===row);return {row,name:issues[0].name,reason:[...new Set(issues.map(x=>x.message))].join(' / '),sourceUrl:issues[0].sourceUrl}});
 return {unresolved,exclusions};
}
