'use client';

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Photo } from '@/lib/db';

interface LightboxProps {
  photo: Photo | null;
  imageUrl: string; // pre-generated, passed from parent to avoid double blob creation
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
}

export default function Lightbox({
  photo,
  imageUrl,
  onClose,
  onNext,
  onPrev,
}: LightboxProps) {
  const touchStartX = useRef<number>(0);

  // Keyboard navigation
  useEffect(() => {
    if (!photo) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && onNext) onNext();
      if (e.key === 'ArrowLeft' && onPrev) onPrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [photo, onClose, onNext, onPrev]);

  // Touch swipe support
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 60) {
      if (dx < 0 && onNext) onNext();
      else if (dx > 0 && onPrev) onPrev();
    }
  };

  if (!photo) return null;

  return (
    <AnimatePresence>
      {/* Full-screen backdrop — tap anywhere to close */}
      <motion.div
        key="lightbox-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-[9999] bg-black/98 backdrop-blur-2xl flex items-center justify-center select-none"
        onClick={onClose}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Image — spring scale entrance */}
        <motion.div
          key={photo.id}
          initial={{ scale: 0.88, opacity: 0, y: 24 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.88, opacity: 0, y: 24 }}
          transition={{ type: 'spring', stiffness: 260, damping: 28 }}
          className="relative max-w-[calc(100vw-120px)] md:max-w-[calc(100vw-160px)] max-h-[88vh] flex items-center justify-center"
          onClick={(e) => e.stopPropagation()} // don't close when clicking image
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={photo.metadata.originalName}
            className="max-w-[calc(100vw-120px)] md:max-w-[calc(100vw-160px)] max-h-[88vh] object-contain rounded-xl select-none shadow-[0_32px_80px_rgba(0,0,0,0.9)]"
            draggable={false}
          />

          {/* Left swipe hint on sides */}
          {onPrev && (
            <button
              onClick={(e) => { e.stopPropagation(); onPrev(); }}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-14 p-4 rounded-full text-white/30 hover:text-white/80 transition-colors cursor-pointer"
              aria-label="Previous"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
          )}
          {onNext && (
            <button
              onClick={(e) => { e.stopPropagation(); onNext(); }}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-14 p-4 rounded-full text-white/30 hover:text-white/80 transition-colors cursor-pointer"
              aria-label="Next"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          )}
        </motion.div>

        {/* Close button — fixed at middle right, away from photos */}
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ delay: 0.1 }}
          onClick={onClose}
          className="fixed top-1/2 -translate-y-1/2 right-4 md:right-8 z-[10000] p-4 rounded-full bg-black/60 hover:bg-black/90 border border-white/20 text-white transition-all duration-200 cursor-pointer active:scale-95 shadow-2xl backdrop-blur-xl"
        >
          <X className="w-6 h-6 md:w-8 md:h-8" />
        </motion.button>
      </motion.div>
    </AnimatePresence>
  );
}
