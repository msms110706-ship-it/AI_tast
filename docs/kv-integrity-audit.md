# STUDY_DATA 읽기 전용 무결성 검사

이 도구는 KV의 list/get API만 구현하며 put/delete API를 포함하지 않습니다. 모든 실행은 dry-run이고 계정 삭제, 수정, 자동 마이그레이션 기능이 없습니다.

Cloudflare에서 `Workers KV Storage Read`만 허용한 별도 API Token을 만든 뒤 다음 환경 변수를 현재 셸에만 설정합니다.

- `CLOUDFLARE_ACCOUNT_ID`
- `STUDY_DATA_NAMESPACE_ID`
- `CLOUDFLARE_API_TOKEN`

실행:

```sh
npm run account:audit -- --dry-run
```

발견된 accountId별로 연결 레코드의 종류와 개수만 확인하는 상세 dry-run:

```sh
npm run account:audit -- --dry-run --detail
```

`accountDetails`는 감사에서 문제가 발견된 accountId만 앞 4자리로 표시합니다. `account-id:`, `account:`, `name:`, `plans:`, `session:`, `mistakes:`, `progress:`마다 `exists`와 `count`만 출력하며, `suggestions`에서 계정 레코드가 없는 고아 데이터 삭제 후보와 계정 레코드가 있어 복구할 매핑을 구분합니다.
보고서의 `kvMutations`는 이 읽기 전용 감사 중 수행된 KV 쓰기와 삭제가 각각 0회임을 명시합니다.

누락 매핑의 복구 가능성만 검증하는 읽기 전용 계획:

```sh
npm run account:audit -- --dry-run --repair-dry-run
```

`repairPlan`은 복구 대상 accountId를 앞 4자리로만 표시하고, 기존 계정 레코드의 존재·일관성과 로그인 매핑의 검증·충돌·중복 여부만 제공합니다. 충돌이나 중복 가능성이 있으면 해당 매핑을 `blocked`로 표시합니다. 이 옵션 역시 KV를 변경하지 않습니다.

`--confirm`, `--delete`, `--write`, `--repair`, `--migrate`는 모두 거부됩니다. 출력에는 접두사, 마스킹된 accountId, 개수만 포함되고 실제 KV 키, 로그인 아이디 해시, 비밀번호 해시, salt, 세션 키 전체 값은 포함되지 않습니다.

Cloudflare 호출 오류는 `Account API Token 검증`, `KV 키 목록 조회`, `KV 값 조회` 단계로 구분됩니다. 오류 응답의 `errors[].code`와 민감값을 제거한 짧은 `errors[].message`만 표시하며, Account ID와 Namespace ID는 실제 값 대신 32자리 형식 유효 여부와 길이만 표시합니다. 두 ID에 따옴표, 내부 공백, 줄바꿈 또는 Markdown 링크 문법이 섞이면 API 호출 전에 중단됩니다.

`potentialDeletionSummary`는 별도 승인 후 정리 대상으로 검토할 종류와 개수일 뿐이며 이 도구는 해당 데이터를 삭제하지 않습니다. `account-id:missing`은 canonical 레코드가 없지만 `user:` 또는 레거시 계정 레코드는 남은 상태이므로 자동 삭제 대상으로 분류하지 않습니다.
