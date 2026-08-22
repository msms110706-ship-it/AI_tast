export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

export function apiError(code, message = "요청을 처리할 수 없습니다.", status = 400) {
  return json({ ok: false, error: { code, message } }, status);
}
