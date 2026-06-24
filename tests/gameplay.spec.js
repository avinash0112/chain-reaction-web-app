/**
 * 2-player gameplay tests: turn management, cell capacity, explosion mechanics,
 * orb capture, winner declaration, and play-again.
 *
 * Grid reference (6×6):
 *   Corners  (capacity 2): (0,0), (0,5), (5,0), (5,5)
 *   Edges    (capacity 3): any non-corner border cell, e.g. (0,1), (0,2) …
 *   Interior (capacity 4): e.g. (1,1), (2,2), (3,3) …
 */
import { test, expect } from "@playwright/test";
import {
  createGame,
  joinGame,
  clickCell,
  getCellOrbText,
  cellOwnedBy,
  waitForMyTurn,
  playUntilWinner,
  isWinnerVisible,
} from "./helpers.js";

// ---------------------------------------------------------------------------
// Helpers shared across tests in this file
// ---------------------------------------------------------------------------

async function setup2Player(browser, name0 = "Alice", name1 = "Bob") {
  const [ctx0, ctx1] = await Promise.all([browser.newContext(), browser.newContext()]);
  const [p0, p1] = await Promise.all([ctx0.newPage(), ctx1.newPage()]);
  const { inviteUrl } = await createGame(p0, name0);
  await joinGame(p1, inviteUrl, name1);
  return { ctx0, ctx1, p0, p1 };
}

// ---------------------------------------------------------------------------
// Turn management
// ---------------------------------------------------------------------------

test("P0 goes first — cells are disabled for P1 on P0's turn", async ({ browser }) => {
  const { ctx0, ctx1, p0, p1 } = await setup2Player(browser);

  await waitForMyTurn(p0);
  // P1 cannot click any cell (all are disabled from P1's perspective)
  const anyCell = p1.locator(".grid-cell").first();
  await expect(anyCell).toHaveClass(/disabled/);

  await Promise.all([ctx0.close(), ctx1.close()]);
});

test("placing an orb updates both players' boards", async ({ browser }) => {
  const { ctx0, ctx1, p0, p1 } = await setup2Player(browser);

  await waitForMyTurn(p0);
  await clickCell(p0, 2, 2);

  await expect(p0.locator('[data-testid="cell-2-2"] .orb')).toBeVisible();
  await expect(p1.locator('[data-testid="cell-2-2"] .orb')).toBeVisible({ timeout: 5000 });

  await Promise.all([ctx0.close(), ctx1.close()]);
});

test("turn alternates P0 → P1 → P0 over three full turns", async ({ browser }) => {
  const { ctx0, ctx1, p0, p1 } = await setup2Player(browser);

  await waitForMyTurn(p0);
  await clickCell(p0, 0, 0);   // P0's first move

  await waitForMyTurn(p1);
  await clickCell(p1, 5, 5);   // P1's first move

  await waitForMyTurn(p0);     // P0 gets another turn — confirms rotation
  await clickCell(p0, 0, 5);

  await waitForMyTurn(p1);     // P1 gets another turn

  await Promise.all([ctx0.close(), ctx1.close()]);
});

test("player cannot click an opponent's cell", async ({ browser }) => {
  const { ctx0, ctx1, p0, p1 } = await setup2Player(browser);

  await waitForMyTurn(p0);
  await clickCell(p0, 3, 3);   // P0 claims (3,3)

  await waitForMyTurn(p1);
  // (3,3) is P0's — from P1's view it is disabled
  await expect(p1.locator('[data-testid="cell-3-3"]')).toHaveClass(/disabled/);

  await Promise.all([ctx0.close(), ctx1.close()]);
});

// ---------------------------------------------------------------------------
// Cell capacity
// ---------------------------------------------------------------------------

