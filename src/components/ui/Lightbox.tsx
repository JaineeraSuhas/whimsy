'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, MapPin, Calendar } from 'lucide-react';
import { Photo } from '@/lib/db';

interface LightboxProps {
  photo: Photo | null;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  location?: string;
  formattedDate?: string;
}

export default function Lightbox({
  photo,
  onClose,
  onNext,
  onPrev,
  location,
  formattedDate,
}: LightboxProps) {
  // Keypress navigation support
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

  if (!photo) return null;

  // Generate local object URL for the blob
  const imageUrl = URL.createObjectURL(photo.blob);

  // Clean up object URL on unmount
  const cleanupUrl = () => {
    try {
      URL.revokeObjectURL(imageUrl);
    } catch (e) {
      // ignore
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-xl select-none"
      >
        {/* Top bar controls */}
        <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-[10000]">
          <div className="flex flex-col text-white">
            <span className="text-xs tracking-widest text-zinc-400 font-mono uppercase">Memory Capture</span>
            <h3 className="text-lg font-light tracking-wide mt-1">{photo.metadata.originalName}</h3>
          </div>
          <button
            onClick={() => {
              cleanupUrl();
              onClose();
            }}
            className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/10 backdrop-blur-md transition-all duration-300 active:scale-95 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Left Arrow */}
        {onPrev && (
          <button
            onClick={onPrev}
            className="absolute left-6 p-4 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/5 transition-all duration-300 active:scale-90 z-[10000] cursor-pointer hidden md:block"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Image Container with entrance animation */}
        <motion.div
          initial={{ scale: 0.95, y: 15, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.95, y: 15, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          className="relative max-w-[90vw] max-h-[75vh] flex flex-col items-center justify-center p-2 rounded-2xl bg-zinc-900/40 border border-white/5 overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={photo.metadata.originalName}
            className="max-w-full max-h-[70vh] object-contain rounded-lg select-none"
            draggable={false}
          />
        </motion.div>

        {/* Right Arrow */}
        {onNext && (
          <button
            onClick={onNext}
            className="absolute right-6 p-4 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/5 transition-all duration-300 active:scale-90 z-[10000] cursor-pointer hidden md:block"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        {/* Bottom Metadata bar */}
        <div className="absolute bottom-8 left-6 right-6 flex flex-col md:flex-row items-center justify-between text-zinc-300 z-[10000] gap-4">
          <div className="flex items-center gap-6 text-sm">
            {location && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5 font-light text-white/80">
                <MapPin className="w-4 h-4 text-blue-400" />
                <span>{location}</span>
              </div>
            )}
            {formattedDate && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5 font-mono text-xs">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>{formattedDate}</span>
              </div>
            )}
          </div>

          {/* Mobile swipe helper text */}
          <span className="text-xs font-mono text-zinc-500 md:hidden">Swipe or tap edges to navigate</span>
          
          <div className="text-xs font-mono text-zinc-400 border border-white/5 px-3 py-1 rounded-full bg-white/5 hidden md:block">
            Use Left / Right Arrows to navigate
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
