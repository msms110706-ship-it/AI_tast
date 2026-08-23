import { createHash } from "node:crypto";

const mask = (value) => `${createHash("sha256").update(String(value)).digest("hex").slice(0, 8)}…`;

async function listAll(store, prefix) {
  const keys = []; let cursor;
  do { const page = await store.list({ prefix, cursor }); keys.push(...(page.keys || []).map((item) => item.name)); cursor = page.list_complete === false ? page.cursor : undefined; } while (cursor);
  return keys;
}

export async function auditAccountSchema(store) {
  const keys = await listAll(store, "user:");
  const sessionCounts = new Map();
  for (const sessionKey of await listAll(store, "session:")) {
    const accountId = await store.get(sessionKey);
    if (accountId) sessionCounts.set(accountId, (sessionCounts.get(accountId) || 0) + 1);
  }
  const seenLoginIds = new Map();
  const report = { dryRun: true, kvMutations: { writes: 0, deletes: 0 }, accounts: 0, migrationReady: 0, collisions: [], under14: { count: 0, linkedData: {}, sessions: 0 } };
  for (const key of keys) {
    const account = await store.get(key, "json"); if (!account?.id) continue;
    report.accounts += 1;
    const loginId = String(account.loginId || account.name || "").normalize("NFKC").trim().toLocaleLowerCase("ko-KR").replace(/\s+/g, " ");
    const fingerprint = mask(loginId);
    if (seenLoginIds.has(loginId)) report.collisions.push({ loginIdFingerprint: fingerprint, accounts: [seenLoginIds.get(loginId), mask(account.id)] });
    else seenLoginIds.set(loginId, mask(account.id));
    if (!account.loginId || !account.displayName || !account.accountId || Number(account.schemaVersion || 0) < 5) report.migrationReady += 1;
    const isUnder14 = account.ageGroup === "under14" || account.ageGroup === "under13" || account.isChild === true;
    if (isUnder14) {
      report.under14.count += 1;
      for (const prefix of ["plans:", "mistakes:", "progress:"]) if (await store.get(`${prefix}${account.id}`) != null) report.under14.linkedData[prefix] = (report.under14.linkedData[prefix] || 0) + 1;
      report.under14.sessions += sessionCounts.get(account.id) || 0;
    }
  }
  report.collisions.sort((a, b) => a.loginIdFingerprint.localeCompare(b.loginIdFingerprint));
  return report;
}
