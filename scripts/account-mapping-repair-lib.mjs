import { normalizeName, sha256 } from "../functions/_lib/auth.js";
import { maskAccountId } from "./kv-integrity-audit-lib.mjs";

const SOURCE_PREFIXES = ["user:", "account-v2:", "account:"];

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

async function safeJson(store, key) {
  try { return await store.get(key, "json"); } catch { return null; }
}

export async function planAccountMappingRepair(store, accountId) {
  const id = String(accountId || "").trim();
  if (!id) throw new Error("ACCOUNT_ID_REQUIRED");
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(id)) throw new Error("ACCOUNT_ID_INVALID");
  if (typeof store?.get !== "function" || typeof store?.list !== "function") throw new Error("READ_CAPABILITY_REQUIRED");

  const entries = await listAll(store);
  const sources = [];
  const normalizedNameToIds = new Map();
  for (const entry of entries) {
    const prefix = SOURCE_PREFIXES.find((candidate) => entry.name.startsWith(candidate));
    if (!prefix && !entry.name.startsWith("account-id:")) continue;
    const account = await safeJson(store, entry.name);
    if (!account?.id) continue;
    const recordId = String(account.id);
    if (recordId === id && prefix) sources.push({ prefix, account });
    if (account.name) {
      const normalized = normalizeName(String(account.name));
      if (!normalizedNameToIds.has(normalized)) normalizedNameToIds.set(normalized, new Set());
      normalizedNameToIds.get(normalized).add(recordId);
    }
  }

  const normalizedNames = new Set(sources.map(({ account }) => account.name ? normalizeName(String(account.name)) : "").filter(Boolean));
  const sourceConsistent = sources.length > 0
    && sources.every(({ account }) => String(account.id || "") === id)
    && normalizedNames.size === 1;
  const normalizedName = normalizedNames.size === 1 ? [...normalizedNames][0] : "";
  const accountDestinationExists = (await store.get(`account-id:${id}`)) !== null;
  const nameHash = normalizedName ? await sha256(normalizedName) : "";
  const mappedId = nameHash ? await store.get(`name:${nameHash}`) : null;
  const duplicateLoginId = normalizedName
    ? [...(normalizedNameToIds.get(normalizedName) || [])].some((candidate) => candidate !== id)
    : false;
  const conflicts = [];
  if (!sources.length) conflicts.push("NO_SOURCE_ACCOUNT_RECORD");
  if (!sourceConsistent) conflicts.push("SOURCE_ACCOUNT_CONFLICT");
  if (accountDestinationExists) conflicts.push("ACCOUNT_ID_DESTINATION_EXISTS");
  if (mappedId !== null && String(mappedId) !== id) conflicts.push("NAME_DESTINATION_CONFLICT");
  if (duplicateLoginId) conflicts.push("DUPLICATE_LOGIN_ID");

  const prefixes = [];
  if (!accountDestinationExists) prefixes.push("account-id:");
  if (normalizedName && mappedId === null) prefixes.push("name:");
  if (!prefixes.length) conflicts.push("NO_MISSING_MAPPING");

  return {
    accountId: maskAccountId(id),
    status: conflicts.length ? "blocked" : "ready",
    prefixes,
    plannedWrites: conflicts.length ? 0 : prefixes.length,
    evidence: {
      existingAccountRecordCount: sources.length,
      sourceRecordsConsistent: sourceConsistent,
      loginIdVerifiable: Boolean(normalizedName),
      duplicateLoginId,
    },
    warnings: conflicts,
    kvMutations: { writes: 0, deletes: 0 },
    _private: { id, source: sources[0]?.account, nameHash },
  };
}

export function publicRepairPlan(plan) {
  const { _private, ...safe } = plan;
  return safe;
}

export async function repairAccountMappings(store, accountId, { apply = false, onPrepared } = {}) {
  const plan = await planAccountMappingRepair(store, accountId);
  const safePlan = publicRepairPlan(plan);
  if (!apply) return safePlan;
  if (plan.status !== "ready") throw new Error(`REPAIR_BLOCKED:${plan.warnings.join(",")}`);
  if (typeof store?.put !== "function") throw new Error("WRITE_CAPABILITY_REQUIRED");
  if (onPrepared) await onPrepared(safePlan);
  for (const prefix of plan.prefixes) {
    if (prefix === "account-id:") await store.put(`account-id:${plan._private.id}`, JSON.stringify(plan._private.source));
    else if (prefix === "name:") await store.put(`name:${plan._private.nameHash}`, plan._private.id);
  }
  return { ...safePlan, applied: true, kvMutations: { writes: plan.prefixes.length, deletes: 0 } };
}
