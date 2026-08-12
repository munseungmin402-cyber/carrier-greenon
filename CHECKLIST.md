# Carrier GreenON 개발 체크리스트

## PHASE 1 — 기본 웹앱

- [x] 프로젝트 기본 구조 생성
- [x] White + Blue 디자인 시스템
- [x] 모바일 반응형 레이아웃
- [x] 하단 Navigation
- [x] 홈 화면


## PHASE 2 — 에어컨 상태

- [x] 가상 Carrier 에어컨 데이터
- [x] POWER 상태
- [x] 냉방 MODE
- [x] 설정온도
- [x] FAN 상태
- [x] 사용시간
- [x] 필터 상태
- [x] 정상 상태 Blue UI
- [x] 비정상 상태 Red UI
- [x] 상태 시뮬레이션 패널


## PHASE 3 — GREEN MISSION

- [x] 오늘의 미션
- [x] 미션 참여
- [x] 미션 진행 상태
- [x] 진행률 표시
- [x] 시간 +30분 시뮬레이션
- [x] 미션 조건 확인
- [x] 미션 Warning
- [x] 미션 성공
- [x] 미션 실패


## PHASE 4 — GREEN POINT

- [x] 미션 성공 시 포인트 지급
- [x] GREEN WALLET
- [x] 현재 포인트
- [x] 포인트 적립 기록
- [x] 포인트 사용 기록


## PHASE 5 — REWARD SHOP

- [x] 리워드 상품 목록
- [x] FOOD 카테고리
- [x] LIFE 카테고리
- [x] CARRIER 카테고리
- [x] 상품 상세
- [x] 포인트 구매
- [x] 포인트 차감
- [x] 포인트 부족 Warning
- [x] 구매내역


## PHASE 6 — 사용자

- [x] 회원가입
- [x] 로그인
- [x] 로그아웃
- [x] MY 페이지
- [x] GREEN LEVEL
- [x] GREEN REPORT


## PHASE 7 — Supabase

- [x] Supabase 프로젝트 연결
- [x] Auth 연결
- [x] profiles 테이블
- [x] missions 테이블
- [x] user_missions 테이블
- [x] point_transactions 테이블
- [x] rewards 테이블
- [x] reward_orders 테이블
- [x] aircon_status 테이블
- [x] GREEN LEVEL 데이터
- [x] RLS 설정
- [x] 사용자별 데이터 접근 테스트


## PHASE 8 — 실제 DB 전환

- [x] 임시 사용자 데이터 제거
- [x] 임시 포인트 데이터 제거
- [x] GREEN POINT Supabase 저장
- [x] 미션 기록 Supabase 저장
- [x] 상품 데이터 Supabase 연결
- [x] 구매내역 Supabase 저장
- [x] 새로고침 후 데이터 유지
- [x] 다른 기기 로그인 테스트


## PHASE 9 — 날씨

- [x] 샘플 날씨 데이터
- [x] 날씨 API 연결 구조
- [x] 외부온도 표시
- [x] 습도 표시
- [x] 날씨 조건별 미션


## PHASE 10 — 배포 준비

- [x] 환경변수 분리
- [x] .env.example
- [x] API Key 노출 검사
- [x] production build 확인
- [x] Git 저장소 정리
- [x] README 작성


## PHASE 11 — Render 배포

- [ ] Render 서비스 생성
- [ ] Git 저장소 연결
- [ ] 환경변수 등록
- [ ] Build 성공
- [ ] 배포 성공
- [ ] 배포 URL 접속
- [ ] 회원가입 테스트
- [ ] 로그인 테스트
- [ ] 미션 테스트
- [ ] 포인트 적립 테스트
- [ ] Reward 구매 테스트


## FINAL CHECK

- [ ] PROJECT.md 요구사항 누락 검사
- [ ] 모바일 화면 검사
- [ ] 정상 상태 Blue 확인
- [ ] Warning/Error Red 확인
- [ ] Supabase 보안 확인
- [ ] 전체 기능 회귀 테스트
- [ ] 최종 배포 확인
