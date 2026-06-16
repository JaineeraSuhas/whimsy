"use client";

import React from 'react';
import { motion } from 'motion/react';

// Common animation transition configurations
const transitionConfig = (delay: number, duration: number = 0.6) => ({
  pathLength: {
    delay,
    duration,
    ease: [0.44, 0, 0.56, 1] as const,
  },
  opacity: {
    delay,
    duration: 0.01,
  }
});

interface LetterProps {
  delay: number;
}

export function SyncedAnimation() {
  return (
    <div className="flex items-center justify-center bg-black min-h-screen w-full">
      <div className="flex items-center justify-center gap-1 md:gap-2 h-16 md:h-24 select-none">
        <LetterS delay={0.1} />
        <LetterY delay={0.2} />
        <LetterN delay={0.3} />
        <LetterC delay={0.4} />
        <LetterE delay={0.5} />
        <LetterD delay={0.6} />
        <Smile delay={0.7} />
      </div>
    </div>
  );
}

// Letter S SVG Component
const LetterS: React.FC<LetterProps> = ({ delay }) => (
  <svg viewBox="0 0 50 78" className="h-full w-auto overflow-visible">
    <motion.path
      d="M 30.17 2.14 C 29.887 2.117 28.217 0.832 26.69 0.382 C 24.17 -0.359 22.42 0.196 22.155 0.248 C 20.169 0.635 18.598 2.377 17.955 3.89 C 16.788 6.64 16.867 8.322 16.788 11.344 C 16.749 12.817 17.67 16.64 18.67 18.14 C 20.78 21.304 22.612 22.991 24.17 25.64 C 25.17 27.342 26.37 28.725 27.17 30.64 C 28.033 32.704 29.106 35.075 29.17 37.14 C 29.204 38.234 28.894 41.271 26.809 43.374 C 26.232 43.955 25.259 45.423 23.67 46.14 C 20.456 47.59 17.747 48.112 15.801 48.446 C 14.671 48.64 13.363 48.909 10.832 48.802 C 8.154 48.689 6.46 48.149 5.367 47.685 C 3.365 46.685 1.889 45.884 1.34 45.525 C 1.004 45.313 0.551 45.043 0 44.626"
      fill="transparent"
      stroke="white"
      strokeWidth={3.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      transform="translate(10 21)"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={transitionConfig(delay, 0.6)}
    />
  </svg>
);

// Letter Y SVG Component
const LetterY: React.FC<LetterProps> = ({ delay }) => (
  <svg viewBox="0 0 33 78" className="h-full w-auto overflow-visible">
    {/* First Stroke: Cup Shape */}
    <motion.path
      d="M 0.256 5 C 0.224 5.72 -0.304 9.705 0.256 12.5 C 0.756 15 2.326 15.88 3.256 16.5 C 4.756 17.5 6.256 18.52 11.05 18.52 C 12.41 18.52 12.974 18.307 13.479 17.935 C 15.425 16.5 16.487 15.4 17.756 12.5 C 18.656 10.285 19.51 7.696 20.256 5.5 C 21.002 3.303 21.222 0.574 21.256 0"
      fill="transparent"
      stroke="white"
      strokeWidth={3.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      transform="translate(5.914 30)"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={transitionConfig(delay, 0.6)}
    />
    {/* Second Stroke: Descender Tail */}
    <motion.path
      d="M 21.256 0 C 21.256 5 20.5 10 18.5 15 C 16.5 20 12.5 24 6.5 26 C 3.5 27 0.5 26.5 -1.5 24"
      fill="transparent"
      stroke="white"
      strokeWidth={3.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      transform="translate(5.914 30)"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={transitionConfig(delay + 0.1, 0.4)}
    />
  </svg>
);

// Letter N SVG Component
const LetterN: React.FC<LetterProps> = ({ delay }) => (
  <svg viewBox="0 0 34 78" className="h-full w-auto overflow-visible">
    <motion.path
      d="M 1.768 0 C 1.768 0.029 1.779 1.732 1.997 6.291 C 2.135 9.167 2.606 13.167 2.809 15.883 C 3.192 21 3.021 21.16 2.809 22 C 2.557 23 2.558 23.5 1.043 24.086 C 0.598 24.258 -0.226 22.7 0.058 21 C 0.559 18 1.035 16.96 1.558 15.5 C 2.168 13.793 1.913 13.39 3.558 11.5 C 4.775 10.102 4.461 10.4 6.058 9 C 9.884 5.646 11.309 6.446 12.558 6.5 C 13.769 6.551 16.405 9.608 17.558 13 C 18.754 16.521 20.66 20.328 19.558 20.328"
      fill="transparent"
      stroke="white"
      strokeWidth={3.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      transform="translate(6.613 25)"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={transitionConfig(delay, 0.6)}
    />
  </svg>
);

// Letter C SVG Component
const LetterC: React.FC<LetterProps> = ({ delay }) => (
  <svg viewBox="0 0 34 78" className="h-full w-auto overflow-visible">
    <motion.path
      d="M 16 2 C 14 0.5 10 0 7 2 C 3.5 4.5 1.5 9 1 14 C 0.5 19 2 24.5 5.5 27.5 C 9 30 14.5 29.5 17 27"
      fill="transparent"
      stroke="white"
      strokeWidth={3.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      transform="translate(7 24)"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={transitionConfig(delay, 0.6)}
    />
  </svg>
);

// Letter E SVG Component
const LetterE: React.FC<LetterProps> = ({ delay }) => (
  <svg viewBox="0 0 34 78" className="h-full w-auto overflow-visible">
    {/* Upper loop */}
    <motion.path
      d="M 0 13.243 C 0.829 12.91 2.134 16.973 8 11.743 C 9.195 10.677 10.902 8.918 11.668 7.241 C 12.997 4.335 12.522 2.613 12.432 1.449 C 12.399 1.012 12.033 0.376 11.501 0.243 C 9.501 -0.257 7.378 -0.161 5 2.243 C 4.553 2.695 3.018 4.277 2 6.243 C 1.003 8.17 0.671 9.545 0 13.243 Z"
      fill="transparent"
      stroke="white"
      strokeWidth={3.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      transform="translate(7.208 24)"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={transitionConfig(delay, 0.4)}
    />
    {/* Lower curve */}
    <motion.path
      d="M 0.208 0 C -0.324 2.934 0.208 5.5 1.331 8.617 C 2.477 11.8 4.244 13.671 5.336 14.5 C 6.582 15.444 8.039 15.684 9.708 15.5 C 11.42 15.311 15.716 12.363 17.208 10 C 17.477 9.46 19.934 6.351 20.208 5.5"
      fill="transparent"
      stroke="white"
      strokeWidth={3.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      transform="translate(7 37.243)"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={transitionConfig(delay + 0.1, 0.4)}
    />
  </svg>
);

// Letter D SVG Component
const LetterD: React.FC<LetterProps> = ({ delay }) => (
  <svg viewBox="0 0 34 78" className="h-full w-auto overflow-visible">
    {/* Loop */}
    <motion.path
      d="M 10.484 0 C 10.061 0.006 8.586 0.3 7.09 1.048 C 4.686 2.25 1.946 5.642 0.901 8.137 C -0.697 11.953 0.172 15.399 0.902 16.536 C 2.076 18.364 2.471 18.93 5.898 20.427 C 11.231 21.479 15.048 20.259 15.684 20.036"
      fill="transparent"
      stroke="white"
      strokeWidth={3.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      transform="translate(8 30.5)"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={transitionConfig(delay, 0.4)}
    />
    {/* Stem */}
    <motion.path
      d="M 0 0 C 0 0.01 0 0.018 0.225 2.614 C 0.449 5.209 0.898 10.39 1.351 14.614 C 1.804 18.838 2.249 21.947 2.506 23.7 C 2.807 25.757 2.948 28.867 3.178 33.814 C 3.344 37.388 3.839 40.227 3.966 44.486 C 4.052 47.341 4.293 51.6 4.412 53.92 C 4.548 56.494 4.606 56.994 4.682 57.489 C 4.717 57.743 4.748 58.005 4.837 58.553"
      fill="transparent"
      stroke="white"
      strokeWidth={3.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      transform="translate(20.5 -4)"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={transitionConfig(delay + 0.1, 0.4)}
    />
  </svg>
);

// Smile :) SVG Component
const Smile: React.FC<LetterProps> = ({ delay }) => (
  <svg viewBox="0 0 69 78" className="h-full w-auto overflow-visible">
    {/* Left Eye */}
    <motion.path
      d="M 0.793 3.045 C 1.213 3.394 1.767 3.583 1.82 3.583 C 2.07 3.583 2.313 3.583 2.595 3.559 C 3.19 3.487 3.723 3.326 4.095 3.037 C 4.351 2.621 4.847 1.393 4.163 0.469 C 4.009 0.259 3.782 0.026 3.483 0.015 C 2.285 -0.032 0.742 -0.023 0.194 0.915 C 0.067 1.132 -0.038 1.398 0.014 1.68 C 0.105 2.212 0.381 2.695 0.793 3.045 Z"
      fill="transparent"
      stroke="white"
      strokeWidth={3.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      transform="translate(14.5 17)"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={transitionConfig(delay, 0.1)}
    />
    {/* Right Eye */}
    <motion.path
      d="M 0.409 3.011 C 1.339 3.455 2.562 3.333 2.783 3.113 C 3.283 2.613 3.361 1.815 3.273 1.316 C 3.186 0.816 3.045 0.603 2.865 0.426 C 2.685 0.249 2.478 0.077 2.229 0.044 C 1.722 -0.025 1.128 -0.053 0.71 0.274 C 0.291 0.601 -0.019 1.035 0.001 1.532 C 0.022 2.047 -0.055 2.791 0.409 3.012 Z"
      fill="transparent"
      stroke="white"
      strokeWidth={3.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      transform="translate(40 14)"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={transitionConfig(delay + 0.05, 0.1)}
    />
    {/* Smile Mouth */}
    <motion.path
      d="M 0 2.862 C 0.292 2.971 1.926 4.168 5.827 6.251 C 7.43 7.106 7.841 7.187 9.827 7.751 C 11.813 8.315 15.887 9.45 17.014 9.761 C 17.327 9.847 19.201 10.442 22.051 10.703 C 24.901 10.963 29.508 11.103 33.33 11.001 C 36.161 10.932 38.986 10.699 41.79 10.304 C 44.048 9.982 47.735 8.523 48.327 8.251 C 48.741 8.061 51.049 7.068 52.827 6.251 C 54.605 5.433 56.303 4.368 57.893 3.545 C 60.973 1.765 62.252 0.87 62.722 0.453 C 62.944 0.268 63.134 0.136 63.368 0"
      fill="transparent"
      stroke="white"
      strokeWidth={3.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      transform="translate(3 30)"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={transitionConfig(delay + 0.1, 0.4)}
    />
  </svg>
);
