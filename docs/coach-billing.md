# 학습 코치 운영 준비

## 소스와 배포

Pages는 `functions/api/coach.js`, 별도 Worker 호스팅은 `server/index.js`를 사용하며 동일한 `functions/_lib/coach.js`를 호출한다. `scripts/package-output.mjs`는 이 소스를 복사한다. `dist`, `out`, `.output`, `.vercel`은 생성 산출물이며 직접 편집하지 않는다. 기존 빌드의 distDir와 배포 디렉터리 충돌을 해소하여 Next 내부 빌드는 `.next`, 정적 Pages 출력은 `out`이다.

## 환경 설정

서버 바인딩: `STUDY_DATA` (Preview는 별도 KV). 서버 비밀값: `OPENAI_API_KEY` (없으면 Wikipedia만 사용).

| 변수 | 기본값 |
| --- | --- |
| OPENAI_MODEL | gpt-5.6-luna |
| COACH_FREE_DAILY_AI_LIMIT | 3 |
| COACH_PAID_MONTHLY_AI_LIMIT | 100 |
| COACH_PAID_DAILY_AI_LIMIT | 20 |
| COACH_MAX_OUTPUT_TOKENS | 600 |
| COACH_COOLDOWN_SECONDS | 10 |
| COACH_AI_ENABLED | true |
| COACH_PAID_FEATURES_ENABLED | false |
| COACH_CHECKOUT_ENABLED | 예약 변수이며 현재 결제를 활성화하지 않음 |

사용량/출력 상한은 환경 변수로 낮출 수 있고 표의 안전 상한을 넘길 수 없다. 쿨다운은 최소 10초다. 결제는 환경 변수와 무관하게 구현되지 않아 항상 차단된다. 실제 유료화에는 별도 코드 검토가 필요하다. 모델 이름은 요청대로 유지했으며 실제 계정의 모델 접근 가능 여부는 실호출로 검증하지 않았다.

