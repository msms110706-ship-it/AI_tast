import { getSessionUserId, sha256 } from './auth.js';
import { json, apiError } from './http.js';

const locks = new Set(); // Same-isolate protection; KV is NOT a distributed mutex.
const DAY_TTL = 172800;
const MONTH_TTL = 2851200;
const number = (value, fallback, max) => /^\d+$/.test(String(value)) ? Math.min(max, Math.max(1, Number(value))) : fallback;
export function policy(env) {
  return {
    free: number(env.COACH_FREE_DAILY_AI_LIMIT, 3, 3),
    daily: number(env.COACH_PAID_DAILY_AI_LIMIT, 20, 20),
    monthly: number(env.COACH_PAID_MONTHLY_AI_LIMIT, 100, 100),
    tokens: number(env.COACH_MAX_OUTPUT_TOKENS, 600, 600),
    cooldown: Math.max(10, number(env.COACH_COOLDOWN_SECONDS, 10, 300)),
    enabled: env.COACH_AI_ENABLED === undefined || env.COACH_AI_ENABLED === 'true',
    paid: env.COACH_PAID_FEATURES_ENABLED === 'true',
  };
}
export function periods(now) {
  const date = new Date(now + 9 * 3600000).toISOString().slice(0, 10);
  return { date, month: date.slice(0, 7), resetAt: new Date(Date.parse(`${date}T00:00:00+09:00`) + 86400000).toISOString() };
}
async function fetchJson(fetcher, url, options, timeout) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      (async () => {
        const res = await fetcher(url, { ...options, signal: controller.signal });
        if (!res.ok) throw new Error('UPSTREAM');
        return await res.json();
      })(),
      new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('TIMEOUT')); }, timeout); }),
    ]);
  } finally { clearTimeout(timer); }
}
async function readBody(request) {
  if (Number(request.headers.get('content-length')) > 8192) throw new Error('SIZE');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('BODY');
  let size = 0;
  const parts = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) { await reader.cancel(); throw new Error('SIZE'); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  const body = JSON.parse(new TextDecoder().decode(bytes));
  if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error('BODY');
  const clean = {};
  for (const [key, max] of Object.entries({ question: 500, subject: 80, range: 500, grade: 30 })) {
    if (body[key] !== undefined && typeof body[key] !== 'string') throw new Error('BODY');
    clean[key] = (body[key] || '').trim();
    if (clean[key].length > max) throw new Error('BODY');
  }
  if (!clean.question) throw new Error('BODY');
  if (typeof body.requestId !== 'string' || !/^[a-zA-Z0-9_-]{16,64}$/.test(body.requestId)) throw new Error('BODY');
  clean.requestId = body.requestId;
  return clean;
}
export function createCoach({ fetcher = (...args) => fetch(...args), now = Date.now, timeout = 15000, pause = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  return async function coach({ request, env }) {
    let lock;
    try {
      if (!['GET', 'POST'].includes(request.method)) return apiError('METHOD', '지원하지 않는 요청입니다.', 405);
      const store = env.STUDY_DATA;
      if (!store) return apiError('UNAVAILABLE', '잠시 후 다시 이용해 주세요.', 503);
      const id = await getSessionUserId(request, store);
      if (!id) return apiError('UNAUTHORIZED', '다시 로그인해 주세요.', 401);
      const records = await Promise.all([store.get(`account-id:${id}`, 'json'), store.get(`user:${id}`, 'json')]);
      const account = records[0] || records[1];
      if (!account || account.id !== id) return apiError('UNAUTHORIZED', '다시 로그인해 주세요.', 401);
      if (records.filter(Boolean).some(a => a.isChild === true || a.localOnly === true || a.ageGroup !== 'over14')) {
        return apiError('LOCAL_ONLY', '연령 확인이 필요합니다. 로컬 도움말을 이용해 주세요.', 403);
      }
      const p = policy(env);
      const time = now();
      const period = periods(time);
      const hash = await sha256(id);
      const dailyKey = `coach-usage:daily:${hash}:${period.date}`;
      const monthKey = `coach-usage:monthly:${hash}:${period.month}`;
      const reservationKey = `coach-reservation:${hash}`;
      const entitlement = p.paid ? await store.get(`billing:account:${id}`, 'json') : null;
      const premium = entitlement?.plan === 'premium' && entitlement.status === 'active' && entitlement.provider === 'future-provider' && Date.parse(entitlement.currentPeriodEnd) > time;
      const limit = premium ? p.daily : p.free;
      const daily = await store.get(dailyKey, 'json') || { used: 0, reserved: 0, inputTokens: 0, outputTokens: 0 };
      const monthly = premium ? await store.get(monthKey, 'json') || { used: 0, reserved: 0 } : { used: 0, reserved: 0 };
      const metadata = () => ({ plan: premium ? 'premium' : 'free', dailyAiLimit: limit, monthlyAiLimit: premium ? p.monthly : null, usedAiQuestions: daily.used, monthlyUsedAiQuestions: monthly.used, remainingAiQuestions: Math.max(0, Math.min(limit - daily.used - daily.reserved, premium ? p.monthly - monthly.used - monthly.reserved : Infinity)), resetAt: period.resetAt, webSearchUsed: false, checkoutEnabled: false });
      if (request.method === 'GET') return json({ ok: true, ...metadata() });
      const origin = request.headers.get('origin');
      if (origin && origin !== new URL(request.url).origin) return apiError('ORIGIN', '허용되지 않는 요청입니다.', 403);
      if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) return apiError('CONTENT_TYPE', 'JSON 요청이 필요합니다.', 415);
      let input;
      try { input = await readBody(request); } catch (e) { return apiError('INVALID_INPUT', '질문은 1~500자이며 입력 크기 제한을 확인해 주세요.', e.message === 'SIZE' ? 413 : 400); }
      const requestKey = `coach-request:${await sha256(JSON.stringify([id, input.requestId]))}`;
      if (await store.get(requestKey)) return apiError('DUPLICATE_REQUEST', '이미 처리한 요청입니다.', 409);
      const previous = await store.get(reservationKey, 'json');
      const retry = Math.max(1, Math.ceil(((previous?.until || 0) - time) / 1000));
      if (locks.has(hash) || previous?.until > time) return json({ ok: false, error: { code: 'COOLDOWN', message: '잠시 기다린 후 다시 질문해 주세요.' }, retryAfter: retry }, 429, { 'retry-after': String(retry) });
      locks.add(hash); lock = hash;
      const nonce = crypto.randomUUID();
      let reservedAt = Date.now();
      // KV permits at most one write/second per key, including settlement.
      const beforeSettlement = () => pause(Math.max(0, 1100 - (Date.now() - reservedAt)));
      await store.put(reservationKey, JSON.stringify({ nonce, until: time + Math.max(p.cooldown * 1000, timeout + 1000) }), { expirationTtl: Math.max(60, p.cooldown) });
      reservedAt = Date.now();
      if ((await store.get(reservationKey, 'json'))?.nonce !== nonce) return json({ ok: false, error: { code: 'BUSY', message: '잠시 후 다시 질문해 주세요.' }, retryAfter: p.cooldown }, 429, { 'retry-after': String(p.cooldown) });
      let reason = metadata().remainingAiQuestions === 0 ? 'limit' : 'unavailable';
      if (p.enabled && env.OPENAI_API_KEY && metadata().remainingAiQuestions > 0) {
        // Persist a tombstone before charging/calling; never retry an uncertain request.
        // KV is not atomic across isolates/regions (see docs/coach-billing.md).
        await store.put(requestKey, 'attempted');
        daily.used++;
        await store.put(dailyKey, JSON.stringify(daily), { expirationTtl: DAY_TTL });
        if (premium) { monthly.used++; await store.put(monthKey, JSON.stringify(monthly), { expirationTtl: MONTH_TTL }); }
        reservedAt = Date.now();
        let result;
        try {
          result = await fetchJson(fetcher, 'https://api.openai.com/v1/responses', {
            method: 'POST', headers: { authorization: `Bearer ${env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
            body: JSON.stringify({ model: env.OPENAI_MODEL || 'gpt-5.6-luna', max_output_tokens: p.tokens, reasoning: { effort: 'low' }, store: false,
              instructions: '한국 학생의 학습 코치입니다. 핵심부터 3~6개 짧은 문단 또는 단계로 한국어로 답하세요. 모르는 사실과 최신 정보는 확인할 수 없다고 밝히세요. 교과서와 교사의 안내를 우선하세요.',
              input: JSON.stringify({ question: input.question, subject: input.subject, range: input.range, grade: input.grade }), text: { verbosity: 'low' } }),
          }, timeout);
        } catch { result = null; }
        const answer = result?.output_text || result?.output?.flatMap(i => i.content || []).filter(c => c.type === 'output_text').map(c => c.text).join('\n');
        for (const [key, field] of [['inputTokens', 'input_tokens'], ['outputTokens', 'output_tokens']]) {
          const value = result?.usage?.[field];
          if (Number.isSafeInteger(value) && value >= 0) daily[key] = (daily[key] || 0) + value;
        }
        await beforeSettlement();
        await store.put(dailyKey, JSON.stringify(daily), { expirationTtl: DAY_TTL });
        if (premium) await store.put(monthKey, JSON.stringify(monthly), { expirationTtl: MONTH_TTL });
        if (answer && result?.status === 'completed') {
          await store.put(reservationKey, JSON.stringify({ nonce, until: time + p.cooldown * 1000 }), { expirationTtl: Math.max(60, p.cooldown) });
          return json({ ok: true, answer, sources: [], mode: 'ai', ...metadata() });
        }
      }
      const endpoint = new URL('https://ko.wikipedia.org/w/api.php');
      endpoint.search = new URLSearchParams({ action: 'query', generator: 'search', gsrsearch: input.question, gsrlimit: '2', prop: 'extracts|info', exintro: '1', explaintext: '1', inprop: 'url', format: 'json' });
      try {
        const data = await fetchJson(fetcher, endpoint.toString(), {}, 8000);
        const pages = Object.values(data.query?.pages || {}).filter(p => p.title && p.extract).slice(0, 2);
        if (!pages.length) throw new Error('EMPTY');
        return json({ ok: true, mode: 'wikipedia', fallbackReason: reason, answer: pages.map(p => `${p.title}\n${p.extract.slice(0, 1000)}`).join('\n\n'), sources: pages.map(p => ({ title: p.title, url: `https://ko.wikipedia.org/wiki/${encodeURIComponent(p.title)}` })), retrievedAt: new Date(now()).toISOString(), ...metadata() });
      } catch { return json({ ok: false, mode: 'builtin', fallbackReason: reason, error: { code: 'NO_REFERENCE', message: 'Wikipedia 자료를 찾지 못했습니다. 교과서에서 핵심 낱말을 확인하거나 잠시 후 다시 질문해 주세요.' }, ...metadata() }, 502); }
      finally { await beforeSettlement(); await store.put(reservationKey, JSON.stringify({ nonce, until: time + p.cooldown * 1000 }), { expirationTtl: Math.max(60, p.cooldown) }); }
    } catch { return apiError('UNAVAILABLE', '요청을 처리하지 못했습니다. 잠시 후 다시 이용해 주세요.', 503); }
    finally { if (lock) locks.delete(lock); }
  };
}
