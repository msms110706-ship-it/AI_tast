import { readRequestBody, registerAccount } from "../../_lib/account-service.js";
import { apiError } from "../../_lib/http.js";

export async function onRequest(context) {
  if (context.request.method !== "POST") return apiError("METHOD_NOT_ALLOWED", "지원하지 않는 요청입니다.", 405);
  try {
    const parsed = await readRequestBody(context.request);
    if (parsed.error) return parsed.error;
    return await registerAccount(context, parsed.body);
  } catch (error) {
    console.error("Register API error", error instanceof Error ? error.message : "unknown");
    return apiError("REGISTER_ERROR", "계정을 만들지 못했습니다.", 500);
  }
}
