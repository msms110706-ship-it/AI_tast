import { createSession, deleteAllSessions, getSessionUserId, hashPin, normalizeName, passwordPolicy, sessionCookie, sha256 } from "../_lib/auth.js";
import { apiError, json } from "../_lib/http.js";

const STRONG_CODE = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d\s])\S{8,64}$/;
const MAX_ACCOUNTS_PER_NAME = 20;

async function accountCandidates(store, normalizedName) {
  const nameHash = await sha256(normalizedName);
  const legacyKey = `account:${nameHash}`;
  const indexKey = `accounts:${nameHash}`;
  const indexedKeys = (await store.get(indexKey, "json")) || [];
  const keys = [...new Set([legacyKey, ...indexedKeys])].slice(0, MAX_ACCOUNTS_PER_NAME + 1);
  const candidates = [];
  for (const key of keys) {
    const account = await store.get(key, "json");
    if (account) candidates.push({ account, accountKey: key });
  }
  return { candidates, indexKey, indexedKeys };
}

async function matchingAccount(candidates, pin, excludedId = "") {
  for (const candidate of candidates) {
    if (candidate.account.id === excludedId) continue;
    const iterations = candidate.account.iterations ?? passwordPolicy.iterations;
    if ((await hashPin(pin, candidate.account.salt, iterations)) === candidate.account.pinHash) return candidate;
  }
  return null;
}

async function handlePost(context) {
  try {
    const store = context.env.STUDY_DATA;
    if (!store) return apiError("STORE_UNAVAILABLE", "서비스 설정을 확인해 주세요.", 503);

    let body;
    try {
      body = await context.request.json();
    } catch {
      return apiError("INVALID_BODY", "입력 내용을 확인해 주세요.", 400);
    }

    const name = String(body.name || "").trim().slice(0, 30);
    const pin = String(body.pin || "").trim();
    const grade = String(body.grade || "").trim();
    if (name.length < 2 || pin.length < 6 || pin.length > 64 || /\s/.test(pin)) return apiError("INVALID_CREDENTIALS", "입력 내용을 확인해 주세요.", 400);
    if (!/^(초[4-6]|중[1-3]|고[1-3])$/.test(grade)) {
      return apiError("INVALID_GRADE", "학년을 확인해 주세요.", 400);
    }

    const normalizedName = normalizeName(name);
    const { candidates, indexKey, indexedKeys } = await accountCandidates(store, normalizedName);
    const matched = await matchingAccount(candidates, pin);
    let account = matched?.account || null;
    let accountKey = matched?.accountKey || "";

    if (!account) {
      if (!STRONG_CODE.test(pin)) return apiError("WEAK_LOGIN_CODE", "영문자·숫자·특수문자를 포함해 8자 이상으로 입력해 주세요.", 400);
      if (indexedKeys.length >= MAX_ACCOUNTS_PER_NAME) return apiError("ACCOUNT_LIMIT", "이 별명으로 만들 수 있는 계정 수를 초과했습니다.", 409);
      const salt = crypto.randomUUID();
      accountKey = `account-v2:${crypto.randomUUID()}`;
      account = {
        id: crypto.randomUUID(),
        name,
        grade,
        isChild: grade.startsWith("초") || body.isUnder13 === true,
        salt,
        iterations: passwordPolicy.iterations,
        pinHash: await hashPin(pin, salt, passwordPolicy.iterations),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        schemaVersion: 2,
      };
      await store.put(accountKey, JSON.stringify(account));
      await store.put(indexKey, JSON.stringify([...new Set([...indexedKeys, accountKey])].slice(-MAX_ACCOUNTS_PER_NAME)));
    }

    await store.put(`user:${account.id}`, JSON.stringify({ ...account, accountKey }));

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
    }, 200, { "set-cookie": sessionCookie(token) });
  } catch (error) {
    console.error("Account API error", error instanceof Error ? error.message : "unknown");
    return apiError("ACCOUNT_ERROR", "계정 요청을 처리하지 못했습니다.", 500);
  }
}

