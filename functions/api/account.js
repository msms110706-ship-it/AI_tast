import { deleteAllSessions, getSessionUserId, hashPin, normalizeName, passwordPolicy, sessionCookie, sha256 } from "../_lib/auth.js";
import { apiError, json } from "../_lib/http.js";
import { loginAccount, passwordPolicyError, readRequestBody, registerAccount } from "../_lib/account-service.js";
import { discoverAccountDeletion, executeAccountDeletion } from "../_lib/account-deletion.js";

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
  return json({ ok: true, account: { displayName: auth.account.displayName || auth.account.name, grade: auth.account.grade, createdAt: auth.account.createdAt, schemaVersion: auth.account.schemaVersion || 1 } });
}

async function handlePatch(context) {
  const auth = await authenticated(context); if (auth.error) return auth.error;
  let body; try { body = await context.request.json(); } catch { return apiError("INVALID_BODY", "입력 내용을 확인해 주세요."); }
  if (Object.hasOwn(body, "displayName") && !Object.hasOwn(body, "newCode")) {
    const displayName = String(body.displayName || "").trim();
    if (displayName.length < 2 || displayName.length > 30) return apiError("INVALID_DISPLAY_NAME", "공개 별명은 2~30자로 입력해 주세요.", 400);
    const updated = { ...auth.account, displayName, accountId: auth.userId, loginId: auth.account.loginId || auth.account.name, updatedAt: new Date().toISOString(), schemaVersion: Math.max(Number(auth.account.schemaVersion || 1), 5) };
    await auth.store.put(`account-id:${auth.userId}`, JSON.stringify(updated));
    await auth.store.put(`user:${auth.userId}`, JSON.stringify(updated));
    return json({ ok: true, account: { displayName, grade: updated.grade } });
  }
  const currentCode = String(body.currentCode || "").trim(); const newCode = String(body.newCode || "").trim();
  const policyError = passwordPolicyError(auth.account.name, newCode);
  if (policyError) return apiError("WEAK_LOGIN_CODE", policyError);
  if ((await hashPin(currentCode, auth.account.salt, auth.account.iterations || passwordPolicy.iterations)) !== auth.account.pinHash) return apiError("INVALID_CREDENTIALS", "입력 내용을 확인해 주세요.", 401);
  const salt = crypto.randomUUID(); const canonicalKey = `account-id:${auth.userId}`; const updated = { ...auth.account, accountKey: canonicalKey, salt, iterations: passwordPolicy.iterations, pinHash: await hashPin(newCode, salt), updatedAt: new Date().toISOString(), schemaVersion: Math.max(Number(auth.account.schemaVersion || 1), 3) };
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
  const currentPassword = String(body.currentPassword || "");
  const iterations = auth.account.iterations || passwordPolicy.iterations;
  if (!currentPassword || (await hashPin(currentPassword, auth.account.salt, iterations)) !== auth.account.pinHash) return apiError("INVALID_CREDENTIALS", "현재 비밀번호가 올바르지 않습니다.", 401);
  if (String(body.confirmation || "").trim() !== "계정 영구 삭제") return apiError("CONFIRMATION_MISMATCH", "확인 문구를 정확히 입력해 주세요.", 400);
  try {
    const plan = await discoverAccountDeletion(auth.store, { ...auth.account, id: auth.userId });
    await executeAccountDeletion(auth.store, plan);
    return json({ ok: true }, 200, { "set-cookie": sessionCookie("", 0) });
  } catch (error) {
    console.error("Account deletion incomplete", { completedOperations: Number(error?.completed || 0) });
    return apiError("ACCOUNT_DELETION_INCOMPLETE", "계정 삭제를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.", 500);
  }
}

export async function onRequest(context) {
  try {
    if (context.request.method === "POST") return await handlePost(context);
    if (context.request.method === "GET") return await handleGet(context);
    if (context.request.method === "PATCH") return await handlePatch(context);
    if (context.request.method === "DELETE") return await handleDelete(context);
    return apiError("METHOD_NOT_ALLOWED", "지원하지 않는 요청입니다.", 405);
  } catch {
    return apiError("ACCOUNT_ERROR", "계정 요청을 처리하지 못했습니다.", 500);
  }
}
