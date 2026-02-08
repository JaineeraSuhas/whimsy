
"use client";

import { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Html } from '@react-three/drei';
import * as THREE from 'three';
import { getAllPhotos, Photo } from '@/lib/db';
import { CircleMenu } from '@/components/ui/circle-menu';
import { Grid3x3, Circle, Sparkles, Waves, Dna, Cylinder, Settings } from 'lucide-react';

// 1. Precise Global Cache to persist textures across re-renders
class GlobalTextureCache {
    private static cache = new Map<string, THREE.Texture>();

    static get(id: string) { return this.cache.get(id); }
    static set(id: string, tex: THREE.Texture) { this.cache.set(id, tex); }
    static clear() {
        this.cache.forEach(tex => tex.dispose());
        this.cache.clear();
    }
}

// 2. Dual-Mode Loader: Strict Serial for Mobile, Parallel for Desktop
class TextureLoaderSystem {
    private static serialQueue: (() => Promise<void>)[] = [];
    private static isProcessing = false;

    static async load(id: string, url: string, gl: THREE.WebGLRenderer): Promise<THREE.Texture> {
        const isMobile = window.innerWidth < 768;

        // DESKTOP PATH: Instant Parallel Loading (High Quality)
        if (!isMobile) {
            return new Promise((resolve, reject) => {
                new THREE.TextureLoader().load(
                    url,
                    (tex) => {
                        const maxAnisotropy = gl.capabilities.getMaxAnisotropy();
                        tex.anisotropy = Math.min(maxAnisotropy, 16);
                        tex.minFilter = THREE.LinearMipmapLinearFilter;
                        tex.magFilter = THREE.LinearFilter;
                        tex.generateMipmaps = true;
                        tex.colorSpace = THREE.SRGBColorSpace;
                        tex.needsUpdate = true;
                        resolve(tex);
                    },
                    undefined,
                    reject
                );
            });
        }

        // MOBILE PATH: Strict Serial Queue (Safe Mode)
        return new Promise((resolve, reject) => {
            this.serialQueue.push(async () => {
                try {
                    let tex: THREE.Texture;

                    // Safari Optimization: Use ImageBitmap if available and on mobile
                    if (typeof createImageBitmap !== 'undefined') {
                        const response = await fetch(url);
                        const blob = await response.blob();
                        const imageBitmap = await createImageBitmap(blob);
                        tex = new THREE.CanvasTexture(imageBitmap);
                    } else {
                        const loader = new THREE.TextureLoader();
                        tex = await loader.loadAsync(url);
                    }

                    // Low memory settings
                    tex.anisotropy = 1;
                    tex.minFilter = THREE.LinearFilter;
                    tex.magFilter = THREE.LinearFilter;
                    tex.generateMipmaps = false;
                    tex.colorSpace = THREE.SRGBColorSpace;
                    tex.needsUpdate = true;

                    resolve(tex);
                } catch (err) {
                    console.warn(`[SerialLoader] Failed ${id}:`, err);
                    reject(err);
                }
                // Breathable delay (100ms) for mobile thread stability
                await new Promise(r => setTimeout(r, 100));
            });

            this.processQueue();
        });
    }

    private static async processQueue() {
        if (this.isProcessing || this.serialQueue.length === 0) return;
        this.isProcessing = true;

        while (this.serialQueue.length > 0) {
            const task = this.serialQueue.shift();
            if (task) {
                try {
                    await task();
                } catch (e) {
                    console.error("[SerialLoader] Task error:", e);
                }
            }
        }

        this.isProcessing = false;
    }
}

