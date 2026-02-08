"use client";

import { useEffect, useState, useRef } from 'react';
import { motion, stagger, useAnimate, AnimatePresence } from "motion/react";
import UploadDropzone from '@/components/UploadDropzone';
import SpiralCanvas from '@/components/SpiralCanvas';
import Floating, { FloatingElement } from '@/components/ui/parallax-floating';
import { getAllPhotos, Photo, getPhotosByPeople, updatePersonName } from '@/lib/db';
import { Grid, Users, Plus, Library } from 'lucide-react';
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
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<'all' | 'people'>('all');
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [showPeopleModal, setShowPeopleModal] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'spiral' | 'sphere' | 'grid' | 'wave' | 'helix' | 'cylinder'>('spiral');

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

  const handleLibraryClick = () => {
    setFilterMode('all');
    setSelectedPersonIds([]);
    setShowPeopleModal(false);
    setShowUpload(false);
    setShowSettings(false);
  };

  if (!showApp) {
    return <HeroSection onEnter={() => setShowApp(true)} />;
  }

  return (
    <main className="relative w-full h-screen overflow-hidden bg-black text-white">

      {/* 3D Spiral Canvas - Lower z-index to stay below UI */}
      <div className="absolute inset-0 z-0">
        <SpiralCanvas photos={filteredPhotos} externalLayoutMode={layoutMode} onLayoutChange={setLayoutMode} />
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
              onClick={handleLibraryClick}
              className="text-2xl md:text-3xl font-bold tracking-tighter hover:opacity-70 transition-opacity cursor-pointer"
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
              onClick={() => { setShowUpload(true); setShowPeopleModal(false); setShowSettings(false); }}
              className="h-10 w-10 md:w-auto md:px-5 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-white transition-all flex items-center justify-center gap-2 backdrop-blur-xl shadow-2xl z-50"
            >
              <Plus className="w-5 h-5 md:w-4 md:h-4" />
              <span className="hidden md:inline text-sm font-semibold">Add Photos</span>
            </button>

            {/* Desktop-only secondary filter */}
            <div className="hidden md:flex items-center gap-1 p-1 rounded-full bg-black/40 backdrop-blur-xl border border-white/5">
              <button
                onClick={handleLibraryClick}
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

      {/* People Modal - Dedicated iOS Popup Interface */}
      <AnimatePresence>
        {showPeopleModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black pointer-events-auto"
          >
            <div className="absolute top-8 left-1/2 -translate-x-1/2 text-center">
              <h2 className="text-xl font-bold tracking-tight">People</h2>
              <p className="text-xs opacity-50 uppercase tracking-widest mt-1">Select faces to filter photos</p>
            </div>

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

            {/* Mobile Layout Selector (Rotating options) */}
            <div className="mt-8 mb-4 flex flex-wrap justify-center gap-2 max-w-[280px]">
              {['spiral', 'sphere', 'grid', 'helix'].map((m) => (
                <button
                  key={m}
                  onClick={() => setLayoutMode(m as any)}
                  className={`px-4 py-2 rounded-full text-[10px] uppercase font-black tracking-widest border transition-all ${layoutMode === m ? 'bg-white text-black border-white' : 'text-white/40 border-white/10'}`}
                >
                  {m}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowPeopleModal(false)}
              className="mt-12 px-12 py-4 rounded-full bg-white text-black font-extrabold text-sm shadow-2xl hover:scale-105 active:scale-95 transition-all"
            >
              DONE
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal Placeholder */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/90 backdrop-blur-3xl pointer-events-auto p-12 text-center"
          >
            <h2 className="text-3xl font-bold mb-8">Settings</h2>
            <div className="w-full max-w-sm space-y-4">
              <button
                onClick={() => { if (confirm("Clear all data?")) { localStorage.clear(); window.location.reload(); } }}
                className="w-full py-4 rounded-2xl bg-red-500/20 text-red-500 border border-red-500/30 font-bold"
              >
                Reset Library
              </button>
              <div className="py-4 px-6 rounded-2xl bg-white/5 border border-white/10 text-xs opacity-50">
                Version 0.2.1 • iOS Edition
              </div>
            </div>
            <button
              onClick={() => setShowSettings(false)}
              className="mt-12 text-white/50 hover:text-white font-medium"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload Section - High z-index with explicit Close btn fix */}
      <AnimatePresence>
        {(photos.length === 0 || showUpload) && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center bg-black/98 backdrop-blur-2xl z-[70] pointer-events-auto"
          >
            {/* Explicit Close Button on Top Level */}
            <button
              onClick={() => setShowUpload(false)}
              className="fixed top-8 right-8 z-[80] p-4 bg-white/10 rounded-full text-white hover:bg-white/20 transition-all font-bold"
            >
              <Plus className="w-6 h-6 rotate-45" />
            </button>

            <div className="w-full max-w-4xl px-6">
              <UploadSection
                onUploadComplete={() => {
                  fetchPhotos();
                  setShowUpload(false);
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Navigation - Higher z-index but below Modals */}
      <MobileBottomNav
        filterMode={filterMode}
        onFilterChange={(mode) => {
          if (mode === 'people') {
            setFilterMode('people');
            setShowPeopleModal(true);
            setShowUpload(false);
            setShowSettings(false);
          } else {
            handleLibraryClick();
          }
        }}
        onSettingsClick={() => { setShowSettings(true); setShowUpload(false); setShowPeopleModal(false); }}
        onLayoutClick={() => { }}
      />

    </main>
  );
}
