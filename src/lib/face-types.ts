import { FaceDetection } from './face-detection';

export interface FaceDetectionWithEmbedding extends FaceDetection {
    embedding: number[]; // For backward compatibility
}

// Update db.ts types to use descriptor instead of embedding
export type { FaceDetection } from './face-detection';