test("corner cell (0,0) has capacity 2 — explodes on 2nd orb", async ({ browser }) => {
  const { ctx0, ctx1, p0, p1 } = await setup2Player(browser);

  // P0 places 1 orb in corner
  await waitForMyTurn(p0);
  await clickCell(p0, 0, 0);
  await expect(p0.locator('[data-testid="cell-0-0"] .orb')).toContainText("1");

  // P1 plays somewhere isolated
  await waitForMyTurn(p1);
  await clickCell(p1, 5, 5);

  // P0 places 2nd orb in corner → count reaches capacity 2 → EXPLOSION
  await waitForMyTurn(p0);
  await clickCell(p0, 0, 0);

  // Corner should be empty after explosion
  await expect(p0.locator('[data-testid="cell-0-0"] .orb')).not.toBeVisible({ timeout: 5000 });
  // Both neighbours should have received an orb
  await expect(p0.locator('[data-testid="cell-0-1"] .orb')).toBeVisible();
  await expect(p0.locator('[data-testid="cell-1-0"] .orb')).toBeVisible();

  await Promise.all([ctx0.close(), ctx1.close()]);
});

test("edge cell (0,2) has capacity 3 — explodes on 3rd orb", async ({ browser }) => {
  const { ctx0, ctx1, p0, p1 } = await setup2Player(browser);

  // Build up (0,2) — an edge cell (3 neighbours: left, right, down)
  for (let i = 0; i < 3; i++) {
    await waitForMyTurn(p0);
    await clickCell(p0, 0, 2);
    if (i < 2) {
      await waitForMyTurn(p1);
      await clickCell(p1, 5, 5 - i); // P1 plays isolated cells
    }
  }

  // After 3rd placement: explosion — edge cell empties
  await expect(p0.locator('[data-testid="cell-0-2"] .orb')).not.toBeVisible({ timeout: 5000 });
  // At least one neighbour should have an orb
  const leftOrRight = await Promise.any([
    p0.locator('[data-testid="cell-0-1"] .orb').waitFor({ timeout: 3000 }),
    p0.locator('[data-testid="cell-0-3"] .orb').waitFor({ timeout: 3000 }),
  ]).then(() => true).catch(() => false);
  expect(leftOrRight).toBe(true);

  await Promise.all([ctx0.close(), ctx1.close()]);
});

test("interior cell (2,2) has capacity 4 — explodes on 4th orb", async ({ browser }) => {
  const { ctx0, ctx1, p0, p1 } = await setup2Player(browser);

  // Build up (2,2) — interior cell (4 neighbours)
  for (let i = 0; i < 4; i++) {
    await waitForMyTurn(p0);
    await clickCell(p0, 2, 2);
    if (i < 3) {
      await waitForMyTurn(p1);
      await clickCell(p1, 5, i); // P1 plays isolated bottom-row cells
    }
  }

  // After 4th placement: explosion — interior cell empties
  await expect(p0.locator('[data-testid="cell-2-2"] .orb')).not.toBeVisible({ timeout: 5000 });
  // All 4 neighbours should have orbs
  for (const [r, c] of [[1, 2], [3, 2], [2, 1], [2, 3]]) {
    await expect(p0.locator(`[data-testid="cell-${r}-${c}"] .orb`)).toBeVisible();
  }

  await Promise.all([ctx0.close(), ctx1.close()]);
});

// ---------------------------------------------------------------------------
// Explosion and capture mechanics
// ---------------------------------------------------------------------------

test("exploding cell distributes exactly one orb to each neighbour", async ({ browser }) => {
  const { ctx0, ctx1, p0, p1 } = await setup2Player(browser);

  // Load corner (0,0) to 2 → explosion sends 1 orb to (0,1) and (1,0)
  await waitForMyTurn(p0);
  await clickCell(p0, 0, 0);
  await waitForMyTurn(p1);
  await clickCell(p1, 5, 5);
  await waitForMyTurn(p0);
  await clickCell(p0, 0, 0); // explosion

  await expect(p0.locator('[data-testid="cell-0-1"] .orb')).toContainText("1", { timeout: 5000 });
  await expect(p0.locator('[data-testid="cell-1-0"] .orb')).toContainText("1");

  await Promise.all([ctx0.close(), ctx1.close()]);
});

test("explosion captures an opponent's adjacent cell", async ({ browser }) => {
  const { ctx0, ctx1, p0, p1 } = await setup2Player(browser);

  // P0 loads corner (0,0) to 1
  await waitForMyTurn(p0);
  await clickCell(p0, 0, 0);

  // P1 places at (0,1) — the right neighbour of P0's corner
  await waitForMyTurn(p1);
  await clickCell(p1, 0, 1);

  // P0 loads corner to 2 → explosion → P1's cell at (0,1) is captured by P0
  await waitForMyTurn(p0);
  await clickCell(p0, 0, 0);

  // (0,1) should now be owned by P0
  await expect(p0.locator('[data-testid="cell-0-1"] .orb')).toBeVisible({ timeout: 5000 });
  expect(await cellOwnedBy(p0, 0, 1, "P0")).toBe(true);

  await Promise.all([ctx0.close(), ctx1.close()]);
});

