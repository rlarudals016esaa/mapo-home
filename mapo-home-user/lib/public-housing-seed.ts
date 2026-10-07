import type {HousingFeed,HousingNotice} from "./public-housing";
const checked="2026-10-06T06:45:00.000Z";
const youth=(board:string,title:string,date:string,address:string,start:string,end:string,label:string,summary:string):HousingNotice=>({
  id:"youth:"+board,source:"youth",title,publishedAt:date,
  url:`https://soco.seoul.go.kr/youth/bbs/BMSR00015/view.do?boardId=${board}&menuNo=400008&optn1=${date}`,
  address,mapoEvidence:address,category:"청년안심주택 · 민간임대",summary,
  applicationStart:start+"+09:00",applicationEnd:end+"+09:00",applicationLabel:label,
  eligibility:"청년·신혼부부 등 공급 유형별 자격은 공식 모집공고문에서 확인해 주세요.",
  withdrawn:false,firstSeenAt:checked,verifiedAt:checked,updatedAt:checked,
});
export const publicHousingSeed:HousingFeed={
  notices:[
    youth("6678","대흥역 리마크빌 마포 최초모집","2026-09-22","서울특별시 마포구 염리동 534","2026-10-01T10:00:00","2026-10-04T18:00:00","2026.10.01 10:00 ~ 10.04 18:00","공공지원 민간임대 425세대. 특별공급 86세대, 일반공급 339세대 모집 공고예요."),
    youth("6677","광흥창역 이랜드PEER신촌 추가모집","2026-09-17","서울특별시 마포구 창전동 450","2026-09-20T09:00:00","2026-09-21T17:00:00","2026.09.20 09:00 ~ 09.21 17:00","공공지원 민간임대 예비입주자 추가모집 공고예요."),
    youth("6666","공덕역 e·seo(이서) 최초모집","2026-09-15","서울특별시 마포구 염리동 172-10","2026-09-22T09:00:00","2026-09-28T23:00:00","2026.09.22 09:00 ~ 09.28 23:00","공공지원 민간임대 175세대. 특별공급 36세대, 일반공급 139세대 모집 공고예요."),
    youth("6562","광흥창역 이랜드PEER신촌 추가모집","2026-06-11","서울특별시 마포구 창전동 450","2026-06-15T09:00:00","2026-06-21T17:00:00","2026.06.15 09:00 ~ 06.21 17:00","공공지원 민간임대 타입별 예비입주자 모집 공고예요."),
  ],
  checks:[
    {source:"youth",status:"partial",checkedAt:checked,lastSuccessAt:null,message:"마포구 검색 결과 중 2026년 공고 4건의 상세 일정 확인. 이전 연도 공고는 공식 사이트에서 확인할 수 있어요."},
    {source:"sh",status:"partial",checkedAt:checked,lastSuccessAt:null,message:"마포 내용 검색 경로 확인. 개별 공고의 공급주택 목록은 추가 확인이 필요해요."},
    {source:"lh",status:"partial",checkedAt:checked,lastSuccessAt:null,message:"서울 지역 공고 검색 경로 확인. 개별 공급주택의 마포구 포함 여부는 추가 확인이 필요해요."},
  ],lastRunAt:checked,schedule:{enabled:false,time:"08:00",timezone:"Asia/Seoul",automationId:null},
};
