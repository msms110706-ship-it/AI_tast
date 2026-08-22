import { deleteSession, sessionCookie } from "../_lib/auth.js";
import { apiError, json } from "../_lib/http.js";

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return apiError("METHOD_NOT_ALLOWED", "지원하지 않는 요청입니다.", 405);
  }

  try {
    const store = context.env.STUDY_DATA;
    if (!store) return apiError("STORE_UNAVAILABLE", "서비스 설정을 확인해 주세요.", 503);
    const deleted = await deleteSession(context.request, store);
    if (!deleted) return apiError("UNAUTHORIZED", "다시 로그인해 주세요.", 401);
    return json({ ok: true }, 200, { "set-cookie": sessionCookie("", 0) });
  } catch (error) {
    console.error("Logout API error", error instanceof Error ? error.message : "unknown");
    return apiError("LOGOUT_ERROR", "로그아웃을 처리하지 못했습니다.", 500);
  }
}
