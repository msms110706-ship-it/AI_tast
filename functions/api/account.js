import { createSession, hashPin, normalizeName, sha256 } from "../_lib/auth.js";
import { json } from "../_lib/http.js";

async function handlePost(context) {
  const store = context.env.STUDY_DATA;
  if (!store) return json({ error: "계정 저장소가 연결되지 않았습니다." }, 503);

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "로그인 형식이 올바르지 않습니다." }, 400);
  }

  const name = String(body.name || "").trim().slice(0, 30);
  const pin = String(body.pin || "");
  const grade = String(body.grade || "").trim();
  if (name.length < 2 || !/^\d{6,8}$/.test(pin)) {
    return json({ error: "별명은 2자 이상, 로그인 코드는 숫자 6~8자리로 입력해 주세요." }, 400);
  }
  if (!/^(초[4-6]|중[1-3]|고[1-3])$/.test(grade)) {
    return json({ error: "학년을 확인해 주세요." }, 400);
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
      pinHash: await hashPin(pin, salt),
      createdAt: new Date().toISOString(),
    };
    await store.put(accountKey, JSON.stringify(account));
  } else if ((await hashPin(pin, account.salt)) !== account.pinHash) {
    return json({ error: "이미 사용 중인 별명이거나 로그인 코드가 다릅니다." }, 401);
  }

  const token = await createSession(store, account.id);
  return json({
    token,
    user: {
      id: account.id,
      name: account.name,
      grade: account.grade,
      isChild: account.isChild,
    },
  });
}

export function onRequest(context) {
  if (context.request.method === "POST") return handlePost(context);
  return json({ error: "POST 요청만 지원합니다." }, 405);
}
