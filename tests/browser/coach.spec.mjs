import { expect, test } from '@playwright/test';

async function blockExternal(page) {
  await page.route('**/*', route => {
    if (new URL(route.request().url()).hostname !== '127.0.0.1') return route.abort();
    return route.continue();
  });
}
test('local coach offers builtin help without coach or Wikipedia requests', async ({ page }) => {
  await blockExternal(page);
  let requests = 0;
  page.on('request', request => { if (/\/api\/coach|wikipedia|api.openai/.test(request.url())) requests++; });
  await page.addInitScript(() => localStorage.setItem('study-flow-session', JSON.stringify({ user: { id: 'local-device', displayName: '로컬 학습자', grade: '중2', isChild: true, localOnly: true } })));
  await page.goto('/');
  await page.getByRole('button', { name: /나만의 계획 만들기/ }).click();
  const card = page.locator('.help-card');
  await expect(card.getByText('로컬 모드에서는 질문이 외부 서비스로 전송되지 않습니다')).toBeVisible();
  await expect(card.getByText(/현재 요금제/)).toHaveCount(0);
  await expect(card.getByRole('button', { name: /프리미엄/ })).toHaveCount(0);
  await card.locator('input').fill('삼각형 넓이');
  await card.getByRole('button', { name: '내장 도움말 보기' }).click();
  await expect(card.locator('.coach-answer')).toContainText('밑변');
  expect(requests).toBe(0);
});
test('exhausted free usage keeps Wikipedia button and labels sources accurately', async ({ page }) => {
  await blockExternal(page);
  const user = { id: crypto.randomUUID(), displayName: '학습자', grade: '중2', isChild: false };
  await page.addInitScript(user => localStorage.setItem('study-flow-session', JSON.stringify({ user })), user);
  const usage = { plan: 'free', dailyAiLimit: 3, usedAiQuestions: 3, remainingAiQuestions: 0, resetAt: '2026-09-25T15:00:00Z' };
  let posts = 0;
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    let body = { ok: true, plans: [], mistakes: [], revision: 0 };
    if (path === '/api/account/me') body = { ok: true, user };
    if (path === '/api/coach') {
      body = { ok: true, ...usage };
      if (route.request().method() === 'POST') { posts++; body = { ...body, mode: 'wikipedia', answer: '참고 자료', sources: [{ title: '학습', url: 'https://ko.wikipedia.org/wiki/학습' }], retrievedAt: '2026-09-24T03:00:00Z' }; }
    }
    return route.fulfill({ json: body });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /나만의 계획 만들기/ }).click();
  const card = page.locator('.help-card');
  await expect(card).toContainText('오늘의 AI 호출 시도 3/3회 사용');
  await expect(card.getByRole('button', { name: '프리미엄 준비 중' })).toBeDisabled();
  await card.locator('input').fill('학습');
  await card.getByRole('button', { name: 'Wikipedia에 질문하기' }).click();
  await expect(card.getByText('Wikipedia 기반 자료')).toBeVisible();
  await expect(card.getByRole('link', { name: '학습', exact: true })).toHaveAttribute('href', 'https://ko.wikipedia.org/wiki/학습');
  await expect(card).toContainText('조회 시각');
  expect(posts).toBe(1);
});

test('public layout keeps start alignment and fits desktop and mobile viewports', async ({ page }) => {
  await blockExternal(page);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    const articles = page.locator('.principle-list article');
    await expect(articles.first()).toBeVisible();
    await expect(articles.first()).toHaveCSS('align-items', 'flex-start');
    await expect(page.locator('.public-footer nav')).toHaveCSS('align-items', 'flex-start');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
