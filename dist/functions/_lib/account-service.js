import { createSession, hashPin, normalizeName, passwordPolicy, sessionCookie, sha256 } from "./auth.js";
import { apiError, json } from "./http.js";

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 30;
export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d\s])\S{8,64}$/;
const LEGACY_PIN_PATTERN = /^\d{6,8}$/;
const GRADE_PATTERN = /^(초[4-6]|중[1-3]|고[1-3])$/;
const AGE_GROUPS = new Set(["over14"]);
const MAX_LEGACY_ACCOUNTS_PER_NAME = 20;
const COMMON_PASSWORDS = new Set([
  "password1!", "password123!", "qwerty123!", "admin123!", "welcome123!",
  "letmein123!", "study123!", "iloveyou1!", "abc12345!", "12345678a!",
]);

export function passwordPolicyError(loginId, password) {
  const normalizedPassword = password.normalize("NFKC").toLocaleLowerCase("ko-KR");
  if (!PASSWORD_PATTERN.test(password)) return "비밀번호는 영문자·숫자·특수문자를 포함해 8자 이상으로 입력해 주세요.";
  if (normalizedPassword === normalizeName(loginId)) return "로그인 아이디와 같은 비밀번호는 사용할 수 없습니다.";
  if (COMMON_PASSWORDS.has(normalizedPassword)) return "너무 흔한 비밀번호는 사용할 수 없습니다. 더 안전한 비밀번호를 만들어 주세요.";
  return "";
}

function publicAccount(account) {
  const isLegacyChild = account.ageGroup === "under14" || account.ageGroup === "under13" || account.isChild === true;
  return {
    displayName: account.displayName || account.name,
    grade: account.grade,
    ageGroup: isLegacyChild ? "기존 만 14세 미만 계정" : "만 14세 이상",
  };
}

function publicUser(account) {
  const isLegacyChild = account.ageGroup === "under14" || account.ageGroup === "under13" || account.isChild === true;
  return {
    id: account.id,
    displayName: account.displayName || account.name,
    grade: account.grade,
    isChild: isLegacyChild,
  };
}

export async function accountLookup(store, name) {
  const normalizedName = normalizeName(name);
  const nameHash = await sha256(normalizedName);
  const nameKey = `name:${nameHash}`;
  const mappedId = await store.get(nameKey);
  const legacyIndexKey = `accounts:${nameHash}`;
  const indexedKeys = (await store.get(legacyIndexKey, "json")) || [];
  const keys = [
    mappedId ? `account-id:${mappedId}` : "",
    mappedId ? `user:${mappedId}` : "",
    `account:${nameHash}`,
    ...indexedKeys.slice(0, MAX_LEGACY_ACCOUNTS_PER_NAME),
  ].filter(Boolean);
  const candidates = [];
  const seenIds = new Set();
  for (const key of [...new Set(keys)]) {
    const account = await store.get(key, "json");
    if (account?.id && !seenIds.has(account.id)) {
      candidates.push({ account, accountKey: key });
      seenIds.add(account.id);
    }
  }
  return { normalizedName, nameHash, nameKey, mappedId, candidates };
}

async function verifyCandidate(candidates, password) {
  for (const candidate of candidates) {
    const iterations = candidate.account.iterations ?? passwordPolicy.iterations;
    if ((await hashPin(password, candidate.account.salt, iterations)) === candidate.account.pinHash) return candidate;
  }
  return null;
}

async function writeCompatibilityIndexes(store, lookup, matched) {
  const account = { ...matched.account, accountKey: `account-id:${matched.account.id}` };
  // Copy first, then publish indexes. Existing records and plans are intentionally retained.
  await store.put(account.accountKey, JSON.stringify(account));
  await store.put(`user:${account.id}`, JSON.stringify(account));
  if (!lookup.mappedId) await store.put(lookup.nameKey, account.id);
  return account;
}

function invalidCredentials() {
  return apiError("INVALID_CREDENTIALS", "로그인 아이디 또는 비밀번호가 올바르지 않습니다.", 401);
}

