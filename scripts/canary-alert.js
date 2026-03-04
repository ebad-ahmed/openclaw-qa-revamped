#!/usr/bin/env node
/**
 * scripts/canary-alert.js
 * ────────────────────────
 * Reads the Playwright JSON reporter output from stdin (or results.json),
 * checks for failures, and POSTs to ALERT_WEBHOOK_URL if any test failed.
 *
 * Usage (pipe from playwright):
 *   npx playwright test tests/canary --reporter=json | node scripts/canary-alert.js
 *
 * Or from file:
 *   node scripts/canary-alert.js reports/results.json
 *
 * Environment:
 *   ALERT_WEBHOOK_URL — Slack/Discord/Teams incoming webhook URL
 */

const fs = require("fs");
const https = require("https");
const http = require("http");

// ── Read input ────────────────────────────────────────────────────────────────

async function readInput() {
  const filePath = process.argv[2];
  if (filePath) {
    return fs.readFileSync(filePath, "utf8");
  }
  // Read from stdin
  return new Promise((resolve) => {
    let data = "";
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
  });
}

// ── Parse results ─────────────────────────────────────────────────────────────

function parseResults(raw) {
  try {
    const json = JSON.parse(raw);
    const suites = json.suites ?? [];
    const failed = [];

    function walk(items) {
      for (const item of items ?? []) {
        if (item.specs) {
          for (const spec of item.specs) {
            const hasFailure = spec.tests?.some((t) =>
              t.results?.some((r) => r.status === "failed" || r.status === "timedOut")
            );
            if (hasFailure) {
              failed.push({
                title: spec.title,
                file: spec.file,
              });
            }
          }
        }
        if (item.suites) walk(item.suites);
      }
    }

    walk(suites);
    return {
      total: json.stats?.expected ?? 0,
      failed,
      passed: json.stats?.expected - (json.stats?.unexpected ?? 0),
    };
  } catch (e) {
    console.error("[canary-alert] Failed to parse JSON:", e.message);
    return null;
  }
}

// ── Send webhook ──────────────────────────────────────────────────────────────

function sendWebhook(webhookUrl, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const url = new URL(webhookUrl);
    const mod = url.protocol === "https:" ? https : http;

    const req = mod.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        res.on("data", () => {});
        res.on("end", () => resolve(res.statusCode));
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  const raw = await readInput();
  if (!raw.trim()) {
    console.log("[canary-alert] No input received — nothing to process.");
    process.exit(0);
  }

  const results = parseResults(raw);
  if (!results) {
    process.exit(1);
  }

  const { failed } = results;

  if (failed.length === 0) {
    console.log(`[canary-alert] ✅ All canary tests passed (${results.passed}/${results.total})`);
    process.exit(0);
  }

  // Build alert message
  const failedList = failed.map((f) => `• *${f.title}* (${f.file})`).join("\n");
  const message = {
    text:
      `🚨 *OpenClaw Canary FAILED* — ${failed.length} test(s) failed at ${new Date().toISOString()}\n` +
      failedList +
      `\n\nTotal: ${results.passed}/${results.total} passed.`,
  };

  console.error("[canary-alert] ❌ Failures detected:");
  failed.forEach((f) => console.error(`  ✗ ${f.title}`));

  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      const status = await sendWebhook(webhookUrl, message);
      console.log(`[canary-alert] Webhook sent (HTTP ${status})`);
    } catch (e) {
      console.error("[canary-alert] Failed to send webhook:", e.message);
    }
  } else {
    console.warn("[canary-alert] ALERT_WEBHOOK_URL not set — skipping webhook.");
  }

  process.exit(1); // Non-zero exit so cron / CI marks it as failure
})();
