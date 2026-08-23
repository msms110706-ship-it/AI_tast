import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const { createSession, hashPin, normalizeName, passwordPolicy, sha256 } = await import("../functions/_lib/auth.js");
const { loginAccount, registerAccount } = await import("../functions/_lib/account-service.js");
const [accountRoute] = await Promise.all([
  import("../functions/api/account.js"),
  import("../functions/api/account/login.js"),
  import("../functions/api/account/register.js"),
  import("../functions/api/account/logout.js"),
  import("../functions/api/account/me.js"),
]);
const { cleanupAccount } = await import("../scripts/account-cleanup-lib.mjs");
const { auditStudyData } = await import("../scripts/kv-integrity-audit-lib.mjs");
const { createCloudflareKvReadClient } = await import("../scripts/cloudflare-kv-read-client.mjs");
const { repairAccountMappings } = await import("../scripts/account-mapping-repair-lib.mjs");
const { auditAccountSchema } = await import("../scripts/account-schema-audit-lib.mjs");
const syncRoute = await import("../functions/api/sync.js");
const middleware = await import("../functions/_middleware.js");

class MockKV {
  constructor() { this.values = new Map(); this.metadata = new Map(); this.writes = []; }
  async get(key, type) {
    const value = this.values.get(key);
    if (value == null) return null;
    return type === "json" ? JSON.parse(value) : value;
  }
  async put(key, value, options) { this.values.set(key, String(value)); this.metadata.set(key, options?.expirationTtl ? { expiration: Math.floor(Date.now() / 1000) + options.expirationTtl } : {}); this.writes.push({ op: "put", key, options }); }
  async delete(key) { this.values.delete(key); this.metadata.delete(key); this.writes.push({ op: "delete", key }); }
  async list({ prefix = "" } = {}) { return { keys: [...this.values.keys()].filter((key) => key.startsWith(prefix)).map((name) => ({ name, ...(this.metadata.get(name) || {}) })), list_complete: true }; }
}

function context(store) { return { env: { STUDY_DATA: store } }; }
async function body(response) { return response.json(); }

async function seedLegacy(store, { name = "기존학생", pin = "123456", id = "legacy-id", plans = [{ id: "plan-1", done: true }] } = {}) {
  const salt = "legacy-salt";
  const key = `account:${await sha256(normalizeName(name))}`;
  const account = { id, name, grade: "중2", isChild: false, salt, iterations: passwordPolicy.iterations, pinHash: await hashPin(pin, salt), createdAt: "2026-01-01T00:00:00.000Z" };
  await store.put(key, JSON.stringify(account));
  await store.put(`plans:${id}`, JSON.stringify(plans));
  store.writes = [];
  return { key, account, plans };
}

test("unknown login returns uniform 401 and writes nothing", async () => {
  const store = new MockKV();
  const response = await loginAccount(context(store), { name: "없는학생", password: "Wrong1!x" });
  assert.equal(response.status, 401);
  assert.deepEqual(await body(response), { ok: false, error: { code: "INVALID_CREDENTIALS", message: "로그인 아이디 또는 비밀번호가 올바르지 않습니다." } });
  assert.equal(store.writes.length, 0);
});

test("wrong legacy code creates neither account, plan nor session", async () => {
  const store = new MockKV();
  await seedLegacy(store);
  const before = new Map(store.values);
  const response = await loginAccount(context(store), { name: "기존학생", password: "654321" });
  assert.equal(response.status, 401);
  assert.deepEqual(store.values, before);
  assert.equal(store.writes.length, 0);
});

test("valid legacy code logs in, preserves plans, and migrates idempotently", async () => {
  const store = new MockKV();
  const seeded = await seedLegacy(store);
  const first = await loginAccount(context(store), { name: " 기존학생 ", password: "123456" });
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("set-cookie").includes("Max-Age=2592000; HttpOnly; Secure; SameSite=Lax"), true);
  assert.deepEqual(await store.get("plans:legacy-id", "json"), seeded.plans);
  assert.ok(await store.get("account-id:legacy-id", "json"));
  assert.equal(await store.get(`name:${await sha256(normalizeName("기존학생"))}`), "legacy-id");
  const accountCount = [...store.values.keys()].filter((key) => key === "account-id:legacy-id").length;
  const second = await loginAccount(context(store), { name: "기존학생", password: "123456" });
  assert.equal(second.status, 200);
  assert.equal([...store.values.keys()].filter((key) => key === "account-id:legacy-id").length, accountCount);
});

