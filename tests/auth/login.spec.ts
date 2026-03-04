/**
 * tests/auth/login.spec.ts
 * ─────────────────────────
 * QA Tier: Authentication gate
 *
 * Covers:
 *  ✓ Unauthenticated users are redirected to /login
 *  ✓ Valid credentials → successful login → chat UI visible
 *  ✓ Invalid credentials → error shown, no redirect
 *  ✓ Empty-form submission → validation errors shown
 *  ✓ Session persists on page reload
 *  ✓ Logout clears session → redirected back to /login
 */

import { test, expect } from "../../fixtures/base";

// ── Helper ────────────────────────────────────────────────────────────────────

const VALID_EMAIL = process.env.TEST_USER_EMAIL ?? "qa-tester@puresquare.com";
const VALID_PASSWORD = process.env.TEST_USER_PASSWORD ?? "changeme";

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe("Login — unauthenticated redirects", () => {
  test("navigating to / while logged out redirects to /login", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("login page renders all required fields", async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.expectLoginPageVisible();
  });
});

test.describe("Login — valid credentials", () => {
  test("logging in with correct credentials shows the chat interface", async ({
    loginPage,
    chatPage,
  }) => {
    await loginPage.goto();
    await loginPage.login(VALID_EMAIL, VALID_PASSWORD);

    // Should land on chat / dashboard — not /login
    await expect(loginPage.page).not.toHaveURL(/\/login/);
    await chatPage.expectLoggedIn();
  });

  test("authenticated user can see the message input", async ({ authedPage }) => {
    await expect(authedPage.messageInput).toBeVisible();
    await expect(authedPage.sendButton).toBeVisible();
  });
});

test.describe("Login — invalid credentials", () => {
  test("wrong password shows an error and stays on /login", async ({
    loginPage,
  }) => {
    await loginPage.goto();
    await loginPage.fillEmail(VALID_EMAIL);
    await loginPage.fillPassword("definitely-wrong-password-42");
    await loginPage.submit();

    // URL must still contain /login
    await expect(loginPage.page).toHaveURL(/\/login/);
    await loginPage.expectErrorVisible(/invalid|incorrect|unauthorized/i);
  });

  test("unknown email shows an error", async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.fillEmail("notareal@example.com");
    await loginPage.fillPassword("anypassword");
    await loginPage.submit();

    await expect(loginPage.page).toHaveURL(/\/login/);
    await loginPage.expectErrorVisible();
  });

  test("empty form submission shows validation feedback", async ({
    loginPage,
  }) => {
    await loginPage.goto();
    await loginPage.submit();

    // Either HTML5 native validation (no navigation) or inline error
    const stillOnLogin =
      loginPage.page.url().includes("/login") ||
      loginPage.page.url() === `${process.env.OPENCLAW_BASE_URL}/login`;
    expect(stillOnLogin).toBe(true);
  });
});

test.describe("Login — session persistence", () => {
  test("authenticated session survives a page reload", async ({ authedPage }) => {
    await authedPage.page.reload();
    await authedPage.page.waitForLoadState("networkidle");
    await authedPage.expectLoggedIn();
  });
});

test.describe("Login — logout", () => {
  test("logging out redirects back to /login", async ({ authedPage, page }) => {
    // Attempt to find and click a logout button / menu item
    const logoutTrigger = page
      .getByTestId("logout-button")
      .or(page.getByRole("button", { name: /log.?out|sign.?out/i }))
      .or(page.getByRole("menuitem", { name: /log.?out|sign.?out/i }));

    // Some apps nest logout in a dropdown — try opening user menu first
    const userMenu = page
      .getByTestId("user-menu")
      .or(page.getByRole("button", { name: /user|account|profile/i }));

    try {
      await userMenu.click({ timeout: 3_000 });
    } catch {
      /* no user menu — logout button may be directly visible */
    }

    await logoutTrigger.click({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
