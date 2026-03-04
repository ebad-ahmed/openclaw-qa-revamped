/**
 * pages/SettingsPage.ts
 * ----------------------
 * Page-Object Model for the OpenClaw Settings screen.
 * Covers model selection, API key management, channel configuration.
 */

import { type Page, type Locator, expect } from "@playwright/test";

export class SettingsPage {
  readonly page: Page;

  readonly modelSelector: Locator;
  readonly apiKeyInput: Locator;
  readonly saveButton: Locator;
  readonly successToast: Locator;

  constructor(page: Page) {
    this.page = page;

    this.modelSelector = page
      .getByTestId("model-selector")
      .or(page.getByRole("combobox", { name: /model/i }));

    this.apiKeyInput = page
      .getByTestId("api-key-input")
      .or(page.locator("input[type='password'][name*='key' i]"));

    this.saveButton = page
      .getByTestId("settings-save")
      .or(page.getByRole("button", { name: /save|apply/i }));

    this.successToast = page
      .getByTestId("success-toast")
      .or(page.locator("[role='status']").filter({ hasText: /saved|success/i }));
  }

  async goto() {
    await this.page.goto("/settings");
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
