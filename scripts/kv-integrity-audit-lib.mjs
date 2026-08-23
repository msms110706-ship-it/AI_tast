import { normalizeName, sha256 } from "../functions/_lib/auth.js";

const ACCOUNT_PREFIXES = ["account-id:", "account:", "account-v2:", "user:"];
const DATA_PREFIXES = ["plans:", "mistakes:", "progress:"];
const DETAIL_PREFIXES = ["account-id:", "account:", "name:", "plans:", "session:", "mistakes:", "progress:"];

export function maskAccountId(value) {
  const id = String(value || "unknown");
  if (id === "unknown") return "unknown";
  return `${id.slice(0, 4)}…`;
}

async function listAll(store) {
  const entries = [];
  let cursor;
  do {
    const page = await store.list({ cursor });
    entries.push(...(page.keys || []));
    cursor = page.list_complete === false ? page.cursor : undefined;
  } while (cursor);
  return entries;
}

function prefixOf(key) {
  return [...ACCOUNT_PREFIXES, ...DATA_PREFIXES, "name:", "accounts:", "session:", "sessions:"].find((prefix) => key.startsWith(prefix)) || "";
}

function aggregate(items) {
  const grouped = new Map();
  for (const item of items) {
    const key = `${item.prefix}|${item.accountId}`;
    const current = grouped.get(key) || { prefix: item.prefix, accountId: maskAccountId(item.accountId), count: 0 };
    current.count += 1;
    grouped.set(key, current);
  }
  return [...grouped.values()].sort((a, b) => a.prefix.localeCompare(b.prefix) || a.accountId.localeCompare(b.accountId));
}

async function safeJson(store, key) {
  try { return await store.get(key, "json"); } catch { return null; }
}

