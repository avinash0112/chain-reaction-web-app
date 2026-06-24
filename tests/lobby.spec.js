import { test, expect } from "@playwright/test";
import { createGame, joinGame, joinByCode } from "./helpers.js";

// ---------------------------------------------------------------------------
// Session creation
// ---------------------------------------------------------------------------

test("create game — invite link appears and contains session id", async ({ page }) => {
  await page.goto("/");
  await page.fill("#player-name", "Alice");
  await page.click("button:has-text('Create new game')");

  const shareInput = page.locator(".share-input");
  await expect(shareInput).toBeVisible();
  const url = await shareInput.inputValue();
  expect(url).toMatch(/\?session=[a-z0-9]{6}/);
});

test("create game — requires a name", async ({ page }) => {
  await page.goto("/");
  await page.click("button:has-text('Create new game')");
  await expect(page.locator(".error-banner")).toContainText("enter your name");
});

test("create game — session id appears in page URL after creating", async ({ page }) => {
  await createGame(page, "Alice");
  expect(page.url()).toMatch(/\?session=/);
});

// ---------------------------------------------------------------------------
// Joining via invite link
// ---------------------------------------------------------------------------

test("join via invite link — second player sees session bar", async ({ browser }) => {
  const [ctx1, ctx2] = await Promise.all([browser.newContext(), browser.newContext()]);
  const [p1, p2] = await Promise.all([ctx1.newPage(), ctx2.newPage()]);

  const { inviteUrl } = await createGame(p1, "Alice");
  await joinGame(p2, inviteUrl, "Bob");

  await expect(p2.locator(".session-bar")).toBeVisible();
  await Promise.all([ctx1.close(), ctx2.close()]);
});

test("join via invite link — requires a name", async ({ browser }) => {
  const [ctx1, ctx2] = await Promise.all([browser.newContext(), browser.newContext()]);
  const [p1, p2] = await Promise.all([ctx1.newPage(), ctx2.newPage()]);

  const { inviteUrl } = await createGame(p1, "Alice");
  await p2.goto(inviteUrl);
  await p2.click("button:has-text('Join game')");
  await expect(p2.locator(".error-banner")).toContainText("enter your name");
  await Promise.all([ctx1.close(), ctx2.close()]);
});

// ---------------------------------------------------------------------------
// Joining via game code
// ---------------------------------------------------------------------------

test("join via game code — works from the home page", async ({ browser }) => {
  const [ctx1, ctx2] = await Promise.all([browser.newContext(), browser.newContext()]);
  const [p1, p2] = await Promise.all([ctx1.newPage(), ctx2.newPage()]);

  const { sessionId } = await createGame(p1, "Alice");
  await joinByCode(p2, sessionId, "Bob");

  await expect(p2.locator(".session-bar")).toContainText(sessionId);
  await Promise.all([ctx1.close(), ctx2.close()]);
});

test("join via game code — error on invalid code", async ({ page }) => {
  await page.goto("/");
  await page.fill("#player-name", "Alice");
  await page.locator("input[placeholder='Game code']").fill("XXXXXX");
  await page.click("button:has-text('Join')");
  await expect(page.locator(".error-banner")).toContainText("not found");
});

// ---------------------------------------------------------------------------
// Player list
// ---------------------------------------------------------------------------

test("player names appear in both players' lists after joining", async ({ browser }) => {
  const [ctx1, ctx2] = await Promise.all([browser.newContext(), browser.newContext()]);
  const [p1, p2] = await Promise.all([ctx1.newPage(), ctx2.newPage()]);

  const { inviteUrl } = await createGame(p1, "Alice");
  await joinGame(p2, inviteUrl, "Bob");

  for (const page of [p1, p2]) {
    await expect(page.locator(".players-list")).toContainText("Alice");
    await expect(page.locator(".players-list")).toContainText("Bob");
  }
  await Promise.all([ctx1.close(), ctx2.close()]);
});

test("YOU badge shown only on own player card", async ({ browser }) => {
  const [ctx1, ctx2] = await Promise.all([browser.newContext(), browser.newContext()]);
  const [p1, p2] = await Promise.all([ctx1.newPage(), ctx2.newPage()]);

  const { inviteUrl } = await createGame(p1, "Alice");
  await joinGame(p2, inviteUrl, "Bob");

  // Alice's page: YOU badge is next to Alice, not Bob
  await expect(p1.locator(".player-item", { hasText: "Alice" }).locator(".you-badge")).toBeVisible();
  await expect(p1.locator(".player-item", { hasText: "Bob" }).locator(".you-badge")).not.toBeVisible();

  // Bob's page: YOU badge is next to Bob, not Alice
  await expect(p2.locator(".player-item", { hasText: "Bob" }).locator(".you-badge")).toBeVisible();
  await expect(p2.locator(".player-item", { hasText: "Alice" }).locator(".you-badge")).not.toBeVisible();

  await Promise.all([ctx1.close(), ctx2.close()]);
});

// ---------------------------------------------------------------------------
// Leaving a session
// ---------------------------------------------------------------------------

test("leave session — returns to lobby", async ({ page }) => {
  await createGame(page, "Alice");
  await page.click("button:has-text('Leave')");
  await expect(page.locator(".lobby")).toBeVisible();
});

test("leave session — second player sees updated player list", async ({ browser }) => {
  const [ctx1, ctx2] = await Promise.all([browser.newContext(), browser.newContext()]);
  const [p1, p2] = await Promise.all([ctx1.newPage(), ctx2.newPage()]);

  const { inviteUrl } = await createGame(p1, "Alice");
  await joinGame(p2, inviteUrl, "Bob");

  // Alice leaves
  await p1.click("button:has-text('Leave')");

  // Bob's list should no longer contain Alice
  await expect(p2.locator(".players-list")).not.toContainText("Alice", { timeout: 5000 });
  await Promise.all([ctx1.close(), ctx2.close()]);
});

// ---------------------------------------------------------------------------
// Waiting for players
// ---------------------------------------------------------------------------

test("waiting message shown when only one player is in the session", async ({ page }) => {
  await createGame(page, "Alice");
  await expect(page.locator("text=waiting for another player")).toBeVisible();
});

test("turn timer starts when second player joins", async ({ browser }) => {
  const [ctx1, ctx2] = await Promise.all([browser.newContext(), browser.newContext()]);
  const [p1, p2] = await Promise.all([ctx1.newPage(), ctx2.newPage()]);

  const { inviteUrl } = await createGame(p1, "Alice");
  await joinGame(p2, inviteUrl, "Bob");

  await expect(p1.locator(".turn-timer")).toBeVisible({ timeout: 5000 });
  await Promise.all([ctx1.close(), ctx2.close()]);
});