Responses 요청은 현재 질문·과목·범위·학년만 전송하며 `store:false`, `reasoning.effort:low`, `max_output_tokens:600`을 사용한다. [OpenAI 공식 문서](https://developers.openai.com/api/docs/guides/reasoning)에 따르면 출력 상한에는 reasoning 토큰도 포함되어 짧은 한도에서 답변이 불완전할 수 있다. 불완전/빈 답변도 Wikipedia로 전환한다. OpenAI 15초, Wikipedia 8초 제한. 자동 재시도 없음.

**web_search 허용 조건은 현재 없음(일일 전역 상한 0).** 최신 질문도 검색하지 않는다. 이후 검색 활성화에는 명시적 최신성 정책과 강하게 일관된 전역 예산 카운터를 먼저 구현해야 한다.

## 인증과 데이터

기존 해시 세션 조회를 재사용하고 KV 계정 레코드를 조회한다. 두 계정 사본 중 아동/로컬/미확인 연령이 하나라도 있으면 차단한다. `over14` 명시 확인 없는 과거 `over13` 또는 연령 없는 계정은 기존 로그인·계획 기능을 유지하지만 코치는 403이다. 연령 재확인 절차는 별도 검토 필요. 클라이언트 premium/연령 값은 무시한다. IP, 질문 원문, 로그인 아이디, 세션은 코치 저장/로그에 남기지 않는다.

| 키 | 값 | TTL |
| --- | --- | --- |
| coach-usage:daily:{SHA256(accountId)}:{한국 날짜} | 호출 시도/이전 예약 횟수, 입력·출력 토큰 합계 | 48시간 |
| coach-usage:monthly:{SHA256(accountId)}:{한국 월} | premium 호출 시도/이전 예약 횟수 | 33일 |
| coach-reservation:{SHA256(accountId)} | 난수 소유권, 호출 가능 시각 | 최소 60초, 설정 쿨다운 이상 |
| coach-request:{SHA256([accountId, requestId])} | attempted (질문·응답·원본 ID 없음) | 만료 없음 |
| billing:account:{accountId} | 미래 서버 권한 | 현재 읽기만, 생성/수정 안 함 |

[Cloudflare KV 쓰기 제한](https://developers.cloudflare.com/kv/api/write-key-value-pairs/)에 맞춰 같은 요청의 예약/확정 쓰기 사이에 최소 1.1초 간격을 둔다. 사용량은 OpenAI 호출 직전에 시도 횟수로 영구 차감하며 성공, 시간 초과, 5xx, 빈/불완전 응답 모두 되돌리지 않는다. 인증·연령·입력 검증 거부는 차감하지 않는다. 무료 일일 3회, premium 일일 20회·월간 100회 이후에는 OpenAI를 호출하지 않는다. 저장 실패 시에도 차감을 복구하거나 자동 재시도하지 않는다. 토큰 집계는 API가 usage를 반환한 경우만 가능하며 타임아웃에서도 공급자 비용이 발생할 수 있다. 금액 계산/표시는 구현하지 않았으며 향후 금액은 표시용 추정치로만 안내해야 한다. 계정 삭제 후 익명화 사용량 키는 위 TTL까지 잔존 후 만료된다. 운영 마이그레이션은 필요 없다.

**KV의 eventual consistency와 read-modify-write는 전역 원자성을 제공하지 않는다.** 동일 isolate Set 잠금과 KV 난수 예약/확인으로 반복·동시 요청을 줄이지만 다른 지역/isolate 간 경합과 오래된 읽기로 상한 초과 및 집계 누락이 가능하다. nonce 재확인은 compare-and-set이 아니다. 엄격한 비용 방어가 필요한 운영 전에는 계정별 Durable Object에서 일/월/쿨다운 예약·확정을 원자 처리하고 전역 비용 제한도 추가해야 한다. Cloudflare Rate Limiting은 요청 빈도 방어에 보완적으로 사용할 수 있다. 새 서비스를 활성화하지 않았다. 그 전에는 `COACH_AI_ENABLED=false` 운영이 안전하다. 공급자 프로젝트 예산/하드 제한도 별도로 설정한다.

## 결제 인터페이스와 향후 상태 모델

`PaymentProvider`는 createCheckoutSession / verifyWebhook / cancelSubscription / getSubscriptionStatus의 실패 전용 인터페이스다. SDK, checkout URL, 카드 입력, 성공 페이지 권한 부여, 운영자 숨김 버튼은 없다. webhook은 모든 요청을 403으로 거부하고 KV에 쓰지 않는다.

미래 entitlement 최소 스키마: `{plan: 'free'|'premium', status: 'inactive'|'active'|'past_due'|'canceled', provider: null|'future-provider', currentPeriodEnd: null|'ISO date', updatedAt: 'ISO date'}`. 현재 premium 판정은 기능 플래그와 서버 레코드의 premium/active/미래 만료일/provider 일치를 모두 요구한다. API에 결제 고객 ID나 비밀정보를 반환하지 않는다.

향후 webhook 절차: 원문 요청 서명·타임스탬프 검증 → 공급자 API로 구독/서버 계정 매핑 확인 → 원자 저장소에서 `billing-event:{provider}:{SHA256(eventId)}` 중복 차단 → 이벤트 버전 비교 → entitlement와 이벤트 처리 상태를 같은 트랜잭션에서 확정. 실패 시 재시도 가능해야 하며 KV만으로 중복 방지 원자성을 보장할 수 없다. 이벤트 TTL은 공급자의 재전송/분쟁 기간 결정 후 확정한다. 미검증 요청에는 기록도 권한도 부여하지 않는다.

상태: 검증된 결제 완료는 active, 결제 실패는 past_due(무료로 전환), 전액 환불·즉시 해지는 canceled(무료), 만료는 inactive(무료). 기간 말 취소를 제공할 경우 취소 예약과 실제 종료를 구분하고 검증된 기간 종료 전까지만 active를 유지한다. 순서가 뒤바뀐 과거 이벤트로 재활성화하지 않는다. 실제 상태 갱신 코드는 아직 연결하지 않았다.

보호자와 결정할 사항: 보호자 명의 판매자/정산 계정 및 책임, 공급자·통화·가격·세금·결제주기, 환불·해지 및 기간 말 취소 정책, 법정대리인 동의와 미성년자 구매 절차, 고객지원, 공급자 개인정보 처리·국외 이전·보관기간. 결정 후 약관/개인정보처리방침을 개정하고 별도 승인된 sandbox 검증 및 보안 검토 후 실판매를 검토한다.

requestId는 필수 16~64자 영문·숫자·밑줄·하이픈이며 계정과 함께 해시한다. 동일 ID 재제출은 409, 같은 isolate의 동시 요청은 잠금으로 차단한다. 호출 전 중복 방지 기록을 남기고 만료시키지 않아 날짜가 바뀌어도 재호출하지 않는다. 원문과 응답은 저장하지 않는다. 이 익명 기록은 계정 삭제 후에도 잔존하며 저장 공간이 누적되는 제한이 있다. KV의 지역 간 비원자성 때문에 서로 다른 isolate/지역에서는 같은 requestId의 호출 총 1회도 엄격히 보장할 수 없다. Durable Object 구현은 다음 별도 단계이며 이번에는 포함하지 않는다.

관리자가 KV의 billing:account 레코드를 직접 수정하고 유료 기능 플래그를 켜면 premium으로 인식될 수 있다. 현재 권한 판정은 실제 결제 증명이 아니다. **실제 결제업체 webhook 서명 검증과 서버 권한 갱신 검증 전에는 유료 서비스를 출시하면 안 된다.** 브라우저, 성공 URL, 서명 없는 webhook은 premium을 부여하지 않는다.

dist/는 Git 추적을 유지한다. 빌드는 기존 dist 파일을 삭제하지 않고 생성물을 덮어쓰며, 오래된 해시 파일은 보존한다. out/, .output/, .vercel/output/static/ 제외 상태는 유지한다.
