/**
 * pages/SettingsPage.ts
 * ----------------------
 * Page-Object Model for the OpenClaw Config screen.
 * Located at /login/config in the SPA.
 */

import { type Page, type Locator, expect } from "@playwright/test";

export class SettingsPage {
  readonly page: Page;

  readonly modelSelector: Locator;
  readonly saveButton: Locator;
  readonly successToast: Locator;

  constructor(page: Page) {
    this.page = page;

    this.modelSelector = page.locator('select').nth(1); // second select is model
    this.saveButton = page.getByRole("button", { name: /save|apply/i });
    this.successToast = page.locator("[role='status']").filter({ hasText: /saved|success/i });
  }

  async goto() {
    await this.page.goto("/login/config");
    await this.page.waitForLoadState("networkidle");
  }

  async selectModel(modelName: string) {
    await this.modelSelector.selectOption({ label: modelName }).catch(() =>
      this.modelSelector.fill(modelName)
    );
  }

  async save() {
    await this.saveButton.click();
    await expect(this.successToast).toBeVisible({ timeout: 5_000 });
  }

  async expectCurrentModel(modelName: string | RegExp) {
    await expect(this.modelSelector).toContainText(modelName);
  }
}
