
'use client';

import React from 'react';
import { motion } from 'framer-motion';
import SearchBar from '../search/SearchBar';

interface HeroProps {
    onSearch: (query: string) => void;
}

export default function Hero({ onSearch }: HeroProps) {
    return (
        <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-black via-gray-900 to-black">
            {/* Animated Background */}
            <div className="absolute inset-0 overflow-hidden">
                <motion.div
                    className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent-warm/20 rounded-full blur-3xl"
                    animate={{
                        x: [0, 100, 0],
                        y: [0, -50, 0],
                        scale: [1, 1.2, 1],
                    }}
                    transition={{
                        duration: 20,
                        repeat: Infinity,
                        ease: 'easeInOut',
                    }}
                />
                <motion.div
                    className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-cool/20 rounded-full blur-3xl"
                    animate={{
                        x: [0, -100, 0],
                        y: [0, 50, 0],
                        scale: [1, 1.3, 1],
                    }}
                    transition={{
                        duration: 25,
                        repeat: Infinity,
                        ease: 'easeInOut',
                    }}
                />
            </div>

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-20">
                {/* Logo/Brand */}
                <motion.div
                    initial={{ opacity: 0, y: -30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="mb-8"
                >
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <motion.div
                                className="w-16 h-16 rounded-full bg-gradient-to-br from-accent-warm to-accent-cool"
                                animate={{
                                    rotate: 360,
                                    scale: [1, 1.1, 1],
                                }}
                                transition={{
                                    rotate: {
                                        duration: 20,
                                        repeat: Infinity,
                                        ease: 'linear',
                                    },
                                    scale: {
                                        duration: 2,
                                        repeat: Infinity,
                                        ease: 'easeInOut',
                                    },
                                }}
                            />
                            <div className="absolute inset-2 bg-black rounded-full" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <svg
                                    className="w-10 h-10 text-white"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={1.5}
                                        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                                    />
                                </svg>
                            </div>
                        </div>
                        <h1 className="text-6xl md:text-7xl font-display font-bold text-white tracking-tight">
                            SPIRAL
                        </h1>
                    </div>
                    <p className="text-gray-400 font-mono text-sm mt-2 text-center">
                        by SOOT
                    </p>
                </motion.div>

                {/* Tagline */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
                    className="mb-12 text-center max-w-3xl"
                >
                    <h2 className="text-3xl md:text-5xl font-display font-bold text-white mb-4 leading-tight">
                        The first intelligent
                        <br />
                        <span className="bg-gradient-to-r from-accent-warm to-accent-cool bg-clip-text text-transparent">
                            visual search engine
                        </span>
                    </h2>
                    <p className="text-lg md:text-xl text-gray-400 font-body">
                        See everything. Discover connections, patterns, and ideas
                        <br className="hidden md:block" />
                        you didn&apos;t even know you were looking for.
                    </p>
                </motion.div>

                {/* Search Bar */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
                    className="w-full max-w-4xl px-4"
                >
                    <SearchBar
                        onSearch={onSearch}
                        autoFocus
                        placeholder="Try: 'the evolution of Tokyo street fashion from 1980 to now'"
                    />
                </motion.div>

                {/* Feature Pills */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.6 }}
                    className="mt-12 flex flex-wrap gap-4 justify-center"
                >
                    {[
                        { icon: '🌀', text: 'Spiral Geometry' },
                        { icon: '🔍', text: 'Deep Mode' },
                        { icon: '🎯', text: 'Lasso Search' },
                        { icon: '✨', text: 'AI-Powered' },
                    ].map((feature) => (
                        <motion.div
                            key={feature.text}
                            whileHover={{ scale: 1.05, y: -5 }}
                            whileTap={{ scale: 0.95 }}
                            className="px-6 py-3 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl hover:border-accent-warm/50 transition-all cursor-pointer group"
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-2xl group-hover:scale-110 transition-transform">
                                    {feature.icon}
                                </span>
                                <span className="font-display font-semibold text-white">
                                    {feature.text}
                                </span>
                            </div>
                        </motion.div>
                    ))}
                </motion.div>

                {/* Scroll Indicator */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.8 }}
                    className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
                >
                    <motion.div
                        animate={{ y: [0, 10, 0] }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: 'easeInOut',
                        }}
                        className="w-6 h-10 border-2 border-white/30 rounded-full flex items-start justify-center p-2"
                    >
                        <motion.div
                            animate={{ y: [0, 12, 0] }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: 'easeInOut',
                            }}
                            className="w-1.5 h-3 bg-white/50 rounded-full"
                        />
                    </motion.div>
                </motion.div>
            </div>
        </div>
    );
}
