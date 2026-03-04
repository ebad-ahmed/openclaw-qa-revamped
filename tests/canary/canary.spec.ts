/**
 * tests/canary/canary.spec.ts
 * ────────────────────────────
 * QA Tier: Deployment Canary (Tier D) — run every 10-15 minutes in production
 *
 * These tests are the Playwright equivalent of the canary.sh script from
 * Section 4.5 of the QA Guide.  They are lightweight, fast, and alert on
 * failures via the ALERT_WEBHOOK_URL environment variable.
 *
 * Run schedule:
 *   */10 * * * *  npx playwright test tests/canary --reporter=json | \
 *                 node scripts/canary-alert.js
 *
 * Pass criteria (all must pass):
 *  ✓ Gateway /healthz returns 200
 *  ✓ UI is reachable and renders login
 *  ✓ Authenticated user can send CANARY_OK probe and get CANARY_OK back
 *  ✓ No error banners in the chat UI after the probe
 */

import { test, expect } from "../../fixtures/base";
import {
  checkGatewayHealth,
  makeNonce,
  captureFailureArtifact,
} from "../../utils/helpers";

// ── Canary Step 1: Gateway health ─────────────────────────────────────────────

test("CANARY-1: gateway /healthz is reachable and healthy", async ({
  request,
}) => {
  const gatewayUrl =
    process.env.OPENCLAW_GATEWAY_URL ?? "http://localhost:18789";
  const resp = await request.get(`${gatewayUrl}/healthz`, {
    timeout: 5_000,
  });
  expect(
    resp.status(),
    "Gateway /healthz returned non-200 — OpenClaw may be down"
  ).toBe(200);
});

// ── Canary Step 2: UI reachable ───────────────────────────────────────────────

test("CANARY-2: login page is reachable", async ({ page }) => {
  const resp = await page.goto("/login", { timeout: 10_000 });
  expect(
    resp?.status() ?? 500,
    "Login page returned HTTP error"
  ).toBeLessThan(500);
});

// ── Canary Step 3: Auth works ─────────────────────────────────────────────────

test("CANARY-3: user can log in and reach chat interface", async ({
  authedPage,
}) => {
  await authedPage.expectLoggedIn();
  await expect(
    authedPage.messageInput,
    "Chat input not visible after login"
  ).toBeVisible();
});

// ── Canary Step 4: Agent loop round-trip (CANARY_OK probe) ───────────────────

test("CANARY-4: agent loop responds with CANARY_OK", async ({ authedPage }) => {
  let reply = "";
  try {
    reply = await authedPage.sendAndWaitForReply(
      "Reply with exactly: CANARY_OK",
      30_000
    );
    expect(
      reply,
      "Agent did not return CANARY_OK — model or gateway may be unresponsive"
    ).toContain("CANARY_OK");
  } catch (err) {
    captureFailureArtifact({
      testName: "CANARY-4",
      prompt: "Reply with exactly: CANARY_OK",
      reply,
      probeType: "agent-loop",
      error: String(err),
    });
    throw err;
  }
});

// ── Canary Step 5: No error banners ───────────────────────────────────────────

test("CANARY-5: chat UI shows no error banners after probe", async ({
  authedPage,
}) => {
  await authedPage.sendAndWaitForReply("Reply with exactly: CANARY_OK");
  await authedPage.expectNoBannerError();
});

// ── Canary Step 6: Nonce round-trip (extra confidence) ───────────────────────

test("CANARY-6: agent echoes unique nonce (round-trip integrity)", async ({
  authedPage,
}) => {
  const nonce = makeNonce("CANARY");
  let reply = "";
  try {
    reply = await authedPage.sendAndWaitForReply(
      `Echo this exact token: ${nonce}`,
      30_000
    );
    expect(
      reply,
      `Nonce ${nonce} not found in agent reply — possible truncation or model error`
    ).toContain(nonce);
  } catch (err) {
    captureFailureArtifact({
      testName: "CANARY-6",
      prompt: `echo nonce ${nonce}`,
      reply,
      probeType: "nonce-round-trip",
      error: String(err),
    });
    throw err;
  }
});
