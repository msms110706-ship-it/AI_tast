import { getSessionUserId } from "../_lib/auth.js";
import { apiError, json } from "../_lib/http.js";

const TYPES = ["개념 부족", "암기 부족", "계산 실수", "문제 해석 오류", "시간 부족", "기타"];

export async function onRequest(context) {
  try {
    const store = context.env.STUDY_DATA;
    if (!store) return apiError("STORE_UNAVAILABLE", "서비스 설정을 확인해 주세요.", 503);
    const userId = await getSessionUserId(context.request, store);
    if (!userId) return apiError("UNAUTHORIZED", "다시 로그인해 주세요.", 401);
    const key = `mistakes:${userId}`;
    if (context.request.method === "GET") return json({ ok: true, mistakes: (await store.get(key, "json")) || [] });
    if (context.request.method !== "PUT") return apiError("METHOD_NOT_ALLOWED", "지원하지 않는 요청입니다.", 405);
    let body; try { body = await context.request.json(); } catch { return apiError("INVALID_BODY", "오답 내용을 확인해 주세요."); }
    if (!Array.isArray(body.mistakes) || body.mistakes.length > 500) return apiError("INVALID_MISTAKES", "오답 목록을 확인해 주세요.");
    const mistakes = body.mistakes.map((item) => ({ id: String(item.id || crypto.randomUUID()), subject: String(item.subject || "").slice(0, 80), unit: String(item.unit || "").slice(0, 200), memo: String(item.memo || "").slice(0, 1000), reason: TYPES.includes(item.reason) ? item.reason : "기타", reviewDate: String(item.reviewDate || "").slice(0, 10), createdAt: item.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(), schemaVersion: 1 }));
    await store.put(key, JSON.stringify(mistakes));
    return json({ ok: true, mistakes, updatedAt: new Date().toISOString() });
  } catch {
    return apiError("MISTAKE_ERROR", "오답을 처리하지 못했습니다.", 500);
  }
}
