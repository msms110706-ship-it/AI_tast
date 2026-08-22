import { deleteAllSessions, getSessionUserId, sessionCookie } from "../_lib/auth.js";
import { apiError, json } from "../_lib/http.js";

export async function onRequest(context) {
  if (context.request.method !== "DELETE") return apiError("METHOD_NOT_ALLOWED", "지원하지 않는 요청입니다.", 405);
  try {
    const store = context.env.STUDY_DATA;
    if (!store) return apiError("STORE_UNAVAILABLE", "서비스 설정을 확인해 주세요.", 503);
    const userId = await getSessionUserId(context.request, store);
    if (!userId) return apiError("UNAUTHORIZED", "다시 로그인해 주세요.", 401);
    await deleteAllSessions(store, userId);
    return json({ ok: true }, 200, { "set-cookie": sessionCookie("", 0) });
  } catch {
    return apiError("SESSION_REVOKE_ERROR", "세션을 만료하지 못했습니다.", 500);
  }
}
