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
      <div className="absolute inset-0 z-0">
        <SpiralCanvas photos={filteredPhotos} />
      </div>

      {/* UI Overlay - Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none">
        <div className="flex justify-between items-center p-6 md:p-8">
          {/* Left: Logo and Photo Count */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="pointer-events-auto"
          >
            <h1
              onClick={() => setShowApp(false)}
              className="text-3xl md:text-4xl font-bold tracking-tighter mix-blend-difference cursor-pointer hover:opacity-70 transition-opacity"
            >
              whimsy.
            </h1>
            <p className="text-xs md:text-sm opacity-60 mix-blend-difference mt-1">
              {filteredPhotos.length} {filteredPhotos.length === 1 ? 'photo' : 'photos'}
            </p>
          </motion.div>

          {/* Right: macOS-style Navigation */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="pointer-events-auto flex items-center gap-3"
          >
            {/* Segmented Control - macOS Style */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 backdrop-blur-md border border-white/10">
              <button
                onClick={() => {
                  setFilterMode('all');
                  setSelectedPersonIds([]);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${filterMode === 'all'
                  ? 'bg-white/20 text-white shadow-lg'
                  : 'text-white/60 hover:text-white/80'
                  }`}
              >
                <Grid className="w-4 h-4" />
                <span className="hidden md:inline">All Photos</span>
              </button>
              <button
                onClick={() => setFilterMode('people')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${filterMode === 'people'
                  ? 'bg-white/20 text-white shadow-lg'
                  : 'text-white/60 hover:text-white/80'
                  }`}
              >
                <Users className="w-4 h-4" />
                <span className="hidden md:inline">People</span>
                {people.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-white/20">
                    {people.length}
                  </span>
                )}
              </button>
            </div>

            {/* Upload Button - iOS Style */}
            <button
              onClick={() => setShowUpload(!showUpload)}
              className="h-10 px-4 rounded-xl bg-gradient-to-b from-white/15 to-white/5 hover:from-white/20 hover:to-white/10 border border-white/20 text-white transition-all duration-200 flex items-center gap-2 backdrop-blur-md shadow-lg hover:shadow-xl"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden md:inline text-sm font-medium">Add Photos</span>
            </button>
          </motion.div>
        </div>
      </div>

      {/* Radial Face Selector - Show when People filter is active */}
      {filterMode === 'people' && people.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.4 }}
          className="absolute bottom-24 right-8 z-10 pointer-events-auto"
        >
          <RadialFaceSelector
            people={people}
            selectedPersonIds={selectedPersonIds}
            onSelectPerson={(id) => {
              setSelectedPersonIds(prev =>
                prev.includes(id)
                  ? prev.filter(p => p !== id)
                  : [...prev, id]
              );
            }}
            onUpdateName={async (id, name) => {
              await updatePersonName(id, name);
              await fetchPhotos();
            }}
          />
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

    </main>
  );
}