function PhotoMesh({ photo, position, rotation, onClick, index, layoutMode }: { photo: Photo, position: [number, number, number], rotation: [number, number, number], onClick: (p: Photo) => void, index: number, layoutMode: string }) {
    const meshRef = useRef<THREE.Mesh>(null);
    const [texture, setTexture] = useState<THREE.Texture | null>(() => GlobalTextureCache.get(photo.id) || null);
    const [isLoading, setIsLoading] = useState(!GlobalTextureCache.get(photo.id));
    const [hovered, setHovered] = useState(false);
    const { gl, camera } = useThree();

    // Random drift parameters for particles
    const driftSpeed = useMemo(() => Math.random() * 0.2 + 0.1, []);
    const driftOffset = useMemo(() => Math.random() * Math.PI * 2, []);

    useEffect(() => {
        if (texture) return;

        let isCancelled = false;
        const url = URL.createObjectURL(photo.thumbnail);

        setIsLoading(true);
        TextureLoaderSystem.load(photo.id, url, gl)
            .then(tex => {
                if (isCancelled) {
                    tex.dispose();
                    URL.revokeObjectURL(url);
                    return;
                }
                GlobalTextureCache.set(photo.id, tex);
                setTexture(tex);
                setIsLoading(false);
                URL.revokeObjectURL(url);
            })
            .catch(err => {
                console.error(`Failed to load texture ${photo.id}:`, err);
                URL.revokeObjectURL(url);
                setIsLoading(false);
            });

        return () => {
            isCancelled = true;
            // No disposal here; persistent cache handles it
        };
    }, [photo.id, gl]);

    useFrame((state) => {
        if (meshRef.current) {
            // Enhanced floating for particles
            if (layoutMode === 'particles') {
                // Float up and down
                meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * driftSpeed + driftOffset) * 2;
                // Gentle rotation
                meshRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.5 + driftOffset) * 0.1;
                // Look at camera for particles to make them engaging
                meshRef.current.lookAt(camera.position);
            } else {
                // Standard subtle float for other modes
                // Reset rotation caused by 'particles' lookAt to ensure flat alignment with group
                meshRef.current.rotation.set(0, 0, 0);

                // Add standard subtle float
                // We use a local y offset reset to prevent accumulation if we were strictly adding
                // But since position prop changes on layout switch, the group moves. 
                // The mesh position is local.
                // Let's us a simple sine wave for local float instead of specific accumulation to avoid drift
                meshRef.current.position.y = Math.sin(state.clock.elapsedTime + position[0]) * 0.1; // Reduced float amplitude
            }
        }
    });

    // Calculate aspect ratio for plane geometry
    const aspect = photo.metadata.width / photo.metadata.height;
    const height = 1.5; // Base height unit
    const width = height * aspect;

    return (
        <group position={position} rotation={rotation}>
            {/* PROGRESSIVE HYDRA LOADING: Show glass placeholder until texture is ready */}
            {isLoading && (
                <mesh>
                    <planeGeometry args={[width, height]} />
                    <meshPhysicalMaterial
                        transparent
                        opacity={0.3}
                        roughness={0.1}
                        transmission={0.8}
                        thickness={1}
                        color="#ffffff"
                    />
                </mesh>
            )}

            {/* Main Photo Mesh - only visible when texture exists */}
            {texture && (
                <mesh
                    ref={meshRef}
                    onClick={(e) => { e.stopPropagation(); onClick(photo); }}
                    onPointerOver={() => { document.body.style.cursor = 'pointer'; setHovered(true); }}
                    onPointerOut={() => { document.body.style.cursor = 'default'; setHovered(false); }}
                >
                    <planeGeometry args={[width, height]} />
                    <meshBasicMaterial
                        map={texture}
                        transparent={true}
                        side={THREE.DoubleSide}
                        toneMapped={false}
                    />
                </mesh>
            )}

            {/* Border / Frame */}
            <mesh position={[0, 0, -0.01]}>
                <planeGeometry args={[width + 0.05, height + 0.05]} />
                <meshBasicMaterial color={hovered ? "#FF4D00" : "#FFFFFF"} opacity={0.3} transparent />
            </mesh>


        </group>
    );
}

