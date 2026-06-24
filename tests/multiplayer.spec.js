/**
 * Tests for 3-player and 4-player game scenarios, including turn rotation,
 * spectator mode, and player-leaving behaviour.
 */
import { test, expect } from "@playwright/test";
import { createGame, joinGame, waitForMyTurn, clickCell } from "./helpers.js";

// ---------------------------------------------------------------------------
// 3-player game
// ---------------------------------------------------------------------------

test("3 players — all see each other in the player list", async ({ browser }) => {
  const ctxs = await Promise.all([0, 1, 2].map(() => browser.newContext()));
  const pages = await Promise.all(ctxs.map((c) => c.newPage()));

  const { inviteUrl } = await createGame(pages[0], "Alice");
  await joinGame(pages[1], inviteUrl, "Bob");
  await joinGame(pages[2], inviteUrl, "Carol");

  for (const page of pages) {
    await expect(page.locator(".players-list")).toContainText("Alice");
    await expect(page.locator(".players-list")).toContainText("Bob");
    await expect(page.locator(".players-list")).toContainText("Carol");
  }

  await Promise.all(ctxs.map((c) => c.close()));
});

test("3 players — turn rotates P0 → P1 → P2 → P0", async ({ browser }) => {
  const ctxs = await Promise.all([0, 1, 2].map(() => browser.newContext()));
  const pages = await Promise.all(ctxs.map((c) => c.newPage()));

  const { inviteUrl } = await createGame(pages[0], "Alice");
  await joinGame(pages[1], inviteUrl, "Bob");
  await joinGame(pages[2], inviteUrl, "Carol");

  // One full rotation: P0 → P1 → P2 → back to P0
  await waitForMyTurn(pages[0]);
  await clickCell(pages[0], 0, 0);

  await waitForMyTurn(pages[1]);
  await clickCell(pages[1], 5, 5);

  await waitForMyTurn(pages[2]);
  await clickCell(pages[2], 0, 5);

  // P0 gets the turn again after the full rotation
  await waitForMyTurn(pages[0]);

  await Promise.all(ctxs.map((c) => c.close()));
});

test("3 players — PLAYING badge moves to the active player", async ({ browser }) => {
  const ctxs = await Promise.all([0, 1, 2].map(() => browser.newContext()));
  const pages = await Promise.all(ctxs.map((c) => c.newPage()));
  const names = ["Alice", "Bob", "Carol"];

  const { inviteUrl } = await createGame(pages[0], names[0]);
  await joinGame(pages[1], inviteUrl, names[1]);
  await joinGame(pages[2], inviteUrl, names[2]);

  // On P0's turn, Alice's card shows PLAYING
  await waitForMyTurn(pages[0]);
  await expect(
    pages[0].locator(".player-item", { hasText: "Alice" }).locator(".playing-badge")
  ).toBeVisible();

  // Make P0's move — then on P1's turn, Bob's card shows PLAYING
  await clickCell(pages[0], 0, 0);
  await waitForMyTurn(pages[1]);
  await expect(
    pages[1].locator(".player-item", { hasText: "Bob" }).locator(".playing-badge")
  ).toBeVisible();

  await Promise.all(ctxs.map((c) => c.close()));
});

test("3 players — grid updates on all screens after a move", async ({ browser }) => {
  const ctxs = await Promise.all([0, 1, 2].map(() => browser.newContext()));
  const pages = await Promise.all(ctxs.map((c) => c.newPage()));

  const { inviteUrl } = await createGame(pages[0], "Alice");
  await joinGame(pages[1], inviteUrl, "Bob");
  await joinGame(pages[2], inviteUrl, "Carol");

  await waitForMyTurn(pages[0]);
  await clickCell(pages[0], 1, 1);

  // All three pages should see the orb at (1,1)
  for (const page of pages) {
    await expect(page.locator('[data-testid="cell-1-1"] .orb')).toBeVisible({ timeout: 5000 });
  }

  await Promise.all(ctxs.map((c) => c.close()));
});

// ---------------------------------------------------------------------------
// 4-player game
// ---------------------------------------------------------------------------

