# Cloudflare Pages 배포 체크리스트

## 배포 전

1. `npm test`와 `npm run build`를 실행하고 `out/_headers`, `out/ads.txt`, `out/robots.txt`, `out/sitemap.xml`을 확인합니다.
2. Preview와 Production 모두 KV 바인딩 이름을 `STUDY_DATA`로 설정합니다. Preview에는 운영과 분리된 KV를 권장합니다.
3. 학습 코치를 운영할 때만 `OPENAI_API_KEY`와 선택적인 `OPENAI_MODEL` secret을 설정합니다. 클라이언트 환경 변수로 노출하지 않습니다.
4. Pages Build command는 `npm run build`, Build output directory는 `out`으로 유지합니다. `functions` 디렉터리는 Pages Functions로 함께 배포합니다.

## 배포 후 확인

- `/`, `/guides/`, `/privacy/`, `/terms/`, `/ads.txt`, `/robots.txt`, `/sitemap.xml`이 200인지 확인합니다.
- 비인증 `/api/sync`가 HTML이 아닌 JSON 401을 반환하는지 확인합니다.
- 정적 응답과 API 응답의 HSTS, nosniff, Referrer-Policy, Permissions-Policy, X-Frame-Options를 확인합니다.
- CSP는 현재 Report-Only입니다. 로그인, 문의, 광고, Disqus, Spotify 화면의 보고와 브라우저 콘솔을 Preview에서 확인한 뒤 인라인 Next.js 부트스트랩 해시를 고정하는 빌드 절차를 마련하고 강제 `Content-Security-Policy`로 전환합니다. `unsafe-eval`이나 `script-src *`는 추가하지 않습니다.
- 390px 모바일과 데스크톱에서 가로 넘침, 문의 키보드 탐색, 성공·실패 상태를 실제 브라우저로 확인합니다.

## 운영 데이터

`npm run account:schema-audit`는 Cloudflare 읽기 전용 토큰으로만 실행하는 익명화 dry-run입니다. `--apply`와 `--confirm`은 거부됩니다. 충돌 보고를 검토하기 전에는 운영 마이그레이션, 기존 아동 계정 변경 또는 삭제를 실행하지 않습니다. 실제 변경 도구와 승인은 이 저장소의 dry-run 도구와 별도로 관리해야 합니다.
