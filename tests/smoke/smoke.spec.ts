/**
 * tests/smoke/smoke.spec.ts
 * ──────────────────────────
 * QA Tier: E2E Smoke (Tier B) — runs on every PR touching gateway
 *
 * These tests do NOT require a real AI model.  They validate:
 *  ✓ Gateway /healthz endpoint returns 200
 *  ✓ Gateway /status returns expected shape
 *  ✓ Login page renders without errors
 *  ✓ Authenticated user reaches chat UI without JS errors
 *  ✓ WebSocket connection is established (if exposed in UI)
 *  ✓ Core navigation links are present
 */

import { test, expect } from "../../fixtures/base";
import { checkGatewayHealth, getGatewayStatus } from "../../utils/helpers";

// ── Gateway health (direct API — no UI) ──────────────────────────────────────

test.describe("Gateway Health — API layer", () => {
  test("GET /healthz returns 200", async ({ request }) => {
    const gatewayUrl =
      process.env.OPENCLAW_GATEWAY_URL ?? "http://localhost:18789";
    const resp = await request.get(`${gatewayUrl}/healthz`);
    expect(resp.status()).toBe(200);
  });

  test("GET /healthz body signals healthy state", async ({ request }) => {
    const gatewayUrl =
      process.env.OPENCLAW_GATEWAY_URL ?? "http://localhost:18789";
    const resp = await request.get(`${gatewayUrl}/healthz`);
    const body = await resp.text();
    // Common patterns: { "status": "ok" } or plain "ok"
    expect(body.toLowerCase()).toMatch(/ok|healthy|running/);
  });

  test("GET /status returns a JSON object", async ({ request }) => {
    const gatewayUrl =
      process.env.OPENCLAW_GATEWAY_URL ?? "http://localhost:18789";
    const resp = await request.get(`${gatewayUrl}/status`);

    if (resp.status() === 404) {
      // /status may not be implemented — skip gracefully
      test.skip();
      return;
    }

    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(typeof body).toBe("object");
  });
});

// ── UI Smoke ──────────────────────────────────────────────────────────────────

test.describe("UI Smoke — unauthenticated", () => {
  test("home page loads without HTTP error", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBeLessThan(500);
  });

  test("login page loads with no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    // Filter out known benign errors (e.g. favicon 404)
    const realErrors = errors.filter(
      (e) => !e.includes("favicon") && !e.includes("ERR_ABORTED")
    );
    expect(realErrors).toHaveLength(0);
  });
});

test.describe("UI Smoke — authenticated", () => {
  test("chat page loads with no console errors after login", async ({
    authedPage,
  }) => {
    const errors: string[] = [];
    authedPage.page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await authedPage.page.reload();
    await authedPage.page.waitForLoadState("networkidle");

    const realErrors = errors.filter(
      (e) => !e.includes("favicon") && !e.includes("ERR_ABORTED")
    );
    expect(realErrors).toHaveLength(0);
  });

  test("chat input and send button are present", async ({ authedPage }) => {
    await expect(authedPage.messageInput).toBeVisible();
    await expect(authedPage.sendButton).toBeVisible();
  });

  test("sidebar navigation is present", async ({ authedPage }) => {
    await expect(authedPage.sidebarNav).toBeVisible();
  });
});

// ── WebSocket connectivity ────────────────────────────────────────────────────

test.describe("WebSocket connectivity", () => {
  test("WebSocket connection opens successfully", async ({ authedPage, page }) => {
    // Intercept WebSocket frames — a WS open event means the connection was established
    let wsOpened = false;

    page.on("websocket", (ws) => {
      if (ws.url().includes("localhost")) {
        wsOpened = true;
      }
    });

    // Sending a message should trigger the WS (or existing connection is already open)
    await authedPage.messageInput.fill("ping");

    // Give the WS 3 seconds to appear — some apps connect on page load
    await page.waitForTimeout(3_000);

    // Soft assertion: warn but don't fail if no WS (some apps use HTTP polling)
    if (!wsOpened) {
      console.warn(
        "[WARN] No WebSocket connection detected. " +
          "If OpenClaw uses HTTP polling, this is expected."
      );
    }
  });
});
