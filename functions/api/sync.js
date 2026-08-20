import { getSessionUserId } from "../_lib/auth.js";
import { json } from "../_lib/http.js";

async function authorized(context) {
  const store = context.env.STUDY_DATA;
  if (!store) return { error: json({ error: "계정 저장소가 연결되지 않았습니다." }, 503) };
  const userId = await getSessionUserId(context.request, store);
  if (!userId) return { error: json({ error: "로그인이 만료되었습니다. 다시 로그인해 주세요." }, 401) };
  return { store, userId };
}

async function handleGet(context) {
  const auth = await authorized(context);
  if (auth.error) return auth.error;
  return json({ plans: (await auth.store.get(`plans:${auth.userId}`, "json")) || [] });
}

async function handlePut(context) {
  const auth = await authorized(context);
  if (auth.error) return auth.error;
  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "계획 형식이 올바르지 않습니다." }, 400);
  }
  if (!Array.isArray(body.plans) || body.plans.length > 100) {
    return json({ error: "저장할 계획 목록을 확인해 주세요." }, 400);
  }
  const serialized = JSON.stringify(body.plans);
  if (serialized.length > 1_500_000) return json({ error: "계획 저장 용량을 초과했습니다." }, 413);
  await auth.store.put(`plans:${auth.userId}`, serialized);
  return json({ ok: true, savedAt: new Date().toISOString() });
}

export async function onRequest(context) {
  try {
    if (context.request.method === "GET") return await handleGet(context);
    if (context.request.method === "PUT") return await handlePut(context);
    return json({ ok: false, error: "GET 또는 PUT 요청만 지원합니다." }, 405);
  } catch (error) {
    console.error("Plan sync API error", error instanceof Error ? error.message : "unknown");
    return json({ ok: false, error: "계획 동기화 중 오류가 발생했습니다." }, 500);
  }
}
