/**
 * pages/LoginPage.ts
 * ------------------
 * Page-Object Model for the OpenClaw login / authentication screen.
 *
 * SELECTOR GUIDE
 * ──────────────
 * Selectors use `data-testid` attributes first (stable), then accessible-role
 * locators (resilient), then CSS selectors (last resort).
 *
 * Update the selectors below to match your actual DOM once the app is running.
 * Run `pnpm codegen` to capture live selectors from the browser.
 */

import { type Page, type Locator, expect } from "@playwright/test";

export class LoginPage {
  readonly page: Page;

  // ── Locators ──────────────────────────────────────────────────────────────
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly forgotPasswordLink: Locator;

  constructor(page: Page) {
    this.page = page;

    // Prefer data-testid → role → CSS
    this.emailInput = page
      .getByTestId("login-email")
      .or(page.getByRole("textbox", { name: /email/i }))
      .or(page.locator("input[type='email']"));

    this.passwordInput = page
      .getByTestId("login-password")
      .or(page.getByRole("textbox", { name: /password/i }))
      .or(page.locator("input[type='password']"));

    this.submitButton = page
      .getByTestId("login-submit")
      .or(page.getByRole("button", { name: /sign in|log in|login/i }));

    this.errorMessage = page
      .getByTestId("login-error")
      .or(page.locator("[role='alert']"));

    this.forgotPasswordLink = page.getByRole("link", {
      name: /forgot.*(password)?/i,
    });
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  async goto() {
    await this.page.goto("/login");
    await this.page.waitForLoadState("networkidle");
  }

  async fillEmail(email: string) {
    await this.emailInput.fill(email);
  }

  async fillPassword(password: string) {
    await this.passwordInput.fill(password);
  }

  async submit() {
    await this.submitButton.click();
  }

  /** One-shot helper: fill credentials and click submit. */
  async login(email: string, password: string) {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.submit();

    // Wait for redirect away from /login (post-login destination)
    await this.page.waitForURL((url) => !url.pathname.includes("/login"), {
      timeout: 20_000,
    });
  }

  // ── Assertions ────────────────────────────────────────────────────────────

  async expectLoginPageVisible() {
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  async expectErrorVisible(text?: string | RegExp) {
    await expect(this.errorMessage).toBeVisible();
    if (text) await expect(this.errorMessage).toContainText(text);
  }

  async expectRedirectedToLogin() {
    await expect(this.page).toHaveURL(/\/login/);
  }
}
