import { expect, test } from "@playwright/test";

test("homepage hydrates and core controls remain interactive without CSP blocks", async ({ page }) => {
  const cspErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /content security policy|refused to (execute|load)/i.test(message.text())) cspErrors.push(message.text());
  });

  await page.route("**/api/account/login", (route) => route.fulfill({
    status: 401,
    contentType: "application/json",
    body: JSON.stringify({ ok: false, error: { code: "INVALID_CREDENTIALS", message: "로그인 아이디 또는 비밀번호가 올바르지 않습니다." } }),
  }));
  await page.goto("/", { waitUntil: "networkidle" });

  const registerTab = page.getByRole("tab", { name: "새 계정 만들기" });
  await registerTab.click();
  await expect(registerTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("만 14세 미만 이용자의 정보는 서버에 저장하지 않습니다.")).toBeVisible();

  await page.getByLabel("연령 구분").selectOption("over14");
  await expect(page.getByLabel("로그인 아이디")).toBeVisible();
  await expect(page.getByLabel("공개 별명")).toBeVisible();
  await expect(page.getByLabel("비밀번호 확인")).toBeVisible();
  await page.getByLabel("연령 구분").selectOption("under14");
  await expect(page.getByRole("button", { name: /계정 없이 이 기기에서 시작하기/ })).toBeVisible();

  const faq = page.locator("details").filter({ hasText: "다른 기기에서도 계획을 볼 수 있나요?" });
  await faq.locator("summary").click();
  await expect(faq).toHaveAttribute("open", "");

  await page.locator("footer").getByRole("button", { name: "문의", exact: true }).click();
  await expect(page.getByRole("heading", { name: /공부의/ })).toBeVisible();
  await page.getByRole("button", { name: /돌아가기/ }).click();

  await page.getByRole("tab", { name: "로그인" }).click();
  const password = page.locator('input[autocomplete="current-password"]');
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "비밀번호 보기" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await page.getByLabel("로그인 아이디").fill("unknown-user");
  await password.fill("Wrong123!");
  await page.getByRole("button", { name: /^로그인/ }).click();
  await expect(page.locator(".form-status.error")).toHaveText("로그인 아이디 또는 비밀번호가 올바르지 않습니다.");
  expect(cspErrors).toEqual([]);
});

test("mobile homepage has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "새 계정 만들기" }).click();
  const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});