// Helper to get positions based on layout
function getLayoutPositions(photos: Photo[], layout: 'spiral' | 'sphere' | 'particles' | 'wave' | 'helix' | 'cylinder', viewport: { width: number, height: number }) {
    const isMobile = viewport.width < 768; // Simple breakpoint check

    // Deterministic random generator for consistent particle positions per photo
    const seededRandom = (seed: number) => {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    };

    return photos.map((photo, index) => {
        let pos: [number, number, number] = [0, 0, 0];
        let rot: [number, number, number] = [0, 0, 0];

        if (layout === 'spiral') {
            const spacing = isMobile ? 0.6 : 0.4;
            const angle = index * spacing;
            const yOffset = isMobile ? 0.3 : 0.5;
            const y = index * yOffset - (photos.length * (yOffset / 2)); // Center vertically
            const radiusBase = isMobile ? 5 : 8;
            const r = radiusBase + (index * (isMobile ? 0.05 : 0.1));
            pos = [r * Math.cos(angle), y, r * Math.sin(angle)];
            rot = [0, -angle + Math.PI / 2 + Math.PI, 0];
        }
        else if (layout === 'sphere') {
            // Fibonacci Sphere
            const phi = Math.acos(-1 + (2 * index) / Math.max(1, photos.length - 1));
            const theta = Math.sqrt(photos.length * Math.PI) * phi;
            const r = isMobile ? 15 : 25; // Radius

            pos = [
                r * Math.cos(theta) * Math.sin(phi),
                r * Math.cos(phi),
                r * Math.sin(theta) * Math.sin(phi)
            ];
            // Rotate to face center (0,0,0)
            const lookAt = new THREE.Vector3(...pos).normalize();
            const rotMatrix = new THREE.Matrix4().lookAt(
                new THREE.Vector3(...pos),
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 1, 0)
            );
            const euler = new THREE.Euler().setFromRotationMatrix(rotMatrix);
            rot = [euler.x, euler.y, euler.z];
        }
        else if (layout === 'particles') {
            // Random Cloud / Particles
            // Use index as seed to keep positions stable across calls
            const rX = seededRandom(index * 13.5) - 0.5;
            const rY = seededRandom(index * 27.2) - 0.5;
            const rZ = seededRandom(index * 41.9) - 0.5;

            const spread = isMobile ? 20 : 35;

            pos = [rX * spread, rY * spread, rZ * spread];
            // Rotation is handled by lookAt in useFrame, init to 0
            rot = [0, 0, 0];
        }
        else if (layout === 'wave') {
            const cols = isMobile ? 4 : 8;
            const spacing = isMobile ? 2 : 3;
            const x = (index % cols) * spacing - (cols * spacing) / 2;
            const z = Math.floor(index / cols) * spacing - 10;
            const y = Math.sin(x * 0.3) * 3 + Math.cos(z * 0.2) * 2;
            pos = [x, y, z];
            rot = [0, 0, 0];
        }
        else if (layout === 'helix') {
            const angle = index * (isMobile ? 0.8 : 0.6);
            const y = index * (isMobile ? 0.6 : 0.8) - (photos.length * 0.4);
            const r = isMobile ? 8 : 12;
            pos = [r * Math.cos(angle), y, r * Math.sin(angle)];
            rot = [0, -angle + Math.PI / 2, 0];
        }
        else if (layout === 'cylinder') {
            const rows = Math.ceil(photos.length / (isMobile ? 6 : 12));
            const photosPerRow = Math.ceil(photos.length / rows);
            const row = Math.floor(index / photosPerRow);
            const col = index % photosPerRow;
            const angle = (col / photosPerRow) * Math.PI * 2;
            const r = isMobile ? 8 : 15;
            const y = row * 3 - (rows * 1.5);
            pos = [r * Math.cos(angle), y, r * Math.sin(angle)];
            rot = [0, -angle + Math.PI / 2 + Math.PI, 0];
        }

        return { photo, position: pos, rotation: rot, index };
    });
}

function SpiralScene({ photos, layoutMode }: { photos: Photo[], layoutMode: 'spiral' | 'sphere' | 'particles' | 'wave' | 'helix' | 'cylinder' }) {
    const { camera, viewport } = useThree();
    const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

    // Smooth layout transitions could be added here with spring, but direct switch for now
    const layoutItems = useMemo(() => getLayoutPositions(photos, layoutMode, { width: viewport.width, height: viewport.height }), [photos, layoutMode, viewport]);

    return (
        <>
            <OrbitControls enableDamping dampingFactor={0.05} autoRotate={true} autoRotateSpeed={0.5} />

            <group>
                {layoutItems.map((item) => (
                    <PhotoMesh
                        key={item.photo.id}
                        {...item}
                        layoutMode={layoutMode}
                        onClick={setSelectedPhoto}
                    />
                ))}
            </group>

            {/* Selected Photo Overlay */}
            {selectedPhoto && (
                <Html fullscreen style={{ pointerEvents: 'none' }}>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-black/80 backdrop-blur-md z-50 animate-in fade-in duration-200" onClick={() => setSelectedPhoto(null)}>
                        <img
                            src={URL.createObjectURL(selectedPhoto.blob)}
                            className="max-h-[85vh] max-w-[85vw] shadow-2xl rounded-lg border border-white/10"
                        />
                        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-white/80 font-mono text-xs tracking-widest uppercase">
                            {new Date(selectedPhoto.metadata.date).toLocaleDateString()}
                        </div>
                    </div>
                </Html>
            )}
        </>
    );
}

interface SpiralCanvasProps {
    photos: Photo[];
    externalLayoutMode?: 'spiral' | 'sphere' | 'particles' | 'wave' | 'helix' | 'cylinder';
    onLayoutChange?: (mode: 'spiral' | 'sphere' | 'particles' | 'wave' | 'helix' | 'cylinder') => void;
    onClearPhotos?: () => void;
}