async function authenticated(context) {
  const store = context.env.STUDY_DATA;
  if (!store) return { error: apiError("STORE_UNAVAILABLE", "서비스 설정을 확인해 주세요.", 503) };
  const userId = await getSessionUserId(context.request, store);
  if (!userId) return { error: apiError("UNAUTHORIZED", "다시 로그인해 주세요.", 401) };
  const account = await store.get(`user:${userId}`, "json");
  if (!account) return { error: apiError("ACCOUNT_INDEX_REQUIRED", "기존 코드로 한 번 다시 로그인해 주세요.", 409) };
  return { store, userId, account };
}

async function handleGet(context) {
  const auth = await authenticated(context); if (auth.error) return auth.error;
  return json({ ok: true, account: { nickname: auth.account.name, grade: auth.account.grade, isChild: auth.account.isChild, createdAt: auth.account.createdAt, schemaVersion: auth.account.schemaVersion || 1 } });
}

async function handlePatch(context) {
  const auth = await authenticated(context); if (auth.error) return auth.error;
  let body; try { body = await context.request.json(); } catch { return apiError("INVALID_BODY", "입력 내용을 확인해 주세요."); }
  const currentCode = String(body.currentCode || "").trim(); const newCode = String(body.newCode || "").trim();
  if (!STRONG_CODE.test(newCode) || /\s/.test(newCode)) return apiError("WEAK_LOGIN_CODE", "새 코드는 영문자·숫자·특수문자를 포함해 8자 이상으로 입력해 주세요.");
  if ((await hashPin(currentCode, auth.account.salt, auth.account.iterations || passwordPolicy.iterations)) !== auth.account.pinHash) return apiError("INVALID_CREDENTIALS", "입력 내용을 확인해 주세요.", 401);
  const { candidates } = await accountCandidates(auth.store, normalizeName(auth.account.name));
  if (await matchingAccount(candidates, newCode, auth.userId)) return apiError("CREDENTIAL_COMBINATION_EXISTS", "같은 별명과 새 비밀번호 조합의 계정이 이미 있습니다.", 409);
  const salt = crypto.randomUUID(); const updated = { ...auth.account, salt, iterations: passwordPolicy.iterations, pinHash: await hashPin(newCode, salt), updatedAt: new Date().toISOString(), schemaVersion: 2 };
  await auth.store.put(auth.account.accountKey, JSON.stringify(updated)); await auth.store.put(`user:${auth.userId}`, JSON.stringify(updated)); await deleteAllSessions(auth.store, auth.userId);
  return json({ ok: true }, 200, { "set-cookie": sessionCookie("", 0) });
}

async function handleDelete(context) {
  const auth = await authenticated(context); if (auth.error) return auth.error;
  let body; try { body = await context.request.json(); } catch { return apiError("INVALID_BODY", "확인 문구를 입력해 주세요."); }
  if (String(body.confirmation || "").trim() !== auth.account.name) return apiError("CONFIRMATION_MISMATCH", "별명을 정확히 입력해 주세요.");
  await deleteAllSessions(auth.store, auth.userId);
  const normalizedName = normalizeName(auth.account.name);
  const nameHash = await sha256(normalizedName);
  const indexKey = `accounts:${nameHash}`;
  const indexedKeys = (await auth.store.get(indexKey, "json")) || [];
  const remainingKeys = indexedKeys.filter((key) => key !== auth.account.accountKey);
  if (remainingKeys.length) await auth.store.put(indexKey, JSON.stringify(remainingKeys));
  else await auth.store.delete(indexKey);
  await Promise.all([auth.store.delete(auth.account.accountKey), auth.store.delete(`user:${auth.userId}`), auth.store.delete(`plans:${auth.userId}`), auth.store.delete(`mistakes:${auth.userId}`)]);
  return json({ ok: true }, 200, { "set-cookie": sessionCookie("", 0) });
}

export function onRequest(context) {
  if (context.request.method === "POST") return handlePost(context);
  if (context.request.method === "GET") return handleGet(context);
  if (context.request.method === "PATCH") return handlePatch(context);
  if (context.request.method === "DELETE") return handleDelete(context);
  return apiError("METHOD_NOT_ALLOWED", "지원하지 않는 요청입니다.", 405);
}
