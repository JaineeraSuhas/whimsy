
'use client';

import React, { useRef, useMemo, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import {
    generateSpiralPositions,
    getCameraPositionForSpiral,
    getOptimalSpiralConfig,
    type SpiralPosition,
} from '@/lib/spiral/spiralMath';

import { ImageData } from '@/types';

interface SpiralCanvasProps {
    images: ImageData[];
    onImageClick?: (image: ImageData) => void;
    mode?: 'standard' | 'deep' | 'lasso';
}

/**
 * Individual image node on the spiral
 */
function ImageNode({
    image,
    position,
    index,
    onClick,
}: {
    image: ImageData;
    position: SpiralPosition;
    index: number;
    onClick: () => void;
}) {
    const meshRef = useRef<THREE.Mesh>(null);
    const [hovered, setHovered] = useState(false);
    const [textureLoaded, setTextureLoaded] = useState(false);

    // Load texture
    const texture = useMemo(() => {
        const loader = new THREE.TextureLoader();
        loader.setCrossOrigin('anonymous');
        return loader.load(
            image.thumbnailUrl,
            (tex) => {
                tex.minFilter = THREE.LinearFilter;
                setTextureLoaded(true);
            },
            undefined,
            (error) => {
                console.error('Texture loading error:', error);
            }
        );
    }, [image.thumbnailUrl]);

    const { camera } = useThree();
    const cameraPosition = camera.position;

    // Animate on hover
    useFrame(() => {
        if (meshRef.current) {
            const targetScale = hovered ? 1.3 : 1;
            meshRef.current.scale.lerp(
                new THREE.Vector3(targetScale, targetScale, targetScale),
                0.1
            );
            // Billboard effect - always face camera
            meshRef.current.lookAt(cameraPosition);
        }
    });

    // Size based on similarity score
    const size = 0.8 + image.similarity * 0.4;

    return (
        <group position={[position.x, position.y, position.z]}>
            <mesh
                ref={meshRef}
                onClick={(e) => {
                    e.stopPropagation();
                    onClick();
                }}
                onPointerOver={(e) => {
                    e.stopPropagation();
                    setHovered(true);
                    document.body.style.cursor = 'pointer';
                }}
                onPointerOut={(e) => {
                    e.stopPropagation();
                    setHovered(false);
                    document.body.style.cursor = 'auto';
                }}
            >
                <planeGeometry args={[size, size]} />
                <meshStandardMaterial
                    map={textureLoaded ? texture : undefined}
                    color={textureLoaded ? '#fff' : '#333'}
                    transparent
                    opacity={textureLoaded ? 1 : 0.5}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {hovered && (
                <Html
                    position={[0, size / 2 + 0.3, 0]}
                    center
                    style={{
                        pointerEvents: 'none',
                        userSelect: 'none',
                        whiteSpace: 'nowrap',
                    }}
                    zIndexRange={[100, 0]}
                >
                    <div className="bg-black/90 text-white px-3 py-2 rounded-lg text-sm max-w-xs backdrop-blur-sm border border-white/10 shadow-xl">
                        <p className="font-semibold truncate max-w-[200px]">
                            {image.metadata?.title || `Image ${index + 1}`}
                        </p>
                        {image.metadata?.source && (
                            <p className="text-gray-400 text-xs">{image.metadata.source}</p>
                        )}
                    </div>
                </Html>
            )}
        </group>
    );
}

/**
 * Spiral path visualization
 */
function SpiralPath({ positions }: { positions: SpiralPosition[] }) {
    const points = useMemo(() => {
        return positions.map(pos => new THREE.Vector3(pos.x, pos.y, pos.z));
    }, [positions]);

    const curve = useMemo(() => {
        if (points.length < 2) return null;
        return new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
    }, [points]);

    const geometry = useMemo(() => {
        if (!curve) return null;
        return new THREE.TubeGeometry(curve, Math.min(points.length * 4, 200), 0.02, 8, false);
    }, [curve, points.length]);

    if (!geometry) return null;

    return (
        <mesh geometry={geometry as any}>
            <meshStandardMaterial
                color="#FF6B35"
                transparent
                opacity={0.3}
                emissive="#FF6B35"
                emissiveIntensity={0.2}
            />
        </mesh>
    );
}

/**
 * Connection lines between related images
 */
function ConnectionLines({
    images,
    positions,
}: {
    images: ImageData[];
    positions: SpiralPosition[];
}) {
    const lines = useMemo(() => {
        const connections: Array<[THREE.Vector3, THREE.Vector3, number]> = [];

        // Connect highly similar images
        // Limit connections to avoid clutter
        const maxConnections = 50;
        let count = 0;

        for (let i = 0; i < images.length && count < maxConnections; i++) {
            for (let j = i + 1; j < images.length; j++) {
                if (Math.abs(images[i].similarity - images[j].similarity) < 0.05) {
                    const start = positions[i];
                    const end = positions[j];
                    const distance = Math.sqrt(
                        Math.pow(end.x - start.x, 2) +
                        Math.pow(end.y - start.y, 2) +
                        Math.pow(end.z - start.z, 2)
                    );

                    // Only show connections for nearby images
                    if (distance < 5) {
                        connections.push([
                            new THREE.Vector3(start.x, start.y, start.z),
                            new THREE.Vector3(end.x, end.y, end.z),
                            images[i].similarity,
                        ]);
                        count++;
                    }
                }
            }
        }

        return connections;
    }, [images, positions]);

    return (
        <group>
            {lines.map(([start, end, similarity], index) => (
                <Line
                    key={`line-${index}`}
                    points={[start, end]}
                    color="#4ECDC4"
                    transparent
                    opacity={similarity * 0.3}
                    lineWidth={1}
                />
            ))}
        </group>
    );
}

/**
 * Scene setup with camera and controls
 */
function SpiralScene({ images, onImageClick }: {
    images: ImageData[];
    onImageClick?: (image: ImageData) => void;
}) {
    const { camera } = useThree();

    const config = useMemo(() => getOptimalSpiralConfig(images.length), [images.length]);
    const positions = useMemo(() => generateSpiralPositions(images.length, config), [images.length, config]);
    const cameraPosition = useMemo(() => getCameraPositionForSpiral(config), [config]);

    // Auto-rotate camera slowly
    useFrame(({ clock }) => {
        const angle = clock.getElapsedTime() * 0.05;
        // Don't override controls if user is interacting, but here we just add subtle movement
        // Doing full override conflicts with OrbitControls. 
        // Instead, let's just use OrbitControls fully or a custom camera rig.
        // For now, we will disable auto-rotate to allow user control.
    });

    return (
        <>
            {/* Lighting */}
            <ambientLight intensity={0.6} />
            <pointLight position={[10, 10, 10]} intensity={0.8} />
            <pointLight position={[-10, -10, -10]} intensity={0.5} color="#4ECDC4" />

            {/* Spiral path */}
            <SpiralPath positions={positions} />

            {/* Connection lines */}
            <ConnectionLines images={images} positions={positions} />

            {/* Image nodes */}
            {images.map((image, index) => (
                <ImageNode
                    key={image.id}
                    image={image}
                    position={positions[index]}
                    index={index}
                    onClick={() => onImageClick?.(image)}
                />
            ))}
        </>
    );
}

/**
 * Main Spiral Canvas Component
 */
export default function SpiralCanvas({ images, onImageClick, mode = 'standard' }: SpiralCanvasProps) {
    const [isLoading, setIsLoading] = useState(true);

    const handleImageClick = useCallback((image: ImageData) => {
        onImageClick?.(image);
    }, [onImageClick]);

    if (images.length === 0) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-transparent">
                <div className="text-center p-8 bg-black/50 backdrop-blur-md rounded-2xl border border-white/10">
                    <p className="text-2xl font-display text-white mb-2">
                        No images found
                    </p>
                    <p className="text-gray-400">
                        Try a different search query
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full relative bg-gradient-to-br from-gray-900 via-black to-gray-900">
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-10">
                    <div className="text-center">
                        <div className="w-16 h-16 border-4 border-accent-warm border-t-transparent rounded-full animate-spin mb-4 mx-auto" />
                        <p className="text-white font-display text-lg">
                            Loading spiral...
                        </p>
                    </div>
                </div>
            )}

            <Canvas
                camera={{ position: [0, 0, 20], fov: 60 }}
                onCreated={() => setIsLoading(false)}
                gl={{
                    antialias: true,
                    alpha: true,
                    powerPreference: 'high-performance',
                }}
            >
                <PerspectiveCamera makeDefault position={[0, 5, 30]} />

                <SpiralScene images={images} onImageClick={handleImageClick} />

                <OrbitControls
                    enablePan={true}
                    enableZoom={true}
                    enableRotate={true}
                    minDistance={5}
                    maxDistance={100}
                    maxPolarAngle={Math.PI / 1.5}
                    minPolarAngle={Math.PI / 6}
                    autoRotate={true}
                    autoRotateSpeed={0.5}
                />
            </Canvas>

            {/* UI Overlay */}
            <div className="absolute top-20 left-4 bg-black/70 backdrop-blur-sm text-white px-4 py-2 rounded-lg border border-white/10">
                <p className="text-sm font-mono text-gray-300">
                    <span className="text-accent-warm">{images.length}</span> images • {mode} mode
                </p>
            </div>

            {/* Controls hint */}
            <div className="absolute bottom-4 right-4 bg-black/70 backdrop-blur-sm text-white px-4 py-2 rounded-lg border border-white/10">
                <p className="text-xs font-mono space-y-1 text-gray-400">
                    <span className="block">🖱️ Drag to rotate</span>
                    <span className="block">🔍 Scroll to zoom</span>
                    <span className="block">👆 Click images for details</span>
                </p>
            </div>
        </div>
    );
}
