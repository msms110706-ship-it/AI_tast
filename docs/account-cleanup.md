# 계정 정리 도구

이 도구는 기본적으로 dry-run이며 전체 namespace 삭제나 테스트 계정 자동 추측을 지원하지 않습니다. 운영 작업 전 Cloudflare Dashboard의 **Storage & databases → KV → STUDY_DATA namespace → KV Pairs**에서 현재 키 목록을 확인하세요. 백업은 Wrangler의 `kv key list`로 키 목록을 저장한 뒤 그 목록을 검토하여 `kv bulk get`으로 값을 별도 보관하는 방식으로 수행할 수 있습니다. 명령 형식은 Cloudflare 공식 `https://developers.cloudflare.com/kv/reference/kv-commands/` 문서를 따르세요.

필수 환경 변수는 `CLOUDFLARE_ACCOUNT_ID`, `STUDY_DATA_NAMESPACE_ID`, 최소 KV 읽기·쓰기 권한의 `CLOUDFLARE_API_TOKEN`입니다. 값은 파일이나 셸 기록에 저장하지 마세요.

Dry-run:

```sh
npm run account:cleanup -- --login-id studymaster24 --dry-run
npm run account:cleanup -- --account-id 정확한-account-id --dry-run
```

출력은 삭제 예정 종류와 개수만 보여주며 KV 키, 해시, salt, 세션 토큰 값은 보여주지 않습니다. 레거시 구조에서 같은 로그인 아이디에 여러 accountId가 발견되면 중단되므로 정확한 `--account-id`로 다시 확인해야 합니다.

관리자가 dry-run 대상과 개수를 검토하고 백업을 확인한 뒤에만 다음처럼 실행합니다.

```sh
npm run account:cleanup -- --login-id studymaster24 --confirm --confirmation "DELETE THIS ACCOUNT"
```

`--confirm`과 정확한 확인 문구가 모두 필요합니다. 같은 대상을 다시 실행하면 `ACCOUNT_NOT_FOUND`로 안전하게 중단됩니다.
