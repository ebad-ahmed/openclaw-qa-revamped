/**
 * utils/helpers.ts
 * -----------------
 * Shared test utilities — API calls, nonce generation, artifact capture.
 */

import { type Page, expect } from "@playwright/test";

// ── Gateway Health API ───────────────────────────────────────────────────────

const GATEWAY_URL =
  process.env.OPENCLAW_GATEWAY_URL ?? "http://localhost:18789";

/**
 * Calls the /healthz endpoint directly (bypasses UI).
 * Returns true if the gateway is healthy.
 */
export async function checkGatewayHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${GATEWAY_URL}/healthz`, {
      signal: AbortSignal.timeout(5_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Calls /status and returns the raw JSON body.
 * Returns null if the gateway is unreachable.
 */
export async function getGatewayStatus(): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${GATEWAY_URL}/status`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ── Nonce / Canary Utilities ─────────────────────────────────────────────────

/** Generates a unique nonce string for round-trip probe tests.
 *  Uses hyphens (not underscores) to avoid markdown italic rendering in the chat UI. */
export function makeNonce(prefix = "QA"): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${ts}-${rand}`;
}

/** Parses a nonce out of agent response text, returns null if not found. */
export function extractNonce(text: string, nonce: string): boolean {
  return text.includes(nonce);
}

// ── Skill Assertion Helpers ──────────────────────────────────────────────────

// OpenClaw's agent uses specific phrasing when it invokes or references web search.
// "Already pulled this" indicates the agent is drawing on a recent web search result
// from session memory — still counts as web-search knowledge being exercised.
const SKILL_KEYWORDS: Record<string, RegExp[]> = {
  browser: [/searching the web/i, /I found|let me search/i, /browser/i, /already pulled/i, /as of today/i],
  "code-interpreter": [/executing code/i, /running|ran the code/i],
  "file-manager": [/reading file/i, /I opened|I wrote/i],
  "web-search": [
    /search results/i, /according to/i, /I found online/i,
    /already pulled/i, /as of today/i, /top stories/i,
    /CVE-\d{4}-\d+/i,            // live CVE IDs indicate real-time search output
  ],
};

/**
 * Checks whether the agent's reply text contains keywords consistent
 * with a specific skill being used.  This is a heuristic fallback when
 * the UI doesn't show a formal skill badge.
 */
export function replyIndicatesSkill(reply: string, skillName: string): boolean {
  const patterns = SKILL_KEYWORDS[skillName] ?? [];
  return patterns.some((re) => re.test(reply));
}

// ── Artifact Collection ──────────────────────────────────────────────────────

/**
 * Captures a structured failure artifact and logs it.
 * In CI, these are written to stdout so the runner can persist them.
 */
export function captureFailureArtifact(opts: {
  testName: string;
  prompt: string;
  reply: string;
  model?: string;
  probeType?: string;
  error?: string;
}) {
  const artifact = {
    timestamp: new Date().toISOString(),
    ...opts,
    env: {
      nodeVersion: process.version,
      openclawModel: process.env.OPENCLAW_LIVE_MODEL ?? "unknown",
    },
  };
  console.error("[QA FAILURE ARTIFACT]", JSON.stringify(artifact, null, 2));
}

// ── Wait Helpers ─────────────────────────────────────────────────────────────

/** Waits until the gateway /healthz returns 200 (up to `maxMs` ms). */
export async function waitForGateway(maxMs = 30_000): Promise<void> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    if (await checkGatewayHealth()) return;
    await new Promise((r) => setTimeout(r, 1_000));
  }
  throw new Error(`Gateway did not become healthy within ${maxMs}ms`);
}

// ── Page-level API intercept helpers ────────────────────────────────────────

/**
 * Intercepts the WebSocket or REST chat endpoint and captures all
 * tool-call payloads.  Call before sending a message, then read
 * `toolCalls` after the reply arrives.
 */
export async function captureToolCalls(page: Page): Promise<{
  toolCalls: Array<{ name: string; input: unknown }>;
}> {
  const toolCalls: Array<{ name: string; input: unknown }> = [];

  await page.route("**/api/agent/**", async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    try {
      const json = JSON.parse(body);
      if (json?.tool_calls) {
        toolCalls.push(...json.tool_calls);
      }
    } catch { /* not JSON — ignore */ }
    await route.fulfill({ response });
  });

  return { toolCalls };
}
