/**
 * tests/chat/chat.spec.ts
 * ────────────────────────
 * QA Tier: Live regression (Tier C)
 *
 * Covers:
 *  ✓ Basic round-trip: user sends a message → agent replies
 *  ✓ Nonce round-trip probe (mirrors OpenClaw live Read Probe)
 *  ✓ Agent replies contain expected text when prompted precisely
 *  ✓ Multi-turn context: agent references earlier messages
 *  ✓ New chat clears prior session history
 *  ✓ No error banners during normal usage
 *  ✓ Long prompt handling (no timeout / silent failure)
 *
 * NOTE: These tests require the OpenClaw gateway to be running and a
 * real model to be configured.  Gate them with OPENCLAW_LIVE_TEST=1
 * in CI to avoid running on every push.
 */

import { test, expect } from "../../fixtures/base";
import { makeNonce, captureFailureArtifact } from "../../utils/helpers";

const LIVE = process.env.OPENCLAW_LIVE_TEST === "1";

test.describe("Chat — basic round-trip", () => {
  test("agent responds to a simple greeting", async ({ authedPage }) => {
    const reply = await authedPage.sendAndWaitForReply("Hello!");
    expect(reply.length).toBeGreaterThan(0);
    await authedPage.expectNoBannerError();
  });

  test("agent returns exactly SMOKE_OK when asked", async ({ authedPage }) => {
    const reply = await authedPage.sendAndWaitForReply(
      'Reply with exactly the text: SMOKE_OK — nothing else.'
    );
    expect(reply.trim()).toContain("SMOKE_OK");
  });
});

test.describe("Chat — nonce round-trip probe (mirrors live Read Probe)", () => {
  test("agent can echo back a unique nonce", async ({ authedPage }) => {
    const nonce = makeNonce("CHAT");
    let reply = "";
    try {
      reply = await authedPage.sendAndWaitForReply(
        `Please echo back this exact token without modification: ${nonce}`
      );
      expect(reply).toContain(nonce);
    } catch (err) {
      captureFailureArtifact({
        testName: "nonce-round-trip",
        prompt: `echo token ${nonce}`,
        reply,
        error: String(err),
      });
      throw err;
    }
  });
});

test.describe("Chat — multi-turn context retention", () => {
  test("agent remembers user name from earlier in the session", async ({
    authedPage,
  }) => {
    // Turn 1: tell the agent your name
    await authedPage.sendAndWaitForReply(
      "For this conversation only, my test alias is TESTUSER_ALPHA."
    );

    // Turn 2: ask it to repeat the name
    const reply2 = await authedPage.sendAndWaitForReply(
      "What test alias did I just give you?"
    );
    expect(reply2).toContain("TESTUSER_ALPHA");
  });

  test("session history is visible in the message list", async ({
    authedPage,
  }) => {
    const msg = `HistoryCheck_${makeNonce()}`;
    await authedPage.sendAndWaitForReply(msg);
    await authedPage.expectSessionHistoryContains(msg);
  });
});

test.describe("Chat — new conversation", () => {
  test("starting a new chat clears prior messages", async ({ authedPage }) => {
    // Send one message to populate history
    await authedPage.sendAndWaitForReply("This is the old session message.");

    // Start a new chat
    await authedPage.startNewChat();
    await authedPage.waitForReady();

    // Old message should no longer be in the message list
    const messageList = authedPage.messageList;
    await expect(messageList).not.toContainText("This is the old session message.");
  });
});

test.describe("Chat — error resilience", () => {
  test("sending an empty message does not trigger an error banner", async ({
    authedPage,
  }) => {
    // Attempt to send empty — most UIs block this, no error should appear
    await authedPage.messageInput.focus();
    await authedPage.sendButton.click();
    await authedPage.expectNoBannerError();
  });
});

test.describe("Chat — long prompt handling", () => {
  test("agent handles a long message without timing out", async ({
    authedPage,
  }) => {
    const longPrompt =
      "Please count from 1 to 20 in your reply, each number on its own line. " +
      "After the numbers, write the word DONE on the last line. " +
      "Here is some padding to make the prompt longer: " +
      "a".repeat(800);

    const reply = await authedPage.sendAndWaitForReply(longPrompt, 60_000);
    expect(reply).toContain("DONE");
  });
});

// ── Live-only tests (gated behind OPENCLAW_LIVE_TEST=1) ───────────────────────

test.describe("Chat — live model round-trip @live", () => {
  test.skip(!LIVE, "Set OPENCLAW_LIVE_TEST=1 to run live model tests");

  test("real model responds with CANARY_OK", async ({ authedPage }) => {
    const reply = await authedPage.sendAndWaitForReply(
      "Reply with exactly: CANARY_OK",
      45_000
    );
    expect(reply).toContain("CANARY_OK");
  });
});
