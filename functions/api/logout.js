import { deleteSession } from "../_lib/auth.js";
import { json } from "../_lib/http.js";

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return json({ ok: false, error: "POST 요청만 지원합니다." }, 405);
  }

  try {
    const store = context.env.STUDY_DATA;
    if (!store) return json({ ok: false, error: "계정 저장소가 연결되지 않았습니다." }, 503);
    const deleted = await deleteSession(context.request, store);
    if (!deleted) return json({ ok: false, error: "인증 정보가 없습니다." }, 401);
    return json({ ok: true });
  } catch (error) {
    console.error("Logout API error", error instanceof Error ? error.message : "unknown");
    return json({ ok: false, error: "로그아웃 처리 중 오류가 발생했습니다." }, 500);
  }
}