export async function loginAccount(context, suppliedBody) {
  const store = context.env.STUDY_DATA;
  if (!store) return apiError("STORE_UNAVAILABLE", "서비스 설정을 확인해 주세요.", 503);
  const name = String(suppliedBody.loginId ?? suppliedBody.name ?? "").trim();
  const password = String(suppliedBody.password ?? suppliedBody.pin ?? "");
  if (name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH || (!LEGACY_PIN_PATTERN.test(password) && !PASSWORD_PATTERN.test(password))) {
    return invalidCredentials();
  }
  const lookup = await accountLookup(store, name);
  const matched = await verifyCandidate(lookup.candidates, password);
  if (!matched) return invalidCredentials();

  const account = await writeCompatibilityIndexes(store, lookup, matched);
  const token = await createSession(store, account.id);
  return json({ ok: true, account: publicAccount(account), user: publicUser(account) }, 200, { "set-cookie": sessionCookie(token) });
}

export async function registerAccount(context, suppliedBody) {
  const store = context.env.STUDY_DATA;
  if (!store) return apiError("STORE_UNAVAILABLE", "서비스 설정을 확인해 주세요.", 503);
  const name = String(suppliedBody.loginId ?? suppliedBody.name ?? "").trim();
  const displayName = String(suppliedBody.displayName || "").trim();
  const password = String(suppliedBody.password ?? suppliedBody.pin ?? "");
  const passwordConfirm = String(suppliedBody.passwordConfirm ?? "");
  const grade = String(suppliedBody.grade || "").trim();
  const ageGroup = String(suppliedBody.ageGroup || "").trim();
  if (name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH) return apiError("INVALID_LOGIN_ID", `로그인 아이디는 ${NAME_MIN_LENGTH}~${NAME_MAX_LENGTH}자로 입력해 주세요.`, 400);
  if (displayName.length < NAME_MIN_LENGTH || displayName.length > NAME_MAX_LENGTH) return apiError("INVALID_DISPLAY_NAME", `공개 별명은 ${NAME_MIN_LENGTH}~${NAME_MAX_LENGTH}자로 입력해 주세요.`, 400);
  const policyError = passwordPolicyError(name, password);
  if (policyError) return apiError("WEAK_PASSWORD", policyError, 400);
  if (password !== passwordConfirm) return apiError("PASSWORD_MISMATCH", "비밀번호 확인이 일치하지 않습니다.", 400);
  if (!GRADE_PATTERN.test(grade)) return apiError("INVALID_GRADE", "학년을 선택해 주세요.", 400);
  if (!AGE_GROUPS.has(ageGroup)) return apiError("LOCAL_MODE_REQUIRED", "만 14세 미만은 서버 계정을 만들 수 없습니다. 기기 전용 모드를 이용해 주세요.", 400);
  if (suppliedBody.recoveryAcknowledged !== true) return apiError("RECOVERY_ACKNOWLEDGEMENT_REQUIRED", "계정 복구 제한을 확인해 주세요.", 400);

  const lookup = await accountLookup(store, name);
  if (lookup.mappedId || lookup.candidates.length) {
    return apiError("ACCOUNT_ALREADY_EXISTS", "사용할 수 없는 로그인 아이디입니다.", 409);
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const salt = crypto.randomUUID();
  const accountKey = `account-id:${id}`;
  const account = {
    id, accountId: id, name, loginId: name, displayName, normalizedName: lookup.normalizedName, grade, ageGroup,
    isChild: false, salt,
    iterations: passwordPolicy.iterations,
    pinHash: await hashPin(password, salt, passwordPolicy.iterations),
    recoveryAcknowledged: true,
    createdAt: now, updatedAt: now, schemaVersion: 5, accountKey,
  };
  // The name index is written last so partially written accounts are never discoverable.
  await store.put(accountKey, JSON.stringify(account));
  await store.put(`user:${id}`, JSON.stringify(account));
  await store.put(lookup.nameKey, id);
  const token = await createSession(store, id);
  return json({ ok: true, account: publicAccount(account), user: publicUser(account) }, 201, { "set-cookie": sessionCookie(token) });
}

export async function readRequestBody(request) {
  try {
    return { body: await request.json() };
  } catch {
    return { error: apiError("INVALID_BODY", "입력 내용을 확인해 주세요.", 400) };
  }
}
