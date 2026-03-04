import { defineConfig, devices } from "@playwright/test";
import * as dotenv from "dotenv";
dotenv.config();

/**
 * OpenClaw QA — Playwright Configuration
 * Mirrors the five-tier QA architecture from the QA Guide:
 *   Tier A  → unit (handled by Vitest, not Playwright)
 *   Tier B  → smoke  (tests/smoke)
 *   Tier C  → live   (tests/chat, tests/skills)
 *   Tier D  → canary (tests/canary)
 *   Auth    → tests/auth
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,           // sequential by default — OpenClaw gateway is stateful
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1,
  timeout: 60_000,                // generous timeout for AI round-trips
  expect: { timeout: 15_000 },

  reporter: [
    ["list"],
    ["html", { outputFolder: "reports/html", open: "never" }],
    ["json", { outputFile: "reports/results.json" }],
  ],

  use: {
    baseURL: process.env.OPENCLAW_BASE_URL ?? "http://localhost:4000",
    headless: true,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "on-first-retry",
    actionTimeout: 15_000,
  },

  projects: [
    // ── Desktop Chrome (primary) ───────────────────────────────────────────
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },

    // ── Mobile Safari (companion app surface) ─────────────────────────────
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 13"] },
      testMatch: /smoke|auth/,    // run only lightweight suites on mobile
    },
  ],
});
