# Cloudflare 로그인 보호 설정

KV 카운터는 원자적이지 않고 로그인 실패마다 KV 쓰기를 발생시키므로 애플리케이션에는 로그인 횟수 카운터를 두지 않습니다. Cloudflare의 zone-level Rate Limiting Rule로 로그인 경로를 엣지에서 제한합니다.

Cloudflare Dashboard에서 해당 도메인의 zone을 선택한 다음 **Security → Security rules → Create rule → Rate limiting rules**로 이동합니다.

권장 시작값:

- 규칙 이름: `Study planner login protection`
- 표현식: `(http.request.method eq "POST" and http.request.uri.path eq "/api/account/login")`
- 특성: IP 기준
- 기준: 1분에 10회 초과
- 완화 동작: Block 또는 Managed Challenge
- 완화 시간: 10분
- 가능하면 custom counting expression에서 응답 코드 401만 집계하여 성공 로그인은 실패 횟수에 포함하지 않기
- 응답 상태: 429

먼저 Managed Challenge 또는 짧은 완화 시간으로 운영 지표를 확인한 뒤 임계값을 조정하세요. 응답 필드를 이용한 401 전용 counting expression을 현재 플랜이 제공하지 않으면 모든 로그인 요청을 세되 임계값을 조금 높이세요. JSON 요청 본문의 로그인 아이디는 일반 WAF 규칙의 안정적인 카운터 특성으로 사용하지 않습니다. 아이디별 제한이 반드시 필요하면 Rate Limiting binding을 지원하는 별도 Worker 구성을 검토하고, 정규화된 아이디의 SHA-256 값만 key로 사용해야 합니다. 아이디 원문, 비밀번호 또는 전체 IP를 애플리케이션 로그에 기록하면 안 됩니다.

Pro 이상에서 Block의 custom response를 사용할 수 있다면 response type을 JSON, code를 429로 하고 본문을 `{"ok":false,"error":{"code":"RATE_LIMITED","message":"로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요."}}`로 설정하세요. Rate Limiting Rule 화면에서 `Retry-After` 사용자 지정 헤더를 제공하지 않는 플랜에서는 완화 기간 600초가 재시도 가능 시간을 결정합니다.

공식 문서:

- https://developers.cloudflare.com/waf/rate-limiting-rules/create-zone-dashboard/
- https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
