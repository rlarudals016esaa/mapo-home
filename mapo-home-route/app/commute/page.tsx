import type {Metadata} from 'next';
import {CommutePanel} from '@/components/commute-panel';
import './commute.css';
export const metadata:Metadata={title:'출퇴근 비교 | 마포홈',description:'관심 매물에서 직장·학교까지 대중교통 시간과 환승, 도보를 비교해 보세요.'};
export default function CommutePage(){return <CommutePanel/>;}
