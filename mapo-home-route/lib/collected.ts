import {dongs,listingSchema} from "./model";
export function amount(text:string){const clean=text.replace(/,/g,"").replace(/\s/g,"");if(!/^(?:\d+(?:\.\d+)?억)?(?:\d+(?:\.\d+)?)?$/.test(clean)||!clean)throw new Error("해석할 수 없는 금액: "+text);const parts=clean.split("억");return parts.length===2?Number(parts[0])*10000+Number(parts[1]||0):Number(clean)}
export function parseCollectedRows(rows:unknown[][],fileName:string){
const dateMatch=fileName.match(/_(\d{4})(\d{2})(\d{2})_/);if(!dateMatch)throw new Error("수집일을 알 수 없습니다. SINGLE_YYYYMMDD_시각.xlsx 형식을 사용하세요.");
const sourceDate=dateMatch[1]+"-"+dateMatch[2]+"-"+dateMatch[3];if(new Date(sourceDate+"T00:00:00Z").toISOString().slice(0,10)!==sourceDate)throw new Error("유효하지 않은 수집일입니다.");
const header=(rows[0]??[]).map(v=>String(v??"").trim());const labelColumns=Array.from({length:24},(_,i)=>header.indexOf("LABEL-"+(i+1)));
if(labelColumns.slice(0,12).some(i=>i<0))throw new Error("수집 파일 LABEL 열 구성이 다릅니다.");
const data=rows.slice(1).map((r,i)=>({r,i})).filter(({r})=>r.some(v=>v!==null&&v!=="")).map(({r,i})=>{const allCells=r.map(v=>String(v??"").trim());const row=labelColumns.map(index=>index<0?"":allCells[index]??"");const name=row[3],type=row[5],sourcePriceText=row[4],deal=sourcePriceText.slice(0,2);const priceText=sourcePriceText.replace(/변동.*$/,"").trim();
if(!["원룸","오피스텔"].includes(type)||!["전세","월세"].includes(deal))throw new Error((i+2)+"행: 원룸·오피스텔 전세·월세만 지원합니다.");
const priceOptions=priceText.slice(2).trim().split(/\s*~\s*/).map(v=>{const a=v.split("/");if(a.length!==(deal==="월세"?2:1))throw new Error((i+2)+"행 금액 형식을 확인하세요.");return {price:amount(a[0]),rent:deal==="월세"?amount(a[1]):0}});
const areaCell=row.slice(6,10).find(v=>v.includes("전용"))??"";const areaMatch=areaCell.match(/전용\s*(\d+(?:\.\d+)?)/);if(!areaMatch)throw new Error((i+2)+"행 전용면적을 확인하세요.");
const articleIds=[...new Set(allCells.map(v=>v.match(/^https:\/\/fin\.land\.naver\.com\/articles\/(\d+)(?:[/?#]|$)/)?.[1]).filter((v):v is string=>!!v))];
if(articleIds.length>1)throw new Error((i+2)+"행의 네이버 매물 링크가 서로 다릅니다.");
const articleId=articleIds[0];const url=articleId?"https://fin.land.naver.com/articles/"+articleId:undefined;const dong=dongs.find(v=>name.startsWith(v+" "))??"동 정보 없음";
return listingSchema.parse({id:articleId?"naver:"+articleId:"snapshot:"+sourceDate+":"+String(i+2),district:"마포구",dong,name,type,deal,...priceOptions[0],priceOptions,priceText,sourcePriceText,area:Number(areaMatch[1]),floor:row.slice(6,10).find(v=>/층$/.test(v))??"층 정보 없음",trackable:!!articleId,sourceRow:i+2,sourceFile:fileName,sourceDate,sourceUrl:url,confirmedAt:row.find(v=>/^(확인매물|등록) \d{4}\.\d{2}\.\d{2}/.test(v)),management:row.find(v=>v.startsWith("관리비 ")),walk:row.find(v=>v.startsWith("역까지 ")),direction:row.slice(6,10).find(v=>v.endsWith("향")),description:row[9]?.replace(/^"|"$/g,"")||undefined});
});
if(new Set(data.map(x=>x.id)).size!==data.length)throw new Error("원문 매물 ID가 중복됩니다. 중복 여부를 확인해 주세요.");
return {rows:data,sourceDate};
}

