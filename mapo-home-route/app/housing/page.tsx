import type {Metadata} from "next";
import {PublicHousingPanel} from "@/components/public-housing-panel";
export const metadata:Metadata={title:"청년·공공임대 소식 | 마포홈",description:"마포구 청년·공공임대 모집 공고와 서울시·SH·LH 공식 공고 안내"};
export default function HousingPage(){return <PublicHousingPanel/>;}
