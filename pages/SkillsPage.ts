/**
 * pages/SkillsPage.ts
 * --------------------
 * Page-Object Model for the Skills / Extensions configuration screen.
 *
 * This covers:
 *  • Listing installed skills
 *  • Toggling skills on/off
 *  • Reading skill configuration state
 *  • Verifying SKILL.md presence / last-used metadata
 */

import { type Page, type Locator, expect } from "@playwright/test";

export class SkillsPage {
  readonly page: Page;

  readonly skillsList: Locator;
  readonly addSkillButton: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;

    this.skillsList = page
      .getByTestId("skills-list")
      .or(page.locator("[data-skills-list]"))
      .or(page.locator(".skills-list, .extensions-list"));

    this.addSkillButton = page
      .getByTestId("add-skill")
      .or(page.getByRole("button", { name: /add skill|install/i }));

    this.searchInput = page
      .getByTestId("skills-search")
      .or(page.getByRole("searchbox", { name: /search skills/i }));
  }

  async goto() {
    // Try common URLs; update to match actual routing
    await this.page.goto("/settings/skills");
    await this.page.waitForLoadState("networkidle");
  }

  // ── Locators scoped to a single skill row ─────────────────────────────────

  private skillRow(name: string): Locator {
    return this.page
      .getByTestId(`skill-row-${name}`)
      .or(
        this.skillsList.locator(`[data-skill-name='${name}']`)
      )
      .or(
        this.skillsList
          .locator(".skill-item, .extension-item")
          .filter({ hasText: new RegExp(`^${name}$`, "i") })
      );
  }

  private toggleFor(name: string): Locator {
    return this.skillRow(name)
      .getByRole("switch")
      .or(this.skillRow(name).locator("input[type='checkbox']"));
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  async enableSkill(name: string) {
    const toggle = this.toggleFor(name);
    const isOn = await toggle.isChecked().catch(() => false);
    if (!isOn) await toggle.click();
  }

  async disableSkill(name: string) {
    const toggle = this.toggleFor(name);
    const isOn = await toggle.isChecked().catch(() => true);
    if (isOn) await toggle.click();
  }

  // ── Assertions ────────────────────────────────────────────────────────────

  async expectSkillVisible(name: string) {
    await expect(this.skillRow(name)).toBeVisible();
  }

  async expectSkillEnabled(name: string) {
    await expect(this.toggleFor(name)).toBeChecked();
  }

  async expectSkillDisabled(name: string) {
    await expect(this.toggleFor(name)).not.toBeChecked();
  }

  async expectSkillCount(min: number) {
    const rows = this.skillsList.locator(".skill-item, [data-skill-name]");
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(min);
  }

  /** Returns all skill names visible on the page. */
  async getInstalledSkillNames(): Promise<string[]> {
    const rows = this.skillsList.locator("[data-skill-name]");
    const count = await rows.count();
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      const name = await rows.nth(i).getAttribute("data-skill-name");
      if (name) names.push(name);
    }
    return names;
  }
}
