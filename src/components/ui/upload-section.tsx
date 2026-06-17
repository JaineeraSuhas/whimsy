"use client"

import { motion } from "motion/react"
import UploadDropzone from "../UploadDropzone"
import { InnerGlobeBackground } from "./InnerGlobeBackground"

interface UploadSectionProps {
    onUploadComplete: () => void
    onBack?: () => void
}

export function UploadSection({ onUploadComplete, onBack }: UploadSectionProps) {
    const handleUploadComplete = () => {
        onUploadComplete()
    }

    return (
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-black">
            <InnerGlobeBackground />
            
            {/* Header / Back Button */}
            <div className="absolute top-0 left-0 right-0 z-40 pointer-events-none">
                <div className="flex justify-between items-center px-6 py-4 md:px-8 md:py-6">
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="pointer-events-auto">
                        <h1 onClick={onBack} className="text-2xl md:text-3xl font-bold tracking-tighter hover:opacity-70 transition-opacity cursor-pointer text-white">
                            whimsy.
                        </h1>
                    </motion.div>
                </div>
            </div>

            {/* Main content - clean centered layout */}
            <div className="relative flex flex-col items-center justify-center z-20 w-full h-full px-4">
                <div className="w-full max-w-5xl flex flex-col items-center justify-center space-y-8 md:space-y-10">
                    
                    {/* Heading with staggered animation and Text Wrap effect */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                        className="space-y-6 w-full"
                    >
                        <h2 className="text-4xl md:text-6xl lg:text-[72px] font-bold leading-[1.15] tracking-tight text-center max-w-5xl mx-auto text-[#555555]" style={{ fontFamily: 'Inter, sans-serif' }}>
                            <span className="text-white">Your</span>{' '}
                            <span className="inline-flex items-center justify-center align-middle mx-1 md:mx-2 relative w-[90px] h-[40px] md:w-[150px] md:h-[60px]" style={{ lineHeight: 0 }}>
                                <img src="/oec/2d410fee21c7e276e22ae2bd62a9dbac.jpg" className="absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 md:w-16 md:h-16 rounded-xl object-cover border-2 md:border-[3px] border-black -rotate-12 z-10" alt="img1" />
                                <img src="/oec/6826d7c4c9992ee415ed3074298e251a.jpg" className="absolute left-[30%] top-1/2 -translate-y-1/2 w-10 h-10 md:w-16 md:h-16 rounded-xl object-cover border-2 md:border-[3px] border-black rotate-6 z-20" alt="img2" />
                                <img src="/oec/424cbb4357dba34f677833150f272dcf.jpg" className="absolute left-[60%] top-1/2 -translate-y-1/2 w-10 h-10 md:w-16 md:h-16 rounded-xl object-cover border-2 md:border-[3px] border-black rotate-[12deg] z-30" alt="img3" />
                            </span>{' '}
                            visual journey,
                            <br className="hidden md:inline" />
                            starts{' '}
                            <span className="inline-flex items-center justify-center align-middle mx-1 md:mx-2 w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl overflow-hidden border-2 md:border-[3px] border-white relative" style={{ lineHeight: 0 }}>
                                <img src="/oec/3f6bcda6b22efb287866b537cd8afd7d.jpg" className="w-full h-full object-cover" alt="icon image" />
                            </span>{' '}
                            <span className="text-white">right here,</span>
                            <br className="hidden md:inline" />
                            drop your{' '}
                            <span className="inline-flex items-center justify-center align-middle mx-1 md:mx-2 w-8 h-8 md:w-12 md:h-12" style={{ lineHeight: 0 }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full rotate-45 drop-shadow-md">
                                    <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5L21 16z" />
                                </svg>
                            </span>{' '}
                            photos now!
                        </h2>
                    </motion.div>

                    {/* Upload interaction area grouped tightly */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
                        className="w-full max-w-[600px] mx-auto flex flex-col items-center space-y-4"
                    >
                        <div className="w-full bg-black/40 backdrop-blur-md rounded-3xl p-3 border border-white/10 shadow-2xl">
                            <UploadDropzone onUploadComplete={handleUploadComplete} />
                        </div>

                        {/* Subtitle directly underneath the dropzone */}
                        <p className="text-[13px] md:text-sm text-white/50 font-medium tracking-wide text-center">
                            Drop your memories into the arena
                            <span className="hidden sm:inline"> • Photos stored locally in your browser</span>
                        </p>
                    </motion.div>
                </div>
            </div>
        </div>
    )
}

