const encoder = new TextEncoder();
const PIN_ITERATIONS = 100_000;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

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
  await store.put(`session:${await sha256(token)}`, userId, { expirationTtl: SESSION_TTL_SECONDS });
  return token;
}

export async function getSessionUserId(request, store) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return null;
  return store.get(`session:${await sha256(token)}`);
}

export const passwordPolicy = {
  iterations: PIN_ITERATIONS,
  algorithm: "PBKDF2-SHA256",
};
