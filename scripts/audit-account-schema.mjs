import { createCloudflareKvReadClient } from "./cloudflare-kv-read-client.mjs";
import { auditAccountSchema } from "./account-schema-audit-lib.mjs";

if (process.argv.some((arg) => arg === "--apply" || arg === "--confirm")) {
  console.error("이 도구는 읽기 전용 dry-run만 지원합니다."); process.exit(2);
}
const client = createCloudflareKvReadClient({ accountId: process.env.CLOUDFLARE_ACCOUNT_ID, namespaceId: process.env.CLOUDFLARE_KV_NAMESPACE_ID, token: process.env.CLOUDFLARE_API_TOKEN });
await client.verify();
console.log(JSON.stringify(await auditAccountSchema(client.store), null, 2));