test("register validates confirmation and password policy", async () => {
  const store = new MockKV();
  assert.equal((await registerAccount(context(store), { loginId: "새학생", displayName: "공개별명", password: "Good123!", passwordConfirm: "Good124!", grade: "중2", ageGroup: "over14", recoveryAcknowledged: true })).status, 400);
  assert.equal((await registerAccount(context(store), { loginId: "새학생", displayName: "공개별명", password: "password", passwordConfirm: "password", grade: "중2", ageGroup: "over14", recoveryAcknowledged: true })).status, 400);
  assert.equal(store.writes.length, 0);
});

test("registration acknowledgement is required by the server", async () => {
  const store = new MockKV();
  const response = await registerAccount(context(store), { loginId: "student-one", displayName: "별명", password: "Good123!", passwordConfirm: "Good123!", grade: "중2", ageGroup: "over14" });
  assert.equal(response.status, 400);
  assert.equal((await body(response)).error.code, "RECOVERY_ACKNOWLEDGEMENT_REQUIRED");
  assert.equal(store.writes.length, 0);
});

test("same password works for different login ids and duplicate id returns 409", async () => {
  const store = new MockKV();
  const input = { loginId: " student-one ", displayName: "같은별명", password: "Good123!", passwordConfirm: "Good123!", grade: "중2", ageGroup: "over14", recoveryAcknowledged: true };
  const created = await registerAccount(context(store), input);
  assert.equal(created.status, 201);
  assert.equal((await registerAccount(context(store), { ...input, loginId: "student-two" })).status, 201);
  const duplicate = await registerAccount(context(store), { ...input, loginId: "student-one" });
  assert.equal(duplicate.status, 409);
  assert.equal((await body(duplicate)).error.code, "ACCOUNT_ALREADY_EXISTS");
});

test("duplicate display names are allowed and public responses never expose loginId", async () => {
  const store = new MockKV();
  const base = { displayName: "같은 공개 별명", password: "Good123!", passwordConfirm: "Good123!", grade: "중2", ageGroup: "over14", recoveryAcknowledged: true };
  const first = await registerAccount(context(store), { ...base, loginId: "private-one" });
  const second = await registerAccount(context(store), { ...base, loginId: "private-two" });
  assert.equal(first.status, 201); assert.equal(second.status, 201);
  const serialized = JSON.stringify(await body(second));
  assert.equal(serialized.includes("private-two"), false);
  assert.equal(serialized.includes("loginId"), false);
  assert.equal(serialized.includes("같은 공개 별명"), true);
});

test("under-14 registration is rejected without any KV write", async () => {
  const store = new MockKV();
  const response = await registerAccount(context(store), { loginId: "child-private", displayName: "로컬학생", password: "Good123!", passwordConfirm: "Good123!", grade: "중1", ageGroup: "under14", recoveryAcknowledged: true });
  assert.equal(response.status, 400);
  assert.equal((await body(response)).error.code, "LOCAL_MODE_REQUIRED");
  assert.equal(store.writes.length, 0);
});