test("4 players — all can join and see each other", async ({ browser }) => {
  const ctxs = await Promise.all([0, 1, 2, 3].map(() => browser.newContext()));
  const pages = await Promise.all(ctxs.map((c) => c.newPage()));
  const names = ["Alice", "Bob", "Carol", "Dave"];

  const { inviteUrl } = await createGame(pages[0], names[0]);
  for (let i = 1; i < 4; i++) await joinGame(pages[i], inviteUrl, names[i]);

  for (const page of pages) {
    for (const name of names) {
      await expect(page.locator(".players-list")).toContainText(name);
    }
  }

  await Promise.all(ctxs.map((c) => c.close()));
});

test("4 players — turn rotates through all four players", async ({ browser }) => {
  const ctxs = await Promise.all([0, 1, 2, 3].map(() => browser.newContext()));
  const pages = await Promise.all(ctxs.map((c) => c.newPage()));

  const { inviteUrl } = await createGame(pages[0], "Alice");
  await joinGame(pages[1], inviteUrl, "Bob");
  await joinGame(pages[2], inviteUrl, "Carol");
  await joinGame(pages[3], inviteUrl, "Dave");

  // Each player takes one turn, in order
  const startCells = [[0, 0], [5, 5], [0, 5], [5, 0]];
  for (let i = 0; i < 4; i++) {
    await waitForMyTurn(pages[i]);
    await clickCell(pages[i], ...startCells[i]);
  }

  // After a full rotation, it's P0's turn again
  await waitForMyTurn(pages[0]);

  await Promise.all(ctxs.map((c) => c.close()));
});

test("5th connection joins as spectator — no YOU badge, no game controls", async ({ browser }) => {
  const ctxs = await Promise.all([0, 1, 2, 3, 4].map(() => browser.newContext()));
  const pages = await Promise.all(ctxs.map((c) => c.newPage()));

  const { inviteUrl } = await createGame(pages[0], "Alice");
  await joinGame(pages[1], inviteUrl, "Bob");
  await joinGame(pages[2], inviteUrl, "Carol");
  await joinGame(pages[3], inviteUrl, "Dave");

  // 5th player: joins as spectator
  await pages[4].goto(inviteUrl);
  await pages[4].fill("#player-name", "Eve");
  await pages[4].click("button:has-text('Join game')");
  await pages[4].locator(".session-bar").waitFor({ timeout: 6000 });

  // Spectator has no YOU badge and sees "Spectating" text
  await expect(pages[4].locator(".you-badge")).not.toBeVisible();
  await expect(pages[4].locator("text=Spectating")).toBeVisible();

  await Promise.all(ctxs.map((c) => c.close()));
});

// ---------------------------------------------------------------------------
// Player leaving mid-game
// ---------------------------------------------------------------------------

test("player leaving mid-game removes them from the list", async ({ browser }) => {
  const ctxs = await Promise.all([0, 1, 2].map(() => browser.newContext()));
  const pages = await Promise.all(ctxs.map((c) => c.newPage()));

  const { inviteUrl } = await createGame(pages[0], "Alice");
  await joinGame(pages[1], inviteUrl, "Bob");
  await joinGame(pages[2], inviteUrl, "Carol");

  // Carol leaves
  await pages[2].click("button:has-text('Leave')");

  // Alice and Bob should no longer see Carol
  for (const page of [pages[0], pages[1]]) {
    await expect(page.locator(".players-list")).not.toContainText("Carol", { timeout: 5000 });
  }

  await Promise.all(ctxs.map((c) => c.close()));
});

test("game pauses (timer stops) when fewer than 2 players remain", async ({ browser }) => {
  const ctxs = await Promise.all([0, 1].map(() => browser.newContext()));
  const pages = await Promise.all(ctxs.map((c) => c.newPage()));

  const { inviteUrl } = await createGame(pages[0], "Alice");
  await joinGame(pages[1], inviteUrl, "Bob");

  // Wait for game to start (turn timer visible)
  await expect(pages[0].locator(".turn-timer")).toBeVisible({ timeout: 5000 });

  // Bob leaves — Alice is now alone; timer should disappear
  await pages[1].click("button:has-text('Leave')");
  await expect(pages[0].locator(".turn-timer")).not.toBeVisible({ timeout: 5000 });
  await expect(pages[0].locator("text=waiting for another player")).toBeVisible();

  await Promise.all(ctxs.map((c) => c.close()));
});
