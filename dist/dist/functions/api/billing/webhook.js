import { apiError } from '../../_lib/http.js';
// No provider or verifier is installed: never accept events or write entitlements.
export function onRequest() {
  return apiError('PAYMENTS_DISABLED', '결제 기능은 준비 중입니다.', 403);
}
