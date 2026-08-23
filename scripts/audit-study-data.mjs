import { auditStudyData } from "./kv-integrity-audit-lib.mjs";
import { createCloudflareKvReadClient } from "./cloudflare-kv-read-client.mjs";

const forbidden = ["--confirm", "--delete", "--write", "--repair", "--migrate"];
if (forbidden.some((flag) => process.argv.includes(flag))) {
  console.error("이 도구는 읽기 전용입니다. 수정·삭제·복구 옵션을 지원하지 않습니다.");
  process.exit(2);
}

const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || "").trim();
const namespaceId = String(process.env.STUDY_DATA_NAMESPACE_ID || "").trim();
const apiToken = String(process.env.CLOUDFLARE_API_TOKEN || "").trim();
if (!accountId || !namespaceId || !apiToken) {
  console.error("읽기 전용 CLOUDFLARE_API_TOKEN과 CLOUDFLARE_ACCOUNT_ID, STUDY_DATA_NAMESPACE_ID가 필요합니다.");
  process.exit(2);
}

try {
  const client = createCloudflareKvReadClient({ accountId, namespaceId, token: apiToken });
  await client.verify();
  const repairDryRun = process.argv.includes("--repair-dry-run");
  console.log(JSON.stringify(await auditStudyData(client.store, undefined, {
    detail: process.argv.includes("--detail") || repairDryRun,
    repairDryRun,
  }), null, 2));
} catch (error) {
  console.error(`무결성 검사 중단: ${error instanceof Error ? error.message : "UNKNOWN_ERROR"}`);
  process.exit(1);
}
