# CLAUDE.md — OpenClaw QA Automation
## Instructions for Claude Code

This repository is the **Playwright end-to-end QA suite** for the OpenClaw deployment
at PureSquare (Secure.com).  Use this file whenever you modify, extend, or debug tests.

---

## Project Layout

```
openclaw-qa/
├── playwright.config.ts        # Central Playwright config — edit timeouts/reporters here
├── .env.example                # Copy to .env with real values before running
├── fixtures/
│   └── base.ts                 # POM instances + authedPage fixture — extend here
├── pages/
│   ├── LoginPage.ts            # Login POM — selectors for auth screen
│   ├── ChatPage.ts             # Chat POM — message input, send, reply reading
│   ├── SkillsPage.ts           # Skills settings POM — toggle/verify skills
│   └── SettingsPage.ts         # Settings POM — model selection, API keys
├── tests/
│   ├── auth/login.spec.ts      # Authentication gate tests
│   ├── chat/chat.spec.ts       # Chat round-trip + multi-turn tests
│   ├── skills/skills.spec.ts   # Skills configuration + decisioning + security
│   ├── smoke/smoke.spec.ts     # Gateway health + UI smoke (Tier B)
│   └── canary/canary.spec.ts   # Production canary probes (Tier D)
├── utils/helpers.ts            # Gateway API helpers, nonce utils, artifact capture
└── scripts/canary-alert.js     # Reads JSON report → sends Slack/Discord webhook
```

---

## How to Run

```bash
# Install
npm install
npx playwright install --with-deps chromium

# Copy env
cp .env.example .env
# Fill in TEST_USER_EMAIL, TEST_USER_PASSWORD, OPENCLAW_BASE_URL

# Run everything
npm test

# Run a single suite
npm run test:smoke
npm run test:auth
npm run test:chat
npm run test:skills
npm run test:canary

# Run headed (visible browser) for debugging
npm run test:headed

# Debug a specific test
npm run test:debug -- tests/chat/chat.spec.ts

# Open HTML report
npm run test:report
```

---

## Key Conventions

### Selectors — always in this priority order:
1. `data-testid` (stable, preferred)
2. Accessible role (`getByRole`) — resilient to CSS changes
3. CSS selector (last resort)

Never use XPath.  Never use text-content selectors for navigation (fragile).

### Fixtures
Always import `{ test, expect }` from `../../fixtures/base`, NOT from `@playwright/test`.
This gives you `authedPage`, `chatPage`, `skillsPage`, `settingsPage` for free.

### Timeouts
- Normal UI interactions: 15 s (set in `playwright.config.ts` as `actionTimeout`)
- AI reply wait: 30–45 s — use `sendAndWaitForReply(msg, 45_000)`
- Canary tests: 30 s max — fast by design

### Test file naming
| Suffix | Tier | What |
|--------|------|------|
| `.spec.ts` | B/C/D/E | All Playwright tests |
| Prefixed `CANARY-N:` | D | Canary steps — must stay fast |

### Environment gates
Gate expensive/live tests behind env vars:
```typescript
test.skip(!process.env.OPENCLAW_LIVE_TEST, "Set OPENCLAW_LIVE_TEST=1 to run");
```

---

## Adding a New Skill Test

1. Open `tests/skills/skills.spec.ts`
2. Add a positive decisioning test in the `"Skills — decisioning (agent picks the RIGHT skill)"` block:
```typescript
test("my-new-skill activates for its trigger prompt", async ({ authedPage }) => {
  const reply = await authedPage.sendAndWaitForReply("Trigger phrase for my skill...");
  await authedPage.expectSkillUsed("my-new-skill");
});
```
3. Add a keyword mapping in `utils/helpers.ts` under `SKILL_KEYWORDS` for the fallback heuristic.
4. Add the skill name to `SKILLS_TO_VERIFY` in `.env`.

---

## Adding a New POM

1. Create `pages/MyNewPage.ts` following the existing POM pattern.
2. Import and instantiate it in `fixtures/base.ts`.
3. Add it to the `OpenClawFixtures` type.

---

## Updating Selectors (when the UI changes)

Run codegen to capture live selectors:
```bash
npm run codegen
# Browser opens — interact with the UI — copy selectors from the sidebar
```
Then update the relevant POM file.

---

## Failure Triage

When a test fails in CI:
1. Download the HTML report artifact from GitHub Actions.
2. Check the screenshot + video in `reports/html/`.
3. Look for `[QA FAILURE ARTIFACT]` lines in the CI log — these are JSON blobs with full context.
4. If a live/canary test fails consistently, open `utils/helpers.ts` and check `captureFailureArtifact`.
5. If the failure is a real regression, promote it to `tests/smoke/smoke.spec.ts` as a deterministic test.

---

## Canary Scheduling (production)

```bash
# Add to crontab
*/10 * * * * cd /opt/openclaw-qa && \
  npx playwright test tests/canary --reporter=json | \
  node scripts/canary-alert.js >> /var/log/openclaw-canary.log 2>&1
```
Alert on 2+ consecutive failures to avoid noise from transient issues.

---

## Security Probe Maintenance

The security probes in `tests/skills/skills.spec.ts` under `"Security probes"` should be
reviewed monthly.  Common updates needed:
- Add new injection patterns as adversarial prompting techniques evolve.
- Tighten API key regex patterns when new providers are added.
- Add new sandbox escape vectors based on OpenClaw release notes.

---

## Common Pitfalls

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `authedPage` fixture fails | Wrong `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` in `.env` | Update `.env` |
| Skills tests all fail | Skills page URL is different | Update `goto()` in `SkillsPage.ts` |
| Typing indicator never appears | App uses a different loading UX | Update `waitForReady()` in `ChatPage.ts` |
| Canary times out | Model is slow / rate-limited | Increase timeout in `canary.spec.ts` |
| WebSocket test warns | App uses HTTP polling, not WS | Safe to ignore that soft assertion |
