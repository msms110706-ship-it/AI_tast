import { loginAccount, readRequestBody } from "../../_lib/account-service.js";
import { apiError } from "../../_lib/http.js";

export async function onRequest(context) {
  if (context.request.method !== "POST") return apiError("METHOD_NOT_ALLOWED", "지원하지 않는 요청입니다.", 405);
  try {
    const parsed = await readRequestBody(context.request);
    if (parsed.error) return parsed.error;
    return await loginAccount(context, parsed.body);
  } catch (error) {
    console.error("Login API error", error instanceof Error ? error.message : "unknown");
    return apiError("LOGIN_ERROR", "로그인을 처리하지 못했습니다.", 500);
  }
}
