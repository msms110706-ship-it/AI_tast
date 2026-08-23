import { repairAccountMappings } from "./account-mapping-repair-lib.mjs";
import { createCloudflareKvReadClient } from "./cloudflare-kv-read-client.mjs";

function option(name) { const index = process.argv.indexOf(name); return index >= 0 ? String(process.argv[index + 1] || "") : ""; }
const targetAccountId = option("--account-id");
const apply = process.argv.includes("--apply");
if (!targetAccountId) {
  console.error("복구 작업 중단: ACCOUNT_ID_REQUIRED (KV writes=0, deletes=0)");
  process.exit(2);
}

const cloudflareAccountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || "").trim();
const namespaceId = String(process.env.STUDY_DATA_NAMESPACE_ID || "").trim();
const apiToken = String(process.env.CLOUDFLARE_API_TOKEN || "").trim();
if (!cloudflareAccountId || !namespaceId || !apiToken) {
  console.error("복구 작업 중단: Cloudflare 환경 변수가 필요합니다. (KV writes=0, deletes=0)");
  process.exit(2);
}

try {
  const client = createCloudflareKvReadClient({ accountId: cloudflareAccountId, namespaceId, token: apiToken });
  await client.verify();
  const store = { ...client.store };
  if (apply) {
    const base = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(cloudflareAccountId)}/storage/kv/namespaces/${encodeURIComponent(namespaceId)}`;
    store.put = async (key, value) => {
      const response = await fetch(`${base}/values/${encodeURIComponent(key)}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${apiToken}`, "content-type": "text/plain;charset=UTF-8" },
        body: String(value),
      });
      if (!response.ok) throw new Error(`CLOUDFLARE_WRITE_${response.status}`);
    };
  }
  const result = await repairAccountMappings(store, targetAccountId, {
    apply,
    onPrepared(plan) { console.log(JSON.stringify({ phase: "pre-write", ...plan }, null, 2)); },
  });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(`복구 작업 중단: ${error instanceof Error ? error.message : "UNKNOWN_ERROR"}`);
  process.exit(1);
}
