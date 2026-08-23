import { normalizeName, sha256 } from "./auth.js";

async function listKeys(store, prefix) {
  if (typeof store.list !== "function") return [];
  const keys = [];
  let cursor;
  do {
    const page = await store.list({ prefix, cursor });
    keys.push(...(page.keys || []).map((entry) => entry.name));
    cursor = page.list_complete === false ? page.cursor : undefined;
  } while (cursor);
  return keys;
}

export async function discoverAccountDeletion(store, account) {
  const accountId = String(account.id || "");
  if (!accountId) throw new Error("ACCOUNT_ID_REQUIRED");
  const nameHash = await sha256(normalizeName(String(account.name || "")));
  const nameKey = `name:${nameHash}`;
  const legacyIndexKey = `accounts:${nameHash}`;
  const indexedKeys = (await store.get(legacyIndexKey, "json")) || [];
  const candidateAccountKeys = new Set([
    `account-id:${accountId}`, `user:${accountId}`, `account:${nameHash}`,
    String(account.accountKey || ""), ...indexedKeys,
  ].filter(Boolean));
  const ownedAccountKeys = [];
  for (const key of candidateAccountKeys) {
    const candidate = await store.get(key, "json");
    if (candidate?.id === accountId) ownedAccountKeys.push(key);
  }

  const sessionKeys = new Set((await store.get(`sessions:${accountId}`, "json")) || []);
  for (const key of await listKeys(store, "session:")) {
    if ((await store.get(key)) === accountId) sessionKeys.add(key);
  }
  const verifiedSessionKeys = [];
  for (const key of sessionKeys) if ((await store.get(key)) === accountId) verifiedSessionKeys.push(key);

  const mappedId = await store.get(nameKey);
  const remainingLegacyIndex = indexedKeys.filter((key) => !ownedAccountKeys.includes(key));
  const deletes = [
    ...verifiedSessionKeys.map((key) => ({ key, type: "session" })),
    { key: `sessions:${accountId}`, type: "session-index" },
    { key: `plans:${accountId}`, type: "plans" },
    { key: `mistakes:${accountId}`, type: "mistakes" },
    { key: `progress:${accountId}`, type: "progress" },
    ...ownedAccountKeys.map((key) => ({ key, type: "account" })),
    ...(mappedId === accountId ? [{ key: nameKey, type: "login-id-mapping" }] : []),
  ];
  return {
    accountId,
    deletes: [...new Map(deletes.map((item) => [item.key, item])).values()],
    legacyIndex: { key: legacyIndexKey, current: indexedKeys, remaining: remainingLegacyIndex },
  };
}

export function deletionSummary(plan) {
  const counts = {};
  for (const item of plan.deletes) counts[item.type] = (counts[item.type] || 0) + 1;
  if (plan.legacyIndex.current.length !== plan.legacyIndex.remaining.length) counts["legacy-login-index-update"] = 1;
  return counts;
}

export async function executeAccountDeletion(store, plan) {
  let completed = 0;
  try {
    // Sessions go first so a partially deleted account cannot continue using an old session.
    for (const item of plan.deletes) { await store.delete(item.key); completed += 1; }
    if (plan.legacyIndex.current.length !== plan.legacyIndex.remaining.length) {
      if (plan.legacyIndex.remaining.length) await store.put(plan.legacyIndex.key, JSON.stringify(plan.legacyIndex.remaining));
      else await store.delete(plan.legacyIndex.key);
      completed += 1;
    }
    return { completed };
  } catch (cause) {
    const error = new Error("ACCOUNT_DELETION_INCOMPLETE");
    error.completed = completed;
    error.cause = cause;
    throw error;
  }
}
