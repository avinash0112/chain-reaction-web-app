import { motion } from "framer-motion";
import React, { useEffect, useState } from "react";

import "./Grid.css";

const ORB_COLORS: Record<string, string> = {
  P0: "red",
  P1: "blue",
  P2: "green",
  P3: "#ffd740",
};

const GRID_SIZE = 6;

function validDirs(r: number, c: number): string[] {
  const dirs: string[] = [];
  if (r > 0) dirs.push("up");
  if (r < GRID_SIZE - 1) dirs.push("down");
  if (c > 0) dirs.push("left");
  if (c < GRID_SIZE - 1) dirs.push("right");
  return dirs;
}

function neighborOf(r: number, c: number, dir: string): [number, number] {
  if (dir === "up") return [r - 1, c];
  if (dir === "down") return [r + 1, c];
  if (dir === "left") return [r, c - 1];
  return [r, c + 1];
}

interface Cell {
  count: number;
  player: string | null;
  capacity: number;
}

interface Props {
  grid: Cell[][] | null;
  myPlayer: string | null;
  isMyTurn: boolean;
  gameOver: boolean;
  handleCellClick: (row: number, col: number) => void;
  explodedAt?: [number, number, string] | null;
}

const ChainReactionGrid: React.FC<Props> = ({
  grid,
  myPlayer,
  isMyTurn,
  gameOver,
  handleCellClick,
  explodedAt,
}) => {
  const [burstKey, setBurstKey] = useState(0);

  useEffect(() => {
    if (explodedAt) {
      setBurstKey((k) => k + 1);
    }
  }, [explodedAt]);

  if (!grid) {
    return <div className="grid-loading">Waiting for game state…</div>;
  }

  const [burstR, burstC, burstPlayer] = explodedAt ?? [-1, -1, ""];
  const receivingCells = new Set<string>();
  if (explodedAt) {
    for (const dir of validDirs(burstR, burstC)) {
      const [nr, nc] = neighborOf(burstR, burstC, dir);
      receivingCells.add(`${nr}-${nc}`);
    }
  }

  return (
    <div className="grid-container">
      {grid.map((row, rowIndex) =>
        row.map((cell, colIndex) => {
          const isOpponentCell =
            cell.player !== null && cell.player !== myPlayer;
          const disabled = gameOver || !isMyTurn || isOpponentCell;
          const isBurst =
            explodedAt && rowIndex === burstR && colIndex === burstC;
          const isReceiving = receivingCells.has(`${rowIndex}-${colIndex}`);

          return (
            <motion.div
              key={`${rowIndex}-${colIndex}`}
              className={`grid-cell${disabled ? " disabled" : ""}`}
              onClick={() => !disabled && handleCellClick(rowIndex, colIndex)}
              whileTap={!disabled ? { scale: 0.9 } : undefined}
            >
              {cell.count > 0 && (
                <motion.div
                  key={`orb-${rowIndex}-${colIndex}-${cell.count}-${cell.player}`}
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
                    style={{ borderColor: ORB_COLORS[burstPlayer] ?? "#fff" }}
                  />
                  {validDirs(burstR, burstC).map((dir) => (
                    <div
                      key={dir}
                      className={`flying-orb flying-orb-${dir}`}
                      style={{ background: ORB_COLORS[burstPlayer] ?? "#fff" }}
                    />
                  ))}
                </div>
              )}

              {isReceiving && <div className="cell-receive-glow" />}
            </motion.div>
          );
        }),
      )}
    </div>
  );
};

export default ChainReactionGrid;
