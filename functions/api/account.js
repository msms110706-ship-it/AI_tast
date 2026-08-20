import { createSession, hashPin, normalizeName, passwordPolicy, sha256 } from "../_lib/auth.js";
import { json } from "../_lib/http.js";

async function handlePost(context) {
  try {
    const store = context.env.STUDY_DATA;
    if (!store) return json({ ok: false, error: "계정 저장소가 연결되지 않았습니다." }, 503);

    let body;
    try {
      body = await context.request.json();
    } catch {
      return json({ ok: false, error: "로그인 형식이 올바르지 않습니다." }, 400);
    }

    const name = String(body.name || "").trim().slice(0, 30);
    const pin = String(body.pin || "");
    const grade = String(body.grade || "").trim();
    if (name.length < 2 || !/^\d{6,8}$/.test(pin)) {
      return json({ ok: false, error: "별명은 2자 이상, 로그인 코드는 숫자 6~8자리로 입력해 주세요." }, 400);
    }
    if (!/^(초[4-6]|중[1-3]|고[1-3])$/.test(grade)) {
      return json({ ok: false, error: "학년을 확인해 주세요." }, 400);
    }

    const accountKey = `account:${await sha256(normalizeName(name))}`;
    let account = await store.get(accountKey, "json");

    if (!account) {
      const salt = crypto.randomUUID();
      account = {
        id: crypto.randomUUID(),
        name,
        grade,
        isChild: grade.startsWith("초") || body.isUnder13 === true,
        salt,
        iterations: passwordPolicy.iterations,
        pinHash: await hashPin(pin, salt, passwordPolicy.iterations),
        createdAt: new Date().toISOString(),
      };
      await store.put(accountKey, JSON.stringify(account));
    } else {
      const iterations = account.iterations ?? passwordPolicy.iterations;
      if ((await hashPin(pin, account.salt, iterations)) !== account.pinHash) {
        return json({ ok: false, error: "이미 사용 중인 별명이거나 로그인 코드가 다릅니다." }, 401);
      }
    }

    const token = await createSession(store, account.id);
    return json({
      ok: true,
      token,
      user: {
        id: account.id,
        name: account.name,
        grade: account.grade,
        isChild: account.isChild,
      },
      account: {
        nickname: account.name,
        grade: account.grade,
        ageGroup: account.isChild ? "under13" : "over13",
      },
    });
  } catch (error) {
    console.error("Account API error", error instanceof Error ? error.message : "unknown");
    return json({ ok: false, error: "계정 처리 중 오류가 발생했습니다." }, 500);
  }
}

export function onRequest(context) {
  if (context.request.method === "POST") return handlePost(context);
  return json({ ok: false, error: "POST 요청만 지원합니다." }, 405);
}
