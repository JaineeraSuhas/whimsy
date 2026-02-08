
"use client";

import { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Html } from '@react-three/drei';
import * as THREE from 'three';
import { getAllPhotos, Photo, clearAllPhotos } from '@/lib/db';
import { CircleMenu } from '@/components/ui/circle-menu';
import { Grid3x3, Circle, LayoutGrid, Waves, Dna, Cylinder, Settings } from 'lucide-react';

function PhotoMesh({ photo, position, rotation, onClick }: { photo: Photo, position: [number, number, number], rotation: [number, number, number], onClick: (p: Photo) => void }) {
    const meshRef = useRef<THREE.Mesh>(null);
    const [texture, setTexture] = useState<THREE.Texture | null>(null);
    const [hovered, setHovered] = useState(false);
    const { gl } = useThree();

    useEffect(() => {
        const url = URL.createObjectURL(photo.thumbnail);
        const loader = new THREE.TextureLoader();
        loader.load(url, (tex) => {
            tex.anisotropy = gl.capabilities.getMaxAnisotropy();
            tex.minFilter = THREE.LinearMipMapLinearFilter;
            tex.magFilter = THREE.LinearFilter;
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.generateMipmaps = true;
            setTexture(tex);
            URL.revokeObjectURL(url);
        });
    }, [photo, gl]);

    useFrame((state) => {
        if (meshRef.current) {
            // Subtle floating animation
            meshRef.current.position.y += Math.sin(state.clock.elapsedTime + position[0]) * 0.001;
        }
    });

    // Calculate aspect ratio for plane geometry
    const aspect = photo.metadata.width / photo.metadata.height;
    const height = 1.5; // Base height unit
    const width = height * aspect;

    return (
        <group position={position} rotation={rotation}>
            {/* Main Photo Mesh */}
            <mesh
                ref={meshRef}
                onClick={(e) => { e.stopPropagation(); onClick(photo); }}
                onPointerOver={() => { document.body.style.cursor = 'pointer'; setHovered(true); }}
                onPointerOut={() => { document.body.style.cursor = 'auto'; setHovered(false); }}
            >
                <planeGeometry args={[width, height]} />
                <meshBasicMaterial
                    map={texture || undefined}
                    side={THREE.DoubleSide}
                    transparent
                    opacity={hovered ? 1 : 0.9}
                />
            </mesh>

            {/* Border / Frame */}
            <mesh position={[0, 0, -0.01]}>
                <planeGeometry args={[width + 0.05, height + 0.05]} />
                <meshBasicMaterial color={hovered ? "#FF4D00" : "#FFFFFF"} opacity={0.3} transparent />
            </mesh>


        </group>
    );
}

// Helper to get positions based on layout
function getLayoutPositions(photos: Photo[], layout: 'spiral' | 'sphere' | 'grid' | 'wave' | 'helix' | 'cylinder', viewport: { width: number, height: number }) {
    const isMobile = viewport.width < 768; // Simple breakpoint check

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
        else if (layout === 'grid') {
            const cols = isMobile ? 2 : Math.ceil(Math.sqrt(photos.length));
            const spacing = isMobile ? 2.0 : 2.5;
            const x = (index % cols) * spacing - (cols * spacing) / 2;
            const y = Math.floor(index / cols) * spacing - (Math.ceil(photos.length / cols) * spacing) / 2;
            pos = [x, y, 0];
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

        return { photo, position: pos, rotation: rot };
    });
}

function SpiralScene({ photos, layoutMode }: { photos: Photo[], layoutMode: 'spiral' | 'sphere' | 'grid' | 'wave' | 'helix' | 'cylinder' }) {
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

// function PhotoMesh({ photo, position, rotation, onClick }: { photo: Photo, position: [number, number, number], rotation: [number, number, number], onClick: (p: Photo) => void }) {
// ... inside PhotoMesh
//     const loader = new THREE.TextureLoader();
//     loader.load(url, (tex) => {
//         tex.anisotropy = 16;
//         tex.minFilter = THREE.LinearMipMapLinearFilter;
//         tex.magFilter = THREE.LinearFilter;
//         tex.colorSpace = THREE.SRGBColorSpace;
//         setTexture(tex);
//         ...

export default function SpiralCanvas({ photos }: { photos: Photo[] }) {
    const [layoutMode, setLayoutMode] = useState<'spiral' | 'sphere' | 'grid' | 'wave' | 'helix' | 'cylinder'>('spiral');
    const [showSettings, setShowSettings] = useState(false);

    const handleClearStorage = async () => {
        if (confirm('Are you sure you want to delete all photos? This cannot be undone.')) {
            await clearAllPhotos();
            window.location.reload();
        }
    };

    const layoutOptions = [
        { id: 'layout-spiral', value: 'spiral', label: 'Spiral' },
        { id: 'layout-sphere', value: 'sphere', label: 'Sphere' },
        { id: 'layout-grid', value: 'grid', label: 'Grid' },
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
            {/* HUD / Controls Overlay */}
            <div className="absolute left-8 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-4 pointer-events-none">
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
                                label: 'Grid',
                                icon: <LayoutGrid size={16} className="text-white" />,
                                onClick: () => setLayoutMode('grid'),
                                isActive: layoutMode === 'grid'
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

            {/* Settings - Positioned at Bottom Left */}
            <div className="absolute bottom-24 left-8 z-10 flex flex-col gap-3 pointer-events-none">
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
                            onClick={handleClearStorage}
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