test("chain reaction — corner explosion triggers edge explosion", async ({ browser }) => {
  const { ctx0, ctx1, p0, p1 } = await setup2Player(browser);

  // Pre-load edge (0,1) to 2 (one away from its capacity of 3)
  // P0: (0,0)   P1: somewhere   P0: (0,1)   P1: somewhere   P0: (0,1)
  await waitForMyTurn(p0);
  await clickCell(p0, 0, 0);
  await waitForMyTurn(p1);
  await clickCell(p1, 5, 5);
  await waitForMyTurn(p0);
  await clickCell(p0, 0, 1); // edge (0,1) count=1
  await waitForMyTurn(p1);
  await clickCell(p1, 4, 5);
  await waitForMyTurn(p0);
  await clickCell(p0, 0, 1); // edge (0,1) count=2

  // Now load corner to 2 → explosion → (0,1) receives 1 → count=3 → chain explosion
  await waitForMyTurn(p1);
  await clickCell(p1, 3, 5);
  await waitForMyTurn(p0);
  await clickCell(p0, 0, 0); // corner (0,0) explodes → (0,1) hits capacity 3 → also explodes

  // Both (0,0) and (0,1) should be empty after the chain
  await expect(p0.locator('[data-testid="cell-0-0"] .orb')).not.toBeVisible({ timeout: 5000 });
  await expect(p0.locator('[data-testid="cell-0-1"] .orb')).not.toBeVisible({ timeout: 5000 });

  await Promise.all([ctx0.close(), ctx1.close()]);
});

// ---------------------------------------------------------------------------
// Winner declaration
// ---------------------------------------------------------------------------

test("winner banner shown when a player captures all orbs", async ({ browser }) => {
  const { ctx0, ctx1, p0, p1 } = await setup2Player(browser);

  await playUntilWinner([p0, p1]);

  const p0Won = await isWinnerVisible(p0);
  const p1Won = await isWinnerVisible(p1);
  expect(p0Won || p1Won).toBe(true);

  await Promise.all([ctx0.close(), ctx1.close()]);
});

test("grid is hidden after a winner is declared", async ({ browser }) => {
  const { ctx0, ctx1, p0, p1 } = await setup2Player(browser);

  await playUntilWinner([p0, p1]);

  // Both pages should have no visible grid once game over
  for (const page of [p0, p1]) {
    await expect(page.locator(".grid-container")).not.toBeVisible({ timeout: 8000 });
  }

  await Promise.all([ctx0.close(), ctx1.close()]);
});

test("winner name is displayed in the announcement", async ({ browser }) => {
  const { ctx0, ctx1, p0, p1 } = await setup2Player(browser, "Alice", "Bob");

  await playUntilWinner([p0, p1]);

  // The winner's name (Alice or Bob) appears in the h3 element
  const winnerText = await (
    await p0.locator("h3").filter({ hasText: /wins!/ }).textContent().catch(() => null) ??
    p1.locator("h3").filter({ hasText: /wins!/ }).textContent()
  );
  expect(winnerText).toMatch(/Alice|Bob/);

  await Promise.all([ctx0.close(), ctx1.close()]);
});

test("play again resets the board", async ({ browser }) => {
  const { ctx0, ctx1, p0, p1 } = await setup2Player(browser);

  await playUntilWinner([p0, p1]);

  // Click Play again on whichever page shows the button
  for (const page of [p0, p1]) {
    const btn = page.locator("button:has-text('Play again')");
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      break;
    }
  }

  // Grid reappears and winner banner is gone
  await expect(p0.locator(".grid-container")).toBeVisible({ timeout: 6000 });
  await expect(p0.locator("h3").filter({ hasText: /wins!/ })).not.toBeVisible();

  await Promise.all([ctx0.close(), ctx1.close()]);
});
