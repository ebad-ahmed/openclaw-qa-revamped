/**
 * pages/ChatPage.ts
 * -----------------
 * Page-Object Model for the OpenClaw chat / agent interface.
 *
 * Key responsibilities:
 *  • Sending messages to the agent
 *  • Waiting for and reading agent responses
 *  • Observing tool/skill invocations in the UI
 *  • Checking session state (new chat, history, etc.)
 */

import { type Page, type Locator, expect } from "@playwright/test";

export class ChatPage {
  readonly page: Page;

  // ── Locators ──────────────────────────────────────────────────────────────
  readonly messageInput: Locator;
  readonly sendButton: Locator;
  readonly messageList: Locator;
  readonly lastAgentMessage: Locator;
  readonly typingIndicator: Locator;
  readonly newChatButton: Locator;
  readonly sessionTitle: Locator;
  readonly skillBadge: Locator;
  readonly toolCallBlock: Locator;
  readonly errorBanner: Locator;
  readonly userAvatar: Locator;
  readonly sidebarNav: Locator;

  constructor(page: Page) {
    this.page = page;

    this.messageInput = page
      .getByTestId("chat-input")
      .or(page.getByRole("textbox", { name: /message|chat/i }))
      .or(page.locator("textarea[placeholder*='message' i]"));

    this.sendButton = page
      .getByTestId("chat-send")
      .or(page.getByRole("button", { name: /send/i }));

    this.messageList = page
      .getByTestId("message-list")
      .or(page.locator("[data-role='message-list']"))
      .or(page.locator(".message-list, .chat-messages"));

    this.lastAgentMessage = page
      .getByTestId("agent-message")
      .last()
      .or(page.locator("[data-role='assistant-message']").last())
      .or(page.locator(".agent-message, .assistant-message").last());

    this.typingIndicator = page
      .getByTestId("typing-indicator")
      .or(page.locator("[aria-label*='typing' i]"))
      .or(page.locator(".typing-indicator"));

    this.newChatButton = page
      .getByTestId("new-chat")
      .or(page.getByRole("button", { name: /new chat|new conversation/i }));

    this.sessionTitle = page
      .getByTestId("session-title")
      .or(page.locator("h1, h2").filter({ hasText: /chat|conversation/i }));

    // Tool/skill invocation UI (shown inline in messages)
    this.skillBadge = page
      .getByTestId("skill-badge")
      .or(page.locator("[data-skill-name]"))
      .or(page.locator(".skill-badge, .tool-badge"));

    this.toolCallBlock = page
      .getByTestId("tool-call")
      .or(page.locator("[data-tool-call]"))
      .or(page.locator(".tool-call-block"));

    this.errorBanner = page
      .getByTestId("chat-error")
      .or(page.locator("[role='alert']"));

    this.userAvatar = page
      .getByTestId("user-avatar")
      .or(page.locator("[aria-label*='user' i]").first());

    this.sidebarNav = page
      .getByTestId("sidebar")
      .or(page.locator("nav[aria-label*='sidebar' i]"))
      .or(page.locator("aside"));
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  async goto() {
    await this.page.goto("/");
    await this.page.waitForLoadState("networkidle");
  }

  /** Waits until the chat interface is fully interactive. */
  async waitForReady() {
    await this.page.waitForLoadState("networkidle");
    await expect(this.messageInput).toBeVisible({ timeout: 20_000 });
  }

  async startNewChat() {
    await this.newChatButton.click();
    await this.page.waitForLoadState("networkidle");
  }

  // ── Messaging ─────────────────────────────────────────────────────────────

  async sendMessage(text: string) {
    await this.messageInput.fill(text);
    await this.sendButton.click();
  }

  /**
   * Sends a message and waits for the agent to finish responding.
   * Returns the final text content of the last agent message.
   */
  async sendAndWaitForReply(text: string, timeoutMs = 45_000): Promise<string> {
    await this.sendMessage(text);

    // 1. Wait for typing indicator to appear (agent started)
    await expect(this.typingIndicator)
      .toBeVisible({ timeout: 10_000 })
      .catch(() => {
        /* some UIs don't show a typing indicator — OK to skip */
      });

    // 2. Wait for typing indicator to disappear (agent finished)
    await expect(this.typingIndicator).toBeHidden({ timeout: timeoutMs });

    // 3. Return the last agent message text
    return (await this.lastAgentMessage.textContent()) ?? "";
  }

  // ── Assertions ────────────────────────────────────────────────────────────

  async expectLoggedIn() {
    // Either the avatar is visible, or we're not on the login page
    await expect(this.page).not.toHaveURL(/\/login/, { timeout: 5_000 });
    await expect(this.messageInput).toBeVisible();
  }

  async expectReply(matcher: string | RegExp) {
    await expect(this.lastAgentMessage).toContainText(matcher, {
      timeout: 30_000,
    });
  }

  async expectSkillUsed(skillName: string) {
    // Looks for a badge/block in the UI showing the skill was invoked
    const badge = this.page
      .getByTestId("skill-badge")
      .or(
        this.page.locator(`[data-skill-name='${skillName}']`)
      )
      .or(
        this.page.locator(".skill-badge, .tool-badge").filter({
          hasText: new RegExp(skillName, "i"),
        })
      );
    await expect(badge).toBeVisible({ timeout: 20_000 });
  }

  async expectNoSkillUsed() {
    await expect(this.toolCallBlock).toBeHidden({ timeout: 5_000 });
  }

  async expectNoBannerError() {
    await expect(this.errorBanner).toBeHidden();
  }

  async expectSessionHistoryContains(text: string) {
    await expect(this.messageList).toContainText(text);
  }

  /** Read the full text of ALL visible agent messages in order. */
  async getAllAgentMessages(): Promise<string[]> {
    const messages = this.page
      .locator("[data-role='assistant-message'], .agent-message");
    const count = await messages.count();
    const texts: string[] = [];
    for (let i = 0; i < count; i++) {
      texts.push((await messages.nth(i).textContent()) ?? "");
    }
    return texts;
  }
}
