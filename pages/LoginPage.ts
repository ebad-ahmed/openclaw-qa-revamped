/**
 * pages/LoginPage.ts
 * ------------------
 * Page-Object Model for the OpenClaw login / authentication screen.
 *
 * The OpenClaw UI uses token-based auth via a gateway token.
 * There is NO email field — only a WebSocket URL, gateway token, and optional password.
 */

import { type Page, type Locator, expect } from "@playwright/test";

export class LoginPage {
  readonly page: Page;

  // ── Locators ──────────────────────────────────────────────────────────────
  readonly wsUrlInput: Locator;
  readonly tokenInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly loginGate: Locator;

  constructor(page: Page) {
    this.page = page;

    this.wsUrlInput = page.locator('input[placeholder*="ws://"]');
    this.tokenInput = page.locator('input[placeholder*="OPENCLAW_GATEWAY_TOKEN"]');
    this.passwordInput = page.locator('input[placeholder="optional"]');
    this.submitButton = page.locator('.login-gate__card button', { hasText: 'Connect' });
    // Exclude the update banner from error messages
    this.errorMessage = page.locator('[role="alert"]:not(.update-banner)');
    this.loginGate = page.locator('.login-gate__card');
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  async goto() {
    await this.page.goto("/login");
    await this.page.waitForLoadState("networkidle");
  }

  async fillToken(token: string) {
    await this.tokenInput.fill(token);
  }

  async fillPassword(password: string) {
    await this.passwordInput.fill(password);
  }

  async submit() {
    await this.submitButton.click();
  }

  /**
   * One-shot helper: fill gateway token and click Connect.
   * Waits for the login gate card to disappear (SPA stays at /login/chat).
   */
  async login(token: string) {
    await this.fillToken(token);
    await this.submit();

    // Wait for the login gate to disappear — SPA transitions to /login/chat?session=main
    await expect(this.loginGate).toBeHidden({ timeout: 20_000 });
  }

  // ── Assertions ────────────────────────────────────────────────────────────

  async expectLoginPageVisible() {
    await expect(this.tokenInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  async expectErrorVisible(text?: string | RegExp) {
    await expect(this.errorMessage).toBeVisible();
    if (text) await expect(this.errorMessage).toContainText(text);
  }

  async expectLoginGateVisible() {
    await expect(this.loginGate).toBeVisible();
  }
}
