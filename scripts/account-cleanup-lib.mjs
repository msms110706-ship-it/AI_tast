import { accountLookup } from "../functions/_lib/account-service.js";
import { discoverAccountDeletion, deletionSummary, executeAccountDeletion } from "../functions/_lib/account-deletion.js";

async function findByAccountId(store, accountId) {
  for (const key of [`account-id:${accountId}`, `user:${accountId}`]) {
    const account = await store.get(key, "json");
    if (account?.id === accountId) return account;
  }
  if (typeof store.list !== "function") return null;
  for (const prefix of ["account:", "account-v2:"]) {
    let cursor;
    do {
      const page = await store.list({ prefix, cursor });
      for (const entry of page.keys || []) {
        const account = await store.get(entry.name, "json");
        if (account?.id === accountId) return { ...account, accountKey: entry.name };
      }
      cursor = page.list_complete === false ? page.cursor : undefined;
    } while (cursor);
  }
  return null;
}

export async function resolveCleanupTarget(store, target) {
  if (Boolean(target.loginId) === Boolean(target.accountId)) throw new Error("SPECIFY_EXACTLY_ONE_TARGET");
  if (target.accountId) {
    const account = await findByAccountId(store, target.accountId);
    if (!account) throw new Error("ACCOUNT_NOT_FOUND");
    return account;
  }
  const lookup = await accountLookup(store, target.loginId);
  const unique = [...new Map(lookup.candidates.map((candidate) => [candidate.account.id, candidate.account])).values()];
  if (!unique.length) throw new Error("ACCOUNT_NOT_FOUND");
  if (unique.length !== 1) throw new Error("AMBIGUOUS_LEGACY_LOGIN_ID_USE_ACCOUNT_ID");
  return unique[0];
}

export async function cleanupAccount(store, target, { dryRun = true, confirmation = "" } = {}) {
  const account = await resolveCleanupTarget(store, target);
  const plan = await discoverAccountDeletion(store, account);
  const result = { dryRun, summary: deletionSummary(plan), totalOperations: plan.deletes.length + (plan.legacyIndex.current.length !== plan.legacyIndex.remaining.length ? 1 : 0) };
  if (dryRun) return result;
  if (confirmation !== "DELETE THIS ACCOUNT") throw new Error("EXACT_CONFIRMATION_REQUIRED");
  await executeAccountDeletion(store, plan);
  return result;
}
