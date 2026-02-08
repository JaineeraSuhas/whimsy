"use client";

import { useEffect, useState, useRef } from 'react';
import { motion, stagger, useAnimate } from "motion/react";
import UploadDropzone from '@/components/UploadDropzone';
import SpiralCanvas from '@/components/SpiralCanvas';
import Floating, { FloatingElement } from '@/components/ui/parallax-floating';
import { getAllPhotos, Photo, getPhotosByPeople, updatePersonName } from '@/lib/db';
import { Grid, Users, Plus } from 'lucide-react';
import { UploadSection } from '@/components/ui/upload-section';
import { RadialFaceSelector, type Person } from '@/components/ui/radial-face-selector';
import { getPeopleWithThumbnails } from '@/lib/face-processing';
import MobileBottomNav from '@/components/MobileBottomNav';
import '@/lib/debug-face-detection'; // Load debug utility

const exampleImages = [
  "/images/WhatsApp Image 2026-02-07 at 9.45.16 PM.jpeg",
  "/images/WhatsApp Image 2026-02-07 at 9.45.19 PM.jpeg",


  "/images/WhatsApp Image 2026-02-07 at 9.45.19 PM (3).jpeg",
  "/images/WhatsApp Image 2026-02-07 at 9.45.19 PM (1).jpeg",
  "/images/WhatsApp Image 2026-02-07 at 9.45.19 PM (4).jpeg",
  "/images/WhatsApp Image 2026-02-07 at 9.45.19 PM (5).jpeg",
  "/images/WhatsApp Image 2026-02-07 at 9.45.19 PM (2).jpeg",
  "/images/WhatsApp Image 2026-02-07 at 9.45.19 PM (6).jpeg",
];

import type { FloatingHandle } from '@/components/ui/parallax-floating';

const HeroSection = ({ onEnter }: { onEnter: () => void }) => {
  const [scope, animate] = useAnimate();
  const floatingRef = useRef<FloatingHandle>(null);

  useEffect(() => {
    animate("img", { opacity: [0, 1] }, { duration: 0.5, delay: stagger(0.15) });
  }, [animate]);

  const handleEnter = async () => {
    if (floatingRef.current) {
      await floatingRef.current.requestAccess();
    }
    onEnter();
  };

  return (
    <div
      className="flex w-full h-screen justify-center items-center bg-black overflow-hidden"
      ref={scope}
    >
      <motion.div
        className="z-50 text-center space-y-4 items-center flex flex-col"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.88, delay: 1.5 }}
      >
        <p className="text-5xl md:text-7xl z-50 text-white font-bold italic tracking-tight">
          whimsy.
        </p>
        <p
          onClick={handleEnter}
          className="text-xs z-50 hover:scale-110 transition-transform bg-white text-black rounded-full py-2 px-6 cursor-pointer font-medium"
        >
          Enter Arena
        </p>
      </motion.div>

      <Floating ref={floatingRef} sensitivity={-1} className="overflow-hidden">
        <FloatingElement depth={0.5} className="top-[8%] left-[11%]">
          <motion.img
            initial={{ opacity: 0 }}
            src={exampleImages[0]}
            alt="Gallery 1"
            className="w-16 h-16 md:w-24 md:h-24 object-cover hover:scale-105 duration-200 cursor-pointer transition-transform rounded-lg"
          />
        </FloatingElement>
        <FloatingElement depth={1} className="top-[10%] left-[32%]">
          <motion.img
            initial={{ opacity: 0 }}
            src={exampleImages[1]}
            alt="Gallery 2"
            className="w-20 h-20 md:w-28 md:h-28 object-cover hover:scale-105 duration-200 cursor-pointer transition-transform rounded-lg"
          />
        </FloatingElement>
        <FloatingElement depth={2} className="top-[2%] left-[53%]">
          <motion.img
            initial={{ opacity: 0 }}
            src={exampleImages[2]}
            alt="Gallery 3"
            className="w-28 h-40 md:w-40 md:h-52 object-cover hover:scale-105 duration-200 cursor-pointer transition-transform rounded-lg"
          />
        </FloatingElement>
        <FloatingElement depth={1} className="top-[0%] left-[83%]">
          <motion.img
            initial={{ opacity: 0 }}
            src={exampleImages[3]}
            alt="Gallery 4"
            className="w-24 h-24 md:w-32 md:h-32 object-cover hover:scale-105 duration-200 cursor-pointer transition-transform rounded-lg"
          />
        </FloatingElement>

        <FloatingElement depth={1} className="top-[40%] left-[2%]">
          <motion.img
            initial={{ opacity: 0 }}
            src={exampleImages[4]}
            alt="Gallery 5"
            className="w-28 h-28 md:w-36 md:h-36 object-cover hover:scale-105 duration-200 cursor-pointer transition-transform rounded-lg"
          />
        </FloatingElement>
        <FloatingElement depth={2} className="top-[70%] left-[77%]">
          <motion.img
            initial={{ opacity: 0 }}
            src={exampleImages[7]}
            alt="Gallery 6"
            className="w-28 h-28 md:w-36 md:h-48 object-cover hover:scale-105 duration-200 cursor-pointer transition-transform rounded-lg"
          />
        </FloatingElement>

        <FloatingElement depth={4} className="top-[73%] left-[15%]">
          <motion.img
            initial={{ opacity: 0 }}
            src={exampleImages[5]}
            alt="Gallery 7"
            className="w-40 md:w-52 h-full object-cover hover:scale-105 duration-200 cursor-pointer transition-transform rounded-lg"
          />
        </FloatingElement>
        <FloatingElement depth={1} className="top-[80%] left-[50%]">
          <motion.img
            initial={{ opacity: 0 }}
            src={exampleImages[6]}
            alt="Gallery 8"
            className="w-24 h-24 md:w-32 md:h-32 object-cover hover:scale-105 duration-200 cursor-pointer transition-transform rounded-lg"
          />
        </FloatingElement>
      </Floating>
    </div>
  );
};