test("unauthenticated API is JSON 401 and security headers cover API responses", async () => {
  const store = new MockKV();
  const unauthorized = await syncRoute.onRequest({ request: new Request("https://example.test/api/sync"), env: { STUDY_DATA: store } });
  assert.equal(unauthorized.status, 401); assert.match(unauthorized.headers.get("content-type"), /application\/json/);
  const secured = await middleware.onRequest({ request: new Request("https://example.test/api/sync"), next: async () => unauthorized });
  assert.equal(secured.headers.get("x-content-type-options"), "nosniff");
  assert.equal(secured.headers.get("x-frame-options"), "DENY");
  assert.match(secured.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.equal(store.writes.length, 0);
});

test("HTML middleware never applies the API-only enforced CSP", async () => {
  const html = new Response("<!doctype html><div id=app></div>", { headers: { "content-type": "text/html", "content-security-policy": "default-src 'none'" } });
  const secured = await middleware.onRequest({ request: new Request("https://example.test/"), next: async () => html });
  assert.equal(secured.headers.has("content-security-policy"), false);
  assert.equal(secured.headers.get("x-frame-options"), "DENY");
  const headersFile = await readFile(new URL("../public/_headers", import.meta.url), "utf8");
  assert.match(headersFile, /Content-Security-Policy-Report-Only:/);
  assert.doesNotMatch(headersFile, /^\s*Content-Security-Policy:/m);
});

test("local-only UI blocks account and external services and provides JSON backup", async () => {
  const source = await readFile(new URL("../app/page.js", import.meta.url), "utf8");
  assert.match(source, /계정 없이 이 기기에서 시작하기/);
  assert.match(source, /기기 변경 또는 브라우저 데이터 삭제 시 학습 기록을 복구할 수 없음을 확인했습니다/);
  assert.match(source, /if \(ageGroup === "under14"\) \{ startLocalMode\(\); return; \}/);
  assert.match(source, /if \(user\?\.isChild\).*Formspree/s);
  assert.match(source, /study-flow-local.*JSON으로 내보내기/s);
  assert.match(source, /기존 서버 데이터와 ID가 같은 항목은 서버 항목을 유지합니다/);
});

test("schema and under-14 audit is read-only, anonymous, and idempotent", async () => {
  const store = new MockKV();
  await seedLegacy(store, { name: "비공개아이디", id: "sensitive-account-id" });
  const account = await store.get(`account:${await sha256(normalizeName("비공개아이디"))}`, "json");
  await store.put("user:sensitive-account-id", JSON.stringify({ ...account, isChild: true }));
  await store.put("mistakes:sensitive-account-id", "[]"); store.writes = [];
  const first = await auditAccountSchema(store); const second = await auditAccountSchema(store);
  assert.deepEqual(first, second); assert.equal(store.writes.length, 0); assert.equal(first.under14.count, 1);
  const serialized = JSON.stringify(first); assert.equal(serialized.includes("비공개아이디"), false); assert.equal(serialized.includes("sensitive-account-id"), false);
});

test("registration UI contains prominent recovery warning and required checkbox", async () => {
  const source = await readFile(new URL("../app/page.js", import.meta.url), "utf8");
  assert.match(source, /비밀번호 찾기 및 복구 기능은 제공되지 않습니다/);
  assert.match(source, /recoveryAcknowledged/);
  assert.match(source, /ageGroup === "under14" \? !localModeAcknowledged : !recoveryAcknowledged/);
  assert.match(source, /로그인 아이디/);
});

async function seedCurrentAccount(store, { id, name, password }) {
  const salt = `salt-${id}`;
  const account = { id, name, grade: "중2", isChild: false, salt, iterations: passwordPolicy.iterations, pinHash: await hashPin(password, salt), accountKey: `account-id:${id}` };
  const nameHash = await sha256(normalizeName(name));
  await store.put(`account-id:${id}`, JSON.stringify(account));
  await store.put(`user:${id}`, JSON.stringify(account));
  await store.put(`name:${nameHash}`, id);
  await store.put(`plans:${id}`, JSON.stringify([{ id: `${id}-plan`, done: true }]));
  await store.put(`mistakes:${id}`, JSON.stringify([{ id: `${id}-mistake` }]));
  return account;
}

test("authenticated deletion removes only the current account and blocks all sessions", async () => {
  const store = new MockKV();
  const first = await seedCurrentAccount(store, { id: "first-id", name: "student-one", password: "Delete123!" });
  await seedCurrentAccount(store, { id: "second-id", name: "student-two", password: "Delete123!" });
  const token1 = await createSession(store, first.id);
  const token2 = await createSession(store, first.id);
  store.writes = [];
  const request = new Request("https://example.test/api/account", { method: "DELETE", headers: { authorization: `Bearer ${token1}`, "content-type": "application/json" }, body: JSON.stringify({ currentPassword: "Delete123!", confirmation: "계정 영구 삭제", accountId: "second-id" }) });
  const response = await accountRoute.onRequest({ request, env: { STUDY_DATA: store } });
  assert.equal(response.status, 200);
  assert.equal(await store.get(`session:${await sha256(token1)}`), null);
  assert.equal(await store.get(`session:${await sha256(token2)}`), null);
  assert.equal(await store.get("plans:first-id"), null);
  assert.ok(await store.get("plans:second-id"));
  assert.ok(await store.get("account-id:second-id"));
});

test("cleanup defaults to dry-run and never touches an unspecified account", async () => {
  const store = new MockKV();
  await seedCurrentAccount(store, { id: "first-id", name: "student-one", password: "Delete123!" });
  await seedCurrentAccount(store, { id: "second-id", name: "student-two", password: "Delete123!" });
  store.writes = [];
  const result = await cleanupAccount(store, { loginId: "student-one" });
  assert.equal(result.dryRun, true);
  assert.equal(store.writes.length, 0);
  assert.ok(await store.get("account-id:first-id"));
  assert.ok(await store.get("account-id:second-id"));
});

test("confirmed cleanup deletes only the explicitly selected account", async () => {
  const store = new MockKV();
  await seedCurrentAccount(store, { id: "first-id", name: "student-one", password: "Delete123!" });
  await seedCurrentAccount(store, { id: "second-id", name: "student-two", password: "Delete123!" });
  await cleanupAccount(store, { accountId: "first-id" }, { dryRun: false, confirmation: "DELETE THIS ACCOUNT" });
  assert.equal(await store.get("account-id:first-id"), null);
  assert.ok(await store.get("account-id:second-id"));
  assert.ok(await store.get("plans:second-id"));
});

test("login id and common passwords are rejected for new accounts", async () => {
  const store = new MockKV();
  const base = { displayName: "공개별명", passwordConfirm: "student-one", grade: "중2", ageGroup: "over14", recoveryAcknowledged: true };
  assert.equal((await registerAccount(context(store), { ...base, loginId: "student-one", password: "student-one" })).status, 400);
  assert.equal((await registerAccount(context(store), { ...base, loginId: "student-two", password: "Qwerty123!", passwordConfirm: "Qwerty123!" })).status, 400);
  assert.equal(store.writes.length, 0);
});

test("read-only integrity audit finds orphans, missing mappings, duplicates, and missing TTL", async () => {
  const store = new MockKV();
  await seedCurrentAccount(store, { id: "valid-id", name: "student-one", password: "Good123!" });
  const duplicate = await seedCurrentAccount(store, { id: "duplicate-id", name: "student-one", password: "Good123!" });
  await store.delete(`name:${await sha256(normalizeName(duplicate.name))}`);
  await store.put("plans:missing-id", "[]");
  await store.put("mistakes:missing-id", "[]");
  await store.put("progress:missing-id", "{}");
  await store.put("session:no-ttl-token-hash", "missing-id");
  await store.put("sessions:missing-id", JSON.stringify(["session:no-ttl-token-hash"]));
  await store.put(`name:${await sha256(normalizeName("orphan-user"))}`, "missing-id");
  await store.delete("account-id:valid-id");
  store.writes = [];

  const report = await auditStudyData(store, undefined, { detail: true });
  assert.equal(report.dryRun, true);
  assert.deepEqual(report.kvMutations, { writes: 0, deletes: 0 });
  assert.equal(store.writes.length, 0);
  assert.equal(report.findings.orphanNameMappings[0].count, 1);
  assert.equal(report.findings.orphanPlans[0].count, 1);
  assert.equal(report.findings.orphanSessions[0].count, 1);
  assert.equal(report.findings.orphanOtherLearningData.reduce((sum, item) => sum + item.count, 0), 2);
  assert.ok(report.findings.accountsWithoutNameMapping.length >= 1);
  assert.ok(report.findings.duplicateLoginIds.length >= 2);
  assert.equal(report.findings.sessionsWithoutVerifiableTtl[0].count, 1);
  assert.ok(report.findings.otherLinkedKeyIssues.some((item) => item.prefix === "account-id:missing"));
  assert.equal(JSON.stringify(report).includes("no-ttl-token-hash"), false);
  assert.equal(store.writes.length, 0);
  const missing = report.accountDetails.find((item) => item.accountId === "miss…");
  assert.deepEqual(missing.records["plans:"], { exists: true, count: 1 });
  assert.deepEqual(missing.records["account-id:"], { exists: false, count: 0 });
  assert.ok(missing.suggestions.orphanDataDeletionCandidates.includes("plans:"));
  assert.ok(missing.suggestions.orphanDataDeletionCandidates.includes("name:"));
  assert.equal(JSON.stringify(report).includes("missing-id"), false);
});

test("repair dry-run plans only unambiguous mappings and performs zero mutations", async () => {
  const store = new MockKV();
  await seedCurrentAccount(store, { id: "repairable-id", name: "repairable-user", password: "Good123!" });
  await store.delete("account-id:repairable-id");
  await store.delete(`name:${await sha256(normalizeName("repairable-user"))}`);
  await seedCurrentAccount(store, { id: "conflict-one", name: "shared-user", password: "Good123!" });
  await seedCurrentAccount(store, { id: "conflict-two", name: "shared-user", password: "Good123!" });
  await store.delete(`name:${await sha256(normalizeName("shared-user"))}`);
  store.writes = [];

  const report = await auditStudyData(store, undefined, { detail: true, repairDryRun: true });
  assert.deepEqual(report.kvMutations, { writes: 0, deletes: 0 });
  assert.equal(store.writes.length, 0);
  const repairable = report.repairPlan.find((item) => item.accountId === "repa…");
  assert.equal(repairable.repairs["account-id:"].status, "ready");
  assert.equal(repairable.repairs["name:"].status, "ready");
  const blocked = report.repairPlan.filter((item) => item.accountId.startsWith("conf"));
  assert.ok(blocked.every((item) => item.repairs["name:"].status === "blocked"));
  assert.ok(blocked.every((item) => item.repairs["name:"].warnings.includes("DUPLICATE_LOGIN_ID")));
  const serialized = JSON.stringify(report);
  assert.equal(serialized.includes("repairable-id"), false);
  assert.equal(serialized.includes("repairable-user"), false);
  assert.equal(serialized.includes("shared-user"), false);
});

test("mapping repair requires an explicit account id before any KV access", async () => {
  let accesses = 0;
  const store = {
    async get() { accesses += 1; return null; },
    async list() { accesses += 1; return { keys: [], list_complete: true }; },
    async put() { accesses += 1; },
  };
  await assert.rejects(repairAccountMappings(store, "", { apply: true }), /ACCOUNT_ID_REQUIRED/);
  assert.equal(accesses, 0);
  const cli = spawnSync(process.execPath, ["scripts/repair-account-mappings.mjs"], { cwd: new URL("..", import.meta.url), encoding: "utf8" });
  assert.equal(cli.status, 2);
});

test("selected mapping repair writes only missing mapping prefixes", async () => {
  const store = new MockKV();
  await seedCurrentAccount(store, { id: "selected-account", name: "selected-user", password: "Good123!" });
  const originalPlans = await store.get("plans:selected-account");
  const originalMistakes = await store.get("mistakes:selected-account");
  await store.delete("account-id:selected-account");
  await store.delete(`name:${await sha256(normalizeName("selected-user"))}`);
  store.writes = [];
  let prepared;

  const result = await repairAccountMappings(store, "selected-account", { apply: true, onPrepared(plan) { prepared = plan; } });
  assert.equal(prepared.accountId, "sele…");
  assert.deepEqual(prepared.prefixes, ["account-id:", "name:"]);
  assert.equal(prepared.plannedWrites, 2);
  assert.deepEqual(result.kvMutations, { writes: 2, deletes: 0 });
  assert.deepEqual(store.writes.map((item) => item.key).sort(), ["account-id:selected-account", `name:${await sha256(normalizeName("selected-user"))}`].sort());
  assert.equal(await store.get("plans:selected-account"), originalPlans);
  assert.equal(await store.get("mistakes:selected-account"), originalMistakes);
});

test("mapping repair blocks duplicates and existing destinations without writes", async () => {
  const store = new MockKV();
  await seedCurrentAccount(store, { id: "collision-one", name: "collision-user", password: "Good123!" });
  await seedCurrentAccount(store, { id: "collision-two", name: "collision-user", password: "Good123!" });
  store.writes = [];
  await assert.rejects(repairAccountMappings(store, "collision-one", { apply: true }), /REPAIR_BLOCKED/);
  assert.equal(store.writes.length, 0);
});

test("account API token verification uses account endpoint and GET-only bearer requests", async () => {
  const calls = [];
  const accountId = "a".repeat(32);
  const namespaceId = "b".repeat(32);
  const fakeFetch = async (url, init) => {
    calls.push({ url: String(url), method: init.method, authorization: init.headers.Authorization });
    if (String(url).endsWith("/tokens/verify")) return Response.json({ success: true, result: { status: "active" } });
    if (String(url).includes("/keys?")) return Response.json({ success: true, result: [], result_info: {} });
    throw new Error("UNEXPECTED_URL");
  };
  const client = createCloudflareKvReadClient({ accountId: ` ${accountId} `, namespaceId: ` ${namespaceId} `, token: " secret-token ", fetchImpl: fakeFetch });
  await client.verify();
  assert.equal(calls[0].url, `https://api.cloudflare.com/client/v4/accounts/${accountId}/tokens/verify`);
  assert.equal(calls.some((call) => call.url.includes("/user/tokens/verify")), false);
  assert.equal(calls[1].url, `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/keys?limit=1000`);
  assert.equal(calls.every((call) => call.method === "GET"), true);
  assert.equal(calls.every((call) => call.authorization === "Bearer secret-token"), true);
  assert.equal(typeof client.store.put, "undefined");
  assert.equal(typeof client.store.delete, "undefined");
});

test("Cloudflare read client reports safe status-specific errors", async () => {
  const accountId = "a".repeat(32);
  const namespaceId = "b".repeat(32);
  for (const [status, message] of [[401, "토큰 인증 실패"], [403, "토큰 권한 부족"], [404, "Account ID 또는 Namespace ID 불일치"], [500, "Cloudflare 읽기 API 오류"]]) {
    const client = createCloudflareKvReadClient({ accountId, namespaceId, token: "token", fetchImpl: async () => Response.json({ errors: [{ code: 1000, message: "safe message" }] }, { status }) });
    await assert.rejects(client.verify(), new RegExp(message));
  }
});

test("HTTP 400 identifies token, key-list, and value-read stages without leaking secrets", async () => {
  const accountId = "a".repeat(32);
  const namespaceId = "b".repeat(32);
  const token = "top-secret-token";
  const errorResponse = () => Response.json({ errors: [{ code: 10013, message: `bad ${token} ${accountId} session:full-secret-key https://example.test/private` }] }, { status: 400 });

  const tokenClient = createCloudflareKvReadClient({ accountId, namespaceId, token, fetchImpl: async () => errorResponse() });
  await assert.rejects(tokenClient.verify(), (error) => error.message.includes("Account API Token 검증 단계 실패") && error.message.includes("code=10013") && !error.message.includes(token) && !error.message.includes(accountId) && !error.message.includes("full-secret-key"));

  const listClient = createCloudflareKvReadClient({ accountId, namespaceId, token, fetchImpl: async (url) => String(url).endsWith("/tokens/verify") ? Response.json({ success: true, result: { status: "active" } }) : errorResponse() });
  await assert.rejects(listClient.verify(), /KV 키 목록 조회 단계 실패/);

  const valueClient = createCloudflareKvReadClient({ accountId, namespaceId, token, fetchImpl: async (url) => {
    if (String(url).endsWith("/tokens/verify")) return Response.json({ success: true, result: { status: "active" } });
    if (String(url).includes("/keys?")) return Response.json({ result: [], result_info: {} });
    return errorResponse();
  } });
  await valueClient.verify();
  await assert.rejects(valueClient.store.get("plans:masked", "json"), /KV 값 조회 단계 실패/);
});

test("quoted, whitespace-contaminated, and Markdown Cloudflare IDs are rejected before fetch", async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return Response.json({}); };
  for (const accountId of ['"' + "a".repeat(32) + '"', "a".repeat(16) + " " + "a".repeat(16), `[${"a".repeat(32)}](link)`]) {
    assert.throws(() => createCloudflareKvReadClient({ accountId, namespaceId: "b".repeat(32), token: "token", fetchImpl }), /formatValid=false/);
  }
  assert.equal(calls, 0);
});
