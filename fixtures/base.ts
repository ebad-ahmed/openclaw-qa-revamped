/**
 * fixtures/base.ts
 * -----------------
 * Central fixture hub.  Import `{ test, expect }` from here (not from
 * @playwright/test) so every spec gets page-object instances for free.
 */

import { test as base, expect } from "@playwright/test";
import { LoginPage } from "../pages/LoginPage";
import { ChatPage } from "../pages/ChatPage";
import { SkillsPage } from "../pages/SkillsPage";
import { SettingsPage } from "../pages/SettingsPage";

type OpenClawFixtures = {
  loginPage: LoginPage;
  chatPage: ChatPage;
  skillsPage: SkillsPage;
  settingsPage: SettingsPage;
  /** Authenticated page — login is performed automatically */
  authedPage: ChatPage;
};

export const test = base.extend<OpenClawFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  chatPage: async ({ page }, use) => {
    await use(new ChatPage(page));
  },

  skillsPage: async ({ page }, use) => {
    await use(new SkillsPage(page));
  },

  settingsPage: async ({ page }, use) => {
    await use(new SettingsPage(page));
  },

  /** Convenience fixture: navigates to the app, authenticates with the
   *  gateway token, and hands control to the test with a ready ChatPage. */
  authedPage: async ({ page }, use) => {
    const token = process.env.TEST_AUTH_TOKEN ?? "";

    const login = new LoginPage(page);
    await login.goto();
    await login.login(token);

    const chat = new ChatPage(page);
    await chat.waitForReady();
    await use(chat);
  },
});

export { expect };
