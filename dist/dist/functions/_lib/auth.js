const encoder = new TextEncoder();
const PIN_ITERATIONS = 100_000;
export const SESSION_TTL_SECONDS = 2_592_000;

function bytesToHex(bytes) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256(value) {
  return bytesToHex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

export async function hashPin(pin, salt, iterations = PIN_ITERATIONS) {
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > PIN_ITERATIONS) {
    throw new Error("UNSUPPORTED_PBKDF2_ITERATIONS");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations },
    key,
    256
  );
  return bytesToHex(bits);
}

export function normalizeName(value) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("ko-KR").replace(/\s+/g, " ");
}

export async function createSession(store, userId) {
  const token = crypto.randomUUID() + crypto.randomUUID().replaceAll("-", "");
  const sessionKey = `session:${await sha256(token)}`;
  await store.put(sessionKey, userId, { expirationTtl: SESSION_TTL_SECONDS });
  const indexKey = `sessions:${userId}`;
  const sessions = (await store.get(indexKey, "json")) || [];
  const next = [...new Set([...sessions, sessionKey])].slice(-50);
  await store.put(indexKey, JSON.stringify(next), { expirationTtl: SESSION_TTL_SECONDS });
  return token;
}

export function getBearerToken(request) {
  const authorization = request.headers.get("authorization") || "";
  if (authorization.startsWith("Bearer ") && authorization.slice(7)) return authorization.slice(7);
  const cookie = request.headers.get("cookie") || "";
  return cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith("study_session="))?.slice(14) || "";
}

export async function getSessionUserId(request, store) {
  const token = getBearerToken(request);
  if (!token) return null;
  return store.get(`session:${await sha256(token)}`);
}

export async function deleteSession(request, store) {
  const token = getBearerToken(request);
  if (!token) return false;
  await store.delete(`session:${await sha256(token)}`);
  return true;
}

export async function deleteAllSessions(store, userId) {
  const indexKey = `sessions:${userId}`;
  const sessions = new Set((await store.get(indexKey, "json")) || []);
  // 이전 버전은 사용자별 세션 인덱스가 없었으므로, 코드 변경·계정 삭제 시
  // 기존 세션도 빠짐없이 만료하도록 session: 접두 키를 안전하게 조회한다.
  if (typeof store.list === "function") {
    let cursor;
    do {
      const page = await store.list({ prefix: "session:", cursor });
      for (const entry of page.keys || []) if ((await store.get(entry.name)) === userId) sessions.add(entry.name);
      cursor = page.list_complete === false ? page.cursor : undefined;
    } while (cursor);
  }
  await Promise.all([...sessions].map((key) => store.delete(key)));
  await store.delete(indexKey);
}

export function sessionCookie(token, maxAge = SESSION_TTL_SECONDS) {
  return `study_session=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

export const passwordPolicy = {
  iterations: PIN_ITERATIONS,
  algorithm: "PBKDF2-SHA256",
};
