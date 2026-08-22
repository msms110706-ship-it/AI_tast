import { getSessionUserId } from "../_lib/auth.js";
import { apiError, json } from "../_lib/http.js";

async function authorized(context) {
  const store = context.env.STUDY_DATA;
  if (!store) return { error: apiError("STORE_UNAVAILABLE", "서비스 설정을 확인해 주세요.", 503) };
  const userId = await getSessionUserId(context.request, store);
  if (!userId) return { error: apiError("UNAUTHORIZED", "다시 로그인해 주세요.", 401) };
  return { store, userId };
}

async function handleGet(context) {
  const auth = await authorized(context);
  if (auth.error) return auth.error;
  const stored = (await auth.store.get(`plans:${auth.userId}`, "json")) || [];
  const document = Array.isArray(stored) ? { schemaVersion: 1, revision: 0, updatedAt: null, plans: stored } : stored;
  return json({ ok: true, ...document, plans: document.plans || [] });
}

async function handlePut(context) {
  const auth = await authorized(context);
  if (auth.error) return auth.error;
  let body;
  try {
    body = await context.request.json();
  } catch {
    return apiError("INVALID_BODY", "계획 형식을 확인해 주세요.", 400);
  }
  if (!Array.isArray(body.plans) || body.plans.length > 100) {
    return apiError("INVALID_PLANS", "저장할 계획 목록을 확인해 주세요.", 400);
  }
  const currentStored = (await auth.store.get(`plans:${auth.userId}`, "json")) || [];
  const current = Array.isArray(currentStored) ? { revision: 0, plans: currentStored } : currentStored;
  if (body.mutationId && current.mutationId === String(body.mutationId)) return json({ ok: true, ...current });
  if (body.revision != null && Number(body.revision) !== Number(current.revision || 0)) {
    return json({ ok: false, error: { code: "REVISION_CONFLICT", message: "다른 기기에서 계획이 변경되었습니다." }, current }, 409);
  }
  const document = { schemaVersion: 2, revision: Number(current.revision || 0) + 1, updatedAt: new Date().toISOString(), mutationId: String(body.mutationId || crypto.randomUUID()), plans: body.plans };
  const serialized = JSON.stringify(document);
  if (serialized.length > 1_500_000) return apiError("PLAN_TOO_LARGE", "계획 저장 용량을 초과했습니다.", 413);
  await auth.store.put(`plans:${auth.userId}`, serialized);
  return json({ ok: true, ...document, savedAt: document.updatedAt });
}

export async function onRequest(context) {
  try {
    if (context.request.method === "GET") return await handleGet(context);
    if (context.request.method === "PUT") return await handlePut(context);
    return apiError("METHOD_NOT_ALLOWED", "지원하지 않는 요청입니다.", 405);
  } catch (error) {
    console.error("Plan sync API error", error instanceof Error ? error.message : "unknown");
    return apiError("SYNC_ERROR", "계획을 동기화하지 못했습니다.", 500);
  }
}
