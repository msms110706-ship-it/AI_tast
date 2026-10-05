import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
if (!globalThis.crypto) globalThis.crypto = webcrypto;
import { createCoach, periods } from '../functions/_lib/coach.js';
import { sha256 } from '../functions/_lib/auth.js';
import { onRequest as webhook } from '../functions/api/billing/webhook.js';
import worker from '../server/index.js';
class MemoryKV {
  values = new Map(); writes = [];
  async get(key, type) { const v = this.values.get(key); return v == null ? null : type === 'json' ? JSON.parse(v) : v; }
  async put(key, value, options) { this.values.set(key, value); this.writes.push({ key, value, ttl: options?.expirationTtl }); }
  async delete() { throw new Error('Unexpected deletion'); }
}
async function fixture(options = {}) {
  const kv = new MemoryKV();
  const id = crypto.randomUUID(); const session = crypto.randomUUID(); const secret = crypto.randomUUID();
  kv.values.set(`session:${await sha256(session)}`, id);
  kv.values.set(`account-id:${id}`, JSON.stringify({ id, ageGroup: 'over14', isChild: false, ...options.account }));
  let time = Date.parse('2026-09-24T03:00:00Z');
  let aiCalls = 0, wikiCalls = 0; const payloads = [];
  const env = { STUDY_DATA: kv, OPENAI_API_KEY: secret, ...options.env };
  const fetcher = async (url, init) => {
    if (url.startsWith('https://api.openai.com/')) {
      aiCalls++; payloads.push(JSON.parse(init.body));
      
      assert.equal((await kv.get(`coach-usage:daily:${await sha256(id)}:2026-09-24`, 'json')).used, aiCalls);
      if (options.ai === 'timeout') return new Promise(() => {});
      if (options.beforeAI) await options.beforeAI({ kv, id });
      if (options.ai === '5xx') return new Response('{}', { status: 503 });
      if (options.ai === 'incomplete') return Response.json({ status: 'incomplete', output_text: 'partial' });
      if (options.ai === 'empty') return Response.json({ status: 'completed' });
      if (options.ai === 'error') return new Response('{}', { status: 429 });
      return Response.json({ status: 'completed', output_text: '학습 안내', usage: { input_tokens: 20, output_tokens: 30 } });
    }
    assert.equal(url.startsWith('https://ko.wikipedia.org/'), true);
    wikiCalls++;
    if (options.wiki === 'error') return new Response('{}', { status: 503 });
    return Response.json({ query: { pages: { 1: { title: '학습', extract: '학습 자료', fullurl: 'https://ko.wikipedia.org/wiki/학습' } } } });
  };
  const handler = createCoach({ fetcher, now: () => time, pause: async () => {}, timeout: options.ai === 'timeout' ? 5 : 15000 });
  const request = (body = { question: '개념 설명' }, extra = {}) => new Request('https://study.example/api/coach', { method: 'POST', headers: { 'content-type': 'application/json', cookie: `study_session=${session}`, ...extra.headers }, body: JSON.stringify({ requestId: crypto.randomUUID(), ...body }) });
  return { kv, id, session, secret, env, payloads, request, handler,
    advance: () => { time += 20000; },
    call: (body, extra) => handler({ request: request(body, extra), env }),
    counts: () => ({ ai: aiCalls, wiki: wikiCalls }),
    dailyKey: `coach-usage:daily:${await sha256(id)}:2026-09-24`,
    monthKey: `coach-usage:monthly:${await sha256(id)}:2026-09`,
  };
}
test('authentication and child/local/unknown age reject without external requests or writes', async () => {
  const f = await fixture();
  assert.equal((await f.call(undefined, { headers: { cookie: '' } })).status, 401);
  assert.equal(f.kv.writes.length, 0); assert.deepEqual(f.counts(), { ai: 0, wiki: 0 });
  f.kv.values.delete(`account-id:${f.id}`);
  assert.equal((await f.call()).status, 401);
  for (const account of [{ isChild: true }, { ageGroup: 'under14' }, { ageGroup: 'under13' }, { localOnly: true }, { ageGroup: undefined }]) {
    const c = await fixture({ account });
    assert.equal((await c.call()).status, 403);
    assert.equal(c.kv.writes.length, 0); assert.deepEqual(c.counts(), { ai: 0, wiki: 0 });
  }
});
test('validation enforces type, bounded bytes, field lengths and origin', async () => {
  const f = await fixture();
  for (const body of [{ question: 'x'.repeat(501) }, { question: ' ' }, { question: 5 }, { question: 'x', subject: 'x'.repeat(81) }, { question: 'x', range: 'x'.repeat(501) }, { question: 'x', grade: 'x'.repeat(31) }]) assert.equal((await f.call(body)).status, 400);
  assert.equal((await f.call({ question: 'x'.repeat(9000) })).status, 413);
  assert.equal((await f.call(undefined, { headers: { 'content-type': 'text/plain' } })).status, 415);
  assert.equal((await f.call(undefined, { headers: { origin: 'https://other.example' } })).status, 403);
  assert.equal(f.kv.writes.length, 0); assert.equal(f.counts().ai, 0);
});
test('free three attempts; fourth Wikipedia; forged premium ignored; bounded model request', async () => {
  const f = await fixture();
  for (let i = 0; i < 3; i++) {
    const res = await f.call({ question: ' 개념 설명 ', plan: 'premium' });
    const data = await res.json(); assert.equal(res.status, 200); assert.equal(data.mode, 'ai'); assert.equal(data.remainingAiQuestions, 2 - i); f.advance();
  }
  const before = f.counts().ai;
  const data = await (await f.call()).json();
  assert.equal(data.mode, 'wikipedia'); assert.equal(data.fallbackReason, 'limit'); assert.equal(f.counts().ai, before);
  assert.ok(data.retrievedAt); assert.ok(data.sources[0].url.startsWith('https://ko.wikipedia.org/wiki/'));
  const p = f.payloads[0]; assert.equal(p.model, 'gpt-5.6-luna'); assert.equal(p.max_output_tokens, 600); assert.equal(p.reasoning.effort, 'low'); assert.equal(p.tools, undefined); assert.equal(p.store, false);
  assert.equal((await f.kv.get(f.dailyKey, 'json')).inputTokens, 60);
  assert.ok(f.kv.writes.filter(w => w.key.startsWith('coach-usage:daily:')).every(w => w.ttl === 172800));
});
test('cooldown and concurrent requests return retry time and allow only one upstream', async () => {
  const f = await fixture();
  const results = await Promise.all([f.call(), f.call()]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 429]);
  const res = await f.call(); assert.equal(res.status, 429); assert.ok(Number(res.headers.get('retry-after')) >= 1); assert.equal(f.counts().ai, 1);
});
test('OpenAI errors, timeouts, 5xx and incomplete/empty responses retain attempt charge', async () => {
  for (const ai of ['error', 'timeout', '5xx', 'incomplete', 'empty']) {
    const f = await fixture({ ai }); const data = await (await f.call()).json();
    assert.equal(data.mode, 'wikipedia'); assert.equal(data.remainingAiQuestions, 2);
    assert.equal((await f.kv.get(f.dailyKey, 'json')).used, 1);
    assert.deepEqual(f.counts(), { ai: 1, wiki: 1 });
    assert.equal((await f.kv.get(f.dailyKey, 'json')).reserved, 0);
  }
});
test('missing key/disabled AI use Wikipedia; Wikipedia failure is safe', async () => {
  for (const env of [{ OPENAI_API_KEY: '' }, { COACH_AI_ENABLED: 'false' }]) {
    const f = await fixture({ env }); assert.equal((await (await f.call()).json()).mode, 'wikipedia'); assert.equal(f.counts().ai, 0);
  }
  const f = await fixture({ ai: 'error', wiki: 'error' }); const res = await f.call();
  assert.equal(res.status, 502); assert.equal((await res.json()).error.code, 'NO_REFERENCE');
});
test('premium requires enabled server active unexpired entitlement; monthly and daily caps', async () => {
  for (const [enabled, status, premium] of [[false, 'active', false], [true, 'past_due', false], [true, 'canceled', false], [true, 'active', true]]) {
    const f = await fixture({ env: { COACH_PAID_FEATURES_ENABLED: String(enabled) } });
    f.kv.values.set(`billing:account:${f.id}`, JSON.stringify({ plan: 'premium', status, provider: 'future-provider', currentPeriodEnd: '2026-10-01T00:00:00Z' }));
    const data = await (await f.call()).json(); assert.equal(data.plan, premium ? 'premium' : 'free'); assert.equal(data.dailyAiLimit, premium ? 20 : 3);
    if (premium) {
      f.advance(); f.kv.values.set(f.monthKey, JSON.stringify({ used: 100, reserved: 0 }));
      const before = f.counts().ai; assert.equal((await (await f.call()).json()).mode, 'wikipedia'); assert.equal(f.counts().ai, before);
      f.advance(); f.kv.values.set(f.monthKey, JSON.stringify({ used: 1, reserved: 0 })); f.kv.values.set(f.dailyKey, JSON.stringify({ used: 20, reserved: 0 }));
      assert.equal((await (await f.call()).json()).mode, 'wikipedia'); assert.equal(f.counts().ai, before);
    }
  }
});
test('unsigned webhook cannot activate premium, regardless of flags', async () => {
  const f = await fixture(); const before = f.kv.values.size;
  const res = await webhook({ request: f.request({ plan: 'premium' }), env: { ...f.env, COACH_CHECKOUT_ENABLED: 'true' } });
  assert.equal(res.status, 403); assert.equal(f.kv.values.size, before); assert.equal(f.kv.writes.length, 0);
});
test('status is read only, Seoul rollover and generated runtime use same guarded routes', async () => {
  const f = await fixture();
  const request = new Request('https://study.example/api/coach', { headers: { cookie: `study_session=${f.session}` } });
  const result = await f.handler({ request, env: f.env }); assert.equal(result.status, 200); assert.equal(f.kv.writes.length, 0);
  assert.equal(periods(Date.parse('2026-09-24T15:00:00Z')).date, '2026-09-25');
  assert.equal(periods(Date.parse('2026-09-30T15:00:00Z')).month, '2026-10');
  assert.equal((await worker.fetch(new Request('https://study.example/api/coach', { method: 'POST' }), f.env)).status, 401);
});
test('no secrets or identifiers in responses, persisted coach records or logging; no real network', async () => {
  const f = await fixture(); let logs = 0; const old = console.error; console.error = () => { logs++; };
  try {
    const response = await (await f.call()).text();
    const stored = JSON.stringify(f.kv.writes);
    assert.equal([f.id, f.session, f.secret, '개념 설명'].some(value => stored.includes(value) || response.includes(value)), false);
    assert.equal(logs, 0);
    const source = await readFile(new URL('../functions/_lib/coach.js', import.meta.url), 'utf8');
    assert.equal(source.includes('console.'), false);
  } finally { console.error = old; }
});
test('existing planner, mistake and session routes remain reachable through packaged runtime', async () => {
  const f = await fixture();
  const send = (path, method = 'GET', data) => worker.fetch(new Request(`https://study.example${path}`, { method, headers: { cookie: `study_session=${f.session}`, 'content-type': 'application/json' }, ...(data ? { body: JSON.stringify(data) } : {}) }), f.env);
  assert.equal((await send('/api/sync')).status, 200);
  const saved = await send('/api/mistakes', 'PUT', { mistakes: [{ subject: '수학', unit: '도형', memo: '복습', reason: '개념 부족' }] });
  assert.equal(saved.status, 200); assert.equal((await (await send('/api/mistakes')).json()).mistakes.length, 1);
  assert.equal((await send('/api/account/me')).status, 200);
  assert.equal((await send('/api/sessions', 'GET')).status, 405);
  assert.equal(f.counts().ai, 0);
});

