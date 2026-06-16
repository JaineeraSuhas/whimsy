
"use client";

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { v4 as uuidv4 } from 'uuid';
import EXIF from 'exif-js';
import { savePhoto, Photo } from '@/lib/db';
import { processFacesInPhoto } from '@/lib/face-processing';

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
                // 1. Extract EXIF
                let date = file.lastModified;
                // Basic EXIF extraction (could be enhanced)
                // @ts-expect-error - EXIF typings do not include File
                EXIF.getData(file as unknown as HTMLImageElement, function (this: HTMLImageElement) {
                    const exifDate = EXIF.getTag(this, "DateTimeOriginal") as string | undefined;
                    if (exifDate) {
                        try {
                            const [datePart, timePart] = exifDate.split(" ");
                            const [year, month, day] = datePart.split(":");
                            const [hour, minute, second] = timePart.split(":");
                            const y = parseInt(year, 10);
                            const m = parseInt(month, 10);
                            const d = parseInt(day, 10);
                            const hr = parseInt(hour, 10);
                            const min = parseInt(minute, 10);
                            const sec = parseInt(second, 10);
                            date = new Date(y, m - 1, d, hr, min, sec).getTime();
                        } catch (e) {
                            console.warn("Error parsing EXIF date", e);
                        }
                    }
                });

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
                            }
                        };

                        try {
                            // Save photo first
                            await savePhoto(newPhoto);

                            // Then detect faces in background
                            setStatusMessage(`Detecting faces in ${file.name}...`);
                            await processFacesInPhoto(newPhoto);
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

        // Process files sequentially with delay to prevent mobile Safari crashes (OOM)
        for (const file of acceptedFiles) {
            await processFile(file);
            processedCount++;
            setProgress(Math.round((processedCount / acceptedFiles.length) * 100));

            // Critical: Force 1s delay between files to allow Garbage Collection
            // This prevents "A problem repeatedly occurred" on iOS
            await new Promise(resolve => setTimeout(resolve, 1000));
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
