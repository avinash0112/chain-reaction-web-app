import React, { useState } from "react";
import { motion } from "framer-motion";
import "./Grid.css"

const ChainReactionGrid = ({ sGrid,handleCellClick }) => {
  return (
    <div className="grid-container">
      {sGrid?.map((row, rowIndex) =>
        row.map((cell, colIndex) => (
          <motion.div
            key={`${rowIndex}-${colIndex}`}
            className="grid-cell"
            onClick={() => handleCellClick(rowIndex, colIndex)}
            whileTap={{ scale: 0.9 }}
          >
            {cell.count > 0 && (
              <motion.div className={`orb ${cell.player}`} animate={{ scale: 1.2 }}>
                {cell.count}
              </motion.div>
            )}
          </motion.div>
        ))
      )}
    </div>
  );
};

export default ChainReactionGrid;
