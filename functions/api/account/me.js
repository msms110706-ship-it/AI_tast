import { getSessionUserId } from "../../_lib/auth.js";
import { apiError, json } from "../../_lib/http.js";

export async function onRequest(context) {
  if (context.request.method !== "GET") return apiError("METHOD_NOT_ALLOWED", "지원하지 않는 요청입니다.", 405);
  try {
    const store = context.env.STUDY_DATA;
    if (!store) return apiError("STORE_UNAVAILABLE", "서비스 설정을 확인해 주세요.", 503);
    const id = await getSessionUserId(context.request, store);
    if (!id) return apiError("UNAUTHORIZED", "다시 로그인해 주세요.", 401);
    const account = await store.get(`user:${id}`, "json") || await store.get(`account-id:${id}`, "json");
    if (!account) return apiError("UNAUTHORIZED", "다시 로그인해 주세요.", 401);
    return json({ ok: true, account: { name: account.name, grade: account.grade, ageGroup: (account.ageGroup || (account.isChild ? "under13" : "over13")) === "under13" ? "13세 미만" : "13세 이상" }, user: { id, name: account.name, grade: account.grade, isChild: account.ageGroup ? account.ageGroup === "under13" : Boolean(account.isChild) } });
  } catch {
    return apiError("ACCOUNT_ERROR", "계정 정보를 확인하지 못했습니다.", 500);
  }
}
