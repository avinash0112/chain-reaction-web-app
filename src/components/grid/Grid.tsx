import { motion } from "framer-motion";
import React from "react";

import "./Grid.css";

const ChainReactionGrid = ({
  grid,
  myPlayer,
  isMyTurn,
  gameOver,
  handleCellClick,
}) => {
  if (!grid) {
    return <div className="grid-loading">Waiting for game state…</div>;
  }

  return (
    <div className="grid-container">
      {grid.map((row, rowIndex) =>
        row.map((cell, colIndex) => {
          const isOpponentCell =
            cell.player !== null && cell.player !== myPlayer;
          const disabled = gameOver || !isMyTurn || isOpponentCell;

          return (
            <motion.div
              key={`${rowIndex}-${colIndex}`}
              className={`grid-cell${disabled ? " disabled" : ""}`}
              onClick={() => !disabled && handleCellClick(rowIndex, colIndex)}
              whileTap={!disabled ? { scale: 0.9 } : undefined}
            >
              {cell.count > 0 && (
                <motion.div
                  className={`orb ${cell.player}`}
                  animate={{ scale: 1.2 }}
                >
                  {cell.count}
                </motion.div>
              )}
            </motion.div>
          );
        })
      )}
    </div>
  );
};

export default ChainReactionGrid;
