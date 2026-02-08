
"use client";

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { v4 as uuidv4 } from 'uuid';
import EXIF from 'exif-js';
import { savePhoto, Photo } from '@/lib/db';
import { processFacesInPhoto } from '@/lib/face-processing';
import { loadFaceDetectionModel } from '@/lib/face-detection';

export default function UploadDropzone({ onUploadComplete }: { onUploadComplete?: () => void }) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState('');

    const processFile = async (file: File) => {
        return new Promise<void>(async (resolve) => {
            try {
                // 1. Extract EXIF
                let date = file.lastModified;
                // Basic EXIF extraction (could be enhanced)
                // @ts-ignore
                EXIF.getData(file as any, function () {
                    // @ts-ignore
                    const exifDate = EXIF.getTag(this, "DateTimeOriginal");
                    if (exifDate) {
                        // Parse EXIF date format: "YYYY:MM:DD HH:MM:SS"
                        const [datePart, timePart] = exifDate.split(" ");
                        const [year, month, day] = datePart.split(":");
                        const [hour, minute, second] = timePart.split(":");
                        date = new Date(year, month - 1, day, hour, minute, second).getTime();
                    }
                });

                // 2. Generate Thumbnail (Canvas) - rudimentary resizing
                const img = new Image();
                const objectUrl = URL.createObjectURL(file);

                img.onload = async () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const MAX_WIDTH = 512; // Optimized from 1024 for mobile VRAM safety while maintaining high quality
                    const scaleSize = MAX_WIDTH / img.width;
                    canvas.width = MAX_WIDTH;
                    canvas.height = img.height * scaleSize;

                    ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

                    canvas.toBlob(async (thumbnailBlob) => {
                        if (!thumbnailBlob) return;

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

                        // Save photo first
                        await savePhoto(newPhoto);

                        // Then detect faces in background
                        setStatusMessage('Detecting faces...');
                        try {
                            await processFacesInPhoto(newPhoto);
                        } catch (e) {
                            console.warn("Face detection failed for", file.name, e);
                        }

                        URL.revokeObjectURL(objectUrl);
                        resolve();

                    }, 'image/jpeg', 0.9);
                };
                img.src = objectUrl;

            } catch (error) {
                console.error("Error processing file", file.name, error);
                resolve();
            }
        });
    };

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        setIsProcessing(true);
        setProgress(0);

        let processedCount = 0;

        // Process files sequentially or in small batches to avoid clogging thread
        for (const file of acceptedFiles) {
            await processFile(file);
            processedCount++;
            setProgress(Math.round((processedCount / acceptedFiles.length) * 100));
        }

        setIsProcessing(false);
        if (onUploadComplete) onUploadComplete();
    }, [onUploadComplete]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/*': []
        }
    });

    return (
        <div
            {...getRootProps()}
            className={`
        border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
        ${isDragActive ? 'border-accent-warm bg-accent-warm/10' : 'border-neutral-700 hover:border-neutral-500'}
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
