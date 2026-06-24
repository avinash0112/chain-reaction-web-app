/**
 * Shared helpers for Chain Reaction E2E tests.
 *
 * Naming convention for cells: row/col are 0-indexed from the top-left.
 * Corner cells: (0,0), (0,5), (5,0), (5,5) — capacity 2
 * Edge cells: any non-corner on the border — capacity 3
 * Interior cells: everything else — capacity 4
 */

/** Create a new game as the first player. Returns { sessionId, inviteUrl }. */
export async function createGame(page, playerName) {
  await page.goto("/");
  await page.fill("#player-name", playerName);
  await page.click("button:has-text('Create new game')");
  const shareInput = page.locator(".share-input");
  await shareInput.waitFor({ timeout: 6000 });
  const inviteUrl = await shareInput.inputValue();
  const sessionId = new URL(inviteUrl).searchParams.get("session");
  return { sessionId, inviteUrl };
}

/** Join an existing game via its full invite URL. */
export async function joinGame(page, inviteUrl, playerName) {
  await page.goto(inviteUrl);
  await page.fill("#player-name", playerName);
  await page.click("button:has-text('Join game')");
  await page.locator(".session-bar").waitFor({ timeout: 6000 });
}

/** Join via typing the game code on the home page. */
export async function joinByCode(page, sessionId, playerName) {
  await page.goto("/");
  await page.fill("#player-name", playerName);
  await page.locator("input[placeholder='Game code']").fill(sessionId);
  await page.click("button:has-text('Join')");
  await page.locator(".session-bar").waitFor({ timeout: 6000 });
}

/** Click the grid cell at (row, col). */
export async function clickCell(page, row, col) {
  await page.locator(`[data-testid="cell-${row}-${col}"]`).click();
}

/** Return the text content of the orb in cell (row, col), or null if empty. */
export async function getCellOrbText(page, row, col) {
  const orb = page.locator(`[data-testid="cell-${row}-${col}"] .orb`);
  if (!(await orb.isVisible().catch(() => false))) return null;
  return orb.textContent();
}

/** Return true if the orb in cell (row, col) belongs to the given player label (e.g. "P0"). */
export async function cellOwnedBy(page, row, col, playerLabel) {
  const orb = page.locator(`[data-testid="cell-${row}-${col}"] .orb.${playerLabel}`);
  return orb.isVisible().catch(() => false);
}

/** Wait until "Your turn!" appears on this page (i.e., it's this player's turn). */
export async function waitForMyTurn(page, timeout = 12000) {
  await page.locator("text=Your turn!").waitFor({ timeout });
}

/** Play alternating moves until one side wins, or maxMoves is exhausted.
 *  pages[0] = P0's page, pages[1] = P1's page, etc.
 *  Clicks the first non-disabled cell for the active player each turn. */
export async function playUntilWinner(pages, maxMoves = 200) {
  for (let move = 0; move < maxMoves; move++) {
    const page = pages[move % pages.length];

    // Wait for turn OR give up if game already ended
    const gotTurn = await page.locator("text=Your turn!")
      .waitFor({ timeout: 15000 })
      .then(() => true)
      .catch(() => false);

    if (!gotTurn) break;

    // Check for winner on any page before clicking
    for (const p of pages) {
      if (await isWinnerVisible(p)) return;
    }

    // Click first available non-disabled cell
    await page.locator(".grid-cell:not(.disabled)").first().click({ timeout: 3000 }).catch(() => {});

    // Brief propagation pause
    await page.waitForTimeout(100);

    // Check for winner after click
    for (const p of pages) {
      if (await isWinnerVisible(p)) return;
    }
  }
}

/** Return true if the winner announcement is visible on the page. */
export async function isWinnerVisible(page) {
  return page.locator("h3").filter({ hasText: /wins!/ }).isVisible().catch(() => false);
}
