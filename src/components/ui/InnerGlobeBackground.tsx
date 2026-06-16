'use client';
import React, { useEffect, useState } from 'react';
import { Photo } from '@/lib/db';

// Example generic images for the background fallback
const defaultBgImages = [
  "/oec/f4d47f450b8e36c74f74d474d059b770.jpg",
  "/oec/3f69bf76ecbde8204ac307d733058827.jpg",
  "/oec/4a05689e995590db5ed5159f91254db8.jpg",
  "/oec/4cfe6764d7dc952f2157ac986c1d6016.jpg",
  "/oec/5c4865a462349820a17ed71408dac389.jpg",
  "/oec/6ec5c45dfbeb4dc0c1e9adf3963d2f83.jpg",
  "/oec/7e1fbe09f080eb2c5d8ba99f141c884a.jpg",
  "/oec/9ad280b6f58556e85ef3966b992b36fa.jpg",
  "/oec/39dc46b25807d0c918f7d935d32132d0.jpg",
  "/oec/60fc2ef5b9ad3a1c4203e3b11de15222.jpg",
  "/oec/4314ae1d136d3bd94ab1b6c3280e8c99.jpg",
  "/oec/56416484803e68511444561d325dd388.jpg",
  "/oec/b0f88e03f29ad82230c943d2915b3d59.jpg",
  "/oec/ef764e74073d1b2296397d198003dc60.jpg"
];

const Ring = ({ yRotation, images, ringIndex }: { yRotation: number, images: string[], ringIndex: number }) => {
  // 9 arms, 40 degrees apart (360 / 9 = 40)
  const arms = Array.from({ length: 9 }).map((_, i) => i * 40);

  return (
    <div
      className="absolute w-full h-full"
      style={{
        transform: `rotateY(${yRotation}deg)`,
        transformStyle: 'preserve-3d'
      }}
    >
      {arms.map((xRotation, i) => (
        <div
          key={i}
          className="absolute inset-0 flex justify-center items-center"
          style={{
            transform: `rotateX(${xRotation}deg)`,
            transformStyle: 'preserve-3d'
          }}
        >
          <div
            className="absolute w-48 h-48 md:w-64 md:h-64 rounded-full overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10"
            style={{
              transform: `translateZ(450px) rotateY(180deg)`,
              backfaceVisibility: 'visible'
            }}
          >
            <img
              src={images[(i * 4 + ringIndex * 3) % images.length]}
              className="w-full h-full object-cover"
              alt="globe inner"
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export const InnerGlobeBackground = () => {
  // 4 rings: 0, 45, 90, 130 degrees
  const yRotations = [0, 45, 90, 130];

  // Use uploaded photos if available, otherwise default
  const images = defaultBgImages;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none bg-black">
      {/* Vignette gradients to frame the look */}
      <div className="absolute inset-0 z-10 bg-gradient-to-b from-black via-transparent to-black" />
      <div className="absolute inset-0 z-10 bg-gradient-to-r from-black via-transparent to-black" />

      {/* The 3D Scene */}
      <div
        className="w-full h-full flex justify-center items-center"
        style={{ perspective: '1200px' }}
      >
        <style>{`
          @keyframes rotate-globe-css {
            from { transform: rotateY(0deg); }
            to { transform: rotateY(360deg); }
          }
          .animate-rotate-globe-css {
            animation: rotate-globe-css 60s linear infinite;
            will-change: transform;
          }
        `}</style>
        <div
          className="animate-rotate-globe-css relative w-full h-full flex justify-center items-center"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {yRotations.map((yRot, i) => (
            <Ring key={i} yRotation={yRot} images={images} ringIndex={i} />
          ))}
        </div>
      </div>
    </div>
  );
};
