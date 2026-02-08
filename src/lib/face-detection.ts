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
    score?: number; // Detection confidence score
    quality?: number; // Overall face quality score (0-1)
    skinTone?: { r: number; g: number; b: number }; // Average color of central face region
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

        // Add timeout to prevent hanging forever
        const loadPromise = Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Model loading timed out')), 20000)
        );

        await Promise.race([loadPromise, timeoutPromise]);

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
        const detectionPromise = faceapi
            .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.4 }))
            .withFaceLandmarks()
            .withFaceDescriptors();

        // 10-second timeout for detection
        const detections = await Promise.race([
            detectionPromise,
            new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('Detection timed out')), 10000))
        ]);

        console.log(`[Face Detection] Found ${detections.length} faces`);

        // Convert to our format
        const faces: FaceDetection[] = detections.map((detection) => {
            const box = detection.detection.box;
            const landmarks = detection.landmarks;

            // Sample skin tone and compute quality metrics
            let skinTone = { r: 0, g: 0, b: 0 };
            let quality = 0;

            try {
                const sampleCanvas = document.createElement('canvas');
                sampleCanvas.width = 128; // Standard size for analysis
                sampleCanvas.height = 128;
                const sampleCtx = sampleCanvas.getContext('2d');

                if (sampleCtx) {
                    // Draw face for analysis
                    sampleCtx.drawImage(
                        img,
                        box.x, box.y, box.width, box.height,
                        0, 0, 128, 128
                    );
                    const imageData = sampleCtx.getImageData(0, 0, 128, 128);
                    const data = imageData.data;

                    // 1. Calculate Skin Tone (Center Region)
                    let r = 0, g = 0, b = 0, count = 0;
                    const centerStart = 128 * 40 * 4; // Approx start of center 40%
                    const centerEnd = 128 * 88 * 4;

                    for (let i = centerStart; i < centerEnd; i += 4) {
                        // Simple center crop check (x bounds)
                        const x = (i / 4) % 128;
                        if (x > 40 && x < 88) {
                            r += data[i];
                            g += data[i + 1];
                            b += data[i + 2];
                            count++;
                        }
                    }
                    skinTone = { r: r / count, g: g / count, b: b / count };

                    // 2. Calculate Brightness Score
                    const brightness = (0.299 * skinTone.r + 0.587 * skinTone.g + 0.114 * skinTone.b);
                    let brightnessScore = 0;
                    if (brightness >= 80 && brightness <= 180) {
                        brightnessScore = 1.0;
                    } else {
                        brightnessScore = 1.0 - Math.abs(brightness - 130) / 130.0;
                    }

                    // 3. Calculate Sharpness Score (Laplacian variance approx)
                    // We'll use a simple edge detection check as proxy
                    let edgeSum = 0;
                    for (let i = 0; i < data.length; i += 4) {
                        // Compare with right neighbor (horizontal gradient)
                        if ((i / 4) % 128 < 127) {
                            const diff = Math.abs(data[i] - data[i + 4]);
                            edgeSum += diff;
                        }
                    }
                    const avgEdge = edgeSum / (128 * 128);
                    const sharpnessScore = Math.min(avgEdge / 20.0, 1.0); // Normalize

                    // 4. Calculate Frontality & Symmetry (using landmarks)
                    let frontalityScore = 0.7;
                    let symmetryScore = 0.8;

                    if (landmarks) {
                        const positions = landmarks.positions;
                        const leftEye = positions[36];
                        const rightEye = positions[45];
                        const nose = positions[30];
                        const leftMouth = positions[48];
                        const rightMouth = positions[54];

                        // Frontality: Nose should be centered between eyes
                        const eyeDist = Math.sqrt(Math.pow(leftEye.x - rightEye.x, 2) + Math.pow(leftEye.y - rightEye.y, 2));
                        const midEyeX = (leftEye.x + rightEye.x) / 2;
                        const noseOffset = Math.abs(nose.x - midEyeX);
                        frontalityScore = 1.0 - Math.min(noseOffset / (eyeDist * 0.5), 1.0);

                        // Symmetry: Eye-Nose distances
                        const leftDist = Math.sqrt(Math.pow(leftEye.x - nose.x, 2) + Math.pow(leftEye.y - nose.y, 2));
                        const rightDist = Math.sqrt(Math.pow(rightEye.x - nose.x, 2) + Math.pow(rightEye.y - nose.y, 2));
                        symmetryScore = 1.0 - (Math.abs(leftDist - rightDist) / Math.max(leftDist, rightDist));
                    }

                    // Total Quality Score (Weighted)
                    // Weights: Sharpness 30%, Brightness 20%, Frontality 25%, Resolution 15%, Symmetry 10%
                    // Resolution score is 1.0 since we scaled to standard, but original box matters
                    const resolutionScore = Math.min(box.width / 200, 1.0);

                    quality = (sharpnessScore * 0.30) +
                        (brightnessScore * 0.20) +
                        (frontalityScore * 0.25) +
                        (resolutionScore * 0.15) +
                        (symmetryScore * 0.10);
                }
            } catch (e) {
                console.error('Failed to compute quality metrics', e);
            }

            return {
                id: `face-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                box: {
                    x: box.x,
                    y: box.y,
                    width: box.width,
                    height: box.height,
                },
                descriptor: detection.descriptor as Float32Array,
                landmarks: detection.landmarks,
                score: detection.detection.score, // Base detection confidence
                quality: quality || detection.detection.score, // Use computed quality or fallback
                skinTone,
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
