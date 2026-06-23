import { motion } from "framer-motion";
import { useEffect, useState } from "react";

import "./Grid.css";

const ORB_COLORS = {
  P0: "red",
  P1: "blue",
  P2: "green",
  P3: "#ffd740",
};

const GRID_SIZE = 6;

function validDirs(r, c) {
  const dirs = [];
  if (r > 0) dirs.push("up");
  if (r < GRID_SIZE - 1) dirs.push("down");
  if (c > 0) dirs.push("left");
  if (c < GRID_SIZE - 1) dirs.push("right");
  return dirs;
}

function neighborOf(r, c, dir) {
  if (dir === "up") return [r - 1, c];
  if (dir === "down") return [r + 1, c];
  if (dir === "left") return [r, c - 1];
  return [r, c + 1];
}

const ChainReactionGrid = ({
  grid,
  myPlayer,
  isMyTurn,
  gameOver,
  handleCellClick,
  // Every cell that exploded in the current wave: [row, col, owner].
  // The server fires a whole wave at once, so this is a list, not one cell.
  explodedAt,
}) => {
  const [burstKey, setBurstKey] = useState(0);

  useEffect(() => {
    if (explodedAt && explodedAt.length > 0) {
      setBurstKey((k) => k + 1);
    }
  }, [explodedAt]);

  if (!grid) {
    return <div className="grid-loading">Waiting for game state…</div>;
  }

  // Map every exploding cell to its owner, and collect the cells receiving
  // orbs this wave — so the whole wave animates simultaneously.
  const burstingCells = new Map();
  const receivingCells = new Set();
  if (explodedAt) {
    for (const [r, c, owner] of explodedAt) {
      burstingCells.set(`${r}-${c}`, owner);
      for (const dir of validDirs(r, c)) {
        const [nr, nc] = neighborOf(r, c, dir);
        receivingCells.add(`${nr}-${nc}`);
      }
    }
  }

  return (
    <div className="grid-container">
      {grid.map((row, rowIndex) =>
        row.map((cell, colIndex) => {
          const isOpponentCell =
            cell.player !== null && cell.player !== myPlayer;
          const disabled = gameOver || !isMyTurn || isOpponentCell;
          const cellKey = `${rowIndex}-${colIndex}`;
          const burstOwner = burstingCells.get(cellKey);
          const isBurst = burstOwner !== undefined;
          // Don't double-decorate a cell that is itself bursting.
          const isReceiving = !isBurst && receivingCells.has(cellKey);

          return (
            <motion.div
              key={cellKey}
              className={`grid-cell${disabled ? " disabled" : ""}`}
              onClick={() => !disabled && handleCellClick(rowIndex, colIndex)}
              whileTap={!disabled ? { scale: 0.9 } : undefined}
            >
              {cell.count > 0 && (
                <motion.div
                  key={`orb-${cellKey}-${cell.count}-${cell.player}`}
                  className={`orb ${cell.player}`}
                  initial={{ scale: 0.5, opacity: 0.6 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  {cell.count}
                </motion.div>
              )}

              {isBurst && (
                <div key={`burst-${burstKey}`} className="cell-burst">
                  <div
                    className="burst-ring"
                    style={{ borderColor: ORB_COLORS[burstOwner] ?? "#fff" }}
                  />
                  {validDirs(rowIndex, colIndex).map((dir) => (
                    <div
                      key={dir}
                      className={`flying-orb flying-orb-${dir}`}
                      style={{ background: ORB_COLORS[burstOwner] ?? "#fff" }}
                    />
                  ))}
                </div>
              )}

              {isReceiving && (
                <div key={`recv-${burstKey}`} className="cell-receive-glow" />
              )}
            </motion.div>
          );
        }),
      )}
    </div>
  );
};

export default ChainReactionGrid;
