"use client";

import React, { useRef, useState, useEffect } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Caveat } from "next/font/google";

const scribbleFont = Caveat({ subsets: ["latin"], weight: ["400", "700"] });

interface RevealCardProps {
  /** 
   * Pass your custom image URL here! 
   * Example: <RevealCard imageUrl="/your-image.png" />
   */
  imageUrl?: string;
}

export const RevealCard: React.FC<RevealCardProps> = ({ 
  // Uses the specific image provided by the user!
  imageUrl = "/author-card.jpg" 
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Framer Motion values for the 3D hover tilt effect
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Smooth springs for realistic physics on hover
  const mouseXSpring = useSpring(x, { stiffness: 300, damping: 40 });
  const mouseYSpring = useSpring(y, { stiffness: 300, damping: 40 });

  // Map mouse coordinates to tilt rotation
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["20deg", "-20deg"]);
  const hoverRotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-20deg", "20deg"]);
  
  // Map mouse to the shiny reflection position for sweeping dynamic light movement!
  const shineX = useTransform(mouseXSpring, [-0.5, 0.5], ["-100%", "100%"]);
  const shineY = useTransform(mouseYSpring, [-0.5, 0.5], ["-100%", "100%"]);

  // Mobile tilt support
  useEffect(() => {
    // Only apply on touch devices to avoid conflicting with desktop mouse
    if (typeof window !== "undefined" && window.matchMedia("(hover: none)").matches) {
      const handleOrientation = (e: DeviceOrientationEvent) => {
        if (e.gamma !== null && e.beta !== null) {
          // Normal holding angle assumed to be ~45 degrees (beta)
          const tiltX = Math.max(-0.5, Math.min(0.5, e.gamma / 60));
          const tiltY = Math.max(-0.5, Math.min(0.5, (e.beta - 45) / 60));
          
          mouseXSpring.set(tiltX);
          mouseYSpring.set(tiltY);
          
          // If we tilt it strongly, simulate a hover to reveal the shine
          if (Math.abs(tiltX) > 0.1 || Math.abs(tiltY) > 0.1) {
             setIsHovered(true);
          } else {
             setIsHovered(false);
          }
        }
      };
      
      window.addEventListener("deviceorientation", handleOrientation);
      return () => window.removeEventListener("deviceorientation", handleOrientation);
    }
  }, [mouseXSpring, mouseYSpring]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current || isFlipped) return; // Disable hover tilt while flipped
    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    x.set(mouseX / width - 0.5);
    y.set(mouseY / height - 0.5);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    x.set(0);
    y.set(0);
  };

  return (
    <div className="relative inline-block perspective-[1000px]">
      {/* Outer Tilt Container */}
      <motion.div
        ref={ref}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          rotateX: isFlipped ? 0 : rotateX,
          rotateY: isFlipped ? 0 : hoverRotateY,
          transformStyle: "preserve-3d",
        }}
        // Made it MORE SMALL: 70px wide, 110px tall
        className="relative flex w-[70px] h-[110px] items-center justify-center rounded-[8px] shadow-[0_10px_20px_rgba(0,0,0,0.5)] group cursor-pointer"
      >
        {/* Inner Flip Container */}
        <motion.div
          onClick={() => setIsFlipped(!isFlipped)}
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          style={{ transformStyle: "preserve-3d" }}
          className="relative w-full h-full rounded-[8px]"
        >
          {/* FRONT SIDE (The Vertical Photo & Glossy Shine) */}
          <div 
            className="absolute inset-0 w-full h-full rounded-[8px] overflow-hidden bg-black"
            style={{ backfaceVisibility: "hidden" }}
          >
            {/* Photo Background */}
            <div 
              className="absolute inset-0 w-full h-full"
              style={{
                backgroundImage: `url(${imageUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
            
            {/* Dynamic Thin Sweeping Shine! */}
            <motion.div 
              className="absolute -inset-[100%] z-10 pointer-events-none mix-blend-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: isHovered && !isFlipped ? 1 : 0 }}
              transition={{ duration: 0.3 }}
              style={{
                x: shineX,
                y: shineY,
                backgroundImage: `linear-gradient(135deg, transparent 40%, rgba(255,255,255,1) 48%, rgba(255,255,255,1) 52%, transparent 60%)`,
                filter: "blur(4px)",
              }}
            />
          </div>

          {/* BACK SIDE (White Background, Black Text) */}
          <div 
            className="absolute inset-0 w-full h-full rounded-[8px] bg-white flex items-center justify-center overflow-hidden border border-black/10 shadow-inner"
            style={{ 
              backfaceVisibility: "hidden", 
              transform: "rotateY(180deg)" 
            }}
          >
            <span 
              className={`text-[9px] font-bold text-black tracking-[0.2em] ${scribbleFont.className}`}
              style={{
                writingMode: "vertical-lr",
                textOrientation: "upright",
                lineHeight: "1.8",
                WebkitTextSizeAdjust: "none",
                textSizeAdjust: "none"
              }}
            >
              suhas<br />jaineera<br /><span className="inline-block translate-y-[3px]" style={{ textOrientation: "mixed" }}>:)</span>
            </span>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};
