'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Compass } from 'lucide-react';
import InfiniteCanvas from './ui/InfiniteCanvas';
import Lightbox from './ui/Lightbox';
import { Photo } from '@/lib/db';

interface InfiniteCanvasViewProps {
  photos: Photo[];
  onOpenPhoto?: (photo: Photo) => void;
}

const FALLBACK_LOCATIONS = [
  'Kyoto, Japan',
  'Paris, France',
  'Rome, Italy',
  'Reykjavík, Iceland',
  'Zermatt, Switzerland',
  'Cape Town, South Africa',
  'New York, USA',
  'Amalfi Coast, Italy',
  'Sydney, Australia',
  'San Francisco, USA',
  'Santorini, Greece',
  'Barcelona, Spain',
  'Bali, Indonesia',
  'London, United Kingdom',
  'Lofoten, Norway',
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

  // Generate object URLs from thumbnail blobs (smaller, fast, reliable)
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

  // Compute deterministic coordinates and info per card
  const cards = useMemo(() => {
    if (!isMounted) return [];

    const W = dimensions.w;
    const H = dimensions.h;

    return photos.map((photo, index) => {
      const cols = Math.ceil(Math.sqrt(photos.length * 1.5)) || 3;
      const col = index % cols;
      const row = Math.floor(index / cols);
      const rowsCount = Math.ceil(photos.length / cols) || 1;

      // Tighter spacing for the museum look
      const spacingX = (W * 1.5) / cols;
      const spacingY = (H * 1.5) / rowsCount;

      const seed = (index * 1337 + 42) % 1000;
      const rX = (seed % 100) / 100 - 0.5;
      const rY = ((seed * 7) % 100) / 100 - 0.5;
      
      // ZERO rotation as per reference
      const rRotation = 0; 
      const rDelay = (seed % 10) * 0.04;

      const left = col * spacingX + spacingX * 0.5 + rX * spacingX * 0.5;
      const top = row * spacingY + spacingY * 0.5 + rY * spacingY * 0.5;

      const dateObj = new Date(photo.metadata.date || photo.createdAt);
      const formattedYear = dateObj.getFullYear().toString();

      const aspect = photo.metadata.width && photo.metadata.height
        ? photo.metadata.width / photo.metadata.height
        : 4 / 3;

      // Larger target sizes for the museum print look
      const targetHeight = 350 + (seed % 150); // Varied heights from 350 to 500
      const targetWidth = targetHeight * aspect;

      // If we have EXIF location, format it. We'll assume photo.metadata.exif.location could exist.
      // Since we don't have a reliable extractor, we only show it if explicitly present.
      let locationStr = '';
      if (photo.metadata.exif && (photo.metadata.exif as any).location) {
        locationStr = (photo.metadata.exif as any).location as string;
      }

      // Name processing: remove extension
      const cleanName = photo.metadata.originalName.replace(/\.[^/.]+$/, "");

      return {
        photo,
        index,
        left,
        top,
        width: targetWidth,
        height: targetHeight + 100, // Extra room for the multi-line text block
        rotation: rRotation,
        delay: rDelay,
        location: locationStr,
        formattedYear,
        cleanName,
        details: `${photo.metadata.width} x ${photo.metadata.height}px ${photo.metadata.mimeType.split('/')[1]?.toUpperCase() || 'IMAGE'}`,
        get imageUrl() { return urlMapRef.current.get(photo.id) || ''; },
      };
    });
  }, [photos, dimensions, isMounted]);

  if (!isMounted || photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-400 gap-3">
        <Compass className="w-8 h-8 animate-spin text-zinc-500" />
        <span className="font-mono text-sm tracking-wide">Assembling memory layout...</span>
      </div>
    );
  }

  const activeCard = activePhotoIndex !== null ? cards[activePhotoIndex] : null;

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-[#050505]">
      {/* Scroll indicator exactly like the reference */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex items-center gap-3">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/0m" className="text-white">
          <path d="M12 4V20M12 4L8 8M12 4L16 8M4 12H20M4 12L8 8M4 12L8 16M20 12L16 8M20 12L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="text-[11px] font-mono tracking-widest text-white uppercase font-bold">
          SCROLL/DRAG TO MOVE
        </span>
      </div>

      <InfiniteCanvas
        scrollSpeed={0.5}
        dragSpeed={0.65}
        ease={0.15}
        enableDrag={true}
        parallaxEnabled={true}
        parallaxIntensity={0.3} // Subtle parallax
      >
        {cards.map((card) => (
          <div
            key={card.photo.id}
            className="absolute origin-top-left"
            style={{
              left: `${card.left}px`,
              top: `${card.top}px`,
              width: `${card.width}px`,
              height: `${card.height}px`,
            }}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: card.delay }}
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenPhoto) {
                  onOpenPhoto(card.photo);
                } else {
                  setActivePhotoIndex(card.index);
                }
              }}
              className="w-full h-full flex flex-col cursor-pointer group select-none"
            >
              {/* Sharp, unstyled image block perfectly matching reference */}
              <div 
                className="w-full relative overflow-hidden bg-[#111]"
                style={{ height: card.height - 100 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={card.imageUrl}
                  alt={card.photo.metadata.originalName}
                  className="w-full h-full object-cover select-none transition-transform duration-[1.5s] ease-out group-hover:scale-105"
                  draggable={false}
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

              {/* Museum-style multi-line left-aligned metadata */}
              <div className="mt-3 flex flex-col items-start justify-start w-full font-mono">
                <span className="text-[10px] md:text-[11px] text-white font-medium mb-0.5 truncate w-full">
                  {card.cleanName}
                </span>
                <span className="text-[9px] md:text-[10px] text-white/70 truncate w-full leading-relaxed">
                  {card.details}
                </span>
                {card.location && (
                  <span className="text-[9px] md:text-[10px] text-white/70 truncate w-full leading-relaxed">
                    {card.location}
                  </span>
                )}
                <span className="text-[9px] md:text-[10px] text-white/70 truncate w-full leading-relaxed mt-1">
                  {card.formattedYear}
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
              activePhotoIndex !== null && activePhotoIndex < cards.length - 1
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
