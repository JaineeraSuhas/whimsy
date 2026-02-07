"use client"

import { motion } from "motion/react"
import UploadDropzone from "../UploadDropzone"

interface UploadSectionProps {
    onUploadComplete: () => void
}

export function UploadSection({ onUploadComplete }: UploadSectionProps) {
    return (
        <div className="relative w-full max-w-3xl mx-auto px-6">
            {/* Main content - clean centered layout */}
            <div className="relative flex flex-col items-center">
                {/* Oversized background text */}
                <motion.div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[10rem] md:text-[14rem] font-bold text-white/[0.015] select-none pointer-events-none leading-none tracking-tighter whitespace-nowrap"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                >
                    UPLOAD
                </motion.div>

                {/* Content container */}
                <div className="relative z-10 text-center space-y-10 py-20">
                    {/* Heading with staggered animation */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                        className="space-y-4"
                    >
                        <h2 className="text-5xl md:text-6xl font-light text-white leading-[1.1] tracking-tight">
                            Your visual journey
                            <br />
                            <span className="font-normal bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-transparent">
                                starts here.
                            </span>
                        </h2>

                        {/* Decorative line */}
                        <motion.div
                            className="w-20 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent mx-auto"
                            initial={{ scaleX: 0, opacity: 0 }}
                            animate={{ scaleX: 1, opacity: 1 }}
                            transition={{ duration: 1, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
                        />
                    </motion.div>

                    {/* Upload dropzone with fade-in */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
                        className="w-full max-w-2xl mx-auto"
                    >
                        <UploadDropzone onUploadComplete={onUploadComplete} />
                    </motion.div>

                    {/* Subtitle with delayed fade */}
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.8, delay: 0.8 }}
                        className="text-sm text-white/40 font-light tracking-wide"
                    >
                        Drop your memories into the arena
                        <span className="hidden md:inline"> • Photos stored locally in your browser</span>
                    </motion.p>
                </div>
            </div>
        </div>
    )
}
