
import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  transpilePackages: ['@tensorflow/tfjs', '@tensorflow-models/face-detection', '@mediapipe/face_detection'],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@mediapipe/face_detection': path.join(process.cwd(), 'src/lib/mediapipe_shim.js'),
    };
    // Fix for potential node dependency issues in browser contexts
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
      encoding: false, // Fix for face-api.js/node-fetch issues on Vercel
    };
    return config;
  },
};

export default nextConfig;
