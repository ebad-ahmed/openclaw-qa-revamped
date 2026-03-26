# OpenClaw QA Automation

End-to-end Playwright test suite for OpenClaw deployments — built for PureSquare / Secure.com.

Covers authentication, chat round-trips, skill configuration & decisioning, gateway health, production canary probes, and security hardening checks — all mapped to the five-tier QA architecture documented in the OpenClaw QA Guide v2.

---

## Quick Start

```bash
# 1. Install dependencies
npm install
npx playwright install --with-deps chromium

# 2. Configure environment
cp .env.example .env
# Edit .env with your OpenClaw URL, gateway URL, and test credentials

# 3. Run smoke tests first (no real model required)
npm run test:smoke

# 4. Run the full suite
npm test
```

---

## Project Structure

```
openclaw-qa/
├── playwright.config.ts              # Central config — timeouts, reporters, browsers
├── .env.example                      # Environment variable template
├── tsconfig.json                     # TypeScript config
├── package.json
│
├── fixtures/
│   └── base.ts                       # Shared fixture hub — POM instances + authedPage
│
├── pages/                            # Page Object Models
│   ├── LoginPage.ts                  # Auth screen
│   ├── ChatPage.ts                   # Chat interface — send, reply, skill badges
│   ├── SkillsPage.ts                 # Skills settings — list, toggle, verify
│   └── SettingsPage.ts               # Model selection, API key management
│
├── tests/
│   ├── auth/login.spec.ts            # Authentication gate (8 tests)
│   ├── chat/chat.spec.ts             # Chat round-trips, nonce probe, multi-turn
│   ├── skills/skills.spec.ts         # Skills config, decisioning, security probes
│   ├── smoke/smoke.spec.ts           # Gateway health + UI smoke (Tier B)
│   └── canary/canary.spec.ts         # Production canary — 6 fast probes (Tier D)
│
├── utils/
│   └── helpers.ts                    # Gateway API calls, nonce utils, artifact capture
│
├── scripts/
│   └── canary-alert.js               # Reads JSON report → Slack/Discord webhook
│
└── .github/
    └── workflows/
        └── openclaw-qa.yml           # Full CI pipeline (GitHub Actions)
```

---

## Test Suites

### Auth (`tests/auth/login.spec.ts`)
- Unauthenticated users redirect to `/login`
- Valid credentials → chat UI accessible
- Invalid credentials → error shown, no redirect
- Empty form → validation feedback
- Session persists on page reload
- Logout clears session and redirects

### Smoke (`tests/smoke/smoke.spec.ts`)
Runs on every PR. No real AI model required.
- Gateway `/healthz` returns 200
- Login page loads with no JS console errors
- Authenticated chat page loads cleanly
- WebSocket connection opens

### Chat (`tests/chat/chat.spec.ts`)
- Basic round-trip: message → reply
- Nonce echo probe (mirrors OpenClaw live Read Probe)
- `SMOKE_OK` precision probe
- Multi-turn context retention
- New chat clears history
- Long prompt handling

### Skills (`tests/skills/skills.spec.ts`)
The most important suite — covers the gaps identified in the QA Guide.

**Configuration**
- Skills settings page is accessible
- Each skill in `SKILLS_TO_VERIFY` is installed and enabled

**Decisioning — positive cases**
- Browser/web-search skill fires for web research prompts
- Code skill fires for code execution prompts
- File skill fires for file read/write prompts

**Decisioning — negative cases**
- No skill fires for simple arithmetic, greetings, definitions, factual questions

**Compliance**
- Agent follows skill output format instructions (SKILL.md compliance)

**Security Probes**
- Prompt injection resistance — agent maintains system prompt
- Credential exposure — API keys are never surfaced
- Sandbox escape — host filesystem paths are inaccessible

### Canary (`tests/canary/canary.spec.ts`)
Six fast steps designed to run every 10 minutes in production:

| Step | Check |
|------|-------|
| CANARY-1 | Gateway `/healthz` reachable |
| CANARY-2 | Login page reachable |
| CANARY-3 | User can log in and reach chat |
| CANARY-4 | Agent replies `CANARY_OK` |
| CANARY-5 | No error banners after probe |
| CANARY-6 | Nonce round-trip integrity |

---

## Available Commands

```bash
npm test                          # Run all tests
npm run test:smoke                # Gateway health + UI smoke only
npm run test:auth                 # Authentication tests only
npm run test:chat                 # Chat round-trip tests only
npm run test:skills               # Skills config + decisioning + security
npm run test:canary               # Production canary probes
npm run test:ci                   # CI mode with GitHub reporter
npm run test:headed               # Run with visible browser (debugging)
npm run test:debug                # Playwright debug mode
npm run test:report               # Open HTML report
npm run codegen                   # Launch codegen to capture live selectors
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENCLAW_BASE_URL` | OpenClaw web UI URL | `http://localhost:18789` |
| `OPENCLAW_GATEWAY_URL` | Gateway API URL | `http://localhost:18789` |
| `TEST_AUTH_TOKEN` | Gateway auth token (single-token login) | — |
| `SKILLS_TO_VERIFY` | Comma-separated skill names to check | `browser,web-search` |
| `ALERT_WEBHOOK_URL` | Slack/Discord webhook for canary alerts | — |
| `OPENCLAW_LIVE_TEST` | Set to `1` to enable live model tests | — |
| `OPENCLAW_LIVE_MODEL` | Model string for live tests | `anthropic/claude-sonnet-4-6` |

---

## CI / CD

The included GitHub Actions workflow (`.github/workflows/openclaw-qa.yml`) runs:

- **Every push / PR** — smoke + auth + skills/chat tests
- **Main branch pushes** — + canary
- **Scheduled (every 10 min)** — canary only with webhook alerting

Add these secrets to your GitHub repository:

```
OPENCLAW_BASE_URL
OPENCLAW_GATEWAY_URL
TEST_AUTH_TOKEN
SKILLS_TO_VERIFY
ALERT_WEBHOOK_URL
```

---

## Canary Cron (production server)

```bash
# /etc/cron.d/openclaw-canary
*/10 * * * * cd /opt/openclaw-qa && \
  npx playwright test tests/canary --reporter=json | \
  node scripts/canary-alert.js >> /var/log/openclaw-canary.log 2>&1
```

Alert on 2+ consecutive failures to filter transient network noise.

---

## Updating Selectors

Selectors use `data-testid` first, then accessible roles, then CSS. When the UI changes, run codegen to recapture live selectors:

```bash
npm run codegen
```

Then update the relevant file in `pages/`.

---

## Adding a New Skill Test

1. Add the skill name to `SKILLS_TO_VERIFY` in `.env`
2. Add a positive decisioning test in `tests/skills/skills.spec.ts`
3. Add keyword hints to `SKILL_KEYWORDS` in `utils/helpers.ts`

---

## License

MIT — see [LICENSE](./LICENSE)