export default function SpiralCanvas({ photos, externalLayoutMode, onLayoutChange, onClearPhotos }: SpiralCanvasProps) {
    const [internalLayoutMode, setInternalLayoutMode] = useState<'spiral' | 'sphere' | 'particles' | 'wave' | 'helix' | 'cylinder'>('spiral');
    const layoutMode = externalLayoutMode || internalLayoutMode;
    const setLayoutMode = onLayoutChange || setInternalLayoutMode;

    const [showSettings, setShowSettings] = useState(false);

    const handleClear = () => {
        GlobalTextureCache.clear();
        if (onClearPhotos) onClearPhotos();
    };

    // Auto-clear cache if photos are externally cleared
    useEffect(() => {
        if (photos.length === 0) {
            GlobalTextureCache.clear();
        }
    }, [photos.length]);

    const layoutOptions = [
        { id: 'layout-spiral', value: 'spiral', label: 'Spiral' },
        { id: 'layout-sphere', value: 'sphere', label: 'Sphere' },
        { id: 'layout-particles', value: 'particles', label: 'Particles' },
        { id: 'layout-wave', value: 'wave', label: 'Wave' },
        { id: 'layout-helix', value: 'helix', label: 'Helix' },
        { id: 'layout-cylinder', value: 'cylinder', label: 'Cylinder' },
    ];

    if (photos.length === 0) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center text-neutral-400 gap-4">
                <div className="p-8 rounded-2xl glass border border-white/5 bg-black/20">
                    <p className="text-xl font-medium text-white mb-2">Your Spiral is Empty</p>
                    <p className="text-sm">Upload photos to begin your journey</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full relative">
            {/* HUD / Controls Overlay - Hidden on Mobile */}
            <div className="hidden md:flex absolute left-8 top-1/2 -translate-y-1/2 z-10 flex-col gap-4 pointer-events-none">
                {/* Layout Circle Menu */}
                <div className="pointer-events-auto">
                    <CircleMenu
                        items={[
                            {
                                label: 'Spiral',
                                icon: <Grid3x3 size={16} className="text-white" />,
                                onClick: () => setLayoutMode('spiral'),
                                isActive: layoutMode === 'spiral'
                            },
                            {
                                label: 'Sphere',
                                icon: <Circle size={16} className="text-white" />,
                                onClick: () => setLayoutMode('sphere'),
                                isActive: layoutMode === 'sphere'
                            },
                            {
                                label: 'Particles',
                                icon: <Sparkles size={16} className="text-white" />,
                                onClick: () => setLayoutMode('particles'),
                                isActive: layoutMode === 'particles'
                            },
                            {
                                label: 'Wave',
                                icon: <Waves size={16} className="text-white" />,
                                onClick: () => setLayoutMode('wave'),
                                isActive: layoutMode === 'wave'
                            },
                            {
                                label: 'Helix',
                                icon: <Dna size={16} className="text-white" />,
                                onClick: () => setLayoutMode('helix'),
                                isActive: layoutMode === 'helix'
                            },
                            {
                                label: 'Cylinder',
                                icon: <Cylinder size={16} className="text-white" />,
                                onClick: () => setLayoutMode('cylinder'),
                                isActive: layoutMode === 'cylinder'
                            },
                        ]}
                    />
                </div>
            </div>

            {/* Settings - Positioned at Bottom Left - Hidden on Mobile */}
            <div className="hidden md:flex absolute bottom-24 left-8 z-10 flex-col gap-3 pointer-events-none">
                {/* Settings Button */}
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="px-4 py-3 rounded-full glass bg-black/40 backdrop-blur-md border border-white/10 text-white/80 text-sm hover:text-white hover:bg-white/20 transition-all pointer-events-auto flex items-center gap-2"
                >
                    <Settings size={16} />
                    <span className="hidden md:inline">Settings</span>
                </button>

                {/* Settings Panel */}
                {showSettings && (
                    <div className="p-4 rounded-2xl glass bg-black/80 backdrop-blur-md border border-white/10 pointer-events-auto w-56">
                        <p className="text-xs text-white/50 mb-3 uppercase tracking-wider font-medium">Actions</p>
                        <button
                            onClick={handleClear}
                            className="w-full px-4 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 text-sm font-medium transition-colors border border-red-500/30"
                        >
                            Clear All Photos
                        </button>
                    </div>
                )}
            </div>

            <Canvas camera={{ position: [0, 0, 40], fov: 60 }} gl={{ alpha: true, antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
                <ambientLight intensity={1.5} />
                <pointLight position={[10, 10, 10]} intensity={1.5} />
                <pointLight position={[-10, -10, -10]} intensity={0.5} />
                <SpiralScene photos={photos} layoutMode={layoutMode} />
            </Canvas>
        </div>
    );
}
