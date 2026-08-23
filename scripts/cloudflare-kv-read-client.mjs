const API_ORIGIN = "https://api.cloudflare.com/client/v4";
const CLOUDFLARE_ID = /^[0-9a-f]{32}$/i;

function identifierInfo(accountId, namespaceId) {
  return `Account ID(formatValid=${CLOUDFLARE_ID.test(accountId)},length=${accountId.length}), Namespace ID(formatValid=${CLOUDFLARE_ID.test(namespaceId)},length=${namespaceId.length})`;
}

function safeCloudflareMessage(value, secrets) {
  let message = String(value || "응답 메시지 없음");
  for (const secret of secrets.filter(Boolean)) message = message.replaceAll(secret, "[redacted]");
  return message
    .replace(/session:[^\s"'<>]+/gi, "session:[redacted]")
    .replace(/\[[^\]]*\]\([^)]*\)/g, "[link removed]")
    .replace(/https?:\/\/\S+/gi, "[url removed]")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

async function responseErrors(response, secrets) {
  try {
    const payload = await response.json();
    if (!Array.isArray(payload?.errors) || !payload.errors.length) return "errors=[code=unknown, message=응답 메시지 없음]";
    return `errors=[${payload.errors.slice(0, 5).map((item) => {
      const code = String(item?.code ?? "unknown").replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 48) || "unknown";
      return `code=${code}, message=${safeCloudflareMessage(item?.message, secrets)}`;
    }).join("; ")}]`;
  } catch {
    return "errors=[code=unknown, message=JSON 오류 정보를 읽을 수 없음]";
  }
}

export async function cloudflareReadError(response, stage, diagnostics, secrets) {
  const details = await responseErrors(response, secrets);
  const prefix = response.status === 401 ? "토큰 인증 실패"
    : response.status === 403 ? "토큰 권한 부족"
      : response.status === 404 ? "Account ID 또는 Namespace ID 불일치"
        : "Cloudflare 읽기 API 오류";
  return new Error(`${stage} 단계 실패: ${prefix} (HTTP ${response.status}); ${details}; ${diagnostics}`);
}

export function createCloudflareKvReadClient({ accountId, namespaceId, token, fetchImpl = fetch }) {
  const cleanAccountId = String(accountId || "").trim();
  const cleanNamespaceId = String(namespaceId || "").trim();
  const cleanToken = String(token || "").trim();
  const diagnostics = identifierInfo(cleanAccountId, cleanNamespaceId);
  if (!cleanToken) throw new Error(`필수 Cloudflare API Token이 비어 있습니다. ${diagnostics}`);
  if (!CLOUDFLARE_ID.test(cleanAccountId) || !CLOUDFLARE_ID.test(cleanNamespaceId)) {
    throw new Error(`Cloudflare 식별자 형식 오류. 따옴표·공백·줄바꿈·Markdown 문법 없이 32자리 ID를 설정하세요. ${diagnostics}`);
  }

  const accountBase = `${API_ORIGIN}/accounts/${cleanAccountId}`;
  const kvBase = `${accountBase}/storage/kv/namespaces/${cleanNamespaceId}`;
  const headers = { Authorization: `Bearer ${cleanToken}` };
  const secrets = [cleanToken, cleanAccountId, cleanNamespaceId];

  async function get(url, stage, { allowNotFound = false } = {}) {
    const response = await fetchImpl(url, { method: "GET", headers });
    if (allowNotFound && response.status === 404) return null;
    if (!response.ok) throw await cloudflareReadError(response, stage, diagnostics, secrets);
    return response;
  }

  const store = {
    async get(key, type) {
      const response = await get(`${kvBase}/values/${encodeURIComponent(key)}`, "KV 값 조회", { allowNotFound: true });
      if (!response) return null;
      const value = await response.text();
      return type === "json" ? JSON.parse(value) : value;
    },
    async list({ cursor } = {}) {
      const query = new URLSearchParams();
      query.set("limit", "1000");
      if (typeof cursor === "string" && cursor.length) query.set("cursor", cursor);
      const payload = await (await get(`${kvBase}/keys?${query.toString()}`, "KV 키 목록 조회")).json();
      const next = typeof payload.result_info?.cursor === "string" ? payload.result_info.cursor : "";
      return { keys: Array.isArray(payload.result) ? payload.result : [], cursor: next, list_complete: !next };
    },
  };

  return {
    store,
    async verify() {
      const payload = await (await get(`${accountBase}/tokens/verify`, "Account API Token 검증")).json();
      if (payload?.success === false || (payload?.result?.status && payload.result.status !== "active")) throw new Error(`Account API Token 검증 단계 실패: 토큰이 활성 상태가 아닙니다. ${diagnostics}`);
      await store.list();
      return true;
    },
  };
}
