import { type Page, type Locator, expect } from "@playwright/test";

export class ChatPage {
  readonly page: Page;

  readonly messageInput: Locator;
  readonly sendButton: Locator;
  readonly messageList: Locator;
  readonly lastAgentMessage: Locator;
  readonly newChatButton: Locator;
  readonly sidebarNav: Locator;
  readonly errorBanner: Locator;
  readonly toolCallBlock: Locator;
  readonly typingIndicator: Locator;

  constructor(page: Page) {
    this.page = page;

    // OpenClaw: textarea inside .agent-chat__input
    this.messageInput = page.locator('.agent-chat__input textarea');
    // OpenClaw: .chat-send-btn with aria-label="Send message"
    this.sendButton = page.locator('button[aria-label="Send message"]');
    // OpenClaw: .chat-thread is the scrollable message log
    this.messageList = page.locator('.chat-thread');
    // OpenClaw: assistant message text is in .chat-text inside .chat-group.assistant
    this.lastAgentMessage = page.locator('.chat-group.assistant .chat-text').last();

    this.newChatButton = page.locator('button[title="New session"]');
    // OpenClaw: nav.sidebar-nav is the left navigation sidebar
    this.sidebarNav = page.locator('nav.sidebar-nav');
    this.errorBanner = page.locator('[role="alert"]:not(.update-banner)');
    // OpenClaw: tool calls are wrapped in .chat-tools-collapse <details> elements
    this.toolCallBlock = page.locator('.chat-tools-collapse');
    // OpenClaw streaming indicator: .chat-bubble.streaming is present while generating
    this.typingIndicator = page.locator('.chat-bubble.streaming');
  }

  async goto() {
    await this.page.goto("/login/chat");
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Wait for the chat to be ready AND idle (no in-progress streaming or thinking).
   * Called by the authedPage fixture and by startNewChat().
   *
   * OpenClaw shows three states while the agent is working:
   *   1. .chat-reading-indicator  — "thinking" dots, before token stream starts
   *   2. .chat-bubble.streaming   — token stream in progress
   *   3. (neither)                — response complete
   */
  async waitForReady(timeout = 120_000) {
    await this.page.waitForLoadState("networkidle");
    await expect(this.messageInput).toBeVisible({ timeout: 20_000 });
    await this.page.waitForFunction(
      () =>
        !document.querySelector('.chat-bubble.streaming') &&
        !document.querySelector('.chat-reading-indicator'),
      null,
      { timeout }
    );
  }

  /**
   * Sends a message and waits for the agent to fully respond.
   *
   * OpenClaw response lifecycle in the DOM:
   *   1. A new .chat-group.assistant appears containing .chat-reading-indicator
   *      (three animated dots, no .streaming class yet)
   *   2. .chat-bubble.streaming appears — tokens are streaming in
   *   3. .streaming class is removed and .chat-text holds the final text
   *
   * We wait for state 3: new assistant group present + no streaming + no
   * reading indicator + .chat-text exists.
   */
  async sendAndWaitForReply(text: string, timeout = 90_000): Promise<string> {
    // Ensure the chat is fully idle before sending
    await this.page.waitForFunction(
      () =>
        !document.querySelector('.chat-bubble.streaming') &&
        !document.querySelector('.chat-reading-indicator'),
      null,
      { timeout: 60_000 }
    );

    const countBefore = await this.page.locator('.chat-group.assistant').count();

    await this.messageInput.fill(text);
    await this.page.keyboard.press('Enter');

    // Wait for a new assistant group to appear (may start as reading indicator)
    await this.page.waitForFunction(
      (c: number) => document.querySelectorAll('.chat-group.assistant').length > c,
      countBefore,
      { timeout }
    );

    // Wait until the last assistant group has completed:
    // - no reading indicator (pre-stream "thinking" dots)
    // - no streaming bubble
    // - has at least one .chat-text element (actual response text)
    await this.page.waitForFunction(
      (c: number) => {
        const groups = document.querySelectorAll('.chat-group.assistant');
        if (groups.length <= c) return false;
        const last = groups[groups.length - 1];
        const hasStreaming = !!last.querySelector('.chat-bubble.streaming');
        const hasIndicator = !!last.querySelector('.chat-reading-indicator');
        const hasText = !!last.querySelector('.chat-text');
        return !hasStreaming && !hasIndicator && hasText;
      },
      countBefore,
      { timeout }
    );

    // Read the final response text from the last assistant group
    return await this.page.locator('.chat-group.assistant').last()
      .locator('.chat-text').last().innerText().catch(() => '');
  }

  async startNewChat() {
    await this.newChatButton.click();
    // Wait for idle: new session triggers a startup sequence that streams
    await this.waitForReady();
  }

  async expectLoggedIn() {
    await expect(this.page).not.toHaveURL(/\/login$/, { timeout: 5_000 });
    await expect(this.page).not.toHaveURL(/\/login\?/, { timeout: 5_000 });
    await expect(this.messageInput).toBeVisible();
  }

  async expectReply(matcher: string | RegExp) {
    await expect(
      this.page.locator('.chat-group.assistant').last().locator('.chat-text').last()
    ).toContainText(matcher, { timeout: 90_000 });
  }

  /**
   * Checks that a tool call block mentioning the skill name appeared.
   * OpenClaw shows tool names in .chat-tools-summary__names inside .chat-tools-collapse.
   */
  async expectSkillUsed(skillName: string) {
    await expect(
      this.page.locator('.chat-tools-summary__names').last()
    ).toContainText(skillName, { ignoreCase: true, timeout: 5_000 });
  }

  async expectNoSkillUsed() {
    // Callers should compare tool block counts directly for this check
    const count = await this.toolCallBlock.count();
    expect(count, 'Expected no tool call blocks').toBe(0);
  }

  /**
   * Asserts no visible [role="alert"] banners (ignoring the update banner).
   */
  async expectNoBannerError() {
    const count = await this.errorBanner.count();
    if (count > 0) {
      await expect(this.errorBanner).not.toBeVisible();
    }
  }

  async expectSessionHistoryContains(text: string) {
    await expect(this.messageList).toContainText(text, { timeout: 5_000 });
  }

  async getAllAgentMessages(): Promise<string[]> {
    const locators = await this.page.locator('.chat-group.assistant .chat-text').all();
    return Promise.all(locators.map((l) => l.innerText().catch(() => '')));
  }

  async clearChat() {
    await this.goto();
  }
}
