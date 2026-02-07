
import type { Config } from 'tailwindcss';

const config: Config = {
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#0A0A0A',
                    light: '#1A1A1A',
                },
                secondary: {
                    DEFAULT: '#FFFFFF',
                    dark: '#F8F8F8',
                },
                accent: {
                    warm: '#FF6B35',
                    cool: '#4ECDC4',
                },
                gray: {
                    50: '#F8F8F8',
                    100: '#E8E8E8',
                    300: '#ACACAC',
                    500: '#6B6B6B',
                    700: '#3A3A3A',
                    900: '#1A1A1A',
                },
            },
            fontFamily: {
                display: ['var(--font-space-grotesk)', 'sans-serif'],
                body: ['var(--font-inter)', 'sans-serif'],
                mono: ['var(--font-jetbrains-mono)', 'monospace'],
            },
            spacing: {
                '18': '4.5rem',
                '88': '22rem',
                '128': '32rem',
            },
            animation: {
                'fade-in': 'fadeIn 0.5s ease-in-out',
                'slide-up': 'slideUp 0.6s ease-out',
                'spiral-rotate': 'spiralRotate 60s linear infinite',
                'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(30px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                spiralRotate: {
                    '0%': { transform: 'rotate(0deg)' },
                    '100%': { transform: 'rotate(360deg)' },
                },
                pulseGlow: {
                    '0%, 100%': { opacity: '1', boxShadow: '0 0 20px rgba(255, 107, 53, 0.5)' },
                    '50%': { opacity: '0.8', boxShadow: '0 0 40px rgba(255, 107, 53, 0.8)' },
                },
            },
            transitionTimingFunction: {
                'in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
                'out': 'cubic-bezier(0, 0, 0.2, 1)',
                'elastic': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
            },
            transitionDuration: {
                'fast': '150ms',
                'base': '250ms',
                'slow': '400ms',
                'slower': '600ms',
            },
        },
    },
    plugins: [],
};
export default config;
