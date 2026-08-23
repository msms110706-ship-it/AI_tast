import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const { hashPin, normalizeName, passwordPolicy, sha256 } = await import("../functions/_lib/auth.js");
const { loginAccount, registerAccount } = await import("../functions/_lib/account-service.js");
await Promise.all([
  import("../functions/api/account.js"),
  import("../functions/api/account/login.js"),
  import("../functions/api/account/register.js"),
  import("../functions/api/account/logout.js"),
  import("../functions/api/account/me.js"),
]);

class MockKV {
  constructor() { this.values = new Map(); this.writes = []; }
  async get(key, type) {
    const value = this.values.get(key);
    if (value == null) return null;
    return type === "json" ? JSON.parse(value) : value;
  }
  async put(key, value, options) { this.values.set(key, String(value)); this.writes.push({ op: "put", key, options }); }
  async delete(key) { this.values.delete(key); this.writes.push({ op: "delete", key }); }
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
  assert.deepEqual(await body(response), { ok: false, error: { code: "INVALID_CREDENTIALS", message: "별명 또는 비밀번호가 올바르지 않습니다." } });
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
  assert.equal((await registerAccount(context(store), { name: "새학생", password: "Good123!", passwordConfirm: "Good124!", grade: "중2", ageGroup: "over13" })).status, 400);
  assert.equal((await registerAccount(context(store), { name: "새학생", password: "password", passwordConfirm: "password", grade: "중2", ageGroup: "over13" })).status, 400);
  assert.equal(store.writes.length, 0);
});

test("register succeeds once and duplicate nickname returns 409", async () => {
  const store = new MockKV();
  const input = { name: " 새학생 ", password: "Good123!", passwordConfirm: "Good123!", grade: "중2", ageGroup: "over13" };
  const created = await registerAccount(context(store), input);
  assert.equal(created.status, 201);
  const duplicate = await registerAccount(context(store), { ...input, name: "새학생" });
  assert.equal(duplicate.status, 409);
  assert.equal((await body(duplicate)).error.code, "ACCOUNT_ALREADY_EXISTS");
});
