'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';

interface StandTextProps {
  text: string;
}

export const StandText: React.FC<StandTextProps> = ({ text }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [pressedIndex, setPressedIndex] = useState<number | null>(null);

  // Split text into uppercase characters
  const letters = text.toUpperCase().split('');

  // Number of shadow layers to stack for the 3D extrusion (foreground + 8 shadow layers = 9 total)
  const LAYERS_COUNT = 9;

  // Extrusion vector coordinates (dx = 1.5px, dy = -1.5px)
  // This means the letters lift up and to the right, leaving shadows trailing down-left
  const dx = 1.2;
  const dy = -1.2;

  return (
    <div 
      className="flex items-center justify-center select-none tracking-tighter"
      style={{ gap: '0.02em' }}
    >
      {letters.map((char, index) => {
        // Compute the multiplier and scaling based on hover/press states
        let multiplier = 1.0;
        let scale = 1.0;
        let skewY = 0;

        if (pressedIndex === index) {
          multiplier = 0.3;
          scale = 0.95;
        } else if (hoveredIndex === index) {
          multiplier = 2.2;
          scale = 1.15;
          skewY = -3; // dynamic slant on active hover
        } else if (hoveredIndex !== null && Math.abs(hoveredIndex - index) === 1) {
          // Wave propagation to immediate neighbors
          multiplier = 1.5;
          scale = 1.06;
          skewY = -1.5;
        }

        return (
          <div
            key={index}
            className="relative cursor-pointer inline-block select-none"
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => {
              setHoveredIndex(null);
              setPressedIndex(null);
            }}
            onMouseDown={() => setPressedIndex(index)}
            onMouseUp={() => setPressedIndex(null)}
            style={{
              padding: '0.15em',
              margin: '-0.15em',
              // High z-index on hovered and neighbor letters so the 3D extrusion comes in front
              zIndex: hoveredIndex === index ? 50 : (hoveredIndex !== null && Math.abs(hoveredIndex - index) === 1 ? 40 : 10),
            }}
          >
            {/* Draw layers from back-most (idx 0) to foreground (idx 8) */}
            {Array.from({ length: LAYERS_COUNT }).map((_, layerIdx) => {
              const isForeground = layerIdx === LAYERS_COUNT - 1;
              const isBackMost = layerIdx === 0;

              // Calculate translation offsets: back-most layer stays at 0, 0
              const tx = layerIdx * dx * multiplier;
              const ty = layerIdx * dy * multiplier;

              return (
                <motion.div
                  key={layerIdx}
                  className={`
                    ${isBackMost ? 'relative' : 'absolute inset-0'}
                    font-black uppercase text-[inherit] select-none leading-none inline-block
                  `}
                  style={{
                    WebkitTextStroke: isForeground ? '0px transparent' : '2px rgba(0,0,0,0.85)',
                    color: isForeground ? '#ffffff' : 'rgba(0,0,0,0.0)',
                    paintOrder: 'stroke fill',
                    transformOrigin: 'bottom center',
                    pointerEvents: isForeground ? 'auto' : 'none',
                  }}
                  animate={{
                    x: tx,
                    y: ty,
                    scale: scale,
                    skewY: skewY,
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: 180,
                    damping: 11,
                    mass: 0.35,
                  }}
                >
                  {char}
                </motion.div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};
