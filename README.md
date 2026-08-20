# 공부하자

Next.js 기반 시험 공부 플래너입니다.

## 서버 계획 동기화 설정

배포 Worker에 Cloudflare KV 호환 바인딩을 `STUDY_DATA`라는 이름으로 연결해야 합니다. 이 저장소에는 로그인 검증값, 30일 세션, 사용자별 계획이 저장됩니다. 바인딩이 없는 환경에서는 로그인 화면에 설정 오류가 표시되며 브라우저 전용 계정을 새로 만들지 않습니다.

- 로컬 개발 또는 배포 미리보기에서도 동일한 이름의 KV 바인딩을 사용하세요.
- `OPENAI_API_KEY`는 학습 코치의 인터넷 답변에만 필요하며 계획 동기화와는 별개입니다.
- 로그인 코드는 PBKDF2-SHA256(120,000회) 검증값으로 저장되고 원문은 저장하지 않습니다.
- Cloudflare Pages는 프로젝트 루트의 `functions/api/account.js`와 `functions/api/sync.js`를 파일 기반 Pages Functions로 배포합니다. Build output directory는 `out`을 사용하며, `_worker.js`를 함께 두면 `functions` 폴더가 무시되므로 생성하지 않습니다.
