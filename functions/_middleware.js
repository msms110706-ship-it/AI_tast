const SECURITY_HEADERS = {
  "strict-transport-security": "max-age=31536000; includeSubDomains; preload",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "x-frame-options": "DENY",
};

const API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

export async function onRequest(context) {
  const response = await context.next();
  const secured = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) secured.headers.set(name, value);
  const pathname = new URL(context.request.url).pathname;
  if (pathname === "/api" || pathname.startsWith("/api/")) {
    secured.headers.set("content-security-policy", API_CSP);
  } else {
    // HTML and static assets use public/_headers' Report-Only policy. Explicitly
    // remove an upstream enforced CSP so Next.js hydration cannot be disabled.
    secured.headers.delete("content-security-policy");
  }
  return secured;
}
