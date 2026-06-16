'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Calendar, Compass, ZoomIn } from 'lucide-react';
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
  'Lofoten, Norway'
];

export default function InfiniteCanvasView({ photos, onOpenPhoto }: InfiniteCanvasViewProps) {
  const [dimensions, setDimensions] = useState({ w: 1200, h: 800 });
  const [isMounted, setIsMounted] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);

  // Measure window size
  useEffect(() => {
    setIsMounted(true);
    setDimensions({ w: window.innerWidth, h: window.innerHeight });

    const handleResize = () => {
      setDimensions({ w: window.innerWidth, h: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Generate object URLs for Blobs once to prevent re-generation lag
  const imageUrls = useMemo(() => {
    const urls: Record<string, string> = {};
    photos.forEach((photo) => {
      try {
        urls[photo.id] = URL.createObjectURL(photo.blob);
      } catch (err) {
        console.error('Failed to create object URL for photo', photo.id, err);
      }
    });
    return urls;
  }, [photos]);

  // Cleanup object URLs on unmount/change
  useEffect(() => {
    return () => {
      Object.values(imageUrls).forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch (e) {
          // ignore
        }
      });
    };
  }, [imageUrls]);

  // Compute deterministic coordinates and info per card
  const cards = useMemo(() => {
    if (!isMounted) return [];

    const W = dimensions.w;
    const H = dimensions.h;

    return photos.map((photo, index) => {
      // Deterministic layout grid columns based on count
      const cols = Math.ceil(Math.sqrt(photos.length * 1.5)) || 3;
      const col = index % cols;
      const row = Math.floor(index / cols);

      const rowsCount = Math.ceil(photos.length / cols) || 1;
      
      const spacingX = (W * 1.8) / cols;
      const spacingY = (H * 1.8) / rowsCount;

      // Seeded random offset generator
      const seed = (index * 1337 + 42) % 1000;
      const rX = (seed % 100) / 100 - 0.5;
      const rY = ((seed * 7) % 100) / 100 - 0.5;
      const rRotation = ((seed * 31) % 18) - 9; // -9 to +9 deg
      const rDelay = (seed % 10) * 0.05;

      const left = col * spacingX + spacingX * 0.5 + rX * spacingX * 0.35;
      const top = row * spacingY + spacingY * 0.5 + rY * spacingY * 0.35;

      // Extract metadata info
      const hash = Array.from(photo.id).reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const location = FALLBACK_LOCATIONS[hash % FALLBACK_LOCATIONS.length];

      const dateObj = new Date(photo.metadata.date || photo.createdAt);
      const formattedDate = dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      // Calculate photo aspect-ratio dimensions
      const aspect = (photo.metadata.width && photo.metadata.height)
        ? photo.metadata.width / photo.metadata.height
        : 4 / 3;

      const targetHeight = 220;
      const targetWidth = Math.min(Math.max(targetHeight * aspect, 180), 320);

      return {
        photo,
        index,
        left,
        top,
        width: targetWidth,
        height: targetHeight + 70, // including metadata space
        rotation: rRotation,
        delay: rDelay,
        location,
        formattedDate,
        imageUrl: imageUrls[photo.id] || '',
      };
    });
  }, [photos, dimensions, isMounted, imageUrls]);

  if (!isMounted || photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-400 gap-3">
        <Compass className="w-8 h-8 animate-spin text-zinc-500" />
        <span className="font-mono text-sm tracking-wide">Assembling memory layout...</span>
      </div>
    );
  }

  // Active Lightbox Photo
  const activeCard = activePhotoIndex !== null ? cards[activePhotoIndex] : null;

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-black">
      {/* HUD Guide Overlay */}
      <div className="absolute top-6 left-6 z-50 flex items-center gap-3 bg-black/40 backdrop-blur-md border border-white/5 px-4 py-2 rounded-full pointer-events-none">
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        <span className="text-xs font-mono tracking-widest text-zinc-300 uppercase">Infinite Memories</span>
      </div>

      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none text-[11px] font-mono tracking-wider text-zinc-500 uppercase bg-black/40 px-4 py-1.5 rounded-full border border-white/5 backdrop-blur-md hidden md:block">
        Drag or Scroll to Explore Canvas
      </div>

      {/* Infinite Scrolling Engine */}
      <InfiniteCanvas
        scrollSpeed={0.5}
        dragSpeed={0.65}
        ease={0.15}
        enableDrag={true}
        parallaxEnabled={true}
        parallaxIntensity={0.6}
      >
        {cards.map((card) => (
          <div
            key={card.photo.id}
            className="absolute origin-center transition-all duration-300"
            style={{
              left: `${card.left}px`,
              top: `${card.top}px`,
              width: `${card.width}px`,
              height: `${card.height}px`,
            }}
          >
            {/* The individual photo card element */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: card.delay, type: 'spring' }}
              whileHover={{ 
                scale: 1.05, 
                rotate: 0, 
                zIndex: 100,
                y: -10
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenPhoto) {
                  onOpenPhoto(card.photo);
                } else {
                  setActivePhotoIndex(card.index);
                }
              }}
              style={{ rotate: card.rotation }}
              className="w-full h-full flex flex-col p-3 rounded-2xl bg-zinc-950/80 hover:bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700/60 shadow-xl hover:shadow-[0_20px_50px_rgba(0,0,0,0.8)] transition-shadow duration-300 cursor-pointer overflow-hidden group select-none"
            >
              {/* Photo Image box */}
              <div className="w-full flex-1 rounded-xl overflow-hidden relative bg-zinc-900 border border-white/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={card.imageUrl}
                  alt={card.photo.metadata.originalName}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 select-none"
                  draggable={false}
                />
                {/* Hover zoom overlay */}
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                  <ZoomIn className="w-7 h-7 text-white/80 filter drop-shadow" />
                </div>
              </div>

              {/* Metadata Details info row */}
              <div className="mt-3.5 flex flex-col justify-end gap-1.5 select-none">
                <div className="flex items-center gap-1.5 text-zinc-300 group-hover:text-white transition-colors">
                  <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="text-[11px] font-medium tracking-wide truncate">{card.location}</span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-500 font-mono text-[9.5px]">
                  <Calendar className="w-3.5 h-3.5 text-emerald-500/80 shrink-0" />
                  <span>{card.formattedDate}</span>
                </div>
              </div>
            </motion.div>
          </div>
        ))}
      </InfiniteCanvas>

      {/* Fullscreen Lightbox Modal */}
      <AnimatePresence>
        {activeCard && (
          <Lightbox
            photo={activeCard.photo}
            location={activeCard.location}
            formattedDate={activeCard.formattedDate}
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
