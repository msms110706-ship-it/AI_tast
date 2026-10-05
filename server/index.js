import { onRequest as account } from '../functions/api/account.js';
import { onRequest as login } from '../functions/api/account/login.js';
import { onRequest as register } from '../functions/api/account/register.js';
import { onRequest as me } from '../functions/api/account/me.js';
import { onRequest as logout } from '../functions/api/logout.js';
import { onRequest as accountLogout } from '../functions/api/account/logout.js';
import { onRequest as sync } from '../functions/api/sync.js';
import { onRequest as sessions } from '../functions/api/sessions.js';
import { onRequest as mistakes } from '../functions/api/mistakes.js';
import { onRequest as coach } from '../functions/api/coach.js';
import { onRequest as webhook } from '../functions/api/billing/webhook.js';
import { onRequest as middleware } from '../functions/_middleware.js';
import { apiError } from '../functions/_lib/http.js';
const routes = { '/api/account': account, '/api/account/login': login, '/api/account/register': register, '/api/account/me': me, '/api/account/logout': accountLogout, '/api/logout': logout, '/api/sync': sync, '/api/sessions': sessions, '/api/mistakes': mistakes, '/api/coach': coach, '/api/billing/webhook': webhook };
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    return middleware({ request, env, next: async () => {
      if (routes[path]) return routes[path]({ request, env });
      if (path.startsWith('/api/')) return apiError('NOT_FOUND', '지원하지 않는 요청입니다.', 404);
      if (!env.ASSETS?.fetch) return new Response('Not found', { status: 404 });
      if (path === '/') url.pathname = '/index.html';
      else if (!path.includes('.')) url.pathname = `${path}/index.html`;
      return env.ASSETS.fetch(new Request(url, request));
    } });
  },
};