test('requestId validation rejects invalid/missing IDs without writes or network', async () => {
  const f = await fixture();
  for (const requestId of [undefined, null, 123, '', 'x'.repeat(15), 'x'.repeat(65), 'a'.repeat(16) + '/', ' '.repeat(16)]) {
    assert.equal((await f.call({ question: 'test', requestId })).status, 400);
  }
  assert.equal(f.kv.writes.length, 0); assert.deepEqual(f.counts(), { ai: 0, wiki: 0 });
});
test('same requestId concurrent and delayed resubmission calls OpenAI at most once, including failures', async () => {
  for (const ai of [undefined, 'timeout', '5xx', 'incomplete']) {
    const f = await fixture({ ai });
    const body = { question: 'test', requestId: crypto.randomUUID() };
    await Promise.all([f.call(body), f.call(body)]);
    f.advance();
    assert.equal((await f.call(body)).status, 409);
    assert.equal(f.counts().ai, 1);
    assert.equal((await f.kv.get(f.dailyKey, 'json')).used, 1);
    // Persisted marker survives handler/isolate replacement.
    const fresh = createCoach({ fetcher: () => { throw new Error('Unexpected network'); } });
    assert.equal((await fresh({ request: f.request(body), env: f.env })).status, 409);
  }
});
test('requestId is namespaced by account and marker stores no raw IDs', async () => {
  const a = await fixture(); const b = await fixture();
  const requestId = crypto.randomUUID();
  await a.call({ question: 'test', requestId });
  for (const [key, value] of a.kv.values) if (key.startsWith('coach-request:')) b.kv.values.set(key, value);
  assert.equal((await b.call({ question: 'test', requestId })).status, 200);
  assert.equal(a.counts().ai + b.counts().ai, 2);
  assert.ok(a.kv.writes.every(w => !w.key.includes(requestId)));
});
test('failed attempts exhaust free quota; fourth attempt makes zero additional OpenAI calls', async () => {
  const f = await fixture({ ai: '5xx' });
  for (let i = 0; i < 3; i++) { await f.call(); f.advance(); }
  assert.equal((await (await f.call()).json()).fallbackReason, 'limit');
  assert.equal(f.counts().ai, 3);
});
test('premium daily and monthly attempts are charged before upstream and retained on failure', async () => {
  const f = await fixture({ ai: '5xx', env: { COACH_PAID_FEATURES_ENABLED: 'true' },
    beforeAI: async ({ kv, id }) => assert.equal((await kv.get(`coach-usage:monthly:${await sha256(id)}:2026-09`, 'json')).used, 1) });
  f.kv.values.set(`billing:account:${f.id}`, JSON.stringify({ plan: 'premium', status: 'active', provider: 'future-provider', currentPeriodEnd: '2026-10-01T00:00:00Z' }));
  await f.call();
  assert.equal((await f.kv.get(f.dailyKey, 'json')).used, 1);
  assert.equal((await f.kv.get(f.monthKey, 'json')).used, 1);
});
test('all payment adapter methods reject and checkout stays disabled with flag enabled', async () => {
  const { PaymentProvider } = await import('../functions/_lib/payment-provider.js');
  const provider = new PaymentProvider();
  for (const method of ['createCheckoutSession', 'verifyWebhook', 'cancelSubscription', 'getSubscriptionStatus']) await assert.rejects(provider[method](), /PAYMENTS_DISABLED/);
  const f = await fixture({ env: { COACH_CHECKOUT_ENABLED: 'true' } });
  assert.equal((await (await f.call()).json()).checkoutEnabled, false);
});
