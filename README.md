# 시험플랜온

Next.js 기반 시험 공부 플래너입니다.

## 서버 계획 동기화 설정

배포 Worker에 Cloudflare KV 호환 바인딩을 `STUDY_DATA`라는 이름으로 연결해야 합니다. 이 저장소에는 만 14세 이상 계정의 로그인 아이디 매핑, 공개 별명, 로그인 검증값, 30일 세션, 사용자별 계획·완료·오답이 저장됩니다. 만 14세 미만 로컬 모드는 KV 및 계정 API를 사용하지 않습니다.

- 로컬 개발 또는 배포 미리보기에서도 동일한 이름의 KV 바인딩을 사용하세요.
- `OPENAI_API_KEY`는 학습 코치의 인터넷 답변에만 필요하며 계획 동기화와는 별개입니다.
- 비밀번호는 PBKDF2-SHA256(100,000회) 검증값으로 저장되고 원문은 저장하지 않습니다. 계정마다 고유 salt와 반복 횟수를 함께 기록합니다.
- 계정 스키마 v5는 `accountId`, 비공개 `loginId`, 중복 가능한 `displayName`을 구분합니다. 기존 `name` 계정은 로그인 호환을 유지하고 화면에서는 `displayName || name`을 사용합니다.
- `npm run account:schema-audit`는 읽기 전용 dry-run입니다. `--apply`와 `--confirm`을 거부하며 민감 식별자·세션·해시·salt를 출력하지 않습니다. 운영 마이그레이션은 보고서 검토 뒤 별도 승인 절차로만 진행합니다.
- 정적 헤더는 `public/_headers`, Pages Functions 헤더는 `functions/_middleware.js`에서 적용합니다. CSP는 먼저 Report-Only로 검증한 뒤 강제 정책으로 전환합니다.
- 운영 계정 정리는 [docs/account-cleanup.md](docs/account-cleanup.md)의 기본 dry-run 도구를 사용하며, 승인 전 실제 삭제를 실행하지 않습니다.
- 계정 API는 `POST /api/account/login`, `POST /api/account/register`, `POST /api/account/logout`, `GET /api/account/me`로 분리되어 있습니다. 기존 `/api/account`는 명시적인 `action`이 있는 요청만 호환 처리합니다.
- Cloudflare Pages는 프로젝트 루트의 `functions`를 파일 기반 Pages Functions로 배포합니다. Build output directory는 `out`을 사용하며, `_worker.js`를 함께 두면 `functions` 폴더가 무시되므로 생성하지 않습니다.
