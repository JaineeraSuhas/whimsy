'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Compass } from 'lucide-react';
import { InfiniteCanvas } from './ui/InfiniteCanvas';
import Lightbox from './ui/Lightbox';
import { Photo } from '@/lib/db';

interface InfiniteCanvasViewProps {
  photos: Photo[];
  onOpenPhoto?: (photo: Photo) => void;
}

/**
 * Deterministic pseudo-random from seed, returns 0..1
 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

// Extracted from the actual Framer HTML snippet
const REFERENCE_LAYOUT = [
  { width: 244, top: 46, left: 59, zIndex: 1, aspect: 0.8 },
  { width: 212, top: 2, left: 50, zIndex: 2, aspect: 0.800593 },
  { width: 273, top: 61, left: 72, zIndex: 3, aspect: 0.8 },
  { width: 238, top: 52, left: 91, zIndex: 4, aspect: 1 },
  { width: 162, top: 12, left: 21, zIndex: 5, aspect: 1.07731 },
  { width: 143, top: 65, left: 31, zIndex: 6, aspect: 0.946809 },
  { width: 256, top: 81, left: 19, zIndex: 7, aspect: 0.802998 },
  { width: 174, top: 34, left: 3, zIndex: 8, aspect: 0.707012 },
  { width: 114, top: 24, left: 83, zIndex: 9, aspect: 0.717901 },
];

export default function InfiniteCanvasView({ photos, onOpenPhoto }: InfiniteCanvasViewProps) {
  const [dimensions, setDimensions] = useState({ w: 1200, h: 800 });
  const [isMounted, setIsMounted] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);

  // Measure window size
  useEffect(() => {
    setIsMounted(true);
    setDimensions({ w: window.innerWidth, h: window.innerHeight });
    const handleResize = () => setDimensions({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Generate object URLs from thumbnail blobs
  const urlMapRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const currentMap = urlMapRef.current;
    const currentIds = new Set(photos.map((p) => p.id));

    currentMap.forEach((url, id) => {
      if (!currentIds.has(id)) {
        URL.revokeObjectURL(url);
        currentMap.delete(id);
      }
    });

    photos.forEach((photo) => {
      if (!currentMap.has(photo.id)) {
        try {
          const blobToUse = photo.thumbnail || photo.blob;
          const url = URL.createObjectURL(blobToUse);
          currentMap.set(photo.id, url);
        } catch (err) {
          console.error('Failed to create object URL for photo', photo.id, err);
        }
      }
    });
  }, [photos]);

  const fullResUrls = useMemo(() => {
    const urls: Record<string, string> = {};
    photos.forEach((photo) => {
      try {
        urls[photo.id] = URL.createObjectURL(photo.blob);
      } catch { /* ignore */ }
    });
    return urls;
  }, [photos]);

  useEffect(() => {
    return () => {
      Object.values(fullResUrls).forEach((url) => {
        try { URL.revokeObjectURL(url); } catch { /* ignore */ }
      });
    };
  }, [fullResUrls]);

  // Compute deterministic scattered layout for cards — matching the reference site style
  const layoutData = useMemo(() => {
    if (!isMounted) return { cards: [], totalW: 0, totalH: 0 };

    const W = dimensions.w;
    const H = dimensions.h;

    // Enforce a large logical block (e.g., 4x4 tiles = 16 tiles) to completely hide repeating clone patterns
    const minimumTiles = 16;
    const minimumSlots = minimumTiles * REFERENCE_LAYOUT.length;
    const slotsToFill = Math.max(photos.length, minimumSlots);
    // Round up to the nearest full tile so the grid is always complete
    const totalSlots = Math.ceil(slotsToFill / REFERENCE_LAYOUT.length) * REFERENCE_LAYOUT.length;

    const displayPhotos = [];
    for (let i = 0; i < totalSlots; i++) {
      displayPhotos.push(photos[i % photos.length]);
    }

    // Seeded pseudo-random shuffle to prevent adjacent identical photos
    let seed = 12345;
    const random = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    
    for (let i = displayPhotos.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [displayPhotos[i], displayPhotos[j]] = [displayPhotos[j], displayPhotos[i]];
    }

    const totalTiles = Math.max(1, Math.ceil(displayPhotos.length / REFERENCE_LAYOUT.length));
    const tileCols = Math.ceil(Math.sqrt(totalTiles));
    
    // Condense the layout to fit 9 images tightly on one screen with slight edge overlap
    const tileW = Math.max(1000, W * 1.05);
    const tileH = Math.max(700, H * 1.05);

    const computedCards = displayPhotos.map((photo, index) => {
      const patternIdx = index % REFERENCE_LAYOUT.length;
      const tileIdx = Math.floor(index / REFERENCE_LAYOUT.length);
      const tileRow = Math.floor(tileIdx / tileCols);
      const tileCol = tileIdx % tileCols;

      const ref = REFERENCE_LAYOUT[patternIdx];

      // Calculate absolute position based on tile offset and reference percentage
      const left = tileCol * tileW + (ref.left / 100) * tileW;
      const top = tileRow * tileH + (ref.top / 100) * tileH;

      // Scale images to be larger so they fill the screen and overlap slightly
      const scaleFactor = Math.max(W / 1440, 1) * 1.35; 
      const finalWidth = ref.width * scaleFactor;

      // Aspect ratio from the reference layout ensures perfect replication of grid slots
      const aspect = ref.aspect;

      const finalHeight = finalWidth / aspect;

      const dateObj = new Date(photo.metadata.date || photo.createdAt);
      const formattedYear = dateObj.getFullYear().toString();

      // Location from EXIF if available
      let locationStr = '';
      if (photo.metadata.exif && typeof photo.metadata.exif['location'] === 'string') {
        locationStr = photo.metadata.exif['location'];
      }

      // Clean name (remove file extension)
      const cleanName = photo.metadata.originalName.replace(/\.[^/.]+$/, "");

      // Staggered animation delay
      const delay = index * 0.06;

      return {
        photo,
        index,
        left,
        top,
        width: finalWidth,
        height: finalHeight,
        zIndex: ref.zIndex,
        delay,
        location: locationStr,
        formattedYear,
        cleanName,
        details: `${photo.metadata.width} x ${photo.metadata.height}px ${photo.metadata.mimeType.split('/')[1]?.toUpperCase() || 'IMAGE'}`,
        get imageUrl() { return urlMapRef.current.get(photo.id) || ''; },
      };
    });
    // The layout grid max dimensions
    const totalW = tileCols * tileW;
    const tileRows = Math.ceil(totalTiles / tileCols);
    const totalH = Math.max(tileRows * tileH, tileH);

    return {
      cards: computedCards,
      totalW,
      totalH,
    };
  }, [photos, dimensions, isMounted]);

  if (!isMounted || photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-400 gap-3">
        <Compass className="w-8 h-8 animate-spin text-zinc-500" />
        <span className="font-mono text-sm tracking-wide">Assembling memory layout...</span>
      </div>
    );
  }

  const activeCard = activePhotoIndex !== null ? layoutData.cards[activePhotoIndex] : null;

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-[#050505]">
      {/* Scroll/Drag indicator — reference style */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex items-center gap-3">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-blue-700">
          <path d="M5 12H19M19 12L13 6M19 12L13 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="text-[10px] font-mono font-bold tracking-[0.25em] text-blue-700 uppercase">
          SCROLL/DRAG TO MOVE
        </span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-blue-700">
          <path d="M12 5V19M12 19L6 13M12 19L18 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      <InfiniteCanvas
        scrollSpeed={0.6}
        dragSpeed={0.7}
        ease={0.1}
        enableDrag={true}
        parallaxEnabled={true}
        parallaxIntensity={0.25}
        contentWidth={layoutData.totalW}
        contentHeight={layoutData.totalH}
      >
        {layoutData.cards.map((card) => (
          <div
            key={`${card.photo.id}-${card.index}`}
            className="absolute"
            style={{
              left: `${card.left}px`,
              top: `${card.top}px`,
              width: `${card.width}px`,
              zIndex: card.zIndex,
              transform: 'translate(-50%, -50%)', // Match Framer's exact transform
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: Math.min(card.delay, 1.2), ease: [0.25, 0.1, 0.25, 1] }}
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenPhoto) {
                  onOpenPhoto(card.photo);
                } else {
                  setActivePhotoIndex(card.index);
                }
              }}
              className="w-full flex flex-col cursor-pointer group select-none gap-[8px]"
            >
              {/* Image container */}
              <div
                className="w-full relative overflow-hidden bg-[#111]"
                style={{ height: `${card.height}px` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={card.imageUrl}
                  alt={card.photo.metadata.originalName}
                  className="w-full h-full object-cover select-none transition-transform duration-[1.2s] ease-out group-hover:scale-[1.04]"
                  draggable={false}
                  loading="lazy"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.dataset.retried) {
                      target.dataset.retried = '1';
                      try {
                        const url = URL.createObjectURL(card.photo.blob);
                        target.src = url;
                      } catch { /* ignore */ }
                    }
                  }}
                />
              </div>

              {/* Metadata text block — matching reference exactly */}
              <div className="flex flex-col items-start w-full gap-[2px] mt-1" style={{ fontFamily: "'Roboto Mono', monospace" }}>
                <span className="text-[6px] text-white font-bold leading-[1.3em] w-full whitespace-pre-wrap break-words">
                  {card.cleanName || 'Untitled'}
                </span>
                <span className="text-[6px] text-white leading-[1.3em] w-full whitespace-pre-wrap break-words">
                  12 x 6 inch C type hand print
                </span>
                <span className="text-[6px] text-white leading-[1.3em] w-full whitespace-pre-wrap break-words">
                  Edition of 1 Plus and additional artist Proof
                </span>
                <span className="text-[6px] text-white leading-[1.3em] w-full whitespace-pre-wrap break-words">
                  2024
                </span>
              </div>
            </motion.div>
          </div>
        ))}
      </InfiniteCanvas>

      <AnimatePresence>
        {activeCard && (
          <Lightbox
            photo={activeCard.photo}
            imageUrl={fullResUrls[activeCard.photo.id] || activeCard.imageUrl}
            onClose={() => setActivePhotoIndex(null)}
            onNext={
              activePhotoIndex !== null && activePhotoIndex < layoutData.cards.length - 1
                ? () => setActivePhotoIndex(activePhotoIndex + 1)
                : undefined
            }
            onPrev={
              activePhotoIndex !== null && activePhotoIndex > 0
                ? () => setActivePhotoIndex(activePhotoIndex - 1)
                : undefined
            }
          />
        )}
      </AnimatePresence>
    </div>
  );
}
