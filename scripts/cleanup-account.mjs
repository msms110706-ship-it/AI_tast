import { cleanupAccount } from "./account-cleanup-lib.mjs";

function option(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : ""; }
const target = { loginId: option("--login-id"), accountId: option("--account-id") };
const dryRunRequested = process.argv.includes("--dry-run");
const confirmed = process.argv.includes("--confirm") && !dryRunRequested;
const confirmation = option("--confirmation");

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const namespaceId = process.env.STUDY_DATA_NAMESPACE_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
if (!accountId || !namespaceId || !apiToken) {
  console.error("CLOUDFLARE_ACCOUNT_ID, STUDY_DATA_NAMESPACE_ID, CLOUDFLARE_API_TOKEN이 필요합니다.");
  process.exit(2);
}

const base = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/storage/kv/namespaces/${encodeURIComponent(namespaceId)}`;
async function api(path, init = {}) {
  const response = await fetch(`${base}${path}`, { ...init, headers: { authorization: `Bearer ${apiToken}`, ...(init.headers || {}) } });
  if (!response.ok) throw new Error(`CLOUDFLARE_API_${response.status}`);
  return response;
}
const store = {
  async get(key, type) {
    const response = await fetch(`${base}/values/${encodeURIComponent(key)}`, { headers: { authorization: `Bearer ${apiToken}` } });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`CLOUDFLARE_API_${response.status}`);
    const value = await response.text();
    return type === "json" ? JSON.parse(value) : value;
  },
  async put(key, value) { await api(`/values/${encodeURIComponent(key)}`, { method: "PUT", body: String(value), headers: { "content-type": "text/plain;charset=UTF-8" } }); },
  async delete(key) { await api(`/values/${encodeURIComponent(key)}`, { method: "DELETE" }); },
  async list({ prefix, cursor }) {
    const query = new URLSearchParams({ prefix, limit: "1000" });
    if (cursor) query.set("cursor", cursor);
    const payload = await (await api(`/keys?${query}`)).json();
    const next = payload.result_info?.cursor || "";
    return { keys: payload.result || [], cursor: next, list_complete: !next };
  },
};

try {
  const result = await cleanupAccount(store, target, { dryRun: !confirmed, confirmation });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(`정리 작업 중단: ${error instanceof Error ? error.message : "UNKNOWN_ERROR"}`);
  process.exit(1);
}
