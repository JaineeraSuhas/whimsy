
import * as tf from '@tensorflow/tfjs';
import * as faceDetection from '@tensorflow-models/face-detection';
import { Photo } from './db';

let detector: faceDetection.FaceDetector | null = null;
const model = faceDetection.SupportedModels.MediaPipeFaceDetector;
const detectorConfig: faceDetection.MediaPipeFaceDetectorMediaPipeModelConfig = {
    runtime: 'tfjs', // or 'mediapipe'
    maxFaces: 10,
};

export const initFaceDetector = async () => {
    if (!detector) {
        await tf.ready();
        detector = await faceDetection.createDetector(model, detectorConfig);
        console.log("Face Detector Initialized");
    }
    return detector;
};

export const detectFaces = async (imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement) => {
    const det = await initFaceDetector();
    if (!det) return [];

    try {
        const faces = await det.estimateFaces(imageElement);
        return faces; // Returns list of { box, keypoints }
    } catch (err) {
        console.error("Face detection failed", err);
        return [];
    }
};

// Function to extract face embedding/descriptor?
// MediaPipe Face Detection just gives boxes. To get embeddings for grouping,
// we normally need 'face-api.js' or 'facemesh' or a recognition model.
// User mentioned "TensorFlow.js face-api.js for face detection".
// face-api.js is a wrapper around tfjs but often old.
// Let's stick to just detection for now to show "Faces" or crop them.
// If true recognition/grouping is needed, we need a recognition model (e.g. FaceNet).
// For now, let's detect faces and crop them as "People" thumbnails.
