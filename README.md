# mapo-home

마포구 원룸·오피스텔 전월세를 찾는 사용자를 위한 마포홈입니다.

사용자 사이트 소스는 `mapo-home-user/`, 운영자 사이트 소스는 `mapo-home-administrator/`에 있습니다.

## 실행

Node.js 22.13 이상에서 사용자 사이트 폴더로 이동하여 `npm ci`, `npm run dev`를 실행합니다. 운영 배포에는 Sites 인증·Cloudflare D1 및 별도 연동 환경 설정이 필요합니다.

운영자 사이트도 `mapo-home-administrator/`에서 `npm ci`, `npm run dev`로 실행합니다. 매물 검색, Listly 파일 표준화·검증, 반영 전 비교, 가격 변화, 내부 알림 검토, 업데이트 이력과 사용자 사이트 연동을 포함합니다. 업로드 자료는 운영자가 확정한 뒤 전달합니다.

운영자 파일 형식은 `mapo-home-administrator/IMPORT-FORMAT.md`, 사이트 간 연동은 `mapo-home-administrator/INTEGRATION-LIVE.md`를 참고하세요. 비밀키, 로컬 데이터베이스, 설치된 의존성과 빌드 결과물은 포함하지 않습니다. GitHub에 소스를 푸시하는 작업과 운영 사이트 배포는 별도입니다.

일부 검증 스크립트는 개발 당시 원본 XLSX, `outputs/`, `.sites-runtime/`의 테스트 자료 또는 실행 중인 로컬 서버가 필요합니다. 해당 자료는 저장소에 포함되지 않으므로 실행 전에 스크립트의 경로와 준비 조건을 확인하세요.

조건 검색, 관심 매물, 알림함, 청년·공공임대 공고, 운영센터 데이터 수신, PWA 설치 안내를 포함합니다. 휴대폰 푸시 구독·서버 발송은 아직 구현되지 않았습니다.