export default function Home() {
  const [showApp, setShowApp] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [filteredPhotos, setFilteredPhotos] = useState<Photo[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<'all' | 'people'>('all');
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);

  const fetchPhotos = async () => {
    setLoading(true);
    const storedPhotos = await getAllPhotos();
    setPhotos(storedPhotos);
    setFilteredPhotos(storedPhotos);

    // Load detected people
    const detectedPeople = await getPeopleWithThumbnails();
    setPeople(detectedPeople);

    setLoading(false);
  };

  useEffect(() => {
    const applyFilters = async () => {
      if (filterMode === 'all') {
        setFilteredPhotos(photos);
      } else if (filterMode === 'people') {
        if (selectedPersonIds.length > 0) {
          // Filter by selected people
          const personPhotos = await getPhotosByPeople(selectedPersonIds);
          setFilteredPhotos(personPhotos);
        } else if (people.length > 0) {
          // Show all photos with faces when people exist
          setFilteredPhotos(photos.filter(p => p.faces && p.faces.length > 0));
        } else {
          // No people detected yet, show all photos
          setFilteredPhotos(photos);
        }
      }
    };

    applyFilters();
  }, [filterMode, photos, selectedPersonIds, people.length]);

  useEffect(() => {
    fetchPhotos();
  }, []);

  if (!showApp) {
    return <HeroSection onEnter={() => setShowApp(true)} />;
  }

  return (
    <main className="relative w-full h-screen overflow-hidden bg-black text-white">

      {/* 3D Spiral Canvas */}
      <div className="absolute inset-0 z-10">
        <SpiralCanvas photos={filteredPhotos} />
      </div>

      {/* UI Overlay - Top Status Bar (iOS/macOS Style) */}
      <div className="absolute top-0 left-0 right-0 z-40 pointer-events-none">
        <div className="flex justify-between items-center px-6 py-4 md:px-8 md:py-6 bg-gradient-to-b from-black/80 to-transparent backdrop-blur-[2px]">
          {/* Left: Brand */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="pointer-events-auto"
          >
            <h1
              onClick={() => setShowApp(false)}
              className="text-2xl md:text-3xl font-bold tracking-tighter hover:opacity-70 transition-opacity"
            >
              whimsy.
            </h1>
            <div className="flex items-center gap-2 mt-0.5 opacity-50">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] md:text-xs font-medium uppercase tracking-widest">
                {filteredPhotos.length} Items
              </span>
            </div>
          </motion.div>

          {/* Right: Primary Actions */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="pointer-events-auto flex items-center gap-2"
          >
            <button
              onClick={() => setShowUpload(!showUpload)}
              className="h-10 w-10 md:w-auto md:px-5 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-white transition-all flex items-center justify-center gap-2 backdrop-blur-xl shadow-2xl"
            >
              <Plus className="w-5 h-5 md:w-4 md:h-4" />
              <span className="hidden md:inline text-sm font-semibold">Add Photos</span>
            </button>

            {/* Desktop-only secondary filter */}
            <div className="hidden md:flex items-center gap-1 p-1 rounded-full bg-black/40 backdrop-blur-xl border border-white/5">
              <button
                onClick={() => { setFilterMode('all'); setSelectedPersonIds([]); }}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${filterMode === 'all' ? 'bg-white text-black' : 'text-white/40 hover:text-white/60'}`}
              >
                LIBRARY
              </button>
              <button
                onClick={() => setFilterMode('people')}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${filterMode === 'people' ? 'bg-white text-black' : 'text-white/40 hover:text-white/60'}`}
              >
                PEOPLE
              </button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Radial Face Selector - iOS Bottom Sheet Style for Mobile */}
      {filterMode === 'people' && people.length > 0 && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed inset-x-0 bottom-0 z-50 pointer-events-auto md:absolute md:bottom-24 md:right-8 md:inset-x-auto"
        >
          {/* Mobile Backdrop */}
          <div className="md:hidden fixed inset-0 bg-black/80 backdrop-blur-sm -z-10" onClick={() => setFilterMode('all')} />

          <div className="relative bg-neutral-900/90 md:bg-transparent backdrop-blur-2xl md:backdrop-blur-none border-t border-white/10 md:border-none rounded-t-[32px] md:rounded-none p-8 md:p-0 flex flex-col items-center">
            {/* iOS Handle */}
            <div className="w-12 h-1.5 bg-white/20 rounded-full mb-8 md:hidden" />

            <RadialFaceSelector
              people={people}
              selectedPersonIds={selectedPersonIds}
              onSelectPerson={(id) => {
                setSelectedPersonIds(prev =>
                  prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
                );
              }}
              onUpdateName={async (id, name) => {
                await updatePersonName(id, name);
                await fetchPhotos();
              }}
            />

            <button
              onClick={() => setFilterMode('all')}
              className="mt-8 px-8 py-3 rounded-full bg-white text-black font-bold text-sm md:hidden shadow-xl"
            >
              DONE
            </button>
          </div>
        </motion.div>
      )}

      {/* Upload Section - Only show when no photos or upload is active */}
      {(photos.length === 0 || showUpload) && !loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 flex items-center justify-center bg-black/95 backdrop-blur-md z-20 pointer-events-auto"
        >
          <div className="relative w-full">
            {showUpload && (
              <motion.button
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                onClick={() => setShowUpload(false)}
                className="absolute top-8 right-8 text-white/50 hover:text-white text-sm font-medium transition-colors flex items-center gap-2 group"
              >
                <span className="group-hover:translate-x-[-2px] transition-transform">✕</span>
                <span>Close</span>
              </motion.button>
            )}
            <UploadSection
              onUploadComplete={() => {
                fetchPhotos();
                setShowUpload(false);
              }}
            />
          </div>
        </motion.div>
      )}

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        filterMode={filterMode}
        onFilterChange={(mode) => {
          setFilterMode(mode);
          if (mode === 'all') setSelectedPersonIds([]);
        }}
        onSettingsClick={() => setShowUpload(true)} // Or dedicated settings modal if needed
        onLayoutClick={() => { }} // Could trigger layout change
      />

    </main>
  );
}
