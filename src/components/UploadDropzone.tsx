
"use client";

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { v4 as uuidv4 } from 'uuid';
import EXIF from 'exif-js';
import { savePhoto, Photo } from '@/lib/db';

export default function UploadDropzone({ 
    onUploadComplete, 
    mode = 'default', 
    className, 
    children,
    onProcessingChange 
}: { 
    onUploadComplete?: () => void, 
    mode?: 'default' | 'button', 
    className?: string, 
    children?: React.ReactNode,
    onProcessingChange?: (isProcessing: boolean) => void 
}) {
    const [isProcessing, setIsProcessing] = useState(false);
    
    // Helper to notify parent of processing state
    const updateProcessingState = (state: boolean) => {
        setIsProcessing(state);
        onProcessingChange?.(state);
    };

    const [progress, setProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState('');

    const processFile = async (file: File) => {
        // ... (unchanged code) ...
        return new Promise<void>(async (resolve) => {
            try {
                // 1. Extract EXIF and Coordinates
                let date = file.lastModified;
                let lat: number | null = null;
                let lon: number | null = null;
                
                await new Promise<void>((resolveExif) => {
                    // @ts-expect-error - EXIF typings do not include File
                    EXIF.getData(file as unknown as HTMLImageElement, function (this: HTMLImageElement) {
                        try {
                            const exifDate = EXIF.getTag(this, "DateTimeOriginal") as string | undefined;
                            if (exifDate) {
                                const [datePart, timePart] = exifDate.split(" ");
                                const [year, month, day] = datePart.split(":");
                                const [hour, minute, second] = timePart.split(":");
                                date = new Date(
                                    parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10),
                                    parseInt(hour, 10), parseInt(minute, 10), parseInt(second, 10)
                                ).getTime();
                            }

                            const gpsLat = EXIF.getTag(this, "GPSLatitude");
                            const gpsLatRef = EXIF.getTag(this, "GPSLatitudeRef");
                            const gpsLon = EXIF.getTag(this, "GPSLongitude");
                            const gpsLonRef = EXIF.getTag(this, "GPSLongitudeRef");

                            if (gpsLat && gpsLatRef && gpsLon && gpsLonRef) {
                                const latDeg = gpsLat[0].valueOf();
                                const latMin = gpsLat[1].valueOf();
                                const latSec = gpsLat[2].valueOf();
                                const lonDeg = gpsLon[0].valueOf();
                                const lonMin = gpsLon[1].valueOf();
                                const lonSec = gpsLon[2].valueOf();

                                lat = latDeg + latMin / 60 + latSec / 3600;
                                if (gpsLatRef === "S") lat = -lat;

                                lon = lonDeg + lonMin / 60 + lonSec / 3600;
                                if (gpsLonRef === "W") lon = -lon;
                            }
                        } catch (e) {
                            console.warn("Error parsing EXIF", e);
                        } finally {
                            resolveExif();
                        }
                    });
                });

                let locationString = '';
                if (lat !== null && lon !== null) {
                    try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`, {
                            headers: {
                                'Accept-Language': 'en-US,en;q=0.9',
                            }
                        });
                        if (res.ok) {
                            const data = await res.json();
                            const addr = data.address;
                            if (addr) {
                                const city = addr.city || addr.town || addr.village || addr.county || '';
                                const state = addr.state || '';
                                const country = addr.country || '';
                                locationString = [city, state, country].filter(Boolean).join(', ');
                            }
                        }
                    } catch (e) {
                        console.warn("Reverse geocoding failed", e);
                    }
                }

                // 2. Generate Thumbnail (Canvas) - rudimentary resizing
                const img = new Image();
                let objectUrl = '';

                try {
                    // Check for HEIC/HEIF
                    const isHeic = file.name.toLowerCase().endsWith('.heic') ||
                        file.name.toLowerCase().endsWith('.heif') ||
                        file.type === 'image/heic' ||
                        file.type === 'image/heif';

                    if (isHeic) {
                        // User requested seamless experience: generic status
                        setStatusMessage(`Processing ${file.name}...`);

                        const heic2anyModule = await import('heic2any');
                        const heic2any = heic2anyModule.default;

                        const convertedBlob = await heic2any({
                            blob: file,
                            toType: 'image/jpeg',
                            quality: 0.6 // Aggressive compression for mobile safety
                        });

                        const jpegBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
                        objectUrl = URL.createObjectURL(jpegBlob);
                    } else {
                        objectUrl = URL.createObjectURL(file);
                    }
                } catch (conversionError) {
                    console.error(`[Upload] HEIC conversion failed for ${file.name}`, conversionError);
                    setStatusMessage(`Error: Could not convert ${file.name}`);
                    resolve();
                    return;
                }

                // Safeguard: Timeout if image takes too long to load (e.g., corrupted)
                const loadTimeout = setTimeout(() => {
                    console.warn(`[Upload] Image load timed out: ${file.name}`);
                    setStatusMessage(`Timeout loading ${file.name} - skipping`);
                    img.src = ""; // Cancel load
                    URL.revokeObjectURL(objectUrl);
                    resolve();
                }, 10000);

                img.onload = async () => {
                    clearTimeout(loadTimeout);
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    // Dual-Mode: 640px for Desktop High-End, 160px for Mobile Safety
                    // Unified Resolution: 640px for EVERYONE (Mobile + Desktop)
                    // This ensures face detection works (needs >320px) and photos are visible/crisp
                    const MAX_WIDTH = 640;
                    const scaleSize = MAX_WIDTH / img.width;
                    canvas.width = MAX_WIDTH;
                    canvas.height = img.height * scaleSize;

                    ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

                    canvas.toBlob(async (thumbnailBlob) => {
                        if (!thumbnailBlob) {
                            console.warn(`[Upload] Failed to create thumbnail blob for ${file.name}`);
                            URL.revokeObjectURL(objectUrl);
                            resolve();
                            return;
                        }

                        const photoId = uuidv4();
                        const newPhoto: Photo = {
                            id: photoId,
                            blob: file, // Store original
                            thumbnail: thumbnailBlob,
                            createdAt: Date.now(),
                            metadata: {
                                id: photoId,
                                originalName: file.name,
                                date: date,
                                width: img.width,
                                height: img.height,
                                mimeType: file.type,
                                exif: {
                                    location: locationString || undefined
                                }
                            }
                        };

                        try {
                            // Save photo
                            await savePhoto(newPhoto);
                        } catch (e) {
                            console.warn("Processing failed for", file.name, e);
                            setStatusMessage(`Skipping faulty image: ${file.name}`);
                        } finally {
                            URL.revokeObjectURL(objectUrl);
                            resolve();
                        }

                    }, 'image/jpeg', 0.9);
                };

                img.onerror = () => {
                    clearTimeout(loadTimeout);
                    console.error(`[Upload] Failed to load image: ${file.name} (${file.type}, ${file.size} bytes). Browser may not support this format.`);
                    setStatusMessage(`Error: Browser cannot read ${file.name}`);
                    URL.revokeObjectURL(objectUrl);
                    resolve();
                };

                img.src = objectUrl;

            } catch (error) {
                console.error("Error processing file", file.name, error);
                resolve();
            }
        });
    };

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        updateProcessingState(true);
        setProgress(0);

        let processedCount = 0;

        // Process files sequentially
        for (const file of acceptedFiles) {
            await processFile(file);
            processedCount++;
            setProgress(Math.round((processedCount / acceptedFiles.length) * 100));
        }

        updateProcessingState(false);
        if (onUploadComplete) onUploadComplete();
    }, [onUploadComplete]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/*': ['.heic', '.heif', '.png', '.jpg', '.jpeg', '.webp']
        }
    });

    if (mode === 'button') {
        return (
            <div {...getRootProps()} className={`relative ${isProcessing ? 'pointer-events-none opacity-50' : ''}`}>
                <input {...getInputProps()} />
                <button
                    className={className || "bg-white text-black px-6 py-2 rounded-full text-xs font-bold shadow-xl hover:scale-105 active:scale-95 transition-all whitespace-nowrap"}
                >
                    {isProcessing ? `UPLOADING ${progress}%` : (children || 'ADD PHOTOS')}
                </button>
            </div>
        );
    }

    return (
        <div
            {...getRootProps()}
            className={`
        border-2 border-dashed rounded-2xl py-8 px-6 text-center cursor-pointer transition-colors flex flex-col items-center justify-center min-h-[140px]
        ${isDragActive ? 'border-accent-warm bg-accent-warm/10' : 'border-neutral-700 hover:border-neutral-500 hover:bg-white/[0.02]'}
        ${isProcessing ? 'pointer-events-none opacity-50' : ''}
      `}
        >
            <input {...getInputProps()} />
            {
                isProcessing ? (
                    <div className="flex flex-col items-center">
                        <div className="loading-dots text-accent-warm mb-2">
                            <span></span><span></span><span></span>
                        </div>
                        <p className="text-neutral-400">Processing {progress}%...</p>
                        {statusMessage && (
                            <p className="text-neutral-500 text-xs mt-1">{statusMessage}</p>
                        )}
                    </div>
                ) : isDragActive ? (
                    <p className="text-accent-warm font-medium">Drop photos here...</p>
                ) : (
                    <div className="space-y-2">
                        <p className="text-lg font-medium text-white">Drag & drop photos</p>
                        <p className="text-sm text-neutral-500">or click to select files</p>
                    </div>
                )
            }
        </div>
    );
}
