import { deleteAllSessions, getSessionUserId, hashPin, normalizeName, passwordPolicy, sessionCookie, sha256 } from "../_lib/auth.js";
import { apiError, json } from "../_lib/http.js";
import { loginAccount, readRequestBody, registerAccount } from "../_lib/account-service.js";

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
    const parsed = await readRequestBody(context.request);
    if (parsed.error) return parsed.error;
    if (parsed.body.action === "login") return await loginAccount(context, parsed.body);
    if (parsed.body.action === "register") return await registerAccount(context, parsed.body);
    return apiError("INVALID_ACTION", "로그인 또는 새 계정 만들기를 선택해 주세요.", 400);
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
  const { candidates: collisionCandidates } = await accountCandidates(auth.store, normalizeName(auth.account.name));
  if (await matchingAccount(collisionCandidates, newCode, auth.userId)) return apiError("CREDENTIAL_COMBINATION_EXISTS", "같은 별명과 새 비밀번호 조합의 계정이 이미 있습니다.", 409);
  const salt = crypto.randomUUID(); const canonicalKey = `account-id:${auth.userId}`; const updated = { ...auth.account, accountKey: canonicalKey, salt, iterations: passwordPolicy.iterations, pinHash: await hashPin(newCode, salt), updatedAt: new Date().toISOString(), schemaVersion: 3 };
  await auth.store.put(canonicalKey, JSON.stringify(updated)); await auth.store.put(`user:${auth.userId}`, JSON.stringify(updated));
  const nameHash = await sha256(normalizeName(auth.account.name)); await auth.store.put(`name:${nameHash}`, auth.userId);
  // Update retained legacy copies for this same account so an old password cannot revive them.
  const { candidates } = await accountCandidates(auth.store, normalizeName(auth.account.name));
  await Promise.all(candidates.filter((candidate) => candidate.account.id === auth.userId && candidate.accountKey !== canonicalKey && candidate.accountKey !== `user:${auth.userId}`).map((candidate) => auth.store.put(candidate.accountKey, JSON.stringify({ ...updated, accountKey: candidate.accountKey }))));
  await deleteAllSessions(auth.store, auth.userId);
  return json({ ok: true }, 200, { "set-cookie": sessionCookie("", 0) });
}

async function handleDelete(context) {
  const auth = await authenticated(context); if (auth.error) return auth.error;
  let body; try { body = await context.request.json(); } catch { return apiError("INVALID_BODY", "확인 문구를 입력해 주세요."); }
  if (String(body.confirmation || "").trim() !== auth.account.name) return apiError("CONFIRMATION_MISMATCH", "별명을 정확히 입력해 주세요.");
  await deleteAllSessions(auth.store, auth.userId);
  const normalizedName = normalizeName(auth.account.name);
  const nameHash = await sha256(normalizedName);
  const mappedId = await auth.store.get(`name:${nameHash}`);
  const indexKey = `accounts:${nameHash}`;
  const indexedKeys = (await auth.store.get(indexKey, "json")) || [];
  const { candidates } = await accountCandidates(auth.store, normalizedName);
  const accountKeys = candidates.filter((candidate) => candidate.account.id === auth.userId).map((candidate) => candidate.accountKey);
  const removingKeys = new Set([...accountKeys, auth.account.accountKey, `account-id:${auth.userId}`, `user:${auth.userId}`]);
  const remainingKeys = indexedKeys.filter((key) => !removingKeys.has(key));
  if (remainingKeys.length) await auth.store.put(indexKey, JSON.stringify(remainingKeys));
  else await auth.store.delete(indexKey);
  await Promise.all([...new Set([...removingKeys, `plans:${auth.userId}`, `mistakes:${auth.userId}`])].map((key) => auth.store.delete(key)));
  if (mappedId === auth.userId) await auth.store.delete(`name:${nameHash}`);
  return json({ ok: true }, 200, { "set-cookie": sessionCookie("", 0) });
}

export function onRequest(context) {
  if (context.request.method === "POST") return handlePost(context);
  if (context.request.method === "GET") return handleGet(context);
  if (context.request.method === "PATCH") return handlePatch(context);
  if (context.request.method === "DELETE") return handleDelete(context);
  return apiError("METHOD_NOT_ALLOWED", "지원하지 않는 요청입니다.", 405);
}
