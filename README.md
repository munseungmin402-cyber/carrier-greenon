# Carrier GreenON

Carrier 에어컨 사용자를 위한 ESG 친환경 냉방 미션·GREEN POINT·리워드 웹앱입니다. 실제 에어컨 API 대신 사용자별 가상 IoT 데이터를 사용하고, 인증과 활동 데이터는 Supabase에 저장합니다.

## 주요 기능

- 광주광역시의 실시간 외부온도·습도와 날씨 맞춤 냉방 안내(10분 자동 갱신)
- 가상 에어컨 상태 및 오류·필터 경고 시뮬레이션
- 26~28°C GREEN MISSION 참여와 진행 기록
- 미션 성공 포인트 지급과 GREEN WALLET 내역
- 스타벅스·성심당·Oral-B·Carrier 실제 제품 사진을 적용한 GREEN REWARD SHOP
- Carrier 공기청정기 3,000P 리워드와 동일 크기 상품 미리보기
- Supabase Auth, 사용자별 데이터 분리, RLS 보호
- Carrier Navy·Steel Blue 기반의 입체적인 모바일 우선 반응형 UI
- 냉동공조 마스코트, 커스텀 마우스 커서, 가상 에어컨 바람 모션

## 기술 구성

- HTML, CSS, Vanilla JavaScript
- Supabase Auth, Postgres, RLS, Database Functions
- Open-Meteo Forecast API
- Render Static Site
- Node.js 24 LTS 기반 무의존성 production 빌드

## 환경변수

`.env.example`을 참고해 다음 값을 로컬 환경 또는 Render Environment에 등록합니다.

| 이름 | 필수 | 설명 |
| --- | --- | --- |
| `SUPABASE_URL` | 예 | Supabase 프로젝트 HTTPS URL |
| `SUPABASE_PUBLISHABLE_KEY` | 예 | 브라우저 공개용 `sb_publishable_` 키 |
| `WEATHER_API_URL` | 아니요 | 기본값은 Open-Meteo Forecast API |
| `NODE_VERSION` | Render 권장 | 검증 버전 `24.19.0` |

`sb_secret_` 키, `service_role` 키, DB 비밀번호는 브라우저 코드와 Render Static Site 환경에 절대 등록하지 않습니다. Publishable 키는 브라우저 공개용이지만 저장소에는 고정하지 않고 빌드 환경에서 주입합니다.

## 로컬 production 빌드

Node.js 24 LTS 환경에서 환경변수를 설정한 뒤 실행합니다.

```powershell
$env:SUPABASE_URL = "https://your-project-ref.supabase.co"
$env:SUPABASE_PUBLISHABLE_KEY = "sb_publishable_your_key_here"
npm run build
```

빌드 과정은 다음 검사를 순서대로 수행합니다.

1. JavaScript 문법 검사
2. 소스와 기존 `dist/` 비밀값 검사
3. `dist/` 정적 파일 생성
4. 환경변수 기반 `dist/supabase-config.js` 생성

완성된 `dist/`를 정적 서버로 제공하면 됩니다. `index.html`을 파일로 직접 열지 말고 HTTP 서버를 사용해야 Auth와 외부 API 동작을 정확히 확인할 수 있습니다.

## Render 배포 준비

저장소 루트의 `render.yaml`은 다음 설정을 포함합니다.

- Build Command: `npm run build`
- Publish Directory: `dist`
- 필수 Supabase 환경변수는 `sync: false`로 선언
- SPA 경로를 `/index.html`로 rewrite
- 기본 보안 응답 헤더 적용

PHASE 11에서 Render Blueprint로 서비스를 생성하고 `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`를 등록한 뒤 배포 URL을 Supabase Auth 허용 URL에도 추가합니다.

## 보안 원칙

- 모든 사용자 소유 데이터는 RLS로 `auth.uid()`와 소유자를 비교합니다.
- 포인트 지급과 상품 구매는 인증 사용자 전용 원자적 DB 함수로 처리합니다.
- 실제 Carrier 에어컨 API나 관리자용 Supabase 키는 브라우저에서 사용하지 않습니다.
- `.env`, `dist/`, 브라우저 테스트 프로필은 Git에서 제외합니다.

## 개발 순서

상세 요구사항과 단계별 완료 상태는 `PROJECT.md`, `CHECKLIST.md`를 확인하세요. 작업 규칙은 `AGENTS.md`를 따릅니다.
