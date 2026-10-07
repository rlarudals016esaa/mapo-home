# vinext-starter

## Mapo public housing daily update

The separate customer page is `/housing`. Ordinary rental listing records and customer alerts are unaffected. The durable shared feed is stored in the D1 `public_housing` table. No API key from `.env.local` is used by this feed.

The authoritative unattended update plan is `lib/housing-update-instructions.ts`, retrievable by a fresh scheduled task at `GET /api/public-housing/instructions`. It documents official source queries, Mapo address verification, the notice schema, revision-aware merge, failure handling and readback. The current Site is owner-private; non-user writes rely on the Sites dispatch service credential returned by `get_site`, not an interactive visitor cookie. Never widen access without revisiting writer authorization. No credentials belong in this document or schedule prompts.

Each scheduled run obtains its own Site service access, reads instructions and the feed, checks the three official portals, then posts verified additions/corrections to `/api/public-housing/update`. Missing/blocked sources retain saved records and get a partial/error check entry. Application status is computed from verified Korean-time boundaries, otherwise shown as unknown. Normal data updates require no deployment. The schedule runs at 08:00 Asia/Seoul; only mark `feed.schedule.enabled` after the scheduler confirms creation. Source fetch and service write/readback must be verified before scheduling.

A clean full-stack starter running on [vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`
- Portable: Windows, macOS, or Linux; no Bash required
- Managed Linux: managed Linux runtime with Bash, `flock`, `curl`, `sha256sum`, and GNU `timeout`
- Git is required only for publishing

## Sites Lifecycle

The Sites initializer copies the shared starter and selects managed-linux only when `SITES_MANAGED_LINUX_CONTAINER=1`; otherwise it selects portable. It saves the selection only in ignored `.sites-runtime/execution-profile.json`. Both profiles copy/configure first, then use the plugin's separate `install-dependencies.mjs` step to measure installation independently. Edit source under `app/` and follow the Sites skill for installation, preview, builds, and publishing.

Run `node <plugin-root>/scripts/configure-execution-profile.mjs` only when the profile is unknown for the current checkout and environment. Profile changes do not alter tracked source or require reinstalling otherwise-valid dependencies; restart an existing preview to use the new selection. Do not commit or upload `.sites-runtime/`.

This starter does not use `wrangler.jsonc`.

`install:ci` runs `npm ci` once against the shared lockfile, disables parent-workspace discovery, and includes required dev/optional dependencies despite production/omit settings. Sharp defaults to prebuilt binaries unless explicitly configured otherwise. Do not overlap installers.

- **Portable:** Preserve host HOME, npm cache, registry, proxy, temporary paths, retry/concurrency settings, and lifecycle-script policy. Use `--prefer-offline --no-audit --no-fund`.
- **Managed Linux:** Use the existing project-local HOME/cache/tmp setup and Linux install lock, tarball preflight, and timeout. Restore the image-seeded npm cache only when its lockfile hash matches; retain network fallback. Builds keep their existing timeout. These helpers are not invoked by the portable profile.

`scripts/sites-env.mjs` preserves the caller's HOME, npm cache, proxy, XDG, and temporary-directory configuration while defaulting Wrangler and Miniflare state to the checkout. If npm reports an unwritable cache, select a writable path with `npm_config_cache` for that install. The `dev` and `start` scripts also keep Wrangler logs inside the checkout. Generated `.sites-runtime/` and `.wrangler/` directories are disposable and ignored by Git.

On portable, `npm run dev` uses `vinext dev` with HMR, starting at port 5173. Vinext records the running server in ignored `.vinext/` state, rejects an ordinary duplicate launch, and recovers stale state after a stopped process; exactly simultaneous starts can race. Pass `--port <port>` or `--hostname <host>` after `npm run dev --` when needed; keep portable previews on loopback.

For browser QA on managed Linux, use `sites-preview start`. The project's dev script runs Vite and accepts the supervisor's `--host 0.0.0.0 --port 4173 --strictPort` arguments. The internal browser uses `http://terminal.local:4173/`; it is not a user-facing URL. The supervisor owns the preview lifecycle. The ignored local profile survives the supervisor's cleared process environment.

The portable profile simulates ChatGPT sign-in only for loopback development requests. Visit `/signin-with-chatgpt?return_to=/` to sign in as `local_seedy` (`seedy@sites.test`, display name `Seedy`) and `/signout-with-chatgpt?return_to=/` to sign out. The development cookie preserves that identity across server restarts. Mock auth is disabled in the managed-linux profile and is not included in production builds; hosted authentication remains dispatch-owned.

The Worker uses `vinext/server/fetch-handler`, including Vinext's config-aware image handling. After building, `npm start` runs that Worker locally through Wrangler on `127.0.0.1`, sharing `.wrangler/state` with dev preview and local D1 migrations; it does not deploy the site or simulate sign-in. Use the URL printed by the server. Pass `npm start -- --port <port>` to select a different built-preview port.

Local previews use Miniflare's placeholder `Request.cf` metadata without a network lookup. Set `CLOUDFLARE_CF_FETCH_ENABLED=true` to opt into fetching preview metadata; this setting does not change hosted request metadata.

Local tool usage metrics are disabled by default. Set `WRANGLER_SEND_METRICS=true` to opt in.

## Included Shape

- edit site code under `app/`
- `app/chatgpt-auth.ts` provides optional dispatch-owned ChatGPT sign-in helpers
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/index.ts` reads the D1 binding from the Cloudflare Worker environment
- `db/schema.ts` starts intentionally empty
- `@cloudflare/workers-types` provides Worker types; `cloudflare-env.d.ts` declares optional `DB`/`BUCKET` bindings—update these declarations if binding names change
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

Signed-in visitors receive both `oai-authenticated-user-id` and `oai-authenticated-user-email`. Private Sites require every visitor to sign in; public Sites may also have anonymous visitors, for whom neither header is present.

The user ID is stable for the same user on the same Site and different across Sites. Use it as the durable user key; use email and name for display or contact purposes.

SIWC-authenticated workspace sites may also receive `oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty `name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by `oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use the returned `userId` as the stable user key for user-owned records; do not use email as a durable identifier.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send anonymous visitors through Sign in with ChatGPT.
- In a Server Component, start sign-in with `<a href={chatGPTSignInPath(returnTo)} target="_top">`. The auth helper module is server-only; do not import it into a Client Component.
- Do not use `fetch`, XHR, a client-side router, or a framework link that can prefetch the sign-in route. SIWC must start as a top-level navigation.
- Never request the AuthAPI authorization endpoint directly. The dispatch-owned `/signin-with-chatgpt` route must start the SIWC flow.
- Use `chatGPTSignOutPath(returnTo)` for browser sign-out links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the OAuth cookies, and identity header injection. Do not implement app routes for those reserved paths. Routes that do not import and call the helper remain anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the Sites hosting platform's access policy controls for workspace-wide restrictions, or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write actions tied to the current ChatGPT user. Leave public content anonymous.

## Local D1 migrations

For a D1-backed local preview, generate SQL with `npm run db:generate`. Build once through the Sites skill's build entrypoint (or `npm run build` for standalone use) to generate `dist/server/wrangler.json`, rebuilding if bindings change. From the project root, apply each pending migration in order:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_example.sql
```

Replace the filename with the pending migration and `DB` with your D1 binding name if different. Use `.wrangler/state`, not `.wrangler/state/v3`; Wrangler adds the versioned directories. Do not replay migrations already applied locally. This updates only the preview database; publishing applies production migrations separately.

## Diagnostic Commands

- `npm run install:ci`: perform the one locked dependency install
- `npm run dev`: start the Vite/Vinext development server
- `npm run build`: build the deployable Sites artifact
- `npm run start`: preview the built Worker locally with D1/R2 support
- `npm run db:generate`: generate Drizzle migrations after schema changes

When using the Sites plugin, follow its skill instructions for installation, builds, and publishing. These npm commands remain available for standalone use.

The portable build runs Vinext directly without a host `timeout` command. The managed-linux build uses `scripts/build-verified.sh` and its existing `SITES_BUILD_TIMEOUT` setting.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)

## 마포홈 사용자 PRD 반영 (2026-10-06)

- 기준 데이터: SINGLE_20261006_130231.xlsx, 1,003개 수집 항목과 965개 네이버 원본 링크.
- 서버에 사용자별 관심 매물과 알림 설정을 저장한다. 관심 해제, 개별 알림 끄기, 단일 조건 교체, 동네 최대 5개를 API에서도 검증한다.
- 로그인은 기존 Sites ChatGPT 인증을 유지한다. 애플리케이션의 비로그인 GET은 공개 매물만 반환한다. 현재 호스팅의 소유자 전용 공개 범위는 유지되므로 실제 익명 외부 방문에는 별도의 공개 범위 결정이 필요하다.
- 면적은 선택 입력인 최소 전용면적(㎡), 알림 호칭은 선택 닉네임으로 구현했다. 동네 정보가 없는 매물은 특정 동네 조건에 일치하지 않는다. 복수 가격은 실제 보증금·월세 쌍으로 비교한다.
- 기존 다중 조건은 legacyRules로 보관하며 호환되지 않는 조건을 임의로 선택하지 않는다. 사용자에게 단일 조건을 다시 입력하도록 안내한다.
- lib/model.ts의 importSnapshot은 검증 완료된 전체 스냅샷을 받는 순수 상태 전이다. 신규 묶음, 관심 매물별 인하/혼합 변화, 조건 이탈·재진입을 판정한다.
- 최초 전체 적재에는 신규 알림을 생성하지 않는다. 재진입과 인하가 겹치면 재진입 한 건을 생성한다. 단순 재수집 자체는 알림을 만들지 않는다. 수동 알림 끄기는 유지한다.
- 고유 식별 정보가 없는 항목과 여러 방의 가격을 묶은 항목은 개별 가격 인하 알림에서 제외한다. 관심 목록에는 보관할 수 있다.
- PWA manifest, 192/512 PNG 아이콘, 서비스 워커, 오프라인 안내, 안전한 알림 클릭 경로를 추가했다. 개인 API 응답과 인증 페이지는 캐시하지 않는다.

### 기기 푸시 (2026-10-07)

운영센터의 확정 자료 전달 → 사용자별 조건 평가 → 알림함·발송 대기열 원자적 저장 → Web Push 전송을 연결했다. 사용자는 `내 조건`에서 `이 기기 알림 켜기`를 누르고 브라우저 권한을 허용한다. `테스트 알림 보내기`는 현재 로그인한 사용자의 현재 기기 한 곳에만 발송한다. iPhone·iPad는 홈 화면에 추가한 앱에서 설정한다.

`MAPO_VAPID_PUBLIC_KEY`, `MAPO_VAPID_PRIVATE_KEY`(secret), `MAPO_VAPID_SUBJECT`는 Sites 런타임 환경에 저장한다. 기존 구독을 유지하려면 키를 임의로 교체하지 않는다. 계정별 최대 10개 기기, 테스트 발송은 기기별 1분에 1회다. HTTPS 푸시 공급자 주소만 허용하고 리다이렉트를 따르지 않는다. 구독 생성/해제/테스트는 로그인과 정확한 Origin 검증을 요구한다.

자료 동기화와 사용자 API 처리 후 Worker의 `waitUntil`에서 구독 사용자의 조건을 평가하고 발송한다. 창을 닫은 사용자도 대상이다. 새 구독에 이전 기록을 재발송하지 않으며, 사용자 저장 revision과 발송 대기열을 같은 D1 트랜잭션으로 확정한다. 재전송 전 전체 중지·개별 중지·관심 해제·조건 이탈을 다시 확인한다. 공급자의 2xx는 `accepted`이며 기기 표시를 보장하는 수신 확인은 아니다. 404/410 구독은 제거하고 429/408/5xx/네트워크 실패는 최대 5회 재시도한다. 응답 소실 뒤 재시도는 중복 수신 가능성이 있어 동일 알림 tag로 대체 표시한다.

백그라운드 작업은 한 요청당 약 22초의 처리 예산을 사용한다. 남은 작업과 지연 재시도는 다음 자료 전달, 사용자 API 요청 또는 운영센터의 다시 전달에서 이어진다. 독립 타이머/상시 재시도 스케줄러와 매일 자동 수집은 이 기능에 포함하지 않는다. 24시간 지난 미발송 알림은 취소하며 최근 30일의 완료 발송 기록을 보관한다. 공공임대 알림은 기존 정책대로 일반 매물 푸시에 포함하지 않는다.

검증: `node tests/push.test.mjs`는 로컬 메모리 SQLite와 가짜 푸시 공급자로 권한/출처, 수신자 격리, 암호화·VAPID 서명, 오프라인 사용자 처리, 원자적 저장 충돌, 중복 방지, 해제, 재시도, 만료 정리를 확인한다. 실제 고객에게 테스트 메시지를 보내지 않는다.

PWA 설치와 푸시의 실기기 호환성은 실제 사용 기기에서 추가 확인해야 한다. 구현 참고: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable 와 https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/

### 검증

- TypeScript 검사와 프로덕션 빌드 통과.
- tests/prd.test.ts: 현재 데이터 보존, 거래 선택·동네 제한, 가격 쌍 조건 판정, 3단계 인하 우선순위, 조건 이탈·재진입, 수동 해제, 신규 묶음, 중복 방지, 미확인 유지, 조건 수정, 이전 상태 마이그레이션 검증.
- tests/api.smoke.mjs: 로컬 개발 환경에서 비로그인 조회, 인증·출처·수정 충돌, 입력 검증, 단일 조건 수정, 관심 저장 유지와 저장 즉시 알림 미생성을 검증한다. 운영 사이트에 실행하지 않는다.
- 브라우저 확인: 하트 저장, 5개 동네 이후 추가 선택 차단, 조건 저장, 새로고침 후 관심 유지, 조건 이탈 대기 표시, 상세의 원본 네이버 링크. 390px와 1280px 화면 확인.

### 기본 매물 정렬 변경

기본값은 원문 확인·등록일 최신순이다. 원본에 “확인매물”과 “등록”이 섞여 있으므로 이를 모두 등록일로 표시하지 않고 카드에 확인/등록을 구분한다. 유효한 원문 날짜가 없으면 마지막에 표시한다.

날짜가 같으면 이름·동네·방 유형·거래 유형·실제 가격 조합·전용면적·층이 같은 항목을 연속 배치한다. 각 그룹은 원본에서 처음 나타난 행 순서, 그룹 내부는 원본 행 순서를 따른다. 다른 날짜의 비슷한 매물을 끌어올리지 않는다. 합치거나 삭제하지 않으며, 기본 최신순에서만 적용한다. 관심 매물의 가격 변화 우선순위는 유지한다.

검증: tests/listing-order.test.ts에서 날짜 우선, 같은 날짜의 그룹 연속성, 날짜 없음/잘못된 날짜의 후순위, 실제 1,003개 ID 유지 및 입력 배열 보존을 확인한다.


### 청년·공공임대 화면 분리

사용자 `/housing`에는 자동 확인 일정, 마지막 확인 시도, 출처별 점검 상태와 운영용 새로고침을 렌더링하지 않는다. 이 정보는 별도 운영자 사이트의 후속 연동 대상으로 두며 공고 저장소와 기존 자동화는 유지한다. 사용자에게는 모집 공고와 신청에 필요한 정보만 제공한다.