export async function auditStudyData(store, nowSeconds = Math.floor(Date.now() / 1000), { detail = false, repairDryRun = false } = {}) {
  if (typeof store?.list !== "function" || typeof store?.get !== "function") throw new Error("READ_ONLY_STORE_REQUIRED");
  const entries = await listAll(store);
  const byKey = new Map(entries.map((entry) => [entry.name, entry]));
  const accountRecords = new Map();
  const canonicalIds = new Set();
  const loginHashToIds = new Map();
  const invalidRecords = [];

  for (const entry of entries) {
    const prefix = ACCOUNT_PREFIXES.find((candidate) => entry.name.startsWith(candidate));
    if (!prefix) continue;
    const account = await safeJson(store, entry.name);
    if (!account?.id) { invalidRecords.push({ prefix, accountId: "unknown" }); continue; }
    const id = String(account.id);
    if (!accountRecords.has(id)) accountRecords.set(id, []);
    accountRecords.get(id).push({ prefix, key: entry.name, account });
    if (prefix === "account-id:") canonicalIds.add(id);
    if (account.name) {
      const hash = await sha256(normalizeName(String(account.name)));
      if (!loginHashToIds.has(hash)) loginHashToIds.set(hash, new Set());
      loginHashToIds.get(hash).add(id);
    }
  }

  const nameMappings = new Map();
  for (const entry of entries.filter((item) => item.name.startsWith("name:"))) {
    const id = await store.get(entry.name);
    nameMappings.set(entry.name.slice(5), String(id || ""));
  }
  for (const [hash, id] of nameMappings) {
    if (!loginHashToIds.has(hash)) loginHashToIds.set(hash, new Set());
    if (id) loginHashToIds.get(hash).add(id);
  }

  const orphanNameMappings = [];
  for (const id of nameMappings.values()) if (!accountRecords.has(id)) orphanNameMappings.push({ prefix: "name:", accountId: id });

  const orphanData = [];
  for (const entry of entries) {
    const prefix = DATA_PREFIXES.find((candidate) => entry.name.startsWith(candidate));
    if (!prefix) continue;
    const id = entry.name.slice(prefix.length);
    if (!accountRecords.has(id)) orphanData.push({ prefix, accountId: id });
  }

  const orphanSessions = [];
  const sessionTtlIssues = [];
  for (const entry of entries.filter((item) => item.name.startsWith("session:"))) {
    const id = String((await store.get(entry.name)) || "unknown");
    if (!accountRecords.has(id)) orphanSessions.push({ prefix: "session:", accountId: id });
    if (!Number.isFinite(entry.expiration) || entry.expiration <= nowSeconds) sessionTtlIssues.push({ prefix: "session:ttl-unverified", accountId: id });
  }

  const missingNameMappings = [];
  const missingCanonicalAccounts = [];
  for (const [id, records] of accountRecords) {
    const account = records.find((record) => record.account.name)?.account;
    if (account?.name) {
      const hash = await sha256(normalizeName(String(account.name)));
      if (nameMappings.get(hash) !== id) missingNameMappings.push({ prefix: "name:missing", accountId: id });
    } else missingNameMappings.push({ prefix: "name:unverifiable", accountId: id });
    if (!canonicalIds.has(id)) missingCanonicalAccounts.push({ prefix: "account-id:missing", accountId: id });
  }

  const duplicateLoginIds = [];
  for (const ids of loginHashToIds.values()) {
    if (ids.size > 1) for (const id of ids) duplicateLoginIds.push({ prefix: "login-id:duplicate", accountId: id });
  }

  const otherLinkedIssues = [...invalidRecords];
  for (const entry of entries.filter((item) => item.name.startsWith("sessions:"))) {
    const id = entry.name.slice(9);
    if (!accountRecords.has(id)) otherLinkedIssues.push({ prefix: "sessions:", accountId: id });
  }
  for (const entry of entries.filter((item) => item.name.startsWith("accounts:"))) {
    const indexedKeys = (await safeJson(store, entry.name)) || [];
    for (const key of indexedKeys) {
      if (typeof key !== "string" || !byKey.has(key)) otherLinkedIssues.push({ prefix: "accounts:", accountId: "unknown" });
    }
  }

  const cleanupCandidates = aggregate([...orphanNameMappings, ...orphanData, ...orphanSessions, ...otherLinkedIssues.filter((item) => item.prefix === "sessions:")]);
  const report = {
    ok: true,
    dryRun: true,
    kvMutations: { writes: 0, deletes: 0 },
    scanned: { totalKeys: entries.length, accountIds: accountRecords.size },
    findings: {
      orphanNameMappings: aggregate(orphanNameMappings),
      orphanPlans: aggregate(orphanData.filter((item) => item.prefix === "plans:")),
      orphanSessions: aggregate(orphanSessions),
      orphanOtherLearningData: aggregate(orphanData.filter((item) => item.prefix !== "plans:")),
      accountsWithoutNameMapping: aggregate(missingNameMappings),
      duplicateLoginIds: aggregate(duplicateLoginIds),
      sessionsWithoutVerifiableTtl: aggregate(sessionTtlIssues),
      otherLinkedKeyIssues: aggregate([...otherLinkedIssues, ...missingCanonicalAccounts]),
    },
    potentialDeletionSummary: cleanupCandidates,
    note: "No data was modified. Potential deletion counts require separate administrator approval before any cleanup.",
  };

  if (detail) {
    const affectedIds = new Set([
      ...orphanNameMappings, ...orphanData, ...orphanSessions, ...sessionTtlIssues,
      ...missingNameMappings, ...missingCanonicalAccounts, ...duplicateLoginIds,
      ...otherLinkedIssues,
    ].map((item) => item.accountId).filter((id) => id && id !== "unknown"));
    const keyCounts = new Map();
    const increment = (id, prefix) => {
      const key = `${id}|${prefix}`;
      keyCounts.set(key, (keyCounts.get(key) || 0) + 1);
    };

    for (const [id, records] of accountRecords) {
      for (const record of records) {
        if (record.prefix === "account-id:" || record.prefix === "account:") increment(id, record.prefix);
      }
    }
    for (const id of nameMappings.values()) if (id) increment(id, "name:");
    for (const entry of entries) {
      const prefix = DATA_PREFIXES.find((candidate) => entry.name.startsWith(candidate));
      if (prefix) increment(entry.name.slice(prefix.length), prefix);
    }
    for (const entry of entries.filter((item) => item.name.startsWith("session:"))) {
      const id = String((await store.get(entry.name)) || "unknown");
      if (id !== "unknown") increment(id, "session:");
    }

    report.accountDetails = [...affectedIds].sort().map((id) => {
      const records = Object.fromEntries(DETAIL_PREFIXES.map((prefix) => {
        const count = keyCounts.get(`${id}|${prefix}`) || 0;
        return [prefix, { exists: count > 0, count }];
      }));
      const hasAnyAccountRecord = accountRecords.has(id);
      const deletionCandidates = DATA_PREFIXES.filter((prefix) => records[prefix].exists && !hasAnyAccountRecord);
      if (records["name:"].exists && !hasAnyAccountRecord) deletionCandidates.push("name:");
      if (records["session:"].exists && !hasAnyAccountRecord) deletionCandidates.push("session:");
      const mappingsToRepair = [];
      if (hasAnyAccountRecord && !records["account-id:"].exists) mappingsToRepair.push("account-id:");
      if (hasAnyAccountRecord && !records["name:"].exists) mappingsToRepair.push("name:");
      return {
        accountId: maskAccountId(id),
        records,
        suggestions: { orphanDataDeletionCandidates: deletionCandidates, mappingsToRepair },
      };
    });
  }

  if (repairDryRun) {
    const repairIds = new Set([...missingNameMappings, ...missingCanonicalAccounts].map((item) => item.accountId));
    report.repairDryRun = true;
    report.repairPlan = [];
    for (const id of [...repairIds].sort()) {
      const records = accountRecords.get(id) || [];
      const normalizedNames = new Set(records
        .map((record) => record.account?.name ? normalizeName(String(record.account.name)) : "")
        .filter(Boolean));
      const accountRecordsConsistent = records.length > 0
        && records.every((record) => String(record.account?.id || "") === id)
        && normalizedNames.size <= 1;
      const normalizedName = normalizedNames.size === 1 ? [...normalizedNames][0] : "";
      const loginHash = normalizedName ? await sha256(normalizedName) : "";
      const mappedId = loginHash ? nameMappings.get(loginHash) : undefined;
      const competingIds = loginHashToIds.get(loginHash) || new Set();
      const duplicateLoginMapping = [...competingIds].some((candidate) => candidate !== id);
      const repairs = {};

      if (!canonicalIds.has(id)) {
        const warnings = [];
        if (!records.length) warnings.push("NO_EXISTING_ACCOUNT_RECORD");
        if (!accountRecordsConsistent) warnings.push("ACCOUNT_RECORD_CONFLICT");
        repairs["account-id:"] = {
          status: warnings.length ? "blocked" : "ready",
          evidence: {
            existingAccountRecordCount: records.length,
            accountRecordsConsistent,
            destinationExists: false,
          },
          warnings,
        };
      }

      if (missingNameMappings.some((item) => item.accountId === id)) {
        const warnings = [];
        if (!normalizedName) warnings.push("LOGIN_ID_UNVERIFIABLE");
        if (!accountRecordsConsistent) warnings.push("ACCOUNT_RECORD_CONFLICT");
        if (mappedId && mappedId !== id) warnings.push("LOGIN_MAPPING_CONFLICT");
        if (duplicateLoginMapping) warnings.push("DUPLICATE_LOGIN_ID");
        repairs["name:"] = {
          status: warnings.length ? "blocked" : "ready",
          evidence: {
            existingAccountRecordCount: records.length,
            accountRecordsConsistent,
            loginIdVerifiable: Boolean(normalizedName),
            mappingExistsForAccount: mappedId === id,
            conflictingMappingExists: Boolean(mappedId && mappedId !== id),
            duplicateLoginMapping,
          },
          warnings,
        };
      }

      report.repairPlan.push({ accountId: maskAccountId(id), repairs });
    }
  }

  return report;
}
