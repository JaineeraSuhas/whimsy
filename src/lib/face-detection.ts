import * as faceapi from 'face-api.js';

let modelsLoaded = false;

export interface FaceDetection {
    id: string;
    box: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    descriptor: Float32Array; // face-api.js descriptor (128 dimensions)
    landmarks?: any;
}

/**
 * Load face-api.js models
 */
export async function loadFaceDetectionModel(): Promise<void> {
    if (modelsLoaded) return;

    try {
        console.log('[Face Detection] Loading face-api.js models...');

        // Load models from CDN
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';

        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);

        modelsLoaded = true;
        console.log('[Face Detection] Models loaded successfully');
    } catch (error) {
        console.error('[Face Detection] Failed to load models:', error);
        throw error;
    }
}

/**
 * Detect faces in an image and extract descriptors
 */
export async function detectFaces(imageSource: Blob | HTMLImageElement): Promise<FaceDetection[]> {
    await loadFaceDetectionModel();

    try {
        let img: HTMLImageElement;

        if (imageSource instanceof Blob) {
            // Convert Blob to HTMLImageElement
            img = await new Promise((resolve, reject) => {
                const image = new Image();
                const url = URL.createObjectURL(imageSource);
                image.onload = () => {
                    URL.revokeObjectURL(url);
                    resolve(image);
                };
                image.onerror = reject;
                image.src = url;
            });
        } else {
            img = imageSource;
        }

        console.log('[Face Detection] Detecting faces...');

        // Detect faces with landmarks and descriptors
        const detections = await faceapi
            .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptors();

        console.log(`[Face Detection] Found ${detections.length} faces`);

        // Convert to our format
        const faces: FaceDetection[] = detections.map((detection, index) => {
            const box = detection.detection.box;

            return {
                id: `face-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
                box: {
                    x: box.x,
                    y: box.y,
                    width: box.width,
                    height: box.height,
                },
                descriptor: detection.descriptor as Float32Array,
                landmarks: detection.landmarks,
            };
        });

        return faces;
    } catch (error) {
        console.error('[Face Detection] Error detecting faces:', error);
        return [];
    }
}

/**
 * Calculate Euclidean distance between two face descriptors
 */
export function faceDistance(descriptor1: Float32Array, descriptor2: Float32Array): number {
    return faceapi.euclideanDistance(descriptor1, descriptor2);
}

/**
 * Check if two faces match (lower distance = more similar)
 * Threshold: 0.6 is standard for face-api.js
 */
export function facesMatch(
    descriptor1: Float32Array,
    descriptor2: Float32Array,
    threshold: number = 0.6
): boolean {
    const distance = faceDistance(descriptor1, descriptor2);
    return distance < threshold;
}

/**
 * Extract face thumbnail from image
 */
export async function extractFaceThumbnail(
    imageSource: Blob,
    box: { x: number; y: number; width: number; height: number },
    padding: number = 0.3
): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(imageSource);

        img.onload = () => {
            URL.revokeObjectURL(url);

            // Add padding
            const paddingX = box.width * padding;
            const paddingY = box.height * padding;

            const x = Math.max(0, box.x - paddingX);
            const y = Math.max(0, box.y - paddingY);
            const width = Math.min(img.width - x, box.width + paddingX * 2);
            const height = Math.min(img.height - y, box.height + paddingY * 2);

            // Create canvas and extract face region
            const canvas = document.createElement('canvas');
            const size = 128; // Fixed size for thumbnails
            canvas.width = size;
            canvas.height = size;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Could not get canvas context'));
                return;
            }

            // Draw face region scaled to fixed size
            ctx.drawImage(img, x, y, width, height, 0, 0, size, size);

            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Failed to create thumbnail blob'));
                    }
                },
                'image/jpeg',
                0.9
            );
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image'));
        };

        img.src = url;
    });
}
